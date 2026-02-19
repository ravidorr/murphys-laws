// @ts-nocheck
import {
  SocialShare,
  renderShareButtonsHTML,
  initSharePopovers,
  SHARE_PLATFORMS,
  buildShareUrls,
  renderInlineShareButtonsHTML,
  initInlineShareButtons
} from '../src/components/social-share.js';
import * as icons from '../src/utils/icons.js';

describe('SocialShare component', () => {
  const localThis = {};

  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
    // Store spies for cleanup
    localThis.documentClickHandler = null;
    localThis.documentKeydownHandler = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates social share wrapper container', () => {
    const el = SocialShare();
    expect(el.className).toBe('share-wrapper');
  });

  it('creates a trigger button', () => {
    const el = SocialShare();
    const trigger = el.querySelector('.share-trigger');
    
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.textContent).toContain('Share');
  });

  it('creates a popover with menu items', () => {
    const el = SocialShare();
    const popover = el.querySelector('.share-popover');
    
    expect(popover).toBeTruthy();
    expect(popover.getAttribute('role')).toBe('menu');
    
    // Should have 6 social links + 2 copy buttons = 8 items
    const items = popover.querySelectorAll('.share-popover-item');
    expect(items.length).toBe(8);
  });

  it('uses default values when no options provided', () => {
    document.title = 'Test Page Title';
    const el = SocialShare();

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/page'));
    expect(twitterLink.href).toContain(encodeURIComponent('Test Page Title'));
  });

  it('uses provided url instead of window.location.href', () => {
    const el = SocialShare({ url: 'https://custom.com/law/123' });

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('https://custom.com/law/123'));
  });

  it('uses provided title instead of document.title', () => {
    const el = SocialShare({ title: 'Custom Law Title' });

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('Custom Law Title'));
  });

  it('uses provided description', () => {
    const el = SocialShare({
      url: 'https://test.com',
      title: 'Test',
      description: 'Custom description here'
    });

    const linkedinLink = el.querySelector('.share-popover-item[href*="linkedin"]');
    expect(linkedinLink.href).toContain(encodeURIComponent('Custom description here'));
  });

  describe('Twitter button', () => {
    it('creates Twitter share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="twitter"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('twitter.com/intent/tweet');
    });
  });

  describe('Facebook button', () => {
    it('creates Facebook share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="facebook"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('facebook.com/sharer');
    });
  });

  describe('LinkedIn button', () => {
    it('creates LinkedIn share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="linkedin"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('linkedin.com/shareArticle');
    });

    it('includes description in LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test Law',
        description: 'This is a detailed description'
      });
      const link = el.querySelector('.share-popover-item[href*="linkedin"]');

      expect(link.href).toContain('summary=');
      expect(link.href).toContain(encodeURIComponent('This is a detailed description'));
    });
  });

  describe('Reddit button', () => {
    it('creates Reddit share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="reddit"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('reddit.com/submit');
    });
  });

  describe('WhatsApp button', () => {
    it('creates WhatsApp share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="whatsapp"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('api.whatsapp.com/send');
    });

    it('includes text and URL in WhatsApp share link', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/123',
        title: "Murphy's Law"
      });
      const link = el.querySelector('.share-popover-item[href*="whatsapp"]');

      expect(link.href).toContain('text=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/123'));
    });
  });

  describe('Email button', () => {
    it('creates Email share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="mailto"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.href).toContain('mailto:');
    });

    it('includes custom subject and body in email', () => {
      const el = SocialShare({
        url: 'https://test.com/law/123',
        title: 'Murphy\'s Original Law'
      });
      const link = el.querySelector('.share-popover-item[href*="mailto"]');

      expect(link.href).toContain('subject=');
      expect(link.href).toContain(encodeURIComponent('Check out this Murphy\'s Law'));
      expect(link.href).toContain('body=');
      expect(link.href).toContain(encodeURIComponent('Murphy\'s Original Law'));
      expect(link.href).toContain(encodeURIComponent('https://test.com/law/123'));
    });

    it('uses _self target for email link', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="mailto"]');

      expect(link.getAttribute('target')).toBe('_self');
      // Email should not have rel="noopener noreferrer"
      expect(link.getAttribute('rel')).toBeNull();
    });
  });

  describe('Icons', () => {
    it('includes share icon on trigger button', () => {
      const el = SocialShare();
      const trigger = el.querySelector('.share-trigger');
      const icon = trigger.querySelector('svg');
      
      expect(icon).toBeTruthy();
    });

    it('includes icon circles for each platform in popover', () => {
      const el = SocialShare();
      const iconCircles = el.querySelectorAll('.icon-circle');
      
      // 6 social platforms + 2 copy buttons = 8 icon circles
      expect(iconCircles.length).toBe(8);
    });

    it('handles missing icon gracefully', () => {
      // Mock createIcon to return null for one icon
      const createIconSpy = vi.spyOn(icons, 'createIcon');
      createIconSpy.mockImplementation((name) => {
        if (name === 'twitter') return null;
        return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      });

      const el = SocialShare();
      const twitterItem = el.querySelector('.icon-circle.twitter');

      // Icon circle should still exist, just without SVG inside
      expect(twitterItem).toBeTruthy();
      expect(twitterItem.querySelector('svg')).toBeFalsy();
    });
  });

  describe('Copy Text button', () => {
    it('creates Copy Text button with correct attributes', () => {
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      const button = el.querySelector('[data-action="copy-text"]');

      expect(button.getAttribute('role')).toBe('menuitem');
      expect(button.getAttribute('data-action')).toBe('copy-text');
      expect(button.getAttribute('data-copy-value')).toBe('Test Law Text');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses title as fallback for lawText', () => {
      const el = SocialShare({ title: 'Title as fallback' });
      const button = el.querySelector('[data-action="copy-text"]');

      expect(button.getAttribute('data-copy-value')).toBe('Title as fallback');
    });
  });

  describe('Copy Link button', () => {
    it('creates Copy Link button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com/law/123', lawId: '123' });
      const button = el.querySelector('[data-action="copy-link"]');

      expect(button.getAttribute('role')).toBe('menuitem');
      expect(button.getAttribute('data-action')).toBe('copy-link');
      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/law/123');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses window.location.href as fallback for url', () => {
      const el = SocialShare();
      const button = el.querySelector('[data-action="copy-link"]');

      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/page');
    });
  });

  describe('Copy feedback', () => {
    it('includes copy feedback element in popover', () => {
      const el = SocialShare();
      const feedback = el.querySelector('.share-copy-feedback');

      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain('Copied!');
    });
  });

  describe('Popover toggle behavior', () => {
    it('toggles popover open on trigger click', () => {
      const el = SocialShare();
      document.body.appendChild(el);
      
      const trigger = el.querySelector('.share-trigger');
      const popover = el.querySelector('.share-popover');
      
      expect(popover.classList.contains('open')).toBe(false);
      
      trigger.click();
      expect(popover.classList.contains('open')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      
      trigger.click();
      expect(popover.classList.contains('open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      
      document.body.removeChild(el);
    });

    it('closes other open popovers when opening a new one', () => {
      const el1 = SocialShare({ lawId: '1', lawText: 'Law 1' });
      const el2 = SocialShare({ lawId: '2', lawText: 'Law 2' });
      document.body.appendChild(el1);
      document.body.appendChild(el2);
      
      const trigger1 = el1.querySelector('.share-trigger');
      const popover1 = el1.querySelector('.share-popover');
      const trigger2 = el2.querySelector('.share-trigger');
      const popover2 = el2.querySelector('.share-popover');
      
      // Open first popover
      trigger1.click();
      expect(popover1.classList.contains('open')).toBe(true);
      expect(popover2.classList.contains('open')).toBe(false);
      
      // Open second popover - first should close
      trigger2.click();
      expect(popover1.classList.contains('open')).toBe(false);
      expect(popover2.classList.contains('open')).toBe(true);
      expect(trigger1.getAttribute('aria-expanded')).toBe('false');
      
      document.body.removeChild(el1);
      document.body.removeChild(el2);
    });

    it('adds popover-above class when space below is insufficient', () => {
      const el = SocialShare();
      document.body.appendChild(el);
      
      const trigger = el.querySelector('.share-trigger');
      const popover = el.querySelector('.share-popover');
      
      // Mock getBoundingClientRect to simulate trigger near bottom of viewport
      const originalGetBoundingClientRect = trigger.getBoundingClientRect;
      trigger.getBoundingClientRect = () => ({
        top: 400,
        bottom: 420,
        left: 0,
        right: 100,
        width: 100,
        height: 20
      });
      
      // Mock window.innerHeight to be small
      const originalInnerHeight = window.innerHeight;
      Object.defineProperty(window, 'innerHeight', { value: 450, writable: true });
      
      trigger.click();
      
      // Should add popover-above class since space below (450-420=30) < 320
      expect(popover.classList.contains('popover-above')).toBe(true);
      
      // Restore mocks
      trigger.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
      
      document.body.removeChild(el);
    });

    it('removes popover-above class when closing and reopening with enough space', () => {
      const el = SocialShare();
      document.body.appendChild(el);
      
      const trigger = el.querySelector('.share-trigger');
      const popover = el.querySelector('.share-popover');
      
      // First, open with limited space (manually add class)
      trigger.click();
      popover.classList.add('popover-above');
      expect(popover.classList.contains('popover-above')).toBe(true);
      
      // Close
      trigger.click();
      expect(popover.classList.contains('popover-above')).toBe(false);
      
      document.body.removeChild(el);
    });
  });

  describe('Event propagation for copy buttons', () => {
    const localThis = {};

    beforeEach(() => {
      localThis.container = document.createElement('div');
      document.body.appendChild(localThis.container);
    });

    afterEach(() => {
      document.body.removeChild(localThis.container);
    });

    it('allows copy-text button clicks to propagate to parent handlers', () => {
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      localThis.container.appendChild(el);

      const parentClickHandler = vi.fn();
      localThis.container.addEventListener('click', parentClickHandler);

      const trigger = el.querySelector('.share-trigger');
      trigger.click(); // Open popover

      const copyTextBtn = el.querySelector('[data-action="copy-text"]');
      copyTextBtn.click();

      expect(parentClickHandler).toHaveBeenCalled();
    });

    it('allows copy-link button clicks to propagate to parent handlers', () => {
      const el = SocialShare({ url: 'https://test.com/law/123', lawId: '123' });
      localThis.container.appendChild(el);

      const parentClickHandler = vi.fn();
      localThis.container.addEventListener('click', parentClickHandler);

      const trigger = el.querySelector('.share-trigger');
      trigger.click(); // Open popover

      const copyLinkBtn = el.querySelector('[data-action="copy-link"]');
      copyLinkBtn.click();

      expect(parentClickHandler).toHaveBeenCalled();
    });

    it('closes popover after copy button click', async () => {
      vi.useFakeTimers();
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      localThis.container.appendChild(el);

      const trigger = el.querySelector('.share-trigger');
      const popover = el.querySelector('.share-popover');

      trigger.click(); // Open popover
      expect(popover.classList.contains('open')).toBe(true);

      const copyTextBtn = el.querySelector('[data-action="copy-text"]');
      copyTextBtn.click();

      // Wait for setTimeout to close popover
      vi.advanceTimersByTime(150);
      expect(popover.classList.contains('open')).toBe(false);
      vi.useRealTimers();
    });

    it('still stops propagation for non-action clicks inside popover', () => {
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      localThis.container.appendChild(el);

      const parentClickHandler = vi.fn();
      localThis.container.addEventListener('click', parentClickHandler);

      const trigger = el.querySelector('.share-trigger');
      trigger.click(); // Open popover

      const popover = el.querySelector('.share-popover');
      // Click on divider or feedback element (non-action areas)
      const divider = popover.querySelector('.share-popover-divider');
      divider.click();

      // Parent handler should NOT be called because stopPropagation was used
      // Note: The click on trigger will have already called it once
      // Reset the mock and test the divider click specifically
      parentClickHandler.mockClear();
      divider.click();
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('URL encoding', () => {
    it('properly encodes special characters in URL', () => {
      const el = SocialShare({
        url: 'https://test.com/law?id=123&sort=votes',
        title: 'Law with & and = chars'
      });

      const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
      expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/law?id=123&sort=votes'));
    });

    it('properly encodes special characters in title', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Murphy\'s Law: "Everything fails"'
      });

      const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
      // Check that special characters are present (browser may encode ' as %27)
      expect(twitterLink.href).toContain('Murphy');
      expect(twitterLink.href).toContain('Law');
      expect(twitterLink.href).toContain('Everything');
      expect(twitterLink.href).toContain('fails');
    });

    it('handles empty description', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test',
        description: ''
      });

      const linkedinLink = el.querySelector('.share-popover-item[href*="linkedin"]');
      expect(linkedinLink.href).toContain('summary=');
    });
  });

  describe('Platform-specific URLs', () => {
    it('creates correct Twitter intent URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="twitter"]');
      expect(link.href).toContain('https://twitter.com/intent/tweet?url=');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('&text=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('Law');
    });

    it('creates correct Facebook sharer URL', () => {
      const el = SocialShare({ url: 'https://murphys-laws.com/law/42' });

      const link = el.querySelector('.share-popover-item[href*="facebook"]');
      const expectedUrl = 'https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent('https://murphys-laws.com/law/42');

      expect(link.href).toBe(expectedUrl);
    });

    it('creates correct LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law',
        description: 'Anything that can go wrong'
      });

      const link = el.querySelector('.share-popover-item[href*="linkedin"]');
      expect(link.href).toContain('https://www.linkedin.com/shareArticle?mini=true');
      expect(link.href).toContain('url=' + encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('title=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('summary=' + encodeURIComponent('Anything that can go wrong'));
    });

    it('creates correct Reddit submit URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="reddit"]');
      expect(link.href).toContain('https://www.reddit.com/submit?url=');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('&title=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('Law');
    });

    it('creates correct WhatsApp share URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="whatsapp"]');
      expect(link.href).toContain('https://api.whatsapp.com/send?text=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
    });

    it('creates correct mailto URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="mailto"]');
      expect(link.href).toContain('mailto:?subject=');
      expect(link.href).toContain('&body=');
    });
  });
});

