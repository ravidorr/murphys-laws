import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { AdminLawService } from '../../src/services/admin-laws.service.ts';
import { CategoryService } from '../../src/services/categories.service.ts';
import { LawService } from '../../src/services/laws.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

type Db = InstanceType<typeof Database>;

describe('AdminLawService (real migrated schema)', () => {
  let db: Db;
  let admin: AdminLawService;
  let laws: LawService;

  const insertLaw = (title: string | null, text: string, status: string, createdAt = '2030-01-01T00:00:00.000Z') =>
    Number(
      db
        .prepare("INSERT INTO laws (title, text, status, first_seen_file_path, created_at, updated_at) VALUES (?, ?, ?, 'web-submission', ?, ?)")
        .run(title, text, status, createdAt, createdAt).lastInsertRowid,
    );
  const isPublic = async (id: number) => Boolean(await laws.getLaw(id));
  const searchHits = async (q: string) => (await laws.listLaws({ limit: 25, offset: 0, q })).data.map((l: { id: number }) => l.id);

  beforeEach(() => {
    db = createMigratedDb();
    admin = new AdminLawService(db);
    laws = new LawService(db);
  });

  it('lists by status with attributions and categories using the real column names', () => {
    const pending = insertLaw('Pending A', 'Zebrafish toast always lands butter side down', 'in_review', '2030-01-02T00:00:00.000Z');
    insertLaw('Pending B', 'Queues move slower when you join them', 'in_review', '2030-01-03T00:00:00.000Z');
    db.prepare("INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, 'Ann', 'email', 'ann@example.com')").run(pending);
    const category = db.prepare('SELECT id, title FROM categories LIMIT 1').get() as { id: number; title: string };
    db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(pending, category.id);

    const result = admin.listLaws({ status: 'in_review', q: '', limit: 10, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.data[1].id).toBe(pending);
    expect(result.data[1].attributions).toEqual([{ name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' }]);
    expect(result.data[1].categories).toEqual([{ id: category.id, name: category.title }]);
    expect(result.data[0].attributions).toEqual([]);
    expect(result.counts.in_review).toBe(2);
    expect(result.counts.published).toBeGreaterThan(0);
  });

  it('lists all statuses, paginates and escapes LIKE wildcards in search', () => {
    const a = insertLaw(null, '100% of zebrafish toast lands butter side down', 'in_review', '2030-01-05T00:00:00.000Z');
    insertLaw(null, 'Plain zebrafish law about nothing special', 'rejected', '2030-01-04T00:00:00.000Z');

    expect(admin.listLaws({ status: 'all', q: '', limit: 1, offset: 1 }).data[0].text).toContain('Plain zebrafish');
    expect(admin.listLaws({ status: 'all', q: '100%', limit: 10, offset: 0 }).data.map((l) => l.id)).toEqual([a]);
    expect(admin.listLaws({ status: 'all', q: 'zebrafish_', limit: 10, offset: 0 }).total).toBe(0);
    expect(admin.listLaws({ status: 'all', q: 'no-such-text-anywhere', limit: 10, offset: 0 })).toMatchObject({ data: [], total: 0 });
    expect(admin.listLaws({ status: 'rejected', q: '', limit: 10, offset: 9999 })).toMatchObject({ data: [], total: 1 });
  });

  it('approving makes a submitted law public and searchable; rejecting hides it again', async () => {
    const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'in_review');
    expect(await isPublic(id)).toBe(false);
    expect(await searchHits('zebrafish')).not.toContain(id);

    const approved = admin.updateLaw(id, { status: 'published' });
    expect(approved.outcome).toBe('updated');
    expect(await isPublic(id)).toBe(true);
    expect(await searchHits('zebrafish')).toContain(id);

    admin.updateLaw(id, { status: 'rejected' });
    expect(await isPublic(id)).toBe(false);
    expect(await searchHits('zebrafish')).not.toContain(id);
  });

  it('keeps a published law searchable after an update that leaves its text and title alone', async () => {
    const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'published');
    admin.updateLaw(id, { adminNotes: 'checked' });
    admin.updateLaw(id, { title: 'Fish' });
    expect(await searchHits('zebrafish')).toContain(id);
  });

  it('indexes a law only while it is published', () => {
    const indexed = () => db.prepare("SELECT rowid FROM laws_fts WHERE laws_fts MATCH 'zebrafish'").all();
    const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'in_review');
    admin.updateLaw(id, { adminNotes: 'still pending' });
    expect(indexed()).toEqual([]);
    admin.updateLaw(id, { status: 'published' });
    expect(indexed()).toEqual([{ rowid: id }]);
    admin.updateLaw(id, { status: 'in_review' });
    expect(indexed()).toEqual([]);
  });

  it('editing a published law refreshes the search index', async () => {
    const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'published');
    expect(await searchHits('zebrafish')).toContain(id);

    admin.updateLaw(id, { text: 'Narwhals always surface right after the camera is packed' });
    expect(await searchHits('zebrafish')).not.toContain(id);
    expect(await searchHits('narwhals')).toContain(id);
  });

  it('updates fields, notes and updated_at, and returns the updated law', () => {
    const id = insertLaw('T', 'Original law text for testing', 'in_review');
    const result = admin.updateLaw(id, { status: 'published', title: null, text: 'New text of the law', adminNotes: 'ok' });
    expect(result.outcome).toBe('updated');
    if (result.outcome === 'updated') {
      expect(result.previousStatus).toBe('in_review');
      expect(result.law).toMatchObject({ id, status: 'published', title: null, text: 'New text of the law', admin_notes: 'ok' });
      expect(result.law.updated_at).not.toBe('2030-01-01T00:00:00.000Z');
    }
  });

  it('updates a single field and reports unknown ids', () => {
    const id = insertLaw(null, 'Another law about queues', 'in_review');
    const result = admin.updateLaw(id, { title: 'Titled' });
    expect(result.outcome === 'updated' && result.law).toMatchObject({ title: 'Titled', status: 'in_review' });
    expect(admin.updateLaw(999999, { status: 'rejected' })).toEqual({ outcome: 'not_found' });
  });

  it('detects concurrent edits through expectedUpdatedAt', () => {
    const id = insertLaw(null, 'Another law about queues', 'in_review');
    expect(admin.updateLaw(id, { title: 'Stale', expectedUpdatedAt: 'not-the-current-value' })).toEqual({ outcome: 'conflict' });
    expect(admin.updateLaw(id, { title: 'Fresh', expectedUpdatedAt: '2030-01-01T00:00:00.000Z' }).outcome).toBe('updated');
    expect(admin.updateLaw(999999, { title: 'x', expectedUpdatedAt: 'whatever' })).toEqual({ outcome: 'not_found' });
  });

  it('lets only one of two updates with the same expectedUpdatedAt win', () => {
    const id = insertLaw(null, 'Another law about queues', 'in_review');
    const guard = '2030-01-01T00:00:00.000Z';
    const first = admin.updateLaw(id, { title: 'First', expectedUpdatedAt: guard });
    const second = admin.updateLaw(id, { title: 'Second', expectedUpdatedAt: guard });
    expect([first.outcome, second.outcome].sort()).toEqual(['conflict', 'updated']);
    expect(admin.listLaws({ status: 'all', q: 'queues', limit: 5, offset: 0 }).data[0].title).toBe('First');
  });

  it('records the thank-you email once without touching updated_at', () => {
    const id = insertLaw(null, 'Another law about queues', 'published');
    const before = admin.listLaws({ status: 'published', q: 'queues', limit: 1, offset: 0 }).data[0];
    expect(before.approval_email_sent_at).toBeNull();

    admin.markApprovalEmailSent(id);
    const sentAt = admin.listLaws({ status: 'published', q: 'queues', limit: 1, offset: 0 }).data[0];
    expect(sentAt.approval_email_sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sentAt.updated_at).toBe(before.updated_at);

    admin.markApprovalEmailSent(id);
    expect(admin.listLaws({ status: 'published', q: 'queues', limit: 1, offset: 0 }).data[0].approval_email_sent_at).toBe(sentAt.approval_email_sent_at);
  });

  describe('changing the category', () => {
    const categories = () => db.prepare('SELECT id, title, slug FROM categories ORDER BY id LIMIT 2').all() as { id: number; title: string; slug: string }[];
    const categoryIdsOf = (id: number) => (admin.listLaws({ status: 'all', q: '', limit: 100, offset: 0 }).data.find((l) => l.id === id)?.categories ?? []).map((c) => c.id);

    it('replaces the categories and reports the previous ones', () => {
      const [first, second] = categories();
      const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'published');
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(id, first.id);

      const result = admin.updateLaw(id, { categoryId: second.id });
      expect(result.outcome).toBe('updated');
      if (result.outcome === 'updated') {
        expect(result.previousCategoryIds).toEqual([first.id]);
        expect(result.law.categories).toEqual([{ id: second.id, name: second.title }]);
        expect(result.law.updated_at).not.toBe('2030-01-01T00:00:00.000Z');
      }
      expect(categoryIdsOf(id)).toEqual([second.id]);
    });

    it('collapses several categories into the chosen one and categorises an uncategorised law', () => {
      const [first, second] = categories();
      const multi = insertLaw(null, 'Law that sits in two categories at once', 'published');
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?), (?, ?)').run(multi, first.id, multi, second.id);
      const none = insertLaw(null, 'Law that has no category at all so far', 'in_review');

      admin.updateLaw(multi, { categoryId: first.id });
      const result = admin.updateLaw(none, { categoryId: second.id });
      expect(categoryIdsOf(multi)).toEqual([first.id]);
      expect(categoryIdsOf(none)).toEqual([second.id]);
      expect(result.outcome === 'updated' && result.previousCategoryIds).toEqual([]);
    });

    it('moves the law between public category listings and counts, and the search filter', async () => {
      const [first, second] = categories();
      const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'published');
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(id, first.id);
      const categoryService = new CategoryService(db);
      const count = async (categoryId: number) => ((await categoryService.listCategories()) as { id: number; law_count: number }[]).find((c) => c.id === categoryId)?.law_count ?? 0;
      const inCategory = async (categoryId: number) => (await laws.listLaws({ limit: 100, offset: 0, categoryId })).data.map((l: { id: number }) => l.id);
      const [firstBefore, secondBefore] = [await count(first.id), await count(second.id)];
      expect(await inCategory(first.id)).toContain(id);

      admin.updateLaw(id, { categoryId: second.id });
      expect(await searchHits('zebrafish')).toContain(id);
      expect(await inCategory(first.id)).not.toContain(id);
      expect(await inCategory(second.id)).toContain(id);
      expect(await count(first.id)).toBe(firstBefore - 1);
      expect(await count(second.id)).toBe(secondBefore + 1);
      expect((await laws.listLaws({ limit: 100, offset: 0, categorySlug: second.slug, q: 'zebrafish' })).data.map((l: { id: number }) => l.id)).toEqual([id]);
      expect((await laws.getLaw(id))?.category_id).toBe(second.id);
    });

    it('rejects an unknown category without changing anything', () => {
      const [first] = categories();
      const id = insertLaw('Fish', 'Zebrafish always escape the net you bought yesterday', 'in_review');
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(id, first.id);

      expect(admin.updateLaw(id, { categoryId: 999999, title: 'Changed', status: 'published' })).toEqual({ outcome: 'invalid_category' });
      expect(categoryIdsOf(id)).toEqual([first.id]);
      expect(admin.listLaws({ status: 'all', q: 'Zebrafish', limit: 5, offset: 0 }).data[0]).toMatchObject({ title: 'Fish', status: 'in_review' });
    });

    it('keeps the old categories when a concurrent edit wins', () => {
      const [first, second] = categories();
      const id = insertLaw(null, 'Another law about queues', 'in_review');
      db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)').run(id, first.id);
      expect(admin.updateLaw(id, { categoryId: second.id, expectedUpdatedAt: 'stale' })).toEqual({ outcome: 'conflict' });
      expect(categoryIdsOf(id)).toEqual([first.id]);
    });

    it('lists every category for the selector, and returns them with the law list', () => {
      const all = admin.listCategories();
      expect(all.length).toBeGreaterThan(1);
      expect(all[0]).toEqual({ id: expect.any(Number), slug: expect.any(String), name: expect.any(String) });
      expect(admin.listLaws({ status: 'all', q: '', limit: 1, offset: 0 }).categories).toEqual(all);
    });
  });

  it('rejects an invalid status at the database level', () => {
    const id = insertLaw(null, 'Another law about queues', 'in_review');
    expect(() => admin.updateLaw(id, { status: 'weird' as never })).toThrow();
  });

  describe('law of the day', () => {
    const today = () => new Date().toISOString().split('T')[0];
    let featured: number;
    let other: number;

    beforeEach(() => {
      // Isolate from the seeded laws so the replacement is predictable.
      db.exec("DELETE FROM laws WHERE status = 'published'");
      featured = insertLaw('Featured', 'Zebrafish law that is featured today', 'published');
      other = insertLaw('Other', 'Narwhal law that is available as a replacement', 'published');
      db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(featured, today());
    });

    it('picks a new published law once after the featured law is rejected, and keeps it', async () => {
      expect((await laws.getLawOfTheDay())?.law.id).toBe(featured);

      admin.updateLaw(featured, { status: 'rejected' });
      expect((await laws.getLawOfTheDay())?.law.id).toBe(other);
      expect((await laws.getLawOfTheDay())?.law.id).toBe(other);
      expect(db.prepare('SELECT COUNT(*) AS n FROM law_of_the_day_history WHERE featured_date = ?').get(today())).toEqual({ n: 2 });
    });

    it('does not override the newer pick when the rejected law is approved again', async () => {
      admin.updateLaw(featured, { status: 'rejected' });
      await laws.getLawOfTheDay();
      admin.updateLaw(featured, { status: 'published' });
      expect((await laws.getLawOfTheDay())?.law.id).toBe(other);
    });

    it('returns null instead of throwing when no published law is left', async () => {
      admin.updateLaw(featured, { status: 'rejected' });
      admin.updateLaw(other, { status: 'in_review' });
      expect(await laws.getLawOfTheDay()).toBeNull();
    });
  });
});
