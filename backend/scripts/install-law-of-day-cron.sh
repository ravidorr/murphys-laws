#!/bin/bash
#
# Installs the schedule that picks the Law of the Day at 00:00 UTC (select-law-of-day.ts).
#
# Run as root by both deploy paths (.github/workflows/deploy.yml and `npm run deploy`) once the release and its
# locked dependencies are in place, so it runs on every deploy and every step is safe to repeat. It fails, before
# changing anything, when the job could not start: the schedule file, select-law-of-day.ts, tsx, .nvmrc or `crontab`
# is missing, or the node the job runs is missing, cannot report its version, is not the major version in .nvmrc, or
# cannot load better-sqlite3. Otherwise it:
#   1. creates backend/logs, where the job writes law-of-day.log, so the log redirect cannot fail
#   2. replaces /etc/cron.d/murphys-laws-law-of-day with backend/config/cron.d/murphys-laws-law-of-day, atomically
#      (a hand edit is overwritten), with the node of the job written into its command (see LAW_OF_DAY_NODE_BIN)
#   3. removes the old `select-law-of-day.mjs` line from root's crontab, and then the old .mjs script, which is kept
#      while that line is still there. Neither is touched when the install was refused.
#
# Step 3 is housekeeping: a problem with root's crontab only prints a WARNING, and the crontab is never emptied (see
# remove_retired_crontab_line). A caller that must not let this block a release can treat any non-zero exit as a
# warning: the API picks the law on the first request of the day when the job is not installed.
#
# Usage: [LAW_OF_DAY_NODE_BIN=/path/to/node] install-law-of-day-cron.sh [APP_DIR]   (APP_DIR defaults to /root/murphys-laws)
#
# LAW_OF_DAY_NODE_BIN is the absolute path of the node that the job runs (default /usr/bin/node). Both deploy paths
# pass the node the deploy itself runs with (the nvm node), so the job uses the node that better-sqlite3 was built
# for, and the next deploy fixes the path after a Node upgrade. When it is not /usr/bin/node, the installer writes it
# into the job's command in place of /usr/bin/node. CRON_D_DIR (default /etc/cron.d) is only overridden by the tests.

set -euo pipefail

APP_DIR="${1:-/root/murphys-laws}"
CRON_D_DIR="${CRON_D_DIR:-/etc/cron.d}"
CRON_NAME="murphys-laws-law-of-day"
SOURCE="$APP_DIR/backend/config/cron.d/$CRON_NAME"
TSX_CLI="$APP_DIR/backend/node_modules/tsx/dist/cli.mjs"
JOB_SCRIPT="$APP_DIR/backend/scripts/select-law-of-day.ts"
RETIRED_SCRIPT="select-law-of-day.mjs"

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: $SOURCE is missing; the Law of the Day schedule was not installed" >&2
  exit 1
fi

# The job starts tsx from backend/node_modules, which the deploy installed before running this script.
for needed in "$TSX_CLI" "$JOB_SCRIPT"; do
  if [ ! -f "$needed" ]; then
    echo "ERROR: $needed is missing; the Law of the Day job could not start, so its schedule was not installed" >&2
    exit 1
  fi
done

# Without crontab there is no cron to run a file in cron.d (and the old line could not be looked for)
if ! command -v crontab > /dev/null; then
  echo "ERROR: crontab is not installed, so cron cannot run the Law of the Day job; its schedule was not installed" >&2
  exit 1
fi

# The job must run a node that better-sqlite3 was built for (the nvm node of .nvmrc that `npm ci` ran with, the same
# major version as the one PM2 runs).
# A different major version fails with a module-version error that only ever reaches the job's log file, so
# refuse to install a schedule that cannot work. The path is written into a cron line and a sed command, so it must be
# an absolute path of plain characters (no space, %, quote or other character that cron or the shell would read).
# Only an unset variable means the default: a caller that could not find its node passes an empty one, which is refused.
NODE_BIN="${LAW_OF_DAY_NODE_BIN-/usr/bin/node}"
safe_path='^/[A-Za-z0-9._/+@-]+$'
if [[ ! "$NODE_BIN" =~ $safe_path ]]; then
  echo "ERROR: the node for the Law of the Day job, '$NODE_BIN', is not an absolute path of plain characters; its schedule was not installed" >&2
  exit 1
