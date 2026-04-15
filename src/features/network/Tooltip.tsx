import { clsx } from 'clsx';
import styles from './Tooltip.module.css';
import type { Node } from '../../types';
import { formatRelative } from '../../lib/time';

export function Tooltip({
  node,
  position,
}: {
  node: Node | null;
  position: { x: number; y: number } | null;
}) {
  const visible = !!node && !!position;
  const style = position
    ? { left: position.x, top: position.y }
    : { left: -9999, top: -9999 };

  const chip =
    node?.status === 'online'
      ? styles.chipOnline
      : node?.status === 'stale'
        ? styles.chipStale
        : styles.chipOffline;

  return (
    <div className={clsx(styles.tooltip, visible && styles.visible)} style={style} aria-hidden="true">
      {node && (
        <>
          <div className={styles.header}>
            <span className={styles.name}>{node.shortName}</span>
            <span className={styles.role}>{node.role.toLowerCase().replace(/_/g, ' ')}</span>
          </div>
          <dl className={styles.grid}>
            <dt className={styles.label}>Status</dt>
            <dd className={styles.value}>
              <span className={clsx(styles.statusChip, chip)}>{node.status}</span>
            </dd>
            <dt className={styles.label}>Long name</dt>
            <dd className={styles.value}>{node.longName}</dd>
            <dt className={styles.label}>Hops</dt>
            <dd className={styles.value}>{node.hopsAway}</dd>
            <dt className={styles.label}>SNR</dt>
            <dd className={styles.value}>{node.snr.toFixed(1)} dB</dd>
            <dt className={styles.label}>RSSI</dt>
            <dd className={styles.value}>{node.rssi} dBm</dd>
            <dt className={styles.label}>Battery</dt>
            <dd className={styles.value}>{Math.round(node.telemetry.batteryLevel)}%</dd>
            <dt className={styles.label}>Last heard</dt>
            <dd className={styles.value}>{formatRelative(node.lastSeen)}</dd>
          </dl>
        </>
      )}
    </div>
  );
}
