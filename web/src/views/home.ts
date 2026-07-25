// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.ts';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.ts';
import { Trending } from '@components/trending.ts';
import { fetchLawOfTheDay } from '../utils/api.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import { exposeExperiment, getExperimentVariant, HOME_MODULE_ORDER_EXPERIMENT, type HomeModuleOrderVariant } from '@utils/experiments.ts';
import type { CleanableElement, OnNavigate, SearchFilters, Law } from '../types/app.d.ts';

type OnSearch = (filters: SearchFilters) => void;
type DailyLawState = 'loading' | 'ready' | 'empty' | 'error';

interface RenderHomeOptions {
  dailyLawState?: DailyLawState;
}

const ARCHIVE_SEARCH_HTML = `
  <section class="section card card--section section-card mb-12 browse-cta" data-home-zone="archive-search" aria-labelledby="browse-cta-heading">
    <div class="section-header">
      <h1 id="browse-cta-heading" class="section-title"><span class="accent-text">Search</span> the Archive</h1>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Start with the complete Murphy's Law archive, then save, vote, share, or submit the next inevitable discovery.</p>
    </div>
    <div class="section-body">
      <form role="search" class="not-found-search-form" aria-label="Search the archive">
        <input type="search" class="form-control" placeholder="Search laws, categories, and mishaps" aria-label="Search laws">
        <button type="submit" class="btn primary">
          <span class="btn-text">Search the Archive</span>
          <span class="icon" data-icon="search" aria-hidden="true"></span>
        </button>
      </form>
      <div class="home-proof-points" aria-label="Archive facts">
        <span class="home-proof-point"><strong>Complete</strong><span>archive</span></span>
        <span class="home-proof-point"><strong>55+</strong><span>categories</span></span>
        <span class="home-proof-point"><strong>Human-reviewed</strong><span>submissions</span></span>
        <span class="home-proof-point"><strong>Curated</strong><span>since 1998</span></span>
      </div>
      <a href="/browse" class="btn primary" data-nav="browse">
        <span class="btn-text">Browse All Laws</span>
        <span class="icon" data-icon="list" aria-hidden="true"></span>
      </a>
    </div>
  </section>
`;

const CATEGORY_DISCOVERY_HTML = `
  <section class="section card card--section section-card mb-12" data-home-zone="category-discovery" aria-labelledby="category-discovery-heading">
    <div class="section-header">
      <h2 id="category-discovery-heading" class="section-title"><span class="accent-text">Browse</span> by Theme</h2>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Jump into grouped categories for technology, work, travel, relationships, and everyday trouble.</p>
    </div>
    <div class="section-body">
      <div class="not-found-actions">
        <a href="/categories" class="btn" data-nav="categories">Explore Categories</a>
        <a href="/category/murphys-technology-laws" class="btn outline" data-nav="category:murphys-technology-laws">Technology Laws</a>
        <a href="/category/murphys-office-laws" class="btn outline" data-nav="category:murphys-office-laws">Work Laws</a>
      </div>
    </div>
  </section>
`;

const SUBMIT_CTA_HTML = `
  <section class="section card card--section section-card mb-12" aria-labelledby="submit-cta-heading">
    <div class="section-header">
      <h2 id="submit-cta-heading" class="section-title"><span class="accent-text">Submit</span> Your Own</h2>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Contributions are human-reviewed before publication. Send the sharp version, include attribution if you know it, and check for duplicates first.</p>
    </div>
    <div class="section-body">
      <a href="/submit" class="btn" data-nav="submit">Submit a Law</a>
    </div>
  </section>
`;

function renderDailyLawZone(
  zone: HTMLElement,
  law: Law | null,
  onNavigate: OnNavigate,
  requestedState: DailyLawState
): void {
  const state = requestedState === 'ready' && !law ? 'empty' : requestedState;
  zone.replaceChildren();
  zone.dataset.dailyLawState = state;
  zone.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

  if (state === 'loading' || (state === 'ready' && law)) {
    zone.appendChild(LawOfTheDay({ law, onNavigate }));
    return;
  }

  const fallback = document.createElement('section');
  fallback.className = 'section card card--section section-card mb-12';
  const message = state === 'error'
    ? 'The daily law could not be loaded. The rest of the archive is still available.'
    : 'There is no daily law available right now. Explore the complete archive instead.';
  const action = state === 'error'
    ? '<button type="button" class="btn outline" data-action="retry">Try Again</button>'
    : '<a href="/browse" class="btn outline" data-nav="browse">Browse All Laws</a>';

  fallback.innerHTML = `
    <div class="section-header">
      <h2 class="section-title"><span class="accent-text">Murphy's</span> Law of the Day</h2>
    </div>
    <div class="section-body">
      <p>${message}</p>
      ${action}
    </div>
  `;
  zone.appendChild(fallback);
}

