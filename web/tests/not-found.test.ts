import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const fetchTopVoted = vi.fn();
vi.mock('../src/utils/api.ts', () => ({ fetchTopVoted: (n: number) => fetchTopVoted(n) }));

import { NotFound } from '../src/views/not-found.js';
import { NOT_FOUND_LINES } from '../src/utils/not-found-lines.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('NotFound view', () => {
  beforeEach(() => {
    fetchTopVoted.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the code, heading, and description', () => {
    fetchTopVoted.mockReturnValue(new Promise(() => undefined));
    const el = NotFound();

    expect(el.querySelector('.not-found-code')?.textContent).toBe('404');
    expect(el.querySelector('h1')?.textContent).toMatch(/Page Not Found/);
    expect(el.textContent).toMatch(/could not be found/i);
  });

  it('shows one of the shared funny lines', () => {
    fetchTopVoted.mockReturnValue(new Promise(() => undefined));
    const el = NotFound();

    expect(NOT_FOUND_LINES).toContain(el.querySelector('.not-found-quote')!.textContent);
  });

  it('keeps the law section hidden until laws load', () => {
    fetchTopVoted.mockReturnValue(new Promise(() => undefined));
    const el = NotFound();

    expect(el.querySelector('.not-found-laws-section')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows suggested laws once loaded', async () => {
    fetchTopVoted.mockResolvedValue({ data: [{ id: 3, text: 'Anything can fail.' }] });
    const el = NotFound();
    await flush();

    expect(fetchTopVoted).toHaveBeenCalledWith(3);
    expect(el.querySelector('.not-found-laws-section')!.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('.not-found-law a')!.getAttribute('href')).toBe('/law/3');
  });

  it('keeps the section hidden when the API returns no laws', async () => {
    fetchTopVoted.mockResolvedValue({ data: [] });
    const el = NotFound();
    await flush();

    expect(el.querySelector('.not-found-laws-section')!.hasAttribute('hidden')).toBe(true);
  });

  it('keeps the section hidden when the API fails', async () => {
    fetchTopVoted.mockRejectedValue(new Error('down'));
    const el = NotFound();
    await flush();

    expect(el.querySelector('.not-found-laws-section')!.hasAttribute('hidden')).toBe(true);
  });
});
