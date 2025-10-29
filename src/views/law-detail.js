import templateHtml from '@views/templates/law-detail.html?raw';
import { fetchLaw } from '../utils/api.js';
import { renderAttributionsList } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { toggleVote, getUserVote } from '../utils/voting.js';
import { showSuccess, showError as showErrorNotification } from '../components/notification.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { SocialShare } from '../components/social-share.js';

export function LawDetail({ lawId, onNavigate, onStructuredData }) {
  const el = document.createElement('div');
  el.className = 'container page law-detail pt-0';
  el.setAttribute('role', 'main');

  // Store current law for updates
  let currentLaw = null;

  el.innerHTML = templateHtml;

  const loadingState = el.querySelector('[data-loading]');
  const lawContent = el.querySelector('[data-law-content]');
  const lawCardContainer = el.querySelector('[data-law-card-container]');
  const notFoundState = el.querySelector('[data-not-found]');
  const notFoundTemplate = el.querySelector('[data-not-found-template]');
  const lawCardTemplate = el.querySelector('[data-law-card-template]');

  // Replace static loading message with random one
  if (loadingState) {
    const loadingText = loadingState.querySelector('p');
    if (loadingText) {
      loadingText.textContent = getRandomLoadingMessage();
    }
  }

  function showLoading() {
    loadingState?.removeAttribute('hidden');
    lawContent?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
  }

  function showNotFound() {
    loadingState?.setAttribute('hidden', '');
    lawContent?.setAttribute('hidden', '');
    if (notFoundState) {
      notFoundState.removeAttribute('hidden');
      if (notFoundTemplate instanceof HTMLTemplateElement) {
        notFoundState.replaceChildren(notFoundTemplate.content.cloneNode(true));
      }
    }
  }

  function showLaw() {
    loadingState?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
    lawContent?.removeAttribute('hidden');
  }

  function renderLawCard(law) {
    if (!lawCardTemplate || !(lawCardTemplate instanceof HTMLTemplateElement)) {
      return null;
    }

    const clone = lawCardTemplate.content.cloneNode(true);
    const root = clone.querySelector('[data-law-card-root]');
    const titleEl = clone.querySelector('[data-law-title]');
    const textEl = clone.querySelector('[data-law-text]');
    const attributionEl = clone.querySelector('[data-law-attribution]');
    const submittedEl = clone.querySelector('[data-law-submitted]');
    const upVoteBtn = clone.querySelector('[data-vote="up"]');
    const downVoteBtn = clone.querySelector('[data-vote="down"]');
    const upVoteCount = clone.querySelector('[data-upvote-count]');
    const downVoteCount = clone.querySelector('[data-downvote-count]');

    if (titleEl) {
      const title = law.title ? String(law.title) : 'Law';
      // Split title to accent the first word
      const words = title.split(' ');
      if (words.length > 1) {
        const firstWord = escapeHtml(words[0]);
        const restOfTitle = escapeHtml(words.slice(1).join(' '));
        titleEl.innerHTML = `<span class="accent-text">${firstWord}</span> ${restOfTitle}`;
      } else {
        titleEl.textContent = title;
      }
    }

    const safeText = escapeHtml(law.text || '');
    if (textEl) textEl.textContent = `"${safeText}"`;

    const attsHtml = renderAttributionsList(law.attributions);
    const author = law.author ? String(law.author) : '';
    if (attsHtml) {
      if (attributionEl) {
        attributionEl.innerHTML = attsHtml;
        attributionEl.removeAttribute('hidden');
      }
    } else if (author) {
      if (attributionEl) {
        attributionEl.textContent = `- ${author}`;
        attributionEl.removeAttribute('hidden');
      }
    }

    const upvotes = Number.isFinite(law.upvotes) ? law.upvotes : 0;
    const downvotes = Number.isFinite(law.downvotes) ? law.downvotes : 0;

    if (upVoteCount) upVoteCount.textContent = String(upvotes);
    if (downVoteCount) downVoteCount.textContent = String(downvotes);

    const submittedBy = law.submittedBy ? String(law.submittedBy) : '';
    if (submittedEl) {
      if (submittedBy) {
        submittedEl.textContent = `Submitted by ${submittedBy}`;
        submittedEl.removeAttribute('hidden');
      } else {
        submittedEl.setAttribute('hidden', '');
      }
    }

    const safeId = escapeHtml(String(law.id ?? ''));
    if (upVoteBtn instanceof HTMLElement) {
      upVoteBtn.setAttribute('data-id', safeId);
      const userVote = getUserVote(law.id);
      if (userVote === 'up') {
        upVoteBtn.classList.add('voted');
      }
    }
    if (downVoteBtn instanceof HTMLElement) {
      downVoteBtn.setAttribute('data-id', safeId);
      const userVote = getUserVote(law.id);
      if (userVote === 'down') {
        downVoteBtn.classList.add('voted');
      }
    }

    return root;
  }

  function renderLaw(law) {
    currentLaw = law;

    if (typeof onStructuredData === 'function') {
      onStructuredData(law);
    }

    showLaw();

    lawCardContainer?.replaceChildren();

    if (lawCardContainer) {
      const lawCard = renderLawCard(law);
      if (lawCard) {
        lawCardContainer.appendChild(lawCard);

        // Add social share buttons to the footer
        const footer = lawCard.querySelector('.section-footer .right');
        if (footer) {
          const lawUrl = `${window.location.origin}${window.location.pathname}?law=${law.id}`;
          const lawTitle = law.title || 'Murphy\'s Law';
          const lawDescription = law.text || '';

          const socialShare = SocialShare({
            url: lawUrl,
            title: `${lawTitle} - Murphy's Laws`,
            description: lawDescription
          });

          footer.appendChild(socialShare);
        }
      }
    }
  }

  showLoading();
  el.setAttribute('aria-busy', 'true');

  if (!lawId) {
    showNotFound();
  } else {
    fetchLaw(lawId)
      .then(data => {
        el.setAttribute('aria-busy', 'false');
        renderLaw(data);
      })
      .catch(() => {
        el.setAttribute('aria-busy', 'false');
        showNotFound();
      });
  }

  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
        return;
      }
    }

    // Handle voting
    const voteBtn = t.closest('[data-vote]');
    if (voteBtn && voteBtn.dataset.id) {
      e.stopPropagation();
      const lawId = voteBtn.dataset.id;
      const voteType = voteBtn.getAttribute('data-vote');

      if (!voteType) return;

      try {
        const result = await toggleVote(lawId, voteType);

        // Update vote counts in UI
        const upVoteCount = el.querySelector('[data-upvote-count]');
        const downVoteCount = el.querySelector('[data-downvote-count]');
        const upVoteBtn = el.querySelector('[data-vote="up"]');
        const downVoteBtn = el.querySelector('[data-vote="down"]');

        if (upVoteCount) upVoteCount.textContent = String(result.upvotes);
        if (downVoteCount) downVoteCount.textContent = String(result.downvotes);

        // Update active state
        const newUserVote = getUserVote(lawId);
        upVoteBtn?.classList.toggle('voted', newUserVote === 'up');
        downVoteBtn?.classList.toggle('voted', newUserVote === 'down');
      } catch {
        // Silently handle errors
      }
    }
  });

  return el;
}
