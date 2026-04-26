# Murphy's Laws iOS App

A comprehensive iOS application for browsing, submitting, and calculating Murphy's Laws and similar humorous principles.

## Features

### Core Features
- **Browse Laws**: Explore a comprehensive collection of Murphy's Laws
- **Search**: Find specific laws with real-time search
- **Categories**: Browse laws by category (Technology, Work, Relationships, etc.)
- **Law of the Day**: Featured law updated daily
- **Voting System**: Upvote/downvote laws to rate their usefulness
- **Submit Laws**: Contribute your own observations
- **Sod's Law Calculator**: Calculate the probability of something going wrong based on multiple factors

### Technical Features
- **MVVM Architecture**: Clean separation of concerns
- **SwiftUI**: Modern declarative UI
- **Swift Concurrency**: Async/await throughout
- **Comprehensive Testing**: Unit tests, integration tests, and UI tests
- **Design System**: Centralized design tokens and typography
- **Accessibility**: VoiceOver support, Dynamic Type, reduced motion
- **Network Monitoring**: Offline detection and recovery
- **Deep Linking**: URL scheme support for navigation
- **Analytics Ready**: Infrastructure for tracking (Firebase, Mixpanel, etc.)
- **Caching**: Performance optimized with intelligent caching

## Architecture

### Project Structure

```
MurphysLaws/
├── Models/
│   ├── Law.swift
│   ├── Category.swift
│   └── Attribution.swift
├── ViewModels/
│   ├── LawListViewModel.swift
│   ├── CategoryListViewModel.swift
│   ├── CalculatorViewModel.swift
│   ├── SubmitLawViewModel.swift
│   └── HomeViewModel.swift
├── Views/
│   ├── HomeView.swift
│   ├── BrowseView.swift
│   ├── CategoriesView.swift
│   ├── CalculatorView.swift
│   ├── MoreView.swift
│   ├── LawDetailView.swift
│   ├── SubmitLawView.swift
│   ├── EmptyStateView.swift
│   └── Components/
├── Services/
│   ├── APIService.swift
│   ├── VotingService.swift
│   ├── NetworkMonitor.swift
│   ├── AnalyticsService.swift
│   └── CrashReportingService.swift
├── Utilities/
│   ├── Constants.swift
│   ├── DateFormatters.swift
│   ├── AccessibilityHelpers.swift
│   ├── DeepLinkHandler.swift
│   └── ImageCache.swift
├── Design System/
│   ├── Tokens.swift
│   └── TypographyModifier.swift
└── Tests/
    ├── Unit/
    ├── Integration/
    └── UI/
```

### Design Patterns

#### MVVM (Model-View-ViewModel)
- **Models**: Plain Swift structs/classes (Law, Category, Attribution)
- **Views**: SwiftUI views that observe ViewModels
- **ViewModels**: `@MainActor` classes conforming to `ObservableObject`

#### Repository Pattern
```swift
protocol LawRepository {
    func fetchLaws(...) async throws -> [Law]
}

class APILawRepository: LawRepository { }
class MockLawRepository: LawRepository { }
```

#### Service Layer
- `APIService`: Network requests
- `VotingService`: Vote management with rate limiting
- `NetworkMonitor`: Connection monitoring
- `AnalyticsService`: Event tracking

## Getting Started

### Prerequisites
- Xcode 15.0+
- iOS 17.0+ deployment target
- Swift 5.9+

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourorg/murphys-laws-ios.git
cd murphys-laws-ios
```

1. **Configure API**
Create a `Config.plist` file in the project root:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>Environment</key>
    <string>development</string>
    <key>APIBaseURL</key>
    <string>https://murphys-laws.com/api/v1</string>
    <key>APIKey</key>
    <string>your-api-key-here</string>
    <key>EnableAnalytics</key>
    <true/>
    <key>EnableCrashReporting</key>
    <true/>
    <key>LogLevel</key>
    <string>debug</string>
</dict>
</plist>
```

1. **Build and Run**
```bash
# Open in Xcode
open MurphysLaws.xcodeproj

# Or build from command line
xcodebuild -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Testing

### Run Tests
```bash
# Unit tests
xcodebuild test -scheme MurphysLaws -destination 'platform=iOS Simulator,name=iPhone 15'

# UI tests
xcodebuild test -scheme MurphysLawsUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Test Coverage
- **Unit Tests**: ViewModels, Services, Utilities
- **Integration Tests**: End-to-end workflows using Swift Testing
- **UI Tests**: User interaction flows

### Writing Tests

#### Swift Testing (Preferred)
```swift
import Testing
@testable import MurphysLaws

@Suite("Calculator Tests")
struct CalculatorTests {
    @Test("Calculate high risk scenario")
    func testHighRisk() async throws {
        let vm = await CalculatorViewModel()
        await vm.urgency = 10.0
        await vm.calculate()
        
        let risk = await vm.riskLevel
        #expect(risk == .high)
    }
}
```