fi
if [ ! -f "$APP_DIR/.nvmrc" ]; then
  echo "ERROR: $APP_DIR/.nvmrc is missing, so the Node version of the Law of the Day job cannot be checked; its schedule was not installed" >&2
  exit 1
fi
if [ ! -x "$NODE_BIN" ]; then
  echo "ERROR: $NODE_BIN is not an executable; the Law of the Day job could not start, so its schedule was not installed. Point LAW_OF_DAY_NODE_BIN at the nvm node." >&2
  exit 1
fi
want="$(tr -d '[:space:]v' < "$APP_DIR/.nvmrc")"
want="${want%%.*}"
have="$("$NODE_BIN" --version 2>/dev/null)" || have=""
have="${have#v}"
have="${have%%.*}"
if [ -z "$have" ]; then
  echo "ERROR: $NODE_BIN --version printed nothing or failed; the Law of the Day job could not start, so its schedule was not installed" >&2
  exit 1
fi
if [ "$want" != "$have" ]; then
  echo "ERROR: $NODE_BIN is Node $have but .nvmrc wants Node $want; the Law of the Day job would fail. Point LAW_OF_DAY_NODE_BIN at the nvm node." >&2
  exit 1
fi
# The same major version is not proof that the native module was built for this node, so load it the way the job does
if ! load_error="$(cd "$APP_DIR/backend" && "$NODE_BIN" -e "new (require('better-sqlite3'))(':memory:').close()" 2>&1)"; then
  echo "ERROR: $NODE_BIN cannot load better-sqlite3 from $APP_DIR/backend ($load_error); the Law of the Day job would fail, so its schedule was not installed" >&2
  exit 1
fi

# Replace the file in one step: a copy made in place could be read half-written by cron. The temporary name starts
# with a dot, which cron ignores, and is in the same directory so the final mv is a rename. The file is the repository
# one with the node of the job in its command, which is checked before it replaces anything.
temporary="$(mktemp "$CRON_D_DIR/.$CRON_NAME.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
sed "/^#/!s|/usr/bin/node|$NODE_BIN|" "$SOURCE" > "$temporary"
chmod 644 "$temporary"
if [ ! -s "$temporary" ] || [ -n "$(tail -c 1 "$temporary")" ]; then
  echo "ERROR: the Law of the Day schedule does not end with a newline, which cron needs; it was not installed" >&2
  exit 1
fi
# Only the lines that are not comments count from here on
job_lines="$(grep -v '^#' "$temporary" || true)"
# A % in a cron command is a newline
case "$job_lines" in
  *%*)
    echo "ERROR: the Law of the Day schedule has a % outside its comments, which cron turns into a newline; it was not installed" >&2
    exit 1
    ;;
esac
case "$job_lines" in
  *"&& $NODE_BIN node_modules/tsx/dist/cli.mjs scripts/select-law-of-day.ts;"*) ;;
  *)
    echo "ERROR: the Law of the Day schedule does not run $NODE_BIN on select-law-of-day.ts; it was not installed" >&2
    exit 1
    ;;
esac
install -d -m 755 "$APP_DIR/backend/logs"
# Cron ignores a file in cron.d that is not owned by root
if [ "$(id -u)" -eq 0 ]; then
  chown root:root "$temporary"
fi
mv -f "$temporary" "$CRON_D_DIR/$CRON_NAME"
echo "Installed $CRON_D_DIR/$CRON_NAME (the job runs $NODE_BIN, $("$NODE_BIN" --version 2>/dev/null || echo "version unknown"))"

