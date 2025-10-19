import templateHtml from '@views/templates/privacy.html?raw';

export function Privacy({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  const lastUpdated = '2025-10-18';

  el.innerHTML = templateHtml.replace('{{lastUpdated}}', lastUpdated);

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.dataset.nav) {
      e.preventDefault();
      onNavigate(target.dataset.nav);
    }
  });

  return el;
}
