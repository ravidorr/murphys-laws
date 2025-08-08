import { currentRoute, navigate, defineRoute, routes } from '@src/router.js';

describe('router', () => {
  const localThis = {};

  beforeEach(() => {
    // Reset hash
    location.hash = '';
  });

  it('parses empty hash to home', () => {
    expect(currentRoute()).toEqual({ name: 'home', param: null });
  });

  it('parses name:param', () => {
    location.hash = '#/law:123';
    expect(currentRoute()).toEqual({ name: 'law', param: '123' });
  });

  it('navigate updates hash', () => {
    navigate('browse');
    expect(location.hash).toBe('#/browse');
  });

  it('defineRoute registers', () => {
    defineRoute('x', () => document.createElement('div'));
    expect(typeof routes.x).toBe('function');
  });
});


