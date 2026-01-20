import { createErrorState, createLoadingPlaceholder, wrapLoadingMarkup, updateSocialMetaTags } from '../src/utils/dom.js';

describe('DOM utilities', () => {
  describe('createErrorState', () => {
    it('creates error element with default message', () => {
      const el = createErrorState();

      expect(el.className).toBe('error-state');
      expect(el.getAttribute('role')).toBe('alert');
      expect(el.getAttribute('aria-live')).toBe('assertive');
      expect(el.textContent).toContain('Something went wrong. Please try again.');
    });

    it('creates error element with custom message', () => {
      const el = createErrorState('Something went wrong!');

      expect(el.textContent).toContain('Something went wrong!');
    });
  });

  describe('createLoadingPlaceholder', () => {
    it('creates loading placeholder with random message when no message provided', () => {
      const el = createLoadingPlaceholder();

      expect(el.className).toBe('loading-placeholder');
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      expect(el.querySelector('p.small')).toBeTruthy();
      expect(el.querySelector('p.small').textContent).toBeTruthy();
    });

    it('creates loading placeholder with custom message', () => {
      const el = createLoadingPlaceholder('Loading...');

      expect(el.querySelector('p.small').textContent).toBe('Loading...');
    });
  });

  describe('wrapLoadingMarkup', () => {
    it('wraps custom markup', () => {
      const result = wrapLoadingMarkup('<p>Custom content</p>');

      expect(result).toContain('loading-placeholder');
      expect(result).toContain('Custom content');
      expect(result).toContain('role="status"');
      expect(result).toContain('aria-live="polite"');
    });

    it('uses random message when no markup provided', () => {
      const result = wrapLoadingMarkup();

      expect(result).toContain('loading-placeholder');
      expect(result).toContain('role="status"');
      expect(result).toContain('aria-live="polite"');
    });
  });

  describe('updateSocialMetaTags', () => {
    beforeEach(() => {
      // Create a minimal head with meta tags
      document.head.innerHTML = `
        <meta property="og:title" content="">
        <meta property="og:description" content="">
        <meta property="og:url" content="">
        <meta property="og:image" content="">
        <meta property="twitter:title" content="">
        <meta property="twitter:description" content="">
        <meta property="twitter:url" content="">
        <meta property="twitter:image" content="">
      `;
    });

    afterEach(() => {
      document.head.innerHTML = '';
    });

    it('updates all meta tags when provided', () => {
      updateSocialMetaTags({
        title: 'Test Title',
        description: 'Test Description',
        url: 'https://test.com',
        image: 'https://test.com/image.png'
      });

      expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Test Title');
      expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe('Test Description');
      expect(document.querySelector('meta[property="og:url"]').getAttribute('content')).toBe('https://test.com');
      expect(document.querySelector('meta[property="og:image"]').getAttribute('content')).toBe('https://test.com/image.png');
      expect(document.querySelector('meta[property="twitter:title"]').getAttribute('content')).toBe('Test Title');
      expect(document.querySelector('meta[property="twitter:description"]').getAttribute('content')).toBe('Test Description');
      expect(document.querySelector('meta[property="twitter:url"]').getAttribute('content')).toBe('https://test.com');
      expect(document.querySelector('meta[property="twitter:image"]').getAttribute('content')).toBe('https://test.com/image.png');
      expect(document.title).toBe('Test Title');
    });

    it('updates only provided fields', () => {
      document.title = 'Original Title';
      updateSocialMetaTags({
        title: 'New Title',
        description: 'New Description'
      });

      expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('New Title');
      expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe('New Description');
      expect(document.title).toBe('New Title');
    });

    it('handles missing meta tags gracefully', () => {
      document.head.innerHTML = '';

      expect(() => {
        updateSocialMetaTags({
          title: 'Test Title',
          description: 'Test Description',
          url: 'https://test.com',
          image: 'https://test.com/image.png'
        });
      }).not.toThrow();
    });

    it('does nothing when document is undefined (SSR)', () => {
      const savedDocument = global.document;
      delete global.document;

      expect(() => {
        updateSocialMetaTags({
          title: 'Test Title'
        });
      }).not.toThrow();

      global.document = savedDocument;
    });

    it('skips updating when value is missing', () => {
      document.head.innerHTML = '<meta property="og:title" content="Original">';
      
      updateSocialMetaTags({
        title: null,
        description: undefined
      });

      expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Original');
    });
  });
});
