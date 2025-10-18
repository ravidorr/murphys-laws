export function Privacy({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <h1 class="mb-4">Privacy Policy</h1>
        <p class="small mb-6">Last updated: ${lastUpdated}</p>

        <section class="mb-6">
          <h2 class="mb-3">Introduction</h2>
          <p class="mb-4">
            Welcome to Murphy's Law Archive ("we," "our," or "us"). We respect your privacy and are
            committed to protecting your personal data. This privacy policy explains how we collect,
            use, and protect information when you visit our website murphys-laws.com (the "Site").
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Information We Collect</h2>
          <h3 class="mb-2">Information You Provide</h3>
          <p class="mb-4">
            When you submit a law or use our contact form, you may provide:
          </p>
          <ul class="mb-4">
            <li>Your name (optional)</li>
            <li>Email address (optional)</li>
            <li>The content you submit</li>
          </ul>

          <h3 class="mb-2">Automatically Collected Information</h3>
          <p class="mb-4">
            When you visit our Site, we may automatically collect:
          </p>
          <ul class="mb-4">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>Pages visited and time spent on pages</li>
            <li>Referring website</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Cookies and Tracking Technologies</h2>
          <p class="mb-4">
            We use cookies and similar tracking technologies to improve your experience on our Site.
            Cookies are small text files stored on your device that help us understand how you use our Site.
          </p>
          <h3 class="mb-2">Types of Cookies We Use:</h3>
          <ul class="mb-4">
            <li><strong>Essential Cookies:</strong> Required for the Site to function properly</li>
            <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our Site</li>
            <li><strong>Advertising Cookies:</strong> Used to deliver relevant advertisements (see Google AdSense section below)</li>
          </ul>
          <p class="mb-4">
            You can control cookies through your browser settings. However, disabling cookies may affect
            your experience on our Site.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Google AdSense and Advertising</h2>
          <p class="mb-4">
            We use Google AdSense to display advertisements on our Site. Google AdSense uses cookies and
            other tracking technologies to show ads based on your visits to this Site and other websites
            across the Internet.
          </p>
          <p class="mb-4">
            Google uses cookies to serve ads based on your previous visits to our Site and other sites.
            You can opt out of personalized advertising by visiting
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google's Ads Settings</a>.
            Alternatively, you can opt out of third-party vendors' use of cookies by visiting
            <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener">www.aboutads.info</a>.
          </p>
          <p class="mb-4">
            For more information about how Google uses data when you use our Site, please visit
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">
              Google's Privacy Policy
            </a>.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">How We Use Your Information</h2>
          <p class="mb-4">We use the information we collect to:</p>
          <ul class="mb-4">
            <li>Provide, operate, and maintain our Site</li>
            <li>Process and display user-submitted content</li>
            <li>Improve and personalize your experience</li>
            <li>Understand how visitors use our Site</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Display relevant advertisements</li>
            <li>Communicate with you (if you've provided contact information)</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Data Sharing and Disclosure</h2>
          <p class="mb-4">
            We do not sell your personal information. We may share your information with:
          </p>
          <ul class="mb-4">
            <li><strong>Service Providers:</strong> Third-party services that help us operate our Site (e.g., Google AdSense)</li>
            <li><strong>Legal Requirements:</strong> If required by law or to protect our rights</li>
            <li><strong>Public Display:</strong> Content you submit may be displayed publicly on our Site</li>
          </ul>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Data Security</h2>
          <p class="mb-4">
            We implement reasonable security measures to protect your information. However, no method of
            transmission over the Internet or electronic storage is 100% secure. We cannot guarantee
            absolute security of your data.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Your Rights</h2>
          <p class="mb-4">Depending on your location, you may have the right to:</p>
          <ul class="mb-4">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict certain processing of your data</li>
            <li>Opt out of marketing communications</li>
          </ul>
          <p class="mb-4">
            To exercise these rights, please <a href="#" data-nav="contact">contact us</a>.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Children's Privacy</h2>
          <p class="mb-4">
            Our Site is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If you are a parent or guardian and believe
            your child has provided us with personal information, please contact us.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">International Data Transfers</h2>
          <p class="mb-4">
            Your information may be transferred to and processed in countries other than your own.
            These countries may have different data protection laws. By using our Site, you consent
            to such transfers.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Changes to This Privacy Policy</h2>
          <p class="mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by
            posting the new Privacy Policy on this page and updating the "Last updated" date at the top.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Contact Us</h2>
          <p class="mb-4">
            If you have any questions about this Privacy Policy, please
            <a href="#" data-nav="contact">contact us</a>.
          </p>
        </section>

        <div class="flex gap-2 mt-6">
          <button data-nav="home">Back to Home</button>
          <button class="outline" data-nav="terms">Terms of Service</button>
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
