import { useState } from 'react';
import type { Snapshot } from '../types';

type Props = {
  readonly history: readonly Snapshot[];
  readonly onRestore: (id: string) => void;
  readonly onDelete: (id: string) => void;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function preview(snap: Snapshot): string {
  const firstRaw = snap.slots.find((s) => s.raw.trim())?.raw ?? '';
  const count = snap.slots.filter((s) => s.raw.trim()).length;
  const label = firstRaw.length > 60 ? `${firstRaw.slice(0, 60)}…` : firstRaw;
  const extra = count > 1 ? ` (+${count - 1} more)` : '';
  return label ? `${label}${extra}` : `${snap.slots.length} URL slot(s)`;
}

export function HistoryPanel({ history, onRestore, onDelete }: Props) {
  const [open, setOpen] = useState(true);

  if (history.length === 0) return null;

  return (
    <section className="history-panel">
      <button
        type="button"
        className="history-header"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`history-caret${open ? ' history-caret-open' : ''}`} aria-hidden="true">
          ▶
        </span>
        <h2>Saved comparisons ({history.length})</h2>
      </button>
      {open && (
        <ul className="history-list">
          {history.map((snap) => (
            <li key={snap.id} className="history-row">
              <div className="history-meta">
                <time className="history-time" dateTime={new Date(snap.savedAt).toISOString()}>
                  {formatTime(snap.savedAt)}
                </time>
                <span className="history-preview muted">{preview(snap)}</span>
              </div>
              <div className="history-actions">
                <button type="button" className="btn" onClick={() => onRestore(snap.id)}>
                  Restore
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => onDelete(snap.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
