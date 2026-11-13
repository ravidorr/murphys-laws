// Scoring for the Buttered Toast Landing Calculator, shared by its sliders and by its WebMCP tool.
import { CALCULATOR_RISK_LEVELS, type CalculatorResultBand } from './calculator-state.ts';

/** The six settings, in the units the sliders show. */
export interface ButteredToastInputs {
  /** Table height, cm. */
  height: number;
  /** Gravity, cm/s². */
  gravity: number;
  /** How far the toast overhangs the edge, cm. */
  overhang: number;
  /** Butter factor. */
  butter: number;
  /** Air friction. */
  friction: number;
  /** Toast inertia. */
  inertia: number;
}

export interface ButteredToastResult {
  /** Chance of landing butter-side down, 0 to 100, unrounded. */
  probability: number;
  /** `probability` rounded, as the page shows it. */
  probabilityPercent: number;
  band: CalculatorResultBand;
  riskLevel: string;
  interpretation: string;
}

/** The slider ranges in the calculator's template. */
export const BUTTERED_TOAST_RANGES: Readonly<Record<keyof ButteredToastInputs, { min: number; max: number }>> = {
  height: { min: 30, max: 200 },
  gravity: { min: 162, max: 2479 },
  overhang: { min: 1, max: 20 },
  butter: { min: 1, max: 2 },
  friction: { min: 0, max: 100 },
  inertia: { min: 250, max: 500 },
};

// Lower bounds (exclusive) of each band, highest first; the last band has none
const BANDS: ReadonlyArray<{ above: number; band: CalculatorResultBand; interpretation: string }> = [
  { above: 85, band: 'calc-dark', interpretation: 'Catastrophe is imminent! Prepare for cleaning.' },
  { above: 60, band: 'calc-danger', interpretation: "You're in the butter zone. High risk of a mess." },
  { above: 25, band: 'calc-orange', interpretation: "It's a toss-up. May the odds be ever in your favor." },
  { above: -Infinity, band: 'calc-ok', interpretation: 'Looking good! Toast should land safely.' },
];

export function calculateButteredToast({ height, gravity, overhang, butter, friction, inertia }: ButteredToastInputs): ButteredToastResult {
  const totalRotationFactor = (30 * Math.sqrt(height / gravity) * overhang * butter) / (inertia + friction);
  const landingOrientation = totalRotationFactor % 1;
  const probability = Math.max(0, (1 - Math.abs(landingOrientation - 0.5) * 2) * 100);
  const { band, interpretation } = BANDS.find((candidate) => probability > candidate.above)!;
  return {
    probability,
    probabilityPercent: Math.round(probability),
    band,
    riskLevel: CALCULATOR_RISK_LEVELS[band],
    interpretation,
  };
}
