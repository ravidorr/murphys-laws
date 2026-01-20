// Simple History API router
// Routes map path -> render function
export const routes = {};

export function defineRoute(name, renderFn) {
  routes[name] = renderFn;
}

const BASE_PATH = ''; // Change this if deploying to a subdirectory

export function navigate(name, param) {
  let path = BASE_PATH || '/';
  
  if (name === 'home') {
    path = '/';
  } else if (name === 'law' && param) {
    path = `/law/${param}`;
  } else if (name === 'category' && param) {
    path = `/category/${param}`;
  } else {
    // Generic fallback for other routes: /name or /name/param
    path = `/${name}${param ? '/' + param : ''}`;
  }

  // Avoid pushing the same state twice
  if (location.pathname !== path) {
    history.pushState({ name, param }, '', path);
  }
  
  // Manually trigger render
  if (renderFn) renderFn();
}

// Exported for testing
export function currentRoute() {
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

let renderFn = null;
let currentCleanup = [];

export function startRouter(rootEl, notFoundRender = null) {
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
    
    // Safety check: if route not found and we are not home, maybe 404?
    // But for now, if fn is null, we fallback to home or notFound as above.
    
    rootEl.innerHTML = '';
    const newContent = fn({ param });
    rootEl.appendChild(newContent);

    // Collect cleanup functions from the new content
    const elementsWithCleanup = newContent.querySelectorAll('*');
    elementsWithCleanup.forEach(el => {
      if (typeof el.cleanup === 'function') {
        currentCleanup.push(el.cleanup);
      }
    });

    // Check the root element itself
    if (typeof newContent.cleanup === 'function') {
      currentCleanup.push(newContent.cleanup);
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
export function forceRender() {
  if (renderFn) {
    renderFn();
  }
}
