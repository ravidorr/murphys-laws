import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

const RELATED_CATEGORY_TERMS: Record<string, string[]> = {
  computer: ['technology', 'software'],
  computers: ['technology', 'software'],
  office: ['work', 'employee'],
  travel: ['bus', 'cars'],
  bus: ['travel', 'cars'],
};

export class CategoryService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async listCategories() {
    const stmt = this.db.prepare(`
      SELECT 
        c.id, 
        c.slug, 
        c.title, 
        c.description,
        COUNT(l.id) as law_count
      FROM categories c
      LEFT JOIN law_categories lc ON c.id = lc.category_id
      LEFT JOIN laws l ON lc.law_id = l.id AND l.status = 'published'
      GROUP BY c.id
      ORDER BY c.title;
    `);
    return stmt.all();
  }

  async getCategory(id: number | string) {
    const stmt = this.db.prepare(`
      SELECT id, slug, title, description
      FROM categories
      WHERE id = ?;
    `);
    return stmt.get(id);
  }

  async getCategoryBySlug(slug: string) {
    const stmt = this.db.prepare(`
      SELECT
        c.id,
        c.slug,
        c.title,
        c.description,
        COUNT(l.id) as law_count
      FROM categories c
      LEFT JOIN law_categories lc ON c.id = lc.category_id
      LEFT JOIN laws l ON lc.law_id = l.id AND l.status = 'published'
      WHERE c.slug = ?
      GROUP BY c.id;
    `);
    return stmt.get(slug) as { id: number; slug: string; title: string; description: string | null; law_count: number } | undefined;
  }

  async getRelatedCategories(slug: string, { limit = 6 } = {}) {
    const category = await this.getCategoryBySlug(slug);
    if (!category) return [];

    const tokens = slug
      .replace(/^murphys-/, '')
      .replace(/-laws$/, '')
      .split('-')
      .filter((token) => token.length > 2);
    const expanded = tokens.flatMap((token) => [token, ...(RELATED_CATEGORY_TERMS[token] ?? [])]);
    const likeTerms = expanded.length > 0 ? expanded : [category.title.toLowerCase()];
    const where = likeTerms.map(() => '(slug LIKE ? OR title LIKE ?)').join(' OR ');
    const params = likeTerms.flatMap((term) => [`%${term}%`, `%${term}%`]);

    const stmt = this.db.prepare(`
      SELECT id, slug, title, description
      FROM categories
      WHERE slug != ? AND (${where})
      ORDER BY title
      LIMIT ?;
    `);
    return stmt.all(slug, ...params, limit);
  }
}
