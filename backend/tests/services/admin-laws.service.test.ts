import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { AdminLawService } from '../../src/services/admin-laws.service.ts';
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

  it('rejects an invalid status at the database level', () => {
    const id = insertLaw(null, 'Another law about queues', 'in_review');
    expect(() => admin.updateLaw(id, { status: 'weird' as never })).toThrow();
  });

  it('keeps law of the day available after the featured law is rejected', async () => {
    const featured = insertLaw('Featured', 'Zebrafish law that is featured today', 'published');
    const other = insertLaw('Other', 'Narwhal law that is available as a replacement', 'published');
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(featured, today);

    expect((await laws.getLawOfTheDay())?.law.id).toBe(featured);

    admin.updateLaw(featured, { status: 'rejected' });
    const replacement = await laws.getLawOfTheDay();
    expect(replacement).not.toBeNull();
    expect(replacement?.law.id).not.toBe(featured);
    expect([other, replacement?.law.id]).toContain(replacement?.law.id);
  });
});
