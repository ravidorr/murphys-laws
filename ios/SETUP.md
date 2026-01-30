# iOS App Setup Guide

Step-by-step guide to set up the Murphy's Laws iOS app in Xcode.

## Prerequisites

- macOS 12.0 or later
- Xcode 14.0 or later
- Apple Developer account (for device testing/deployment)

## Quick Start

### 1. Create New Xcode Project

Open Xcode and create a new project:

```
File > New > Project
```

**Template**: iOS > App
**Product Name**: MurphysLaws
**Team**: Your development team
**Organization Identifier**: com.murphyslaws (or your preference)
**Interface**: SwiftUI
**Language**: Swift
**Storage**: None

Save location: `murphys-laws/ios/` directory

### 2. Project Structure Setup

Your Xcode project should match this file structure:

```
MurphysLaws/
├── App/
│ ├── MurphysLawsApp.swift      # App entry point
│ └── ContentView.swift         # Main navigation
├── Models/
│ ├── Law.swift
│ ├── Category.swift
│ ├── Attribution.swift
│ └── Vote.swift
├── Views/
│ ├── Home/
│ │ ├── HomeView.swift
│ │ └── LawOfDayCard.swift
│ ├── Browse/
│ │ ├── BrowseView.swift
│ │ ├── LawDetailView.swift
│ │ └── FilterView.swift
│ ├── Categories/
│ │ └── CategoriesView.swift
│ ├── Calculator/
│ │ └── CalculatorView.swift
│ ├── Submit/
│ │ └── SubmitLawView.swift
│ ├── More/
│ │ └── MoreView.swift
│ └── Shared/
│ └── LawCard.swift
├── ViewModels/
│ ├── LawListViewModel.swift
│ ├── LawDetailViewModel.swift
│ ├── HomeViewModel.swift
│ └── CategoryListViewModel.swift
├── Services/
│ ├── APIService.swift
│ └── VotingService.swift
├── Repositories/
│ ├── LawRepository.swift
│ └── CategoryRepository.swift
└── Utilities/
 ├── Constants.swift
 └── DeviceID.swift
```

### 3. Import Files into Xcode

**Option A: Drag and Drop (Recommended)**

1. In Xcode's Project Navigator, select the `MurphysLaws` group
2. From Finder, drag each directory into Xcode:
- Drag `App/` folder → creates App group
- Drag `Models/` folder → creates Models group
- Continue for all directories
1. In the import dialog:
- **Create groups** (not folder references)
- **Copy items if needed** (unchecked - files already in place)
- Add to target: MurphysLaws

**Option B: Add Files Menu**

1. Right-click on `MurphysLaws` group
2. Select "Add Files to 'MurphysLaws'..."
3. Navigate to `ios/MurphysLaws/App/`
4. Select files/folders to import
5. Configure options as above
6. Repeat for each directory

### 4. Verify File Targets

Ensure all Swift files are included in the app target:

1. Select any `.swift` file
2. Open File Inspector (⌥⌘1)
3. Under "Target Membership", ensure MurphysLaws is checked
4. If any files are missing, check their target membership

### 5. Configure Build Settings

#### Set Deployment Target

1. Select project in navigator
2. Select MurphysLaws target
3. General tab > Deployment Info
4. Set **Minimum Deployments** to **iOS 16.0**

#### Configure App Capabilities

No special capabilities are required for basic functionality. Optional:

- **Push Notifications**: For law of the day reminders (future feature)
- **Background Fetch**: For updating content in background (future feature)

### 6. Configure Info.plist

Add these keys to `Info.plist` (if not present):

**Display Name**:
```xml
<key>CFBundleDisplayName</key>
<string>Murphy's Laws</string>
```

**Privacy - Photo Library Usage** (for sharing screenshots):
```xml
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save and share Murphy's Laws as images</string>
```

**App Transport Security** (allow HTTPS only):
```xml
<key>NSAppTransportSecurity</key>
<dict>
 <key>NSAllowsArbitraryLoads</key>
 <false/>
</dict>
```

### 7. Assets Configuration

#### App Icon

1. Open `Assets.xcassets`
2. Select `AppIcon`
3. Drag icon images for each required size
4. Recommended: Use SF Symbol `exclamationmark.triangle.fill` as base

#### Accent Color

1. Select `AccentColor` in Assets
2. Set color:
- Light: System Blue (#007AFF) or custom brand color
- Dark: Same or adjusted for dark mode

### 8. Build and Test

#### First Build

1. Select scheme: **MurphysLaws > iPhone 15 Pro** (or any simulator)
2. Press **⌘B** to build
3. Fix any build errors (should be none if steps followed correctly)

#### First Run

1. Press **⌘R** to build and run
2. App should launch showing tab bar
3. Navigate through tabs to verify all screens load

#### Expected Behavior

 **Home Tab**: Shows "Loading Law of the Day..." then displays a law
 **Browse Tab**: Shows list of laws with search bar
 **Categories Tab**: Shows grid of category cards
 **Calculator Tab**: Shows calculator with sliders
 **More Tab**: Shows settings and info options

### 9. Configure for Local Development (Optional)

To test against local backend:

1. Open `Utilities/Constants.swift`
2. Change API baseURL:

```swift
enum API {
 static let baseURL = "http://localhost:8787/api/v1"
 // ... rest of constants
}
```

1. Ensure backend is running locally
2. Rebuild and run app

### 10. Device Testing

#### Connect Physical Device

1. Connect iPhone/iPad via USB
2. Trust computer on device
3. In Xcode, select device from scheme selector
4. Xcode may prompt to register device (requires Apple Developer account)

#### Run on Device

1. Select your device from schemes
2. Press **⌘R** to build and run
3. If prompted, unlock device and trust developer

## Troubleshooting

### "No such module" errors

**Cause**: File not added to target
**Fix**: Select file > File Inspector > Check MurphysLaws target

### "Duplicate symbol" errors

**Cause**: File added multiple times
**Fix**: Check Build Phases > Compile Sources, remove duplicates

### API connection fails

**Cause**: App Transport Security blocking HTTP
**Fix**: Ensure backend uses HTTPS, or add exception in Info.plist

### Simulator crashes on launch

**Cause**: iOS version mismatch
**Fix**: Use iOS 16.0+ simulator, or lower deployment target

### Views not showing up

**Cause**: File not in navigation structure
**Fix**: Verify ContentView.swift references all tab views

## Next Steps

- Read `README.md` for architecture overview
- Review PRD in `shared/docs/MOBILE-IOS-PRD.md`
- Test all features per testing checklist
- Customize branding (colors, icons, etc.)
- Add unit tests for ViewModels
- Add UI tests for critical flows

## Getting Help

- Check console logs for runtime errors
- Review API responses in Network console
- Verify file structure matches documentation
- Ensure all dependencies are properly imported

## Development Workflow

1. **Make changes** in preferred editor or Xcode
2. **Xcode auto-detects** file changes
3. **Build** (⌘B) to verify syntax
4. **Run** (⌘R) to test functionality
5. **Commit** changes to git

Happy coding!
