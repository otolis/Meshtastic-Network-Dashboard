import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { clsx } from 'clsx';
import styles from './HealthView.module.css';
import type { HealthSample } from '../../types';
import { useFetchHealthSeries, useNodes, useTimeRange } from '../../state/hooks';

export default function HealthView() {
  const range = useTimeRange();
  const fetch = useFetchHealthSeries();
  const nodes = useNodes();
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(range)
      .then((s) => {
        if (alive) {
          setSamples(s);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e.message : 'fetch failed');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [range, fetch]);

  const latest = samples[samples.length - 1];
  const prev = samples[Math.max(0, samples.length - 2)];

  const chartData = useMemo(
    () =>
      samples.map((s) => ({
        t: s.timestamp,
        messagesPerHour: Math.round(s.messagesPerHour),
        packetLoss: Number(s.packetLossPct.toFixed(2)),
        online: s.nodesOnline,
        snr: Number(s.avgSnr.toFixed(2)),
      })),
    [samples],
  );

  if (error) {
    return (
      <section className={styles.view}>
        <header className={styles.header}>
          <h1 className={styles.title}>Mesh Health</h1>
          <span className={styles.subtitle}>⚠ {error}</span>
        </header>
      </section>
    );
  }

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mesh Health</h1>
        <span className={styles.subtitle}>
          range {range.label} · {samples.length} samples
        </span>
      </header>

      <div className={styles.cards}>
        <MetricCard
          label="Nodes"
          value={latest ? `${latest.nodesOnline}/${latest.nodesTotal}` : '—'}
          prev={prev ? prev.nodesOnline : undefined}
          curr={latest ? latest.nodesOnline : undefined}
          unit="online"
        />
        <MetricCard
          label="Msg / hour"
          value={latest ? String(latest.messagesPerHour) : '—'}
          prev={prev?.messagesPerHour}
          curr={latest?.messagesPerHour}
        />
        <MetricCard
          label="Packet loss"
          value={latest ? `${latest.packetLossPct.toFixed(1)}` : '—'}
          prev={prev?.packetLossPct}
          curr={latest?.packetLossPct}
          unit="%"
          inversed
        />
        <MetricCard
          label="Avg SNR"
          value={latest ? latest.avgSnr.toFixed(1) : '—'}
          prev={prev?.avgSnr}
          curr={latest?.avgSnr}
          unit="dB"
        />
        <MetricCard
          label="Avg hops"
          value={latest ? latest.avgHops.toFixed(2) : '—'}
          prev={prev?.avgHops}
          curr={latest?.avgHops}
          inversed
        />
        <MetricCard label="Favorites" value={String(nodes.data.filter((n) => n.isFavorite).length)} />
        <MetricCard label="MQTT-gated" value={String(nodes.data.filter((n) => n.viaMqtt).length)} />
        <MetricCard label="Offline" value={String(nodes.data.filter((n) => n.status === 'offline').length)} />
      </div>

      <div className={styles.charts}>
        <ChartBox title="Messages / hour" meta={`last ${samples.length} samples`} loading={loading}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="msgGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="messagesPerHour" stroke="var(--accent)" fill="url(#msgGrad)" strokeWidth={2} />
          </AreaChart>
        </ChartBox>

        <ChartBox title="Packet loss %" meta="lower is better" loading={loading}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <Tooltip content={<ChartTooltip />} />
            <Line dataKey="packetLoss" stroke="var(--status-warn)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Nodes online" meta="excluding offline devices" loading={loading}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <Tooltip content={<ChartTooltip />} />
            <Line dataKey="online" stroke="var(--status-ok)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Avg SNR" meta="dB across all active nodes" loading={loading}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={tickTime} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} stroke="rgba(148,163,184,0.12)" />
            <Tooltip content={<ChartTooltip />} />
            <Line dataKey="snr" stroke="var(--accent-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartBox>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  prev,
  curr,
  unit,
  inversed,
}: {
  label: string;
  value: string;
  prev?: number;
  curr?: number;
  unit?: string;
  inversed?: boolean;
}) {
  let delta: { direction: 'up' | 'down' | 'flat'; pct: number } | null = null;
  if (prev !== undefined && curr !== undefined && prev !== 0) {
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct) < 0.5) delta = { direction: 'flat', pct };
    else if (pct > 0) delta = { direction: 'up', pct };
    else delta = { direction: 'down', pct };
  }
  const deltaClass = delta
    ? delta.direction === 'flat'
      ? styles.deltaFlat
      : (inversed ? delta.direction === 'down' : delta.direction === 'up')
        ? styles.deltaUp
        : styles.deltaDown
    : styles.deltaFlat;

  return (
    <div className={styles.card}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.cardValue}>
        {value}
        {unit && <span className={styles.cardValueUnit}>{unit}</span>}
      </span>
      <span className={clsx(styles.cardDelta, deltaClass)}>
        {delta ? (
          <>
            {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '—'}{' '}
            {Math.abs(delta.pct).toFixed(1)}%
          </>
        ) : (
          '—'
        )}
      </span>
    </div>
  );
}

function ChartBox({
  title,
  meta,
  loading,
  children,
}: {
  title: string;
  meta: string;
  loading: boolean;
  children: React.ReactElement;
}) {
  return (
    <div className={styles.chartBox}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>{title}</h3>
        <span className={styles.chartMeta}>{meta}</span>
      </div>
      <div className={styles.chartContainer}>
        {loading ? (
          <div className={styles.loading}>Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function tickTime(v: number): string {
  const d = new Date(v);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function ChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: number;
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  const item = props.payload[0];
  if (!item) return null;
  return (
    <div
      style={{
        padding: '6px 10px',
        background: 'rgba(17, 24, 38, 0.95)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: 'var(--text-tertiary)' }}>
        {props.label !== undefined ? tickTime(props.label) : ''}
      </div>
      <div style={{ color: item.color }}>
        {item.name}: <strong>{item.value}</strong>
      </div>
    </div>
  );
}
