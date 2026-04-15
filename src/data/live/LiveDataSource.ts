import type {
  ConnectionStatus,
  MeshDataSource,
  MeshEvent,
  MeshEventHandler,
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

const NOT_IMPLEMENTED = 'LiveDataSource: real-device integration is a v2 milestone. Swap `new MockDataSource()` for `new LiveDataSource(...)` in src/app/Providers.tsx when the adapter lands.';

/**
 * v2 stub. The interface is intentionally identical to MockDataSource so the
 * future real-device implementation (WebSerial / WebBluetooth / MQTT) becomes
 * a single-line swap in Providers.tsx. Leaving this present in v1 enforces the
 * contract at compile time.
 */
export class LiveDataSource implements MeshDataSource {
  readonly status: ConnectionStatus = 'OFFLINE';

  constructor(_options: { url?: string; serial?: boolean } = {}) {
    void _options;
  }

  getNodes(): Promise<Node[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  getEdges(): Promise<Edge[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  getMessages(_filter?: MessageFilter): Promise<Message[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  getHealthSeries(_range: TimeRange): Promise<HealthSample[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  getDevices(_filter?: StatusFilter): Promise<Device[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  getDeviceById(_id: NodeId): Promise<Device | null> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  subscribe<E extends MeshEvent>(_event: E, _handler: MeshEventHandler<E>): Unsubscribe {
    return () => undefined;
  }

  connect(): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED));
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
