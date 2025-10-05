// Law of the Day widget component

import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getUserVote, toggleVote } from '../utils/voting.js';
import { showError } from './notification.js';

export function LawOfTheDay({ law, onNavigate, showButton = true }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';
  el.setAttribute('data-law-id', law?.id || '');

  if (!law) {
    el.innerHTML = `
      <div class="skeleton" role="status" aria-label="Loading Law of the Day"></div>
    `;
    return el;
  }

  const iso = new Date().toISOString();
  const dateText = new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const upvotes = Number.isFinite(law.upvotes) ? law.upvotes : 0;
  const downvotes = Number.isFinite(law.downvotes) ? law.downvotes : 0;
  const attribution = firstAttributionLine(law);
  const userVote = getUserVote(law.id);

  // Safely escape the law text
  const safeText = escapeHtml(law.text);

  el.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="accent-text">Murphy's</span> Law of the Day</h3>
      <time class="section-date" datetime="${iso}">${dateText}</time>
      </div>
    <div class="section-body" data-law-id="${escapeHtml(String(law.id))}">
      <blockquote class="lod-quote-large">"${safeText}"</blockquote>
      <p class="lod-attrib">${attribution}</p>
    </div>
    <div class="section-footer">
      <div class="left">
        <button class="vote-btn count-up ${userVote === 'up' ? 'voted' : ''}" data-vote="up" aria-label="Upvote this law">
          <span class="material-symbols-outlined icon">thumb_up</span>
          <span class="count-num">${upvotes}</span>
        </button>
        <button class="vote-btn count-down ${userVote === 'down' ? 'voted' : ''}" data-vote="down" aria-label="Downvote this law">
          <span class="material-symbols-outlined icon">thumb_down</span>
          <span class="count-num">${downvotes}</span>
        </button>
      </div>
      ${showButton ? `
      <button class="btn" type="button" data-nav="browse" aria-label="View more laws">
        <span class="btn-text">View More Laws</span>
        <span class="material-symbols-outlined icon ml">arrow_forward</span>
      </button>
      ` : ''}
    </div>
  `;

  // Handle voting and navigation
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle vote buttons
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      const voteType = voteBtn.getAttribute('data-vote');

      try {
        const result = await toggleVote(law.id, voteType);

        // Update vote counts in UI
        const upBtn = el.querySelector('[data-vote="up"]');
        const downBtn = el.querySelector('[data-vote="down"]');
        const upCount = upBtn?.querySelector('.count-num');
        const downCount = downBtn?.querySelector('.count-num');

        if (upCount) upCount.textContent = result.upvotes;
        if (downCount) downCount.textContent = result.downvotes;

        // Update active state
        const newUserVote = getUserVote(law.id);
        upBtn?.classList.toggle('voted', newUserVote === 'up');
        downBtn?.classList.toggle('voted', newUserVote === 'down');
      } catch (error) {
        console.error('Failed to vote:', error);
        showError(error.message || 'Failed to vote. Please try again.');
      }
      return;
    }

    // Preserve click-to-detail navigation on the main body
    const host = t.closest('[data-law-id]');
    if (host) {
      const id = host.getAttribute('data-law-id');
      if (id) onNavigate('law', id);
    }
  });

  return el;
}
