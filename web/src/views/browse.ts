// Browse view - displays all laws with pagination and search
// Refactored to use shared law card renderer

import templateHtml from '@views/templates/browse.html?raw';
import { fetchLaws } from '../utils/api.ts';
import { renderLoadingHTML } from '../components/loading.ts';
import { getRandomLoadingMessage, LAWS_PER_PAGE } from '../utils/constants.ts';
import { addVotingListeners } from '../utils/voting.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { renderLawCards } from '../utils/law-card-renderer.ts';
import { initSharePopovers } from '../components/social-share.ts';
import { renderPagination } from '../utils/pagination.ts';
import { updateSearchInfo, hasActiveFilters } from '../utils/search-info.ts';
import { AdvancedSearch } from '../components/advanced-search.ts';
import { TopVoted } from '../components/top-voted.ts';
import { Trending } from '../components/trending.ts';
import { RecentlyAdded } from '../components/recently-added.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { Breadcrumb } from '../components/breadcrumb.ts';
import { handleCopyAction } from '../utils/copy-actions.ts';
import { handleNavClick, addNavigationListener } from '../utils/navigation.ts';
import type { CleanableElement, OnNavigate, SearchFilters, Law } from '../types/app.ts';

export function Browse({ searchQuery, onNavigate }: { searchQuery?: string; onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page';

  let currentPage = 1;
  let totalLaws = 0;
  let laws: Law[] = [];
  let currentFilters: SearchFilters = { q: searchQuery || '' };
  let currentSort = 'score';
  let currentOrder = 'desc';

  // Render law cards
  function renderLaws(laws: Law[], query?: string) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="searchOff" aria-hidden="true"></span>
          <p class="empty-state-title">Murphy spared these results</p>
          <p class="empty-state-text">Try adjusting your search filters or clearing them to see more results.</p>
          <button class="btn" data-nav="submit" style="margin-top: 1rem;">
            <span class="btn-text">Submit a Law</span>
            <span class="icon" data-icon="send" aria-hidden="true"></span>
          </button>
        </div>
      `;
    }

    // Use shared law card renderer with search highlighting (eliminates ~30 lines of duplicate HTML)
    return renderLawCards(laws, { searchQuery: query });
  }

  // Render the page
  async function render() {
    el.innerHTML = templateHtml;
    await updateSearchInfo(el.querySelector('#browse-search-info'), currentFilters);

    // Render breadcrumb navigation
    const breadcrumbContainer = el.querySelector('#browse-breadcrumb');
    if (breadcrumbContainer) {
      const breadcrumb = Breadcrumb({
        items: [
          { label: 'Browse All Murphy\'s Laws' }
        ],
        onNavigate
      });
      if (breadcrumb) breadcrumbContainer.replaceChildren(breadcrumb);
    }

    // Replace static loading message with random one
    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) {
      loadingPlaceholder.textContent = getRandomLoadingMessage();
    }
  }

  // Update the display with fetched laws
  async function updateDisplay() {
    const cardText = el.querySelector('#browse-laws-list');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        ${renderLaws(laws, currentFilters.q)}
        ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
      `;
      hydrateIcons(cardText);
      initSharePopovers(cardText as HTMLElement);
    }
    
    // Update result count
    const resultCountEl = el.querySelector('#browse-result-count') as HTMLElement | null;
    if (resultCountEl) {
      if (totalLaws > 0) {
        const start = (currentPage - 1) * LAWS_PER_PAGE + 1;
        const end = Math.min(currentPage * LAWS_PER_PAGE, totalLaws);
        resultCountEl.textContent = `Showing ${start}-${end} of ${totalLaws} laws`;
        resultCountEl.style.display = '';
      } else {
        resultCountEl.textContent = '';
        resultCountEl.style.display = 'none';
      }
    }
    
    await updateSearchInfo(el.querySelector('#browse-search-info'), currentFilters);
  }

  // Load laws for current page
  async function loadPage(page: number) {
    currentPage = page;

    // Show loading state
    const cardText = el.querySelector('#browse-laws-list');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'true');
      cardText.innerHTML = renderLoadingHTML();

      // Disable pagination buttons during load
      /* v8 ignore next 3 - forEach callback coverage varies by v8 version */
      el.querySelectorAll('.pagination button').forEach(btn => {
        btn.setAttribute('disabled', 'true');
      });
    }

    try {
      const offset = (page - 1) * LAWS_PER_PAGE;
      const data = await fetchLaws({
        limit: LAWS_PER_PAGE,
        offset,
        sort: currentSort,
        order: currentOrder,
        ...currentFilters
      });

      laws = data && Array.isArray(data.data) ? data.data : [];
      totalLaws = data && Number.isFinite(data.total) ? data.total : laws.length;
      await updateDisplay();

      // Register export content
      if (laws.length > 0) {
        setExportContent({
          type: ContentType.LAWS,
          title: hasActiveFilters(currentFilters) ? 'Search Results' : 'All Laws',
          data: laws,
          metadata: { total: totalLaws, filters: currentFilters, page: currentPage }
        });
      } else {
        clearExportContent();
      }

      // Only trigger ads if we actually have content - validate before triggering
      if (laws.length > 0 && cardText) {
        triggerAdSense(cardText as HTMLElement);
      }
    } catch {
      if (cardText) {
        cardText.setAttribute('aria-busy', 'false');
        cardText.innerHTML = `
          <div class="empty-state">
            <span class="icon empty-state-icon" data-icon="error" aria-hidden="true"></span>
            <p class="empty-state-title">Of course something went wrong</p>
            <p class="empty-state-text">Ironically, Murphy's Laws couldn't be loaded right now. Please try again.</p>
          </div>
        `;
        hydrateIcons(cardText);
      }
    }
  }

  // Event delegation for navigation, copy actions, pagination, and law card clicks
  // Note: Voting is handled by addVotingListeners() utility
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    // Handle copy text/link actions (shared utility) — sync guard, async clipboard
    if (t.closest('[data-action="copy-text"]') || t.closest('[data-action="copy-link"]')) {
      void handleCopyAction(e, t);
      return;
    }

    // Handle navigation buttons (shared utility)
    if (handleNavClick(t, onNavigate)) return;

    // Handle page navigation
    const pageAttr = t.getAttribute('data-page');
    if (pageAttr && !t.hasAttribute('disabled')) {
      const page = parseInt(pageAttr, 10);
      if (!isNaN(page) && page > 0) {
        loadPage(page);
      }
      return;
    }

    // Handle law card clicks
    const lawCard = t.closest('.law-card-mini') as HTMLElement | null;
    if (lawCard && lawCard.dataset.lawId) {
      // Don't navigate if clicking on interactive elements (buttons for voting, favorites, share)
      if (t.closest('button')) return;
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }
  });

  // Keyboard navigation for law cards (WCAG 2.1.1) — shared utility
  addNavigationListener(el, onNavigate);

  // Initial render and load
  render();

  // Add voting listeners using shared utility (replaces 35 lines of duplicate code)
  addVotingListeners(el);

  // Function to update widgets visibility based on search state
  function updateWidgetsVisibility() {
    const widgetsContainer = el.querySelector('[data-widgets]');
    if (widgetsContainer) {
      if (hasActiveFilters(currentFilters)) {
        widgetsContainer.setAttribute('hidden', '');
      } else {
        widgetsContainer.removeAttribute('hidden');
      }
    }
  }

  // Create and insert advanced search component
  const searchComponent = AdvancedSearch({
    initialFilters: currentFilters,
    onSearch: (filters) => {
      currentFilters = filters;
      updateWidgetsVisibility(); // Update widget visibility when search changes
      loadPage(1); // Reset to page 1 when filters change
    }
  });

  const searchContainer = el.querySelector('#advanced-search-container');
  if (searchContainer) {
    searchContainer.appendChild(searchComponent);
  }

  // Add widgets after search
  const widgetsContainer = el.querySelector('[data-widgets]');
  if (widgetsContainer) {
    const topVotedWidget = TopVoted();
    const trendingWidget = Trending();
    const recentlyAddedWidget = RecentlyAdded();

    widgetsContainer.appendChild(topVotedWidget);
    widgetsContainer.appendChild(trendingWidget);
    widgetsContainer.appendChild(recentlyAddedWidget);
  }

  // Set initial widget visibility
  updateWidgetsVisibility();

  // Add sort select handler
  const sortSelect = el.querySelector('#sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const [sort, order] = value.split('-');
      currentSort = sort ?? '';
      currentOrder = order ?? '';
      loadPage(1); // Reset to page 1 when sort changes
    });
  }

  loadPage(1);

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup = () => {
    clearExportContent();
  };

  return el;
}
