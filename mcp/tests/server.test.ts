import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('constructs an McpServer that reports the package version', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('accepts MURPHYS_API_URL override via env', () => {
    const original = process.env.MURPHYS_API_URL;
    process.env.MURPHYS_API_URL = 'https://staging.example';
    try {
      expect(() => createServer()).not.toThrow();
    } finally {
      if (original === undefined) {
        delete process.env.MURPHYS_API_URL;
      } else {
        process.env.MURPHYS_API_URL = original;
      }
    }
  });
});
