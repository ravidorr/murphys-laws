# Murphy's Laws iOS - Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MurphysLawsApp                          │
│                     (Main Entry Point)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ NetworkMonitor (EnvironmentObject)
                         ├─ VotingService (EnvironmentObject)
                         └─ DeepLinkHandler (EnvironmentObject)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          ContentView                            │
│                  (TabView with 5 tabs)                          │
└─┬───────┬──────────┬────────────┬──────────┬───────────────────┘
  │       │          │            │          │
  ▼       ▼          ▼            ▼          ▼
┌────┐ ┌────┐  ┌──────────┐  ┌──────┐  ┌──────┐
│Home│ │Browse│ │Categories│ │Calc │  │ More │
└─┬──┘ └─┬──┘  └────┬─────┘  └──┬───┘  └──┬───┘
  │      │          │            │         │
  │      │          │            │         │
  ▼      ▼          ▼            ▼         ▼
┌────────────────────────────────────────────────┐
│              View Layer (SwiftUI)              │
│  • HomeView         • BrowseView               │
│  • CategoriesView   • CalculatorView           │
│  • MoreView         • LawDetailView            │
│  • SubmitLawView    • EmptyStateView           │
└────────────────┬───────────────────────────────┘
                 │
                 │ @StateObject / @ObservedObject
                 │
                 ▼
┌────────────────────────────────────────────────┐
│          ViewModel Layer (@MainActor)          │
│  • HomeViewModel                               │
│  • LawListViewModel                            │
│  • CategoryListViewModel                       │
│  • CalculatorViewModel                         │
│  • SubmitLawViewModel                          │
│  • LawDetailViewModel                          │
└────────────────┬───────────────────────────────┘
                 │
                 │ Uses
                 │
                 ▼
┌────────────────────────────────────────────────┐
│            Service Layer                       │
│  • APIService (Singleton)                      │
│  • VotingService (Singleton, @MainActor)       │
│  • NetworkMonitor (Singleton, @MainActor)      │
│  • AnalyticsService (Singleton, @MainActor)    │
│  • CrashReportingService (Singleton)           │
└────────────────┬───────────────────────────────┘
                 │
                 │ Uses
                 │
                 ▼
┌────────────────────────────────────────────────┐
│          Repository Pattern                    │
│  Protocol: LawRepository                       │
│    ├─ APILawRepository (Production)            │
│    └─ MockLawRepository (Testing)              │
└────────────────┬───────────────────────────────┘
                 │
                 │ Returns
                 │
                 ▼
┌────────────────────────────────────────────────┐
│             Model Layer                        │
│  • Law (struct, Codable, Identifiable)         │
│  • Category (struct, Codable, Identifiable)    │
│  • Attribution (struct, Codable, Identifiable) │
│  • VoteType (enum)                             │
│  • RiskLevel (enum)                            │
└────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. Loading Laws (Browse Flow)

```
User taps Browse Tab
        │
        ▼
┌─────────────────┐
│  BrowseView     │
│  - .task {}     │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  LawListViewModel        │
│  - loadLaws()            │
└───────────┬──────────────┘
            │
            ▼
┌───────────────────────────┐
│  LawRepository            │
│  - fetchLaws()            │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│  APIService               │
│  - request<T>()           │
│  - URLSession.data()      │
└───────────┬───────────────┘
            │
            ▼
      Network Request
            │
            ▼
      JSON Response
            │
            ▼
┌───────────────────────────┐
│  Decoder                  │
│  - decode([Law].self)     │
└───────────┬───────────────┘
            │
            ▼
   ViewModel.laws = result
            │
            ▼
    SwiftUI auto-updates
            │
            ▼
     List displays laws
```

### 2. Voting Flow

