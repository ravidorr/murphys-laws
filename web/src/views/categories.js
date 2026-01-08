// Categories view - displays a list of all categories

import templateHtml from '@views/templates/categories.html?raw';
import { fetchCategories } from '../utils/api.js';
import { wrapLoadingMarkup } from '../utils/dom.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { hydrateIcons } from '@utils/icons.js';
import { setJsonLd } from '@modules/structured-data.js';
import { SITE_URL } from '@utils/constants.js';

export function Categories({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  let categories = [];

  // Render categories
  function renderCategoryCards(cats) {
    if (!cats || cats.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="category" aria-hidden="true"></span>
          <p class="empty-state-title">No categories found</p>
          <p class="empty-state-text">It seems Murphy hasn't created any categories yet.</p>
        </div>
      `;
    }

    return `
      <div class="category-grid">
        ${cats.map(category => `
          <div class="category-card" data-category-id="${category.id}">
            <h2 class="category-title">${category.title}</h2>
            ${category.description ? `<p class="category-description">${category.description}</p>` : ''}
            <p class="category-count">${category.law_count} laws</p>
            <button class="btn btn-small" data-nav="category:${category.slug || category.id}">View Laws</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render the page
  async function render() {
    el.innerHTML = templateHtml;

    // Replace static loading message with random one
    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) {
      loadingPlaceholder.textContent = getRandomLoadingMessage();
    }
  }

  // Update the display with fetched categories
  async function updateDisplay() {
    const categoriesList = el.querySelector('#categories-list');
    if (categoriesList) {
      categoriesList.setAttribute('aria-busy', 'false');
      categoriesList.innerHTML = renderCategoryCards(categories);
      hydrateIcons(categoriesList);

      // Set structured data for categories page
      setJsonLd('categories-page', {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': 'Browse Murphy\'s Law Categories',
        'url': `${SITE_URL}/#/categories`,
        'description': 'Explore various categories of Murphy\'s Laws.',
        'hasPart': categories.map(category => ({
          '@type': 'CollectionPage',
          'name': category.title,
          'url': `${SITE_URL}/#/category:${category.id}`,
          'description': category.description || `Laws related to ${category.title}`,
        }))
      });
    }
  }

  // Load categories
  async function loadCategories() {
    const categoriesList = el.querySelector('#categories-list');
    if (categoriesList) {
      categoriesList.setAttribute('aria-busy', 'true');
      categoriesList.innerHTML = wrapLoadingMarkup();
    }

    try {
      const data = await fetchCategories();
      categories = data && Array.isArray(data.data) ? data.data : [];
      await updateDisplay();
    } catch {
      if (categoriesList) {
        categoriesList.setAttribute('aria-busy', 'false');
        categoriesList.innerHTML = `
          <div class="empty-state">
            <span class="icon empty-state-icon" data-icon="error" aria-hidden="true"></span>
            <p class="empty-state-title">Failed to load categories</p>
            <p class="empty-state-text">Murphy seems to be hiding the categories. Please try again.</p>
          </div>
        `;
        hydrateIcons(categoriesList);
      }
    }
  }

  // Event delegation for navigation
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        // Extract category ID if present (e.g., "category:123")
        if (navTarget.startsWith('category:')) {
          const categoryId = navTarget.split(':')[1];
          onNavigate('category', categoryId);
        } else {
          onNavigate(navTarget);
        }
        return;
      }
    }
  });

  // Initial render and load
  render();
  loadCategories();

  return el;
}
