CREATE VIRTUAL TABLE IF NOT EXISTS laws_fts USING fts5(
  title,
  text,
  content='laws',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS laws_fts_after_insert
AFTER INSERT ON laws
WHEN NEW.status = 'published'
BEGIN
  INSERT INTO laws_fts(rowid, title, text) VALUES (NEW.id, NEW.title, NEW.text);
END;

CREATE TRIGGER IF NOT EXISTS laws_fts_after_delete
AFTER DELETE ON laws
WHEN OLD.status = 'published'
BEGIN
  INSERT INTO laws_fts(laws_fts, rowid, title, text) VALUES ('delete', OLD.id, OLD.title, OLD.text);
END;

CREATE TRIGGER IF NOT EXISTS laws_fts_after_update_delete
AFTER UPDATE ON laws
WHEN OLD.status = 'published'
BEGIN
  INSERT INTO laws_fts(laws_fts, rowid, title, text) VALUES ('delete', OLD.id, OLD.title, OLD.text);
END;

CREATE TRIGGER IF NOT EXISTS laws_fts_after_update_insert
AFTER UPDATE ON laws
WHEN NEW.status = 'published'
BEGIN
  INSERT INTO laws_fts(rowid, title, text) VALUES (NEW.id, NEW.title, NEW.text);
END;

INSERT INTO laws_fts(laws_fts) VALUES ('rebuild');
