// Trending component - fetches 3 most recently voted laws
// Refactored to use shared law card renderer

import { fetchTrending } from '../utils/api.js';
import { createErrorState, createLoadingPlaceholder } from '../utils/dom.js';
import { addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { LAW_CARD_MIN_HEIGHT, WIDGET_CARD_COUNT } from '../utils/constants.js';

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
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
    </div>
  `;

  const contentDiv = el.querySelector('.card-content');
  if (contentDiv) {
    const loading = createLoadingPlaceholder();
    contentDiv.appendChild(loading);
  }

  fetchTrending(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly the configured number of laws
      const trending = laws.slice(0, WIDGET_CARD_COUNT);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        // Use shared law card renderer (eliminates ~30 lines of duplicate HTML generation)
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
          <div class="card-text">
            ${renderLawCards(trending)}
          </div>
        `;
        hydrateIcons(contentDiv);

        // Add voting event listeners only if there are laws
        if (trending.length > 0) {
          addVotingListeners(el);
        }
      }
    })
    .catch(() => {
      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
        `;
        const errorEl = createErrorState('Failed to load trending laws.');
        contentDiv.appendChild(errorEl);
        hydrateIcons(contentDiv);
      }
    });

  return el;
}
