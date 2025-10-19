import { LawOfTheDay } from '@components/law-of-day.js';
import { TopVoted } from '@components/top-voted.js';
import { Trending } from '@components/trending.js';
import { RecentlyAdded } from '@components/recently-added.js';
import templateHtml from '@views/templates/law-detail.html?raw';
import { fetchLaw, fetchLawOfTheDay } from '../utils/api.js';
import { renderAttributionsList } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { toggleVote } from '../utils/voting.js';

export function LawDetail({ lawId, onNavigate, onStructuredData }) {
  const el = document.createElement('div');
  el.className = 'container page law-detail pt-0';
  el.setAttribute('role', 'main');

  // Store current law for updates
  let currentLaw = null;

  el.innerHTML = templateHtml;

  const breadcrumbCurrent = el.querySelector('[data-breadcrumb-current]');
  const loadingState = el.querySelector('[data-loading]');
  const lawContent = el.querySelector('[data-law-content]');
  const lawOfDayContainer = el.querySelector('[data-law-of-day]');
  const lawCardContainer = el.querySelector('[data-law-card-container]');
  const widgetsContainer = el.querySelector('[data-widgets]');
  const notFoundState = el.querySelector('[data-not-found]');
  const notFoundTemplate = el.querySelector('[data-not-found-template]');
  const lawCardTemplate = el.querySelector('[data-law-card-template]');

  function setBreadcrumb(title) {
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = title;
    }
  }

  function showLoading() {
    loadingState?.removeAttribute('hidden');
    lawContent?.setAttribute('hidden', '');
    notFoundState?.setAttribute('hidden', '');
    setBreadcrumb('Loading…');
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
    setBreadcrumb('Not Found');
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
    const metaScore = clone.querySelector('[data-law-score]');
    const submittedEl = clone.querySelector('[data-law-submitted]');
    const upVoteBtn = clone.querySelector('[data-vote="up"]');
    const downVoteBtn = clone.querySelector('[data-vote="down"]');

    if (titleEl) titleEl.textContent = law.title ? String(law.title) : 'Law';
    if (textEl) textEl.textContent = law.text ? String(law.text) : '';

    const attsHtml = renderAttributionsList(law.attributions);
    const author = law.author ? String(law.author) : '';
    if (attsHtml) {
      if (attributionEl) {
        attributionEl.innerHTML = attsHtml;
        attributionEl.removeAttribute('hidden');
      }
    } else if (author) {
      if (attributionEl) {
        attributionEl.innerHTML = '';
        const authorEl = document.createElement('p');
        authorEl.className = 'small mb-4';
        authorEl.textContent = ` - ${author}`;
        attributionEl.appendChild(authorEl);
        attributionEl.removeAttribute('hidden');
      }
    }

    const displayScore = Number.isFinite(law.score) ? law.score : 0;
    if (metaScore) metaScore.textContent = `${displayScore > 0 ? '+' : ''}${displayScore}`;

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
    }
    if (downVoteBtn instanceof HTMLElement) {
      downVoteBtn.setAttribute('data-id', safeId);
    }

    return root;
  }

  function renderLaw(law) {
    currentLaw = law;
    const safeTitle = law.title ? escapeHtml(law.title) : 'Law';

    if (typeof onStructuredData === 'function') {
      onStructuredData(law);
    }

    setBreadcrumb(safeTitle);
    showLaw();

    lawOfDayContainer?.replaceChildren();
    lawCardContainer?.replaceChildren();
    widgetsContainer?.replaceChildren();

    fetchLawOfTheDay()
      .then(data => {
        const laws = data && Array.isArray(data.data) ? data.data : [];
        let lawOfTheDay = null;
        let isCurrentLawOfTheDay = false;

        if (laws.length > 0) {
          lawOfTheDay = laws[0];
          isCurrentLawOfTheDay = lawOfTheDay && lawOfTheDay.id === law.id;
        }

        if (lawOfTheDay && lawOfDayContainer) {
          const lodWidget = LawOfTheDay({ law: lawOfTheDay, onNavigate, showButton: false });
          lawOfDayContainer.appendChild(lodWidget);
        }

        if (!isCurrentLawOfTheDay && lawCardContainer) {
          const lawCard = renderLawCard(law);
          if (lawCard) {
            lawCardContainer.appendChild(lawCard);
          }
        }

        if (widgetsContainer) {
          const topVotedWidget = TopVoted();
          const trendingWidget = Trending();
          const recentlyAddedWidget = RecentlyAdded();

          widgetsContainer.appendChild(topVotedWidget);
          widgetsContainer.appendChild(trendingWidget);
          widgetsContainer.appendChild(recentlyAddedWidget);
        }
      })
      .catch(() => {
        lawOfDayContainer?.replaceChildren();

        if (lawCardContainer) {
          const lawCard = renderLawCard(law);
          if (lawCard) {
            lawCardContainer.appendChild(lawCard);
          }
        }

        if (widgetsContainer) {
          const topVotedWidget = TopVoted();
          const trendingWidget = Trending();
          const recentlyAddedWidget = RecentlyAdded();

          widgetsContainer.appendChild(topVotedWidget);
          widgetsContainer.appendChild(trendingWidget);
          widgetsContainer.appendChild(recentlyAddedWidget);
        }
      });
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
    if (t.dataset.nav) onNavigate(t.dataset.nav);

    // Handle voting
    if (t.dataset.vote && t.dataset.id) {
      const lawId = t.dataset.id;
      const voteType = t.dataset.vote;

      try {
        await toggleVote(lawId, voteType);
        // Optionally refresh the page to show updated vote counts
      } catch {
        // Silently handle errors
      }
    }
  });

  return el;
}
