// Categories view - displays all categories with descriptions

import * as Sentry from '@sentry/browser';
import templateHtml from '@views/templates/categories.html?raw';
import { fetchCategories } from '../utils/api.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { getRandomLoadingMessage } from '../utils/constants.ts';
import { stripMarkdownFootnotes } from '../utils/sanitize.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate, Category } from '../types/app.d.ts';

export function Categories({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  let categories: Category[] = [];

  // Render a single category card
  function renderCategoryCard(category: Category) {
    const title = stripMarkdownFootnotes(category.title);
    const description = category.description || 'Explore laws in this category.';
    const lawCount = category.law_count || 0;
    const lawText = lawCount === 1 ? 'law' : 'laws';

    return `
      <article class="category-card" data-category-slug="${category.slug}" tabindex="0" role="link" aria-label="${title} - ${lawCount} ${lawText}">
        <h3 class="category-card-title">${title}</h3>
        <p class="category-card-description">${description}</p>
        <div class="category-card-footer">
          <span class="category-card-count">
            <span class="icon" data-icon="list" aria-hidden="true"></span>
            ${lawCount} ${lawText}
          </span>
          <span class="category-card-arrow">
            <span class="icon" data-icon="arrowRight" aria-hidden="true"></span>
          </span>
        </div>
      </article>
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

    // Sort categories alphabetically by title
    const sortedCategories = [...categories].sort((a, b) => 
      a.title.localeCompare(b.title)
    );

    return sortedCategories.map(renderCategoryCard).join('');
  }

  // Render the page structure
  async function render() {
    el.innerHTML = templateHtml;

    // Replace static loading message with random one
    const loadingPlaceholder = el.querySelector('.loading-placeholder p');
    if (loadingPlaceholder) {
      loadingPlaceholder.textContent = getRandomLoadingMessage();
    }
  }

  // Update the display with fetched categories
  function updateDisplay() {
    const grid = el.querySelector('#categories-grid');
    if (grid) {
      grid.classList.remove('loading-placeholder');
      grid.removeAttribute('role');
      grid.removeAttribute('aria-label');
      grid.innerHTML = renderCategories(categories);
      hydrateIcons(grid);
    }

    // Update page title and meta description
    document.title = `Browse Murphy's Laws by Category | Murphy's Law Archive`;
    updateMetaDescription(`Explore all ${categories.length} categories of Murphy's Laws - from computer laws to engineering principles. Find the perfect law for every situation.`);
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
      const grid = el.querySelector('#categories-grid');
      if (grid) {
        grid.classList.remove('loading-placeholder');
        grid.innerHTML = `
          <div class="empty-state">
            <span class="icon empty-state-icon" data-icon="alertTriangle" aria-hidden="true"></span>
            <p class="empty-state-title">Failed to load categories</p>
            <p class="empty-state-text">Please check your connection and try again.</p>
            <button class="btn" id="retry-categories" style="margin-top: 1rem;">
              <span class="btn-text">Try Again</span>
              <span class="icon" data-icon="refresh" aria-hidden="true"></span>
            </button>
          </div>
        `;
        hydrateIcons(grid);
      }
    }
  }

  // Event delegation for clicks
  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // Handle category card click
    const card = target.closest('.category-card');
    if (card) {
      const slug = card.getAttribute('data-category-slug');
      if (slug) {
        onNavigate('category', slug);
      }
      return;
    }

    // Handle retry button
    if (target.closest('#retry-categories')) {
      const grid = el.querySelector('#categories-grid');
      if (grid) {
        grid.classList.add('loading-placeholder');
        grid.innerHTML = `<p class="text-center small">${getRandomLoadingMessage()}</p>`;
      }
      loadCategories();
    }
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
        if (slug) {
          onNavigate('category', slug);
        }
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