```
User taps Upvote Button
        │
        ▼
┌─────────────────────────────┐
│  LawDetailView              │
│  - handleVote(.up)          │
└────────────┬────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  VotingService               │
│  - toggleVote(lawID, .up)    │
│  - Check rate limiting       │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  APIService                  │
│  - voteLaw(id, type)         │
└────────────┬─────────────────┘
             │
             ▼
      Network Request
             │
             ▼
┌──────────────────────────────┐
│  VoteResponse                │
│  - upvotes: Int              │
│  - downvotes: Int            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  VotingService               │
│  - Update local votes dict   │
│  - Save to UserDefaults      │
│  - Post notification         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  NotificationCenter          │
│  - .lawVotesDidChange        │
└────────────┬─────────────────┘
             │
             ▼
    All listening views
    update vote counts
```

### 3. Calculator Flow

```
User adjusts Urgency slider
        │
        ▼
┌──────────────────────────────┐
│  CalculatorView              │
│  - .onChange(urgency)        │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  CalculatorViewModel         │
│  - calculate()               │
│  - Debounce 100ms            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  Calculation Logic           │
│  P = [(U×C×I)/(S×F)] × 10    │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  Risk Level Computation      │
│  < 30 = Low                  │
│  30-60 = Medium              │
│  > 60 = High                 │
└────────────┬─────────────────┘
             │
             ▼
    @Published properties
          update
             │
             ▼
    SwiftUI redraws UI
    - Probability %
    - Risk emoji
    - Color changes
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────┐
│              Memory Caches (Actors)             │
├─────────────────────────────────────────────────┤
│                                                 │
│  LawCache (actor)                               │
│  ├─ laws: [Int: Law]                            │
│  ├─ lawOfDay: Law?                              │
│  └─ lawOfDayDate: Date?                         │
│                                                 │
│  CategoryCache (actor)                          │
│  ├─ categories: [Category]?                     │
│  ├─ lastUpdate: Date?                           │
│  └─ maxAge: 1 hour                              │
│                                                 │
│  ImageCache (actor)                             │
│  ├─ cache: [URL: CachedImage]                   │
│  ├─ maxSize: 100 images                         │
│  └─ maxAge: 1 hour                              │
│                                                 │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Persisted to
                  ▼
┌─────────────────────────────────────────────────┐
│           Persistent Storage                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  UserDefaults                                   │
│  ├─ user_votes: [Int: VoteType]                 │
│  ├─ cached_categories: [Category]               │
│  ├─ device_identifier: String                   │
│  └─ notification_enabled: Bool                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Design System Hierarchy

```
┌──────────────────────────────────────────────────┐
│              Tokens.swift (Generated)            │
│         Auto-generated from design tokens        │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│                 DS Namespace                     │
├──────────────────────────────────────────────────┤
│                                                  │
│  DS.Color                                        │
│  ├─ bg, fg, mutedFg                              │
│  ├─ btnPrimaryBg, btnPrimaryFg                   │
│  ├─ success, error, warning                      │
│  ├─ riskLow, riskMedium, riskHigh                │
│  └─ ... (50+ semantic colors)                    │
│                                                  │
│  DS.Typography                                   │
│  ├─ display, h1, h2, h3, h4                      │
│  ├─ bodyLg, bodyMd, bodySm                       │
│  ├─ caption                                      │
│  └─ Each has: font, lineSpacing, letterSpacing   │
│                                                  │
│  DS.Spacing                                      │
│  ├─ s1 (4pt), s2 (8pt), s4 (16pt)                │
│  └─ ... s16 (64pt)                               │
│                                                  │
│  DS.Radius                                       │
│  ├─ sm (4pt), md (6pt), lg (8pt)                 │
│  └─ xl (12pt), full (9999pt)                     │
│                                                  │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Applied via
                 ▼
┌──────────────────────────────────────────────────┐
│           TypographyModifier.swift               │
│                                                  │
│  extension View {                                │
│    func dsTypography(_ level: DS.Typography)     │
│  }                                               │
│                                                  │
└────────────────┬─────────────────────────────────┘
                 │
                 │ Used in
                 ▼
┌──────────────────────────────────────────────────┐
│                All SwiftUI Views                 │
│                                                  │
│  Text("Hello")                                   │
│    .dsTypography(DS.Typography.h1)               │
│    .foregroundColor(DS.Color.fg)                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Testing Architecture

