import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

export class AttributionService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async listAttributions(): Promise<{ name: string }[]> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT name
      FROM attributions
      WHERE name IS NOT NULL AND name != ''
      ORDER BY name;
    `);
    return stmt.all() as { name: string }[];
  }
}
