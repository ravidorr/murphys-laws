#!/bin/bash
# Shared by backup-murphys.sh and test-backup-restore.sh. Source it; do not run it.
#
# Off-site copies are encrypted on the server with GPG (AES-256, symmetric, authenticated) and sent with rclone
# to a Backblaze B2 bucket, deliberately at a different provider than the droplet (rclone's native "b2"
# backend). The code only talks to rclone, so any rclone remote works, but B2 is the supported target because
# it has versioning and Object Lock, which Cloudflare R2 does not. Nothing leaves the server unencrypted, and
# nothing secret is kept in the repo. The setup is read from a root-only file
# on the server (never sourced, only parsed for the two keys below):
#
#   OFFSITE_REMOTE=murphys-b2:murphys-laws-backups   # an rclone remote and bucket, no trailing slash
#   OFFSITE_PASSPHRASE_FILE=/etc/murphys-laws/offsite-backup.passphrase   # optional, this is the default
#   OFFSITE_PRUNE=lifecycle   # optional: "lifecycle" (default) never deletes from this server and leaves expiry to
#                             # a B2 lifecycle rule, so the server's key needs no delete right; "server" runs
#                             # rclone delete after each upload and needs the deleteFiles capability
#
# The file is $OFFSITE_BACKUP_ENV_FILE, default /etc/murphys-laws/offsite-backup.env. A value already in the
# environment wins over the file. The rclone remote's credentials live in rclone's own config
# (/root/.config/rclone/rclone.conf, or $RCLONE_CONFIG).
#
# Layout in the bucket: <remote>/db/<name>.gpg and <remote>/env/<name>.gpg, named like the local backups so
# the names sort by time.
#
# offsite_load_config returns 0 when off-site is configured and usable, 1 when it is not configured, and 2
# when it is configured but cannot work (the reason is in OFFSITE_ERROR). A config file that exists but gives
# no remote counts as the second case, so a typo cannot silently turn off-site backups off. Every other function returns
# non-zero on failure and writes the reason to stderr.

OFFSITE_BACKUP_ENV_FILE="${OFFSITE_BACKUP_ENV_FILE:-/etc/murphys-laws/offsite-backup.env}"
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
OFFSITE_PASSPHRASE_FILE="${OFFSITE_PASSPHRASE_FILE:-}"
OFFSITE_PRUNE="${OFFSITE_PRUNE:-}"
OFFSITE_ERROR=""

# Prints the value of KEY from a KEY=VALUE file: the last assignment wins, a leading `export` and one pair of
# quotes are removed. The file is parsed, never sourced, so its content cannot run anything.
_offsite_file_value() {
  local file="$1" key="$2" value quote
  [ -r "$file" ] || return 0
  value="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1)" || true
  value="${value#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  case "$value" in
    \"* | \'*)
      # Quoted: the text up to the closing quote; anything after it (such as a comment) is dropped
      quote="${value:0:1}"
      value="${value:1}"
      value="${value%%"$quote"*}"
      ;;
    *)
      # Unquoted: a trailing comment starts at whitespace followed by #
      value="$(printf '%s' "$value" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')"
      ;;
  esac
  printf '%s' "$value"
}

offsite_load_config() {
  OFFSITE_ERROR=""
  if [ -z "$OFFSITE_REMOTE" ]; then
    OFFSITE_REMOTE="$(_offsite_file_value "$OFFSITE_BACKUP_ENV_FILE" OFFSITE_REMOTE)"
  fi
  if [ -z "$OFFSITE_PASSPHRASE_FILE" ]; then
    OFFSITE_PASSPHRASE_FILE="$(_offsite_file_value "$OFFSITE_BACKUP_ENV_FILE" OFFSITE_PASSPHRASE_FILE)"
  fi
  OFFSITE_PASSPHRASE_FILE="${OFFSITE_PASSPHRASE_FILE:-/etc/murphys-laws/offsite-backup.passphrase}"
  if [ -z "$OFFSITE_PRUNE" ]; then
    OFFSITE_PRUNE="$(_offsite_file_value "$OFFSITE_BACKUP_ENV_FILE" OFFSITE_PRUNE)"
  fi
  OFFSITE_PRUNE="${OFFSITE_PRUNE:-lifecycle}"
  OFFSITE_REMOTE="${OFFSITE_REMOTE%/}"

  if [ -z "$OFFSITE_REMOTE" ]; then
    # No file at all means off-site was never set up. A file that is there but gives no remote (a typo in the
    # key, a blank value, or no permission to read it) must not pass for "not configured": the backups would
    # silently stay on the droplet.
    if [ -e "$OFFSITE_BACKUP_ENV_FILE" ]; then
      OFFSITE_ERROR="$OFFSITE_BACKUP_ENV_FILE exists but gives no OFFSITE_REMOTE (check the key name and that it is readable by root)"
      return 2
    fi
    return 1
  fi
  case "$OFFSITE_REMOTE" in
    *:*) ;;
    *) OFFSITE_ERROR="OFFSITE_REMOTE '$OFFSITE_REMOTE' is not an rclone remote (expected name:bucket)"; return 2 ;;
  esac
  case "$OFFSITE_PRUNE" in
    server | lifecycle) ;;
    *) OFFSITE_ERROR="OFFSITE_PRUNE '$OFFSITE_PRUNE' must be server or lifecycle"; return 2 ;;
  esac
  if ! command -v rclone >/dev/null 2>&1; then
    OFFSITE_ERROR="rclone is not installed"
    return 2
  fi
  if ! command -v gpg >/dev/null 2>&1; then
    OFFSITE_ERROR="gpg is not installed"
    return 2
  fi
  if [ ! -r "$OFFSITE_PASSPHRASE_FILE" ] || [ ! -s "$OFFSITE_PASSPHRASE_FILE" ]; then
    OFFSITE_ERROR="passphrase file $OFFSITE_PASSPHRASE_FILE is missing, empty or unreadable"
    return 2
  fi
  return 0
}

