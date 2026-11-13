// Scoring for the home page's Sod's Law calculator, shared by its sliders and by its WebMCP tool.
import { CALCULATOR_RISK_LEVELS, type CalculatorResultBand } from './calculator-state.ts';

/** The five ratings, each 1 to 9. */
export interface SodsLawInputs {
  urgency: number;
  complexity: number;
  importance: number;
  /** 9 is expert. */
  skill: number;
  frequency: number;
}

export interface SodsLawResult {
  /** 0 to 8.6, unrounded. */
  score: number;
  /** The same score on the full calculator page's 0-100% scale. */
  probabilityPercent: number;
  band: CalculatorResultBand;
  riskLevel: string;
  interpretation: string;
}

export const SODS_LAW_MIN_RATING = 1;
export const SODS_LAW_MAX_RATING = 9;

/** The highest score shown; anything above it counts as certain. */
const MAX_SCORE = 8.6;
const AIR_FACTOR = 0.7;

// Upper bounds (exclusive) of each band, lowest first; the last band has no bound
const BANDS: ReadonlyArray<{ below: number; band: CalculatorResultBand; interpretation: string }> = [
  { below: 2, band: 'calc-ok', interpretation: "You're probably safe. What could possibly go wrong?" },
  { below: 4, band: 'calc-warn', interpretation: 'A bit risky. Maybe have a backup plan.' },
  { below: 6, band: 'calc-orange', interpretation: 'Definitely worrying. Proceed with caution.' },
  { below: 8, band: 'calc-danger', interpretation: "Disaster is looming. It's not looking good." },
  { below: Infinity, band: 'calc-dark', interpretation: 'Catastrophe is almost certain. Good luck.' },
];

export function calculateSodsLaw({ urgency, complexity, importance, skill, frequency }: SodsLawInputs): SodsLawResult {
  const raw = ((urgency + complexity + importance) * (10 - skill)) / 20 * AIR_FACTOR * (1 / (1 - Math.sin(frequency / 10)));
  const score = Math.min(raw, MAX_SCORE);
  const { band, interpretation } = BANDS.find((candidate) => score < candidate.below)!;
  return {
    score,
    probabilityPercent: Math.round((score / MAX_SCORE) * 100),
    band,
    riskLevel: CALCULATOR_RISK_LEVELS[band],
    interpretation,
  };
}
