import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

/** Detect if a string looks like an email address (privacy: do not expose in UI). */
export function isEmailLike(name: string): boolean {
  if (typeof name !== 'string' || !name.trim()) return false;
  const trimmed = name.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.includes('@');
}

/** Return a display-safe label: use name if it looks like a display name, otherwise "Anonymous". */
export function sanitizeDisplayName(name: string): string {
  if (typeof name !== 'string' || !name.trim()) return 'Anonymous';
  const trimmed = name.trim();
  if (isEmailLike(trimmed)) return 'Anonymous';
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return 'Anonymous';
  return trimmed;
}

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
    const rows = stmt.all() as { name: string }[];
    const seen = new Set<string>();
    const result: { name: string }[] = [];
    for (const row of rows) {
      const display = sanitizeDisplayName(row.name);
      if (!seen.has(display)) {
        seen.add(display);
        result.push({ name: display });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search submitters by name (for typeahead). Returns display-safe names only; limit applied.
   */
  async searchSubmitters(q = '', limit = 20): Promise<{ name: string }[]> {
    const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const hasQ = typeof q === 'string' && q.trim().length > 0;
    const likeParam = hasQ ? `%${q.trim()}%` : null;

    const sql = hasQ
      ? `
      SELECT DISTINCT name
      FROM attributions
      WHERE name IS NOT NULL AND name != '' AND name LIKE ?
      ORDER BY name
      LIMIT ?
    `
      : `
      SELECT DISTINCT name
      FROM attributions
      WHERE name IS NOT NULL AND name != ''
      ORDER BY name
      LIMIT ?
    `;
    const stmt = this.db.prepare(sql);
    const rows = (hasQ ? stmt.all(likeParam, boundedLimit) : stmt.all(boundedLimit)) as { name: string }[];

    const seen = new Set<string>();
    const result: { name: string }[] = [];
    for (const row of rows) {
      const display = sanitizeDisplayName(row.name);
      if (!seen.has(display)) {
        seen.add(display);
        result.push({ name: display });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}
