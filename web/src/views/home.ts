// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.ts';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.ts';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.ts';
import { Trending } from '@components/trending.ts';
import { RecentlyAdded } from '@components/recently-added.ts';
import { fetchLawOfTheDay } from '../utils/api.ts';
import { createErrorState } from '../utils/dom.ts';
import { renderLoadingHTML } from '../components/loading.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { hydrateIcons } from '@utils/icons.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import type { CleanableElement, OnNavigate, Law } from '../types/app.d.ts';

const ARCHIVE_SEARCH_HTML = `
  <section class="section card card--section section-card mb-12 browse-cta" data-home-zone="archive-search" aria-labelledby="browse-cta-heading">
    <div class="section-header">
      <h1 id="browse-cta-heading" class="section-title"><span class="accent-text">Search</span> the Archive</h1>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Start with the complete Murphy's Law archive, then save, vote, share, or submit the next inevitable discovery.</p>
    </div>
    <div class="section-body">
      <form role="search" class="not-found-search-form" aria-label="Search the archive" data-nav="browse">
        <input type="search" class="form-control" placeholder="Search laws, categories, and mishaps" aria-label="Search laws">
        <button type="submit" class="btn primary">
          <span class="btn-text">Search the Archive</span>
          <span class="icon" data-icon="search" aria-hidden="true"></span>
        </button>
      </form>
      <div class="home-proof-points" aria-label="Archive facts">
        <span class="home-proof-point"><strong>2,400+</strong><span>laws</span></span>
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

const HOME_OVERVIEW_HTML = `
  <section class="section card card--section section-card mb-12">
    <div class="section-header">
      <h2 class="section-title"><span class="accent-text">The</span> Science of Murphy's Law</h2>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">"Anything that can go wrong, will go wrong." First articulated in 1949 by Captain Edward A. Murphy Jr. during rocket sled experiments at Edwards Air Force Base.</p>
    </div>
    <div class="section-body">
      <div class="content-section">
        <h3>Why Murphy's Law Still Matters</h3>
        <p>
          Murphy's Law is more than a punchline. It is a call to excellence: plan for failure, design for resilience, and keep your sense of humor when the "impossible" happens anyway.
        </p>
        <p>
          Our archive is the world's most comprehensive collection of these universal insights. We curate the most enduring formulations - from classical corollaries and field-specific variants in <a href="#/categories" data-nav="categories">aviation, healthcare, and technology</a> to the daily frustrations of modern life.
        </p>
        <ul>
          <li><strong>Verified Origins:</strong> Entries with documented sources and real-world relevance.</li>
          <li><strong>Community Curation:</strong> Vote on <a href="#/submit" data-nav="submit">submissions</a> to surface the most insightful laws.</li>
          <li><strong>Practical Resilience:</strong> Every <a href="#/categories" data-nav="categories">category</a> offers lessons in risk management and defensive design.</li>
        </ul>

        <h3>Master the Chaos</h3>
        <p>
          Whether you are an engineer auditing a safety system or a traveler seeking perspective after a missed flight, our tools help you explore these patterns with purpose.
        </p>
        <ul>
          <li><strong>Daily Insight:</strong> The Law of the Day delivers your morning dose of reality.</li>
          <li><strong>Predict the Inevitable:</strong> Use the <a href="#/calculators/sods-law" data-nav="calculators/sods-law">Sod's Law</a> and <a href="#/calculators/buttered-toast" data-nav="calculators/buttered-toast">Buttered Toast</a> calculators to model your next mishap.</li>
          <li><strong>The Living Record:</strong> See how Murphy's Law manifests in <a href="#/real-life-examples" data-nav="real-life-examples">real-world projects, travel, and technology</a>.</li>
        </ul>
        <p class="text-center mt-4">
          <em>Don't just wait for things to go wrong. Understand why they do.</em>
        </p>

        <h3>Articles</h3>
        <p>Dive deeper with long-form reads on the history, psychology, and practical use of Murphy's Law:</p>
        <ul>
          <li><a href="#/origin-story" data-nav="origin-story">The True Origin of Murphy's Law</a> – Captain Murphy, Project MX981, and the birth of the maxim.</li>
          <li><a href="#/why-murphys-law-feels-true" data-nav="why-murphys-law-feels-true">Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)</a> – Negativity bias, availability heuristic, and confirmation bias.</li>
          <li><a href="#/murphys-law-project-management" data-nav="murphys-law-project-management">Project Management vs. The Universe: A Survival Guide</a> – Plan for failure, scope creep, and communication.</li>
        </ul>
      </div>
    </div>
  </section>
