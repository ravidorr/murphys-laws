// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.ts';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.ts';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.ts';
import { SubmitLawSection } from '@components/submit-law.ts';
import { fetchLawOfTheDay } from '../utils/api.ts';
import { createErrorState } from '../utils/dom.ts';
import { renderLoadingHTML } from '../components/loading.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { HOME_HERO_ACCENT, HOME_HERO_TITLE } from '../utils/constants.ts';
import type { CleanableElement, OnNavigate, Law } from '../types/app.d.ts';

const HERO_HTML = `
  <h1 class="page-title page-title-hero text-primary mb-4"><span class="accent-text">${HOME_HERO_ACCENT}</span> ${HOME_HERO_TITLE}</h1>
`;

const HOME_OVERVIEW_HTML = `
  <section class="section section-card mb-12">
    <div class="section-header">
      <h2 class="section-title"><span class="accent-text">The</span> Science of Murphy's Law</h2>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">"Anything that can go wrong, will go wrong." First articulated in 1949 by Captain Edward A. Murphy Jr. during rocket sled experiments at Edwards Air Force Base, this observation revolutionized how we approach safety, engineering, and human error.</p>
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
      </div>
    </div>
  </section>
`;

// Exported for testing
// Note: _categories parameter kept for backward compatibility with tests
export function renderHome(el: HTMLElement, lawOfTheDay: Law | null, _categories: unknown, onNavigate: OnNavigate): void {
  // Clear loading indicator but preserve the hero H1
  el.innerHTML = HERO_HTML;

  if (lawOfTheDay) {
    const widget = LawOfTheDay({ law: lawOfTheDay, onNavigate });
    el.appendChild(widget);
  }

  // Add Sod's Law Calculator widget
  const calcWidget = SodCalculatorSimple({ onNavigate });
  el.appendChild(calcWidget);

  // Add Buttered Toast Calculator widget
  const toastWidget = ButteredToastCalculatorSimple({ onNavigate });
  el.appendChild(toastWidget);

  // Add Submit Law section
  const submitWidget = SubmitLawSection();
  el.appendChild(submitWidget);

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

  el.innerHTML = `${HERO_HTML}${renderLoadingHTML({ size: 'large' })}`;

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
      /* v8 ignore start - Error path only reachable if renderHome throws, tested via integration tests */
      .catch(() => {
        el.innerHTML = '';
        const errorEl = createErrorState('Ironically, something went wrong while loading Murphy\'s Laws. Please try again.');
        el.appendChild(errorEl);
      });
    /* v8 ignore stop */
  }

  // Initial render: loading, then fetch
  fetchAndRender();

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        if (navTarget.startsWith('category:')) {
          const catId = navTarget.split(':')[1];
          onNavigate('category', catId);
        } else {
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
      /* v8 ignore next - Truthy check for navigation, tested via integration tests */
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
