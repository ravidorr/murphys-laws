// Categories view - displays all categories with descriptions

import * as Sentry from '@sentry/browser';
import templateHtml from '@views/templates/categories.html?raw';
import { fetchCategories } from '../utils/api.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { getRandomLoadingMessage, getCategoryDisplayName } from '../utils/constants.ts';
import { escapeHtml, stripMarkdownFootnotes } from '../utils/sanitize.ts';
import { groupCategories } from '@utils/category-groups.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updatePageMetadata } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate, Category } from '../types/app.d.ts';

export function Categories({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('aria-live', 'polite');

  let categories: Category[] = [];
  let categoryQuery = '';
  const featuredSlugs = new Set([
    'murphys-technology-laws',
    'murphys-office-laws',
    'murphys-travel-laws',
    'murphys-love-laws',
    'murphys-computers-laws'
  ]);

  // Render a single category card
  function renderCategoryCard(category: Category) {
    const title = getCategoryDisplayName(category.slug, stripMarkdownFootnotes(category.title));
    const rawDescription = category.description || 'Explore laws in this category.';
    const description = rawDescription.length > 150 ? `${rawDescription.slice(0, 147).trimEnd()}…` : rawDescription;
    const lawCount = category.law_count || 0;
    const lawText = lawCount === 1 ? 'law' : 'laws';

    return `
      <a href="/category/${escapeHtml(category.slug)}" class="card card--category category-card category-card--rich" data-category-slug="${escapeHtml(category.slug)}" aria-label="${escapeHtml(title)} - ${lawCount} ${lawText}">
        <h3 class="category-card-title">${escapeHtml(title)}</h3>
        <p class="category-card-description">${escapeHtml(description)}</p>
        <div class="category-card-footer">
          <span class="category-card-count">
            <span class="icon" data-icon="list" aria-hidden="true"></span>
            ${lawCount} ${lawText}
          </span>
          <span class="category-card-arrow">
            <span class="icon" data-icon="arrowRight" aria-hidden="true"></span>
          </span>
        </div>
      </a>
    `;
  }

  // Render all category cards
  function renderCategories(categories: Category[]) {
    if (!categories || categories.length === 0) {
      return `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="folder" aria-hidden="true"></span>
          <p class="empty-state-title">No categories found</p>
          <p class="empty-state-text">Categories are being loaded. Please try again later.</p>
        </div>
      `;
    }

    return groupCategories(categories)
      .map((group) => `
        <section class="category-cluster" data-category-cluster="${group.name}">
          <header class="category-cluster-header">
            <h2 class="category-cluster-title">${escapeHtml(group.name)}</h2>
            <p class="category-cluster-description">${escapeHtml(group.description)}</p>
          </header>
          <div class="categories-grid">
            ${group.categories.map(renderCategoryCard).join('')}
          </div>
        </section>
      `)
      .join('');
  }

  // Render the page structure
  async function render() {
    el.innerHTML = templateHtml;

    const loadingPlaceholder = el.querySelector('.loading-placeholder p')!;
    loadingPlaceholder.textContent = getRandomLoadingMessage();
  }

  function updateDisplay() {
    const normalizedQuery = categoryQuery.trim().toLowerCase();
    const visibleCategories = normalizedQuery
      ? categories.filter((category) => `${category.title} ${category.description || ''}`.toLowerCase().includes(normalizedQuery))
      : categories;
    const grid = el.querySelector('#categories-grid')!;
    grid.classList.remove('loading-placeholder');
    grid.removeAttribute('role');
    grid.removeAttribute('aria-label');
    grid.innerHTML = renderCategories(visibleCategories);
    hydrateIcons(grid);

    const status = el.querySelector('#category-filter-status');
    if (status) status.textContent = normalizedQuery ? `${visibleCategories.length} categories found` : `${categories.length} categories`;

    const featured = el.querySelector('#featured-categories');
    const featuredGrid = featured?.querySelector('.category-featured-grid');
    if (featured && featuredGrid && !normalizedQuery) {
      const featuredCategories = categories.filter((category) => featuredSlugs.has(category.slug));
      featuredGrid.innerHTML = featuredCategories.map(renderCategoryCard).join('');
      featured.toggleAttribute('hidden', featuredCategories.length === 0);
      hydrateIcons(featuredGrid);
    } else {
      featured?.setAttribute('hidden', '');
    }

    updatePageMetadata({
      title: `Browse Murphy's Laws by Category | Murphy's Law Archive`,
      description: `Explore all ${categories.length} categories of Murphy's Laws, from technology and work to travel and everyday life.`,
      path: '/categories'
    });
  }

  // Load categories
  async function loadCategories() {
    try {
      const response = await fetchCategories();
      categories = response.data || [];
      updateDisplay();

      // Register export content for categories
      if (categories.length > 0) {
        setExportContent({
          type: ContentType.CATEGORIES,
          title: 'Law Categories',
          data: categories.map(cat => ({
            id: cat.id,
            name: stripMarkdownFootnotes(cat.title),
            slug: cat.slug,
            law_count: cat.law_count || 0
          }))
        });
      } else {
        clearExportContent();
      }
    } catch (error) {
      Sentry.captureException(error);
      const grid = el.querySelector('#categories-grid')!;
      grid.classList.remove('loading-placeholder');
      grid.innerHTML = `
        <div class="empty-state">
          <span class="icon empty-state-icon" data-icon="alertTriangle" aria-hidden="true"></span>
          <p class="empty-state-title">Failed to load categories</p>
          <p class="empty-state-text">Please check your connection and try again.</p>
          <button class="btn mt-4" id="retry-categories">
            <span class="btn-text">Try Again</span>
            <span class="icon" data-icon="refresh" aria-hidden="true"></span>
          </button>
        </div>
      `;
      hydrateIcons(grid);
    }
  }

  // Event delegation for clicks
  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // Handle category card click
    const card = target.closest('.category-card');
    if (card) {
      e.preventDefault();
      const slug = card.getAttribute('data-category-slug');
      if (slug) {
        trackProductEvent('category.click', { surface: 'categories', category: slug });
        onNavigate('category', slug);
      }
      return;
    }

    if (target.closest('#retry-categories')) {
      const grid = el.querySelector('#categories-grid')!;
      grid.classList.add('loading-placeholder');
      grid.innerHTML = `<p class="text-center small">${getRandomLoadingMessage()}</p>`;
      loadCategories();
    }
  });

  el.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== 'category-filter') return;
    categoryQuery = target.value;
    updateDisplay();
  });

  // Handle keyboard navigation for category cards
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const card = target.closest('.category-card');
      if (card) {
        e.preventDefault();
        const slug = card.getAttribute('data-category-slug');
        if (slug) onNavigate('category', slug);
      }
    }
  });

  // Initialize
  render();
  loadCategories();

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup =() => {
    clearExportContent();
  };

  return el;
}
