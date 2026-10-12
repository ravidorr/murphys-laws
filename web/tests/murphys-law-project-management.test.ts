import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MurphysLawProjectManagement } from '../src/views/murphys-law-project-management.js';
import * as structuredData from '../src/modules/structured-data.js';
import * as exportContext from '../src/utils/export-context.js';
import * as api from '../src/utils/api.js';

vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/constants.js', async (importOriginal) => ({
  ...(await importOriginal() as Record<string, unknown>),
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive"
}));
vi.mock('../src/utils/ads.js', () => ({
  triggerAdSense: vi.fn()
}));

describe('MurphysLawProjectManagement view', () => {
  beforeEach(() => {
    vi.spyOn(api, 'fetchLaws').mockResolvedValue({
      data: [{ id: 31, text: 'The first 90% of a project takes 90% of the time.', upvotes: 4, downvotes: 0 }],
      total: 1,
      limit: 3,
      offset: 0
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the article content', () => {
    const el = MurphysLawProjectManagement({ onNavigate: vi.fn() });
    expect(el.innerHTML).toContain('Survival Guide');
  });

  it('adds office-law archive links and opens featured laws by their data-param id', async () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });

    expect(el.querySelector('.article-next-steps a.btn.primary')?.getAttribute('href')).toBe('/category/murphys-office-laws');
    await vi.waitFor(() => {
      expect(el.querySelector('.article-featured-laws a.law-card-link')).not.toBeNull();
    });
    el.querySelector<HTMLAnchorElement>('.article-featured-laws a.law-card-link')!.click();

    expect(onNavigate).toHaveBeenCalledWith('law', '31');
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

  it('does not navigate when the navigation target is empty', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const navBtn = document.createElement('a');
    navBtn.setAttribute('data-nav', '');
    el.appendChild(navBtn);

    navBtn.click();

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores click on non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    const el = MurphysLawProjectManagement({ onNavigate });
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('clears registered export content during cleanup', () => {
    const clearExportContent = vi.spyOn(exportContext, 'clearExportContent');
    const el = MurphysLawProjectManagement() as HTMLDivElement & { cleanup: () => void };

    el.cleanup();

    expect(clearExportContent).toHaveBeenCalledOnce();
  });
});
