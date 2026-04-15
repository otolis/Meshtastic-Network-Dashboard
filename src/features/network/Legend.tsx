import { useState } from 'react';
import { clsx } from 'clsx';
import styles from './Legend.module.css';

const ROLES: readonly { label: string; color: string }[] = [
  { label: 'Router', color: 'var(--role-router)' },
  { label: 'Repeater', color: 'var(--role-repeater)' },
  { label: 'Client', color: 'var(--role-client)' },
  { label: 'Tracker', color: 'var(--role-tracker)' },
  { label: 'Sensor', color: 'var(--role-sensor)' },
  { label: 'TAK', color: 'var(--role-tak)' },
];

const EDGES: readonly { label: string; color: string; style: string }[] = [
  { label: 'Strong link', color: 'var(--accent)', style: 'solid' },
  { label: 'Medium link', color: 'var(--status-stale)', style: 'solid' },
  { label: 'Weak link', color: 'var(--status-offline)', style: 'dashed' },
  { label: 'MQTT gateway', color: 'var(--accent-2)', style: 'dashed' },
];

export function Legend() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={clsx(styles.legend, collapsed && styles.collapsed)}
      aria-label="Graph legend"
    >
      <div className={styles.header}>
        <span>Legend</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Role</span>
            {ROLES.map((r) => (
              <div key={r.label} className={styles.row}>
                <span className={styles.swatch} style={{ background: r.color, color: r.color }} />
                <span className={styles.rowLabel}>{r.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Links</span>
            {EDGES.map((e) => (
              <div key={e.label} className={styles.row}>
                <span
                  className={styles.edgeSample}
                  style={{ color: e.color, borderTopStyle: e.style as 'solid' | 'dashed' }}
                />
                <span className={styles.rowLabel}>{e.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Node</span>
            <div className={styles.row}>
              <span style={{ color: 'var(--accent)', fontSize: '0.64rem' }}>size</span>
              <span className={styles.rowLabel}>throughput</span>
            </div>
            <div className={styles.row}>
              <span style={{ color: 'var(--accent)', fontSize: '0.64rem' }}>glow</span>
              <span className={styles.rowLabel}>SNR strength</span>
            </div>
            <div className={styles.row}>
              <span style={{ color: 'var(--status-stale)', fontSize: '0.64rem' }}>—</span>
              <span className={styles.rowLabel}>stale (dashed)</span>
            </div>
            <div className={styles.row}>
              <span style={{ color: 'var(--status-offline)', fontSize: '0.64rem' }}>—</span>
              <span className={styles.rowLabel}>offline (dashed, dim)</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
