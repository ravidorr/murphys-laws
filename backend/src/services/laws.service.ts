import type Database from 'better-sqlite3';
import { safeParseJsonArray } from '../utils/helpers.ts';
import {
  getCorollaries,
  getCorollaryOf,
  createCorollaryChildren,
  COROLLARY_RELATION,
  LawRelationError,
  type CorollaryChildInput,
  type RelatedLaw
} from './law-relations.service.ts';
import { isUsefulDuplicateMatch, scoreDuplicateSimilarity } from '../../../shared/modules/duplicate-similarity.ts';

type Db = InstanceType<typeof Database>;

/**
 * Appended to a query over `laws l` to leave out corollaries: laws that are the "from" side of a COROLLARY_OF
 * relation whose parent is published. A corollary under an unpublished parent has no page to point at, so it stays
 * an ordinary law (the same published-parent rule that sets corollary_of_id).
 */
const EXCLUDE_PUBLISHED_COROLLARIES = ` AND NOT EXISTS (SELECT 1 FROM law_relations r JOIN laws p ON p.id = r.to_law_id WHERE r.from_law_id = l.id AND r.relation_type = '${COROLLARY_RELATION}' AND p.status = 'published')`;

export interface ListLawsParams {
  limit: number;
  offset: number;
  q?: string;
  categoryId?: number | null;
  categorySlug?: string | null;
  attribution?: string;
  sort?: string;
  order?: string;
  /** When true, exclude laws that are corollaries (from_law_id in law_relations with COROLLARY_OF) */
  excludeCorollaries?: boolean;
}

/** Law shape returned by getLaw / getLawOfTheDay; compatible with IFeedLawService */
export interface LawRow {
  id: number;
  title?: string | null;
  text: string;
  [key: string]: unknown;
}

interface CountRow {
  total: number;
}

interface ListLawRow {
  id: number;
  title?: string | null;
  text: string;
  file_path?: string | null;
  line_number?: number | null;
  created_at: string;
  attributions: string;
  upvotes: number;
  downvotes: number;
  score: number;
  last_voted_at: string;
  category_id?: number | null;
  category_slug?: string | null;
  category_name?: string | null;
  [key: string]: unknown;
}

interface ListedLawRow {
  [key: string]: unknown;
  id: number;
  title?: string | null;
  text: string;
  attributions: unknown[];
}

interface LawDbRow {
  id: number;
  title?: string | null;
  text: string;
  attributions: string | unknown[];
  upvotes: number;
  downvotes: number;
  category_ids?: number[];
  category_id?: number | null;
  [key: string]: unknown;
}

/** A corollary as the law page lists it. */
interface CorollaryCard {
  id: number;
  title: string | null;
  text: string;
  upvotes: number;
  downvotes: number;
}

interface LawCategoryRow {
  category_id: number;
}

interface LawOfTheDayHistoryRow {
  law_id: number;
}

/** The day's pick as `selectLawOfTheDay` reports it; `created` is false when the pick was already there. */
export interface LawOfTheDayPick {
  lawId: number;
  featuredDate: string;
  created: boolean;
}

interface EditorialRow {
  explanation: string;
  practical_example: string;
  source_label: string;
  source_url: string;
  reviewed_at: string;
}

interface CandidateRow {
  id: number;
}

interface InsertLawResult {
  id: number;
}

export interface SuggestionsParams {
  q?: string;
  limit?: number;
}

export function buildFtsMatchQuery(query: string): string {
  const tokens = query
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length >= 2)
    .slice(0, 10) ?? [];
  return [...new Set(tokens)]
    .map((token) => `"${token.replace(/"/g, '""')}"*`)
    .join(' OR ');
}

export interface SubmitLawParams {
  title: string | null;
  text: string;
  author?: string | null;
  email?: string | null;
  categoryId?: number | null;
  /** Corollaries submitted with the law. They are created in review next to it and are not published until it is. */
  corollaries?: CorollaryChildInput[];
}

export interface SubmittedLaw {
  id: number;
  corollaries: RelatedLaw[];
}

