# Phase 2.6: Fix Missing SwiftUI Import

## Issue
```
MurphysLaws/Services/AnalyticsService.swift:150:11: error: cannot find type 'View' in scope
```

**Root Cause:** `AnalyticsService.swift` has a `View` extension but only imports `Foundation`, needs `import SwiftUI`.

---

## Fix

### Step 1: Open AnalyticsService.swift

```bash
open MurphysLaws/Services/AnalyticsService.swift
```

### Step 2: Add SwiftUI Import

**At the top of the file, find:**
```swift
import Foundation
```

**Add SwiftUI import:**
```swift
import Foundation
import SwiftUI
```

### Step 3: Save and Build

```bash
# Save the file
# Then in Xcode: Cmd+B to build
```

---

## Expected Result

 The `cannot find type 'View'` error should disappear.

 **New errors may appear** - likely related to root-level duplicate Swift files (Phase 3 will fix those).

---

## Report Back

After adding the import:

1. **Did the `View` error go away?** (Yes/No)
2. **What errors remain?** (Copy a few examples)
3. **Are they about duplicate symbols?** (e.g., "duplicate symbol '_$s13MurphysLaws...'")

If you see duplicate symbol errors, that's perfect - it means we're ready for **Phase 3: Remove Root Duplicates**!

---

## Quick Check

**After build, check error type:**

### No more View errors
→ Great! Move to next errors

### Duplicate symbol errors
Example:
```
duplicate symbol '_$s13MurphysLaws17HomeViewModelC...'
```
→ Perfect! This is Phase 3 territory (root duplicates)

### Other compilation errors
→ Report them and we'll address

**Add the import and report the results!**
