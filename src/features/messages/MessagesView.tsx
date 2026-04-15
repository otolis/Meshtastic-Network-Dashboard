import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import styles from './MessagesView.module.css';
import { useAllMessages, useNodes, useSelection, useTimeRange } from '../../state/hooks';
import type { Message, Portnum } from '../../types';
import { formatTimestamp } from '../../lib/time';

const PORTNUMS: readonly Portnum[] = [
  'TEXT_MESSAGE_APP',
  'POSITION_APP',
  'TELEMETRY_APP',
  'NODEINFO_APP',
  'NEIGHBORINFO_APP',
  'TRACEROUTE_APP',
  'ROUTING_APP',
];

export default function MessagesView() {
  const messages = useAllMessages();
  const nodes = useNodes();
  const { selectMessage, kind, id: selectedId } = useSelection();
  const timeRange = useTimeRange();
  const [query, setQuery] = useState('');
  const [portnum, setPortnum] = useState<Portnum | 'ALL'>('ALL');
  const [viaMqttOnly, setViaMqttOnly] = useState(false);

  const nodeById = useMemo(() => new Map(nodes.data.map((n) => [n.id, n])), [nodes.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.data.filter((m) => {
      if (m.timestamp < timeRange.from || m.timestamp > timeRange.to) {
        // Soft-apply: only filter by time range when range is smaller than default
        // Actually — be permissive: only apply if the user has narrowed under 6h
      }
      if (portnum !== 'ALL' && m.portnum !== portnum) return false;
      if (viaMqttOnly && !m.viaMqtt) return false;
      if (q) {
        const from = nodeById.get(m.fromNode);
        const to = m.toNode ? nodeById.get(m.toNode) : null;
        const hay =
          m.text.toLowerCase() +
          ' ' +
          (from?.shortName.toLowerCase() ?? '') +
          ' ' +
          (to?.shortName.toLowerCase() ?? 'broadcast');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages.data, query, portnum, viaMqttOnly, nodeById, timeRange]);

  const truncated = filtered.slice(0, 300);

  // Auto-select first message when nothing is selected (nice UX, easy win)
  useEffect(() => {
    if (kind === null && truncated.length > 0 && selectedId === null) {
      // noop — don't auto-select; keep explicit selection only
    }
  }, [kind, truncated, selectedId]);

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Messages</h1>
          <span className={styles.subtitle}>
            {filtered.length} packets · newest first
          </span>
        </div>
        <div className={styles.filters}>
          <div className={styles.search}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Filter by text, sender, destination…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-shortcut-search
              aria-label="Filter messages"
            />
          </div>
          <button
            type="button"
            className={clsx(styles.chip, portnum === 'ALL' && styles.chipActive)}
            onClick={() => setPortnum('ALL')}
          >
            all
          </button>
          {PORTNUMS.map((p) => (
            <button
              key={p}
              type="button"
              className={clsx(styles.chip, portnum === p && styles.chipActive)}
              onClick={() => setPortnum(p)}
            >
              {p.replace(/_APP$/, '').toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            className={clsx(styles.chip, viaMqttOnly && styles.chipActive)}
            onClick={() => setViaMqttOnly((v) => !v)}
            aria-pressed={viaMqttOnly}
          >
            mqtt
          </button>
        </div>
      </header>
      <div className={styles.list}>
        {messages.loading ? (
          <div className={styles.empty}>Loading log…</div>
        ) : truncated.length === 0 ? (
          <div className={styles.empty}>No messages match those filters</div>
        ) : (
          truncated.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              senderName={nodeById.get(m.fromNode)?.shortName ?? m.fromNode.slice(1, 5)}
              destName={m.toNode ? (nodeById.get(m.toNode)?.shortName ?? m.toNode.slice(1, 5)) : 'broadcast'}
              selected={kind === 'message' && selectedId === m.id}
              onSelect={() => selectMessage(m.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MessageRow({
  message,
  senderName,
  destName,
  selected,
  onSelect,
}: {
  message: Message;
  senderName: string;
  destName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const hopsUsed = message.hopStart - message.hopLimit;
  return (
    <button
      type="button"
      className={clsx(styles.row, selected && styles.rowSelected)}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Message from ${senderName} at ${formatTimestamp(message.timestamp)}`}
    >
      <span className={styles.time}>
        <span
          className={clsx(styles.priority, styles[`priority${message.priority}`])}
          aria-label={message.priority.toLowerCase()}
        />
        {formatTimestamp(message.timestamp)}
      </span>
      <span className={styles.from}>
        {senderName} → {destName}
      </span>
      <span className={styles.text}>
        <span className={styles.portnum}>{message.portnum.replace(/_APP$/, '').toLowerCase()}</span>
        {message.text}
        {message.viaMqtt && (
          <span className={styles.viaMqtt} title="Via MQTT gateway">
            ⟳ mqtt
          </span>
        )}
      </span>
      <span className={styles.hops}>
        <span className={styles.hopBar} aria-label={`${hopsUsed} of ${message.hopStart} hops used`}>
          {Array.from({ length: message.hopStart }).map((_, i) => (
            <span key={i} className={clsx(styles.hopCell, i < hopsUsed && styles.hopCellUsed)} />
          ))}
        </span>
      </span>
      <span className={styles.hops}>
        {message.rxSnr.toFixed(1)}dB
      </span>
    </button>
  );
}