```
┌─────────────────────────────────────────────────┐
│                Test Pyramid                     │
└─────────────────────────────────────────────────┘

                    ┌────────┐
                    │   UI   │  NavigationUITests.swift
                    │  Tests │  CalculatorUITests.swift
                    └────┬───┘
                         │
                  ┌──────┴──────┐
                  │ Integration │  LawIntegrationTests.swift
                  │    Tests    │  (Swift Testing)
                  └──────┬──────┘
                         │
              ┌──────────┴──────────┐
              │     Unit Tests      │  CalculatorViewModelTests.swift
              │                     │  LawListViewModelTests.swift
              │                     │  HomeViewModelTests.swift
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │   Mock Objects      │  MockLawRepository
              │                     │  Mock APIService
              └─────────────────────┘
```

### Test Utilities

```
┌────────────────────────────────────┐
│      Mock Infrastructure           │
├────────────────────────────────────┤
│                                    │
│  MockLawRepository                 │
│  ├─ lawsToReturn: [Law]            │
│  ├─ shouldFail: Bool               │
│  └─ lastCategoryID: Int?           │
│                                    │
│  Law.mock / Law.mockList           │
│  Category.mock / Category.mockList │
│  Attribution.mock                  │
│                                    │
└────────────────────────────────────┘
```

---

## Error Handling Flow

```
Network Request
       │
       ▼
   Success? ──Yes──> Decode JSON ──> Update UI
       │
       No
       │
       ▼
┌─────────────────┐
│  Classify Error │
└────────┬────────┘
         │
         ├─> Network Error ──> NetworkMonitor checks
         ├─> Rate Limit ──> VotingService backoff
         ├─> Server Error ──> ErrorRecoveryView
         ├─> Decode Error ──> Log to Crashlytics
         └─> Unknown ──> Generic error view
                  │
                  ▼
         ErrorRecoveryView
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
    Show Icon  Message  Retry Button
         │        │        │
         └────────┴────────┘
                  │
                  ▼
         User taps Retry
                  │
                  ▼
         Retry original request
```

---

## View State Management

```
┌────────────────────────────────────────────┐
│           ViewModel States                 │
├────────────────────────────────────────────┤
│                                            │
│  @Published var laws: [Law] = []           │
│  @Published var isLoading = false          │
│  @Published var errorMessage: String?      │
│  @Published var hasMorePages = true        │
│                                            │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│        SwiftUI View Rendering              │
├────────────────────────────────────────────┤
│                                            │
│  if isLoading && laws.isEmpty {            │
│    ProgressView()                          │
│  } else if let error = errorMessage {      │
│    ErrorRecoveryView(error)                │
│  } else if laws.isEmpty {                  │
│    EmptyStateView()                        │
│  } else {                                  │
│    List { ForEach(laws) { ... } }          │
│  }                                         │
│                                            │
└────────────────────────────────────────────┘
```

---

## API Request Flow

```
ViewModel
    │
    │ async/await
    ▼
Repository
    │
    │ protocol abstraction
    ▼
APIService.request<T>()
    │
    ├─> Build URLRequest
    │   ├─ Set method (GET/POST/DELETE)
    │   ├─ Add headers (Content-Type, X-Device-ID, X-API-Key)
    │   └─ Add body (if POST/PUT)
    │
    ├─> URLSession.data(for:)
    │
    ├─> Check HTTPURLResponse
    │   ├─ 200-299: Success
    │   ├─ 429: Rate limit
    │   ├─ 400-499: Client error
    │   └─ 500-599: Server error
    │
    ├─> Decode JSON
    │   └─> decoder.decode(T.self)
    │
    └─> Return result or throw APIError
```

---

## Conclusion

This architecture provides:

 **Separation of Concerns**: Views, ViewModels, Services, Repositories
 **Testability**: Mock infrastructure at every layer
 **Type Safety**: Swift's strong typing throughout
 **Thread Safety**: @MainActor and actors
 **Performance**: Multi-level caching
 **Resilience**: Comprehensive error handling
 **Scalability**: Easy to add new features
 **Maintainability**: Clear organization and patterns

The app follows Apple's best practices and modern Swift patterns, making it production-ready and maintainable for the long term.
