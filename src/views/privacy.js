export function Privacy({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = `
    <article class="card content-card">
      <div class="card-content">
        <header class="content-header">
          <p class="small">Last updated: ${lastUpdated}</p>
          <h1>Privacy Policy</h1>
          <p class="lead">
            Murphy's Law Archive is built for curious, privacy-conscious readers. This policy explains
            what information we collect, why we collect it, and how we protect your trust while you
            browse, submit laws, and share your stories.
          </p>
        </header>

        <section class="content-section">
          <h2>What We Collect</h2>
          <div class="content-grid">
            <div>
              <h3>Information You Share</h3>
              <p>
                When you submit a law, send feedback, or subscribe to updates, you may share your name,
                email address, and the content you contribute. Sharing is optional — the archive welcomes
                anonymous submissions.
              </p>
            </div>
            <div>
              <h3>Activity Signals</h3>
              <p>
                Our servers automatically receive technical basics like IP address, device and browser
                details, pages visited, and time on page. These signals help us keep the site reliable
                and understand what content resonates.
              </p>
            </div>
          </div>
        </section>

        <section class="content-section">
          <h2>How We Use Data</h2>
          <ul>
            <li><strong>Operate the archive:</strong> Render pages, route navigation, and surface the laws you love.</li>
            <li><strong>Celebrate community contributions:</strong> Display submitted laws and stories with proper attribution.</li>
            <li><strong>Improve the experience:</strong> Analyze patterns to refine navigation, search, and performance.</li>
            <li><strong>Keep things safe:</strong> Detect misuse, abuse, or unauthorized access.</li>
            <li><strong>Stay in touch:</strong> Respond when you reach out or request updates.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>Cookies & Analytics</h2>
          <p>
            We use lightweight first-party cookies and privacy-focused analytics to understand traffic
            trends. They remember preferences like dark mode and help us learn which calculators or laws
            people return to most. You can clear or block cookies through your browser without breaking
            the site.
          </p>
        </section>

        <section class="content-section">
          <h2>Third-Party Services</h2>
          <p>
            When enabled, services such as email delivery providers or advertising networks may process
            limited information to send notifications or measure reach. We require these partners to honor
            strong privacy safeguards and only share the minimum necessary data.
          </p>
        </section>

        <section class="content-section">
          <h2>Data Retention</h2>
          <p>
            Submission content remains visible so the archive reflects collective wisdom. Supporting
            metadata is retained only as long as we have a reason — typically to provide the feature you
            requested or to comply with legal obligations. When data is no longer needed, we delete or
            anonymize it.
          </p>
        </section>

        <section class="content-section">
          <h2>Your Choices</h2>
          <ul>
            <li><strong>Control submissions:</strong> Request edits or removal of content you provided.</li>
            <li><strong>Access information:</strong> Ask what data we have collected about you.</li>
            <li><strong>Opt out:</strong> Disable cookies, unsubscribe from updates, or decline analytics participation.</li>
            <li><strong>Reach out:</strong> Contact us for clarification before sharing personal details.</li>
          </ul>
        </section>

        <section class="content-section">
          <h2>Security Practices</h2>
          <p>
            We apply encryption in transit, strict access controls, and regular reviews of our systems.
            While no website can promise absolute security, we respond quickly to issues and keep backups
            isolated from public infrastructure.
          </p>
        </section>

        <section class="content-section">
          <h2>Global Visitors</h2>
          <p>
            Murphy's Law is universal, and so are our visitors. Data may be processed in the United States
            and other regions where our providers operate. Using the site means you consent to that
            transfer, and we rely on standard contractual safeguards when required.
          </p>
        </section>

        <section class="content-section">
          <h2>Updates</h2>
          <p>
            We review this policy whenever new features launch or regulations change. When updates happen,
            we adjust the date at the top and summarize material changes so you can stay informed.
          </p>
        </section>

        <section class="content-section">
          <h2>Contact</h2>
          <p>
            Questions or requests? <a href="#" data-nav="contact">Send us a note</a> and we'll respond promptly.
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
