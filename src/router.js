// Simple hash-based router
// Routes map hash -> render function
export const routes = {};

export function defineRoute(name, renderFn) {
  routes[name] = renderFn;
}

export function navigate(name, param) {
  const suffix = param ? `:${param}` : '';
  location.hash = `#/${name}${suffix}`;
}

export function currentRoute() {
  const m = location.hash.match(/^#\/(\w+)(?::(.+))?$/);
  return m ? { name: m[1], param: m[2] || null } : { name: 'home', param: null };
}

let renderFn = null;

export function startRouter(rootEl) {
  function render() {
    const { name, param } = currentRoute();
    const fn = routes[name] || routes['home'];
    rootEl.innerHTML = '';
    rootEl.appendChild(fn({ param }));
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
