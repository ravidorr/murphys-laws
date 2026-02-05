// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLawOfTheDay } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { renderLoadingHTML } from '../components/loading.js';
import { triggerAdSense } from '../utils/ads.js';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.js';

// Hero section HTML - single source of truth for home page heading
const HERO_HTML = `
  <h1 class="page-title page-title-hero text-primary mb-4"><span class="accent-text">The Ultimate Archive</span> of Life's Unavoidable Truths</h1>
  <p class="text-center mb-2 text-lg text-muted-fg max-w-2xl mx-auto">
    <strong>From Rocket Sleds to Buttered Toast:</strong> Navigating the Science of Murphy's Law.
  </p>
  <p class="text-center mb-8 text-muted-fg max-w-2xl mx-auto">
    "Anything that can go wrong, will go wrong." First articulated in 1949 by Captain Edward A. Murphy Jr. during high-stakes rocket sled experiments at Edwards Air Force Base, this simple observation revolutionized how we view safety, engineering, and human error.
  </p>

  <section class="home-section mb-8">
    <h2 class="section-title">Why Murphy's Law Still Matters</h2>
    <p class="text-muted-fg mb-4">
      Murphy's Law is more than just a punchline - it is a call to excellence. It serves as a practical reminder to plan for failure, design for resilience, and maintain a sense of humor when the "impossible" happens anyway.
    </p>
    <p class="text-muted-fg mb-6">
      Our archive is the world's most comprehensive collection of these universal insights. We curate the most enduring formulations of the law - from classical corollaries and field-specific variants in aviation and healthcare to the daily frustrations of modern life.
    </p>
    <ul class="feature-list">
      <li><strong>Verified Origins:</strong> We prioritize entries with documented sources and real-world relevance.</li>
      <li><strong>The Law of the Crowd:</strong> Join a community that votes on submissions to ensure the most insightful (and relatable) laws rise to the top.</li>
      <li><strong>Practical Resilience:</strong> Every category offers lessons in risk management and defensive design to help you stay one step ahead of the unexpected.</li>
    </ul>
  </section>

  <section class="home-section mb-8">
    <h2 class="section-title">Master the Chaos</h2>
    <p class="text-muted-fg mb-6">
      Whether you are an engineer auditing a safety system or a traveler looking for a laugh after a missed flight, our tools help you explore the patterns of the universe with purpose.
    </p>
    <ul class="feature-list">
      <li><strong>Daily Insight:</strong> Check the Law of the Day for your morning dose of reality.</li>
      <li><strong>Predict the Inevitable:</strong> Use our Sod's Law and Buttered Toast calculators to model the probability of your next mishap.</li>
      <li><strong>The Living Record:</strong> Visit our <a href="#/real-life-examples" data-nav="real-life-examples">Real-Life Examples</a> page to see how Murphy's Law manifests in modern projects, travel, and technology.</li>
    </ul>
    <p class="text-muted-fg mt-6 text-center">
      <em>Don't just wait for things to go wrong. Understand why they do.</em>
    </p>
  </section>
`;

const HOME_OVERVIEW_HTML = `
  <section class="card content-card mb-8">
    <header class="card-header">
      <h2 class="card-title"><span class="accent-text">Why</span> Murphy's Law Still Matters</h2>
      <p class="text-muted-fg">Murphy's Law isn't just a punchline - it's a practical reminder to plan for failure, design for resilience, and keep a sense of humor when things go sideways.</p>
    </header>
    <div class="card-body">
      <div class="content-section">
        <p>
        This archive curates the most enduring formulations of Murphy's Law, including classical corollaries, field-specific variants, and firsthand stories submitted by readers.
        We highlight how the law shows up in engineering, aviation, healthcare, finance, and everyday life, with context that explains where each observation came from.
        </p>
        <ul>
          <li><strong>Context-first curation:</strong> We prioritize entries with a known origin, documented source, or clear real-world relevance.</li>
          <li><strong>Community-reviewed:</strong> Visitors vote on submissions, helping the most insightful laws rise to the top.</li>
          <li><strong>Actionable takeaways:</strong> Each category includes patterns and lessons you can apply before things go wrong.</li>
        </ul>
      </div>
    </div>
  </section>
  <section class="card content-card mb-8">
    <header class="card-header">
      <h2 class="card-title"><span class="accent-text">How</span> to Use the Archive</h2>
      <p class="text-muted-fg">Whether you're researching safety systems or just need a laugh, these tools make it easy to explore the archive with purpose.</p>
    </header>
    <div class="card-body">
      <div class="content-section">
        <p>
          Start with the Law of the Day for a daily reminder, then dive into curated categories for your industry or curiosity.
          Use the calculators to model classic scenarios, or submit your own Murphy moment to keep the archive evolving.
        </p>
        <p>
          Looking for inspiration? Visit the <a href="/examples" data-nav="examples">real-life examples</a> page and explore how other readers describe the patterns they've noticed in projects, travel, and daily life.
        </p>
      </div>
    </div>
  </section>
`;

// Exported for testing
// Note: _categories parameter kept for backward compatibility with tests
export function renderHome(el, lawOfTheDay, _categories, onNavigate) {
  // Clear loading indicator but preserve the hero H1 and description
  el.innerHTML = `${HERO_HTML}${HOME_OVERVIEW_HTML}`;

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
}

export function Home({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page pt-0 min-h-400';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `${HERO_HTML}${HOME_OVERVIEW_HTML}${renderLoadingHTML({ size: 'large' })}`;

  function fetchAndRender() {
    fetchLawOfTheDay()
      .catch(() => null)
      .then((lawJson) => {
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
    if (!(t instanceof Element)) return;

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
    if (!(t instanceof Element)) return;

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
  el.cleanup = () => {
    clearExportContent();
  };

  return el;
}
