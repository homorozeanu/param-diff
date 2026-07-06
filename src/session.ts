import type { Slot, Snapshot } from './types';

// Per-tab persistence via sessionStorage: survives reload, cleared on tab close.
// Every access is wrapped so private-mode / quota / corrupt data all degrade to
// a safe default rather than throwing. The .v1 suffix is a schema version — bump
// it (and drop the old keys) if the persisted shape ever changes incompatibly.
const CURRENT_KEY = 'paramdiff.current.v1';
const HISTORY_KEY = 'paramdiff.history.v1';

// Max saved comparisons kept. When exceeded, the oldest are trimmed by callers.
export const MAX_HISTORY = 20;

function read(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    // Corrupt JSON or storage unavailable — drop it and fall back.
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded / storage disabled — persistence is best-effort.
  }
}

export function loadCurrent(): Slot[] | null {
  const data = read(CURRENT_KEY);
  return Array.isArray(data) ? (data as Slot[]) : null;
}

export function saveCurrent(slots: Slot[]): void {
  write(CURRENT_KEY, slots);
}

export function loadHistory(): Snapshot[] {
  const data = read(HISTORY_KEY);
  return Array.isArray(data) ? (data as Snapshot[]) : [];
}

export function saveHistory(list: Snapshot[]): void {
  write(HISTORY_KEY, list);
}
