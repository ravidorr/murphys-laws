import { trackProductEvent } from './metrics.ts';

export const HOME_MODULE_ORDER_EXPERIMENT = 'homepage-module-order-v1';
export type HomeModuleOrderVariant = 'themes-first' | 'trending-first';

function storageKey(experiment: string): string {
  return `murphys-experiment:${experiment}`;
}

export function getExperimentVariant<T extends string>(experiment: string, variants: readonly T[]): T {
  if (variants.length === 0) throw new Error('Experiment requires at least one variant');
  try {
    const stored = localStorage.getItem(storageKey(experiment));
    if (stored && variants.includes(stored as T)) return stored as T;
    const variant = variants[Math.floor(Math.random() * variants.length)]!;
    localStorage.setItem(storageKey(experiment), variant);
    return variant;
  } catch {
    return variants[0]!;
  }
}

export function exposeExperiment(experiment: string, variant: string): void {
  trackProductEvent('experiment.exposure', { experiment, variant });
}

export function trackExperimentOutcome(experiment: string, outcome: string): void {
  try {
    const variant = localStorage.getItem(storageKey(experiment));
    if (variant) trackProductEvent('experiment.conversion', { experiment, variant, action: outcome });
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}
