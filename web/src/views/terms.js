import { getPageContent } from '@utils/markdown-content.js';
import { triggerAdSense } from '../utils/ads.js';

export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = getPageContent('terms');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  el.addEventListener('click', (e) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      event.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  return el;
}
