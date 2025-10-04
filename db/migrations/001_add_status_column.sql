-- Add status column to laws table for review workflow
-- Status values: 'published', 'in_review', 'rejected'

ALTER TABLE laws ADD COLUMN status TEXT DEFAULT 'published' CHECK(status IN ('published', 'in_review', 'rejected'));

-- Update all existing laws to 'published' status
UPDATE laws SET status = 'published' WHERE status IS NULL;
