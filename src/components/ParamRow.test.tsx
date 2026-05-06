import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParamRow } from './ParamRow';
import { makeParam, expandParam, decodeParam } from '../parse';

function renderRow(param: ReturnType<typeof makeParam>) {
  const onDecode = vi.fn();
  const onExpand = vi.fn();
  const onReset = vi.fn();
  const utils = render(
    <ParamRow param={param} depth={0} onDecode={onDecode} onExpand={onExpand} onReset={onReset} />,
  );
  return { ...utils, onDecode, onExpand, onReset };
}

describe('ParamRow', () => {
  it('renders the key and the raw value', () => {
    const p = makeParam('q', 'hello');
    renderRow(p);
    expect(screen.getByText('q')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders an "(empty)" placeholder for an empty value', () => {
    const p = makeParam('q', '');
    renderRow(p);
    expect(screen.getByText('(empty)')).toBeInTheDocument();
  });

  it('disables Decode when the value cannot be decoded further', () => {
    const p = makeParam('q', 'plain');
    renderRow(p);
    expect(screen.getByRole('button', { name: 'Decode' })).toBeDisabled();
  });

  it('enables Decode when the value contains percent-encoded sequences', async () => {
    const p = makeParam('q', 'a%20b');
    const { onDecode } = renderRow(p);
    const decodeBtn = screen.getByRole('button', { name: 'Decode' });
    expect(decodeBtn).toBeEnabled();
    await userEvent.click(decodeBtn);
    expect(onDecode).toHaveBeenCalledWith(p.id);
  });

  it('enables Expand when the value looks expandable', async () => {
    const p = makeParam('redirect', '/cb?code=abc');
    const { onExpand } = renderRow(p);
    const expandBtn = screen.getByRole('button', { name: 'Expand' });
    expect(expandBtn).toBeEnabled();
    await userEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledWith(p.id);
  });

  it('disables Reset when the param has not been modified', () => {
    const p = makeParam('q', 'plain');
    renderRow(p);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('enables Reset after a decode and shows the decode count badge', async () => {
    const decoded = decodeParam(makeParam('q', 'a%20b'));
    const { onReset } = renderRow(decoded);
    expect(screen.getByText(/decoded ×1/)).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    expect(resetBtn).toBeEnabled();
    await userEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledWith(decoded.id);
  });

  it('shows the nested base and renders nested rows when expanded', () => {
    const expanded = expandParam(makeParam('redirect', '/cb?code=abc&state=xyz'));
    renderRow(expanded);
    // The expanded row shows the base "/cb" followed by "?".
    expect(screen.getByText('/cb')).toBeInTheDocument();
    // Nested rows render keys "code" and "state".
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('state')).toBeInTheDocument();
  });

  it('disables Decode and Expand on the parent when expanded', () => {
    const expanded = expandParam(makeParam('redirect', '/cb?code=abc'));
    renderRow(expanded);
    // The first Decode/Expand buttons belong to the parent row.
    const decodeButtons = screen.getAllByRole('button', { name: 'Decode' });
    const expandButtons = screen.getAllByRole('button', { name: 'Expand' });
    expect(decodeButtons[0]).toBeDisabled();
    expect(expandButtons[0]).toBeDisabled();
  });

  it('renders a "(no base)" placeholder when expanded value has no base', () => {
    const expanded = expandParam(makeParam('q', 'a=1&b=2'));
    renderRow(expanded);
    expect(screen.getByText('(no base)')).toBeInTheDocument();
  });

  it('indents nested rows according to depth', () => {
    const expanded = expandParam(makeParam('redirect', '/cb?code=abc'));
    const { container } = renderRow(expanded);
    const rows = container.querySelectorAll('.param-row');
    expect(rows.length).toBe(2);
    expect((rows[0] as HTMLElement).style.paddingLeft).toBe('0rem');
    expect((rows[1] as HTMLElement).style.paddingLeft).toBe('1.5rem');
  });
});
