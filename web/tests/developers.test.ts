import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Developers } from '../src/views/developers.js';
import * as api from '../src/utils/api.js';

vi.mock('../src/utils/api.js', () => ({
  fetchLaws: vi.fn()
}));

describe('Developers page', () => {
  beforeEach(() => {
    vi.mocked(api.fetchLaws).mockReset();
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [],
      total: 0,
      limit: 1,
      offset: 0
    });
  });

  it('renders developers page element with content-page class', () => {
    const el = Developers({ onNavigate: () => {} });
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
  });

  it('mentions the REST API, SDK, CLI, and MCP', () => {
    const el = Developers({ onNavigate: () => {} });
    expect(el.textContent).toMatch(/REST API/);
    expect(el.textContent).toMatch(/murphys-laws-sdk/);
    expect(el.textContent).toMatch(/murphys-laws-cli/);
    expect(el.textContent).toMatch(/murphys-laws-mcp/);
  });

  it('lists the current write rate limits in per-minute units', () => {
    const el = Developers({ onNavigate: () => {} });
    expect(el.textContent).toMatch(/3 per minute/);
    expect(el.textContent).toMatch(/30 per minute/);
  });

  it('documents the X-RateLimit headers', () => {
    const el = Developers({ onNavigate: () => {} });
    expect(el.textContent).toMatch(/X-RateLimit-Limit/);
    expect(el.textContent).toMatch(/X-RateLimit-Remaining/);
    expect(el.textContent).toMatch(/X-RateLimit-Reset/);
  });

  it('does not contain em dashes', () => {
    const el = Developers({ onNavigate: () => {} });
    expect(el.textContent).not.toMatch(/\u2014/);
  });

  it('is cleanable', () => {
    const el = Developers({ onNavigate: () => {} }) as HTMLDivElement & { cleanup?: () => void };
    expect(typeof el.cleanup).toBe('function');
    el.cleanup!();
  });

  it('ignores clicks without navigation targets', () => {
    let navigated = false;
    const el = Developers({ onNavigate: () => { navigated = true; } });
    el.click();
    expect(navigated).toBe(false);
  });

  it('ignores non-HTMLElement click targets', () => {
    let navigated = false;
    const el = Developers({ onNavigate: () => { navigated = true; } });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.appendChild(svg);

    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(navigated).toBe(false);
  });

  it('navigates when a data-nav target is clicked', () => {
    let target = '';
    const el = Developers({ onNavigate: (next) => { target = next; } });
    const button = document.createElement('button');
    button.setAttribute('data-nav', 'browse');
    el.appendChild(button);

    button.click();

    expect(target).toBe('browse');
  });

  it('ignores empty data-nav targets', () => {
    let navigated = false;
    const el = Developers({ onNavigate: () => { navigated = true; } });
    const button = document.createElement('button');
    button.setAttribute('data-nav', '');
    el.appendChild(button);

    button.click();

    expect(navigated).toBe(false);
  });

  it('updates the supplemental archive size when the API returns a finite total', async () => {
    vi.mocked(api.fetchLaws).mockResolvedValue({
      data: [],
      total: 12_345,
      limit: 1,
      offset: 0
    });

    const el = Developers({ onNavigate: () => {} });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-archive-size]')?.textContent).toBe('12,345 laws');
    });
  });

  it('keeps the archive-size fallback for invalid totals or missing placeholders', async () => {
    vi.mocked(api.fetchLaws).mockResolvedValueOnce({
      data: [],
      total: Number.NaN,
      limit: 1,
      offset: 0
    });
    const invalidTotalEl = Developers({ onNavigate: () => {} });
    await vi.waitFor(() => expect(api.fetchLaws).toHaveBeenCalledTimes(1));
    expect(invalidTotalEl.querySelector('[data-archive-size]')?.textContent).toBe('the full archive');

    vi.mocked(api.fetchLaws).mockResolvedValueOnce({
      data: [],
      total: 10,
      limit: 1,
      offset: 0
    });
    const missingPlaceholderEl = Developers({ onNavigate: () => {} });
    missingPlaceholderEl.querySelector('[data-archive-size]')?.remove();
    await vi.waitFor(() => expect(api.fetchLaws).toHaveBeenCalledTimes(2));
  });

  it('keeps the archive-size fallback when the API request fails', async () => {
    vi.mocked(api.fetchLaws).mockRejectedValue(new Error('offline'));

    const el = Developers({ onNavigate: () => {} });

    await vi.waitFor(() => expect(api.fetchLaws).toHaveBeenCalled());
    expect(el.querySelector('[data-archive-size]')?.textContent).toBe('the full archive');
  });
});
