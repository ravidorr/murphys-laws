import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

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
}
