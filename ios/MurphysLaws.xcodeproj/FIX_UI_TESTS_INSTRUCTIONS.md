# Fix UI Tests Linker Errors - Step by Step Guide

## The Problem

Your UI Tests target is trying to link against app code (`SharedContentLoader`, `ContentPage`) which causes linker errors. UI Tests should interact with the app through UI only, not by importing code.

## Quick Fix (Recommended - 1 minute)

Since your UI tests are already disabled with `XCTSkip`, the fastest solution is to disable the target:

### Steps:

1. **Open Xcode**
2. **Click on the scheme dropdown** (next to the Run/Stop buttons) → **Edit Scheme...**
3. **Select "Test"** in the left sidebar
4. **Uncheck `MurphysLawsUITests`** in the test list
5. **Click "Close"**
6. **Build** (⌘B)

**Done!** Your project should now build successfully.

---

## Proper Fix (If you want UI tests to work later - 5 minutes)

### Step 1: Remove Files from UI Tests Target

1. **Select `SharedContentLoader.swift`** in Project Navigator
2. **Open File Inspector** (View → Inspectors → File, or press ⌥⌘1)
3. In the **Target Membership** section:
   - Keep `MurphysLaws` checked
   - **Uncheck `MurphysLawsUITests`** if it's checked
4. **Repeat for `ContentPage.swift`**

### Step 2: Remove UIUtilities Framework

1. **Select your project** (top item in Project Navigator)
2. **Select the `MurphysLawsUITests` target**
3. **Go to "Build Phases" tab**
4. **Expand "Link Binary With Libraries"**
5. **Look for `UIUtilities.framework`**
   - If you see it, select it and click the **"−"** button
6. **Also check the "General" tab** → "Frameworks, Libraries, and Embedded Content"
   - Remove `UIUtilities` if present there too

### Step 3: Clean and Rebuild

1. **Clean Build Folder**: Product → Clean Build Folder (⇧⌘K)
2. **Close Xcode**
3. **Delete Derived Data**:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*
   ```
4. **Reopen Xcode**
5. **Build** (⌘B)

---

## Verification

After the fix, verify:

- [ ] Project builds without linker errors
- [ ] `SharedContentLoader.swift` is only in `MurphysLaws` target
- [ ] `ContentPage.swift` is only in `MurphysLaws` target
- [ ] No `UIUtilities` references in UI Tests target
- [ ] UI tests can be re-enabled later when needed

---

## Understanding Target Membership

### Main App Target (`MurphysLaws`)
Should contain:
- All app source code
- Views, ViewModels, Models
- Repositories, Services
- Assets, Resources

### Unit Tests Target (`MurphysLawsTests`)
Should contain:
- Test files ending in `Tests.swift`
- Mock classes for testing
- Can use `@testable import MurphysLaws` to access app code

### UI Tests Target (`MurphysLawsUITests`)
Should contain:
- Test files ending in `UITests.swift`
- **NO app source code**
- **NO @testable import**
- Only interacts with app through UI (XCUIApplication)

---

## Why This Happened

This typically occurs when:
1. Files were dragged into the project with wrong target selection
2. "Add to targets" dialog had UI Tests checked by mistake
3. Xcode project file got corrupted during merge/update

---

## If Problems Persist

Try these additional steps:

### 1. Check for Hidden References
```bash
cd /Users/ravidor/personal-dev/murphys-laws/ios
grep -r "SharedContentLoader" MurphysLaws.xcodeproj/project.pbxproj
```

If you see multiple references with the UI Tests target ID, the project file needs manual editing.

### 2. Verify Build Settings

**MurphysLawsUITests** target should have:
- **Test Host**: `$(BUILT_PRODUCTS_DIR)/MurphysLaws.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/MurphysLaws`
- **Bundle Loader**: Empty or `$(TEST_HOST)`
- **Defines Module**: NO

### 3. Nuclear Option - Recreate UI Tests Target

If nothing works:
1. Delete the `MurphysLawsUITests` target entirely
2. Create a new UI Testing target: File → New → Target → UI Testing Bundle
3. Move your test files to the new target

---

## Need More Help?

Run this diagnostic command:
```bash
cd /Users/ravidor/personal-dev/murphys-laws/ios
xcodebuild -project MurphysLaws.xcodeproj -scheme MurphysLaws -showBuildSettings | grep -E "TEST_HOST|BUNDLE_LOADER|PRODUCT_NAME"
```

Share the output and I can provide more specific guidance.