describe('renderShareButtonsHTML', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
  });

  it('returns HTML string with share-wrapper class', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-wrapper"');
  });

  it('includes share trigger button', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-trigger"');
    expect(html).toContain('Share');
  });

  it('includes share popover with menu items', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-popover"');
    expect(html).toContain('share-popover-item');
  });

  it('includes all social platform links', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('twitter.com/intent/tweet');
    expect(html).toContain('facebook.com/sharer');
    expect(html).toContain('linkedin.com/shareArticle');
    expect(html).toContain('reddit.com/submit');
    expect(html).toContain('api.whatsapp.com/send');
    expect(html).toContain('mailto:');
  });

  it('includes copy buttons with correct data attributes', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law text' });
    expect(html).toContain('data-action="copy-text"');
    expect(html).toContain('data-action="copy-link"');
    expect(html).toContain('data-law-id="123"');
  });

  it('escapes special characters in lawText', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test "quoted" law' });
    expect(html).toContain('&quot;');
  });

  it('includes copy feedback element', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('share-copy-feedback');
    expect(html).toContain('Copied!');
  });

  it('handles missing lawText gracefully', () => {
    const html = renderShareButtonsHTML({ lawId: '123' });
    expect(html).toContain('class="share-wrapper"');
    expect(html).toContain('data-copy-value=""'); // Empty copy value
  });

  it('handles missing lawText and uses empty string in URLs', () => {
    const html = renderShareButtonsHTML({ lawId: '456' });
    expect(html).toContain('data-law-id="456"');
    // Email body should still work with empty text
    expect(html).toContain('mailto:');
  });

  it('uses lawId to construct URL when url is not provided', () => {
    const html = renderShareButtonsHTML({ lawId: '789', lawText: 'Test' });
    expect(html).toContain('/law/789');
  });
});

