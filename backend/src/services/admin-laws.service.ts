import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

export const ADMIN_LAW_STATUSES = ['published', 'in_review', 'rejected'] as const;
export type AdminLawStatus = (typeof ADMIN_LAW_STATUSES)[number];

export interface AdminListParams {
  status: AdminLawStatus | 'all';
  q: string;
  limit: number;
  offset: number;
}

export interface AdminLawUpdate {
  status?: AdminLawStatus;
  title?: string | null;
  text?: string;
  adminNotes?: string | null;
}

interface AdminLawRow {
  id: number;
  title: string | null;
  text: string;
  status: AdminLawStatus;
  admin_notes: string | null;
  first_seen_file_path: string | null;
  created_at: string;
  updated_at: string;
}

interface AttributionRow {
  law_id: number;
  name: string | null;
  contact_type: string | null;
  contact_value: string | null;
}

interface CategoryRow {
  law_id: number;
  id: number;
  name: string;
}

const LAW_COLUMNS = 'id, title, text, status, admin_notes, first_seen_file_path, created_at, updated_at';

export class AdminLawService {
  db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  listLaws({ status, q, limit, offset }: AdminListParams) {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push("(title LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { total } = this.db.prepare(`SELECT COUNT(*) AS total FROM laws ${where}`).get(...params) as { total: number };
    const rows = this.db
      .prepare(`SELECT ${LAW_COLUMNS} FROM laws ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as AdminLawRow[];

    return { data: this.attachDetails(rows), total, counts: this.statusCounts() };
  }

  updateLaw(id: number, update: AdminLawUpdate) {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (update.status !== undefined) {
      sets.push('status = ?');
      params.push(update.status);
    }
    if (update.title !== undefined) {
      sets.push('title = ?');
      params.push(update.title);
    }
    if (update.text !== undefined) {
      sets.push('text = ?');
      params.push(update.text);
    }
    if (update.adminNotes !== undefined) {
      sets.push('admin_notes = ?');
      params.push(update.adminNotes);
    }
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");

    const result = this.db.prepare(`UPDATE laws SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
    if (result.changes === 0) {
      return null;
    }

    const row = this.db.prepare(`SELECT ${LAW_COLUMNS} FROM laws WHERE id = ?`).get(id) as AdminLawRow;
    return this.attachDetails([row])[0];
  }

  private statusCounts(): Record<AdminLawStatus, number> {
    const counts: Record<AdminLawStatus, number> = { published: 0, in_review: 0, rejected: 0 };
    const rows = this.db.prepare('SELECT status, COUNT(*) AS n FROM laws GROUP BY status').all() as { status: AdminLawStatus; n: number }[];
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status] = row.n;
      }
    }
    return counts;
  }

  private attachDetails(rows: AdminLawRow[]) {
    if (rows.length === 0) {
      return [];
    }
    const placeholders = rows.map(() => '?').join(',');
    const ids = rows.map((row) => row.id);

    const attributions = this.db
      .prepare(`SELECT law_id, name, contact_type, contact_value FROM attributions WHERE law_id IN (${placeholders})`)
      .all(...ids) as AttributionRow[];
    const categories = this.db
      .prepare(`SELECT lc.law_id, c.id, c.title AS name FROM law_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.law_id IN (${placeholders})`)
      .all(...ids) as CategoryRow[];

    return rows.map((row) => ({
      ...row,
      attributions: attributions
        .filter((a) => a.law_id === row.id)
        .map(({ name, contact_type, contact_value }) => ({ name, contact_type, contact_value })),
      categories: categories.filter((c) => c.law_id === row.id).map(({ id: categoryId, name }) => ({ id: categoryId, name })),
    }));
  }
}
