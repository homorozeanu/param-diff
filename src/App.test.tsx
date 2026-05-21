import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Helpers ---------------------------------------------------------------------

function setMatchMedia(prefersLight: boolean) {
  // jsdom doesn't implement matchMedia. Install a minimal stub that answers
  // the query App uses ("(prefers-color-scheme: light)").
  const mql = (query: string) => ({
    matches: query.includes('prefers-color-scheme: light') ? prefersLight : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(mql),
  });
}

function resetThemeEnvironment() {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
}

beforeEach(() => {
  resetThemeEnvironment();
  setMatchMedia(false); // default: dark preferred
});

// Tests -----------------------------------------------------------------------

describe('App — URL slot management', () => {
  it('starts with one empty slot and an Add button at 1/4', () => {
    render(<App />);
    expect(screen.getByLabelText('URL 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('URL 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add url \(1\/4\)/i })).toBeInTheDocument();
    // No Remove button when there's only one slot.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('adds a slot up to MAX_URLS=4 and hides the Add button at the cap', async () => {
    const user = userEvent.setup();
    render(<App />);
    const add = () => screen.getByRole('button', { name: /add url/i });
    await user.click(add());
    await user.click(add());
    await user.click(add());
    expect(screen.getByLabelText('URL 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add url/i })).not.toBeInTheDocument();
    // The label counter is 1-indexed; URL 5 must not appear.
    expect(screen.queryByLabelText('URL 5')).not.toBeInTheDocument();
  });

  it('removes a non-first slot and shifts label numbering for surviving slots', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /add url/i }));
    await user.click(screen.getByRole('button', { name: /add url/i }));
    // Type something distinct into slot 2 so we can verify which slot was removed.
    await user.type(screen.getByLabelText('URL 2'), 'https://b.example/?x=1');
    // Two Remove buttons exist (one per slot now; the slot count is 3).
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons).toHaveLength(3);
    // Click the first Remove button (slot index 0).
    await user.click(removeButtons[0]);
    // After removal slot count drops to 2, and what was slot 2's content is now in URL 1.
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByLabelText('URL 1')).toHaveValue('https://b.example/?x=1');
  });

  it('hides the Remove button when only one slot remains', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /add url/i }));
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    // One slot left → Remove disappears.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});

describe('App — end-to-end interaction', () => {
  it('parses a pasted URL into rows and updates the diff after Decode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /add url/i }));
    // Two URLs that differ only by URL-encoding of "hello world".
    await user.type(screen.getByLabelText('URL 1'), 'https://x.com/?q=hello%20world');
    await user.type(screen.getByLabelText('URL 2'), 'https://y.com/?q=hello world');

    // Initially the diff should flag the row as different (encoded vs decoded value).
    const tableBefore = screen.getByRole('table');
    const qRowBefore = within(tableBefore).getAllByRole('row')[1];
    expect(qRowBefore).toHaveClass('diff-row-diff');

    // Click Decode on URL 1 — there are two Decode buttons (one per slot).
    const decodeButtons = screen.getAllByRole('button', { name: 'Decode' });
    await user.click(decodeButtons[0]);

    // Now both URLs effectively show "hello world" in the diff table.
    const qRowAfter = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(qRowAfter).toHaveClass('diff-row-same');
    const cells = within(qRowAfter).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('hello world');
    expect(cells[2]).toHaveTextContent('hello world');
  });

  it('scopes mutations to the slot they were issued in', async () => {
    // Decoding in URL 1 must not mutate URL 2's params.
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /add url/i }));
    await user.type(screen.getByLabelText('URL 1'), 'https://x.com/?q=a%20b');
    await user.type(screen.getByLabelText('URL 2'), 'https://y.com/?q=a%20b');

    const decodeButtons = screen.getAllByRole('button', { name: 'Decode' });
    await user.click(decodeButtons[0]); // URL 1 only

    // URL 1 row shows the decoded badge; URL 2 still has Decode enabled.
    expect(screen.getByText(/decoded ×1/)).toBeInTheDocument();
    const decodeButtonsAfter = screen.getAllByRole('button', { name: 'Decode' });
    expect(decodeButtonsAfter[0]).toBeDisabled(); // URL 1: nothing left to decode
    expect(decodeButtonsAfter[1]).toBeEnabled();  // URL 2: untouched
  });
});

describe('App — theme toggle', () => {
  it('reads the initial theme from data-theme on <html> when present', () => {
    document.documentElement.dataset.theme = 'light';
    render(<App />);
    const sw = screen.getByRole('switch', { name: /toggle light theme/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('falls back to localStorage when data-theme is not set', () => {
    localStorage.setItem('theme', 'light');
    render(<App />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('falls back to prefers-color-scheme when neither attr nor storage are set', () => {
    setMatchMedia(true); // user prefers light
    render(<App />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('defaults to dark when nothing is configured and no light preference', () => {
    setMatchMedia(false);
    render(<App />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('flips the theme on click and persists it to localStorage and data-theme', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('ignores invalid values in data-theme and localStorage', () => {
    document.documentElement.dataset.theme = 'neon'; // not 'dark'/'light'
    localStorage.setItem('theme', 'sepia');         // not 'dark'/'light'
    setMatchMedia(true); // should fall through to media query and pick 'light'
    render(<App />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