describe('initSharePopovers', () => {
  const localThis = {};

  beforeEach(() => {
    document.body.innerHTML = '';
    localThis.container = document.createElement('div');
    document.body.appendChild(localThis.container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes popover behavior for share wrappers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    expect(trigger.dataset.initialized).toBe('true');
    
    // Test toggle functionality
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('does not re-initialize already initialized popovers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);
    initSharePopovers(localThis.container); // Call again

    const trigger = localThis.container.querySelector('.share-trigger');
    // Should still work normally, no double event listeners
    trigger.click();
    const popover = localThis.container.querySelector('.share-popover');
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('allows copy-text button clicks to propagate to parent handlers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law text' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const parentClickHandler = vi.fn();
    localThis.container.addEventListener('click', parentClickHandler);

    const trigger = localThis.container.querySelector('.share-trigger');
    trigger.click(); // Open popover

    const copyTextBtn = localThis.container.querySelector('[data-action="copy-text"]');
    copyTextBtn.click();

    expect(parentClickHandler).toHaveBeenCalled();
  });

  it('allows copy-link button clicks to propagate to parent handlers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const parentClickHandler = vi.fn();
    localThis.container.addEventListener('click', parentClickHandler);

    const trigger = localThis.container.querySelector('.share-trigger');
    trigger.click(); // Open popover

    const copyLinkBtn = localThis.container.querySelector('[data-action="copy-link"]');
    copyLinkBtn.click();

    expect(parentClickHandler).toHaveBeenCalled();
  });

  it('closes popover after copy button click', async () => {
    vi.useFakeTimers();
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    trigger.click(); // Open popover
    expect(popover.classList.contains('open')).toBe(true);

    const copyTextBtn = localThis.container.querySelector('[data-action="copy-text"]');
    copyTextBtn.click();

    // Wait for setTimeout to close popover
    vi.advanceTimersByTime(150);
    expect(popover.classList.contains('open')).toBe(false);
    vi.useRealTimers();
  });

  it('still stops propagation for non-action clicks inside popover', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const parentClickHandler = vi.fn();
    localThis.container.addEventListener('click', parentClickHandler);

    const trigger = localThis.container.querySelector('.share-trigger');
    trigger.click(); // Open popover

    // Reset the mock after trigger click
    parentClickHandler.mockClear();

    const popover = localThis.container.querySelector('.share-popover');
    const divider = popover.querySelector('.share-popover-divider');
    divider.click();

    // Parent handler should NOT be called because stopPropagation was used
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it('closes popover after link click', async () => {
    vi.useFakeTimers();
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    trigger.click(); // Open popover
    expect(popover.classList.contains('open')).toBe(true);

    // Click a social link
    const twitterLink = localThis.container.querySelector('.share-popover-item[href*="twitter"]');
    twitterLink.click();

    // Wait for setTimeout to close popover
    vi.advanceTimersByTime(150);
    expect(popover.classList.contains('open')).toBe(false);
    vi.useRealTimers();
  });

  it('skips wrappers with missing trigger element', () => {
    // Create HTML without trigger
    localThis.container.innerHTML = `
      <div class="share-wrapper">
        <div class="share-popover" role="menu"></div>
      </div>
    `;

    // Should not throw
    initSharePopovers(localThis.container);

    // No initialization should happen
    const popover = localThis.container.querySelector('.share-popover');
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('skips wrappers with missing popover element', () => {
    // Create HTML without popover
    localThis.container.innerHTML = `
      <div class="share-wrapper">
        <button class="share-trigger">Share</button>
      </div>
    `;

    // Should not throw
    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    // Trigger should not be marked as initialized
    expect(trigger.dataset.initialized).toBeUndefined();
  });
});

describe('Global event handlers', () => {
  const localThis = {};

  beforeEach(() => {
    document.body.innerHTML = '';
    localThis.container = document.createElement('div');
    document.body.appendChild(localThis.container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('closes all open popovers on document click', async () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Open popover
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);

    // Click elsewhere on document (global handler should close it)
    document.body.click();

    expect(popover.classList.contains('open')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes all open popovers on Escape key', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Open popover
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escapeEvent);

    expect(popover.classList.contains('open')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not close popovers on other key presses', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Open popover
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);

    // Press a different key
    const keyEvent = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    document.dispatchEvent(keyEvent);

    // Popover should still be open
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('removes popover-above class when closing via global click', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Manually add popover-above class to simulate positioning
    trigger.click();
    popover.classList.add('popover-above');
    expect(popover.classList.contains('open')).toBe(true);
    expect(popover.classList.contains('popover-above')).toBe(true);

    // Click elsewhere
    document.body.click();

    expect(popover.classList.contains('open')).toBe(false);
    expect(popover.classList.contains('popover-above')).toBe(false);
  });

  it('removes popover-above class when closing via Escape', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Manually add popover-above class to simulate positioning
    trigger.click();
    popover.classList.add('popover-above');

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escapeEvent);

    expect(popover.classList.contains('open')).toBe(false);
    expect(popover.classList.contains('popover-above')).toBe(false);
  });

  it('toggles popover closed when clicking trigger while open', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // First click opens
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Add popover-above class to verify it gets removed
    popover.classList.add('popover-above');

    // Second click on same trigger closes
    trigger.click();
    expect(popover.classList.contains('open')).toBe(false);
    expect(popover.classList.contains('popover-above')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('positions popover above when not enough space below', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    localThis.container.innerHTML = html;

    initSharePopovers(localThis.container);

    const trigger = localThis.container.querySelector('.share-trigger');
    const popover = localThis.container.querySelector('.share-popover');

    // Mock getBoundingClientRect to simulate trigger near bottom of viewport
    const originalGetBoundingClientRect = trigger.getBoundingClientRect;
    trigger.getBoundingClientRect = () => ({
      top: 500,
      bottom: window.innerHeight - 50, // Only 50px below trigger
      left: 100,
      right: 200,
      width: 100,
      height: 30
    });

    // Click to open
    trigger.click();

    // Should have popover-above class because not enough space below
    expect(popover.classList.contains('open')).toBe(true);
    expect(popover.classList.contains('popover-above')).toBe(true);

    // Restore
    trigger.getBoundingClientRect = originalGetBoundingClientRect;
  });
});

describe('SHARE_PLATFORMS configuration', () => {
  it('exports SHARE_PLATFORMS constant', () => {
    expect(SHARE_PLATFORMS).toBeDefined();
    expect(SHARE_PLATFORMS.social).toBeDefined();
    expect(SHARE_PLATFORMS.copy).toBeDefined();
  });

  it('contains all 6 social platforms', () => {
    expect(SHARE_PLATFORMS.social).toHaveLength(6);
    const platformIds = SHARE_PLATFORMS.social.map(p => p.id);
    expect(platformIds).toContain('twitter');
    expect(platformIds).toContain('facebook');
    expect(platformIds).toContain('linkedin');
    expect(platformIds).toContain('reddit');
    expect(platformIds).toContain('whatsapp');
    expect(platformIds).toContain('email');
  });

  it('contains 2 copy actions', () => {
    expect(SHARE_PLATFORMS.copy).toHaveLength(2);
    const copyIds = SHARE_PLATFORMS.copy.map(p => p.id);
    expect(copyIds).toContain('copy-text');
    expect(copyIds).toContain('copy-link');
  });

  it('social platforms have required properties', () => {
    SHARE_PLATFORMS.social.forEach(platform => {
      expect(platform.id).toBeDefined();
      expect(platform.label).toBeDefined();
      expect(platform.shortLabel).toBeDefined();
      expect(platform.icon).toBeDefined();
    });
  });

  it('copy platforms have required properties', () => {
    SHARE_PLATFORMS.copy.forEach(platform => {
      expect(platform.id).toBeDefined();
      expect(platform.label).toBeDefined();
      expect(platform.shortLabel).toBeDefined();
      expect(platform.icon).toBeDefined();
      expect(platform.action).toBeDefined();
    });
  });
});

describe('buildShareUrls', () => {
  it('builds URLs for all social platforms', () => {
    const urls = buildShareUrls({
      url: 'https://test.com/page',
      title: 'Test Title',
      description: 'Test description',
      lawText: 'Test law text'
    });

    expect(urls.twitter).toContain('twitter.com/intent/tweet');
    expect(urls.facebook).toContain('facebook.com/sharer');
    expect(urls.linkedin).toContain('linkedin.com/shareArticle');
    expect(urls.reddit).toContain('reddit.com/submit');
    expect(urls.whatsapp).toContain('api.whatsapp.com/send');
    expect(urls.email).toContain('mailto:');
  });

  it('encodes URL parameter correctly', () => {
    const urls = buildShareUrls({
      url: 'https://test.com/page?id=123',
      title: 'Test'
    });

    expect(urls.twitter).toContain(encodeURIComponent('https://test.com/page?id=123'));
  });

  it('encodes title parameter correctly', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: "Murphy's Law"
    });

    expect(urls.twitter).toContain(encodeURIComponent("Murphy's Law"));
  });

  it('includes description in LinkedIn URL', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: 'Test',
      description: 'A detailed description'
    });

    expect(urls.linkedin).toContain(encodeURIComponent('A detailed description'));
  });

  it('uses custom email subject when provided', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: 'Test',
      emailSubject: 'Custom subject line'
    });

    expect(urls.email).toContain(encodeURIComponent('Custom subject line'));
  });

  it('uses lawText in email body', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: 'Test',
      lawText: 'The actual law text'
    });

    expect(urls.email).toContain(encodeURIComponent('The actual law text'));
  });

  it('falls back to title when lawText is not provided', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: 'Fallback title'
    });

    expect(urls.email).toContain(encodeURIComponent('Fallback title'));
  });

  it('uses default email subject when not provided', () => {
    const urls = buildShareUrls({
      url: 'https://test.com',
      title: 'Test'
    });

    expect(urls.email).toContain(encodeURIComponent("Check out this Murphy's Law"));
  });
});

