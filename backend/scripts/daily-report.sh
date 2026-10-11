#!/usr/bin/env bash

#############################################################################
# Consolidated Daily Report launcher
# Rendering and delivery: backend/scripts/render-daily-report.ts
#############################################################################

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/murphys-laws}"
TSX_BIN="${TSX_BIN:-$REPO_ROOT/node_modules/.bin/tsx}"

if [ ! -x "$TSX_BIN" ] && command -v npx >/dev/null 2>&1; then
  exec npx --yes tsx "$REPO_ROOT/backend/scripts/render-daily-report.ts" "$@"
fi

exec "$TSX_BIN" "$REPO_ROOT/backend/scripts/render-daily-report.ts" "$@"
