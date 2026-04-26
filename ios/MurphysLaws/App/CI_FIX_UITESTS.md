# URGENT FIX: CI Build Failure

## Issue
CI build failing because `MurphysLawsApp.swift` in UITests target references app classes.

```
error: Cannot find 'NetworkMonitor' in scope
error: Cannot find 'VotingService' in scope
```

**Location:** `ios/MurphysLawsUITests/MurphysLawsApp.swift`

**Root Cause:** App entry point file (`MurphysLawsApp.swift`) is in the wrong target (UITests instead of main app).

---

## Fix: Remove File from UITests

### Option 1: Check if File Should Exist (Recommended)

**First, verify if this is a duplicate:**

```bash
# Find all MurphysLawsApp.swift files
find . -name "MurphysLawsApp.swift" -type f

# Expected: Should be ONLY in MurphysLaws/App/
# Not in: MurphysLawsUITests/
```

**If you see:**
```
./MurphysLaws/App/MurphysLawsApp.swift           CORRECT
./MurphysLawsUITests/MurphysLawsApp.swift        WRONG - DELETE THIS
```

**Then:**
```bash
# Delete the UITests version
git rm MurphysLawsUITests/MurphysLawsApp.swift

# Regenerate project
xcodegen generate

# Test build
xcodebuild -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15' build

# Commit
git add .
git commit -m "fix(ci): Remove MurphysLawsApp.swift from UITests target

- Deleted duplicate MurphysLawsApp.swift from MurphysLawsUITests/
- App entry point should only exist in main app target
- Fixes CI build error: Cannot find NetworkMonitor/VotingService

Related to: #[PR-number]"

git push origin fix/project-structure-cleanup
```

---

### Option 2: If File Doesn't Exist in UITests

**If you only see it in the main app:**
```
./MurphysLaws/App/MurphysLawsApp.swift           Only one
```

**Then the issue is project.yml configuration.**

**Check and fix project.yml:**

```yaml
targets:
  MurphysLawsUITests:
    type: bundle.ui-testing
    platform: iOS
    sources:
      - MurphysLawsUITests
      # Make sure this DOESN'T include MurphysLaws/App/
```

**Ensure UITests target only includes UITests directory:**

```yaml
targets:
  MurphysLawsUITests:
    type: bundle.ui-testing
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: MurphysLawsUITests
        excludes:
          - "*.md"
    dependencies:
      - target: MurphysLaws  # Only reference app as dependency, not source
```

Then regenerate:
```bash
xcodegen generate
```

---

### Option 3: Quick Emergency Fix (If Options 1-2 Don't Work)

**If CI is blocking and you need a quick fix:**

Add this to the top of `MurphysLawsUITests/MurphysLawsApp.swift` (if it exists there):

```swift
#if !DEBUG
@testable import MurphysLaws

@StateObject private var networkMonitor = NetworkMonitor.shared
@StateObject private var votingService = VotingService.shared
#endif
```

**But this is a band-aid - still remove the file from UITests properly!**

---

## Recommended Action Plan

### Immediate (Fix CI):

```bash
# 1. Find the problem file
find . -name "MurphysLawsApp.swift"

# 2. If in UITests, delete it
git rm MurphysLawsUITests/MurphysLawsApp.swift

# 3. Regenerate
xcodegen generate

# 4. Build locally to verify
xcodebuild -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15' build

# 5. Commit and push
git add .
git commit -m "fix(ci): Remove MurphysLawsApp from UITests target"
git push origin fix/project-structure-cleanup
```

This should make the CI green!

---

## Why This Happened

During our cleanup, we moved files from UITests to app target, but **didn't catch this one** because:
- It wasn't causing local build issues (only in CI)
- UITests weren't running locally
- It references classes that only fail when UITests actually run

**This is exactly why CI is valuable!**

---

## After Fix

Once you push the fix:
1. CI should go green
2. PR will be ready to merge
3. Celebrate (again)!

---

**Execute the commands above and push the fix!** The CI will re-run and should pass.
