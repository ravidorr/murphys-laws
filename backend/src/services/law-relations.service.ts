import type Database from 'better-sqlite3';
import {
  COROLLARY_TEXT_MAX_LENGTH,
  COROLLARY_TEXT_MIN_LENGTH,
  COROLLARY_TITLE_MAX_LENGTH,
  MAX_COROLLARIES_PER_PARENT
} from '../../../shared/modules/corollary-parser.ts';

type Db = InstanceType<typeof Database>;

/*
 * Corollaries are ordinary law rows linked to their parent through law_relations. For rows written by this service
 * the CHILD is from_law_id, the PARENT is to_law_id, relation_type is 'COROLLARY_OF' and note is the child's title
 * (imported rows follow the same direction but may carry a different note).
 *
 * The model has one level and one parent: a corollary cannot have corollaries, cannot be linked to two parents, and
 * a parent cannot itself be a corollary. A parent has at most MAX_COROLLARIES_PER_PARENT corollaries, counting
 * every child whatever its status, so a rejected or in-review corollary keeps its slot.
 *
 * Every function takes the database handle (or the same handle inside a caller's transaction) and has no HTTP
 * concerns, so callers compose them. `createCorollaryChildren` runs in its own `db.transaction`, which better-sqlite3
 * turns into a savepoint when a caller's transaction is already open, so its writes commit or roll back with the
 * caller's. `linkCorollary` is a single check-then-insert and relies on better-sqlite3 being synchronous.
 */
export const COROLLARY_RELATION = 'COROLLARY_OF';
/** Marks rows created through the website, the same value `LawService.submitLaw` writes. */
export const WEB_SUBMISSION_PATH = 'web-submission';

/** Statuses a new child can start with. `rejected` is not offered: nothing creates a corollary just to reject it. */
export type CorollaryStatus = 'published' | 'in_review';

export interface CorollaryChildInput {
  title: string | null;
  text: string;
}

export interface CreateCorollaryChildrenOptions {
  /** Status for every new child row. A published child needs a published parent. */
  status: CorollaryStatus;
  /** Categories to copy onto each child. The caller passes the parent's; every id must exist. */
  categoryIds: readonly number[];
  /** Public name of the submitter. Written as name only, never with contact details. Null or blank writes no attribution. */
  submitterName: string | null;
}

/** A law as the relation reads return it. */
export interface RelatedLaw extends CorollaryChildInput {
  id: number;
}

export type LawRelationErrorCode =
  | 'PARENT_NOT_FOUND'
  | 'CHILD_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'PARENT_IS_COROLLARY'
  | 'PARENT_NOT_PUBLISHED'
  | 'CHILD_HAS_COROLLARIES'
  | 'CHILD_ALREADY_HAS_PARENT'
  | 'SELF_RELATION'
  | 'TOO_MANY_COROLLARIES'
  | 'INVALID_COROLLARY';

/** The HTTP status a caller should answer with for each rule, so every endpoint maps the same way. */
export const LAW_RELATION_ERROR_STATUS: Readonly<Record<LawRelationErrorCode, 400 | 404>> = {
  PARENT_NOT_FOUND: 404,
  CHILD_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 400,
  PARENT_IS_COROLLARY: 400,
  PARENT_NOT_PUBLISHED: 400,
  CHILD_HAS_COROLLARIES: 400,
  CHILD_ALREADY_HAS_PARENT: 400,
  SELF_RELATION: 400,
  TOO_MANY_COROLLARIES: 400,
  INVALID_COROLLARY: 400
};

/** A rule of the corollary model was broken. The message is safe to show to an admin or submitter. */
export class LawRelationError extends Error {
  readonly code: LawRelationErrorCode;
  /** 1-based position of the offending corollary in the input list, when the error is about one of them. */
  readonly position?: number;

  constructor(code: LawRelationErrorCode, message: string, position?: number) {
    super(message);
    this.name = 'LawRelationError';
    this.code = code;
    if (position !== undefined) this.position = position;
  }
}

function exists(db: Db, sql: string, ...params: unknown[]): boolean {
  return db.prepare(sql).get(...params) !== undefined;
}

/** True when the law is a corollary of another law. */
export function isChild(db: Db, lawId: number): boolean {
  return exists(db, 'SELECT 1 FROM law_relations WHERE from_law_id = ? AND relation_type = ? LIMIT 1', lawId, COROLLARY_RELATION);
}

/** True when the law has at least one corollary, whatever its status. */
export function hasCorollaries(db: Db, lawId: number): boolean {
  return exists(db, 'SELECT 1 FROM law_relations WHERE to_law_id = ? AND relation_type = ? LIMIT 1', lawId, COROLLARY_RELATION);
}

function countCorollaries(db: Db, parentId: number, exceptChildId: number | null): number {
  return (db
    .prepare(
      `SELECT COUNT(DISTINCT from_law_id) AS n FROM law_relations
       WHERE to_law_id = ? AND relation_type = ? AND from_law_id IS NOT ?`
    )
    .get(parentId, COROLLARY_RELATION, exceptChildId) as { n: number }).n;
}

function statusOf(db: Db, lawId: number): string | undefined {
  return (db.prepare('SELECT status FROM laws WHERE id = ?').get(lawId) as { status: string } | undefined)?.status;
}

function assertCanBeParent(db: Db, parentId: number): void {
  if (statusOf(db, parentId) === undefined) {
    throw new LawRelationError('PARENT_NOT_FOUND', `Parent law ${parentId} not found`);
  }
  if (isChild(db, parentId)) {
    throw new LawRelationError('PARENT_IS_COROLLARY', 'A corollary cannot have corollaries of its own');
  }
}

