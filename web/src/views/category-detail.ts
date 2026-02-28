// Category Detail view - displays laws for a specific category

import * as Sentry from '@sentry/browser';
import templateHtml from '@views/templates/category-detail.html?raw';
import { fetchLaws } from '../utils/api.ts';
import { renderLoadingHTML } from '../components/loading.ts';
import { getRandomLoadingMessage, LAWS_PER_PAGE } from '../utils/constants.ts';
import { addVotingListeners } from '../utils/voting.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { renderLawCards } from '../utils/law-card-renderer.ts';
import { initSharePopovers } from '../components/social-share.ts';
import { renderPagination } from '../utils/pagination.ts';
import { setJsonLd, setCategoryItemListSchema } from '@modules/structured-data.ts';
import { SITE_URL, SITE_NAME, getCategoryDisplayName } from '@utils/constants.ts';
import { fetchCategories } from '../utils/api.ts'; // To get category title for structured data
import { triggerAdSense } from '../utils/ads.ts';
import { stripMarkdownFootnotes } from '../utils/sanitize.ts';
import { handleCopyAction } from '../utils/copy-actions.ts';
import { handleNavClick, addNavigationListener } from '../utils/navigation.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import { Breadcrumb } from '../components/breadcrumb.ts';
import { AdvancedSearch } from '../components/advanced-search.ts';
import { updateSearchInfo } from '../utils/search-info.ts';
import type { CleanableElement, OnNavigate, SearchFilters, Law } from '../types/app.ts';

function parseCategoryParams(search: string): { page: number; sort: string; order: string } {
  const params = new URLSearchParams(search);
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const sort = params.get('sort') ?? 'score';
  const order = params.get('order') ?? 'desc';
  return { page, sort, order };
}

