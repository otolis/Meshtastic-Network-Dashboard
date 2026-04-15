import { formatDistanceToNowStrict } from 'date-fns';
import type { TimeRange } from '../types';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const TIME_RANGE_PRESETS: readonly { label: string; durationMs: number }[] = [
  { label: '5m', durationMs: 5 * MINUTE_MS },
  { label: '15m', durationMs: 15 * MINUTE_MS },
  { label: '1h', durationMs: HOUR_MS },
  { label: '6h', durationMs: 6 * HOUR_MS },
  { label: '24h', durationMs: DAY_MS },
  { label: '7d', durationMs: 7 * DAY_MS },
];

/** Build a TimeRange relative to a given "now" anchor. */
export function makeRange(nowMs: number, label: string, durationMs: number): TimeRange {
  return { from: nowMs - durationMs, to: nowMs, label };
}

/** Convenience: build a TimeRange ending at the current wall-clock time. */
export function rangeEndingNow(label: string, durationMs: number): TimeRange {
  return makeRange(Date.now(), label, durationMs);
}

export function isWithinRange(timestamp: number, range: TimeRange): boolean {
  return timestamp >= range.from && timestamp <= range.to;
}

export function formatRelative(timestamp: number, nowMs: number = Date.now()): string {
  if (timestamp > nowMs) return 'in the future';
  const delta = nowMs - timestamp;
  if (delta < MINUTE_MS) return 'just now';
  return `${formatDistanceToNowStrict(timestamp, { addSuffix: false })} ago`;
}

export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
