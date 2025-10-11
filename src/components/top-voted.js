// Top Voted component - fetches top 4 laws by score and displays #2, #3, #4

import { fetchTopVoted } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState } from '../utils/dom.js';
import { getUserVote, addVotingListeners } from '../utils/voting.js';

export function TopVoted() {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">Top</span> Voted</h4>
      <div class="loading-placeholder" role="status" aria-live="polite">
        <p class="small">Loading...</p>
      </div>
    </div>
  `;

  fetchTopVoted()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      // Skip first one (Law of the Day) and show #2, #3, #4
      const topVoted = laws.slice(1);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Top</span> Voted</h4>
          <div class="card-text">
            ${topVoted.map((law, i) => {
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
                  <span class="rank">#${i + 2}</span>
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
      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Top</span> Voted</h4>
        `;
        const errorEl = createErrorState('Failed to load top voted laws.');
        contentDiv.appendChild(errorEl);
      }
    });

  return el;
}
