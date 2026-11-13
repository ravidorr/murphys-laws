// The WebMCP tools Murphy's Laws offers. The search and signup tools drive the form that is already on the page, so an
// agent goes through the same code, tracking and validation as a visitor; the calculator tools only compute.
import { registerWebMcpTool, type WebMcpResult } from './webmcp.ts';
import { calculateSodsLaw, SODS_LAW_MAX_RATING, SODS_LAW_MIN_RATING, type SodsLawInputs } from './sods-law.ts';
import { BUTTERED_TOAST_RANGES, calculateButteredToast, type ButteredToastInputs } from './buttered-toast.ts';

/** Same limit as the signup form's `maxlength`. */
const EMAIL_MAX_LENGTH = 254;

function readText(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * `search_laws`: fills the archive search form and submits it, which opens the results in the visitor's tab.
 * Read-only: nothing is saved or sent anywhere except the search request the page makes itself.
 */
export function registerSearchLawsTool(form: HTMLFormElement, field: HTMLInputElement): () => void {
  return registerWebMcpTool({
    name: 'search_laws',
    title: 'Search the Murphy\'s Law archive',
    description:
      'Searches the Murphy\'s Law archive for a word or phrase and opens the results in the visitor\'s browser tab. Read-only: nothing is saved or changed.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for in laws, categories and mishaps, for example "toast".', minLength: 1, maxLength: 200 },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true },
    execute: (input): WebMcpResult => {
      const query = readText(input, 'query');
      if (!query) return { error: 'query is required' };
      field.value = query;
      // Submitting navigates, and the router then removes this tool; do it after execute has returned
      // so the tool is not unregistered in the middle of its own call
      setTimeout(() => form.requestSubmit(), 0);
      return { success: true, query, message: 'The search results are open in the visitor\'s browser tab.' };
    },
  });
}

/**
 * `subscribe_daily_email`: types an address into the signup form and stops there. The visitor presses Subscribe
 * themselves, because submitting sends an email to that address and an agent must not do that unseen.
 */
export function registerDailyEmailTool(form: HTMLFormElement, field: HTMLInputElement): () => void {
  return registerWebMcpTool({
    name: 'subscribe_daily_email',
    title: 'Subscribe to the daily law email',
    description:
      'Enters an email address in the Law of the Day signup form and focuses its Subscribe button. It does not submit: the visitor must press Subscribe, which sends one confirmation email to that address. Nothing is subscribed until the address owner clicks the link in it. Use only an address the visitor asked for.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', description: 'The address that should receive the daily email.', maxLength: EMAIL_MAX_LENGTH },
      },
      required: ['email'],
    },
    annotations: { readOnlyHint: false },
    execute: (input): WebMcpResult => {
      const email = readText(input, 'email');
      if (!email) return { error: 'email is required' };
      // Check the address on a detached input: a rejected one must not overwrite what the visitor typed
      const probe = document.createElement('input');
      probe.type = 'email';
      probe.value = email;
      if (email.length > EMAIL_MAX_LENGTH || !probe.checkValidity()) return { error: 'email is not a valid address' };
      field.value = email;
      form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
      return {
        success: true,
        status: 'awaiting_visitor',
        message: 'The address is entered. The visitor must press Subscribe to send the confirmation email.',
      };
    },
  });
}

interface CalculatorField<I> {
  key: keyof I & string;
  description: string;
  min: number;
  max: number;
}

/**
 * A calculator tool is a pure calculation: it reads no page state, moves no slider and sends nothing, so it needs
 * no visitor consent and returns the same answer wherever it is called.
 */
function registerCalculatorTool<I extends object>(config: {
  name: string;
  title: string;
  description: string;
  fields: ReadonlyArray<CalculatorField<I>>;
  calculate: (inputs: I) => WebMcpResult;
}): () => void {
  return registerWebMcpTool({
    name: config.name,
    title: config.title,
    description: config.description,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        config.fields.map(({ key, description, min, max }) => [key, { type: 'number', description, minimum: min, maximum: max }])
      ),
      required: config.fields.map(({ key }) => key),
    },
    annotations: { readOnlyHint: true },
    execute: (input): WebMcpResult => {
      const values: Record<string, number> = {};
      for (const { key, min, max } of config.fields) {
        const value = input[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          return { error: `${key} must be a number from ${min} to ${max}` };
        }
        values[key] = value;
      }
      return { ...config.calculate(values as I), inputs: values };
    },
  });
}

