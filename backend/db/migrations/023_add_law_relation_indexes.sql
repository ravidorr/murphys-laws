-- Migration 023: index law_relations for corollary lookups.
--
-- Corollaries are law rows linked to their parent through law_relations: the child is from_law_id, the parent is
-- to_law_id, and relation_type is 'COROLLARY_OF'. Reading a parent's corollaries filters on (to_law_id, relation_type);
-- finding the parent of a corollary, and the one-level depth rule, filter on (from_law_id, relation_type).
--
-- Both indexes are deliberately NOT unique: imported data may already hold duplicate edges, and a unique index would
-- make this migration fail on them. Uniqueness is enforced in code (INSERT ... WHERE NOT EXISTS).
-- IF NOT EXISTS makes a second run a no-op.
CREATE INDEX IF NOT EXISTS idx_law_relations_from ON law_relations(from_law_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_law_relations_to ON law_relations(to_law_id, relation_type);
