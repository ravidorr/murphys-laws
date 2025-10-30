import templateHtml from '@views/templates/terms.html?raw';

export function Terms({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = templateHtml.replace('{{lastUpdated}}', lastUpdated);

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
