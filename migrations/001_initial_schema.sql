CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  source_file_path TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  title TEXT,                  -- e.g., "Peter Principle", "Cole's Law"
  text TEXT NOT NULL,          -- main content (plain text)
  raw_markdown TEXT,           -- optional, original fragment
  origin_note TEXT,            -- e.g., "Buddha's version", "Larry Niven's summary"
  first_seen_file_path TEXT,   -- provenance
  first_seen_line_number INTEGER,
  canonical INTEGER DEFAULT 1, -- for future de-dup workflows
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), status TEXT DEFAULT 'published' CHECK(status IN ('published', 'in_review', 'rejected')), admin_notes TEXT,
  UNIQUE(first_seen_file_path, first_seen_line_number)
);
CREATE TABLE law_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  position INTEGER,
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(law_id, category_id)
);
CREATE TABLE attributions (
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
CREATE TABLE law_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_law_id INTEGER NOT NULL,
  to_law_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL, -- COROLLARY_OF | VARIANT_OF | TRANSLATION_OF | COMMENT_ON
  note TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (from_law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (to_law_id) REFERENCES laws(id) ON DELETE CASCADE
);
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  voter_identifier TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(law_id) REFERENCES laws(id) ON DELETE CASCADE
);
CREATE INDEX idx_votes_law_id ON votes(law_id);
CREATE INDEX idx_votes_voter_identifier ON votes(voter_identifier);
CREATE UNIQUE INDEX idx_votes_unique_voter_law ON votes(law_id, voter_identifier);
