import { describe, expect, it } from 'vitest';
import { calculateSodsLaw } from '../src/utils/sods-law.ts';
import { BUTTERED_TOAST_RANGES, calculateButteredToast, type ButteredToastInputs } from '../src/utils/buttered-toast.ts';

describe('calculateSodsLaw', () => {
  const ratings = (urgency: number, complexity: number, importance: number, skill: number, frequency: number) =>
    ({ urgency, complexity, importance, skill, frequency });

  it('scores the default sliders at 5.04, the value the page shows', () => {
    const result = calculateSodsLaw(ratings(5, 5, 5, 5, 5));
    expect(result.score.toFixed(2)).toBe('5.04');
    expect(result).toMatchObject({
      probabilityPercent: 59,
      band: 'calc-orange',
      riskLevel: 'elevated',
      interpretation: 'Definitely worrying. Proceed with caution.',
    });
  });

  it.each([
    [ratings(1, 1, 1, 9, 1), 'calc-ok', 'low', "You're probably safe. What could possibly go wrong?"],
    [ratings(3, 3, 3, 5, 5), 'calc-warn', 'moderate', 'A bit risky. Maybe have a backup plan.'],
    [ratings(5, 5, 5, 5, 5), 'calc-orange', 'elevated', 'Definitely worrying. Proceed with caution.'],
    [ratings(7, 7, 7, 5, 5), 'calc-danger', 'high', "Disaster is looming. It's not looking good."],
    [ratings(9, 9, 9, 1, 9), 'calc-dark', 'critical', 'Catastrophe is almost certain. Good luck.'],
  ])('puts %j in its band', (inputs, band, riskLevel, interpretation) => {
    expect(calculateSodsLaw(inputs)).toMatchObject({ band, riskLevel, interpretation });
  });

  it('caps the score at 8.6, which is 100%', () => {
    const result = calculateSodsLaw(ratings(9, 9, 9, 1, 9));
    expect(result.score).toBe(8.6);
    expect(result.probabilityPercent).toBe(100);
  });
});

describe('calculateButteredToast', () => {
  const defaults: ButteredToastInputs = { height: 75, gravity: 980, overhang: 5, butter: 1.2, friction: 20, inertia: 350 };

  it('gives the default sliders 27%, a toss-up', () => {
    const result = calculateButteredToast(defaults);
    expect(result.probabilityPercent).toBe(27);
    expect(result.probability).toBeCloseTo(26.9, 1);
    expect(result).toMatchObject({
      band: 'calc-orange',
      riskLevel: 'elevated',
      interpretation: "It's a toss-up. May the odds be ever in your favor.",
    });
  });

  it.each([
    [1, 'calc-ok', 'low', 'Looking good! Toast should land safely.'],
    [13, 'calc-danger', 'high', "You're in the butter zone. High risk of a mess."],
    [17, 'calc-dark', 'critical', 'Catastrophe is imminent! Prepare for cleaning.'],
  ])('puts an overhang of %s cm in its band', (overhang, band, riskLevel, interpretation) => {
    expect(calculateButteredToast({ ...defaults, overhang })).toMatchObject({ band, riskLevel, interpretation });
  });

  it('never leaves 0 to 100 across the slider ranges', () => {
    const { height, gravity, overhang, butter, friction, inertia } = BUTTERED_TOAST_RANGES;
    for (const h of [height.min, height.max]) {
      for (const g of [gravity.min, gravity.max]) {
        for (const o of [overhang.min, overhang.max]) {
          for (const b of [butter.min, butter.max]) {
            for (const f of [friction.min, friction.max]) {
              for (const t of [inertia.min, inertia.max]) {
                const { probability } = calculateButteredToast({ height: h, gravity: g, overhang: o, butter: b, friction: f, inertia: t });
                expect(probability).toBeGreaterThanOrEqual(0);
                expect(probability).toBeLessThanOrEqual(100);
              }
            }
          }
        }
      }
    }
  });
});
