import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryEntry } from './HistoryEntry';
import type { Slot, Snapshot } from '../types';

function slot(raw: string): Slot {
  return { id: `s-${raw}`, raw, parsed: { base: '', params: [] } };
}

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'snap-1',
    savedAt: 1_700_000_000_000,
    slots: [slot('https://x.com/?a=1')],
    ...overrides,
  };
}

function renderEntry(snapshot: Snapshot) {
  const onRestore = vi.fn();
  const onDelete = vi.fn();
  const utils = render(
    <ul>
      <HistoryEntry snapshot={snapshot} onRestore={onRestore} onDelete={onDelete} />
    </ul>,
  );
  return { ...utils, onRestore, onDelete };
}

describe('HistoryEntry', () => {
  it('fires onRestore with the snapshot id', async () => {
    const { onRestore } = renderEntry(snap({ id: 'abc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith('abc');
  });

  it('fires onDelete with the snapshot id', async () => {
    const { onDelete } = renderEntry(snap({ id: 'xyz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('xyz');
  });

  it('previews the first non-empty URL', () => {
    renderEntry(snap({ slots: [slot(''), slot('https://y.com/?b=2')] }));
    expect(screen.getByText('https://y.com/?b=2')).toBeInTheDocument();
  });

  it('truncates a long URL to 60 chars with an ellipsis', () => {
    const long = `https://x.com/?q=${'a'.repeat(80)}`;
    renderEntry(snap({ slots: [slot(long)] }));
    expect(screen.getByText(`${long.slice(0, 60)}…`)).toBeInTheDocument();
  });

  it('appends "(+N more)" when multiple URLs are present', () => {
    renderEntry(snap({ slots: [slot('https://x.com/?a=1'), slot('https://y.com/?b=2')] }));
    expect(screen.getByText('https://x.com/?a=1 (+1 more)')).toBeInTheDocument();
  });

  it('falls back to a slot-count label when all URLs are empty', () => {
    renderEntry(snap({ slots: [slot(''), slot('')] }));
    expect(screen.getByText('2 URL slot(s)')).toBeInTheDocument();
  });
});
