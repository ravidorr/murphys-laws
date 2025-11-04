-- Migration 006: Add performance indexes
-- These indexes optimize common query patterns identified in code review

-- Index on laws.status - used in virtually every query to filter published laws
CREATE INDEX IF NOT EXISTS idx_laws_status
  ON laws(status);

-- Index on laws.created_at - used for "recently added" sorting
CREATE INDEX IF NOT EXISTS idx_laws_created_at
  ON laws(created_at DESC);

-- Indexes on law_categories for efficient category filtering
-- The law_id index helps with joins and EXISTS subqueries
CREATE INDEX IF NOT EXISTS idx_law_categories_law_id
  ON law_categories(law_id);

-- The category_id index helps when filtering by specific categories
CREATE INDEX IF NOT EXISTS idx_law_categories_category_id
  ON law_categories(category_id);

-- Compound index for common join pattern (law_id, category_id)
-- This can be used for queries that filter by both columns
CREATE INDEX IF NOT EXISTS idx_law_categories_compound
  ON law_categories(law_id, category_id);

-- Indexes on attributions for efficient attribution filtering and joins
CREATE INDEX IF NOT EXISTS idx_attributions_law_id
  ON attributions(law_id);

-- Index on attribution name for LIKE searches (e.g., searching by author name)
CREATE INDEX IF NOT EXISTS idx_attributions_name
  ON attributions(name COLLATE NOCASE);
