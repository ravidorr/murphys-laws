import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const MIGRATION_SQL = readFileSync(
  join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), 'db', 'migrations', '022_strip_law_contact_details.sql'),
  'utf8'
);

type Db = ReturnType<typeof createMigratedDb>;

interface LawRow { id: number; title: string | null; text: string; status: string; admin_notes: string | null }
interface AttributionRow { name: string | null; contact_type: string | null; contact_value: string | null; note: string | null }

describe('migration 022: strip contact details from public law fields', () => {
  let db: Db;
  let nextId = 100000;

  /** Production ids differ from the seeded archive ids, so the fixtures use ids the migration cannot know. */
  function addLaw(title: string | null, text: string, attributions: Array<Partial<AttributionRow>> = []): number {
    const id = nextId++;
    db.prepare('INSERT INTO laws (id, title, text, status, first_seen_file_path, first_seen_line_number) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, title, text, 'published', `fixture-${id}.md`, id);
    for (const a of attributions) {
      db.prepare('INSERT INTO attributions (law_id, name, contact_type, contact_value, note) VALUES (?, ?, ?, ?, ?)')
        .run(id, a.name ?? null, a.contact_type ?? null, a.contact_value ?? null, a.note ?? null);
    }
    return id;
  }

  const law = (id: number): LawRow => db.prepare('SELECT id, title, text, status, admin_notes FROM laws WHERE id = ?').get(id) as LawRow;
  const attributions = (id: number): AttributionRow[] =>
    db.prepare('SELECT name, contact_type, contact_value, note FROM attributions WHERE law_id = ? ORDER BY id').all(id) as AttributionRow[];
  const searchIds = (term: string): number[] =>
    (db.prepare('SELECT rowid FROM laws_fts WHERE laws_fts MATCH ?').all(term) as Array<{ rowid: number }>).map((r) => r.rowid);
  const migrate = (): void => { db.exec(MIGRATION_SQL); };

  beforeEach(() => { db = createMigratedDb(); });
  afterEach(() => { db.close(); });

  it('moves the sentence out of a title cut inside a mailto link and restores the submitter', () => {
    const id = addLaw(
      'The difference between love and the common cold is that there is a vaccine for the common cold. Sent [by Takura Razemba](mailto',
      'tamzanzw@yahoo.com).'
    );
    migrate();
    expect(law(id)).toMatchObject({
      title: null,
      text: 'The difference between love and the common cold is that there is a vaccine for the common cold.',
      status: 'published'
    });
    expect(attributions(id)).toEqual([
      { name: 'Takura Razemba', contact_type: 'email', contact_value: 'tamzanzw@yahoo.com', note: null }
    ]);
  });

  it('handles the other lead-ins of a cut title and keeps an existing attribution', () => {
    const sent = addLaw('A law. Sent by [Dana](mailto', 'dana@example.com).');
    const bare = addLaw('Another law. by [Eli](mailto', 'eli@example.com).', [{ name: 'Existing', contact_type: 'text' }]);
    const plain = addLaw('Third law. [anon@example.com](mailto', 'anon@example.com).');
    migrate();
    expect(law(sent)).toMatchObject({ title: null, text: 'A law.' });
    expect(attributions(sent)[0]).toMatchObject({ name: 'Dana', contact_value: 'dana@example.com' });
    expect(law(bare)).toMatchObject({ title: null, text: 'Another law.' });
    expect(attributions(bare)).toEqual([{ name: 'Existing', contact_type: 'text', contact_value: null, note: null }]);
    expect(law(plain)).toMatchObject({ title: null, text: 'Third law.' });
    expect(attributions(plain)[0]).toMatchObject({ name: 'Anonymous', contact_value: 'anon@example.com' });
  });

  it('cleans the note and the text tail left by an address split at its last dot', () => {
    const id = addLaw(
      null,
      'Whatever hits the fan will not be evenly distributed. net).',
      [
        { name: 'John Cougar', contact_type: 'email' },
        { name: 'John Cougar', contact_type: 'email', note: 'and [getalife](mailto:getalife1@webtv' }
      ]
    );
    migrate();
    expect(law(id).text).toBe('Whatever hits the fan will not be evenly distributed.');
    expect(attributions(id).map((a) => a.note)).toEqual([null, 'and getalife']);
  });

  it('turns an attribution name that is an address into Anonymous and keeps the contact', () => {
    const withContact = addLaw(null, 'A law.', [{ name: 'Eppeguy@aol.com', contact_type: 'url', contact_value: 'http://Eppeguy@aol.com', note: 'he got these laws from a math teacher' }]);
    const withoutContact = addLaw(null, 'Another law.', [{ name: 'pjwmail@ntlworld.com' }]);
    migrate();
    expect(attributions(withContact)).toEqual([
      { name: 'Anonymous', contact_type: 'url', contact_value: 'http://Eppeguy@aol.com', note: 'he got these laws from a math teacher' }
    ]);
    expect(attributions(withoutContact)).toEqual([
      { name: 'Anonymous', contact_type: 'email', contact_value: 'pjwmail@ntlworld.com', note: null }
    ]);
  });

  it('drops a note that still holds a contact detail', () => {
    const mailto = addLaw(null, 'A law.', [{ name: 'Sam', note: 'see mailto:sam' }]);
    const address = addLaw(null, 'Another law.', [{ name: 'Sam', note: 'write to sam@example.com' }]);
    migrate();
    expect(attributions(mailto)[0]?.note).toBeNull();
    expect(attributions(address)[0]?.note).toBeNull();
  });

  it('sends a law that still holds a contact detail back to review and removes it from search', () => {
    const bare = addLaw(null, 'Ask zebra.hunter@example.com about quokkas.');
    const link = addLaw('Law with a link', 'See [x](mailto:x@example.com) for quokkas.');
    const title = addLaw('Contact zebra@example.org', 'Plain quokkas text.');
    expect(searchIds('quokkas')).toEqual(expect.arrayContaining([bare, link, title]));
    migrate();
    for (const id of [bare, link, title]) {
      expect(law(id).status).toBe('in_review');
      expect(law(id).admin_notes).toContain('migration 022');
    }
    expect(searchIds('quokkas')).toEqual([]);
  });

  it('keeps an existing admin note when sending a law back to review', () => {
    const id = addLaw(null, 'Mail me at someone@example.com');
    db.prepare('UPDATE laws SET admin_notes = ? WHERE id = ?').run('checked once', id);
    migrate();
    expect(law(id).admin_notes).toMatch(/^checked once Moved to review/);
  });

  it('leaves rows without a contact detail byte-identical', () => {
    const untouched = [
      addLaw(null, 'Too often we lose sight. Remember, when someone annoys you, bitch-slap that mother@#?!&* upside the head.', [{ name: 'Soljah' }]),
      addLaw('Peter Principle', 'People rise to their level of incompetence (see the corollary).', [{ name: 'Brad Johnson', note: 'Austin, TX' }]),
      addLaw(null, 'Meet me @ 5 p.m. (or later).', [{ name: '@handle' }]),
      addLaw(null, 'An unfinished thought (maybe net).', [{ name: 'Jo', note: 'age 42' }]),
      addLaw('Quoted title', 'tamzanzw@yahoo.com).', [])
    ];
    const rows = (): unknown[] => untouched.map((id) => [law(id), attributions(id)]);
    const before = rows();
    migrate();
    // Only the last fixture holds an address in its text, and no broken title explains it: it goes to review.
    const after = rows();
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4));
    expect(law(untouched[4]!).status).toBe('in_review');
  });

  it('does not rewrite the updated_at of rows it leaves alone', () => {
    const id = addLaw(null, 'A clean law.', [{ name: 'Brad Johnson' }]);
    db.prepare('UPDATE laws SET updated_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', id);
    migrate();
    expect((db.prepare('SELECT updated_at FROM laws WHERE id = ?').get(id) as { updated_at: string }).updated_at).toBe('2020-01-01T00:00:00.000Z');
  });

  it('keeps search in step: the cleaned law is found by its sentence and not by the address', () => {
    const id = addLaw('A vaccine quokka sentence. Sent [by Takura Razemba](mailto', 'tamzanzw@yahoo.com).');
    expect(searchIds('tamzanzw')).toEqual([id]);
    migrate();
    expect(searchIds('quokka')).toEqual([id]);
    expect(searchIds('tamzanzw')).toEqual([]);
    const published = (db.prepare("SELECT count(*) AS c FROM laws WHERE status = 'published'").get() as { c: number }).c;
    expect((db.prepare('SELECT count(*) AS c FROM laws_fts').get() as { c: number }).c).toBe(published);
  });

  it('is idempotent', () => {
    addLaw('A law. Sent [by Dana](mailto', 'dana@example.com).');
    addLaw(null, 'Whatever hits the fan. net).', [{ name: 'Jo', note: 'and [h](mailto:h@webtv' }, { name: 'a@b.com' }]);
    addLaw(null, 'Ask someone@example.com');
    migrate();
    const snapshot = JSON.stringify([
      db.prepare('SELECT * FROM laws ORDER BY id').all(),
      db.prepare('SELECT * FROM attributions ORDER BY id').all()
    ]);
    migrate();
    expect(JSON.stringify([
      db.prepare('SELECT * FROM laws ORDER BY id').all(),
      db.prepare('SELECT * FROM attributions ORDER BY id').all()
    ])).toBe(snapshot);
  });

  it('runs cleanly on a database with no matching rows', () => {
    expect(() => migrate()).not.toThrow();
  });
});
