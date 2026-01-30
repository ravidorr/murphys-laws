# Murphy's Laws - iOS App Product Requirements Document

**Version:** 1.0
**Last Updated:** November 6, 2025
**Platform:** iOS 16.0+
**Development Language:** Swift
**UI Framework:** SwiftUI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [User Personas](#user-personas)
4. [Features & Requirements](#features--requirements)
5. [User Interface Design](#user-interface-design)
6. [Technical Requirements](#technical-requirements)
7. [Success Metrics](#success-metrics)
8. [Development Timeline](#development-timeline)
9. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Purpose
Create a native iOS application for Murphy's Laws that provides users with a seamless mobile experience for browsing, searching, and interacting with Murphy's Laws - humorous observations about life's tendency for things to go wrong.

### Goals
- Deliver a fast, native iOS experience matching web app functionality
- Leverage iOS-specific features (share sheet, haptics, widgets)
- Maintain 100% feature parity with web application
- Achieve App Store rating of 4.5+ stars

### Target Audience
- iOS users aged 18-65
- Tech enthusiasts, office workers, students
- Users who enjoy humor, productivity content, and life observations
- Global audience (English-speaking markets initially)

---

## Product Overview

### Current State
Murphy's Laws exists as a production web application built with:
- Vanilla JavaScript frontend
- Node.js API backend (versioned at `/api/v1/`)
- SQLite database
- 40+ categorized collections with hundreds of laws
- Search, voting, calculators, and submission features

### Vision
The iOS app will be a native Swift application that:
- Uses the existing `/api/v1/` backend
- Provides offline caching for recently viewed laws
- Implements iOS-specific UI patterns (navigation, share sheet, etc.)
- Delivers superior performance compared to mobile web

### Value Proposition
**For Users:**
- Fast, native experience optimized for iPhone/iPad
- Offline access to favorite laws
- iOS share integration for easy sharing
- Home screen widgets for daily law delivery
- Native haptic feedback and animations

**For Business:**
- Expanded user base (iOS represents 60% of US smartphone market)
- Increased engagement through push notifications
- App Store visibility and discoverability
- Better monetization through native ad integration

---

## User Personas

### Persona 1: "Tech-Savvy Tom"
- **Age:** 28
- **Occupation:** Software Developer
- **Goals:** Quick entertainment during breaks, share funny laws with team
- **Pain Points:** Web apps feel slow on mobile, wants offline access
- **Device:** iPhone 15 Pro
- **Usage Pattern:** Multiple short sessions per day (2-5 minutes)

### Persona 2: "Office Manager Lisa"
- **Age:** 42
- **Occupation:** Office Manager
- **Goals:** Find relatable workplace humor, share with colleagues
- **Pain Points:** Needs quick access, doesn't want to open browser
- **Device:** iPhone 13
- **Usage Pattern:** Daily during lunch break (10-15 minutes)

### Persona 3: "Student Sam"
- **Age:** 21
- **Occupation:** College Student
- **Goals:** Procrastination material, share on social media
- **Pain Points:** Limited data plan, wants offline mode
- **Device:** iPhone 12
- **Usage Pattern:** Evening browsing sessions (15-30 minutes)

---

## Features & Requirements

### MVP Features (Version 1.0)

#### 1. Browse Laws
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to browse all Murphy's Laws in a scrollable list
- As a user, I want to see laws paginated (25 per page) for performance
- As a user, I want to pull-to-refresh to get the latest laws
- As a user, I want infinite scroll for seamless browsing

**Acceptance Criteria:**
- Display law cards with text, upvote/downvote counts, and category tags
- Implement pagination matching web app (25 laws per page)
- Pull-to-refresh clears cache and fetches fresh data
- Infinite scroll automatically loads next page when scrolling near bottom
- Loading states with skeleton screens
- Error states with retry button

**API Endpoints:**
- `GET /api/v1/laws?limit=25&offset=0&sort=score&order=desc`

**Technical Notes:**
- Use `LazyVStack` for efficient rendering
- Implement prefetching for smooth scrolling
- Cache images/data with 1-hour TTL

---

#### 2. Law Detail View
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to tap a law to see its full details
- As a user, I want to see attributions (who submitted it)
- As a user, I want to vote on laws from the detail view
- As a user, I want to share laws via iOS share sheet

**Acceptance Criteria:**
- Full law text displayed with proper typography
- Attribution names with contact info (if available)
- Vote buttons with real-time count updates
- Native iOS share sheet integration
- Related laws section (if available)
- Category tags (tappable to filter)

**API Endpoints:**
- `GET /api/v1/laws/{id}`
- `POST /api/v1/laws/{id}/vote`
- `DELETE /api/v1/laws/{id}/vote`

**Technical Notes:**
- Use `UIActivityViewController` for sharing
- Format share text: `"{law_text}" - Murphy's Laws`
- Deep linking support: `murphyslaws://law/{id}`

---

#### 3. Voting System
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to upvote laws I find funny/accurate
- As a user, I want to downvote laws I don't like
- As a user, I want to see my vote status (upvoted/downvoted/neutral)
- As a user, I want to change my vote (upvote → downvote or remove)

**Acceptance Criteria:**
- Vote buttons change color when voted (green for up, red for down)
- Vote counts update immediately (optimistic UI)
- Haptic feedback on vote action
- Vote state persists across app restarts (UserDefaults + backend sync)
- Handle vote conflicts (e.g., already voted from web)

**API Endpoints:**
- `POST /api/v1/laws/{id}/vote` - Body: `{"vote_type": "up"}`
- `DELETE /api/v1/laws/{id}/vote`

**Technical Notes:**
- Store votes locally in UserDefaults: `votes_law_123: "up"`
- Send device ID in API calls for deduplication
- Handle offline voting (queue and sync when online)

---

#### 4. Search & Filters
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to search laws by text
- As a user, I want to filter laws by category
- As a user, I want to filter laws by attribution/submitter
- As a user, I want to see search suggestions

**Acceptance Criteria:**
- Search bar in navigation with real-time results
- Category filter chips (horizontal scrollable list)
- Attribution dropdown/picker
- Combined filters (e.g., search + category)
- Clear filters button
- Search history (last 10 searches)

**API Endpoints:**
- `GET /api/v1/laws?q=murphy&category_id=5&attribution=John`
- `GET /api/v1/categories`
- `GET /api/v1/attributions`

**Technical Notes:**
- Debounce search input (300ms)
- Cache category/attribution lists in UserDefaults with 24-hour TTL
- Use SwiftUI `searchable()` modifier

---

#### 5. Law of the Day
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to see a featured "Law of the Day" on the home screen
- As a user, I want a daily push notification for Law of the Day (opt-in)
- As a user, I want to view past Laws of the Day

**Acceptance Criteria:**
- Dedicated "Law of the Day" card on home screen
- Special styling/badge to distinguish it
- Tap to view full details
- Share button directly from card
- Push notification opt-in during onboarding
- Notification sent at user-selected time (default 9 AM local time)

**API Endpoints:**
- `GET /api/v1/law-of-day`

**Technical Notes:**
- Use local notifications scheduled daily
- Fetch Law of the Day on app launch and cache
- Include law text in notification (if short enough)

---

#### 6. Submit New Law
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to submit my own Murphy's Law
- As a user, I want to optionally attribute my submission
- As a user, I want to select a category for my submission
- As a user, I want confirmation when submitted

**Acceptance Criteria:**
- Form with law text field (10-1000 chars, validated)
- Optional title field
- Optional author name and email fields
- "Submit anonymously" toggle
- Category picker (required)
- Form validation with inline errors
- Success confirmation alert
- Submission status: "Your law is under review"

**API Endpoints:**
- `POST /api/v1/laws`
- `GET /api/v1/categories` (for picker)

**Technical Notes:**
- Use SwiftUI `Form` with validation
- Disable submit button until valid
- Clear form after successful submission
- Email validation regex: RFC 5322 standard

---

#### 7. Sod's Law Calculator
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to calculate the probability of something going wrong
- As a user, I want to see the mathematical formula
- As a user, I want to share calculation results

**Acceptance Criteria:**
- Input sliders for:
- Urgency (U): 1-10
- Complexity (C): 1-10
- Importance (I): 1-10
- Skill Level (S): 1-10
- Frequency (F): 1-10
- Real-time probability calculation
- Formula display: `((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))`
- Result interpretation (Low/Medium/High risk)
- Color-coded result (green/yellow/red)
- Share via iOS share sheet
- Optional: Email results (uses existing API)

**API Endpoints:**
- `POST /api/v1/share-calculation` (optional, for email)

**Technical Notes:**
- Formula rendering: Use `Text` with formatted string (no MathJax needed)
- Alternative: Render formula as SVG from backend
- Share text: "My task has a {probability}% chance of going wrong! #MurphysLaw"

---

#### 8. Category Browsing
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to browse laws by category
- As a user, I want to see category descriptions
- As a user, I want to see how many laws are in each category

**Acceptance Criteria:**
- List of all categories with law counts
- Category descriptions/subtitles
- Tap category to view filtered law list
- Category icons/colors for visual distinction
- Alphabetical sorting

**API Endpoints:**
- `GET /api/v1/categories`
- `GET /api/v1/laws?category_id={id}`

**Technical Notes:**
- Cache category list with 24-hour TTL
- Use SF Symbols for category icons
- Color scheme: Define color per category type

---

### Post-MVP Features (Version 1.1+)

#### 9. Home Screen Widget
**Priority:** P2 (Nice to Have)

**Features:**
- Small widget: Law of the Day (text only)
- Medium widget: Law of the Day + upvote count
- Large widget: Law of the Day + related laws
- Widget updates daily at midnight

**Technical Notes:**
- Use `WidgetKit` framework
- Timeline provider refreshes daily
- Tap widget opens app to law detail

---

#### 10. Offline Mode
**Priority:** P2 (Nice to Have)

**Features:**
- Cache last 100 browsed laws
- Cache user's votes for sync
- Queue submissions for later
- Offline indicator banner
- Auto-sync when connection restored

**Technical Notes:**
- Use Core Data for local cache
- Background fetch for sync
- Network reachability monitoring

---

#### 11. Buttered Toast Calculator
**Priority:** P2 (Nice to Have)

**Features:**
- Physics-based toast landing calculator
- Input fields: height, gravity, overhang, butter factor
- Formula: `P = (1 - |((30√(H/g) · O · B)/(T + F) mod 1) - 0.5| · 2) · 100%`
- Visual toast animation

**API Endpoints:**
- None (client-side calculation)

---

#### 12. Favorites/Bookmarks
**Priority:** P2 (Nice to Have)

**Features:**
- Bookmark laws for quick access
- Local storage (UserDefaults or Core Data)
- Favorites tab in navigation
- Sync favorites to backend (requires auth)

---

#### 13. Dark Mode
**Priority:** P2 (Nice to Have)

**Features:**
- System theme support (auto-switch)
- Manual toggle in settings
- All screens support both light and dark themes

**Technical Notes:**
- Use `@Environment(\.colorScheme)` in SwiftUI
- Define color assets in `Assets.xcassets`

---

## User Interface Design

### Navigation Structure

```
TabView (Bottom Navigation)
├─ Home
│ ├─ Law of the Day Widget
│ ├─ Top Voted Laws Widget
│ ├─ Trending Laws Widget
│ └─ Recently Added Laws Widget
├─ Browse
│ ├─ Search Bar
│ ├─ Category Filter Chips
│ ├─ Law List (Infinite Scroll)
│ └─ Law Detail (Push Navigation)
├─ Categories
│ ├─ Category List
│ └─ Filtered Law List (Push Navigation)
├─ Calculators
│ ├─ Sod's Law Calculator
│ └─ Toast Calculator (v1.1)
└─ More
 ├─ Submit Law
 ├─ Favorites (v1.1)
 ├─ Settings
 │ ├─ Notification Preferences
 │ ├─ Theme Selection (v1.1)
 │ └─ About/Privacy Policy
 └─ About
```

### Screen Layouts

#### Home Screen
```
┌─────────────────────────┐
│ Navigation Bar │
│ "Murphy's Laws" │
├─────────────────────────┤
│ Law of the Day │
│ ┌─────────────────────┐ │
│ │ "If anything can │ │
│ │ go wrong, it will" │ │
│ │ │ │
│ │ ⬆ 42 ⬇ 3 Share │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Top Voted Laws │
│ [Horizontal Scroll] │
├─────────────────────────┤
│ Trending Laws │
│ [Horizontal Scroll] │
└─────────────────────────┘
```

#### Browse Screen
```
┌─────────────────────────┐
│ Search Bar │
├─────────────────────────┤
│ [Tech] [Love] [Work]... │ ← Category chips
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Law Title │ │
│ │ Law text preview...│ │
│ │ ⬆ 10 ⬇ 2 │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Another law... │ │
│ └─────────────────────┘ │
│ ... (infinite scroll) │
└─────────────────────────┘
```

#### Law Detail Screen
```
┌─────────────────────────┐
│ ← Back Share │
├─────────────────────────┤
│ Law Title (if exists) │
│ │
│ Full law text displayed │
│ with proper spacing and │
│ typography... │
│ │
│ [Technology] [Office] │ ← Category tags
│ │
│ ⬆ Upvote (42) │
│ ⬇ Downvote (3) │
│ │
│ ─────────────────────── │
│ Attribution: │
│ Submitted by John Doe │
│ john@example.com │
│ │
│ Related Laws: │
│ - Similar law 1 │
│ - Similar law 2 │
└─────────────────────────┘
```

#### Sod's Law Calculator
```
┌─────────────────────────┐
│ Sod's Law Calculator │
├─────────────────────────┤
│ Urgency: [●─────] 5 │
│ Complexity: [●●●───] 7 │
│ Importance: [●●●●──] 8 │
│ Skill Level: [●●●───] 6 │
│ Frequency: [●●────] 4 │
│ │
│ ─────────────────────── │
│ │
│ Formula: │
│ ((U+C+I)×(10-S))/20×... │
│ │
│ Result: 78.5% │
│ "High risk of failure" │
│ │
│ [Share Results] │
└─────────────────────────┘
```

### Design System

#### Typography
- **Titles:** SF Pro Display, Bold, 28pt
- **Headings:** SF Pro Text, Semibold, 20pt
- **Body:** SF Pro Text, Regular, 17pt
- **Captions:** SF Pro Text, Regular, 13pt

#### Colors (Light Mode)
- **Primary:** Blue (#007AFF)
- **Background:** White (#FFFFFF)
- **Card Background:** Light Gray (#F2F2F7)
- **Text Primary:** Black (#000000)
- **Text Secondary:** Gray (#8E8E93)
- **Upvote:** Green (#34C759)
- **Downvote:** Red (#FF3B30)

#### Colors (Dark Mode)
- **Primary:** Blue (#0A84FF)
- **Background:** Black (#000000)
- **Card Background:** Dark Gray (#1C1C1E)
- **Text Primary:** White (#FFFFFF)
- **Text Secondary:** Gray (#8E8E93)

#### Spacing
- **XS:** 4pt
- **S:** 8pt
- **M:** 16pt
- **L:** 24pt
- **XL:** 32pt

---

## Technical Requirements

### Platform Support
- **Minimum iOS Version:** 16.0
- **Target iOS Version:** 18.0
- **Device Support:** iPhone, iPad (universal app)
- **Orientation:** Portrait (iPhone), All orientations (iPad)

### Architecture

#### Design Pattern
- **MVVM (Model-View-ViewModel)** with SwiftUI
- **Repository Pattern** for data access
- **Coordinator Pattern** for navigation (optional)

#### Project Structure
```
MurphysLaws/
├── App/
│ ├── MurphysLawsApp.swift # App entry point
│ └── AppDelegate.swift # App lifecycle
├── Models/
│ ├── Law.swift # Law data model
│ ├── Category.swift # Category model
│ ├── Attribution.swift # Attribution model
│ └── Vote.swift # Vote model
├── ViewModels/
│ ├── LawListViewModel.swift # Browse laws logic
│ ├── LawDetailViewModel.swift # Law detail logic
│ ├── SearchViewModel.swift # Search logic
│ └── CalculatorViewModel.swift # Calculator logic
├── Views/
│ ├── Home/
│ │ ├── HomeView.swift
│ │ └── LawOfTheDayCard.swift
│ ├── Browse/
│ │ ├── LawListView.swift
│ │ ├── LawCardView.swift
│ │ └── LawDetailView.swift
│ ├── Search/
│ │ ├── SearchView.swift
│ │ └── FilterView.swift
│ ├── Categories/
│ │ └── CategoryListView.swift
│ ├── Calculators/
│ │ ├── SodsLawCalculatorView.swift
│ │ └── ToastCalculatorView.swift (v1.1)
│ └── Submit/
│ └── SubmitLawView.swift
├── Services/
│ ├── APIService.swift # HTTP client
│ ├── CacheService.swift # Local caching
│ ├── VotingService.swift # Vote management
│ └── NotificationService.swift # Push notifications
├── Repositories/
│ ├── LawRepository.swift # Law data access
│ └── CategoryRepository.swift # Category data access
├── Utilities/
│ ├── Constants.swift # App constants
│ ├── Extensions/
│ │ ├── View+Extensions.swift
│ │ └── Color+Extensions.swift
│ └── NetworkMonitor.swift # Network reachability
└── Resources/
 ├── Assets.xcassets # Images, colors
 ├── Localizable.strings # i18n strings
 └── Info.plist # App configuration
```

### Dependencies

#### Swift Package Manager (SPM)
```swift
dependencies: [
 .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.8.0"),
 // Alternative: Use native URLSession (recommended for simplicity)
]
```

**Recommended:** Use native APIs only (URLSession, Combine, SwiftUI)

### Networking

#### API Client Example
```swift
class APIService {
 let baseURL = "https://murphys-laws.com/api/v1"

 func fetchLaws(
 limit: Int = 25,
 offset: Int = 0,
 query: String? = nil,
 categoryID: Int? = nil
 ) async throws -> LawsResponse {
 var components = URLComponents(string: "\(baseURL)/laws")!
 components.queryItems = [
 URLQueryItem(name: "limit", value: "\(limit)"),
 URLQueryItem(name: "offset", value: "\(offset)")
 ]
 if let query = query {
 components.queryItems?.append(URLQueryItem(name: "q", value: query))
 }
 if let categoryID = categoryID {
 components.queryItems?.append(URLQueryItem(name: "category_id", value: "\(categoryID)"))
 }

 let (data, _) = try await URLSession.shared.data(from: components.url!)
 return try JSONDecoder().decode(LawsResponse.self, from: data)
 }

 func voteLaw(id: Int, voteType: VoteType) async throws -> VoteResponse {
 var request = URLRequest(url: URL(string: "\(baseURL)/laws/\(id)/vote")!)
 request.httpMethod = "POST"
 request.setValue("application/json", forHTTPHeaderField: "Content-Type")
 request.setValue(DeviceInfo.deviceID, forHTTPHeaderField: "X-Device-ID")

 let body = ["vote_type": voteType.rawValue]
 request.httpBody = try JSONEncoder().encode(body)

 let (data, _) = try await URLSession.shared.data(for: request)
 return try JSONDecoder().decode(VoteResponse.self, from: data)
 }
}
```

### Data Models

```swift
struct Law: Codable, Identifiable {
 let id: Int
 let text: String
 let title: String?
 let upvotes: Int
 let downvotes: Int
 let createdAt: Date
 let attributions: [Attribution]?

 var score: Int { upvotes - downvotes }

 enum CodingKeys: String, CodingKey {
 case id, text, title, upvotes, downvotes, attributions
 case createdAt = "created_at"
 }
}

struct Category: Codable, Identifiable {
 let id: Int
 let title: String
 let slug: String
 let description: String?
}

struct Attribution: Codable {
 let name: String
 let contactType: String?
 let contactValue: String?

 enum CodingKeys: String, CodingKey {
 case name
 case contactType = "contact_type"
 case contactValue = "contact_value"
 }
}

enum VoteType: String, Codable {
 case up, down
}
```

### Local Storage

#### UserDefaults Keys
```swift
struct StorageKeys {
 static let votes = "user_votes" // [law_id: vote_type]
 static let categories = "cached_categories" // [Category]
 static let lastSync = "last_sync_date" // Date
 static let deviceID = "device_identifier" // UUID
}
```

#### Vote Tracking
```swift
class VoteManager {
 func getVote(for lawID: Int) -> VoteType? {
 let votes = UserDefaults.standard.dictionary(forKey: StorageKeys.votes) as? [String: String]
 return votes?["\(lawID)"].flatMap { VoteType(rawValue: $0) }
 }

 func setVote(_ voteType: VoteType, for lawID: Int) {
 var votes = UserDefaults.standard.dictionary(forKey: StorageKeys.votes) as? [String: String] ?? [:]
 votes["\(lawID)"] = voteType.rawValue
 UserDefaults.standard.set(votes, forKey: StorageKeys.votes)
 }
}
```

### Error Handling

```swift
enum APIError: LocalizedError {
 case networkError(Error)
 case invalidResponse
 case decodingError(Error)
 case serverError(Int)
 case rateLimitExceeded

 var errorDescription: String? {
 switch self {
 case .networkError:
 return "Network connection failed. Please check your internet."
 case .invalidResponse:
 return "Invalid server response."
 case .decodingError:
 return "Failed to parse data."
 case .serverError(let code):
 return "Server error: \(code)"
 case .rateLimitExceeded:
 return "Too many requests. Please try again later."
 }
 }
}
```

### Performance Requirements
- **App Launch:** < 2 seconds (cold start)
- **Law List Load:** < 1 second (from cache), < 3 seconds (from API)
- **Search Results:** < 500ms (after debounce)
- **Vote Action:** < 200ms (optimistic UI)
- **Memory Usage:** < 100MB (typical), < 200MB (max)

### Security Requirements
- **API Communication:** HTTPS only
- **Device ID:** UUID stored in Keychain (not UserDefaults)
- **No Authentication:** Anonymous usage (for MVP)
- **Input Validation:** Client-side validation for all forms
- **Rate Limiting:** Respect backend rate limits (30 votes/min)

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### Acquisition
- **App Store Downloads:** 10,000+ in first 3 months
- **Conversion Rate:** 5% of web users install app
- **App Store Search Ranking:** Top 50 in "Entertainment" category

#### Engagement
- **Daily Active Users (DAU):** 1,000+ after 3 months
- **Session Duration:** 5+ minutes average
- **Sessions per User:** 3+ per week
- **Law of Day Open Rate:** 20%+ of users with notifications enabled

#### Retention
- **Day 1 Retention:** 50%+
- **Day 7 Retention:** 30%+
- **Day 30 Retention:** 15%+

#### Quality
- **App Store Rating:** 4.5+ stars
- **Crash-Free Rate:** 99.5%+
- **Performance:** 95% of users experience < 3s load times

#### Monetization (Future)
- **Ad Impressions:** 50,000+ per month
- **Ad Click-Through Rate:** 2%+

---

## Development Timeline

### Phase 1: Foundation (Weeks 1-2)
- Xcode project setup
- API client implementation
- Data models and repositories
- Basic navigation structure
- Design system (colors, typography, components)

### Phase 2: Core Features (Weeks 3-5)
- Home screen with Law of the Day
- Browse laws list with pagination
- Law detail view
- Voting functionality
- Search and filters
- Category browsing

### Phase 3: Secondary Features (Weeks 6-7)
- Submit law form
- Sod's Law Calculator
- Share functionality
- Settings screen
- About/Privacy Policy pages

### Phase 4: Polish & Testing (Week 8)
- UI/UX polish
- Performance optimization
- Bug fixes
- Unit tests (ViewModels, Services)
- UI tests (critical flows)
- Accessibility audit (VoiceOver, Dynamic Type)

### Phase 5: App Store Submission (Week 9)
- App Store assets (screenshots, preview video)
- App Store listing (description, keywords)
- Privacy policy update
- TestFlight beta testing
- Submit for review

**Total Timeline:** 9 weeks (2.25 months) for MVP

---

## Future Enhancements

### Version 1.1 (Post-Launch)
- Home screen widgets
- Offline mode with Core Data
- Buttered Toast Calculator
- Favorites/Bookmarks
- Dark mode (manual toggle)

### Version 1.2
- User accounts (sign in with Apple)
- Cross-device sync (favorites, votes)
- Law submission voting (upvote pending submissions)
- Achievement badges (e.g., "Voted on 100 laws")

### Version 1.3
- Social features (comments, discussions)
- Collections (user-curated lists)
- Advanced calculator (custom formulas)
- Siri Shortcuts integration

### Version 2.0
- AI-powered law recommendations
- Personalized feed based on interests
- Community features (user profiles, followers)
- Premium subscription (ad-free, exclusive content)

---

## Appendix

### App Store Listing

#### Name
Murphy's Laws - Life Observations

#### Subtitle
Humorous laws about things going wrong

#### Description
```
Discover hundreds of Murphy's Laws - witty observations about life's tendency
for things to go wrong at the worst possible moment.

FEATURES:
• Browse 40+ categories: Technology, Love, Office, Travel, and more
• Daily "Law of the Day" delivered to your home screen
• Vote on your favorite laws
• Powerful search and filters
• Sod's Law Calculator - predict the probability of failure
• Share laws with friends via text, social media, or email
• Submit your own Murphy's Laws

Whether you're a tech enthusiast, office worker, or just appreciate good humor,
Murphy's Laws has something for everyone.

PRIVACY:
No account required. No personal data collected. Browse anonymously.

FREE FOREVER:
All features are free. No in-app purchases.
```

#### Keywords
```
murphys law, sods law, humor, funny, quotes, laws, observations,
calculator, entertainment, jokes
```

#### Category
Primary: Entertainment
Secondary: Reference

### Privacy Policy Updates
- Add iOS-specific data collection (device ID for voting)
- Mention push notification data
- Update "How We Use Your Data" section

### Support & Feedback
- **Email:** <support@murphys-laws.com>
- **In-App:** Feedback form in Settings
- **GitHub:** Issue tracker for bug reports

---

**Document Owner:** Development Team
**Stakeholders:** Product Manager, iOS Engineers, QA, Design
**Review Cycle:** Monthly during development, quarterly post-launch
