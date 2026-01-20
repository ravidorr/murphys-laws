// Category Detail view - displays laws for a specific category

import templateHtml from '@views/templates/category-detail.html?raw';
import { fetchLaws } from '../utils/api.js';
import { wrapLoadingMarkup } from '../utils/dom.js';
import { getRandomLoadingMessage, LAWS_PER_PAGE } from '../utils/constants.js';
import { addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { renderPagination } from '../utils/pagination.js';
import { setJsonLd } from '@modules/structured-data.js';
import { SITE_URL } from '@utils/constants.js';
import { fetchCategories } from '../utils/api.js'; // To get category title for structured data
import { triggerAdSense } from '../utils/ads.js';

export function CategoryDetail({ categoryId, onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  let currentPage = 1;
  let totalLaws = 0;
  let laws = [];
  let categoryTitle = 'Category'; // Default title
  let _currentFilters = { category_id: categoryId };

  // Format the page title, avoiding double "Laws" (e.g., "Murphy's Laws's Laws")
  function formatPageTitle(title) {
    // If title already ends with "Laws", just use it as-is
    if (title.endsWith('Laws') || title.endsWith('laws')) {
      const words = title.split(' ');
      if (words.length > 1) {
        return `<span class="accent-text">${words[0]}</span> ${words.slice(1).join(' ')}`;
      }
      return `<span class="accent-text">${title}</span>`;
    }
    // Otherwise, add "'s Laws"
    return `<span class="accent-text">${title}'s</span> Laws`;
  }

  // Render law cards
  function renderLaws(laws) {
    if (!laws || laws.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="searchOff" aria-hidden="true"></span>
          <p class="empty-state-title">No laws found</p>
          <p class="empty-state-text">No laws have been submitted for this category yet.</p>
          <button class="btn" data-nav="submit" style="margin-top: 1rem;">
            <span class="btn-text">Submit a Murphy's Law</span>
            <span class="icon" data-icon="send" aria-hidden="true"></span>
          </button>
        </div>
      `;
    }

    return renderLawCards(laws);
  }

  // Render the page structure
  async function render() {
    el.innerHTML = templateHtml;

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
        ${renderLaws(laws)}
        ${renderPagination(currentPage, totalLaws, LAWS_PER_PAGE)}
      `;
      hydrateIcons(cardText);

      // Only trigger ads if we have laws with content
      if (laws.length > 0) {
        triggerAdSense(el);
      }
    }
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
      cardText.innerHTML = wrapLoadingMarkup();

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
        sort: 'score',
        order: 'desc'
      };

      const numericId = parseInt(categoryId, 10);
      if (!isNaN(numericId) && numericId > 0) {
        params.category_id = numericId;
      } else {
        params.category_slug = categoryId;
      }

      const data = await fetchLaws(params);

      laws = data && Array.isArray(data.data) ? data.data : [];
      totalLaws = data && Number.isFinite(data.total) ? data.total : laws.length;
      await updateDisplay();
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
        categoryTitle = category.title;
        const titleEl = el.querySelector('#category-detail-title');
        if (titleEl) {
          titleEl.innerHTML = formatPageTitle(categoryTitle);
        }
      }
    } catch (error) {
      console.error('Failed to fetch category details:', error);
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
          'item': `${SITE_URL}/#/categories`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': `${categoryTitle} Laws`,
          'item': `${SITE_URL}/#/category:${categoryId}`
        }
      ]
    });

    // CollectionPage Schema for Category Detail page
    setJsonLd('category-detail-page', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${categoryTitle} Laws - Murphy's Law Archive`,
      'url': `${SITE_URL}/#/category:${categoryId}`,
      'description': `Browse all Murphy's Laws related to ${categoryTitle}.`,
      'image': `${SITE_URL}/social/home.png`, // Placeholder, could be category specific
    });
  }


  // Event delegation for navigation and pagination
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

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
      onNavigate('law', lawCard.dataset.lawId);
      return;
    }
  });

  // Initial render and load
  render();
  fetchCategoryDetails().then(() => {
    loadPage(1); // Load laws after category details are fetched
  });

  // Add voting listeners using shared utility
  addVotingListeners(el);

  return el;
}
