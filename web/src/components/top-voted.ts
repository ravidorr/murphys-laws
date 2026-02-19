// Top Voted component - fetches and displays top 3 laws by upvotes

import { fetchTopVoted } from '../utils/api.ts';
import { createLawListSection } from './law-list-section.ts';
import { WIDGET_CARD_COUNT } from '../utils/constants.ts';

/**
 * Creates a Top Voted component that displays the 3 highest voted laws
 * @returns {HTMLDivElement} Component element with top voted laws
 */
export function TopVoted() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Top',
    remainderText: ' Voted',
  });

  // Fetch only the configured number of laws from API
  fetchTopVoted(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Double-check: ensure we only show exactly the configured number of laws
      const topLaws = laws.slice(0, WIDGET_CARD_COUNT);
      // Render with explicit limit
      renderLaws(topLaws, { skip: 0, limit: WIDGET_CARD_COUNT, rankOffset: 1 });
    })
    .catch(() => {
      renderError('Failed to load top voted laws.');
    });

  return el;
}
