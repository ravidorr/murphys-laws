// Top Voted component - fetches and displays top 3 laws by upvotes

import { fetchTopVoted } from '../utils/api.js';
import { createLawListSection } from './law-list-section.js';

export function TopVoted() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Top',
    remainderText: ' Voted',
  });

  // Fetch only 3 laws from API
  fetchTopVoted(3)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Double-check: ensure we only show exactly 3 laws maximum
      const top3Laws = laws.slice(0, 3);
      // Render with explicit limit of 3
      renderLaws(top3Laws, { skip: 0, limit: 3, rankOffset: 1 });
    })
    .catch(() => {
      renderError('Failed to load top voted laws.');
    });

  return el;
}
