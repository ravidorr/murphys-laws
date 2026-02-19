// DOM utilities and event listener management
import { hydrateIcons } from './icons.ts';
import { renderLinkButtonHTML } from './button.ts';

interface SocialMetaOptions {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

/**
 * Updates the meta description tag
 */
export function updateMetaDescription(description: string): void {
  if (typeof document === 'undefined' || !description) return;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute('content', description);
  }
}

/**
 * Creates an error state element with ARIA live region
 */
export function createErrorState(message = 'Something went wrong. Please try again.'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'error-state';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `
    <section class="section section-card">
      <div class="section-header">
        <h3 class="section-title">
          <span class="icon" data-icon="warning" aria-hidden="true"></span>
          <span class="accent-text">Connection</span> Error
        </h3>
      </div>
      <div class="section-body text-center">
        <p class="small mb-4">${message}</p>
      </div>
      <div class="section-footer">
        <div class="left"></div>
        <div class="right">
          <button class="btn outline" onclick="window.location.reload()">
            <span class="icon" data-icon="refresh" aria-hidden="true"></span>
            <span class="btn-text">Retry</span>
          </button>
          ${renderLinkButtonHTML({ href: '/', text: 'Go Home', icon: 'home' })}
        </div>
      </div>
    </section>
  `;
  hydrateIcons(el);
  return el;
}

/**
 * Updates Open Graph and Twitter Card meta tags for social sharing
 */
export function updateSocialMetaTags({ title, description, url, image }: SocialMetaOptions): void {
  if (typeof document === 'undefined') return;

  const head = document.head;

  // Update Open Graph tags
  const ogTitle = head.querySelector('meta[property="og:title"]');
  const ogDescription = head.querySelector('meta[property="og:description"]');
  const ogUrl = head.querySelector('meta[property="og:url"]');
  const ogImage = head.querySelector('meta[property="og:image"]');

  if (ogTitle && title) ogTitle.setAttribute('content', title);
  if (ogDescription && description) ogDescription.setAttribute('content', description);
  if (ogUrl && url) ogUrl.setAttribute('content', url);
  if (ogImage && image) ogImage.setAttribute('content', image);

  // Update Twitter Card tags
  const twitterTitle = head.querySelector('meta[property="twitter:title"]');
  const twitterDescription = head.querySelector('meta[property="twitter:description"]');
  const twitterUrl = head.querySelector('meta[property="twitter:url"]');
  const twitterImage = head.querySelector('meta[property="twitter:image"]');

  if (twitterTitle && title) twitterTitle.setAttribute('content', title);
  if (twitterDescription && description) twitterDescription.setAttribute('content', description);
  if (twitterUrl && url) twitterUrl.setAttribute('content', url);
  if (twitterImage && image) twitterImage.setAttribute('content', image);

  // Update document title
  if (title) document.title = title;
}
