import { vi } from 'vitest';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';
import { fetchAPI, fetchLaw, fetchRelatedLaws, fetchLaws, fetchLawOfTheDay, fetchTopVoted, fetchTrending, fetchRecentlyAdded, fetchCategories, fetchSuggestions } from '../src/utils/api.ts';

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

      const callUrl = fetchSpy.mock.calls[0][0];
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
  });

  describe('fetchLawOfTheDay', () => {
    it('fetches from law-of-day endpoint', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ law: { id: 1, title: 'Top Law' }, featured_date: '2025-10-29' })
      });

      const result = await fetchLawOfTheDay();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/law-of-day'),
        expect.any(Object)
      );
      expect(result).toEqual({
        data: [{ id: 1, title: 'Top Law' }],
        total: 1,
        limit: 1,
        offset: 0
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
});
