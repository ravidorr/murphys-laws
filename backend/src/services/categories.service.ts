// @ts-nocheck
export class CategoryService {
  constructor(db) {
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

  async getCategory(id) {
    const stmt = this.db.prepare(`
      SELECT id, slug, title, description
      FROM categories
      WHERE id = ?;
    `);
    return stmt.get(id);
  }
}
