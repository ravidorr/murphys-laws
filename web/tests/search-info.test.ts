import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSearchInfo, hasActiveFilters } from '../src/utils/search-info.ts';
import * as apiModule from '../src/utils/api.ts';
import * as sanitizeModule from '../src/utils/sanitize.ts';

describe('Search Info utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateSearchInfo', () => {
    it('returns early when infoElement is null', async () => {
      await updateSearchInfo(null, { q: 'test' });
      // Should not throw
      expect(true).toBe(true);
    });

    it('clears content when no filters are active', async () => {
      const infoElement = document.createElement('div');
      infoElement.innerHTML = 'old content';

      await updateSearchInfo(infoElement, {});

      expect(infoElement.innerHTML).toBe('');
    });

    it('displays search query filter', async () => {
      const infoElement = document.createElement('div');

      await updateSearchInfo(infoElement, { q: 'test query' });

      expect(infoElement.innerHTML).toContain('test query');
      expect(infoElement.innerHTML).toContain('Search results for:');
    });

    it('displays category filter with category name', async () => {
      const infoElement = document.createElement('div');

      vi.spyOn(apiModule, 'fetchAPI').mockResolvedValue({
        title: 'Technology'
      });

      await updateSearchInfo(infoElement, { category_id: 5 });

      expect(infoElement.innerHTML).toContain('Technology');
      expect(infoElement.innerHTML).toContain('in category');
    });

    it('displays category filter with ID when category has no title', async () => {
      const infoElement = document.createElement('div');

      vi.spyOn(apiModule, 'fetchAPI').mockResolvedValue({
        id: 5
        // no title
      });

      await updateSearchInfo(infoElement, { category_id: 5 });

      expect(infoElement.innerHTML).toContain('#5');
      expect(infoElement.innerHTML).toContain('in category');
    });

    it('displays category filter with ID when API fails', async () => {
      const infoElement = document.createElement('div');

      vi.spyOn(apiModule, 'fetchAPI').mockRejectedValue(new Error('Network error'));

      await updateSearchInfo(infoElement, { category_id: 5 });

      expect(infoElement.innerHTML).toContain('#5');
      expect(infoElement.innerHTML).toContain('in category');
    });

    it('displays attribution filter', async () => {
      const infoElement = document.createElement('div');

      await updateSearchInfo(infoElement, { attribution: 'Murphy' });

      expect(infoElement.innerHTML).toContain('Murphy');
      expect(infoElement.innerHTML).toContain('by');
    });

    it('displays combined filters', async () => {
      const infoElement = document.createElement('div');

      vi.spyOn(apiModule, 'fetchAPI').mockResolvedValue({
        title: 'Science'
      });

      await updateSearchInfo(infoElement, {
        q: 'test',
        category_id: 3,
        attribution: 'Murphy'
      });

      expect(infoElement.innerHTML).toContain('test');
      expect(infoElement.innerHTML).toContain('Science');
      expect(infoElement.innerHTML).toContain('Murphy');
    });

    it('escapes HTML in search query', async () => {
      const infoElement = document.createElement('div');

      await updateSearchInfo(infoElement, { q: '<script>alert("xss")</script>' });

      expect(infoElement.innerHTML).not.toContain('<script>');
      expect(infoElement.innerHTML).toContain('&lt;script&gt;');
    });

    it('escapes HTML in attribution', async () => {
      const infoElement = document.createElement('div');

      await updateSearchInfo(infoElement, { attribution: '<img src=x onerror=alert(1)>' });

      expect(infoElement.innerHTML).not.toContain('<img');
      expect(infoElement.innerHTML).toContain('&lt;img');
    });

    it('renders category titles from the API as text', async () => {
      const infoElement = document.createElement('div');
      const maliciousTitle = '<img src=x onerror=alert(1)>';
      vi.spyOn(apiModule, 'fetchAPI').mockResolvedValue({ title: maliciousTitle });

      await updateSearchInfo(infoElement, { category_id: 5 });

      expect(infoElement.querySelector('img')).toBeNull();
      expect(infoElement.querySelector('strong')?.textContent).toBe(maliciousTitle);
    });

    it('renders non-numeric category IDs as text', async () => {
      const infoElement = document.createElement('div');
      const maliciousCategoryId = '<img src=x onerror=alert(1)>';

      await updateSearchInfo(infoElement, { category_id: maliciousCategoryId });

      expect(infoElement.querySelector('img')).toBeNull();
      expect(infoElement.querySelector('strong')?.textContent).toBe(maliciousCategoryId);
    });

    it('renders search query as text even if the escaping utility regresses', async () => {
      const infoElement = document.createElement('div');
      const maliciousQuery = '<img src=x onerror=alert(1)>';
      vi.spyOn(sanitizeModule, 'escapeHtml').mockImplementation((value) => String(value));

      await updateSearchInfo(infoElement, { q: maliciousQuery });

      expect(infoElement.querySelector('img')).toBeNull();
      expect(infoElement.querySelector('strong')?.textContent).toBe(maliciousQuery);
    });
  });

  describe('hasActiveFilters', () => {
    it('returns false when no filters are active', () => {
      expect(hasActiveFilters({})).toBe(false);
    });

    it('returns true when search query is present', () => {
      expect(hasActiveFilters({ q: 'test' })).toBe(true);
    });

    it('returns true when category_id is present', () => {
      expect(hasActiveFilters({ category_id: 5 })).toBe(true);
    });

    it('returns true when attribution is present', () => {
      expect(hasActiveFilters({ attribution: 'Murphy' })).toBe(true);
    });

    it('returns true when multiple filters are present', () => {
      expect(hasActiveFilters({ q: 'test', category_id: 5, attribution: 'Murphy' })).toBe(true);
    });

    it('returns false when filters are empty strings', () => {
      expect(hasActiveFilters({ q: '', category_id: 0, attribution: '' })).toBe(false);
    });
  });
});
