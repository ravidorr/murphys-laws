export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = `
    <article class="card content-card">
      <div class="card-content">
        <header class="content-header">
          <p class="small">Last updated: ${lastUpdated}</p>
          <h1>Terms of Service</h1>
          <p class="lead">
            These terms describe how Murphy's Law Archive operates, what you can expect from the
            platform, and the responsibilities that come with contributing to a community built on
            curiosity, humor, and respect.
          </p>
        </header>

        <section class="content-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By visiting murphys-laws.com you agree to these Terms of Service. If you ever disagree with
            them, the safest option is to stop using the site before Murphy's Law decides otherwise.
          </p>
        </section>

        <section class="content-section">
          <h2>2. What the Archive Provides</h2>
          <div class="content-grid">
            <div>
              <h3>Discover & Learn</h3>
              <p>
                Browse thousands of classic, modern, and community-submitted Murphy's Laws organized by
                topic, from technology glitches to kitchen catastrophes.
              </p>
            </div>
            <div>
              <h3>Participate</h3>
              <p>
                Vote on your favorites, share your own observations, and explore calculators that bring
                Murphy's mischief to life through math and physics.
              </p>
            </div>
          </div>
          <p>
            We aim for high availability, but reserve the right to adjust or pause services if needed.
          </p>
        </section>

        <section class="content-section">
          <h2>3. Guidelines for Community Conduct</h2>
          <ul>
            <li>Share content that is respectful, relevant, and original.</li>
            <li>Avoid spam, advertising, or anything that infringes on others’ rights.</li>
            <li>Do not misuse automated tools or attempt to disrupt our infrastructure.</li>
            <li>Respect privacy - no harvesting or misusing personal information.</li>
            <li>Be yourself; impersonation undermines trust and violates these terms.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>4. Content You Submit</h2>
          <p>
            Anything you contribute - laws, stories, comments - remains yours, but you grant us a worldwide,
            royalty-free license to display, adapt, and promote it within the archive. Please submit only
            content you're comfortable sharing publicly and that you have rights to distribute.
          </p>
          <p>
            We moderate for clarity, safety, and community tone. We may edit or remove submissions that
            violate these terms or clash with community expectations.
          </p>
        </section>

        <section class="content-section">
          <h2>5. Intellectual Property</h2>
          <p>
            The Murphy's Law Archive, including design, code, and original content, is released under the
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">
              CC0 1.0 Universal Public Domain Dedication
            </a>.
            Feel free to reuse and remix - just remember to credit the storytellers when you can.
          </p>
          <p>
            Third-party or user-submitted materials may carry different licenses. When in doubt, ask the
            contributor or contact us for clarification.
          </p>
        </section>

        <section class="content-section">
          <h2>6. Advertising & External Links</h2>
          <p>
            We occasionally display ads or link to partner content. These external experiences have their
            own policies and quirks, so interacting with them is at your discretion.
          </p>
        </section>

        <section class="content-section">
          <h2>7. Warranty Disclaimer</h2>
          <p>
            The archive is offered as-is. We strive for accurate laws, functioning calculators, and swift
            navigation, but we can't promise perfection - or immunity from Murphy's Law.
          </p>
        </section>

        <section class="content-section">
          <h2>8. Limitation of Liability</h2>
          <p>
            We are not liable for indirect, incidental, or consequential damages arising from site usage,
            including lost data, missed opportunities, or general irony.
          </p>
        </section>

        <section class="content-section">
          <h2>9. Indemnity</h2>
          <p>
            If your use of the site causes claims against Murphy's Law Archive, you agree to step in and
            help resolve them, including covering reasonable legal costs.
          </p>
        </section>

        <section class="content-section">
          <h2>10. Third-Party Links</h2>
          <p>
            Some stories lead to other sites. We don't control external content, so review their policies
            before engaging.
          </p>
        </section>

        <section class="content-section">
          <h2>11. Privacy</h2>
          <p>
            Using the archive also means agreeing to our
            <a href="#" data-nav="privacy">Privacy Policy</a>, which explains how we collect and protect data.
          </p>
        </section>

        <section class="content-section">
          <h2>12. Changes to These Terms</h2>
          <p>
            Terms evolve as the archive grows. We'll update this page and refresh the effective date when
            substantive changes occur. Continued use after updates counts as acceptance.
          </p>
        </section>

        <section class="content-section">
          <h2>13. Governing Law</h2>
          <p>
            These terms follow the laws of the jurisdiction where we operate, without regard to conflicts
            of law. If a clause becomes invalid, the rest of the document remains enforceable.
          </p>
        </section>

        <section class="content-section">
          <h2>14. Ending Access</h2>
          <p>
            We may suspend or terminate accounts that violate these terms, threaten the community, or put
            our infrastructure at risk. We aim to be fair and transparent, but reserve discretion.
          </p>
        </section>

        <section class="content-section">
          <h2>15. Contact Us</h2>
          <p>
            Have questions about these terms? <a href="#" data-nav="contact">Reach out</a> - we read every message and
            respond as quickly as Murphy allows.
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
