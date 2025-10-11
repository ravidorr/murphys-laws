import { createErrorState } from '../src/utils/dom.js';

describe('DOM utilities', () => {
  describe('createErrorState', () => {
    it('creates error element with default message', () => {
      const el = createErrorState();

      expect(el.className).toBe('error-state');
      expect(el.getAttribute('role')).toBe('alert');
      expect(el.getAttribute('aria-live')).toBe('assertive');
      expect(el.textContent).toContain('An error occurred.');
    });

    it('creates error element with custom message', () => {
      const el = createErrorState('Something went wrong!');

      expect(el.textContent).toContain('Something went wrong!');
    });
  });
});
