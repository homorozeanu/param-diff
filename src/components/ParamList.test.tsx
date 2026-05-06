import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ParamList } from './ParamList';
import { parseUrl } from '../parse';
import type { ParsedUrl } from '../types';

const noop = () => {};
const empty: ParsedUrl = { base: '', params: [] };

describe('ParamList', () => {
  it('renders the empty hint with the URL number when the slot is empty', () => {
    render(
      <ParamList parsed={empty} index={2} onDecode={noop} onExpand={noop} onReset={noop} />,
    );
    expect(screen.getByText(/URL 3 — paste a URL above/i)).toBeInTheDocument();
    // Neither header nor base block render in the empty state.
    expect(screen.queryByText(/^Base:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Key')).not.toBeInTheDocument();
  });

  it('renders the base and a "No query parameters." hint for a URL with no params', () => {
    const parsed = parseUrl('https://example.com');
    render(
      <ParamList parsed={parsed} index={0} onDecode={noop} onExpand={noop} onReset={noop} />,
    );
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/no query parameters/i)).toBeInTheDocument();
    // No header row is rendered when there are no params.
    expect(screen.queryByText('Key')).not.toBeInTheDocument();
  });

  it('renders the header row plus one row per param', () => {
    const parsed = parseUrl('https://x.com/p?a=1&b=2');
    const { container } = render(
      <ParamList parsed={parsed} index={0} onDecode={noop} onExpand={noop} onReset={noop} />,
    );
    expect(screen.getByText('https://x.com/p')).toBeInTheDocument();
    // 1 header row + 2 param rows = 3 .param-row elements.
    const rows = container.querySelectorAll('.param-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveClass('param-row-header');
    // Param rows render their keys.
    expect(within(rows[1] as HTMLElement).getByText('a')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('b')).toBeInTheDocument();
  });

  it('shows "(none)" for the base when only a query string was pasted', () => {
    // splitQuery yields base='' for "?a=1" — parseUrl preserves that.
    const parsed = parseUrl('?a=1&b=2');
    render(
      <ParamList parsed={parsed} index={0} onDecode={noop} onExpand={noop} onReset={noop} />,
    );
    expect(screen.getByText('(none)')).toBeInTheDocument();
  });
});
