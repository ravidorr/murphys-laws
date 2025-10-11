// Browse view - displays all laws with pagination and search

import templateHtml from '@views/templates/browse.html?raw';
import { fetchLaws } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { highlightSearchTerm, escapeHtml } from '../utils/sanitize.js';
import { wrapLoadingMarkup } from '../utils/dom.js';
import { LAWS_PER_PAGE } from '../utils/constants.js';
import { getUserVote, toggleVote } from '../utils/voting.js';
import { AdvancedSearch } from '../components/advanced-search.js';

export function Browse({ searchQuery, onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';

  let currentPage = 1;
  let totalLaws = 0;
  let laws = [];
  let currentFilters = { q: searchQuery || '' };

  // Render pagination controls
  function renderPagination(currentPage, totalLaws, perPage) {
    const totalPages = Math.ceil(totalLaws / perPage);
    if (totalPages <= 1) return '';

    let pages = [];

    // Always show first page
    pages.push(1);

    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    const pageButtons = pages.map(p => {
      if (p === '...') {
        return `<span class="ellipsis">…</span>`;
      }
      const isCurrent = p === currentPage;
      const disabled = isCurrent ? 'aria-current="page"' : '';
      return `<button class="btn outline" data-page="${p}" ${disabled}>${p}</button>`;
    }).join('');

    const prevDisabled = currentPage === 1 ? 'disabled aria-disabled="true"' : '';
    const nextDisabled = currentPage === totalPages ? 'disabled aria-disabled="true"' : '';

    return `
      <div class="pagination">
        <button class="btn outline" data-page="${currentPage - 1}" ${prevDisabled}>Previous</button>
        ${pageButtons}
        <button class="btn outline" data-page="${currentPage + 1}" ${nextDisabled}>Next</button>
      </div>
    `;
  }

  // Render law cards
  function renderLaws(laws, query) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="material-symbols-outlined empty-state-icon">search_off</span>
          <p class="empty-state-title">No laws found</p>
          <p class="empty-state-text">Try adjusting your search filters or clearing them to see more results.</p>
        </div>
      `;
    }

    return laws.map(law => {
      const up = Number.isFinite(law.upvotes) ? law.upvotes : 0;
      const down = Number.isFinite(law.downvotes) ? law.downvotes : 0;
      const attribution = firstAttributionLine(law);

      // Apply highlighting and escaping to title and text
      const title = law.title ? highlightSearchTerm(law.title, query) : '';
      const text = highlightSearchTerm(law.text, query);
      const titleText = title ? `<strong>${title}:</strong> ${text}` : text;

      const userVote = getUserVote(law.id);

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
    }).join('');
  }

  // Render the page
  function updateSearchInfo() {
    const infoEl = el.querySelector('#browse-search-info');
    if (!infoEl) return;
    if (currentFilters.q) {
      infoEl.innerHTML = `<p class="small" style="padding: 0 1rem;">Search results for: <strong>${escapeHtml(currentFilters.q)}</strong></p>`;
    } else {
      infoEl.innerHTML = '';
    }
  }

  function render() {
    el.innerHTML = templateHtml;
    updateSearchInfo();
  }

  // Update the display with fetched laws
  function updateDisplay() {
    const cardText = el.querySelector('.card-text');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        ${renderLaws(laws, currentFilters.q)}
        ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
      `;
    }
    updateSearchInfo();
  }

  // Load laws for current page
  async function loadPage(page) {
    currentPage = page;

    // Show loading state
    const cardText = el.querySelector('.card-text');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'true');
      cardText.innerHTML = wrapLoadingMarkup();

      // Disable pagination buttons during load
      el.querySelectorAll('.pagination button').forEach(btn => {
        btn.setAttribute('disabled', 'true');
      });
    }

    try {
      const offset = (page - 1) * LAWS_PER_PAGE;
      const data = await fetchLaws({
        limit: LAWS_PER_PAGE,
        offset,
        sort: 'score',
        order: 'desc',
        ...currentFilters
      });

      laws = data && Array.isArray(data.data) ? data.data : [];
      totalLaws = data && Number.isFinite(data.total) ? data.total : laws.length;
      updateDisplay();
    } catch {
      if (cardText) {
        cardText.setAttribute('aria-busy', 'false');
        cardText.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-outlined empty-state-icon">error_outline</span>
            <p class="empty-state-title">Failed to load laws</p>
            <p class="empty-state-text">There was an error loading the laws. Please try again later.</p>
          </div>
        `;
      }
    }
  }

  // Event delegation for navigation, voting, and pagination
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
      } catch {
        // Could add a notification here if needed
      }
      return;
    }

    // Handle page navigation
    if (t.dataset.page && !t.hasAttribute('disabled')) {
      const page = parseInt(t.dataset.page, 10);
      if (!isNaN(page) && page > 0) {
        loadPage(page);
      }
      return;
    }

    // Handle law card clicks
    const lawCard = t.closest('.law-card-mini');
    if (lawCard && lawCard.dataset.lawId) {
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }

    // Handle data-nav attributes
    if (t.dataset.nav) {
      onNavigate(t.dataset.nav);
    }
  });

  // Initial render and load
  render();

  // Create and insert advanced search component
  const searchComponent = AdvancedSearch({
    initialFilters: currentFilters,
    onSearch: (filters) => {
      currentFilters = filters;
      loadPage(1); // Reset to page 1 when filters change
    }
  });

  const searchContainer = el.querySelector('#advanced-search-container');
  if (searchContainer) {
    searchContainer.appendChild(searchComponent);
  }

  loadPage(1);

  return el;
}
