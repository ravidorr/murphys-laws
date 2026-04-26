# Minor Fix: UI Test Launch Argument Mismatch

## Issue (P2 - Low Priority)

UI tests use `--uitesting` but app checks for `UI-TESTING`.

**Impact:** Test mode setup doesn't run → slower, flakier UI tests

**Priority:** LOW (UI tests work, just not optimally)

---

## The Problem

**In UI Tests:**
```swift
// NavigationUITests.swift
app.launchArguments = ["--uitesting"]
```

**In App:**
```swift
// MurphysLawsApp.swift (probably)
if ProcessInfo.processInfo.arguments.contains("UI-TESTING") {
    setupUITestingEnvironment()
}
```

**Result:** Arguments don't match, so test setup never runs.

---

## Fix Options

### Option A: Change UI Tests to Match App (Easier)

**File:** `ios/MurphysLawsUITests/NavigationUITests.swift`

**Find:**
```swift
app.launchArguments = ["--uitesting"]
```

**Replace with:**
```swift
app.launchArguments = ["UI-TESTING"]
```

---

### Option B: Change App to Match UI Tests

**File:** `ios/MurphysLaws/App/MurphysLawsApp.swift`

**Find:**
```swift
if ProcessInfo.processInfo.arguments.contains("UI-TESTING") {
```

**Replace with:**
```swift
if ProcessInfo.processInfo.arguments.contains("--uitesting") {
```

---

## Recommended: Option A

**Quick fix in NavigationUITests.swift:**

```swift
override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication()
    
    // Enable UI test mode (faster animations)
    app.launchArguments = ["UI-TESTING"]  // Changed from "--uitesting"
    app.launchEnvironment = ["UITEST_DISABLE_ANIMATIONS": "1"]
    
    app.launch()
}
```

---

## Commands

```bash
# Edit the file
open MurphysLawsUITests/NavigationUITests.swift

# Change line ~15:
# From: app.launchArguments = ["--uitesting"]
# To:   app.launchArguments = ["UI-TESTING"]

# Also check CalculatorUITests.swift if it exists
find . -name "*UITests.swift" -type f

# If others have the same issue, fix them too

# Commit
git add .
git commit -m "fix(tests): Align UI test launch argument with app check

- Changed '--uitesting' to 'UI-TESTING' in NavigationUITests
- Matches the argument that app actually checks for
- Enables test-mode setup (faster animations, better reliability)

Priority: P2 (minor improvement for future UI testing)"

git push origin fix/project-structure-cleanup
```

---

## Why It Matters (Eventually)

**Without this fix:**
- UI tests run with full animations
- Tests are slower
- Tests may be flakier (timing issues)

**With this fix:**
- Test mode activates properly
- Animations disabled
- Faster, more reliable tests

**But:** This only matters when you actually run UI tests. Right now they're still mostly disabled.

---

## Priority Assessment

| Issue | Priority | Blocks CI? | Blocks Feature? |
|-------|----------|------------|-----------------|
| CI UITests failure | HIGH  | YES | N/A |
| Deep link bug | MEDIUM  | NO | YES |
| Launch argument | LOW  | NO | NO |

---

## Recommendation

**Current situation:**
- CI failure is **blocking** (HIGH priority)
- Deep link bug **breaks feature** (MEDIUM priority)  
- Launch argument is **nice to have** (LOW priority)

**Suggested order:**
1. **Fix CI** (MurphysLawsApp in UITests) - CRITICAL
2. **Fix deep links** (host parsing) - IMPORTANT
3. **Fix launch arg** (test optimization) - OPTIONAL

**Or combine all 3 in one commit:**

```bash
# 1. Delete duplicate app file (CI fix)
git rm MurphysLawsUITests/MurphysLawsApp.swift

# 2. Fix deep link parser (feature fix)
# Edit DeepLinkHandler.swift - read url.host

# 3. Fix launch argument (test optimization)
# Edit NavigationUITests.swift - change to "UI-TESTING"

# Build
xcodebuild -scheme MurphysLaws build

# Commit all together
git add .
git commit -m "fix: CI build, deep links, and UI test optimization

- Remove duplicate MurphysLawsApp from UITests (fixes CI)
- Fix deep link parser to read url.host (fixes routing)
- Align UI test launch argument with app check (P2 optimization)

Resolves CI failure and functional bugs"

git push origin fix/project-structure-cleanup
```

---

**Your call:** Fix just the CI blocker now, or fix all 3 together?
