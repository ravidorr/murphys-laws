/**
 * Sentry metrics helper. Metrics are automatically enabled when Sentry is
 * initialized (SDK 10.25+). Use these functions to emit count, gauge, and
 * distribution metrics that connect to errors, logs, and spans in Sentry.
 */
import * as Sentry from '@sentry/browser';

const metricsEnabled =
  typeof import.meta !== 'undefined' &&
  !!import.meta.env?.VITE_SENTRY_DSN &&
  !!import.meta.env?.PROD;

function hasMetrics(): boolean {
  return metricsEnabled && typeof Sentry.metrics?.count === 'function';
}

export type ProductEventName =
  | 'archive.search'
  | 'archive.no_results'
  | 'category.click'
  | 'law.related_click'
  | 'law.vote'
  | 'law.favorite'
  | 'law.share'
  | 'calculator.start'
  | 'calculator.complete'
  | 'submit.start'
  | 'submit.complete';

type ProductEventTags = Partial<Record<'surface' | 'result' | 'category' | 'action' | 'calculator', string>>;

/**
 * Increment a counter (e.g. button clicks, API calls).
 */
export function count(name: string, value: number = 1, options?: { tags?: Record<string, string>; unit?: string }): void {
  if (!hasMetrics()) return;
  if (options) {
    Sentry.metrics.count(name, value, options);
    return;
  }
  Sentry.metrics.count(name, value);
}

export function trackProductEvent(name: ProductEventName, tags: ProductEventTags = {}): void {
  count(`product.${name}`, 1, { tags });
}

/**
 * Record a gauge value (e.g. current queue depth, active connections).
 */
export function gauge(name: string, value: number, options?: { tags?: Record<string, string>; unit?: string }): void {
  if (!hasMetrics()) return;
  Sentry.metrics.gauge(name, value, options);
}

/**
 * Record a distribution (e.g. response times, payload sizes).
 */
export function distribution(
  name: string,
  value: number,
  options?: { tags?: Record<string, string>; unit?: string }
): void {
  if (!hasMetrics()) return;
  Sentry.metrics.distribution(name, value, options);
}
