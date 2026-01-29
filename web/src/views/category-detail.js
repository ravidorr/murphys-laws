// Category Detail view - displays laws for a specific category

import * as Sentry from '@sentry/browser';
import templateHtml from '@views/templates/category-detail.html?raw';
import { fetchLaws } from '../utils/api.js';
import { renderLoadingHTML } from '../components/loading.js';
import { getRandomLoadingMessage, LAWS_PER_PAGE } from '../utils/constants.js';
import { addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { initSharePopovers } from '../components/social-share.js';
import { renderPagination } from '../utils/pagination.js';
import { setJsonLd, setCategoryItemListSchema } from '@modules/structured-data.js';
import { SITE_URL, SITE_NAME } from '@utils/constants.js';
import { fetchCategories } from '../utils/api.js'; // To get category title for structured data
import { triggerAdSense } from '../utils/ads.js';
import { showSuccess } from '../components/notification.js';
import { stripMarkdownFootnotes } from '../utils/sanitize.js';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.js';
import { updateMetaDescription } from '@utils/dom.js';
import { Breadcrumb } from '../components/breadcrumb.js';
import { AdvancedSearch } from '../components/advanced-search.js';
import { updateSearchInfo } from '../utils/search-info.js';

export function CategoryDetail({ categoryId, onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  let currentPage = 1;
  let totalLaws = 0;
  let laws = [];
  let categoryTitle = 'Category'; // Default title
  let categoryDescription = ''; // Category description
  let currentFilters = { category_id: categoryId };
  let currentSort = 'score';
  let currentOrder = 'desc';
  let categoryNumericId = null; // Will be set after fetching category details

  // Format the page title, avoiding double "Laws" (e.g., "Murphy's Laws's Laws")
  // Always wraps only the first word (typically "Murphy's") in accent color
  function formatPageTitle(title) {
    const endsWithLaws = title.endsWith('Laws') || title.endsWith('laws');
    const words = title.split(' ');
    
    // Wrap only the first word in accent (typically "Murphy's")
    const accentPart = `<span class="accent-text">${words[0]}</span>`;
    const restPart = words.slice(1).join(' ');
    
    if (words.length === 1) {
      // Single word title
      /* v8 ignore next - Single word category title fallback */
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
  function renderLaws(laws, query) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="searchOff" aria-hidden="true"></span>
          <p class="empty-state-title">No laws found</p>
          <p class="empty-state-text">No laws have been submitted for this category yet. Try adjusting your search filters.</p>
          <button class="btn" data-nav="submit" style="margin-top: 1rem;">
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

    const titleEl = el.querySelector('#category-detail-title');
    if (titleEl) {
      titleEl.innerHTML = formatPageTitle(categoryTitle);
    }

    // Replace static loading message with random one
    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) {
      loadingPlaceholder.textContent = getRandomLoadingMessage();
    }
  }

  // Update the display with fetched laws
  async function updateDisplay() {
    const cardText = el.querySelector('#category-laws-list');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'false');
      cardText.innerHTML = `
        ${renderLaws(laws, currentFilters.q)}
        ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
      `;
      hydrateIcons(cardText);
      initSharePopovers(cardText);

      // Only trigger ads if we have laws with content
      if (laws.length > 0) {
        triggerAdSense(el);
      }
    }
    
    // Update result count
    const resultCountEl = el.querySelector('#category-result-count');
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
    
    await updateSearchInfo(el.querySelector('#category-search-info'), currentFilters);
    // Update breadcrumbs and structured data after category title is loaded
    updateStructuredData();
  }

  // Load laws for current page
  async function loadPage(page) {
    currentPage = page;

    // Show loading state
    const cardText = el.querySelector('#category-laws-list');
    if (cardText) {
      cardText.setAttribute('aria-busy', 'true');
      cardText.innerHTML = renderLoadingHTML();

      // Disable pagination buttons during load
      el.querySelectorAll('.pagination button').forEach(btn => {
        btn.setAttribute('disabled', 'true');
      });
    }

    try {
      const offset = (page - 1) * LAWS_PER_PAGE;
      const params = {
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
    } catch {
      if (cardText) {
        cardText.setAttribute('aria-busy', 'false');
        cardText.innerHTML = `
          <div class="empty-state">
            <span class="icon empty-state-icon" data-icon="error" aria-hidden="true"></span>
            <p class="empty-state-title">Of course something went wrong</p>
            <p class="empty-state-text">Ironically, Murphy's Laws for this category couldn't be loaded right now. Please try again.</p>
          </div>
        `;
        hydrateIcons(cardText);
      }
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
        categoryTitle = stripMarkdownFootnotes(category.title);
        categoryDescription = category.description || '';
        categoryNumericId = category.id; // Store the numeric ID for API calls
        
        // Update filters with the numeric ID
        currentFilters.category_id = category.id;
        
        const titleEl = el.querySelector('#category-detail-title');
        if (titleEl) {
          titleEl.innerHTML = formatPageTitle(categoryTitle);
        }
        // Update description element
        const descEl = el.querySelector('#category-description');
        if (descEl) {
          descEl.textContent = categoryDescription || 'All laws within this category.';
        }
        // Update browser page title and meta description
        document.title = `${categoryTitle} | ${SITE_NAME}`;
        updateMetaDescription(categoryDescription || `Browse all Murphy's Laws related to ${categoryTitle}. Discover witty observations and corollaries in this category.`);
        
        // Render breadcrumb navigation
        const breadcrumbContainer = el.querySelector('#category-breadcrumb');
        if (breadcrumbContainer) {
          const breadcrumb = Breadcrumb({
            items: [
              { label: 'Categories', nav: 'categories', href: '/categories' },
              { label: categoryTitle }
            ],
            onNavigate
          });
          breadcrumbContainer.replaceChildren(breadcrumb);
        }
        
        // Create and insert advanced search component with category pre-selected
        const searchComponent = AdvancedSearch({
          initialFilters: { category_id: category.id },
          onSearch: (filters) => {
            // Always keep the category_id in filters for this page
            currentFilters = { ...filters, category_id: category.id };
            loadPage(1); // Reset to page 1 when filters change
          }
        });

        const searchContainer = el.querySelector('#advanced-search-container');
        if (searchContainer) {
          searchContainer.appendChild(searchComponent);
        }
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


  // Event delegation for navigation and pagination
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    // Handle copy text action
    const copyTextBtn = t.closest('[data-action="copy-text"]');
    if (copyTextBtn) {
      e.stopPropagation();
      const textToCopy = copyTextBtn.getAttribute('data-copy-value') || '';
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          showSuccess('Law text copied to clipboard!');
        } catch {
          // Fallback
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

    // Handle copy link action
    const copyLinkBtn = t.closest('[data-action="copy-link"]');
    if (copyLinkBtn) {
      e.stopPropagation();
      const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || '';
      if (linkToCopy) {
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
      }
      return;
    }

    // Handle navigation buttons (data-nav)
    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
        return;
      }
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
      // Don't navigate if clicking on interactive elements (buttons for voting, favorites, share)
      if (t.closest('button')) return;
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }
  });

  // Keyboard navigation for law cards (WCAG 2.1.1)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const t = e.target;
    if (!(t instanceof Element)) return;

    // Handle law card keyboard activation
    const lawCard = t.closest('.law-card-mini');
    if (lawCard && lawCard.dataset.lawId) {
      e.preventDefault();
      onNavigate('law', lawCard.dataset.lawId);
    }
  });

  // Initial render and load
  render();
  fetchCategoryDetails().then(() => {
    loadPage(1); // Load laws after category details are fetched
  });

  // Add voting listeners using shared utility
  addVotingListeners(el);

  // Add sort select handler
  const sortSelect = el.querySelector('#sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      const [sort, order] = value.split('-');
      currentSort = sort;
      currentOrder = order;
      loadPage(1); // Reset to page 1 when sort changes
    });
  }

  // Cleanup function to clear export content on unmount
  el.cleanup = () => {
    clearExportContent();
  };

  return el;
}
