// Recently Added component - fetches 3 most recently added laws

import { fetchRecentlyAdded } from '../utils/api.js';
import { createLawListSection } from './law-list-section.js';
import { WIDGET_CARD_COUNT } from '../utils/constants.js';

/**
 * Creates a Recently Added component that displays the 3 most recently added laws
 * @returns {HTMLDivElement} Component element with recently added laws
 */
export function RecentlyAdded() {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Recently',
    remainderText: ' Added',
  });

  fetchRecentlyAdded(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly the configured number of laws
      renderLaws(laws.slice(0, WIDGET_CARD_COUNT), { limit: WIDGET_CARD_COUNT });
    })
    .catch(() => {
      renderError('Failed to load recently added laws.');
    });

  return el;
}
