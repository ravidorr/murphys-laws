export function Contact({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = `
    <article class="card content-card">
      <div class="card-content">
        <header class="content-header">
          <h1>Contact Murphy's Law Archive</h1>
          <p class="lead">
            We love meeting fellow observers of life's inevitable mishaps. Whether you're sharing a new
            law, reporting an issue, or just saying hello, here's how to reach us.
          </p>
        </header>

        <section class="content-section">
          <h2>Send a Message</h2>
          <div class="content-grid">
            <div>
              <h3>Share a Law</h3>
              <p>
                The archive grows through community stories. Submit your latest Murphy moment via the
                <a href="#" data-nav="submit">Submit a Law</a> form and we'll feature it with proper credit.
              </p>
            </div>
            <div>
              <h3>Email</h3>
              <p>
                For questions, collaborations, or feedback, drop us a note at
                <a href="mailto:contact@murphys-laws.com">contact@murphys-laws.com</a>.
              </p>
            </div>
          </div>
        </section>

        <section class="content-section">
          <h2>Need Support?</h2>
          <p>
            Spot a glitch or unusual behavior? Send us the page URL, what you were doing, your browser
            and device, plus any error messages. The more detail, the faster we can recreate and fix it.
          </p>
          <p>
            Concerned about content? Let us know which law or story needs attention and why. We review
            every report and respond with next steps.
          </p>
        </section>

        <section class="content-section">
          <h2>When You'll Hear Back</h2>
          <p>
            We usually reply within two business days. During major launches or when Murphy strikes in
            bulk, it might take a little longer — but we read every message.
          </p>
        </section>

        <section class="content-section">
          <h2>Quick Links</h2>
          <ul>
            <li><a href="#" data-nav="about">About</a> — learn our origin story and mission.</li>
            <li><a href="#" data-nav="privacy">Privacy Policy</a> — see how we treat your data.</li>
            <li><a href="#" data-nav="terms">Terms of Service</a> — understand the rules of the road.</li>
          </ul>
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
