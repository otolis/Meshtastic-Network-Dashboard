import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import styles from './Inspector.module.css';
import { useSelection, useNodes, useAllMessages, useFetchDeviceById } from '../../state/hooks';
import type { Device, Message, Node } from '../../types';

export function Inspector({ className }: { className?: string }) {
  const { kind, id, clear } = useSelection();
  const nodes = useNodes();
  const messages = useAllMessages();
  const fetchDevice = useFetchDeviceById();
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    setDevice(null);
    if (kind === 'device' && id) {
      let alive = true;
      fetchDevice(id).then((d) => {
        if (alive) setDevice(d);
      }).catch(() => {
        if (alive) setDevice(null);
      });
      return () => {
        alive = false;
      };
    }
    return;
  }, [kind, id, fetchDevice]);

  const selectedNode = useMemo<Node | null>(() => {
    if (kind !== 'node' || !id) return null;
    return nodes.data.find((n) => n.id === id) ?? null;
  }, [kind, id, nodes.data]);

  const selectedMessage = useMemo<Message | null>(() => {
    if (kind !== 'message' || !id) return null;
    return messages.data.find((m) => m.id === id) ?? null;
  }, [kind, id, messages.data]);

  const empty = kind === null;

  return (
    <aside className={clsx(styles.inspector, empty && styles.inspectorClosed, className)} aria-label="Inspector">
      {!empty && (
        <div className={styles.header}>
          <span>
            Inspector · <span className={styles.kind}>{kind}</span>
          </span>
          <button
            type="button"
            className={styles.close}
            onClick={() => clear()}
            aria-label="Close inspector (Esc)"
          >
            ✕
          </button>
        </div>
      )}
      {empty ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            ◎
          </span>
          <p className={styles.emptyTitle}>No selection</p>
          <p className={styles.emptyBody}>
            Click a node, a message, or a device row to inspect its full record.
          </p>
        </div>
      ) : selectedNode ? (
        <div className={styles.body}>
          <JsonBlock data={selectedNode} />
        </div>
      ) : selectedMessage ? (
        <div className={styles.body}>
          <JsonBlock data={selectedMessage} />
        </div>
      ) : device ? (
        <div className={styles.body}>
          <JsonBlock data={device} />
        </div>
      ) : (
        <div className={styles.body}>
          <p className={styles.emptyBody}>Loading…</p>
        </div>
      )}
    </aside>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const lines = useMemo(() => serialize(data, 0), [data]);
  return <pre className={styles.json}>{lines}</pre>;
}

function serialize(value: unknown, depth: number): string {
  const pad = '  '.repeat(depth);
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '[\n' + value.map((v) => pad + '  ' + serialize(v, depth + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return (
      '{\n' +
      entries
        .map(([k, v]) => pad + '  ' + JSON.stringify(k) + ': ' + serialize(v, depth + 1))
        .join(',\n') +
      '\n' +
      pad +
      '}'
    );
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'null';
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
