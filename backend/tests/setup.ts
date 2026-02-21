/**
 * Global test setup. Mocks @sentry/node so the real SDK never runs during tests.
 * Prevents CI failures from Sentry (e.g. git or network) when coverage loads app code.
 */
import { vi } from 'vitest';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));
