# Phase 2.5: Fix iOS 16 Compatibility

## Issue
```
MurphysLaws/Navigation/DeepLinkHandler.swift:107:14: error: 'onChange(of:initial:_:)' is only available in iOS 17.0 or newer
```

**Root Cause:** Code uses iOS 17+ API but project targets iOS 16.0

---

## Solution Options

### Option A: Update to iOS 17 (Recommended)
If you don't need iOS 16 support, just update the deployment target.

### Option B: Fix Code for iOS 16 Compatibility
Use the older `onChange` API that works on iOS 16.

---

## Option A: Update to iOS 17

### Commands:

```bash
# Edit project.yml
# Change deploymentTarget from "16.0" to "17.0"
```

**Edit `project.yml`:**
```yaml
targets:
  MurphysLaws:
    type: application
    platform: iOS
    deploymentTarget: "17.0"  # Changed from 16.0
    # ... rest of config
```

Then:
```bash
# Regenerate
xcodegen generate

# Build
open MurphysLaws.xcodeproj
# Press Cmd+B
```

---

## Option B: Fix Code for iOS 16

**Find line 107 in `DeepLinkHandler.swift`**

It probably looks like this:
```swift
.onChange(of: deepLinkHandler.activeDeepLink, initial: false) { oldValue, newValue in
    // ...
}
```

**Replace with iOS 16-compatible version:**
```swift
.onChange(of: deepLinkHandler.activeDeepLink) { newValue in
    // Note: In iOS 16, onChange only provides newValue, not oldValue
    guard let deepLink = newValue else { return }

    // ... rest of your code
}
```

**Full context fix:**

Open `MurphysLaws/Navigation/DeepLinkHandler.swift` and find the `DeepLinkModifier` body method around line 107.

**Replace this:**
```swift
.onChange(of: deepLinkHandler.activeDeepLink) { oldValue, newValue in
    guard let deepLink = newValue else { return }
    // ... handling code
}
```

**With this (iOS 16 compatible):**
```swift
.onChange(of: deepLinkHandler.activeDeepLink) { newValue in
    guard let deepLink = newValue else { return }

    switch deepLink {
    case .law(let id):
        selectedLawID = id

    case .category(let id):
        selectedCategoryID = id
        tabCoordinator.navigate(to: .categories)

    case .calculator:
        tabCoordinator.navigate(to: .calculator)

    case .submit:
        tabCoordinator.showingSubmit = true

    case .home:
        tabCoordinator.navigate(to: .home)
    }

    deepLinkHandler.clearActiveDeepLink()
}
```

---

## Recommendation

**Use Option A (iOS 17)** because:
- Simpler fix (just change deployment target)
- Access to modern SwiftUI features
- Matches what documentation said (iOS 17/Xcode 15/Swift 5.9)
- iOS 17 has been out since Sept 2023 (wide adoption)

**Use Option B (iOS 16)** if:
- You specifically need iOS 16 device support
- You're targeting older devices

---

## Execute Your Choice

### If choosing Option A (iOS 17):

```bash
# Edit project.yml, change deploymentTarget to "17.0"
# Then:
xcodegen generate
open MurphysLaws.xcodeproj
# Build (Cmd+B)
```

### If choosing Option B (iOS 16 code fix):

```bash
# Edit DeepLinkHandler.swift around line 107
# Change onChange signature as shown above
# Then build in Xcode (Cmd+B)
```

---

## Report Back

After you choose and execute an option, tell me:

1. **Which option did you choose?** (A or B)
2. **Did the build error go away?** (Yes/No)
3. **What errors remain (if any)?**

Then we'll proceed to **Phase 3: Remove Root Duplicates**!

---

## Quick Decision Helper

**Check current iOS version requirement:**
```bash
grep -A2 "deploymentTarget:" project.yml
```

Shows: `iOS: "16.0"`

**Decide:**
- Want modern APIs? → Change to `"17.0"` (Option A)
- Need iOS 16 support? → Fix code (Option B)

**My recommendation: Option A - update to iOS 17**
