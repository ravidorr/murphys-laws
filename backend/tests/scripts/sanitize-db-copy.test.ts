import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../scripts/migrate.ts';
import { createApiServer } from '../../src/server/api-server.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '..', '..', 'db', 'migrations');
const SCRIPT = resolve(import.meta.dirname, '..', '..', 'scripts', 'sanitize-db-copy.sh');

// Everything below is personal data that must not survive anywhere in the copy, not even as a deleted page.
const SECRETS = [
  'secret.person@example.org',
  'leak-in-review@example.net',
  'fp-voter-alpha-7731',
  'fp-voter-beta-9942',
  'fp-voter-gamma-5518',
  'subscriber@example.com',
  'sub-token-4c1f9e',
  'https://push.example.com/send/endpoint-8827',
  'fb-user-1234567890',
  'future-pii-value-for-someone',
  'private moderation note about Jane Doe',
  'mailto:secret.person',
  'rejected-submitter@example.net',
  '2026-01-02T03:04:05.000Z-approval-mail',
];

type Db = ReturnType<typeof createMigratedDb>;

/** scripts/migrate.ts records what it applied; the raw migrations do not, so record every one before `before`. */
function recordMigrations(db: Db, before: string): void {
  db.exec('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f < before).sort()) {
    db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
  }
}

