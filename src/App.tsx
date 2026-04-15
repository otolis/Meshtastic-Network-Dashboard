import styles from './App.module.css';
import { useConnectionStatus, useNodes, useLiveMessages } from './state/hooks';

/**
 * Phase 2 smoke-test landing page. The real four-view shell lands in Phase 3
 * and replaces this component — the landing page proves the data chain works.
 */
export default function App() {
  const nodes = useNodes();
  const status = useConnectionStatus();
  const liveMessages = useLiveMessages();
  const onlineCount = nodes.data.filter((n) => n.status === 'online').length;

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <span className={styles.pulse} aria-hidden="true" />
        <h1 className={styles.title}>Meshtastic Network Dashboard</h1>
        <p className={styles.tagline}>Mesh telemetry, live on the wire.</p>
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>Source</dt>
            <dd>{status}</dd>
          </div>
          <div className={styles.metric}>
            <dt>Nodes</dt>
            <dd>
              {nodes.loading ? '—' : nodes.error ? 'error' : `${onlineCount}/${nodes.data.length}`}
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>Live msgs</dt>
            <dd>{liveMessages.length}</dd>
          </div>
        </dl>
        <p className={styles.status}>
          {nodes.loading ? 'Booting data source…' : nodes.error ? nodes.error.message : 'Views arriving.'}
        </p>
      </div>
    </main>
  );
}