#### XCTest (Legacy)
```swift
import XCTest
@testable import MurphysLaws

final class LawTests: XCTestCase {
    func testLawScore() {
        let law = Law.mock
        XCTAssertEqual(law.score, law.upvotes - law.downvotes)
    }
}
```

## Design System

### Accessing Design Tokens

```swift
// Colors
DS.Color.bg
DS.Color.fg
DS.Color.btnPrimaryBg

// Typography
Text("Hello")
    .dsTypography(DS.Typography.h1)

// Spacing
VStack(spacing: DS.Spacing.s4) { }

// Corner Radius
.cornerRadius(DS.Radius.lg)
```

### Custom Colors
All colors support dark mode automatically via asset catalogs in `Assets.xcassets/DS/`.

## Features Deep Dive

### Sod's Law Calculator

The calculator computes failure probability using:

```
P = [(U × C × I) / (S × F)] × 10

Where:
- U = Urgency (1-10)
- C = Complexity (1-10)
- I = Importance (1-10)
- S = Skill Level (1-10)
- F = Frequency (1-10)
- P = Probability of failure (%)
```

### Voting System

- Rate limiting: 30 votes per minute
- Local persistence via UserDefaults
- Optimistic UI updates
- Server sync on vote

### Deep Linking

Supported URL schemes:
```
murphyslaws://law/123          # View specific law
murphyslaws://category/5       # View category
murphyslaws://calculator       # Open calculator
murphyslaws://submit           # Submit new law
```

## Configuration

### Environment Variables

Set in `Config.plist`:
- `Environment`: "development" | "production"
- `APIBaseURL`: Backend API endpoint
- `APIKey`: Optional API authentication
- `EnableAnalytics`: Enable/disable analytics
- `EnableCrashReporting`: Enable/disable crash reports
- `LogLevel`: "debug" | "info" | "warning" | "error"

### Build Configurations

#### Development
- Verbose logging
- Mock data enabled
- Analytics disabled

#### Production
- Minimal logging
- Real API endpoints
- Analytics enabled

## API Integration

### Endpoints

```swift
// Laws
GET  /api/v1/laws
GET  /api/v1/laws/:id
POST /api/v1/laws
POST /api/v1/laws/:id/vote
DELETE /api/v1/laws/:id/vote

// Categories
GET  /api/v1/categories

// Law of Day
GET  /api/v1/law-of-day

// Calculator
POST /api/v1/share-calculation
```

### Error Handling

All API errors are wrapped in `APIError`:
- `networkError`: Connection issues
- `invalidURL`: Malformed URLs
- `invalidResponse`: Bad server response
- `decodingError`: JSON parsing failures
- `serverError`: HTTP errors (400-599)
- `rateLimitExceeded`: Too many requests
- `noData`: Empty response

## Accessibility

### Supported Features
- VoiceOver labels and hints
- Dynamic Type support
- Reduced Motion respect
- High Contrast mode
- Accessibility identifiers for testing

### Implementation

```swift
Button("Vote") { }
    .accessibleButton(
        label: "Upvote this law",
        hint: "Double tap to upvote"
    )

Text("Heading")
    .accessibleHeading()
```

## Analytics

### Tracked Events
- App launched
- Law viewed
- Law voted
- Search performed
- Calculator used
- Law submitted
- Errors occurred

### Implementation

```swift
AnalyticsService.shared.track(.lawViewed(lawID: 123))
AnalyticsService.shared.logScreen("HomeView")
```

## Debugging

### Common Issues

**API Connection Failures**
- Check `Config.plist` has correct `APIBaseURL`
- Verify network permissions in `Info.plist`
- Check network monitor: `NetworkMonitor.shared.isConnected`

**UI Tests Failing**
- Ensure `--uitesting` launch argument is set
- Check accessibility identifiers are present
- Verify animations are disabled in test mode

**Design Tokens Not Working**
- Confirm all color assets exist in `Assets.xcassets/DS/`
- Rebuild project to regenerate `Tokens.swift`
- Check bundle identifier matches

## Deployment

### Pre-Release Checklist
- [ ] All tests passing
- [ ] Analytics configured
- [ ] Crash reporting enabled
- [ ] API keys configured for production
- [ ] App icons and launch screen added
- [ ] Privacy policy link updated
- [ ] Terms of service link updated

### Build for Release
```bash
xcodebuild archive \
    -scheme MurphysLaws \
    -archivePath ./build/MurphysLaws.xcarchive

xcodebuild -exportArchive \
    -archivePath ./build/MurphysLaws.xcarchive \
    -exportPath ./build \
    -exportOptionsPlist ExportOptions.plist
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- SwiftLint rules enforced
- Use `async/await` over completion handlers
- Prefer Swift Testing for new tests
- Follow MVVM architecture

## License

Copyright 2026 Murphy's Laws. All rights reserved.

## Acknowledgments

- Design tokens auto-generated from shared design system
- Inspired by the pessimism of Murphy, Parkinson, Hofstadter, and countless others
- Built with SwiftUI

---

**If anything can go wrong in your build, check this README first.**
