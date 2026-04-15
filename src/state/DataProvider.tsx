import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ConnectionStatus, MeshEventPayload } from '../data/source';
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
} from '../types';
import { useDataSource } from './DataSourceContext';

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface DataProviderValue {
  connectionStatus: ConnectionStatus;
  nodes: AsyncState<Node[]>;
  edges: AsyncState<Edge[]>;
  allMessages: AsyncState<Message[]>;
  devices: AsyncState<Device[]>;
  /** Latest message stream emitted by MeshDataSource.subscribe, bounded for UI responsiveness */
  liveMessages: Message[];
  /** Fetch a health series for an explicit time range */
  fetchHealthSeries: (range: TimeRange) => Promise<HealthSample[]>;
  /** Fetch a single device by id (async for real-device parity) */
  fetchDeviceById: (id: NodeId) => Promise<Device | null>;
  /** Imperative filter for the messages cache */
  fetchMessages: (filter?: MessageFilter) => Promise<Message[]>;
  /** Imperative devices filter */
  fetchDevices: (filter?: StatusFilter) => Promise<Device[]>;
}

const DataProviderContext = createContext<DataProviderValue | null>(null);

const MAX_LIVE_MESSAGES = 500;

export function DataProvider({ children }: { children: ReactNode }) {
  const source = useDataSource();

  const nodes = useAsyncQuery(() => source.getNodes(), [source]);
  const edges = useAsyncQuery(() => source.getEdges(), [source]);
  const allMessages = useAsyncQuery(() => source.getMessages(), [source]);
  const devices = useAsyncQuery(() => source.getDevices(), [source]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(source.status);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);

  // Open + close the source lifecycle
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await source.connect?.();
        if (alive) setConnectionStatus(source.status);
      } catch (err) {
        if (alive) setConnectionStatus('OFFLINE');
        console.error('MeshDataSource.connect failed', err);
      }
    })();
    return () => {
      alive = false;
      void source.disconnect?.();
    };
  }, [source]);

  // Subscribe to live events and propagate them into per-slice state
  useEffect(() => {
    const unsubStatus = source.subscribe('status:change', (s: MeshEventPayload['status:change']) => {
      setConnectionStatus(s);
    });
    const unsubMessage = source.subscribe('message:new', (m: MeshEventPayload['message:new']) => {
      setLiveMessages((prev) => {
        const next = [m, ...prev];
        if (next.length > MAX_LIVE_MESSAGES) next.length = MAX_LIVE_MESSAGES;
        return next;
      });
      allMessages.mutate((prev) => {
        const next = [m, ...prev];
        if (next.length > 2_000) next.length = 2_000;
        return next;
      });
    });
    const unsubNode = source.subscribe('node:update', (n: MeshEventPayload['node:update']) => {
      nodes.mutate((prev) => prev.map((x) => (x.id === n.id ? n : x)));
    });
    const unsubEdge = source.subscribe('edge:update', (e: MeshEventPayload['edge:update']) => {
      edges.mutate((prev) => prev.map((x) => (x.id === e.id ? e : x)));
    });
    return () => {
      unsubStatus();
      unsubMessage();
      unsubNode();
      unsubEdge();
    };
  }, [source, nodes, edges, allMessages]);

  const fetchHealthSeries = useCallback(
    (range: TimeRange) => source.getHealthSeries(range),
    [source],
  );
  const fetchDeviceById = useCallback((id: NodeId) => source.getDeviceById(id), [source]);
  const fetchMessages = useCallback((filter?: MessageFilter) => source.getMessages(filter), [source]);
  const fetchDevices = useCallback((filter?: StatusFilter) => source.getDevices(filter), [source]);

  const value = useMemo<DataProviderValue>(
    () => ({
      connectionStatus,
      nodes,
      edges,
      allMessages,
      devices,
      liveMessages,
      fetchHealthSeries,
      fetchDeviceById,
      fetchMessages,
      fetchDevices,
    }),
    [
      connectionStatus,
      nodes,
      edges,
      allMessages,
      devices,
      liveMessages,
      fetchHealthSeries,
      fetchDeviceById,
      fetchMessages,
      fetchDevices,
    ],
  );

  return <DataProviderContext.Provider value={value}>{children}</DataProviderContext.Provider>;
}

function useData(): DataProviderValue {
  const v = useContext(DataProviderContext);
  if (!v) throw new Error('DataProvider hooks must be used inside <DataProvider>');
  return v;
}

/** Exposed per-slice hooks — consumer imports only the slice it cares about. */
export const useNodes = () => useData().nodes;
export const useEdges = () => useData().edges;
export const useAllMessages = () => useData().allMessages;
export const useDevices = () => useData().devices;
export const useLiveMessages = () => useData().liveMessages;
export const useConnectionStatus = () => useData().connectionStatus;
export const useFetchHealthSeries = () => useData().fetchHealthSeries;
export const useFetchDeviceById = () => useData().fetchDeviceById;
export const useFetchMessages = () => useData().fetchMessages;
export const useFetchDevices = () => useData().fetchDevices;

// -- internals -----------------------------------------------------

interface InternalAsyncState<T> extends AsyncState<T> {
  mutate(updater: (prev: T) => T): void;
}

function useAsyncQuery<T>(load: () => Promise<T>, deps: unknown[]): InternalAsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const aliveRef = useRef(true);
  // Track load fn so we don't need to re-run if identity is stable
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    loadRef
      .current()
      .then((result) => {
        if (!aliveRef.current) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!aliveRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    aliveRef.current = true;
    run();
    return () => {
      aliveRef.current = false;
    };
  }, [run]);

  const mutate = useCallback((updater: (prev: T) => T) => {
    setData((prev) => (prev === null ? prev : updater(prev)));
  }, []);

  const empty = [] as unknown as T;
  return {
    data: data ?? empty,
    loading,
    error,
    refetch: run,
    mutate,
  };
}
