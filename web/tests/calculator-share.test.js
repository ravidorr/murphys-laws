import { initCalculatorSharePopover } from '@modules/calculator-share.js';

describe('initCalculatorSharePopover', () => {
  /** @type {HTMLElement} */
  let root;
  let teardown;

  function createSharePopoverHTML() {
    return `
      <div class="share-wrapper calculator-share">
        <button type="button" class="share-trigger" aria-expanded="false" aria-haspopup="true">
          Share
        </button>
        <div class="share-popover" role="menu">
          <a class="share-popover-item" href="#" role="menuitem" target="_blank" rel="noopener noreferrer" data-share="twitter">
            Share on X
          </a>
          <a class="share-popover-item" href="#" role="menuitem" target="_blank" rel="noopener noreferrer" data-share="facebook">
            Share on Facebook
          </a>
          <a class="share-popover-item" href="#" role="menuitem" target="_blank" rel="noopener noreferrer" data-share="linkedin">
            Share on LinkedIn
          </a>
          <a class="share-popover-item" href="#" role="menuitem" target="_blank" rel="noopener noreferrer" data-share="reddit">
            Share on Reddit
          </a>
          <a class="share-popover-item" href="#" role="menuitem" target="_blank" rel="noopener noreferrer" data-share="whatsapp">
            Share on WhatsApp
          </a>
          <a class="share-popover-item" href="#" role="menuitem" target="_self" data-share="email">
            Share via Email
          </a>
          <div class="share-popover-divider"></div>
          <button type="button" class="share-popover-item" role="menuitem" data-action="copy-text">
            Copy text
          </button>
          <button type="button" class="share-popover-item" role="menuitem" data-action="copy-link">
            Copy link
          </button>
          <div class="share-copy-feedback">
            Copied!
          </div>
        </div>
      </div>
    `;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    root.innerHTML = createSharePopoverHTML();
    document.body.appendChild(root);
  });

  afterEach(() => {
    teardown?.();
    if (root?.parentNode) root.parentNode.removeChild(root);
    root = null;
    vi.useRealTimers();
  });

  it('throws error if root is not provided', () => {
    expect(() => initCalculatorSharePopover({})).toThrow('initCalculatorSharePopover requires a root element');
  });

  it('returns empty function if share wrapper is not found', () => {
    const emptyRoot = document.createElement('div');
    const result = initCalculatorSharePopover({
      root: emptyRoot,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });
    expect(typeof result).toBe('function');
  });

  it('returns teardown function', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });
    expect(typeof teardown).toBe('function');
  });

  it('toggles popover open on trigger click', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    expect(popover.classList.contains('open')).toBe(false);
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles popover closed on second trigger click', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes popover on outside click', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    document.dispatchEvent(new Event('click'));
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('closes popover on Escape key', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test text',
      emailSubject: 'Test subject'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('updates share links with correct URLs', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com/test?param=value',
      getShareText: () => 'My test result!',
      emailSubject: 'Check this out'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const twitterLink = root.querySelector('[data-share="twitter"]');
    const facebookLink = root.querySelector('[data-share="facebook"]');
    const linkedinLink = root.querySelector('[data-share="linkedin"]');
    const redditLink = root.querySelector('[data-share="reddit"]');
    const whatsappLink = root.querySelector('[data-share="whatsapp"]');
    const emailLink = root.querySelector('[data-share="email"]');

    expect(twitterLink.href).toContain('twitter.com/intent/tweet');
    expect(twitterLink.href).toContain(encodeURIComponent('http://example.com/test?param=value'));
    expect(facebookLink.href).toContain('facebook.com/sharer');
    expect(linkedinLink.href).toContain('linkedin.com/shareArticle');
    expect(redditLink.href).toContain('reddit.com/submit');
    expect(whatsappLink.href).toContain('api.whatsapp.com/send');
    expect(emailLink.href).toContain('mailto:');
  });

  it('copies link to clipboard on copy-link click', async () => {
    const localThis = {
      getShareableUrl: vi.fn(() => 'http://example.com/shareable'),
      getShareText: vi.fn(() => 'Test text'),
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: localThis.getShareableUrl,
      getShareText: localThis.getShareText,
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyLinkBtn = root.querySelector('[data-action="copy-link"]');
    copyLinkBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(localThis.writeTextMock).toHaveBeenCalledWith('http://example.com/shareable');
  });

  it('copies text to clipboard on copy-text click', async () => {
    const localThis = {
      getShareableUrl: vi.fn(() => 'http://example.com'),
      getShareText: vi.fn(() => 'My calculation result!'),
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: localThis.getShareableUrl,
      getShareText: localThis.getShareText,
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyTextBtn = root.querySelector('[data-action="copy-text"]');
    copyTextBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(localThis.writeTextMock).toHaveBeenCalledWith('My calculation result!');
  });

  it('shows copy feedback after successful copy', async () => {
    const localThis = {
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const feedback = root.querySelector('.share-copy-feedback');
    expect(feedback.classList.contains('visible')).toBe(false);

    const copyLinkBtn = root.querySelector('[data-action="copy-link"]');
    copyLinkBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(feedback.classList.contains('visible')).toBe(true);

    // Feedback should hide after timeout
    vi.advanceTimersByTime(1600);
    expect(feedback.classList.contains('visible')).toBe(false);
  });

  it('uses fallback copy method when clipboard API fails', async () => {
    const localThis = {
      writeTextMock: vi.fn().mockRejectedValue(new Error('Clipboard error')),
      execCommandMock: vi.fn().mockReturnValue(true)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    document.execCommand = localThis.execCommandMock;

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com/fallback',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyLinkBtn = root.querySelector('[data-action="copy-link"]');
    copyLinkBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();
    await Promise.resolve();

    expect(localThis.execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('closes popover after clicking share link', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    const twitterLink = root.querySelector('[data-share="twitter"]');
    twitterLink.dispatchEvent(new Event('click', { bubbles: true }));

    vi.advanceTimersByTime(150);
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('closes popover after clicking copy button', async () => {
    const localThis = {
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    const copyLinkBtn = root.querySelector('[data-action="copy-link"]');
    copyLinkBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();
    vi.advanceTimersByTime(150);
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('closes other popovers when opening a new one', () => {
    // Create a second share popover
    const secondPopover = document.createElement('div');
    secondPopover.innerHTML = createSharePopoverHTML();
    document.body.appendChild(secondPopover);

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const teardown2 = initCalculatorSharePopover({
      root: secondPopover,
      getShareableUrl: () => 'http://example.com/2',
      getShareText: () => 'Test 2',
      emailSubject: 'Test 2'
    });

    const trigger1 = root.querySelector('.share-trigger');
    const popover1 = root.querySelector('.share-popover');
    const trigger2 = secondPopover.querySelector('.share-trigger');
    const popover2 = secondPopover.querySelector('.share-popover');

    // Open first popover
    trigger1.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover1.classList.contains('open')).toBe(true);

    // Open second popover - first should close
    trigger2.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover1.classList.contains('open')).toBe(false);
    expect(popover2.classList.contains('open')).toBe(true);

    teardown2();
    secondPopover.parentNode.removeChild(secondPopover);
  });

  it('does not close popover on click inside popover', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');
    const divider = popover.querySelector('.share-popover-divider');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Click on divider (inside popover but not an action)
    divider.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('adds popover-above class when near viewport bottom', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    // Mock getBoundingClientRect to simulate trigger near bottom of viewport
    const originalGetBoundingClientRect = trigger.getBoundingClientRect;
    trigger.getBoundingClientRect = () => ({
      bottom: window.innerHeight - 50, // Near bottom
      top: window.innerHeight - 100
    });

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('popover-above')).toBe(true);

    trigger.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('removes event listeners on teardown', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    // Verify it works before teardown
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(false);

    // Call teardown
    teardown();

    // Re-initialize to ensure listeners were removed
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com/new',
      getShareText: () => 'New test',
      emailSubject: 'New test'
    });

    // Should still work with new initialization
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('handles missing trigger gracefully', () => {
    root.querySelector('.share-trigger').remove();

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    expect(typeof teardown).toBe('function');
  });

  it('handles missing popover gracefully', () => {
    root.querySelector('.share-popover').remove();

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    expect(typeof teardown).toBe('function');
  });

  it('uses default email subject when not provided', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test'
      // emailSubject not provided
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const emailLink = root.querySelector('[data-share="email"]');
    expect(emailLink.href).toContain('mailto:');
    expect(emailLink.href).toContain('subject=');
  });

  it('ignores non-Escape keys', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Press a different key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('handles missing feedback element gracefully', async () => {
    // Remove feedback element
    root.querySelector('.share-copy-feedback').remove();

    const localThis = {
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyLinkBtn = root.querySelector('[data-action="copy-link"]');
    copyLinkBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    // Should not throw even without feedback element
    expect(localThis.writeTextMock).toHaveBeenCalled();
  });

  it('ignores unknown data-action attributes', async () => {
    // Add a button with unknown action
    const popover = root.querySelector('.share-popover');
    const unknownBtn = document.createElement('button');
    unknownBtn.setAttribute('data-action', 'unknown-action');
    unknownBtn.textContent = 'Unknown';
    popover.appendChild(unknownBtn);

    const localThis = {
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    unknownBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    // Should not call clipboard for unknown action
    expect(localThis.writeTextMock).not.toHaveBeenCalled();
  });

  it('ignores clicks not on data-action buttons in handleCopyAction', async () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Click directly on popover (not on any button)
    const divider = popover.querySelector('.share-popover-divider');
    divider.dispatchEvent(new Event('click', { bubbles: true }));

    // Popover should still be open
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('handles unknown platform in data-share gracefully', () => {
    // Add a link with unknown platform
    const popover = root.querySelector('.share-popover');
    const unknownLink = document.createElement('a');
    unknownLink.setAttribute('data-share', 'unknown-platform');
    unknownLink.href = '#';
    unknownLink.textContent = 'Unknown Platform';
    popover.appendChild(unknownLink);

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    // Unknown platform link should keep its original href
    expect(unknownLink.href).toContain('#');
  });

  it('handles outside click when popover is already closed', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const popover = root.querySelector('.share-popover');

    // Popover is closed
    expect(popover.classList.contains('open')).toBe(false);

    // Outside click should do nothing (no error)
    document.dispatchEvent(new Event('click'));
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('handles Escape key when popover is already closed', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const popover = root.querySelector('.share-popover');

    // Popover is closed
    expect(popover.classList.contains('open')).toBe(false);

    // Escape should do nothing (no error)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover.classList.contains('open')).toBe(false);
  });

  it('handles other popover without previousElementSibling', () => {
    // Create a popover that is the first child (no previousElementSibling)
    const orphanPopover = document.createElement('div');
    orphanPopover.className = 'share-popover open';
    document.body.insertBefore(orphanPopover, document.body.firstChild);

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');

    // Opening our popover should close the orphan popover without error
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    expect(orphanPopover.classList.contains('open')).toBe(false);

    document.body.removeChild(orphanPopover);
  });

  it('removes popover-above class when there is enough space below', () => {
    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    // First open with limited space (add popover-above)
    const originalGetBoundingClientRect = trigger.getBoundingClientRect;
    trigger.getBoundingClientRect = () => ({
      bottom: window.innerHeight - 50,
      top: window.innerHeight - 100
    });

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('popover-above')).toBe(true);

    // Close popover
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    // Now open with plenty of space (should remove popover-above)
    trigger.getBoundingClientRect = () => ({
      bottom: 100,
      top: 50
    });

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('popover-above')).toBe(false);

    trigger.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('handles click event with no data-action button target', async () => {
    const localThis = {
      writeTextMock: vi.fn().mockResolvedValue(undefined)
    };

    Object.assign(navigator, {
      clipboard: {
        writeText: localThis.writeTextMock
      }
    });

    teardown = initCalculatorSharePopover({
      root,
      getShareableUrl: () => 'http://example.com',
      getShareText: () => 'Test',
      emailSubject: 'Test'
    });

    const trigger = root.querySelector('.share-trigger');
    const popover = root.querySelector('.share-popover');

    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Create a click event where closest('[data-action]') returns null
    // by clicking on an element without data-action
    const feedback = root.querySelector('.share-copy-feedback');
    
    // Simulate a click that goes through handlePopoverClick but has no data-action
    // This is different from clicking divider because we need to ensure
    // the click goes to handleCopyAction path but button is null
    const clickEvent = new MouseEvent('click', { bubbles: true });
    
    // Override closest to simulate no button found
    const originalClosest = feedback.closest;
    feedback.closest = (selector) => {
      if (selector === '[data-action]') return null;
      if (selector === 'a[data-share]') return null;
      return originalClosest.call(feedback, selector);
    };
    
    feedback.dispatchEvent(clickEvent);
    
    feedback.closest = originalClosest;

    // Should not have called clipboard
    expect(localThis.writeTextMock).not.toHaveBeenCalled();
  });
});
