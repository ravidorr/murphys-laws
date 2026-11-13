import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerWebMcpTool, type WebMcpTool } from '../src/utils/webmcp.ts';
import {
  registerButteredToastTool,
  registerDailyEmailTool,
  registerDraftLawTool,
  registerFilterLawsTool,
  registerSearchLawsTool,
  registerSodsLawTool,
} from '../src/utils/webmcp-tools.ts';

interface Registration {
  tool: WebMcpTool;
  signal: AbortSignal;
}

const live = new Map<string, Registration>();
const registerTool = vi.fn();

function installModelContext(): void {
  Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } });
}

function removeModelContext(): void {
  delete (document as unknown as Record<string, unknown>).modelContext;
}

function makeTool(name: string): WebMcpTool {
  return {
    name,
    title: name,
    description: `Tool ${name}`,
    inputSchema: { type: 'object', properties: {} },
    execute: () => ({ success: true }),
  };
}

beforeEach(() => {
  live.clear();
  registerTool.mockReset();
  registerTool.mockImplementation((tool: WebMcpTool, options: { signal: AbortSignal }) => {
    live.set(tool.name, { tool, signal: options.signal });
    return Promise.resolve();
  });
  installModelContext();
});

afterEach(() => {
  removeModelContext();
  vi.restoreAllMocks();
});

describe('registerWebMcpTool', () => {
  it('does nothing where the browser has no WebMCP', () => {
    removeModelContext();
    const unregister = registerWebMcpTool(makeTool('a'));
    expect(registerTool).not.toHaveBeenCalled();
    expect(() => unregister()).not.toThrow();
  });

  it('does nothing when modelContext has no registerTool', () => {
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {} });
    expect(() => registerWebMcpTool(makeTool('a'))()).not.toThrow();
    expect(registerTool).not.toHaveBeenCalled();
  });

  it('registers the tool with an abort signal and removes it on unregister', () => {
    const tool = makeTool('a');
    const unregister = registerWebMcpTool(tool);
    const { signal } = live.get('a')!;
    expect(live.get('a')!.tool).toBe(tool);
    expect(signal.aborted).toBe(false);
    unregister();
    expect(signal.aborted).toBe(true);
  });

  it('replaces an earlier registration of the same name', () => {
    const first = registerWebMcpTool(makeTool('a'));
    const firstSignal = live.get('a')!.signal;
    registerWebMcpTool(makeTool('a'));
    const secondSignal = live.get('a')!.signal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
    // The stale handle must not take the newer registration down with it
    first();
    expect(secondSignal.aborted).toBe(false);
  });

  it('keeps tools with different names apart', () => {
    const a = registerWebMcpTool(makeTool('a'));
    registerWebMcpTool(makeTool('b'));
    a();
    expect(live.get('a')!.signal.aborted).toBe(true);
    expect(live.get('b')!.signal.aborted).toBe(false);
  });

  it('allows the same name again after unregistering', () => {
    registerWebMcpTool(makeTool('a'))();
    registerWebMcpTool(makeTool('a'));
    expect(live.get('a')!.signal.aborted).toBe(false);
  });

  it('warns and drops the tool when registration is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('InvalidStateError');
    registerTool.mockImplementation((tool: WebMcpTool, options: { signal: AbortSignal }) => {
      live.set(tool.name, { tool, signal: options.signal });
      return Promise.reject(error);
    });
    registerWebMcpTool(makeTool('a'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith('WebMCP tool "a" was not registered', error);
    expect(live.get('a')!.signal.aborted).toBe(true);
  });

  it('warns when registerTool throws, and returns a usable handle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('SecurityError');
    registerTool.mockImplementation(() => {
      throw error;
    });
    const unregister = registerWebMcpTool(makeTool('a'));
    expect(warn).toHaveBeenCalledWith('WebMCP tool "a" was not registered', error);
    expect(() => unregister()).not.toThrow();
  });

  it('accepts a registerTool that returns nothing', () => {
    registerTool.mockImplementation((tool: WebMcpTool, options: { signal: AbortSignal }) => {
      live.set(tool.name, { tool, signal: options.signal });
    });
    expect(() => registerWebMcpTool(makeTool('a'))).not.toThrow();
  });
});

