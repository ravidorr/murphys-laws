#!/usr/bin/env bash
# Builds a sanitized COPY of the production database, so the deploy can prerender the site from production data
# without personal data ever leaving the server and without a database in git.
#
#   sanitize-db-copy.sh export LIVE_DB   Back up LIVE_DB to a private temp directory, sanitize the backup and write
#                                        it to stdout. The live file is only read. Meant to be streamed over SSH:
#                                          ssh host 'sudo bash -s -- export /root/murphys-laws/backend/murphys.db' \
#                                            < backend/scripts/sanitize-db-copy.sh > murphys.db
#   sanitize-db-copy.sh sanitize FILE    Sanitize FILE in place (safe to run again).
#   sanitize-db-copy.sh verify FILE      Exit non-zero unless FILE holds nothing personal (read-only).
#
# Only the sqlite3 CLI is needed (the server's Node lives in root's nvm), and every status line goes to stderr:
# stdout carries the database in `export` mode, and no row content is ever printed.
#
# SANITIZING IS AN ALLOWLIST. A table that is not named in ALLOWED_TABLES keeps its schema but loses every row, so
# a table added later (email or push subscriptions, deletion requests, ...) is emptied by default. The schema is
# kept because schema_migrations says the migration that created it already ran, so the migrations that run on the
# copy would not recreate it, and a later ALTER TABLE would fail.
#
# Kept tables and why nothing else personal is in them:
#   laws                     title, text, origin_note, status: public. raw_markdown (the raw import fragment, may
#                            hold `mailto:`), admin_notes (private moderator text) and approval_email_sent_at are
#                            never served, so they are blanked. Only published laws are kept: laws waiting for
#                            review or rejected are not public, and migration 022 parks the laws it cannot clean
#                            mechanically there. The prerender never reads them.
#   categories, law_categories, law_relations, law_of_the_day_history, law_annotations: public content.
#   attributions             name and note are shown publicly. contact_value (the submitter's address) and
#                            source_fragment (raw markdown with `mailto:`) are never served, so they are blanked.
#   votes                    voter_identifier (a client fingerprint) becomes 'v' || id: unique per row, so the
#                            (law_id, voter_identifier) unique index and every vote count still hold, and
#                            score-based ordering is unchanged.
#   schema_migrations, sqlite_sequence and the laws_fts search index (derived from public law text).
set -euo pipefail

ALLOWED_TABLES="laws categories law_categories attributions law_relations votes law_of_the_day_history law_annotations schema_migrations sqlite_sequence laws_fts laws_fts_data laws_fts_idx laws_fts_docsize laws_fts_config"

SCRATCH=""
log() { printf '%s\n' "$*" >&2; }
fail() { log "sanitize-db-copy: $*"; exit 1; }

# The SQL list of allowed names: 'a','b',...
allowed_sql_list() {
  local name out=""
  for name in $ALLOWED_TABLES; do
    out="${out:+$out,}'$name'"
  done
  printf '%s' "$out"
}

# Run SQL against a database file. Input is always explicit, so a `bash -s` script on stdin is never consumed.
sql() {
  local file="$1" statements="$2"
  sqlite3 -bail "$file" "$statements" </dev/null
}

table_exists() {
  [ "$(sql "$1" "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '$2';")" = "1" ]
}

column_exists() {
  [ "$(sql "$1" "SELECT COUNT(*) FROM pragma_table_info('$2') WHERE name = '$3';")" = "1" ]
}

# The columns that hold (or may hold) personal data in the kept tables, with the neutral value each one gets.
# The copy is taken from the PREVIOUS release's schema, before this deploy's migrations run, so a table or column
# that a migration of this very deploy adds does not exist yet: it is skipped here and cannot hold a row yet.
# A column added to a kept table later is NOT covered until it is listed here; backend/tests/scripts/
# sanitize-db-copy.test.ts fails for any column of the migrated schema that is neither listed nor reviewed as safe.
BLANKED_COLUMNS="laws.raw_markdown=NULL laws.admin_notes=NULL laws.approval_email_sent_at=NULL attributions.contact_value='' attributions.source_fragment=NULL"

