#!/bin/bash
#
# Removes the standalone vulnerability scanner entry from root's crontab, if there is one.
#
# Run as root by the GitHub Actions deploy (.github/workflows/deploy.yml, "Deploy and restart services") after the
# maintenance scripts are installed; the deploy prints its "==> Removing the standalone vulnerability scanner cron
# job, if there is one" marker first. The workflow's script holds ${{ }} expressions, and GitHub refuses a workflow
# whose script string is over 21,000 characters, so this block lives here, where its behavior is tested
# (scripts/deploy-workflow.test.ts). The deploy also treats a non-zero exit of this script as a warning only.
#
# Usage: remove-scanner-cron.sh      (no arguments; reads nothing from standard input)
#
# The daily report runs the vulnerability scanner, so a standalone cron entry for it is removed. This is
# housekeeping and must never block a release (failing here would leave the old API running against the
# migrated schema), so every problem below only prints a WARNING and the deploy goes on; nothing here
# calls exit. What can never happen is an empty crontab: piping `crontab -l` into `crontab -` replaced
# the whole crontab with nothing whenever the read failed, and nothing reported it. The crontab is
# read into a variable and written back only from a read that succeeded, only when a scanner line was
# there and only when something other than blank lines remains. "No crontab for root" is not a problem.
# Any other failed read, a grep that errors (exit 2, which must never look like "no match" or "nothing
# left") or a failed write leaves the crontab as it was (`crontab -` replaces it atomically).

set -e
trap 'echo "==> Script failed at line $LINENO of $0"' ERR

scanner_script="vulnerability-scanner.sh"
crontab_error_file="$(mktemp)" || crontab_error_file=""
if [ -z "$crontab_error_file" ]; then
  echo "WARNING: could not create a temporary file to read root's crontab; it was left unchanged and the deploy continues" >&2
else
  crontab_status=0
  crontab_current="$(sudo env LC_ALL=C crontab -l 2>"$crontab_error_file" </dev/null)" || crontab_status=$?
  crontab_error="$(cat "$crontab_error_file")" || crontab_error=""
  rm -f "$crontab_error_file" || echo "WARNING: could not remove the temporary file $crontab_error_file; the deploy continues" >&2
  if [ "$crontab_status" -ne 0 ]; then
    # sudo may print a line of its own first, so only the last line of the error is the crontab's answer
    case "${crontab_error##*$'\n'}" in
      "no crontab for "*) echo "Root has no crontab; nothing to remove" ;;
      *) echo "WARNING: could not read root's crontab (exit $crontab_status: $crontab_error); it was left unchanged and the deploy continues" >&2 ;;
    esac
  else
    [ -z "$crontab_error" ] || echo "WARNING: crontab -l printed: $crontab_error" >&2
    # Each grep below exits 0 for "yes", 1 for "no" and 2 for an error, which is never read as "no". They
    # read a pipe and print nothing (no -q, so printf is never cut off by a closed pipe), because a failed
    # here-string redirection would look like "no".
    # content_check is 0 when something other than blank lines remains and 1 when nothing does.
    scanner_found=0
    printf '%s\n' "$crontab_current" | LC_ALL=C grep -aF -- "$scanner_script" > /dev/null || scanner_found=$?
    crontab_filtered=""
    scanner_removed=0
    content_check=0
    if [ "$scanner_found" -eq 0 ]; then
      crontab_filtered="$(printf '%s\n' "$crontab_current" | LC_ALL=C grep -avF -- "$scanner_script")" || scanner_removed=$?
      if [ "$scanner_removed" -le 1 ]; then
        printf '%s\n' "$crontab_filtered" | LC_ALL=C grep -a '[^[:space:]]' > /dev/null || content_check=$?
      fi
    fi
    if [ "$scanner_found" -gt 1 ] || [ "$scanner_removed" -gt 1 ] || [ "$content_check" -gt 1 ]; then
      echo "WARNING: could not search root's crontab for $scanner_script; it was left unchanged and the deploy continues" >&2
    elif [ "$scanner_found" -eq 1 ]; then
      echo "No standalone vulnerability scanner cron job; the crontab was left unchanged"
    elif [ "$content_check" -eq 1 ]; then
      # Removing the entry would leave nothing, and an empty crontab is never written
      echo "WARNING: the vulnerability scanner entry is the only entry in root's crontab; it was left in place" >&2
    elif printf '%s\n' "$crontab_filtered" | sudo crontab -; then
      echo "✓ Standalone vulnerability scanner cron job removed"
    else
      echo "WARNING: could not write root's crontab; it was left as it was and the deploy continues" >&2
    fi
  fi
fi
