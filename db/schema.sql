-- Murphy's Laws SQLite schema
-- Safe to run repeatedly; uses IF NOT EXISTS and UPSERTs in importer

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  source_file_path TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  title TEXT,                  -- e.g., "Peter Principle", "Cole's Law"
  text TEXT NOT NULL,          -- main content (plain text)
  raw_markdown TEXT,           -- optional, original fragment
  origin_note TEXT,            -- e.g., "Buddha's version", "Larry Niven's summary"
  language TEXT DEFAULT 'en',
  first_seen_file_path TEXT,   -- provenance
  first_seen_line_number INTEGER,
  canonical INTEGER DEFAULT 1, -- for future de-dup workflows
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(first_seen_file_path, first_seen_line_number)
);

CREATE TABLE IF NOT EXISTS law_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  position INTEGER,
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(law_id, category_id)
);

CREATE TABLE IF NOT EXISTS attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  name TEXT,
  contact_type TEXT,  -- email | url | text
  contact_value TEXT,
  note TEXT,
  source_fragment TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS law_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_law_id INTEGER NOT NULL,
  to_law_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL, -- COROLLARY_OF | VARIANT_OF | TRANSLATION_OF | COMMENT_ON
  note TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (from_law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (to_law_id) REFERENCES laws(id) ON DELETE CASCADE
);
