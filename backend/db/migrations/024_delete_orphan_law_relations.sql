-- Migration 024: delete law_relations rows whose from_law_id or to_law_id no longer exists in laws.
--
-- law_relations declares ON DELETE CASCADE foreign keys, but SQLite enforces foreign keys only on connections that turn
-- the pragma on. The sqlite3 CLI does not, which covers the migration runner and scripts such as review-laws.ts that
-- delete laws through it, so a law deleted there leaves its relation rows behind. (The API's better-sqlite3 connection
-- enforces them by default.)
--
-- Reads that join laws never show an orphan, but the one-level checks and the corollary count in
-- law-relations.service.ts read law_relations alone. An orphan makes a surviving child still count as a corollary,
-- makes a parent count as having corollaries, and counts toward the per-parent cap. Removing it lets a surviving child
-- be an ordinary law again.
--
-- The condition names the missing law rather than a relation type, so it clears any orphan (COROLLARY_OF, COMMENT_ON).
-- Re-running is a no-op because the second pass finds nothing to delete.
DELETE FROM law_relations
WHERE NOT EXISTS (SELECT 1 FROM laws WHERE laws.id = law_relations.from_law_id)
   OR NOT EXISTS (SELECT 1 FROM laws WHERE laws.id = law_relations.to_law_id);
