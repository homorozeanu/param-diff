import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DiffView } from './DiffView';
import { expandParam, parseUrl, updateParamById } from '../parse';
import type { ParsedUrl } from '../types';

const empty: ParsedUrl = { base: '', params: [] };

describe('DiffView', () => {
  it('shows an empty-state hint when fewer than two URLs have content', () => {
    render(<DiffView parsedUrls={[empty, empty]} />);
    expect(screen.getByText(/add a second URL to enable diff/i)).toBeInTheDocument();
    expect(screen.getByText(/Currently 0 URLs parsed/)).toBeInTheDocument();
  });

  it('uses singular "URL" when exactly one URL has content', () => {
    render(<DiffView parsedUrls={[parseUrl('https://x.com/?a=1'), empty]} />);
    expect(screen.getByText(/Currently 1 URL parsed/)).toBeInTheDocument();
  });

  it('marks identical params with the "same" row class', () => {
    const { container } = render(
      <DiffView
        parsedUrls={[parseUrl('https://x.com/?a=1&b=2'), parseUrl('https://y.com/?a=1&b=2')]}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    rows.forEach((r) => expect(r).toHaveClass('diff-row-same'));
  });

  it('marks differing params with the "diff" row class and renders both values', () => {
    const { container } = render(
      <DiffView
        parsedUrls={[parseUrl('https://x.com/?a=1'), parseUrl('https://y.com/?a=2')]}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toHaveClass('diff-row-diff');
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('a');
    expect(cells[1]).toHaveTextContent('1');
    expect(cells[2]).toHaveTextContent('2');
  });

  it('renders a "missing" cell for a param absent from one URL', () => {
    const { container } = render(
      <DiffView
        parsedUrls={[parseUrl('https://x.com/?a=1&b=2'), parseUrl('https://y.com/?a=1')]}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    // Row order matches union-of-keys: a (same), b (diff/missing).
    const bRow = rows[1] as HTMLElement;
    expect(bRow).toHaveClass('diff-row-diff');
    const cells = within(bRow).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('b');
    expect(cells[1]).toHaveTextContent('2');
    expect(cells[2]).toHaveClass('diff-cell-missing');
    expect(cells[2]).toHaveTextContent(/missing/i);
  });

  it('preserves union-of-keys order across URLs', () => {
    render(
      <DiffView
        parsedUrls={[
          parseUrl('https://x.com/?a=1&b=2'),
          parseUrl('https://y.com/?b=2&c=3&a=1'),
        ]}
      />,
    );
    const keyCells = screen.getAllByRole('cell').filter((c) => c.classList.contains('diff-key'));
    // Keys should appear in first-seen order: a (URL 1), b (URL 1), c (URL 2).
    expect(keyCells.map((c) => c.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('renders one column header per active URL using the original index', () => {
    // The second slot is empty, so the third URL should be labelled "URL 3"
    // (its original index), not "URL 2".
    render(
      <DiffView
        parsedUrls={[parseUrl('https://x.com/?a=1'), empty, parseUrl('https://z.com/?a=2')]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'URL 1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'URL 3' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'URL 2' })).not.toBeInTheDocument();
  });

  it('marks a row as "diff" when one URL is missing the param even if the other two share a value', () => {
    // The allSame check requires presentValues.length === cells.length, so a
    // missing cell must force a diff even if the present values are identical.
    const { container } = render(
      <DiffView
        parsedUrls={[
          parseUrl('https://x.com/?a=1&b=2'),
          parseUrl('https://y.com/?a=1'),
          parseUrl('https://z.com/?a=1&b=2'),
        ]}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    // a is present everywhere with value 1.
    expect(rows[0]).toHaveClass('diff-row-same');
    // b is missing in URL 2 → must be flagged diff even though URL 1 and URL 3 agree.
    expect(rows[1]).toHaveClass('diff-row-diff');
    const bCells = within(rows[1] as HTMLElement).getAllByRole('cell');
    expect(bCells[0]).toHaveTextContent('b');
    expect(bCells[1]).toHaveTextContent('2');
    expect(bCells[2]).toHaveClass('diff-cell-missing');
    expect(bCells[3]).toHaveTextContent('2');
  });

  it('marks a row as "same" across three URLs when every present value agrees', () => {
    const { container } = render(
      <DiffView
        parsedUrls={[
          parseUrl('https://x.com/?a=1'),
          parseUrl('https://y.com/?a=1'),
          parseUrl('https://z.com/?a=1'),
        ]}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveClass('diff-row-same');
  });

  it('flattens expanded params into nested rows and a "(base)" row for the prefix', () => {
    const left = parseUrl('https://x.com/?redirect=/cb?code=abc&state=xyz');
    const right = parseUrl('https://y.com/?redirect=/cb?code=abc&state=xyz');
    // Expand the "redirect" param on the left URL only.
    const redirectId = left.params[0].id;
    const expandedLeft: ParsedUrl = {
      ...left,
      params: updateParamById(left.params, redirectId, expandParam),
    };
    const { container } = render(<DiffView parsedUrls={[expandedLeft, right]} />);
    const rows = container.querySelectorAll('tbody tr');
    const keyCells = Array.from(rows).map(
      (r) => within(r as HTMLElement).getAllByRole('cell')[0].textContent,
    );
    // Left contributes: "redirect (base)", "redirect.code", "state"
    // Right contributes: "redirect", "state"
    // Union, in first-seen order:
    expect(keyCells).toEqual(['redirect (base)', 'redirect.code', 'state', 'redirect']);

    // The "redirect (base)" row is missing on the right (only the left is expanded).
    const baseRow = rows[0] as HTMLElement;
    const baseCells = within(baseRow).getAllByRole('cell');
    expect(baseCells[1]).toHaveTextContent('/cb');
    expect(baseCells[2]).toHaveClass('diff-cell-missing');

    // The "redirect" leaf row only exists on the right (the left's redirect is now expanded).
    const redirectLeafRow = rows[3] as HTMLElement;
    const redirectLeafCells = within(redirectLeafRow).getAllByRole('cell');
    expect(redirectLeafCells[1]).toHaveClass('diff-cell-missing');
    expect(redirectLeafCells[2]).toHaveTextContent('/cb?code=abc');

    // "state" is the same on both sides.
    expect(rows[2]).toHaveClass('diff-row-same');
  });

  it('shows "No query params parsed yet" when two URLs have a base but zero params', () => {
    // Both have content (base set) so active.length === 2, but neither has params.
    render(
      <DiffView
        parsedUrls={[parseUrl('https://x.com'), parseUrl('https://y.com')]}
      />,
    );
    expect(screen.getByText(/no query params parsed yet/i)).toBeInTheDocument();
    // The diff table is not rendered.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