# SQL assignments (for UPDATE ... SET) and tests (for ... WHERE col IS NOT value) over the blanked columns of one
# table that exist in this database.
blank_clauses() {
  local file="$1" table="$2" mode="$3" entry column value out=""
  for entry in $BLANKED_COLUMNS; do
    [ "${entry%%.*}" = "$table" ] || continue
    column="${entry#*.}"; value="${column#*=}"; column="${column%%=*}"
    column_exists "$file" "$table" "$column" || continue
    if [ "$mode" = "set" ]; then out="${out:+$out, }$column = $value"; else out="${out:+$out OR }$column IS NOT $value"; fi
  done
  printf '%s' "$out"
}

# Run each statement of a newline-separated list.
run_each() {
  local file="$1" list="$2" statement
  while IFS= read -r statement; do
    if [ -n "$statement" ]; then sql "$file" "$statement"; fi
  done <<< "$list"
}

# A WAL or shared-memory file next to the copy would hold pages the main file no longer has.
assert_no_sidecars() {
  local file="$1"
  if [ -e "$file-wal" ] || [ -e "$file-shm" ] || [ -e "$file-journal" ]; then
    fail "a -wal, -shm or -journal file sits next to the copy; refusing to continue"
  fi
}

sanitize() {
  local file="$1"
  [ -f "$file" ] || fail "no database at the given path"
  local ddl allowed
  ddl="$SCRATCH/recreate.sql"
  allowed="$(allowed_sql_list)"

  # 1. Leave WAL mode first. In WAL mode the statements below would land in the -wal file while the main file keeps
  #    the original pages, and the main file alone is what gets shipped. secure_delete zeroes deleted content.
  [ "$(sql "$file" 'PRAGMA journal_mode=DELETE;')" = "delete" ] || fail "could not leave WAL mode"
  assert_no_sidecars "$file"

  # 2. Remember the definition of everything outside the allowlist, so it can be recreated empty: tables first,
  #    then their indexes, triggers and views. Virtual tables and their shadow tables are dropped for good (none
  #    is expected; the allowed laws_fts is kept as it is).
  sql "$file" "
    SELECT sql || ';' FROM sqlite_master AS m
    WHERE sql IS NOT NULL
      AND name NOT LIKE 'sqlite_%'
      AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'
      AND NOT EXISTS (SELECT 1 FROM sqlite_master AS v
                      WHERE v.sql LIKE 'CREATE VIRTUAL TABLE%' AND m.name GLOB v.name || '_*')
      AND ((type = 'table' AND name NOT IN ($allowed))
        OR (type IN ('index', 'trigger') AND tbl_name NOT IN ($allowed))
        OR type = 'view')
    ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, rowid;
  " > "$ddl"

  # 3. Drop views, then virtual tables, then every other table outside the allowlist. Each list is read into a
  #    variable first, so a failing query fails the script instead of silently dropping nothing.
  run_each "$file" "$(sql "$file" "SELECT 'DROP VIEW IF EXISTS \"' || name || '\";' FROM sqlite_master WHERE type = 'view';")"
  run_each "$file" "$(sql "$file" "SELECT 'DROP TABLE IF EXISTS \"' || name || '\";' FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%' AND name NOT IN ($allowed);")"
  run_each "$file" "$(sql "$file" "SELECT 'DROP TABLE IF EXISTS \"' || name || '\";' FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ($allowed);")"

  # 4. Remove personal data from the kept tables, in one transaction. foreign_keys is on, so deleting a law also
  #    deletes its children; the orphan deletes cover a database that was ever written with it off.
  local script="PRAGMA secure_delete = ON; PRAGMA foreign_keys = ON; BEGIN;" clauses child
  script="$script DELETE FROM laws WHERE status IS NOT 'published';"
  for child in attributions law_categories votes law_of_the_day_history law_annotations; do
    if table_exists "$file" "$child"; then script="$script DELETE FROM $child WHERE law_id NOT IN (SELECT id FROM laws);"; fi
  done
  if table_exists "$file" law_relations; then
    script="$script DELETE FROM law_relations WHERE from_law_id NOT IN (SELECT id FROM laws) OR to_law_id NOT IN (SELECT id FROM laws);"
  fi
  for child in laws attributions; do
    clauses="$(blank_clauses "$file" "$child" set)"
    if [ -n "$clauses" ]; then script="$script UPDATE $child SET $clauses WHERE $(blank_clauses "$file" "$child" test);"; fi
  done
  # A voter identifier becomes 'v' || id: unique per row, so the (law_id, voter_identifier) index still holds.
  script="$script UPDATE votes SET voter_identifier = 'v' || id WHERE voter_identifier IS NOT 'v' || id;"
  # Rebuild the search index from the laws that are left, so it keeps no trace of a deleted law.
  if table_exists "$file" laws_fts; then script="$script INSERT INTO laws_fts(laws_fts) VALUES ('rebuild');"; fi
  sql "$file" "$script COMMIT;" > /dev/null

  # 5. Recreate what was dropped, empty.
  if [ -s "$ddl" ]; then
    sqlite3 -bail "$file" < "$ddl"
  fi

  # 6. Rewrite the whole file, so no deleted page (and no free page) keeps its old bytes.
  sql "$file" 'VACUUM;'
  assert_no_sidecars "$file"
  [ "$(sql "$file" 'PRAGMA integrity_check;')" = "ok" ] || fail "integrity_check failed on the sanitized copy"
  verify "$file"
  log "sanitize-db-copy: sanitized copy ready"
}

