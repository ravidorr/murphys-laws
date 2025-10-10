// Recently Added component - fetches 3 most recently added laws

import { fetchRecentlyAdded } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState } from '../utils/dom.js';
import { getUserVote } from '../utils/voting.js';
import { addVotingListeners } from '../utils/voting-ui.js';

export function RecentlyAdded() {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">Recently</span> Added</h4>
      <div class="loading-placeholder" role="status" aria-live="polite">
        <p class="small">Loading...</p>
      </div>
    </div>
  `;

  fetchRecentlyAdded()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      const recent = laws.slice(0, 3);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Recently</span> Added</h4>
          <div class="card-text">
            ${recent.map((law) => {
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
                    <span class="material-symbols-outlined icon">thumb_up</span>
                    <span class="count-num">${up}</span>
                  </button>
                  <button class="vote-btn count-down ${userVote === 'down' ? 'voted' : ''}" data-vote="down" data-law-id="${escapeHtml(String(law.id))}" aria-label="Downvote this law">
                    <span class="material-symbols-outlined icon">thumb_down</span>
                    <span class="count-num">${down}</span>
                  </button>
                </div>
              </div>
            `;
  }).join('')}
          </div>
        `;
        
        // Add voting event listeners
        addVotingListeners(el);
      }
    })
    .catch(err => {
      console.error('Failed to fetch recently added laws:', err);
      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Recently</span> Added</h4>
        `;
        const errorEl = createErrorState('Failed to load recently added laws.');
        contentDiv.appendChild(errorEl);
      }
    });

  return el;
}
