import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { AdminLawService } from '../../src/services/admin-laws.service.ts';

describe('AdminLawService', () => {
  let db: InstanceType<typeof Database>;
  let service: AdminLawService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE laws (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, text TEXT NOT NULL,
        status TEXT DEFAULT 'published', admin_notes TEXT, first_seen_file_path TEXT,
        created_at TEXT DEFAULT '2026-01-01T00:00:00.000Z', updated_at TEXT DEFAULT '2026-01-01T00:00:00.000Z'
      );
      CREATE TABLE attributions (id INTEGER PRIMARY KEY, law_id INTEGER, name TEXT, contact_type TEXT, contact_value TEXT);
      CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL);
      CREATE TABLE law_categories (law_id INTEGER, category_id INTEGER);
      INSERT INTO laws (id, title, text, status, created_at) VALUES
        (1, 'Pub', 'Published law text', 'published', '2026-01-01'),
        (2, 'Pending A', '100% of toast lands butter-side down', 'in_review', '2026-01-02'),
        (3, NULL, 'Pending B about queues moving slower', 'in_review', '2026-01-03'),
        (4, 'Bad', 'Rejected law text here', 'rejected', '2026-01-04'),
        (5, 'Odd', 'Unknown status row text', 'weird', '2026-01-05');
      INSERT INTO attributions VALUES (1, 2, 'Ann', 'email', 'ann@example.com');
      INSERT INTO categories VALUES (7, 'food', 'Food');
      INSERT INTO law_categories VALUES (2, 7);
    `);
    service = new AdminLawService(db);
  });

  it('lists by status newest first with details and counts', () => {
    const result = service.listLaws({ status: 'in_review', q: '', limit: 10, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.data.map((l) => l.id)).toEqual([3, 2]);
    expect(result.data[1].attributions).toEqual([{ name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' }]);
    expect(result.data[1].categories).toEqual([{ id: 7, name: 'Food' }]);
    expect(result.data[0].attributions).toEqual([]);
    expect(result.counts).toEqual({ published: 1, in_review: 2, rejected: 1 });
  });

  it('lists all statuses, paginates and escapes LIKE wildcards in search', () => {
    expect(service.listLaws({ status: 'all', q: '', limit: 2, offset: 1 }).data.map((l) => l.id)).toEqual([4, 3]);
    expect(service.listLaws({ status: 'all', q: '100%', limit: 10, offset: 0 }).data.map((l) => l.id)).toEqual([2]);
    expect(service.listLaws({ status: 'all', q: 'zzz', limit: 10, offset: 0 })).toMatchObject({ data: [], total: 0 });
  });

  it('updates fields and returns the updated law', () => {
    const law = service.updateLaw(2, { status: 'published', title: null, text: 'New text of the law', adminNotes: 'ok' });
    expect(law).toMatchObject({ id: 2, status: 'published', title: null, text: 'New text of the law', admin_notes: 'ok' });
    expect(law!.updated_at).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('updates a single field and returns null for unknown ids', () => {
    expect(service.updateLaw(3, { title: 'Titled' })).toMatchObject({ id: 3, title: 'Titled', status: 'in_review' });
    expect(service.updateLaw(999, { status: 'rejected' })).toBeNull();
  });
});
