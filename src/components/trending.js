// Trending component - fetches 3 most recently voted laws

import { fetchTrending } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState, createLoadingPlaceholder } from '../utils/dom.js';
import { getUserVote, addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';

export function Trending() {
  const el = document.createElement('div');
  el.className = 'card';
  // Reserve space for 3 law cards to prevent layout shift (0.253 CLS)
  // Each mini card is ~120px, plus title (~40px) = ~400px total
  el.style.minHeight = '400px';

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

  fetchTrending(3)
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Ensure we only show exactly 3 laws
      const trending = laws.slice(0, 3);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
          <div class="card-text">
            ${trending.map((law) => {
    const up = Number.isFinite(law.upvotes) ? law.upvotes : 0;
    const down = Number.isFinite(law.downvotes) ? law.downvotes : 0;
    const attribution = firstAttributionLine(law);
    const userVote = getUserVote(law.id);

    // Safely escape title and text
    const safeTitle = law.title ? escapeHtml(law.title) : '';
    const safeText = escapeHtml(law.text);
    const titleText = safeTitle ? `<strong>${safeTitle}:</strong> ${safeText}` : safeText;

    return `
              <div class="law-card-mini" data-law-id="${escapeHtml(String(law.id))}">
                <p class="law-card-text">
                  ${titleText}
                </p>
                ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
                <div class="law-card-footer">
                  <button class="vote-btn count-up ${userVote === 'up' ? 'voted' : ''}" data-vote="up" data-law-id="${escapeHtml(String(law.id))}" aria-label="Upvote this law">
                    <span class="icon" data-icon="thumbUp" aria-hidden="true"></span>
                    <span class="count-num">${up}</span>
                  </button>
                  <button class="vote-btn count-down ${userVote === 'down' ? 'voted' : ''}" data-vote="down" data-law-id="${escapeHtml(String(law.id))}" aria-label="Downvote this law">
                    <span class="icon" data-icon="thumbDown" aria-hidden="true"></span>
                    <span class="count-num">${down}</span>
                  </button>
                </div>
              </div>
            `;
  }).join('')}
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
