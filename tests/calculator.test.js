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
  });
});


