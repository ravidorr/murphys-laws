#!/bin/bash
#
# Looks at the last 20 lines of each murphys-api log file (out and error) after a deploy restarted it, and prints a
# WARNING when a log line mentions an error or a MODULE_VERSION-style native module mismatch (the case that
# PREVENTING-502-ERRORS.md describes). Called by .github/workflows/deploy.yml. It only warns: the exit status is 0
# whatever the logs hold, and when pm2 cannot be read it prints one WARNING to stderr and still exits 0.
#
# `pm2 logs --nostream` prints a banner and, before the lines of each log file, a header that names the file
# ("/root/murphys-laws/backend/logs/api-error-1.log last 20 lines:"). The header of the error log contains the word
# "error" on every deploy, so only the log lines are checked, never the banner or the headers. A log line starts with
# the process prefix ("1|murphys-a | "), never with a "/", so a line that starts with "/" is a header even when its
# exact shape is not the one expected.
#
# Usage: check-pm2-health.sh [MARKER_FILE]
#
# MARKER_FILE is a file that the deploy touched just before it started PM2. A log file whose modification time is
# older than the marker was not written to since the restart, so its lines (all from earlier runs) are skipped. A file
# with the same modification time as the marker counts as written to: a startup crash a moment after the start must
# never be skipped, so a tie can only cost an extra warning. For a file that was written to, the last 20 lines may
# still hold older lines: PM2 does not timestamp them (ecosystem.config.cjs sets no `time`). Without a marker (no
# argument, or a file that does not exist), or for a log file that cannot be found, every line is checked.
#
# The deploy runs this with stdin redirected from /dev/null: pm2 would otherwise inherit stdin, which there is the
# rest of the deploy script.

set -uo pipefail
shopt -s nocasematch

marker="${1:-}"
skip=0
found=0

logs="$(pm2 logs murphys-api --lines 20 --nostream 2>&1)" || {
  status=$?
  echo "WARNING: could not read the PM2 logs of murphys-api (pm2 exit $status), so they were not checked" >&2
  printf '%s\n' "$logs" | tail -n 5 >&2
  exit 0
}

while IFS= read -r line; do
  line="${line%$'\r'}"
  if [[ "$line" =~ ^(/.+)\ last\ [0-9]+\ lines:[[:space:]]*$ ]]; then
    file="${BASH_REMATCH[1]}"
    skip=0
    if [ -n "$marker" ] && [ -f "$file" ] && [ "$marker" -nt "$file" ]; then skip=1; fi
  elif [[ "$line" == /* ]]; then
    skip=0
  elif [ "$skip" -eq 0 ] && [[ "$line" != "[TAILING]"* ]] && [[ "$line" == *error* || "$line" =~ module.*version ]]; then
    echo "$line"
    found=1
  fi
done <<< "$logs"

if [ "$found" -eq 1 ]; then
  echo "⚠️  WARNING: Errors detected in logs"
fi
exit 0
