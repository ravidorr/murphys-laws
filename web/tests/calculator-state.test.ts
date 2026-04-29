import { describe, expect, it } from 'vitest';
import {
  parseCalculatorState,
  serializeCalculatorState
} from '../src/utils/calculator-state.ts';

describe('calculator state', () => {
  it('serializes Sod calculator state into stable query params', () => {
    const url = serializeCalculatorState('https://murphys-laws.com/calculator/sods-law', {
      u: 8,
      c: 6,
      i: 7,
      s: 4,
      f: 3,
    });

    expect(url).toBe('https://murphys-laws.com/calculator/sods-law?u=8&c=6&i=7&s=4&f=3');
  });

  it('serializes toast calculator state into stable query params', () => {
    const url = serializeCalculatorState('https://murphys-laws.com/calculator/buttered-toast?x=ignore', {
      h: 99,
      g: 980,
      o: 5,
      b: 1.2,
      f: 20,
      t: 350,
    });

    expect(url).toBe('https://murphys-laws.com/calculator/buttered-toast?x=ignore&h=99&g=980&o=5&b=1.2&f=20&t=350');
  });

  it('parses only values inside the configured slider bounds', () => {
    const state = parseCalculatorState(
      new URLSearchParams('u=9&c=12&i=4&s=nope&f=1'),
      {
        u: { min: 1, max: 9 },
        c: { min: 1, max: 9 },
        i: { min: 1, max: 9 },
        s: { min: 1, max: 9 },
        f: { min: 1, max: 9 },
      }
    );

    expect(state).toEqual({ u: 9, i: 4, f: 1 });
  });
});
