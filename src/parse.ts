import type { Param, ParsedUrl } from './types';

let idCounter = 0;
const nextId = () => `p${++idCounter}`;

export function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function canDecodeFurther(value: string): boolean {
  try {
    return decodeURIComponent(value) !== value;
  } catch {
    return false;
  }
}

// Detects "/path?a=1&b=2", "https://host/x?a=1", or even bare "a=1&b=2".
// We require at least one '=' to consider it a query-bearing string.
export function looksExpandable(value: string): boolean {
  if (!value?.includes('=')) return false;
  if (value.includes('?')) return true;
  // Bare "a=1&b=2" — only treat as expandable if every &-segment has '=' and
  // keys look reasonable (no spaces, not too long).
  if (!value.includes('&')) return false;
  const parts = value.split('&');
  return parts.every((p) => {
    const eq = p.indexOf('=');
    if (eq <= 0) return false;
    const k = p.slice(0, eq);
    return /^[A-Za-z0-9_\-.]+$/.test(k);
  });
}

// Split "base?qs" into base + raw key/value pairs.
// If no '?', treat the whole thing as the query string with empty base.
export function splitQuery(value: string): { base: string; pairs: { key: string; value: string }[] } {
  const qIdx = value.indexOf('?');
  const base = qIdx >= 0 ? value.slice(0, qIdx) : '';
  const qs = qIdx >= 0 ? value.slice(qIdx + 1) : value;
  const pairs = qs
    .split('&')
    .filter((s) => s.length > 0)
    .map((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx < 0) return { key: pair, value: '' };
      return { key: pair.slice(0, eqIdx), value: pair.slice(eqIdx + 1) };
    });
  return { base, pairs };
}

// Advance idCounter past the highest `p<N>` id found in a restored param tree,
// so params created after a restore (e.g. a later Expand) can't collide with
// ids that were persisted and rehydrated verbatim.
export function reserveIds(params: Param[]): void {
  const walk = (ps: Param[]) => {
    for (const p of ps) {
      const m = /^p(\d+)$/.exec(p.id);
      if (m) idCounter = Math.max(idCounter, Number(m[1]));
      if (p.nestedParams) walk(p.nestedParams);
    }
  };
  walk(params);
}

export function makeParam(key: string, rawValue: string): Param {
  return {
    id: nextId(),
    key,
    value: rawValue,
    rawValue,
    decodeCount: 0,
    expanded: false,
  };
}

export function parseUrl(input: string): ParsedUrl {
  const trimmed = input.trim();
  if (!trimmed) return { base: '', params: [] };
  if (!trimmed.includes('?')) return { base: trimmed, params: [] };
  const { base, pairs } = splitQuery(trimmed);
  return {
    base,
    params: pairs.map(({ key, value }) => makeParam(key, value)),
  };
}

// Operations on the param tree --------------------------------------------------

export function decodeParam(p: Param): Param {
  if (p.expanded) return p; // Decode is disabled while expanded.
  const next = decodeOnce(p.value);
  if (next === p.value) return p;
  return { ...p, value: next, decodeCount: p.decodeCount + 1 };
}

export function expandParam(p: Param): Param {
  if (p.expanded) return p;
  if (!looksExpandable(p.value)) return p;
  const { base, pairs } = splitQuery(p.value);
  if (pairs.length === 0) return p;
  return {
    ...p,
    expanded: true,
    nestedBase: base,
    nestedParams: pairs.map(({ key, value }) => makeParam(key, value)),
  };
}

export function resetParam(p: Param): Param {
  return {
    ...p,
    value: p.rawValue,
    decodeCount: 0,
    expanded: false,
    nestedBase: undefined,
    nestedParams: undefined,
  };
}

// Apply an update to the param identified by `id` anywhere in the tree.
export function updateParamById(
  params: Param[],
  id: string,
  updater: (p: Param) => Param,
): Param[] {
  return params.map((p) => {
    if (p.id === id) return updater(p);
    if (p.nestedParams) {
      const nested = updateParamById(p.nestedParams, id, updater);
      if (nested !== p.nestedParams) return { ...p, nestedParams: nested };
    }
    return p;
  });
}

// Flatten for diffing: yields one entry per leaf (non-expanded) param, keyed by
// dotted path. Expanded parents contribute a "<path>?" entry for the base portion.
export type FlatEntry = { keyPath: string; value: string };

export function flatten(params: Param[], prefix = ''): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const p of params) {
    const path = prefix ? `${prefix}.${p.key}` : p.key;
    if (p.expanded && p.nestedParams) {
      if (p.nestedBase) out.push({ keyPath: `${path} (base)`, value: p.nestedBase });
      out.push(...flatten(p.nestedParams, path));
    } else {
      out.push({ keyPath: path, value: p.value });
    }
  }
  return out;
}
