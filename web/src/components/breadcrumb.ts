import templateHtml from '@components/templates/breadcrumb.html?raw';
import { hydrateIcons } from '@utils/icons.ts';
import type { OnNavigate } from '../types/app.d.ts';

interface BreadcrumbItem {
  label: string;
  nav?: string;
  href?: string;
}

/**
 * Breadcrumb navigation component
 * @param {Object} options
 * @param {Array<{label: string, nav?: string, href?: string}>} options.items - Breadcrumb items (excluding Home)
 * @param {Function} options.onNavigate - Navigation handler
 * @returns {HTMLElement}
 */
export function Breadcrumb({ items = [], onNavigate }: { items?: BreadcrumbItem[]; onNavigate: OnNavigate }) {
  const container = document.createElement('div');
  container.innerHTML = templateHtml;

  // Template always has a root nav element.
  const nav = container.firstElementChild!;
  const list = nav.querySelector('.breadcrumb-list');
  const firstLi = list?.querySelector('.breadcrumb-item');

  function createSeparator(): HTMLSpanElement {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.setAttribute('aria-hidden', 'true');
    sep.innerHTML = '<span class="icon" data-icon="chevronRight"></span>';
    return sep;
  }

  // Add separator after "Home" when there are more items
  if (firstLi && items.length > 0) {
    firstLi.appendChild(createSeparator());
  }

  // Add additional breadcrumb items
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    li.appendChild(createSeparator());
    
    // Check if this is the last item (current page)
    const isLast = index === items.length - 1;
    
    if (isLast) {
      // Current page - not a link
      const span = document.createElement('span');
      span.className = 'breadcrumb-current';
      span.setAttribute('aria-current', 'page');
      span.textContent = item.label;
      li.appendChild(span);
    } else {
      // Intermediate page - link
      const link = document.createElement('a');
      link.className = 'breadcrumb-link';
      link.href = item.href || '#';
      if (item.nav) {
        link.setAttribute('data-nav', item.nav);
      }
      link.textContent = item.label;
      li.appendChild(link);
    }
    
    // Template always has .breadcrumb-list.
    list!.appendChild(li);
  });

  // Hydrate icons
  hydrateIcons(nav);
  
  // Handle navigation clicks
  nav.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    
    const link = target.closest('[data-nav]');
    if (link) {
      e.preventDefault();
      const navTarget = link.getAttribute('data-nav');
      if (navTarget && onNavigate) {
        onNavigate(navTarget);
      }
    }
  });
  
  return nav;
}
