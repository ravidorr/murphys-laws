import { createLoading, renderLoadingHTML } from '../src/components/loading.js';
import { LOADING_MESSAGES } from '../src/utils/constants.js';

interface LoadingTestContext {
  el?: Element;
  html?: string;
  domEl?: HTMLElement;
  htmlEl?: Element | null;
}

describe('Loading Component', () => {
  describe('createLoading', () => {
    it('creates loading element with random message when no options provided', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading();

      expect(localThis.el.className).toBe('loading-placeholder');
      expect(localThis.el.getAttribute('role')).toBe('status');
      expect(localThis.el.getAttribute('aria-live')).toBe('polite');
      expect(localThis.el.querySelector('p.small')).toBeTruthy();
      // Message should be one of the loading messages
      const text = localThis.el.querySelector('p.small').textContent;
      expect(LOADING_MESSAGES).toContain(text);
    });

    it('creates loading element with custom message', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({ message: 'Custom loading...' });

      expect(localThis.el.querySelector('p.small').textContent).toBe('Custom loading...');
    });

    it('creates loading element with default size', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading();

      expect(localThis.el.className).toBe('loading-placeholder');
      expect(localThis.el.classList.contains('size-default')).toBe(false);
    });

    it('creates loading element with small size', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({ size: 'small' });

      expect(localThis.el.classList.contains('loading-placeholder')).toBe(true);
      expect(localThis.el.classList.contains('size-small')).toBe(true);
    });

    it('creates loading element with large size', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({ size: 'large' });

      expect(localThis.el.classList.contains('loading-placeholder')).toBe(true);
      expect(localThis.el.classList.contains('size-large')).toBe(true);
    });

    it('ignores invalid size and uses default', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({ size: 'invalid' as 'small' | 'default' | 'large' });

      expect(localThis.el.className).toBe('loading-placeholder');
      expect(localThis.el.classList.contains('size-invalid')).toBe(false);
    });

    it('adds custom aria-label when provided', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({ ariaLabel: 'Loading content' });

      expect(localThis.el.getAttribute('aria-label')).toBe('Loading content');
    });

    it('does not add aria-label when not provided', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading();

      expect(localThis.el.hasAttribute('aria-label')).toBe(false);
    });

    it('handles all options together', () => {
      const localThis: LoadingTestContext = {};
      localThis.el = createLoading({
        message: 'Loading laws...',
        size: 'large',
        ariaLabel: 'Loading law list'
      });

      expect(localThis.el.classList.contains('loading-placeholder')).toBe(true);
      expect(localThis.el.classList.contains('size-large')).toBe(true);
      expect(localThis.el.querySelector('p.small').textContent).toBe('Loading laws...');
      expect(localThis.el.getAttribute('aria-label')).toBe('Loading law list');
      expect(localThis.el.getAttribute('role')).toBe('status');
      expect(localThis.el.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('renderLoadingHTML', () => {
    it('renders HTML string with random message when no options provided', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML();

      expect(localThis.html).toContain('class="loading-placeholder"');
      expect(localThis.html).toContain('role="status"');
      expect(localThis.html).toContain('aria-live="polite"');
      expect(localThis.html).toContain('<p class="small">');
    });

    it('renders HTML string with custom message', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({ message: 'Loading data...' });

      expect(localThis.html).toContain('Loading data...');
    });

    it('renders HTML string with default size', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML();

      expect(localThis.html).toContain('class="loading-placeholder"');
      expect(localThis.html).not.toContain('size-default');
    });

    it('renders HTML string with small size', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({ size: 'small' });

      expect(localThis.html).toContain('loading-placeholder size-small');
    });

    it('renders HTML string with large size', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({ size: 'large' });

      expect(localThis.html).toContain('loading-placeholder size-large');
    });

    it('renders HTML string with custom aria-label', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({ ariaLabel: 'Loading categories' });

      expect(localThis.html).toContain('aria-label="Loading categories"');
    });

    it('renders valid HTML that can be inserted into DOM', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({ message: 'Test message' });
      
      const container = document.createElement('div');
      container.innerHTML = localThis.html;
      localThis.el = container.firstElementChild;

      expect(localThis.el.className).toBe('loading-placeholder');
      expect(localThis.el.getAttribute('role')).toBe('status');
      expect(localThis.el.querySelector('p.small').textContent).toBe('Test message');
    });

    it('handles all options together', () => {
      const localThis: LoadingTestContext = {};
      localThis.html = renderLoadingHTML({
        message: 'Loading categories...',
        size: 'small',
        ariaLabel: 'Loading category list'
      });

      expect(localThis.html).toContain('loading-placeholder size-small');
      expect(localThis.html).toContain('Loading categories...');
      expect(localThis.html).toContain('aria-label="Loading category list"');
      expect(localThis.html).toContain('role="status"');
      expect(localThis.html).toContain('aria-live="polite"');
    });
  });

  describe('consistency between createLoading and renderLoadingHTML', () => {
    it('produces equivalent output structure', () => {
      const localThis: LoadingTestContext = {};
      const options = { message: 'Loading...', size: 'small' as const, ariaLabel: 'Test' };

      localThis.domEl = createLoading(options);
      localThis.html = renderLoadingHTML(options);
      
      const container = document.createElement('div');
      container.innerHTML = localThis.html;
      localThis.htmlEl = container.firstElementChild;

      // Compare key attributes
      expect(localThis.domEl.className).toBe(localThis.htmlEl.className);
      expect(localThis.domEl.getAttribute('role')).toBe(localThis.htmlEl.getAttribute('role'));
      expect(localThis.domEl.getAttribute('aria-live')).toBe(localThis.htmlEl.getAttribute('aria-live'));
      expect(localThis.domEl.getAttribute('aria-label')).toBe(localThis.htmlEl.getAttribute('aria-label'));
      expect(localThis.domEl.querySelector('p.small').textContent).toBe(
        localThis.htmlEl.querySelector('p.small').textContent
      );
    });
  });
});
