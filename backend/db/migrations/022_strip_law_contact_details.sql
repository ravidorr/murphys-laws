-- Migration 022: remove contact details (email addresses and `mailto` link fragments) from public law fields.
--
-- Contact details are meant to live only in attributions.contact_value, which no public endpoint serves.
-- Production still holds rows where they leaked into what pages and the API show:
--   1. attributions.name holds a whole address (for example `name@aol.com`).
--   2. A `[Name](mailto:...)` link that an older import split in the middle of the address: the law
--      sentence sits in `title`, ending `Sent [by Name](mailto`, and `text` holds only the rest of the
--      address, `name@yahoo.com).`
--   3. The same split left a note `and [handle](mailto:handle@host` and a text ending ` net).`
-- The rows are found by their CONTENT, never by id: production ids differ from the ids the archive seeds.
-- SQLite has no regular expressions here (better-sqlite3 has no REGEXP either), so an address is matched
-- with GLOB: a letter, digit or `._%+-` before the `@`, a domain character after it, and later a dot followed
-- by a letter. `mother@#?!&*` is not an address. GLOB cannot say that the domain has no space in it, so the
-- pattern is deliberately a superset of the real thing (`meet 5@3 p.m.` also matches). A false positive costs
-- little: a law goes back to review (a person looks at it), a note is dropped, a name becomes `Anonymous`.
-- Nothing is deleted, and attributions.source_fragment (the raw markdown, never served) is left alone.
--
-- What a cleaned row looks like:
--   * name that is an address -> `Anonymous` (the label sanitizeDisplayName uses); the address is kept in
--     contact_value, which is never public.
--   * title ending `Sent [by Name](mailto` (or `Sent by [Name](mailto`, `by [Name](mailto`, `[Name](mailto`)
--     + text that is only an address -> the sentence moves from title to text, title becomes NULL, and a
--     `Name` attribution (contact = the address) is added when the law has none. A title that is only the
--     lead-in has no sentence to move and is left for step 4.
--   * note `and [handle](mailto:...` -> `and handle` (text after the link is dropped); text ending `net).` with
--     such a note -> the stray tail is removed, only when the text has no `(`, so `(see the corollary).` stays.
--   * a note that still holds `mailto` or an address after that is set to NULL (the law stays published).
--   * a published law whose title or text still holds `mailto` or an address cannot be cleaned
--     mechanically, so it goes back to `in_review` for a human (it is not deleted). Laws that are already
--     `in_review` or `rejected` are not public and are not touched.
-- Every UPDATE on laws goes through the search-index triggers from migration 019, so the index stays in step.
-- The migration is idempotent: a cleaned row no longer matches any condition, and the move to review only
-- applies to published laws. It is wrapped in one transaction; note that scripts/migrate.ts pipes it through the
-- sqlite3 CLI, which carries on after a failed statement, so idempotence is what makes a re-run safe.

BEGIN;

-- 1. Attribution names that are addresses.
UPDATE attributions
SET contact_value = CASE WHEN contact_value IS NULL OR contact_value = '' THEN name ELSE contact_value END,
    contact_type = CASE WHEN contact_value IS NULL OR contact_value = '' THEN 'email' ELSE contact_type END,
    name = 'Anonymous'
WHERE name GLOB '*[A-Za-z0-9._%+-]@[A-Za-z0-9-]*.[A-Za-z]*';

-- 2. A law whose title ends in a broken mailto link and whose text is only the rest of the address.
DROP TABLE IF EXISTS temp.law_contact_fix;
CREATE TEMP TABLE law_contact_fix AS
SELECT
  id,
  CASE
    WHEN rtrim(pre) LIKE '% Sent by' THEN rtrim(substr(rtrim(pre), 1, length(rtrim(pre)) - 8))
    WHEN rtrim(pre) LIKE '% Sent' THEN rtrim(substr(rtrim(pre), 1, length(rtrim(pre)) - 5))
    WHEN rtrim(pre) LIKE '% by' THEN rtrim(substr(rtrim(pre), 1, length(rtrim(pre)) - 3))
    ELSE rtrim(pre)
  END AS new_text,
  CASE
    WHEN link_text LIKE 'by %' THEN trim(substr(link_text, 4))
    ELSE trim(link_text)
  END AS submitter,
  rtrim(address, ').') AS contact
FROM (
  SELECT
    id,
    substr(title, 1, instr(title, '[') - 1) AS pre,
    substr(title, instr(title, '[') + 1, instr(title, ']') - instr(title, '[') - 1) AS link_text,
    text AS address
  FROM laws
  WHERE title LIKE '%[%](mailto%'
    AND instr(text, ' ') = 0
    AND text GLOB '*[A-Za-z0-9._%+-]@[A-Za-z0-9-]*.[A-Za-z]*'
)
WHERE length(trim(pre)) > 0
  AND lower(trim(pre)) NOT IN ('sent', 'sent by', 'by');

INSERT INTO attributions (law_id, name, contact_type, contact_value)
SELECT
  fix.id,
  CASE
    WHEN fix.submitter = '' OR fix.submitter GLOB '*@*' THEN 'Anonymous'
    ELSE fix.submitter
  END,
  'email',
  fix.contact
FROM law_contact_fix AS fix
WHERE NOT EXISTS (SELECT 1 FROM attributions WHERE attributions.law_id = fix.id);

UPDATE laws
SET text = (SELECT new_text FROM law_contact_fix WHERE law_contact_fix.id = laws.id),
    title = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT id FROM law_contact_fix);

DROP TABLE temp.law_contact_fix;

-- 3a. A text left ending in the tail of a split address (` net).`) next to a broken mailto note: drop the
-- last word. rtrim removes the trailing characters that can be part of an address tail and stops at the space.
-- Only a text without any `(` qualifies, so a legitimate `... (see the corollary).` is never cut.
UPDATE laws
SET text = trim(rtrim(text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-)')),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE (text LIKE '% %)' OR text LIKE '% %).')
  AND text NOT LIKE '%(%'
  AND EXISTS (SELECT 1 FROM attributions WHERE attributions.law_id = laws.id AND attributions.note LIKE '%](mailto%')
  AND rtrim(text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-)') LIKE '% '
  AND length(trim(rtrim(text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-)'))) > 0;

-- 3b. A note holding a broken `[handle](mailto...` link: keep the prefix and the handle, drop the contact.
UPDATE attributions
SET note = trim(rtrim(substr(note, 1, instr(note, '[') - 1)) || ' ' || substr(note, instr(note, '[') + 1, instr(note, ']') - instr(note, '[') - 1))
WHERE note LIKE '%[%](mailto%';

-- 4. What cannot be cleaned mechanically: drop a note that still holds a contact detail ...
UPDATE attributions
SET note = NULL
WHERE note LIKE '%mailto%'
   OR note GLOB '*[A-Za-z0-9._%+-]@[A-Za-z0-9-]*.[A-Za-z]*';

-- ... and send a law that still holds one back to moderation.
UPDATE laws
SET status = 'in_review',
    admin_notes = trim(COALESCE(admin_notes, '') || ' Moved to review by migration 022: the text or title holds a contact detail (email address or mailto link).'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'published'
  AND (   text LIKE '%mailto%'
       OR COALESCE(title, '') LIKE '%mailto%'
       OR text GLOB '*[A-Za-z0-9._%+-]@[A-Za-z0-9-]*.[A-Za-z]*'
       OR COALESCE(title, '') GLOB '*[A-Za-z0-9._%+-]@[A-Za-z0-9-]*.[A-Za-z]*');

COMMIT;
