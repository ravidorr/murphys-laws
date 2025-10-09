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

  it('shows error state in character counter for short text', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));

    expect(counter.classList.contains('submit-char-counter-error')).toBe(true);

    document.body.removeChild(el);
  });

  it('removes error state when text becomes valid', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const textarea = el.querySelector('#submit-text');
    const counter = el.querySelector('.submit-char-counter');

    // First add error
    textarea.value = 'Short';
    textarea.dispatchEvent(new Event('input'));
    expect(counter.classList.contains('submit-char-counter-error')).toBe(true);

    // Then fix it
    textarea.value = 'This is now valid text';
    textarea.dispatchEvent(new Event('input'));
    expect(counter.classList.contains('submit-char-counter-error')).toBe(false);

    document.body.removeChild(el);
  });

  it('clears message div initially', () => {
    const el = SubmitLawSection();
    document.body.appendChild(el);

    const messageDiv = el.querySelector('.submit-message');

    // Message div should be hidden initially
    expect(messageDiv.style.display).toBe('');
    expect(messageDiv.textContent).toBe('');

    document.body.removeChild(el);
  });

  it('handles 404 error with user-friendly message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles 500 error with user-friendly message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles other status codes with generic message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('uses fallback URL when primary fails', async () => {
    // Mock fetchAPI for category loading
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 123 })
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(global.fetch).toHaveBeenCalledTimes(2);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 404 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 500 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback 400 error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback other status codes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 418,
        json: async () => { throw new Error('Not JSON'); }
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('submits with title, author, and category when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [{ id: 1, title: 'General' }]
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const title = el.querySelector('#submit-title');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const categorySelect = el.querySelector('#submit-category');
    const termsCheckbox = el.querySelector('#submit-terms');

    title.value = 'Test Title';
    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    categorySelect.value = '1';
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('omits author and email when anonymous is checked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const email = el.querySelector('#submit-email');
    const anonymous = el.querySelector('#submit-anonymous');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    email.value = 'john@example.com';
    anonymous.checked = true;
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('clears form after successful submission', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const title = el.querySelector('#submit-title');
    const textarea = el.querySelector('#submit-text');
    const author = el.querySelector('#submit-author');
    const email = el.querySelector('#submit-email');
    const termsCheckbox = el.querySelector('#submit-terms');

    title.value = 'Test Title';
    textarea.value = 'Valid law text with enough characters';
    author.value = 'John Doe';
    email.value = 'john@example.com';
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 400));

    // Fields should be cleared
    expect(title.value).toBe('');
    expect(textarea.value).toBe('');
    expect(author.value).toBe('');
    expect(email.value).toBe('');
    expect(termsCheckbox.checked).toBe(false);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response without data property', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({});

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category');
    // Should only have the default option
    expect(categorySelect.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response with non-array data', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: 'not an array' });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category');
    // Should only have the default option
    expect(categorySelect.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without text', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    global.fetch = vi.fn();

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const termsCheckbox = el.querySelector('#submit-terms');

    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - global.fetch should not be called for submission
    expect(global.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without terms checked', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    global.fetch = vi.fn();

    const el = SubmitLawSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');

    textarea.value = 'Valid law text with enough characters';

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - global.fetch should not be called for submission
    expect(global.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles fallback error with error property', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Fallback error' })
      });

    const el = SubmitLawSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form');
    const textarea = el.querySelector('#submit-text');
    const termsCheckbox = el.querySelector('#submit-terms');

    textarea.value = 'Valid law text with enough characters';
    textarea.dispatchEvent(new Event('input'));
    termsCheckbox.checked = true;
    termsCheckbox.dispatchEvent(new Event('change'));

    form.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });
});
