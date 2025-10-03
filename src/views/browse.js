// Browse view - displays all laws with pagination and search

import { fetchLaws } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { highlightSearchTerm, escapeHtml } from '../utils/sanitize.js';
import { LAWS_PER_PAGE } from '../utils/constants.js';
import { createLoadingState, createErrorState } from '../utils/dom.js';

export function Browse({ _isLoggedIn, searchQuery, onNavigate, _onVote }) {
  const el = document.createElement('div');
  el.className = 'container page';

  let currentPage = 1;
  let totalLaws = 0;
  let laws = [];

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

    const prevDisabled = currentPage === 1 ? 'aria-disabled="true"' : '';
    const nextDisabled = currentPage === totalPages ? 'aria-disabled="true"' : '';

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
      return '<p class="small">No laws found.</p>';
    }

    return laws.map(law => {
      const up = Number.isFinite(law.up) ? law.up : 0;
      const down = Number.isFinite(law.down) ? law.down : 0;
      const attribution = firstAttributionLine(law);

      // Apply highlighting and escaping to title and text
      const title = law.title ? highlightSearchTerm(law.title, query) : '';
      const text = highlightSearchTerm(law.text, query);
      const titleText = title ? `<strong>${title}:</strong> ${text}` : text;

      return `
        <div class="law-card-mini" data-law-id="${escapeHtml(String(law.id))}">
          <p class="law-card-text">
            ${titleText}
          </p>
          ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
          <div class="law-card-footer">
            <span class="count-up" aria-label="upvotes">
              <span class="material-symbols-outlined icon-sm">thumb_up</span>
              <span class="count-num">${up}</span>
            </span>
            <span class="count-down" aria-label="downvotes">
              <span class="material-symbols-outlined icon-sm">thumb_down</span>
              <span class="count-num">${down}</span>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render the page
  function render() {
    const searchInfo = searchQuery
      ? `<p class="small" style="padding: 0 1rem;">Search results for: <strong>${escapeHtml(searchQuery)}</strong></p>`
      : '';

    el.innerHTML = `
      <div class="card">
        <div class="card-content">
          <h2 class="card-title"><span class="accent-text">Browse</span> All Laws</h2>
          ${searchInfo}
          <div class="card-text" role="region" aria-live="polite" aria-busy="true">
            <div style="padding: 1rem;">
              <p class="small">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Update the display with fetched laws
  function updateDisplay() {
    const cardText = el.querySelector('.card-text');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        ${renderLaws(laws, searchQuery)}
        ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
      `;
    }
  }

  // Load laws for current page
  async function loadPage(page) {
    currentPage = page;

    // Show loading state
    const cardText = el.querySelector('.card-text');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'true');
      cardText.innerHTML = '<div style="padding: 1rem;"><p class="small">Loading...</p></div>';

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
        q: searchQuery
      });

      laws = data && Array.isArray(data.data) ? data.data : [];
      totalLaws = data && Number.isFinite(data.total) ? data.total : laws.length;
      updateDisplay();
    } catch (err) {
      console.error('Failed to fetch laws:', err);
      if (cardText) {
        cardText.setAttribute('aria-busy', 'false');
        const errorEl = createErrorState('Failed to load laws. Please try again.');
        cardText.innerHTML = '';
        cardText.appendChild(errorEl);
      }
    }
  }

  // Event delegation for navigation and pagination
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

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
  loadPage(1);

  return el;
}
