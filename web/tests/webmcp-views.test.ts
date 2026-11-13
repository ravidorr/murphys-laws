import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CleanableElement } from '../src/types/app.d.ts';
import type { WebMcpTool } from '../src/utils/webmcp.ts';

// Partial mock: the home page's Trending widget needs the real fetchTrending
vi.mock('../src/utils/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/api.js')>()),
  fetchTrending: vi.fn(() => new Promise(() => {})),
}));

import { renderHome } from '../src/views/home.ts';
import { DailyEmailSignup } from '../src/components/daily-email-signup.ts';
import { Header } from '../src/components/header.ts';
import { AdvancedSearch } from '../src/components/advanced-search.ts';
import { SubmitLawSection } from '../src/components/submit-law.ts';
import { Calculator } from '../src/views/sods-calculator.ts';
import { ButteredToastCalculator } from '../src/views/buttered-toast-calculator.ts';
import { SodCalculatorSimple } from '../src/components/sod-calculator-simple.ts';

const live = new Map<string, { tool: WebMcpTool; signal: AbortSignal }>();

beforeEach(() => {
  live.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool: (tool: WebMcpTool, options: { signal: AbortSignal }) => {
        live.set(tool.name, { tool, signal: options.signal });
        return Promise.resolve();
      },
    },
  });
});

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).modelContext;
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** Every tool goes away when the router runs the cleanup of the element that offered it. */
function expectRemovedOnCleanup(toolName: string, owner: Element | null): void {
  const { signal } = live.get(toolName)!;
  expect(signal.aborted).toBe(false);
  (owner as CleanableElement).cleanup!();
  expect(signal.aborted).toBe(true);
}

describe('search_laws is offered by the header, which is on every page', () => {
  it('drives the header search form and is removed with the header', async () => {
    const onSearch = vi.fn();
    const header = Header({ onSearch, onNavigate: vi.fn() });
    document.body.append(header);

    const result = await live.get('search_laws')!.tool.execute({ query: 'toast' });
    expect(result).toMatchObject({ success: true, query: 'toast' });
    expect(header.querySelector<HTMLInputElement>('#header-search')!.value).toBe('toast');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSearch).toHaveBeenCalledWith({ q: 'toast' }, 'header');

    expectRemovedOnCleanup('search_laws', header);
  });

  it('is not registered a second time by the home page search form', () => {
    renderHome(document.createElement('div'), null, [], vi.fn(), vi.fn());
    expect(live.has('search_laws')).toBe(false);
  });
});

describe('WebMCP on the home page', () => {
  it('registers subscribe_daily_email and calculate_sods_law, each removed with its section', () => {
    const el = document.createElement('div');
    renderHome(el, null, [], vi.fn());

    expectRemovedOnCleanup('subscribe_daily_email', el.querySelector('[data-home-zone="daily-email"]'));
    expect(live.has('calculate_sods_law')).toBe(true);
    expectRemovedOnCleanup('calculate_sods_law', el.querySelector('.sod-simple-score')!.closest('section'));
  });
});

describe('WebMCP on the home page calculator widget', () => {
  it('leaves the sliders alone when the tool calculates', async () => {
    const widget = SodCalculatorSimple({ onNavigate: vi.fn() });
    document.body.append(widget);
    const before = widget.querySelector('#score-display')!.textContent;

    const result = await live.get('calculate_sods_law')!.tool.execute({
      urgency: 9, complexity: 9, importance: 9, skill: 1, frequency: 9,
    });

    expect(result).toMatchObject({ score: 8.6, probabilityPercent: 100, riskLevel: 'critical' });
    expect(widget.querySelector('#score-display')!.textContent).toBe(before);
    expect(widget.querySelector<HTMLInputElement>('#urgency')!.value).toBe('5');
  });
});

describe('WebMCP on the daily email component', () => {
  it('fills the real form but leaves submitting to the visitor', async () => {
    const section = DailyEmailSignup();
    document.body.replaceChildren(section);
    const input = section.querySelector<HTMLInputElement>('input[name="email"]')!;

    await live.get('subscribe_daily_email')!.tool.execute({ email: 'ann@example.com' });

    expect(input.value).toBe('ann@example.com');
    expect(document.activeElement).toBe(section.querySelector('button[type="submit"]'));
  });
});

describe('WebMCP on the advanced search', () => {
  it('registers filter_laws, which calls the component\'s onSearch, and removes it on cleanup', async () => {
    const onSearch = vi.fn();
    const search = AdvancedSearch({ onSearch });
    document.body.append(search);

    await live.get('filter_laws')!.tool.execute({ category_id: 8, query: 'gas' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSearch).toHaveBeenCalledWith({ q: 'gas', category_id: 8 });

    expectRemovedOnCleanup('filter_laws', search);
  });
});

describe('WebMCP on the submit-a-law form', () => {
  it('registers draft_law_submission, which fills the form and leaves the terms unticked', async () => {
    const section = SubmitLawSection();
    document.body.append(section);

    const result = await live.get('draft_law_submission')!.tool.execute({
      text: 'Whatever can go wrong will go wrong at the worst moment.',
      title: 'Murphy',
    });

    expect(result).toMatchObject({ success: true, status: 'awaiting_visitor' });
    expect(section.querySelector<HTMLTextAreaElement>('#submit-text')!.value).toContain('Whatever can go wrong');
    expect(section.querySelector<HTMLInputElement>('#submit-title')!.value).toBe('Murphy');
    expect(section.querySelector<HTMLInputElement>('#submit-terms')!.checked).toBe(false);
    expect(section.querySelector<HTMLButtonElement>('#submit-btn')!.disabled).toBe(true);

    expectRemovedOnCleanup('draft_law_submission', section);
  });
});

describe('WebMCP on the full calculators', () => {
  it('registers calculate_sods_law on the Sod\'s Law page and removes it on leaving', async () => {
    vi.useFakeTimers();
    try {
      const page = Calculator();
      document.body.append(page);
      const scoreBefore = page.querySelector('#score-value')!.textContent;

      const result = await live.get('calculate_sods_law')!.tool.execute({
        urgency: 1, complexity: 1, importance: 1, skill: 9, frequency: 1,
      });
      expect(result).toMatchObject({ riskLevel: 'low' });
      expect(page.querySelector('#score-value')!.textContent).toBe(scoreBefore);

      expectRemovedOnCleanup('calculate_sods_law', page);
    } finally {
      await vi.runAllTimersAsync();
      vi.useRealTimers();
    }
  });

  it('registers calculate_buttered_toast on the toast page and removes it on leaving', async () => {
    vi.useFakeTimers();
    try {
      const page = ButteredToastCalculator();
      document.body.append(page);
      const before = page.querySelector('#toast-probability-value')!.textContent;

      const result = await live.get('calculate_buttered_toast')!.tool.execute({
        height: 75, gravity: 980, overhang: 17, butter: 1.2, friction: 20, inertia: 350,
      });
      expect(result).toMatchObject({ probabilityPercent: 92, riskLevel: 'critical' });
      expect(page.querySelector('#toast-probability-value')!.textContent).toBe(before);

      expectRemovedOnCleanup('calculate_buttered_toast', page);
    } finally {
      await vi.runAllTimersAsync();
      vi.useRealTimers();
    }
  });
});
