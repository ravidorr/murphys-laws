// Shared law card rendering utility
// Eliminates ~90 lines of duplicate HTML generation across multiple files

import { firstAttributionLine } from './attribution.js';
import { escapeHtml, highlightSearchTerm } from './sanitize.js';
import { getUserVote } from './voting.js';

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

  // Return HTML string
  return `
    <div class="law-card-mini" data-law-id="${safeId}">
      <p class="law-card-text">
        ${rankMarkup}
        ${titleText}
      </p>
      ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
      <div class="law-card-footer">
        <button class="vote-btn count-up ${userVote === 'up' ? 'voted' : ''}" data-vote="up" data-law-id="${safeId}" aria-label="Upvote this law">
          <span class="icon" data-icon="thumbUp" aria-hidden="true"></span>
          <span class="count-num">${up}</span>
        </button>
        <button class="vote-btn count-down ${userVote === 'down' ? 'voted' : ''}" data-vote="down" data-law-id="${safeId}" aria-label="Downvote this law">
          <span class="icon" data-icon="thumbDown" aria-hidden="true"></span>
          <span class="count-num">${down}</span>
        </button>
      </div>
    </div>
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
