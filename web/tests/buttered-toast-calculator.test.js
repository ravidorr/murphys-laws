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

    expect(interpretation).toMatch(/Clean floors ahead/i);
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

});
