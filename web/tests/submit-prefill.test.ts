import { afterEach, describe, expect, it } from 'vitest';
import { consumeSubmitPrefillText, submitPrefillUrl, SUBMIT_PREFILL_MAX_LENGTH } from '../src/utils/submit-prefill.js';

describe('submit prefill', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('builds a submit URL that carries the text, encoded', () => {
    expect(submitPrefillUrl('toast & jam')).toBe('/submit?text=toast+%26+jam');
  });

  it('caps the text in the URL at the form limit', () => {
    const url = new URL(submitPrefillUrl('a'.repeat(SUBMIT_PREFILL_MAX_LENGTH + 200)), 'http://localhost');
    expect(url.searchParams.get('text')).toHaveLength(SUBMIT_PREFILL_MAX_LENGTH);
  });

  it('returns the text and removes it from the address', () => {
    window.history.replaceState({ name: 'submit' }, '', '/submit?text=toast+%26+jam');

    expect(consumeSubmitPrefillText()).toBe('toast & jam');
    expect(location.pathname).toBe('/submit');
    expect(location.search).toBe('');
    expect(history.state).toEqual({ name: 'submit' });
  });

  it('keeps other query parameters and the hash', () => {
    window.history.replaceState(null, '', '/submit?text=toast&utm_source=mail#form');

    expect(consumeSubmitPrefillText()).toBe('toast');
    expect(location.search).toBe('?utm_source=mail');
    expect(location.hash).toBe('#form');
    expect(history.state).toEqual({});
  });

  it('returns undefined and leaves the address alone when there is no text', () => {
    window.history.replaceState({}, '', '/submit?utm_source=mail');

    expect(consumeSubmitPrefillText()).toBeUndefined();
    expect(location.search).toBe('?utm_source=mail');
  });

  it('returns an empty string for an empty text parameter', () => {
    window.history.replaceState({}, '', '/submit?text=');

    expect(consumeSubmitPrefillText()).toBe('');
    expect(location.search).toBe('');
  });
});
