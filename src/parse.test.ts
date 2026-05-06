import { describe, it, expect } from 'vitest';
import {
  decodeOnce,
  canDecodeFurther,
  looksExpandable,
  splitQuery,
  parseUrl,
  decodeParam,
  expandParam,
  resetParam,
  updateParamById,
  flatten,
  makeParam,
} from './parse';

describe('decodeOnce', () => {
  it('decodes percent-encoded sequences', () => {
    expect(decodeOnce('hello%20world')).toBe('hello world');
    expect(decodeOnce('a%3Db%26c%3Dd')).toBe('a=b&c=d');
  });

  it('returns the input unchanged when there is nothing to decode', () => {
    expect(decodeOnce('plain')).toBe('plain');
  });

  it('returns the input unchanged on malformed sequences (does not throw)', () => {
    expect(decodeOnce('%E0%A4%A')).toBe('%E0%A4%A');
    expect(decodeOnce('%')).toBe('%');
  });
});

describe('canDecodeFurther', () => {
  it('is true when decoding would change the value', () => {
    expect(canDecodeFurther('hello%20world')).toBe(true);
  });

  it('is false when decoding would not change the value', () => {
    expect(canDecodeFurther('plain')).toBe(false);
  });

  it('is false on malformed sequences', () => {
    expect(canDecodeFurther('%')).toBe(false);
  });
});

describe('looksExpandable', () => {
  it('detects URLs with a query string', () => {
    expect(looksExpandable('https://x.com/path?a=1&b=2')).toBe(true);
    expect(looksExpandable('/path?a=1')).toBe(true);
  });

  it('detects bare query strings with multiple pairs', () => {
    expect(looksExpandable('a=1&b=2')).toBe(true);
  });

  it('rejects strings with no =', () => {
    expect(looksExpandable('hello')).toBe(false);
    expect(looksExpandable('')).toBe(false);
  });

  it('rejects single-pair bare values without ?', () => {
    expect(looksExpandable('a=1')).toBe(false);
  });

  it('rejects bare strings whose keys look unreasonable', () => {
    expect(looksExpandable('hello world=1&b=2')).toBe(false);
    expect(looksExpandable('=1&=2')).toBe(false);
  });

  it('rejects bare strings if any segment has an empty key', () => {
    // Locks the "every &-segment must have a non-empty key" invariant.
    expect(looksExpandable('a=1&=2')).toBe(false);
  });
});

