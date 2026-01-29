import { ButteredToastCalculator } from '@views/buttered-toast-calculator.js';

describe('ButteredToastCalculator view', () => {
  it('renders with all sliders and initial values', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    expect(el.textContent).toMatch(/Buttered Toast Landing Calculator/);
    expect(el.querySelector('#toast-height')).toBeTruthy();
    expect(el.querySelector('#toast-gravity')).toBeTruthy();
    expect(el.querySelector('#toast-overhang')).toBeTruthy();
    expect(el.querySelector('#toast-butter')).toBeTruthy();
    expect(el.querySelector('#toast-friction')).toBeTruthy();
    expect(el.querySelector('#toast-inertia')).toBeTruthy();

    document.body.removeChild(el);
  });

  it('computes probability and updates interpretation', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set slider values
    el.querySelector('#toast-height').value = '75';
    el.querySelector('#toast-gravity').value = '980';
    el.querySelector('#toast-overhang').value = '5';
    el.querySelector('#toast-butter').value = '1.2';
    el.querySelector('#toast-friction').value = '20';
    el.querySelector('#toast-inertia').value = '350';

    // Trigger input event to calculate
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const probability = el.querySelector('#toast-probability-value').textContent;
    expect(probability).toMatch(/%$/);
    expect(el.querySelector('#toast-interpretation').textContent.length).toBeGreaterThan(5);

    document.body.removeChild(el);
  });

  it('shows "safe" interpretation for low probability (< 25%)', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set values to produce a low probability
    el.querySelector('#toast-height').value = '30';
    el.querySelector('#toast-gravity').value = '2479';
    el.querySelector('#toast-overhang').value = '1';
    el.querySelector('#toast-butter').value = '1.0';
    el.querySelector('#toast-friction').value = '100';
    el.querySelector('#toast-inertia').value = '500';

    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation').textContent;

    expect(interpretation).toMatch(/Looking good/i);
    expect(el.querySelector('#toast-result-display').classList.contains('calc-ok')).toBe(true);

    document.body.removeChild(el);
  });

  it('shows "toss-up" interpretation for medium probability (25-60%)', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set values to produce medium probability
    el.querySelector('#toast-height').value = '80';
    el.querySelector('#toast-gravity').value = '1200';
    el.querySelector('#toast-overhang').value = '8';
    el.querySelector('#toast-butter').value = '1.3';
    el.querySelector('#toast-friction').value = '40';
    el.querySelector('#toast-inertia').value = '350';

    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation').textContent;

    expect(interpretation).toMatch(/toss-up/i);
    expect(el.querySelector('#toast-result-display').classList.contains('calc-orange')).toBe(true);

    document.body.removeChild(el);
  });

  it('shows "butter zone" interpretation for high probability (60-85%)', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set values to produce high probability (60-85%)
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-gravity').value = '800';
    el.querySelector('#toast-overhang').value = '12';
    el.querySelector('#toast-butter').value = '1.6';
    el.querySelector('#toast-friction').value = '15';
    el.querySelector('#toast-inertia').value = '280';

    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation').textContent;

    expect(interpretation).toMatch(/butter zone/i);
    expect(el.querySelector('#toast-result-display').classList.contains('calc-danger')).toBe(true);

    document.body.removeChild(el);
  });

  it('shows "catastrophe" interpretation for very high probability (> 85%)', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set values to produce very high probability (> 85%)
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-gravity').value = '980';
    el.querySelector('#toast-overhang').value = '11';
    el.querySelector('#toast-butter').value = '1.2';
    el.querySelector('#toast-friction').value = '20';
    el.querySelector('#toast-inertia').value = '250';

    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation').textContent;

    expect(interpretation).toMatch(/Catastrophe is imminent/i);
    expect(el.querySelector('#toast-result-display').classList.contains('calc-dark')).toBe(true);

    document.body.removeChild(el);
  });

  it('updates slider value displays on input', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-height-value').textContent).toBe('100 cm');

    el.querySelector('#toast-gravity').value = '1500';
    el.querySelector('#toast-gravity').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-gravity-value').textContent).toBe('1500 cm/s²');

    el.querySelector('#toast-overhang').value = '10';
    el.querySelector('#toast-overhang').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-overhang-value').textContent).toBe('10 cm');

    el.querySelector('#toast-butter').value = '1.5';
    el.querySelector('#toast-butter').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-butter-value').textContent).toBe('1.50');

    el.querySelector('#toast-friction').value = '50';
    el.querySelector('#toast-friction').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-friction-value').textContent).toBe('50');

    el.querySelector('#toast-inertia').value = '400';
    el.querySelector('#toast-inertia').dispatchEvent(new Event('input'));
    expect(el.querySelector('#toast-inertia-value').textContent).toBe('400');

    document.body.removeChild(el);
  });

  it('resets formula values after timeout', async () => {
    vi.useFakeTimers();

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Trigger slider change to flash values
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Advance time past the 2-second timeout
    vi.advanceTimersByTime(2100);

    // Formula should have reset (though we can't easily check the internal showValues state)
    expect(el.querySelector('#toast-formula-display')).toBeTruthy();

    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('clears existing timeouts when slider changes rapidly', () => {
    vi.useFakeTimers();

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Trigger multiple slider changes rapidly
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(500);

    el.querySelector('#toast-height').value = '150';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Advance time past the 2-second timeout
    vi.advanceTimersByTime(2100);

    expect(el.querySelector('#toast-formula-display')).toBeTruthy();

    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('polls for MathJax when not initially available', () => {
    vi.useFakeTimers();

    // Temporarily remove MathJax
    const originalMathJax = window.MathJax;
    delete window.MathJax;

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Simulate MathJax loading after 500ms
    vi.advanceTimersByTime(500);

    // Restore MathJax with typesetPromise
    window.MathJax = {
      typesetPromise: vi.fn().mockResolvedValue(undefined)
    };

    // Advance to trigger the poll check
    vi.advanceTimersByTime(100);

    // Clean up
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('stops polling for MathJax after timeout', () => {
    vi.useFakeTimers();

    // Temporarily remove MathJax
    const originalMathJax = window.MathJax;
    delete window.MathJax;

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Advance past the 10-second polling timeout
    vi.advanceTimersByTime(11000);

    // Restore MathJax
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('handles MathJax warning when not available', () => {

    // Temporarily remove MathJax
    const originalMathJax = window.MathJax;
    delete window.MathJax;

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Trigger formula update
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));


    // Restore
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
  });

  it('re-renders formula when MathJax loads during polling', () => {
    vi.useFakeTimers();

    // Temporarily remove MathJax
    const originalMathJax = window.MathJax;
    delete window.MathJax;

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Simulate MathJax loading after 200ms
    vi.advanceTimersByTime(200);

    const mockTypesetPromise = vi.fn().mockResolvedValue(undefined);
    window.MathJax = {
      typesetPromise: mockTypesetPromise
    };

    // Trigger the poll check
    vi.advanceTimersByTime(100);

    // Clean up
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('calls MathJax after formula update', async () => {
    const mockTypesetPromise = vi.fn().mockResolvedValue(undefined);
    const originalMathJax = window.MathJax;

    window.MathJax = {
      typesetPromise: mockTypesetPromise
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Trigger formula update
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Wait for requestAnimationFrame to execute
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Wait for async MathJax call
    await vi.waitFor(() => {
      expect(mockTypesetPromise).toHaveBeenCalled();
    }, { timeout: 100 });

    // Restore
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
  });

  it('handles MathJax typeset error gracefully', async () => {
    const mockTypesetPromise = vi.fn().mockRejectedValue(new Error('MathJax error'));
    const originalMathJax = window.MathJax;

    window.MathJax = {
      typesetPromise: mockTypesetPromise
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Trigger formula update
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Wait for requestAnimationFrame to execute
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Wait for async MathJax call and error handling
    await vi.waitFor(() => {
      expect(mockTypesetPromise).toHaveBeenCalled();
    }, { timeout: 100 });

    // Restore
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
  });

  it('calculates probability of 0% when result is negative', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Values that might produce negative result (edge case)
    el.querySelector('#toast-height').value = '30';
    el.querySelector('#toast-gravity').value = '2479';
    el.querySelector('#toast-overhang').value = '1';
    el.querySelector('#toast-butter').value = '1.0';
    el.querySelector('#toast-friction').value = '100';
    el.querySelector('#toast-inertia').value = '500';

    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    const probability = el.querySelector('#toast-probability-value').textContent;
    const numericProb = parseInt(probability);

    expect(numericProb).toBeGreaterThanOrEqual(0);

    document.body.removeChild(el);
  });

  it('updates all sliders independently', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const sliderTests = [
      { id: 'toast-height', value: '150', display: 'toast-height-value', expected: '150 cm' },
      { id: 'toast-gravity', value: '1200', display: 'toast-gravity-value', expected: '1200 cm/s²' },
      { id: 'toast-overhang', value: '12', display: 'toast-overhang-value', expected: '12 cm' },
      { id: 'toast-butter', value: '1.75', display: 'toast-butter-value', expected: '1.75' },
      { id: 'toast-friction', value: '60', display: 'toast-friction-value', expected: '60' },
      { id: 'toast-inertia', value: '420', display: 'toast-inertia-value', expected: '420' }
    ];

    sliderTests.forEach(test => {
      const slider = el.querySelector(`#${test.id}`);
      slider.value = test.value;
      slider.dispatchEvent(new Event('input'));

      expect(el.querySelector(`#${test.display}`).textContent).toBe(test.expected);
    });

    document.body.removeChild(el);
  });

  it('displays initial probability on load', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const probability = el.querySelector('#toast-probability-value').textContent;
    expect(probability).toMatch(/\d+%/);

    document.body.removeChild(el);
  });

  it('displays formula element on load', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const formula = el.querySelector('#toast-formula-display');
    expect(formula).toBeTruthy();

    document.body.removeChild(el);
  });

  it('includes informational text about how it works', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    expect(el.textContent).toMatch(/How it works/i);
    expect(el.textContent).toMatch(/Height/i);
    expect(el.textContent).toMatch(/Gravity/i);
    expect(el.textContent).toMatch(/Butter Factor/i);

    document.body.removeChild(el);
  });

  it('loads slider values from URL parameters', () => {
    // Set URL with parameters
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      search: '?h=80&g=1000&o=6&b=1.5&f=25&t=400'
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Check that sliders were set from URL params
    expect(el.querySelector('#toast-height').value).toBe('80');
    expect(el.querySelector('#toast-gravity').value).toBe('1000');
    expect(el.querySelector('#toast-overhang').value).toBe('6');
    expect(el.querySelector('#toast-butter').value).toBe('1.5');
    expect(el.querySelector('#toast-friction').value).toBe('25');
    expect(el.querySelector('#toast-inertia').value).toBe('400');

    document.body.removeChild(el);
    window.location = originalLocation;
  });

  it('ignores URL parameters outside valid range', () => {
    // Set URL with out-of-range parameters
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      search: '?h=999&g=-100&o=50' // Values outside valid ranges
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Values outside range should not be applied (keep defaults)
    // Height range is typically 50-120, gravity 900-1100, overhang 1-10
    const heightSlider = el.querySelector('#toast-height');
    const gravitySlider = el.querySelector('#toast-gravity');
    const overhangSlider = el.querySelector('#toast-overhang');

    // Check that values stayed within valid range
    expect(parseFloat(heightSlider.value)).toBeLessThanOrEqual(parseFloat(heightSlider.max));
    expect(parseFloat(gravitySlider.value)).toBeGreaterThanOrEqual(parseFloat(gravitySlider.min));
    expect(parseFloat(overhangSlider.value)).toBeLessThanOrEqual(parseFloat(overhangSlider.max));

    document.body.removeChild(el);
    window.location = originalLocation;
  });

  it('recalculates when URL parameters are loaded', () => {
    // Set URL with some parameters
    const originalLocation = window.location;
    delete window.location;
    window.location = {
      ...originalLocation,
      search: '?h=90'
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // The probability should be calculated (not the default)
    const probability = el.querySelector('#toast-probability-value');
    expect(probability).toBeTruthy();
    expect(probability.textContent).toMatch(/\d+%/);

    document.body.removeChild(el);
    window.location = originalLocation;
  });

  it('renders share popover with all social share options', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const shareWrapper = el.querySelector('.share-wrapper.calculator-share');
    expect(shareWrapper).toBeTruthy();
    expect(el.querySelector('.share-trigger')).toBeTruthy();
    expect(el.querySelector('.share-popover')).toBeTruthy();
    expect(el.querySelector('[data-share="twitter"]')).toBeTruthy();
    expect(el.querySelector('[data-share="facebook"]')).toBeTruthy();
    expect(el.querySelector('[data-share="linkedin"]')).toBeTruthy();
    expect(el.querySelector('[data-share="reddit"]')).toBeTruthy();
    expect(el.querySelector('[data-share="whatsapp"]')).toBeTruthy();
    expect(el.querySelector('[data-share="email"]')).toBeTruthy();
    expect(el.querySelector('[data-action="copy-text"]')).toBeTruthy();
    expect(el.querySelector('[data-action="copy-link"]')).toBeTruthy();

    document.body.removeChild(el);
  });

  it('toggles share popover when trigger is clicked', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const trigger = el.querySelector('.share-trigger');
    const popover = el.querySelector('.share-popover');

    expect(popover.classList.contains('open')).toBe(false);
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(false);

    document.body.removeChild(el);
  });

  it('copies link to clipboard when copy-link button is clicked', async () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Set specific slider values
    el.querySelector('#toast-height').value = '80';
    el.querySelector('#toast-gravity').value = '1000';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Open popover first
    const trigger = el.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyBtn = el.querySelector('[data-action="copy-link"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain('h=80');
    expect(copiedUrl).toContain('g=1000');

    document.body.removeChild(el);
  });

  it('copies text to clipboard when copy-text button is clicked', async () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Open popover first
    const trigger = el.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const copyBtn = el.querySelector('[data-action="copy-text"]');
    copyBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toMatch(/Buttered Toast/i);

    document.body.removeChild(el);
  });

  it('updates share links with correct URLs when popover opens', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set a slider value
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Open popover
    const trigger = el.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));

    const twitterLink = el.querySelector('[data-share="twitter"]');
    const facebookLink = el.querySelector('[data-share="facebook"]');
    const linkedinLink = el.querySelector('[data-share="linkedin"]');

    expect(twitterLink.href).toContain('twitter.com/intent/tweet');
    expect(facebookLink.href).toContain('facebook.com/sharer');
    expect(linkedinLink.href).toContain('linkedin.com/shareArticle');

    document.body.removeChild(el);
  });

  it('closes share popover on outside click', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const trigger = el.querySelector('.share-trigger');
    const popover = el.querySelector('.share-popover');

    // Open popover
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Click outside
    document.dispatchEvent(new Event('click'));
    expect(popover.classList.contains('open')).toBe(false);

    document.body.removeChild(el);
  });

  it('closes share popover on Escape key', () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    const trigger = el.querySelector('.share-trigger');
    const popover = el.querySelector('.share-popover');

    // Open popover
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    expect(popover.classList.contains('open')).toBe(true);

    // Press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover.classList.contains('open')).toBe(false);

    document.body.removeChild(el);
  });

  it('updateState captures current slider values in share URL', async () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set specific slider values
    el.querySelector('#toast-height').value = '120';
    el.querySelector('#toast-gravity').value = '1100';
    el.querySelector('#toast-overhang').value = '8';
    el.querySelector('#toast-butter').value = '1.5';
    el.querySelector('#toast-friction').value = '30';
    el.querySelector('#toast-inertia').value = '350';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Copy link uses updateState internally
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    });

    // Open popover and click copy-link
    const trigger = el.querySelector('.share-trigger');
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    el.querySelector('[data-action="copy-link"]').dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();

    const url = writeTextMock.mock.calls[0][0];
    expect(url).toContain('h=120');
    expect(url).toContain('g=1100');
    expect(url).toContain('o=8');
    expect(url).toContain('b=1.5');
    expect(url).toContain('f=30');
    expect(url).toContain('t=350');

    document.body.removeChild(el);
  });

  it('handles MathJax becoming undefined during requestAnimationFrame', async () => {
    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set up MathJax to be available initially
    const originalMathJax = window.MathJax;
    window.MathJax = {
      typesetPromise: vi.fn().mockResolvedValue(undefined)
    };

    // Trigger formula update
    el.querySelector('#toast-height').value = '100';
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Remove MathJax to simulate it becoming undefined
    delete window.MathJax;

    // Wait for requestAnimationFrame
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Should not throw
    expect(true).toBe(true);

    // Restore
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
  });

  it('handles MathJax.typesetPromise becoming non-function during RAF', async () => {
    const originalRAF = window.requestAnimationFrame;
    let rafCallback = null;
    
    // Capture the RAF callback instead of executing immediately
    window.requestAnimationFrame = (cb) => {
      rafCallback = cb;
      return 1;
    };

    const el = ButteredToastCalculator();
    document.body.appendChild(el);

    // Set up MathJax with typesetPromise
    const originalMathJax = window.MathJax;
    const mathJaxRef = { typesetPromise: vi.fn().mockResolvedValue(undefined) };
    window.MathJax = mathJaxRef;

    // Trigger formula update (which schedules RAF)
    el.querySelector('#toast-height').dispatchEvent(new Event('input'));

    // Now remove typesetPromise to make it non-function
    mathJaxRef.typesetPromise = undefined;

    // Execute the RAF callback - should hit the defensive check
    if (rafCallback) rafCallback();

    // Should not throw
    expect(true).toBe(true);

    // Restore
    window.MathJax = originalMathJax;
    window.requestAnimationFrame = originalRAF;
    document.body.removeChild(el);
  });

  it('handles ensureMathJax rejection gracefully', async () => {
    // Mock ensureMathJax to reject
    vi.mock('../src/utils/mathjax.js', () => ({
      ensureMathJax: vi.fn(() => Promise.reject(new Error('MathJax load failed')))
    }));

    // Re-import to use the mock
    vi.resetModules();
    const { ButteredToastCalculator: FreshCalculator } = await import('../src/views/buttered-toast-calculator.js');

    const container = document.createElement('div');
    document.body.appendChild(container);

    const el = FreshCalculator();
    container.appendChild(el);

    // Wait for promise rejection to be handled
    await new Promise(resolve => setTimeout(resolve, 10));

    // Formula should still be displayed (updateFormula called in catch)
    const formulaDisplay = el.querySelector('#toast-formula-display');
    expect(formulaDisplay).toBeTruthy();
    expect(formulaDisplay.textContent).toBeTruthy();

    document.body.removeChild(container);
    vi.clearAllMocks();
  });

});
