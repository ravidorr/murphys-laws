// Refactored to use shared law card renderer
import { createErrorState } from '../utils/dom.ts';
import { createLoading } from './loading.ts';
import { addVotingListeners } from '../utils/voting.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { renderLawCards } from '../utils/law-card-renderer.ts';
import { initSharePopovers } from './social-share.ts';
import { LAW_CARD_MIN_HEIGHT } from '../utils/constants.ts';
import type { Law } from '../types/app.d.ts';

/**
 * Creates a reusable law list section component with loading states and error handling
 * @param {Object} options - Component configuration
 * @param {string} options.accentText - Accent text for title (e.g., "Top")
 * @param {string} options.remainderText - Remainder text for title (e.g., " Voted")
 * @returns {Object} Component interface with element and render methods
 * @returns {HTMLDivElement} returns.el - The component container element
 * @returns {Function} returns.renderLaws - Function to render laws
 * @returns {Function} returns.renderError - Function to render error state
 */
export function createLawListSection({ accentText, remainderText }: { accentText: string; remainderText: string }) {
  const el = document.createElement('div');
  el.className = 'card';
  // Reserve space for law cards to prevent layout shift (using LAW_CARD_MIN_HEIGHT constant)
  el.style.minHeight = `${LAW_CARD_MIN_HEIGHT}px`;

  el.innerHTML = `
    <header class="card-header">
      <h3 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h3>
    </header>
    <div class="card-body"></div>
  `;

  const bodyDiv = el.querySelector('.card-body');
  let loadingEl: HTMLElement | null = null;

  if (bodyDiv) {
    loadingEl = createLoading();
    bodyDiv.appendChild(loadingEl);
  }

  function renderLaws(laws: Law[] = [], { skip = 0, limit = Infinity, rankOffset = null as number | null } = {}) {
    const body = el.querySelector('.card-body');
    if (!body) return;

    // Ensure we have a valid array and apply skip/limit
    const validLaws = Array.isArray(laws) ? laws : [];
    const startIndex = Math.max(0, skip);
    const endIndex = startIndex + (Number.isFinite(limit) && limit > 0 ? limit : validLaws.length);
    const sliced = validLaws.slice(startIndex, endIndex);

    // Use shared law card renderer (eliminates duplicate HTML generation)
    body.innerHTML = `
      <div class="card-text">
        ${renderLawCards(sliced, { rankOffset })}
      </div>
    `;
    hydrateIcons(body);
    initSharePopovers(body as HTMLElement);

    // Only add voting listeners if there are actually laws to vote on
    if (sliced.length > 0) {
      addVotingListeners(el);
    }
  }

  function renderError(message: string) {
    const body = el.querySelector('.card-body');
    if (!body) return;

    body.innerHTML = '';
    body.appendChild(createErrorState(message));
  }

  return {
    el,
    renderLaws,
    renderError,
  };
}
