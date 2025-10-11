// Simple hash-based router
// Routes map hash -> render function - exported for testing
export const routes = {};

export function defineRoute(name, renderFn) {
  routes[name] = renderFn;
}

export function navigate(name, param) {
  const suffix = param ? `:${param}` : '';
  location.hash = `#/${name}${suffix}`;
}

// Exported for testing
export function currentRoute() {
  const m = location.hash.match(/^#\/(\w+)(?::(.+))?$/);
  return m ? { name: m[1], param: m[2] || null } : { name: 'home', param: null };
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
  }
  renderFn = render;
  window.addEventListener('hashchange', render);
  render();
}

// Force a re-render of the current route
export function forceRender() {
  if (renderFn) {
    renderFn();
  }
}
