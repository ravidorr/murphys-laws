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
  
  const nav = container.firstElementChild;
  const list = nav.querySelector('.breadcrumb-list');
  
  // Add additional breadcrumb items
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    
    // Add separator
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.innerHTML = '<span class="icon" data-icon="chevronRight"></span>';
    li.appendChild(separator);
    
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
    
    list.appendChild(li);
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
