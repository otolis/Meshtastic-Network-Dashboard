import type {
  Device,
  Edge,
  HealthSample,
  HwModel,
  Message,
  Node,
  NodeId,
  NodeStatus,
  Portnum,
  Priority,
  Role,
} from '../../types';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../../lib/time';
import { meshId, shortId } from '../../lib/id';
import { gaussian, logNormal, mulberry32, pick, randomFloat, randomInt, weightedPick } from '../../lib/rng';
import type { Rng } from '../../lib/rng';

/**
 * The universe. One coherent story referenced by every view so the dashboard
 * tells a single truth: a hackerspace mesh with a street-facing gateway,
 * a workshop cluster, a rooftop repeater, a garden with mobile trackers,
 * and a few nodes that are having bad days.
 */

const SCENARIO_SEED = 0x5c80d7a3;
const ANCHOR_NOW_MS = Date.UTC(2026, 3, 15, 17, 0, 0); // Stable "now" so snapshots are reproducible in tests

interface NodeTemplate {
  shortName: string;
  longName: string;
  role: Role;
  hwModel: HwModel;
  positionHint: { lat: number; lon: number; altitude: number };
  status: NodeStatus;
  /** Offset applied to lastSeen relative to anchor, in ms */
  lastSeenOffsetMs: number;
  /** Clamped battery override; -1 uses log-normal distribution */
  batteryOverride: number;
  /** Relative throughput weight */
  throughputHint: number;
  firmware: string;
  isFavorite: boolean;
  viaMqtt: boolean;
}

const BASE_LAT = 37.7749;
const BASE_LON = -122.4194;

