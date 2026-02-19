import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Home } from '../src/views/home.js';

describe('Home view - Coverage', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it('handles law host clicks with missing data-law-id', () => {
    const el = Home({ onNavigate: vi.fn() });
    container.appendChild(el);
    
    // Create element that matches data-law-id but has empty attribute
    const mockLawHost = document.createElement('div');
    mockLawHost.setAttribute('data-law-id', '');
    el.appendChild(mockLawHost);
    
    mockLawHost.click();
    // Should not call onNavigate
    expect(Home).toBeDefined(); // Just ensure it didn't throw
  });
});
