-- Data migration: Strip Markdown escape backslashes from laws text and title
-- This handles cases like \=, \+, \!, \*, \-, \. which are often escaped in Markdown source files
-- Generated: 2026-02-28

BEGIN TRANSACTION;

-- Update laws text: replace common escaped characters
UPDATE laws SET 
  text = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(text, '\=', '='), '\+', '+'), '\!', '!'), '\*', '*'), '\-', '-'), '\.', '.'),
  title = CASE 
    WHEN title IS NOT NULL THEN REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title, '\=', '='), '\+', '+'), '\!', '!'), '\*', '*'), '\-', '-'), '\.', '.')
    ELSE title
  END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE text LIKE '%\=%' 
   OR text LIKE '%\+%' 
   OR text LIKE '%\!%' 
   OR text LIKE '%\*%' 
   OR text LIKE '%\-%' 
   OR text LIKE '%\.%'
   OR title LIKE '%\=%' 
   OR title LIKE '%\+%' 
   OR title LIKE '%\!%' 
   OR title LIKE '%\*%' 
   OR title LIKE '%\-%' 
   OR title LIKE '%\.%';

COMMIT;
