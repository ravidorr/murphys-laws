-- Migration 019: keep the search index in step when a published law is updated without its text or title
-- changing (admin notes, category, updated_at).
--
-- The two AFTER UPDATE triggers from migration 015 had no guaranteed order. When the removal of the old
-- entry could run after the re-insert, it removed the entry that had just been added, so the law silently
-- disappeared from search. The removal (renamed laws_fts_before_update_delete) now runs BEFORE the update
-- and the insert (laws_fts_after_update_insert, same name) AFTER it.
-- Everything runs in one transaction so a failure cannot leave the index without update triggers.

BEGIN;

DROP TRIGGER IF EXISTS laws_fts_after_update_delete;
DROP TRIGGER IF EXISTS laws_fts_after_update_insert;
DROP TRIGGER IF EXISTS laws_fts_before_update_delete;

CREATE TRIGGER laws_fts_before_update_delete
BEFORE UPDATE ON laws
WHEN OLD.status = 'published'
BEGIN
  INSERT INTO laws_fts(laws_fts, rowid, title, text) VALUES ('delete', OLD.id, OLD.title, OLD.text);
END;

CREATE TRIGGER laws_fts_after_update_insert
AFTER UPDATE ON laws
WHEN NEW.status = 'published'
BEGIN
  INSERT INTO laws_fts(rowid, title, text) VALUES (NEW.id, NEW.title, NEW.text);
END;

-- Repair any index already damaged by the old triggers: rebuild it from the published laws
-- (this also drops unpublished laws that migration 015's rebuild indexed).
INSERT INTO laws_fts(laws_fts) VALUES ('delete-all');
INSERT INTO laws_fts(rowid, title, text) SELECT id, title, text FROM laws WHERE status = 'published';

COMMIT;
