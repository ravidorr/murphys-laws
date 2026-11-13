import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import type { MockInstance } from 'vitest';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';
import { fetchAPI, fetchDuplicateCandidates, fetchLaw, fetchRelatedCategories, fetchRelatedLaws, fetchLaws, fetchLawOfTheDay, consumeEarlyLawOfTheDay, peekEarlyLawOfTheDay, fetchTopVoted, fetchTrending, fetchRecentlyAdded, fetchCategories, fetchSuggestions } from '../src/utils/api.ts';
import { LAST_VOTE_AT_KEY } from '../src/utils/recent-vote.ts';

describe('API utilities', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  describe('growth endpoints', () => {
    it('fetches duplicate candidates', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 1, text: 'Existing law' }] })
      });

      await fetchDuplicateCandidates('Existing law with enough text');

      expect(String(fetchSpy.mock.calls[0]![0])).toContain('/api/v1/laws/duplicates');
      expect(String(fetchSpy.mock.calls[0]![0])).toContain('text=Existing+law+with+enough+text');
    });

    it('fetches related categories', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ slug: 'work', title: 'Work' }] })
      });

      await fetchRelatedCategories('murphys-office-laws');

      expect(String(fetchSpy.mock.calls[0]![0])).toContain('/api/v1/categories/murphys-office-laws/related');
    });

    it('skips the duplicate lookup for text shorter than ten characters', async () => {
      const localThis: { result?: Awaited<ReturnType<typeof fetchDuplicateCandidates>> } = {};
      localThis.result = await fetchDuplicateCandidates('too short');

      expect(localThis.result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchLaw', () => {
    it('throws error for invalid law ID (non-numeric)', async () => {
      await expect(fetchLaw('invalid')).rejects.toThrow('Invalid law ID');
    });

    it('throws error for invalid law ID (NaN)', async () => {
      await expect(fetchLaw(NaN)).rejects.toThrow('Invalid law ID');
    });

    it('throws error for invalid law ID (Infinity)', async () => {
      await expect(fetchLaw(Infinity)).rejects.toThrow('Invalid law ID');
    });

    it('fetches law with valid numeric ID', async () => {
      const mockLaw = { id: 1, title: 'Test Law', text: 'Test text' };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockLaw
      });

      const result = await fetchLaw(1);
      expect(result).toEqual(mockLaw);
    });

    it('fetches law with valid string numeric ID', async () => {
      const mockLaw = { id: 42, title: 'Test Law', text: 'Test text' };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockLaw
      });

      const result = await fetchLaw('42');
      expect(result).toEqual(mockLaw);
    });

    it('throws error when fetch fails', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(fetchLaw(999)).rejects.toThrow('Failed to fetch law: 404');
    });

    it('throws error for zero or negative law ID', async () => {
      await expect(fetchLaw(0)).rejects.toThrow('Invalid law ID');
      await expect(fetchLaw(-1)).rejects.toThrow('Invalid law ID');
    });

    it('throws when fetch network error occurs', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchLaw(1)).rejects.toThrow('Network error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws when API returns non-JSON response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: async () => ({})
      });

      await expect(fetchLaw(1)).rejects.toThrow('API returned non-JSON response');
    });

    it('succeeds when response has no headers.get (e.g. test mocks)', async () => {
      const mockLaw = { id: 1, title: 'Test', text: 'Text' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: {},
        json: async () => mockLaw
      });

      const result = await fetchLaw(1);
      expect(result).toEqual(mockLaw);
    });

    it('succeeds when response has Headers with content-type application/json', async () => {
      const mockLaw = { id: 1, title: 'Test', text: 'Text' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockLaw
      });

      const result = await fetchLaw(1);
      expect(result).toEqual(mockLaw);
    });

    it('passes an AbortSignal so stalled requests fail fast', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 1 })
      });

      await fetchLaw(1);

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });

    it('enters content-type check when headers.get exists and returns empty (covers L57 B1)', async () => {
      const mockLaw = { id: 1, title: 'Test', text: 'Text' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: { get: (): string => '' },
        json: async () => mockLaw
      });

      const result = await fetchLaw(1);
      expect(result).toEqual(mockLaw);
    });
  });

  describe('fetchRelatedLaws', () => {
    it('throws error for invalid law ID (non-numeric)', async () => {
      await expect(fetchRelatedLaws('invalid')).rejects.toThrow('Invalid law ID');
    });

    it('throws error for invalid law ID (NaN)', async () => {
      await expect(fetchRelatedLaws(NaN)).rejects.toThrow('Invalid law ID');
    });

    it('throws error for invalid law ID (zero or negative)', async () => {
      await expect(fetchRelatedLaws(0)).rejects.toThrow('Invalid law ID');
      await expect(fetchRelatedLaws(-1)).rejects.toThrow('Invalid law ID');
    });

    it('fetches related laws with valid numeric ID', async () => {
      const mockRelated = { data: [{ id: 2, text: 'Related' }], law_id: 1 };
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRelated
      });

      const result = await fetchRelatedLaws(1);
      expect(result).toEqual(mockRelated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/laws/1/related'),
        expect.any(Object)
      );
    });

    it('fetches related laws with valid string numeric ID', async () => {
      const mockRelated = { data: [], law_id: 42 };
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRelated
      });

      const result = await fetchRelatedLaws('42');
      expect(result).toEqual(mockRelated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/laws/42/related'),
        expect.any(Object)
      );
    });

    it('uses default limit of 5 (no limit param in URL)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], law_id: 1 })
      });

      await fetchRelatedLaws(1);
      
      // Default limit of 5 should not add limit param to URL
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('limit='),
        expect.any(Object)
      );
    });

    it('passes custom limit parameter', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], law_id: 1 })
      });

      await fetchRelatedLaws(1, { limit: 3 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=3'),
        expect.any(Object)
      );
    });

    it('throws when API request fails', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(fetchRelatedLaws(1)).rejects.toThrow('API request failed: 500');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchLaws', () => {
    it('includes search query when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ q: 'murphy' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=murphy'),
        expect.any(Object)
      );
    });

    it('trims search query whitespace', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ q: '  murphy  ' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=murphy'),
        expect.any(Object)
      );
    });

    it('excludes search query when empty string', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ q: '' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('q='),
        expect.any(Object)
      );
    });

    it('excludes search query when only whitespace', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ q: '   ' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('q='),
        expect.any(Object)
      );
    });

    it('includes category_id when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ category_id: 5 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('category_id=5'),
        expect.any(Object)
      );
    });

    it('excludes category_id when not provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({});

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('category_id='),
        expect.any(Object)
      );
    });

    it('includes attribution when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ attribution: 'Murphy' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('attribution=Murphy'),
        expect.any(Object)
      );
    });

    it('trims attribution whitespace', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ attribution: '  Murphy  ' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('attribution=Murphy'),
        expect.any(Object)
      );
    });

    it('excludes attribution when empty string', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ attribution: '' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('attribution='),
        expect.any(Object)
      );
    });

    it('excludes attribution when only whitespace', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ attribution: '   ' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('attribution='),
        expect.any(Object)
      );
    });

    it('combines multiple filters', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ q: 'test', category_id: 3, attribution: 'Smith' });

      const firstCall = fetchSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      const callUrl = firstCall![0] as string;
      expect(callUrl).toContain('q=test');
      expect(callUrl).toContain('category_id=3');
      expect(callUrl).toContain('attribution=Smith');
    });
  });

  describe('fetchAPI', () => {
    it('throws error when API request fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(fetchAPI('/api/laws')).rejects.toThrow('API request failed: 500');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when API returns non-JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' })
      });

      await expect(fetchAPI('/api/laws')).rejects.toThrow('API returned non-JSON response');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchAPI('/api/laws')).rejects.toThrow('Network error');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('accepts URLSearchParams as params', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      const params = new URLSearchParams({ q: 'test', limit: '10' });
      await fetchAPI('/api/laws', params);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('accepts response when content-type header is missing (test compatibility)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(), // No content-type
        json: async () => ({ data: [] })
      });

      // When content-type is empty but headers exist, we accept the response
      // This provides backwards compatibility with test mocks
      const result = await fetchAPI('/api/laws');
      expect(result).toEqual({ data: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns JSON data on success', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: 1 }] })
      });

      const result = await fetchAPI('/api/laws');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: [{ id: 1 }] });
    });

    it('passes an AbortSignal so stalled requests fail fast', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      await fetchAPI('/api/laws');

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('fetchLawOfTheDay', () => {
    it('fetches from law-of-day endpoint', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 1, text: 'Top law text', title: 'Top Law' }, featured_date: '2025-10-29' })
      });

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/law-of-day'),
        expect.any(Object)
      );
      expect(result).toEqual({
        data: [{ id: 1, text: 'Top law text', title: 'Top Law' }],
        total: 1,
        limit: 1,
        offset: 0
      });
    });
  });

  describe('fetchAPI fetch options', () => {
    it('passes extra fetch options such as cache through', async () => {
      fetchSpy.mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) });

      await fetchAPI('/api/v1/x', {}, { cache: 'no-cache' });

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
    });

    it('sets no cache mode by default', async () => {
      fetchSpy.mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) });

      await fetchAPI('/api/v1/x');

      expect(fetchSpy.mock.calls[0]![1]).not.toHaveProperty('cache');
    });
  });

  describe('Law of the Day after a vote', () => {
    const lawBody = { law: { id: 9, text: 'Fresh law.' }, featured_date: '2026-11-12' };

    beforeEach(() => {
      localStorage.clear();
      fetchSpy.mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => lawBody });
    });

    afterEach(() => {
      localStorage.clear();
      delete window.__earlyLawOfDay;
      vi.useRealTimers();
    });

    it('uses the HTTP cache when the visitor has not voted lately', async () => {
      await fetchLawOfTheDay();

      expect(fetchSpy.mock.calls[0]![1]).not.toHaveProperty('cache');
    });

    it('asks the network for the law within a minute of a vote, so the count includes it', async () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 5_000));

      await fetchLawOfTheDay();

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
    });

    it('uses the HTTP cache again a minute after the vote', async () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 60_000));

      await fetchLawOfTheDay();

      expect(fetchSpy.mock.calls[0]![1]).not.toHaveProperty('cache');
    });

    it('does not adopt an early result that was fetched before the vote, and fetches fresh instead', async () => {
      const preVoteLaw = { id: 5, text: 'Pre-vote law.', upvotes: 3, downvotes: 0 };
      window.__earlyLawOfDay = {
        law: preVoteLaw,
        error: null,
        url: '/api/v1/law-of-day',
        startedAt: Date.now() - 20_000,
        promise: Promise.resolve(preVoteLaw),
      };
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 5_000));

      expect(peekEarlyLawOfTheDay()).toBeNull();
      const result = await fetchLawOfTheDay();

      expect(window.__earlyLawOfDay).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
      expect(result.data[0]).toEqual(lawBody.law);
    });

    it('fetches fresh when the early request failed and the visitor voted a moment ago', async () => {
      window.__earlyLawOfDay = { law: null, url: '/api/v1/law-of-day', startedAt: Date.now(), error: null, promise: Promise.resolve(null) };
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 5_000));

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
      expect(result.data[0]).toEqual(lawBody.law);
    });

    it('keeps the cache bypass on the retry that gets only what is left of the shared 10 s', async () => {
      // A frozen clock, so the 3 s that went by before the retry is exactly 3 s
      vi.useFakeTimers();
      const timeoutSignal = vi.spyOn(AbortSignal, 'timeout');
      window.__earlyLawOfDay = { law: null, url: '/api/v1/law-of-day', error: '503', startedAt: Date.now() - 3_000, promise: Promise.resolve(null) };
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 5_000));

      await fetchLawOfTheDay();

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
      expect(timeoutSignal).toHaveBeenCalledWith(7_000);
    });

    it('still adopts a fresh early result when localStorage cannot be read', () => {
      const law = { id: 5, text: 'Early law.', upvotes: 4, downvotes: 0 };
      window.__earlyLawOfDay = { law, url: '/api/v1/law-of-day', startedAt: Date.now(), error: null, promise: Promise.resolve(law) };
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

      expect(peekEarlyLawOfTheDay()).toBe(law);
    });

    it('still adopts an early result that was fetched after the vote', async () => {
      localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 5_000));
      const law = { id: 5, text: 'Post-vote law.', upvotes: 4, downvotes: 0 };
      window.__earlyLawOfDay = { law, url: '/api/v1/law-of-day', startedAt: Date.now() - 1_000, error: null, promise: Promise.resolve(law) };

      expect(peekEarlyLawOfTheDay()).toBe(law);
      const result = await fetchLawOfTheDay();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.data[0]).toBe(law);
    });
  });

  describe('early Law of the Day request', () => {
    const law = { id: 5, text: 'Early law.', upvotes: 0, downvotes: 0 };

    function setEarly(overrides: Partial<EarlyLawOfDay> = {}): EarlyLawOfDay {
      const early: EarlyLawOfDay = { law, url: '/api/v1/law-of-day', startedAt: Date.now(), error: null, promise: Promise.resolve(law), ...overrides };
      window.__earlyLawOfDay = early;
      return early;
    }

    afterEach(() => {
      delete window.__earlyLawOfDay;
      vi.useRealTimers();
    });

    it('peeks at the law without consuming it', () => {
      const early = setEarly();

      expect(peekEarlyLawOfTheDay()).toBe(law);
      expect(window.__earlyLawOfDay).toBe(early);
    });

    it('has nothing to peek at or consume without an early request', () => {
      expect(peekEarlyLawOfTheDay()).toBeNull();
      expect(consumeEarlyLawOfTheDay()).toBeNull();
    });

    it('ignores a result that came from another API than the one the app requests', async () => {
      setEarly({ url: 'https://other.example/api/v1/law-of-day' });
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 9, text: 'From the configured API.' } })
      });

      expect(peekEarlyLawOfTheDay()).toBeNull();
      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.data[0]).toEqual({ id: 9, text: 'From the configured API.' });
      expect(window.__earlyLawOfDay).toBeUndefined();
    });

    it('drops, and does not hand over, a result from another API', () => {
      setEarly({ url: '/v2/api/v1/law-of-day' });

      expect(consumeEarlyLawOfTheDay()).toBeNull();
      expect(window.__earlyLawOfDay).toBeUndefined();
    });

    it('has no law to peek at while the early request is pending', () => {
      setEarly({ law: null, promise: new Promise(() => {}) });

      expect(peekEarlyLawOfTheDay()).toBeNull();
    });

    it('hands the early request over once', () => {
      const early = setEarly();

      expect(consumeEarlyLawOfTheDay()).toBe(early.promise);
      expect(window.__earlyLawOfDay).toBeUndefined();
      expect(consumeEarlyLawOfTheDay()).toBeNull();
    });

    it('ignores, and drops, a result older than a minute', () => {
      vi.useFakeTimers();
      setEarly({ startedAt: Date.now() });
      vi.advanceTimersByTime(60_001);

      expect(peekEarlyLawOfTheDay()).toBeNull();
      expect(consumeEarlyLawOfTheDay()).toBeNull();
      expect(window.__earlyLawOfDay).toBeUndefined();
    });

    it('still adopts a result that is exactly a minute old', () => {
      vi.useFakeTimers();
      const early = setEarly({ startedAt: Date.now() });
      vi.advanceTimersByTime(60_000);

      expect(consumeEarlyLawOfTheDay()).toBe(early.promise);
    });

    it('fetchLawOfTheDay adopts the early law without a second request', async () => {
      setEarly();

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [law], total: 1, limit: 1, offset: 0 });
      expect(window.__earlyLawOfDay).toBeUndefined();
    });

    it('fetchLawOfTheDay waits for a pending early request', async () => {
      let resolveEarly!: (value: typeof law | null) => void;
      setEarly({ law: null, promise: new Promise((resolve) => { resolveEarly = resolve; }) });

      const pending = fetchLawOfTheDay();
      resolveEarly(law);

      await expect(pending).resolves.toEqual({ data: [law], total: 1, limit: 1, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetchLawOfTheDay requests the law itself when the early request failed', async () => {
      setEarly({ law: null, promise: Promise.resolve(null) });
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 9, text: 'Fresh law.' }, featured_date: '2025-10-29' })
      });

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.data[0]).toEqual({ id: 9, text: 'Fresh law.' });
    });

    it('fetchLawOfTheDay fetches again on a retry after the early request was used', async () => {
      setEarly();
      await fetchLawOfTheDay();
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 6, text: 'Retried.' } })
      });

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.data[0]).toEqual({ id: 6, text: 'Retried.' });
    });

    describe('when the early request hangs or fails', () => {
      const ownResponse = () => ({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 9, text: 'Fresh law.' } })
      });

      beforeEach(() => {
        vi.mocked(Sentry.addBreadcrumb).mockClear();
        vi.mocked(Sentry.captureMessage).mockClear();
        fetchSpy.mockResolvedValue(ownResponse());
      });

      it('stops waiting when the early request has used its 10 s, and goes straight to the error state without a second try', async () => {
        vi.useFakeTimers();
        const early = setEarly({ law: null, startedAt: Date.now() - 6_000, promise: new Promise(() => {}) });

        const pending = fetchLawOfTheDay();
        const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(3_999);
        expect(fetchSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        await outcome;
        // The wait never depended on the early promise: it is still pending
        expect(early.law).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('does not wait at all, and does not ask again, when the early request is already past its 10 s', async () => {
        vi.useFakeTimers();
        setEarly({ law: null, startedAt: Date.now() - 30_000, promise: new Promise(() => {}) });

        const pending = fetchLawOfTheDay();
        const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(0);

        await outcome;
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it('records a timeout as a breadcrumb only, like the other network failures', async () => {
        vi.useFakeTimers();
        setEarly({ law: null, startedAt: Date.now() - 20_000, promise: new Promise(() => {}) });

        const pending = fetchLawOfTheDay();
        const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(0);
        await outcome;

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
          category: 'law-of-day',
          message: 'Early Law of the Day failed: timeout'
        }));
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });

      it('retries after a quick early failure with what is left of the 10 s, not a fresh 10 s', async () => {
        vi.useFakeTimers();
        const timeoutSignal = vi.spyOn(AbortSignal, 'timeout');
        setEarly({ law: null, error: '503', startedAt: Date.now() - 3_000, promise: Promise.resolve(null) });

        await expect(fetchLawOfTheDay()).resolves.toMatchObject({ data: [{ id: 9 }] });

        expect(timeoutSignal).toHaveBeenCalledWith(7_000);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      });

      it('gives the retry the whole 10 s when the early request failed at once', async () => {
        // A frozen clock: with the real one, a 1 ms tick between setEarly (which stamps the start) and the retry
        // leaves 9_999 ms
        vi.useFakeTimers();
        const timeoutSignal = vi.spyOn(AbortSignal, 'timeout');
        setEarly({ law: null, error: 'network', promise: Promise.resolve(null) });

        await fetchLawOfTheDay();

        expect(timeoutSignal).toHaveBeenCalledWith(10_000);
      });

      it('makes its own request with the full 10 s when there is no early request at all', async () => {
        const timeoutSignal = vi.spyOn(AbortSignal, 'timeout');

        await expect(fetchLawOfTheDay()).resolves.toMatchObject({ data: [{ id: 9 }] });

        expect(timeoutSignal).toHaveBeenCalledWith(10_000);
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });

      it('ends a hung API after 10 s in total, even where the request cannot be aborted', async () => {
        vi.useFakeTimers();
        // A request that ignores its signal, as in a browser without AbortController
        fetchSpy.mockReturnValue(new Promise(() => {}));
        setEarly({ law: null, error: '503', startedAt: Date.now() - 4_000, promise: Promise.resolve(null) });

        const pending = fetchLawOfTheDay();
        const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(5_999);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);

        await outcome;
        expect(vi.getTimerCount()).toBe(0);
      });

      it('ends a hung API after 10 s when there is no early request', async () => {
        vi.useFakeTimers();
        fetchSpy.mockReturnValue(new Promise(() => {}));

        const pending = fetchLawOfTheDay();
        const outcome = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(9_999);
        await vi.advanceTimersByTimeAsync(1);

        await outcome;
      });

      it.each(['timeout', 'abort', 'network'])('does not send an event for a %s failure the script recorded', async (reason) => {
        setEarly({ law: null, error: reason, promise: Promise.resolve(null) });

        await fetchLawOfTheDay();

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: `Early Law of the Day failed: ${reason}` }));
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });

      it.each(['503', 'parse', 'shape'])('reports a %s failure the script recorded, once, when the app falls back', async (reason) => {
        setEarly({ law: null, error: reason, promise: Promise.resolve(null) });

        await fetchLawOfTheDay();

        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(`Early Law of the Day failed: ${reason}`, { level: 'warning', extra: { reason } });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      it('reports a failed early paint when the app takes over the early law', () => {
        const early = setEarly({ error: 'paint' });

        expect(consumeEarlyLawOfTheDay()).toBe(early.promise);

        expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: paint', { level: 'warning', extra: { reason: 'paint' } });
      });

      it('still uses an early law that arrived long ago, without a second request or a report', async () => {
        vi.useFakeTimers();
        setEarly({ startedAt: Date.now() - 30_000 });

        await expect(fetchLawOfTheDay()).resolves.toEqual({ data: [law], total: 1, limit: 1, offset: 0 });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      });

      it('reports a failed early paint when fetchLawOfTheDay adopts the law', async () => {
        setEarly({ error: 'paint' });

        await expect(fetchLawOfTheDay()).resolves.toMatchObject({ data: [law] });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: paint', { level: 'warning', extra: { reason: 'paint' } });
      });

      it('falls back to its own request and reports it if the early promise rejects', async () => {
        const early = setEarly({ law: null, promise: Promise.reject(new Error('boom')) });

        await expect(fetchLawOfTheDay()).resolves.toMatchObject({ data: [{ id: 9 }] });

        expect(early.error).toBe('error');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: error', { level: 'warning', extra: { reason: 'error' } });
      });

      it('reports an early result from another API than the app uses', async () => {
        setEarly({ url: '/__API_BASE_URL__/api/v1/law-of-day' });

        await fetchLawOfTheDay();

        expect(Sentry.captureMessage).toHaveBeenCalledWith('Early Law of the Day failed: url-mismatch', {
          level: 'warning',
          extra: { reason: 'url-mismatch', url: '/__API_BASE_URL__/api/v1/law-of-day' }
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      it('leaves a result that is too old as a breadcrumb only', async () => {
        vi.useFakeTimers();
        setEarly({ startedAt: Date.now() - 61_000 });

        await fetchLawOfTheDay();

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Early Law of the Day failed: stale' }));
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });

      it('leaves a result that was made obsolete by a vote as a breadcrumb only, and asks the network for the law', async () => {
        localStorage.setItem(LAST_VOTE_AT_KEY, String(Date.now() - 1_000));
        setEarly({ law: null, startedAt: Date.now() - 4_000, promise: new Promise(() => {}) });

        await fetchLawOfTheDay();

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'Early Law of the Day failed: voted' }));
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'no-cache' });
        localStorage.clear();
      });

      it('never gives the retry more than the one window, even if the clock stepped backwards', async () => {
        const timeoutSignal = vi.spyOn(AbortSignal, 'timeout');
        setEarly({ law: null, error: '503', startedAt: Date.now() + 5_000, promise: Promise.resolve(null) });

        await fetchLawOfTheDay();

        expect(timeoutSignal).toHaveBeenCalledWith(10_000);
      });

      it('reports nothing when the early request succeeded', async () => {
        setEarly();

        await fetchLawOfTheDay();

        expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe('fetchTopVoted', () => {
    it('fetches laws sorted by score with custom limit', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchTopVoted(10);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  describe('fetchTrending', () => {
    it('fetches laws sorted by last_voted_at', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchTrending(5);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('sort=last_voted_at'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRecentlyAdded', () => {
    it('fetches laws sorted by created_at', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchRecentlyAdded(7);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('sort=created_at'),
        expect.any(Object)
      );
    });
  });

  describe('fetchCategories', () => {
    it('fetches all categories', async () => {
      const mockCategories = { data: [{ id: 1, name: 'General' }, { id: 2, name: 'Technology' }] };
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockCategories
      });

      const result = await fetchCategories();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/categories'),
        expect.any(Object)
      );
      expect(result).toEqual(mockCategories);
    });
  });

  describe('fetchSuggestions', () => {
    it('returns empty array for empty query', async () => {
      const result = await fetchSuggestions({ q: '' });
      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty array for null query', async () => {
      const result = await fetchSuggestions({ q: null });
      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty array for undefined query', async () => {
      const result = await fetchSuggestions({});
      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty array for query shorter than 2 characters', async () => {
      const result = await fetchSuggestions({ q: 'a' });
      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only query shorter than 2 chars after trim', async () => {
      const result = await fetchSuggestions({ q: ' a ' });
      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches suggestions for valid query', async () => {
      const mockSuggestions = { data: [{ id: 1, text: 'Test law' }] };
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockSuggestions
      });

      const result = await fetchSuggestions({ q: 'test' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/laws/suggestions'),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        expect.any(Object)
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('trims query whitespace', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      await fetchSuggestions({ q: '  test  ' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        expect.any(Object)
      );
    });

    it('uses default limit of 10', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      await fetchSuggestions({ q: 'test' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('respects custom limit', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      await fetchSuggestions({ q: 'test', limit: 5 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object)
      );
    });

    it('caps limit at 20', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [] })
      });

      await fetchSuggestions({ q: 'test', limit: 100 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });

    it('returns empty array on API error', async () => {
      fetchSpy.mockRejectedValue(new Error('API Error'));

      const result = await fetchSuggestions({ q: 'test' });

      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    });

    it('reports non-Error rejections because they are not transport failures', async () => {
      const localThis: { result?: Awaited<ReturnType<typeof fetchSuggestions>> } = {};
      fetchSpy.mockRejectedValueOnce('unexpected failure');

      localThis.result = await fetchSuggestions({ q: 'test' });

      expect(localThis.result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).toHaveBeenCalledWith('unexpected failure');
    });

    it('returns empty array without reporting transient fetch transport failures', async () => {
      vi.mocked(Sentry.captureException).mockClear();
      fetchSpy.mockRejectedValue(new TypeError('NetworkError while fetching'));

      const result = await fetchSuggestions({ q: 'test' });

      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('treats AbortSignal.timeout rejections as transport errors, not Sentry exceptions', async () => {
      vi.mocked(Sentry.captureException).mockClear();
      fetchSpy.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

      const result = await fetchSuggestions({ q: 'test' });

      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('treats DOMException AbortError as a transport error too', async () => {
      vi.mocked(Sentry.captureException).mockClear();
      fetchSpy.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

      const result = await fetchSuggestions({ q: 'test' });

      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('returns empty array when API request fails', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await fetchSuggestions({ q: 'test' });

      expect(result).toEqual({ data: [], total: 0, limit: 0, offset: 0 });
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('fetchLaws with category_slug', () => {
    it('includes category_slug when provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ category_slug: 'technology' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('category_slug=technology'),
        expect.any(Object)
      );
    });

    it('excludes category_slug when not provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({});

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('category_slug='),
        expect.any(Object)
      );
    });
  });

  describe('fetchLaws with exclude_corollaries', () => {
    it('includes exclude_corollaries=1 when exclude_corollaries is true', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({ exclude_corollaries: true });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('exclude_corollaries=1'),
        expect.any(Object)
      );
    });

    it('omits exclude_corollaries when not provided', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [], total: 0 })
      });

      await fetchLaws({});

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('exclude_corollaries='),
        expect.any(Object)
      );
    });
  });
});
