import type Database from 'better-sqlite3';
import { canOfferSplit, parseCorollaries, type CorollaryItem } from '../../../shared/modules/corollary-parser.ts';
import {
  COROLLARY_RELATION,
  createCorollaryChildren,
  hasCorollaries,
  isChild,
  LAW_RELATION_ERROR_STATUS,
  LawRelationError,
  type CorollaryChildInput,
  type RelatedLaw,
} from './law-relations.service.ts';

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
  /** Replaces the law's categories with this single existing category. */
  categoryId?: number;
  /** When set, the update only applies if the law still has this updated_at (optimistic concurrency). */
  expectedUpdatedAt?: string;
}

interface AdminLawRow {
  id: number;
  title: string | null;
  text: string;
  status: AdminLawStatus;
  admin_notes: string | null;
  first_seen_file_path: string | null;
  approval_email_sent_at: string | null;
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

export interface AdminLaw extends AdminLawRow {
  attributions: { name: string | null; contact_type: string | null; contact_value: string | null }[];
  categories: { id: number; name: string }[];
}

/** What the review screen is seeded with: the text before the bullets and one entry per bullet. */
export interface CorollaryCandidates {
  parent_text: string;
  items: CorollaryItem[];
}

export interface AdminListedLaw extends AdminLaw {
  /** Only on in-review top-level laws whose text has a parent sentence followed by bullets. A seed, never applied unreviewed. */
  corollary_candidates?: CorollaryCandidates;
}

export type AdminUpdateResult =
  | {
      outcome: 'updated';
      /** With a fresh split seed when the saved text still has corollaries, so the page need not reload to offer it. */
      law: AdminListedLaw;
      previousStatus: AdminLawStatus;
      previousCategoryIds: number[];
      /** True when the law is a corollary of another law. */
      isCorollary: boolean;
      /** How many corollaries changed status because the law's own status changed. */
      cascaded: number;
    }
  | { outcome: 'invalid_category' }
  | { outcome: 'parent_not_published'; parentId: number }
  | { outcome: 'conflict' }
  | { outcome: 'not_found' };

/** The explicit result of the moderator's review. Nothing here is parsed again on the server. */
export interface AdminSplitInput {
  /** The updated_at the page loaded; the split only applies if the law still has it. */
  expectedUpdatedAt: string;
  /** Replaces the title when given; null clears it; undefined keeps it. */
  title?: string | null;
  /** The parent's law text once the corollaries are taken out. */
  parentText: string;
  /** Replaces the law's categories with this single existing category. The children copy the result. */
  categoryId?: number;
  adminNotes?: string | null;
  corollaries: CorollaryChildInput[];
}

export type AdminSplitResult =
  | { outcome: 'split'; law: AdminLaw; children: RelatedLaw[]; previousStatus: AdminLawStatus; previousCategoryIds: number[] }
  | { outcome: 'invalid'; status: 400 | 404; message: string }
  | { outcome: 'invalid_category' }
  | { outcome: 'conflict' }
  | { outcome: 'not_found' };

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const LAW_COLUMNS = 'id, title, text, status, admin_notes, first_seen_file_path, approval_email_sent_at, created_at, updated_at';

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

