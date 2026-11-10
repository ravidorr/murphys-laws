import type Database from 'better-sqlite3';
import {
  COROLLARY_TEXT_MAX_LENGTH,
  COROLLARY_TEXT_MIN_LENGTH,
  COROLLARY_TITLE_MAX_LENGTH,
  MAX_COROLLARIES_PER_PARENT
} from '../../../shared/modules/corollary-parser.ts';

type Db = InstanceType<typeof Database>;

/**
 * Corollaries are ordinary law rows linked to their parent through law_relations:
 * the CHILD is from_law_id, the PARENT is to_law_id, relation_type is 'COROLLARY_OF' and note is the child's title.
 * Only one level exists: a child cannot be a parent, and a parent cannot be a child.
 *
 * Every function takes the database (or the same handle inside a caller's transaction) and has no HTTP concerns,
 * so callers compose them. Writes run in their own `db.transaction`, which nests as a savepoint inside a caller's.
 */
export const COROLLARY_RELATION = 'COROLLARY_OF';
/** Marks rows created through the website, matching `LawService.submitLaw`. */
export const WEB_SUBMISSION_PATH = 'web-submission';

export type CorollaryStatus = 'published' | 'in_review';

export interface CorollaryChildInput {
  title: string | null;
  text: string;
}

export interface CreateCorollaryChildrenOptions {
  /** Status for every new child row. */
  status: CorollaryStatus;
  /** The parent's categories; copied onto each child. The caller supplies them. */
  categoryIds: readonly number[];
  /** Public name of the submitter. Written as name only, never with contact details. Null writes no attribution. */
  submitterName: string | null;
}

export interface CorollaryLaw {
  id: number;
  title: string | null;
  text: string;
}

export type LawRelationErrorCode =
  | 'PARENT_NOT_FOUND'
  | 'PARENT_IS_COROLLARY'
  | 'CHILD_HAS_COROLLARIES'
  | 'SELF_RELATION'
  | 'TOO_MANY_COROLLARIES'
  | 'INVALID_COROLLARY';

/** A rule of the corollary model was broken. Callers map this to a 400 or 409; the message is safe to show. */
export class LawRelationError extends Error {
  readonly code: LawRelationErrorCode;

  constructor(code: LawRelationErrorCode, message: string) {
    super(message);
    this.name = 'LawRelationError';
    this.code = code;
  }
}

/** True when the law is a corollary of another law. */
export function isChild(db: Db, lawId: number): boolean {
  return db
    .prepare('SELECT 1 FROM law_relations WHERE from_law_id = ? AND relation_type = ? LIMIT 1')
    .get(lawId, COROLLARY_RELATION) !== undefined;
}

function hasCorollaries(db: Db, lawId: number): boolean {
  return db
    .prepare('SELECT 1 FROM law_relations WHERE to_law_id = ? AND relation_type = ? LIMIT 1')
    .get(lawId, COROLLARY_RELATION) !== undefined;
}

function assertCanBeParent(db: Db, parentId: number): void {
  if (db.prepare('SELECT 1 FROM laws WHERE id = ?').get(parentId) === undefined) {
    throw new LawRelationError('PARENT_NOT_FOUND', 'Parent law not found');
  }
  if (isChild(db, parentId)) {
    throw new LawRelationError('PARENT_IS_COROLLARY', 'A corollary cannot have corollaries of its own');
  }
}

/**
 * Links an existing law as a corollary of a parent. Returns true when a relation was added and false when the same
 * relation already existed, so repeating the call never duplicates it.
 */
export function linkCorollary(db: Db, childId: number, parentId: number, note: string | null): boolean {
  if (childId === parentId) {
    throw new LawRelationError('SELF_RELATION', 'A law cannot be a corollary of itself');
  }
  assertCanBeParent(db, parentId);
  if (hasCorollaries(db, childId)) {
    throw new LawRelationError('CHILD_HAS_COROLLARIES', 'A law with corollaries cannot become a corollary');
  }
  const result = db
    .prepare(
      `INSERT INTO law_relations (from_law_id, to_law_id, relation_type, note)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM law_relations WHERE from_law_id = ? AND to_law_id = ? AND relation_type = ?
       )`
    )
    .run(childId, parentId, COROLLARY_RELATION, note, childId, parentId, COROLLARY_RELATION);
  return result.changes > 0;
}

