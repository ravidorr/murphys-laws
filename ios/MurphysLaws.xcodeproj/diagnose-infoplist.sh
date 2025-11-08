#!/bin/bash

# Info.plist Duplicate Build Error Diagnostic Script
# Run this to identify why Info.plist is being processed multiple times

echo "🔍 Diagnosing Info.plist duplicate build error..."
echo ""

PROJECT_DIR="/Users/ravidor/personal-dev/murphys-laws/ios"
PROJECT_FILE="$PROJECT_DIR/MurphysLaws.xcodeproj/project.pbxproj"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "❌ Project file not found at: $PROJECT_FILE"
    echo "   Please run this script from your project directory"
    exit 1
fi

echo "✅ Found project file"
echo ""

# Check 1: Info.plist in PBXBuildFile (Copy Bundle Resources)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 1: Info.plist in Copy Bundle Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INFO_IN_BUILD=$(grep -n "Info.plist.*PBXBuildFile" "$PROJECT_FILE")
if [ -n "$INFO_IN_BUILD" ]; then
    echo "❌ PROBLEM FOUND!"
    echo "   Info.plist is in build files (it shouldn't be)"
    echo ""
    echo "   Lines found:"
    echo "$INFO_IN_BUILD" | sed 's/^/   /'
    echo ""
    echo "   FIX: In Xcode, go to:"
    echo "   → Target → Build Phases → Copy Bundle Resources"
    echo "   → Remove Info.plist from the list"
    echo ""
    FOUND_ISSUE=true
else
    echo "✅ GOOD: Info.plist is not in Copy Bundle Resources"
fi

echo ""

# Check 2: Multiple INFOPLIST_FILE entries
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 2: INFOPLIST_FILE Build Settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INFOPLIST_ENTRIES=$(grep "INFOPLIST_FILE" "$PROJECT_FILE")
INFOPLIST_COUNT=$(echo "$INFOPLIST_ENTRIES" | grep -c "INFOPLIST_FILE")

echo "Found $INFOPLIST_COUNT INFOPLIST_FILE references:"
echo "$INFOPLIST_ENTRIES" | grep "INFOPLIST_FILE" | sed 's/^/   /'
echo ""

if [ $INFOPLIST_COUNT -gt 4 ]; then
    echo "⚠️  WARNING: Unusually high number of INFOPLIST_FILE references"
    echo "   Expected: 2-4 (one per configuration per target)"
else
    echo "✅ GOOD: Normal number of INFOPLIST_FILE references"
fi

echo ""

# Check 3: Look for duplicate Info.plist files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 3: Info.plist Files in Project"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INFO_FILES=$(find "$PROJECT_DIR" -name "Info.plist" -type f 2>/dev/null | grep -v "DerivedData" | grep -v "Build")
INFO_FILE_COUNT=$(echo "$INFO_FILES" | grep -c "Info.plist")

echo "Found $INFO_FILE_COUNT Info.plist file(s):"
echo "$INFO_FILES" | sed 's/^/   /'
echo ""

if [ $INFO_FILE_COUNT -gt 2 ]; then
    echo "⚠️  WARNING: Multiple Info.plist files found"
    echo "   You should typically have 1-2 (app + test target)"
else
    echo "✅ GOOD: Normal number of Info.plist files"
fi

echo ""

# Check 4: ProcessInfoPlistFile build phase
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 4: ProcessInfoPlistFile References"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for shell script build phases that might process Info.plist
SHELL_SCRIPTS=$(grep -c "shellScript" "$PROJECT_FILE")
echo "Found $SHELL_SCRIPTS shell script build phases"

if [ $SHELL_SCRIPTS -gt 5 ]; then
    echo "⚠️  WARNING: Many shell scripts - one might be processing Info.plist"
    echo "   Check Build Phases → Run Script sections"
else
    echo "✅ GOOD: Normal number of shell scripts"
fi

echo ""

# Check 5: Target membership
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 5: Recent .plist Files Added"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Config.plist was accidentally set as Info.plist
CONFIG_IN_SETTINGS=$(grep "Config.plist.*INFOPLIST" "$PROJECT_FILE")
if [ -n "$CONFIG_IN_SETTINGS" ]; then
    echo "❌ PROBLEM FOUND!"
    echo "   Config.plist is set as INFOPLIST_FILE (wrong!)"
    echo "   Config.plist should be in Copy Bundle Resources, not as Info.plist"
    echo ""
    FOUND_ISSUE=true
else
    echo "✅ GOOD: Config.plist not set as INFOPLIST_FILE"
fi

# Check if Config.plist is in Copy Bundle Resources (should be)
CONFIG_IN_BUILD=$(grep "Config.plist.*PBXBuildFile" "$PROJECT_FILE")
if [ -n "$CONFIG_IN_BUILD" ]; then
    echo "✅ GOOD: Config.plist is in Copy Bundle Resources"
else
    echo "⚠️  WARNING: Config.plist not found in Copy Bundle Resources"
    echo "   You should add Config.plist to your target"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY & RECOMMENDED FIX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$FOUND_ISSUE" ]; then
    echo "🔧 ACTION REQUIRED:"
    echo ""
    echo "1. Open Xcode"
    echo "2. Select your MurphysLaws target"
    echo "3. Go to Build Phases tab"
    echo "4. Expand 'Copy Bundle Resources'"
    echo "5. Find and remove 'Info.plist' (if present)"
    echo "6. Keep 'Config.plist' in Copy Bundle Resources"
    echo "7. Clean Build Folder (⌘ + Shift + K)"
    echo "8. Build (⌘ + B)"
    echo ""
    echo "Expected result in Copy Bundle Resources:"
    echo "   ✅ Config.plist"
    echo "   ✅ Assets.xcassets"
    echo "   ✅ Other resources"
    echo "   ❌ Info.plist (should NOT be here)"
else
    echo "🤔 No obvious issues found in project file"
    echo ""
    echo "Try these additional fixes:"
    echo ""
    echo "1. Clean Build Folder:"
    echo "   ⌘ + Shift + K in Xcode"
    echo ""
    echo "2. Delete Derived Data:"
    echo "   rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*"
    echo ""
    echo "3. Restart Xcode"
    echo ""
    echo "4. Check Build Settings:"
    echo "   Target → Build Settings → Search 'Info.plist'"
    echo "   Verify INFOPLIST_FILE points to correct path"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For detailed fix instructions, see: INFO_PLIST_FIX.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
