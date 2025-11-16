#!/bin/bash

# Fix ContentPage.swift visibility issue in Xcode project
# This script restores the project to use explicit file references instead of automatic sync

echo "🔧 Fixing ContentPage.swift visibility issue..."
echo ""

PROJECT_DIR="/home/user/murphys-laws/ios"
PBXPROJ="$PROJECT_DIR/MurphysLaws.xcodeproj/project.pbxproj"
BACKUP="$PBXPROJ.backup.$(date +%Y%m%d_%H%M%S)"

# Create backup
echo "📦 Creating backup: $BACKUP"
cp "$PBXPROJ" "$BACKUP"

# Copy the working backup that has explicit file references
WORKING_BACKUP="$PROJECT_DIR/MurphysLaws.xcodeproj/project.pbxproj.backup.20251116_012535"

if [ -f "$WORKING_BACKUP" ]; then
    echo "✅ Restoring from working backup..."
    cp "$WORKING_BACKUP" "$PBXPROJ"
    echo ""
    echo "✅ Project file restored!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Open Xcode"
    echo "2. Clean Build Folder (Shift + Cmd + K)"
    echo "3. Build (Cmd + B)"
    echo ""
    echo "🎉 ContentPage should now be visible!"
else
    echo "❌ Working backup not found at: $WORKING_BACKUP"
    echo "Cannot restore. Please check the backup file location."
    exit 1
fi
