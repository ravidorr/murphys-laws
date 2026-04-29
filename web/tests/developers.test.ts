import { describe, it, expect } from 'vitest';
import { Developers } from '../src/views/developers.js';

describe('Developers page', () => {
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
});
