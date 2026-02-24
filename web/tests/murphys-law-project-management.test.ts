import { describe, it, expect, vi } from 'vitest';
import { MurphysLawProjectManagement } from '../src/views/murphys-law-project-management.js';
import * as structuredData from '../src/modules/structured-data.js';

vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive"
}));
vi.mock('../src/utils/ads.js', () => ({
  triggerAdSense: vi.fn()
}));

describe('MurphysLawProjectManagement view', () => {
  it('renders the article content', () => {
    const el = MurphysLawProjectManagement({ onNavigate: vi.fn() });
    expect(el.innerHTML).toContain('Survival Guide');
  });

  it('sets structured data for the article', () => {
    MurphysLawProjectManagement({ onNavigate: vi.fn() });
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('murphys-law-project-management-article', expect.objectContaining({
      '@type': 'Article',
      'headline': "Project Management vs. The Universe: A Survival Guide"
    }));
  });

  it('renders without onNavigate provided', () => {
    const el = MurphysLawProjectManagement();
    expect(el.innerHTML).toContain('Survival Guide');
  });

  it('L54 B1: navTarget truthy calls onNavigate', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'origin-story');
    el.appendChild(navBtn);
    navBtn.click();
    expect(onNavigate).toHaveBeenCalledWith('origin-story');
  });

  it('handles navigation click with data-nav attribute', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'origin-story');
    el.appendChild(navBtn);
    navBtn.click();
    expect(onNavigate).toHaveBeenCalledWith('origin-story');
  });

  it('ignores click when target has no data-nav', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const btn = document.createElement('button');
    el.appendChild(btn);
    btn.click();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores click when onNavigate not provided', () => {
    const el = MurphysLawProjectManagement();
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    expect(() => navBtn.click()).not.toThrow();
  });

  it('ignores click on non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
