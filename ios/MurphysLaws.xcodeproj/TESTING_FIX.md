# Fix: Unable to Find Module Dependency 'Testing'

## Problem
```
error: Unable to find module dependency: 'Testing'
import Testing
       ^
```

## Root Cause
`ConfigurationTests.swift` is in the **main app target** but uses the **Swift Testing framework**, which is only available in **test targets**.

---

## Solution 1: Move to Test Target (Recommended)

### Step 1: Locate the File
In Xcode Project Navigator:
```
MurphysLaws/
  └── Repositories/
      └── ConfigurationTests.swift  ← This file
```

### Step 2: Fix Target Membership

**Option A: Via File Inspector**
1. Click on `ConfigurationTests.swift` in Project Navigator
2. Open File Inspector (right sidebar, or ⌘ + Option + 1)
3. Find **"Target Membership"** section
4. **Uncheck** ✗ `MurphysLaws` (main app target)
5. **Check** ✓ `MurphysLawsTests` (test target)

**Option B: Drag and Drop**
1. Find your test folder (probably `MurphysLawsTests/`)
2. Drag `ConfigurationTests.swift` into that folder
3. When prompted, choose "Move"

### Step 3: Verify
After moving:
```
MurphysLawsTests/
  ├── MurphysLawsTests.swift
  └── ConfigurationTests.swift  ← Should be here now
```

### Step 4: Clean and Build
```
⌘ + Shift + K  (Clean)
⌘ + U          (Run Tests)
```

---

## Solution 2: Use XCTest Instead

If you prefer to keep using the traditional XCTest framework:

### Step 1: Replace the File Content

1. Open `ConfigurationTests.swift` in Xcode
2. Replace ALL content with this:

```swift
//
//  ConfigurationTests.swift
//  MurphysLawsTests
//
//  Tests for configuration loading
//

import XCTest
@testable import MurphysLaws

class ConfigurationTests: XCTestCase {
    
    func testAPIBaseURLLoaded() {
        let baseURL = Constants.API.baseURL
        
        XCTAssertFalse(baseURL.isEmpty, "API base URL should not be empty")
        XCTAssertTrue(baseURL.contains("http"), "API base URL should be a valid URL")
        
        print("API Base URL: \(baseURL)")
    }
    
    func testEnvironmentConfigurationLoaded() {
        let environment = Constants.Environment.current
        
        XCTAssertFalse(environment.isEmpty, "Environment should not be empty")
        XCTAssertTrue(
            environment == "development" || 
            environment == "staging" || 
            environment == "production",
            "Environment should be a valid value"
        )
        
        print("Environment: \(environment)")
        print("   - Is Development: \(Constants.Environment.isDevelopment)")
        print("   - Is Production: \(Constants.Environment.isProduction)")
        print("   - Analytics Enabled: \(Constants.Environment.enableAnalytics)")
        print("   - Crash Reporting Enabled: \(Constants.Environment.enableCrashReporting)")
        print("   - Log Level: \(Constants.Environment.logLevel)")
    }
    
    func testAPIKeyHandling() {
        let apiKey = Constants.API.apiKey
        
        if let key = apiKey {
            XCTAssertFalse(key.isEmpty, "API key should not be empty if present")
            XCTAssertNotEqual(key, "YOUR_API_KEY_HERE", "API key should be replaced from template")
            print("API Key configured (length: \(key.count))")
        } else {
            print("No API key configured (optional)")
        }
    }
    
    func testConfigurationValuesAccessible() {
        // Test that we can access all configuration values without crashing
        _ = Constants.API.baseURL
        _ = Constants.API.apiKey
        _ = Constants.Environment.current
        _ = Constants.Environment.isDevelopment
        _ = Constants.Environment.isProduction
        _ = Constants.Environment.enableAnalytics
        _ = Constants.Environment.enableCrashReporting
        _ = Constants.Environment.logLevel
        
        print("All configuration values are accessible")
    }
    
    func testLogLevelIsValid() {
        let logLevel = Constants.Environment.logLevel
        let validLevels = ["debug", "info", "warning", "error"]
        
        XCTAssertTrue(
            validLevels.contains(logLevel.lowercased()),
            "Log level should be one of: debug, info, warning, error"
        )
        
        print("Log Level: \(logLevel)")
    }
    
    func testAPIEndpointsConfigured() {
        // Verify all API endpoints are properly set
        XCTAssertEqual(Constants.API.laws, "/laws")
        XCTAssertEqual(Constants.API.lawOfDay, "/law-of-day")
        XCTAssertEqual(Constants.API.categories, "/categories")
        XCTAssertEqual(Constants.API.attributions, "/attributions")
        
        print("All API endpoints configured correctly")
    }
}
```

