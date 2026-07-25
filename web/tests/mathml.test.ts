import { describe, expect, it } from 'vitest';
import {
  renderSodsFormula,
  renderToastFormula,
} from '../src/utils/mathjax.ts';

describe('native MathML formulas', () => {
  it('renders the Sod formula with semantic fractions and variable labels', () => {
    const container = document.createElement('div');

    renderSodsFormula(container, {
      probability: 'P',
      urgency: 'U',
      complexity: 'C',
      importance: 'I',
      skill: 'S',
      frequency: 'F',
      activity: 'A',
    });

    const math = container.querySelector('math');
    expect(math).toBeTruthy();
    expect(math?.querySelectorAll('mfrac').length).toBeGreaterThanOrEqual(3);
    expect(math?.querySelector('mi[title="Urgency (1-9)"]')).toBeTruthy();
    expect(container.querySelector('style')).toBeNull();
  });

  it('renders the toast formula with a square root and current values', () => {
    const container = document.createElement('div');

    renderToastFormula(container, {
      height: 100,
      gravity: 981,
      overhang: 8,
      butter: '1.50',
      friction: 30,
      inertia: 350,
    });

    expect(container.querySelector('math msqrt mfrac')).toBeTruthy();
    expect(container.textContent).toContain('100');
    expect(container.textContent).toContain('1.50');
    expect(container.querySelector('style')).toBeNull();
  });
});
