#!/bin/bash
#
# Installs the cron schedules of the nightly jobs: every backend/config/cron.d/murphys-laws-* file goes to /etc/cron.d
# (murphys-laws-law-of-day, which picks the Law of the Day at 00:00 UTC, and murphys-laws-daily-notifications, which sends
# the daily email and push). The name of this script is older than the second file.
#
# Run as root by both deploy paths (.github/workflows/deploy.yml and `npm run deploy`) once the release and its
# locked dependencies are in place, so it runs on every deploy and every step is safe to repeat. It fails, before
# changing anything, when a job could not start: a schedule file, run-cron-job.sh, the script a job runs, tsx, .nvmrc or
# `crontab` is missing, or the node the jobs run is missing, cannot report its version, is not the major version in
# .nvmrc, or cannot load better-sqlite3. It is all or nothing: when one schedule file fails its checks, none of them is
# installed (a schedule already installed stays as it was). Otherwise it:
#   1. creates backend/logs, where the jobs write their logs and run-cron-job.sh keeps its state files
#   2. replaces each /etc/cron.d/murphys-laws-* file with the one in backend/config/cron.d, atomically (a hand edit is
#      overwritten), with the node of the jobs written into their commands (see LAW_OF_DAY_NODE_BIN)
#   3. removes the old `select-law-of-day.mjs` line from root's crontab, and then the old .mjs script, which is kept
#      while that line is still there. Neither is touched when the install was refused.
#
# Step 3 is housekeeping: a problem with root's crontab only prints a WARNING, and the crontab is never emptied (see
# remove_retired_crontab_line). A caller that must not let this block a release can treat any non-zero exit as a
# warning: the API picks the law on the first request of the day when the Law of the Day job is not installed, but the
# daily email and push do not go out and no alert tells anyone until the next deploy installs them.
#
# Usage: [LAW_OF_DAY_NODE_BIN=/path/to/node] install-law-of-day-cron.sh [APP_DIR]   (APP_DIR defaults to /root/murphys-laws)
#
# LAW_OF_DAY_NODE_BIN is the absolute path of the node that the job runs (default /usr/bin/node). Both deploy paths
# pass the node the deploy itself runs with (the nvm node), so the job uses the node that better-sqlite3 was built
# for, and the next deploy fixes the path after a Node upgrade. The default is only for a caller that sets nothing: on
# the production server /usr/bin/node is a symlink to nvm v22.20.0 (the node PM2 runs), a different patch version from the
# deploy's node (v22.16.0, the version of .nvmrc) but the same major, so the checks below would accept either. When the variable is not /usr/bin/node, the installer writes it into the job's
# command in place of /usr/bin/node. CRON_D_DIR (default /etc/cron.d) is only overridden by the tests.

set -euo pipefail

APP_DIR="${1:-/root/murphys-laws}"
CRON_D_DIR="${CRON_D_DIR:-/etc/cron.d}"
SOURCE_DIR="$APP_DIR/backend/config/cron.d"
REQUIRED_CRON="murphys-laws-law-of-day"
TSX_CLI="$APP_DIR/backend/node_modules/tsx/dist/cli.mjs"
RUNNER="$APP_DIR/backend/scripts/run-cron-job.sh"
RETIRED_SCRIPT="select-law-of-day.mjs"

if [ ! -f "$SOURCE_DIR/$REQUIRED_CRON" ]; then
  echo "ERROR: $SOURCE_DIR/$REQUIRED_CRON is missing; the cron schedules (Law of the Day, daily email and push) were not installed" >&2
  exit 1
fi
CRON_NAMES=()
for source in "$SOURCE_DIR"/murphys-laws-*; do
  [ -f "$source" ] && CRON_NAMES+=("${source##*/}")
done

# The jobs start through run-cron-job.sh and tsx from backend/node_modules, which the deploy installed before running this script.
for needed in "$TSX_CLI" "$RUNNER" "$APP_DIR/backend/scripts/alert-email.sh"; do
  if [ ! -f "$needed" ]; then
    echo "ERROR: $needed is missing; the cron jobs could not start, so their schedules were not installed" >&2
    exit 1
  fi
done
if [ ! -x "$RUNNER" ]; then
  echo "ERROR: $RUNNER is not executable; the cron jobs could not start, so their schedules were not installed" >&2
  exit 1
fi

# Without crontab there is no cron to run a file in cron.d (and the old line could not be looked for)
if ! command -v crontab > /dev/null; then
  echo "ERROR: crontab is not installed, so cron cannot run the cron jobs; their schedules were not installed" >&2
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
  echo "ERROR: the node for the cron jobs, '$NODE_BIN', is not an absolute path of plain characters; their schedules were not installed" >&2
  exit 1
fi
if [ ! -f "$APP_DIR/.nvmrc" ]; then
  echo "ERROR: $APP_DIR/.nvmrc is missing, so the Node version of the cron jobs cannot be checked; their schedules were not installed" >&2
  exit 1
fi
if [ ! -x "$NODE_BIN" ]; then
  echo "ERROR: $NODE_BIN is not an executable; the cron jobs could not start, so their schedules were not installed. Point LAW_OF_DAY_NODE_BIN at the nvm node." >&2
  exit 1