describe('search_laws tool', () => {
  let form: HTMLFormElement;
  let field: HTMLInputElement;
  let submitted: Event | null;

  beforeEach(() => {
    form = document.createElement('form');
    field = document.createElement('input');
    form.append(field);
    submitted = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = event;
    });
    registerSearchLawsTool(form, field);
  });

  it('is described as read-only and requires a query', () => {
    const { tool } = live.get('search_laws')!;
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.inputSchema.required).toEqual(['query']);
    expect(tool.description).toMatch(/read-only/i);
  });

  it('fills the field and submits the page form', async () => {
    const result = await live.get('search_laws')!.tool.execute({ query: '  toast  ' });
    expect(field.value).toBe('toast');
    expect(result).toMatchObject({ success: true, query: 'toast' });
    // The submit runs after execute has returned, so the router cannot remove the tool mid-call
    expect(submitted).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submitted).not.toBeNull();
  });

  it.each([{}, { query: '   ' }, { query: 5 }])('rejects a missing query: %j', async (input) => {
    const result = await live.get('search_laws')!.tool.execute(input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result).toEqual({ error: 'query is required' });
    expect(submitted).toBeNull();
  });
});

describe('subscribe_daily_email tool', () => {
  let form: HTMLFormElement;
  let field: HTMLInputElement;
  let button: HTMLButtonElement;
  let submitted: boolean;

  beforeEach(() => {
    form = document.createElement('form');
    field = document.createElement('input');
    field.type = 'email';
    field.required = true;
    button = document.createElement('button');
    button.type = 'submit';
    form.append(field, button);
    document.body.replaceChildren(form);
    submitted = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    registerDailyEmailTool(form, field);
  });

  it('declares that it changes state and tells the agent the visitor must submit', () => {
    const { tool } = live.get('subscribe_daily_email')!;
    expect(tool.annotations).toEqual({ readOnlyHint: false });
    expect(tool.inputSchema.required).toEqual(['email']);
    expect(tool.description).toMatch(/does not submit/i);
    expect(tool.description).toMatch(/visitor must press Subscribe/);
  });

  it('enters the address and focuses Subscribe without submitting', async () => {
    const result = await live.get('subscribe_daily_email')!.tool.execute({ email: ' ann@example.com ' });
    expect(field.value).toBe('ann@example.com');
    expect(document.activeElement).toBe(button);
    expect(submitted).toBe(false);
    expect(result).toMatchObject({ success: true, status: 'awaiting_visitor' });
  });

  it('never overwrites an address the visitor already typed', async () => {
    field.value = 'visitor@example.com';
    const result = await live.get('subscribe_daily_email')!.tool.execute({ email: 'agent@example.com' });
    expect(result).toEqual({ error: 'the form already has an address the visitor typed; ask them first' });
    expect(field.value).toBe('visitor@example.com');
    expect(document.activeElement).not.toBe(button);
  });

  it('accepts the address that is already in the field', async () => {
    field.value = 'ann@example.com';
    const result = await live.get('subscribe_daily_email')!.tool.execute({ email: 'ann@example.com' });
    expect(result).toMatchObject({ success: true, status: 'awaiting_visitor' });
  });

  it('still succeeds when the form has no Subscribe button', async () => {
    button.remove();
    const result = await live.get('subscribe_daily_email')!.tool.execute({ email: 'ann@example.com' });
    expect(result).toMatchObject({ success: true });
  });

  it.each([{}, { email: '' }, { email: 42 }])('rejects a missing address: %j', async (input) => {
    const result = await live.get('subscribe_daily_email')!.tool.execute(input);
    expect(result).toEqual({ error: 'email is required' });
  });

  it.each([['not-an-address'], [`${'a'.repeat(250)}@example.com`]])(
    'rejects an address the form would not accept and leaves the field alone: %s',
    async (email) => {
      field.value = 'visitor@example.com';
      const result = await live.get('subscribe_daily_email')!.tool.execute({ email });
      expect(result).toEqual({ error: 'email is not a valid address' });
      expect(field.value).toBe('visitor@example.com');
      expect(document.activeElement).not.toBe(button);
      expect(submitted).toBe(false);
    }
  );
});

