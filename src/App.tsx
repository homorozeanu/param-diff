import { useEffect, useMemo, useState } from 'react';
import type { ParsedUrl } from './types';
import {
  parseUrl,
  decodeParam,
  expandParam,
  resetParam,
  updateParamById,
} from './parse';
import { UrlInput } from './components/UrlInput';
import { ParamList } from './components/ParamList';
import { DiffView } from './components/DiffView';

const MAX_URLS = 4;

type Theme = 'dark' | 'light';

type Slot = {
  id: string;
  raw: string;
  parsed: ParsedUrl;
};

function emptySlot(): Slot {
  return { id: crypto.randomUUID(), raw: '', parsed: { base: '', params: [] } };
}

function getInitialTheme(): Theme {
  const fromAttr = document.documentElement.dataset.theme;
  if (fromAttr === 'dark' || fromAttr === 'light') return fromAttr;
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const [slots, setSlots] = useState<Slot[]>([emptySlot()]);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const setRaw = (idx: number, raw: string) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, raw, parsed: parseUrl(raw) } : s)),
    );
  };

  const addUrl = () =>
    setSlots((prev) => (prev.length >= MAX_URLS ? prev : [...prev, emptySlot()]));

  const removeUrl = (idx: number) =>
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const mutateParams = (idx: number, paramId: string, updater: (p: import('./types').Param) => import('./types').Param) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, parsed: { ...s.parsed, params: updateParamById(s.parsed.params, paramId, updater) } }
          : s,
      ),
    );
  };

  const onDecode = (idx: number) => (id: string) => mutateParams(idx, id, decodeParam);
  const onExpand = (idx: number) => (id: string) => mutateParams(idx, id, expandParam);
  const onReset = (idx: number) => (id: string) => mutateParams(idx, id, resetParam);

  const parsedUrls = useMemo(() => slots.map((s) => s.parsed), [slots]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>ParamDiff</h1>
          <button
            type="button"
            role="switch"
            className="theme-switch"
            aria-checked={theme === 'light'}
            aria-label="Toggle light theme"
            onClick={toggleTheme}
          >
            <span className="theme-switch-track">
              <span className="theme-switch-thumb">
                <svg
                  className="theme-switch-icon theme-switch-icon-moon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                <svg
                  className="theme-switch-icon theme-switch-icon-sun"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              </span>
            </span>
          </button>
        </div>
        <p className="muted">
          Paste 1–4 URLs. Each query parameter shows as a row — click <strong>Decode</strong> to peel one
          URL-encoding layer (repeat for double-encoded values), or <strong>Expand</strong> to break a
          nested query string into its own rows. Add a second URL to compare.
        </p>
      </header>

      <section className="urls">
        {slots.map((slot, i) => (
          <div key={slot.id} className="url-block">
            <UrlInput
              index={i}
              value={slot.raw}
              onChange={(v) => setRaw(i, v)}
              onRemove={slots.length > 1 ? () => removeUrl(i) : undefined}
            />
            <ParamList
              parsed={slot.parsed}
              index={i}
              onDecode={onDecode(i)}
              onExpand={onExpand(i)}
              onReset={onReset(i)}
            />
          </div>
        ))}
        {slots.length < MAX_URLS && (
          <button type="button" className="btn btn-add" onClick={addUrl}>
            + Add URL ({slots.length}/{MAX_URLS})
          </button>
        )}
      </section>

      <section className="diff-section">
        <h2>Diff</h2>
        <DiffView parsedUrls={parsedUrls} />
      </section>
    </div>
  );
}
