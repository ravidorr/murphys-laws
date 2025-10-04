-- Create votes table for tracking individual votes
-- Enables analytics and prevents duplicate voting from same identifier

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id INTEGER NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  voter_identifier TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(law_id) REFERENCES laws(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_votes_law_id ON votes(law_id);
CREATE INDEX idx_votes_voter_identifier ON votes(voter_identifier);

-- Unique constraint: one vote per identifier per law
CREATE UNIQUE INDEX idx_votes_unique_voter_law ON votes(law_id, voter_identifier);
