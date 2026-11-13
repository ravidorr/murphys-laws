#!/bin/bash
#
# Installs the server maintenance scripts (backup, monitoring, reports) into /usr/local/bin, and the example
# configuration files into /etc/murphys-laws.
#
# Run as root by the GitHub Actions deploy (.github/workflows/deploy.yml, "Deploy and restart services") after the
# migrations, with the release already in place. The workflow's script holds ${{ }} expressions, and GitHub refuses a
# workflow whose script string is over 21,000 characters, so this block lives here, where its behavior is tested
# (scripts/deploy-workflow.test.ts). It exits 1 with an ERROR line when a script that must not be left stale cannot
# be installed; the deploy passes that exit status on, so it fails the deploy.
#
# Usage: install-maintenance-scripts.sh [TARGET_DIR]   (TARGET_DIR defaults to /root/murphys-laws; reads nothing from
# standard input)
#
# BIN_DIR (default /usr/local/bin) and ETC_DIR (default /etc/murphys-laws) are only overridden by the tests.

set -e
trap 'echo "==> Script failed at line $LINENO of $0"' ERR

TARGET_DIR="${1:-/root/murphys-laws}"
BIN_DIR="${BIN_DIR:-/usr/local/bin}"
ETC_DIR="${ETC_DIR:-/etc/murphys-laws}"

# Update server maintenance scripts
# Sourced by the monitoring scripts below to resolve the alert address. They fall back to the repo
# copy, but the installed one is preferred, so a failure here fails the deploy instead of being
# ignored
sudo cp "$TARGET_DIR/backend/scripts/alert-email.sh" "$BIN_DIR/alert-email.sh" \
  && sudo chmod +x "$BIN_DIR/alert-email.sh" \
  && test -f "$BIN_DIR/alert-email.sh" \
  || { echo "ERROR: could not install $BIN_DIR/alert-email.sh; the monitoring scripts would lose their alerts" >&2; exit 1; }
# These scripts also load that helper, so a copy that fails would leave an old script running with
# the old behavior. Fail the deploy and show the cause instead of hiding it. (The other copies
# below do not load the helper and keep ignoring errors.)
# shellcheck disable=SC2015 # A && B || C is intended: a failed copy or a failed chmod both stop the deploy
for script in backup-murphys backup-offsite health-monitor ssl-monitor cost-optimization-report test-backup-restore; do
  sudo cp "$TARGET_DIR/backend/scripts/$script.sh" "$BIN_DIR/$script.sh" \
    && sudo chmod +x "$BIN_DIR/$script.sh" \
    || { echo "ERROR: could not install $BIN_DIR/$script.sh" >&2; exit 1; }
done
sudo cp "$TARGET_DIR/backend/scripts/daily-report.sh" "$BIN_DIR/daily-report.sh" 2>/dev/null || true
sudo cp "$TARGET_DIR/backend/scripts/vulnerability-scanner.sh" "$BIN_DIR/vulnerability-scanner.sh" 2>/dev/null || true
sudo cp "$TARGET_DIR/backend/scripts/performance-tracker.sh" "$BIN_DIR/performance-tracker.sh" 2>/dev/null || true
sudo cp "$TARGET_DIR/backend/scripts/analyze-resource-peaks.sh" "$BIN_DIR/analyze-resource-peaks.sh" 2>/dev/null || true
sudo mkdir -p "$ETC_DIR"
sudo cp "$TARGET_DIR/backend/config/operational-metrics-main-app.env.example" "$ETC_DIR/operational-metrics.env.example" 2>/dev/null || true
sudo cp "$TARGET_DIR/backend/config/infrastructure-inventory.json.example" "$ETC_DIR/infrastructure-inventory.json.example" 2>/dev/null || true
sudo cp "$TARGET_DIR/backend/scripts/log-analyzer.sh" "$BIN_DIR/log-analyzer.sh" 2>/dev/null || true
sudo chmod +x "$BIN_DIR"/*.sh 2>/dev/null || true
