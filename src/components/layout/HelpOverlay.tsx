import { useEffect } from 'react';
import styles from './HelpOverlay.module.css';

interface Shortcut {
  combo: string[];
  desc: string;
}

const SHORTCUTS: readonly Shortcut[] = [
  { combo: ['1'], desc: 'Go to Network' },
  { combo: ['2'], desc: 'Go to Messages' },
  { combo: ['3'], desc: 'Go to Health' },
  { combo: ['4'], desc: 'Go to Devices' },
  { combo: ['/'], desc: 'Focus the current-view search' },
  { combo: ['Esc'], desc: 'Close inspector / clear selection' },
  { combo: ['?'], desc: 'Toggle this help overlay' },
];

export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title} id="help-title">
            Keyboard shortcuts
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close help (Esc)">
            ✕
          </button>
        </header>
        <dl className={styles.rows}>
          {SHORTCUTS.map((s) => (
            <RowPair key={s.desc} {...s} />
          ))}
        </dl>
        <p className={styles.footer}>
          Shortcuts are disabled while typing in inputs. <kbd>Esc</kbd> always closes overlays.
        </p>
      </div>
    </div>
  );
}

function RowPair({ combo, desc }: Shortcut) {
  return (
    <>
      <dt className={styles.combo}>
        {combo.map((k, i) => (
          <kbd key={i}>{k}</kbd>
        ))}
      </dt>
      <dd className={styles.desc}>{desc}</dd>
    </>
  );
}
