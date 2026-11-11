-- Migration 024: delete law_relations rows whose from_law_id or to_law_id no longer exists in laws.
--
-- law_relations declares ON DELETE CASCADE foreign keys, but SQLite's own default is off, so a connection enforces
-- foreign keys only if its driver or the caller turns them on. better-sqlite3 (the API) does by default; the sqlite3 CLI
-- does not. Scripts such as review-laws.ts (mergeLaws) delete laws through the CLI, as can a manual sqlite3 session, so
-- a law deleted there leaves its relation rows behind.
--
-- Reads that join laws never show an orphan, but the corollary rules read law_relations alone: the one-level checks and
-- the corollary count in law-relations.service.ts, and attachCandidates in admin-laws.service.ts. A COROLLARY_OF orphan
-- makes a surviving law count as a corollary or as having corollaries, counts toward the per-parent cap, and withholds
-- the split offer from an in-review law. Removing it lets the surviving law be linked, or become a parent or child, as
-- if the orphan had never existed. COMMENT_ON rows are never read by the API, so those are removed only for tidiness.
--
-- The condition names the missing law rather than a relation type, so it clears any orphan (COROLLARY_OF, COMMENT_ON).
-- Re-running is a no-op because the second pass finds nothing to delete.
DELETE FROM law_relations
WHERE NOT EXISTS (SELECT 1 FROM laws WHERE laws.id = law_relations.from_law_id)
   OR NOT EXISTS (SELECT 1 FROM laws WHERE laws.id = law_relations.to_law_id);
