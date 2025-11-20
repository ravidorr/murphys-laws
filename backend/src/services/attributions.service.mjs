export class AttributionService {
  constructor(db) {
    this.db = db;
  }

  async listAttributions() {
    const stmt = this.db.prepare(`
      SELECT DISTINCT name
      FROM attributions
      WHERE name IS NOT NULL AND name != ''
      ORDER BY name;
    `);
    return stmt.all();
  }
}
