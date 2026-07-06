import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPanel } from './HistoryPanel';
import type { Snapshot } from '../types';

function snap(id: string, raw: string): Snapshot {
  return {
    id,
    savedAt: 1_700_000_000_000,
    slots: [{ id: `s-${id}`, raw, parsed: { base: '', params: [] } }],
  };
}

describe('HistoryPanel', () => {
  it('renders nothing when history is empty', () => {
    const { container } = render(
      <HistoryPanel history={[]} onRestore={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists a row per snapshot with a preview of the first URL', () => {
    render(
      <HistoryPanel
        history={[snap('a', 'https://x.com/?a=1'), snap('b', 'https://y.com/?b=2')]}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Saved comparisons (2)')).toBeInTheDocument();
    expect(screen.getByText('https://x.com/?a=1')).toBeInTheDocument();
    expect(screen.getByText('https://y.com/?b=2')).toBeInTheDocument();
  });

  it('fires onRestore with the snapshot id', async () => {
    const onRestore = vi.fn();
    render(
      <HistoryPanel history={[snap('a', 'https://x.com/?a=1')]} onRestore={onRestore} onDelete={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith('a');
  });

  it('fires onDelete with the snapshot id', async () => {
    const onDelete = vi.fn();
    render(
      <HistoryPanel history={[snap('a', 'https://x.com/?a=1')]} onRestore={vi.fn()} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('collapses and expands the list', async () => {
    render(
      <HistoryPanel history={[snap('a', 'https://x.com/?a=1')]} onRestore={vi.fn()} onDelete={vi.fn()} />,
    );
    const header = screen.getByRole('button', { name: /Saved comparisons/ });
    expect(screen.getByText('https://x.com/?a=1')).toBeInTheDocument();
    await userEvent.click(header);
    expect(screen.queryByText('https://x.com/?a=1')).not.toBeInTheDocument();
  });
});
