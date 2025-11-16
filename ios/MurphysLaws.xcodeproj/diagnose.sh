#!/bin/bash

# Diagnostic script to find the actual problem
# Save this as diagnose.sh in your ios/ directory and run: bash diagnose.sh

cd /Users/ravidor/personal-dev/murphys-laws/ios

echo "=== DIAGNOSTIC REPORT ==="
echo ""

echo "1. Checking for SharedContentLoader references in project file:"
grep -n "SharedContentLoader" MurphysLaws.xcodeproj/project.pbxproj | head -20
echo ""

echo "2. Checking for ContentPage references in project file:"
grep -n "ContentPage" MurphysLaws.xcodeproj/project.pbxproj | head -20
echo ""

echo "3. Checking UIUtilities references:"
grep -n "UIUtilities" MurphysLaws.xcodeproj/project.pbxproj
echo ""

echo "4. Checking UI Tests target linker flags:"
grep -A10 "MurphysLawsUITests" MurphysLaws.xcodeproj/project.pbxproj | grep -E "OTHER_LDFLAGS|FRAMEWORK_SEARCH_PATHS"
echo ""

echo "5. Checking for @testable import in UI test files:"
find . -name "*UITests.swift" -exec grep -l "@testable\|import MurphysLaws" {} \;
echo ""

echo "=== END DIAGNOSTIC ==="
