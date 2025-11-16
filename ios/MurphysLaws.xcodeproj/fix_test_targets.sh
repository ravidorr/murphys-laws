#!/bin/bash

# Script to fix MurphysLaws UI Test target issues
# Run this from the ios/ directory

echo "🔧 Fixing MurphysLaws Test Target Configuration..."
echo ""

PROJECT_DIR="/Users/ravidor/personal-dev/murphys-laws/ios"
XCODE_PROJECT="$PROJECT_DIR/MurphysLaws.xcodeproj"
PROJECT_FILE="$XCODE_PROJECT/project.pbxproj"

# Check if project exists
if [ ! -f "$PROJECT_FILE" ]; then
    echo "❌ Error: Could not find project.pbxproj at $PROJECT_FILE"
    echo "Please run this script from the correct directory."
    exit 1
fi

echo "📁 Found project at: $PROJECT_FILE"
echo ""

# Backup the project file
echo "💾 Creating backup..."
cp "$PROJECT_FILE" "$PROJECT_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup created"
echo ""

# Clean derived data
echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*
echo "✅ Derived data cleaned"
echo ""

# Clean build folder
echo "🧹 Cleaning build folder..."
cd "$PROJECT_DIR"
xcodebuild clean -scheme MurphysLaws -quiet 2>/dev/null
echo "✅ Build folder cleaned"
echo ""

echo "✅ Basic cleanup complete!"
echo ""
echo "⚠️  MANUAL STEPS REQUIRED:"
echo ""
echo "1. Open Xcode and select your project in the Project Navigator"
echo ""
echo "2. For each of these files, verify Target Membership:"
echo "   • SharedContentLoader.swift"
echo "   • ContentPage.swift"
echo ""
echo "   Make sure:"
echo "   ✅ 'MurphysLaws' target is checked"
echo "   ❌ 'MurphysLawsUITests' target is UNCHECKED"
echo ""
echo "3. Select 'MurphysLawsUITests' target → Build Phases → Link Binary With Libraries"
echo "   Remove 'UIUtilities.framework' if present"
echo ""
echo "4. Clean Build Folder in Xcode (Shift + Cmd + K)"
echo ""
echo "5. Build (Cmd + B)"
echo ""
echo "To restore the backup if needed:"
echo "cp $PROJECT_FILE.backup.* $PROJECT_FILE"
echo ""