describe('renderInlineShareButtonsHTML', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
  });

  it('returns HTML string with share-buttons-inline class', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('class="share-buttons-inline"');
  });

  it('includes buttons for all social platforms', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('data-share="twitter"');
    expect(html).toContain('data-share="facebook"');
    expect(html).toContain('data-share="linkedin"');
    expect(html).toContain('data-share="reddit"');
    expect(html).toContain('data-share="whatsapp"');
    expect(html).toContain('data-share="email"');
  });

  it('includes copy buttons', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('data-action="copy-text"');
    expect(html).toContain('data-action="copy-link"');
  });

  it('uses shortLabel for button text', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('>X</span>');
    expect(html).toContain('>Facebook</span>');
    expect(html).toContain('>LinkedIn</span>');
    expect(html).toContain('>Reddit</span>');
    expect(html).toContain('>WhatsApp</span>');
    expect(html).toContain('>Email</span>');
    expect(html).toContain('>Copy</span>');
    expect(html).toContain('>Link</span>');
  });

  it('includes share-btn-inline class on each button', () => {
    const html = renderInlineShareButtonsHTML();
    const matches = html.match(/class="share-btn-inline"/g);
    // 6 social + 2 copy = 8 buttons
    expect(matches.length).toBe(8);
  });

  it('includes icon circles with platform classes', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('icon-circle twitter');
    expect(html).toContain('icon-circle facebook');
    expect(html).toContain('icon-circle linkedin');
    expect(html).toContain('icon-circle reddit');
    expect(html).toContain('icon-circle whatsapp');
    expect(html).toContain('icon-circle email');
    expect(html).toContain('icon-circle copy');
    expect(html).toContain('icon-circle link');
  });

  it('includes copy feedback element', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('share-copy-feedback');
    expect(html).toContain('Copied!');
  });

  it('sets correct target for social links', () => {
    const html = renderInlineShareButtonsHTML();
    // Email should use _self, others should use _blank
    expect(html).toContain('data-share="email" target="_self"');
    expect(html).toContain('data-share="twitter" target="_blank"');
  });

  it('includes noopener noreferrer for non-email links', () => {
    const html = renderInlineShareButtonsHTML();
    expect(html).toContain('data-share="twitter" target="_blank" rel="noopener noreferrer"');
  });
});

