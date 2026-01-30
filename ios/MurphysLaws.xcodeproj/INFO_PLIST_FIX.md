# Fix: Multiple Commands Produce Info.plist Error

## Problem
```
Multiple commands produce '/Users/.../MurphysLaws.app/Info.plist'
duplicate output file '.../Info.plist' on task: ProcessInfoPlistFile
```

## Root Cause
Info.plist is being processed multiple times, usually because it's incorrectly added to "Copy Bundle Resources" build phase.

## Solution Steps

### Step 1: Remove Info.plist from Copy Bundle Resources

1. **Open Xcode**
2. Select your project in the Navigator
3. Select your **MurphysLaws target**
4. Go to **Build Phases** tab
5. Expand **Copy Bundle Resources**
6. Look for **Info.plist** in the list
7. If you find it, **select it and press Delete (-)** button
8. Info.plist should NOT be in this section

### Step 2: Verify Info.plist Location

1. Still in **Build Phases**
2. Check that Info.plist is NOT in:
   - Copy Bundle Resources ❌
   - Compile Sources ❌
   - Any other build phase ❌

3. Info.plist should ONLY be referenced in:
   - **Build Settings** → Search "Info.plist"
   - **Info.plist File** setting should point to: `MurphysLaws/Info.plist`

### Step 3: Check for Duplicate Info.plist Files

1. In Project Navigator, search for "Info.plist"
2. You should see:
   - ✅ `MurphysLaws/Info.plist` (your app's Info.plist)
   - ❌ No duplicate Info.plist files in the target

3. If you see multiple Info.plist files, ensure only ONE is set in Build Settings

### Step 4: Verify Build Settings

1. Select your target
2. Go to **Build Settings**
3. Search for "Info.plist"
4. Verify **Packaging** section:
   - **Info.plist File**: `MurphysLaws/Info.plist` (or correct path)
   - Should only have ONE path listed

### Step 5: Clean Build

After making changes:
```bash
# In Xcode
⌘ + Shift + K  (Clean Build Folder)
⌘ + B          (Build)
```

Or from Terminal:
```bash
cd /Users/ravidor/personal-dev/murphys-laws/ios
rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*
xcodebuild clean -project MurphysLaws.xcodeproj -scheme MurphysLaws
```

## Verification

After fixing, you should:
- ✅ Build succeeds without errors
- ✅ No duplicate Info.plist warnings
- ✅ App runs normally

## Common Mistakes

### ❌ Wrong: Info.plist in Copy Bundle Resources
```
Build Phases
└── Copy Bundle Resources
    ├── Info.plist  ❌ REMOVE THIS
    ├── Config.plist ✅ Keep this
    └── Assets.xcassets ✅ Keep this
```

### ✅ Correct: Info.plist only in Build Settings
```
Build Settings
└── Packaging
    └── Info.plist File: MurphysLaws/Info.plist ✅
```

## If Problem Persists

### Check for Config.plist Issues
Since we just added Config.plist, ensure it's properly configured:

1. **Config.plist should BE in Copy Bundle Resources** ✅
2. **Config.plist should NOT be in Build Settings Info.plist File** ✅

### Check Target Membership
1. Select Info.plist in Project Navigator
2. Open File Inspector (⌘ + ⌥ + 1)
3. Under "Target Membership":
   - Should show your app target (unchecked or not listed is fine)
   - Info.plist doesn't need target membership

### Nuclear Option: Reset Build Settings
If nothing works:
```bash
# Delete derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean project
cd /Users/ravidor/personal-dev/murphys-laws/ios
xcodebuild clean -project MurphysLaws.xcodeproj

# Restart Xcode
```

## Prevention

To avoid this in the future:
- ✅ Never manually add Info.plist to Copy Bundle Resources
- ✅ Let Xcode manage Info.plist through Build Settings
- ✅ Only .plist files that need runtime access (like Config.plist) go in Copy Bundle Resources

## Related: Config.plist Setup

Make sure Config.plist IS in Copy Bundle Resources (unlike Info.plist):
1. Select Config.plist in Navigator
2. File Inspector → Target Membership → Check your target ✅
3. Build Phases → Copy Bundle Resources → Config.plist should be listed ✅

## Quick Fix Script

Run this to check your project structure:
```bash
#!/bin/bash
echo "Checking Info.plist configuration..."

# Find the .xcodeproj
PROJECT="/Users/ravidor/personal-dev/murphys-laws/ios/MurphysLaws.xcodeproj"

if [ -f "$PROJECT/project.pbxproj" ]; then
    # Check if Info.plist is in Copy Bundle Resources
    if grep -q "Info.plist.*PBXBuildFile" "$PROJECT/project.pbxproj"; then
        echo "❌ PROBLEM FOUND: Info.plist is in build files"
        echo "   FIX: Remove Info.plist from Copy Bundle Resources in Xcode"
    else
        echo "✅ Info.plist not in build files (good)"
    fi
    
    # Check for Info.plist path in build settings
    INFO_COUNT=$(grep -c "INFOPLIST_FILE" "$PROJECT/project.pbxproj")
    echo "✅ Found $INFO_COUNT Info.plist File references"
else
    echo "❌ Project file not found"
fi
```

Save as `check-infoplist.sh`, then run:
```bash
chmod +x check-infoplist.sh
./check-infoplist.sh
```

## Expected Result

After fixing:
```
Build succeeded
No warnings
App runs normally
```