function cleanChild(child: CorollaryChildInput, position: number): CorollaryChildInput {
  const text = typeof child.text === 'string' ? child.text.trim() : '';
  const title = typeof child.title === 'string' ? child.title.trim() : '';
  if (text.length < COROLLARY_TEXT_MIN_LENGTH || text.length > COROLLARY_TEXT_MAX_LENGTH) {
    throw new LawRelationError(
      'INVALID_COROLLARY',
      `Corollary ${position} must be between ${COROLLARY_TEXT_MIN_LENGTH} and ${COROLLARY_TEXT_MAX_LENGTH} characters`
    );
  }
  if (title.length > COROLLARY_TITLE_MAX_LENGTH) {
    throw new LawRelationError('INVALID_COROLLARY', `Corollary ${position} title must be at most ${COROLLARY_TITLE_MAX_LENGTH} characters`);
  }
  return { title: title === '' ? null : title, text };
}

/**
 * Creates one law row per child and links each to the parent. Every child copies the parent's categories, is stored
 * with first_seen_file_path 'web-submission', and gets an attribution carrying the submitter's NAME ONLY
 * (contact_type 'text', contact_value NULL): an email is never copied, so no child can trigger a thank-you message.
 *
 * All input is validated before the first insert, and the inserts are atomic: if any child fails, none remain.
 */
export function createCorollaryChildren(
  db: Db,
  parentId: number,
  children: readonly CorollaryChildInput[],
  options: CreateCorollaryChildrenOptions
): CorollaryLaw[] {
  const cleaned = children.map((child, index) => cleanChild(child, index + 1));
  const categoryIds = [...new Set(options.categoryIds)];
  const submitterName = options.submitterName?.trim() || null;

  return db.transaction((): CorollaryLaw[] => {
    assertCanBeParent(db, parentId);
    if (cleaned.length === 0) return [];

    const existing = (db
      .prepare('SELECT COUNT(DISTINCT from_law_id) AS n FROM law_relations WHERE to_law_id = ? AND relation_type = ?')
      .get(parentId, COROLLARY_RELATION) as { n: number }).n;
    if (existing + cleaned.length > MAX_COROLLARIES_PER_PARENT) {
      throw new LawRelationError(
        'TOO_MANY_COROLLARIES',
        `A law can have at most ${MAX_COROLLARIES_PER_PARENT} corollaries`
      );
    }

    const insertLaw = db.prepare(
      'INSERT INTO laws (title, text, status, first_seen_file_path) VALUES (?, ?, ?, ?) RETURNING id'
    );
    const insertCategory = db.prepare('INSERT INTO law_categories (law_id, category_id) VALUES (?, ?)');
    const insertAttribution = db.prepare(
      "INSERT INTO attributions (law_id, name, contact_type, contact_value) VALUES (?, ?, 'text', NULL)"
    );

    return cleaned.map((child) => {
      const { id } = insertLaw.get(child.title, child.text, options.status, WEB_SUBMISSION_PATH) as { id: number };
      for (const categoryId of categoryIds) insertCategory.run(id, categoryId);
      if (submitterName) insertAttribution.run(id, submitterName);
      linkCorollary(db, id, parentId, child.title);
      return { id, title: child.title, text: child.text };
    });
  })();
}

/**
 * A parent's corollaries in the order they were linked (the original bullet order). A corollary appears only when
 * both it and the parent are published. A child linked twice appears once.
 */
export function getCorollaries(db: Db, parentId: number): CorollaryLaw[] {
  return db
    .prepare(
      `SELECT c.id, c.title, c.text
       FROM law_relations r
       JOIN laws c ON c.id = r.from_law_id
       JOIN laws p ON p.id = r.to_law_id
       WHERE r.to_law_id = ? AND r.relation_type = ?
         AND c.status = 'published' AND p.status = 'published'
       GROUP BY c.id
       ORDER BY MIN(r.id)`
    )
    .all(parentId, COROLLARY_RELATION) as CorollaryLaw[];
}

/** The parent of a corollary, or null. Returned only when both the corollary and the parent are published. */
export function getCorollaryOf(db: Db, childId: number): CorollaryLaw | null {
  const row = db
    .prepare(
      `SELECT p.id, p.title, p.text
       FROM law_relations r
       JOIN laws c ON c.id = r.from_law_id
       JOIN laws p ON p.id = r.to_law_id
       WHERE r.from_law_id = ? AND r.relation_type = ?
         AND c.status = 'published' AND p.status = 'published'
       ORDER BY r.id
       LIMIT 1`
    )
    .get(childId, COROLLARY_RELATION) as CorollaryLaw | undefined;
  return row ?? null;
}
