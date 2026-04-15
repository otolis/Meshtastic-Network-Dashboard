export type NodeId = string;

export type Role =
  | 'CLIENT'
  | 'CLIENT_MUTE'
  | 'CLIENT_HIDDEN'
  | 'ROUTER'
  | 'ROUTER_CLIENT'
  | 'REPEATER'
  | 'TRACKER'
  | 'SENSOR'
  | 'TAK'
  | 'TAK_TRACKER'
  | 'LOST_AND_FOUND';

export type HwModel =
  | 'TBEAM'
  | 'HELTEC_V3'
  | 'RAK4631'
  | 'STATION_G2'
  | 'T_DECK'
  | 'T_ECHO'
  | 'TLORA_V2_1_1P6';

export type Portnum =
  | 'TEXT_MESSAGE_APP'
  | 'POSITION_APP'
  | 'NODEINFO_APP'
  | 'TELEMETRY_APP'
  | 'NEIGHBORINFO_APP'
  | 'TRACEROUTE_APP'
  | 'ROUTING_APP';

export type Priority = 'BACKGROUND' | 'DEFAULT' | 'RELIABLE' | 'HIGH' | 'ACK';

export type NodeStatus = 'online' | 'stale' | 'offline';

export interface NodeTelemetry {
  batteryLevel: number;
  voltage: number;
  channelUtilization: number;
  airUtilTx: number;
  uptimeSeconds: number;
}

export interface NodePosition {
  latitude: number;
  longitude: number;
  altitude: number;
  precisionMeters: number;
}

export interface Node {
  id: NodeId;
  shortName: string;
  longName: string;
  role: Role;
  hwModel: HwModel;
  firmware: string;
  status: NodeStatus;
  lastSeen: number;
  snr: number;
  rssi: number;
  hopsAway: number;
  telemetry: NodeTelemetry;
  position: NodePosition;
  viaMqtt: boolean;
  isFavorite: boolean;
  /** Relative importance / throughput — encodes node size in the graph */
  throughput: number;
}

export interface Edge {
  id: string;
  source: NodeId;
  target: NodeId;
  snr: number;
  rssi: number;
  /** 0..1 — encodes link strength for edge thickness */
  quality: number;
  lastTrafficAt: number;
  packetCount: number;
  viaMqtt: boolean;
}

export interface Message {
  id: string;
  fromNode: NodeId;
  /** null means broadcast */
  toNode: NodeId | null;
  channel: number;
  portnum: Portnum;
  priority: Priority;
  timestamp: number;
  text: string;
  hopLimit: number;
  hopStart: number;
  rxSnr: number;
  rxRssi: number;
  viaMqtt: boolean;
  pkiEncrypted: boolean;
  /** Hop path as list of node ids from source to destination (inclusive). Null if unknown. */
  path: NodeId[] | null;
}

export interface Device extends Node {
  macAddress: string;
  regionCode: string;
  modemPreset: string;
}

export interface HealthSample {
  timestamp: number;
  nodesTotal: number;
  nodesOnline: number;
  packetLossPct: number;
  avgHops: number;
  avgSnr: number;
  messagesPerHour: number;
}

export interface TimeRange {
  /** Epoch millis inclusive */
  from: number;
  /** Epoch millis inclusive */
  to: number;
  label: string;
}
