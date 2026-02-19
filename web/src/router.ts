// Simple History API router
// Routes map path -> render function
import * as Sentry from '@sentry/browser';
import type { CleanableElement, RouteInfo, RouteRenderFn } from './types/app.d.ts';

export const routes: Record<string, RouteRenderFn> = {};

export function defineRoute(name: string, renderFn: RouteRenderFn): void {
  routes[name] = renderFn;
}

const BASE_PATH = ''; // Change this if deploying to a subdirectory

export function navigate(name: string, param?: string): void {
  const base = BASE_PATH || '';
  let path: string;

  if (name === 'home') {
    path = base + '/';
  } else if (name === 'law' && param) {
    path = `${base}/law/${param}`;
  } else if (name === 'category' && param) {
    path = `${base}/category/${param}`;
  } else {
    path = `${base}/${name}${param ? '/' + param : ''}`;
  }

  // Avoid pushing the same state twice
  if (location.pathname !== path) {
    history.pushState({ name, param }, '', path);
  }
  
  // Manually trigger render
  if (renderFn) {
    renderFn();
  } else {
    Sentry.captureMessage('navigate() called before startRouter() was initialized. Navigation will not render.', 'warning');
  }
}

// Exported for testing
export function currentRoute(): RouteInfo {
  const path = location.pathname;
  
  // Home
  if (path === '/' || path === '/index.html') {
    return { name: 'home', param: null };
  }

  // Specific routes
  // Match /law/murphys-computers-laws
  const lawMatch = path.match(/^\/law\/([^/]+)/);
  if (lawMatch) {
    return { name: 'law', param: lawMatch[1] };
  }

  // Match /category/some-category
  const catMatch = path.match(/^\/category\/([^/]+)/);
  if (catMatch) {
    return { name: 'category', param: catMatch[1] };
  }

  // Match /calculator/sods-law or /calculator/buttered-toast
  const calcMatch = path.match(/^\/calculator\/([^/]+)/);
  if (calcMatch) {
    return { name: 'calculator', param: calcMatch[1] };
  }

  // Generic match for top-level routes like /browse, /about, /submit
  const genericMatch = path.match(/^\/([^/]+)/);
  if (genericMatch) {
    return { name: genericMatch[1], param: null };
  }

  return { name: 'home', param: null };
}

let renderFn: (() => void) | null = null;
let currentCleanup: (() => void)[] = [];

export function startRouter(rootEl: HTMLElement, notFoundRender: RouteRenderFn | null = null): void {
  function render() {
    // Call cleanup functions from previous render
    currentCleanup.forEach(fn => {
      if (typeof fn === 'function') {
        try {
          fn();
        } catch {
          // Silently handle cleanup errors
        }
      }
    });
    currentCleanup = [];

    const { name, param } = currentRoute();
    const fn = routes[name] || notFoundRender || routes['home'];

    if (!fn) {
      console.error('No render function for route:', name);
      return;
    }

    rootEl.innerHTML = '';
    const newContent = fn({ param });
    rootEl.appendChild(newContent);

    // Collect cleanup functions from the new content
    const elementsWithCleanup = newContent.querySelectorAll('*');
    elementsWithCleanup.forEach(el => {
      const cleanable = el as CleanableElement;
      if (typeof cleanable.cleanup === 'function') {
        currentCleanup.push(cleanable.cleanup);
      }
    });

    // Check the root element itself
    const cleanableContent = newContent as CleanableElement;
    if (typeof cleanableContent.cleanup === 'function') {
      currentCleanup.push(cleanableContent.cleanup);
    }

    window.scrollTo(0, 0);

    // Move focus to main content for screen readers (WCAG 2.4.3)
    const mainContent = newContent.querySelector('main') || newContent.querySelector('[role="main"]');
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus({ preventScroll: true });
    }
  }
  
  renderFn = render;
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', render);
  
  // Initial render
  render();
}

// Force a re-render of the current route
export function forceRender(): void {
  if (renderFn) {
    renderFn();
  }
}