/** `calculate_sods_law`: the Sod's Law calculator's score for five ratings, without touching its sliders. */
export function registerSodsLawTool(): () => void {
  const rating = (description: string) => ({ description, min: SODS_LAW_MIN_RATING, max: SODS_LAW_MAX_RATING });
  return registerCalculatorTool<SodsLawInputs>({
    name: 'calculate_sods_law',
    title: 'Calculate the Sod\'s Law score',
    description:
      'Works out how likely things are to go wrong with the Sod\'s Law calculator\'s formula, from five ratings of 1 to 9. Pure calculation: it does not move the page\'s sliders, change anything or send anything.',
    fields: [
      { key: 'urgency', ...rating('How urgent the task is, 1 to 9.') },
      { key: 'complexity', ...rating('How complex the task is, 1 to 9.') },
      { key: 'importance', ...rating('How important the task is, 1 to 9.') },
      { key: 'skill', ...rating('The doer\'s skill, 1 to 9, where 9 is expert.') },
      { key: 'frequency', ...rating('How often the task is done, 1 to 9.') },
    ],
    calculate: (inputs) => {
      const { score, probabilityPercent, riskLevel, interpretation } = calculateSodsLaw(inputs);
      return { score: Number(score.toFixed(2)), probabilityPercent, riskLevel, interpretation };
    },
  });
}

/** `calculate_buttered_toast`: the chance a dropped slice lands butter-side down, without touching the sliders. */
export function registerButteredToastTool(): () => void {
  const range = (key: keyof ButteredToastInputs, description: string) => ({ key, description, ...BUTTERED_TOAST_RANGES[key] });
  return registerCalculatorTool<ButteredToastInputs>({
    name: 'calculate_buttered_toast',
    title: 'Calculate the buttered toast landing odds',
    description:
      'Works out the chance that a dropped slice of buttered toast lands butter-side down, with the Buttered Toast calculator\'s formula. Pure calculation: it does not move the page\'s sliders, change anything or send anything.',
    fields: [
      range('height', 'Height of the table, in cm.'),
      range('gravity', 'Gravity, in cm/s². Earth is 980.'),
      range('overhang', 'How far the toast overhangs the edge, in cm.'),
      range('butter', 'Butter factor.'),
      range('friction', 'Air friction.'),
      range('inertia', 'Toast inertia.'),
    ],
    calculate: (inputs) => {
      const { probabilityPercent, riskLevel, interpretation } = calculateButteredToast(inputs);
      return { probabilityPercent, riskLevel, interpretation };
    },
  });
}

interface LawFilters {
  q?: string;
  category_id?: number;
  attribution?: string;
}

/**
 * `filter_laws`: runs the advanced search with a category and/or a submitter, and opens the results. It calls the
 * same `onSearch` the Search button calls. Read-only.
 */