export class LawService {
  private db: Db;
  private ftsDisabled = false;

  constructor(db: Db) {
    this.db = db;
  }

  private hasFtsIndex(): boolean {
    if (this.ftsDisabled) return false;
    try {
      return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'laws_fts'").get());
    } catch {
      return false;
    }
  }

  private hasAnnotationsTable(): boolean {
    try {
      return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'law_annotations'").get());
    } catch {
      return false;
    }
  }

  async listLaws(params: ListLawsParams): Promise<{ data: ListedLawRow[]; total: number }> {
    const { limit, offset, q = '', categoryId = null, categorySlug = null, attribution = '', sort = 'score', order = 'desc', excludeCorollaries = false } = params;
    const baseSelect = `
      SELECT
        l.id,
        l.title,
        l.text,
        l.first_seen_file_path AS file_path,
        l.first_seen_line_number AS line_number,
        l.created_at,
        COALESCE((
          SELECT json_group_array(json_object(
            'name', a.name,
            'note', a.note
          )) FROM attributions a WHERE a.law_id = l.id
        ), '[]') AS attributions,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes,
        (COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) -
         COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0)) AS score,
        COALESCE((SELECT MAX(v.created_at) FROM votes v WHERE v.law_id = l.id), l.created_at) AS last_voted_at,
        (SELECT c.id FROM law_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.law_id = l.id ORDER BY c.id LIMIT 1) AS category_id,
        (SELECT c.slug FROM law_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.law_id = l.id ORDER BY c.id LIMIT 1) AS category_slug,
        (SELECT c.title FROM law_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.law_id = l.id ORDER BY c.id LIMIT 1) AS category_name,
        (SELECT r.to_law_id FROM law_relations r JOIN laws p ON p.id = r.to_law_id
          WHERE r.from_law_id = l.id AND r.relation_type = '${COROLLARY_RELATION}' AND p.status = 'published'
          ORDER BY r.id LIMIT 1) AS corollary_of_id
      FROM laws l
      WHERE l.status = 'published'`;

    const hasQ = q && q.length > 0;
    const hasCategory = categoryId !== null && !isNaN(categoryId);
    const hasCategorySlug = categorySlug && categorySlug.length > 0;
    const hasAttribution = attribution && attribution.length > 0;
    const ftsQuery = buildFtsMatchQuery(q);
    const useFts = Boolean(hasQ && ftsQuery && this.hasFtsIndex());

    const like = `%${q}%`;
    const attributionLike = `%${attribution}%`;

    // Build parameter arrays
    const countParams = [];
    const listParams = [];

    let where = excludeCorollaries ? EXCLUDE_PUBLISHED_COROLLARIES : '';
    let countWhere = "WHERE l.status = 'published'" + (excludeCorollaries ? EXCLUDE_PUBLISHED_COROLLARIES : '');

    if (hasQ) {
      if (useFts) {
        where += " AND l.id IN (SELECT rowid FROM laws_fts WHERE laws_fts MATCH ?)";
        countWhere += " AND l.id IN (SELECT rowid FROM laws_fts WHERE laws_fts MATCH ?)";
        countParams.push(ftsQuery);
        listParams.push(ftsQuery);
      } else {
        where += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
        countWhere += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
        countParams.push(like, like);
        listParams.push(like, like);
      }
    }

    if (hasCategory) {
      where += " AND EXISTS (SELECT 1 FROM law_categories lc WHERE lc.law_id = l.id AND lc.category_id = ?)";
      countWhere += " AND EXISTS (SELECT 1 FROM law_categories lc WHERE lc.law_id = l.id AND lc.category_id = ?)";
      countParams.push(categoryId);
      listParams.push(categoryId);
    }

    if (hasCategorySlug) {
      const slugCondition = " AND EXISTS (SELECT 1 FROM law_categories lc JOIN categories c ON lc.category_id = c.id WHERE lc.law_id = l.id AND c.slug = ?)";
      where += slugCondition;
      countWhere += slugCondition;
      countParams.push(categorySlug);
      listParams.push(categorySlug);
    }

    if (hasAttribution) {
      where += " AND EXISTS (SELECT 1 FROM attributions a WHERE a.law_id = l.id AND a.name LIKE ?)";
      countWhere += " AND EXISTS (SELECT 1 FROM attributions a WHERE a.law_id = l.id AND a.name LIKE ?)";
      countParams.push(attributionLike);
      listParams.push(attributionLike);
    }

    // Build ORDER BY clause based on sort parameter
    const orderDirection = order === 'asc' ? 'ASC' : 'DESC';
    let orderBy;
    switch (sort) {
      case 'relevance':
        orderBy = useFts
          ? `(SELECT bm25(laws_fts, 5.0, 1.0) FROM laws_fts WHERE rowid = l.id AND laws_fts MATCH ?) ASC, score DESC, l.id DESC`
          : `score DESC, upvotes DESC, l.id DESC`;
        break;
      case 'upvotes':
        orderBy = `upvotes ${orderDirection}, l.id DESC`;
        break;
      case 'created_at':
        orderBy = `l.created_at ${orderDirection}, l.id DESC`;
        break;
      case 'last_voted_at':
        orderBy = `last_voted_at ${orderDirection}, l.id DESC`;
        break;
      case 'score':
      default:
        orderBy = `score ${orderDirection}, upvotes DESC, l.id DESC`;
        break;
    }

    const countSql = `SELECT COUNT(1) AS total FROM laws l ${countWhere};`;
    const listSql = `${baseSelect}${where}\nORDER BY ${orderBy}\nLIMIT ? OFFSET ?;`;

    try {
      const countStmt = this.db.prepare(countSql);
      const countResult = countStmt.get(...countParams) as CountRow | undefined;
      const total = countResult ? countResult.total : 0;

      if (sort === 'relevance' && useFts) listParams.push(ftsQuery);
      listParams.push(limit, offset);
      const listStmt = this.db.prepare(listSql);
      const rows = listStmt.all(...listParams) as ListLawRow[];

      const data = rows.map((r: ListLawRow) => ({
        ...r,
        attributions: safeParseJsonArray(r.attributions),
      }));

      return { data, total };
    } catch (error) {
      if (useFts) {
        this.ftsDisabled = true;
        return this.listLaws(params);
      }
      throw error;
    }
  }

