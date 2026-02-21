import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SodCalculatorSimple } from '../src/components/sod-calculator-simple.js';

interface SodCalculatorSimpleContext {
  el?: HTMLElement;
  appended?: boolean;
}

interface MountOptions {
  onNavigate?: (page: string, param?: string) => void;
  append?: boolean;
}

function createLocalThis(): () => SodCalculatorSimpleContext {
  const context: SodCalculatorSimpleContext = {};

  beforeEach(() => {
    (Object.keys(context) as (keyof SodCalculatorSimpleContext)[]).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('SodCalculatorSimple component', () => {
  const local = createLocalThis();

  afterEach(() => {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
  });

  function mountCalculator({ onNavigate = () => {}, append = false }: MountOptions = {}) {
    const el = SodCalculatorSimple({ onNavigate });
    const self = local();
    self.el = el;
    self.appended = append;
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders with initial values', () => {
    const el = mountCalculator();

    expect(el.querySelector('#urgency-value')!.textContent).toBe('5');
    expect(el.querySelector('#score-display')!.textContent).toBe('5.04');
  });

  it('updates score when sliders change', () => {
    const el = mountCalculator({ append: true });

    const urgencySlider = el.querySelector<HTMLInputElement>('#urgency');
    urgencySlider!.value = '9';
    urgencySlider!.dispatchEvent(new Event('input'));

    const scoreDisplay = el.querySelector('#score-display');
    expect(scoreDisplay).toBeTruthy();
    expect(parseFloat(scoreDisplay!.textContent!)).toBeGreaterThan(5.25);
  });

  it('navigates when button is clicked', () => {
    let navigated: string | null = null;
    const el = mountCalculator({ onNavigate: (page: string) => { navigated = page; } });

    const button = el.querySelector<HTMLElement>('[data-nav="calculator/sods-law"]');
    button!.click();

    expect(navigated).toBe('calculator/sods-law');
  });

  it('updates slider labels when inputs change', () => {
    const el = mountCalculator({ append: true });

    const skillSlider = el.querySelector<HTMLInputElement>('#skill');
    const skillValue = el.querySelector('#skill-value');

    skillSlider!.value = '7';
    skillSlider!.dispatchEvent(new Event('input'));

    expect(skillValue).toBeTruthy();
    expect(skillValue!.textContent).toBe('7');
  });

  it('updates interpretation based on score', () => {
    const el = mountCalculator({ append: true });

    const urgencySlider = el.querySelector<HTMLInputElement>('#urgency');
    const skillSlider = el.querySelector<HTMLInputElement>('#skill');

    urgencySlider!.value = '9';
    skillSlider!.value = '1';

    urgencySlider!.dispatchEvent(new Event('input'));
    skillSlider!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    expect(interpretation!.length).toBeGreaterThan(0);
  });

  it('shows safe interpretation for low score (score < 2)', () => {
    const el = mountCalculator({ append: true });

    // Set all values to minimize score: low urgency, low complexity, low importance, high skill, low frequency
    (el.querySelector<HTMLInputElement>('#urgency'))!.value = '1';
    (el.querySelector<HTMLInputElement>('#complexity'))!.value = '1';
    (el.querySelector<HTMLInputElement>('#importance'))!.value = '1';
    (el.querySelector<HTMLInputElement>('#skill'))!.value = '9';
    (el.querySelector<HTMLInputElement>('#frequency'))!.value = '1';

    // Trigger update
    (el.querySelector<HTMLInputElement>('#urgency'))!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    const scoreDisplay = el.querySelector('#score-display')!.textContent;

    // Score should be very low
    expect(parseFloat(scoreDisplay!)).toBeLessThan(2);
    expect(interpretation).toContain('probably safe');
  });

  it('shows risky interpretation for score 2-4', () => {
    const el = mountCalculator({ append: true });

    // Set values to produce score between 2-4
    // Formula: ((U + C + I) * (10 - S)) / 20 * 0.7 * (1 / (1 - Math.sin(F / 10)))
    (el.querySelector<HTMLInputElement>('#urgency'))!.value = '6';
    (el.querySelector<HTMLInputElement>('#complexity'))!.value = '6';
    (el.querySelector<HTMLInputElement>('#importance'))!.value = '6';
    (el.querySelector<HTMLInputElement>('#skill'))!.value = '7';
    (el.querySelector<HTMLInputElement>('#frequency'))!.value = '4';

    (el.querySelector<HTMLInputElement>('#urgency'))!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    expect(interpretation).toContain('risky');
  });

  it('shows worrying interpretation for score 4-6', () => {
    const el = mountCalculator({ append: true });

    // Default values produce ~5.04 which is in 4-6 range
    (el.querySelector<HTMLInputElement>('#urgency'))!.value = '5';
    (el.querySelector<HTMLInputElement>('#complexity'))!.value = '5';
    (el.querySelector<HTMLInputElement>('#importance'))!.value = '5';
    (el.querySelector<HTMLInputElement>('#skill'))!.value = '5';
    (el.querySelector<HTMLInputElement>('#frequency'))!.value = '5';

    (el.querySelector<HTMLInputElement>('#urgency'))!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    expect(interpretation).toContain('worrying');
  });

  it('shows looming disaster interpretation for score 6-8', () => {
    const el = mountCalculator({ append: true });

    // Set values for disaster score (6-8)
    // Need lower values to keep score under 8
    (el.querySelector<HTMLInputElement>('#urgency'))!.value = '7';
    (el.querySelector<HTMLInputElement>('#complexity'))!.value = '7';
    (el.querySelector<HTMLInputElement>('#importance'))!.value = '7';
    (el.querySelector<HTMLInputElement>('#skill'))!.value = '4';
    (el.querySelector<HTMLInputElement>('#frequency'))!.value = '4';

    (el.querySelector<HTMLInputElement>('#urgency'))!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    expect(interpretation).toContain('looming');
  });

  it('shows catastrophe interpretation for very high score (score >= 8)', () => {
    const el = mountCalculator({ append: true });

    // Set values for maximum score
    (el.querySelector<HTMLInputElement>('#urgency'))!.value = '9';
    (el.querySelector<HTMLInputElement>('#complexity'))!.value = '9';
    (el.querySelector<HTMLInputElement>('#importance'))!.value = '9';
    (el.querySelector<HTMLInputElement>('#skill'))!.value = '1';
    (el.querySelector<HTMLInputElement>('#frequency'))!.value = '9';

    (el.querySelector<HTMLInputElement>('#urgency'))!.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation')!.textContent;
    expect(interpretation).toContain('Catastrophe');
  });

  it('handles click event with null target gracefully', () => {
    const el = mountCalculator();

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });

    expect(() => el.dispatchEvent(event)).not.toThrow();
  });

  it('ignores click when target is not HTMLElement and does not call onNavigate', () => {
    let navigated: string | null = null;
    const el = mountCalculator({ append: true, onNavigate: (page: string) => { navigated = page; } });

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: document.createTextNode('x'), writable: false });
    el.dispatchEvent(event);

    expect(navigated).toBeNull();
  });

  it('handles click on element without data-nav attribute', () => {
    let navigated: string | null = null;
    const el = mountCalculator({ onNavigate: (page: string) => { navigated = page; } });

    // Click on a slider (which doesn't have data-nav)
    const slider = el.querySelector<HTMLInputElement>('#urgency');
    slider!.click();

    // Should not trigger navigation
    expect(navigated).toBeNull();
  });
});