    return { data: this.attachCandidates(this.attachDetails(rows)), total, counts: this.statusCounts(), categories: this.listCategories() };
  }

  /** Every category a moderator may pick, in the order shown in the selector. */
  listCategories() {
    return this.db.prepare('SELECT id, slug, title AS name FROM categories ORDER BY title').all() as { id: number; slug: string; name: string }[];
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
    sets.push(`updated_at = ${NOW}`);

    const apply = this.db.transaction((): AdminUpdateResult => {
      const before = this.db.prepare('SELECT status, updated_at FROM laws WHERE id = ?').get(id) as { status: AdminLawStatus; updated_at: string } | undefined;
      if (!before) {
        return { outcome: 'not_found' };
      }

      const publishing = update.status === 'published' && before.status !== 'published';
      const unpublishedParent = publishing ? this.findUnpublishedParent(id) : undefined;
      if (unpublishedParent !== undefined) {
        // A page that is out of date gets the reload that a conflict triggers, not a refusal about a state it never saw.
        return update.expectedUpdatedAt !== undefined && update.expectedUpdatedAt !== before.updated_at
          ? { outcome: 'conflict' }
          : { outcome: 'parent_not_published', parentId: unpublishedParent };
      }

      if (update.categoryId !== undefined && !this.db.prepare('SELECT 1 FROM categories WHERE id = ?').get(update.categoryId)) {
        return { outcome: 'invalid_category' };
      }
      const previousCategoryIds = this.categoryIdsOf(id);

      const guard = update.expectedUpdatedAt === undefined ? '' : ' AND updated_at = ?';
      const guardParams = update.expectedUpdatedAt === undefined ? [] : [update.expectedUpdatedAt];
      const result = this.db.prepare(`UPDATE laws SET ${sets.join(', ')} WHERE id = ?${guard}`).run(...params, id, ...guardParams);
      if (result.changes === 0) {
        return { outcome: 'conflict' };
      }

      if (update.categoryId !== undefined) {
        this.replaceCategory(id, update.categoryId);
      }

      const cascaded = update.status === undefined ? 0 : this.cascadeToCorollaries(id, before.status, update.status);

      const row = this.db.prepare(`SELECT ${LAW_COLUMNS} FROM laws WHERE id = ?`).get(id) as AdminLawRow;
      return {
        outcome: 'updated',
        law: this.attachCandidates(this.attachDetails([row]))[0],
        previousStatus: before.status,
        previousCategoryIds,
        isCorollary: isChild(this.db, id),
        cascaded,
      };
    });
    return apply();
  }

  /**
   * Publishes a law in review as a parent and creates its corollaries as published laws, atomically.
   * The parent is published first because a published corollary needs a published parent. Any failure, including a
   * broken corollary rule, rolls the whole split back and leaves the law exactly as it was.
   */
  splitLaw(id: number, split: AdminSplitInput): AdminSplitResult {
    // The controller enforces the same limit; a caller that skips it would otherwise publish the law with nothing split.
    if (split.corollaries.length === 0) {
      return { outcome: 'invalid', status: 400, message: 'A split needs at least one corollary' };
    }
    const apply = this.db.transaction((): AdminSplitResult => {
      const before = this.db.prepare('SELECT status, updated_at FROM laws WHERE id = ?').get(id) as { status: AdminLawStatus; updated_at: string } | undefined;
      if (!before) {
        return { outcome: 'not_found' };
      }
      if (before.status !== 'in_review') {
        // A law that someone else already split, approved or rejected is a stale page, not a bad request: the admin page
        // reloads on a conflict. Only a law the page could have seen as current is refused for its status.
        return before.updated_at === split.expectedUpdatedAt
          ? { outcome: 'invalid', status: 400, message: 'Only a law in review can be split' }
          : { outcome: 'conflict' };
      }
      if (split.categoryId !== undefined && !this.db.prepare('SELECT 1 FROM categories WHERE id = ?').get(split.categoryId)) {
        return { outcome: 'invalid_category' };
      }
      if (hasCorollaries(this.db, id)) {
        // Its existing corollaries would stay in review while the parent is published, and would count toward the maximum.
        return { outcome: 'invalid', status: 400, message: 'A law that already has corollaries cannot be split; approve it instead' };
      }
      const previousCategoryIds = this.categoryIdsOf(id);

      const sets = ['text = ?', "status = 'published'"];
      const params: (string | number | null)[] = [split.parentText];
      if (split.title !== undefined) {
        sets.push('title = ?');
        params.push(split.title);
      }
      if (split.adminNotes !== undefined) {
        sets.push('admin_notes = ?');
        params.push(split.adminNotes);
      }
      sets.push(`updated_at = ${NOW}`);
      const result = this.db.prepare(`UPDATE laws SET ${sets.join(', ')} WHERE id = ? AND updated_at = ?`).run(...params, id, split.expectedUpdatedAt);
      if (result.changes === 0) {
        return { outcome: 'conflict' };
      }

      if (split.categoryId !== undefined) {
        this.replaceCategory(id, split.categoryId);
      }
      // The first attribution that has a name: an email-only row ahead of it must not drop the credit.
      const submitter = this.db
        .prepare("SELECT name FROM attributions WHERE law_id = ? AND trim(coalesce(name, '')) != '' ORDER BY id LIMIT 1")
        .get(id) as { name: string } | undefined;
      const children = createCorollaryChildren(this.db, id, split.corollaries, {
        status: 'published',
        categoryIds: this.categoryIdsOf(id),
        submitterName: submitter?.name ?? null,
      });

      const row = this.db.prepare(`SELECT ${LAW_COLUMNS} FROM laws WHERE id = ?`).get(id) as AdminLawRow;
      return { outcome: 'split', law: this.attachDetails([row])[0], children, previousStatus: before.status, previousCategoryIds };
    });

    try {
      return apply();
    } catch (error) {
      if (error instanceof LawRelationError) {
        return { outcome: 'invalid', status: LAW_RELATION_ERROR_STATUS[error.code], message: error.message };
      }
      throw error;
    }
  }

  /** Records the thank-you without touching updated_at, so open admin pages do not see a false conflict. */
  markApprovalEmailSent(id: number): void {
    this.db
      .prepare("UPDATE laws SET approval_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND approval_email_sent_at IS NULL")
      .run(id);
  }

  private categoryIdsOf(lawId: number): number[] {
    return (this.db.prepare('SELECT category_id FROM law_categories WHERE law_id = ? ORDER BY category_id').all(lawId) as { category_id: number }[]).map((r) => r.category_id);
  }

  private replaceCategory(lawId: number, categoryId: number): void {
    // Category listings, counts and searches all read law_categories, so replacing the rows updates them everywhere.
    this.db.prepare('DELETE FROM law_categories WHERE law_id = ?').run(lawId);
    this.db.prepare('INSERT INTO law_categories (law_id, category_id, position) VALUES (?, ?, 0)').run(lawId, categoryId);
  }

  /** The id of a parent of this law that is not published, or undefined when the law has no such parent. */
  private findUnpublishedParent(lawId: number): number | undefined {
    const row = this.db
      .prepare(
        `SELECT p.id FROM law_relations r JOIN laws p ON p.id = r.to_law_id
         WHERE r.from_law_id = ? AND r.relation_type = ? AND p.status != 'published'
         ORDER BY r.id LIMIT 1`,
      )
      .get(lawId, COROLLARY_RELATION) as { id: number } | undefined;
    return row?.id;
  }

  /**
   * Carries a parent's status change to its corollaries. Rejected corollaries never come back on their own.
   * Returns the number of corollary rows actually updated.
   *  - the parent leaves published: its published corollaries follow it (to review or to rejected);
   *  - the parent is approved: its in-review corollaries are published;
   *  - the parent is rejected: its in-review corollaries are rejected too.
   * Each moved corollary gets a new updated_at, so an admin page still showing it sees a conflict, not a stale edit.
   */
  private cascadeToCorollaries(parentId: number, from: AdminLawStatus, to: AdminLawStatus): number {
    if (from === to) {
      return 0;
    }
    const moving: AdminLawStatus[] = [];
    if (from === 'published') moving.push('published');
    if (to === 'published' || to === 'rejected') moving.push('in_review');
    if (moving.length === 0) {
      return 0;
    }
    const placeholders = moving.map(() => '?').join(',');
    return this.db
      .prepare(
        `UPDATE laws SET status = ?, updated_at = ${NOW}
         WHERE status IN (${placeholders})
           AND id IN (SELECT from_law_id FROM law_relations WHERE to_law_id = ? AND relation_type = ?)`,
      )
      .run(to, ...moving, parentId, COROLLARY_RELATION).changes;
  }

  /** Adds the split seed to in-review laws that have no corollary relation on either side. */
  private attachCandidates(laws: AdminLaw[]): AdminListedLaw[] {
    const reviewable = laws.filter((law) => law.status === 'in_review');
    if (reviewable.length === 0) {
      return laws;
    }
    const placeholders = reviewable.map(() => '?').join(',');
    const ids = reviewable.map((law) => law.id);
    // A corollary cannot be split, and a law that already has corollaries (for example submitted ones) would get a
    // second set of children from the same bullets.
    const related = new Set<number>();
    for (const r of this.db
      .prepare(
        `SELECT from_law_id, to_law_id FROM law_relations
         WHERE relation_type = ? AND (from_law_id IN (${placeholders}) OR to_law_id IN (${placeholders}))`,
      )
      .all(COROLLARY_RELATION, ...ids, ...ids) as { from_law_id: number; to_law_id: number }[]) {
      related.add(r.from_law_id);
      related.add(r.to_law_id);
    }
    return laws.map((law): AdminListedLaw => {
      if (law.status !== 'in_review' || related.has(law.id)) {
        return law;
      }
      const parsed = parseCorollaries(law.text);
      return canOfferSplit(parsed) ? { ...law, corollary_candidates: { parent_text: parsed.parentText, items: parsed.items } } : law;
    });
  }

  private statusCounts(): Record<AdminLawStatus, number> {
    const counts: Record<AdminLawStatus, number> = { published: 0, in_review: 0, rejected: 0 };
    const rows = this.db.prepare('SELECT status, COUNT(*) AS n FROM laws GROUP BY status').all() as { status: AdminLawStatus; n: number }[];
    // laws.status has a CHECK constraint, so every row is one of the three known values.
    for (const row of rows) {
      counts[row.status] = row.n;
    }
    return counts;
  }

  private attachDetails(rows: AdminLawRow[]): AdminLaw[] {
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
