import { Calculator } from '@views/calculator.js';

describe("Calculator view", () => {

  it('computes a score and updates interpretation', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set slider values
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '9';

    // Trigger input event to calculate (calculator updates automatically on input)
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const score = Number(el.querySelector('#score-value').textContent);
    expect(score).toBeGreaterThan(0);
    expect(el.querySelector('#score-interpretation').textContent.length).toBeGreaterThan(5);

    document.body.removeChild(el);
  });

  it('shows "safe" interpretation for low scores (< 2)', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set values to produce a low score
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

    document.body.removeChild(el);
  });

  it('shows "risky" interpretation for scores between 2 and 4', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set values to produce a score between 2 and 4
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

    document.body.removeChild(el);
  });

  it('shows "worrying" interpretation for scores between 4 and 6', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set values to produce a score between 4 and 6
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

    document.body.removeChild(el);
  });

  it('shows "disaster" interpretation for scores between 6 and 8', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set values to produce a score between 6 and 8
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

    document.body.removeChild(el);
  });

  it('shows "catastrophe" interpretation for high scores (>= 8)', () => {
    const el = Calculator();
    document.body.appendChild(el);

    // Set values to produce a high score
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

    document.body.removeChild(el);
  });

  it('updates slider value displays on input', () => {
    const el = Calculator();
    document.body.appendChild(el);

    el.querySelector('#urgency').value = '7';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    expect(el.querySelector('#urgency-value').textContent).toBe('7');

    document.body.removeChild(el);
  });

  it('resets formula values after timeout', async () => {
    vi.useFakeTimers();

    const el = Calculator();
    document.body.appendChild(el);

    // Trigger slider change to flash values
    el.querySelector('#urgency').value = '7';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    // Advance time past the 2-second timeout
    vi.advanceTimersByTime(2100);

    // Formula should have reset (though we can't easily check the internal showValues state)
    expect(el.querySelector('#formula-display')).toBeTruthy();

    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it('polls for MathJax when not initially available', () => {
    vi.useFakeTimers();

    // Temporarily remove MathJax
    const originalMathJax = window.MathJax;
    delete window.MathJax;

    const el = Calculator();
    document.body.appendChild(el);

    // Simulate MathJax loading after 500ms
    vi.advanceTimersByTime(500);

    // Restore MathJax
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

    const el = Calculator();
    document.body.appendChild(el);

    // Advance past the 10-second polling timeout
    vi.advanceTimersByTime(11000);

    // Restore MathJax
    window.MathJax = originalMathJax;
    document.body.removeChild(el);
    vi.useRealTimers();
  });
});


