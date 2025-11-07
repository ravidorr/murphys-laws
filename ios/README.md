# Murphy's Laws - iOS App

Native iOS application for browsing Murphy's Laws, voting on favorites, and calculating the probability of tasks going wrong using Sod's Law formula.

## 🎯 Features

- **Law of the Day**: Discover a new Murphy's Law every day
- **Browse Laws**: Explore the complete archive with search and filters
- **Categories**: Filter laws by technology, office, daily life, and more
- **Voting**: Vote on your favorite laws to help others discover them
- **Sod's Law Calculator**: Calculate the probability of your task going wrong
- **Submit Laws**: Contribute your own Murphy's Law variations

## 📋 Requirements

- iOS 16.0+
- Xcode 14.0+
- Swift 5.7+

## 🚀 Quick Start

### For First-Time Setup

The iOS source code has been created but requires Xcode project setup:

1. Open Xcode and create a new iOS App project
2. Save to this `ios/` directory with name `MurphysLaws`
3. Import the source files into your Xcode project
4. Configure Info.plist and Assets

**See [SETUP.md](./SETUP.md) for detailed step-by-step instructions.**

### If Xcode Project Already Exists

```bash
cd ios
open MurphysLaws.xcodeproj
```

Then press `⌘R` to build and run.

## 🏗️ Architecture

The app follows MVVM (Model-View-ViewModel) architecture with a Repository pattern:

```
MurphysLaws/
├── App/                    # App entry point and navigation
├── Models/                 # Data models (Law, Category, Attribution, Vote)
├── Views/                  # SwiftUI views organized by feature
│   ├── Home/              # Law of the Day and featured content
│   ├── Browse/            # Law browsing and detail views
│   ├── Categories/        # Category browsing
│   ├── Calculator/        # Sod's Law Calculator
│   ├── Submit/            # Law submission form
│   ├── More/              # Settings and about
│   └── Shared/            # Reusable components
├── ViewModels/            # Business logic and state management
├── Services/              # API and voting services
├── Repositories/          # Data access layer with caching
└── Utilities/             # Constants and helpers
```

**Architecture Details**: See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md#ios-architecture)

## 🔧 Configuration

### API Endpoint

The app connects to: `https://murphys-laws.com/api/v1`

For local development, modify `baseURL` in `Utilities/Constants.swift`:

```swift
static let baseURL = "http://localhost:8787/api/v1"
```

### Storage

- **User Votes**: Persisted in UserDefaults with device ID
- **Category Cache**: 1-hour TTL
- **Law of the Day Cache**: 24-hour TTL

## 🧪 Testing

### Manual Testing

- [ ] Law of the Day loads and displays
- [ ] Browse shows laws with pagination
- [ ] Search and filtering work
- [ ] Voting persists and updates counts
- [ ] Calculator computes correctly
- [ ] Share functionality works

### Unit Tests (TODO)

```bash
⌘U in Xcode

# Or via command line
xcodebuild test \
  -project MurphysLaws.xcodeproj \
  -scheme MurphysLaws \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

## 📚 Documentation

- **Setup Guide**: [SETUP.md](./SETUP.md) - Detailed Xcode setup instructions
- **PRD**: [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md) - Complete feature specifications
- **API**: [API Documentation](../shared/docs/API.md) - Backend API endpoints

## 🐛 Troubleshooting

**Build errors**: Ensure all files are added to Xcode target
**API fails**: Verify `baseURL` in Constants.swift
**Votes not saving**: Check device ID generation in DeviceID.swift

See [SETUP.md](./SETUP.md#troubleshooting) for detailed troubleshooting.

## 📱 Status

✅ **MVP Complete** - All core features implemented:
- ✅ Data models (Law, Category, Attribution, Vote)
- ✅ API service with URLSession
- ✅ Repository layer with caching
- ✅ ViewModels for all features
- ✅ Complete UI implementation
  - ✅ Home with Law of the Day
  - ✅ Browse with search and filters
  - ✅ Category browsing
  - ✅ Law detail with voting
  - ✅ Sod's Law Calculator
  - ✅ Submit law form
  - ✅ Settings and about

**Next Steps**:
- Create Xcode project file
- Add app icons and assets
- Unit test coverage
- UI test coverage
- App Store submission preparation

## 🤝 Contributing

When adding features:
1. Follow MVVM architecture
2. Use `@MainActor` for ViewModels
3. Implement error handling with `ContentUnavailableView`
4. Add loading states with `ProgressView`
5. Support pull-to-refresh

## 👤 Author

Raanan Avidor - [murphys-laws.com](https://murphys-laws.com)
