import styles from './App.module.css';

export default function App() {
  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <span className={styles.pulse} aria-hidden="true" />
        <h1 className={styles.title}>Meshtastic Network Dashboard</h1>
        <p className={styles.tagline}>Mesh telemetry, live on the wire.</p>
        <p className={styles.status}>Foundation online. Views arriving.</p>
      </div>
    </main>
  );
}
