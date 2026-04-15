import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import styles from './DevicesView.module.css';
import type { Device, NodeStatus } from '../../types';
import { useDevices, useSelection } from '../../state/hooks';
import { formatRelative } from '../../lib/time';

type SortKey = 'shortName' | 'status' | 'role' | 'hwModel' | 'battery' | 'lastSeen' | 'snr';

const COLUMNS: readonly { key: SortKey; label: string }[] = [
  { key: 'shortName', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'role', label: 'Role' },
  { key: 'hwModel', label: 'Hardware' },
  { key: 'battery', label: 'Battery' },
  { key: 'snr', label: 'SNR' },
  { key: 'lastSeen', label: 'Last heard' },
];

export default function DevicesView() {
  const devices = useDevices();
  const { selectDevice, selectNode, kind, id } = useSelection();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.data.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (q) {
        const hay = `${d.shortName} ${d.longName} ${d.id} ${d.hwModel} ${d.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devices.data, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = pickSortValue(a, sortKey);
      const bv = pickSortValue(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * (sortDir === 'asc' ? 1 : -1);
      return String(av).localeCompare(String(bv)) * (sortDir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const counts = useMemo(
    () => ({
      ALL: devices.data.length,
      online: devices.data.filter((d) => d.status === 'online').length,
      stale: devices.data.filter((d) => d.status === 'stale').length,
      offline: devices.data.filter((d) => d.status === 'offline').length,
    }),
    [devices.data],
  );

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.title}>Devices</h1>
        <span className={styles.subtitle}>
          {sorted.length} of {devices.data.length} devices
        </span>
        <div className={styles.filters}>
          <div className={styles.search}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Filter by name, id, hardware…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-shortcut-search
              aria-label="Filter devices"
            />
          </div>
          {(['ALL', 'online', 'stale', 'offline'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={clsx(styles.chip, statusFilter === s && styles.chipActive)}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s.toLowerCase()} · {counts[s]}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.tableWrap}>
        {devices.loading ? (
          <div className={styles.empty}>Loading devices…</div>
        ) : sorted.length === 0 ? (
          <div className={styles.empty}>No devices match those filters</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => onSort(c.key)} scope="col">
                    {c.label}
                    {sortKey === c.key && (
                      <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
                <th scope="col">Locate</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr
                  key={d.id}
                  className={clsx(styles.row, kind === 'device' && id === d.id && styles.rowSelected)}
                  onClick={() => selectDevice(d.id)}
                >
                  <td className={styles.cell}>
                    {d.isFavorite && <span className={styles.favoriteMark} aria-label="favorite">★</span>}
                    <strong>{d.shortName}</strong>{' '}
                    <span style={{ color: 'var(--text-tertiary)' }}>· {d.longName}</span>
                  </td>
                  <td className={styles.cell}>
                    <span
                      className={clsx(
                        styles.status,
                        d.status === 'online'
                          ? styles.statusOnline
                          : d.status === 'stale'
                            ? styles.statusStale
                            : styles.statusOffline,
                      )}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className={styles.cell}>{d.role.toLowerCase().replace(/_/g, ' ')}</td>
                  <td className={styles.cell}>{d.hwModel}</td>
                  <td className={styles.cell}>
                    <BatteryBar level={d.telemetry.batteryLevel} />
                    {Math.round(d.telemetry.batteryLevel)}%
                  </td>
                  <td className={styles.cell}>{d.snr.toFixed(1)} dB</td>
                  <td className={styles.cell}>{formatRelative(d.lastSeen)}</td>
                  <td className={styles.cell}>
                    <button
                      type="button"
                      className={styles.locate}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectNode(d.id);
                        navigate('/network');
                      }}
                      aria-label={`Locate ${d.shortName} on graph`}
                    >
                      ↗ graph
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function BatteryBar({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(100, level));
  const cls =
    pct <= 20 ? styles.batteryLow : pct <= 50 ? styles.batteryMid : styles.batteryFill;
  return (
    <span className={styles.batteryBar} aria-label={`Battery ${Math.round(pct)}%`}>
      <span className={clsx(styles.batteryFill, cls)} style={{ width: `${pct}%` }} />
    </span>
  );
}

function pickSortValue(d: Device, key: SortKey): string | number {
  switch (key) {
    case 'shortName':
      return d.shortName;
    case 'status': {
      const order: Record<string, number> = { online: 0, stale: 1, offline: 2 };
      return order[d.status] ?? 3;
    }
    case 'role':
      return d.role;
    case 'hwModel':
      return d.hwModel;
    case 'battery':
      return d.telemetry.batteryLevel;
    case 'lastSeen':
      return -d.lastSeen;
    case 'snr':
      return d.snr;
  }
}
