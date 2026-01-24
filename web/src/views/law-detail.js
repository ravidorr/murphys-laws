import templateHtml from '@views/templates/law-detail.html?raw';
import { fetchLaw, fetchRelatedLaws as fetchRelatedLawsAPI } from '../utils/api.js';
import { renderAttributionsList } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { toggleVote, getUserVote } from '../utils/voting.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { SocialShare, initSharePopovers } from '../components/social-share.js';
import { updateSocialMetaTags } from '../utils/dom.js';
import { hydrateIcons } from '@utils/icons.js';
import { triggerAdSense } from '../utils/ads.js';
import { showSuccess } from '../components/notification.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { addVotingListeners } from '../utils/voting.js';

export function LawDetail({ lawId, onNavigate, onStructuredData }) {
  const el = document.createElement('div');
  el.className = 'container page law-detail pt-0';
  el.setAttribute('role', 'main');

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
        hydrateIcons(notFoundState);
      }
    }
  }

  function showLaw() {
    loadingState?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
    lawContent?.removeAttribute('hidden');
  }

  function renderLawCard(law) {
    /* v8 ignore next 3 - Template type guard, tested via integration tests */
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
    if (textEl) textEl.textContent = safeText;

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

    if (typeof onStructuredData === 'function') {
      onStructuredData(law);
    }

    // Update meta tags for social sharing
    const lawUrl = `${window.location.origin}${window.location.pathname}?law=${law.id}`;
    const lawTitle = law.title || 'Murphy\'s Law';
    const lawText = law.text || '';

    updateSocialMetaTags({
      title: `${lawTitle} - Murphy's Laws`,
      description: lawText,
      url: lawUrl
    });

    showLaw();

    lawCardContainer?.replaceChildren();

    if (lawCardContainer) {
      const lawCard = renderLawCard(law);
      if (lawCard) {
        lawCardContainer.appendChild(lawCard);
        hydrateIcons(lawCardContainer);

        // Add social share buttons to the footer
        const footer = lawCard.querySelector('.section-footer .right');
        if (footer) {
          const lawUrl = `${window.location.origin}${window.location.pathname}?law=${law.id}`;
          const lawText = law.text || '';

          // Create engaging Twitter text with the actual law
          const twitterText = `I'm on Murphy's Law Site and I've seen this law: "${lawText}". See it for yourself:`;

          const socialShare = SocialShare({
            url: lawUrl,
            title: twitterText,
            description: lawText,
            lawText: lawText,
            lawId: law.id
          });

          footer.appendChild(socialShare);
          hydrateIcons(footer);
        }

        // Signal content is ready - validate content before triggering ads
        triggerAdSense(lawCardContainer);
      }
    }

    // Fetch and render related laws
    loadRelatedLaws(law.id);
  }

  // Fetch related laws from the same category using the dedicated API endpoint
  async function loadRelatedLaws(currentLawId) {
    const relatedSection = el.querySelector('[data-related-laws]');
    const relatedList = el.querySelector('[data-related-laws-list]');
    
    if (!relatedSection || !relatedList) return;

    try {
      const data = await fetchRelatedLawsAPI(currentLawId, { limit: 3 });

      if (data && Array.isArray(data.data) && data.data.length > 0) {
        relatedList.innerHTML = renderLawCards(data.data);
        hydrateIcons(relatedList);
        initSharePopovers(relatedList);
        addVotingListeners(relatedList);
        relatedSection.removeAttribute('hidden');
      }
    } catch {
      // Silently fail - related laws are not critical
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
    if (!(t instanceof Element)) return;

    // Handle copy text action (both old and new button formats)
    const copyTextBtn = t.closest('[data-action="copy-text"]');
    if (copyTextBtn) {
      e.stopPropagation();
      // Try data-copy-value first (new button), fall back to law-text element (legacy)
      let textToCopy = copyTextBtn.getAttribute('data-copy-value');
      if (!textToCopy) {
        const lawTextEl = el.querySelector('[data-law-text]');
        textToCopy = lawTextEl?.textContent || '';
      }
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          showSuccess('Law text copied to clipboard!');
        } catch {
          // Fallback: select and copy
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

    // Handle copy link action (new circular button)
    const copyLinkBtn = t.closest('[data-action="copy-link"]');
    if (copyLinkBtn) {
      e.stopPropagation();
      const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || window.location.href;
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

    // Handle related law card clicks
    const lawCard = t.closest('.law-card-mini');
    if (lawCard && lawCard.dataset.lawId) {
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }

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
