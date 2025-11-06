import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRandomLoadingMessage, SITE_URL, API_BASE_URL, API_FALLBACK_URL } from '../src/utils/constants.js';

describe('Constants', () => {
  describe('getRandomLoadingMessage', () => {
    it('returns a string', () => {
      const message = getRandomLoadingMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('returns different messages on multiple calls', () => {
      const messages = new Set();
      for (let i = 0; i < 20; i++) {
        messages.add(getRandomLoadingMessage());
      }
      // Should have some variety (not all the same)
      expect(messages.size).toBeGreaterThan(1);
    });

    it('returns a message containing "Loading"', () => {
      const message = getRandomLoadingMessage();
      expect(message.toLowerCase()).toContain('loading');
    });
  });

  describe('SITE_URL', () => {
    it('has a default value', () => {
      expect(typeof SITE_URL).toBe('string');
      expect(SITE_URL.length).toBeGreaterThan(0);
    });

    it('uses default when no env vars available', () => {
      // The getEnvVar function should return default when neither Vite nor Node env is available
      // In test environment, import.meta.env might exist but not have VITE_SITE_URL
      // So it should fall back to default
      expect(SITE_URL).toBe('https://murphys-laws.com');
    });
  });

  describe('API_BASE_URL', () => {
    it('has a value', () => {
      expect(typeof API_BASE_URL).toBe('string');
    });
  });

  describe('API_FALLBACK_URL', () => {
    it('has a default value', () => {
      expect(typeof API_FALLBACK_URL).toBe('string');
      expect(API_FALLBACK_URL.length).toBeGreaterThan(0);
    });
  });
});

