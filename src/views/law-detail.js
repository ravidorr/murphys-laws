import { LawOfTheDay } from '@components/law-of-day.js';
import { TopVoted } from '@components/top-voted.js';
import { Trending } from '@components/trending.js';
import { RecentlyAdded } from '@components/recently-added.js';
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

  // Helper to render breadcrumb navigation
  function renderBreadcrumb(lawTitle) {
    return `
      <nav class="breadcrumb mb-4" aria-label="Breadcrumb">
        <a href="#" data-nav="home" class="breadcrumb-link">Home</a>
        <span class="breadcrumb-separator">/</span>
        <a href="#" data-nav="browse" class="breadcrumb-link">Browse</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-current">${lawTitle}</span>
      </nav>
    `;
  }

  // Helper to render law card HTML
  function createLawCardHTML(law) {
    const displayScore = Number.isFinite(law.score) ? law.score : 0;
    const attsHtml = renderAttributionsList(law.attributions);
    const safeTitle = law.title ? escapeHtml(law.title) : 'Law';
    const safeText = escapeHtml(law.text);
    const safeAuthor = law.author ? escapeHtml(law.author) : '';
    const safeSubmittedBy = law.submittedBy ? escapeHtml(law.submittedBy) : '';

    return `
      <div class="card">
        <div class="card-content">
          <h2 class="mb-4">${safeTitle}</h2>
          <blockquote class="blockquote">${safeText}</blockquote>
          ${attsHtml || (safeAuthor ? `<p class="small mb-4"> — ${safeAuthor}</p>` : '')}
          <div class="small law-meta mb-4" data-law-meta>
            <span data-score>Score: ${displayScore > 0 ? '+' : ''}${displayScore}</span>
            ${safeSubmittedBy ? `<span>Submitted by ${safeSubmittedBy}</span>` : ''}
          </div>
          <div class="flex gap-2 flex-wrap">
            <div class="flex gap-2">
              <button data-vote="up" data-id="${escapeHtml(String(law.id))}" aria-label="Upvote" title="Upvote">
                <span class="material-symbols-outlined">thumb_up</span>
              </button>
              <button class="outline" data-vote="down" data-id="${escapeHtml(String(law.id))}" aria-label="Downvote" title="Downvote">
                <span class="material-symbols-outlined">thumb_down</span>
              </button>
            </div>
            <button class="btn outline" data-nav="browse">Browse All Laws</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderNotFound() {
    el.innerHTML = `
      ${renderBreadcrumb('Not Found')}
      <div class="card"><div class="card-content text-center">
        <h2 class="mb-4">Law Not Found</h2>
        <button data-nav="browse">Browse All Laws</button>
      </div></div>
    `;
  }

  function renderLaw(law) {
    currentLaw = law;
    const safeTitle = law.title ? escapeHtml(law.title) : 'Law';

    // Clear and start fresh
    el.innerHTML = '';

    if (typeof onStructuredData === 'function') {
      onStructuredData(law);
    }

    // Add breadcrumb navigation
    const breadcrumbDiv = document.createElement('div');
    breadcrumbDiv.innerHTML = renderBreadcrumb(safeTitle);
    el.appendChild(breadcrumbDiv);

    // Fetch Law of the Day
    fetchLawOfTheDay()
      .then(data => {
        const laws = data && Array.isArray(data.data) ? data.data : [];
        let lawOfTheDay = null;
        let isCurrentLawOfTheDay = false;

        if (laws.length > 0) {
          lawOfTheDay = laws[0]; // First result is the top-voted law
          isCurrentLawOfTheDay = lawOfTheDay && lawOfTheDay.id === law.id;
        }

        // Add Law of the Day component first (without button on detail page)
        if (lawOfTheDay) {
          const lodWidget = LawOfTheDay({ law: lawOfTheDay, onNavigate, showButton: false });
          el.appendChild(lodWidget);
        }

        // Only add current law details card if it's NOT the Law of the Day
        if (!isCurrentLawOfTheDay) {
          const lawCard = document.createElement('div');
          lawCard.innerHTML = createLawCardHTML(law);
          el.appendChild(lawCard);
        }

        // Add Top Voted, Trending, Recently Added components (they fetch their own data)
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid mb-12 section-grid';

        const topVotedWidget = TopVoted();
        const trendingWidget = Trending();
        const recentlyAddedWidget = RecentlyAdded();

        gridWrapper.appendChild(topVotedWidget);
        gridWrapper.appendChild(trendingWidget);
        gridWrapper.appendChild(recentlyAddedWidget);

        el.appendChild(gridWrapper);
      })
      .catch(() => {
        // Fallback: render law without Law of the Day component
        const lawCard = document.createElement('div');
        lawCard.innerHTML = createLawCardHTML(law);
        el.appendChild(lawCard);

        // Still add the other components
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid mb-12 section-grid';

        const topVotedWidget = TopVoted();
        const trendingWidget = Trending();
        const recentlyAddedWidget = RecentlyAdded();

        gridWrapper.appendChild(topVotedWidget);
        gridWrapper.appendChild(trendingWidget);
        gridWrapper.appendChild(recentlyAddedWidget);

        el.appendChild(gridWrapper);
      });
  }

  // Initial loading
  el.innerHTML = `<p class="small">Loading law...</p>`;
  el.setAttribute('aria-busy', 'true');

  if (!lawId) {
    renderNotFound();
  } else {
    fetchLaw(lawId)
      .then(data => {
        el.setAttribute('aria-busy', 'false');
        renderLaw(data);
      })
      .catch(() => {
        el.setAttribute('aria-busy', 'false');
        renderNotFound();
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
