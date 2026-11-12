import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_VOTE_AT_KEY,
  LAW_OF_DAY_CACHE_WINDOW_MS,
  markVoteCast,
  votedSince,
  votedWithinCacheWindow,
} from '../src/utils/recent-vote.ts';

describe('recent vote tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('matches the 60 second max-age the API sends with the Law of the Day', () => {
    expect(LAW_OF_DAY_CACHE_WINDOW_MS).toBe(60_000);
  });

  it('reports no vote when none was ever cast', () => {
    expect(votedWithinCacheWindow()).toBe(false);
    expect(votedSince(0)).toBe(false);
  });

  it('stores the time of the vote under the key index.html reads', () => {
    markVoteCast();

    expect(localStorage.getItem(LAST_VOTE_AT_KEY)).toBe(String(Date.now()));
    expect(LAST_VOTE_AT_KEY).toBe('murphy_last_vote_at');
  });

  it('is inside the cache window for a minute after the vote, and not after', () => {
    markVoteCast();
    vi.advanceTimersByTime(59_999);
    expect(votedWithinCacheWindow()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(votedWithinCacheWindow()).toBe(false);
  });

  it('does not bypass the cache for good because of a stored time far ahead of the clock', () => {
    localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() + 3_600_000));

    expect(votedWithinCacheWindow()).toBe(false);
    expect(votedSince(0)).toBe(false);
  });

  it.each(['', 'yesterday', '0', '-1', '1e999'])('ignores an unusable stored time (%j)', (value) => {
    localStorage.setItem(LAST_VOTE_AT_KEY, value);

    expect(votedWithinCacheWindow()).toBe(false);
    expect(votedSince(0)).toBe(false);
  });

  it('tells whether a response fetched at a given time predates the vote', () => {
    const before = Date.now() - 1;
    const same = Date.now();
    markVoteCast();

    expect(votedSince(before)).toBe(true);
    expect(votedSince(same)).toBe(true);
    expect(votedSince(Date.now() + 1)).toBe(false);
  });

  it('survives localStorage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

    expect(() => markVoteCast()).not.toThrow();
    expect(votedWithinCacheWindow()).toBe(false);
    expect(votedSince(0)).toBe(false);
  });
});
