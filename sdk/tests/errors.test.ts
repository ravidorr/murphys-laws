import { describe, it, expect } from 'vitest';
import { ApiError } from '../src/errors.js';

describe('ApiError', () => {
  it('captures status and body', () => {
    const err = new ApiError(418, 'teapot');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(418);
    expect(err.body).toBe('teapot');
    expect(err.message).toBe('API error 418: teapot');
  });
});
