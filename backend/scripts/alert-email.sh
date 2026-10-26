#!/bin/bash
# Shared by every monitoring script that sends email. Source it; do not run it.
#
# Each script loads it with this block (the helper cannot load itself), which falls back to the repo
# copy and stops the script with a clear error when neither exists, so alerts are never lost silently.
# The file is tested before sourcing it so the missing-file case never depends on how a given shell
# reacts to a failed `source` (a POSIX-mode shell exits at once, and `set -e` scripts must not):
#
#   _alert_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
#   _alert_helper="$(dirname "$_alert_self")/alert-email.sh"
#   [ -f "$_alert_helper" ] || _alert_helper="${REPO_ROOT:-/root/murphys-laws}/backend/scripts/alert-email.sh"
#   if [ ! -f "$_alert_helper" ] || ! source "$_alert_helper"; then
#     echo "FATAL: cannot load alert-email.sh" >&2; exit 1
#   fi
#
# and then uses it like this:
#
#   ALERT_EMAIL="$(resolve_alert_email)"
#   if echo "$body" | send_alert_mail "$subject"; then ...sent...
#   else status=$?; echo "not sent: $(describe_alert_mail_status "$status")"; fi
#
# There is no built-in address. resolve_alert_email prints the first non-blank value of the extra
# variable names you pass, then ALERT_EMAIL, then EMAIL_TO (the admin address the server already uses
# for notices). Each name is looked up in the environment first, then in the server's .env files,
# because cron does not load them. The files are checked in the order the API server uses (root .env, then
# backend/.env) with an extra override file first, and the first file with a value wins. The TypeScript
# scripts (health-check.ts, the daily report) use the same files in the same order (the API server itself
# does not read the override file):
#   $ALERT_ENV_FILE (an extra file for overrides), $REPO_ROOT/.env, $REPO_ROOT/backend/.env
# (REPO_ROOT defaults to /root/murphys-laws). The files are parsed like the dotenv package parses the
# usual forms (plain, quoted, export, trailing comments), not the rarer ones such as backtick quotes or
# escapes in double quotes, and are never sourced, so a secret containing shell characters cannot run
# anything. It prints nothing, and still succeeds, when no address is configured.
#
# send_alert_mail returns 0 when mail accepted the message, 3 when there is no recipient, 4 when the
# recipient is not a plausible address, 127 when `mail` is missing, and mail's own status otherwise.
# Callers decide what a failure means; on a drop or a failure it also writes to syslog (when `logger`
# exists) so the problem is visible somewhere durable, not only on a cron stderr nobody reads.
#
# The recipient may be a single address or a comma-separated list ("a@example.com, b@example.com"); spaces around the
# commas are ignored and every address is checked on its own.
#
# Status 0 only means `mail` handed the message to the local mail system. If that system is down or
# cannot deliver, the message can still queue or bounce afterwards (check `mailq`).
#
# So that cron notices an undelivered alert or report, a script sets ALERT_UNDELIVERED=1 when a send did
# not succeed (in the shell that runs the script, not inside a pipeline) and ends with
# `exit "$(delivery_exit_code <its own exit code>)"`, which turns an otherwise successful run into exit
# code 2 and leaves a failing exit code alone.

_alert_trim() {
  local value="$1"
  value="${value%$'\r'}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

# Prints the value of KEY from a dotenv-style FILE, read the way the dotenv package reads it: spaces
# around `=` are allowed, the last duplicate wins, a quoted value ends at its closing quote (anything
# after it, such as a comment, is dropped), and an unquoted value ends at the first `#`.
_alert_env_file_value() {
  local file="$1" key="$2" line value
  # -a keeps a file with a stray binary byte readable as text (otherwise some greps answer "Binary file
  # matches" or silently match nothing); a real read error is left visible on stderr.
  line="$(grep -aE "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" "$file" | tail -n 1)"
  [ -n "$line" ] || return 0
  value="$(_alert_trim "${line#*=}")"
  case "$value" in
    \"*) value="${value#\"}"; value="${value%%\"*}" ;;
    \'*) value="${value#\'}"; value="${value%%\'*}" ;;
    *) value="${value%%#*}" ;;
  esac
  printf '%s' "$(_alert_trim "$value")"
}

resolve_alert_email() {
  local root="${REPO_ROOT:-/root/murphys-laws}" key value file
  for key in "$@" ALERT_EMAIL EMAIL_TO; do
    value="$(_alert_trim "${!key:-}")"
    if [ -z "$value" ]; then
      for file in "${ALERT_ENV_FILE:-}" "$root/.env" "$root/backend/.env"; do
        if [ -n "$file" ] && [ -f "$file" ]; then
          value="$(_alert_trim "$(_alert_env_file_value "$file" "$key")")"
          [ -n "$value" ] && break
        fi
      done
    fi
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
  return 0
}

# Exit code for a script that would exit with $1: 2 when an alert or report was not delivered
# (ALERT_UNDELIVERED is non-zero) and $1 is 0, otherwise $1 unchanged.
delivery_exit_code() {
  local code="${1:-0}"
  if [ "$code" -eq 0 ] && [ "${ALERT_UNDELIVERED:-0}" -ne 0 ]; then
    echo 2
  else
    echo "$code"
  fi
}

# Reports a problem on stderr and, when `logger` exists, in syslog.
_alert_problem() {
  echo "WARNING: $1" >&2
  if command -v logger >/dev/null 2>&1; then
    logger -t murphys-alerts -p user.warning -- "$1" 2>/dev/null || true
  fi
}

# Reads the message body from stdin and mails it to $ALERT_EMAIL. Status codes are described above.
send_alert_mail() {
  local subject="${1:-}" recipient="${ALERT_EMAIL:-}"

  if [ -z "$recipient" ]; then
    _alert_problem "no alert recipient (set ALERT_EMAIL or EMAIL_TO); not emailing: $subject"
    cat >/dev/null
    return 3
  fi
  # One address or a comma-separated list; spaces around the commas are ignored.
  local -a recipients=()
  local part
  while IFS= read -r part; do
    part="$(_alert_trim "$part")"
    [ -n "$part" ] || continue
    if [[ "$part" == -* || "$part" == *[[:space:]]* || "$part" != *@* ]]; then
      _alert_problem "alert recipient '$recipient' is not a valid address; not emailing: $subject"
      cat >/dev/null
      return 4
    fi
    recipients+=("$part")
  done <<< "${recipient//,/$'\n'}"
  if [ "${#recipients[@]}" -eq 0 ]; then
    _alert_problem "alert recipient '$recipient' is not a valid address; not emailing: $subject"
    cat >/dev/null
    return 4
  fi
  if ! command -v mail >/dev/null 2>&1; then
    _alert_problem "the mail command is not installed or not on PATH ($PATH); not emailing: $subject"
    cat >/dev/null
    return 127
  fi

  local status=0
  mail -s "$subject" -- "${recipients[@]}" || status=$?
  if [ "$status" -ne 0 ]; then
    _alert_problem "mail exited with status $status; the message may not have been sent: $subject"
  fi
  return "$status"
}

# Turns a send_alert_mail status into words for a log line.
describe_alert_mail_status() {
  case "${1:-0}" in
    0) echo "sent" ;;
    3) echo "no recipient configured" ;;
    4) echo "invalid recipient" ;;
    127) echo "mail command not found" ;;
    *) echo "mail exited with status ${1}" ;;
  esac
}
