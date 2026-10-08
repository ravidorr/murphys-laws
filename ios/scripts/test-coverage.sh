#!/bin/bash

set -euo pipefail

destination="${1:-}"

if [ -z "$destination" ]; then
  simulator_id="$(xcrun simctl list devices available | awk '/iPhone/ {
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^\([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\)$/) {
        gsub(/[()]/, "", $i)
        print $i
        exit
      }
    }
  }')"

  if [ -z "$simulator_id" ]; then
    echo "No available iPhone simulator found."
    exit 1
  fi

  destination="platform=iOS Simulator,id=$simulator_id"
fi

rm -rf TestResults.xcresult coverage.json

xcodebuild test \
  -project MurphysLaws.xcodeproj \
  -scheme MurphysLaws \
  -destination "$destination" \
  -enableCodeCoverage YES \
  -resultBundlePath TestResults.xcresult

xcrun xccov view --report --json TestResults.xcresult > coverage.json
npx tsx scripts/check-coverage.ts coverage.json 0.65
