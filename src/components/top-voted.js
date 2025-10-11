// Top Voted component - fetches top 4 laws by score and displays #2, #3, #4

import { fetchTopVoted } from '../utils/api.js';
import { createLawListSection } from './law-list-section.js';

export function TopVoted() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Top',
    remainderText: ' Voted',
  });

  fetchTopVoted()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      renderLaws(laws, { skip: 1, limit: 3, rankOffset: 2 });
    })
    .catch(() => {
      renderError('Failed to load top voted laws.');
    });

  return el;
}
