-- Migration 005: Strip redundant quotes from law text
-- Some laws were submitted with quotes already wrapped around them.
-- Since the display code adds quotes automatically, this creates double quotes.
-- This migration removes the outer quotes from these laws.

UPDATE laws
SET text = SUBSTR(text, 2, LENGTH(text) - 2)
WHERE status = 'published'
  AND text LIKE '"%'
  AND text LIKE '%"'
  AND LENGTH(text) > 2;
