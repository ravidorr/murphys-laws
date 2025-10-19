import templateHtml from '@views/templates/about.html?raw';

export function About({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = templateHtml;

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
