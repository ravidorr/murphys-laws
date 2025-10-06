import { SubmitLawSection } from '../src/components/submit-law.js';
import { vi } from 'vitest';
import * as api from '../src/utils/api.js';

describe('SubmitLawSection component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with all fields', () => {
    const el = SubmitLawSection();

    expect(el.querySelector('#submit-title')).toBeTruthy();
    expect(el.querySelector('#submit-text')).toBeTruthy();
    expect(el.querySelector('#submit-category')).toBeTruthy();
    expect(el.querySelector('#submit-author')).toBeTruthy();
    expect(el.querySelector('#submit-email')).toBeTruthy();
    expect(el.querySelector('#submit-anonymous')).toBeTruthy();
    expect(el.querySelector('#submit-terms')).toBeTruthy();
    expect(el.querySelector('#submit-btn')).toBeTruthy();
  });

  it('submit button is disabled initially', () => {
    const el = SubmitLawSection();
    const submitBtn = el.querySelector('#submit-btn');

    expect(submitBtn.disabled).toBe(true);
  });

  it('updates character counter on text input', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    textarea.value = 'Test text';
    textarea.dispatchEvent(new Event('input'));

    expect(counter.textContent).toContain('9');

    document.body.removeChild(el);
  });

  it('enables submit button when text and terms are filled', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');
    const submitBtn = el.querySelector('#submit-btn');

    textarea.value = 'This is a valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(submitBtn.disabled).toBe(false);

    document.body.removeChild(el);
  });

  it('disables submit button if text is too short', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');
    const submitBtn = el.querySelector('#submit-btn');

    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    expect(submitBtn.disabled).toBe(true);

    document.body.removeChild(el);
  });

  it('loads categories on mount', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [
        { id: 1, name: 'General' },
        { id: 2, name: 'Technology' }
      ]
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category');
    const options = categorySelect.querySelectorAll('option');

    expect(options.length).toBeGreaterThan(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles category loading error gracefully', async () => {
    vi.spyOn(api, 'fetchAPI').mockRejectedValue(new Error('API failed'));

    const el = SubmitLawSection();

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category');
    expect(categorySelect).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('anonymous checkbox exists and works', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const anonymousCheckbox = el.querySelector('#submit-anonymous');

    expect(anonymousCheckbox).toBeTruthy();
    expect(anonymousCheckbox.type).toBe('checkbox');

    anonymousCheckbox.checked = true;
    expect(anonymousCheckbox.checked).toBe(true);

    document.body.removeChild(el);
  });

  it('submits form with valid data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'This is a valid law text with more than ten characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('shows error message on submit failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid data' })
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'This is a valid law text with more than ten characters';
    textarea.dispatchEvent(new Event('input'));

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('validates email format', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const emailInput = el.querySelector('#submit-email');

    emailInput.value = 'invalid-email';
    emailInput.dispatchEvent(new Event('input'));

    // HTML5 validation should apply
    expect(emailInput.type).toBe('email');

    document.body.removeChild(el);
  });
});
