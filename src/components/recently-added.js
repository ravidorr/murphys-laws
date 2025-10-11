// Recently Added component - fetches 3 most recently added laws

import { fetchRecentlyAdded } from '../utils/api.js';
import { createLawListSection } from './law-list-section.js';

export function RecentlyAdded() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Recently',
    remainderText: ' Added',
  });

  fetchRecentlyAdded()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      renderLaws(laws, { limit: 3 });
    })
    .catch(() => {
      renderError('Failed to load recently added laws.');
    });

  return el;
}
