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

  // Template always provides .card-body
  const bodyDiv = el.querySelector('.card-body')!;
  const loading = createLoading();
  bodyDiv.appendChild(loading);

  fetchTrending(WIDGET_CARD_COUNT)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly the configured number of laws
      const trending = laws.slice(0, WIDGET_CARD_COUNT);

      const body = el.querySelector('.card-body')!; // same element, always present
      body.innerHTML = `
          <div class="card-text">
            ${renderLawCards(trending)}
          </div>
        `;
      hydrateIcons(body);
      initSharePopovers(body as HTMLElement);

      // Add voting event listeners only if there are laws
      if (trending.length > 0) {
        addVotingListeners(el);
      }
    })
    .catch(() => {
      const body = el.querySelector('.card-body')!; // template always has .card-body
      body.innerHTML = '';
      const errorEl = createErrorState('Failed to load trending laws.');
      body.appendChild(errorEl);
      hydrateIcons(body);
    });

  return el;
}
