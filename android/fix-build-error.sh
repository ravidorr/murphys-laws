#!/bin/bash

# Fix Android Build Error - Missing redirect.txt
# This script cleans the Android build and rebuilds the project

echo "🔧 Fixing Android Build Error..."
echo ""

# Navigate to Android directory
cd "$(dirname "$0")"

echo "📦 Step 1: Cleaning build directories..."
rm -rf app/build
rm -rf build
rm -rf .gradle

echo "✅ Build directories cleaned"
echo ""

echo "🔨 Step 2: Cleaning with Gradle..."
./gradlew clean

echo "✅ Gradle clean completed"
echo ""

echo "🏗️  Step 3: Building debug APK..."
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "The APK file should now be located at:"
    echo "app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "You should now be able to run the app from Android Studio without errors."
else
    echo ""
    echo "❌ Build failed. Please check the error messages above."
    echo ""
    echo "Common solutions:"
    echo "1. Ensure you have internet connectivity for downloading dependencies"
    echo "2. Check that you have the correct JDK version (17 or higher)"
    echo "3. Try running from Android Studio: Build > Clean Project, then Build > Rebuild Project"
    echo "4. Invalidate caches: File > Invalidate Caches / Restart in Android Studio"
fi
