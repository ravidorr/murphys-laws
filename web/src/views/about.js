import { getPageContent } from '@utils/markdown-content.js';
import { triggerAdSense } from '../utils/ads.js';
import { SITE_NAME } from '@utils/constants.js';

export function About({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  // Set page title
  document.title = `About | ${SITE_NAME}`;

  el.innerHTML = getPageContent('about');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  return el;
}