// Exported for testing
// Note: _categories parameter kept for backward compatibility with tests
export function renderHome(
  el: HTMLElement,
  lawOfTheDay: Law | null,
  _categories: unknown,
  onNavigate: OnNavigate,
  onSearch?: OnSearch,
  options: RenderHomeOptions = {}
): void {
  el.innerHTML = '';

  // Primary discovery zone
  const browseWrap = document.createElement('div');
  browseWrap.innerHTML = ARCHIVE_SEARCH_HTML;
  const browseCta = browseWrap.firstElementChild!;
  hydrateIcons(browseCta as HTMLElement);
  el.appendChild(browseCta);
  const searchForm = browseCta.querySelector('form[role="search"]');
  if (searchForm instanceof HTMLFormElement) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      trackProductEvent('archive.search', { surface: 'home', result: 'submitted' });
      const input = searchForm.querySelector('input[type="search"]');
      const query = input instanceof HTMLInputElement ? input.value.trim() : '';
      if (onSearch) onSearch({ q: query });
      else onNavigate('browse');
    });
  }

  const lawZone = document.createElement('div');
  lawZone.className = 'min-h-400';
  lawZone.setAttribute('data-home-zone', 'law-of-day');
  renderDailyLawZone(
    lawZone,
    lawOfTheDay,
    onNavigate,
    options.dailyLawState ?? (lawOfTheDay ? 'ready' : 'empty')
  );
  el.appendChild(lawZone);

  const categoryWrap = document.createElement('div');
  categoryWrap.innerHTML = CATEGORY_DISCOVERY_HTML;
  const categorySection = categoryWrap.firstElementChild!;
  hydrateIcons(categorySection as HTMLElement);

  const trendingZone = document.createElement('section');
  trendingZone.setAttribute('data-home-zone', 'trending');
  trendingZone.className = 'section mb-12';
  trendingZone.appendChild(Trending());
  const variant = getExperimentVariant<HomeModuleOrderVariant>(HOME_MODULE_ORDER_EXPERIMENT, ['themes-first', 'trending-first']);
  exposeExperiment(HOME_MODULE_ORDER_EXPERIMENT, variant);
  if (variant === 'trending-first') {
    el.append(trendingZone, categorySection);
  } else {
    el.append(categorySection, trendingZone);
  }

  const toolsZone = document.createElement('section');
  toolsZone.setAttribute('data-home-zone', 'tools-submit');

  const calcWidget = SodCalculatorSimple({ onNavigate });
  toolsZone.appendChild(calcWidget);

  const submitWrap = document.createElement('div');
  submitWrap.innerHTML = SUBMIT_CTA_HTML;
  const submitCta = submitWrap.firstElementChild!;
  toolsZone.appendChild(submitCta);
  hydrateIcons(toolsZone);
  el.appendChild(toolsZone);

}

export function Home({ onNavigate, onSearch }: { onNavigate: OnNavigate; onSearch?: OnSearch }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page pt-0 min-h-400';
  el.setAttribute('aria-live', 'polite');

  renderHome(el, null, [], onNavigate, onSearch, { dailyLawState: 'loading' });

  function fetchAndRender() {
    const lawZone = el.querySelector<HTMLElement>('[data-home-zone="law-of-day"]');
    if (lawZone) {
      renderDailyLawZone(lawZone, null, onNavigate, 'loading');
    }

    fetchLawOfTheDay()
      .then((lawJson): void => {
        const lawOfTheDay = lawJson && lawJson.data && lawJson.data[0] ? lawJson.data[0] : null;

        const currentLawZone = el.querySelector<HTMLElement>('[data-home-zone="law-of-day"]');
        if (currentLawZone) {
          renderDailyLawZone(currentLawZone, lawOfTheDay, onNavigate, lawOfTheDay ? 'ready' : 'empty');
        }
        // Signal that meaningful content is ready for ads - pass element for validation
        triggerAdSense(el);

        // Register export content for home page (law of the day if available)
        if (lawOfTheDay) {
          setExportContent({
            type: ContentType.SINGLE_LAW,
            title: 'Law of the Day',
            data: lawOfTheDay
          });
        } else {
          clearExportContent();
        }
      })
      .catch(() => {
        const currentLawZone = el.querySelector<HTMLElement>('[data-home-zone="law-of-day"]');
        if (currentLawZone) {
          renderDailyLawZone(currentLawZone, null, onNavigate, 'error');
        }
        clearExportContent();
        triggerAdSense(el);
      });
  }

  // The complete page structure is already rendered; only the reserved daily-law slot changes.
  fetchAndRender();

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.closest('[data-action="retry"]')) {
      fetchAndRender();
      return;
    }

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        if (navTarget.startsWith('category:')) {
          const catId = navTarget.split(':')[1];
          trackProductEvent('category.click', { surface: 'home', category: catId });
          onNavigate('category', catId);
        } else {
          if (navTarget === 'browse') trackProductEvent('archive.search', { surface: 'home', result: 'browse' });
          if (navTarget === 'submit') trackProductEvent('submit.start', { surface: 'home' });
          onNavigate(navTarget);
        }
        return;
      }
    }

    const lawHost = t.closest('[data-law-id]');
    if (lawHost) {
      // Don't navigate if clicking on interactive elements (buttons for voting, favorites, share)
      if (t.closest('button')) return;
      const id = lawHost.getAttribute('data-law-id');
      if (id) onNavigate('law', id);
    }
  });

  // Keyboard navigation for law cards and category cards (WCAG 2.1.1)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle law card keyboard activation
    const lawHost = t.closest('[data-law-id]');
    if (lawHost) {
      const id = lawHost.getAttribute('data-law-id');
      if (id) {
        e.preventDefault();
        onNavigate('law', id);
      }
      return;
    }

    // Handle category card keyboard activation
    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        e.preventDefault();
        if (navTarget.startsWith('category:')) {
          const catId = navTarget.split(':')[1];
          onNavigate('category', catId);
        } else {
          onNavigate(navTarget);
        }
      }
    }
  });

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup =() => {
    clearExportContent();
  };

  return el;
}
