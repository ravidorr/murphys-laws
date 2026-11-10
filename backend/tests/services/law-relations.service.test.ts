import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import {
  COROLLARY_RELATION,
  createCorollaryChildren,
  getCorollaries,
  getCorollaryOf,
  isChild,
  LawRelationError,
  linkCorollary,
  type LawRelationErrorCode
} from '../../src/services/law-relations.service.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

type Db = InstanceType<typeof Database>;

const OPTIONS = { status: 'in_review', categoryIds: [] as number[], submitterName: null } as const;

describe('law-relations service (real migrated schema)', () => {
  let db: Db;
  let categoryIds: number[];
  /** The migrations seed archive laws, so counts are measured against this baseline. */
  let baseLaws: number;

  const insertLaw = (text: string, status = 'published', title: string | null = null): number =>
    Number(
      db
        .prepare("INSERT INTO laws (title, text, status, first_seen_file_path) VALUES (?, ?, ?, 'web-submission')")
        .run(title, text, status).lastInsertRowid
    );
  const link = (childId: number, parentId: number, type = COROLLARY_RELATION): void => {
    db.prepare('INSERT INTO law_relations (from_law_id, to_law_id, relation_type, note) VALUES (?, ?, ?, NULL)').run(childId, parentId, type);
  };
  const relations = (): Array<{ from_law_id: number; to_law_id: number; relation_type: string; note: string | null }> =>
    db.prepare('SELECT from_law_id, to_law_id, relation_type, note FROM law_relations ORDER BY id').all() as never;
  const count = (table: string): number => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  const codeOf = (fn: () => unknown): LawRelationErrorCode | undefined => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(LawRelationError);
      return (error as LawRelationError).code;
    }
    return undefined;
  };

  beforeEach(() => {
    db = createMigratedDb();
    baseLaws = count('laws');
    categoryIds = (db.prepare('SELECT id FROM categories ORDER BY id LIMIT 2').all() as Array<{ id: number }>).map((c) => c.id);
  });
  afterEach(() => { db.close(); });

  describe('createCorollaryChildren', () => {
    it('creates child laws linked child -> parent as COROLLARY_OF with the child title as the note', () => {
      const parent = insertLaw('Any fix applied on a Friday will break something by Monday.', 'in_review');
      const created = createCorollaryChildren(
        db,
        parent,
        [
          { title: 'The Ignition Corollary', text: 'The harder you press the button, the less it matters.' },
          { title: null, text: 'The previous version had the bug you just fixed.' }
        ],
        { status: 'published', categoryIds: [], submitterName: null }
      );

      expect(created.map((c) => c.title)).toEqual(['The Ignition Corollary', null]);
      expect(relations()).toEqual([
        { from_law_id: created[0].id, to_law_id: parent, relation_type: 'COROLLARY_OF', note: 'The Ignition Corollary' },
        { from_law_id: created[1].id, to_law_id: parent, relation_type: 'COROLLARY_OF', note: null }
      ]);
      const row = db.prepare('SELECT title, text, status, first_seen_file_path FROM laws WHERE id = ?').get(created[0].id);
      expect(row).toEqual({
        title: 'The Ignition Corollary',
        text: 'The harder you press the button, the less it matters.',
        status: 'published',
        first_seen_file_path: 'web-submission'
      });
    });

    it('uses the requested status and trims text and title, treating a blank title as none', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      const [child] = createCorollaryChildren(db, parent, [{ title: '   ', text: '  Padded corollary text here.  ' }], OPTIONS);
      expect(child).toEqual({ id: child.id, title: null, text: 'Padded corollary text here.' });
      expect(db.prepare('SELECT status FROM laws WHERE id = ?').get(child.id)).toEqual({ status: 'in_review' });
    });

    it('copies the parent categories onto every child once, even when listed twice', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      const created = createCorollaryChildren(
        db,
        parent,
        [{ title: null, text: 'First corollary with enough text.' }, { title: null, text: 'Second corollary with enough text.' }],
        { status: 'published', categoryIds: [...categoryIds, categoryIds[0]], submitterName: null }
      );
      for (const child of created) {
        const copied = db.prepare('SELECT category_id FROM law_categories WHERE law_id = ? ORDER BY category_id').all(child.id);
        expect(copied).toEqual(categoryIds.map((category_id) => ({ category_id })));
      }
    });

    it('writes the submitter name only, never an email', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      db.prepare("INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, 'Pat Example', 'email', 'pat@example.test')").run(parent);
      const [child] = createCorollaryChildren(db, parent, [{ title: null, text: 'A corollary with enough text.' }], {
        status: 'in_review',
        categoryIds: [],
        submitterName: '  Pat Example  '
      });
      expect(db.prepare('SELECT name, contact_type, contact_value FROM attributions WHERE law_id = ?').all(child.id)).toEqual([
        { name: 'Pat Example', contact_type: 'text', contact_value: null }
      ]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM attributions WHERE contact_value IS NOT NULL AND law_id != ?").get(parent)).toEqual({ n: 0 });
    });

    it('writes no attribution when there is no submitter name', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      createCorollaryChildren(db, parent, [{ title: null, text: 'A corollary with enough text.' }], OPTIONS);
      createCorollaryChildren(db, parent, [{ title: null, text: 'Another corollary with text.' }], { ...OPTIONS, submitterName: '   ' });
      expect(count('attributions')).toBe(0);
    });

    it('returns nothing and writes nothing for an empty list', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      expect(createCorollaryChildren(db, parent, [], OPTIONS)).toEqual([]);
      expect(relations()).toEqual([]);
    });

    it('indexes the new children for search', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      const [child] = createCorollaryChildren(db, parent, [{ title: null, text: 'Zebrafish corollary lands butter side down.' }], {
        ...OPTIONS,
        status: 'published'
      });
      const hits = db.prepare('SELECT rowid FROM laws_fts WHERE laws_fts MATCH ?').all('zebrafish') as Array<{ rowid: number }>;
      expect(hits.map((h) => h.rowid)).toEqual([child.id]);
    });

    describe('depth and limits', () => {
      it('refuses to add corollaries to a corollary', () => {
        const parent = insertLaw('A parent law with enough text.');
        const child = insertLaw('A corollary with enough text.');
        link(child, parent);
        expect(codeOf(() => createCorollaryChildren(db, child, [{ title: null, text: 'A grandchild with enough text.' }], OPTIONS)))
          .toBe('PARENT_IS_COROLLARY');
        expect(count('laws')).toBe(baseLaws + 2);
      });

      it('allows a law that only has a non-corollary relation to become a parent', () => {
        const parent = insertLaw('A parent law with enough text.');
        const other = insertLaw('Another law with enough text.');
        link(parent, other, 'COMMENT_ON');
        expect(createCorollaryChildren(db, parent, [{ title: null, text: 'A corollary with enough text.' }], OPTIONS)).toHaveLength(1);
      });

      it('refuses an unknown parent', () => {
        expect(codeOf(() => createCorollaryChildren(db, 999999, [{ title: null, text: 'A corollary with enough text.' }], OPTIONS)))
          .toBe('PARENT_NOT_FOUND');
      });

      it('allows five corollaries and refuses a sixth, counting those already linked', () => {
        const parent = insertLaw('A parent law with enough text.');
        const five = Array.from({ length: 5 }, (_, i) => ({ title: null, text: `Corollary number ${i + 1} of the law.` }));
        expect(createCorollaryChildren(db, parent, five, OPTIONS)).toHaveLength(5);
        expect(codeOf(() => createCorollaryChildren(db, parent, [{ title: null, text: 'One corollary too many here.' }], OPTIONS)))
          .toBe('TOO_MANY_COROLLARIES');

        const other = insertLaw('Another parent law with text.');
        expect(codeOf(() => createCorollaryChildren(db, other, [...five, ...five].slice(0, 6), OPTIONS))).toBe('TOO_MANY_COROLLARIES');
        expect(count('laws')).toBe(baseLaws + 2 + 5);
      });
    });

    describe('validation', () => {
      const cases: Array<[string, { title: string | null; text: unknown }]> = [
        ['text shorter than 10 characters', { title: null, text: '123456789' }],
        ['text that is only whitespace', { title: null, text: '            ' }],
        ['text longer than 1000 characters', { title: null, text: 'x'.repeat(1001) }],
        ['text that is not a string', { title: null, text: 42 }],
        ['a title longer than 200 characters', { title: 't'.repeat(201), text: 'A corollary with enough text.' }]
      ];
      it.each(cases)('rejects %s without inserting anything', (_name, child) => {
        const parent = insertLaw('A parent law with enough text.', 'in_review');
        const before = count('laws');
        expect(codeOf(() => createCorollaryChildren(db, parent, [
          { title: null, text: 'A valid corollary with text.' },
          child as { title: string | null; text: string }
        ], OPTIONS))).toBe('INVALID_COROLLARY');
        expect(count('laws')).toBe(before);
        expect(relations()).toEqual([]);
      });

      it('accepts the boundary lengths and ignores a title that is not a string', () => {
        const parent = insertLaw('A parent law with enough text.', 'in_review');
        const created = createCorollaryChildren(db, parent, [
          { title: 't'.repeat(200), text: '1234567890' },
          { title: undefined as unknown as null, text: 'x'.repeat(1000) }
        ], OPTIONS);
        expect(created.map((c) => [c.title?.length ?? null, c.text.length])).toEqual([[200, 10], [null, 1000]]);
      });
    });

    describe('atomicity', () => {
      const addBoomTrigger = (): void => {
        db.exec(`CREATE TRIGGER boom BEFORE INSERT ON laws WHEN NEW.text = 'This corollary always fails.'
                 BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
      };
      const children = [
        { title: 'First', text: 'This first corollary is fine.' },
        { title: 'Second', text: 'This corollary always fails.' }
      ];

      it('leaves nothing behind when one child fails', () => {
        const parent = insertLaw('A parent law with enough text.', 'in_review');
        addBoomTrigger();
        const before = { laws: count('laws'), attributions: count('attributions'), categories: count('law_categories') };
        expect(() => createCorollaryChildren(db, parent, children, { status: 'published', categoryIds, submitterName: 'Pat' })).toThrow('boom');
        expect({ laws: count('laws'), attributions: count('attributions'), categories: count('law_categories') }).toEqual(before);
        expect(relations()).toEqual([]);
      });

      it('rolls back with the caller\'s transaction and keeps the caller\'s earlier writes until it rolls back', () => {
        const parent = insertLaw('A parent law with enough text.', 'in_review');
        addBoomTrigger();
        const approve = db.transaction(() => {
          db.prepare("UPDATE laws SET status = 'published' WHERE id = ?").run(parent);
          createCorollaryChildren(db, parent, children, { status: 'published', categoryIds, submitterName: 'Pat' });
        });
        expect(() => approve()).toThrow('boom');
        expect(db.prepare('SELECT status FROM laws WHERE id = ?').get(parent)).toEqual({ status: 'in_review' });
        expect(relations()).toEqual([]);
        expect(count('laws')).toBe(baseLaws + 1);
      });

      it('commits with the caller\'s transaction when everything succeeds', () => {
        const parent = insertLaw('A parent law with enough text.', 'in_review');
        const approve = db.transaction(() => {
          db.prepare("UPDATE laws SET status = 'published' WHERE id = ?").run(parent);
          return createCorollaryChildren(db, parent, [children[0]], { status: 'published', categoryIds: [], submitterName: null });
        });
        const [child] = approve();
        expect(getCorollaries(db, parent).map((c) => c.id)).toEqual([child.id]);
      });
    });
  });

  describe('linkCorollary', () => {
    it('does not duplicate a relation that already exists', () => {
      const parent = insertLaw('A parent law with enough text.');
      const child = insertLaw('A corollary with enough text.');
      expect(linkCorollary(db, child, parent, 'Title')).toBe(true);
      expect(linkCorollary(db, child, parent, 'Title')).toBe(false);
      expect(relations()).toEqual([{ from_law_id: child, to_law_id: parent, relation_type: 'COROLLARY_OF', note: 'Title' }]);
    });

    it('treats a different relation type between the same laws as not a duplicate', () => {
      const parent = insertLaw('A parent law with enough text.');
      const child = insertLaw('A corollary with enough text.');
      link(child, parent, 'COMMENT_ON');
      expect(linkCorollary(db, child, parent, null)).toBe(true);
      expect(relations()).toHaveLength(2);
    });

    it('refuses a law as its own corollary', () => {
      const law = insertLaw('A law with enough text.');
      expect(codeOf(() => linkCorollary(db, law, law, null))).toBe('SELF_RELATION');
    });

    it('refuses a parent that is a corollary', () => {
      const grand = insertLaw('A top law with enough text.');
      const middle = insertLaw('A middle law with enough text.');
      const leaf = insertLaw('A leaf law with enough text.');
      link(middle, grand);
      expect(codeOf(() => linkCorollary(db, leaf, middle, null))).toBe('PARENT_IS_COROLLARY');
    });

    it('refuses a child that already has corollaries', () => {
      const top = insertLaw('A top law with enough text.');
      const parent = insertLaw('A parent law with enough text.');
      const leaf = insertLaw('A leaf law with enough text.');
      link(leaf, parent);
      expect(codeOf(() => linkCorollary(db, parent, top, null))).toBe('CHILD_HAS_COROLLARIES');
      expect(relations()).toHaveLength(1);
    });

    it('refuses an unknown parent', () => {
      const child = insertLaw('A corollary with enough text.');
      expect(codeOf(() => linkCorollary(db, child, 999999, null))).toBe('PARENT_NOT_FOUND');
    });
  });

  describe('isChild', () => {
    it('is true only for the from side of a COROLLARY_OF relation', () => {
      const parent = insertLaw('A parent law with enough text.');
      const child = insertLaw('A corollary with enough text.');
      const commenter = insertLaw('A commenting law with text.');
      link(child, parent);
      link(commenter, parent, 'COMMENT_ON');
      expect(isChild(db, child)).toBe(true);
      expect(isChild(db, parent)).toBe(false);
      expect(isChild(db, commenter)).toBe(false);
      expect(isChild(db, 999999)).toBe(false);
    });
  });

  describe('getCorollaries / getCorollaryOf', () => {
    it('reads in the direction child -> parent', () => {
      const parent = insertLaw('A parent law with enough text.', 'published', 'Parent title');
      const child = insertLaw('A corollary with enough text.', 'published', 'Child title');
      link(child, parent);
      expect(getCorollaries(db, parent)).toEqual([{ id: child, title: 'Child title', text: 'A corollary with enough text.' }]);
      expect(getCorollaries(db, child)).toEqual([]);
      expect(getCorollaryOf(db, child)).toEqual({ id: parent, title: 'Parent title', text: 'A parent law with enough text.' });
      expect(getCorollaryOf(db, parent)).toBeNull();
    });

    it('orders corollaries by relation id, not by law id', () => {
      const parent = insertLaw('A parent law with enough text.');
      const first = insertLaw('The first listed corollary.');
      const second = insertLaw('The second listed corollary.');
      const third = insertLaw('The third listed corollary.');
      link(third, parent);
      link(first, parent);
      link(second, parent);
      expect(getCorollaries(db, parent).map((c) => c.id)).toEqual([third, first, second]);
    });

    it('returns only corollaries that are published, when the parent is published', () => {
      const parent = insertLaw('A parent law with enough text.');
      const published = insertLaw('A published corollary text.');
      const review = insertLaw('A corollary still in review.', 'in_review');
      const rejected = insertLaw('A rejected corollary text.', 'rejected');
      link(published, parent);
      link(review, parent);
      link(rejected, parent);
      expect(getCorollaries(db, parent).map((c) => c.id)).toEqual([published]);
    });

    it.each(['in_review', 'rejected'])('returns nothing when the parent is %s', (status) => {
      const parent = insertLaw('A parent law with enough text.', status);
      const child = insertLaw('A published corollary text.');
      link(child, parent);
      expect(getCorollaries(db, parent)).toEqual([]);
      expect(getCorollaryOf(db, child)).toBeNull();
    });

    it('returns no parent for a corollary that is not published itself', () => {
      const parent = insertLaw('A parent law with enough text.');
      const child = insertLaw('A corollary still in review.', 'in_review');
      link(child, parent);
      expect(getCorollaryOf(db, child)).toBeNull();
    });

    it('ignores other relation types', () => {
      const parent = insertLaw('A parent law with enough text.');
      const commenter = insertLaw('A commenting law with text.');
      link(commenter, parent, 'COMMENT_ON');
      expect(getCorollaries(db, parent)).toEqual([]);
      expect(getCorollaryOf(db, commenter)).toBeNull();
    });

    it('lists a child once and picks the first published parent when imported data holds duplicate or extra edges', () => {
      const unpublished = insertLaw('A parent that is in review.', 'in_review');
      const parent = insertLaw('A published parent law text.');
      const other = insertLaw('Another published parent text.');
      const child = insertLaw('A corollary with enough text.');
      link(child, unpublished);
      link(child, parent);
      link(child, parent);
      link(child, other);
      expect(getCorollaries(db, parent).map((c) => c.id)).toEqual([child]);
      expect(getCorollaryOf(db, child)?.id).toBe(parent);
    });

    it('returns a created-then-approved corollary', () => {
      const parent = insertLaw('A parent law with enough text.', 'in_review');
      createCorollaryChildren(db, parent, [{ title: 'Child', text: 'A corollary with enough text.' }], OPTIONS);
      expect(getCorollaries(db, parent)).toEqual([]);
      db.prepare("UPDATE laws SET status = 'published'").run();
      expect(getCorollaries(db, parent).map((c) => c.title)).toEqual(['Child']);
    });
  });
});
