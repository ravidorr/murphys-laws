import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';

function createLocalThis() {
  const context = {};

  beforeEach(() => {
    Object.keys(context).forEach((key) => {
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

  function mountCalculator({ onNavigate = () => {}, append = false } = {}) {
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

    expect(el.querySelector('#urgency-value').textContent).toBe('5');
    expect(el.querySelector('#score-display').textContent).toBe('5.04');
  });

  it('updates score when sliders change', () => {
    const el = mountCalculator({ append: true });

    const urgencySlider = el.querySelector('#urgency');
    urgencySlider.value = '9';
    urgencySlider.dispatchEvent(new Event('input'));

    const scoreDisplay = el.querySelector('#score-display');

    expect(parseFloat(scoreDisplay.textContent)).toBeGreaterThan(5.25);
  });

  it('navigates when button is clicked', () => {
    let navigated = null;
    const el = mountCalculator({ onNavigate: (page) => { navigated = page; } });

    const button = el.querySelector('[data-nav="calculator/sods-law"]');
    button.click();

    expect(navigated).toBe('calculator/sods-law');
  });

  it('updates slider labels when inputs change', () => {
    const el = mountCalculator({ append: true });

    const skillSlider = el.querySelector('#skill');
    const skillValue = el.querySelector('#skill-value');

    skillSlider.value = '7';
    skillSlider.dispatchEvent(new Event('input'));

    expect(skillValue.textContent).toBe('7');
  });

  it('updates interpretation based on score', () => {
    const el = mountCalculator({ append: true });

    const urgencySlider = el.querySelector('#urgency');
    const skillSlider = el.querySelector('#skill');

    urgencySlider.value = '9';
    skillSlider.value = '1';

    urgencySlider.dispatchEvent(new Event('input'));
    skillSlider.dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    expect(interpretation.length).toBeGreaterThan(0);
  });

  it('shows safe interpretation for low score (score < 2)', () => {
    const el = mountCalculator({ append: true });

    // Set all values to minimize score: low urgency, low complexity, low importance, high skill, low frequency
    el.querySelector('#urgency').value = '1';
    el.querySelector('#complexity').value = '1';
    el.querySelector('#importance').value = '1';
    el.querySelector('#skill').value = '9';
    el.querySelector('#frequency').value = '1';

    // Trigger update
    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    const scoreDisplay = el.querySelector('#score-display').textContent;

    // Score should be very low
    expect(parseFloat(scoreDisplay)).toBeLessThan(2);
    expect(interpretation).toContain('probably safe');
  });

  it('shows risky interpretation for score 2-4', () => {
    const el = mountCalculator({ append: true });

    // Set values to produce score between 2-4
    // Formula: ((U + C + I) * (10 - S)) / 20 * 0.7 * (1 / (1 - Math.sin(F / 10)))
    el.querySelector('#urgency').value = '6';
    el.querySelector('#complexity').value = '6';
    el.querySelector('#importance').value = '6';
    el.querySelector('#skill').value = '7';
    el.querySelector('#frequency').value = '4';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    expect(interpretation).toContain('risky');
  });

  it('shows worrying interpretation for score 4-6', () => {
    const el = mountCalculator({ append: true });

    // Default values produce ~5.04 which is in 4-6 range
    el.querySelector('#urgency').value = '5';
    el.querySelector('#complexity').value = '5';
    el.querySelector('#importance').value = '5';
    el.querySelector('#skill').value = '5';
    el.querySelector('#frequency').value = '5';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    expect(interpretation).toContain('worrying');
  });

  it('shows looming disaster interpretation for score 6-8', () => {
    const el = mountCalculator({ append: true });

    // Set values for disaster score (6-8)
    // Need lower values to keep score under 8
    el.querySelector('#urgency').value = '7';
    el.querySelector('#complexity').value = '7';
    el.querySelector('#importance').value = '7';
    el.querySelector('#skill').value = '4';
    el.querySelector('#frequency').value = '4';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    expect(interpretation).toContain('looming');
  });

  it('shows catastrophe interpretation for very high score (score >= 8)', () => {
    const el = mountCalculator({ append: true });

    // Set values for maximum score
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '9';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation').textContent;
    expect(interpretation).toContain('Catastrophe');
  });

  it('handles click event with non-Element target gracefully', () => {
    const el = mountCalculator();

    // Create and dispatch a click event with null target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });

    // Should not throw
    expect(() => el.dispatchEvent(event)).not.toThrow();
  });

  it('handles click on element without data-nav attribute', () => {
    let navigated = null;
    const el = mountCalculator({ onNavigate: (page) => { navigated = page; } });

    // Click on a slider (which doesn't have data-nav)
    const slider = el.querySelector('#urgency');
    slider.click();

    // Should not trigger navigation
    expect(navigated).toBeNull();
  });
});
