#!/bin/bash
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
echo "🔧 Removing SharedContentLoader.swift from build files..."
sed -i '' '/7037DAAB12DB3321919685BA.*SharedContentLoader/d' MurphysLaws.xcodeproj/project.pbxproj

echo "🔧 Removing ContentPage.swift from build files..."
sed -i '' '/5C6AA634EAF4932FAF9375FF.*ContentPage/d' MurphysLaws.xcodeproj/project.pbxproj

echo ""
echo "✅ Project file fixed!"
echo ""

# Clean derived data
echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-* 2>/dev/null || true
echo "✅ Done"
echo ""

echo "📋 Next steps:"
echo "1. Open Xcode"
echo "2. Clean Build Folder (Shift + Cmd + K)"
echo "3. Build (Cmd + B)"
echo ""
echo "✅ Your build should now work!"
echo ""
echo "If something goes wrong, restore backup:"
echo "   cp '$BACKUP' MurphysLaws.xcodeproj/project.pbxproj"
