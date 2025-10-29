-- Migration 004: Create law_of_the_day_history table
-- Tracks which laws have been featured as "Law of the Day" and when
-- Used to prevent re-using laws within 365 days

CREATE TABLE IF NOT EXISTS law_of_the_day_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  featured_date TEXT NOT NULL, -- DATE in ISO format YYYY-MM-DD
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
  UNIQUE(law_id, featured_date)
);

-- Index for efficient lookups when selecting next law of the day
CREATE INDEX IF NOT EXISTS idx_law_of_the_day_history_featured_date
  ON law_of_the_day_history(featured_date);

-- Index for checking if a specific law was featured recently
CREATE INDEX IF NOT EXISTS idx_law_of_the_day_history_law_id
  ON law_of_the_day_history(law_id, featured_date);
