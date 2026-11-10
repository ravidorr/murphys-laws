import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LawDetail } from '../src/views/law-detail.ts';
import * as metricsModule from '../src/utils/metrics.ts';

const parentLaw = {
  id: 5,
  title: 'The Start-Stop Synchronicity',
  text: 'A red traffic light will turn green one second after the engine switches itself off.',
  upvotes: 3,
  downvotes: 0,
  category_slug: 'cars',
  category_name: 'Cars',
  corollaries: [
    { id: 11, title: 'The Ignition Corollary', text: 'The restart always feels twice as long with a horn behind you.', upvotes: 4, downvotes: 1 },
    { id: 12, title: 'Corollary', text: 'The light stays green just long enough to miss it.', upvotes: 0, downvotes: 0 }
  ],
  corollary_of: null
};

const corollaryLaw = {
  id: 11,
  title: 'Corollary',
  text: 'The restart always feels twice as long with a horn behind you.',
  upvotes: 4,
  downvotes: 1,
  category_slug: 'cars',
  category_name: 'Cars',
  corollaries: [],
  corollary_of: { id: 5, title: 'The Start-Stop Synchronicity', text: parentLaw.text }
};

function mockApi(law: unknown): void {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes('/related')) return { ok: true, json: async () => ({ data: [] }) };
    if (String(url).includes('/vote')) return { ok: true, json: async () => ({ upvotes: 5, downvotes: 1 }) };
    return { ok: true, json: async () => law };
  });
}

function voteRequests(): string[] {
  return vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0])).filter((url) => url.includes('/vote'));
}

async function mount(law: unknown, onNavigate = vi.fn()): Promise<{ el: HTMLElement; onNavigate: ReturnType<typeof vi.fn> }> {
  mockApi(law);
  const el = LawDetail({ lawId: String((law as { id: number }).id), onNavigate });
  document.body.appendChild(el);
  await vi.waitFor(() => expect(el.querySelector('[data-law-card-root]')).toBeTruthy(), { timeout: 1000 });
  return { el, onNavigate };
}

