import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAPI, fetchLaw, fetchLaws, fetchLawOfTheDay, fetchTopVoted, fetchTrending, fetchRecentlyAdded } from '../src/utils/api.js';

describe('API utilities', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
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

      const callUrl = fetchSpy.mock.calls[0][0];
      expect(callUrl).toContain('q=test');
      expect(callUrl).toContain('category_id=3');
      expect(callUrl).toContain('attribution=Smith');
    });
  });

  describe('fetchAPI', () => {
    it('uses fallback URL when primary fetch fails', async () => {

      // First call fails
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Second call (fallback) succeeds
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await fetchAPI('/api/laws');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: [] });
    });

    it('uses fallback URL when primary returns non-JSON', async () => {

      // First call returns HTML
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' })
      });

      // Second call (fallback) succeeds
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await fetchAPI('/api/laws');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: [] });

    });

    it('throws error when fallback also fails', async () => {

      // Both calls fail
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503
      });

      await expect(fetchAPI('/api/laws')).rejects.toThrow('Fallback fetch not ok: 503');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

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

    it('handles missing content-type header', async () => {

      // First call has no content-type header
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(), // No content-type
        json: async () => ({ data: [] })
      });

      // Second call (fallback) succeeds
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await fetchAPI('/api/laws');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: [] });

    });
  });

  describe('fetchLawOfTheDay', () => {
    it('fetches single law sorted by score', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: 1, title: 'Top Law' }], total: 1 })
      });

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=1'),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('sort=score'),
        expect.any(Object)
      );
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
});
