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

    const button = el.querySelector('[data-nav="calculator"]');
    button.click();

    expect(navigated).toBe('calculator');
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
});
