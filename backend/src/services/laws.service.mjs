import { safeParseJsonArray } from '../utils/helpers.js';


export class LawService {
  constructor(db) {
    this.db = db;
  }

  async listLaws({ limit, offset, q, categoryId, categorySlug, attribution }) {
    const baseSelect = `
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

    const countSql = `SELECT COUNT(1) AS total FROM laws l ${countWhere};`;
    const listSql = `${baseSelect}${where}\nORDER BY l.id\nLIMIT ? OFFSET ?;`;

    const countStmt = this.db.prepare(countSql);
    const countResult = countStmt.get(...countParams);
    const total = countResult ? countResult.total : 0;

    listParams.push(limit, offset);
    const listStmt = this.db.prepare(listSql);
    const rows = listStmt.all(...listParams);

    const data = rows.map(r => ({
      ...r,
      attributions: safeParseJsonArray(r.attributions),
    }));

    return { data, total };
  }

  async getLaw(id) {
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
    const law = stmt.get(id);

    if (law) {
      law.attributions = safeParseJsonArray(law.attributions);
    }

    return law;
  }

  async getLawOfTheDay() {
    const today = new Date().toISOString().split('T')[0];

    const existingStmt = this.db.prepare(`
      SELECT law_id
      FROM law_of_the_day_history
      WHERE featured_date = ?
      LIMIT 1
    `);
    const existingLaw = existingStmt.get(today);

    let lawId;

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
      const candidates = candidatesStmt.all();

      if (candidates.length === 0) {
        const fallbackStmt = this.db.prepare(`
          SELECT l.id,
                 COALESCE((SELECT COUNT(*) FROM votes v WHERE v.law_id = l.id AND v.vote_type = 'up'), 0) AS upvotes
          FROM laws l
          WHERE l.status = 'published'
          ORDER BY upvotes DESC, l.text ASC
          LIMIT 1
        `);
        const fallbackCandidates = fallbackStmt.all();

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
    return { law, featured_date: today };
  }

  async submitLaw({ title, text, author, email, categoryId }) {
    const insertLawSql = `
      INSERT INTO laws (title, text, status, first_seen_file_path)
      VALUES (?, ?, 'in_review', 'web-submission')
      RETURNING id;
    `;

    const insertLawStmt = this.db.prepare(insertLawSql);
    const lawResult = insertLawStmt.get(title, text);

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
