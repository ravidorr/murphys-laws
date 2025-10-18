import { escapeHtml } from '../utils/sanitize.js';

export function About({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <h1 class="mb-4">About Murphy's Law Archive</h1>

        <section class="mb-6">
          <h2 class="mb-3">What is Murphy's Law?</h2>
          <blockquote class="blockquote mb-4">
            "Anything that can go wrong will go wrong."
          </blockquote>
          <p class="mb-4">
            Murphy's Law is a popular adage that states: "Anything that can go wrong will go wrong."
            This seemingly simple observation has spawned countless variations, corollaries, and
            related laws that capture the humorous yet often accurate nature of life's mishaps.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">About This Site</h2>
          <p class="mb-4">
            Welcome to Murphy's Law Archive, a comprehensive collection of Murphy's Law and its many
            variations. This site serves as a repository for witty observations about life, technology,
            work, and everything in between.
          </p>
          <p class="mb-4">
            Our collection includes classic Murphy's Laws, domain-specific variations (like technology
            laws, office laws, and more), and user-submitted observations. You can:
          </p>
          <ul class="mb-4">
            <li>Browse our extensive archive of laws</li>
            <li>Vote on your favorite (or least favorite) laws</li>
            <li>Submit your own observations</li>
            <li>Use our calculators to apply Murphy's Law mathematically</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">The Creator</h2>
          <p class="mb-4">
            This archive is maintained by <strong>Raanan Avidor</strong>, a software developer with
            a passion for collecting and cataloging life's inevitable ironies. The project started
            as a personal collection and has grown into a comprehensive archive for anyone who
            appreciates the humor in Murphy's Law.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Licensing</h2>
          <p class="mb-4">
            The content on this site is marked with
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">
              CC0 1.0 Universal (CC0 1.0) Public Domain Dedication
            </a>.
            This means you can copy, modify, distribute, and perform the work, even for commercial
            purposes, all without asking permission.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Contact</h2>
          <p class="mb-4">
            Have questions, suggestions, or want to submit a law? Visit our
            <a href="#" data-nav="contact">Contact page</a> to get in touch.
          </p>
        </section>

        <div class="flex gap-2 mt-6">
          <button data-nav="home">Back to Home</button>
          <button class="outline" data-nav="browse">Browse Laws</button>
        </div>
      </div>
    </div>
  `;

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.dataset.nav) {
      e.preventDefault();
      onNavigate(target.dataset.nav);
    }
  });

  return el;
}