describe('splitQuery', () => {
  it('splits "base?qs" into base and pairs', () => {
    const result = splitQuery('https://x.com/p?a=1&b=2');
    expect(result.base).toBe('https://x.com/p');
    expect(result.pairs).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('treats a value with no ? as the query string with empty base', () => {
    const result = splitQuery('a=1&b=2');
    expect(result.base).toBe('');
    expect(result.pairs).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('handles a key without an = (no value)', () => {
    const result = splitQuery('?flag&a=1');
    expect(result.pairs).toEqual([
      { key: 'flag', value: '' },
      { key: 'a', value: '1' },
    ]);
  });

  it('skips empty pair segments from "&&"', () => {
    const result = splitQuery('?a=1&&b=2');
    expect(result.pairs).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps everything after the first = as the value', () => {
    const result = splitQuery('?token=abc=def=ghi');
    expect(result.pairs).toEqual([{ key: 'token', value: 'abc=def=ghi' }]);
  });

  it('preserves an empty key when the segment starts with =', () => {
    const result = splitQuery('?=foo&a=1');
    expect(result.pairs).toEqual([
      { key: '', value: 'foo' },
      { key: 'a', value: '1' },
    ]);
  });
});

describe('parseUrl', () => {
  it('returns empty result for empty/whitespace input', () => {
    expect(parseUrl('')).toEqual({ base: '', params: [] });
    expect(parseUrl('   ')).toEqual({ base: '', params: [] });
  });

  it('returns base only when no query string is present (regression for 0f5cbc6)', () => {
    // Bug fix: a URL like "https://example.com" without "?" should not be
    // treated as a bare query string.
    const result = parseUrl('https://example.com');
    expect(result.base).toBe('https://example.com');
    expect(result.params).toEqual([]);
  });

  it('parses a full URL with query params', () => {
    const result = parseUrl('https://x.com/path?a=1&b=hello%20world');
    expect(result.base).toBe('https://x.com/path');
    expect(result.params).toHaveLength(2);
    expect(result.params[0]).toMatchObject({ key: 'a', value: '1', rawValue: '1', decodeCount: 0, expanded: false });
    expect(result.params[1]).toMatchObject({ key: 'b', value: 'hello%20world' });
  });

  it('assigns a unique id to each param', () => {
    const result = parseUrl('https://x.com/?a=1&b=2&c=3');
    const ids = result.params.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('trims surrounding whitespace from input', () => {
    const result = parseUrl('  https://x.com/?a=1  ');
    expect(result.base).toBe('https://x.com/');
    expect(result.params[0].key).toBe('a');
  });

  it('keeps repeated keys as separate Param entries (no de-duping)', () => {
    // Documents current behaviour: ?a=1&a=2 yields two distinct params.
    // Downstream consumers (e.g. DiffView's flat map) collapse these by keyPath,
    // so changing this requires touching the diff layer too.
    const result = parseUrl('https://x.com/?a=1&a=2');
    expect(result.params).toHaveLength(2);
    expect(result.params.map((p) => [p.key, p.value])).toEqual([
      ['a', '1'],
      ['a', '2'],
    ]);
    expect(result.params[0].id).not.toBe(result.params[1].id);
  });
});

describe('decodeParam', () => {
  it('decodes once and increments decodeCount', () => {
    const p = makeParam('q', 'a%20b');
    const next = decodeParam(p);
    expect(next.value).toBe('a b');
    expect(next.decodeCount).toBe(1);
    expect(next.rawValue).toBe('a%20b');
  });

  it('returns the same reference when value is already fully decoded', () => {
    const p = makeParam('q', 'plain');
    expect(decodeParam(p)).toBe(p);
  });

  it('is a no-op when expanded', () => {
    const p = { ...makeParam('q', 'a%20b'), expanded: true };
    expect(decodeParam(p)).toBe(p);
  });

  it('peels two encoding layers across two calls', () => {
    // 'a%2520b' -> 'a%20b' -> 'a b'
    const p0 = makeParam('q', 'a%2520b');
    const p1 = decodeParam(p0);
    expect(p1.value).toBe('a%20b');
    expect(p1.decodeCount).toBe(1);
    const p2 = decodeParam(p1);
    expect(p2.value).toBe('a b');
    expect(p2.decodeCount).toBe(2);
    // rawValue stays the original through the chain.
    expect(p2.rawValue).toBe('a%2520b');
    // A third call is a no-op once fully decoded.
    expect(decodeParam(p2)).toBe(p2);
  });
});

describe('expandParam', () => {
  it('expands a value that looks like a URL with a query', () => {
    const p = makeParam('redirect', '/cb?code=abc&state=xyz');
    const next = expandParam(p);
    expect(next.expanded).toBe(true);
    expect(next.nestedBase).toBe('/cb');
    expect(next.nestedParams).toHaveLength(2);
    expect(next.nestedParams?.[0]).toMatchObject({ key: 'code', value: 'abc' });
  });

  it('does not expand a value that does not look expandable', () => {
    const p = makeParam('q', 'plain');
    expect(expandParam(p)).toBe(p);
  });

  it('does not re-expand an already-expanded param', () => {
    const p = expandParam(makeParam('q', '/cb?a=1&b=2'));
    expect(expandParam(p)).toBe(p);
  });
});

describe('resetParam', () => {
  it('restores rawValue after multiple decodes', () => {
    // 'a%2520b' -> 'a%20b' -> 'a b'
    let p = makeParam('q', 'a%2520b');
    p = decodeParam(p);
    p = decodeParam(p);
    expect(p.value).toBe('a b');
    expect(p.decodeCount).toBe(2);
    const reset = resetParam(p);
    expect(reset.value).toBe('a%2520b');
    expect(reset.decodeCount).toBe(0);
    expect(reset.expanded).toBe(false);
  });

  it('clears expanded state and nested fields', () => {
    const p = expandParam(makeParam('q', '/cb?a=1&b=2'));
    expect(p.expanded).toBe(true);
    expect(p.nestedParams).toHaveLength(2);
    const reset = resetParam(p);
    expect(reset.value).toBe('/cb?a=1&b=2');
    expect(reset.expanded).toBe(false);
    expect(reset.nestedBase).toBeUndefined();
    expect(reset.nestedParams).toBeUndefined();
  });
});

describe('updateParamById', () => {
  it('updates a top-level param by id', () => {
    const a = makeParam('a', 'A');
    const b = makeParam('b', 'B');
    const result = updateParamById([a, b], b.id, (p) => ({ ...p, value: 'B!' }));
    expect(result[0]).toBe(a); // unchanged ref
    expect(result[1].value).toBe('B!');
  });

  it('updates a nested param and clones the parent only along the path', () => {
    const inner = makeParam('inner', 'i');
    const sibling = makeParam('sibling', 's');
    const outer = { ...makeParam('outer', '/?inner=i'), expanded: true, nestedParams: [inner] };
    const result = updateParamById([outer, sibling], inner.id, (p) => ({ ...p, value: 'i!' }));
    expect(result[1]).toBe(sibling); // unchanged ref
    expect(result[0].nestedParams?.[0].value).toBe('i!');
    expect(result[0]).not.toBe(outer);
  });

  it('returns the same content when id is not found at the top level', () => {
    const a = makeParam('a', 'A');
    const b = makeParam('b', 'B');
    const result = updateParamById([a, b], 'no-such-id', (p) => ({ ...p, value: 'X' }));
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it('preserves leaf refs when id is not found anywhere in the tree', () => {
    // NOTE: The current implementation always clones a parent that has
    // nestedParams (because Array.prototype.map returns a new array, so the
    // `nested !== p.nestedParams` guard never short-circuits even when no
    // descendant matched). The leaves themselves are still preserved by ref,
    // which is what React reconciliation actually cares about.
    const a = makeParam('a', 'A');
    const inner = makeParam('inner', 'i');
    const outer = { ...makeParam('outer', '/?inner=i'), expanded: true, nestedParams: [inner] };
    const result = updateParamById([a, outer], 'no-such-id', (p) => ({ ...p, value: 'X' }));
    expect(result[0]).toBe(a);
    // outer has nestedParams, so it is re-cloned (deep-equal but not same ref).
    expect(result[1]).toStrictEqual(outer);
    expect(result[1].nestedParams?.[0]).toBe(inner);
  });
});

describe('flatten', () => {
  it('flattens leaf params with their key paths', () => {
    const params = parseUrl('https://x.com/?a=1&b=2').params;
    expect(flatten(params)).toEqual([
      { keyPath: 'a', value: '1' },
      { keyPath: 'b', value: '2' },
    ]);
  });

  it('emits "<path> (base)" for the base portion of expanded params', () => {
    // parseUrl splits at the first '?', so the top-level params are
    //   redirect=/cb?code=abc   and   state=xyz
    const root = parseUrl('https://x.com/?redirect=/cb?code=abc&state=xyz').params;
    const expanded = root.map((p) => (p.key === 'redirect' ? expandParam(p) : p));
    const flat = flatten(expanded);
    expect(flat).toEqual([
      { keyPath: 'redirect (base)', value: '/cb' },
      { keyPath: 'redirect.code', value: 'abc' },
      { keyPath: 'state', value: 'xyz' },
    ]);
  });

  it('omits the base entry when expanded value has no base', () => {
    const p = expandParam(makeParam('q', 'a=1&b=2'));
    expect(flatten([p])).toEqual([
      { keyPath: 'q.a', value: '1' },
      { keyPath: 'q.b', value: '2' },
    ]);
  });
});
