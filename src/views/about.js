export function About({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = `
    <article class="card content-card">
      <div class="card-content">
        <header class="content-header">
          <h1>About Murphy's Law Archive</h1>
          <p class="lead">
            Murphy's Law Archive preserves and celebrates the world's favorite truism about
            inevitable mishaps. What started as a personal collection has become a living
            repository for witty observations, cautionary tales, and the humor we need when
            plans go sideways.
          </p>
        </header>

        <section class="content-section">
          <h2>What is Murphy's Law?</h2>
          <blockquote class="blockquote">
            "Anything that can go wrong, will." — Capt. Edward A. Murphy Jr.
          </blockquote>
          <p>
            Born out of an Air Force experiment in 1949, Murphy's Law captured a universal truth:
            when the stakes are high and complexity reigns, something eventually slips. Over the
            decades, this simple idea has multiplied into corollaries, variations, and stories from
            every corner of life, each reminding us to prepare, adapt, and laugh.
          </p>
        </section>

        <section class="content-section">
          <h2>What You'll Find</h2>
          <div class="content-grid">
            <div>
              <h3>Curated Laws</h3>
              <p>
                Browse more than forty categories covering technology, transportation, the workplace,
                family life, and specialized fields—from classrooms to cockpits.
              </p>
            </div>
            <div>
              <h3>Community Wisdom</h3>
              <p>
                Vote on classics, submit your own observations, and explore real stories submitted by
                readers who have lived through Murphy-grade chaos.
              </p>
            </div>
            <div>
              <h3>Interactive Tools</h3>
              <p>
                Put the legends to the test with calculators like our Sod's Law probability model and
                buttered toast landing simulator—both grounded in documented formulas.
              </p>
            </div>
            <div>
              <h3>Deep Dives</h3>
              <p>
                Explore essays and debates about fate versus preparation, optimism versus realism, and
                why humor is our best survival tool when things go sideways.
              </p>
            </div>
          </div>
        </section>

        <section class="content-section">
          <h2>How It Happened</h2>
          <p>
            Founder <strong>Raanan Avidor</strong> launched the archive in the late 1990s after a single
            Murphy moment on a Geocities page sparked an avalanche of emails. That snowball grew into a
            structured archive, a modern web app, and a shared space for everyone who appreciates the
            instructional power of things going wrong.
          </p>
        </section>

        <section class="content-section">
          <h2>Why It Matters</h2>
          <ul>
            <li><strong>Stress relief:</strong> Humor diffuses the tension when the worst happens.</li>
            <li><strong>Preparedness:</strong> Knowing the patterns helps us plan for the unexpected.</li>
            <li><strong>Shared experience:</strong> Murphy's Laws resonate across cultures, professions, and generations.</li>
            <li><strong>Perspective:</strong> Laughing at the chaos keeps us resilient.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>Stay in Touch</h2>
          <p>
            Have a story or a new twist on Murphy's Law? <a href="#" data-nav="contact">Reach out</a> or head back to the
            <a href="#" data-nav="browse">archive</a> to keep exploring.
          </p>
          <p class="small">
            All content is shared under the
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">
              CC0 1.0 Universal Public Domain Dedication
            </a>—use, remix, and share freely.
          </p>
        </section>
      </div>
    </article>
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
