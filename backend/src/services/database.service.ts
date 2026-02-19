import Database from 'better-sqlite3';

export class DatabaseService {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, {
      timeout: 5000,
      readonly: false
    });
    this.db.pragma('journal_mode = WAL');
    console.log('Database connected with better-sqlite3');
  }

  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  transaction<_T>(fn: () => _T): () => _T {
    return this.db.transaction(fn) as () => _T;
  }
}
