export function Contact({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.setAttribute('role', 'main');

  el.innerHTML = `
    <div class="card">
      <div class="card-content">
        <h1 class="mb-4">Contact Us</h1>

        <section class="mb-6">
          <p class="mb-4">
            We'd love to hear from you! Whether you have questions, suggestions, feedback,
            or just want to share your thoughts about Murphy's Law, feel free to reach out.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Get in Touch</h2>

          <div class="mb-4">
            <h3 class="mb-2">Submit a Law</h3>
            <p class="mb-3">
              Have a Murphy's Law observation to share? Visit our
              <a href="#" data-nav="submit">Submit a Law</a> page to contribute to our collection.
            </p>
          </div>

          <div class="mb-4">
            <h3 class="mb-2">Email</h3>
            <p class="mb-3">
              For general inquiries, feedback, or questions, you can reach us at:
            </p>
            <p class="mb-3">
              <a href="mailto:contact@murphys-laws.com">contact@murphys-laws.com</a>
            </p>
          </div>

          <div class="mb-4">
            <h3 class="mb-2">Website Issues</h3>
            <p class="mb-3">
              If you encounter any technical issues or bugs on the site, please let us know.
              Include details such as:
            </p>
            <ul class="mb-3">
              <li>The page where you encountered the issue</li>
              <li>What you were trying to do</li>
              <li>Your browser and device type</li>
              <li>Any error messages you received</li>
            </ul>
          </div>

          <div class="mb-4">
            <h3 class="mb-2">Content Concerns</h3>
            <p class="mb-3">
              If you have concerns about any content on our site, including copyright issues
              or inappropriate submissions, please contact us with specific details.
            </p>
          </div>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Response Time</h2>
          <p class="mb-4">
            We typically respond to inquiries within 2-3 business days. Please note that
            during periods of high volume, response times may be longer.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="mb-3">Other Resources</h2>
          <ul class="mb-4">
            <li><a href="#" data-nav="about">About Us</a> - Learn more about Murphy's Law Archive</li>
            <li><a href="#" data-nav="privacy">Privacy Policy</a> - How we handle your data</li>
            <li><a href="#" data-nav="terms">Terms of Service</a> - Our terms and conditions</li>
          </ul>
        </section>

        <div class="flex gap-2 mt-6">
          <button data-nav="home">Back to Home</button>
          <button class="outline" data-nav="submit">Submit a Law</button>
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
