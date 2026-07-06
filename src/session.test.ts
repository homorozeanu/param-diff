import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadCurrent,
  saveCurrent,
  loadHistory,
  saveHistory,
} from './session';
import type { Slot, Snapshot } from './types';

const CURRENT_KEY = 'paramdiff.current.v1';
const HISTORY_KEY = 'paramdiff.history.v1';

function slot(raw: string): Slot {
  return { id: 'slot-1', raw, parsed: { base: '', params: [] } };
}

function snapshot(id: string): Snapshot {
  return { id, savedAt: 1_700_000_000_000, slots: [slot('https://x.com/?a=1')] };
}

describe('session storage', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  describe('current', () => {
    it('round-trips slots', () => {
      const slots = [slot('https://x.com/?a=1'), slot('https://y.com/?b=2')];
      saveCurrent(slots);
      expect(loadCurrent()).toEqual(slots);
    });

    it('returns null when nothing is stored', () => {
      expect(loadCurrent()).toBeNull();
    });

    it('returns null and drops the value on corrupt JSON', () => {
      sessionStorage.setItem(CURRENT_KEY, '{not json');
      expect(loadCurrent()).toBeNull();
      expect(sessionStorage.getItem(CURRENT_KEY)).toBeNull();
    });

    it('returns null when the stored value is not an array', () => {
      sessionStorage.setItem(CURRENT_KEY, JSON.stringify({ nope: true }));
      expect(loadCurrent()).toBeNull();
    });
  });

  describe('history', () => {
    it('round-trips snapshots', () => {
      const list = [snapshot('a'), snapshot('b')];
      saveHistory(list);
      expect(loadHistory()).toEqual(list);
    });

    it('returns [] when nothing is stored', () => {
      expect(loadHistory()).toEqual([]);
    });

    it('returns [] on corrupt data', () => {
      sessionStorage.setItem(HISTORY_KEY, 'garbage');
      expect(loadHistory()).toEqual([]);
    });
  });

  it('does not throw when setItem throws (quota / disabled)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => saveCurrent([slot('x')])).not.toThrow();
    expect(() => saveHistory([snapshot('a')])).not.toThrow();
  });
});
