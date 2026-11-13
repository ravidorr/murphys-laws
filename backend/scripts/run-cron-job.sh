#!/bin/bash
#
# Runs one nightly cron job, keeps its log, records the run, and emails an alert when it fails.
#
# Usage: run-cron-job.sh JOB_NAME COMMAND [ARGUMENT...]
#
# The files in backend/config/cron.d start every job through this script. It:
#   1. changes to the backend directory (the one above this script) and appends everything the command prints, and
#      a "start" and "end" line, to backend/logs/JOB_NAME.log, so a failing `cd` or a missing command reaches the log too
#   2. stops the command after CRON_JOB_TIMEOUT seconds (default 1800) when `timeout` exists; the exit status is then 124
#   3. records the run in backend/logs/cron-state/JOB_NAME.state (see below), which the daily report reads to flag a
#      job that never ran (render-daily-report.ts)
#   4. when the command failed, emails an alert through alert-email.sh with the job name, the exit status and the last
#      20 lines of the log. The alert goes out on the 1st, 2nd, 4th, 8th... failure in a row, so a job that keeps failing
#      does not mail every day without bound; a success starts the count again and sends nothing
#
# The state file holds one KEY=VALUE per line, replaced in one step (never half-written):
#   last_start=EPOCH     when the last run began
#   last_end=EPOCH       when the last run ended
#   last_status=N        exit status of the last run (0 is success, 124 is a timeout)
#   last_success=EPOCH   when the last run with status 0 ended (absent until there was one)
#   failures=N           failed runs in a row (0 after a success)
#
# The exit status is the command's own, or 2 when the command succeeded but the alert could not be delivered.
# JOB_NAME is letters, digits, hyphen and underscore. Environment (the tests override these): CRON_JOB_TIMEOUT,
# CRON_JOB_LOG_DIR (default backend/logs), REPO_ROOT and ALERT_EMAIL / EMAIL_TO (see alert-email.sh).

set -uo pipefail

_alert_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$_alert_self")"
_alert_helper="$SCRIPT_DIR/alert-email.sh"
[ -f "$_alert_helper" ] || _alert_helper="${REPO_ROOT:-/root/murphys-laws}/backend/scripts/alert-email.sh"
if [ ! -f "$_alert_helper" ] || ! source "$_alert_helper"; then
  echo "FATAL: cannot load alert-email.sh" >&2
  exit 1
fi

JOB="${1:-}"
if [ "$#" -lt 2 ] || [[ ! "$JOB" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "usage: run-cron-job.sh JOB_NAME COMMAND [ARGUMENT...] (JOB_NAME is letters, digits, - and _)" >&2
  exit 64
fi
shift

BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${CRON_JOB_LOG_DIR:-$BACKEND_DIR/logs}"
STATE_DIR="$LOG_DIR/cron-state"
LOG_FILE="$LOG_DIR/$JOB.log"
STATE_FILE="$STATE_DIR/$JOB.state"

mkdir -p "$STATE_DIR" || { echo "FATAL: cannot create $STATE_DIR" >&2; exit 1; }

state_value() {
  local value=""
  [ -f "$STATE_FILE" ] && value="$(sed -n "s/^$1=//p" "$STATE_FILE" | tail -n 1)"
  printf '%s' "$value"
}

write_state() {
  local temporary
  temporary="$(mktemp "$STATE_DIR/.$JOB.XXXXXX")" || return 1
  printf '%s\n' "$@" > "$temporary" && mv -f "$temporary" "$STATE_FILE" || { rm -f "$temporary"; return 1; }
}

previous_failures="$(state_value failures)"
previous_success="$(state_value last_success)"
[[ "$previous_failures" =~ ^[0-9]+$ ]] || previous_failures=0
[[ "$previous_success" =~ ^[0-9]+$ ]] || previous_success=""

started="$(date -u +%s)"
# "last_end" is not written yet, so a run that is killed halfway shows as started and never finished
write_state "last_start=$started" ${previous_success:+"last_success=$previous_success"} "failures=$previous_failures" \
  || echo "WARNING: could not record the start of $JOB in $STATE_FILE" >&2

echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') $JOB: start ===" >> "$LOG_FILE"
status=0
# A subshell, so the cd does not change where the wrapper itself resolves a relative log or state path
run_command() (
  cd "$BACKEND_DIR" || exit 1
  if command -v timeout >/dev/null 2>&1; then
    timeout "${CRON_JOB_TIMEOUT:-1800}" "$@"
  else
    "$@"
  fi
)
run_command "$@" >> "$LOG_FILE" 2>&1 || status=$?
ended="$(date -u +%s)"
echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') $JOB: end, exit status $status ===" >> "$LOG_FILE"

if [ "$status" -eq 0 ]; then
  failures=0
  success="$ended"
else
  failures=$((previous_failures + 1))
  success="$previous_success"
fi
write_state "last_start=$started" "last_end=$ended" "last_status=$status" ${success:+"last_success=$success"} "failures=$failures" \
  || echo "WARNING: could not record the end of $JOB in $STATE_FILE" >&2

if [ "$status" -ne 0 ]; then
  # Alert on failure 1, 2, 4, 8, ... in a row (a power of two)
  if [ $((failures & (failures - 1))) -eq 0 ]; then
    ALERT_EMAIL="$(resolve_alert_email)"
    subject="Murphy's Laws cron job failed: $JOB (exit $status)"
    {
      echo "The nightly cron job '$JOB' exited with status $status$([ "$status" -eq 124 ] && echo " (timed out)")."
      echo "Failures in a row: $failures. Host: $(hostname 2>/dev/null || echo unknown). Log: $LOG_FILE"
      echo
      echo "Last 20 lines of the log:"
      tail -n 20 "$LOG_FILE"
    } | send_alert_mail "$subject"
    mail_status=${PIPESTATUS[1]}
    if [ "$mail_status" -ne 0 ]; then
      ALERT_UNDELIVERED=1
      echo "alert for $JOB not sent: $(describe_alert_mail_status "$mail_status")" >> "$LOG_FILE"
    fi
  else
    echo "alert for $JOB skipped: failure $failures in a row (alerts go out on the 1st, 2nd, 4th, 8th...)" >> "$LOG_FILE"
  fi
fi

exit "$(delivery_exit_code "$status")"
