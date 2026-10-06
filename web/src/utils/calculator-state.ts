export type CalculatorState = Record<string, number>;
export type CalculatorBounds = Record<string, { min: number; max: number }>;

/** CSS class marking a calculator result's band, from safest to worst. */
export type CalculatorResultBand = 'calc-ok' | 'calc-warn' | 'calc-orange' | 'calc-danger' | 'calc-dark';

/** Risk level reported to analytics for each result band (shared by all calculators). */
export const CALCULATOR_RISK_LEVELS: Readonly<Record<CalculatorResultBand, string>> = {
  'calc-ok': 'low',
  'calc-warn': 'moderate',
  'calc-orange': 'elevated',
  'calc-danger': 'high',
  'calc-dark': 'critical',
};

/** Sliders fire on every drag step; a result counts as used once they rest this long. */
export const CALCULATOR_RESULT_SETTLE_MS = 1000;

export function serializeCalculatorState(baseUrl: string, state: CalculatorState): string {
  const url = new URL(baseUrl);
  Object.entries(state).forEach(([key, value]) => {
    if (Number.isFinite(value)) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function parseCalculatorState(params: URLSearchParams, bounds: CalculatorBounds): CalculatorState {
  const parsed: CalculatorState = {};
  Object.entries(bounds).forEach(([key, range]) => {
    const raw = params.get(key);
    if (!raw) return;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= range.min && value <= range.max) {
      parsed[key] = value;
    }
  });
  return parsed;
}