/**
 * Links an existing law as a corollary of a parent. Returns true when a relation was added and false when the same
 * relation already existed (a repeat never duplicates it, and keeps the note it was first given).
 *
 * Refuses: linking a law to itself, an unknown law on either side, a parent that is a corollary, a child that has
 * corollaries, a child that already belongs to a different parent, a parent that already has the maximum number of
 * corollaries, and a published child under a parent that is not published.
 */
export function linkCorollary(db: Db, childId: number, parentId: number, note: string | null): boolean {
  if (childId === parentId) {
    throw new LawRelationError('SELF_RELATION', 'A law cannot be a corollary of itself');
  }
  assertCanBeParent(db, parentId);
  const childStatus = statusOf(db, childId);
  if (childStatus === undefined) {
    throw new LawRelationError('CHILD_NOT_FOUND', `Corollary law ${childId} not found`);
  }
  if (hasCorollaries(db, childId)) {
    throw new LawRelationError('CHILD_HAS_COROLLARIES', 'A law with corollaries cannot become a corollary');
  }
  if (exists(db, 'SELECT 1 FROM law_relations WHERE from_law_id = ? AND to_law_id != ? AND relation_type = ? LIMIT 1', childId, parentId, COROLLARY_RELATION)) {
    throw new LawRelationError('CHILD_ALREADY_HAS_PARENT', 'A corollary can belong to only one law');
  }
  if (childStatus === 'published' && statusOf(db, parentId) !== 'published') {
    throw new LawRelationError('PARENT_NOT_PUBLISHED', 'A corollary cannot be published while its law is not');
  }
  if (countCorollaries(db, parentId, childId) >= MAX_COROLLARIES_PER_PARENT) {
    throw new LawRelationError('TOO_MANY_COROLLARIES', `A law can have at most ${MAX_COROLLARIES_PER_PARENT} corollaries`);
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

/** Validates one input entry. The inputs are typed, but callers pass parsed JSON, so the types are checked too. */
function cleanChild(child: CorollaryChildInput, position: number): CorollaryChildInput {
  if (typeof child !== 'object' || child === null) {
    throw new LawRelationError('INVALID_COROLLARY', `Corollary ${position} must be an object`, position);
  }
  if (typeof child.text !== 'string') {
    throw new LawRelationError('INVALID_COROLLARY', `Corollary ${position} text must be a string`, position);
  }
  if (child.title !== null && child.title !== undefined && typeof child.title !== 'string') {
    throw new LawRelationError('INVALID_COROLLARY', `Corollary ${position} title must be a string or null`, position);
  }
  const text = child.text.trim();
  const title = (child.title ?? '').trim();
  if (text.length < COROLLARY_TEXT_MIN_LENGTH || text.length > COROLLARY_TEXT_MAX_LENGTH) {
    throw new LawRelationError(
      'INVALID_COROLLARY',
      `Corollary ${position} must be between ${COROLLARY_TEXT_MIN_LENGTH} and ${COROLLARY_TEXT_MAX_LENGTH} characters`,
      position
    );
  }
  if (title.length > COROLLARY_TITLE_MAX_LENGTH) {
    throw new LawRelationError(
      'INVALID_COROLLARY',
      `Corollary ${position} title must be at most ${COROLLARY_TITLE_MAX_LENGTH} characters`,
      position
    );
  }
  return { title: title === '' ? null : title, text };
}

/**
 * Creates one law row per child and links each to the parent. Every child gets the supplied categories, is stored
 * with first_seen_file_path 'web-submission', and gets an attribution carrying the submitter's NAME ONLY
 * (contact_type 'text', contact_value NULL): an email is never copied, so no child can trigger a thank-you message.
 * Blank titles are stored as NULL. An empty list creates nothing and returns an empty list.
 *
 * All input is validated before the first insert, and the inserts are atomic: if any child fails, none remain.
 */
export function createCorollaryChildren(
  db: Db,
  parentId: number,
  children: readonly CorollaryChildInput[],
  options: CreateCorollaryChildrenOptions
): RelatedLaw[] {
  if (!Array.isArray(children)) {
    throw new LawRelationError('INVALID_COROLLARY', 'Corollaries must be a list');
  }
  const cleaned = children.map((child, index) => cleanChild(child, index + 1));
  const categoryIds = [...new Set(options.categoryIds)];
  const submitterName = options.submitterName?.trim() || null;

  return db.transaction((): RelatedLaw[] => {
    assertCanBeParent(db, parentId);
    for (const categoryId of categoryIds) {
      if (!exists(db, 'SELECT 1 FROM categories WHERE id = ?', categoryId)) {
        throw new LawRelationError('CATEGORY_NOT_FOUND', `Category ${categoryId} not found`);
      }
    }
    if (countCorollaries(db, parentId, null) + cleaned.length > MAX_COROLLARIES_PER_PARENT) {
      throw new LawRelationError('TOO_MANY_COROLLARIES', `A law can have at most ${MAX_COROLLARIES_PER_PARENT} corollaries`);
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
export function getCorollaries(db: Db, parentId: number): RelatedLaw[] {
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
    .all(parentId, COROLLARY_RELATION) as RelatedLaw[];
}

/** The parent of a corollary, or null. Returned only when both the corollary and the parent are published. */
export function getCorollaryOf(db: Db, childId: number): RelatedLaw | null {
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
    .get(childId, COROLLARY_RELATION) as RelatedLaw | undefined;
  return row ?? null;
}