describe('initInlineShareButtons', () => {
  const localThis = {};

  beforeEach(() => {
    document.body.innerHTML = '';
    localThis.container = document.createElement('div');
    document.body.appendChild(localThis.container);
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes inline share buttons behavior', () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com/share',
      getShareText: () => 'Test share text'
    });

    expect(typeof teardown).toBe('function');
  });

  it('returns empty teardown function when no container found', () => {
    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com/share',
      getShareText: () => 'Test share text'
    });

    expect(typeof teardown).toBe('function');
    // Should not throw
    teardown();
  });

  it('updates share link URLs when clicked', () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    let callCount = 0;
    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => {
        callCount++;
        return 'https://test.com/dynamic-url';
      },
      getShareText: () => 'Dynamic text'
    });

    const twitterLink = localThis.container.querySelector('[data-share="twitter"]');
    twitterLink.click();

    // getShareableUrl should be called to update URLs
    expect(callCount).toBeGreaterThan(0);
    expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/dynamic-url'));

    teardown();
  });

  it('handles copy-link action', async () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com/copied-url',
      getShareText: () => 'Copied text'
    });

    const copyLinkBtn = localThis.container.querySelector('[data-action="copy-link"]');
    copyLinkBtn.click();

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalledWith('https://test.com/copied-url');

    teardown();
  });

  it('handles copy-text action', async () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com',
      getShareText: () => 'Text to copy'
    });

    const copyTextBtn = localThis.container.querySelector('[data-action="copy-text"]');
    copyTextBtn.click();

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalledWith('Text to copy');

    teardown();
  });

  it('shows copy feedback after copy action', async () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com',
      getShareText: () => 'Test text'
    });

    const copyLinkBtn = localThis.container.querySelector('[data-action="copy-link"]');
    copyLinkBtn.click();

    await Promise.resolve();

    const feedback = localThis.container.querySelector('.share-copy-feedback');
    expect(feedback.classList.contains('visible')).toBe(true);

    teardown();
  });

  it('hides copy feedback after timeout', async () => {
    vi.useFakeTimers();
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com',
      getShareText: () => 'Test text'
    });

    const copyLinkBtn = localThis.container.querySelector('[data-action="copy-link"]');
    copyLinkBtn.click();

    await Promise.resolve();

    const feedback = localThis.container.querySelector('.share-copy-feedback');
    expect(feedback.classList.contains('visible')).toBe(true);

    // Advance timer past feedback timeout (1500ms)
    vi.advanceTimersByTime(1600);

    expect(feedback.classList.contains('visible')).toBe(false);

    vi.useRealTimers();
    teardown();
  });

  it('uses fallback copy method when clipboard API fails', async () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    // Mock clipboard to fail
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Not supported'))
      }
    });

    // Mock document.execCommand
    const execCommandMock = vi.fn();
    document.execCommand = execCommandMock;

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com/fallback',
      getShareText: () => 'Fallback text'
    });

    const copyLinkBtn = localThis.container.querySelector('[data-action="copy-link"]');
    copyLinkBtn.click();

    await Promise.resolve();
    await Promise.resolve(); // Wait for catch block

    expect(execCommandMock).toHaveBeenCalledWith('copy');

    teardown();
  });

  it('uses custom email subject when provided', () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com',
      getShareText: () => 'Test text',
      emailSubject: 'Custom Email Subject'
    });

    // Trigger URL update by clicking a share link
    const emailLink = localThis.container.querySelector('[data-share="email"]');
    emailLink.click();

    expect(emailLink.href).toContain(encodeURIComponent('Custom Email Subject'));

    teardown();
  });

  it('teardown removes event listeners', () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    let callCount = 0;
    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => {
        callCount++;
        return 'https://test.com';
      },
      getShareText: () => 'Test'
    });

    // Initial update call
    const initialCount = callCount;

    teardown();

    // Click after teardown - should not increment count
    const twitterLink = localThis.container.querySelector('[data-share="twitter"]');
    twitterLink.click();

    // Count should remain the same after teardown
    expect(callCount).toBe(initialCount);
  });

  it('ignores clicks on non-action buttons', async () => {
    const html = renderInlineShareButtonsHTML();
    localThis.container.innerHTML = html;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    const teardown = initInlineShareButtons(localThis.container, {
      getShareableUrl: () => 'https://test.com',
      getShareText: () => 'Test'
    });

    // Click on the wrapper itself (not a button)
    const wrapper = localThis.container.querySelector('.share-buttons-inline');
    wrapper.click();

    await Promise.resolve();

    // writeText should not be called
    expect(writeTextMock).not.toHaveBeenCalled();

    teardown();
  });
});
