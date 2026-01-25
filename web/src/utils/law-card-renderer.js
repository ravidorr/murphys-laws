// Shared law card rendering utility
// Eliminates ~90 lines of duplicate HTML generation across multiple files

import { firstAttributionLine } from './attribution.js';
import { escapeHtml, highlightSearchTerm } from './sanitize.js';
import { getUserVote } from './voting.js';
import { isFavorite } from './favorites.js';
import { isFavoritesEnabled } from './feature-flags.js';
import { renderShareButtonsHTML } from '../components/social-share.js';
import { renderButtonHTML } from './button.js';

/**
 * Renders a law card with consistent HTML structure
 * @param {Object} law - Law object
 * @param {number} law.id - Law ID
 * @param {string} law.text - Law text
 * @param {string} law.title - Law title (optional)
 * @param {number} law.upvotes - Number of upvotes
 * @param {number} law.downvotes - Number of downvotes
 * @param {Object} options - Rendering options
 * @param {number} options.index - Index in list (for ranking)
 * @param {number} options.rankOffset - Offset for rank number (e.g., 1 for #1, #2, #3)
 * @param {string} options.searchQuery - Search query to highlight
 * @returns {string} HTML string for law card
 */
export function renderLawCard(law, options = {}) {
  const {
    index = 0,
    rankOffset = null,
    searchQuery = ''
  } = options;

  // Safely get vote counts
  const up = Number.isFinite(law.upvotes) ? law.upvotes : 0;
  const down = Number.isFinite(law.downvotes) ? law.downvotes : 0;

  // Get attribution
  const attribution = firstAttributionLine(law);

  // Get user's current vote
  const userVote = getUserVote(law.id);

  // Escape and optionally highlight text
  const safeId = escapeHtml(String(law.id));
  let safeTitle = law.title ? escapeHtml(law.title) : '';
  let safeText = escapeHtml(law.text || '');

  // Apply search highlighting if query provided
  if (searchQuery && searchQuery.trim()) {
    safeTitle = law.title ? highlightSearchTerm(law.title, searchQuery) : '';
    safeText = highlightSearchTerm(law.text, searchQuery);
  }

  // Build title text with optional title prefix
  const titleText = safeTitle ? `<strong>${safeTitle}:</strong> ${safeText}` : safeText;

  // Build rank markup if rankOffset is provided
  const rankMarkup = typeof rankOffset === 'number'
    ? `<span class="rank">#${index + rankOffset}</span>`
    : '';

  // Build accessible label (plain text without HTML)
  const plainTitle = law.title ? escapeHtml(law.title) : '';
  const plainText = escapeHtml(law.text || '');
  const ariaLabel = plainTitle ? `${plainTitle}: ${plainText}` : plainText;

  // Generate share buttons HTML
  const shareButtonsHtml = renderShareButtonsHTML({
    lawId: safeId,
    lawText: law.text || ''
  });

  // Generate favorite button HTML (only if feature enabled)
  const isFav = isFavoritesEnabled() && isFavorite(law.id);
  const favoriteTooltip = isFav ? 'Remove from favorites' : 'Add to favorites';
  const favoriteButtonHtml = isFavoritesEnabled()
    ? renderButtonHTML({
      variant: 'vote',
      direction: 'up', // Required for vote variant
      icon: isFav ? 'heartFilled' : 'heart',
      count: '', // No count for favorites
      lawId: safeId,
      action: 'favorite',
      className: isFav ? 'favorited' : null,
      ariaLabel: favoriteTooltip,
      tooltip: favoriteTooltip,
    })
    : '';

  // Return HTML string with keyboard accessibility (WCAG 2.1.1)
  return `
    <article class="law-card-mini" data-law-id="${safeId}" tabindex="0" role="article" aria-label="${ariaLabel}">
      <p class="law-card-text">
        ${rankMarkup}
        ${titleText}
      </p>
      ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
      <div class="law-card-footer">
        <div class="law-card-footer-left">
          ${renderButtonHTML({
    variant: 'vote',
    direction: 'up',
    icon: 'thumbUp',
    count: up,
    vote: 'up',
    lawId: safeId,
    className: userVote === 'up' ? 'voted' : null,
    ariaLabel: 'Upvote this law',
  })}
          ${renderButtonHTML({
    variant: 'vote',
    direction: 'down',
    icon: 'thumbDown',
    count: down,
    vote: 'down',
    lawId: safeId,
    className: userVote === 'down' ? 'voted' : null,
    ariaLabel: 'Downvote this law',
  })}
          ${favoriteButtonHtml}
        </div>
        ${shareButtonsHtml}
      </div>
    </article>
  `;
}

/**
 * Renders multiple law cards
 * @param {Array} laws - Array of law objects
 * @param {Object} options - Rendering options (same as renderLawCard)
 * @returns {string} HTML string for all law cards concatenated
 */
export function renderLawCards(laws, options = {}) {
  if (!Array.isArray(laws) || laws.length === 0) {
    return '';
  }

  return laws.map((law, index) => renderLawCard(law, { ...options, index })).join('');
}
