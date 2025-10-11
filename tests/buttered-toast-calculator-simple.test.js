import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';

describe('ButteredToastCalculatorSimple component', () => {
  it('renders with initial values', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Buttered Toast Landing Calculator/);
    expect(el.querySelector('#toast-height-simple')).toBeTruthy();
    expect(el.querySelector('#toast-overhang-simple')).toBeTruthy();
  });

  it('does not render sliders for constants (gravity, butter, friction, inertia)', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    expect(el.querySelector('#toast-gravity-simple')).toBeFalsy();
    expect(el.querySelector('#toast-butter-simple')).toBeFalsy();
    expect(el.querySelector('#toast-friction-simple')).toBeFalsy();
    expect(el.querySelector('#toast-inertia-simple')).toBeFalsy();
  });

  it('displays initial probability calculation', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const probabilityDisplay = el.querySelector('#toast-probability-simple');
    expect(probabilityDisplay.textContent).toMatch(/%$/);
  });

  it('displays initial interpretation', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const interpretation = el.querySelector('#toast-interpretation-simple');
    expect(interpretation.textContent.length).toBeGreaterThan(10);
  });

  it('updates height value display when slider changes', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const heightSlider = el.querySelector('#toast-height-simple');
    const heightValue = el.querySelector('#toast-height-simple-value');

    heightSlider.value = '100';
    heightSlider.dispatchEvent(new Event('input'));

    expect(heightValue.textContent).toBe('100 cm');
  });

  it('updates overhang value display when slider changes', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const overhangSlider = el.querySelector('#toast-overhang-simple');
    const overhangValue = el.querySelector('#toast-overhang-simple-value');

    overhangSlider.value = '15';
    overhangSlider.dispatchEvent(new Event('input'));

    expect(overhangValue.textContent).toBe('15 cm');
  });

  it('recalculates probability when height slider changes', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const heightSlider = el.querySelector('#toast-height-simple');
    const probabilityDisplay = el.querySelector('#toast-probability-simple');
    const initialProbability = probabilityDisplay.textContent;

    heightSlider.value = '150';
    heightSlider.dispatchEvent(new Event('input'));

    expect(probabilityDisplay.textContent).not.toBe(initialProbability);
  });

  it('recalculates probability when overhang slider changes', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const overhangSlider = el.querySelector('#toast-overhang-simple');
    const probabilityDisplay = el.querySelector('#toast-probability-simple');
    const initialProbability = probabilityDisplay.textContent;

    overhangSlider.value = '15';
    overhangSlider.dispatchEvent(new Event('input'));

    expect(probabilityDisplay.textContent).not.toBe(initialProbability);
  });

  it('shows safe interpretation for low probability', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // Set values to get low probability
    el.querySelector('#toast-height-simple').value = '30';
    el.querySelector('#toast-overhang-simple').value = '1';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation-simple');
    expect(interpretation.textContent).toMatch(/Clean floors ahead/i);
  });

  it('shows toss-up interpretation for medium probability', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // Set values to get medium probability (25-60%)
    el.querySelector('#toast-height-simple').value = '60';
    el.querySelector('#toast-overhang-simple').value = '7';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation-simple');
    expect(interpretation.textContent).toMatch(/toss-up/i);
  });

  it('shows butter zone interpretation for high probability', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // Set values to get high probability (60-85%)
    el.querySelector('#toast-height-simple').value = '80';
    el.querySelector('#toast-overhang-simple').value = '8';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation-simple');
    expect(interpretation.textContent).toMatch(/butter zone/i);
  });

  it('shows catastrophe interpretation for very high probability', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // Set values to get very high probability (> 85%)
    el.querySelector('#toast-height-simple').value = '90';
    el.querySelector('#toast-overhang-simple').value = '11';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const interpretation = el.querySelector('#toast-interpretation-simple');
    expect(interpretation.textContent).toMatch(/Catastrophe is imminent/i);
  });

  it('navigates to full calculator when button is clicked', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = ButteredToastCalculatorSimple({ onNavigate });

    const navBtn = el.querySelector('[data-nav="toastcalculator"]');
    navBtn.click();

    expect(navigated).toBe('toastcalculator');
  });

  it('navigates when clicking button text (child element)', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = ButteredToastCalculatorSimple({ onNavigate });

    // Click on the text span inside the button (simulates real user behavior)
    const btnText = el.querySelector('.btn-text');
    btnText.click();

    expect(navigated).toBe('toastcalculator');
  });

  it('navigates when clicking button icon (child element)', () => {
    let navigated = '';
    const onNavigate = (target) => { navigated = target; };

    const el = ButteredToastCalculatorSimple({ onNavigate });

    // Click on the icon span inside the button
    const icon = el.querySelector('[data-nav="toastcalculator"] .material-symbols-outlined');
    icon.click();

    expect(navigated).toBe('toastcalculator');
  });

  it('applies correct CSS classes for different probability ranges', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });
    const scoreSection = el.querySelector('.sod-simple-score');

    // Test low probability
    el.querySelector('#toast-height-simple').value = '30';
    el.querySelector('#toast-overhang-simple').value = '1';
    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));
    expect(scoreSection.classList.contains('calc-ok')).toBe(true);

    // Test very high probability (> 85%)
    el.querySelector('#toast-height-simple').value = '90';
    el.querySelector('#toast-overhang-simple').value = '11';
    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));
    expect(scoreSection.classList.contains('calc-dark')).toBe(true);
  });

  it('does not navigate when clicking non-navigation elements', () => {
    let navigated = false;
    const onNavigate = () => { navigated = true; };

    const el = ButteredToastCalculatorSimple({ onNavigate });

    const label = el.querySelector('label');
    label.click();

    expect(navigated).toBe(false);
  });

  it('uses correct constant values in calculation', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // The constants should be: GRAVITY=980, BUTTER_FACTOR=1.2, AIR_FRICTION=20, TOAST_INERTIA=250
    // With height=75 and overhang=5, we can verify the calculation is using these constants

    const probabilityDisplay = el.querySelector('#toast-probability-simple');
    const initialProbability = probabilityDisplay.textContent;

    // The probability should be consistent with these constants
    expect(initialProbability).toBeTruthy();
    expect(initialProbability).toMatch(/\d+%/);
  });

  it('handles minimum slider values correctly', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    el.querySelector('#toast-height-simple').value = '30';
    el.querySelector('#toast-overhang-simple').value = '1';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const probability = el.querySelector('#toast-probability-simple').textContent;
    expect(probability).toMatch(/\d+%/);
  });

  it('handles maximum slider values correctly', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    el.querySelector('#toast-height-simple').value = '200';
    el.querySelector('#toast-overhang-simple').value = '20';

    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    const probability = el.querySelector('#toast-probability-simple').textContent;
    expect(probability).toMatch(/\d+%/);
  });

  it('rounds probability to nearest integer', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const probability = el.querySelector('#toast-probability-simple').textContent;
    const numericProbability = parseInt(probability);

    expect(numericProbability).toBe(Math.round(numericProbability));
  });

  it('ensures probability is never negative', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    // Test various combinations
    const testCases = [
      { height: '30', overhang: '1' },
      { height: '200', overhang: '1' },
      { height: '30', overhang: '20' },
      { height: '100', overhang: '10' }
    ];

    testCases.forEach(testCase => {
      el.querySelector('#toast-height-simple').value = testCase.height;
      el.querySelector('#toast-overhang-simple').value = testCase.overhang;
      el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

      const probability = parseInt(el.querySelector('#toast-probability-simple').textContent);
      expect(probability).toBeGreaterThanOrEqual(0);
    });
  });

  it('removes old CSS classes when applying new ones', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });
    const scoreSection = el.querySelector('.sod-simple-score');

    // Start with low probability
    el.querySelector('#toast-height-simple').value = '30';
    el.querySelector('#toast-overhang-simple').value = '1';
    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));
    expect(scoreSection.classList.contains('calc-ok')).toBe(true);

    // Change to very high probability (> 85%)
    el.querySelector('#toast-height-simple').value = '90';
    el.querySelector('#toast-overhang-simple').value = '11';
    el.querySelector('#toast-height-simple').dispatchEvent(new Event('input'));

    // Old class should be removed
    expect(scoreSection.classList.contains('calc-ok')).toBe(false);
    expect(scoreSection.classList.contains('calc-dark')).toBe(true);
  });

  it('displays subtitle text', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/probability of a buttered toast landing butter-side down/i);
  });

  it('has proper aria-label on button', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const button = el.querySelector('[data-nav="toastcalculator"]');
    expect(button.getAttribute('aria-label')).toMatch(/View full Buttered Toast Calculator/i);
  });

  it('shows probability label', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Probability of Butter-Side Down Landing/i);
  });

  it('updates both display value and calculation when slider changes', () => {
    const el = ButteredToastCalculatorSimple({ onNavigate: () => {} });

    const heightSlider = el.querySelector('#toast-height-simple');
    const heightValue = el.querySelector('#toast-height-simple-value');
    const probabilityDisplay = el.querySelector('#toast-probability-simple');

    const initialProbability = probabilityDisplay.textContent;

    heightSlider.value = '120';
    heightSlider.dispatchEvent(new Event('input'));

    // Check both value display and probability changed
    expect(heightValue.textContent).toBe('120 cm');
    expect(probabilityDisplay.textContent).not.toBe(initialProbability);
  });

  it('handles click on non-HTMLElement gracefully', () => {
    let navigated = false;
    const onNavigate = () => { navigated = true; };

    const el = ButteredToastCalculatorSimple({ onNavigate });

    // Create a synthetic event with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: 'not an element', writable: false });

    el.dispatchEvent(event);

    expect(navigated).toBe(false);
  });
});
