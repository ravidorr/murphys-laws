# Test Target Verification Checklist

## Issue Summary
The error "Unable to find module dependency: 'XCTest'" occurs when test files are placed in the main app target instead of the test target.

## Current Status

### ✅ Working Test Files
These files are correctly configured in the test target:
- `ConfigurationTests.swift` (in test target)
- `CalculatorViewModelTests.swift`
- `LawListViewModelTests.swift`
- `HomeViewModelTests.swift`
- `MockLawRepository.swift`
- `VotingUITests.swift` (likely in UI test target)

### ❌ Problem File
- `ConfigurationTests.swift` at path `MurphysLaws/Repositories/ConfigurationTests.swift`
  - This is a **duplicate** file in the main app target
  - Must be removed or have its target membership changed

## Verification Steps

### Step 1: Check Target Membership
1. In Xcode, select `ConfigurationTests.swift` in the Project Navigator
2. Open the File Inspector (View → Inspectors → Show File Inspector or ⌥⌘1)
3. Look at the "Target Membership" section
4. **Expected Configuration:**
   - ❌ "MurphysLaws" (main app target) - **Should be UNCHECKED**
   - ✅ "MurphysLawsTests" (test target) - **Should be CHECKED**

### Step 2: Verify Test Target Build Settings
1. Select your project in the Project Navigator
2. Select the "MurphysLawsTests" target
3. Go to "Build Phases" → "Compile Sources"
4. Verify that all test files are listed here:
   - ConfigurationTests.swift
   - CalculatorViewModelTests.swift
   - LawListViewModelTests.swift
   - HomeViewModelTests.swift
   - MockLawRepository.swift

### Step 3: Check Test Host
1. With "MurphysLawsTests" target selected
2. Go to "Build Settings"
3. Search for "Test Host"
4. Verify it points to: `$(BUILT_PRODUCTS_DIR)/MurphysLaws.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/MurphysLaws`

### Step 4: Verify Framework Search Paths
1. With "MurphysLawsTests" target selected
2. Go to "Build Settings"
3. Search for "Framework Search Paths"
4. Verify it includes: `$(PLATFORM_DIR)/Developer/Library/Frameworks`

### Step 5: Check Dependencies
1. With "MurphysLawsTests" target selected
2. Go to "Build Phases" → "Dependencies"
3. Verify "MurphysLaws" (main app) is listed as a dependency

### Step 6: Verify Bundle Loader
1. With "MurphysLawsTests" target selected
2. Go to "Build Settings"
3. Search for "Bundle Loader"
4. Verify it's set to: `$(TEST_HOST)`

## Fix Instructions

### Option A: Remove from Main Target (Recommended)
1. Select `ConfigurationTests.swift` at `MurphysLaws/Repositories/ConfigurationTests.swift`
2. Open File Inspector (⌥⌘1)
3. Under "Target Membership":
   - **Uncheck** "MurphysLaws"
   - **Keep checked** "MurphysLawsTests"
4. Clean Build Folder (⇧⌘K)
5. Build (⌘B)

### Option B: Delete the Duplicate
If the file in `MurphysLaws/Repositories/` is truly a duplicate:
1. Select the file
2. Press Delete
3. Choose "Move to Trash"
4. The correct version in the test target will remain

### Option C: Move the File
If the test file is in the wrong location:
1. In Project Navigator, drag `ConfigurationTests.swift` from `MurphysLaws/Repositories/`
2. Drop it into the test target group (usually named `MurphysLawsTests`)
3. In the dialog, ensure only "MurphysLawsTests" is checked

## Test Target Best Practices

### File Organization
```
MurphysLaws/
  ├── Models/
  ├── Views/
  ├── ViewModels/
  ├── Repositories/
  └── ...

MurphysLawsTests/                    ← Test target folder
  ├── ConfigurationTests.swift
  ├── CalculatorViewModelTests.swift
  ├── LawListViewModelTests.swift
  ├── HomeViewModelTests.swift
  └── Mocks/
      └── MockLawRepository.swift

MurphysLawsUITests/                  ← UI test target folder
  └── VotingUITests.swift
```

### Naming Conventions
- Test files: `[ClassName]Tests.swift`
- Mock files: `Mock[ClassName].swift`
- Test targets: `[AppName]Tests` and `[AppName]UITests`

### Import Statements
All test files should have:
```swift
import XCTest
@testable import MurphysLaws
```

### Test Class Declaration
```swift
// For MainActor types
@MainActor
final class MyViewModelTests: XCTestCase {
    // tests...
}

// For standard types
final class MyModelTests: XCTestCase {
    // tests...
}
```

## Common Issues and Solutions

### Issue: XCTest not found
**Cause:** Test file is in main app target
**Solution:** Move to test target or change target membership

### Issue: Cannot import main module with @testable
**Cause:** Test target doesn't depend on main app target
**Solution:** Add main app as dependency in Build Phases

### Issue: Tests don't run
**Cause:** Test target not properly configured
**Solution:** Verify Test Host and Bundle Loader settings

### Issue: "Circular dependency" error
**Cause:** Main app target depends on test target
**Solution:** Remove test target from main app's dependencies

## Verification Commands

After fixing, verify with:
1. Clean Build Folder: ⇧⌘K
2. Build: ⌘B (should succeed)
3. Test: ⌘U (should run all tests)

## Expected Test Results

When properly configured, you should see:
- ✅ ConfigurationTests: ~13 tests passing
- ✅ CalculatorViewModelTests: ~10 tests passing
- ✅ LawListViewModelTests: ~6 tests passing
- ✅ HomeViewModelTests: ~6 tests passing

Total: ~35+ tests passing

## Additional Notes

### Test Target Info.plist
Modern Xcode projects don't require a separate Info.plist for test targets. If you have one, ensure it's minimal.

### Swift Testing Framework
Your project uses XCTest (traditional framework). If you want to modernize, consider migrating to Swift Testing:
```swift
import Testing
@testable import MurphysLaws

@Suite("Configuration Tests")
struct ConfigurationTests {
    @Test("API Base URL is valid")
    func apiBaseURL() {
        #expect(Constants.API.baseURL == "https://murphys-laws.com/api/v1")
    }
}
```

### Continuous Integration
Ensure your CI/CD pipeline runs tests:
```bash
xcodebuild test -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Next Steps

1. ✅ Fix the duplicate `ConfigurationTests.swift` file
2. ✅ Verify all tests pass
3. ✅ Consider adding more test coverage
4. ✅ Set up code coverage reporting
5. ✅ Add tests to CI/CD pipeline

## Support

If issues persist:
1. Check Xcode version (ensure using Xcode 15+)
2. Clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. Reset package dependencies if using SPM
4. Restart Xcode
