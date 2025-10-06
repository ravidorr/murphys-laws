import {
  createComponent,
  addGlobalListener,
  addAbortableListener,
  createLoadingState,
  createErrorState,
  setLoadingState
} from '../src/utils/dom.js';

describe('DOM utilities', () => {
  describe('createComponent', () => {
    it('creates element with default tag', () => {
      const el = createComponent();
      expect(el.tagName).toBe('DIV');
    });

    it('creates element with custom tag', () => {
      const el = createComponent('section');
      expect(el.tagName).toBe('SECTION');
    });

    it('sets className when provided', () => {
      const el = createComponent('div', { className: 'test-class' });
      expect(el.className).toBe('test-class');
    });

    it('sets innerHTML when provided', () => {
      const el = createComponent('div', { innerHTML: '<p>Test</p>' });
      expect(el.innerHTML).toBe('<p>Test</p>');
    });

    it('has cleanup method', () => {
      const el = createComponent();
      expect(typeof el.cleanup).toBe('function');
    });

    it('tracks event listeners', () => {
      const el = createComponent();
      const handler = () => {};

      el.addEventListener('click', handler);

      // Verify listener was added (it should work)
      el.click();
      expect(el.cleanup).toBeDefined();
    });

    it('removes event listeners on cleanup', () => {
      const el = createComponent();
      let clickCount = 0;
      const handler = () => { clickCount++; };

      el.addEventListener('click', handler);
      el.click();
      expect(clickCount).toBe(1);

      el.cleanup();
      el.click();
      expect(clickCount).toBe(1); // Should not increment
    });

    it('handles multiple event listeners', () => {
      const el = createComponent();
      let count1 = 0;
      let count2 = 0;

      el.addEventListener('click', () => { count1++; });
      el.addEventListener('mouseenter', () => { count2++; });

      el.click();
      el.dispatchEvent(new Event('mouseenter'));
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      el.cleanup();
      el.click();
      el.dispatchEvent(new Event('mouseenter'));
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe('addGlobalListener', () => {
    it('adds event listener to target', () => {
      const target = document.createElement('div');
      let clicked = false;

      addGlobalListener(target, 'click', () => { clicked = true; });
      target.click();

      expect(clicked).toBe(true);
    });

    it('returns cleanup function', () => {
      const target = document.createElement('div');
      let clickCount = 0;

      const cleanup = addGlobalListener(target, 'click', () => { clickCount++; });

      expect(typeof cleanup).toBe('function');

      target.click();
      expect(clickCount).toBe(1);

      cleanup();
      target.click();
      expect(clickCount).toBe(1);
    });

    it('works with window and document', () => {
      let windowClicked = false;
      let docClicked = false;

      const cleanup1 = addGlobalListener(window, 'custom-event', () => { windowClicked = true; });
      const cleanup2 = addGlobalListener(document, 'custom-event', () => { docClicked = true; });

      window.dispatchEvent(new Event('custom-event'));
      document.dispatchEvent(new Event('custom-event'));

      expect(windowClicked).toBe(true);
      expect(docClicked).toBe(true);

      cleanup1();
      cleanup2();
    });
  });

  describe('addAbortableListener', () => {
    it('adds event listener with abort signal', () => {
      const target = document.createElement('div');
      const controller = new AbortController();
      let clicked = false;

      addAbortableListener(target, 'click', () => { clicked = true; }, controller.signal);
      target.click();

      expect(clicked).toBe(true);
    });

    it('removes listener when signal is aborted', () => {
      const target = document.createElement('div');
      const controller = new AbortController();
      let clickCount = 0;

      addAbortableListener(target, 'click', () => { clickCount++; }, controller.signal);

      target.click();
      expect(clickCount).toBe(1);

      controller.abort();

      target.click();
      expect(clickCount).toBe(1);
    });
  });

  describe('createLoadingState', () => {
    it('creates loading element with default message', () => {
      const el = createLoadingState();

      expect(el.className).toBe('loading-state');
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      expect(el.textContent).toContain('Loading...');
    });

    it('creates loading element with custom message', () => {
      const el = createLoadingState('Please wait...');

      expect(el.textContent).toContain('Please wait...');
    });
  });

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

  describe('setLoadingState', () => {
    it('sets loading state to true', () => {
      const el = document.createElement('div');

      setLoadingState(el, true);

      expect(el.getAttribute('aria-busy')).toBe('true');
      expect(el.querySelector('.loading-state')).toBeTruthy();
    });

    it('sets loading state to false', () => {
      const el = document.createElement('div');

      setLoadingState(el, true);
      setLoadingState(el, false);

      expect(el.getAttribute('aria-busy')).toBe('false');
      expect(el.querySelector('.loading-state')).toBeNull();
    });

    it('uses custom loading message', () => {
      const el = document.createElement('div');

      setLoadingState(el, true, 'Custom loading...');

      const loadingEl = el.querySelector('.loading-state');
      expect(loadingEl.textContent).toContain('Custom loading...');
    });

    it('does not create duplicate loading states', () => {
      const el = document.createElement('div');

      setLoadingState(el, true);
      setLoadingState(el, true);

      const loadingEls = el.querySelectorAll('.loading-state');
      expect(loadingEls.length).toBe(1);
    });

    it('removes loading state when set to false', () => {
      const el = document.createElement('div');

      setLoadingState(el, true, 'Loading data...');
      expect(el.querySelector('.loading-state')).toBeTruthy();

      setLoadingState(el, false);
      expect(el.querySelector('.loading-state')).toBeNull();
    });
  });
});
