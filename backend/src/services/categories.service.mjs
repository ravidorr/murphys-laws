export class CategoryService {
  constructor(db) {
    this.db = db;
  }

  async listCategories() {
    const stmt = this.db.prepare(`
      SELECT id, slug, title, description
      FROM categories
      ORDER BY title;
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
