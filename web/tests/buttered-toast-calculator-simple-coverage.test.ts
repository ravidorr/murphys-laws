import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@components/templates/buttered-toast-calculator-simple.html?raw', () => ({
  default: '<section class="section"></section>'
}));

import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';

describe('ButteredToastCalculatorSimple coverage (L25)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('throws when template is missing a slider (L25)', async () => {
    const { ButteredToastCalculatorSimple: Calc } = await import('@components/buttered-toast-calculator-simple.js');
    expect(() => Calc({ onNavigate: () => {} })).toThrow(/Calculator slider.*not found/);
  });
});
