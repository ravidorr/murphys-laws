import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { AdminLawService, type AdminSplitInput } from '../../src/services/admin-laws.service.ts';
import { COROLLARY_RELATION } from '../../src/services/law-relations.service.ts';
import { LawService } from '../../src/services/laws.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

type Db = InstanceType<typeof Database>;

const GUARD = '2030-01-01T00:00:00.000Z';

describe('AdminLawService corollaries (real migrated schema)', () => {
  let db: Db;
  let admin: AdminLawService;
  let laws: LawService;

  const insertLaw = (title: string | null, text: string, status: string, createdAt = GUARD) =>
    Number(
      db
        .prepare("INSERT INTO laws (title, text, status, first_seen_file_path, created_at, updated_at) VALUES (?, ?, ?, 'web-submission', ?, ?)")
        .run(title, text, status, createdAt, createdAt).lastInsertRowid,
    );
  const link = (childId: number, parentId: number) =>
    db.prepare('INSERT INTO law_relations (from_law_id, to_law_id, relation_type, note) VALUES (?, ?, ?, NULL)').run(childId, parentId, COROLLARY_RELATION);
  const statusOf = (id: number) => (db.prepare('SELECT status FROM laws WHERE id = ?').get(id) as { status: string }).status;
  const row = (id: number) => db.prepare('SELECT * FROM laws WHERE id = ?').get(id) as Record<string, unknown>;
  const categories = () => db.prepare('SELECT id, title FROM categories ORDER BY id LIMIT 3').all() as { id: number; title: string }[];
  const searchHits = async (q: string) => (await laws.listLaws({ limit: 25, offset: 0, q })).data.map((l: { id: number }) => l.id);

  beforeEach(() => {
    db = createMigratedDb();
    admin = new AdminLawService(db);
    laws = new LawService(db);
  });

  describe('corollary candidates in the list', () => {
    const bulleted = 'A red light turns green right after you stop watching it.\n\n• The Ignition Corollary: The engine restarts slowly behind a horn.\n• Remember to breathe while waiting.';

    it('seeds in-review top-level laws whose text parses, and leaves every other law without the field', () => {
      const parsing = insertLaw('Lights', bulleted, 'in_review', '2030-01-09T00:00:00.000Z');
      const plain = insertLaw(null, 'A plain law with no bullets at all', 'in_review', '2030-01-08T00:00:00.000Z');
      const noParent = insertLaw(null, '• Only a bullet with no parent sentence above it', 'in_review', '2030-01-07T00:00:00.000Z');
      const publishedBulleted = insertLaw(null, bulleted, 'published', '2030-01-06T00:00:00.000Z');
      const child = insertLaw(null, bulleted, 'in_review', '2030-01-05T00:00:00.000Z');
      link(child, plain);

      const data = admin.listLaws({ status: 'all', q: '', limit: 100, offset: 0 }).data;
      const byId = (id: number) => data.find((l) => l.id === id) as unknown as Record<string, unknown>;

      expect(byId(parsing).corollary_candidates).toEqual({
        parent_text: 'A red light turns green right after you stop watching it.',
        items: [
          { title: 'The Ignition Corollary', text: 'The engine restarts slowly behind a horn.', labeled: true },
          { title: null, text: 'Remember to breathe while waiting.', labeled: false },
        ],
      });
      for (const id of [plain, noParent, publishedBulleted, child]) {
        expect(byId(id)).not.toHaveProperty('corollary_candidates');
      }
    });

    it('does not offer a split for a law that is already a corollary', () => {
      const parent = insertLaw(null, 'A parent law with enough words in it', 'published');
      const child = insertLaw(null, bulleted, 'in_review');
      link(child, parent);
      expect(admin.listLaws({ status: 'in_review', q: '', limit: 100, offset: 0 }).data.find((l) => l.id === child)).not.toHaveProperty('corollary_candidates');
    });
  });

  describe('splitLaw', () => {
    const items = (...texts: string[]) => texts.map((text, i) => ({ title: `Corollary ${i + 1}`, text }));
    const input = (over: Partial<AdminSplitInput> = {}): AdminSplitInput => ({
      expectedUpdatedAt: GUARD,
      parentText: 'A red light turns green right after you stop watching it.',
      corollaries: items('The engine restarts slowly behind a horn.', 'The green lasts just long enough to miss.'),
      ...over,
    });
    const make = (attribution: { name: string | null; type: string; value: string | null } | null = { name: 'Ringo', type: 'email', value: 'ringo@example.com' }) => {
      const id = insertLaw('Lights', 'Original text with the bullets still inside', 'in_review');
      if (attribution) {
        db.prepare('INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, ?, ?, ?)').run(id, attribution.name, attribution.type, attribution.value);
      }
      return id;
    };

    it('publishes the parent and creates published, linked children in one go', () => {
      const id = make();
      const result = admin.splitLaw(id, input());

      expect(result.outcome).toBe('split');
      if (result.outcome !== 'split') return;
      expect(result.previousStatus).toBe('in_review');
      expect(result.law).toMatchObject({ id, status: 'published', text: 'A red light turns green right after you stop watching it.', title: 'Lights' });
      expect(result.law.updated_at).not.toBe(GUARD);
      expect(result.children).toEqual([
        { id: expect.any(Number), title: 'Corollary 1', text: 'The engine restarts slowly behind a horn.' },
        { id: expect.any(Number), title: 'Corollary 2', text: 'The green lasts just long enough to miss.' },
      ]);
      for (const child of result.children) {
        expect(statusOf(child.id)).toBe('published');
      }
    });

    it('links each child to the parent with the child as from_law_id and the title as the note', () => {
      const id = make();
      const result = admin.splitLaw(id, input());
      const children = result.outcome === 'split' ? result.children : [];
      const relations = db.prepare('SELECT from_law_id, to_law_id, relation_type, note FROM law_relations WHERE to_law_id = ? ORDER BY id').all(id);
      expect(relations).toEqual(children.map((c) => ({ from_law_id: c.id, to_law_id: id, relation_type: 'COROLLARY_OF', note: c.title })));
    });

    it('copies the parent categories and gives children the submitter name only, never the email', () => {
      const [first, second] = categories();
      const id = make();
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?), (?, ?)').run(id, first.id, id, second.id);
      const result = admin.splitLaw(id, input());
      const children = result.outcome === 'split' ? result.children : [];

      for (const child of children) {
        expect(db.prepare('SELECT category_id FROM law_categories WHERE law_id = ? ORDER BY category_id').all(child.id)).toEqual([{ category_id: first.id }, { category_id: second.id }]);
        expect(db.prepare('SELECT name, contact_type, contact_value FROM attributions WHERE law_id = ?').all(child.id)).toEqual([{ name: 'Ringo', contact_type: 'text', contact_value: null }]);
        expect(row(child.id).first_seen_file_path).toBe('web-submission');
      }
      expect(JSON.stringify(db.prepare('SELECT * FROM attributions WHERE law_id IN (?, ?)').all(children[0].id, children[1].id))).not.toContain('@');
      expect(db.prepare('SELECT contact_value FROM attributions WHERE law_id = ?').get(id)).toEqual({ contact_value: 'ringo@example.com' });
    });

    it('creates children without an attribution when the parent has no name', () => {
      const id = make(null);
      const result = admin.splitLaw(id, input());
      const children = result.outcome === 'split' ? result.children : [];
      expect(db.prepare('SELECT COUNT(*) AS n FROM attributions WHERE law_id IN (?, ?)').get(children[0].id, children[1].id)).toEqual({ n: 0 });
    });

    it('applies the category, title and notes given with the split, and children copy the new category', () => {
      const [first, second] = categories();
      const id = make();
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(id, first.id);
      const result = admin.splitLaw(id, input({ categoryId: second.id, title: 'New title', adminNotes: 'checked' }));
      expect(result.outcome).toBe('split');
      if (result.outcome !== 'split') return;
      expect(result.previousCategoryIds).toEqual([first.id]);
      expect(result.law).toMatchObject({ title: 'New title', admin_notes: 'checked', categories: [{ id: second.id, name: expect.any(String) }] });
      expect(db.prepare('SELECT category_id FROM law_categories WHERE law_id = ?').all(result.children[0].id)).toEqual([{ category_id: second.id }]);
    });

    it('keeps the title and notes when they are not given, and clears them with null', () => {
      const id = make();
      db.prepare("UPDATE laws SET admin_notes = 'old' WHERE id = ?").run(id);
      const kept = admin.splitLaw(id, input({ corollaries: items('Only one corollary is here for now.') }));
      expect(kept.outcome === 'split' && kept.law).toMatchObject({ title: 'Lights', admin_notes: 'old' });

      const other = make();
      db.prepare("UPDATE laws SET admin_notes = 'old' WHERE id = ?").run(other);
      const cleared = admin.splitLaw(other, input({ title: null, adminNotes: null, corollaries: items('Only one corollary is here for now.') }));
      expect(cleared.outcome === 'split' && cleared.law).toMatchObject({ title: null, admin_notes: null });
    });

    it('stores blank corollary titles as null', () => {
      const id = make();
      const result = admin.splitLaw(id, input({ corollaries: [{ title: null, text: 'A corollary without any title at all.' }] }));
      expect(result.outcome === 'split' && result.children[0].title).toBeNull();
    });

    it('makes the parent and the children searchable', async () => {
      const id = make();
      const result = admin.splitLaw(id, input({ parentText: 'Zebrafish always escape the net you bought', corollaries: items('Narwhals surface right after the camera is packed.') }));
      const children = result.outcome === 'split' ? result.children : [];
      expect(await searchHits('zebrafish')).toContain(id);
      expect(await searchHits('narwhals')).toEqual([children[0].id]);
    });

    it('answers conflict for a stale updated_at and changes nothing', () => {
      const id = make();
      const before = row(id);
      expect(admin.splitLaw(id, input({ expectedUpdatedAt: 'stale' }))).toEqual({ outcome: 'conflict' });
      expect(row(id)).toEqual(before);
      expect(db.prepare('SELECT COUNT(*) AS n FROM law_relations WHERE to_law_id = ?').get(id)).toEqual({ n: 0 });
    });

    it('lets only one of two identical splits win', () => {
      const id = make();
      const first = admin.splitLaw(id, input());
      const second = admin.splitLaw(id, input());
      expect(first.outcome).toBe('split');
      // The second sees a published law, which can no longer be split.
      expect(second.outcome).toBe('invalid');
      expect(db.prepare('SELECT COUNT(*) AS n FROM law_relations WHERE to_law_id = ?').get(id)).toEqual({ n: 2 });
    });

    it('reports a missing law', () => {
      expect(admin.splitLaw(999999, input())).toEqual({ outcome: 'not_found' });
    });

    it.each(['published', 'rejected'])('refuses a law that is %s', (status) => {
      const id = insertLaw(null, 'A law that is not waiting for review', status);
      const result = admin.splitLaw(id, input());
      expect(result).toEqual({ outcome: 'invalid', status: 400, message: 'Only a law in review can be split' });
      expect(statusOf(id)).toBe(status);
    });

    it('refuses an unknown category without writing anything', () => {
      const id = make();
      expect(admin.splitLaw(id, input({ categoryId: 999999 }))).toEqual({ outcome: 'invalid_category' });
      expect(statusOf(id)).toBe('in_review');
      expect(db.prepare('SELECT COUNT(*) AS n FROM law_relations WHERE to_law_id = ?').get(id)).toEqual({ n: 0 });
    });

    it('refuses to split a law that is itself a corollary, leaving it untouched', () => {
      const parent = insertLaw(null, 'A published parent law with words', 'published');
      const child = make();
      link(child, parent);
      const before = row(child);

      const result = admin.splitLaw(child, input());
      expect(result).toEqual({ outcome: 'invalid', status: 400, message: 'A corollary cannot have corollaries of its own' });
      expect(row(child)).toEqual(before);
    });

    it('rolls everything back when the parent would exceed five corollaries', () => {
      const id = make();
      for (let i = 0; i < 4; i += 1) link(insertLaw(null, `Existing in-review corollary number ${i}`, 'in_review'), id);
      const before = row(id);
      const lawCount = (db.prepare('SELECT COUNT(*) AS n FROM laws').get() as { n: number }).n;

      const result = admin.splitLaw(id, input());
      expect(result).toMatchObject({ outcome: 'invalid', status: 400, message: 'A law can have at most 5 corollaries' });
      expect(row(id)).toEqual(before);
      expect((db.prepare('SELECT COUNT(*) AS n FROM laws').get() as { n: number }).n).toBe(lawCount);
    });

    it('rolls back the parent update and every child when a later insert fails', () => {
      const id = make();
      const before = row(id);
      const lawCount = (db.prepare('SELECT COUNT(*) AS n FROM laws').get() as { n: number }).n;
      db.exec("CREATE TRIGGER fail_relation BEFORE INSERT ON law_relations WHEN NEW.note = 'Corollary 2' BEGIN SELECT RAISE(ABORT, 'boom'); END;");

      expect(() => admin.splitLaw(id, input())).toThrow('boom');
      expect(row(id)).toEqual(before);
      expect((db.prepare('SELECT COUNT(*) AS n FROM laws').get() as { n: number }).n).toBe(lawCount);
      expect(db.prepare('SELECT COUNT(*) AS n FROM law_relations WHERE to_law_id = ?').get(id)).toEqual({ n: 0 });
    });

    it('answers with the validation error of an invalid corollary and rolls back', () => {
      const id = make();
      const result = admin.splitLaw(id, input({ corollaries: [{ title: null, text: 'short' }] }));
      expect(result).toMatchObject({ outcome: 'invalid', status: 400 });
      expect(statusOf(id)).toBe('in_review');
    });

    it('reports whether a law is a corollary on an ordinary update, for the thank-you rule', () => {
      const parent = insertLaw(null, 'A published parent law with words', 'published');
      const child = insertLaw(null, 'An in-review child law with words', 'in_review');
      link(child, parent);
      const plain = insertLaw(null, 'A plain in-review law with words', 'in_review');
      const asChild = admin.updateLaw(child, { adminNotes: 'x' });
      const asPlain = admin.updateLaw(plain, { adminNotes: 'x' });
      expect(asChild.outcome === 'updated' && asChild.isCorollary).toBe(true);
      expect(asPlain.outcome === 'updated' && asPlain.isCorollary).toBe(false);
    });
  });

  describe('status cascade in updateLaw (plan section 2.2)', () => {
    let parent: number;
    let published: number;
    let review: number;
    let rejected: number;

    const setup = (parentStatus: string) => {
      parent = insertLaw('Parent', 'The parent law has enough text to be valid', parentStatus);
      published = insertLaw(null, 'A published corollary of the parent law', 'published');
      review = insertLaw(null, 'An in review corollary of the parent law', 'in_review');
      rejected = insertLaw(null, 'A rejected corollary of the parent law', 'rejected');
      for (const child of [published, review, rejected]) link(child, parent);
    };
    const childStatuses = () => [published, review, rejected].map(statusOf);

    it('moves published children with a published parent that goes back to review', () => {
      setup('published');
      const result = admin.updateLaw(parent, { status: 'in_review' });
      expect(childStatuses()).toEqual(['in_review', 'in_review', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(1);
    });

    it('rejects the published and in-review children of a published parent that is rejected', () => {
      setup('published');
      const result = admin.updateLaw(parent, { status: 'rejected' });
      expect(childStatuses()).toEqual(['rejected', 'rejected', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(2);
    });

    it('publishes in-review children when the parent is approved and leaves rejected ones rejected', () => {
      setup('in_review');
      const result = admin.updateLaw(parent, { status: 'published' });
      expect(childStatuses()).toEqual(['published', 'published', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(1);
    });

    it('rejects in-review children when an in-review parent is rejected and leaves published ones alone', () => {
      setup('in_review');
      const result = admin.updateLaw(parent, { status: 'rejected' });
      expect(childStatuses()).toEqual(['published', 'rejected', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(1);
    });

    it('treats approving a rejected parent like approving a submission', () => {
      setup('rejected');
      admin.updateLaw(parent, { status: 'published' });
      expect(childStatuses()).toEqual(['published', 'published', 'rejected']);
    });

    it('does nothing to children when the parent moves from rejected to review', () => {
      setup('rejected');
      const result = admin.updateLaw(parent, { status: 'in_review' });
      expect(childStatuses()).toEqual(['published', 'in_review', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(0);
    });

    it.each([
      ['an edit without a status', { adminNotes: 'note' }],
      ['the same status', { status: 'published' as const }],
    ])('does nothing to children for %s', (_name, update) => {
      setup('published');
      const result = admin.updateLaw(parent, update);
      expect(childStatuses()).toEqual(['published', 'in_review', 'rejected']);
      expect(result.outcome === 'updated' && result.cascaded).toBe(0);
    });

    it('bumps updated_at on cascaded children so open admin pages see a conflict, and updates the search index', async () => {
      setup('published');
      db.prepare("UPDATE laws SET text = 'Zebrafish corollary of the parent law' WHERE id = ?").run(published);
      expect(await searchHits('zebrafish')).toContain(published);
      admin.updateLaw(parent, { status: 'in_review' });
      expect(row(published).updated_at).not.toBe(GUARD);
      expect(await searchHits('zebrafish')).not.toContain(published);
    });

    it('does not cascade when the update conflicts', () => {
      setup('published');
      expect(admin.updateLaw(parent, { status: 'rejected', expectedUpdatedAt: 'stale' })).toEqual({ outcome: 'conflict' });
      expect(childStatuses()).toEqual(['published', 'in_review', 'rejected']);
    });

    it('does not cascade from a child to anything else', () => {
      setup('published');
      admin.updateLaw(published, { status: 'rejected' });
      expect(statusOf(parent)).toBe('published');
      expect(childStatuses()).toEqual(['rejected', 'in_review', 'rejected']);
    });

    describe('publishing a child', () => {
      it.each(['in_review', 'rejected'])('is refused with the parent %s, and nothing changes', (parentStatus) => {
        setup(parentStatus);
        const before = row(review);
        const result = admin.updateLaw(review, { status: 'published', adminNotes: 'never saved' });
        expect(result).toEqual({ outcome: 'parent_not_published', parentId: parent });
        expect(row(review)).toEqual(before);
      });

      it('is allowed when the parent is published', () => {
        setup('published');
        expect(admin.updateLaw(review, { status: 'published' }).outcome).toBe('updated');
        expect(admin.updateLaw(rejected, { status: 'published' }).outcome).toBe('updated');
        expect(childStatuses()).toEqual(['published', 'published', 'published']);
      });

      it('is not refused when the child is already published and only edited', () => {
        setup('in_review');
        expect(admin.updateLaw(published, { status: 'published', adminNotes: 'fine' }).outcome).toBe('updated');
      });

      it('lets an unpublished child be rejected or edited under an unpublished parent', () => {
        setup('in_review');
        expect(admin.updateLaw(review, { status: 'rejected' }).outcome).toBe('updated');
        expect(admin.updateLaw(rejected, { adminNotes: 'x' }).outcome).toBe('updated');
      });
    });
  });
});
