# Bug Fix: Deep Link Parsing

## Issue

Deep link parser doesn't match the URL builder format.

**Builder creates:** `murphyslaws://law/123` (host-based)  
**Parser expects:** `murphyslaws:///law/123` (path-based)

**Result:** Valid deep links are dropped or misrouted.

---

## The Problem

In `DeepLinkHandler.swift`:

```swift
// Builder creates URLs like this:
static func lawURL(id: Int) -> URL {
    URL(string: "\(Constants.DeepLink.scheme)://\(Constants.DeepLink.lawPath)/\(id)")!
    // Result: murphyslaws://law/123
    //         where "law" is the HOST, not path
}

// But parser reads like this:
init?(url: URL) {
    let components = url.pathComponents.filter { $0 != "/" }
    guard let path = components.first else { ... }
    // Reads pathComponents, expecting path-based URL
    // In murphyslaws://law/123, host="law", pathComponents=["123"]
    // So components.first = "123", not "law"!
}
```

---

## Fix Options

### Option A: Use Host (Recommended)

**Change the parser to read from `url.host` first:**

```swift
init?(url: URL) {
    guard url.scheme == Constants.DeepLink.scheme else {
        return nil
    }
    
    // Read host first (for host-based URLs like murphyslaws://law/123)
    let path = url.host ?? url.pathComponents.filter { $0 != "/" }.first
    let components = url.pathComponents.filter { $0 != "/" }
    
    guard let path = path else {
        self = .home
        return
    }
    
    switch path {
    case Constants.DeepLink.lawPath:  // "law"
        if components.count > 0, let id = Int(components[0]) {
            self = .law(id: id)
        } else {
            return nil
        }
        
    case Constants.DeepLink.categoryPath:  // "category"
        if components.count > 0, let id = Int(components[0]) {
            self = .category(id: id)
        } else {
            return nil
        }
        
    case Constants.DeepLink.calculatorPath:  // "calculator"
        self = .calculator
        
    case "submit":
        self = .submit
        
    default:
        return nil
    }
}
```

---

### Option B: Change URL Builder to Path-Based

**Change the builder to use path-based URLs:**

```swift
// In DeepLinkBuilder
static func lawURL(id: Int) -> URL {
    URL(string: "\(Constants.DeepLink.scheme)://host/\(Constants.DeepLink.lawPath)/\(id)")!
    // Result: murphyslaws://host/law/123
    //         where path = ["law", "123"]
}

static func categoryURL(id: Int) -> URL {
    URL(string: "\(Constants.DeepLink.scheme)://host/\(Constants.DeepLink.categoryPath)/\(id)")!
}

static func calculatorURL() -> URL {
    URL(string: "\(Constants.DeepLink.scheme)://host/\(Constants.DeepLink.calculatorPath)")!
}

static func submitURL() -> URL {
    URL(string: "\(Constants.DeepLink.scheme)://host/submit")!
}
```

**Then parser works as-is.**

---

## Recommended Fix (Option A)

**File:** `ios/MurphysLaws/Navigation/DeepLinkHandler.swift`

**Find the `init?(url: URL)` method around line 15-50 and replace with:**

```swift
init?(url: URL) {
    guard url.scheme == Constants.DeepLink.scheme else {
        return nil
    }
    
    // For host-based URLs like murphyslaws://law/123
    // url.host = "law", pathComponents = ["123"]
    let routePath = url.host
    let components = url.pathComponents.filter { $0 != "/" }
    
    guard let routePath = routePath else {
        self = .home
        return
    }
    
    switch routePath {
    case Constants.DeepLink.lawPath:  // "law"
        // Path should have ID: murphyslaws://law/123
        if components.count > 0, let id = Int(components[0]) {
            self = .law(id: id)
        } else {
            return nil
        }
        
    case Constants.DeepLink.categoryPath:  // "category"
        // Path should have ID: murphyslaws://category/5
        if components.count > 0, let id = Int(components[0]) {
            self = .category(id: id)
        } else {
            return nil
        }
        
    case Constants.DeepLink.calculatorPath:  // "calculator"
        self = .calculator
        
    case "submit":
        self = .submit
        
    default:
        return nil
    }
}
```

---

## Testing

**After applying the fix, test with these URLs:**

```swift
// Test cases
let lawURL = URL(string: "murphyslaws://law/123")!
let deepLink = DeepLink(url: lawURL)
// Should create: .law(id: 123)

let categoryURL = URL(string: "murphyslaws://category/5")!
let deepLink2 = DeepLink(url: categoryURL)
// Should create: .category(id: 5)

let calcURL = URL(string: "murphyslaws://calculator")!
let deepLink3 = DeepLink(url: calcURL)
// Should create: .calculator
```

---

## Commands

```bash
# Edit the file
open MurphysLaws/Navigation/DeepLinkHandler.swift

# Apply the fix from Option A above
# Save the file

# Build to verify
xcodebuild -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15' build

# Run tests if you have deep link tests
xcodebuild test -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15'

# Commit
git add MurphysLaws/Navigation/DeepLinkHandler.swift
git commit -m "fix: Deep link parser now reads host for proper routing

- Changed parser to read url.host instead of just pathComponents
- Fixes bug where murphyslaws://law/123 was misrouted
- Parser now matches URL builder format (host-based URLs)
- Tested with law, category, calculator, submit deep links

Related: Deep link parsing bug caught by code review"

git push origin fix/project-structure-cleanup
```

---

## Why This Matters

Without this fix:
- `murphyslaws://law/123` → Invalid/dropped
- `murphyslaws://category/5` → Invalid/dropped
- Deep linking doesn't work at all

With this fix:
- `murphyslaws://law/123` → Opens law detail
- `murphyslaws://category/5` → Opens category
- Deep linking works properly

---

**This is a good catch! Apply Option A fix and push it.**

It won't affect CI (deep links aren't tested there), but it's important for the feature to actually work when you need it.
