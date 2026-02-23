import { describe, it, expect, vi } from 'vitest';
import { WhyMurphysLawFeelsTrue } from '../src/views/why-murphys-law-feels-true.js';
import * as structuredData from '../src/modules/structured-data.js';

vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive"
}));
vi.mock('../src/utils/ads.js', () => ({
  triggerAdSense: vi.fn()
}));

describe('WhyMurphysLawFeelsTrue view', () => {
  it('renders the article content', () => {
    const el = WhyMurphysLawFeelsTrue({ onNavigate: vi.fn() });
    expect(el.innerHTML).toContain('Universe');
  });

  it('sets structured data for the article', () => {
    WhyMurphysLawFeelsTrue({ onNavigate: vi.fn() });
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('why-murphys-law-feels-true-article', expect.objectContaining({
      '@type': 'Article',
      'headline': "Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)"
    }));
  });

  it('renders without onNavigate provided', () => {
    const el = WhyMurphysLawFeelsTrue();
    expect(el.innerHTML).toContain('Universe');
  });

  it('handles navigation click with data-nav attribute', () => {
    const onNavigate = vi.fn();
    const el = WhyMurphysLawFeelsTrue({ onNavigate });
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    navBtn.click();
    expect(onNavigate).toHaveBeenCalledWith('about');
  });

  it('ignores click when target has no data-nav', () => {
    const onNavigate = vi.fn();
    const el = WhyMurphysLawFeelsTrue({ onNavigate });
    const btn = document.createElement('button');
    el.appendChild(btn);
    btn.click();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores click when onNavigate not provided', () => {
    const el = WhyMurphysLawFeelsTrue();
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    expect(() => navBtn.click()).not.toThrow();
  });

  it('ignores click on non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    const el = WhyMurphysLawFeelsTrue({ onNavigate });
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
