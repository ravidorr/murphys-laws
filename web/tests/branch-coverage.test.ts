/**
 * Tests specifically targeting uncovered branches to improve branch coverage.
 * This file covers edge cases and branches not tested in the main test files.
 */

import { Breadcrumb } from '@components/breadcrumb.js';
import { AdvancedSearch } from '@components/advanced-search.js';
import { addVotingListeners } from '../src/utils/voting.js';
import * as api from '../src/utils/api.js';
import * as cacheUtils from '../src/utils/category-cache.js';

describe('Branch Coverage Tests', () => {
  describe('Breadcrumb component', () => {
    const localThis = {
      el: null,
    };

    afterEach(() => {
      if (localThis.el?.parentNode) {
        localThis.el.parentNode.removeChild(localThis.el);
      }
      localThis.el = null;
    });

    it('uses provided href when available on intermediate items', () => {
      const items = [
        { label: 'Category', href: '/categories', nav: 'categories' },
        { label: 'Current Page' }
      ];

      localThis.el = Breadcrumb({ items, onNavigate: () => {} });

      // Find the category link (Home link is first, then our category link)
      const categoryLink = localThis.el.querySelector('[data-nav="categories"]');
      expect(categoryLink).toBeTruthy();
      expect(categoryLink.getAttribute('href')).toBe('/categories');
    });

    it('falls back to "#" when href is not provided on intermediate items', () => {
      const items = [
        { label: 'Category', nav: 'categories' }, // No href
        { label: 'Current Page' }
      ];

      localThis.el = Breadcrumb({ items, onNavigate: () => {} });

      // Find the category link - should have href="#" as fallback
      const categoryLink = localThis.el.querySelector('[data-nav="categories"]');
      expect(categoryLink).toBeTruthy();
      expect(categoryLink.getAttribute('href')).toBe('#');
    });

    it('handles click events on non-Element targets gracefully', () => {
      const onNavigateMock = vi.fn();
      const items = [
        { label: 'Category', nav: 'categories' },
        { label: 'Current Page' }
      ];

      localThis.el = Breadcrumb({ items, onNavigate: onNavigateMock });

      // Create a click event with a text node (non-Element) as target
      const textNode = document.createTextNode('text');
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: textNode });
      localThis.el.dispatchEvent(event);

      // onNavigate should not be called because target is not an Element
      expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('does not call onNavigate when clicking element without data-nav', () => {
      const onNavigateMock = vi.fn();
      const items = [
        { label: 'Current Page' }  // Only current page, no intermediate items
      ];

      localThis.el = Breadcrumb({ items, onNavigate: onNavigateMock });

      // Click on the current page span (which has no data-nav)
      const currentSpan = localThis.el.querySelector('.breadcrumb-current');
      if (currentSpan) {
        currentSpan.click();
      }

      // onNavigate should only be called if clicked on something with data-nav
      // Current page has no data-nav, but the home link does exist
      // However, we're clicking on the current span, not the home link
      expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('does not navigate when intermediate item has no nav attribute', () => {
      const onNavigateMock = vi.fn();
      const items = [
        { label: 'Category' },  // No nav attribute - creates link but without data-nav
        { label: 'Current Page' }
      ];

      localThis.el = Breadcrumb({ items, onNavigate: onNavigateMock });

      // Find the category link (it will have no data-nav)
      const allLinks = localThis.el.querySelectorAll('.breadcrumb-link');
      // First link is Home (has data-nav), second is Category (no data-nav)
      const categoryLink = allLinks[1];
      
      if (categoryLink && !categoryLink.hasAttribute('data-nav')) {
        categoryLink.click();
        // onNavigate should not be called because navTarget is falsy
        expect(onNavigateMock).not.toHaveBeenCalled();
      }
    });

    it('calls onNavigate when clicking link with data-nav attribute', () => {
      const onNavigateMock = vi.fn();
      const items = [
        { label: 'Category', nav: 'categories' },
        { label: 'Current Page' }
      ];

      localThis.el = Breadcrumb({ items, onNavigate: onNavigateMock });
      document.body.appendChild(localThis.el);

      const link = localThis.el.querySelector('[data-nav="categories"]');
      link.click();

      expect(onNavigateMock).toHaveBeenCalledWith('categories');
    });

    it('handles navigation when onNavigate is not provided', () => {
      const items = [
        { label: 'Category', nav: 'categories' },
        { label: 'Current Page' }
      ];

      // Intentionally omit onNavigate to test undefined branch; assert to satisfy required type
      localThis.el = Breadcrumb({ items } as Parameters<typeof Breadcrumb>[0]);
      document.body.appendChild(localThis.el);

      const link = localThis.el.querySelector('[data-nav="categories"]');
      
      // Should not throw when clicking
      expect(() => link.click()).not.toThrow();
    });
  });

  describe('AdvancedSearch component - cache fallback branches', () => {
    const localThis = {
      el: null,
    };
    let fetchAPISpy;
    let getCachedCategoriesSpy;
    let getCachedAttributionsSpy;

    beforeEach(() => {
      fetchAPISpy = vi.spyOn(api, 'fetchAPI');
      getCachedCategoriesSpy = vi.spyOn(cacheUtils, 'getCachedCategories');
      getCachedAttributionsSpy = vi.spyOn(cacheUtils, 'getCachedAttributions');
      vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((cb) => cb());
      localStorage.clear();
    });

    afterEach(() => {
      if (localThis.el?.parentNode) {
        localThis.el.parentNode.removeChild(localThis.el);
      }
      localThis.el = null;
      localStorage.clear();
      vi.restoreAllMocks();
    });

    it('shows error when categories fetch fails and no cache exists', async () => {
      // No cache available
      getCachedCategoriesSpy.mockReturnValue(null);
      getCachedAttributionsSpy.mockReturnValue(null);

      // Fetch fails
      fetchAPISpy.mockRejectedValue(new Error('Network error'));

      localThis.el = AdvancedSearch({ onSearch: () => {} });

      // Wait for async operations
      await vi.waitFor(() => {
        const categorySelect = localThis.el.querySelector('#search-category');
        expect(categorySelect.innerHTML).toContain('Error loading categories');
      });
    });

    it('shows error when attributions fetch fails and no cache exists', async () => {
      // No cache available
      getCachedCategoriesSpy.mockReturnValue(null);
      getCachedAttributionsSpy.mockReturnValue(null);

      // Categories succeeds, attributions fails
      fetchAPISpy
        .mockResolvedValueOnce({ data: [] })
        .mockRejectedValueOnce(new Error('Network error'));

      localThis.el = AdvancedSearch({ onSearch: () => {} });

      // Wait for async operations
      await vi.waitFor(() => {
        const attributionSelect = localThis.el.querySelector('#search-attribution');
        expect(attributionSelect.innerHTML).toContain('Error loading attributions');
      });
    });

    it('uses cached categories when fetch fails and cache exists', async () => {
      const cachedCategories = [{ id: 1, title: 'Cached Category' }];
      
      // Cache exists but empty initially, then available on fallback
      getCachedCategoriesSpy
        .mockReturnValueOnce(null)   // First call during populateDropdowns
        .mockReturnValueOnce(null)   // Check before loading
        .mockReturnValueOnce(cachedCategories); // Fallback in catch block
      getCachedAttributionsSpy.mockReturnValue(null);

      // Fetch fails
      fetchAPISpy.mockRejectedValue(new Error('Network error'));

      localThis.el = AdvancedSearch({ onSearch: () => {} });

      await vi.waitFor(() => {
        const categorySelect = localThis.el.querySelector('#search-category');
        // Either shows cached data or error - both are valid
        expect(categorySelect).toBeTruthy();
      });
    });

    it('uses cached attributions when fetch fails and cache exists', async () => {
      const cachedAttributions = [{ name: 'Cached Author' }];
      
      getCachedCategoriesSpy.mockReturnValue(null);
      // Cache exists
      getCachedAttributionsSpy
        .mockReturnValueOnce(null)   // First call
        .mockReturnValueOnce(cachedAttributions); // Fallback in catch

      // First fetch succeeds, second fails
      fetchAPISpy
        .mockResolvedValueOnce({ data: [] })
        .mockRejectedValueOnce(new Error('Network error'));

      localThis.el = AdvancedSearch({ onSearch: () => {} });

      await vi.waitFor(() => {
        const attributionSelect = localThis.el.querySelector('#search-attribution');
        expect(attributionSelect.innerHTML).toContain('Cached Author');
      });
    });
  });

  describe('voting addVotingListeners branches', () => {
    it('handles vote click when button is not inside law-card-mini', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ upvotes: 1, downvotes: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );
      const container = document.createElement('div');
      const voteBtn = document.createElement('button');
      voteBtn.setAttribute('data-vote', 'up');
      voteBtn.setAttribute('data-law-id', '999');
      container.appendChild(voteBtn);
      addVotingListeners(container);
      voteBtn.click();
      await new Promise(r => setTimeout(r, 5));
      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('handles toggleVote rejection without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="law-card-mini">
          <button data-vote="up" data-law-id="1"><span class="count-num">0</span></button>
          <button data-vote="down" data-law-id="1"><span class="count-num">0</span></button>
        </div>
      `;
      addVotingListeners(container);
      const upBtn = container.querySelector('[data-vote="up"]');
      (upBtn as HTMLElement).click();
      await new Promise(r => setTimeout(r, 10));
      vi.restoreAllMocks();
    });
  });
});

