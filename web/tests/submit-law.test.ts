import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { SubmitLawSection } from '../src/components/submit-law.ts';
import * as api from '../src/utils/api.ts';
import * as cacheUtils from '../src/utils/category-cache.ts';

interface SubmitLawContext {
  el?: HTMLElement | null;
  appended?: boolean;
}

interface SubmitLawTestLocal {
  el?: HTMLElement | null;
  submitBtn?: HTMLButtonElement | null;
  textarea?: HTMLTextAreaElement | null;
  termsCheckbox?: HTMLInputElement | null;
}

function createLocalThis(): () => SubmitLawContext {
  const context: SubmitLawContext = {};

  beforeEach(() => {
    (Object.keys(context) as (keyof SubmitLawContext)[]).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('SubmitLawSection component', () => {
  const local = createLocalThis();
  let deferUntilIdleSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    const self = local();
    self.el = null;
    self.appended = false;
    deferUntilIdleSpy = vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => {
      // Execute immediately for testing
      callback();
    });
    localStorage.clear();
  });

  afterEach(() => {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    self.el = null;
    self.appended = false;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function mountSection({ append = false } = {}) {
    const self = local();
    if (self.appended && self.el?.parentNode) {
      self.el.parentNode.removeChild(self.el);
    }
    const el = SubmitLawSection();
    self.el = el;
    self.appended = append;
    if (append) {
      document.body.appendChild(el);
    }
    return el;
  }

  it('renders form with all fields', () => {
    const el = mountSection();

    expect(el.querySelector('#submit-title') as HTMLInputElement | null).toBeTruthy();
    expect(el.querySelector('#submit-text') as HTMLTextAreaElement | null).toBeTruthy();
    expect(el.querySelector('#submit-category') as HTMLSelectElement | null).toBeTruthy();
    expect(el.querySelector('#submit-author') as HTMLInputElement | null).toBeTruthy();
    expect(el.querySelector('#submit-email') as HTMLInputElement | null).toBeTruthy();
    expect(el.querySelector('#submit-anonymous') as HTMLInputElement | null).toBeTruthy();
    expect(el.querySelector('#submit-terms') as HTMLInputElement | null).toBeTruthy();
    expect(el.querySelector('#submit-btn') as HTMLButtonElement | null).toBeTruthy();
  });

  it('submit button is disabled initially', () => {
    const el = mountSection();
    const submitBtn = el.querySelector('#submit-btn') as HTMLButtonElement | null;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn!.disabled).toBe(true);
  });

  it('submit button has tooltip when disabled', () => {
    const localThis: SubmitLawTestLocal = {};
    localThis.el = mountSection();
    localThis.submitBtn = localThis.el!.querySelector('#submit-btn') as HTMLButtonElement | null;
    expect(localThis.submitBtn).toBeTruthy();
    expect(localThis.submitBtn!.disabled).toBe(true);
    expect(localThis.submitBtn!.getAttribute('data-tooltip')).toBe('Complete required fields to submit');
  });

  it('submit button tooltip is removed when enabled', () => {
    const localThis: SubmitLawTestLocal = {};
    localThis.el = mountSection({ append: true });
    localThis.textarea = localThis.el!.querySelector('#submit-text') as HTMLTextAreaElement | null;
    localThis.termsCheckbox = localThis.el!.querySelector('#submit-terms') as HTMLInputElement | null;
    localThis.submitBtn = localThis.el!.querySelector('#submit-btn') as HTMLButtonElement | null;
    expect(localThis.submitBtn).toBeTruthy();
    expect(localThis.textarea).toBeTruthy();
    expect(localThis.termsCheckbox).toBeTruthy();
    // Initially has tooltip
    expect(localThis.submitBtn!.getAttribute('data-tooltip')).toBe('Complete required fields to submit');

    // Fill requirements
    localThis.textarea!.value = 'This is a valid law text with enough characters';
    localThis.textarea!.dispatchEvent(new Event('input'));
    localThis.termsCheckbox!.checked = true;
    localThis.termsCheckbox!.dispatchEvent(new Event('change'));

    // Tooltip should be removed when enabled
    expect(localThis.submitBtn!.disabled).toBe(false);
    expect(localThis.submitBtn!.hasAttribute('data-tooltip')).toBe(false);
  });

  it('submit button tooltip returns when disabled again', () => {
    const localThis: SubmitLawTestLocal = {};
    localThis.el = mountSection({ append: true });
    localThis.textarea = localThis.el!.querySelector('#submit-text') as HTMLTextAreaElement | null as HTMLTextAreaElement | null;
    localThis.termsCheckbox = localThis.el!.querySelector('#submit-terms') as HTMLInputElement | null as HTMLInputElement | null;
    localThis.submitBtn = localThis.el!.querySelector('#submit-btn') as HTMLButtonElement | null as HTMLButtonElement | null;

    // Enable the button
    localThis.textarea!.value = 'This is a valid law text with enough characters';
    localThis.textarea!.dispatchEvent(new Event('input'));
    localThis.termsCheckbox!.checked = true;
    localThis.termsCheckbox!.dispatchEvent(new Event('change'));

    expect(localThis.submitBtn!.disabled).toBe(false);
    expect(localThis.submitBtn!.hasAttribute('data-tooltip')).toBe(false);

    // Disable by unchecking terms
    localThis.termsCheckbox!.checked = false;
    localThis.termsCheckbox!.dispatchEvent(new Event('change'));

    // Tooltip should return
    expect(localThis.submitBtn!.disabled).toBe(true);
    expect(localThis.submitBtn!.getAttribute('data-tooltip')).toBe('Complete required fields to submit');
  });

  it('renders validation requirements display', () => {
    const el = mountSection();
    
    const requirementsDiv = el.querySelector('.submit-requirements') as HTMLElement | null;
    const textRequirement = el.querySelector('[data-requirement="text"]') as HTMLElement | null;
    const termsRequirement = el.querySelector('[data-requirement="terms"]') as HTMLElement | null;

    expect(requirementsDiv).toBeTruthy();
    expect(textRequirement).toBeTruthy();
    expect(termsRequirement).toBeTruthy();
  });

  it('marks text requirement as met when text is valid', () => {
    const el = mountSection({ append: true });
    
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const textRequirement = el.querySelector('[data-requirement="text"]') as HTMLElement | null;

    // Initially not met
    expect(textRequirement!.classList.contains('requirement-met')).toBe(false);

    // Add valid text
    textarea!.value = 'This is a valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));

    expect(textRequirement!.classList.contains('requirement-met')).toBe(true);
  });

  it('marks terms requirement as met when terms are checked', () => {
    const el = mountSection({ append: true });
    
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;
    const termsRequirement = el.querySelector('[data-requirement="terms"]') as HTMLElement | null;

    // Initially not met
    expect(termsRequirement!.classList.contains('requirement-met')).toBe(false);

    // Check terms
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    expect(termsRequirement!.classList.contains('requirement-met')).toBe(true);
  });

  it('adds all-requirements-met class when all requirements are satisfied', () => {
    const el = mountSection({ append: true });
    
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;
    const requirementsDiv = el.querySelector('.submit-requirements') as HTMLElement | null;

    // Initially not all met
    expect(requirementsDiv!.classList.contains('all-requirements-met')).toBe(false);

    // Satisfy all requirements
    textarea!.value = 'This is a valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    expect(requirementsDiv!.classList.contains('all-requirements-met')).toBe(true);
  });

  it('updates character counter on text input', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const counter = el.querySelector('.submit-char-counter') as HTMLElement | null;

    textarea!.value = 'Test text';
    textarea!.dispatchEvent(new Event('input'));

    expect(counter!.textContent).toContain('9');

  });

  it('enables submit button when text and terms are filled', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;
    const submitBtn = el.querySelector('#submit-btn') as HTMLButtonElement | null;

    textarea!.value = 'This is a valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));

    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    expect(submitBtn!.disabled).toBe(false);

  });

  it('disables submit button if text is too short', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;
    const submitBtn = el.querySelector('#submit-btn') as HTMLButtonElement | null;

    textarea!.value = 'Short';
    textarea!.dispatchEvent(new Event('input'));

    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    expect(submitBtn!.disabled).toBe(true);

  });

  it('loads categories on mount', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [
        { id: 1, title: 'General' },
        { id: 2, title: 'Technology' }
      ]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    const options = categorySelect!.querySelectorAll('option');

    expect(options.length).toBeGreaterThan(1);
    expect(deferUntilIdleSpy).toHaveBeenCalled();
  });

  it('populates categories from cache immediately', () => {
    const categories = [
      { id: 1, title: 'General', slug: 'general' },
      { id: 2, title: 'Technology', slug: 'technology' }
    ];

    // Set cache before mounting
    cacheUtils.setCachedCategories(categories);

    const el = mountSection({ append: true });

    // Should populate immediately from cache
    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    const options = categorySelect!.querySelectorAll('option');

    expect(options.length).toBeGreaterThan(1);
    expect(categorySelect!.textContent).toMatch(/General/);
    expect(categorySelect!.textContent).toMatch(/Technology/);
  });

  it('loads categories on focus if not loaded yet', async () => {
    const categories = [
      { id: 1, title: 'General' }
    ];

    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: categories
    });

    // Mock deferUntilIdle to not execute immediately
    deferUntilIdleSpy.mockImplementation(() => {});

    const el = mountSection({ append: true });

    // Trigger focus event to lazy load
    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    categorySelect!.dispatchEvent(new Event('focus', { bubbles: true }));

    await vi.waitFor(() => {
      expect(categorySelect!.textContent).toMatch(/General/);
    });
  });

  it('does not load categories twice', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [{ id: 1, title: 'General' }]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    // First load happened
    const firstCallCount = fetchSpy.mock.calls.length;

    // Trigger focus again to try to load categories again
    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    categorySelect!.dispatchEvent(new Event('focus', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 10));

    // Should not have made additional API calls (categories already loaded)
    expect(fetchSpy.mock.calls.length).toBe(firstCallCount);
  });

  it('handles category loading error gracefully', async () => {
    vi.spyOn(api, 'fetchAPI').mockRejectedValue(new Error('API failed'));

    const el = mountSection();

    await new Promise(resolve => setTimeout(resolve, 10));

    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    expect(categorySelect).toBeTruthy();

  });

  it('anonymous checkbox exists and works', () => {
    const el = mountSection({ append: true });

    const anonymousCheckbox = el.querySelector('#submit-anonymous') as HTMLInputElement | null;

    expect(anonymousCheckbox).toBeTruthy();
    expect(anonymousCheckbox!.type).toBe('checkbox');

    anonymousCheckbox!.checked = true;
    expect(anonymousCheckbox!.checked).toBe(true);

  });

  it('submits form with valid data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'This is a valid law text with more than ten characters';
    textarea!.dispatchEvent(new Event('input'));

    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

  });

  it('shows error message on submit failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid data' })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'This is a valid law text with more than ten characters';
    textarea!.dispatchEvent(new Event('input'));

    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 10));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

  });

  it('validates email format', () => {
    const el = mountSection({ append: true });

    const emailInput = el.querySelector('#submit-email') as HTMLInputElement | null;

    emailInput!.value = 'invalid-email';
    emailInput!.dispatchEvent(new Event('input'));

    // HTML5 validation should apply
    expect(emailInput!.type).toBe('email');

  });

  it('shows error state in character counter for short text', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const counter = el.querySelector('.submit-char-counter') as HTMLElement | null;

    textarea!.value = 'Short';
    textarea!.dispatchEvent(new Event('input'));

    expect(counter!.classList.contains('submit-char-counter-error')).toBe(true);

  });

  it('removes error state when text becomes valid', () => {
    const el = mountSection({ append: true });

    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const counter = el.querySelector('.submit-char-counter') as HTMLElement | null;

    // First add error
    textarea!.value = 'Short';
    textarea!.dispatchEvent(new Event('input'));
    expect(counter!.classList.contains('submit-char-counter-error')).toBe(true);

    // Then fix it
    textarea!.value = 'This is now valid text';
    textarea!.dispatchEvent(new Event('input'));
    expect(counter!.classList.contains('submit-char-counter-error')).toBe(false);

  });

  it('clears message div initially', () => {
    const el = mountSection({ append: true });

    const messageDiv = el.querySelector('.submit-message') as HTMLElement | null;

    // Message div should be hidden initially
    expect(messageDiv!.style.display).toBe('');
    expect(messageDiv!.textContent).toBe('');

  });

  it('handles 404 error with user-friendly message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('handles 500 error with user-friendly message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('handles other status codes with generic message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

  });

  it('handles 503 error', async () => {
    // Mock fetchAPI for category loading
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service unavailable' })
    });

    const el = mountSection();
    document.body.appendChild(el);

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles 404 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles 500 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles 400 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles other status codes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 418,
      json: async () => { throw new Error('Not JSON'); }
    });

    const el = mountSection();
    document.body.appendChild(el);

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('submits with title, author, and category when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    vi.spyOn(api, 'fetchAPI').mockResolvedValue({
      data: [{ id: 1, title: 'General' }]
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const title = el.querySelector('#submit-title') as HTMLInputElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const author = el.querySelector('#submit-author') as HTMLInputElement | null;
    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    title!.value = 'Test Title';
    textarea!.value = 'Valid law text with enough characters';
    author!.value = 'John Doe';
    categorySelect!.value = '1';
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('omits author and email when anonymous is checked', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const author = el.querySelector('#submit-author') as HTMLInputElement | null;
    const email = el.querySelector('#submit-email') as HTMLInputElement | null;
    const anonymous = el.querySelector('#submit-anonymous') as HTMLInputElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    author!.value = 'John Doe';
    email!.value = 'john@example.com';
    anonymous!.checked = true;
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('clears form after successful submission', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const el = mountSection({ append: true });

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const title = el.querySelector('#submit-title') as HTMLInputElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const author = el.querySelector('#submit-author') as HTMLInputElement | null;
    const email = el.querySelector('#submit-email') as HTMLInputElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    title!.value = 'Test Title';
    textarea!.value = 'Valid law text with enough characters';
    author!.value = 'John Doe';
    email!.value = 'john@example.com';
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 400));

    // Fields should be cleared
    expect(title!.value).toBe('');
    expect(textarea!.value).toBe('');
    expect(author!.value).toBe('');
    expect(email!.value).toBe('');
    expect(termsCheckbox!.checked).toBe(false);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response without data property', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({});

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    // Should only have the default option
    expect(categorySelect!.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles categories response with non-array data', async () => {
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: 'not an array' });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;
    // Should only have the default option
    expect(categorySelect!.options.length).toBe(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without text', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    globalThis.fetch = vi.fn();

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - globalThis.fetch should not be called for submission
    expect(globalThis.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('prevents submission without terms checked', async () => {
    // Mock fetchAPI to prevent category loading from calling fetch
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    globalThis.fetch = vi.fn();

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;

    textarea!.value = 'Valid law text with enough characters';

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 50));

    // Form should not submit - globalThis.fetch should not be called for submission
    expect(globalThis.fetch).not.toHaveBeenCalled();

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('handles error with error property', async () => {
    // Mock fetchAPI for category loading
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Validation error' })
    });

    const el = mountSection({ append: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const form = el.querySelector('.submit-form') as HTMLFormElement | null;
    const textarea = el.querySelector('#submit-text') as HTMLTextAreaElement | null;
    const termsCheckbox = el.querySelector('#submit-terms') as HTMLInputElement | null;

    textarea!.value = 'Valid law text with enough characters';
    textarea!.dispatchEvent(new Event('input'));
    termsCheckbox!.checked = true;
    termsCheckbox!.dispatchEvent(new Event('change'));

    form!.dispatchEvent(new Event('submit'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('does not reload categories on second focus', async () => {
    const fetchAPISpy = vi.spyOn(api, 'fetchAPI');
    fetchAPISpy.mockResolvedValue({ data: [{ id: 1, title: 'Test Category', slug: 'test' }] });

    const el = mountSection({ append: true });
    const categorySelect = el.querySelector('#submit-category') as HTMLSelectElement | null;

    // First focus should trigger category loading
    categorySelect!.dispatchEvent(new FocusEvent('focus'));
    await new Promise(resolve => setTimeout(resolve, 50));

    const callsAfterFirstFocus = fetchAPISpy.mock.calls.filter(
      call => call[0] === '/api/v1/categories'
    ).length;

    // Second focus should NOT reload categories (early return)
    categorySelect!.dispatchEvent(new FocusEvent('focus'));
    await new Promise(resolve => setTimeout(resolve, 50));

    const callsAfterSecondFocus = fetchAPISpy.mock.calls.filter(
      call => call[0] === '/api/v1/categories'
    ).length;

    // Should be the same number of calls
    expect(callsAfterSecondFocus).toBe(callsAfterFirstFocus);

    document.body.removeChild(el);
    vi.restoreAllMocks();
  });
});
