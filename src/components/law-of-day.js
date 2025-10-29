// Law of the Day widget component

import templateHtml from '@components/templates/law-of-day.html?raw';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getUserVote, toggleVote } from '../utils/voting.js';
import { showError, showSuccess } from './notification.js';
import { SocialShare } from './social-share.js';

export function LawOfTheDay({ law, onNavigate }) {
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

  el.innerHTML = templateHtml;

  const dateEl = el.querySelector('#lod-date');
  if (dateEl) {
    dateEl.setAttribute('datetime', iso);
    dateEl.textContent = dateText;
  }

  const bodyEl = el.querySelector('#lod-body');
  if (bodyEl) {
    bodyEl.setAttribute('data-law-id', escapeHtml(String(law.id)));
    bodyEl.innerHTML = `
      <blockquote class="lod-quote-large">"${safeText}"</blockquote>
      <p class="lod-attrib">${attribution}</p>
    `;
  }

  const upBtn = el.querySelector('[data-vote="up"]');
  const downBtn = el.querySelector('[data-vote="down"]');

  if (upBtn) {
    upBtn.classList.toggle('voted', userVote === 'up');
    const upCount = upBtn.querySelector('.count-num');
    if (upCount) upCount.textContent = String(upvotes);
  }

  if (downBtn) {
    downBtn.classList.toggle('voted', userVote === 'down');
    const downCount = downBtn.querySelector('.count-num');
    if (downCount) downCount.textContent = String(downvotes);
  }

  // Add social share buttons to the footer
  const footer = el.querySelector('.section-footer .right');
  if (footer) {
    // Remove the old share button
    const oldShareBtn = footer.querySelector('[data-action="share"]');
    if (oldShareBtn) {
      oldShareBtn.remove();
    }

    const lawUrl = `${window.location.origin}${window.location.pathname}?law=${law.id}`;
    const lawText = law.text || '';

    // Create engaging Twitter text with the actual law
    const twitterText = `I'm on Murphy's Law Site and I've seen this law: "${lawText}". See it for yourself:`;

    const socialShare = SocialShare({
      url: lawUrl,
      title: twitterText,
      description: lawText
    });

    footer.appendChild(socialShare);
  }

  // Handle voting, navigation, and sharing
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
