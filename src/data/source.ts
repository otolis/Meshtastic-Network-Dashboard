import type {
  Device,
  Edge,
  HealthSample,
  Message,
  MessageFilter,
  Node,
  NodeId,
  NodeStatus,
  StatusFilter,
  TimeRange,
} from '../types';

export type MeshEvent =
  | 'node:update'
  | 'edge:update'
  | 'message:new'
  | 'health:sample'
  | 'status:change';

export interface MeshEventPayload {
  'node:update': Node;
  'edge:update': Edge;
  'message:new': Message;
  'health:sample': HealthSample;
  'status:change': ConnectionStatus;
}

export type MeshEventHandler<E extends MeshEvent> = (payload: MeshEventPayload[E]) => void;

export type Unsubscribe = () => void;

export type ConnectionStatus = 'LIVE' | 'STALE' | 'OFFLINE' | 'MOCK';

/**
 * The one seam between the UI and any data origin (mock today, real devices tomorrow).
 *
 * Reads are Promise-returning so the UI exercises loading/error paths from day one.
 * Events are callback-based — zero deps, plays nicely with React useEffect cleanup.
 *
 * All real implementations MUST honor error states; throwing synchronously is a bug.
 */
export interface MeshDataSource {
  getNodes(): Promise<Node[]>;
  getEdges(): Promise<Edge[]>;
  getMessages(filter?: MessageFilter): Promise<Message[]>;
  getHealthSeries(range: TimeRange): Promise<HealthSample[]>;
  getDevices(filter?: StatusFilter): Promise<Device[]>;
  getDeviceById(id: NodeId): Promise<Device | null>;

  subscribe<E extends MeshEvent>(event: E, handler: MeshEventHandler<E>): Unsubscribe;

  /** Optional lifecycle — mock is no-op; real impl opens socket/BLE/serial. */
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;

  /** Current connection status — drives the live status pill in the top bar. */
  readonly status: ConnectionStatus;
}

export type { NodeStatus };
