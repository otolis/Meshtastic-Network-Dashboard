import { clsx } from 'clsx';
import styles from './TopBar.module.css';
import { useConnectionStatus, useNodes, useSetTimeRange, useTimeRange } from '../../state/hooks';
import { TIME_RANGE_PRESETS } from '../../lib/time';

export function TopBar({ className }: { className?: string }) {
  const status = useConnectionStatus();
  const nodes = useNodes();
  const timeRange = useTimeRange();
  const { setTimeRangePreset } = useSetTimeRange();
  const online = nodes.data.filter((n) => n.status === 'online').length;

  return (
    <header className={clsx(styles.topbar, className)}>
      <div className={styles.title}>
        <span className={styles.titleMain}>Meshtastic Network</span>
        <span className={styles.titleSub}>live topology · telemetry</span>
      </div>
      <div className={styles.center}>
        <span className={statusClass(status)}>
          <span className={styles.pillDot} aria-hidden="true" />
          <span>{status}</span>
        </span>
        <span className={styles.meta}>
          {nodes.loading ? '…' : `${online}/${nodes.data.length} nodes online`}
        </span>
      </div>
      <div className={styles.right}>
        <div className={styles.ranges} role="radiogroup" aria-label="Time range">
          {TIME_RANGE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={timeRange.label === p.label}
              className={clsx(styles.rangeBtn, timeRange.label === p.label && styles.rangeBtnActive)}
              onClick={() => setTimeRangePreset(p.label)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function statusClass(status: string): string {
  const base = styles.pill;
  switch (status) {
    case 'LIVE':
      return clsx(base, styles.pillLive);
    case 'STALE':
      return clsx(base, styles.pillStale);
    case 'OFFLINE':
      return clsx(base, styles.pillOffline);
    case 'MOCK':
    default:
      return clsx(base, styles.pillMock);
  }
}
