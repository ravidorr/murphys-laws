# Murphy's Laws - Mobile Architecture Documentation

**Version:** 1.0
**Last Updated:** November 6, 2025
**Platforms:** iOS 16+, Android 8+

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Backend API Architecture](#backend-api-architecture)
4. [iOS Architecture](#ios-architecture)
5. [Android Architecture](#android-architecture)
6. [Shared Components & Patterns](#shared-components--patterns)
7. [Data Flow & State Management](#data-flow--state-management)
8. [Offline Support Strategy](#offline-support-strategy)
9. [Push Notifications](#push-notifications)
10. [Security & Privacy](#security--privacy)
11. [Performance Optimization](#performance-optimization)
12. [Testing Strategy](#testing-strategy)
13. [Deployment & CI/CD](#deployment--cicd)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT LAYER │
├──────────────────────┬──────────────────────┬───────────────┤
│ │ │ │
│ iOS App │ Android App │ Web App │
│ (Swift/SwiftUI) │ (Kotlin/Compose) │ (Vanilla JS)│
│ │ │ │
└──────────┬───────────┴──────────┬───────────┴───────┬───────┘
 │ │ │
 └──────────────────────┼───────────────────┘
 │
 ┌───────▼────────┐
 │ │
 │ HTTPS/JSON │
 │ │
 └───────┬────────┘
 │
┌─────────────────────────────────▼───────────────────────────┐
│ API LAYER │
├─────────────────────────────────────────────────────────────┤
│ │
│ Node.js API Server (scripts/api-server.mjs) │
│ • Versioned Endpoints: /api/v1/* │
│ • Rate Limiting (IP + Device ID) │
│ • CORS Management │
│ • Request Validation │
│ │
└──────────────────────────────┬──────────────────────────────┘
 │
 ┌────────▼─────────┐
 │ │
 │ SQLite DB │
 │ (better-sqlite3)│
 │ │
 └──────────────────┘
```

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Backend API** | Node.js | 22+ | HTTP server |
| **Database** | SQLite | 3.x | Data persistence |
| **iOS App** | Swift | 5.9+ | Native iOS development |
| **iOS UI** | SwiftUI | 5.0+ | Declarative UI framework |
| **Android App** | Kotlin | 1.9+ | Native Android development |
| **Android UI** | Jetpack Compose | 1.6+ | Declarative UI framework |
| **API Format** | JSON/REST | - | Data interchange |
| **Push Notifications** | FCM | - | Cross-platform notifications |

---

## Architecture Principles

### 1. Platform-Native Development
**Why:** Best performance, UX, and access to platform features
- iOS: Swift + SwiftUI (native APIs only, no third-party dependencies)
- Android: Kotlin + Jetpack Compose (Android Jetpack libraries)
- Each platform follows its own design guidelines (HIG vs Material 3)

### 2. Shared Backend
**Why:** Single source of truth, consistent business logic
- Existing Node.js API serves all clients (web, iOS, Android)
- Backend handles complex calculations, validation, rate limiting
- Database migrations managed centrally

### 3. Clean Architecture
**Why:** Separation of concerns, testability, maintainability
- **Presentation Layer:** UI (SwiftUI/Compose) + ViewModels
- **Domain Layer:** Business logic, use cases, models
- **Data Layer:** Repositories, API clients, local storage

### 4. Offline-First (Post-MVP)
**Why:** Better UX in poor connectivity scenarios
- Cache recently viewed content
- Queue write operations (votes, submissions)
- Sync when connection restored

### 5. Optimistic UI Updates
**Why:** Perceived performance, instant feedback
- Update UI immediately on user action
- Revert if server rejects
- Show loading states for initial loads only

---

## Backend API Architecture

### Backend Structure

The backend follows a **modular layered architecture** for maintainability and testability:

```
backend/
├── src/
│   ├── controllers/     # HTTP request handlers (5 files)
│   │   ├── laws.controller.mjs
│   │   ├── votes.controller.mjs
│   │   ├── categories.controller.mjs
│   │   ├── attributions.controller.mjs
│   │   └── health.controller.mjs
│   ├── services/        # Business logic (6 files)
│   │   ├── laws.service.mjs
│   │   ├── votes.service.mjs
│   │   ├── categories.service.mjs
│   │   ├── attributions.service.mjs
│   │   ├── database.service.mjs
│   │   └── email.service.mjs
│   ├── middleware/      # Cross-cutting concerns (2 files)
│   │   ├── cors.mjs
│   │   └── rate-limit.mjs
│   ├── routes/          # Route definitions (1 file)
│   │   └── router.mjs
│   └── utils/           # Helper functions (4 files)
├── tests/               # Comprehensive test coverage (13 test files)
│   ├── controllers/     # Controller unit tests
│   ├── services/        # Service unit tests
│   ├── middleware/      # Middleware unit tests
│   └── utils/           # Utility unit tests
└── scripts/
    └── api-server.mjs   # Main server entry point
```

**Architecture Benefits:**
- **Separation of Concerns**: Controllers handle HTTP, Services handle business logic
- **Testability**: Each layer tested independently with Vitest
- **Maintainability**: ~1000 lines refactored into 18 modular files
- **Scalability**: Easy to add new endpoints and features

### API Versioning

```
Base URL: https://murphys-laws.com/api/v1/

Version Strategy:
- /api/v1/* - Current stable version
- /api/v2/* - Future breaking changes
- Mobile apps specify minimum supported version
```

### Core Endpoints

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/v1/laws` | GET | List laws (paginated, filtered) | 60/min |
| `/api/v1/laws/{id}` | GET | Get single law | 60/min |
| `/api/v1/laws` | POST | Submit new law | 3/min |
| `/api/v1/laws/{id}/vote` | POST | Vote on law | 30/min |
| `/api/v1/laws/{id}/vote` | DELETE | Remove vote | 30/min |
| `/api/v1/law-of-day` | GET | Get daily featured law | 60/min |
| `/api/v1/categories` | GET | List all categories | 60/min |
| `/api/v1/attributions` | GET | List attributions | 60/min |
| `/api/v1/share-calculation` | POST | Email calculation results | 5/min |

### Request/Response Format

#### Example: Fetch Laws
```http
GET /api/v1/laws?limit=25&offset=0&sort=score&order=desc HTTP/1.1
Host: murphys-laws.com
Accept: application/json
X-Device-ID: 550e8400-e29b-41d4-a716-446655440000

HTTP/1.1 200 OK
Content-Type: application/json

{
 "data": [
 {
 "id": 123,
 "text": "If anything can go wrong, it will",
 "title": "Murphy's Original Law",
 "upvotes": 42,
 "downvotes": 3,
 "created_at": "2024-01-15T10:30:00Z",
 "attributions": [
 {
 "name": "Edward A. Murphy Jr.",
 "contact_type": "url",
 "contact_value": "https://en.wikipedia.org/wiki/Edward_A._Murphy_Jr."
 }
 ]
 }
 ],
 "total": 1234,
 "limit": 25,
 "offset": 0
}
```

#### Example: Vote on Law
```http
POST /api/v1/laws/123/vote HTTP/1.1
Host: murphys-laws.com
Content-Type: application/json
X-Device-ID: 550e8400-e29b-41d4-a716-446655440000

{
 "vote_type": "up"
}

HTTP/1.1 200 OK
Content-Type: application/json

{
 "upvotes": 43,
 "downvotes": 3
}
```

### Error Handling

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
 "error": "Rate limit exceeded",
 "message": "Too many votes. Please try again in 60 seconds.",
 "retry_after": 60
}
```

### Device Identification

**Purpose:** Deduplicate votes across devices without authentication

**Implementation:**
- Client generates UUID on first launch
- Stored securely (Keychain on iOS, EncryptedSharedPreferences on Android)
- Sent in `X-Device-ID` header with all vote requests
- Backend uses device_id OR IP address for vote deduplication

```javascript
// Backend (api-server.mjs)
function getUserIdentifier(req) {
 // Priority: device_id > IP address
 return req.headers['x-device-id']
 || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
 || req.headers['x-real-ip']
 || req.socket.remoteAddress;
}
```

---

## iOS Architecture

### Architecture Pattern: MVVM

```
┌─────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ SwiftUI │◄─────│ ViewModel │ │
│ │ Views │ │ (Observable)│ │
│ └──────────────┘ └───────┬──────┘ │
│ │ │
└─────────────────────────────────┼───────────────────────┘
 │
┌─────────────────────────────────▼───────────────────────┐
│ DOMAIN LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Models │ │ Use Cases │ │
│ │ (structs) │ │ (optional) │ │
│ └──────────────┘ └───────┬──────┘ │
│ │ │
└─────────────────────────────────┼───────────────────────┘
 │
┌─────────────────────────────────▼───────────────────────┐
│ DATA LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Repository │──────│ API Client │ │
│ │ │ │ (URLSession)│ │
│ └──────┬───────┘ └──────────────┘ │
│ │ │
│ ┌──────▼───────┐ │
│ │ Cache Service│ │
│ │ (UserDefaults)│ │
│ └──────────────┘ │
│ │
└─────────────────────────────────────────────────────────┘
```

### Key iOS Components

#### 1. Views (SwiftUI)
```swift
struct LawListView: View {
 @StateObject private var viewModel = LawListViewModel()

 var body: some View {
 List {
 ForEach(viewModel.laws) { law in
 LawCardView(law: law)
 .onTapGesture {
 viewModel.selectLaw(law)
 }
 }
 }
 .task {
 await viewModel.loadLaws()
 }
 }
}
```

#### 2. ViewModels
```swift
@MainActor
class LawListViewModel: ObservableObject {
 @Published var laws: [Law] = []
 @Published var isLoading = false
 @Published var error: Error?

 private let repository: LawRepository

 init(repository: LawRepository = LawRepositoryImpl()) {
 self.repository = repository
 }

 func loadLaws() async {
 isLoading = true
 defer { isLoading = false }

 do {
 laws = try await repository.fetchLaws()
 } catch {
 self.error = error
 }
 }
}
```

#### 3. Repository
```swift
protocol LawRepository {
 func fetchLaws(limit: Int, offset: Int) async throws -> [Law]
 func voteLaw(id: Int, voteType: VoteType) async throws -> VoteResponse
}

class LawRepositoryImpl: LawRepository {
 private let apiService: APIService
 private let cacheService: CacheService

 func fetchLaws(limit: Int = 25, offset: Int = 0) async throws -> [Law] {
 // Check cache first
 if let cachedLaws = cacheService.getCachedLaws(), offset == 0 {
 return cachedLaws
 }

 // Fetch from API
 let response = try await apiService.fetchLaws(limit: limit, offset: offset)

 // Cache for future
 if offset == 0 {
 cacheService.cacheLaws(response.data)
 }

 return response.data
 }
}
```

#### 4. API Service
```swift
class APIService {
 let baseURL = "https://murphys-laws.com/api/v1"

 func fetchLaws(limit: Int, offset: Int) async throws -> LawsResponse {
 var components = URLComponents(string: "\(baseURL)/laws")!
 components.queryItems = [
 URLQueryItem(name: "limit", value: "\(limit)"),
 URLQueryItem(name: "offset", value: "\(offset)")
 ]

 let (data, response) = try await URLSession.shared.data(from: components.url!)

 guard let httpResponse = response as? HTTPURLResponse,
 (200...299).contains(httpResponse.statusCode) else {
 throw APIError.invalidResponse
 }

 return try JSONDecoder().decode(LawsResponse.self, from: data)
 }
}
```

### iOS Project Structure

```
MurphysLaws/
├── App/
│ ├── MurphysLawsApp.swift # Entry point
│ └── AppDelegate.swift
├── Models/
│ ├── Law.swift
│ ├── Category.swift
│ └── Vote.swift
├── ViewModels/
│ ├── LawListViewModel.swift
│ ├── LawDetailViewModel.swift
│ └── SearchViewModel.swift
├── Views/
│ ├── Home/
│ ├── Browse/
│ ├── Search/
│ └── Calculators/
├── Services/
│ ├── APIService.swift
│ ├── CacheService.swift
│ └── VotingService.swift
├── Repositories/
│ └── LawRepository.swift
├── Utilities/
│ ├── Constants.swift
│ ├── Extensions/
│ └── NetworkMonitor.swift
└── Resources/
 ├── Assets.xcassets
 └── Info.plist
```

---

## Android Architecture

### Architecture Pattern: MVVM + Clean Architecture

```
┌─────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Compose │◄─────│ ViewModel │ │
│ │ Screens │ │ (StateFlow) │ │
│ └──────────────┘ └───────┬──────┘ │
│ │ │
└─────────────────────────────────┼───────────────────────┘
 │
┌─────────────────────────────────▼───────────────────────┐
│ DOMAIN LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Models │ │ Use Cases │ │
│ │ (data class)│ │ │ │
│ └──────────────┘ └───────┬──────┘ │
│ │ │
│ ┌──────────────────────────────▼──┐ │
│ │ Repository Interfaces │ │
│ └──────────────┬───────────────────┘ │
│ │ │
└─────────────────┼───────────────────────────────────────┘
 │
┌─────────────────▼───────────────────────────────────────┐
│ DATA LAYER │
├─────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────────┐ ┌──────────────┐ │
│ │ Repository Impl │──────│ API Service │ │
│ │ │ │ (Retrofit) │ │
│ └────────┬─────────┘ └──────────────┘ │
│ │ │
│ ┌────────▼─────────┐ │
│ │ Room Database │ │
│ │ (Local Cache) │ │
│ └──────────────────┘ │
│ │
└─────────────────────────────────────────────────────────┘
```

### Key Android Components

#### 1. Screens (Compose)
```kotlin
@Composable
fun LawListScreen(
 viewModel: LawListViewModel = hiltViewModel()
) {
 val uiState by viewModel.uiState.collectAsStateWithLifecycle()

 LazyColumn {
 items(uiState.laws) { law ->
 LawCard(
 law = law,
 onLawClick = { viewModel.onLawClick(law) },
 onVote = { voteType -> viewModel.voteLaw(law.id, voteType) }
 )
 }
 }
}
```

#### 2. ViewModels
```kotlin
@HiltViewModel
class LawListViewModel @Inject constructor(
 private val getLawsUseCase: GetLawsUseCase,
 private val voteLawUseCase: VoteLawUseCase
) : ViewModel() {

 private val _uiState = MutableStateFlow(LawListUiState())
 val uiState: StateFlow<LawListUiState> = _uiState.asStateFlow()

 init {
 loadLaws()
 }

 fun loadLaws() {
 viewModelScope.launch {
 _uiState.update { it.copy(isLoading = true) }

 getLawsUseCase()
 .catch { error ->
 _uiState.update { it.copy(error = error, isLoading = false) }
 }
 .collect { laws ->
 _uiState.update { it.copy(laws = laws, isLoading = false) }
 }
 }
 }

 fun voteLaw(lawId: Int, voteType: VoteType) {
 viewModelScope.launch {
 voteLawUseCase(lawId, voteType)
 .onSuccess { response ->
 // Update law in list with new vote counts
 }
 .onFailure { error ->
 // Show error
 }
 }
 }
}

data class LawListUiState(
 val laws: List<Law> = emptyList(),
 val isLoading: Boolean = false,
 val error: Throwable? = null
)
```

#### 3. Use Cases
```kotlin
class GetLawsUseCase @Inject constructor(
 private val lawRepository: LawRepository
) {
 operator fun invoke(
 limit: Int = 25,
 offset: Int = 0,
 query: String? = null
 ): Flow<List<Law>> = lawRepository.getLaws(limit, offset, query)
}

class VoteLawUseCase @Inject constructor(
 private val lawRepository: LawRepository
) {
 suspend operator fun invoke(
 lawId: Int,
 voteType: VoteType
 ): Result<VoteResponse> = lawRepository.voteLaw(lawId, voteType)
}
```

#### 4. Repository
```kotlin
interface LawRepository {
 fun getLaws(limit: Int, offset: Int, query: String?): Flow<List<Law>>
 suspend fun voteLaw(lawId: Int, voteType: VoteType): Result<VoteResponse>
}

class LawRepositoryImpl @Inject constructor(
 private val apiService: ApiService,
 private val lawDao: LawDao,
 private val networkMonitor: NetworkMonitor
) : LawRepository {

 override fun getLaws(
 limit: Int,
 offset: Int,
 query: String?
 ): Flow<List<Law>> = flow {
 // Emit cached data first (if offset = 0)
 if (offset == 0) {
 val cached = lawDao.getLaws().firstOrNull()
 if (cached.isNotEmpty()) {
 emit(cached.map { it.toDomainModel() })
 }
 }

 // Fetch from API
 try {
 val response = apiService.getLaws(limit, offset, query = query)
 val laws = response.data.map { it.toDomainModel() }

 // Cache if first page
 if (offset == 0) {
 lawDao.insertLaws(laws.map { it.toEntity() })
 }

 emit(laws)
 } catch (e: Exception) {
 // If offline and no cache, throw error
 if (!networkMonitor.isConnected && offset > 0) {
 throw e
 }
 }
 }
}
```

#### 5. API Service (Retrofit)
```kotlin
interface ApiService {
 @GET("laws")
 suspend fun getLaws(
 @Query("limit") limit: Int = 25,
 @Query("offset") offset: Int = 0,
 @Query("q") query: String? = null,
 @Query("category_id") categoryId: Int? = null
 ): LawsResponse

 @POST("laws/{id}/vote")
 suspend fun voteLaw(
 @Path("id") id: Int,
 @Body voteRequest: VoteRequest,
 @Header("X-Device-ID") deviceId: String
 ): VoteResponse
}
```

### Android Project Structure

```
app/src/main/java/com/murphyslaws/
├── data/
│ ├── local/
│ │ ├── LawDatabase.kt
│ │ ├── dao/
│ │ └── entities/
│ ├── remote/
│ │ ├── ApiService.kt
│ │ ├── dto/
│ │ └── NetworkModule.kt
│ └── repository/
│ └── LawRepositoryImpl.kt
├── domain/
│ ├── model/
│ ├── repository/
│ └── usecase/
├── presentation/
│ ├── home/
│ ├── browse/
│ ├── search/
│ └── navigation/
├── util/
│ └── Constants.kt
└── di/
 ├── AppModule.kt
 └── DatabaseModule.kt
```

---

## Shared Components & Patterns

### 1. Voting System

Both platforms implement identical voting logic:

```
User Interaction Flow:
1. User taps upvote button
2. UI updates immediately (optimistic update)
3. Vote stored locally (UserDefaults/DataStore)
4. API request sent in background
5. On success: Keep UI update
6. On failure: Revert UI, show error

State Management:
- Local vote state: { law_id: vote_type }
- Persisted across app restarts
- Synced with backend on each vote action
```

**iOS Implementation:**
```swift
class VotingService {
 func voteLaw(id: Int, voteType: VoteType) async throws {
 // 1. Update local state
 VoteManager.shared.setVote(voteType, for: id)

 // 2. Update UI (via notification/Combine)
 NotificationCenter.default.post(name: .lawVoteChanged, object: id)

 // 3. Send to backend
 do {
 let response = try await apiService.voteLaw(id: id, voteType: voteType)
 // Success - local state already updated
 } catch {
 // Revert local state
 VoteManager.shared.removeVote(for: id)
 throw error
 }
 }
}
```

**Android Implementation:**
```kotlin
class VotingService @Inject constructor(
 private val apiService: ApiService,
 private val voteManager: VoteManager
) {
 suspend fun voteLaw(lawId: Int, voteType: VoteType): Result<VoteResponse> {
 // 1. Update local state
 voteManager.setVote(lawId, voteType)

 // 2. Send to backend
 return try {
 val deviceId = DeviceInfo.getDeviceId()
 val response = apiService.voteLaw(lawId, VoteRequest(voteType.value), deviceId)
 Result.success(response)
 } catch (e: Exception) {
 // Revert local state
 voteManager.removeVote(lawId)
 Result.failure(e)
 }
 }
}
```

### 2. Search Implementation

**Debouncing Pattern:**

Both platforms debounce search input to avoid excessive API calls.

**iOS (Combine):**
```swift
class SearchViewModel: ObservableObject {
 @Published var searchQuery = ""
 @Published var results: [Law] = []

 private var cancellables = Set<AnyCancellable>()

 init() {
 $searchQuery
 .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
 .removeDuplicates()
 .sink { [weak self] query in
 self?.performSearch(query: query)
 }
 .store(in: &cancellables)
 }
}
```

**Android (Flow):**
```kotlin
class SearchViewModel @Inject constructor(
 private val searchLawsUseCase: SearchLawsUseCase
) : ViewModel() {

 private val searchQuery = MutableStateFlow("")

 val searchResults: StateFlow<List<Law>> = searchQuery
 .debounce(300)
 .distinctUntilChanged()
 .flatMapLatest { query ->
 if (query.isEmpty()) {
 flowOf(emptyList())
 } else {
 searchLawsUseCase(query)
 }
 }
 .stateIn(
 scope = viewModelScope,
 started = SharingStarted.WhileSubscribed(5000),
 initialValue = emptyList()
 )
}
```

### 3. Pagination

**iOS:**
- Use `onAppear` on last item to trigger next page load
- Track `currentPage` and `hasMore` in ViewModel
- Append new results to existing array

**Android:**
- Use Paging 3 library for automatic pagination
- `PagingSource` handles page loading logic
- `LazyColumn` with `items(pagingItems)` for UI

---

## Data Flow & State Management

### iOS State Management (SwiftUI + Combine)

```
User Action
 ↓
View Event
 ↓
ViewModel Method
 ↓
Repository/Service Call
 ↓
Update @Published Properties
 ↓
SwiftUI Auto-Refresh
 ↓
UI Update
```

**Example:**
```swift
// View
Button("Upvote") {
 viewModel.vote(.up)
}

// ViewModel
@Published var voteCount = 0

func vote(_ type: VoteType) {
 Task {
 // Optimistic update
 voteCount += 1

 do {
 let response = try await repository.voteLaw(id: lawId, voteType: type)
 voteCount = response.upvotes // Update with server value
 } catch {
 voteCount -= 1 // Revert
 errorMessage = error.localizedDescription
 }
 }
}
```

### Android State Management (StateFlow + Compose)

```
User Action
 ↓
ViewModel Event Handler
 ↓
Use Case Execution (Coroutine)
 ↓
Update StateFlow/MutableState
 ↓
Compose Recomposition
 ↓
UI Update
```

**Example:**
```kotlin
// Screen
Button(onClick = { viewModel.vote(VoteType.UP) }) {
 Text("Upvote")
}

// ViewModel
private val _uiState = MutableStateFlow(LawDetailUiState())
val uiState = _uiState.asStateFlow()

fun vote(voteType: VoteType) {
 viewModelScope.launch {
 // Optimistic update
 _uiState.update { it.copy(upvotes = it.upvotes + 1) }

 voteLawUseCase(lawId, voteType)
 .onSuccess { response ->
 _uiState.update { it.copy(upvotes = response.upvotes) }
 }
 .onFailure { error ->
 _uiState.update { it.copy(upvotes = it.upvotes - 1) }
 }
 }
}
```

---

## Offline Support Strategy

### Caching Layers

```
┌─────────────────────────────────────┐
│ USER INTERFACE │
└────────────┬────────────────────────┘
 │
 ▼
┌─────────────────────────────────────┐
│ IN-MEMORY CACHE │
│ (ViewModel state, last used data) │
└────────────┬────────────────────────┘
 │
 ▼
┌─────────────────────────────────────┐
│ PERSISTENT CACHE │
│ iOS: UserDefaults / CoreData │
│ Android: DataStore / Room │
└────────────┬────────────────────────┘
 │
 ▼
┌─────────────────────────────────────┐
│ NETWORK API │
│ (Source of truth) │
└─────────────────────────────────────┘
```

### Cache Strategy

**MVP (Simple Caching):**
- Cache last 25 laws from browse screen (1-hour TTL)
- Cache categories list (24-hour TTL)
- Cache attributions list (24-hour TTL)
- Store vote state locally (no TTL, sync on action)

**Post-MVP (Full Offline Mode):**
- Cache last 100 viewed laws
- Queue write operations (votes, submissions)
- Sync queue when connection restored
- Conflict resolution for votes

### Implementation

**iOS (UserDefaults for MVP):**
```swift
class CacheService {
 func cacheLaws(_ laws: [Law]) {
 let encoder = JSONEncoder()
 if let data = try? encoder.encode(laws) {
 UserDefaults.standard.set(data, forKey: "cached_laws")
 UserDefaults.standard.set(Date(), forKey: "cached_laws_timestamp")
 }
 }

 func getCachedLaws() -> [Law]? {
 guard let timestamp = UserDefaults.standard.object(forKey: "cached_laws_timestamp") as? Date,
 Date().timeIntervalSince(timestamp) < 3600, // 1 hour
 let data = UserDefaults.standard.data(forKey: "cached_laws") else {
 return nil
 }

 let decoder = JSONDecoder()
 return try? decoder.decode([Law].self, from: data)
 }
}
```

**Android (Room for Post-MVP):**
```kotlin
@Database(entities = [LawEntity::class], version = 1)
abstract class LawDatabase : RoomDatabase() {
 abstract fun lawDao(): LawDao
}

@Dao
interface LawDao {
 @Query("SELECT * FROM laws WHERE cachedAt > :minTimestamp ORDER BY id DESC LIMIT 100")
 fun getCachedLaws(minTimestamp: Long = System.currentTimeMillis() - 3600000): Flow<List<LawEntity>>

 @Insert(onConflict = OnConflictStrategy.REPLACE)
 suspend fun insertLaws(laws: List<LawEntity>)

 @Query("DELETE FROM laws WHERE cachedAt < :timestamp")
 suspend fun clearOldCache(timestamp: Long)
}
```

---

## Push Notifications

### Architecture

```
┌─────────────────┐
│ Mobile Apps │
│ (iOS/Android) │
└────────┬────────┘
 │
 │ Register device token
 ▼
┌─────────────────┐
│ Backend API │
│ (Node.js) │
└────────┬────────┘
 │
 │ Store tokens
 ▼
┌─────────────────┐
│ Database │
│ (device_tokens│
│ table) │
└─────────────────┘

Daily Job (Cron):
┌─────────────────┐
│ Law of Day │
│ Selection Script│
└────────┬────────┘
 │
 ▼
┌─────────────────┐
│ FCM Service │
│ (Send to all │
│ registered │
│ devices) │
└─────────────────┘
```

### Implementation Plan (Post-MVP)

#### Backend Changes

**Database Schema:**
```sql
CREATE TABLE device_tokens (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id TEXT UNIQUE NOT NULL,
 token TEXT NOT NULL,
 platform TEXT CHECK(platform IN ('ios', 'android')) NOT NULL,
 notification_enabled BOOLEAN DEFAULT 1,
 notification_time TEXT DEFAULT '09:00', -- Local time
 timezone TEXT DEFAULT 'UTC',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API Endpoints:**
```javascript
// Register device token
POST /api/v1/notifications/register
Body: {
 device_id: "uuid",
 token: "fcm_token",
 platform: "ios",
 notification_time: "09:00",
 timezone: "America/New_York"
}

// Unregister device
DELETE /api/v1/notifications/unregister
Body: { device_id: "uuid" }

// Update preferences
PUT /api/v1/notifications/preferences
Body: {
 device_id: "uuid",
 notification_enabled: true,
 notification_time: "10:00"
}
```

**Daily Notification Script:**
```javascript
// scripts/send-law-of-day-notification.mjs
import admin from 'firebase-admin';
import Database from 'better-sqlite3';

async function sendLawOfDayNotifications() {
 const db = new Database('db/murphys-laws.sqlite');

 // Get today's law
 const law = db.prepare(`
 SELECT l.* FROM laws l
 JOIN law_of_the_day_history h ON l.id = h.law_id
 WHERE h.featured_date = DATE('now')
 `).get();

 // Get all device tokens with notifications enabled
 const devices = db.prepare(`
 SELECT * FROM device_tokens
 WHERE notification_enabled = 1
 `).all();

 // Group by timezone and send at appropriate time
 for (const device of devices) {
 const message = {
 notification: {
 title: "Law of the Day",
 body: law.text.substring(0, 100) + "..."
 },
 data: {
 law_id: law.id.toString(),
 type: "law_of_day"
 },
 token: device.token
 };

 await admin.messaging().send(message);
 }
}
```

#### iOS Implementation

```swift
import UserNotifications
import FirebaseMessaging

class NotificationService {
 func requestPermission() {
 UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
 if granted {
 DispatchQueue.main.async {
 UIApplication.shared.registerForRemoteNotifications()
 }
 }
 }
 }

 func registerDeviceToken(_ fcmToken: String) async {
 let deviceId = DeviceInfo.deviceID
 let request = NotificationRegistrationRequest(
 deviceId: deviceId,
 token: fcmToken,
 platform: "ios",
 notificationTime: "09:00",
 timezone: TimeZone.current.identifier
 )

 try? await apiService.registerForNotifications(request)
 }
}

// AppDelegate
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
 Messaging.messaging().apnsToken = deviceToken

 Messaging.messaging().token { token, error in
 if let token = token {
 Task {
 await NotificationService.shared.registerDeviceToken(token)
 }
 }
 }
}
```

#### Android Implementation

```kotlin
class NotificationService @Inject constructor(
 private val apiService: ApiService
) {
 suspend fun registerForNotifications() {
 FirebaseMessaging.getInstance().token.await()?.let { token ->
 val deviceId = DeviceInfo.getDeviceId()
 val request = NotificationRegistrationRequest(
 deviceId = deviceId,
 token = token,
 platform = "android",
 notificationTime = "09:00",
 timezone = TimeZone.getDefault().id
 )

 apiService.registerForNotifications(request)
 }
 }
}

class FirebaseMessagingService : FirebaseMessagingService() {
 override fun onMessageReceived(remoteMessage: RemoteMessage) {
 remoteMessage.notification?.let { notification ->
 showNotification(
 title = notification.title ?: "Murphy's Laws",
 body = notification.body ?: "",
 lawId = remoteMessage.data["law_id"]?.toIntOrNull()
 )
 }
 }

 override fun onNewToken(token: String) {
 // Update token on backend
 CoroutineScope(Dispatchers.IO).launch {
 NotificationService().registerForNotifications()
 }
 }
}
```

---

## Security & Privacy

### Device Identification

**Purpose:** Deduplicate votes without requiring user accounts

**Implementation:**
- Generate UUID on first app launch
- Store securely:
- iOS: Keychain (encrypted, survives app reinstall)
- Android: EncryptedSharedPreferences
- Never share with third parties
- Used only for vote deduplication

**iOS:**
```swift
import Security

class DeviceInfo {
 static var deviceID: String {
 if let existingID = getKeychainValue(for: "device_id") {
 return existingID
 }

 let newID = UUID().uuidString
 saveToKeychain(value: newID, for: "device_id")
 return newID
 }

 private static func saveToKeychain(value: String, for key: String) {
 let data = value.data(using: .utf8)!
 let query: [String: Any] = [
 kSecClass as String: kSecClassGenericPassword,
 kSecAttrAccount as String: key,
 kSecValueData as String: data
 ]
 SecItemAdd(query as CFDictionary, nil)
 }
}
```

**Android:**
```kotlin
class DeviceInfo(private val context: Context) {
 private val sharedPreferences = EncryptedSharedPreferences.create(
 "secure_prefs",
 MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
 context,
 EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
 EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
 )

 fun getDeviceId(): String {
 return sharedPreferences.getString("device_id", null) ?: run {
 val newId = UUID.randomUUID().toString()
 sharedPreferences.edit().putString("device_id", newId).apply()
 newId
 }
 }
}
```

### HTTPS Only

**iOS (Info.plist):**
```xml
<key>NSAppTransportSecurity</key>
<dict>
 <key>NSAllowsArbitraryLoads</key>
 <false/>
</dict>
```

**Android (network_security_config.xml):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
 <base-config cleartextTrafficPermitted="false">
 <trust-anchors>
 <certificates src="system" />
 </trust-anchors>
 </base-config>
</network-security-config>
```

### Data Privacy

**What We Collect:**
- Device ID (anonymous UUID)
- Vote data (law_id + vote_type)
- Optional: Email for submissions (user-provided)
- Optional: FCM token for notifications

**What We Don't Collect:**
- Name, phone, address
- Location data
- Device identifiers (IDFA, Android ID)
- Browsing history outside the app
- Third-party tracking

**Privacy Policy Updates:**
- Add mobile-specific data collection section
- Explain device ID usage
- Explain FCM token usage
- Right to deletion (delete device_id from backend)

---

## Performance Optimization

### Best Practices

#### iOS
1. **Use LazyVStack for lists** - Only renders visible items
2. **Image caching** - Cache downloaded images (if applicable)
3. **Debounce search** - Reduce API calls
4. **Pagination** - Load 25 items at a time
5. **Background threading** - Network calls on background queue
6. **Avoid force-unwrapping** - Use optional binding

#### Android
1. **Use LazyColumn** - Efficient list rendering
2. **Paging 3** - Automatic pagination
3. **Coroutines** - Non-blocking async operations
4. **Room caching** - Fast local reads
5. **ProGuard/R8** - Code minification for smaller APK
6. **Baseline profiles** - Improve startup time

### Monitoring

**iOS:**
- Xcode Instruments (Time Profiler, Network)
- MetricKit for production metrics
- Firebase Performance Monitoring

**Android:**
- Android Studio Profiler (CPU, Memory, Network)
- Firebase Performance Monitoring
- Google Play Console vitals

---

## Testing Strategy

### Unit Tests

**iOS:**
```swift
class LawViewModelTests: XCTestCase {
 func testVotingUpdatesCount() async {
 let mockRepo = MockLawRepository()
 let viewModel = LawViewModel(repository: mockRepo)

 await viewModel.vote(.up)

 XCTAssertEqual(viewModel.upvotes, 1)
 }
}
```

**Android:**
```kotlin
class LawViewModelTest {
 @Test
 fun `voting updates count`() = runTest {
 val mockRepo = FakeLawRepository()
 val viewModel = LawViewModel(mockRepo)

 viewModel.vote(VoteType.UP)

 assertEquals(1, viewModel.uiState.value.upvotes)
 }
}
```

### UI Tests

**iOS (XCUITest):**
```swift
func testBrowseLaws() {
 let app = XCUIApplication()
 app.launch()

 app.tabBars.buttons["Browse"].tap()
 XCTAssertTrue(app.tables.cells.count > 0)
}
```

**Android (Compose UI Test):**
```kotlin
@Test
fun browseLawsDisplaysList() {
 composeTestRule.setContent {
 LawListScreen()
 }

 composeTestRule.onNodeWithText("Murphy's Law").assertExists()
}
```

---

## Deployment & CI/CD

### iOS Deployment

**TestFlight (Beta):**
```bash
# Build archive
xcodebuild archive \
 -workspace MurphysLaws.xcworkspace \
 -scheme MurphysLaws \
 -archivePath build/MurphysLaws.xcarchive

# Export IPA
xcodebuild -exportArchive \
 -archivePath build/MurphysLaws.xcarchive \
 -exportPath build/ \
 -exportOptionsPlist ExportOptions.plist

# Upload to TestFlight
xcrun altool --upload-app \
 -f build/MurphysLaws.ipa \
 -u $APPLE_ID \
 -p $APP_SPECIFIC_PASSWORD
```

**App Store Release:**
- Increment version (CFBundleShortVersionString)
- Update release notes
- Submit for review via App Store Connect
- Wait 1-3 days for review

### Android Deployment

**Google Play (Internal Testing):**
```bash
# Build release APK/AAB
./gradlew bundleRelease

# Sign with release key
jarsigner -verbose \
 -keystore release.keystore \
 app/build/outputs/bundle/release/app-release.aab \
 upload

# Upload to Play Console (manual or via API)
```

**Production Release:**
- Increment versionCode and versionName
- Update release notes
- Upload to Production track
- Staged rollout (10% → 50% → 100%)

### CI/CD Pipeline (GitHub Actions)

```yaml
name: iOS Build & Test

on:
 push:
 branches: [ main ]
 pull_request:
 branches: [ main ]

jobs:
 build:
 runs-on: macos-latest
 steps:
 - uses: actions/checkout@v3
 - name: Build
 run: xcodebuild build -workspace MurphysLaws.xcworkspace -scheme MurphysLaws
 - name: Test
 run: xcodebuild test -workspace MurphysLaws.xcworkspace -scheme MurphysLaws
```

---

## Appendix

### Useful Resources

**iOS:**
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui/)
- [URLSession](https://developer.apple.com/documentation/foundation/urlsession)

**Android:**
- [Material Design 3](https://m3.material.io/)
- [Jetpack Compose](https://developer.android.com/jetpack/compose)
- [Android Architecture Components](https://developer.android.com/topic/architecture)

**Backend:**
- [API Versioning Best Practices](https://www.freecodecamp.org/news/rest-api-design-best-practices-build-a-rest-api/)
- [Rate Limiting Strategies](https://stripe.com/blog/rate-limiters)

---

**Document Owner:** Development Team
**Stakeholders:** iOS Engineers, Android Engineers, Backend Engineers, QA
**Review Cycle:** Monthly during development, quarterly post-launch
