import type {
  ConnectionStatus,
  MeshDataSource,
  MeshEvent,
  MeshEventHandler,
  MeshEventPayload,
  Unsubscribe,
} from '../source';
import type {
  Device,
  Edge,
  HealthSample,
  Message,
  MessageFilter,
  Node,
  NodeId,
  StatusFilter,
  TimeRange,
} from '../../types';
import { buildScenario } from './scenario';
import type { Scenario } from './scenario';
import { MINUTE_MS } from '../../lib/time';
import { mulberry32, pick, randomFloat, randomInt, weightedPick } from '../../lib/rng';
import type { Rng } from '../../lib/rng';
import { shortId } from '../../lib/id';

interface MockOptions {
  seed?: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  /** 0..1 — probability a read() rejects to exercise error states */
  errorRate?: number;
  /** Disable the live event stream (useful in tests). */
  enableEventStream?: boolean;
}

/**
 * Mock implementation of MeshDataSource. Holds a coherent in-memory scenario,
 * simulates realistic latency + error rate, emits a bursty live event stream
 * so the UI has real motion from day one.
 */
export class MockDataSource implements MeshDataSource {
  private scenario: Scenario;
  private readonly minLatency: number;
  private readonly maxLatency: number;
  private readonly errorRate: number;
  private readonly enableEventStream: boolean;
  private readonly handlers = new Map<MeshEvent, Set<(payload: unknown) => void>>();
  private eventTimer: ReturnType<typeof setTimeout> | null = null;
  private rng: Rng;
  private _status: ConnectionStatus = 'MOCK';

  constructor(opts: MockOptions = {}) {
    const seed = opts.seed ?? 0x5c80d7a3;
    this.rng = mulberry32(seed ^ 0xa17);
    this.scenario = buildScenario(seed);
    this.minLatency = opts.minLatencyMs ?? 150;
    this.maxLatency = opts.maxLatencyMs ?? 300;
    this.errorRate = opts.errorRate ?? 0.02;
    this.enableEventStream = opts.enableEventStream ?? true;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    this._status = 'MOCK';
    if (this.enableEventStream) this.scheduleNextBurst();
    this.emit('status:change', this._status);
  }

  async disconnect(): Promise<void> {
    if (this.eventTimer) {
      clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }
    this._status = 'OFFLINE';
    this.emit('status:change', this._status);
  }

  async getNodes(): Promise<Node[]> {
    return this.read(() => this.scenario.nodes.slice());
  }

  async getEdges(): Promise<Edge[]> {
    return this.read(() => this.scenario.edges.slice());
  }

  async getMessages(filter?: MessageFilter): Promise<Message[]> {
    return this.read(() => {
      const all = this.scenario.messages;
      if (!filter) return all.slice();
      return all.filter((m) => matchesFilter(m, filter));
    });
  }

  async getHealthSeries(range: TimeRange): Promise<HealthSample[]> {
    return this.read(() =>
      this.scenario.healthSeries.filter((s) => s.timestamp >= range.from && s.timestamp <= range.to),
    );
  }

  async getDevices(filter?: StatusFilter): Promise<Device[]> {
    return this.read(() => {
      const all = this.scenario.devices;
      if (!filter) return all.slice();
      return all.filter((d) => {
        if (filter.status && d.status !== filter.status) return false;
        if (filter.query) {
          const q = filter.query.toLowerCase();
          return (
            d.shortName.toLowerCase().includes(q) ||
            d.longName.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            d.hwModel.toLowerCase().includes(q)
          );
        }
        return true;
      });
    });
  }

  async getDeviceById(id: NodeId): Promise<Device | null> {
    return this.read(() => this.scenario.devices.find((d) => d.id === id) ?? null);
  }