`;


// Exported for testing
// Note: _categories parameter kept for backward compatibility with tests
export function renderHome(el: HTMLElement, lawOfTheDay: Law | null, _categories: unknown, onNavigate: OnNavigate): void {
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
      onNavigate('browse');
    });
  }

  if (lawOfTheDay) {
    const lawZone = document.createElement('section');
    lawZone.setAttribute('data-home-zone', 'law-of-day');
    const widget = LawOfTheDay({ law: lawOfTheDay, onNavigate });
    lawZone.appendChild(widget);
    el.appendChild(lawZone);
  }

  const categoryWrap = document.createElement('div');
  categoryWrap.innerHTML = CATEGORY_DISCOVERY_HTML;
  const categorySection = categoryWrap.firstElementChild!;
  hydrateIcons(categorySection as HTMLElement);
  el.appendChild(categorySection);

  const trendingRecentZone = document.createElement('section');
  trendingRecentZone.setAttribute('data-home-zone', 'trending-recent');
  trendingRecentZone.className = 'section mb-12';
  const discoveryGrid = document.createElement('div');
  discoveryGrid.className = 'home-discovery-grid';
  discoveryGrid.appendChild(Trending());
  discoveryGrid.appendChild(RecentlyAdded());
  trendingRecentZone.appendChild(discoveryGrid);
  el.appendChild(trendingRecentZone);

  const toolsZone = document.createElement('section');
  toolsZone.setAttribute('data-home-zone', 'tools-submit');

  const calcWidget = SodCalculatorSimple({ onNavigate });
  toolsZone.appendChild(calcWidget);

  const toastWidget = ButteredToastCalculatorSimple({ onNavigate });
  toolsZone.appendChild(toastWidget);

  const submitWrap = document.createElement('div');
  submitWrap.innerHTML = SUBMIT_CTA_HTML;
  const submitCta = submitWrap.firstElementChild!;
  toolsZone.appendChild(submitCta);
  hydrateIcons(toolsZone);
  el.appendChild(toolsZone);

  // Add Science of Murphy's Law section (below Submit a Law)
  const scienceWrap = document.createElement('div');
  scienceWrap.innerHTML = HOME_OVERVIEW_HTML;
  const scienceSection = scienceWrap.firstElementChild!;
  el.appendChild(scienceSection);
}

export function Home({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page pt-0 min-h-400';
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = renderLoadingHTML({ size: 'large' });

  function fetchAndRender() {
    fetchLawOfTheDay()
      .catch((): null => null)
      .then((lawJson): void => {
        const lawOfTheDay = lawJson && lawJson.data && lawJson.data[0] ? lawJson.data[0] : null;
        
        renderHome(el, lawOfTheDay, [], onNavigate);
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
        el.innerHTML = '';
        const errorEl = createErrorState('Ironically, something went wrong while loading Murphy\'s Laws. Please try again.');
        const retryBtn = errorEl.querySelector('button.btn.outline');
        if (retryBtn) {
          retryBtn.removeAttribute('onclick');
          retryBtn.setAttribute('data-action', 'retry');
        }
        el.appendChild(errorEl);
      });
  }

  // Initial render: loading, then fetch
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
