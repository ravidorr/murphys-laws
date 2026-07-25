import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exposeExperiment,
  getExperimentVariant,
  HOME_MODULE_ORDER_EXPERIMENT,
  trackExperimentOutcome
} from '../src/utils/experiments.ts';
import { trackProductEvent } from '../src/utils/metrics.ts';

vi.mock('../src/utils/metrics.ts', () => ({
  trackProductEvent: vi.fn()
}));

describe('anonymous experiment registry', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists one anonymous variant assignment', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const first = getExperimentVariant(HOME_MODULE_ORDER_EXPERIMENT, ['themes-first', 'trending-first'] as const);
    vi.mocked(Math.random).mockReturnValue(0);
    const second = getExperimentVariant(HOME_MODULE_ORDER_EXPERIMENT, ['themes-first', 'trending-first'] as const);
    expect(first).toBe('trending-first');
    expect(second).toBe(first);
  });

  it('uses the control without storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getExperimentVariant(HOME_MODULE_ORDER_EXPERIMENT, ['themes-first', 'trending-first'] as const)).toBe('themes-first');
  });

  it('rejects experiments without variants', () => {
    expect(() => getExperimentVariant(HOME_MODULE_ORDER_EXPERIMENT, [])).toThrow('at least one variant');
  });

  it('tracks exposure and assigned-variant outcomes', () => {
    localStorage.setItem(`murphys-experiment:${HOME_MODULE_ORDER_EXPERIMENT}`, 'themes-first');

    exposeExperiment(HOME_MODULE_ORDER_EXPERIMENT, 'themes-first');
    trackExperimentOutcome(HOME_MODULE_ORDER_EXPERIMENT, 'browse');

    expect(trackProductEvent).toHaveBeenCalledWith('experiment.exposure', {
      experiment: HOME_MODULE_ORDER_EXPERIMENT,
      variant: 'themes-first'
    });
    expect(trackProductEvent).toHaveBeenCalledWith('experiment.conversion', {
      experiment: HOME_MODULE_ORDER_EXPERIMENT,
      variant: 'themes-first',
      action: 'browse'
    });
  });

  it('ignores outcomes without an assignment or storage access', () => {
    trackExperimentOutcome(HOME_MODULE_ORDER_EXPERIMENT, 'browse');
    expect(trackProductEvent).not.toHaveBeenCalled();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => trackExperimentOutcome(HOME_MODULE_ORDER_EXPERIMENT, 'browse')).not.toThrow();
    expect(trackProductEvent).not.toHaveBeenCalled();
  });
});