# The schedule says 00:00 UTC, but cron.d runs it in the server's own time zone unless the cron in use honors the
# CRON_TZ line of the file (the Debian and Ubuntu cron package does not document it). The pick itself is always for
# the current UTC day, so a run at another hour still picks the right law, but a run before 00:00 UTC only finds the
# day before already picked: the job then no longer picks ahead of the first visitor.
utc_offset="$(date +%z)" || utc_offset="+0000"
if [ "$utc_offset" != "+0000" ]; then
  echo "WARNING: the server's time zone is UTC$utc_offset; unless the cron honors CRON_TZ=UTC (cronie does, the Debian and Ubuntu cron package does not document it), the Law of the Day job runs at 00:00 local time and not at 00:00 UTC, and then does not pick ahead of the first visitor" >&2
fi

# Removes the old `select-law-of-day.mjs` line from root's crontab, which would otherwise start a second job at the
# same time. It is the same rule as the deploy step that removes the retired vulnerability scanner entry, because
# `crontab -l | grep -v ... | crontab -` replaces the whole crontab with nothing whenever the read fails. So: the
# crontab is read into a variable and written back only from a read that succeeded, only when the old line was
# there, and only when something other than blank lines remains; "no crontab for root" is not a problem; every
# other failure leaves the crontab as it was and only prints a WARNING; nothing here ends the script (the Law of
# the Day job is installed by now, and `crontab -` replaces the crontab atomically). The old .mjs script, installed
# from the old docs by hand and never updated, is removed only once its line is gone, so the old line is never left
# pointing at a file that is not there.
old_line_gone=0
remove_retired_crontab_line() {
  local error_file current error status=0 found=0 filtered="" removed=0 content=0
  if ! error_file="$(mktemp)"; then
    echo "WARNING: could not create a temporary file to read root's crontab, so the old $RETIRED_SCRIPT line was not looked for" >&2
    return 0
  fi
  current="$(LC_ALL=C crontab -l 2>"$error_file" </dev/null)" || status=$?
  error="$(cat "$error_file")" || error=""
  rm -f "$error_file" || echo "WARNING: could not remove the temporary file $error_file" >&2
  if [ "$status" -ne 0 ]; then
    case "${error##*$'\n'}" in
      "no crontab for "*) old_line_gone=1 ;;
      *) echo "WARNING: could not read root's crontab (exit $status: $error), so the old $RETIRED_SCRIPT line was left in place" >&2 ;;
    esac
    return 0
  fi
  [ -z "$error" ] || echo "WARNING: crontab -l printed: $error" >&2
  # Each grep exits 0 for "yes", 1 for "no" and 2 for an error, which is never read as "no". They read a pipe and
  # print nothing (no -q, so printf is never cut off by a closed pipe).
  printf '%s\n' "$current" | LC_ALL=C grep -aF -- "$RETIRED_SCRIPT" > /dev/null || found=$?
  if [ "$found" -eq 0 ]; then
    filtered="$(printf '%s\n' "$current" | LC_ALL=C grep -avF -- "$RETIRED_SCRIPT")" || removed=$?
    if [ "$removed" -le 1 ]; then
      printf '%s\n' "$filtered" | LC_ALL=C grep -a '[^[:space:]]' > /dev/null || content=$?
    fi
  fi
  if [ "$found" -gt 1 ] || [ "$removed" -gt 1 ] || [ "$content" -gt 1 ]; then
    echo "WARNING: could not search root's crontab for $RETIRED_SCRIPT, so it was left as it was" >&2
  elif [ "$found" -eq 1 ]; then
    old_line_gone=1
  elif [ "$content" -eq 1 ]; then
    echo "WARNING: the old $RETIRED_SCRIPT line is the only entry in root's crontab, so it was left in place (an empty crontab is never written); remove it with crontab -e" >&2
  elif printf '%s\n' "$filtered" | crontab -; then
    echo "Removed the old $RETIRED_SCRIPT line from root's crontab"
    old_line_gone=1
  else
    echo "WARNING: could not write root's crontab, so the old $RETIRED_SCRIPT line was left in place" >&2
  fi
}
remove_retired_crontab_line
if [ "$old_line_gone" -eq 1 ]; then
  rm -f "$APP_DIR/backend/scripts/$RETIRED_SCRIPT" || echo "WARNING: could not remove the old $RETIRED_SCRIPT" >&2
fi
