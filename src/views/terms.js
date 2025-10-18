export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <h1 class="mb-4">Terms of Service</h1>
        <p class="small mb-6">Last updated: ${lastUpdated}</p>

        <section class="mb-6">
          <h2 class="mb-3">1. Acceptance of Terms</h2>
          <p class="mb-4">
            By accessing and using murphys-laws.com (the "Site"), you accept and agree to be bound by
            these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use
            the Site.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">2. Description of Service</h2>
          <p class="mb-4">
            Murphy's Law Archive provides a platform for users to:
          </p>
          <ul class="mb-4">
            <li>Browse and read a collection of Murphy's Laws and related observations</li>
            <li>Vote on laws</li>
            <li>Submit their own laws for publication</li>
            <li>Use calculators based on Murphy's Law</li>
          </ul>
          <p class="mb-4">
            We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">3. User Conduct</h2>
          <p class="mb-4">You agree not to:</p>
          <ul class="mb-4">
            <li>Submit content that is offensive, abusive, defamatory, or otherwise objectionable</li>
            <li>Submit content that infringes on intellectual property rights</li>
            <li>Submit spam, advertising, or promotional content</li>
            <li>Attempt to interfere with or disrupt the Site or servers</li>
            <li>Use automated systems (bots, scrapers) without permission</li>
            <li>Impersonate any person or entity</li>
            <li>Collect or harvest personal information from other users</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">4. User-Generated Content</h2>
          <h3 class="mb-2">Content Submission</h3>
          <p class="mb-4">
            When you submit content to the Site (including laws, comments, or other materials), you:
          </p>
          <ul class="mb-4">
            <li>Grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display your content</li>
            <li>Represent that you own or have the necessary rights to the content</li>
            <li>Understand that your submission may be publicly displayed on the Site</li>
            <li>Agree that we may edit or remove your content at our discretion</li>
          </ul>

          <h3 class="mb-2">Content Moderation</h3>
          <p class="mb-4">
            We reserve the right to review, edit, or remove any user-submitted content that violates
            these Terms or is otherwise inappropriate. However, we are not obligated to monitor all content.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">5. Intellectual Property</h2>
          <h3 class="mb-2">Site Content</h3>
          <p class="mb-4">
            The content on this Site, including laws, design, graphics, and code, is marked with
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">
              CC0 1.0 Universal (CC0 1.0) Public Domain Dedication
            </a>.
            This means the content is in the public domain and can be freely used, modified, and
            distributed.
          </p>

          <h3 class="mb-2">Third-Party Content</h3>
          <p class="mb-4">
            Some content may be sourced from third parties or user submissions. Such content may be
            subject to different licenses or copyrights.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">6. Advertising</h2>
          <p class="mb-4">
            The Site displays advertisements through Google AdSense and other advertising partners.
            We are not responsible for the content of advertisements or the actions of advertisers.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">7. Disclaimer of Warranties</h2>
          <p class="mb-4">
            THE SITE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
            FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p class="mb-4">
            We do not warrant that:
          </p>
          <ul class="mb-4">
            <li>The Site will be uninterrupted or error-free</li>
            <li>Defects will be corrected</li>
            <li>The Site is free of viruses or other harmful components</li>
            <li>The content is accurate, complete, or current</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">8. Limitation of Liability</h2>
          <p class="mb-4">
            TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
            REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL,
            OR OTHER INTANGIBLE LOSSES.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">9. Indemnification</h2>
          <p class="mb-4">
            You agree to indemnify and hold harmless Murphy's Law Archive, its operators, and
            affiliates from any claims, damages, losses, liabilities, and expenses (including
            legal fees) arising from:
          </p>
          <ul class="mb-4">
            <li>Your use of the Site</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Content you submit to the Site</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">10. External Links</h2>
          <p class="mb-4">
            The Site may contain links to third-party websites. We are not responsible for the
            content, accuracy, or practices of external sites. Your use of third-party websites
            is at your own risk.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">11. Privacy</h2>
          <p class="mb-4">
            Your use of the Site is also governed by our
            <a href="#" data-nav="privacy">Privacy Policy</a>. Please review it to understand
            our practices.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">12. Changes to Terms</h2>
          <p class="mb-4">
            We reserve the right to modify these Terms at any time. Changes will be effective
            immediately upon posting to the Site. Your continued use of the Site after changes
            constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">13. Governing Law</h2>
          <p class="mb-4">
            These Terms shall be governed by and construed in accordance with the laws of your
            jurisdiction, without regard to conflict of law provisions.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">14. Termination</h2>
          <p class="mb-4">
            We reserve the right to terminate or suspend your access to the Site at any time,
            for any reason, without notice.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">15. Contact</h2>
          <p class="mb-4">
            If you have any questions about these Terms, please
            <a href="#" data-nav="contact">contact us</a>.
          </p>
        </section>

        <div class="flex gap-2 mt-6">
          <button data-nav="home">Back to Home</button>
          <button class="outline" data-nav="privacy">Privacy Policy</button>
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
