import { describe, it, expect } from 'vitest';
import * as logic from '../src/admin-ui/admin-logic.js';

const law = { id: 1, status: 'in_review', title: 'T', text: 'Original law text', admin_notes: null };

describe('admin-logic', () => {
  it('builds list URLs', () => {
    expect(logic.buildListUrl({ status: 'in_review', q: '', offset: 0 })).toBe('/api/v1/admin/laws?status=in_review&limit=25&offset=0');
    expect(logic.buildListUrl({ status: 'all', q: 'a b', offset: 25 })).toContain('q=a+b');
  });

  it('sends only changed fields', () => {
    expect(logic.buildUpdateBody(law, { status: 'in_review', title: 'T', text: 'Original law text', notes: '' })).toEqual({});
    expect(logic.buildUpdateBody(law, { status: 'published', title: ' ', text: ' New text of law ', notes: ' n ' })).toEqual({
      status: 'published',
      title: null,
      text: 'New text of law',
      admin_notes: 'n',
    });
    expect(logic.buildUpdateBody({ ...law, title: null }, { title: '' })).toEqual({});
  });

  it('sends category_id only when a different single category is chosen', () => {
    const base = { status: 'published', title: 'T', text: 'Original law text', categories: [{ id: 3, name: 'C' }] };
    expect(logic.buildUpdateBody(base, { categoryId: 3 })).toEqual({});
    expect(logic.buildUpdateBody(base, { categoryId: 4 })).toEqual({ category_id: 4 });
    expect(logic.buildUpdateBody(base, {})).toEqual({});
    expect(logic.buildUpdateBody({ ...base, categories: [] }, { categoryId: 3 })).toEqual({ category_id: 3 });
    expect(logic.buildUpdateBody({ ...base, categories: undefined }, { categoryId: 3 })).toEqual({ category_id: 3 });
    expect(logic.buildUpdateBody({ ...base, categories: [{ id: 3, name: 'C' }, { id: 4, name: 'D' }] }, { categoryId: 3 })).toEqual({ category_id: 3 });
  });

  it('preselects only a single category', () => {
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [{ id: 3, name: 'C' }] })).toBe('3');
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [] })).toBe('');
    expect(logic.categorySelectValue({ status: 'published', text: 'x' })).toBe('');
    expect(logic.categorySelectValue({ status: 'published', text: 'x', categories: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] })).toBe('');
  });

  it('labels pages', () => {
    expect(logic.pageLabel(0, 0, 0)).toBe('No laws');
    expect(logic.pageLabel(60, 25, 25)).toBe('26-50 of 60');
  });

  it('formats dates and submitters', () => {
    expect(logic.formatDate('2026-03-04T10:00:00.000Z')).toBe('2026-03-04');
    expect(logic.formatDate('nope')).toBe('');
    expect(logic.describeSubmitter([])).toBe('Anonymous');
    expect(logic.describeSubmitter([{ name: null, contact_type: 'text' }])).toBe('Anonymous');
    expect(logic.describeSubmitter([{ name: 'Ann', contact_type: 'email', contact_value: 'a@b.c' }])).toBe('Ann <a@b.c>');
    expect(logic.describeSubmitter([{ name: 'Ann', contact_type: 'email', contact_value: null }])).toBe('Ann');
  });

  it('maps error statuses to messages', () => {
    expect(logic.errorMessage(401)).toContain('Token rejected');
    expect(logic.errorMessage(403)).toContain('refused');
    expect(logic.errorMessage(404)).toContain('not enabled');
    expect(logic.errorMessage(404, 'Not Found')).toContain('not enabled');
    expect(logic.errorMessage(404, 'Law not found')).toBe('Law not found');
    expect(logic.errorMessage(429)).toContain('Too many');
    expect(logic.errorMessage(400, 'Invalid status')).toBe('Invalid status');
    expect(logic.errorMessage(500)).toBe('Request failed (500).');
  });

  it('adjusts counts and totals after a status change', () => {
    const base = { counts: { in_review: 3, published: 5, rejected: 1 }, total: 3, filter: 'in_review' };
    expect(logic.applyStatusChange(base, 'in_review', 'published')).toEqual({
      counts: { in_review: 2, published: 6, rejected: 1 },
      total: 2,
      removed: true,
    });
    expect(logic.applyStatusChange({ ...base, filter: 'all', total: 9 }, 'in_review', 'rejected')).toEqual({
      counts: { in_review: 2, published: 5, rejected: 2 },
      total: 9,
      removed: false,
    });
    expect(logic.applyStatusChange(base, 'in_review', 'in_review')).toEqual({ counts: base.counts, total: 3, removed: false });
    expect(logic.applyStatusChange({ counts: {}, total: 0, filter: 'published' }, 'in_review', 'published')).toEqual({
      counts: { in_review: 0, published: 1 },
      total: 0,
      removed: false,
    });
  });

  it('treats a deleted law (to = null) as leaving the view in every filter', () => {
    const base = { counts: { in_review: 3, published: 5, rejected: 1 }, total: 9 };
    expect(logic.applyStatusChange({ ...base, filter: 'in_review' }, 'in_review', null)).toEqual({
      counts: { in_review: 2, published: 5, rejected: 1 },
      total: 8,
      removed: true,
    });
    expect(logic.applyStatusChange({ ...base, filter: 'all' }, 'published', null)).toMatchObject({ total: 8, removed: true });
    expect(logic.applyStatusChange({ counts: { in_review: 0 }, total: 0, filter: 'all' }, 'in_review', null).counts.in_review).toBe(0);
  });

  it('validates server replies before they are rendered', () => {
    expect(logic.isListReply({ data: [], total: 0, counts: {} })).toBe(true);
    for (const bad of [null, {}, { data: {}, total: 0, counts: {} }, { data: [], total: 'x', counts: {} }, { data: [], total: 0 }, { data: [], total: 0, counts: 5 }]) {
      expect(logic.isListReply(bad)).toBe(false);
    }
    expect(logic.isLawReply({ data: { status: 'published' } })).toBe(true);
    for (const bad of [null, {}, { data: null }, { data: 5 }, { data: {} }, { data: { status: 3 } }]) {
      expect(logic.isLawReply(bad)).toBe(false);
    }
  });

  it('describes the thank-you email outcome for the admin', () => {
    expect(logic.describeThankYou(undefined)).toBe('');
    expect(logic.describeThankYou(null)).toBe('');
    expect(logic.describeThankYou({ status: 'queued' })).toBe(' Thank-you email is being sent (delivery is not confirmed).');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'no_email' })).toContain('left no email address');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'invalid_email' })).toContain('not valid');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'not_configured' })).toContain('not set up');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'already_sent' })).toContain('already sent');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'error' })).toContain('server logs');
    expect(logic.describeThankYou({ status: 'skipped', reason: 'something-new' })).toBe(' No thank-you email was sent.');
  });

  it('describes the thank-you outcome for a corollary', () => {
    expect(logic.describeThankYou({ status: 'skipped', reason: 'corollary' })).toContain('corollary');
  });

  describe('split review', () => {
    const candidates = {
      parent_text: 'A red light turns green right after you stop watching it.',
      items: [
        { title: 'The Ignition Corollary', text: 'The engine restarts slowly behind a horn.', labeled: true },
        { title: null, text: 'Remember to breathe while waiting.', labeled: false },
        { title: 'The Green-Light Corollary', text: 'The green lasts just long enough to miss.', labeled: true },
      ],
    };
    const row = (over: Partial<logic.SplitRow> = {}): logic.SplitRow => ({ title: 'A title', text: 'A corollary of enough length.', treatAs: 'corollary', ...over });
    const parent = 'A red light turns green right after you stop watching it.';

    it('offers only Corollary and Keep in parent text', () => {
      expect(logic.TREAT_OPTIONS).toEqual([
        { value: 'corollary', label: 'Corollary' },
        { value: 'keep', label: 'Keep in parent text' },
      ]);
      expect(logic.MAX_COROLLARIES).toBe(5);
    });

    it('seeds labeled bullets as corollaries and unlabeled ones as kept in the parent text (D3)', () => {
      expect(logic.seedSplitRows(candidates)).toEqual([
        { title: 'The Ignition Corollary', text: 'The engine restarts slowly behind a horn.', treatAs: 'corollary', manual: false },
        { title: '', text: 'Remember to breathe while waiting.', treatAs: 'keep', manual: false },
        { title: 'The Green-Light Corollary', text: 'The green lasts just long enough to miss.', treatAs: 'corollary', manual: false },
      ]);
    });

    it('seeds at most five corollaries, keeping the surplus labeled bullets in the parent text', () => {
      const many = { parent_text: parent, items: Array.from({ length: 7 }, (_, i) => ({ title: `C${i}`, text: `Corollary text number ${i}`, labeled: true })) };
      const rows = logic.seedSplitRows(many);
      expect(rows.filter((r: { treatAs: string }) => r.treatAs === 'corollary')).toHaveLength(5);
      expect(rows.slice(5).map((r: { treatAs: string }) => r.treatAs)).toEqual(['keep', 'keep']);
    });

    it('recomposes the parent text with the kept bullets after it', () => {
      expect(logic.composeParentText(` ${parent} `, [])).toBe(parent);
      expect(logic.composeParentText(parent, [row({ treatAs: 'keep', title: '', text: ' Remember to breathe while waiting. ' })])).toBe(`${parent}\n\n• Remember to breathe while waiting.`);
      expect(
        logic.composeParentText(parent, [
          row({ treatAs: 'keep', title: 'Note', text: 'First kept line here.' }),
          row({ treatAs: 'keep', title: ' ', text: 'Second kept line here.' }),
        ]),
      ).toBe(`${parent}\n\n• Note: First kept line here.\n• Second kept line here.`);
    });

    it('counts corollary rows and knows when another can be added', () => {
      const rows = logic.seedSplitRows(candidates);
      expect(logic.countCorollaries(rows)).toBe(2);
      expect(logic.canAddCorollary(rows)).toBe(true);
      expect(logic.canAddCorollary(Array.from({ length: 5 }, () => row()))).toBe(false);
      expect(logic.canAddCorollary(Array.from({ length: 5 }, () => row({ treatAs: 'keep' })))).toBe(true);
    });

    it('describes what approving will publish', () => {
      expect(logic.describeCandidates(candidates)).toBe('3 bullets found in the law text, 2 of them labeled as corollaries.');
      expect(logic.describeCandidates({ parent_text: parent, items: [candidates.items[0], candidates.items[2]] })).toBe('2 corollaries found in the law text.');
      expect(logic.describeCandidates({ parent_text: parent, items: [candidates.items[0]] })).toBe('1 corollary found in the law text.');
      expect(logic.describeCandidates({ parent_text: parent, items: [candidates.items[1]] })).toBe('1 bullet found in the law text, none labeled as a corollary.');
      expect(logic.describeCandidates({ parent_text: parent, items: [candidates.items[1], candidates.items[1]] })).toBe('2 bullets found in the law text, none labeled as a corollary.');
      expect(logic.describeSplit(2)).toEqual({ button: 'Approve and publish 3 laws', summary: 'Approving publishes 3 laws: the parent and 2 corollaries. Category and author name are copied to each corollary, and the submitter gets one thank-you email, for the parent.' });
      expect(logic.describeSplit(1)).toEqual({
        button: 'Approve and publish 2 laws',
        summary: 'Approving publishes 2 laws: the parent and 1 corollary. Category and author name are copied to each corollary, and the submitter gets one thank-you email, for the parent.',
      });
      expect(logic.describeSplit(0).button).toBe('Approve and publish the law');
    });

    describe('validateSplit', () => {
      const valid = () => ({ parentText: parent, rows: [row(), row({ title: '', text: 'Another corollary of enough length.' })] });

      it('accepts a valid split', () => {
        expect(logic.validateSplit(valid())).toEqual([]);
      });

      it('needs between one and five corollaries', () => {
        expect(logic.validateSplit({ parentText: parent, rows: [] })).toEqual(['Choose at least one bullet to publish as a corollary.']);
        expect(logic.validateSplit({ parentText: parent, rows: [row({ treatAs: 'keep' })] })).toEqual(['Choose at least one bullet to publish as a corollary.']);
        const six = Array.from({ length: 6 }, (_, i) => row({ text: `Corollary text number ${i}` }));
        expect(logic.validateSplit({ parentText: parent, rows: six })).toEqual(['A law can have at most 5 corollaries. Keep the others in the parent text.']);
      });

      it('checks the length of the parent text, with the kept bullets included', () => {
        expect(logic.validateSplit({ ...valid(), parentText: 'short' })).toEqual(['The law text must be between 10 and 1000 characters.']);
        const kept = row({ treatAs: 'keep', title: '', text: 'k'.repeat(990) });
        expect(logic.validateSplit({ parentText: parent, rows: [row(), kept] })).toEqual(['The law text must be between 10 and 1000 characters.']);
      });

      it('checks each corollary text and title, naming the bullet', () => {
        expect(logic.validateSplit({ ...valid(), rows: [row(), row({ text: 'too short' })] })).toEqual(['Bullet 2 must be between 10 and 1000 characters.']);
        expect(logic.validateSplit({ ...valid(), rows: [row({ text: 'x'.repeat(1001) })] })).toEqual(['Bullet 1 must be between 10 and 1000 characters.']);
        expect(logic.validateSplit({ ...valid(), rows: [row({ title: 'x'.repeat(201) })] })).toEqual(['Bullet 1 title must be at most 200 characters.']);
        expect(logic.validateSplit({ ...valid(), rows: [row({ title: 'x'.repeat(200) })] })).toEqual([]);
      });

      it('does not check the text of bullets that stay in the parent', () => {
        expect(logic.validateSplit({ ...valid(), rows: [row(), row({ treatAs: 'keep', title: '', text: 'ok' })] })).toEqual([]);
      });

      it('refuses duplicate corollaries and a corollary equal to the parent text', () => {
        expect(logic.validateSplit({ ...valid(), rows: [row(), row({ title: '', text: ' a  COROLLARY of enough length. ' })] })).toEqual(['Bullet 2 repeats another corollary or the law text.']);
        expect(logic.validateSplit({ ...valid(), rows: [row({ text: parent })] })).toEqual(['Bullet 1 repeats another corollary or the law text.']);
      });
    });

    describe('buildSplitBody', () => {
      const law = { id: 9, status: 'in_review', title: 'Lights', text: 'Original', admin_notes: null, updated_at: 'v1', categories: [{ id: 3, name: 'C' }] };
      const edits = (over: Record<string, unknown> = {}) => ({
        title: 'Lights',
        notes: '',
        categoryId: 3,
        parentText: parent,
        rows: [row({ title: ' The Ignition Corollary ', text: ' The engine restarts slowly behind a horn. ' }), row({ title: '  ', text: 'The green lasts just long enough to miss.' })],
        ...over,
      });

      it('sends the guard, the composed parent text and only the corollary rows, trimmed', () => {
        expect(logic.buildSplitBody(law, edits())).toEqual({
          updated_at: 'v1',
          parent_text: parent,
          corollaries: [
            { title: 'The Ignition Corollary', text: 'The engine restarts slowly behind a horn.' },
            { title: null, text: 'The green lasts just long enough to miss.' },
          ],
        });
      });

      it('moves kept bullets into the parent text and leaves them out of the corollaries', () => {
        const body = logic.buildSplitBody(law, edits({ rows: [row(), row({ treatAs: 'keep', title: '', text: 'Remember to breathe while waiting.' })] }));
        expect(body.parent_text).toBe(`${parent}\n\n• Remember to breathe while waiting.`);
        expect(body.corollaries).toHaveLength(1);
      });

      it('sends the title, notes and category only when they changed', () => {
        expect(logic.buildSplitBody(law, edits({ title: ' New ', notes: ' check ', categoryId: 4 }))).toMatchObject({ title: 'New', admin_notes: 'check', category_id: 4 });
        expect(logic.buildSplitBody(law, edits({ title: '', categoryId: undefined })).title).toBeNull();
        const body = logic.buildSplitBody(law, edits());
        expect(body).not.toHaveProperty('title');
        expect(body).not.toHaveProperty('admin_notes');
        expect(body).not.toHaveProperty('category_id');
      });

      it('omits the guard for a law without updated_at', () => {
        expect(logic.buildSplitBody({ ...law, updated_at: undefined }, edits())).not.toHaveProperty('updated_at');
      });
    });
  });

  describe('submissions with corollaries', () => {
    const child = (id: number, over: Record<string, unknown> = {}) => ({ id, title: `Name ${id}`, text: `Corollary text number ${id}`, status: 'in_review', updated_at: `v${id}`, ...over });
    const submission = (children: unknown[]) => ({ ...law, children }) as Parameters<typeof logic.describeSubmission>[0];

    it('counts only corollaries that are not rejected', () => {
      const withRejected = submission([child(2), child(3, { status: 'rejected' }), child(4)]);
      expect(logic.liveChildren(withRejected).map((c) => c.id)).toEqual([2, 4]);
      expect(logic.liveChildren(law as never)).toEqual([]);
    });

    it('describes the submission pill and the buttons from the live count', () => {
      expect(logic.describeSubmission(submission([child(2)]))).toBe('1 law + 1 corollary');
      expect(logic.describeSubmission(submission([child(2), child(3)]))).toBe('1 law + 2 corollaries');
      expect(logic.describeSubmission(submission([child(2, { status: 'rejected' })]))).toBe('');
      expect(logic.describeSubmission(law as never)).toBe('');

      expect(logic.describeQueueActions(submission([child(2), child(3)]))).toEqual({ approve: 'Approve all 3', reject: 'Reject all' });
      expect(logic.describeQueueActions(submission([child(2), child(3, { status: 'rejected' })]))).toEqual({ approve: 'Approve all 2', reject: 'Reject all' });
      expect(logic.describeQueueActions(submission([child(2, { status: 'rejected' })]))).toEqual({ approve: 'Approve', reject: 'Reject' });
      expect(logic.describeQueueActions(law as never)).toEqual({ approve: 'Approve', reject: 'Reject' });
    });

    it('builds one guarded update per changed live corollary, never for rejected or untouched ones', () => {
      const card = submission([child(2), child(3), child(4, { status: 'rejected' }), child(5, { updated_at: undefined })]);
      const values = {
        2: { title: 'Name 2', text: 'Corollary text number 2' },
        3: { title: ' ', text: ' Edited corollary text 3 ' },
        4: { title: 'x', text: 'Changed but rejected text' },
        5: { title: 'New name', text: 'Corollary text number 5' },
      };
      expect(logic.buildChildUpdates(card, values)).toEqual([
        { id: 3, body: { title: null, text: 'Edited corollary text 3', updated_at: 'v3' } },
        { id: 5, body: { title: 'New name' } },
      ]);
      expect(logic.buildChildUpdates(card, { 3: values[3] }).map((u) => u.id)).toEqual([3]);
      expect(logic.buildChildUpdates(card, {})).toEqual([]);
    });

    it('names the corollary that would be refused, by its place on the card', () => {
      const card = submission([child(2, { status: 'rejected' }), child(3), child(4)]);
      expect(logic.validateChildEdits(card, {
        3: { title: 'ok', text: 'too short' },
        4: { title: 't'.repeat(201), text: 'x'.repeat(1001) },
      })).toEqual([
        'Corollary 2 must be between 10 and 1000 characters.',
        'Corollary 3 must be between 10 and 1000 characters.',
        'Corollary 3 title must be at most 200 characters.',
      ]);
      expect(logic.validateChildEdits(card, { 2: { title: '', text: 'x' }, 3: { title: '', text: 'x'.repeat(10) } })).toEqual([]);
      expect(logic.validateChildEdits(card, {})).toEqual([]);
      expect(logic.validateChildEdits(law as never, {})).toEqual([]);
    });

    it('says how many corollaries moved with a status change', () => {
      expect(logic.describeCascade(0)).toBe('');
      expect(logic.describeCascade(undefined)).toBe('');
      expect(logic.describeCascade(1)).toBe(' 1 corollary moved with it.');
      expect(logic.describeCascade(3)).toBe(' 3 corollaries moved with it.');
    });
  });
});
