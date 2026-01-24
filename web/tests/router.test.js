import { defineRoute, navigate, currentRoute, routes, startRouter, forceRender } from '../src/router.js';

describe('Router', () => {
  beforeEach(() => {
    // Clear routes and reset path
    Object.keys(routes).forEach(key => delete routes[key]);
    history.replaceState(null, '', '/');
    // Mock window.scrollTo for jsdom
    window.scrollTo = () => {};
  });

  it('defines and stores routes', () => {
    const mockRender = () => document.createElement('div');
    defineRoute('test', mockRender);
    expect(routes['test']).toBe(mockRender);
  });

  it('navigates to a category route', () => {
    navigate('category', 'computers');
    expect(location.pathname).toBe('/category/computers');
  });

  it('navigates to a generic route', () => {
    navigate('about');
    expect(location.pathname).toBe('/about');
  });

  it('navigates to a generic route with param', () => {
    navigate('search', 'query');
    expect(location.pathname).toBe('/search/query');
  });

  it('does not push state when navigating to current path', () => {
    navigate('browse');
    const spy = vi.spyOn(history, 'pushState');
    navigate('browse');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('parses category route', () => {
    history.replaceState(null, '', '/category/computers');
    const route = currentRoute();
    expect(route.name).toBe('category');
    expect(route.param).toBe('computers');
  });

  it('parses calculator route with sods-law param', () => {
    history.replaceState(null, '', '/calculator/sods-law');
    const route = currentRoute();
    expect(route.name).toBe('calculator');
    expect(route.param).toBe('sods-law');
  });

  it('parses calculator route with buttered-toast param', () => {
    history.replaceState(null, '', '/calculator/buttered-toast');
    const route = currentRoute();
    expect(route.name).toBe('calculator');
    expect(route.param).toBe('buttered-toast');
  });

  it('parses generic route', () => {
    history.replaceState(null, '', '/about');
    const route = currentRoute();
    expect(route.name).toBe('about');
    expect(route.param).toBeNull();
  });

  it('parses categories route', () => {
    history.replaceState(null, '', '/categories');
    const route = currentRoute();
    expect(route.name).toBe('categories');
    expect(route.param).toBeNull();
  });

  it('parses index.html as home', () => {
    history.replaceState(null, '', '/index.html');
    const route = currentRoute();
    expect(route.name).toBe('home');
    expect(route.param).toBeNull();
  });

  it('navigates to home route by clearing path', () => {
    history.replaceState(null, '', '/browse');
    navigate('home');
    expect(location.pathname).toBe('/');
  });

  it('navigates to a route with parameter', () => {
    navigate('law', '123');
    expect(location.pathname).toBe('/law/123');
  });

  it('parses current route from path', () => {
    history.replaceState(null, '', '/browse');
    const route = currentRoute();
    expect(route.name).toBe('browse');
    expect(route.param).toBeNull();
  });

  it('parses route with parameter', () => {
    history.replaceState(null, '', '/law/123');
    const route = currentRoute();
    expect(route.name).toBe('law');
    expect(route.param).toBe('123');
  });

  it('defaults to home route when path is root', () => {
    history.replaceState(null, '', '/');
    const route = currentRoute();
    expect(route.name).toBe('home');
    expect(route.param).toBeNull();
  });

  it('parses hyphenated route names correctly', () => {
    history.replaceState(null, '', '/origin-story');
    const route = currentRoute();
    expect(route.name).toBe('origin-story');
    expect(route.param).toBeNull();
  });

  it('navigates to hyphenated routes', () => {
    navigate('origin-story');
    expect(location.pathname).toBe('/origin-story');
  });

  it('starts router and renders initial route', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    let renderCount = 0;
    defineRoute('home', () => {
      renderCount++;
      const el = document.createElement('div');
      el.textContent = 'Home';
      return el;
    });

    startRouter(rootEl);

    expect(renderCount).toBe(1);
    expect(rootEl.textContent).toBe('Home');

    document.body.removeChild(rootEl);
  });

  it('calls cleanup functions when navigating away', async () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    let cleanupCalled = false;
    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home';
      el.cleanup = () => { cleanupCalled = true; };
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      el.textContent = 'Browse';
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    // Simulate navigation
    navigate('browse');

    expect(cleanupCalled).toBe(true);
    expect(rootEl.textContent).toBe('Browse');
    document.body.removeChild(rootEl);
  });

  it('forceRender re-renders current route', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    let renderCount = 0;
    defineRoute('home', () => {
      renderCount++;
      const el = document.createElement('div');
      el.textContent = `Home ${renderCount}`;
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    expect(renderCount).toBe(1);

    forceRender();

    expect(renderCount).toBe(2);
    expect(rootEl.textContent).toBe('Home 2');

    document.body.removeChild(rootEl);
  });

  it('scrolls to top when navigating', async () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home';
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      el.textContent = 'Browse';
      return el;
    });

    // Set scroll position
    window.scrollTo(0, 100);

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    navigate('browse');

    expect(window.scrollY).toBe(0);
    document.body.removeChild(rootEl);
  });

  it('sets focus on main content after navigation (WCAG 2.4.3)', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      const main = document.createElement('main');
      main.textContent = 'Home content';
      el.appendChild(main);
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      const main = document.createElement('main');
      main.textContent = 'Browse content';
      el.appendChild(main);
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    // Navigate to browse
    navigate('browse');

    // Main element should have tabindex for programmatic focus
    const main = rootEl.querySelector('main');
    expect(main.getAttribute('tabindex')).toBe('-1');

    document.body.removeChild(rootEl);
  });

  it('sets focus on element with role="main" if main tag not found', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      const mainDiv = document.createElement('div');
      mainDiv.setAttribute('role', 'main');
      mainDiv.textContent = 'Home content';
      el.appendChild(mainDiv);
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    const mainDiv = rootEl.querySelector('[role="main"]');
    expect(mainDiv.getAttribute('tabindex')).toBe('-1');

    document.body.removeChild(rootEl);
  });

  it('handles cleanup function errors gracefully', async () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);


    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home';
      el.cleanup = () => { throw new Error('Cleanup failed'); };
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      el.textContent = 'Browse';
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    navigate('browse');

    // Should still navigate despite cleanup error
    expect(rootEl.textContent).toBe('Browse');

    document.body.removeChild(rootEl);
  });

  it('calls cleanup on child elements with cleanup functions', async () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    let childCleanupCalled = false;

    defineRoute('home', () => {
      const el = document.createElement('div');
      const child = document.createElement('span');
      child.textContent = 'Child';
      child.cleanup = () => { childCleanupCalled = true; };
      el.appendChild(child);
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      el.textContent = 'Browse';
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    navigate('browse');

    expect(childCleanupCalled).toBe(true);
    document.body.removeChild(rootEl);
  });

  it('handles non-function cleanup values gracefully', async () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home';
      el.cleanup = 'not a function'; // Invalid cleanup value
      return el;
    });

    defineRoute('browse', () => {
      const el = document.createElement('div');
      el.textContent = 'Browse';
      return el;
    });

    history.replaceState(null, '', '/');
    startRouter(rootEl);

    navigate('browse');

    // Should still navigate successfully
    expect(rootEl.textContent).toBe('Browse');
    document.body.removeChild(rootEl);
  });

  it('renders notFound when route is not defined', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home Page';
      return el;
    });

    const notFound = () => {
      const el = document.createElement('div');
      el.textContent = '404';
      return el;
    };

    // Navigate to a valid route name that doesn't exist in routes
    // But we are using Paths now. So /undefined-route
    history.replaceState(null, '', '/undefined-route');
    startRouter(rootEl, notFound);

    // Should render notFound route
    expect(rootEl.textContent).toBe('404');
    document.body.removeChild(rootEl);
  });

  it('falls back to home route when no notFoundRender provided and route not defined', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home Fallback';
      return el;
    });

    // Navigate to an undefined route without notFoundRender
    history.replaceState(null, '', '/nonexistent-page');
    startRouter(rootEl); // No notFoundRender provided

    // Should fall back to home route
    expect(rootEl.textContent).toBe('Home Fallback');
    document.body.removeChild(rootEl);
  });
});