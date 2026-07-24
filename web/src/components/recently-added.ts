// Recently Added component - fetches 3 most recently added laws

import { fetchRecentlyAdded } from '../utils/api.ts';
import { createLawListSection } from './law-list-section.ts';
import { WIDGET_CARD_COUNT } from '../utils/constants.ts';
import type { Law } from '../types/app.d.ts';

interface DiscoveryWidgetOptions {
  seenIds?: Set<number>;
}

/**
 * Creates a Recently Added component that displays the 3 most recently added laws
 * @returns {HTMLDivElement} Component element with recently added laws
 */
export function RecentlyAdded({ seenIds }: DiscoveryWidgetOptions = {}): HTMLDivElement {
  const { el, renderLaws, renderError } = createLawListSection({
    accentText: 'Recently',
    remainderText: ' Added',
  });

  fetchRecentlyAdded(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      const recentLaws = laws.filter((law: Law) => !seenIds?.has(law.id)).slice(0, WIDGET_CARD_COUNT);
      recentLaws.forEach((law: Law) => seenIds?.add(law.id));
      el.toggleAttribute('hidden', recentLaws.length === 0);
      renderLaws(recentLaws, { limit: WIDGET_CARD_COUNT });
    })
    .catch(() => {
      renderError('Failed to load recently added laws.');
    });

  return el;
}