### Step 2: Fix Target Membership
Still need to move it to test target (see Solution 1, Step 2)

### Step 3: Build and Test
```
⌘ + Shift + K  (Clean)
⌘ + U          (Run Tests)
```

---

## Solution 3: Delete the Test File (Quick Fix)

If you don't need the tests right now:

1. **Right-click** `ConfigurationTests.swift` in Project Navigator
2. **Delete** → Choose "Move to Trash"
3. **Clean and Build** (⌘ + Shift + K, then ⌘ + B)

You can add tests back later when needed.

---

## Understanding the Error

### Swift Testing Framework
- **New** testing framework introduced in Swift 5.9+
- Uses `@Test` macro instead of `func test...`
- Only available in **test targets**, not main app targets
- Import: `import Testing`

### XCTest Framework
- **Traditional** testing framework
- Uses `func test...` methods
- Available in test targets
- Import: `import XCTest`

### The Problem
```swift
// This file was created in: MurphysLaws (main app)
import Testing  // Only works in test targets!
```

### The Fix
```swift
// Move to: MurphysLawsTests (test target)
import Testing  // Now works!

// OR use XCTest instead:
import XCTest  // Works in test targets
```

---

## Quick Checklist

After applying fix:

- [ ] ConfigurationTests.swift is in test target (not main app)
- [ ] File Inspector shows correct target membership
- [ ] Project builds without "Testing" import error
- [ ] Tests run successfully (⌘ + U)
- [ ] Configuration values load correctly

---

## Recommended Approach

**Best practice:**

1. Keep test files in dedicated test folders
2. Use XCTest for broad compatibility
3. Use Swift Testing for new projects (iOS 16+, macOS 13+)

**For your project:**
- Move `ConfigurationTests.swift` to `MurphysLawsTests/` folder
- Keep using `import Testing` if on iOS 16+
- Or switch to `XCTest` for compatibility

---

## Verify Your Test Target

Make sure you have a test target:

1. In Project Navigator, click the blue project icon
2. Look under **TARGETS**:
   ```
   TARGETS
     ├── MurphysLaws          (main app)
     ├── MurphysLawsTests     ← Should have this
     └── MurphysLawsUITests   ← Maybe this too
   ```

3. If you don't see `MurphysLawsTests`:
   - File → New → Target
   - Choose "Unit Testing Bundle"
   - Name it "MurphysLawsTests"

---

## After Fixing

Once tests are in the right place:

```bash
# Run tests from command line
cd /Users/ravidor/personal-dev/murphys-laws/ios
xcodebuild test -project MurphysLaws.xcodeproj -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15'
```

Or in Xcode:
```
⌘ + U  (Run all tests)
```

Expected output:
```
testAPIBaseURLLoaded passed
testEnvironmentConfigurationLoaded passed
testAPIKeyHandling passed
testConfigurationValuesAccessible passed
testLogLevelIsValid passed
testAPIEndpointsConfigured passed
```

---

## Summary

**The Fix:** Move `ConfigurationTests.swift` from main app target to test target.

**How:** File Inspector → Target Membership → Uncheck app, Check test target.

**Result:** Tests work correctly!