describe('LawDetail corollaries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('lists the corollaries from the law response above related laws, with no extra request', async () => {
    const { el } = await mount(parentLaw);

    const section = el.querySelector('section.corollary-list') as HTMLElement;
    expect(section).toBeTruthy();
    expect(section.querySelectorAll('.corollary-card')).toHaveLength(2);
    expect(section.querySelector('.corollary-list-count')?.textContent).toBe('2 consequences of this law');
    const titles = [...section.querySelectorAll('.corollary-card-title a')].map((a) => a.textContent);
    expect(titles).toEqual(['The Ignition Corollary', 'The light stays green just long enough to miss it']);

    const related = el.querySelector('[data-related-laws]') as HTMLElement;
    expect(section.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const urls = vi.mocked(globalThis.fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes('corollar'))).toEqual([]);
  });

  it('renders no section and no banner for a law without corollaries', async () => {
    const { el } = await mount({ ...parentLaw, corollaries: [] });
    expect(el.querySelector('.corollary-list')).toBeNull();
    expect(el.querySelector('.parent-banner')).toBeNull();
  });

  it('renders no section when an older API response has no corollary fields', async () => {
    const { el } = await mount({ id: 9, title: 'Plain', text: 'A plain law with no corollary fields at all.' });
    expect(el.querySelector('.corollary-list')).toBeNull();
    expect(el.querySelector('.parent-banner')).toBeNull();
  });

  it('opens a corollary in the app and records the click', async () => {
    const track = vi.spyOn(metricsModule, 'trackProductEvent');
    const { el, onNavigate } = await mount(parentLaw);

    const link = el.querySelector('.corollary-card-title a') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('law', '11');
    expect(track).toHaveBeenCalledWith('law.corollary_click', { surface: 'law_detail' });
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }]
  ])('leaves a %s-click on a corollary to the browser', async (_name, init) => {
    const track = vi.spyOn(metricsModule, 'trackProductEvent');
    const { el, onNavigate } = await mount(parentLaw);

    const link = el.querySelector('.corollary-card-title a') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('law.corollary_click', expect.anything());
  });

  it('votes on a corollary without voting on the parent', async () => {
    const { el } = await mount(parentLaw);

    const card = el.querySelector('.corollary-card[data-law-id="11"]') as HTMLElement;
    (card.querySelector('button[data-vote="up"]') as HTMLButtonElement).click();

    await vi.waitFor(() => expect(card.querySelector('[data-vote="up"] .count-num')?.textContent).toBe('5'));
    expect(card.querySelector('[data-vote="up"]')?.classList.contains('voted')).toBe(true);
    expect(voteRequests()).toEqual(['/api/v1/laws/11/vote']);
    expect(el.querySelector('[data-law-card-root] [data-upvote-count]')?.textContent).toBe('3');
  });

  it('does not stack vote listeners when the law renders again', async () => {
    const { el } = await mount(parentLaw);

    // A retry renders the law again into the same view
    const before = el.querySelector('.corollary-card');
    mockApi(parentLaw);
    const retry = document.createElement('button');
    retry.setAttribute('data-action', 'retry-law');
    el.appendChild(retry);
    retry.click();
    await vi.waitFor(() => expect(el.querySelector('.corollary-card')).not.toBe(before));
    expect(el.querySelectorAll('.corollary-card')).toHaveLength(2);

    (el.querySelector('.corollary-card button[data-vote="up"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(voteRequests().length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(voteRequests()).toHaveLength(1);
  });

  it('shows the parent banner and a breadcrumb through the parent on a corollary page', async () => {
    const { el } = await mount(corollaryLaw);

    expect(el.querySelector('.corollary-list')).toBeNull();
    const banner = el.querySelector('a.parent-banner') as HTMLAnchorElement;
    expect(banner.getAttribute('href')).toBe('/law/5');
    expect(banner.textContent).toContain('Corollary of');
    expect(banner.textContent).toContain('The Start-Stop Synchronicity');

    const crumbs = [...el.querySelectorAll('#law-breadcrumb .breadcrumb-item')].map((item) => item.textContent?.replace('›', '').trim());
    expect(crumbs).toEqual(['Home', 'Browse', 'Cars', 'The Start-Stop Synchronicity', 'The restart always feels twice as long with a horn behind you']);
    const parentCrumb = el.querySelector('#law-breadcrumb a[data-param="5"]') as HTMLAnchorElement;
    expect(parentCrumb.getAttribute('href')).toBe('/law/5');
    expect(el.querySelector('#law-breadcrumb [aria-current="page"]')?.textContent).toBe('The restart always feels twice as long with a horn behind you');
  });

  it('opens the parent from the banner without recording a corollary click', async () => {
    const track = vi.spyOn(metricsModule, 'trackProductEvent');
    const { el, onNavigate } = await mount(corollaryLaw);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    (el.querySelector('a.parent-banner') as HTMLAnchorElement).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('law', '5');
    expect(track).not.toHaveBeenCalledWith('law.corollary_click', expect.anything());
  });

  it('keeps the ordinary breadcrumb for a law that is not a corollary', async () => {
    const { el } = await mount(parentLaw);
    const crumbs = [...el.querySelectorAll('#law-breadcrumb .breadcrumb-item')].map((item) => item.textContent?.replace('›', '').trim());
    expect(crumbs).toEqual(['Home', 'Browse', 'Cars', 'The Start-Stop Synchronicity']);
  });

  it.each([
    ['Home', ['home', undefined]],
    ['Browse', ['browse', undefined]],
    ['Cars', ['category', 'cars']]
  ])('opens %s once from the breadcrumb', async (label, expected) => {
    const { el, onNavigate } = await mount(parentLaw);
    const crumb = [...el.querySelectorAll('#law-breadcrumb a')].find((a) => a.textContent?.replace('›', '').trim() === label) as HTMLAnchorElement;
    crumb.click();
    expect(onNavigate.mock.calls).toEqual([expected]);
  });

  it('opens the parent once from its breadcrumb link', async () => {
    const { el, onNavigate } = await mount(corollaryLaw);
    (el.querySelector('#law-breadcrumb a[data-param="5"]') as HTMLAnchorElement).click();
    expect(onNavigate.mock.calls).toEqual([['law', '5']]);
  });
});
