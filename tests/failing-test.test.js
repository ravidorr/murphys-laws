import { describe, it, expect } from 'vitest';

describe('Failing Test', () => {
  it('should fail intentionally', () => {
    expect(true).toBe(false);
  });
});