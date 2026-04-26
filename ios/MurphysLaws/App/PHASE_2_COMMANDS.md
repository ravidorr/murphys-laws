# Phase 2: Move Files from UITests to App

## Current Status
 Phase 1 complete - No more duplicate resource errors
 Swift compilation errors - Files in wrong target

## Current Errors
```
ContentView.swift:12:48: error: cannot find 'DeepLinkHandler' in scope
ContentView.swift:78:10: error: value of type 'some View' has no member 'handleDeepLinks'
```

**Root Cause:** `DeepLinkHandler.swift` is in `MurphysLawsUITests/` but needs to be in app target.

Similarly:
- `AnalyticsService.swift` → in UITests, needs to be in app
- `ImageCache.swift` → in UITests, needs to be in app
- `CrashReportingService.swift` → inside AnalyticsService, needs verification

---

## Commands to Execute

### Step 1: Create Necessary Directories

```bash
# From ios/ directory, create directories if they don't exist
mkdir -p MurphysLaws/Services
mkdir -p MurphysLaws/Navigation
mkdir -p MurphysLaws/Utilities

# Verify directories exist
ls -la MurphysLaws/ | grep -E "Services|Navigation|Utilities"
```

---

### Step 2: Move Files from UITests to App

```bash
# Move service files
git mv MurphysLawsUITests/AnalyticsService.swift MurphysLaws/Services/
git mv MurphysLawsUITests/ImageCache.swift MurphysLaws/Services/

# Move navigation files
git mv MurphysLawsUITests/DeepLinkHandler.swift MurphysLaws/Navigation/

# Check for any other misplaced files
echo "=== Checking for other app files in UITests ==="
ls -la MurphysLawsUITests/*.swift | grep -v "UITests"
```

**Expected output:**
- `git mv` commands should succeed
- Files should be staged for move in git

---

### Step 3: Verify the Moves

```bash
# Check git status to see the moves
git status

# Verify files are in new locations
ls -la MurphysLaws/Services/
ls -la MurphysLaws/Navigation/
```

**Expected to see:**
```
renamed: MurphysLawsUITests/AnalyticsService.swift -> MurphysLaws/Services/AnalyticsService.swift
renamed: MurphysLawsUITests/ImageCache.swift -> MurphysLaws/Services/ImageCache.swift
renamed: MurphysLawsUITests/DeepLinkHandler.swift -> MurphysLaws/Navigation/DeepLinkHandler.swift
```

---

### Step 4: Regenerate Xcode Project

```bash
# Regenerate to pick up new file locations
xcodegen generate
```

**Expected:** XcodeGen should detect files in new locations and add them to app target.

---

### Step 5: Verify in Xcode

```bash
# Open project
open MurphysLaws.xcodeproj
```

**In Xcode:**

1. **Find `DeepLinkHandler.swift` in Project Navigator**
   - Should now be under `Navigation/` group

2. **Select it and check File Inspector (right sidebar)**
   - Target Membership section should show:
     - `MurphysLaws` (checked)
     - `MurphysLawsUITests` (unchecked)

3. **Repeat for the other moved files:**
   - `AnalyticsService.swift` → in `MurphysLaws` target
   - `ImageCache.swift` → in `MurphysLaws` target

---

### Step 6: Build and Check Errors

**In Xcode:**
- Clean Build Folder: `Product → Clean Build Folder` (Cmd+Shift+K)
- Build: `Product → Build` (Cmd+B)

---

## Expected Results

### Best Case: DeepLinkHandler errors are GONE
The two ContentView errors should disappear:
```
 ContentView.swift now finds DeepLinkHandler
 .handleDeepLinks() extension now works
```

**New errors might appear** related to other missing files (that's Phase 3).

### Some errors persist
If you still see `cannot find 'DeepLinkHandler'`:
1. Verify file is in app target (File Inspector)
2. Check import statements are correct
3. Verify no typos in file/class names

### Build gets worse
If you see MORE errors after the move:
- Check that files weren't corrupted during move
- Verify import statements in moved files
- Check for circular dependencies

---

## Common Issues & Solutions

### Issue: File not in app target after move
**Solution:**
```bash
# Regenerate again
xcodegen generate

# Or manually in Xcode:
# Select file → File Inspector → Check "MurphysLaws" target
```

### Issue: Import errors in moved files
**Check these files for correct imports:**
```swift
// AnalyticsService.swift should import:
import Foundation

// DeepLinkHandler.swift should import:
import Foundation
import SwiftUI

// ImageCache.swift should import:
import Foundation
import UIKit
```

### Issue: "No such file or directory"
**Verify paths:**
```bash
# Make sure files actually moved
find MurphysLaws -name "DeepLinkHandler.swift"
find MurphysLaws -name "AnalyticsService.swift"
find MurphysLaws -name "ImageCache.swift"
```

---

## Report Back

After completing Steps 1-6, tell me:

1. **Did `git mv` commands succeed?** (Yes/No)
2. **What does `git status` show?** (list the renamed files)
3. **Are files in correct target in Xcode?** (Check File Inspector)
4. **What errors remain after build?** (Copy error messages)
5. **Did DeepLinkHandler errors go away?** (Yes/No)

---

## Next Steps

### If Phase 2 succeeds:
→ **Phase 3**: Remove root-level duplicate Swift files

### If Phase 2 has issues:
→ Debug the specific errors and adjust

---

## Quick Verification Commands

```bash
# See all files in Services
ls -la MurphysLaws/Services/

# See all files in Navigation
ls -la MurphysLaws/Navigation/

# Check git status
git status --short

# See what's left in UITests
ls -la MurphysLawsUITests/*.swift
```

**Execute Steps 1-6 and report the results!**
