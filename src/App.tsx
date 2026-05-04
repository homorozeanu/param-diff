import { useMemo, useState } from 'react';
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

type Slot = {
  raw: string;
  parsed: ParsedUrl;
};

function emptySlot(): Slot {
  return { raw: '', parsed: { base: '', params: [] } };
}

export default function App() {
  const [slots, setSlots] = useState<Slot[]>([emptySlot()]);

  const setRaw = (idx: number, raw: string) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === idx ? { raw, parsed: parseUrl(raw) } : s)),
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
        <h1>ParamDiff</h1>
        <p className="muted">
          Paste 1–4 URLs. Each query parameter shows as a row — click <strong>Decode</strong> to peel one
          URL-encoding layer (repeat for double-encoded values), or <strong>Expand</strong> to break a
          nested query string into its own rows. Add a second URL to compare.
        </p>
      </header>

      <section className="urls">
        {slots.map((slot, i) => (
          <div key={i} className="url-block">
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
