// @ts-nocheck
import Database from 'better-sqlite3';


export class DatabaseService {
  constructor(dbPath) {
    this.db = new Database(dbPath, {
      timeout: 5000,
      readonly: false
    });
    this.db.pragma('journal_mode = WAL');
    console.log('Database connected with better-sqlite3');
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }
}

// Singleton instance will be created in app.mjs or we can export a factory
