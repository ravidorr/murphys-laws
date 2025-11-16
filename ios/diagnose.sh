#!/bin/bash
cd /Users/ravidor/personal-dev/murphys-laws/ios
echo "=== SharedContentLoader in project ==="
grep -n "SharedContentLoader" MurphysLaws.xcodeproj/project.pbxproj | head -20
echo ""
echo "=== ContentPage in project ==="
grep -n "ContentPage" MurphysLaws.xcodeproj/project.pbxproj | head -20
echo ""
echo "=== UIUtilities in project ==="
grep -n "UIUtilities" MurphysLaws.xcodeproj/project.pbxproj
