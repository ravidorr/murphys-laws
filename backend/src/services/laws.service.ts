import type Database from 'better-sqlite3';
import { safeParseJsonArray } from '../utils/helpers.ts';

type Db = InstanceType<typeof Database>;

export interface ListLawsParams {
  limit: number;
  offset: number;
  q?: string;
  categoryId?: number | null;
  categorySlug?: string | null;
  attribution?: string;
  sort?: string;
  order?: string;
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
  [key: string]: unknown;
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

interface LawCategoryRow {
  category_id: number;
}

interface LawOfTheDayHistoryRow {
  law_id: number;
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

export interface SubmitLawParams {
  title: string;
  text: string;
  author?: string;
  email?: string;
  categoryId?: number | null;
}

export class LawService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async listLaws({ limit, offset, q = '', categoryId = null, categorySlug = null, attribution = '', sort = 'score', order = 'desc' }: ListLawsParams) {
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
            'contact_type', a.contact_type,
            'contact_value', a.contact_value,
            'note', a.note
          )) FROM attributions a WHERE a.law_id = l.id
        ), '[]') AS attributions,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes,
        COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0) AS downvotes,
        (COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) -
         COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'down'), 0)) AS score,
        COALESCE((SELECT MAX(v.created_at) FROM votes v WHERE v.law_id = l.id), l.created_at) AS last_voted_at
      FROM laws l
      WHERE l.status = 'published'`;

    const hasQ = q && q.length > 0;
    const hasCategory = categoryId !== null && !isNaN(categoryId);
    const hasCategorySlug = categorySlug && categorySlug.length > 0;
    const hasAttribution = attribution && attribution.length > 0;

    const like = `%${q}%`;
    const attributionLike = `%${attribution}%`;

    // Build parameter arrays
    const countParams = [];
    const listParams = [];

    let where = '';
    let countWhere = "WHERE l.status = 'published'";

    if (hasQ) {
      where += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
      countWhere += " AND (l.text LIKE ? OR COALESCE(l.title,'') LIKE ?)";
      countParams.push(like, like);
      listParams.push(like, like);
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

    const countStmt = this.db.prepare(countSql);
    const countResult = countStmt.get(...countParams) as CountRow | undefined;
    const total = countResult ? countResult.total : 0;

    listParams.push(limit, offset);
    const listStmt = this.db.prepare(listSql);
    const rows = listStmt.all(...listParams) as ListLawRow[];

    const data = rows.map((r: ListLawRow) => ({
      ...r,
      attributions: safeParseJsonArray(r.attributions),
    }));

    return { data, total };
  }

  async getLaw(id: number): Promise<LawRow | undefined> {
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
            'contact_type', a.contact_type,
            'contact_value', a.contact_value,
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

      // Add category IDs
      const categoriesStmt = this.db.prepare(`
        SELECT category_id FROM law_categories WHERE law_id = ?
      `);
      const categories = categoriesStmt.all(id) as LawCategoryRow[];
      law.category_ids = categories.map((c: LawCategoryRow) => c.category_id);
      law.category_id = law.category_ids[0] ?? null; // Primary category for backward compatibility
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

    // 2. Fetch related laws from same categories, excluding current law
    // Sort by score, limit to requested count
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
        AND l.status = 'published'
      ORDER BY score DESC, upvotes DESC, l.id DESC
      LIMIT ?
    `;

    const stmt = this.db.prepare(sql);
    return stmt.all(...categoryIds, lawId, limit);
  }

  async getLawOfTheDay(): Promise<{ law: LawRow; featured_date: string } | null> {
    const today = new Date().toISOString().split('T')[0];

    const existingStmt = this.db.prepare(`
      SELECT law_id
      FROM law_of_the_day_history
      WHERE featured_date = ?
      LIMIT 1
    `);
    const existingLaw = existingStmt.get(today) as LawOfTheDayHistoryRow | undefined;

    let lawId: number;

    if (existingLaw) {
      lawId = existingLaw.law_id;
    } else {
      const candidatesStmt = this.db.prepare(`
        SELECT l.id,
               COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
        FROM laws l
        WHERE l.status = 'published'
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
          WHERE l.status = 'published'
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
      insertStmt.run(lawId, today);
    }

    const law = await this.getLaw(lawId);
    if (!law) return null;
    return { law, featured_date: today };
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

  async submitLaw({ title, text, author, email, categoryId }: SubmitLawParams) {
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

    return lawId;
  }
}
