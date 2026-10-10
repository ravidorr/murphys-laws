import { describe, expect, it } from 'vitest';
import rootPackage from '../../package.json';
import { APP_VERSION } from '../src/utils/app-version.js';

describe('APP_VERSION', () => {
  it('uses the root package version', () => {
    expect(APP_VERSION).toBe(rootPackage.version);
  });
});
