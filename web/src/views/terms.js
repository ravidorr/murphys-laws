import { getPageContent } from '@utils/markdown-content.js';

export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = getPageContent('terms');

  el.addEventListener('click', (event) => {
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
