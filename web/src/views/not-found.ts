import templateHtml from '@views/templates/not-found.html?raw';
import { hydrateIcons } from '@utils/icons.ts';
import type { OnNavigate } from '../types/app.d.ts';

export function NotFound({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page pt-0';
  el.innerHTML = templateHtml;
  
  // Hydrate icons
  hydrateIcons(el);

  // Template always provides search form and input
  const searchForm = el.querySelector('#not-found-search-form')!;
  const searchInput = el.querySelector('#not-found-search-input')!;
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = (searchInput as HTMLInputElement).value.trim();
    if (query) {
      onNavigate('browse');
      sessionStorage.setItem('searchQuery', query);
    }
  });

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      const navParam = navBtn.getAttribute('data-param');
      if (navTarget) {
        onNavigate(navTarget, navParam || undefined);
      }
    }
  });

  return el;
}
