-- Data migration: Update law content
-- Generated: 2025-10-20T12:49:48.655Z
-- Laws updated: 2373, 2374, 2375

BEGIN TRANSACTION;

-- Update law #2373
UPDATE laws SET title = 'Finagle''s First Law', text = 'If an experiment works, something has gone wrong', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2373;

-- Update law #2374
UPDATE laws SET title = 'Finagle''s Second Law', text = 'No matter what the anticipated result, there will always be someone eager to (a) misinterpret it, (b) fake it, (c) believe it happened to his own pet theory', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2374;

-- Update law #2375
UPDATE laws SET title = 'Niven''s First Law', text = 'Never fire a laser at a mirror', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 2375;

COMMIT;