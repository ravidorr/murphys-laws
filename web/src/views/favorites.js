// Favorites view - displays user's favorited laws

import templateHtml from '@views/templates/favorites.html?raw';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '@utils/law-card-renderer.js';
import { getFavorites, clearAllFavorites, getFavoritesCount, removeFavorite } from '@utils/favorites.js';
import { isFavoritesEnabled } from '@utils/feature-flags.js';
import { renderLinkButtonHTML } from '@utils/button.js';
import { addVotingListeners } from '@utils/voting.js';

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

  // If feature is disabled, show message and redirect option
  if (!isFavoritesEnabled()) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="icon empty-state-icon" data-icon="heart" aria-hidden="true"></span>
        <p class="empty-state-title">Feature not available</p>
        <p class="empty-state-text">The favorites feature is currently disabled.</p>
        <div class="empty-state-actions">
          ${renderLinkButtonHTML({
    href: '/',
    text: 'Go to Home',
    icon: 'home',
  })}
        </div>
      </div>
    `;
    hydrateIcons(el);
    return el;
  }

  /**
   * Render the empty state when no favorites
   * @returns {string} HTML string
   */
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <span class="icon empty-state-icon" data-icon="heart" aria-hidden="true"></span>
        <p class="empty-state-title">No favorites yet</p>
        <p class="empty-state-text">Click the heart icon on any law to save it here.</p>
        <div class="empty-state-actions">
          ${renderLinkButtonHTML({
    href: '/browse',
    text: 'Browse All Laws',
    icon: 'list',
  })}
        </div>
      </div>
    `;
  }

  /**
   * Update the subtitle with count
   * @param {number} count - Number of favorites
   */
  function updateSubtitle(count) {
    const subtitle = el.querySelector('#favorites-subtitle');
    if (subtitle) {
      if (count === 0) {
        subtitle.textContent = 'Your saved laws collection';
      } else if (count === 1) {
        subtitle.textContent = '1 law saved to your collection';
      } else {
        subtitle.textContent = `${count} laws saved to your collection`;
      }
    }
  }

  /**
   * Toggle actions visibility
   * @param {boolean} show - Whether to show actions
   */
  function toggleActions(show) {
    const actions = el.querySelector('#favorites-actions');
    if (actions) {
      actions.classList.toggle('hidden', !show);
    }
  }

  /**
   * Render favorites list
   */
  function render() {
    const container = el.querySelector('#favorites-container');
    if (!container) return;

    const favorites = getFavorites();
    const count = favorites.length;

    // Update subtitle and actions visibility
    updateSubtitle(count);
    toggleActions(count > 0);

    // Remove loading state
    container.classList.remove('loading-placeholder');
    container.removeAttribute('role');
    container.removeAttribute('aria-label');

    if (count === 0) {
      container.innerHTML = renderEmptyState();
    } else {
      // Render law cards
      container.innerHTML = renderLawCards(favorites);
    }

    hydrateIcons(container);
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

    // Remove the card from DOM with animation
    const card = el.querySelector(`[data-law-id="${lawId}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';
      card.style.transition = 'opacity 0.2s, transform 0.2s';

      setTimeout(() => {
        render(); // Re-render to update count and potentially show empty state
      }, 200);
    } else {
      render();
    }
  }

  // Initialize
  el.innerHTML = templateHtml;
  render();

  // Set page title
  document.title = `My Favorites | Murphy's Law Archive`;

  // Add voting listeners for vote buttons
  addVotingListeners(el);

  // Event delegation
  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

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
    }

    // Handle navigation links
    const navLink = target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      const route = navLink.getAttribute('data-nav');
      const param = navLink.getAttribute('data-param');
      if (route) {
        onNavigate(route, param);
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

  return el;
}
