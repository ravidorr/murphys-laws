import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { LawService } from '../../src/services/laws.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

type Db = InstanceType<typeof Database>;

const PARENT = 'A red light turns green right after you stop watching it.';
const ONE = 'The engine restarts slowly when someone behind you is honking.';
const TWO = 'The green lasts just long enough for you to miss it.';

describe('LawService.submitLaw with corollaries (real migrated schema)', () => {
  let db: Db;
  let laws: LawService;

  const row = (id: number) => db.prepare('SELECT * FROM laws WHERE id = ?').get(id) as Record<string, unknown>;
  const lawCount = () => (db.prepare('SELECT COUNT(*) AS n FROM laws').get() as { n: number }).n;
  const attributions = (id: number) => db.prepare('SELECT name, contact_type, contact_value FROM attributions WHERE law_id = ?').all(id);
  const categoriesOf = (id: number) => (db.prepare('SELECT category_id FROM law_categories WHERE law_id = ?').all(id) as { category_id: number }[]).map((r) => r.category_id);
  const relations = (parentId: number) =>
    db.prepare("SELECT from_law_id, to_law_id, relation_type, note FROM law_relations WHERE to_law_id = ? ORDER BY id").all(parentId);

  beforeEach(() => {
    db = createMigratedDb();
    laws = new LawService(db);
  });

  it('returns the id and an empty list when no corollary was submitted', async () => {
    const submitted = await laws.submitLaw({ title: null, text: PARENT, author: 'Ann', email: null, categoryId: null });
    expect(submitted).toEqual({ id: expect.any(Number), corollaries: [] });
    expect(relations(submitted.id)).toEqual([]);
  });

  it('creates every corollary in review next to the law, linked child to parent with the title as the note', async () => {
    const submitted = await laws.submitLaw({
      title: 'Start-Stop',
      text: PARENT,
      author: 'Ann',
      email: 'ann@example.com',
      categoryId: null,
      corollaries: [
        { title: 'The Ignition Corollary', text: ONE },
        { title: null, text: TWO },
      ],
    });

    expect(submitted.corollaries).toEqual([
      { id: expect.any(Number), title: 'The Ignition Corollary', text: ONE },
      { id: expect.any(Number), title: null, text: TWO },
    ]);
    expect(row(submitted.id)).toMatchObject({ status: 'in_review', first_seen_file_path: 'web-submission' });
    for (const child of submitted.corollaries) {
      expect(row(child.id)).toMatchObject({ status: 'in_review', first_seen_file_path: 'web-submission', text: child.text });
    }
    expect(relations(submitted.id)).toEqual([
      { from_law_id: submitted.corollaries[0].id, to_law_id: submitted.id, relation_type: 'COROLLARY_OF', note: 'The Ignition Corollary' },
      { from_law_id: submitted.corollaries[1].id, to_law_id: submitted.id, relation_type: 'COROLLARY_OF', note: null },
    ]);
  });

  it('credits each corollary by name only and never copies the email', async () => {
    const submitted = await laws.submitLaw({
      title: null,
      text: PARENT,
      author: 'Ann',
      email: 'ann@example.com',
      categoryId: null,
      corollaries: [{ title: null, text: ONE }],
    });

    expect(attributions(submitted.id)).toEqual([{ name: 'Ann', contact_type: 'email', contact_value: 'ann@example.com' }]);
    expect(attributions(submitted.corollaries[0].id)).toEqual([{ name: 'Ann', contact_type: 'text', contact_value: null }]);
    expect(JSON.stringify(db.prepare('SELECT * FROM attributions').all()).match(/ann@example\.com/g)).toHaveLength(1);
  });

  it('credits the corollaries of an email-only submitter as Anonymous, like the law, and adds none for a fully anonymous one', async () => {
    const emailOnly = await laws.submitLaw({ title: null, text: PARENT, author: null, email: 'who@example.com', categoryId: null, corollaries: [{ title: null, text: ONE }] });
    expect(attributions(emailOnly.corollaries[0].id)).toEqual([{ name: 'Anonymous', contact_type: 'text', contact_value: null }]);

    const anonymous = await laws.submitLaw({ title: null, text: `${PARENT} Again.`, author: null, email: null, categoryId: null, corollaries: [{ title: null, text: TWO }] });
    expect(attributions(anonymous.id)).toEqual([]);
    expect(attributions(anonymous.corollaries[0].id)).toEqual([]);
  });

  it('copies the chosen category onto every corollary', async () => {
    const categoryId = (db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get() as { id: number }).id;
    const submitted = await laws.submitLaw({ title: null, text: PARENT, author: null, email: null, categoryId, corollaries: [{ title: null, text: ONE }, { title: null, text: TWO }] });

    expect(categoriesOf(submitted.id)).toEqual([categoryId]);
    for (const child of submitted.corollaries) expect(categoriesOf(child.id)).toEqual([categoryId]);
  });

  it('keeps the corollaries out of public reads until the law and they are published', async () => {
    const submitted = await laws.submitLaw({ title: null, text: PARENT, author: null, email: null, categoryId: null, corollaries: [{ title: 'The Ignition Corollary', text: ONE }] });
    expect(await laws.getLaw(submitted.id)).toBeFalsy();
    expect(await laws.getLaw(submitted.corollaries[0].id)).toBeFalsy();

    db.prepare("UPDATE laws SET status = 'published' WHERE id IN (?, ?)").run(submitted.id, submitted.corollaries[0].id);
    const parent = (await laws.getLaw(submitted.id)) as unknown as { corollaries: { id: number }[] };
    expect(parent.corollaries.map((c) => c.id)).toEqual([submitted.corollaries[0].id]);
  });

  it('indexes a published corollary for search through the FTS triggers', async () => {
    const submitted = await laws.submitLaw({ title: null, text: PARENT, author: null, email: null, categoryId: null, corollaries: [{ title: null, text: 'Zebrafish always find the hole in the net.' }] });
    db.prepare("UPDATE laws SET status = 'published' WHERE id IN (?, ?)").run(submitted.id, submitted.corollaries[0].id);

    const hits = (await laws.listLaws({ limit: 25, offset: 0, q: 'zebrafish' })).data.map((l: { id: number }) => l.id);
    expect(hits).toEqual([submitted.corollaries[0].id]);
  });

  it('rolls the whole submission back when a corollary is refused, leaving no law, attribution or relation', async () => {
    const before = lawCount();
    await expect(
      laws.submitLaw({
        title: null,
        text: PARENT,
        author: 'Ann',
        email: null,
        categoryId: null,
        corollaries: [{ title: null, text: ONE }, { title: null, text: 'too short' }],
      }),
    ).rejects.toThrow('Corollary 2 must be between 10 and 1000 characters');

    expect(lawCount()).toBe(before);
    expect(db.prepare('SELECT COUNT(*) AS n FROM attributions').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM law_relations').get()).toEqual({ n: 0 });
  });

  it('rolls back the categories and the search index entry of the law when a corollary is refused', async () => {
    const categoryId = (db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get() as { id: number }).id;
    const before = (db.prepare('SELECT COUNT(*) AS n FROM law_categories').get() as { n: number }).n;
    await expect(
      laws.submitLaw({ title: null, text: 'Zebrafish law that must not survive the rollback.', author: null, email: null, categoryId, corollaries: [{ title: null, text: ONE }, { title: null, text: 'too short' }] }),
    ).rejects.toThrow('Corollary 2');
    expect((db.prepare('SELECT COUNT(*) AS n FROM law_categories').get() as { n: number }).n).toBe(before);
    expect(db.prepare("SELECT COUNT(*) AS n FROM laws WHERE text LIKE '%Zebrafish law that must not survive%'").get()).toEqual({ n: 0 });
  });

  it('rolls back when a corollary cannot be inserted after the law was', async () => {
    db.exec("CREATE TRIGGER block_child BEFORE INSERT ON laws WHEN NEW.text = 'Blocked corollary text here' BEGIN SELECT RAISE(ABORT, 'insert blocked'); END;");
    const before = lawCount();
    await expect(
      laws.submitLaw({ title: null, text: PARENT, author: null, email: null, categoryId: null, corollaries: [{ title: null, text: ONE }, { title: null, text: 'Blocked corollary text here' }] }),
    ).rejects.toThrow('insert blocked');
    expect(lawCount()).toBe(before);
  });

  it('refuses more than five corollaries', async () => {
    const before = lawCount();
    const six = [1, 2, 3, 4, 5, 6].map((n) => ({ title: null, text: `Corollary number ${n} of the law` }));
    await expect(laws.submitLaw({ title: null, text: PARENT, author: null, email: null, categoryId: null, corollaries: six })).rejects.toThrow('at most 5 corollaries');
    expect(lawCount()).toBe(before);
  });
});
