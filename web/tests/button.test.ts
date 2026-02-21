import { describe, it, expect } from 'vitest';
import { createButton, renderButtonHTML, renderLinkButtonHTML, renderShareLinkHTML } from '../src/utils/button.ts';

interface ButtonTestLocalThis {
  btn?: HTMLButtonElement;
  btnUp?: HTMLButtonElement;
  btnDown?: HTMLButtonElement;
  textSpan?: Element | null;
  countSpan?: Element | null;
  children?: Element[];
  html?: string;
  iconIndex?: number;
  textIndex?: number;
  container?: HTMLDivElement;
  domBtn?: HTMLButtonElement;
  htmlBtn?: HTMLButtonElement | null;
  link?: HTMLAnchorElement | null;
  iconCircle?: Element | null;
  icon?: Element | null;
  platforms?: Array<{ platform: string; icon: string; text: string }>;
}

describe('Button component', () => {
  describe('createButton - coverage for L203 L263 L274 L276 L286', () => {
    it('buildClassString vote+direction (L203)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ variant: 'vote', direction: 'up', count: 0 });
      expect(localThis.btn!.className).toContain('count-up');
    });
    it('sets button id when provided (L263)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ text: 'X', id: 'coverage-id' });
      expect(localThis.btn!.id).toBe('coverage-id');
    });
    it('vote variant with icon appends icon (L274)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ variant: 'vote', direction: 'up', icon: 'thumbUp', count: 1 });
      expect(localThis.btn!.querySelector('svg')).toBeTruthy();
    });
    it('iconOnly with icon appends icon (L276)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ icon: 'close', iconOnly: true, ariaLabel: 'Close' });
      expect(localThis.btn!.querySelector('svg')).toBeTruthy();
    });
    it('standard button with iconPosition right appends icon after text (L286)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ text: 'Next', icon: 'arrowForward', iconPosition: 'right' });
      const children = Array.from(localThis.btn!.children);
      expect(children[0]!.classList.contains('btn-text')).toBe(true);
      expect(children[1]!.tagName).toBe('svg');
    });
  });

  describe('createButton', () => {
    describe('variants', () => {
      it('creates primary variant with .btn class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Click me' });
        expect(localThis.btn!.className).toBe('btn');
        expect(localThis.btn!.tagName).toBe('BUTTON');
      });

      it('creates secondary variant with .btn.outline classes', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ variant: 'secondary', text: 'Cancel' });
        expect(localThis.btn!.className).toBe('btn outline');
      });

      it('creates vote variant with .vote-btn and direction class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btnUp = createButton({ variant: 'vote', direction: 'up', icon: 'thumbUp', count: 5 });
        localThis.btnDown = createButton({ variant: 'vote', direction: 'down', icon: 'thumbDown', count: 3 });

        expect(localThis.btnUp!.className).toBe('vote-btn count-up');
        expect(localThis.btnDown!.className).toBe('vote-btn count-down');
      });

      it('throws error when vote variant missing direction', () => {
        expect(() => createButton({ variant: 'vote', icon: 'thumbUp' }))
          .toThrow('vote variant requires direction: "up" | "down"');
      });
    });

    describe('content', () => {
      it('renders text in .btn-text span for standard buttons', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Search' });
        localThis.textSpan = localThis.btn!.querySelector('.btn-text');

        expect(localThis.textSpan).toBeTruthy();
        expect(localThis.textSpan!.textContent).toBe('Search');
      });

      it('renders icon on left by default', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Search', icon: 'search' });
        localThis.children = Array.from(localThis.btn!.children);

        expect(localThis.children![0]!.tagName).toBe('svg');
        expect(localThis.children![1]!.className).toBe('btn-text');
      });

      it('renders icon on right for arrowForward only', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Next', icon: 'arrowForward', iconPosition: 'right' });
        localThis.children = Array.from(localThis.btn!.children);

        expect(localThis.children![0]!.className).toBe('btn-text');
        expect(localThis.children![1]!.tagName).toBe('svg');
      });

      it('throws error when iconPosition right used with non-arrow icon', () => {
        expect(() => createButton({ text: 'Test', icon: 'search', iconPosition: 'right' }))
          .toThrow('iconPosition "right" only allowed for arrowForward icon');
      });

      it('renders icon-only button', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ icon: 'close', iconOnly: true, ariaLabel: 'Close' });

        expect(localThis.btn!.children.length).toBe(1);
        expect(localThis.btn!.children[0]!.tagName).toBe('svg');
        expect(localThis.btn!.querySelector('.btn-text')).toBeNull();
      });

      it('throws error when iconOnly without ariaLabel', () => {
        expect(() => createButton({ icon: 'close', iconOnly: true }))
          .toThrow('iconOnly buttons require ariaLabel for accessibility');
      });

      it('renders vote button with icon and count', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          count: 42,
        });
        localThis.countSpan = localThis.btn!.querySelector('.count-num');

        expect(localThis.countSpan).toBeTruthy();
        expect(localThis.countSpan!.textContent).toBe('42');
      });
    });

    describe('attributes', () => {
      it('sets type attribute (default button)', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Click' });
        expect(localThis.btn!.type).toBe('button');
      });

      it('sets type attribute to submit', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Submit', type: 'submit' });
        expect(localThis.btn!.type).toBe('submit');
      });

      it('sets id attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Test', id: 'my-button' });
        expect(localThis.btn!.id).toBe('my-button');
      });

      it('sets disabled attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Disabled', disabled: true });
        expect(localThis.btn!.disabled).toBe(true);
      });
    });

    describe('data attributes', () => {
      it('sets data-nav attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Home', nav: 'home' });
        expect(localThis.btn!.getAttribute('data-nav')).toBe('home');
      });

      it('sets data-param attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Category', nav: 'category', navParam: 'tech-laws' });
        expect(localThis.btn!.getAttribute('data-nav')).toBe('category');
        expect(localThis.btn!.getAttribute('data-param')).toBe('tech-laws');
      });

      it('sets data-law-id attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          lawId: '123',
        });
        expect(localThis.btn!.getAttribute('data-law-id')).toBe('123');
      });

      it('sets data-action attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Copy', action: 'copy-text' });
        expect(localThis.btn!.getAttribute('data-action')).toBe('copy-text');
      });

      it('sets data-page attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: '2', page: 2 });
        expect(localThis.btn!.getAttribute('data-page')).toBe('2');
      });

      it('sets data-copy-value attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Copy', copyValue: 'Hello world' });
        expect(localThis.btn!.getAttribute('data-copy-value')).toBe('Hello world');
      });

      it('sets data-vote attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          vote: 'up',
        });
        expect(localThis.btn!.getAttribute('data-vote')).toBe('up');
      });

      it('sets data-tooltip attribute for CSS tooltip', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Help', tooltip: 'Click for help' });
        expect(localThis.btn!.getAttribute('data-tooltip')).toBe('Click for help');
      });
    });

    describe('ARIA attributes', () => {
      it('sets aria-label attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ icon: 'close', iconOnly: true, ariaLabel: 'Close dialog' });
        expect(localThis.btn!.getAttribute('aria-label')).toBe('Close dialog');
      });

      it('sets aria-expanded attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Menu', ariaExpanded: false });
        expect(localThis.btn!.getAttribute('aria-expanded')).toBe('false');
      });

      it('sets aria-haspopup attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Menu', ariaHaspopup: true });
        expect(localThis.btn!.getAttribute('aria-haspopup')).toBe('true');
      });

      it('sets aria-current attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: '1', ariaCurrent: 'page' });
        expect(localThis.btn!.getAttribute('aria-current')).toBe('page');
      });

      it('sets aria-busy attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Loading', ariaBusy: true });
        expect(localThis.btn!.getAttribute('aria-busy')).toBe('true');
      });

      it('sets aria-disabled attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Test', ariaDisabled: true });
        expect(localThis.btn!.getAttribute('aria-disabled')).toBe('true');
      });

      it('sets role attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Item', role: 'menuitem' });
        expect(localThis.btn!.getAttribute('role')).toBe('menuitem');
      });
    });

    describe('loading state', () => {
      it('disables button when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Submit', loading: true });
        expect(localThis.btn!.disabled).toBe(true);
      });

      it('sets aria-busy when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Submit', loading: true });
        expect(localThis.btn!.getAttribute('aria-busy')).toBe('true');
      });

      it('shows loadingText when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Submit', loading: true, loadingText: 'Submitting...' });
        localThis.textSpan = localThis.btn!.querySelector('.btn-text');
        expect(localThis.textSpan!.textContent).toBe('Submitting...');
      });

      it('adds loading class when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Submit', loading: true });
        expect(localThis.btn!.classList.contains('loading')).toBe(true);
      });
    });

    describe('custom className', () => {
      it('adds custom class to button', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Test', className: 'custom-class' });
        expect(localThis.btn!.classList.contains('custom-class')).toBe(true);
        expect(localThis.btn!.classList.contains('btn')).toBe(true);
      });

      it('adds multiple custom classes', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.btn = createButton({ text: 'Test', className: 'class-one class-two' });
        expect(localThis.btn!.classList.contains('class-one')).toBe(true);
        expect(localThis.btn!.classList.contains('class-two')).toBe(true);
      });
    });
  });

  describe('renderButtonHTML', () => {
    describe('variants', () => {
      it('renders primary variant with .btn class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Click me' });
        expect(localThis.html!).toContain('class="btn"');
      });

      it('renders secondary variant with .btn.outline classes', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ variant: 'secondary', text: 'Cancel' });
        expect(localThis.html!).toContain('class="btn outline"');
      });

      it('renders vote variant with direction class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          count: 5,
        });
        expect(localThis.html!).toContain('class="vote-btn count-up"');
        expect(localThis.html!).toContain('<span class="count-num">5</span>');
      });
    });

    describe('content', () => {
      it('renders text in .btn-text span', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Search' });
        expect(localThis.html!).toContain('<span class="btn-text">Search</span>');
      });

      it('renders icon placeholder with data-icon attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Search', icon: 'search' });
        expect(localThis.html!).toContain('data-icon="search"');
        expect(localThis.html!).toContain('aria-hidden="true"');
      });

      it('renders icon on left by default', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Search', icon: 'search' });
        localThis.iconIndex = localThis.html!.indexOf('data-icon="search"');
        localThis.textIndex = localThis.html!.indexOf('btn-text');
        expect(localThis.iconIndex!).toBeLessThan(localThis.textIndex!);
      });

      it('renders icon on right for arrowForward', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Next', icon: 'arrowForward', iconPosition: 'right' });
        localThis.iconIndex = localThis.html!.indexOf('data-icon="arrowForward"');
        localThis.textIndex = localThis.html!.indexOf('btn-text');
        expect(localThis.textIndex!).toBeLessThan(localThis.iconIndex);
      });

      it('renders icon-only button', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ icon: 'close', iconOnly: true, ariaLabel: 'Close' });
        expect(localThis.html!).toContain('data-icon="close"');
        expect(localThis.html!).not.toContain('btn-text');
      });
    });

    describe('attributes', () => {
      it('renders type attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Submit', type: 'submit' });
        expect(localThis.html!).toContain('type="submit"');
      });

      it('renders id attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Test', id: 'my-button' });
        expect(localThis.html!).toContain('id="my-button"');
      });

      it('renders disabled attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Disabled', disabled: true });
        expect(localThis.html!).toContain(' disabled');
      });
    });

    describe('data attributes', () => {
      it('renders data-nav attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Home', nav: 'home' });
        expect(localThis.html!).toContain('data-nav="home"');
      });

      it('renders data-param attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Category', nav: 'category', navParam: 'tech' });
        expect(localThis.html!).toContain('data-param="tech"');
      });

      it('renders data-page attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: '2', page: 2 });
        expect(localThis.html!).toContain('data-page="2"');
      });

      it('escapes quotes in data-copy-value', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Copy', copyValue: 'He said "hello"' });
        expect(localThis.html!).toContain('data-copy-value="He said &quot;hello&quot;"');
      });
    });

    describe('ARIA attributes', () => {
      it('renders aria-label attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ icon: 'close', iconOnly: true, ariaLabel: 'Close' });
        expect(localThis.html!).toContain('aria-label="Close"');
      });

      it('renders aria-expanded attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Menu', ariaExpanded: false });
        expect(localThis.html!).toContain('aria-expanded="false"');
      });

      it('renders aria-current attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: '1', ariaCurrent: 'page' });
        expect(localThis.html!).toContain('aria-current="page"');
      });

      it('renders aria-disabled attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Test', ariaDisabled: true });
        expect(localThis.html!).toContain('aria-disabled="true"');
      });

      it('renders aria-haspopup attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Menu', ariaHaspopup: true });
        expect(localThis.html!).toContain('aria-haspopup="true"');
      });

      it('renders role attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Item', role: 'menuitem' });
        expect(localThis.html!).toContain('role="menuitem"');
      });
    });

    describe('loading state', () => {
      it('renders disabled when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Submit', loading: true });
        expect(localThis.html!).toContain(' disabled');
      });

      it('renders aria-busy when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Submit', loading: true });
        expect(localThis.html!).toContain('aria-busy="true"');
      });

      it('renders loadingText when loading', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderButtonHTML({ text: 'Submit', loading: true, loadingText: 'Submitting...' });
        expect(localThis.html!).toContain('Submitting...');
        expect(localThis.html!).not.toContain('>Submit<');
      });
    });

    describe('consistency with createButton', () => {
      it('produces equivalent structure for simple button', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.domBtn = createButton({ text: 'Test', icon: 'search' });
        localThis.html = renderButtonHTML({ text: 'Test', icon: 'search' });

        // Parse HTML and compare structure
        localThis.container = document.createElement('div');
        localThis.container!.innerHTML = localThis.html;
        localThis.htmlBtn = localThis.container!.querySelector('button');

        expect(localThis.htmlBtn!.className).toBe(localThis.domBtn!.className);
        expect(localThis.htmlBtn!.type).toBe(localThis.domBtn!.type);
        expect(localThis.htmlBtn!.querySelector('.btn-text')!.textContent)
          .toBe(localThis.domBtn!.querySelector('.btn-text')!.textContent);
      });

      it('produces equivalent structure for vote button', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.domBtn = createButton({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          count: 10,
          lawId: '123',
          vote: 'up',
          ariaLabel: 'Upvote',
        });
        localThis.html = renderButtonHTML({
          variant: 'vote',
          direction: 'up',
          icon: 'thumbUp',
          count: 10,
          lawId: '123',
          vote: 'up',
          ariaLabel: 'Upvote',
        });

        localThis.container = document.createElement('div');
        localThis.container!.innerHTML = localThis.html;
        localThis.htmlBtn = localThis.container!.querySelector('button');

        expect(localThis.htmlBtn!.className).toBe(localThis.domBtn!.className);
        expect(localThis.htmlBtn!.getAttribute('data-law-id'))
          .toBe(localThis.domBtn!.getAttribute('data-law-id'));
        expect(localThis.htmlBtn!.getAttribute('data-vote'))
          .toBe(localThis.domBtn!.getAttribute('data-vote'));
        expect(localThis.htmlBtn!.querySelector('.count-num')!.textContent)
          .toBe(localThis.domBtn!.querySelector('.count-num')!.textContent);
      });
    });
  });

  describe('edge cases', () => {
    it('handles missing optional parameters', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({});
      expect(localThis.btn!.tagName).toBe('BUTTON');
      expect(localThis.btn!.className).toBe('btn');
    });

    it('handles count of 0 in vote button', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({
        variant: 'vote',
        direction: 'down',
        icon: 'thumbDown',
        count: 0,
      });
      expect(localThis.btn!.querySelector('.count-num')!.textContent).toBe('0');
    });

    it('handles null values for data attributes', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ text: 'Test', nav: null, lawId: null });
      expect(localThis.btn!.hasAttribute('data-nav')).toBe(false);
      expect(localThis.btn!.hasAttribute('data-law-id')).toBe(false);
    });

    it('handles empty string text', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ text: '' });
      expect(localThis.btn!.querySelector('.btn-text')).toBeNull();
    });

    it('handles button without icon', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.btn = createButton({ text: 'No Icon' });
      expect(localThis.btn!.querySelector('svg')).toBeNull();
      expect(localThis.btn!.querySelector('.btn-text')!.textContent).toBe('No Icon');
    });
  });

  describe('renderLinkButtonHTML', () => {
    describe('basic rendering', () => {
      it('renders an anchor element with btn class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home' });
        expect(localThis.html!).toContain('<a');
        expect(localThis.html!).toContain('</a>');
        expect(localThis.html!).toContain('class="btn"');
        expect(localThis.html!).toContain('href="/"');
      });

      it('renders text in .btn-text span', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Go Home' });
        expect(localThis.html!).toContain('<span class="btn-text">Go Home</span>');
      });

      it('renders icon placeholder with data-icon attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home', icon: 'home' });
        expect(localThis.html!).toContain('data-icon="home"');
        expect(localThis.html!).toContain('aria-hidden="true"');
      });
    });

    describe('variants', () => {
      it('renders primary variant by default', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home' });
        expect(localThis.html!).toContain('class="btn"');
      });

      it('renders secondary variant with outline class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Cancel', variant: 'secondary' });
        expect(localThis.html!).toContain('class="btn outline"');
      });
    });

    describe('icon positioning', () => {
      it('renders icon on left by default', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home', icon: 'home' });
        localThis.iconIndex = localThis.html!.indexOf('data-icon="home"');
        localThis.textIndex = localThis.html!.indexOf('btn-text');
        expect(localThis.iconIndex!).toBeLessThan(localThis.textIndex!);
      });

      it('renders icon on right for arrowForward', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: '/next',
          text: 'Next Page',
          icon: 'arrowForward',
          iconPosition: 'right',
        });
        localThis.iconIndex = localThis.html!.indexOf('data-icon="arrowForward"');
        localThis.textIndex = localThis.html!.indexOf('btn-text');
        expect(localThis.textIndex!).toBeLessThan(localThis.iconIndex);
      });

      it('throws error when iconPosition right used with non-arrow icon', () => {
        expect(() => renderLinkButtonHTML({
          href: '/',
          text: 'Test',
          icon: 'home',
          iconPosition: 'right',
        })).toThrow('iconPosition "right" only allowed for arrowForward icon');
      });
    });

    describe('attributes', () => {
      it('renders id attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home', id: 'home-link' });
        expect(localThis.html!).toContain('id="home-link"');
      });

      it('renders aria-label attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: '/',
          text: 'Home',
          ariaLabel: 'Go to homepage',
        });
        expect(localThis.html!).toContain('aria-label="Go to homepage"');
      });

      it('renders target attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: 'https://example.com',
          text: 'Visit',
          target: '_blank',
        });
        expect(localThis.html!).toContain('target="_blank"');
      });

      it('renders rel attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: 'https://example.com',
          text: 'Visit',
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        expect(localThis.html!).toContain('rel="noopener noreferrer"');
      });
    });

    describe('custom className', () => {
      it('adds custom class to link', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: '/',
          text: 'Home',
          className: 'my-custom-class',
        });
        expect(localThis.html!).toContain('btn my-custom-class');
      });
    });

    describe('validation', () => {
      it('throws error when href is missing', () => {
        expect(() => renderLinkButtonHTML({ text: 'Home' }))
          .toThrow('renderLinkButtonHTML requires href');
      });
    });

    describe('DOM parsing', () => {
      it('produces valid anchor element structure', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderLinkButtonHTML({
          href: '/about',
          text: 'About Us',
          icon: 'info',
          id: 'about-link',
          ariaLabel: 'Learn about us',
          target: '_self',
        });

        localThis.container = document.createElement('div');
        localThis.container!.innerHTML = localThis.html;
        localThis.link = localThis.container!.querySelector('a');

        expect(localThis.link!.tagName).toBe('A');
        expect(localThis.link!.getAttribute('href')).toBe('/about');
        expect(localThis.link!.getAttribute('id')).toBe('about-link');
        expect(localThis.link!.getAttribute('aria-label')).toBe('Learn about us');
        expect(localThis.link!.getAttribute('target')).toBe('_self');
        expect(localThis.link!.querySelector('.btn-text')!.textContent).toBe('About Us');
        expect(localThis.link!.querySelector('.icon')).toBeTruthy();
        expect(localThis.link!.querySelector('.icon')!.getAttribute('data-icon')).toBe('info');
      });
    });
  });

  describe('renderButtonHTML - coverage L312 L501', () => {
    it('standard button iconPosition right (L312 L501)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.html = renderButtonHTML({ text: 'Go', icon: 'arrowForward', iconPosition: 'right' });
      expect(localThis.html!).toContain('btn-text');
      expect(localThis.html!.indexOf('btn-text')).toBeLessThan(localThis.html!.indexOf('data-icon="arrowForward"'));
    });
  });

  describe('renderLinkButtonHTML - coverage L584 L608', () => {
    it('includes id when provided (L584)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.html = renderLinkButtonHTML({ href: '/', text: 'Home', id: 'link-id' });
      expect(localThis.html!).toContain('id="link-id"');
    });
    it('iconPosition right for arrowForward (L608)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.html = renderLinkButtonHTML({ href: '/', text: 'Next', icon: 'arrowForward', iconPosition: 'right' });
      expect(localThis.html!.indexOf('btn-text')).toBeLessThan(localThis.html!.indexOf('data-icon="arrowForward"'));
    });
  });

  describe('renderShareLinkHTML - coverage L680', () => {
    it('includes target and rel when provided (L680)', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.html = renderShareLinkHTML({
        href: 'https://x.com/share',
        text: 'Share',
        icon: 'twitter',
        platform: 'twitter',
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      expect(localThis.html!).toContain('target="_blank"');
      expect(localThis.html!).toContain('rel="noopener noreferrer"');
    });
  });

  describe('renderShareLinkHTML', () => {
    describe('basic rendering', () => {
      it('renders an anchor element with share-popover-item class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet?url=test',
          text: 'Share on X',
          icon: 'twitter',
          platform: 'twitter',
        });
        expect(localThis.html!).toContain('<a');
        expect(localThis.html!).toContain('</a>');
        expect(localThis.html!).toContain('class="share-popover-item"');
      });

      it('renders icon-circle wrapper with platform class', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://facebook.com/sharer',
          text: 'Share on Facebook',
          icon: 'facebook',
          platform: 'facebook',
        });
        expect(localThis.html!).toContain('class="icon-circle facebook"');
      });

      it('renders icon placeholder inside icon-circle', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://linkedin.com/share',
          text: 'Share on LinkedIn',
          icon: 'linkedin',
          platform: 'linkedin',
        });
        expect(localThis.html!).toContain('data-icon="linkedin"');
        expect(localThis.html!).toContain('aria-hidden="true"');
      });

      it('renders text after icon-circle', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://reddit.com/submit',
          text: 'Share on Reddit',
          icon: 'reddit',
          platform: 'reddit',
        });
        expect(localThis.html!).toContain('</span>Share on Reddit</a>');
      });

      it('renders role="menuitem" attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet',
          text: 'Share',
          icon: 'twitter',
          platform: 'twitter',
        });
        expect(localThis.html!).toContain('role="menuitem"');
      });
    });

    describe('default target and rel attributes', () => {
      it('uses target="_blank" by default for social platforms', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet',
          text: 'Share on X',
          icon: 'twitter',
          platform: 'twitter',
        });
        expect(localThis.html!).toContain('target="_blank"');
      });

      it('uses rel="noopener noreferrer" by default for social platforms', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://facebook.com/sharer',
          text: 'Share on Facebook',
          icon: 'facebook',
          platform: 'facebook',
        });
        expect(localThis.html!).toContain('rel="noopener noreferrer"');
      });

      it('uses target="_self" for email platform', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'mailto:?subject=test',
          text: 'Share via Email',
          icon: 'email',
          platform: 'email',
        });
        expect(localThis.html!).toContain('target="_self"');
      });

      it('omits rel attribute for email platform', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'mailto:?subject=test',
          text: 'Share via Email',
          icon: 'email',
          platform: 'email',
        });
        expect(localThis.html!).not.toContain('rel=');
      });
    });

    describe('custom target and rel', () => {
      it('allows overriding target attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet',
          text: 'Share',
          icon: 'twitter',
          platform: 'twitter',
          target: '_self',
        });
        expect(localThis.html!).toContain('target="_self"');
      });

      it('allows overriding rel attribute', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet',
          text: 'Share',
          icon: 'twitter',
          platform: 'twitter',
          rel: 'noopener',
        });
        expect(localThis.html!).toContain('rel="noopener"');
        expect(localThis.html!).not.toContain('noopener noreferrer');
      });
    });

    describe('validation', () => {
      it('throws error when href is missing', () => {
        expect(() => renderShareLinkHTML({
          text: 'Share',
          icon: 'twitter',
          platform: 'twitter',
        })).toThrow('renderShareLinkHTML requires href');
      });

      it('throws error when text is missing', () => {
        expect(() => renderShareLinkHTML({
          href: 'https://twitter.com',
          icon: 'twitter',
          platform: 'twitter',
        })).toThrow('renderShareLinkHTML requires text');
      });

      it('throws error when icon is missing', () => {
        expect(() => renderShareLinkHTML({
          href: 'https://twitter.com',
          text: 'Share',
          platform: 'twitter',
        })).toThrow('renderShareLinkHTML requires icon');
      });

      it('throws error when platform is missing', () => {
        expect(() => renderShareLinkHTML({
          href: 'https://twitter.com',
          text: 'Share',
          icon: 'twitter',
        })).toThrow('renderShareLinkHTML requires platform');
      });
    });

    describe('all supported platforms', () => {
      const localThis: ButtonTestLocalThis = {};
      localThis.platforms = [
        { platform: 'twitter', icon: 'twitter', text: 'Share on X' },
        { platform: 'facebook', icon: 'facebook', text: 'Share on Facebook' },
        { platform: 'linkedin', icon: 'linkedin', text: 'Share on LinkedIn' },
        { platform: 'reddit', icon: 'reddit', text: 'Share on Reddit' },
        { platform: 'whatsapp', icon: 'whatsapp', text: 'Share on WhatsApp' },
        { platform: 'email', icon: 'email', text: 'Share via Email' },
      ];

      localThis.platforms!.forEach(({ platform, icon, text }) => {
        it(`renders ${platform} share link correctly`, () => {
          const html = renderShareLinkHTML({
            href: `https://example.com/share/${platform}`,
            text,
            icon,
            platform,
          });
          expect(html).toContain(`class="icon-circle ${platform}"`);
          expect(html).toContain(`data-icon="${icon}"`);
          expect(html).toContain(text);
        });
      });
    });

    describe('DOM parsing', () => {
      it('produces valid anchor element structure', () => {
        const localThis: ButtonTestLocalThis = {};
        localThis.html = renderShareLinkHTML({
          href: 'https://twitter.com/intent/tweet?url=test',
          text: 'Share on X',
          icon: 'twitter',
          platform: 'twitter',
        });

        localThis.container = document.createElement('div');
        localThis.container!.innerHTML = localThis.html;
        localThis.link = localThis.container!.querySelector('a');

        expect(localThis.link!.tagName).toBe('A');
        expect(localThis.link!.className).toBe('share-popover-item');
        expect(localThis.link!.getAttribute('href')).toBe('https://twitter.com/intent/tweet?url=test');
        expect(localThis.link!.getAttribute('role')).toBe('menuitem');
        expect(localThis.link!.getAttribute('target')).toBe('_blank');
        expect(localThis.link!.getAttribute('rel')).toBe('noopener noreferrer');

        localThis.iconCircle = localThis.link!.querySelector('.icon-circle');
        expect(localThis.iconCircle).toBeTruthy();
        expect(localThis.iconCircle!.classList.contains('twitter')).toBe(true);

        localThis.icon = localThis.iconCircle!.querySelector('.icon');
        expect(localThis.icon).toBeTruthy();
        expect(localThis.icon!.getAttribute('data-icon')).toBe('twitter');
      });
    });
  });
});
