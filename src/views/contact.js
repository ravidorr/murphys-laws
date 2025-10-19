import templateHtml from '@views/templates/contact.html?raw';

export function Contact({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  el.innerHTML = templateHtml;

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.dataset.nav) {
      e.preventDefault();
      onNavigate(target.dataset.nav);
    }
  });

  return el;
}
