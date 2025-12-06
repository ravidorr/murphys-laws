-- Migration to add a status column to the laws table
-- This allows for moderation of submitted laws.

ALTER TABLE laws ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Optionally, backfill existing laws to 'approved' status
UPDATE laws SET status = 'approved' WHERE status IS NULL;