  async getLaw(id: number): Promise<LawRow | undefined> {
    const sql = `
      SELECT
        l.id,
        l.title,
        l.text,
        l.first_seen_file_path AS file_path,
        l.first_seen_line_number AS line_number,
        l.created_at,
        l.updated_at,
        COALESCE((
          SELECT json_group_array(json_object(
            'name', a.name,
            'note', a.note
          )) FROM attributions a WHERE a.law_id = l.id
        ), '[]') AS attributions,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
      FROM laws l
      WHERE l.id = ? AND l.status = 'published'
      LIMIT 1;
    `;
    const stmt = this.db.prepare(sql);
    const law = stmt.get(id) as LawDbRow | undefined;

    if (law) {
      law.attributions = safeParseJsonArray(law.attributions);

      // Add category IDs and primary category slug/title for context copy
      const categoriesStmt = this.db.prepare(`
        SELECT category_id FROM law_categories WHERE law_id = ? ORDER BY category_id ASC
      `);
      const categories = categoriesStmt.all(id) as LawCategoryRow[];
      law.category_ids = categories.map((c: LawCategoryRow) => c.category_id);
      const primaryCategoryId = law.category_ids[0] ?? null;
      law.category_id = primaryCategoryId;

      if (primaryCategoryId !== null) {
        const catStmt = this.db.prepare('SELECT slug, title, law_context FROM categories WHERE id = ?');
        const cat = catStmt.get(primaryCategoryId) as { slug: string; title: string; law_context?: string | null } | undefined;
        if (cat) {
          law.category_slug = cat.slug;
          law.category_name = cat.title;
          if (cat.law_context !== undefined && cat.law_context !== null && cat.law_context !== '') {
            law.category_context = cat.law_context;
          }
        }
      }


      law.corollaries = this.getCorollariesWithVotes(id);
      law.corollary_of = getCorollaryOf(this.db, id);

      if (this.hasAnnotationsTable()) {
        const editorial = this.db.prepare(`
          SELECT explanation, practical_example, source_label, source_url, reviewed_at
          FROM law_annotations WHERE law_id = ?
        `).get(id) as EditorialRow | undefined;
        if (editorial) law.editorial = editorial;
      }
    }

    return law as LawRow | undefined;
  }

