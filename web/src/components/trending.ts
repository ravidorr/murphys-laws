// Trending component - fetches 3 most recently voted laws
// Refactored to use shared law card renderer

import { fetchTrending } from '../utils/api.ts';
import { createErrorState } from '../utils/dom.ts';
import { createLoading } from './loading.ts';
import { addVotingListeners } from '../utils/voting.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { renderLawCards } from '../utils/law-card-renderer.ts';
import { initSharePopovers } from './social-share.ts';
import { LAW_CARD_MIN_HEIGHT, WIDGET_CARD_COUNT } from '../utils/constants.ts';

/**
 * Creates a Trending component that displays the 3 most recently voted laws
 * @returns {HTMLDivElement} Component element with trending laws
 */
export function Trending() {
  const el = document.createElement('div');
  el.className = 'card';
  // Reserve space for law cards to prevent layout shift (using LAW_CARD_MIN_HEIGHT constant)
  el.style.minHeight = `${LAW_CARD_MIN_HEIGHT}px`;

  el.innerHTML = `
    <header class="card-header">
      <h3 class="card-title"><span class="accent-text">Trending</span> Now</h3>
    </header>
    <div class="card-body"></div>
  `;

  const bodyDiv = el.querySelector('.card-body');
  if (bodyDiv) {
    const loading = createLoading();
    bodyDiv.appendChild(loading);
  }

  fetchTrending(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly the configured number of laws
      const trending = laws.slice(0, WIDGET_CARD_COUNT);

      const bodyDiv = el.querySelector('.card-body');
      if (bodyDiv) {
        // Use shared law card renderer (eliminates ~30 lines of duplicate HTML generation)
        bodyDiv.innerHTML = `
          <div class="card-text">
            ${renderLawCards(trending)}
          </div>
        `;
        hydrateIcons(bodyDiv);
        initSharePopovers(bodyDiv as HTMLElement);

        // Add voting event listeners only if there are laws
        if (trending.length > 0) {
          addVotingListeners(el);
        }
      }
    })
    .catch(() => {
      const bodyDiv = el.querySelector('.card-body');
      if (bodyDiv) {
        bodyDiv.innerHTML = '';
        const errorEl = createErrorState('Failed to load trending laws.');
        bodyDiv.appendChild(errorEl);
        hydrateIcons(bodyDiv);
      }
    });

  return el;
}
