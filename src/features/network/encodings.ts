import type { Node, NodeStatus, Role } from '../../types';

/** Role → color token (CSS variable name). */
export function roleColorVar(role: Role): string {
  switch (role) {
    case 'ROUTER':
      return '--role-router';
    case 'ROUTER_CLIENT':
      return '--role-router';
    case 'REPEATER':
      return '--role-repeater';
    case 'CLIENT':
      return '--role-client';
    case 'CLIENT_MUTE':
      return '--role-client-mute';
    case 'CLIENT_HIDDEN':
      return '--role-client-hidden';
    case 'TRACKER':
      return '--role-tracker';
    case 'SENSOR':
      return '--role-sensor';
    case 'TAK':
      return '--role-tak';
    case 'TAK_TRACKER':
      return '--role-tak-tracker';
    case 'LOST_AND_FOUND':
      return '--role-lost';
    default:
      return '--role-client';
  }
}

/** Returns a CSS color string reading the token at runtime. */
export function roleColor(role: Role): string {
  return `var(${roleColorVar(role)})`;
}

/**
 * Glow intensity 0..1 encoded from SNR.
 * SNR ranges roughly -20 (terrible) to +10 (excellent); clamp and normalize.
 */
export function glowIntensity(node: Node): number {
  if (node.status === 'offline') return 0;
  const normalized = (node.snr + 20) / 30;
  return Math.max(0.05, Math.min(1, normalized));
}

/** Border style for node status. Returned as [stroke, strokeWidth, strokeDasharray]. */
export function statusBorder(status: NodeStatus): { stroke: string; width: number; dash: string | null } {
  switch (status) {
    case 'offline':
      return { stroke: 'var(--status-offline)', width: 1.5, dash: '3 3' };
    case 'stale':
      return { stroke: 'var(--status-stale)', width: 1.2, dash: '2 4' };
    case 'online':
    default:
      return { stroke: 'var(--border-strong)', width: 1, dash: null };
  }
}

/** Used to compute the filter `brightness` / opacity for the glow ring behind a node. */
export function glowOpacity(node: Node): number {
  return 0.25 + glowIntensity(node) * 0.6;
}

export function edgeStroke(quality: number, viaMqtt: boolean): string {
  if (viaMqtt) return 'var(--accent-2)';
  if (quality < 0.25) return 'var(--status-offline)';
  if (quality < 0.5) return 'var(--status-stale)';
  return 'var(--accent)';
}
