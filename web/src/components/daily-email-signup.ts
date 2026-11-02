import { apiPost } from '../utils/request.ts';
import { trackProductEvent } from '../utils/metrics.ts';

const FORM_HTML = `
  <div class="section-header">
    <h2 id="daily-email-heading" class="section-title"><span class="accent-text">Get</span> the Law of the Day</h2>
  </div>
  <div class="section-subheader">
    <p class="section-subtitle">One law in your inbox each morning. Confirm your address once, unsubscribe from any email.</p>
  </div>
  <div class="section-body">
    <form class="not-found-search-form" data-daily-email-form aria-label="Subscribe to the daily law email">
      <input type="email" name="email" class="form-control" placeholder="you@example.com" aria-label="Email address" autocomplete="email" maxlength="254" required>
      <button type="submit" class="btn primary"><span class="btn-text">Subscribe</span></button>
    </form>
    <p class="small" role="status" data-daily-email-status></p>
  </div>
`;

/** Home page signup for the daily Law of the Day email (double opt-in, confirmed from the first email). */
export function DailyEmailSignup(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section card card--section section-card mb-12';
  section.setAttribute('data-home-zone', 'daily-email');
  section.setAttribute('aria-labelledby', 'daily-email-heading');
  section.innerHTML = FORM_HTML;

  const form = section.querySelector<HTMLFormElement>('[data-daily-email-form]')!;
  const input = form.querySelector<HTMLInputElement>('input[name="email"]')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const status = section.querySelector<HTMLElement>('[data-daily-email-status]')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    button.disabled = true;
    status.textContent = 'Sending the confirmation email...';
    try {
      await apiPost('/api/v1/subscriptions', { email });
      trackProductEvent('subscribe.email', { surface: 'home', result: 'requested' });
      status.textContent = 'Check your inbox and confirm your address to start the daily email.';
      form.reset();
    } catch {
      trackProductEvent('subscribe.email', { surface: 'home', result: 'error' });
      status.textContent = 'The subscription could not be started. Check the address and try again in a minute.';
    } finally {
      button.disabled = false;
    }
  });

  return section;
}
