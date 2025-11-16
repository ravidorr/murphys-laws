#!/bin/bash

# This script will actually fix the project file
# Save as fix_project.sh and run: bash fix_project.sh

set -e

cd /Users/ravidor/personal-dev/murphys-laws/ios

echo "🔧 Fixing Xcode project file..."
echo ""

# Backup
BACKUP="MurphysLaws.xcodeproj/project.pbxproj.backup.$(date +%Y%m%d_%H%M%S)"
cp MurphysLaws.xcodeproj/project.pbxproj "$BACKUP"
echo "✅ Backup created: $BACKUP"
echo ""

# Remove the problematic build file entries
echo "🔧 Removing SharedContentLoader.swift from UI Tests..."
sed -i '' '/7037DAAB12DB3321919685BA.*SharedContentLoader/d' MurphysLaws.xcodeproj/project.pbxproj

echo "🔧 Removing ContentPage.swift from UI Tests..."
sed -i '' '/5C6AA634EAF4932FAF9375FF.*ContentPage/d' MurphysLaws.xcodeproj/project.pbxproj

echo ""
echo "✅ Project file fixed!"
echo ""
echo "Now:"
echo "1. Clean derived data..."

rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-* 2>/dev/null || true

echo "✅ Derived data cleaned"
echo ""
echo "2. Open Xcode and:"
echo "   - Clean Build Folder (Shift + Cmd + K)"
echo "   - Build (Cmd + B)"
echo ""
echo "If it still fails, restore backup:"
echo "   cp '$BACKUP' MurphysLaws.xcodeproj/project.pbxproj"
echo ""
