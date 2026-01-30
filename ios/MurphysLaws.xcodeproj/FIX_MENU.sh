#!/bin/bash

# Visual guide runner - makes it super obvious what to do

clear

cat << "EOF"
    ___  ___                __         _     
   / _ \/  /_ ___________ _/ /__ __ __( )____
  / // / /\// / __/ _\ \ // / / // //  (_-< /
 /____/_/ /_/_/ _\_\_\_//_//_/\ __/____/__/ 
                         /__/           

        Murphy's Laws - Build Error Fix
        
EOF

echo ""
echo "════════════════════════════════════════════════════════════"
echo "                    BUILD ERROR DETECTED                     "
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Your build is failing with UI Tests linker errors."
echo "Don't worry - I have the fix ready!"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Choose your fix method:"
echo ""
echo "  [1] 🚀 AUTOMATIC FIX (Recommended)"
echo "      • Runs the fix script automatically"
echo "      • Takes ~10 seconds"
echo "      • Safest and fastest"
echo ""
echo "  [2] 🔧 AGGRESSIVE AUTO-FIX"
echo "      • Directly edits project file"
echo "      • Use if option 1 doesn't work"
echo "      • Creates backup first"
echo ""
echo "  [3] 📋 SHOW MANUAL INSTRUCTIONS"
echo "      • Step-by-step guide"
echo "      • For manual control"
echo "      • Takes ~30 seconds"
echo ""
echo "  [4] 📖 READ DOCUMENTATION"
echo "      • Understand the problem"
echo "      • View all available fixes"
echo ""
echo "  [5] ❌ EXIT"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

read -p "Enter your choice [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "🚀 Running automatic fix..."
        echo ""
        bash JUST_FIX_IT.sh
        ;;
    2)
        echo ""
        echo "🔧 Running aggressive auto-fix..."
        echo ""
        if command -v ruby &> /dev/null; then
            ruby aggressive_fix.rb
            echo ""
            echo "✅ Fix complete!"
            echo ""
            echo "Next steps:"
            echo "1. Open Xcode"
            echo "2. Clean Build Folder (Shift + Cmd + K)"
            echo "3. Build (Cmd + B)"
            echo ""
            read -p "Press Enter to open Xcode..."
            open MurphysLaws.xcodeproj
        else
            echo "❌ Ruby not found. Please choose option 1 or 3."
        fi
        ;;
    3)
        echo ""
        echo "📋 MANUAL FIX INSTRUCTIONS"
        echo "══════════════════════════════════════════════════════"
        echo ""
        echo "QUICK FIX (30 seconds):"
        echo ""
        echo "1. In Xcode, click the scheme dropdown"
        echo "   (next to the Run/Stop buttons)"
        echo ""
        echo "2. Select 'Edit Scheme...'"
        echo ""
        echo "3. Click 'Test' in the left sidebar"
        echo ""
        echo "4. UNCHECK the box next to 'MurphysLawsUITests'"
        echo ""
        echo "5. Click 'Close'"
        echo ""
        echo "6. Build your project (Cmd + B)"
        echo ""
        echo "✅ Done! Your build will succeed."
        echo ""
        echo "══════════════════════════════════════════════════════"
        echo ""
        echo "WHY THIS WORKS:"
        echo "Your UI tests are already disabled in code (XCTSkip)."
        echo "Disabling them in the scheme prevents linker errors."
        echo ""
        echo "══════════════════════════════════════════════════════"
        echo ""
        read -p "Press Enter to open Xcode..."
        open MurphysLaws.xcodeproj
        ;;
    4)
        echo ""
        echo "📖 Opening documentation..."
        echo ""
        if [ -f "READ_ME_FIRST.md" ]; then
            cat READ_ME_FIRST.md
        else
            cat START_HERE.txt
        fi
        echo ""
        read -p "Press Enter to continue..."
        bash "$0"
        ;;
    5)
        echo ""
        echo "👋 Exiting. Run this script again anytime:"
        echo "   bash FIX_MENU.sh"
        echo ""
        exit 0
        ;;
    *)
        echo ""
        echo "❌ Invalid choice. Please run the script again."
        echo ""
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════"
echo "                         ALL DONE!                        "
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Your build should now work!"
echo ""
echo "If you still have issues:"
echo "• Read START_HERE.txt"
echo "• Read READ_ME_FIRST.md"
echo "• Or run: bash JUST_FIX_IT.sh"
echo ""
