import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderLawCards, renderLawCard } from '../src/utils/law-card-renderer.js';
import type { Law } from '../src/types/app.d.ts';

// Mock voting utility
vi.mock('../src/utils/voting.js', () => ({
  getUserVote: vi.fn(() => null)
}));

// Mock feature flags
vi.mock('../src/utils/feature-flags.js', () => ({
  isFavoritesEnabled: vi.fn(() => true)
}));

// Mock favorites utility
vi.mock('../src/utils/favorites.js', () => ({
  isFavorite: vi.fn(() => false)
}));

import { isFavoritesEnabled } from '../src/utils/feature-flags.js';
import { isFavorite } from '../src/utils/favorites.js';

describe('law-card-renderer', () => {
  describe('renderLawCard', () => {
    it('renders a basic law card', () => {
      const law = { id: 1, title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };
      const html = renderLawCard(law);
      
      expect(html).toContain('Test Law');
      expect(html).toContain('Test text');
      expect(html).toContain('data-law-id="1"');
    });

    it('renders with keyboard accessibility attributes (WCAG 2.1.1)', () => {
      const law = { id: 1, title: 'Test Law', text: 'Test text', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('role="article"');
      expect(html).toContain('aria-label="Test Law: Test text"');
    });

    it('renders accessible label without title when none provided', () => {
      const law = { id: 1, text: 'Just text content', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('aria-label="Just text content"');
    });

    it('uses article element for semantic structure', () => {
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('<article class="law-card-mini"');
      expect(html).toContain('</article>');
    });

    it('renders law without title', () => {
      const law = { id: 1, text: 'Just text', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('Just text');
      expect(html).not.toContain('<strong>');
    });

    it('handles law with null text', () => {
      const law = { id: 1, title: 'Title Only', text: null, upvotes: 0, downvotes: 0 } as unknown as Law;
      const html = renderLawCard(law);
      
      expect(html).toContain('Title Only');
      expect(html).toContain('data-law-id="1"');
    });

    it('handles law with undefined text', () => {
      const law = { id: 1, title: 'Title', upvotes: 0, downvotes: 0 } as Law;
      const html = renderLawCard(law);
      
      expect(html).toContain('Title');
    });

    it('highlights search term in text', () => {
      const law = { id: 1, title: 'Murphy Law', text: 'Things will go wrong', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law, { searchQuery: 'wrong' });
      
      expect(html).toContain('mark');
    });

    it('highlights search term in title when title exists', () => {
      const law = { id: 1, title: 'Murphy Law', text: 'Text here', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law, { searchQuery: 'Murphy' });
      
      expect(html).toContain('mark');
    });

    it('handles search query with no title', () => {
      const law = { id: 1, title: undefined, text: 'Something wrong here', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law, { searchQuery: 'wrong' });
      
      expect(html).toContain('mark');
    });

    it('renders rank when rankOffset is provided', () => {
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law, { rankOffset: 1, index: 0 });
      
      expect(html).toContain('#1');
    });

    it('renders correct rank based on offset and index', () => {
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law, { rankOffset: 1, index: 10 });
      
      expect(html).toContain('#11');
    });

    it('renders vote buttons with counts', () => {
      const law = { id: 1, text: 'Test', upvotes: 10, downvotes: 3 };
      const html = renderLawCard(law);
      
      expect(html).toContain('10');
      expect(html).toContain('3');
      expect(html).toContain('data-vote="up"');
      expect(html).toContain('data-vote="down"');
    });

    it('renders favorite button with tooltip when feature enabled', () => {
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('data-action="favorite"');
      expect(html).toContain('data-tooltip="Add to favorites"');
    });

    it('renders favorite button with correct aria-label', () => {
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('aria-label="Add to favorites"');
    });

    it('does not render favorite button when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);
      
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).not.toContain('data-action="favorite"');
      
      // Reset mock
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
    });

    it('renders favorited state with filled heart icon when law is favorited', () => {
      vi.mocked(isFavorite).mockReturnValue(true);
      
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).toContain('favorited');
      expect(html).toContain('heartFilled');
      expect(html).toContain('Remove from favorites');
      
      // Reset mock
      vi.mocked(isFavorite).mockReturnValue(false);
    });

    it('renders non-favorited state with outline heart icon', () => {
      vi.mocked(isFavorite).mockReturnValue(false);
      
      const law = { id: 1, text: 'Test', upvotes: 0, downvotes: 0 };
      const html = renderLawCard(law);
      
      expect(html).not.toContain('favorited');
      expect(html).toContain('Add to favorites');
    });
  });

  describe('renderLawCards', () => {
    it('renders multiple cards', () => {
      const laws = [
        { id: 1, text: 'Law 1', upvotes: 0, downvotes: 0 },
        { id: 2, text: 'Law 2', upvotes: 0, downvotes: 0 }
      ];
      const html = renderLawCards(laws);
      
      expect(html).toContain('Law 1');
      expect(html).toContain('Law 2');
    });

    it('passes options to each card', () => {
      const laws = [
        { id: 1, text: 'Search term here', upvotes: 0, downvotes: 0 }
      ];
      const html = renderLawCards(laws, { searchQuery: 'term' });
      
      expect(html).toContain('mark');
    });

    it('returns empty string for empty array', () => {
      const html = renderLawCards([]);
      expect(html).toBe('');
    });

    it('returns empty string for null input', () => {
      const html = renderLawCards(null as unknown as Law[]);
      expect(html).toBe('');
    });

    it('returns empty string for undefined input', () => {
      const html = renderLawCards(undefined as unknown as Law[]);
      expect(html).toBe('');
    });

    it('returns empty string for non-array input', () => {
      const html = renderLawCards('not an array' as unknown as Law[]);
      expect(html).toBe('');
    });
  });
});
