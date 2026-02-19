import { Calculator } from '@views/sods-calculator.js';

describe("Calculator view", () => {
  let el;
  let originalMathJax;
  let originalFetch;

  type MountOptions = { mathJaxStub?: { typesetPromise: (elements?: HTMLElement[]) => Promise<void> } | null };
  function mountCalculator({ mathJaxStub }: MountOptions = {}) {
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    if (mathJaxStub === null) {
      delete window.MathJax;
    } else if (mathJaxStub) {
      window.MathJax = mathJaxStub;
    } else {
      window.MathJax = { typesetPromise: vi.fn().mockResolvedValue(undefined) };
    }

    el = Calculator();
    document.body.appendChild(el);
    return el;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    originalMathJax = window.MathJax;
    originalFetch = global.fetch;
    mountCalculator();
  });

  afterEach(async () => {
    // Run all pending timers and flush promises before switching to real timers
    // to prevent callbacks from firing after the test environment is torn down
    vi.runAllTimers();
    // Flush any pending promises (e.g., from requestAnimationFrame callbacks)
    await vi.runAllTimersAsync();
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);
    el = null;
    vi.useRealTimers();
    window.MathJax = originalMathJax;
    global.fetch = originalFetch;
  });

  it('computes a score and updates interpretation', () => {
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '9';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    expect(score).toBeGreaterThan(0);
    expect(el.querySelector('#score-interpretation').textContent.length).toBeGreaterThan(5);
  });

  it('shows "safe" interpretation for low scores (< 2)', () => {
    el.querySelector('#urgency').value = '1';
    el.querySelector('#complexity').value = '1';
    el.querySelector('#importance').value = '1';
    el.querySelector('#skill').value = '9';
    el.querySelector('#frequency').value = '1';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    const interpretation = el.querySelector('#score-interpretation').textContent;

    expect(score).toBeLessThan(2);
    expect(interpretation).toMatch(/safe/i);
    expect(el.querySelector('#result-display').classList.contains('calc-ok')).toBe(true);
  });

  it('shows "risky" interpretation for scores between 2 and 4', () => {
    el.querySelector('#urgency').value = '4';
    el.querySelector('#complexity').value = '4';
    el.querySelector('#importance').value = '4';
    el.querySelector('#skill').value = '6';
    el.querySelector('#frequency').value = '3';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    const interpretation = el.querySelector('#score-interpretation').textContent;

    expect(score).toBeGreaterThanOrEqual(2);
    expect(score).toBeLessThan(4);
    expect(interpretation).toMatch(/risky/i);
    expect(el.querySelector('#result-display').classList.contains('calc-warn')).toBe(true);
  });

  it('shows "worrying" interpretation for scores between 4 and 6', () => {
    el.querySelector('#urgency').value = '5';
    el.querySelector('#complexity').value = '5';
    el.querySelector('#importance').value = '5';
    el.querySelector('#skill').value = '5';
    el.querySelector('#frequency').value = '5';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    const interpretation = el.querySelector('#score-interpretation').textContent;

    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThan(6);
    expect(interpretation).toMatch(/worrying/i);
    expect(el.querySelector('#result-display').classList.contains('calc-orange')).toBe(true);
  });

  it('shows "disaster" interpretation for scores between 6 and 8', () => {
    el.querySelector('#urgency').value = '5';
    el.querySelector('#complexity').value = '5';
    el.querySelector('#importance').value = '5';
    el.querySelector('#skill').value = '3';
    el.querySelector('#frequency').value = '5';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    const interpretation = el.querySelector('#score-interpretation').textContent;

    expect(score).toBeGreaterThanOrEqual(6);
    expect(score).toBeLessThan(8);
    expect(interpretation).toMatch(/disaster/i);
    expect(el.querySelector('#result-display').classList.contains('calc-danger')).toBe(true);
  });

  it('shows "catastrophe" interpretation for high scores (>= 8)', () => {
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '9';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    const interpretation = el.querySelector('#score-interpretation').textContent;

    expect(score).toBeGreaterThanOrEqual(8);
    expect(interpretation).toMatch(/catastrophe/i);
    expect(el.querySelector('#result-display').classList.contains('calc-dark')).toBe(true);
  });

  it('updates slider value displays on input', () => {
    el.querySelector('#urgency').value = '7';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    expect(el.querySelector('#urgency-value').textContent).toBe('7');
  });

  it('resets formula values after timeout', () => {
    el.querySelector('#urgency').value = '7';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(2100);

    expect(el.querySelector('#formula-display')).toBeTruthy();
  });

  it('polls for MathJax when not initially available', async () => {
    mountCalculator({ mathJaxStub: null });

    vi.advanceTimersByTime(500);

    const mathJaxMock = {
      typesetPromise: vi.fn().mockResolvedValue(undefined)
    };
    mountCalculator({ mathJaxStub: mathJaxMock });

    vi.advanceTimersByTime(100);
    await vi.runOnlyPendingTimersAsync(); // Allow requestAnimationFrame to execute

    const formulaDisplay = el.querySelector('#formula-display');
    expect(mathJaxMock.typesetPromise).toHaveBeenCalledWith([formulaDisplay]);
  });

  it('stops polling for MathJax after timeout', () => {
    mountCalculator({ mathJaxStub: null });

    vi.advanceTimersByTime(11000);

    expect(window.MathJax).toBeUndefined();
  });

  it('shows formula with values when sliders change and hides after timeout', () => {
    const urgencySlider = el.querySelector('#urgency');
    urgencySlider.value = '7';
    urgencySlider.dispatchEvent(new Event('input'));

    const formulaDisplay = el.querySelector('#formula-display');
    expect(formulaDisplay.textContent).toContain('0.7');
    expect(formulaDisplay.textContent).toContain('7');

    vi.advanceTimersByTime(2100);
    expect(formulaDisplay.textContent).toContain('A');
    expect(formulaDisplay.textContent).toContain('U');
  });


  it('renders inline share buttons with all social share options', () => {
    const shareContainer = el.querySelector('#calculator-share-container');
    expect(shareContainer).toBeTruthy();
    const shareButtons = el.querySelector('.share-buttons-inline');
    expect(shareButtons).toBeTruthy();
    expect(el.querySelector('[data-share="twitter"]')).toBeTruthy();
    expect(el.querySelector('[data-share="facebook"]')).toBeTruthy();
    expect(el.querySelector('[data-share="linkedin"]')).toBeTruthy();
    expect(el.querySelector('[data-share="reddit"]')).toBeTruthy();
    expect(el.querySelector('[data-share="whatsapp"]')).toBeTruthy();
    expect(el.querySelector('[data-share="email"]')).toBeTruthy();
    expect(el.querySelector('[data-action="copy-text"]')).toBeTruthy();
    expect(el.querySelector('[data-action="copy-link"]')).toBeTruthy();
  });

  it('inline share buttons are always visible (no toggle needed)', () => {
    const shareButtons = el.querySelector('.share-buttons-inline');
    expect(shareButtons).toBeTruthy();
    // Inline buttons don't need a trigger - they're always visible
    expect(el.querySelector('[data-share="twitter"]')).toBeTruthy();
  });

  it('copies link to clipboard when copy-link button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Click copy-link button directly (no popover to open)
    const copyBtn = el.querySelector('[data-action="copy-link"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain('u=');
    expect(copiedUrl).toContain('c=');
    expect(copiedUrl).toContain('i=');
    expect(copiedUrl).toContain('s=');
    expect(copiedUrl).toContain('f=');
  });

  it('copies text to clipboard when copy-text button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Click copy-text button directly (no popover to open)
    const copyBtn = el.querySelector('[data-action="copy-text"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toMatch(/Sod's Law score/i);
  });

  it('share links have correct URLs', () => {
    // Set specific slider values
    el.querySelector('#urgency').value = '7';
    el.querySelector('#complexity').value = '8';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    // Click a share link to trigger URL update
    const twitterLink = el.querySelector('[data-share="twitter"]');
    twitterLink.dispatchEvent(new Event('click', { bubbles: true }));

    const facebookLink = el.querySelector('[data-share="facebook"]');
    const linkedinLink = el.querySelector('[data-share="linkedin"]');
    const redditLink = el.querySelector('[data-share="reddit"]');
    const whatsappLink = el.querySelector('[data-share="whatsapp"]');
    const emailLink = el.querySelector('[data-share="email"]');

    expect(twitterLink.href).toContain('twitter.com/intent/tweet');
    expect(facebookLink.href).toContain('facebook.com/sharer');
    expect(linkedinLink.href).toContain('linkedin.com/shareArticle');
    expect(redditLink.href).toContain('reddit.com/submit');
    expect(whatsappLink.href).toContain('api.whatsapp.com/send');
    expect(emailLink.href).toContain('mailto:');
  });

  it('shows copy feedback when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const copyBtn = el.querySelector('[data-action="copy-link"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    const feedback = el.querySelector('.share-copy-feedback');
    expect(feedback.classList.contains('visible')).toBe(true);
  });

  it('hides copy feedback after timeout', async () => {
    // Note: vi.useFakeTimers() is already called in beforeEach
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const copyBtn = el.querySelector('[data-action="copy-link"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    const feedback = el.querySelector('.share-copy-feedback');
    expect(feedback.classList.contains('visible')).toBe(true);

    // Advance timer past the feedback timeout (1500ms)
    vi.advanceTimersByTime(1600);

    expect(feedback.classList.contains('visible')).toBe(false);
    // Note: vi.useRealTimers() is called in afterEach
  });

  it('loads URL parameters into sliders', () => {
    // Clean up existing element
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    // Use vi.stubGlobal for proper location mocking
    const originalSearch = window.location.search;
    vi.stubGlobal('location', {
      ...window.location,
      search: '?u=7&c=8&i=3&s=6&f=4',
      href: 'http://localhost:3000/calculator?u=7&c=8&i=3&s=6&f=4'
    });

    // Mount new calculator
    el = Calculator();
    document.body.appendChild(el);

    expect(el.querySelector('#urgency').value).toBe('7');
    expect(el.querySelector('#complexity').value).toBe('8');
    expect(el.querySelector('#importance').value).toBe('3');
    expect(el.querySelector('#skill').value).toBe('6');
    expect(el.querySelector('#frequency').value).toBe('4');

    // Also verify slider value displays are updated
    expect(el.querySelector('#urgency-value').textContent).toBe('7');
    expect(el.querySelector('#complexity-value').textContent).toBe('8');
    expect(el.querySelector('#importance-value').textContent).toBe('3');
    expect(el.querySelector('#skill-value').textContent).toBe('6');
    expect(el.querySelector('#frequency-value').textContent).toBe('4');

    // Restore location
    vi.unstubAllGlobals();
  });

  it('ignores URL parameters outside valid range 1-9', () => {
    // Clean up existing element
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    // Use vi.stubGlobal for proper location mocking
    vi.stubGlobal('location', {
      ...window.location,
      search: '?u=0&c=10&i=-5&s=&f=abc',
      href: 'http://localhost:3000/calculator?u=0&c=10&i=-5&s=&f=abc'
    });

    // Mount new calculator
    el = Calculator();
    document.body.appendChild(el);

    // All sliders should retain default value of 5
    expect(el.querySelector('#urgency').value).toBe('5');
    expect(el.querySelector('#complexity').value).toBe('5');
    expect(el.querySelector('#importance').value).toBe('5');
    expect(el.querySelector('#skill').value).toBe('5');
    expect(el.querySelector('#frequency').value).toBe('5');

    // Restore location
    vi.unstubAllGlobals();
  });

  it('loads URL parameters and updates slider value displays', () => {
    // Clean up existing element
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    // Mock window.location to have URL params
    const originalLocation = window.location;
    const mockLocation = {
      ...originalLocation,
      href: 'http://localhost:3000/calculator?u=5&c=6&i=7&s=8&f=9',
      search: '?u=5&c=6&i=7&s=8&f=9'
    };
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true, configurable: true });

    // Mount new calculator
    el = Calculator();
    document.body.appendChild(el);

    // Check slider values
    expect(el.querySelector('#urgency').value).toBe('5');
    expect(el.querySelector('#complexity').value).toBe('6');
    expect(el.querySelector('#importance').value).toBe('7');
    expect(el.querySelector('#skill').value).toBe('8');
    expect(el.querySelector('#frequency').value).toBe('9');

    // Check slider value displays are also updated
    expect(el.querySelector('#urgency-value').textContent).toBe('5');
    expect(el.querySelector('#complexity-value').textContent).toBe('6');
    expect(el.querySelector('#importance-value').textContent).toBe('7');
    expect(el.querySelector('#skill-value').textContent).toBe('8');
    expect(el.querySelector('#frequency-value').textContent).toBe('9');

    // Restore location
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  it('ignores invalid URL parameters (out of range)', () => {
    // Clean up existing element
    el?.cleanup?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    // Mock window.location with invalid URL params
    const originalLocation = window.location;
    const mockLocation = {
      ...originalLocation,
      href: 'http://localhost:3000/calculator?u=0&c=10&i=-5&s=abc&f=',
      search: '?u=0&c=10&i=-5&s=abc&f='
    };
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true, configurable: true });

    // Mount new calculator
    el = Calculator();
    document.body.appendChild(el);

    // Sliders should retain their default values (5 for all)
    expect(el.querySelector('#urgency').value).toBe('5');
    expect(el.querySelector('#complexity').value).toBe('5');
    expect(el.querySelector('#importance').value).toBe('5');
    expect(el.querySelector('#skill').value).toBe('5');
    expect(el.querySelector('#frequency').value).toBe('5');

    // Restore location
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
  });

  it('uses current state values when generating shareable URL', async () => {
    // Set specific slider values
    el.querySelector('#urgency').value = '3';
    el.querySelector('#complexity').value = '4';
    el.querySelector('#importance').value = '5';
    el.querySelector('#skill').value = '6';
    el.querySelector('#frequency').value = '7';

    // Dispatch input to update state
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    // Click copy link button to trigger getShareableUrl
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Click copy-link button directly (inline share buttons)
    const copyBtn = el.querySelector('[data-action="copy-link"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    // Check the URL contains updated values
    const copiedUrl = writeTextMock.mock.calls[0]?.[0] || '';
    expect(copiedUrl).toContain('u=3');
    expect(copiedUrl).toContain('c=4');
    expect(copiedUrl).toContain('i=5');
    expect(copiedUrl).toContain('s=6');
    expect(copiedUrl).toContain('f=7');
  });

});