fi
want="$(tr -d '[:space:]v' < "$APP_DIR/.nvmrc")"
want="${want%%.*}"
have="$("$NODE_BIN" --version 2>/dev/null)" || have=""
have="${have#v}"
have="${have%%.*}"
if [ -z "$have" ]; then
  echo "ERROR: $NODE_BIN --version printed nothing or failed; the cron jobs could not start, so their schedules were not installed" >&2
  exit 1
fi
if [ "$want" != "$have" ]; then
  echo "ERROR: $NODE_BIN is Node $have but .nvmrc wants Node $want; the cron jobs would fail. Point LAW_OF_DAY_NODE_BIN at the nvm node." >&2
  exit 1
fi
# The same major version is not proof that the native module was built for this node, so load it the way the job does
if ! load_error="$(cd "$APP_DIR/backend" && "$NODE_BIN" -e "new (require('better-sqlite3'))(':memory:').close()" 2>&1)"; then
  echo "ERROR: $NODE_BIN cannot load better-sqlite3 from $APP_DIR/backend ($load_error); the cron jobs would fail, so their schedules were not installed" >&2
  exit 1
fi

# Replace each file in one step: a copy made in place could be read half-written by cron. The temporary name starts
# with a dot, which cron ignores, and is in the same directory so the final mv is a rename. Each file is the repository
# one with the node of the jobs in its commands. Every file is built and checked before any of them replaces anything, so
# one bad file installs none.
temporaries=()
trap '[ "${#temporaries[@]}" -eq 0 ] || rm -f "${temporaries[@]}"' EXIT
for name in "${CRON_NAMES[@]}"; do
  temporary="$(mktemp "$CRON_D_DIR/.$name.XXXXXX")"
  temporaries+=("$temporary")
  sed "/^#/!s|/usr/bin/node|$NODE_BIN|" "$SOURCE_DIR/$name" > "$temporary"
  chmod 644 "$temporary"
  if [ ! -s "$temporary" ] || [ -n "$(tail -c 1 "$temporary")" ]; then
    echo "ERROR: the cron schedule $name does not end with a newline, which cron needs; no schedule was installed" >&2
    exit 1
  fi
  # Only the lines that are not comments count from here on
  job_lines="$(grep -v '^#' "$temporary" || true)"
  # A % in a cron command is a newline
  case "$job_lines" in
    *%*)
      echo "ERROR: the cron schedule $name has a % outside its comments, which cron turns into a newline; no schedule was installed" >&2
      exit 1
      ;;
  esac
  # Every job line must run a script of the release through run-cron-job.sh and the node of the jobs, and there must be one
  job_count=0
  while IFS= read -r line; do
    case "$line" in
      [0-9*]*)
        job_count=$((job_count + 1))
        job_script="$(printf '%s\n' "$line" | sed -nE "s|^[^ ]+ [^ ]+ [^ ]+ [^ ]+ [^ ]+ root /[^ ]+/backend/scripts/run-cron-job\.sh [A-Za-z0-9_-]+ $NODE_BIN node_modules/tsx/dist/cli\.mjs (scripts/[A-Za-z0-9_.-]+\.ts)\$|\1|p")"
        if [ -z "$job_script" ]; then
          echo "ERROR: the cron schedule $name does not run $NODE_BIN on a script through $RUNNER in the line '$line'; no schedule was installed" >&2
          exit 1
        fi
        if [ ! -f "$APP_DIR/backend/$job_script" ]; then
          echo "ERROR: $APP_DIR/backend/$job_script is missing; a job of $name could not start, so no schedule was installed" >&2
          exit 1
        fi
        ;;
    esac
  done <<< "$job_lines"
  if [ "$job_count" -eq 0 ]; then
    echo "ERROR: the cron schedule $name does not run $NODE_BIN on a script through $RUNNER; no schedule was installed" >&2
    exit 1
  fi
done
install -d -m 755 "$APP_DIR/backend/logs"
for index in "${!CRON_NAMES[@]}"; do
  # Cron ignores a file in cron.d that is not owned by root
  if [ "$(id -u)" -eq 0 ]; then
    chown root:root "${temporaries[$index]}"
  fi
done
for index in "${!CRON_NAMES[@]}"; do
  mv -f "${temporaries[$index]}" "$CRON_D_DIR/${CRON_NAMES[$index]}"
  echo "Installed $CRON_D_DIR/${CRON_NAMES[$index]} (the jobs run $NODE_BIN, $("$NODE_BIN" --version 2>/dev/null || echo "version unknown"))"
done

# The schedules say UTC times, but the Debian and Ubuntu cron package that the production server uses ignores the CRON_TZ
# line of the file (its crontab(5) documents only TZ), so cron.d runs the job in the server's own time zone, which is
# UTC there. This warning covers a server in another zone; it is printed at deploy time only, does not stop the deploy, and
# compares the current UTC offset (so it does not see a zone that is at +0000 now and changes with summer time). The
# installer does not detect which cron package is installed. The pick itself is always for the current UTC
# day, so a run at another hour still picks the right law, but a run before 00:00 UTC only finds the day before
# already picked: the job then no longer picks ahead of the first visitor.
utc_offset="$(date +%z)" || utc_offset="+0000"
if [ "$utc_offset" != "+0000" ]; then
  echo "WARNING: the server's time zone is UTC$utc_offset; the Debian and Ubuntu cron package ignores the CRON_TZ=UTC line of the schedule file, so with that cron the Law of the Day job runs at 00:00 local time and not at 00:00 UTC, and then does not pick ahead of the first visitor" >&2
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
