// Browse view - displays all laws with pagination and search
// Refactored to use shared law card renderer

import templateHtml from '@views/templates/browse.html?raw';
import { fetchLaws } from '../utils/api.js';
import { renderLoadingHTML } from '../components/loading.js';
import { getRandomLoadingMessage, LAWS_PER_PAGE } from '../utils/constants.js';
import { addVotingListeners } from '../utils/voting.js';
import { hydrateIcons } from '@utils/icons.js';
import { renderLawCards } from '../utils/law-card-renderer.js';
import { initSharePopovers } from '../components/social-share.js';
import { renderPagination } from '../utils/pagination.js';
import { updateSearchInfo, hasActiveFilters } from '../utils/search-info.js';
import { AdvancedSearch } from '../components/advanced-search.js';
import { TopVoted } from '../components/top-voted.js';
import { Trending } from '../components/trending.js';
import { RecentlyAdded } from '../components/recently-added.js';
import { triggerAdSense } from '../utils/ads.js';
import { showSuccess } from '../components/notification.js';

export function Browse({ searchQuery, onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';

  let currentPage = 1;
  let totalLaws = 0;
  let laws = [];
  let currentFilters = { q: searchQuery || '' };
  let currentSort = 'score';
  let currentOrder = 'desc';

  // Render law cards
  function renderLaws(laws, query) {
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
      initSharePopovers(cardText);
    }
    
    // Update result count
    const resultCountEl = el.querySelector('#browse-result-count');
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
  async function loadPage(page) {
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

      // Only trigger ads if we actually have content - validate before triggering
      if (laws.length > 0 && cardText) {
        triggerAdSense(cardText);
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

  // Event delegation for navigation and pagination
  // Note: Voting is handled by addVotingListeners() utility (eliminates ~35 lines of duplicate code)
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
      const value = e.target.value;
      const [sort, order] = value.split('-');
      currentSort = sort;
      currentOrder = order;
      loadPage(1); // Reset to page 1 when sort changes
    });
  }

  loadPage(1);

  return el;
}