# Exit non-zero unless the file holds nothing personal. Counts only; no row is printed.
verify() {
  local file="$1"
  [ -f "$file" ] || fail "no database at the given path"
  assert_no_sidecars "$file"
  [ "$(sql "$file" 'PRAGMA journal_mode;')" = "delete" ] || fail "the copy is not in rollback-journal mode"
  local allowed extra rows table
  allowed="$(allowed_sql_list)"

  extra="$(sql "$file" "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ($allowed) AND sql LIKE 'CREATE VIRTUAL TABLE%';")"
  [ "$extra" = "0" ] || fail "a virtual table outside the allowlist is present"

  # Every table outside the allowlist must be empty.
  local tables
  tables="$(sql "$file" "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ($allowed);")"
  while IFS= read -r table; do
    [ -n "$table" ] || continue
    rows="$(sql "$file" "SELECT COUNT(*) FROM \"$table\";")"
    [ "$rows" = "0" ] || fail "a table outside the allowlist still has rows"
  done <<< "$tables"

  local check="SELECT (SELECT COUNT(*) FROM laws WHERE status IS NOT 'published')" clauses
  for table in laws attributions; do
    clauses="$(blank_clauses "$file" "$table" test)"
    if [ -n "$clauses" ]; then check="$check + (SELECT COUNT(*) FROM $table WHERE $clauses)"; fi
  done
  check="$check + (SELECT COUNT(*) FROM votes WHERE voter_identifier IS NOT 'v' || id);"
  rows="$(sql "$file" "$check")"
  [ "$rows" = "0" ] || fail "personal data is still present in a kept table"
}

main() {
  command -v sqlite3 >/dev/null || fail "sqlite3 is not installed"
  local mode="${1:-}" path="${2:-}"
  # Private scratch space (the backup in `export` mode, the recreate script), removed however the script ends.
  SCRATCH="$(mktemp -d)"
  trap 'rm -rf "$SCRATCH"' EXIT
  [ -n "$path" ] || fail "usage: sanitize-db-copy.sh export LIVE_DB | sanitize FILE | verify FILE"
  case "$mode" in
    export)
      [ -f "$path" ] || fail "no live database at the given path"
      # .backup is a consistent snapshot taken through the SQLite API while the live server keeps writing
      # (it copes with the WAL and retries a busy page); the live file is not modified.
      sqlite3 "$path" ".timeout 15000" ".backup '$SCRATCH/murphys.db'" </dev/null
      # Whatever the sqlite3 CLI prints while sanitizing (a PRAGMA echoes its value) must not reach the stream.
      sanitize "$SCRATCH/murphys.db" >&2
      cat "$SCRATCH/murphys.db"
      ;;
    sanitize) sanitize "$path" ;;
    verify) verify "$path"; log "sanitize-db-copy: the copy holds nothing personal" ;;
    *) fail "unknown mode (use export, sanitize or verify)" ;;
  esac
}

# Everything above is defined before this line runs, so a script streamed over `bash -s` is fully read first.
main "$@"
exit
