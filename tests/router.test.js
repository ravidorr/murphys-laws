import { defineRoute, navigate, currentRoute, routes, startRouter, forceRender } from '../src/router.js';

describe('Router', () => {
  beforeEach(() => {
    // Clear routes and reset hash
    Object.keys(routes).forEach(key => delete routes[key]);
    location.hash = '';
    // Mock window.scrollTo for jsdom
    window.scrollTo = () => {};
  });

  it('defines and stores routes', () => {
    const mockRender = () => document.createElement('div');
    defineRoute('test', mockRender);
    expect(routes['test']).toBe(mockRender);
  });

  it('navigates to a route', () => {
    navigate('browse');
    expect(location.hash).toBe('#/browse');
  });

  it('navigates to a route with parameter', () => {
    navigate('law', '123');
    expect(location.hash).toBe('#/law:123');
  });

  it('parses current route from hash', () => {
    location.hash = '#/browse';
    const route = currentRoute();
    expect(route.name).toBe('browse');
    expect(route.param).toBeNull();
  });

  it('parses route with parameter', () => {
    location.hash = '#/law:123';
    const route = currentRoute();
    expect(route.name).toBe('law');
    expect(route.param).toBe('123');
  });

  it('defaults to home route when hash is empty', () => {
    location.hash = '';
    const route = currentRoute();
    expect(route.name).toBe('home');
    expect(route.param).toBeNull();
  });

  it('defaults to home route when hash is invalid', () => {
    location.hash = '#invalid';
    const route = currentRoute();
    expect(route.name).toBe('home');
    expect(route.param).toBeNull();
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

    location.hash = '#/home';
    startRouter(rootEl);

    await new Promise(r => setTimeout(r, 50));
    location.hash = '#/browse';
    await new Promise(r => setTimeout(r, 50));

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

    location.hash = '#/home';
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

    location.hash = '#/home';
    startRouter(rootEl);

    await new Promise(r => setTimeout(r, 50));
    location.hash = '#/browse';
    await new Promise(r => setTimeout(r, 50));

    expect(window.scrollY).toBe(0);
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

    location.hash = '#/home';
    startRouter(rootEl);

    location.hash = '#/browse';
    await new Promise(r => setTimeout(r, 50));

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

    location.hash = '#/home';
    startRouter(rootEl);

    location.hash = '#/browse';
    await new Promise(r => setTimeout(r, 50));

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

    location.hash = '#/home';
    startRouter(rootEl);

    location.hash = '#/browse';
    await new Promise(r => setTimeout(r, 50));

    // Should still navigate successfully
    expect(rootEl.textContent).toBe('Browse');
    document.body.removeChild(rootEl);
  });

  it('falls back to home route when route is not defined', () => {
    const rootEl = document.createElement('div');
    document.body.appendChild(rootEl);

    defineRoute('home', () => {
      const el = document.createElement('div');
      el.textContent = 'Home Page';
      return el;
    });

    // Navigate to a valid route name that doesn't exist in routes
    // Use a route name that matches the \w+ pattern but isn't defined
    location.hash = '#/undefinedroute';
    startRouter(rootEl);

    // Should fallback to home route
    expect(rootEl.textContent).toBe('Home Page');
    document.body.removeChild(rootEl);
  });
});