# offsite_encrypt PLAIN_FILE ENCRYPTED_FILE
offsite_encrypt() {
  gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
    --passphrase-file "$OFFSITE_PASSPHRASE_FILE" --output "$2" "$1"
}

# offsite_decrypt ENCRYPTED_FILE PLAIN_FILE
offsite_decrypt() {
  gpg --batch --yes --quiet --pinentry-mode loopback \
    --passphrase-file "$OFFSITE_PASSPHRASE_FILE" --output "$2" --decrypt "$1"
}

# offsite_upload KIND LOCAL_FILE: encrypts LOCAL_FILE (the plain copy never leaves the server), uploads it to
# <remote>/<KIND>/<name>.gpg, and checks the object is listed there. rclone also verifies size and checksum.
offsite_upload() {
  local kind="$1" file="$2" name tmpdir listing rc=0
  name="$(basename "$file").gpg"
  tmpdir="$(umask 077 && mktemp -d "${TMPDIR:-/tmp}/offsite-upload.XXXXXX")" || return 1
  if offsite_encrypt "$file" "$tmpdir/$name" \
    && rclone copyto "$tmpdir/$name" "$OFFSITE_REMOTE/$kind/$name" \
    && listing="$(rclone lsf --files-only "$OFFSITE_REMOTE/$kind/")" \
    && printf '%s\n' "$listing" | grep -Fxq -- "$name"; then
    rc=0
  else
    rc=1
  fi
  rm -rf "$tmpdir"
  return "$rc"
}

# offsite_prune KIND DAYS: deletes off-site objects older than DAYS, so the off-site retention matches the
# local one. Call it only after a successful upload, so an outage never empties the bucket.
#
# With OFFSITE_PRUNE=lifecycle (the default) nothing is deleted from here: expiry is left to the bucket's
# lifecycle rule, so the credentials on this server never need permission to delete (see BACKUP-RESTORE.md).
# On B2, rclone delete only hides a version unless hard_delete is set, and a version under Object Lock cannot
# be removed early anyway, so "server" is for a bucket without Object Lock.
#
# A directory that does not exist yet (rclone status 3) has nothing to prune.
offsite_prune() {
  local listing rc=0
  [ "$OFFSITE_PRUNE" = "lifecycle" ] && return 0
  listing="$(rclone lsf --files-only "$OFFSITE_REMOTE/$1/")" || rc=$?
  [ "$rc" -eq 3 ] && return 0
  [ "$rc" -eq 0 ] || return "$rc"
  [ -n "$listing" ] || return 0
  rclone delete --min-age "${2}d" "$OFFSITE_REMOTE/$1/"
}

# offsite_latest KIND: prints the name of the newest object (names sort by time), nothing when there is none.
offsite_latest() {
  local listing
  listing="$(rclone lsf --files-only "$OFFSITE_REMOTE/$1/")" || return 1
  printf '%s\n' "$listing" | grep -v '^$' | sort | tail -n 1
}

# offsite_is_fresh KIND NAME HOURS: succeeds when NAME was modified within the last HOURS hours.
offsite_is_fresh() {
  local listing
  listing="$(rclone lsf --files-only --max-age "${3}h" "$OFFSITE_REMOTE/$1/")" || return 1
  printf '%s\n' "$listing" | grep -Fxq -- "$2"
}

# offsite_has_older KIND DAYS: succeeds when a current (not hidden) object older than DAYS is listed. With the
# lifecycle rule in place there is none, so the restore test uses it to notice a missing or broken rule.
offsite_has_older() {
  local listing
  listing="$(rclone lsf --files-only --min-age "${2}d" "$OFFSITE_REMOTE/$1/")" || return 1
  [ -n "$listing" ]
}

# offsite_fetch KIND NAME DEST_FILE: downloads <remote>/<KIND>/<NAME> and decrypts it to DEST_FILE.
offsite_fetch() {
  local kind="$1" name="$2" dest="$3" tmpdir rc=0
  tmpdir="$(umask 077 && mktemp -d "${TMPDIR:-/tmp}/offsite-fetch.XXXXXX")" || return 1
  if rclone copyto "$OFFSITE_REMOTE/$kind/$name" "$tmpdir/$name" \
    && offsite_decrypt "$tmpdir/$name" "$dest"; then
    rc=0
  else
    rc=1
  fi
  rm -rf "$tmpdir"
  return "$rc"
}
