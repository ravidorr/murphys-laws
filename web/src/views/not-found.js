import templateHtml from '@views/templates/not-found.html?raw';

export function NotFound({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page pt-0';
  el.innerHTML = templateHtml;

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  return el;
}