  subscribe<E extends MeshEvent>(event: E, handler: MeshEventHandler<E>): Unsubscribe {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as (payload: unknown) => void);
    };
  }

  private async read<T>(compute: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, randomInt(this.rng, this.minLatency, this.maxLatency)));
    if (this.rng() < this.errorRate) {
      throw new Error('Simulated transient failure — retrying in a moment will usually succeed');
    }
    return compute();
  }

  private emit<E extends MeshEvent>(event: E, payload: MeshEventPayload[E]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) h(payload);
  }

  private scheduleNextBurst(): void {
    const delay = randomInt(this.rng, 2_000, 8_000);
    this.eventTimer = setTimeout(() => {
      this.emitBurst();
      this.scheduleNextBurst();
    }, delay);
  }

  private emitBurst(): void {
    const burstSize = randomInt(this.rng, 2, 6);
    const activeNodes = this.scenario.nodes.filter((n) => n.status !== 'offline');
    for (let i = 0; i < burstSize; i++) {
      const from = pick(this.rng, activeNodes);
      const to = this.rng() < 0.4 ? null : pick(this.rng, activeNodes.filter((n) => n.id !== from.id));
      const template = weightedPick(this.rng, liveMessageWeights());
      const path = to ? this.mutatePath(from.id, to.id) : null;
      const msg: Message = {
        id: shortId(this.rng),
        fromNode: from.id,
        toNode: to?.id ?? null,
        channel: randomInt(this.rng, 0, 2),
        portnum: template.portnum,
        priority: template.priority,
        timestamp: Date.now(),
        text: template.text,
        hopLimit: 7 - (path ? path.length - 1 : 0),
        hopStart: 7,
        rxSnr: Math.round((from.snr + randomFloat(this.rng, -1, 1)) * 10) / 10,
        rxRssi: Math.round(from.rssi + randomFloat(this.rng, -3, 3)),
        viaMqtt: from.viaMqtt && this.rng() < 0.5,
        pkiEncrypted: this.rng() < 0.35,
        path,
      };
      this.scenario.messages.unshift(msg);
      // Keep the log bounded
      if (this.scenario.messages.length > 1500) this.scenario.messages.pop();
      this.emit('message:new', msg);
      if (path) {
        for (let h = 0; h < path.length - 1; h++) {
          const source = path[h];
          const target = path[h + 1];
          if (!source || !target) continue;
          const edge = this.scenario.edges.find(
            (e) => (e.source === source && e.target === target) || (e.source === target && e.target === source),
          );
          if (edge) {
            edge.lastTrafficAt = msg.timestamp;
            edge.packetCount += 1;
            this.emit('edge:update', edge);
          }
        }
      }
    }

    // Occasionally: a node update (battery tick down, SNR wiggle) or a health sample
    if (this.rng() < 0.25) {
      const n = pick(this.rng, activeNodes);
      n.telemetry.batteryLevel = Math.max(0, n.telemetry.batteryLevel - this.rng() * 0.2);
      n.snr = Math.round((n.snr + randomFloat(this.rng, -0.3, 0.3)) * 10) / 10;
      n.lastSeen = Date.now();
      this.emit('node:update', n);
    }
    if (this.rng() < 0.15) {
      const sample: HealthSample = {
        timestamp: Date.now(),
        nodesTotal: this.scenario.nodes.length,
        nodesOnline: activeNodes.length,
        packetLossPct: 2 + this.rng() * 4,
        avgHops: 1.6 + this.rng() * 0.4,
        avgSnr: -6 + (this.rng() - 0.5) * 2,
        messagesPerHour: Math.round(60 + this.rng() * 40),
      };
      this.scenario.healthSeries.push(sample);
      this.emit('health:sample', sample);
    }
  }

  private mutatePath(from: NodeId, to: NodeId): NodeId[] | null {
    // Quick BFS on current edge state
    const adj = new Map<NodeId, NodeId[]>();
    for (const e of this.scenario.edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source)?.push(e.target);
      adj.get(e.target)?.push(e.source);
    }
    const visited = new Set<NodeId>([from]);
    const queue: { id: NodeId; path: NodeId[] }[] = [{ id: from, path: [from] }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const n of adj.get(current.id) ?? []) {
        if (visited.has(n)) continue;
        const newPath = [...current.path, n];
        if (n === to) return newPath;
        visited.add(n);
        queue.push({ id: n, path: newPath });
      }
    }
    return null;
  }
}

function liveMessageWeights(): [{ text: string; portnum: Message['portnum']; priority: Message['priority'] }, number][] {
  return [
    [{ text: 'position update', portnum: 'POSITION_APP', priority: 'DEFAULT' }, 5],
    [{ text: 'battery steady', portnum: 'TELEMETRY_APP', priority: 'BACKGROUND' }, 4],
    [{ text: 'ack', portnum: 'ROUTING_APP', priority: 'ACK' }, 3],
    [{ text: 'hop tick', portnum: 'TRACEROUTE_APP', priority: 'DEFAULT' }, 2],
    [{ text: 'neighbor refresh', portnum: 'NEIGHBORINFO_APP', priority: 'BACKGROUND' }, 3],
    [{ text: 'shift done, heading out', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' }, 2],
    [{ text: 'rain easing', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' }, 1],
    [{ text: 'firmware sync', portnum: 'NODEINFO_APP', priority: 'BACKGROUND' }, 2],
  ];
}

function matchesFilter(m: Message, f: MessageFilter): boolean {
  if (f.fromNode && m.fromNode !== f.fromNode) return false;
  if (f.toNode !== undefined && m.toNode !== f.toNode) return false;
  if (f.channel !== undefined && m.channel !== f.channel) return false;
  if (f.portnum && m.portnum !== f.portnum) return false;
  if (f.viaMqtt !== undefined && m.viaMqtt !== f.viaMqtt) return false;
  if (f.query) {
    const q = f.query.toLowerCase();
    if (!m.text.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
  }
  if (f.from !== undefined && m.timestamp < f.from) return false;
  if (f.to !== undefined && m.timestamp > f.to) return false;
  return true;
}

// Re-export so consumers can pin a seed during tests
export { buildScenario } from './scenario';
export type { Scenario } from './scenario';
export { MINUTE_MS };
