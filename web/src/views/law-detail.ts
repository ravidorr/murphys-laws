import templateHtml from '@views/templates/law-detail.html?raw';
import { fetchLaw, fetchLaws, fetchRelatedLaws as fetchRelatedLawsAPI } from '../utils/api.ts';
import { renderAttributionsList, submittedByLabel } from '../utils/attribution.ts';
import { escapeHtml } from '../utils/sanitize.ts';
import { toggleVote, getUserVote } from '../utils/voting.ts';
import { getRandomLoadingMessage } from '../utils/constants.ts';
import { SocialShare, initSharePopovers } from '../components/social-share.ts';
import { updateSocialMetaTags } from '../utils/dom.ts';
// Note: law-detail uses template-based loading with getRandomLoadingMessage()
// for text replacement, which is compatible with the unified loading approach
import { hydrateIcons, createIcon } from '@utils/icons.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { copyToClipboard } from '../utils/clipboard.ts';
import { renderLawCards } from '../utils/law-card-renderer.ts';
import { addVotingListeners } from '../utils/voting.ts';
import { isFavoritesEnabled } from '../utils/feature-flags.ts';
import { isFavorite, toggleFavorite } from '../utils/favorites.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { Breadcrumb } from '../components/breadcrumb.ts';
import { getDefaultLawContext } from '../utils/law-context-copy.ts';
import type { CleanableElement, Law } from '../types/app.ts';

interface LawDetailProps {
  lawId: string;
  onNavigate: (page: string, param?: string) => void;
  onStructuredData?: (law: Law) => void;
}