function buildCategorySearch(page: number, sort: string, order: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (sort && sort !== 'score') params.set('sort', sort);
  if (order && order !== 'desc') params.set('order', order);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function CategoryDetail({ categoryId, onNavigate }: { categoryId: string; onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('aria-live', 'polite');

  const initialParams = typeof location !== 'undefined' ? parseCategoryParams(location.search) : { page: 1, sort: 'score', order: 'desc' };
  let currentPage = initialParams.page;
  let totalLaws = 0;
  let laws: Law[] = [];
  let categoryTitle = 'Category'; // Default title
  let categoryDescription = ''; // Category description
  let currentFilters: SearchFilters = { category_id: categoryId };
  let currentSort = initialParams.sort;
  let currentOrder = initialParams.order;
  let categoryNumericId: number | null = null; // Will be set after fetching category details

  // Format the page title, avoiding double "Laws" (e.g., "Murphy's Laws's Laws")
  // Always wraps only the first word (typically "Murphy's") in accent color
  function formatPageTitle(title: string) {
    const endsWithLaws = title.endsWith('Laws') || title.endsWith('laws');
    const words = title.split(' ');
    
    // Wrap only the first word in accent (typically "Murphy's")
    const accentPart = `<span class="accent-text">${words[0]}</span>`;
    const restPart = words.slice(1).join(' ');
    
    if (words.length === 1) {
      // Single word title
      return endsWithLaws ? accentPart : `${accentPart}'s Laws`;
    }
    
    if (endsWithLaws) {
      // Title already ends with "Laws", use as-is
      return `${accentPart} ${restPart}`;
    }
    
    // Add "'s Laws" to the end
    return `${accentPart} ${restPart}'s Laws`;
  }

  // Render law cards
  function renderLaws(laws: Law[], query?: string) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="searchOff" aria-hidden="true"></span>
          <p class="empty-state-title">No laws found</p>
          <p class="empty-state-text">No laws have been submitted for this category yet. Try adjusting your search filters.</p>
          <button class="btn mt-4" data-nav="submit">
            <span class="btn-text">Submit a Murphy's Law</span>
            <span class="icon" data-icon="send" aria-hidden="true"></span>
          </button>
        </div>
      `;
    }

    // Use shared law card renderer with search highlighting
    return renderLawCards(laws, { searchQuery: query });
  }

  // Render the page structure
  async function render() {
    el.innerHTML = templateHtml;
    await updateSearchInfo(el.querySelector('#category-search-info'), currentFilters);

    el.querySelector('#category-detail-title')!.innerHTML = formatPageTitle(categoryTitle);

    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) loadingPlaceholder.textContent = getRandomLoadingMessage();
  }

  async function updateDisplay() {
    const cardText = el.querySelector('#category-laws-list')!;
    cardText.setAttribute('aria-busy', 'false');
    cardText.innerHTML = `
      ${renderLaws(laws, currentFilters.q)}
      ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
    `;
    hydrateIcons(cardText);
    initSharePopovers(cardText as HTMLElement);

    if (laws.length > 0) triggerAdSense(el);

    const resultCountEl = el.querySelector('#category-result-count') as HTMLElement;
    if (totalLaws > 0) {
      const start = (currentPage - 1) * LAWS_PER_PAGE + 1;
      const end = Math.min(currentPage * LAWS_PER_PAGE, totalLaws);
      resultCountEl.textContent = `Showing ${start}-${end} of ${totalLaws} laws`;
      resultCountEl.style.display = '';
    } else {
      resultCountEl.textContent = '';
      resultCountEl.style.display = 'none';
    }

    await updateSearchInfo(el.querySelector('#category-search-info'), currentFilters);
    // Update breadcrumbs and structured data after category title is loaded
    updateStructuredData();
  }

  // Load laws for current page
  async function loadPage(page: number) {
    currentPage = page;

    const cardText = el.querySelector('#category-laws-list')!;
    cardText.setAttribute('aria-busy', 'true');
    cardText.innerHTML = renderLoadingHTML();
    el.querySelectorAll('.pagination button').forEach(btn => {
      btn.setAttribute('disabled', 'true');
    });

    try {
      const offset = (page - 1) * LAWS_PER_PAGE;
      const params: Record<string, string | number> = {
        limit: LAWS_PER_PAGE,
        offset,
        sort: currentSort,
        order: currentOrder,
        ...currentFilters
      };

      // If we have the numeric ID, use it; otherwise use slug
      if (categoryNumericId) {
        params.category_id = categoryNumericId;
      } else {
        const numericId = parseInt(categoryId, 10);
        if (!isNaN(numericId) && numericId > 0) {
          params.category_id = numericId;
        } else {
          params.category_slug = categoryId;
        }
      }

      const data = await fetchLaws(params);

      laws = data && Array.isArray(data.data) ? data.data : [];
      totalLaws = data && Number.isFinite(data.total) ? data.total : laws.length;
      await updateDisplay();

      // Register export content for this category
      if (laws.length > 0) {
        setExportContent({
          type: ContentType.LAWS,
          title: categoryTitle,
          data: laws,
          metadata: { total: totalLaws, categoryId, page: currentPage }
        });
      } else {
        clearExportContent();
      }

      if (typeof history !== 'undefined' && history.replaceState) {
        const search = buildCategorySearch(currentPage, currentSort, currentOrder);
        history.replaceState(history.state ?? {}, '', `${location.pathname}${search}`);
      }
    } catch {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="error" aria-hidden="true"></span>
          <p class="empty-state-title">Of course something went wrong</p>
          <p class="empty-state-text">Ironically, Murphy's Laws for this category couldn't be loaded right now. Please try again.</p>
          <button type="button" class="btn" data-action="retry">
            <span class="icon" data-icon="refresh" aria-hidden="true"></span>
            <span class="btn-text">Try Again</span>
          </button>
        </div>
      `;
      hydrateIcons(cardText);
    }
  }

  // Fetch category details to get title for display and structured data
  async function fetchCategoryDetails() {
    try {
      const data = await fetchCategories();
      let category;
      const numericId = parseInt(categoryId, 10);
      
      if (!isNaN(numericId) && numericId > 0) {
        category = data.data.find(cat => String(cat.id) === String(categoryId));
      } else {
        category = data.data.find(cat => cat.slug === categoryId);
      }

      if (category) {
        categoryTitle = getCategoryDisplayName(category.slug, stripMarkdownFootnotes(category.title));
        categoryDescription = category.description || '';
        categoryNumericId = category.id;

        currentFilters.category_id = category.id;

        el.querySelector('#category-detail-title')!.innerHTML = formatPageTitle(categoryTitle);
        const descEl = el.querySelector('#category-description')!;
        descEl.textContent = categoryDescription || 'All laws within this category.';

        document.title = `${categoryTitle} | ${SITE_NAME}`;
        updateMetaDescription(categoryDescription || `Browse all Murphy's Laws related to ${categoryTitle}. Discover witty observations and corollaries in this category.`);

        const breadcrumbContainer = el.querySelector('#category-breadcrumb')!;
        const breadcrumb = Breadcrumb({
          items: [
            { label: 'Categories', nav: 'categories', href: '/categories' },
            { label: categoryTitle }
          ],
          onNavigate
        });
        if (breadcrumb) breadcrumbContainer.replaceChildren(breadcrumb);

        const searchComponent = AdvancedSearch({
          initialFilters: { category_id: category.id },
          onSearch: (filters) => {
            currentFilters = { ...filters, category_id: category.id };
            loadPage(1);
          }
        });
        el.querySelector('#advanced-search-container')!.appendChild(searchComponent);
      }
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  function updateStructuredData() {
    // BreadcrumbList Schema for Category Detail page
    setJsonLd('category-detail-breadcrumbs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': SITE_URL
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Categories',
          'item': `${SITE_URL}/categories`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': `${categoryTitle} Laws`,
          'item': `${SITE_URL}/category/${categoryId}`
        }
      ]
    });

    // CollectionPage Schema for Category Detail page
    setJsonLd('category-detail-page', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${categoryTitle} Laws - Murphy's Law Archive`,
      'url': `${SITE_URL}/category/${categoryId}`,
      'description': categoryDescription || `Browse all Murphy's Laws related to ${categoryTitle}.`,
      'image': `${SITE_URL}/social/home.png`, // Placeholder, could be category specific
    });
    
    // ItemList Schema for SEO - lists laws in this category
    if (laws && laws.length > 0) {
      setCategoryItemListSchema({
        categoryTitle,
        categorySlug: categoryId,
        laws
      });
    }
  }


  // Event delegation for navigation, copy actions, pagination, and law card clicks
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.closest('[data-action="retry"]')) {
      loadPage(currentPage);
      return;
    }

    // Handle copy text/link actions (shared utility) - sync guard, async clipboard
    if (t.closest('[data-action="copy-text"]') || t.closest('[data-action="copy-link"]')) {
      void handleCopyAction(e, t);
      return;
    }

    // Handle navigation buttons and links (shared utility)
    if (handleNavClick(t, onNavigate)) {
      e.preventDefault();
      return;
    }

    // Handle page navigation (use closest so clicks on button inner span/icon still work)
    const pageBtn = t.closest('button[data-page]');
    if (pageBtn && !pageBtn.hasAttribute('disabled')) {
      const pageAttr = pageBtn.getAttribute('data-page');
      if (pageAttr) {
        const page = parseInt(pageAttr, 10);
        if (!isNaN(page) && page > 0) {
          loadPage(page);
        }
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
  fetchCategoryDetails().then(() => {
    loadPage(currentPage); // Load laws after category details are fetched (page from URL)
  });

  // Add voting listeners using shared utility
  addVotingListeners(el);

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

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup = () => {
    clearExportContent();
  };

  return el;
}
