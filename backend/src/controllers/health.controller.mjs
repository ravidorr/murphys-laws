import { sendJson } from '../utils/http-helpers.js';

export class HealthController {
  constructor(db) {
    this.db = db;
  }

  async check(req, res) {
    const dbStartTime = Date.now();
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM laws LIMIT 1');
      stmt.get();
      const dbQueryTime = Date.now() - dbStartTime;
      return sendJson(res, 200, { ok: true, dbQueryTime }, req);
    } catch (dbError) {
      console.error('Health check database error:', dbError);
      return sendJson(res, 503, { ok: false, error: 'Database unavailable', dbError: dbError.message }, req);
    }
  }
}
