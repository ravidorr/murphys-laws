import { Calculator } from '@views/sods-calculator.js';

describe("Calculator view", () => {
  let el;
  let originalMathJax;
  let originalFetch;

  function mountCalculator({ mathJaxStub } = {}) {
    el?._teardownShare?.();
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

  afterEach(() => {
    // Run all pending timers before switching to real timers to prevent
    // callbacks from firing after the test environment is torn down
    vi.runAllTimers();
    el?._teardownShare?.();
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


  it('validates share preview and opens modal', () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    const previewBtn = el.querySelector('#preview-email');
    const shareStatus = el.querySelector('#share-status');
    previewBtn.dispatchEvent(new Event('click'));
    expect(shareStatus.textContent).toMatch(/task description/i);

    el.querySelector('#task-description').value = 'Deploy app';
    el.querySelector('#sender-name').value = 'John Doe';
    el.querySelector('#sender-email').value = 'john@example.com';
    el.querySelector('#recipient-name').value = 'Jane Smith';
    el.querySelector('#recipient-email').value = 'user@example.com';
    previewBtn.dispatchEvent(new Event('click'));

    expect(shareStatus.classList.contains('hidden')).toBe(true);
    expect(el.querySelector('#email-preview-modal').classList.contains('hidden')).toBe(false);
  });

  it('handles share send success and cancellation', async () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    el.querySelector('#task-description').value = 'Deploy app';
    el.querySelector('#sender-name').value = 'John Doe';
    el.querySelector('#sender-email').value = 'john@example.com';
    el.querySelector('#recipient-name').value = 'Jane Smith';
    el.querySelector('#recipient-email').value = 'user@example.com';

    const sendBtn = el.querySelector('#send-email');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
    global.fetch = fetchMock;

    sendBtn.dispatchEvent(new Event('click'));

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
    expect(el.querySelector('#share-status').textContent).toMatch(/sent successfully/i);

    vi.advanceTimersByTime(2100);
    await Promise.resolve();
    expect(el.querySelector('#share-form-container').classList.contains('hidden')).toBe(true);
  });

  it('validates sender name is required', () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    const sendBtn = el.querySelector('#send-email');
    const shareStatus = el.querySelector('#share-status');

    el.querySelector('#task-description').value = 'Deploy app';
    // sender-name is empty
    el.querySelector('#sender-email').value = 'john@example.com';
    el.querySelector('#recipient-name').value = 'Jane Smith';
    el.querySelector('#recipient-email').value = 'user@example.com';

    sendBtn.dispatchEvent(new Event('click'));

    expect(shareStatus.textContent).toMatch(/your name/i);
    expect(shareStatus.classList.contains('error')).toBe(true);
  });

  it('validates sender email is required and properly formatted', () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    const sendBtn = el.querySelector('#send-email');
    const shareStatus = el.querySelector('#share-status');

    el.querySelector('#task-description').value = 'Deploy app';
    el.querySelector('#sender-name').value = 'John Doe';
    el.querySelector('#sender-email').value = 'invalid-email';
    el.querySelector('#recipient-name').value = 'Jane Smith';
    el.querySelector('#recipient-email').value = 'user@example.com';

    sendBtn.dispatchEvent(new Event('click'));

    expect(shareStatus.textContent).toMatch(/valid email address for sender/i);
    expect(shareStatus.classList.contains('error')).toBe(true);
  });

  it('validates recipient name is required', () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    const sendBtn = el.querySelector('#send-email');
    const shareStatus = el.querySelector('#share-status');

    el.querySelector('#task-description').value = 'Deploy app';
    el.querySelector('#sender-name').value = 'John Doe';
    el.querySelector('#sender-email').value = 'john@example.com';
    // recipient-name is empty
    el.querySelector('#recipient-email').value = 'user@example.com';

    sendBtn.dispatchEvent(new Event('click'));

    expect(shareStatus.textContent).toMatch(/recipient name/i);
    expect(shareStatus.classList.contains('error')).toBe(true);
  });

  it('validates recipient email is properly formatted', () => {
    el.querySelector('#share-cta').dispatchEvent(new Event('click'));
    const sendBtn = el.querySelector('#send-email');
    const shareStatus = el.querySelector('#share-status');

    el.querySelector('#task-description').value = 'Deploy app';
    el.querySelector('#sender-name').value = 'John Doe';
    el.querySelector('#sender-email').value = 'john@example.com';
    el.querySelector('#recipient-name').value = 'Jane Smith';
    el.querySelector('#recipient-email').value = 'not-an-email';

    sendBtn.dispatchEvent(new Event('click'));

    expect(shareStatus.textContent).toMatch(/valid recipient email/i);
    expect(shareStatus.classList.contains('error')).toBe(true);
  });

  it('renders quick share buttons', () => {
    expect(el.querySelector('#copy-link')).toBeTruthy();
    expect(el.querySelector('#share-twitter')).toBeTruthy();
    expect(el.querySelector('#share-facebook')).toBeTruthy();
  });

  it('copies link to clipboard when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const copyBtn = el.querySelector('#copy-link');
    copyBtn.dispatchEvent(new Event('click'));

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain('u=');
    expect(copiedUrl).toContain('c=');
    expect(copiedUrl).toContain('i=');
    expect(copiedUrl).toContain('s=');
    expect(copiedUrl).toContain('f=');
  });

  it('shows success feedback after copying link', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const copyBtn = el.querySelector('#copy-link');
    const copyFeedback = el.querySelector('#copy-feedback');

    copyBtn.dispatchEvent(new Event('click'));

    await Promise.resolve();
    await Promise.resolve();

    expect(copyFeedback.textContent).toMatch(/copied/i);
    expect(copyFeedback.classList.contains('success')).toBe(true);
  });

  it('shows error feedback when clipboard fails', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const copyBtn = el.querySelector('#copy-link');
    const copyFeedback = el.querySelector('#copy-feedback');

    copyBtn.dispatchEvent(new Event('click'));

    await Promise.resolve();
    await Promise.resolve();

    expect(copyFeedback.textContent).toMatch(/failed/i);
    expect(copyFeedback.classList.contains('error')).toBe(true);
  });

  it('opens Twitter share window when Twitter button is clicked', () => {
    const windowOpenMock = vi.fn();
    window.open = windowOpenMock;

    const twitterBtn = el.querySelector('#share-twitter');
    twitterBtn.dispatchEvent(new Event('click'));

    expect(windowOpenMock).toHaveBeenCalled();
    const twitterUrl = windowOpenMock.mock.calls[0][0];
    expect(twitterUrl).toContain('twitter.com/intent/tweet');
  });

  it('opens Facebook share window when Facebook button is clicked', () => {
    const windowOpenMock = vi.fn();
    window.open = windowOpenMock;

    const facebookBtn = el.querySelector('#share-facebook');
    facebookBtn.dispatchEvent(new Event('click'));

    expect(windowOpenMock).toHaveBeenCalled();
    const facebookUrl = windowOpenMock.mock.calls[0][0];
    expect(facebookUrl).toContain('facebook.com/sharer');
  });

  it('loads URL parameters into sliders', () => {
    // Clean up existing element
    el?._teardownShare?.();
    if (el?.parentNode) el.parentNode.removeChild(el);

    // Set URL params
    const url = new URL(window.location.href);
    url.searchParams.set('u', '7');
    url.searchParams.set('c', '8');
    url.searchParams.set('i', '3');
    url.searchParams.set('s', '6');
    url.searchParams.set('f', '4');
    window.history.replaceState({}, '', url.toString());

    // Mount new calculator
    el = Calculator();
    document.body.appendChild(el);

    expect(el.querySelector('#urgency').value).toBe('7');
    expect(el.querySelector('#complexity').value).toBe('8');
    expect(el.querySelector('#importance').value).toBe('3');
    expect(el.querySelector('#skill').value).toBe('6');
    expect(el.querySelector('#frequency').value).toBe('4');

    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  });

});
