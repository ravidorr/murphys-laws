#!/bin/bash

# Murphy's Laws iOS - Xcode Project Generator
# This script helps generate the Xcode project from project.yml

set -e

echo "🔨 Murphy's Laws iOS - Xcode Project Setup"
echo ""

# Check if we're in the right directory
if [ ! -f "project.yml" ]; then
    echo "❌ Error: project.yml not found. Please run this script from the ios/ directory."
    exit 1
fi

# Check if XcodeGen is installed
if ! command -v xcodegen &> /dev/null; then
    echo "📦 XcodeGen is not installed."
    echo ""
    echo "To install XcodeGen, run one of these commands:"
    echo ""
    echo "  Using Homebrew:"
    echo "    brew install xcodegen"
    echo ""
    echo "  Using Mint:"
    echo "    mint install yonaskolb/XcodeGen"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo "✅ XcodeGen found"
echo ""

# Regenerate iOS design tokens from shared/DESIGN.md before XcodeGen runs.
# The outputs (Assets.xcassets/DS/ and DesignSystem/Tokens.swift) are
# gitignored; they're a deterministic function of shared/DESIGN.md and
# we re-derive them here so Xcode always sees the freshest values.
# Requires Node + npm. Skipped automatically if Node isn't on PATH (a
# clear error from the script will surface in that case).
if command -v npm &> /dev/null; then
    echo "🎨 Regenerating iOS design tokens from shared/DESIGN.md..."
    npm --prefix ../web run design:export:ios
    echo ""
else
    echo "⚠️  npm not found on PATH; skipping iOS design-token regeneration."
    echo "   Tokens.swift and Assets.xcassets/DS/ may be missing or stale."
    echo "   Install Node 22+ and re-run this script for visual parity with web."
    echo ""
fi

# Generate the Xcode project
echo "🔧 Generating Xcode project from project.yml..."
xcodegen generate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Xcode project generated successfully!"
    echo ""
    echo "📱 Next steps:"
    echo "  1. Open the project: open MurphysLaws.xcodeproj"
    echo "  2. Select a simulator or device"
    echo "  3. Press ⌘R to build and run"
    echo ""
    echo "📚 Documentation:"
    echo "  - README: ./README.md"
    echo "  - Setup Guide: ./SETUP.md"
    echo "  - iOS PRD: ../shared/docs/MOBILE-IOS-PRD.md"
    echo ""
else
    echo ""
    echo "❌ Failed to generate Xcode project"
    echo "Please check the error messages above and ensure project.yml is valid."
    exit 1
fi