describe('calculator tools', () => {
  const sodsInput = { urgency: 5, complexity: 5, importance: 5, skill: 5, frequency: 5 };
  const toastInput = { height: 75, gravity: 980, overhang: 5, butter: 1.2, friction: 20, inertia: 350 };

  it('calculate_sods_law matches the page and declares itself a pure calculation', async () => {
    registerSodsLawTool();
    const { tool } = live.get('calculate_sods_law')!;
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.description).toMatch(/pure calculation/i);
    expect(tool.inputSchema.required).toEqual(['urgency', 'complexity', 'importance', 'skill', 'frequency']);
    expect(Object.keys(tool.inputSchema.properties as object)).toHaveLength(5);

    expect(await tool.execute(sodsInput)).toEqual({
      score: 5.04,
      probabilityPercent: 59,
      riskLevel: 'elevated',
      interpretation: 'Definitely worrying. Proceed with caution.',
      inputs: sodsInput,
    });
  });

  it('calculate_buttered_toast matches the page', async () => {
    registerButteredToastTool();
    const { tool } = live.get('calculate_buttered_toast')!;
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.inputSchema.required).toHaveLength(6);

    expect(await tool.execute(toastInput)).toEqual({
      probabilityPercent: 27,
      riskLevel: 'elevated',
      interpretation: "It's a toss-up. May the odds be ever in your favor.",
      inputs: toastInput,
    });
  });

  it.each([
    ['a missing rating', { ...sodsInput, urgency: undefined }, 'urgency must be a number from 1 to 9'],
    ['a string', { ...sodsInput, skill: '5' }, 'skill must be a number from 1 to 9'],
    ['NaN', { ...sodsInput, frequency: Number.NaN }, 'frequency must be a number from 1 to 9'],
    ['too low', { ...sodsInput, complexity: 0 }, 'complexity must be a number from 1 to 9'],
    ['too high', { ...sodsInput, importance: 10 }, 'importance must be a number from 1 to 9'],
  ])('calculate_sods_law rejects %s', async (_name, input, error) => {
    registerSodsLawTool();
    expect(await live.get('calculate_sods_law')!.tool.execute(input)).toEqual({ error });
  });

  it('calculate_buttered_toast rejects a value outside the slider range', async () => {
    registerButteredToastTool();
    expect(await live.get('calculate_buttered_toast')!.tool.execute({ ...toastInput, gravity: 100 })).toEqual({
      error: 'gravity must be a number from 162 to 2479',
    });
  });
});

