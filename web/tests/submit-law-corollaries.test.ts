import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubmitLawSection } from '../src/components/submit-law.ts';
import * as api from '../src/utils/api.ts';
import * as cacheUtils from '../src/utils/category-cache.ts';
import * as request from '../src/utils/request.ts';

type PendoTrack = (name: string, properties?: Record<string, unknown>) => void;

const LAW = 'A red light turns green right after you stop watching it.';
const ONE = 'The engine restarts slowly when someone behind you is honking.';
const TWO = 'The green lasts just long enough for you to miss it.';

describe('submit form corollaries', () => {
  let el: HTMLElement;
  let track: ReturnType<typeof vi.fn<PendoTrack>>;

  const q = <T extends Element>(selector: string) => el.querySelector(selector) as T;
  const rows = () => [...el.querySelectorAll<HTMLElement>('[data-corollary-row]')];
  const field = (row: number, part: 'title' | 'text') => rows()[row]!.querySelector(`[data-corollary-${part}]`) as HTMLInputElement & HTMLTextAreaElement;
  const addButton = () => q<HTMLButtonElement>('[data-action="add-corollary"]');
  const submitButton = () => q<HTMLButtonElement>('#submit-btn');
  const label = () => submitButton().querySelector('.btn-text')!.textContent;
  const message = () => q<HTMLElement>('.submit-message');
  const lawText = () => q<HTMLTextAreaElement>('#submit-text');
  const hint = () => q<HTMLElement>('[data-corollary-hint]');
  const count = () => q<HTMLElement>('[data-corollary-count]').textContent;
  const type = (node: HTMLElement, value: string) => {
    (node as HTMLInputElement).value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const addRow = (title = '', text = '') => {
    addButton().click();
    const index = rows().length - 1;
    if (title) type(field(index, 'title'), title);
    if (text) type(field(index, 'text'), text);
  };
  const fillLaw = (text = LAW) => {
    type(lawText(), text);
    const terms = q<HTMLInputElement>('#submit-terms');
    terms.checked = true;
    terms.dispatchEvent(new Event('change'));
  };
  const submit = () => q<HTMLFormElement>('.submit-form').dispatchEvent(new Event('submit'));
  const events = (name: string) => track.mock.calls.filter(([eventName]) => eventName === name);

  beforeEach(() => {
    vi.spyOn(cacheUtils, 'deferUntilIdle').mockImplementation((callback) => callback());
    vi.spyOn(api, 'fetchAPI').mockResolvedValue({ data: [] });
    vi.spyOn(api, 'fetchDuplicateCandidates').mockResolvedValue({ data: [], total: 0, limit: 5, offset: 0 });
    track = vi.fn<PendoTrack>();
    window.pendo = { track };
    localStorage.clear();
    el = SubmitLawSection();
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    delete window.pendo;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('the repeater', () => {
    it('tells visitors corollaries cannot yet be added to a published law', () => {
      const help = q<HTMLElement>('#submit-corollaries-help').textContent;
      expect(help).toContain('Corollaries can only be added to a new law for now, not to one that is already published.');
      expect(q('[data-corollaries]').getAttribute('aria-describedby')).toBe('submit-corollaries-help');
    });

    it('starts with no boxes, a counter and an enabled add button', () => {
      expect(rows()).toHaveLength(0);
      expect(count()).toBe('0 of 5 added');
      expect(addButton().disabled).toBe(false);
      expect(q('fieldset[data-corollaries] legend').textContent).toContain('Corollaries');
      expect(label()).toBe('Submit Law');
    });

    it('adds a labelled box, focuses its name and reports the addition', () => {
      addButton().click();

      expect(rows()).toHaveLength(1);
      expect(rows()[0]!.getAttribute('role')).toBe('group');
      expect(rows()[0]!.querySelector('[data-corollary-label]')!.textContent).toBe('Corollary 1');
      expect(rows()[0]!.querySelector('[data-action="remove-corollary"]')!.getAttribute('aria-label')).toBe('Remove corollary 1');
      expect(document.activeElement).toBe(field(0, 'title'));
      expect(count()).toBe('1 of 5 added');
      expect(events('law_corollary_added')).toEqual([['law_corollary_added', { corollary_count: 1, via: 'button' }]]);
    });

    it('gives every field a unique id with a label that points at it', () => {
      addRow();
      addRow();
      const ids = rows().flatMap((row) => [...row.querySelectorAll('input, textarea')].map((node) => node.id));
      expect(new Set(ids).size).toBe(4);
      for (const row of rows()) {
        for (const [labelSelector, fieldSelector] of [['[data-corollary-title-label]', '[data-corollary-title]'], ['[data-corollary-text-label]', '[data-corollary-text]']] as const) {
          expect((row.querySelector(labelSelector) as HTMLLabelElement).htmlFor).toBe(row.querySelector(fieldSelector)!.id);
        }
        expect(row.getAttribute('aria-labelledby')).toBe(row.querySelector('[data-corollary-label]')!.id);
      }
    });

    it('stops at five boxes and re-enables the button after one is removed', () => {
      for (let i = 0; i < 5; i += 1) addRow();
      expect(rows()).toHaveLength(5);
      expect(addButton().disabled).toBe(true);
      expect(count()).toBe('5 of 5 added');
      addButton().click();
      expect(rows()).toHaveLength(5);

      (rows()[1]!.querySelector('[data-action="remove-corollary"]') as HTMLButtonElement).click();
      expect(rows()).toHaveLength(4);
      expect(addButton().disabled).toBe(false);
      expect(count()).toBe('4 of 5 added');
    });

    it('removes the right box, renumbers the rest, keeps their text and moves focus to the add button', () => {
      addRow('', ONE);
      addRow('', TWO);
      addRow('', 'The third corollary of the law');

      (rows()[0]!.querySelector('[data-action="remove-corollary"]') as HTMLButtonElement).click();

      expect(rows().map((row) => row.querySelector('[data-corollary-label]')!.textContent)).toEqual(['Corollary 1', 'Corollary 2']);
      expect(rows().map((row) => (row.querySelector('[data-corollary-text]') as HTMLTextAreaElement).value)).toEqual([TWO, 'The third corollary of the law']);
      expect(rows()[1]!.querySelector('[data-action="remove-corollary"]')!.getAttribute('aria-label')).toBe('Remove corollary 2');
      expect(document.activeElement).toBe(addButton());
    });

    it('ignores clicks inside the boxes that are not on a remove button', () => {
      addRow();
      field(0, 'text').click();
      el.querySelector('[data-corollary-rows]')!.dispatchEvent(new Event('click', { bubbles: true }));
      expect(rows()).toHaveLength(1);
    });

    it('counts characters per box and flags a box that is too short', () => {
      addRow('', 'short');
      const counter = rows()[0]!.querySelector('[data-corollary-counter]') as HTMLElement;
      expect(counter.textContent).toBe('5 / 1000');
      expect(counter.classList.contains('submit-char-counter-error')).toBe(true);
      type(field(0, 'text'), ONE);
      expect(counter.textContent).toBe(`${ONE.length} / 1000`);
      expect(counter.classList.contains('submit-char-counter-error')).toBe(false);
      type(field(0, 'text'), '');
      expect(counter.textContent).toBe('0 / 1000');
      expect(counter.classList.contains('submit-char-counter-error')).toBe(false);
    });
  });

  describe('validation and the submit button', () => {
    it('lets a form with only empty boxes submit and ignores them', async () => {
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 1, corollaries: [] });
      fillLaw();
      addRow();
      addRow();

      expect(submitButton().disabled).toBe(false);
      expect(label()).toBe('Submit Law');
      submit();
      await vi.waitFor(() => expect(request.apiPost).toHaveBeenCalled());
      expect(vi.mocked(request.apiPost).mock.calls[0]![1]).not.toHaveProperty('corollaries', expect.anything());
    });

    it('blocks submitting while a filled box is under 10 characters, naming the box', () => {
      fillLaw();
      addRow('', ONE);
      addRow('', 'too short');

      expect(submitButton().disabled).toBe(true);
      expect(message().textContent).toBe('Corollary 2 text must be at least 10 characters');
      expect(message().classList.contains('error')).toBe(true);

      type(field(1, 'text'), TWO);
      expect(submitButton().disabled).toBe(false);
      expect(message().hidden).toBe(true);
    });

    it('treats a box with only a name as filled and incomplete', () => {
      fillLaw();
      addRow('The Ignition Corollary', '');
      expect(submitButton().disabled).toBe(true);
      expect(message().textContent).toBe('Corollary 1 text must be at least 10 characters');
    });

    it('does not send a submission with a short corollary even if the button is forced', () => {
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 1 });
      fillLaw();
      addRow('', 'too short');
      submit();
      expect(request.apiPost).not.toHaveBeenCalled();
      expect(events('law_submission_failed')).toEqual([['law_submission_failed', expect.objectContaining({ failure_reason: 'corollary_invalid' })]]);
    });

    it('names a repeated corollary by its box on screen, even when an earlier box is empty', () => {
      fillLaw();
      addRow();
      addRow('', ONE);
      addRow('', `  ${ONE.toUpperCase()} `);
      expect(submitButton().disabled).toBe(true);
      expect(message().textContent).toBe('Corollary 3 repeats another corollary or the law text');

      type(field(2, 'text'), `  ${LAW.toLowerCase()}`);
      expect(message().textContent).toBe('Corollary 3 repeats another corollary or the law text');
      type(field(2, 'text'), TWO);
      expect(submitButton().disabled).toBe(false);
    });

    it('refuses a corollary text over 1000 characters or a name over 200, which typing cannot produce but moving bullets can', () => {
      fillLaw();
      addRow('', ONE);
      field(0, 'text').value = 'x'.repeat(1001);
      field(0, 'text').dispatchEvent(new Event('input', { bubbles: true }));
      expect(message().textContent).toBe('Corollary 1 text must be at most 1000 characters');
      field(0, 'text').value = ONE;
      field(0, 'title').value = 't'.repeat(201);
      field(0, 'title').dispatchEvent(new Event('input', { bubbles: true }));
      expect(message().textContent).toBe('Corollary 1 name must be at most 200 characters');
      expect(submitButton().disabled).toBe(true);
    });

    it('words the button after the filled boxes only, and goes back when they are removed', () => {
      fillLaw();
      addRow('', ONE);
      expect(label()).toBe('Submit law with 1 corollary');
      addRow('', TWO);
      addRow();
      expect(label()).toBe('Submit law with 2 corollaries');
      type(field(0, 'text'), '');
      expect(label()).toBe('Submit law with 1 corollary');
      (rows()[1]!.querySelector('[data-action="remove-corollary"]') as HTMLButtonElement).click();
      type(field(0, 'text'), '');
      expect(label()).toBe('Submit Law');
    });
  });

  describe('submitting', () => {
    it('sends the law with each filled box, trimmed, titles only when given, and skips empty boxes', async () => {
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 12, status: 'in_review', corollaries: [{ id: 13 }, { id: 14 }] });
      fillLaw();
      addRow('  The Ignition Corollary ', `  ${ONE}  `);
      addRow();
      addRow('', TWO);

      submit();
      await vi.waitFor(() => expect(request.apiPost).toHaveBeenCalled());

      expect(request.apiPost).toHaveBeenCalledWith('/api/v1/laws', expect.objectContaining({
        text: LAW,
        corollaries: [{ title: 'The Ignition Corollary', text: ONE }, { title: undefined, text: TWO }],
      }));
    });

    it('reports the corollary count on the submitted event and says so in the thank-you', async () => {
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 12 });
      fillLaw();
      addRow('', ONE);
      addRow('', TWO);

      submit();
      await vi.waitFor(() => expect(events('law_submitted')).toHaveLength(1));

      expect(events('law_submitted')[0]![1]).toMatchObject({ corollary_count: 2 });
      expect(JSON.stringify(track.mock.calls)).not.toContain(ONE);
      expect(message().textContent).toContain('Your law and its 2 corollaries have been submitted');
      expect(message().textContent).toContain('reviewed together');
    });

    it('uses singular wording for one corollary and the plain thank-you for none', async () => {
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 12 });
      fillLaw();
      addRow('', ONE);
      submit();
      await vi.waitFor(() => expect(message().textContent).toContain('Your law and its corollary have been submitted'));

      el.remove();
      el = SubmitLawSection();
      document.body.appendChild(el);
      fillLaw();
      submit();
      await vi.waitFor(() => expect(message().textContent).toContain('Your law has been submitted.'));
      expect(message().textContent).not.toContain('corollar');
    });

    it('shows "Submitting..." while the request runs, then the count again', async () => {
      let finish: (value: unknown) => void = () => {};
      vi.spyOn(request, 'apiPost').mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      fillLaw();
      addRow('', ONE);

      submit();
      await vi.waitFor(() => expect(label()).toBe('Submitting...'));
      addRow('', TWO);
      expect(label()).toBe('Submitting...');
      finish({ id: 1 });
      await vi.waitFor(() => expect(label()).toBe('Submit law with 2 corollaries'));
    });

    it('clears the boxes for the next law after a successful submission', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      vi.spyOn(request, 'apiPost').mockResolvedValue({ id: 12 });
      fillLaw();
      addRow('', ONE);
      addRow('', TWO);

      submit();
      await vi.waitFor(() => expect(events('law_submitted')).toHaveLength(1));
      vi.advanceTimersByTime(400);

      expect(rows()).toHaveLength(0);
      expect(count()).toBe('0 of 5 added');
      expect(label()).toBe('Submit Law');
      expect(hint().hidden).toBe(true);
    });

    it('keeps the boxes when the submission fails, so nothing typed is lost', async () => {
      vi.spyOn(request, 'apiPost').mockRejectedValue(new Error('Rate limit exceeded. Please try again later.'));
      fillLaw();
      addRow('', ONE);

      submit();
      await vi.waitFor(() => expect(events('law_submission_failed')).toHaveLength(1));
      expect(rows()).toHaveLength(1);
      expect(field(0, 'text').value).toBe(ONE);
    });
  });

  describe('the hint for corollaries typed into the law text', () => {
    const bulleted = `${LAW}\n\n• The Ignition Corollary: ${ONE}\n• Remember to breathe while waiting.\n• The Green-Light Corollary: ${TWO}`;

    it('appears for corollary-labeled bullets and says how many', () => {
      expect(hint().hidden).toBe(true);
      type(lawText(), bulleted);
      expect(hint().hidden).toBe(false);
      expect(q('[data-corollary-hint-text]').textContent).toBe('Looks like your text includes 2 corollaries.');

      type(lawText(), `${LAW}\n\n• The Ignition Corollary: ${ONE}`);
      expect(q('[data-corollary-hint-text]').textContent).toBe('Looks like your text includes a corollary.');
    });

    it('stays away for plain text, for bullets without a corollary label and for text with no sentence before the bullets', () => {
      type(lawText(), LAW);
      expect(hint().hidden).toBe(true);
      type(lawText(), `${LAW}\n\n• Remember to breathe while waiting.\n• Another plain bullet in the list`);
      expect(hint().hidden).toBe(true);
      type(lawText(), `• The Ignition Corollary: ${ONE}`);
      expect(hint().hidden).toBe(true);
    });

    it('moves only the labeled bullets into the boxes and leaves the unlabeled one in the law text', () => {
      type(lawText(), bulleted);
      q<HTMLButtonElement>('[data-action="move-corollaries"]').click();

      expect(rows()).toHaveLength(2);
      expect(field(0, 'title').value).toBe('The Ignition Corollary');
      expect(field(0, 'text').value).toBe(ONE);
      expect(field(1, 'title').value).toBe('The Green-Light Corollary');
      expect(field(1, 'text').value).toBe(TWO);
      expect(lawText().value).toBe(`${LAW}\n\n• Remember to breathe while waiting.`);
      expect(hint().hidden).toBe(true);
      expect(count()).toBe('2 of 5 added. Moved 2 from your law text.');
      expect(events('law_corollary_added')).toEqual([['law_corollary_added', { corollary_count: 2, via: 'text_hint', moved: 2 }]]);
      expect(document.activeElement).toBe(field(0, 'title'));
      expect(rows()[0]!.querySelector('[data-corollary-counter]')!.textContent).toBe(`${ONE.length} / 1000`);
    });

    it('leaves the law text as the parent sentence alone when every bullet moved, and enables submitting', () => {
      fillLaw(`${LAW}\n\n• The Ignition Corollary: ${ONE}`);
      q<HTMLButtonElement>('[data-action="move-corollaries"]').click();
      expect(lawText().value).toBe(LAW);
      expect(submitButton().disabled).toBe(false);
      expect(label()).toBe('Submit law with 1 corollary');
    });

    it('fills empty boxes first and respects the maximum with the boxes already filled, keeping what does not fit', () => {
      addRow('', 'The first corollary already typed in');
      addRow('', 'The second corollary already typed in');
      addRow();
      const labeled = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name) => `• The ${name} Corollary: The ${name} consequence of the law`).join('\n');
      type(lawText(), `${LAW}\n\n${labeled}`);
      q<HTMLButtonElement>('[data-action="move-corollaries"]').click();

      // One empty box and two free slots: three of the four fit, the fourth stays in the text.
      expect(rows()).toHaveLength(5);
      expect(field(2, 'title').value).toBe('The Alpha Corollary');
      expect(field(3, 'title').value).toBe('The Beta Corollary');
      expect(field(4, 'title').value).toBe('The Gamma Corollary');
      expect(lawText().value).toBe(`${LAW}\n\n• The Delta Corollary: The Delta consequence of the law`);
      expect(hint().hidden).toBe(false);
      expect(q('[data-corollary-hint-text]').textContent).toBe('Looks like your text includes a corollary.');
      expect(count()).toBe('5 of 5 added. Moved 3 from your law text; 1 stayed in the text because there is no room for more boxes.');
    });

    it('says there is no room, and changes nothing, when all five boxes are in use', () => {
      for (let i = 0; i < 5; i += 1) addRow('', `Corollary ${i} typed in by the visitor`);
      const text = `${LAW}\n\n• The Ninth Corollary: The ninth consequence of the law`;
      type(lawText(), text);
      q<HTMLButtonElement>('[data-action="move-corollaries"]').click();
      expect(lawText().value).toBe(text);
      expect(rows()).toHaveLength(5);
      expect(count()).toContain('No room');
    });

    it('does nothing when the text no longer parses by the time the button is used', () => {
      type(lawText(), bulleted);
      lawText().value = LAW;
      q<HTMLButtonElement>('[data-action="move-corollaries"]').click();
      expect(rows()).toHaveLength(0);
      expect(lawText().value).toBe(LAW);
    });
  });
});