export function registerFilterLawsTool(onSearch: (filters: LawFilters) => void): () => void {
  return registerWebMcpTool({
    name: 'filter_laws',
    title: 'Filter the Murphy\'s Law archive',
    description:
      'Searches the archive with the filters the header search lacks: a category (its numeric id, as listed by /api/v1/categories) and/or the name of the person who submitted the law, optionally with a keyword. Opens the filtered results in the visitor\'s browser tab. Read-only: nothing is saved or changed. Give at least one filter.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional keyword.', maxLength: 200 },
        category_id: { type: 'integer', minimum: 1, description: 'Numeric id of a category.' },
        attribution: { type: 'string', description: 'Name of the person who submitted the law, for example "Anonymous".', maxLength: 200 },
      },
    },
    annotations: { readOnlyHint: true },
    execute: (input): WebMcpResult => {
      const filters: LawFilters = {};
      const query = readText(input, 'query');
      if (query) filters.q = query;
      const attribution = readText(input, 'attribution');
      if (attribution) filters.attribution = attribution;
      if (input.category_id !== undefined) {
        if (!Number.isInteger(input.category_id) || (input.category_id as number) < 1) {
          return { error: 'category_id must be a whole number of 1 or more' };
        }
        filters.category_id = input.category_id as number;
      }
      if (Object.keys(filters).length === 0) return { error: 'give at least one of query, category_id or attribution' };
      // Searching navigates, and the router then removes this tool; do it after execute has returned
      setTimeout(() => onSearch(filters), 0);
      return { success: true, filters, message: 'The filtered results are open in the visitor\'s browser tab.' };
    },
  });
}

interface LawDraftFields {
  text: HTMLTextAreaElement;
  title: HTMLInputElement;
  author: HTMLInputElement;
  category: HTMLSelectElement;
  /** The CC0 release the visitor must accept themselves. */
  terms: HTMLInputElement;
}

/**
 * `draft_law_submission`: fills the submit-a-law form and stops. The visitor reads the public-domain (CC0) release,
 * ticks it and presses Submit themselves: that is their consent, not the agent's. It never overwrites what the
 * visitor already typed.
 */
export function registerDraftLawTool(fields: LawDraftFields): () => void {
  return registerWebMcpTool({
    name: 'draft_law_submission',
    title: 'Draft a law submission',
    description:
      'Fills in the "Submit a law" form with a law the visitor asked you to submit. It does not submit and does not accept the terms: the visitor must read and tick the public-domain (CC0) release and press Submit Law themselves. Every submission is reviewed by a human before it is published. Refuses to overwrite text the visitor already typed. Use only text the visitor asked you to submit.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The law itself, 10 to 1000 characters.', minLength: 10, maxLength: 1000 },
        title: { type: 'string', description: 'Optional name for the law.', maxLength: 200 },
        category_id: { type: 'integer', minimum: 1, description: 'Optional numeric id of a category (see /api/v1/categories).' },
        author: { type: 'string', description: 'Optional name to credit.', maxLength: 200 },
      },
      required: ['text'],
    },
    annotations: { readOnlyHint: false },
    execute: (input): WebMcpResult => {
      const text = readText(input, 'text');
      if (text.length < 10 || text.length > 1000) return { error: 'text must be 10 to 1000 characters' };

      const title = readText(input, 'title');
      const author = readText(input, 'author');
      const typed: Array<[string, HTMLTextAreaElement | HTMLInputElement, string]> = [
        ['text', fields.text, text],
        ['title', fields.title, title],
        ['author', fields.author, author],
      ];
      for (const [name, field, value] of typed) {
        const existing = field.value.trim();
        if (value && existing && existing !== value) return { error: `the form already has ${name} the visitor typed; ask them first` };
      }

      let categoryValue = '';
      if (input.category_id !== undefined) {
        categoryValue = String(input.category_id);
        const known = Array.from(fields.category.options).some((option) => option.value === categoryValue);
        if (!Number.isInteger(input.category_id) || !known) {
          return { error: 'category_id is not one of the form\'s categories (they may still be loading)' };
        }
        // A category already chosen, by the visitor or preselected from the page they came from, is theirs
        if (fields.category.value && fields.category.value !== categoryValue) {
          return { error: 'the form already has a category the visitor chose; ask them first' };
        }
      }

      for (const [, field, value] of typed) if (value) field.value = value;
      if (categoryValue) {
        fields.category.value = categoryValue;
        fields.category.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // The form listens for input on the law text to check validity and look for duplicates
      fields.text.dispatchEvent(new Event('input', { bubbles: true }));
      fields.terms.focus();
      return {
        success: true,
        status: 'awaiting_visitor',
        message: 'The draft is in the form. The visitor must accept the public-domain (CC0) release and press Submit Law.',
      };
    },
  });
}
