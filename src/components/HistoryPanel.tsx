import { useState } from 'react';
import type { Snapshot } from '../types';
import { HistoryEntry } from './HistoryEntry';

type Props = {
  readonly history: readonly Snapshot[];
  readonly onRestore: (id: string) => void;
  readonly onDelete: (id: string) => void;
};

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
            <HistoryEntry key={snap.id} snapshot={snap} onRestore={onRestore} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
