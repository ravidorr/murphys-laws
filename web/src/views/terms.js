import { getPageContent } from '@utils/markdown-content.js';
import { triggerAdSense } from '../utils/ads.js';
import { SITE_NAME } from '@utils/constants.js';

export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  // Set page title
  document.title = `Terms of Service | ${SITE_NAME}`;

  el.innerHTML = getPageContent('terms');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
        return;
      }
    }
  });

  return el;
}