const NODE_TEMPLATES: readonly NodeTemplate[] = [
  {
    shortName: 'porch',
    longName: 'porch-gateway',
    role: 'ROUTER',
    hwModel: 'STATION_G2',
    positionHint: { lat: BASE_LAT, lon: BASE_LON, altitude: 18 },
    status: 'online',
    lastSeenOffsetMs: -12 * 1000,
    batteryOverride: -1,
    throughputHint: 9,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: true,
    viaMqtt: true,
  },
  {
    shortName: 'roof',
    longName: 'rooftop-solar-repeater',
    role: 'REPEATER',
    hwModel: 'HELTEC_V3',
    positionHint: { lat: BASE_LAT + 0.00012, lon: BASE_LON + 0.00008, altitude: 32 },
    status: 'online',
    lastSeenOffsetMs: -44 * 1000,
    batteryOverride: 92,
    throughputHint: 8,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: true,
    viaMqtt: false,
  },
  {
    shortName: 'shop',
    longName: 'workshop-bench',
    role: 'CLIENT',
    hwModel: 'TBEAM',
    positionHint: { lat: BASE_LAT - 0.00018, lon: BASE_LON + 0.00022, altitude: 8 },
    status: 'online',
    lastSeenOffsetMs: -8 * 1000,
    batteryOverride: -1,
    throughputHint: 5,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'lathe',
    longName: 'workshop-lathe-corner',
    role: 'CLIENT',
    hwModel: 'TBEAM',
    positionHint: { lat: BASE_LAT - 0.00022, lon: BASE_LON + 0.00028, altitude: 7 },
    status: 'online',
    lastSeenOffsetMs: -2 * MINUTE_MS,
    batteryOverride: -1,
    throughputHint: 3,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'atk1',
    longName: 'attic-beacon',
    role: 'CLIENT_MUTE',
    hwModel: 'T_ECHO',
    positionHint: { lat: BASE_LAT + 0.00005, lon: BASE_LON - 0.00004, altitude: 22 },
    status: 'online',
    lastSeenOffsetMs: -30 * 1000,
    batteryOverride: -1,
    throughputHint: 2,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'grdn',
    longName: 'garden-sensor',
    role: 'SENSOR',
    hwModel: 'RAK4631',
    positionHint: { lat: BASE_LAT - 0.00032, lon: BASE_LON - 0.00012, altitude: 6 },
    status: 'online',
    lastSeenOffsetMs: -5 * MINUTE_MS,
    batteryOverride: 78,
    throughputHint: 2,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'trk1',
    longName: 'tracker-bike-alpha',
    role: 'TRACKER',
    hwModel: 'T_DECK',
    positionHint: { lat: BASE_LAT + 0.00084, lon: BASE_LON - 0.00062, altitude: 12 },
    status: 'online',
    lastSeenOffsetMs: -3 * MINUTE_MS,
    batteryOverride: -1,
    throughputHint: 4,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: true,
    viaMqtt: false,
  },
  {
    shortName: 'trk2',
    longName: 'tracker-dog-harness',
    role: 'TRACKER',
    hwModel: 'T_DECK',
    positionHint: { lat: BASE_LAT + 0.00044, lon: BASE_LON + 0.00051, altitude: 11 },
    status: 'online',
    lastSeenOffsetMs: -7 * MINUTE_MS,
    batteryOverride: 12, // low-battery outlier
    throughputHint: 4,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: true,
    viaMqtt: false,
  },
  {
    shortName: 'tak1',
    longName: 'tak-field-one',
    role: 'TAK',
    hwModel: 'TBEAM',
    positionHint: { lat: BASE_LAT + 0.00101, lon: BASE_LON + 0.00072, altitude: 14 },
    status: 'online',
    lastSeenOffsetMs: -18 * 1000,
    batteryOverride: -1,
    throughputHint: 5,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'nbr1',
    longName: 'neighbor-3rd-street',
    role: 'CLIENT',
    hwModel: 'HELTEC_V3',
    positionHint: { lat: BASE_LAT - 0.00091, lon: BASE_LON - 0.00084, altitude: 10 },
    status: 'online',
    lastSeenOffsetMs: -55 * 1000,
    batteryOverride: -1,
    throughputHint: 3,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'nbr2',
    longName: 'neighbor-oak-ave',
    role: 'CLIENT_HIDDEN',
    hwModel: 'TLORA_V2_1_1P6',
    positionHint: { lat: BASE_LAT + 0.00082, lon: BASE_LON - 0.00118, altitude: 9 },
    status: 'online',
    lastSeenOffsetMs: -90 * 1000,
    batteryOverride: -1,
    throughputHint: 2,
    firmware: '2.5.19.e28a1d4',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'hub2',
    longName: 'hackerspace-hub',
    role: 'ROUTER_CLIENT',
    hwModel: 'STATION_G2',
    positionHint: { lat: BASE_LAT - 0.00061, lon: BASE_LON + 0.00071, altitude: 19 },
    status: 'online',
    lastSeenOffsetMs: -6 * 1000,
    batteryOverride: -1,
    throughputHint: 7,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: true,
    viaMqtt: true,
  },
  {
    shortName: 'bldr',
    longName: 'boulder-camp-trk',
    role: 'TAK_TRACKER',
    hwModel: 'T_DECK',
    positionHint: { lat: BASE_LAT + 0.00213, lon: BASE_LON - 0.00188, altitude: 28 },
    status: 'online',
    lastSeenOffsetMs: -9 * MINUTE_MS,
    batteryOverride: -1,
    throughputHint: 3,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'lab1',
    longName: 'bench-lab',
    role: 'CLIENT',
    hwModel: 'RAK4631',
    positionHint: { lat: BASE_LAT - 0.00024, lon: BASE_LON - 0.00038, altitude: 7 },
    status: 'online',
    lastSeenOffsetMs: -21 * 1000,
    batteryOverride: -1,
    throughputHint: 3,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'strm',
    longName: 'storm-damaged-back-yard',
    role: 'CLIENT',
    hwModel: 'TBEAM',
    positionHint: { lat: BASE_LAT - 0.00055, lon: BASE_LON - 0.00091, altitude: 8 },
    status: 'offline',
    lastSeenOffsetMs: -3.2 * HOUR_MS,
    batteryOverride: 8, // failing
    throughputHint: 1,
    firmware: '2.5.18.5c1e9f2',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'prch',
    longName: 'side-porch-prototype',
    role: 'CLIENT',
    hwModel: 'TLORA_V2_1_1P6',
    positionHint: { lat: BASE_LAT + 0.00015, lon: BASE_LON - 0.00041, altitude: 8 },
    status: 'stale',
    lastSeenOffsetMs: -42 * MINUTE_MS, // stale: > 15min < 24h
    batteryOverride: -1,
    throughputHint: 2,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
  {
    shortName: 'mqt1',
    longName: 'mqtt-gateway-west',
    role: 'ROUTER',
    hwModel: 'STATION_G2',
    positionHint: { lat: BASE_LAT - 0.00138, lon: BASE_LON + 0.00152, altitude: 22 },
    status: 'online',
    lastSeenOffsetMs: -3 * 1000,
    batteryOverride: -1,
    throughputHint: 6,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: true,
  },
  {
    shortName: 'rng1',
    longName: 'ranger-tracker',
    role: 'TRACKER',
    hwModel: 'T_DECK',
    positionHint: { lat: BASE_LAT + 0.00174, lon: BASE_LON + 0.00208, altitude: 16 },
    status: 'online',
    lastSeenOffsetMs: -14 * MINUTE_MS,
    batteryOverride: -1,
    throughputHint: 3,
    firmware: '2.5.20.a7c9b3f',
    isFavorite: false,
    viaMqtt: false,
  },
];

// Which nodes can hear which — explicit adjacency keeps cross-view coherence trustworthy.
// shortName pairs; derive edges from these so Messages hop-paths align with the graph.
const ADJACENCY: readonly [string, string][] = [
  ['porch', 'roof'],
  ['porch', 'shop'],
  ['porch', 'hub2'],
  ['porch', 'nbr1'],
  ['porch', 'nbr2'],
  ['porch', 'mqt1'],
  ['roof', 'hub2'],
  ['roof', 'atk1'],
  ['roof', 'tak1'],
  ['roof', 'rng1'],
  ['shop', 'lathe'],
  ['shop', 'hub2'],
  ['shop', 'lab1'],
  ['shop', 'grdn'],
  ['hub2', 'lab1'],
  ['hub2', 'mqt1'],
  ['atk1', 'trk1'],
  ['grdn', 'trk2'],
  ['trk1', 'trk2'],
  ['tak1', 'bldr'],
  ['tak1', 'rng1'],
  ['roof', 'bldr'],
  ['prch', 'porch'],
  ['strm', 'shop'],
];

const MESSAGE_TEMPLATES: readonly { text: string; portnum: Portnum; priority: Priority }[] = [
  { text: 'position update', portnum: 'POSITION_APP', priority: 'DEFAULT' },
  { text: 'battery 62%, rising', portnum: 'TELEMETRY_APP', priority: 'BACKGROUND' },
  { text: 'heading home', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
  { text: 'anyone near the south gate?', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
  { text: 'copy that', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
  { text: 'soldering iron back in drawer', portnum: 'TEXT_MESSAGE_APP', priority: 'BACKGROUND' },
  { text: 'temp 18.2C hum 54%', portnum: 'TELEMETRY_APP', priority: 'BACKGROUND' },
  { text: 'new firmware 2.5.20 ready', portnum: 'TEXT_MESSAGE_APP', priority: 'RELIABLE' },
  { text: 'traceroute: 4 hops', portnum: 'TRACEROUTE_APP', priority: 'DEFAULT' },
  { text: 'neighbor info update', portnum: 'NEIGHBORINFO_APP', priority: 'BACKGROUND' },
  { text: 'ack', portnum: 'ROUTING_APP', priority: 'ACK' },
  { text: 'node info refresh', portnum: 'NODEINFO_APP', priority: 'BACKGROUND' },
  { text: 'bike at shop, locking up', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
  { text: 'rain incoming, bringing gear in', portnum: 'TEXT_MESSAGE_APP', priority: 'HIGH' },
  { text: '10-4', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
  { text: 'channel util 18.3%', portnum: 'TELEMETRY_APP', priority: 'BACKGROUND' },
  { text: 'packet loss spike, investigating', portnum: 'TEXT_MESSAGE_APP', priority: 'HIGH' },
  { text: 'hackerspace open until 21:00', portnum: 'TEXT_MESSAGE_APP', priority: 'DEFAULT' },
];

export interface Scenario {
  nodes: Node[];
  edges: Edge[];
  messages: Message[];
  devices: Device[];
  healthSeries: HealthSample[];
  anchorNow: number;
}

export function buildScenario(seed: number = SCENARIO_SEED, nowMs: number = ANCHOR_NOW_MS): Scenario {
  const rng = mulberry32(seed);
  const nodes = buildNodes(rng, nowMs);
  const edges = buildEdges(rng, nodes, nowMs);
  const messages = buildMessages(rng, nodes, edges, nowMs);
  const devices = buildDevices(rng, nodes);
  const healthSeries = buildHealthSeries(rng, nodes, messages, nowMs);
  return { nodes, edges, messages, devices, healthSeries, anchorNow: nowMs };
}

function buildNodes(rng: Rng, nowMs: number): Node[] {
  return NODE_TEMPLATES.map((t) => {
    const id = meshId(rng);
    const battery = t.batteryOverride >= 0 ? t.batteryOverride : Math.round(logNormal(rng, Math.log(65), 0.35, 20, 99));
    const voltage = 3.2 + (battery / 100) * 1.0;
    const snr = t.status === 'offline' ? -20 : Math.round(gaussian(rng, -6, 4) * 10) / 10;
    const rssi = t.status === 'offline' ? -120 : Math.round(gaussian(rng, -90, 12));
    const hopsAway = pickHopsAway(rng, t.shortName);
    const lastSeen = nowMs + t.lastSeenOffsetMs;
    return {
      id,
      shortName: t.shortName,
      longName: t.longName,
      role: t.role,
      hwModel: t.hwModel,
      firmware: t.firmware,
      status: t.status,
      lastSeen,
      snr,
      rssi,
      hopsAway,
      telemetry: {
        batteryLevel: battery,
        voltage: Math.round(voltage * 100) / 100,
        channelUtilization: Math.round(logNormal(rng, Math.log(14), 0.5, 2, 42) * 10) / 10,
        airUtilTx: Math.round(logNormal(rng, Math.log(4), 0.6, 0.2, 20) * 10) / 10,
        uptimeSeconds: Math.round(logNormal(rng, Math.log(3 * 86400), 0.8, 300, 30 * 86400)),
      },
      position: {
        latitude: t.positionHint.lat + randomFloat(rng, -0.00004, 0.00004),
        longitude: t.positionHint.lon + randomFloat(rng, -0.00004, 0.00004),
        altitude: t.positionHint.altitude,
        precisionMeters: t.role === 'TRACKER' || t.role === 'TAK_TRACKER' ? 12 : 50,
      },
      viaMqtt: t.viaMqtt,
      isFavorite: t.isFavorite,
      throughput: t.throughputHint + randomFloat(rng, -0.5, 0.5),
    } satisfies Node;
  });
}

function pickHopsAway(rng: Rng, shortName: string): number {
  if (shortName === 'porch' || shortName === 'hub2' || shortName === 'roof') return 0;
  if (shortName === 'bldr' || shortName === 'rng1') return randomInt(rng, 2, 3);
  return randomInt(rng, 1, 2);
}

function buildEdges(rng: Rng, nodes: Node[], nowMs: number): Edge[] {
  const byShort = new Map<string, Node>();
  for (const n of nodes) byShort.set(n.shortName, n);
  const edges: Edge[] = [];
  for (const [a, b] of ADJACENCY) {
    const na = byShort.get(a);
    const nb = byShort.get(b);
    if (!na || !nb) continue;
    const baseSnr = (na.snr + nb.snr) / 2;
    const snr = Math.round((baseSnr + randomFloat(rng, -1.5, 1.5)) * 10) / 10;
    const rssi = Math.round((na.rssi + nb.rssi) / 2 + randomFloat(rng, -4, 4));
    const quality = clamp01(0.5 + snr / 30);
    const lastTrafficOffset = na.status === 'offline' || nb.status === 'offline'
      ? -2 * HOUR_MS
      : -randomInt(rng, 5, 300) * 1000;
    edges.push({
      id: shortId(rng),
      source: na.id,
      target: nb.id,
      snr,
      rssi,
      quality,
      lastTrafficAt: nowMs + lastTrafficOffset,
      packetCount: randomInt(rng, 12, 2400),
      viaMqtt: na.viaMqtt && nb.viaMqtt,
    });
  }
  return edges;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function buildMessages(rng: Rng, nodes: Node[], edges: Edge[], nowMs: number): Message[] {
  const activeNodes = nodes.filter((n) => n.status !== 'offline');
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const messages: Message[] = [];

  // Bursty timeline over last 24h — walk backwards from "now" accumulating gaps.
  let ts = nowMs;
  while (ts > nowMs - DAY_MS) {
    const burstSize = randomInt(rng, 2, 7);
    let burstTs = ts;
    for (let i = 0; i < burstSize && burstTs > nowMs - DAY_MS; i++) {
      const from = pick(rng, activeNodes);
      const to = rng() < 0.35 ? null : pick(rng, activeNodes.filter((n) => n.id !== from.id));
      const template = weightedPick(rng, buildMessageWeights());
      const path = to ? computePath(from, to, edges, nodeById, rng) : null;
      const hopStart = 7;
      const hopLimit = Math.max(0, hopStart - (path ? path.length - 1 : randomInt(rng, 0, 3)));
      messages.push({
        id: shortId(rng),
        fromNode: from.id,
        toNode: to?.id ?? null,
        channel: randomInt(rng, 0, 2),
        portnum: template.portnum,
        priority: template.priority,
        timestamp: burstTs,
        text: template.text,
        hopLimit,
        hopStart,
        rxSnr: Math.round((from.snr + randomFloat(rng, -1, 1)) * 10) / 10,
        rxRssi: Math.round(from.rssi + randomFloat(rng, -3, 3)),
        viaMqtt: from.viaMqtt && rng() < 0.5,
        pkiEncrypted: rng() < 0.35,
        path,
      });
      burstTs -= randomInt(rng, 1_200, 28_000);
    }
    // Gap before next burst: 3–15 minutes
    ts = burstTs - randomInt(rng, 3 * MINUTE_MS, 15 * MINUTE_MS);
  }

  // Sort newest-first
  messages.sort((a, b) => b.timestamp - a.timestamp);
  return messages;
}

function buildMessageWeights(): [(typeof MESSAGE_TEMPLATES)[number], number][] {
  return MESSAGE_TEMPLATES.map((t) => {
    // Weight telemetry/background heavier than text — realistic packet mix
    if (t.portnum === 'TEXT_MESSAGE_APP') return [t, 2] as [typeof t, number];
    if (t.portnum === 'TELEMETRY_APP') return [t, 3] as [typeof t, number];
    if (t.portnum === 'POSITION_APP') return [t, 4] as [typeof t, number];
    if (t.portnum === 'NODEINFO_APP') return [t, 2] as [typeof t, number];
    if (t.portnum === 'NEIGHBORINFO_APP') return [t, 2] as [typeof t, number];
    if (t.portnum === 'TRACEROUTE_APP') return [t, 1] as [typeof t, number];
    return [t, 1] as [typeof t, number];
  });
}

function computePath(
  from: Node,
  to: Node,
  edges: Edge[],
  nodeById: Map<NodeId, Node>,
  rng: Rng,
): NodeId[] | null {
  if (from.id === to.id) return [from.id];
  // Simple BFS along the adjacency graph, jitter by shuffling neighbors
  const adj = new Map<NodeId, NodeId[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  const visited = new Set<NodeId>([from.id]);
  const queue: { id: NodeId; path: NodeId[] }[] = [{ id: from.id, path: [from.id] }];
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const neighbors = adj.get(id) ?? [];
    const shuffled = [...neighbors].sort(() => rng() - 0.5);
    for (const n of shuffled) {
      if (visited.has(n)) continue;
      const next = nodeById.get(n);
      if (!next || next.status === 'offline') continue;
      const newPath = [...path, n];
      if (n === to.id) return newPath;
      visited.add(n);
      queue.push({ id: n, path: newPath });
    }
  }
  return null;
}

function buildDevices(rng: Rng, nodes: Node[]): Device[] {
  return nodes.map((n) => ({
    ...n,
    macAddress: Array.from({ length: 6 })
      .map(() => Math.floor(rng() * 256).toString(16).padStart(2, '0'))
      .join(':'),
    regionCode: 'US',
    modemPreset: 'LONG_FAST',
  }));
}

function buildHealthSeries(
  rng: Rng,
  nodes: Node[],
  messages: Message[],
  nowMs: number,
): HealthSample[] {
  const samples: HealthSample[] = [];
  const sampleCount = 24 * 60; // one sample per minute for 24h
  const totalNodes = nodes.length;
  const onlineBaseline = nodes.filter((n) => n.status === 'online').length;

  // Bin messages per minute so messagesPerHour is coherent with the log
  const msgByMinute = new Map<number, number>();
  for (const m of messages) {
    const key = Math.floor(m.timestamp / MINUTE_MS);
    msgByMinute.set(key, (msgByMinute.get(key) ?? 0) + 1);
  }

  for (let i = sampleCount; i >= 0; i--) {
    const t = nowMs - i * MINUTE_MS;
    const minuteKey = Math.floor(t / MINUTE_MS);
    // Aggregate the last 60 minutes into messagesPerHour
    let msgLastHour = 0;
    for (let j = 0; j < 60; j++) {
      msgLastHour += msgByMinute.get(minuteKey - j) ?? 0;
    }
    const onlineJitter = Math.round(gaussian(rng, 0, 0.4));
    const nodesOnline = Math.max(0, Math.min(totalNodes, onlineBaseline + onlineJitter));
    samples.push({
      timestamp: t,
      nodesTotal: totalNodes,
      nodesOnline,
      packetLossPct: clamp01(0.03 + gaussian(rng, 0, 0.012)) * 100,
      avgHops: 1.5 + Math.abs(gaussian(rng, 0, 0.25)),
      avgSnr: -6 + gaussian(rng, 0, 1.2),
      messagesPerHour: msgLastHour,
    });
  }
  return samples.reverse();
}
