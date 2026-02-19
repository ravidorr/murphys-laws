import { TopVoted } from '../src/components/top-voted.js';
import { Trending } from '../src/components/trending.js';
import { RecentlyAdded } from '../src/components/recently-added.js';
import * as api from '../src/utils/api.js';
import type { Law, PaginatedResponse } from '../src/types/app.d.ts';

function paginatedResponse(data: Law[]): PaginatedResponse<Law> {
  return { data, total: data.length, limit: data.length, offset: 0 };
}

describe('Law components', () => {
  const mockLaws = [
    {
      id: 1,
      title: 'First Law',
      text: 'First law text',
      upvotes: 100,
      downvotes: 10,
      attributions: []
    },
    {
      id: 2,
      title: 'Second Law',
      text: 'Second law text',
      upvotes: 90,
      downvotes: 5,
      attributions: [{ name: 'Test Author', contact_type: null }]
    },
    {
      id: 3,
      title: null,
      text: 'Third law without title',
      upvotes: 80,
      downvotes: 8,
      attributions: []
    },
    {
      id: 4,
      title: 'Fourth Law',
      text: 'Fourth law text',
      upvotes: 70,
      downvotes: 12,
      attributions: []
    }
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  describe('TopVoted component', () => {
    it('renders loading state initially', () => {
      vi.spyOn(api, 'fetchTopVoted').mockImplementation(() => new Promise(() => {}));

      const el = TopVoted();

      // Check for loading placeholder (uses random messages, not "Loading")
      expect(el.querySelector('.loading-placeholder')).toBeTruthy();
      expect(el.textContent).toContain('Top Voted');
    });

    it('renders top voted laws after fetch', async () => {
      vi.spyOn(api, 'fetchTopVoted').mockResolvedValue(paginatedResponse(mockLaws));

      const el = TopVoted();
      document.body.appendChild(el);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Top');
      expect(el.textContent).toContain('Voted');
      // Should skip first law and show #2, #3, #4
      expect(el.textContent).toContain('Second Law');
      expect(el.textContent).toContain('Third law without title');

      document.body.removeChild(el);
      vi.restoreAllMocks();
    });

    it('handles empty law list', async () => {
      vi.spyOn(api, 'fetchTopVoted').mockResolvedValue(paginatedResponse([]));

      const el = TopVoted();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.querySelector('.card-body')).toBeTruthy();
      vi.restoreAllMocks();
    });

    it('handles API error', async () => {
      vi.spyOn(api, 'fetchTopVoted').mockRejectedValue(new Error('API failed'));

      const el = TopVoted();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Failed to load');
      vi.restoreAllMocks();
    });
  });

  describe('Trending component', () => {
    it('renders loading state initially', () => {
      vi.spyOn(api, 'fetchTrending').mockImplementation(() => new Promise(() => {}));

      const el = Trending();

      // Check for any of the possible loading messages (they're random)
      expect(el.textContent).toMatch(/Loading|Fetching|Almost there/);
      vi.restoreAllMocks();
    });

    it('renders trending laws after fetch', async () => {
      vi.spyOn(api, 'fetchTrending').mockResolvedValue(paginatedResponse(mockLaws.slice(0, 3)));

      const el = Trending();
      document.body.appendChild(el);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Trending');
      expect(el.textContent).toContain('First Law');

      document.body.removeChild(el);
      vi.restoreAllMocks();
    });

    it('handles empty law list', async () => {
      vi.spyOn(api, 'fetchTrending').mockResolvedValue(paginatedResponse([]));

      const el = Trending();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.querySelector('.card-body')).toBeTruthy();
      vi.restoreAllMocks();
    });

    it('handles API error', async () => {
      vi.spyOn(api, 'fetchTrending').mockRejectedValue(new Error('API failed'));

      const el = Trending();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Failed to load');
      vi.restoreAllMocks();
    });
  });

  describe('RecentlyAdded component', () => {
    it('renders loading state initially', () => {
      vi.spyOn(api, 'fetchRecentlyAdded').mockImplementation(() => new Promise(() => {}));

      const el = RecentlyAdded();

      // Check for loading placeholder instead of specific text (now shows random messages)
      expect(el.querySelector('.loading-placeholder')).toBeTruthy();
      vi.restoreAllMocks();
    });

    it('renders recently added laws after fetch', async () => {
      vi.spyOn(api, 'fetchRecentlyAdded').mockResolvedValue(paginatedResponse(mockLaws.slice(0, 3)));

      const el = RecentlyAdded();
      document.body.appendChild(el);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Recently');
      expect(el.textContent).toContain('Added');
      expect(el.textContent).toContain('First Law');

      document.body.removeChild(el);
      vi.restoreAllMocks();
    });

    it('handles empty law list', async () => {
      vi.spyOn(api, 'fetchRecentlyAdded').mockResolvedValue(paginatedResponse([]));

      const el = RecentlyAdded();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.querySelector('.card-body')).toBeTruthy();
      vi.restoreAllMocks();
    });

    it('handles API error', async () => {
      vi.spyOn(api, 'fetchRecentlyAdded').mockRejectedValue(new Error('API failed'));

      const el = RecentlyAdded();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(el.textContent).toContain('Failed to load');
      vi.restoreAllMocks();
    });

    it('handles vote button clicks', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      vi.spyOn(api, 'fetchRecentlyAdded').mockResolvedValue(paginatedResponse([mockLaws[0]]));

      const el = RecentlyAdded();
      document.body.appendChild(el);

      await new Promise(resolve => setTimeout(resolve, 10));

      const upvoteBtn = el.querySelector('[data-vote="up"]');
      if (upvoteBtn instanceof HTMLElement) {
        upvoteBtn.click();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      document.body.removeChild(el);
      vi.restoreAllMocks();
    });
  });
});
