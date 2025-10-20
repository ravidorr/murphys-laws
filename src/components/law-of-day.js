// Law of the Day widget component

import templateHtml from '@components/templates/law-of-day.html?raw';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getUserVote, toggleVote } from '../utils/voting.js';
import { showError, showSuccess } from './notification.js';

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

    // Handle share button
    const shareBtn = t.closest('[data-action="share"]');
    if (shareBtn) {
      e.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}#/law/${law.id}`;
      const title = law.title || 'Murphy\'s Law of the Day';
      const text = law.text || '';

      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
        } catch (err) {
          // User cancelled or error occurred
          if (err.name !== 'AbortError') {
            // Fallback to clipboard
            fallbackShare(url);
          }
        }
      } else {
        // Fallback to clipboard
        fallbackShare(url);
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

  function fallbackShare(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showSuccess('Link copied to clipboard!');
      }).catch(() => {
        promptCopy(url);
      });
    } else {
      promptCopy(url);
    }
  }

  function promptCopy(url) {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showSuccess('Link copied to clipboard!');
      } else {
        showError('Failed to copy link. Please copy manually: ' + url);
      }
    } catch {
      showError('Failed to copy link. Please copy manually: ' + url);
    }
    document.body.removeChild(textArea);
  }

  return el;
}
