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
import { updateMetaDescription } from '../utils/dom.ts';
import type { CleanableElement, OnNavigate, SearchFilters, Law } from '../types/app.ts';

const BROWSE_TITLE = "Browse All Murphy's Laws | Murphy's Law Archive";
const BROWSE_DESCRIPTION =
  "Search and filter the complete collection of Murphy's Laws. Find corollaries, technology laws, and everyday observations about the perversity of the universe.";

function parseBrowseParams(search: string): { filters: SearchFilters; sort: string; order: string; page: number } {
  const params = new URLSearchParams(search);
  const q = params.get('q') ?? '';
  const categoryId = params.get('category_id');
  const attribution = params.get('attribution') ?? '';
  const sort = params.get('sort') ?? 'score';
  const order = params.get('order') ?? 'desc';
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const filters: SearchFilters = { q };
  if (categoryId) filters.category_id = /^\d+$/.test(categoryId) ? parseInt(categoryId, 10) : categoryId;
  if (attribution) filters.attribution = attribution;
  return { filters, sort, order, page };
}

function buildBrowseSearch(filters: SearchFilters, sort: string, order: string, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category_id !== undefined && filters.category_id !== '') params.set('category_id', String(filters.category_id));
  if (filters.attribution) params.set('attribution', filters.attribution);
  if (sort && sort !== 'score') params.set('sort', sort);
  if (order && order !== 'desc') params.set('order', order);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function Browse({ searchQuery, onNavigate }: { searchQuery?: string; onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page';

  const initial = parseBrowseParams(typeof location !== 'undefined' ? location.search : '');
  let currentPage = initial.page;
  let totalLaws = 0;
  let laws: Law[] = [];
  let currentFilters: SearchFilters = searchQuery !== undefined && searchQuery !== '' ? { ...initial.filters, q: searchQuery } : initial.filters;
  let currentSort = initial.sort;
  let currentOrder = initial.order;

  // Render law cards
  function renderLaws(laws: Law[], query?: string) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="searchOff" aria-hidden="true"></span>
          <p class="empty-state-title">Murphy spared these results</p>
          <p class="empty-state-text">Try adjusting your search filters or clearing them to see more results.</p>
          <button class="btn mt-4" data-nav="submit">
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
    document.title = BROWSE_TITLE;
    updateMetaDescription(BROWSE_DESCRIPTION);
    el.innerHTML = templateHtml;
    await updateSearchInfo(el.querySelector('#browse-search-info'), currentFilters);

    const breadcrumbContainer = el.querySelector('#browse-breadcrumb')!;
    const breadcrumb = Breadcrumb({
      items: [{ label: 'Browse All Murphy\'s Laws' }],
      onNavigate
    });
    if (breadcrumb) breadcrumbContainer.replaceChildren(breadcrumb);

    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) loadingPlaceholder.textContent = getRandomLoadingMessage();
  }

  async function updateDisplay() {
    const cardText = el.querySelector('#browse-laws-list')!;
    cardText.setAttribute('aria-busy', 'false');
    cardText.innerHTML = `
      ${renderLaws(laws, currentFilters.q)}
      ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
    `;
    hydrateIcons(cardText);
    initSharePopovers(cardText as HTMLElement);

    const resultCountEl = el.querySelector('#browse-result-count') as HTMLElement;
    if (totalLaws > 0) {
      const start = (currentPage - 1) * LAWS_PER_PAGE + 1;
      const end = Math.min(currentPage * LAWS_PER_PAGE, totalLaws);
      resultCountEl.textContent = `Showing ${start}-${end} of ${totalLaws} laws`;
      resultCountEl.style.display = '';
    } else {
      resultCountEl.textContent = '';
      resultCountEl.style.display = 'none';
    }

    await updateSearchInfo(el.querySelector('#browse-search-info'), currentFilters);
  }

  // Load laws for current page
  async function loadPage(page: number) {
    currentPage = page;

    const cardText = el.querySelector('#browse-laws-list')!;
    cardText.setAttribute('aria-busy', 'true');
    /* Disable pagination buttons before replacing content so they are still in DOM */
    el.querySelectorAll('.pagination button').forEach(btn => {
      btn.setAttribute('disabled', 'true');
    });
    cardText.innerHTML = renderLoadingHTML();

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

      if (laws.length > 0) triggerAdSense(cardText as HTMLElement);

      const search = buildBrowseSearch(currentFilters, currentSort, currentOrder, currentPage);
      if (typeof history !== 'undefined' && history.replaceState) {
        history.replaceState(history.state ?? {}, '', `${location.pathname}${search}`);
      }
    } catch {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="error" aria-hidden="true"></span>
          <p class="empty-state-title">Of course something went wrong</p>
          <p class="empty-state-text">Ironically, Murphy's Laws couldn't be loaded right now. Please try again.</p>
          <button type="button" class="btn" data-action="retry">
            <span class="icon" data-icon="refresh" aria-hidden="true"></span>
            <span class="btn-text">Try Again</span>
          </button>
        </div>
      `;
      hydrateIcons(cardText);
    }
  }

  // Event delegation for navigation, copy actions, pagination, and law card clicks
  // Note: Voting is handled by addVotingListeners() utility
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-action="retry"]')) {
      loadPage(currentPage);
      return;
    }

    // Handle copy text/link actions (shared utility) - sync guard, async clipboard
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

  // Keyboard navigation for law cards (WCAG 2.1.1) - shared utility
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

  const searchComponent = AdvancedSearch({
    initialFilters: currentFilters,
    onSearch: (filters) => {
      currentFilters = filters;
      updateWidgetsVisibility();
      currentPage = 1;
      loadPage(1);
    }
  });
  el.querySelector('#advanced-search-container')!.appendChild(searchComponent);

  const widgetsContainer = el.querySelector('[data-widgets]')!;
  widgetsContainer.appendChild(TopVoted());
  widgetsContainer.appendChild(Trending());
  widgetsContainer.appendChild(RecentlyAdded());

  updateWidgetsVisibility();

  const sortSelect = el.querySelector('#sort-select') as HTMLSelectElement;
  const sortValue = `${currentSort}-${currentOrder}`;
  if (sortSelect && sortValue) {
    const option = sortSelect.querySelector(`option[value="${sortValue}"]`);
    if (option) (option as HTMLOptionElement).selected = true;
  }
  sortSelect?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    const [sort, order] = value.split('-');
    currentSort = sort ?? '';
    currentOrder = order ?? '';
    currentPage = 1;
    loadPage(1);
  });

  loadPage(currentPage);

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup = () => {
    clearExportContent();
  };

  return el;
}
