-- Migration 008: Create facebook_data_deletion_requests table
-- Tracks Facebook user data deletion requests for GDPR compliance
-- This table stores deletion requests even though the app currently doesn't
-- store Facebook user data, for audit trail and future-proofing

CREATE TABLE IF NOT EXISTS facebook_data_deletion_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facebook_user_id TEXT NOT NULL,
  confirmation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed', -- completed | pending | failed
  request_payload TEXT, -- JSON of the original signed request for audit
  ip_address TEXT, -- IP address of the request
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  processed_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Index for efficient lookups by Facebook user ID
CREATE INDEX IF NOT EXISTS idx_facebook_deletion_fb_user_id
  ON facebook_data_deletion_requests(facebook_user_id);

-- Index for efficient lookups by confirmation code
CREATE INDEX IF NOT EXISTS idx_facebook_deletion_confirmation_code
  ON facebook_data_deletion_requests(confirmation_code);

-- Index for efficient lookups by status
CREATE INDEX IF NOT EXISTS idx_facebook_deletion_status
  ON facebook_data_deletion_requests(status, created_at);
