import { describe, it, expect } from 'vitest';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';

describe('SodCalculatorSimple component', () => {
  it('renders with initial values', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Sod's Law Calculator/);
    expect(el.querySelector('#urgency')).toBeTruthy();
    expect(el.querySelector('#complexity')).toBeTruthy();
    expect(el.querySelector('#importance')).toBeTruthy();
    expect(el.querySelector('#skill')).toBeTruthy();
    expect(el.querySelector('#frequency')).toBeTruthy();
  });

  it('displays initial score calculation', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    const scoreDisplay = el.querySelector('#score-display');
    // Score with default values (all 5s)
    expect(parseFloat(scoreDisplay.textContent)).toBeGreaterThan(5);
    expect(parseFloat(scoreDisplay.textContent)).toBeLessThan(6);
  });

  it('displays initial interpretation', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/Definitely worrying/);
  });

  it('updates slider value display when slider changes', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    const urgencySlider = el.querySelector('#urgency');
    const urgencyValue = el.querySelector('#urgency-value');

    urgencySlider.value = '7';
    urgencySlider.dispatchEvent(new Event('input'));

    expect(urgencyValue.textContent).toBe('7');
  });

  it('recalculates score when slider changes', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    const urgencySlider = el.querySelector('#urgency');
    const scoreDisplay = el.querySelector('#score-display');
    const initialScore = scoreDisplay.textContent;

    urgencySlider.value = '9';
    urgencySlider.dispatchEvent(new Event('input'));

    expect(scoreDisplay.textContent).not.toBe(initialScore);
  });

  it('shows safe interpretation for low scores', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Set values to get a low score
    el.querySelector('#urgency').value = '1';
    el.querySelector('#complexity').value = '1';
    el.querySelector('#importance').value = '1';
    el.querySelector('#skill').value = '9';
    el.querySelector('#frequency').value = '1';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/probably safe/i);
  });

  it('shows risky interpretation for medium-low scores', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Set values to get score between 2 and 4
    el.querySelector('#urgency').value = '4';
    el.querySelector('#complexity').value = '4';
    el.querySelector('#importance').value = '4';
    el.querySelector('#skill').value = '6';
    el.querySelector('#frequency').value = '4';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/A bit risky/i);
  });

  it('shows worrying interpretation for medium scores', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Default values give score around 5.25
    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/Definitely worrying/i);
  });

  it('shows disaster interpretation for high scores', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Set values to get score between 6 and 8
    el.querySelector('#urgency').value = '6';
    el.querySelector('#complexity').value = '6';
    el.querySelector('#importance').value = '6';
    el.querySelector('#skill').value = '4';
    el.querySelector('#frequency').value = '5';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/Disaster is looming/i);
  });

  it('shows catastrophe interpretation for very high scores', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Set values to get score >= 8
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '7';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#interpretation');
    expect(interpretation.textContent).toMatch(/Catastrophe is almost certain/i);
  });

  it('navigates to full calculator when button is clicked', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = SodCalculatorSimple({ onNavigate });

    const navBtn = el.querySelector('[data-nav="calculator"]');
    navBtn.click();

    expect(navigated).toBe('calculator');
  });

  it('navigates when clicking button text (child element)', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = SodCalculatorSimple({ onNavigate });

    // Click on the text span inside the button (simulates real user behavior)
    const btnText = el.querySelector('.btn-text');
    btnText.click();

    expect(navigated).toBe('calculator');
  });

  it('navigates when clicking button icon (child element)', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = SodCalculatorSimple({ onNavigate });

    // Click on the icon span inside the button
    const icon = el.querySelector('[data-nav="calculator"] .material-symbols-outlined');
    icon.click();

    expect(navigated).toBe('calculator');
  });

  it('updates all slider values independently', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    const sliders = ['urgency', 'complexity', 'importance', 'skill', 'frequency'];

    sliders.forEach((name, idx) => {
      const slider = el.querySelector(`#${name}`);
      const valueDisplay = el.querySelector(`#${name}-value`);

      const newValue = String(idx + 2);
      slider.value = newValue;
      slider.dispatchEvent(new Event('input'));

      expect(valueDisplay.textContent).toBe(newValue);
    });
  });

  it('caps score at 8.6', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });

    // Set extreme values
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#frequency').value = '9';

    el.querySelector('#urgency').dispatchEvent(new Event('input'));

    const scoreDisplay = el.querySelector('#score-display');
    const score = parseFloat(scoreDisplay.textContent);

    expect(score).toBeLessThanOrEqual(8.6);
  });

  it('applies correct CSS classes for different score ranges', () => {
    const el = SodCalculatorSimple({ onNavigate: () => {} });
    const scoreSection = el.querySelector('.sod-simple-score');

    // Test low score
    el.querySelector('#urgency').value = '1';
    el.querySelector('#complexity').value = '1';
    el.querySelector('#importance').value = '1';
    el.querySelector('#skill').value = '9';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));
    expect(scoreSection.classList.contains('calc-ok')).toBe(true);

    // Test high score
    el.querySelector('#urgency').value = '9';
    el.querySelector('#complexity').value = '9';
    el.querySelector('#importance').value = '9';
    el.querySelector('#skill').value = '1';
    el.querySelector('#urgency').dispatchEvent(new Event('input'));
    expect(scoreSection.classList.contains('calc-dark')).toBe(true);
  });

  it('does not navigate when clicking non-navigation elements', () => {
    let navigated = false;
    const onNavigate = () => { navigated = true; };

    const el = SodCalculatorSimple({ onNavigate });

    const label = el.querySelector('label');
    label.click();

    expect(navigated).toBe(false);
  });
});
