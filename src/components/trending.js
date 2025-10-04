// Trending component - fetches 3 most recently voted laws

import { fetchTrending } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState } from '../utils/dom.js';
import { getUserVote, toggleVote } from '../utils/voting.js';

export function Trending() {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
      <div class="loading-placeholder" role="status" aria-live="polite">
        <p class="small">Loading...</p>
      </div>
    </div>
  `;

  fetchTrending()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
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
      console.error('Failed to fetch trending laws:', err);
      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
        `;
        const errorEl = createErrorState('Failed to load trending laws.');
        contentDiv.appendChild(errorEl);
      }
    });

  return el;
}

// Add voting functionality to the component
function addVotingListeners(el) {
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle vote buttons
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      const voteType = voteBtn.getAttribute('data-vote');
      const lawId = voteBtn.getAttribute('data-law-id');

      if (!lawId) return;

      try {
        const result = await toggleVote(lawId, voteType);

        // Update vote counts in UI
        const lawCard = voteBtn.closest('.law-card-mini');
        if (lawCard) {
          const upBtn = lawCard.querySelector('[data-vote="up"]');
          const downBtn = lawCard.querySelector('[data-vote="down"]');
          const upCount = upBtn?.querySelector('.count-num');
          const downCount = downBtn?.querySelector('.count-num');

          if (upCount) upCount.textContent = result.upvotes;
          if (downCount) downCount.textContent = result.downvotes;

          // Update active state
          const newUserVote = getUserVote(lawId);
          upBtn?.classList.toggle('voted', newUserVote === 'up');
          downBtn?.classList.toggle('voted', newUserVote === 'down');
        }
      } catch (error) {
        console.error('Failed to vote:', error);
        // Could add a notification here if needed
      }
      return;
    }
  });
}