function sanitizerRun(args: string[], input?: Buffer): { status: number | null; stdout: Buffer; stderr: string } {
  const result = spawnSync('bash', args, { input, maxBuffer: 256 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr.toString() };
}

describe('sanitize-db-copy.sh', () => {
  let directory: string;
  let live: string;
  let copy: string;
  let liveDb: Db;
  /** All published laws in the live fixture (the migrations seed about a hundred), and the three this test adds. */
  let publishedIds: number[];
  let mine: { first: number; cut: number; second: number };

  /** A production-shaped database, one migration behind (022 runs later, on the copy), in WAL mode and still open. */
  function buildLive(): void {
    liveDb = createMigratedDb({ path: live, before: '022' });
    recordMigrations(liveDb, '022');
    liveDb.pragma('journal_mode = WAL');
    const insertLaw = liveDb.prepare(
      'INSERT INTO laws (title, text, status, raw_markdown, admin_notes, approval_email_sent_at, first_seen_file_path, first_seen_line_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const addLaw = (title: string | null, text: string, status: string, n: number, extra: Array<string | null> = [null, null, null]): number =>
      Number(insertLaw.run(title, text, status, extra[0], extra[1], extra[2], `fixture-${n}.md`, n).lastInsertRowid);

    const first = addLaw('Alpha law', 'Whatever can go wrong will go wrong, said the alpha.', 'published', 1,
      ['[Alpha](mailto:secret.person@example.org) raw import', 'private moderation note about Jane Doe', '2026-01-02T03:04:05.000Z-approval-mail']);
    // A law cut inside a mailto link, which migration 022 repairs once the copy is migrated.
    const cut = addLaw('The cut law sentence. Sent [by Dana](mailto', 'dana@example.com).', 'published', 2);
    const second = addLaw('Beta law', 'Beta text with enough words to be searchable zebrafish.', 'published', 3);
    const review = addLaw(null, 'Please publish this, write to leak-in-review@example.net', 'in_review', 4);
    const rejected = addLaw('Rejected', 'Spam from rejected-submitter@example.net', 'rejected', 5);
    mine = { first, cut, second };

    const attribution = liveDb.prepare('INSERT INTO attributions (law_id, name, contact_type, contact_value, note, source_fragment) VALUES (?, ?, ?, ?, ?, ?)');
    attribution.run(first, 'Alice Author', 'email', 'secret.person@example.org', 'a note', '[Alice Author](mailto:secret.person@example.org)');
    attribution.run(second, 'Bob Builder', 'url', 'https://bob.example.com', null, '[Bob Builder](https://bob.example.com)');
    attribution.run(review, 'Carol', 'email', 'leak-in-review@example.net', null, '[Carol](mailto:leak-in-review@example.net)');
    attribution.run(rejected, 'Mallory', 'email', 'rejected-submitter@example.net', null, null);

    const vote = liveDb.prepare('INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, ?, ?)');
    vote.run(first, 'up', 'fp-voter-alpha-7731');
    vote.run(first, 'up', 'fp-voter-beta-9942');
    vote.run(first, 'down', 'fp-voter-gamma-5518');
    vote.run(second, 'up', 'fp-voter-alpha-7731');
    vote.run(review, 'up', 'fp-voter-beta-9942');

    liveDb.prepare("INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, '2026-11-01')").run(first);
    liveDb.prepare("INSERT INTO email_subscriptions (email, token, status) VALUES ('subscriber@example.com', 'sub-token-4c1f9e', 'confirmed')").run();
    liveDb.prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example.com/send/endpoint-8827', 'p', 'a')").run();
    liveDb.prepare("INSERT INTO facebook_data_deletion_requests (facebook_user_id, confirmation_code) VALUES ('fb-user-1234567890', 'code-1')").run();
    // A table nobody has heard of yet: it must be emptied because it is not on the allowlist.
    liveDb.exec(`
      CREATE TABLE future_pii (id INTEGER PRIMARY KEY, who TEXT NOT NULL);
      CREATE INDEX idx_future_pii_who ON future_pii(who);
      CREATE TRIGGER future_pii_touch AFTER INSERT ON future_pii BEGIN SELECT 1; END;
      CREATE VIEW future_pii_view AS SELECT who FROM future_pii;
      INSERT INTO future_pii (who) VALUES ('future-pii-value-for-someone');
    `);
    publishedIds = (liveDb.prepare("SELECT id FROM laws WHERE status = 'published' ORDER BY id").all() as Array<{ id: number }>).map((r) => r.id);
    // Rows that make the file hold free pages, which a plain DELETE would leave readable.
    for (let i = 0; i < 200; i += 1) {
      liveDb.prepare('INSERT INTO future_pii (who) VALUES (?)').run(`future-pii-value-for-someone-${i}`);
    }
  }

  const exportCopy = (): void => {
    const { status, stdout, stderr } = sanitizerRun([SCRIPT, 'export', live]);
    expect(stderr).not.toMatch(/failed|error/i);
    expect(status).toBe(0);
    writeFileSync(copy, stdout);
  };

  const query = <T>(sql: string, file = copy): T[] => {
    const db = new Database(file, { readonly: true });
    try {
      return db.prepare(sql).all() as T[];
    } finally {
      db.close();
    }
  };
  const dump = (file: string): string => {
    const result = spawnSync('sqlite3', [file, '.dump']);
    expect(result.status).toBe(0);
    return result.stdout.toString();
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'sanitize-db-'));
    live = join(directory, 'live.db');
    copy = join(directory, 'copy.db');
    buildLive();
  });

  afterEach(() => {
    liveDb.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('leaves no personal data anywhere in the bytes of the exported copy', () => {
    exportCopy();
    const bytes = readFileSync(copy).toString('latin1');
    for (const secret of SECRETS) {
      expect(bytes, `${secret} must not appear in the copy`).not.toContain(secret);
    }
    expect(existsSync(`${copy}-wal`)).toBe(false);
    expect(existsSync(`${copy}-shm`)).toBe(false);
    expect(query<{ journal_mode: string }>('PRAGMA journal_mode')[0]?.journal_mode).toBe('delete');
    expect(query<{ integrity_check: string }>('PRAGMA integrity_check')[0]?.integrity_check).toBe('ok');
  });

  it('streams only the database on stdout and prints no row on stderr', () => {
    const { status, stdout, stderr } = sanitizerRun([SCRIPT, 'export', live]);
    expect(status).toBe(0);
    expect(stdout.subarray(0, 15).toString('latin1')).toBe('SQLite format 3');
    for (const secret of SECRETS) expect(stderr).not.toContain(secret);
  });

  it('works when the script is streamed to `bash -s`, as the deploy does over SSH', () => {
    const { status, stdout } = sanitizerRun(['-s', '--', 'export', live], readFileSync(SCRIPT));
    expect(status).toBe(0);
    writeFileSync(copy, stdout);
    expect(readFileSync(copy).toString('latin1')).not.toContain('secret.person@example.org');
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM laws')[0]?.n).toBe(publishedIds.length);
  });

  it('keeps tables outside the allowlist as empty tables and drops their data', () => {
    exportCopy();
    for (const table of ['email_subscriptions', 'push_subscriptions', 'facebook_data_deletion_requests', 'future_pii']) {
      expect(query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n, table).toBe(0);
    }
    const objects = query<{ name: string }>("SELECT name FROM sqlite_master WHERE name LIKE 'idx_future_pii%' OR name LIKE 'future_pii%'").map((r) => r.name);
    expect(objects).toEqual(expect.arrayContaining(['idx_future_pii_who', 'future_pii_touch', 'future_pii_view']));
    // The recreated table still works.
    const db = new Database(copy);
    try {
      db.prepare("INSERT INTO email_subscriptions (email, token) VALUES ('x@example.com', 't')").run();
    } finally {
      db.close();
    }
  });

  it('keeps only published laws, blanks the contact and raw fields, and keeps what the build needs', () => {
    exportCopy();
    expect(query<{ id: number }>('SELECT id FROM laws ORDER BY id').map((r) => r.id)).toEqual(publishedIds);
    expect(publishedIds.length).toBeGreaterThan(3);
    expect(query<{ status: string }>('SELECT DISTINCT status FROM laws')).toEqual([{ status: 'published' }]);
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM laws WHERE raw_markdown IS NOT NULL OR admin_notes IS NOT NULL OR approval_email_sent_at IS NOT NULL')[0]?.n).toBe(0);

    const attributions = query<{ name: string; contact_type: string; contact_value: string; note: string | null; source_fragment: string | null }>(
      'SELECT name, contact_type, contact_value, note, source_fragment FROM attributions ORDER BY name'
    );
    expect(attributions).toEqual([
      { name: 'Alice Author', contact_type: 'email', contact_value: '', note: 'a note', source_fragment: null },
      { name: 'Bob Builder', contact_type: 'url', contact_value: '', note: null, source_fragment: null },
    ]);

    // Public content survives untouched, and the search index follows the laws that are left.
    expect(query<{ title: string }>(`SELECT title FROM laws WHERE id = ${mine.first}`)[0]?.title).toBe('Alpha law');
    expect(query<{ rowid: number }>("SELECT rowid FROM laws_fts WHERE laws_fts MATCH 'zebrafish'").map((r) => r.rowid)).toEqual([mine.second]);
    expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM laws_fts WHERE laws_fts MATCH 'leak OR spam'")[0]?.n).toBe(0);
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM law_of_the_day_history')[0]?.n).toBe(1);
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations')[0]?.n).toBeGreaterThan(20);
  });

  it('replaces voter identifiers with unique neutral values and keeps every vote count and the unique index', () => {
    exportCopy();
    const counts = (file: string): Array<{ law_id: number; up: number; down: number }> =>
      query(`SELECT law_id, SUM(vote_type = 'up') AS up, SUM(vote_type = 'down') AS down FROM votes GROUP BY law_id ORDER BY law_id`, file);
    // Only published laws keep votes; their counts equal the live ones.
    expect(counts(copy)).toEqual(counts(live).filter((row) => publishedIds.includes(row.law_id)));
    expect(counts(copy)).toEqual([
      { law_id: mine.first, up: 2, down: 1 },
      { law_id: mine.second, up: 1, down: 0 },
    ]);
    const identifiers = query<{ voter_identifier: string; id: number }>('SELECT id, voter_identifier FROM votes');
    for (const row of identifiers) expect(row.voter_identifier).toBe(`v${row.id}`);
    expect(new Set(identifiers.map((r) => r.voter_identifier)).size).toBe(identifiers.length);

    const db = new Database(copy);
    try {
      const { id, law_id: lawId, voter_identifier: voter } = db.prepare('SELECT id, law_id, voter_identifier FROM votes LIMIT 1').get() as { id: number; law_id: number; voter_identifier: string };
      expect(id).toBeGreaterThan(0);
      expect(() => db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', ?)").run(lawId, voter)).toThrow(/UNIQUE/);
    } finally {
      db.close();
    }
  });

  it('is idempotent: sanitizing a sanitized copy changes nothing', () => {
    exportCopy();
    const before = dump(copy);
    expect(sanitizerRun([SCRIPT, 'sanitize', copy]).status).toBe(0);
    expect(sanitizerRun([SCRIPT, 'sanitize', copy]).status).toBe(0);
    expect(dump(copy)).toBe(before);
    expect(sanitizerRun([SCRIPT, 'verify', copy]).status).toBe(0);
  });

  it('can sanitize a file in place without a server, and never reads rows into its output', () => {
    writeFileSync(copy, readFileSync(live));
    // A copy of the live file alone would miss its WAL, so take a consistent one first.
    spawnSync('sqlite3', [live, `.backup '${copy}'`]);
    const { status, stdout, stderr } = sanitizerRun([SCRIPT, 'sanitize', copy]);
    expect(status).toBe(0);
    for (const secret of SECRETS) {
      expect(stdout.toString()).not.toContain(secret);
      expect(stderr).not.toContain(secret);
    }
    expect(readFileSync(copy).toString('latin1')).not.toContain('secret.person@example.org');
  });

  it('verify rejects a database that still holds personal data, and one left in WAL mode', () => {
    const backup = join(directory, 'unsanitized.db');
    spawnSync('sqlite3', [live, `.backup '${backup}'`]);
    const raw = sanitizerRun([SCRIPT, 'verify', backup]);
    expect(raw.status).not.toBe(0);
    expect(raw.stderr).toMatch(/not in rollback-journal mode|still has rows|still present/);

    exportCopy();
    const db = new Database(copy);
    try {
      db.pragma('journal_mode = WAL');
      db.prepare("UPDATE votes SET voter_identifier = 'fp-voter-alpha-7731' WHERE id = (SELECT MIN(id) FROM votes)").run();
      db.pragma('journal_mode = DELETE');
    } finally {
      db.close();
    }
    const tampered = sanitizerRun([SCRIPT, 'verify', copy]);
    expect(tampered.status).not.toBe(0);
    expect(tampered.stderr).toMatch(/personal data is still present/);
  });

  it('sanitizes a database whose schema is behind this release, then lets the migrations catch it up', () => {
    // The copy is taken before the deploy's migrations, so a table or column they add does not exist yet: there is
    // no search index and no approval_email_sent_at here.
    const old = join(directory, 'old.db');
    const oldDb = createMigratedDb({ path: old, before: '015' });
    recordMigrations(oldDb, '015');
    oldDb.exec(`INSERT INTO laws (title, text, status, admin_notes, first_seen_file_path, first_seen_line_number) VALUES ('Old', 'Old law text', 'published', 'private moderation note about Jane Doe', 'o.md', 900002);
      INSERT INTO laws (text, status) VALUES ('Draft with leak-in-review@example.net', 'in_review');
      INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (1, 'Ann', 'email', 'secret.person@example.org');
      INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (1, 'up', 'fp-voter-alpha-7731');`);
    oldDb.close();
    const { status, stdout, stderr } = sanitizerRun([SCRIPT, 'export', old]);
    expect(stderr).not.toMatch(/error/i);
    expect(status).toBe(0);
    writeFileSync(copy, stdout);
    const bytes = readFileSync(copy).toString('latin1');
    for (const secret of SECRETS) expect(bytes).not.toContain(secret);
    expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'laws_fts'")[0]?.n).toBe(0);
    expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM laws WHERE status <> 'published'")[0]?.n).toBe(0);
    migrate(copy);
    expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'laws_fts'")[0]?.n).toBe(1);
  });

  it('refuses a missing database and unknown modes', () => {
    expect(sanitizerRun([SCRIPT, 'export', join(directory, 'missing.db')]).status).not.toBe(0);
    expect(sanitizerRun([SCRIPT, 'sanitize', join(directory, 'missing.db')]).status).not.toBe(0);
    expect(sanitizerRun([SCRIPT, 'verify', join(directory, 'missing.db')]).status).not.toBe(0);
    expect(sanitizerRun([SCRIPT, 'frobnicate', live]).stderr).toMatch(/unknown mode/);
    expect(sanitizerRun([SCRIPT]).stderr).toMatch(/usage/);
  });

  it('does not modify the live database', () => {
    const before = liveDb.prepare('SELECT COUNT(*) AS n FROM votes WHERE voter_identifier LIKE ?').get('fp-voter-%') as { n: number };
    exportCopy();
    const after = liveDb.prepare('SELECT COUNT(*) AS n FROM votes WHERE voter_identifier LIKE ?').get('fp-voter-%') as { n: number };
    expect(after).toEqual(before);
    expect(before.n).toBe(5);
    expect((liveDb.prepare("SELECT COUNT(*) AS n FROM laws WHERE status <> 'published'").get() as { n: number }).n).toBe(2);
  });

  describe('column review', () => {
    // Every column of every kept table, as of the fully migrated schema, is either blanked or reviewed as safe.
    // A migration that adds a column to one of these tables fails here until someone decides which it is.
    const SAFE_COLUMNS: Record<string, string[]> = {
      laws: ['id', 'slug', 'title', 'text', 'origin_note', 'first_seen_file_path', 'first_seen_line_number', 'canonical', 'created_at', 'updated_at', 'status'],
      categories: ['id', 'slug', 'title', 'description', 'source_file_path', 'created_at', 'updated_at', 'law_context'],
      law_categories: ['id', 'law_id', 'category_id', 'position'],
      attributions: ['id', 'law_id', 'name', 'contact_type', 'note', 'created_at'],
      law_relations: ['id', 'from_law_id', 'to_law_id', 'relation_type', 'note', 'created_at'],
      votes: ['id', 'law_id', 'vote_type', 'created_at'],
      law_of_the_day_history: ['id', 'law_id', 'featured_date', 'created_at'],
      law_annotations: ['law_id', 'explanation', 'practical_example', 'source_label', 'source_url', 'reviewed_at'],
      schema_migrations: ['id', 'filename', 'applied_at'],
    };
    // votes.voter_identifier is replaced by 'v' || id rather than blanked, so it is listed apart.
    const REPLACED = ['votes.voter_identifier'];

    it('classifies every column of the kept tables', () => {
      const script = readFileSync(SCRIPT, 'utf8');
      const listed = /^BLANKED_COLUMNS="([^"]*)"$/m.exec(script)?.[1];
      expect(listed).toBeDefined();
      const blanked = (listed ?? '').split(' ').map((entry) => entry.split('=')[0] as string);

      const db = createMigratedDb();
      try {
        db.exec('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, applied_at TIMESTAMP)');
        for (const [table, safe] of Object.entries(SAFE_COLUMNS)) {
          const actual = (db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as Array<{ name: string }>).map((r) => r.name);
          const classified = [
            ...safe,
            ...blanked.filter((entry) => entry.startsWith(`${table}.`)).map((entry) => entry.slice(table.length + 1)),
            ...REPLACED.filter((entry) => entry.startsWith(`${table}.`)).map((entry) => entry.slice(table.length + 1)),
          ];
          expect([...actual].sort(), `${table}: classify every column in this test and in the sanitizer`).toEqual([...classified].sort());
        }
      } finally {
        db.close();
      }
    });
  });

  describe('the copy migrates and serves the API', () => {
    let server: ReturnType<typeof createApiServer>['server'];
    let savedPath: string | undefined;

    const get = (url: string): Promise<{ status: number; body: string }> =>
      new Promise((resolveReply) => {
        const stream = new Readable({ read() {} });
        stream.push(null);
        const req = Object.assign(stream, {
          method: 'GET',
          url,
          headers: { 'x-real-ip': '203.0.113.77' },
          socket: { remoteAddress: '127.0.0.1' },
        }) as unknown as IncomingMessage;
        let status = 0;
        const res = {
          writeHead: (code: number) => { status = code; },
          setHeader: vi.fn(),
          end: (chunk?: Buffer | string) => resolveReply({ status, body: chunk ? chunk.toString() : '' }),
        } as unknown as ServerResponse;
        server.emit('request', req, res);
      });

    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      savedPath = process.env.MURPHYS_DB_PATH;
    });

    afterEach(() => {
      if (savedPath === undefined) delete process.env.MURPHYS_DB_PATH;
      else process.env.MURPHYS_DB_PATH = savedPath;
      vi.restoreAllMocks();
    });

    it('applies the pending migration to the copy and serves the cleaned data from MURPHYS_DB_PATH', async () => {
      exportCopy();
      // The sanitized copy is one migration behind: 022 is applied here, on the copy, as the deploy does.
      expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM schema_migrations WHERE filename LIKE '022%'")[0]?.n).toBe(0);
      migrate(copy);
      expect(query<{ n: number }>("SELECT COUNT(*) AS n FROM schema_migrations WHERE filename LIKE '022%'")[0]?.n).toBe(1);

      process.env.MURPHYS_DB_PATH = copy;
      ({ server } = createApiServer());

      const list = await get('/api/v1/laws?limit=5');
      expect(list.status).toBe(200);
      expect(JSON.parse(list.body).data.length).toBe(5);

      const cut = await get(`/api/v1/laws/${mine.cut}`);
      expect(cut.status).toBe(200);
      expect(JSON.parse(cut.body)).toMatchObject({ id: mine.cut, title: null, text: 'The cut law sentence.' });
      expect(cut.body).not.toContain('dana@example.com');
      const alpha = await get(`/api/v1/laws/${mine.first}`);
      expect(alpha.status).toBe(200);
      for (const secret of SECRETS) expect(alpha.body).not.toContain(secret);
      // Laws that were waiting for review are not in the copy at all.
      expect((await get(`/api/v1/laws/${mine.second + 1}`)).status).toBe(404);

      expect((await get('/api/v1/categories')).status).toBe(200);
      expect((await get('/api/v1/law-of-day')).status).toBeLessThan(500);
      expect((await get(`/api/v1/laws/${mine.first}/related`)).status).toBe(200);
      expect((await get('/api/health')).status).toBe(200);
    });
  });
});
