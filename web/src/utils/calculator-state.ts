export type CalculatorState = Record<string, number>;
export type CalculatorBounds = Record<string, { min: number; max: number }>;

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