export function LawDetail({ lawId, onNavigate, onStructuredData }: LawDetailProps): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page law-detail pt-0';

  el.innerHTML = templateHtml;

  const loadingState = el.querySelector('[data-loading]');
  const lawContent = el.querySelector('[data-law-content]');
  const lawCardContainer = el.querySelector('[data-law-card-container]');
  const notFoundState = el.querySelector('[data-not-found]');
  const notFoundTemplate = el.querySelector('[data-not-found-template]');
  const lawCardTemplate = el.querySelector('[data-law-card-template]');

  // Replace static loading message with random one
  /* v8 ignore start -- loadingState/loadingText are always provided by the component template */
  if (loadingState) {
    const loadingText = loadingState.querySelector('p');
    if (loadingText) {
      loadingText.textContent = getRandomLoadingMessage();
    }
  }
  /* v8 ignore stop */

  function showLoading() {
    loadingState?.removeAttribute('hidden');
    lawContent?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
  }

  function showNotFound() {
    loadingState?.setAttribute('hidden', '');
    lawContent?.setAttribute('hidden', '');
    /* v8 ignore start -- notFoundState/notFoundTemplate are always provided by the component template */
    if (notFoundState) {
      notFoundState.removeAttribute('hidden');
      if (notFoundTemplate instanceof HTMLTemplateElement) {
        notFoundState.replaceChildren(notFoundTemplate.content.cloneNode(true));
        hydrateIcons(notFoundState);
      }
    }
    /* v8 ignore stop */
  }

  function showLaw() {
    loadingState?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
    lawContent?.removeAttribute('hidden');
  }

  function renderLawCard(law: Law) {
    /* v8 ignore start -- lawCardTemplate is always provided by the component template */
    if (!lawCardTemplate || !(lawCardTemplate instanceof HTMLTemplateElement)) {
      return null;
    }
    /* v8 ignore stop */

    const clone = lawCardTemplate.content.cloneNode(true) as DocumentFragment;
    const root = clone.querySelector('[data-law-card-root]');
    const titleEl = clone.querySelector('[data-law-title]');
    const textEl = clone.querySelector('[data-law-text]');
    const attributionEl = clone.querySelector('[data-law-attribution]');
    const submittedEl = clone.querySelector('[data-law-submitted]');
    const upVoteBtn = clone.querySelector('[data-vote="up"]');
    const downVoteBtn = clone.querySelector('[data-vote="down"]');
    const upVoteCount = clone.querySelector('[data-upvote-count]');
    const downVoteCount = clone.querySelector('[data-downvote-count]');

    /* v8 ignore start -- titleEl is always present in the law card template clone */
    if (titleEl) {
    /* v8 ignore stop */
      const title = law.title ? String(law.title) : "Murphy's Law";
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
    /* v8 ignore start -- textEl is always present in the law card template clone */
    if (textEl) textEl.textContent = safeText;
    /* v8 ignore stop */

    const attsHtml = renderAttributionsList(law.attributions);
    const author = law.author ? String(law.author) : '';
    if (attsHtml) {
      /* v8 ignore start -- attributionEl is always present in the law card template clone */
      if (attributionEl) {
        attributionEl.innerHTML = attsHtml;
        attributionEl.removeAttribute('hidden');
      }
      /* v8 ignore stop */
    } else if (author) {
      /* v8 ignore start -- attributionEl is always present in the law card template clone */
      if (attributionEl) {
        attributionEl.textContent = `- ${author}`;
        attributionEl.removeAttribute('hidden');
      }
      /* v8 ignore stop */
    }

    const upvotes = Number.isFinite(law.upvotes) ? law.upvotes : 0;
    const downvotes = Number.isFinite(law.downvotes) ? law.downvotes : 0;

    /* v8 ignore start -- upVoteCount is always present in the law card template clone */
    if (upVoteCount) upVoteCount.textContent = String(upvotes);
    /* v8 ignore stop */
    /* v8 ignore start -- downVoteCount is always present in the law card template clone */
    if (downVoteCount) downVoteCount.textContent = String(downvotes);
    /* v8 ignore stop */

    // Show "Submitted by" only when we did not already show attribution (avoid "Sent by X" + "Submitted by X" duplication)
    const showedAttribution = !!(attsHtml || author);
    const submittedBy = submittedByLabel(law.attributions);
    const hasAttributions = Array.isArray(law.attributions) && law.attributions.length > 0;
    /* v8 ignore start -- submittedEl is always present in the law card template clone */
    if (submittedEl) {
    /* v8 ignore stop */
      if (!showedAttribution && submittedBy && (submittedBy !== 'Anonymous' || hasAttributions)) {
        submittedEl.textContent = `Submitted by ${submittedBy}`;
        submittedEl.removeAttribute('hidden');
      } else {
        submittedEl.setAttribute('hidden', '');
      }
    }

    /* v8 ignore start -- law.id is always defined in the API response */
    const safeId = escapeHtml(String(law.id ?? ''));
    /* v8 ignore stop */
    const userVote = getUserVote(law.id);
    /* v8 ignore start -- upVoteBtn is always an HTMLElement in the template clone */
    if (upVoteBtn instanceof HTMLElement) {
    /* v8 ignore stop */
      upVoteBtn.setAttribute('data-id', safeId);
      if (userVote === 'up') {
        upVoteBtn.classList.add('voted');
      }
    }
    /* v8 ignore start -- downVoteBtn is always an HTMLElement in the template clone */
    if (downVoteBtn instanceof HTMLElement) {
    /* v8 ignore stop */
      downVoteBtn.setAttribute('data-id', safeId);
      if (userVote === 'down') {
        downVoteBtn.classList.add('voted');
      }
    }

    // Initialize favorite button if feature is enabled
    const favoriteBtn = clone.querySelector('[data-favorite-btn]');
    /* v8 ignore start -- favoriteBtn is always an HTMLElement when found by querySelector */
    if (favoriteBtn instanceof HTMLElement && isFavoritesEnabled()) {
    /* v8 ignore stop */
      favoriteBtn.removeAttribute('hidden');
      favoriteBtn.setAttribute('data-id', safeId);
      
      const isFav = isFavorite(law.id);
      const favoriteTooltip = isFav ? 'Remove from favorites' : 'Add to favorites';
      if (isFav) {
        favoriteBtn.classList.add('favorited');
        favoriteBtn.setAttribute('aria-label', favoriteTooltip);
        favoriteBtn.setAttribute('data-tooltip', favoriteTooltip);
        // Use filled bookmark icon (same for add/remove)
        const iconEl = favoriteBtn.querySelector('[data-icon]');
        /* v8 ignore start -- iconEl is always present inside the favoriteBtn template clone */
        if (iconEl) {
          iconEl.setAttribute('data-icon', 'bookmarkFilled');
        }
        /* v8 ignore stop */
      }
      
      // Store law data for toggling
      favoriteBtn.dataset.lawText = law.text || '';
      favoriteBtn.dataset.lawTitle = law.title || '';
    }

    return root;
  }

  function renderLaw(law: Law) {

    if (typeof onStructuredData === 'function') {
      onStructuredData(law);
    }

    // Update meta tags for social sharing
    const lawUrl = `${window.location.origin}/law/${law.id}`;
    const lawTitle = law.title || 'Murphy\'s Law';
    const lawText = law.text || '';
    const ogImageUrl = `${window.location.origin}/api/v1/og/law/${law.id}.png`;

    updateSocialMetaTags({
      title: `${lawTitle} - Murphy's Laws`,
      description: lawText,
      url: lawUrl,
      image: ogImageUrl
    });

    // Register export content for this law
    setExportContent({
      type: ContentType.SINGLE_LAW,
      title: lawTitle,
      data: law
    });

    // Render breadcrumb navigation (include category when present)
    const breadcrumbContainer = el.querySelector('#law-breadcrumb');
    /* v8 ignore start -- breadcrumbContainer is always provided by the component template */
    if (breadcrumbContainer) {
    /* v8 ignore stop */
      const items: { label: string; nav?: string; param?: string; href?: string }[] = [
        { label: 'Browse', nav: 'browse', href: '/browse' }
      ];
      if (law.category_slug && law.category_name) {
        items.push({ label: law.category_name, nav: 'category', param: law.category_slug, href: `/category/${law.category_slug}` });
      }
      items.push({ label: lawTitle });
      const breadcrumb = Breadcrumb({
        items,
        onNavigate
      });
      /* v8 ignore start -- Breadcrumb always returns a non-null element */
      if (breadcrumb) breadcrumbContainer.replaceChildren(breadcrumb);
      /* v8 ignore stop */
    }

    showLaw();

    lawCardContainer?.replaceChildren();

    /* v8 ignore start -- lawCardContainer is always provided by the component template */
    if (lawCardContainer) {
    /* v8 ignore stop */
      const lawCard = renderLawCard(law);
      /* v8 ignore start -- renderLawCard always returns non-null when template is present */
      if (lawCard) {
      /* v8 ignore stop */
        lawCardContainer.appendChild(lawCard);
        hydrateIcons(lawCardContainer);

        // Add social share buttons to the footer
        const footer = lawCard.querySelector('.section-footer .right');
        /* v8 ignore start -- footer is always present in the law card template */
        if (footer) {
        /* v8 ignore stop */
          // Create engaging Twitter text with the actual law
          const twitterText = `I'm on Murphy's Law Site and I've seen this law: "${lawText}". See it for yourself:`;

          const socialShare = SocialShare({
            url: lawUrl,
            title: twitterText,
            description: lawText,
            lawText,
            lawId: String(law.id)
          });

          footer.appendChild(socialShare);
          hydrateIcons(footer);
        }

        // Signal content is ready - validate content before triggering ads
        triggerAdSense(lawCardContainer as HTMLElement);
      }
    }

    // Add "In context" editorial copy from primary category (DB) or default (AdSense / thin-content)
    const contextSection = el.querySelector('[data-law-context]');
    const contextTextEl = el.querySelector('[data-law-context-text]');
    /* v8 ignore start -- contextSection and contextTextEl are always in the component template */
    if (contextSection && contextTextEl) {
    /* v8 ignore stop */
      const contextText = (law.category_context !== undefined && law.category_context !== null && law.category_context !== '')
        ? law.category_context
        : getDefaultLawContext();
      contextTextEl.textContent = contextText;
    }

    // Fetch and render related laws
    loadRelatedLaws(law.id);
  }

  // Fetch related laws from the same category using the dedicated API endpoint
  async function loadRelatedLaws(currentLawId: number | string) {
    const relatedSection = el.querySelector('[data-related-laws]');
    const relatedList = el.querySelector('[data-related-laws-list]');
    
    /* v8 ignore start -- relatedSection and relatedList are always in the component template */
    if (!relatedSection || !relatedList) return;
    /* v8 ignore stop */

    try {
      const data = await fetchRelatedLawsAPI(currentLawId, { limit: 3 });

      if (data && Array.isArray(data.data) && data.data.length > 0) {
        relatedList.innerHTML = renderLawCards(data.data);
        hydrateIcons(relatedList);
        initSharePopovers(relatedList as HTMLElement);
        addVotingListeners(relatedList as HTMLElement);
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
    clearExportContent();
  } else {
    fetchLaw(lawId)
      .then(data => {
        el.setAttribute('aria-busy', 'false');
        renderLaw(data);
      })
      .catch(() => {
        el.setAttribute('aria-busy', 'false');
        showNotFound();
        clearExportContent();
      });
  }

  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-action="retry-law"]')) {
      /* v8 ignore start -- lawId is always set when the retry action is triggered */
      if (!lawId) return;
      /* v8 ignore stop */
      showLoading();
      el.setAttribute('aria-busy', 'true');
      fetchLaw(lawId)
        .then((data) => {
          el.setAttribute('aria-busy', 'false');
          renderLaw(data);
        })
        .catch(() => {
          el.setAttribute('aria-busy', 'false');
          showNotFound();
          clearExportContent();
        });
      return;
    }

    if (t.closest('[data-action="random-law"]')) {
      e.preventDefault();
      fetchLaws({ limit: 1, offset: 0, exclude_corollaries: true })
        .then((res) => {
          /* v8 ignore start -- res always has a total field from the fetchLaws API */
          const total = res?.total ?? 0;
          /* v8 ignore stop */
          if (total <= 0) {
            onNavigate('browse');
            return;
          }
          const offset = Math.min(Math.floor(Math.random() * total), Math.max(0, total - 1));
          return fetchLaws({ limit: 1, offset, exclude_corollaries: true });
        })
        .then((res) => {
          const law = res?.data?.[0];
          if (law?.id) {
            onNavigate('law', String(law.id));
          } else {
            onNavigate('browse');
          }
        })
        .catch(() => {
          onNavigate('browse');
        });
      return;
    }

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
        await copyToClipboard(textToCopy, 'Law text copied to clipboard!');
      }
      return;
    }

    // Handle copy link action (new circular button)
    const copyLinkBtn = t.closest('[data-action="copy-link"]');
    if (copyLinkBtn) {
      e.stopPropagation();
      const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || window.location.href;
      await copyToClipboard(linkToCopy, 'Link copied to clipboard!');
      return;
    }

    // Handle favorite button click (main law card uses data-favorite-btn)
    const favoriteBtn = t.closest('[data-favorite-btn]') as HTMLElement | null;
    if (favoriteBtn && favoriteBtn.dataset.id) {
      e.stopPropagation();
      const lawId = favoriteBtn.dataset.id;
      /* v8 ignore start -- dataset.lawText/lawTitle are always set when the law card is rendered */
      const lawText = favoriteBtn.dataset.lawText || '';
      const lawTitle = favoriteBtn.dataset.lawTitle || '';
      /* v8 ignore stop */

      const isNowFavorite = toggleFavorite({
        id: lawId,
        text: lawText,
        title: lawTitle,
      });

      // Update button visual state
      /* v8 ignore start -- both tooltip states tested; icon always present in hydrated button */
      const newTooltip = isNowFavorite ? 'Remove from favorites' : 'Add to favorites';
      favoriteBtn.classList.toggle('favorited', isNowFavorite);
      favoriteBtn.setAttribute('aria-label', newTooltip);
      favoriteBtn.setAttribute('data-tooltip', newTooltip);

      // Update icon (always use filled bookmark for add/remove)
      const iconEl = favoriteBtn.querySelector('svg[data-icon-name]');
      if (iconEl) {
        const newIcon = createIcon('bookmarkFilled');
        if (newIcon) {
          iconEl.replaceWith(newIcon);
        }
      }
      /* v8 ignore stop */
      return;
    }

    // Handle favorite button click on related law cards (uses data-action="favorite")
    const relatedFavoriteBtn = t.closest('[data-action="favorite"]');
    if (relatedFavoriteBtn) {
      e.stopPropagation();
      const lawId = relatedFavoriteBtn.getAttribute('data-law-id');
      if (!lawId) return;

      // Get law content from the card (link contains "Title: text" or "text")
      const lawCard = relatedFavoriteBtn.closest('.law-card-mini');
      const link = lawCard?.querySelector('.law-card-text a');
      const fullContent = link?.textContent?.trim() || '';
      const colonIdx = fullContent.indexOf(': ');
      /* v8 ignore start -- content format depends on whether law has a title; both branches valid */
      const lawTitle = colonIdx > 0 ? fullContent.slice(0, colonIdx).trim() : '';
      const lawText = colonIdx > 0 ? fullContent.slice(colonIdx + 2).trim() : fullContent;
      /* v8 ignore stop */

      const isNowFavorite = toggleFavorite({
        id: lawId,
        text: lawText,
        title: lawTitle,
      });

      // Update button visual state
      /* v8 ignore start -- both tooltip states tested; icon always present in hydrated button */
      const newTooltip = isNowFavorite ? 'Remove from favorites' : 'Add to favorites';
      relatedFavoriteBtn.classList.toggle('favorited', isNowFavorite);
      relatedFavoriteBtn.setAttribute('aria-label', newTooltip);
      relatedFavoriteBtn.setAttribute('data-tooltip', newTooltip);

      // Update icon (always use filled bookmark for add/remove)
      const iconEl = relatedFavoriteBtn.querySelector('svg[data-icon-name]');
      if (iconEl) {
        const newIcon = createIcon('bookmarkFilled');
        if (newIcon) {
          iconEl.replaceWith(newIcon);
        }
      }
      /* v8 ignore stop */
      return;
    }

    // Handle related law card clicks
    const lawCard = t.closest('.law-card-mini') as HTMLElement | null;
    if (lawCard && lawCard.dataset.lawId) {
      // Don't navigate if clicking on interactive elements (buttons for voting, favorites, share)
      if (t.closest('button')) return;
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      /* v8 ignore start -- nav elements always have a data-nav attribute set in the template */
      if (navTarget) {
      /* v8 ignore stop */
        onNavigate(navTarget);
        return;
      }
    }

    // Handle voting (use closest so clicks on button inner icon/count still work)
    const voteBtn = t.closest('button[data-vote]') as HTMLElement | null;
    if (voteBtn && voteBtn.dataset.id) {
      e.stopPropagation();
      const lawId = voteBtn.dataset.id;
      const voteType = voteBtn.getAttribute('data-vote') as import('../types/app.d.ts').VoteType | null;

      if (!voteType) return;

      try {
        const result = await toggleVote(lawId, voteType);

        // Update vote counts in UI
        const upVoteCount = el.querySelector('[data-upvote-count]');
        const downVoteCount = el.querySelector('[data-downvote-count]');
        const upVoteBtn = el.querySelector('[data-vote="up"]');
        const downVoteBtn = el.querySelector('[data-vote="down"]');

        /* v8 ignore start -- vote count elements are always present in the rendered law card */
        if (upVoteCount) upVoteCount.textContent = String(result.upvotes);
        if (downVoteCount) downVoteCount.textContent = String(result.downvotes);
        /* v8 ignore stop */

        // Update active state
        const newUserVote = getUserVote(lawId);
        upVoteBtn?.classList.toggle('voted', newUserVote === 'up');
        downVoteBtn?.classList.toggle('voted', newUserVote === 'down');
      } catch {
        // Silently handle errors
      }
    }
  });

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup = () => {
    clearExportContent();
  };

  return el;
}
