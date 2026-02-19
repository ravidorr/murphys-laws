// @ts-nocheck
import { createIcon, hydrateIcons } from '../src/utils/icons.ts';

describe('Icons utility', () => {
  describe('createIcon', () => {
    it('creates a valid icon element', () => {
      const icon = createIcon('home');
      expect(icon).toBeTruthy();
      expect(icon.tagName).toBe('svg');
      expect(icon.getAttribute('viewBox')).toBe('0 0 640 640');
      expect(icon.getAttribute('fill')).toBe('currentColor');
      expect(icon.getAttribute('focusable')).toBe('false');
      expect(icon.getAttribute('data-icon-name')).toBe('home');
      expect(icon.classList.contains('icon')).toBe(true);
    });

    it('sets aria-hidden by default', () => {
      const icon = createIcon('search');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('does not set aria-hidden when labelled is true', () => {
      const icon = createIcon('search', { labelled: true });
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });

    it('handles the clear alias (maps to close)', () => {
      const clearIcon = createIcon('clear');
      const closeIcon = createIcon('close');
      expect(clearIcon.innerHTML).toBe(closeIcon.innerHTML);
      expect(clearIcon.getAttribute('data-icon-name')).toBe('clear');
    });

    it('returns null for invalid icon name', () => {
      const icon = createIcon('nonexistent-icon');
      expect(icon).toBeNull();
    });

    it('adds custom class names', () => {
      const icon = createIcon('email', { classNames: ['custom-class', 'another-class'] });
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.classList.contains('custom-class')).toBe(true);
      expect(icon.classList.contains('another-class')).toBe(true);
    });

    it('creates all icon types successfully', () => {
      const iconNames = [
        'arrowForward', 'checkCircle', 'close', 'copy', 'email', 'error',
        'facebook', 'home', 'link', 'linkedin', 'list', 'preview',
        'reddit', 'refresh', 'rss', 'search', 'searchOff', 'send',
        'share', 'thumbDown', 'thumbUp', 'twitter', 'warning',
        'whatsapp', 'sun', 'moon', 'sunMoon'
      ];

      iconNames.forEach(name => {
        const icon = createIcon(name);
        expect(icon).toBeTruthy();
        expect(icon.tagName).toBe('svg');
        expect(icon.getAttribute('data-icon-name')).toBe(name);
      });
    });

    it('creates theme-related icons with correct viewBox (Lucide style)', () => {
      const sunIcon = createIcon('sun');
      const moonIcon = createIcon('moon');
      const sunMoonIcon = createIcon('sunMoon');

      // All Lucide icons use 24x24 viewBox
      expect(sunIcon.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(moonIcon.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(sunMoonIcon.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('creates stroke-based icons with correct attributes (Lucide style)', () => {
      const sunIcon = createIcon('sun');

      expect(sunIcon.getAttribute('fill')).toBe('none');
      expect(sunIcon.getAttribute('stroke')).toBe('currentColor');
      expect(sunIcon.getAttribute('stroke-width')).toBe('2');
      expect(sunIcon.getAttribute('stroke-linecap')).toBe('round');
      expect(sunIcon.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('creates fill-based icons with correct attributes (Font Awesome style)', () => {
      const homeIcon = createIcon('home');

      expect(homeIcon.getAttribute('fill')).toBe('currentColor');
      expect(homeIcon.hasAttribute('stroke')).toBe(false);
    });

    it('handles empty classNames array', () => {
      const icon = createIcon('home', { classNames: [] });
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.classList.length).toBe(1);
    });
  });

  describe('hydrateIcons', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('replaces placeholder elements with SVG icons', () => {
      container.innerHTML = '<span class="icon" data-icon="home"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon).toBeTruthy();
      expect(icon.getAttribute('data-icon-name')).toBe('home');
    });

    it('replaces multiple icons in one pass', () => {
      container.innerHTML = `
        <span data-icon="home"></span>
        <span data-icon="search"></span>
        <span data-icon="email"></span>
      `;
      hydrateIcons(container);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBe(3);
    });

    it('handles clear alias during hydration', () => {
      container.innerHTML = '<span data-icon="clear"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon).toBeTruthy();
      expect(icon.getAttribute('data-icon-name')).toBe('clear');
    });

    it('preserves existing classes from placeholder', () => {
      container.innerHTML = '<span class="custom-class another-class" data-icon="home"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.classList.contains('custom-class')).toBe(true);
      expect(icon.classList.contains('another-class')).toBe(true);
      expect(icon.classList.contains('icon')).toBe(true);
    });

    it('handles aria-label attribute', () => {
      container.innerHTML = '<span data-icon="home" aria-label="Home page"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.getAttribute('aria-label')).toBe('Home page');
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });

    it('handles role attribute', () => {
      container.innerHTML = '<span data-icon="home" role="img"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.getAttribute('role')).toBe('img');
    });

    it('handles title attribute', () => {
      container.innerHTML = '<span data-icon="home" title="Go home"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.getAttribute('title')).toBe('Go home');
    });

    it('handles aria-hidden="false" on placeholder', () => {
      container.innerHTML = '<span data-icon="home" aria-hidden="false"></span>';
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });

    it('skips placeholders without data-icon attribute', () => {
      container.innerHTML = '<span class="icon"></span>';
      hydrateIcons(container);

      expect(container.querySelector('svg')).toBeNull();
      expect(container.querySelector('span')).toBeTruthy();
    });

    it('skips placeholders with invalid icon names', () => {
      container.innerHTML = '<span data-icon="invalid-icon"></span>';
      hydrateIcons(container);

      expect(container.querySelector('svg')).toBeNull();
      expect(container.querySelector('span')).toBeTruthy();
    });

    it('works when called without a root element (uses document)', () => {
      document.body.innerHTML = '<span data-icon="home" id="test-icon"></span>';
      hydrateIcons();

      const icon = document.getElementById('test-icon');
      expect(icon).toBeNull(); // Should be replaced

      const svg = document.querySelector('svg[data-icon-name="home"]');
      expect(svg).toBeTruthy();

      // Cleanup
      svg?.remove();
    });

    it('handles multiple attributes together', () => {
      container.innerHTML = `
        <span
          class="custom-class"
          data-icon="home"
          aria-label="Home"
          role="img"
          title="Go home"
        ></span>
      `;
      hydrateIcons(container);

      const icon = container.querySelector('svg');
      expect(icon.classList.contains('custom-class')).toBe(true);
      expect(icon.getAttribute('aria-label')).toBe('Home');
      expect(icon.getAttribute('role')).toBe('img');
      expect(icon.getAttribute('title')).toBe('Go home');
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });

    it('returns early when document is undefined (SSR environment)', () => {
      const originalDocument = global.document;
      delete global.document;
      
      // Should not throw
      expect(() => hydrateIcons(null)).not.toThrow();
      
      global.document = originalDocument;
    });

    it('skips icon replacement when createIcon returns null for unknown icon', () => {
      // Create a placeholder with a valid-looking but nonexistent icon
      container.innerHTML = '<span data-icon="totally-fake-icon-xyz"></span>';
      
      // Capture original span
      const originalSpan = container.querySelector('span');
      expect(originalSpan).toBeTruthy();
      
      hydrateIcons(container);
      
      // Should still have the original span (not replaced)
      const spanAfter = container.querySelector('span[data-icon="totally-fake-icon-xyz"]');
      expect(spanAfter).toBeTruthy();
      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('createIcon SSR handling', () => {
    it('returns null when document is undefined', () => {
      const originalDocument = global.document;
      delete global.document;
      
      const icon = createIcon('home');
      expect(icon).toBeNull();
      
      global.document = originalDocument;
    });
  });
});
