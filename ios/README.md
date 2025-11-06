# Murphy's Laws - iOS App

Native iOS application built with Swift and SwiftUI.

## Requirements

- macOS 13+
- Xcode 15+
- iOS 16+ deployment target

## Setup

```bash
cd ios
open MurphysLaws.xcodeproj
```

Or if using Swift Package Manager dependencies:
```bash
open MurphysLaws.xcworkspace
```

## Running

1. Select target device/simulator in Xcode
2. Press `⌘R` to build and run

## Testing

```bash
# Unit tests
⌘U in Xcode

# Or via command line
xcodebuild test \
  -project MurphysLaws.xcodeproj \
  -scheme MurphysLaws \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Project Structure

```
ios/MurphysLaws/
├── App/                    # App entry point
├── Models/                 # Data models
├── ViewModels/             # MVVM ViewModels
├── Views/                  # SwiftUI views
├── Services/               # API, caching, etc.
├── Repositories/           # Data access layer
├── Utilities/              # Helper functions
└── Resources/              # Assets, plist
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md#ios-architecture).

## Documentation

- [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md)
- [API Documentation](../shared/docs/API.md)

## Status

🚧 **Coming Soon** - iOS app is not yet implemented.

See [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md) for planned features and timeline.