describe('filter_laws tool', () => {
  const onSearch = vi.fn();

  beforeEach(() => {
    onSearch.mockClear();
    vi.useFakeTimers();
    registerFilterLawsTool(onSearch);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is read-only and runs the page\'s own search callback after execute returns', async () => {
    const { tool } = live.get('filter_laws')!;
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    const result = await tool.execute({ query: ' gas ', category_id: 7, attribution: ' Anonymous ' });
    expect(result).toMatchObject({ success: true, filters: { q: 'gas', category_id: 7, attribution: 'Anonymous' } });
    expect(onSearch).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onSearch).toHaveBeenCalledWith({ q: 'gas', category_id: 7, attribution: 'Anonymous' });
  });

  it('accepts a single filter', async () => {
    await live.get('filter_laws')!.tool.execute({ category_id: 3 });
    vi.runAllTimers();
    expect(onSearch).toHaveBeenCalledWith({ category_id: 3 });
  });

  it.each([[0], [-2], [1.5], ['3']])('rejects category_id %j', async (category_id) => {
    const result = await live.get('filter_laws')!.tool.execute({ category_id });
    expect(result).toEqual({ error: 'category_id must be a whole number of 1 or more' });
    vi.runAllTimers();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('asks for at least one filter', async () => {
    const result = await live.get('filter_laws')!.tool.execute({ query: '  ' });
    expect(result).toEqual({ error: 'give at least one of query, category_id or attribution' });
    vi.runAllTimers();
    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe('draft_law_submission tool', () => {
  const LAW = 'Whatever can go wrong will go wrong at the worst moment.';
  let fields: {
    text: HTMLTextAreaElement;
    title: HTMLInputElement;
    author: HTMLInputElement;
    category: HTMLSelectElement;
    terms: HTMLInputElement;
  };
  let inputEvents: number;
  let changeEvents: number;
  let submitted: boolean;

  beforeEach(() => {
    const form = document.createElement('form');
    fields = {
      text: document.createElement('textarea'),
      title: document.createElement('input'),
      author: document.createElement('input'),
      category: document.createElement('select'),
      terms: Object.assign(document.createElement('input'), { type: 'checkbox' }),
    };
    fields.category.add(new Option('Select a category', ''));
    fields.category.add(new Option('Computers', '8'));
    form.append(fields.text, fields.title, fields.author, fields.category, fields.terms);
    document.body.replaceChildren(form);
    inputEvents = 0;
    changeEvents = 0;
    submitted = false;
    fields.text.addEventListener('input', () => inputEvents++);
    fields.category.addEventListener('change', () => changeEvents++);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    registerDraftLawTool(fields);
  });

  const execute = (input: Record<string, unknown>) => live.get('draft_law_submission')!.tool.execute(input);

  it('declares that it changes the page and leaves the consent to the visitor', () => {
    const { tool } = live.get('draft_law_submission')!;
    expect(tool.annotations).toEqual({ readOnlyHint: false });
    expect(tool.inputSchema.required).toEqual(['text']);
    expect(tool.description).toMatch(/does not submit and does not accept the terms/);
  });

  it('fills the form, fires the input and change events, and never accepts the terms or submits', async () => {
    const result = await execute({ text: ` ${LAW} `, title: 'Murphy', author: 'Ann', category_id: 8 });
    expect(result).toMatchObject({ success: true, status: 'awaiting_visitor' });
    expect(fields.text.value).toBe(LAW);
    expect(fields.title.value).toBe('Murphy');
    expect(fields.author.value).toBe('Ann');
    expect(fields.category.value).toBe('8');
    expect(inputEvents).toBe(1);
    expect(changeEvents).toBe(1);
    expect(fields.terms.checked).toBe(false);
    expect(document.activeElement).toBe(fields.terms);
    expect(submitted).toBe(false);
  });

  it('needs only the text', async () => {
    await execute({ text: LAW });
    expect(fields.text.value).toBe(LAW);
    expect(fields.title.value).toBe('');
    expect(fields.category.value).toBe('');
    expect(changeEvents).toBe(0);
  });

  it.each([[{}], [{ text: 'too short' }], [{ text: 'x'.repeat(1001) }], [{ text: 42 }]])('rejects bad text %j', async (input) => {
    expect(await execute(input)).toEqual({ error: 'text must be 10 to 1000 characters' });
    expect(fields.text.value).toBe('');
  });

  it('may fill the same text again', async () => {
    fields.text.value = LAW;
    expect(await execute({ text: LAW })).toMatchObject({ success: true });
  });

  it.each([
    ['text', { text: LAW }],
    ['title', { text: LAW, title: 'Murphy' }],
    ['author', { text: LAW, author: 'Ann' }],
  ])('never overwrites %s the visitor typed', async (name, input) => {
    const field = fields[name as 'text' | 'title' | 'author'];
    field.value = 'something else the visitor wrote';
    expect(await execute(input)).toEqual({ error: `the form already has ${name} the visitor typed; ask them first` });
    expect(field.value).toBe('something else the visitor wrote');
    expect(inputEvents).toBe(0);
  });

  it('never overwrites a category the visitor already chose', async () => {
    fields.category.add(new Option('Work', '9'));
    fields.category.value = '9';
    expect(await execute({ text: LAW, category_id: 8 })).toEqual({
      error: 'the form already has a category the visitor chose; ask them first',
    });
    expect(fields.category.value).toBe('9');
    expect(fields.text.value).toBe('');
    expect(changeEvents).toBe(0);
  });

  it('accepts the category that is already selected', async () => {
    fields.category.value = '8';
    expect(await execute({ text: LAW, category_id: 8 })).toMatchObject({ success: true });
  });

  it.each([[99], [8.5], ['8']])('rejects category_id %j without touching the form', async (category_id) => {
    expect(await execute({ text: LAW, category_id })).toEqual({
      error: 'category_id is not one of the form\'s categories (they may still be loading)',
    });
    expect(fields.text.value).toBe('');
  });
});
