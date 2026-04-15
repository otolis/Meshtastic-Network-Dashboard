import type { NodeId, NodeStatus, Portnum } from './mesh';

export interface MessageFilter {
  fromNode?: NodeId;
  toNode?: NodeId;
  channel?: number;
  portnum?: Portnum;
  viaMqtt?: boolean;
  /** Free-text query applied to message text (case-insensitive, substring match) */
  query?: string;
  /** Epoch millis — inclusive */
  from?: number;
  /** Epoch millis — inclusive */
  to?: number;
}

export interface StatusFilter {
  status?: NodeStatus;
  query?: string;
}
