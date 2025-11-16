#!/bin/bash

# IMMEDIATE FIX for MurphysLaws UI Tests Linker Errors
# Run this script from the ios/ directory

set -e  # Exit on any error

PROJECT_DIR="/Users/ravidor/personal-dev/murphys-laws/ios"
XCODE_PROJECT="$PROJECT_DIR/MurphysLaws.xcodeproj"
PROJECT_FILE="$XCODE_PROJECT/project.pbxproj"

echo "🚨 IMMEDIATE FIX - MurphysLaws UI Tests Linker Errors"
echo "======================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "$PROJECT_FILE" ]; then
    echo "❌ Error: Cannot find project.pbxproj"
    echo "Please cd to: $PROJECT_DIR"
    echo "Then run: bash FIX_NOW.sh"
    exit 1
fi

echo "✅ Found project at: $PROJECT_DIR"
echo ""

# Step 1: Backup
echo "📦 Step 1: Creating backup..."
BACKUP_FILE="$PROJECT_FILE.backup.$(date +%Y%m%d_%H%M%S)"
cp "$PROJECT_FILE" "$BACKUP_FILE"
echo "✅ Backup created at: $BACKUP_FILE"
echo ""

# Step 2: Clean everything
echo "🧹 Step 2: Cleaning build artifacts..."

# Clean derived data
echo "   → Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-* 2>/dev/null || true

# Clean build folder
echo "   → Cleaning build folder..."
cd "$PROJECT_DIR"
xcodebuild clean -scheme MurphysLaws -quiet 2>/dev/null || true

echo "✅ Clean complete"
echo ""

# Step 3: Remove problematic target memberships
echo "🔧 Step 3: Fixing target memberships..."
echo ""
echo "The linker errors are caused by SharedContentLoader.swift and"
echo "ContentPage.swift being incorrectly added to the UI Tests target."
echo ""
echo "⚠️  I cannot automatically fix the Xcode project file safely."
echo ""
echo "Please do ONE of the following:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 1: Disable UI Tests (FASTEST - 30 seconds)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open Xcode"
echo "2. Product → Scheme → Edit Scheme... (or press Cmd + <)"
echo "3. Click 'Test' in the left sidebar"
echo "4. UNCHECK the box next to 'MurphysLawsUITests'"
echo "5. Click Close"
echo "6. Build (Cmd + B)"
echo ""
echo "✅ DONE! Your app will build."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 2: Fix Target Membership (PROPER FIX - 2 minutes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open Xcode"
echo "2. Select 'SharedContentLoader.swift' in Project Navigator"
echo "3. Open File Inspector (View → Inspectors → File, or Cmd+Opt+1)"
echo "4. In 'Target Membership' section:"
echo "   ✅ Keep 'MurphysLaws' checked"
echo "   ❌ UNCHECK 'MurphysLawsUITests'"
echo ""
echo "5. Repeat for 'ContentPage.swift'"
echo ""
echo "6. Select your project (top item in Project Navigator)"
echo "7. Select 'MurphysLawsUITests' target"
echo "8. Go to 'Build Phases' tab"
echo "9. Expand 'Link Binary With Libraries'"
echo "10. If you see 'UIUtilities.framework', select it and click '-' to remove"
echo ""
echo "11. Clean Build Folder (Product → Clean Build Folder, or Shift+Cmd+K)"
echo "12. Build (Cmd + B)"
echo ""
echo "✅ DONE! Your UI tests will be properly configured."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTION 3: Nuclear Option - Delete UI Tests Target"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open Xcode"
echo "2. Select your project (top item in Project Navigator)"
echo "3. Select 'MurphysLawsUITests' target"
echo "4. Press Delete key"
echo "5. Confirm deletion"
echo "6. Build (Cmd + B)"
echo ""
echo "✅ DONE! UI tests completely removed."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 RECOMMENDATION: Use Option 1 (disable) for now,"
echo "   then fix properly with Option 2 later."
echo ""
echo "If something goes wrong, restore backup:"
echo "cp '$BACKUP_FILE' '$PROJECT_FILE'"
echo ""
echo "======================================================="

# Open Xcode automatically
echo ""
echo "🚀 Opening Xcode now..."
sleep 2
open "$XCODE_PROJECT"

echo ""
echo "👆 Follow the instructions above in Xcode!"
echo ""