  /** Published corollaries of a published parent, with the vote counts the law page shows on each card. */
  private getCorollariesWithVotes(parentId: number): CorollaryCard[] {
    const children = getCorollaries(this.db, parentId);
    if (children.length === 0) return [];
    const placeholders = children.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT law_id,
                SUM(vote_type = 'up') AS upvotes,
                SUM(vote_type = 'down') AS downvotes
         FROM votes WHERE law_id IN (${placeholders}) GROUP BY law_id`
      )
      .all(...children.map((child) => child.id)) as { law_id: number; upvotes: number; downvotes: number }[];
    const votes = new Map(rows.map((row) => [row.law_id, row]));
    return children.map((child) => ({
      id: child.id,
      title: child.title,
      text: child.text,
      upvotes: votes.get(child.id)?.upvotes ?? 0,
      downvotes: votes.get(child.id)?.downvotes ?? 0
    }));
  }

  async getRandomLaw(): Promise<LawRow | undefined> {
    const sql = `
      SELECT
        l.id,
        l.title,
        l.text,
        l.first_seen_file_path AS file_path,
        l.first_seen_line_number AS line_number,
        COALESCE((
          SELECT json_group_array(json_object(
            'name', a.name,
            'note', a.note
          )) FROM attributions a WHERE a.law_id = l.id
        ), '[]') AS attributions,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
      FROM laws l
      WHERE l.status = 'published'
      ORDER BY RANDOM()
      LIMIT 1;
    `;
    const stmt = this.db.prepare(sql);
    const law = stmt.get() as LawDbRow | undefined;

    if (law) {
      law.attributions = safeParseJsonArray(law.attributions);
    }

    return law as LawRow | undefined;
  }

  async getRelatedLaws(lawId: number, { limit = 5 }: { limit?: number } = {}) {
    // 1. Get category IDs for this law
    const categoriesStmt = this.db.prepare(`
      SELECT category_id FROM law_categories WHERE law_id = ?
    `);
    const categories = categoriesStmt.all(lawId) as LawCategoryRow[];

    if (categories.length === 0) {
      return [];
    }

    const categoryIds = categories.map((c: LawCategoryRow) => c.category_id);

    // 2. Fetch related laws from same categories, excluding the current law and every corollary of a published law.
    // A law page lists its own corollaries in their own section, and other laws' corollaries read oddly under an
    // unrelated law.
    // Sort by score, then upvotes. Many laws have no votes, so ties are common: the tie is broken by a fixed pattern
    // that depends on the current law's id, so each page gets its own mix instead of the newest laws on every page.
    // The mix stays the same until votes or the published laws change.
    const placeholders = categoryIds.map(() => '?').join(',');
    const sql = `
      SELECT DISTINCT
        l.id,
        l.title,
        l.text,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes,
        (COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) -
         COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0)) AS score
      FROM laws l
      JOIN law_categories lc ON lc.law_id = l.id
      WHERE lc.category_id IN (${placeholders})
        AND l.id != ?
        AND l.status = 'published'${EXCLUDE_PUBLISHED_COROLLARIES}
      ORDER BY score DESC, upvotes DESC, ((l.id + ?) * 2654435761) % 4294967296, l.id DESC
      LIMIT ?
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all(...categoryIds, lawId, lawId, limit);
  }

  /** The law featured for a UTC day: the newest pick whose law is still published, if any. */
  private findFeaturedLawId(featuredDate: string): number | undefined {
    // Ignore a stale pick whose law was unpublished (e.g. rejected by a moderator) so a new one is chosen.
    const existingStmt = this.db.prepare(`
      SELECT h.law_id
      FROM law_of_the_day_history h
      JOIN laws l ON l.id = h.law_id
      WHERE h.featured_date = ? AND l.status = 'published'
      ORDER BY h.rowid DESC
      LIMIT 1
    `);
    const existingLaw = existingStmt.get(featuredDate) as LawOfTheDayHistoryRow | undefined;
    return existingLaw?.law_id;
  }

  /**
   * Makes sure a Law of the Day is picked for a UTC day (default: today) and reports it, or returns null when no
   * law is published. The API calls it on a request and the daily cron script calls it at midnight, so two
   * processes can run it at once: the check and the insert share one immediate transaction, which takes the
   * database's write lock before the check, so exactly one of them picks and the other finds that pick.
   * `created` tells which one it was.
   *
   * A corollary is never picked: both the one-year candidate query and the fallback leave out corollaries of a
   * published law (EXCLUDE_PUBLISHED_COROLLARIES), so a corollary cannot win even when every other law was featured
   * in the last year. A corollary that is left out always has a published parent that is not itself a corollary
   * (the one-level rule), so that parent stays eligible and the pool is empty only when no law is
   * published. That case is unchanged: null, and the cron script logs an error and exits 1. A pick already recorded for the day is not re-examined, so a corollary
   * recorded before this rule existed stays that day's law until the next UTC day.
   */
  selectLawOfTheDay(featuredDate: string = new Date().toISOString().split('T')[0]): LawOfTheDayPick | null {
    // A pick that already exists is the common case and must not need the write lock.
    const existingLawId = this.findFeaturedLawId(featuredDate);
    if (existingLawId !== undefined) {
      return { lawId: existingLawId, featuredDate, created: false };
    }

    const pick = this.db.transaction((): LawOfTheDayPick | null => {
      // Checked again under the lock: another process may have picked since the check above.
      const pickedMeanwhile = this.findFeaturedLawId(featuredDate);
      if (pickedMeanwhile !== undefined) {
        return { lawId: pickedMeanwhile, featuredDate, created: false };
      }

      let lawId: number;

      const candidatesStmt = this.db.prepare(`
        SELECT l.id,
               COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
        FROM laws l
        WHERE l.status = 'published'${EXCLUDE_PUBLISHED_COROLLARIES}
          AND l.id NOT IN (
            SELECT law_id
            FROM law_of_the_day_history
            WHERE featured_date > date('now', '-365 days')
          )
        ORDER BY upvotes DESC, l.text ASC
        LIMIT 1
      `);
      const candidates = candidatesStmt.all() as CandidateRow[];

      if (candidates.length === 0) {
        const fallbackStmt = this.db.prepare(`
          SELECT l.id,
                 COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
          FROM laws l
          WHERE l.status = 'published'${EXCLUDE_PUBLISHED_COROLLARIES}
          ORDER BY upvotes DESC, l.text ASC
          LIMIT 1
        `);
        const fallbackCandidates = fallbackStmt.all() as CandidateRow[];

        if (fallbackCandidates.length === 0) {
          return null;
        }

        lawId = fallbackCandidates[0].id;
      } else {
        lawId = candidates[0].id;
      }

      const insertStmt = this.db.prepare(`
        INSERT INTO law_of_the_day_history (law_id, featured_date)
        VALUES (?, ?)
      `);
      insertStmt.run(lawId, featuredDate);
      return { lawId, featuredDate, created: true };
    });

    return pick.immediate();
  }

  async getLawOfTheDay(): Promise<{ law: LawRow; featured_date: string } | null> {
    const pick = this.selectLawOfTheDay();
    if (!pick) return null;

    const law = await this.getLaw(pick.lawId);
    if (!law) return null;
    return { law, featured_date: pick.featuredDate };
  }

  async suggestions({ q, limit = 10 }: SuggestionsParams = {}) {
    if (!q || q.trim().length < 2) {
      return { data: [] };
    }

    const searchTerm = `%${q.trim()}%`;
    const maxLimit = Math.min(limit, 20);

    // Optimized query for autocomplete - only return essential fields
    // Prioritize text matches over title matches, then sort by score
    const sql = `
      SELECT
        l.id,
        l.text,
        l.title,
        (COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) -
         COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0)) AS score
      FROM laws l
      WHERE l.status = 'published'
        AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)
      ORDER BY
        CASE WHEN l.text LIKE ? THEN 1 ELSE 2 END,
        score DESC,
        l.id DESC
      LIMIT ?;
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, maxLimit);

    return { data: rows };
  }

  async findDuplicateCandidates({ text, limit = 5 }: { text: string; limit?: number }) {
    const normalized = text.trim().toLowerCase();
    const words = normalized
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 5);
    const terms = words.length > 0 ? words : [normalized.slice(0, 24)];
    const where = terms.map(() => "(LOWER(l.text) LIKE ? OR LOWER(COALESCE(l.title, '')) LIKE ?)").join(' OR ');
    const params = terms.flatMap((term) => [`%${term}%`, `%${term}%`]);
    const stmt = this.db.prepare(`
      SELECT
        l.id,
        l.title,
        l.text,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes
      FROM laws l
      WHERE l.status = 'published' AND (${where})
      ORDER BY upvotes DESC, l.id DESC
      LIMIT ?;
    `);
    const candidateLimit = Math.min(Math.max(limit * 10, 20), 50);
    const candidates = stmt.all(...params, candidateLimit) as Array<{ id: number; title?: string | null; text: string; upvotes: number; downvotes: number }>;
    return candidates
      .map((candidate) => {
        const textMatch = scoreDuplicateSimilarity(text, candidate.text);
        const match = textMatch.match_type === 'exact'
          ? textMatch
          : scoreDuplicateSimilarity(text, `${candidate.title || ''} ${candidate.text}`.trim());
        return { ...candidate, ...match };
      })
      .filter(isUsefulDuplicateMatch)
      .sort((a, b) => b.similarity - a.similarity || b.upvotes - a.upvotes || b.id - a.id)
      .slice(0, limit);
  }

  async submitLaw({ title, text, author, email, categoryId, corollaries = [] }: SubmitLawParams): Promise<SubmittedLaw> {
    if (categoryId) {
      const category = this.db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId);
      if (!category) {
        throw new Error('Invalid category ID');
      }
    }

    const submit = this.db.transaction(() => {
      const insertLawSql = `
        INSERT INTO laws (title, text, status, first_seen_file_path)
        VALUES (?, ?, 'in_review', 'web-submission')
        RETURNING id;
      `;

      const insertLawStmt = this.db.prepare(insertLawSql);
      const lawResult = insertLawStmt.get(title, text) as InsertLawResult | undefined;

      if (!lawResult) {
        throw new Error('Failed to insert law');
      }

      const lawId = lawResult.id;

      if (author || email) {
        const contactType = email ? 'email' : 'text';
        const contactValue = email || null;
        const name = author || 'Anonymous';
        const insertAttrStmt = this.db.prepare(`
          INSERT INTO attributions (law_id, name, contact_type, contact_value)
          VALUES (?, ?, ?, ?);
        `);
        insertAttrStmt.run(lawId, name, contactType, contactValue);
      }

      if (categoryId) {
        const insertCatStmt = this.db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)');
        insertCatStmt.run(lawId, categoryId);
      }

      // The corollaries join the parent's transaction (a savepoint), so a failing one leaves no law behind. They are
      // credited by name only: the address belongs to the parent, so no corollary can trigger a thank-you.
      const children = createCorollaryChildren(this.db, lawId, corollaries, {
        status: 'in_review',
        categoryIds: categoryId ? [categoryId] : [],
        submitterName: author || (email ? 'Anonymous' : null)
      });

      return { id: lawId, corollaries: children };
    });

    try {
      return submit();
    } catch (error) {
      if (error instanceof LawRelationError) {
        throw new Error(error.message, { cause: error });
      }
      throw error;
    }
  }
}
