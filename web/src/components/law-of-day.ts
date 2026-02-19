// Law of the Day widget component

import templateHtml from '@components/templates/law-of-day.html?raw';
import { firstAttributionLine } from '../utils/attribution.ts';
import { escapeHtml } from '../utils/sanitize.ts';
import { getUserVote, toggleVote } from '../utils/voting.ts';
import { showError, showSuccess } from './notification.ts';
import { SocialShare } from './social-share.ts';
import { hydrateIcons, createIcon } from '../utils/icons.ts';
import { createLoading } from './loading.ts';
import { isFavoritesEnabled } from '../utils/feature-flags.ts';
import { isFavorite, toggleFavorite } from '../utils/favorites.ts';
import type { Law, OnNavigate } from '../types/app.d.ts';

export function LawOfTheDay({ law, onNavigate }: { law: Law | null; onNavigate: OnNavigate }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';

  if (!law) {
    const loading = createLoading({ 
      size: 'large', 
      ariaLabel: 'Loading Law of the Day' 
    });
    el.appendChild(loading);
    return el;
  }

  const iso = new Date().toISOString();
  const dateText = new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const upvotes = Number.isFinite(law.upvotes) ? law.upvotes : 0;
  const downvotes = Number.isFinite(law.downvotes) ? law.downvotes : 0;
  const attribution = firstAttributionLine(law);
  const userVote = getUserVote(law.id);

  // Safely escape the law text and title
  const safeText = escapeHtml(law.text);
  const safeTitle = law.title ? escapeHtml(law.title) : '';

  // Combine title and text if title exists
  const lawDisplay = safeTitle ? `${safeTitle}: ${safeText}` : safeText;

  el.innerHTML = templateHtml;

  // Hydrate icons
  hydrateIcons(el);

  const dateEl = el.querySelector('#lod-date');
  if (dateEl) {
    dateEl.setAttribute('datetime', iso);
    dateEl.textContent = dateText;
  }

  const bodyEl = el.querySelector('#lod-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <a href="/law/${law.id}" class="lod-link" data-law-id="${law.id}" aria-label="Read full law details">
        <blockquote class="lod-quote-large">${lawDisplay}</blockquote>
      </a>
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

  // Initialize favorite button if feature is enabled
  const favoriteBtn = el.querySelector('[data-favorite-btn]');
  if (favoriteBtn instanceof HTMLElement && isFavoritesEnabled()) {
    favoriteBtn.removeAttribute('hidden');
    favoriteBtn.setAttribute('data-law-id', String(law.id));
    
    const isFav = isFavorite(law.id);
    const favoriteTooltip = isFav ? 'Remove from favorites' : 'Add to favorites';
    if (isFav) {
      favoriteBtn.classList.add('favorited');
      // Replace icon with filled heart
      const iconEl = favoriteBtn.querySelector('svg[data-icon-name]');
      if (iconEl) {
        const newIcon = createIcon('heartFilled');
        if (newIcon) {
          iconEl.replaceWith(newIcon);
        }
      }
    }
    favoriteBtn.setAttribute('aria-label', favoriteTooltip);
    favoriteBtn.setAttribute('data-tooltip', favoriteTooltip);
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
      description: lawText,
      lawText: lawText,
      lawId: String(law.id)
    });

    footer.appendChild(socialShare);
    hydrateIcons(footer);
  }

  // Handle voting, navigation, sharing, and copy actions
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle copy text action
    const copyTextBtn = t.closest('[data-action="copy-text"]');
    if (copyTextBtn) {
      e.stopPropagation();
      const textToCopy = copyTextBtn.getAttribute('data-copy-value') || law.text || '';
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          showSuccess('Law text copied to clipboard!');
        } catch {
          // Fallback
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showSuccess('Law text copied to clipboard!');
        }
      }
      return;
    }

    // Handle copy link action
    const copyLinkBtn = t.closest('[data-action="copy-link"]');
    if (copyLinkBtn) {
      e.stopPropagation();
      const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || `${window.location.origin}/law/${law.id}`;
      try {
        await navigator.clipboard.writeText(linkToCopy);
        showSuccess('Link copied to clipboard!');
      } catch {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = linkToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showSuccess('Link copied to clipboard!');
      }
      return;
    }

    // Handle favorite button click
    const favoriteBtn = t.closest('[data-action="favorite"]');
    if (favoriteBtn) {
      e.stopPropagation();
      const lawId = favoriteBtn.getAttribute('data-law-id');
      if (!lawId) return;

      const isNowFavorite = toggleFavorite({
        id: lawId,
        text: law.text || '',
        title: law.title || '',
      });

      // Update button visual state
      const newTooltip = isNowFavorite ? 'Remove from favorites' : 'Add to favorites';
      favoriteBtn.classList.toggle('favorited', isNowFavorite);
      favoriteBtn.setAttribute('aria-label', newTooltip);
      favoriteBtn.setAttribute('data-tooltip', newTooltip);

      // Update icon
      const iconEl = favoriteBtn.querySelector('svg[data-icon-name]');
      if (iconEl) {
        const newIconName = isNowFavorite ? 'heartFilled' : 'heart';
        const newIcon = createIcon(newIconName);
        if (newIcon) {
          iconEl.replaceWith(newIcon);
        }
      }
      return;
    }

    // Handle vote buttons
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn) {
      e.stopPropagation();
      const voteType = voteBtn.getAttribute('data-vote') as import('../types/app.d.ts').VoteType | null;
      if (!voteType) return;

      try {
        const result = await toggleVote(law.id, voteType);

        // Update vote counts in UI
        const upBtn = el.querySelector('[data-vote="up"]');
        const downBtn = el.querySelector('[data-vote="down"]');
        const upCount = upBtn?.querySelector('.count-num');
        const downCount = downBtn?.querySelector('.count-num');

        if (upCount) upCount.textContent = String(result.upvotes);
        if (downCount) downCount.textContent = String(result.downvotes);

        // Update active state
        const newUserVote = getUserVote(law.id);
        upBtn?.classList.toggle('voted', newUserVote === 'up');
        downBtn?.classList.toggle('voted', newUserVote === 'down');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to vote. Please try again.');
      }
      return;
    }

    // Handle law detail navigation
    const lawLink = t.closest('[data-law-id]');
    if (lawLink) {
      e.preventDefault();
      const lawId = lawLink.getAttribute('data-law-id');
      if (lawId && onNavigate) {
        onNavigate('law', lawId);
      }
      return;
    }

    // Handle nav buttons
    const navBtn = t.closest('[data-nav]');
    if (navBtn && onNavigate) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
      return;
    }
  });

  return el;
}
