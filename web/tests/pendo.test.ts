import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getErrorMessage,
  getPagePath,
  getRequestErrorType,
  getSearchProperties,
  normalizeQuery,
  trackPendoEvent
} from '../src/utils/pendo.ts';

describe('Pendo track events helper', () => {
  type PendoTrack = (eventName: string, properties?: Record<string, unknown>) => void;
  let track: ReturnType<typeof vi.fn<PendoTrack>>;

  beforeEach(() => {
    track = vi.fn<PendoTrack>();
    window.pendo = { track };
  });

  afterEach(() => {
    delete window.pendo;
  });

  describe('trackPendoEvent', () => {
    it('sends the event name and properties to the Pendo agent', () => {
      trackPendoEvent('law_voted', { law_id: '7', upvotes: 3, removed: false });

      expect(track).toHaveBeenCalledWith('law_voted', { law_id: '7', upvotes: 3, removed: false });
    });

    it('sends an empty property object by default', () => {
      trackPendoEvent('favorites_cleared');

      expect(track).toHaveBeenCalledWith('favorites_cleared', {});
    });

    it('drops empty and non-finite values and truncates long strings', () => {
      trackPendoEvent('search_performed', {
        query: 'x'.repeat(150),
        category_id: undefined,
        attribution: null,
        results_count: Number.NaN,
        query_length: 150,
      });

      expect(track).toHaveBeenCalledWith('search_performed', { query: 'x'.repeat(100), query_length: 150 });
    });

    it('is a no-op when the Pendo agent is not loaded', () => {
      delete window.pendo;
      expect(() => trackPendoEvent('theme_changed', { theme: 'dark' })).not.toThrow();

      window.pendo = {};
      expect(() => trackPendoEvent('theme_changed', { theme: 'dark' })).not.toThrow();
      expect(track).not.toHaveBeenCalled();
    });

    it('never lets an agent error reach the caller', () => {
      track.mockImplementation(() => { throw new Error('agent failure'); });

      expect(() => trackPendoEvent('pwa_installed')).not.toThrow();
    });
  });

  it('getPagePath returns the current path without the query string', () => {
    window.history.replaceState(null, '', '/browse?q=toast');

    expect(getPagePath()).toBe('/browse');
  });

  it('normalizeQuery lower-cases, collapses whitespace and truncates free text', () => {
    expect(normalizeQuery('  Murphy   WAS   Here ')).toBe('murphy was here');
    expect(normalizeQuery('A'.repeat(120))).toBe('a'.repeat(100));
    expect(normalizeQuery(undefined)).toBe('');
    expect(normalizeQuery(null)).toBe('');
  });

  describe('getSearchProperties', () => {
    it('describes active search filters', () => {
      expect(getSearchProperties({ q: ' Toast ', category_id: 12, attribution: 'Arthur Bloch' }, 'relevance')).toEqual({
        query: 'toast',
        query_length: 5,
        category_id: '12',
        attribution: 'Arthur Bloch',
        sort: 'relevance',
      });
    });

    it('leaves out filters that are not set', () => {
      expect(getSearchProperties({ category_id: '' }, 'score')).toEqual({
        query: undefined,
        query_length: 0,
        category_id: undefined,
        attribution: undefined,
        sort: 'score',
      });
    });
  });

  describe('getRequestErrorType', () => {
    it.each([
      ['Rate limit exceeded. Please try again later.', 'rate_limited'],
      ['The request timed out. Please try again.', 'timeout'],
      ['Network error. Please check your connection and try again.', 'network'],
      ['Invalid response from server. Please try again.', 'invalid_response'],
      ['The server encountered an error. Please try again later.', 'server_error'],
      ['Internal Server Error', 'server_error'],
      ['The requested resource was not found. Please make sure the API server is running.', 'not_found'],
      ['You do not have permission to perform this action.', 'forbidden'],
      ['Law text must be at least 10 characters', 'validation'],
      ['Law text is required', 'validation'],
      ['Invalid category ID', 'validation'],
      ['Something unexpected', 'unknown'],
    ])('classifies "%s" as %s', (message, expected) => {
      expect(getRequestErrorType(new Error(message))).toBe(expected);
    });

    it('classifies non-Error rejections by their text', () => {
      expect(getRequestErrorType('boom')).toBe('unknown');
      expect(getRequestErrorType('Rate limit exceeded')).toBe('rate_limited');
    });
  });

  it('getErrorMessage reads Error messages and stringifies anything else', () => {
    expect(getErrorMessage(new Error('Vote failed'))).toBe('Vote failed');
    expect(getErrorMessage('offline')).toBe('offline');
  });
});
