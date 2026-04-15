import type { ReactNode } from 'react';
import styles from './ViewPlaceholder.module.css';

interface Stat {
  label: string;
  value: string;
}

export function ViewPlaceholder({
  title,
  subtitle,
  tagline,
  stats,
  bulletedFeatures,
  children,
}: {
  title: string;
  subtitle: string;
  tagline: string;
  stats: Stat[];
  bulletedFeatures: string[];
  children?: ReactNode;
}) {
  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        <p className={styles.tagline}>{tagline}</p>
      </header>
      <div className={styles.panel}>
        <dl className={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <dt className={styles.statLabel}>{s.label}</dt>
              <dd className={styles.statValue}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <ul className={styles.features}>
          {bulletedFeatures.map((f, i) => (
            <li key={i} className={styles.featureItem}>
              {f}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}
