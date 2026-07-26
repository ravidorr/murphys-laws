import { describe, expect, it } from 'vitest';
import {
  renderSodsFormula,
  renderToastFormula,
} from '../src/utils/mathjax.ts';

describe('native formula rendering', () => {
  it('uses MathML rather than a runtime stylesheet-based renderer', () => {
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

    expect(container.querySelector('math[display="block"]')).toBeTruthy();
    expect(container.querySelector('style')).toBeNull();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('keeps Sod variables semantic and accessible', () => {
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

    expect(container.querySelector('mi[title="Probability"]')).toBeTruthy();
    expect(
      container.querySelector('mi[title="Complexity (1-9)"]'),
    ).toBeTruthy();
    expect(container.querySelector('math')?.getAttribute('aria-label')).toContain(
      'Probability equals',
    );
  });

  it('renders numeric values as numbers rather than variables', () => {
    const container = document.createElement('div');

    renderSodsFormula(container, {
      probability: 75,
      urgency: 7,
      complexity: 6,
      importance: 8,
      skill: 3,
      frequency: 9,
      activity: '0.7',
    });

    expect(container.querySelectorAll('mn').length).toBeGreaterThan(6);
    expect(container.querySelector('mi[title="Urgency (1-9)"]')).toBeNull();
    expect(container.textContent).toContain('75');
  });

  it('renders the toast square-root and fraction structure natively', () => {
    const container = document.createElement('div');

    renderToastFormula(container, {
      height: 'H',
      gravity: 'g',
      overhang: 'O',
      butter: 'B',
      friction: 'F',
      inertia: 'T',
    });

    expect(container.querySelector('msqrt > mfrac')).toBeTruthy();
    expect(container.querySelectorAll('mfrac')).toHaveLength(2);
    expect(
      container.querySelector('mi[title*="Air friction"]'),
    ).toBeTruthy();
  });

  it('replaces an existing formula atomically', () => {
    const container = document.createElement('div');
    container.append(document.createElement('span'));

    renderToastFormula(container, {
      height: 100,
      gravity: 981,
      overhang: 8,
      butter: '1.50',
      friction: 30,
      inertia: 350,
    });

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.localName).toBe('math');
    expect(container.textContent).toContain('1.50');
  });
});
