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

  it('calls cleanup functions when navigating away', (done) => {
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

    setTimeout(() => {
      location.hash = '#/browse';

      setTimeout(() => {
        expect(cleanupCalled).toBe(true);
        expect(rootEl.textContent).toBe('Browse');
        document.body.removeChild(rootEl);
        done();
      }, 50);
    }, 50);
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

  it('scrolls to top when navigating', (done) => {
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

    setTimeout(() => {
      location.hash = '#/browse';

      setTimeout(() => {
        expect(window.scrollY).toBe(0);
        document.body.removeChild(rootEl);
        done();
      }, 50);
    }, 50);
  });
});
