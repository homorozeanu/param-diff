import type { Snapshot } from '../types';

type Props = {
  readonly snapshot: Snapshot;
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

export function HistoryEntry({ snapshot, onRestore, onDelete }: Props) {
  return (
    <li className="history-row">
      <div className="history-meta">
        <time className="history-time" dateTime={new Date(snapshot.savedAt).toISOString()}>
          {formatTime(snapshot.savedAt)}
        </time>
        <span className="history-preview muted">{preview(snapshot)}</span>
      </div>
      <div className="history-actions">
        <button type="button" className="btn" onClick={() => onRestore(snapshot.id)}>
          Restore
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onDelete(snapshot.id)}>
          Delete
        </button>
      </div>
    </li>
  );
}
