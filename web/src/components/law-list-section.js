// Refactored to use shared law card renderer
import { createErrorState, createLoadingPlaceholder } from '../utils/dom.js';
import { addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { initSharePopovers } from './social-share.js';
import { LAW_CARD_MIN_HEIGHT } from '../utils/constants.js';

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
export function createLawListSection({ accentText, remainderText }) {
  const el = document.createElement('div');
  el.className = 'card';
  // Reserve space for law cards to prevent layout shift (using LAW_CARD_MIN_HEIGHT constant)
  el.style.minHeight = `${LAW_CARD_MIN_HEIGHT}px`;

  el.innerHTML = `
    <div class="card-content">
      <h3 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h3>
    </div>
  `;

  const contentDiv = el.querySelector('.card-content');
  let loadingEl = null;

  if (contentDiv) {
    loadingEl = createLoadingPlaceholder();
    contentDiv.appendChild(loadingEl);
  }

  function renderLaws(laws = [], { skip = 0, limit = Infinity, rankOffset = null } = {}) {
    const content = el.querySelector('.card-content');
    if (!content) return;

    // Ensure we have a valid array and apply skip/limit
    const validLaws = Array.isArray(laws) ? laws : [];
    const startIndex = Math.max(0, skip);
    const endIndex = startIndex + (Number.isFinite(limit) && limit > 0 ? limit : validLaws.length);
    const sliced = validLaws.slice(startIndex, endIndex);

    // Use shared law card renderer (eliminates duplicate HTML generation)
    content.innerHTML = `
      <h3 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h3>
      <div class="card-text">
        ${renderLawCards(sliced, { rankOffset })}
      </div>
    `;
    hydrateIcons(content);
    initSharePopovers(content);

    // Only add voting listeners if there are actually laws to vote on
    if (sliced.length > 0) {
      addVotingListeners(el);
    }
  }

  function renderError(message) {
    const content = el.querySelector('.card-content');
    if (!content) return;

    content.innerHTML = `
      <h3 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h3>
    `;
    content.appendChild(createErrorState(message));
  }

  return {
    el,
    renderLaws,
    renderError,
  };
}
