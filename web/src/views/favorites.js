// Favorites view - displays user's favorited laws

import templateHtml from '@views/templates/favorites.html?raw';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '@utils/law-card-renderer.js';
import { getFavorites, clearAllFavorites, removeFavorite } from '@utils/favorites.js';
import { isFavoritesEnabled } from '@utils/feature-flags.js';
import { addVotingListeners } from '@utils/voting.js';
import { setExportContent, clearExportContent, ContentType } from '@utils/export-context.js';

/**
 * Favorites page view
 * @param {Object} options - View options
 * @param {Function} options.onNavigate - Navigation callback
 * @returns {HTMLElement} View element
 */
export function Favorites({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  // Set page title
  document.title = `Browse My Favorites Laws | Murphy's Law Archive`;

  // If feature is disabled, show message and redirect option
  if (!isFavoritesEnabled()) {
    el.innerHTML = `
      <div class="card content-card">
        <header class="card-header text-center">
          <h1 class="mb-2"><span class="accent-text">Browse</span> My Favorites Laws</h1>
        </header>
        <div class="card-body text-center">
          <p class="mb-4 text-muted-fg">The favorites feature is currently disabled.</p>
          <div class="not-found-actions">
            <button type="button" class="btn" data-nav="home">
              <span class="icon" data-icon="home" aria-hidden="true"></span>
              <span class="btn-text">Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    `;
    hydrateIcons(el);
    setupEventListeners();
    return el;
  }

  /**
   * Render the empty state when no favorites (matches 404 page layout)
   * @returns {string} HTML string
   */
  function renderEmptyState() {
    return `
      <div class="card content-card">
        <header class="card-header text-center">
          <h1 class="mb-2"><span class="accent-text">Browse</span> My Favorites Laws</h1>
          <blockquote class="not-found-quote">
            "The law you need most will be the one you forgot to save."
          </blockquote>
          <p class="text-muted-fg">Your favorites collection is empty. Save laws to access them quickly.</p>
        </header>
        <div class="card-body text-center">
          <div class="not-found-search mb-6">
            <form role="search" class="not-found-search-form" id="favorites-search-form" aria-label="Search the archive">
              <input type="text" id="favorites-search-input" placeholder="Search laws..." class="form-control" aria-label="Search">
              <button type="submit" class="btn">
                <span class="icon" data-icon="search" aria-hidden="true"></span>
                <span class="btn-text">Search</span>
              </button>
            </form>
          </div>

          <div class="not-found-actions">
            <button type="button" class="btn" data-nav="home">
              <span class="icon" data-icon="home" aria-hidden="true"></span>
              <span class="btn-text">Back to Home</span>
            </button>
            <button type="button" class="btn outline" data-nav="browse">
              <span class="icon" data-icon="list" aria-hidden="true"></span>
              <span class="btn-text">Browse All Laws</span>
            </button>
          </div>

          <div class="not-found-categories mt-8">
            <p class="small text-muted-fg mb-4">Or explore popular categories:</p>
            <div class="not-found-category-links">
              <button type="button" class="btn outline" data-nav="category" data-param="murphys-computer-laws">Computer Laws</button>
              <button type="button" class="btn outline" data-nav="category" data-param="murphys-love-laws">Love Laws</button>
              <button type="button" class="btn outline" data-nav="category" data-param="murphys-technology-laws">Technology Laws</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the populated state with favorites (matches Top Voted/Trending layout)
   * @param {Array} favorites - Array of favorite laws
   * @returns {string} HTML string
   */
  function renderPopulatedState(favorites) {
    const count = favorites.length;
    const subtitle = count === 1
      ? '1 law saved to your collection'
      : `${count} laws saved to your collection`;

    return `
      <div class="card">
        <header class="card-header">
          <div class="card-title-row">
            <h1 class="card-title">
              <span class="accent-text">Browse</span> My Favorites Laws
            </h1>
            <button type="button" id="clear-favorites-btn" class="btn outline">
              <span class="icon" data-icon="close" aria-hidden="true"></span>
              <span class="btn-text">Clear All</span>
            </button>
          </div>
          <p id="favorites-subtitle" class="text-muted-fg favorites-subtitle">${subtitle}</p>
        </header>
        <div class="card-body">
          <div class="card-text">
            ${renderLawCards(favorites)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the page based on current state
   */
  function render() {
    const root = el.querySelector('#favorites-root');
    if (!root) return;

    const favorites = getFavorites();

    // Remove loading state
    root.classList.remove('loading-placeholder');
    root.removeAttribute('role');
    root.removeAttribute('aria-label');

    if (favorites.length === 0) {
      root.innerHTML = renderEmptyState();
      clearExportContent();
    } else {
      root.innerHTML = renderPopulatedState(favorites);
      // Register export content for favorites
      setExportContent({
        type: ContentType.LAWS,
        title: 'My Favorite Laws',
        data: favorites,
        metadata: { total: favorites.length }
      });
    }

    hydrateIcons(root);

    // Set up search form handler for empty state
    setupSearchFormHandler();
  }

  /**
   * Set up search form handler for empty state
   */
  function setupSearchFormHandler() {
    const searchForm = el.querySelector('#favorites-search-form');
    const searchInput = el.querySelector('#favorites-search-input');

    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          // Navigate to browse with search query
          onNavigate('browse');
          // Store query for browse page to pick up
          sessionStorage.setItem('searchQuery', query);
        }
      });
    }
  }

  /**
   * Handle clear all favorites
   */
  function handleClearAll() {
    // Confirm before clearing
    if (confirm('Are you sure you want to remove all favorites?')) {
      clearAllFavorites();
      render();
    }
  }

  /**
   * Handle favorite toggle (remove from favorites on this page)
   * @param {string} lawId - Law ID to unfavorite
   */
  function handleUnfavorite(lawId) {
    removeFavorite(lawId);

    // Find the card element specifically (not the button which also has data-law-id)
    const card = el.querySelector(`.law-card-mini[data-law-id="${lawId}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';
      card.style.transition = 'opacity 0.2s, transform 0.2s';

      setTimeout(() => {
        render(); // Re-render to update count and potentially show empty state
      }, 200);
    } else {
      // Card not found, render immediately
      render();
    }
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Event delegation
    el.addEventListener('click', (e) => {
      const target = e.target;
      // Use Element instead of HTMLElement to support SVG elements (heart icons)
      if (!(target instanceof Element)) return;

      // Handle clear all button
      if (target.closest('#clear-favorites-btn')) {
        handleClearAll();
        return;
      }

      // Handle favorite button (unfavorite)
      const favoriteBtn = target.closest('[data-action="favorite"]');
      if (favoriteBtn) {
        e.stopPropagation();
        const lawId = favoriteBtn.getAttribute('data-law-id');
        if (lawId) {
          handleUnfavorite(lawId);
        }
        return;
      }

      // Handle law card click (navigate to law detail)
      const lawCard = target.closest('.law-card-mini');
      if (lawCard && !target.closest('button') && !target.closest('a')) {
        const lawId = lawCard.getAttribute('data-law-id');
        if (lawId) {
          onNavigate('law', lawId);
        }
        return;
      }

      // Handle navigation links
      const navLink = target.closest('[data-nav]');
      if (navLink) {
        e.preventDefault();
        const route = navLink.getAttribute('data-nav');
        const param = navLink.getAttribute('data-param');
        if (route) {
          onNavigate(route, param || undefined);
        }
      }
    });

    // Keyboard navigation for law cards
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const lawCard = target.closest('.law-card-mini');
        if (lawCard && !target.closest('button')) {
          e.preventDefault();
          const lawId = lawCard.getAttribute('data-law-id');
          if (lawId) {
            onNavigate('law', lawId);
          }
        }
      }
    });
  }

  // Initialize
  el.innerHTML = templateHtml;
  render();
  setupEventListeners();
  addVotingListeners(el);

  // Cleanup function to clear export content on unmount
  el.cleanup = () => {
    clearExportContent();
  };

  return el;
}
