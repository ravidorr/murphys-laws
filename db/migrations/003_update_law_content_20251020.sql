-- Data migration: Update law content
-- Generated: 2025-10-20T13:10:42.963Z
-- Laws updated: 2376, 2377, 2378, 2379

BEGIN TRANSACTION;

-- Update law #2376
UPDATE laws SET title = 'Niven''s Second Law', text = 'Giving up freedom for security is beginning to look naïve', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2376;

-- Update law #2377
UPDATE laws SET title = 'Niven''s Third Law', text = 'It is easier to destroy than to create', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2377;

-- Update law #2378
UPDATE laws SET title = 'Niven''s Fourth Law', text = 'Ethics change with technology.', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2378;

-- Update law #2379
UPDATE laws SET title = 'Niven''s Fifth Law', text = 'The only universal message in science fiction: There exist minds that think as well as you do, but differently.', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2379;

COMMIT;