// Recently Added component - fetches 3 most recently added laws

import { fetchRecentlyAdded } from '../utils/api.js';
import { createLawListSection } from './law-list-section.js';

export function RecentlyAdded() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Recently',
    remainderText: ' Added',
  });

  fetchRecentlyAdded(3)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly 3 laws
      renderLaws(laws.slice(0, 3), { limit: 3 });
    })
    .catch(() => {
      renderError('Failed to load recently added laws.');
    });

  return el;
}
