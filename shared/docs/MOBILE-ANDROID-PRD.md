# Murphy's Laws - Android App Product Requirements Document

**Version:** 1.0
**Last Updated:** November 6, 2025
**Platform:** Android 8.0+ (API 26+)
**Development Language:** Kotlin
**UI Framework:** Jetpack Compose

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
Create a native Android application for Murphy's Laws that provides users with a seamless mobile experience for browsing, searching, and interacting with Murphy's Laws - humorous observations about life's tendency for things to go wrong.

### Goals
- Deliver a fast, native Android experience matching web app functionality
- Leverage Material Design 3 (Material You) principles
- Maintain 100% feature parity with web application and iOS app
- Achieve Google Play rating of 4.5+ stars

### Target Audience
- Android users aged 18-65
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
The Android app will be a native Kotlin application that:
- Uses the existing `/api/v1/` backend
- Provides offline caching for recently viewed laws
- Implements Material Design 3 (Material You) principles
- Delivers superior performance compared to mobile web
- Supports Android 8.0+ (97% of active devices)

### Value Proposition
**For Users:**
- Fast, native Material You experience
- Offline access to favorite laws
- Android share integration for easy sharing
- Home screen widgets for daily law delivery
- Native Material Design animations

**For Business:**
- Expanded user base (Android represents 70% of global smartphone market)
- Increased engagement through push notifications
- Google Play visibility and discoverability
- Better monetization through native ad integration

---

## User Personas

### Persona 1: "Developer Dan"
- **Age:** 30
- **Occupation:** Android Developer
- **Goals:** Quick entertainment during breaks, share funny laws with team
- **Pain Points:** Web apps feel slow on mobile, wants offline access
- **Device:** Google Pixel 8
- **Usage Pattern:** Multiple short sessions per day (2-5 minutes)

### Persona 2: "Manager Maria"
- **Age:** 45
- **Occupation:** Project Manager
- **Goals:** Find relatable workplace humor, share with colleagues
- **Pain Points:** Needs quick access, doesn't want to open browser
- **Device:** Samsung Galaxy S23
- **Usage Pattern:** Daily during lunch break (10-15 minutes)

### Persona 3: "Student Steve"
- **Age:** 19
- **Occupation:** College Student
- **Goals:** Procrastination material, share on social media
- **Pain Points:** Limited data plan, wants offline mode
- **Device:** OnePlus Nord (mid-range device)
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
- ✅ Display law cards with text, upvote/downvote counts, and category chips
- ✅ Implement pagination matching web app (25 laws per page)
- ✅ SwipeRefresh for pull-to-refresh
- ✅ Infinite scroll automatically loads next page when scrolling near bottom
- ✅ Loading states with shimmer effect (Compose placeholder)
- ✅ Error states with retry button

**API Endpoints:**
- `GET /api/v1/laws?limit=25&offset=0&sort=score&order=desc`

**Technical Notes:**
- Use `LazyColumn` for efficient rendering
- Implement `Paging 3` library for pagination
- Cache with Room database (1-hour TTL)

---

#### 2. Law Detail View
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to tap a law to see its full details
- As a user, I want to see attributions (who submitted it)
- As a user, I want to vote on laws from the detail view
- As a user, I want to share laws via Android share sheet

**Acceptance Criteria:**
- ✅ Full law text displayed with Material 3 typography
- ✅ Attribution names with contact info (if available)
- ✅ Vote buttons with real-time count updates
- ✅ Native Android share sheet integration
- ✅ Related laws section (if available)
- ✅ Category chips (tappable to filter)

**API Endpoints:**
- `GET /api/v1/laws/{id}`
- `POST /api/v1/laws/{id}/vote`
- `DELETE /api/v1/laws/{id}/vote`

**Technical Notes:**
- Use Android `Intent.ACTION_SEND` for sharing
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
- ✅ Vote buttons change color when voted (Material 3 colors)
- ✅ Vote counts update immediately (optimistic UI)
- ✅ Haptic feedback on vote action (Vibrator API)
- ✅ Vote state persists across app restarts (SharedPreferences + backend sync)
- ✅ Handle vote conflicts (e.g., already voted from web)

**API Endpoints:**
- `POST /api/v1/laws/{id}/vote` - Body: `{"vote_type": "up"}`
- `DELETE /api/v1/laws/{id}/vote`

**Technical Notes:**
- Store votes locally in DataStore: `votes_law_123: "up"`
- Send device ID in API headers for deduplication
- Handle offline voting (queue in Room, sync when online)

---

#### 4. Search & Filters
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to search laws by text
- As a user, I want to filter laws by category
- As a user, I want to filter laws by attribution/submitter
- As a user, I want to see search suggestions

**Acceptance Criteria:**
- ✅ Search bar in top app bar with real-time results
- ✅ Category filter chips (horizontal scrollable)
- ✅ Attribution dropdown/dialog picker
- ✅ Combined filters (e.g., search + category)
- ✅ Clear filters button
- ✅ Search history (last 10 searches)

**API Endpoints:**
- `GET /api/v1/laws?q=murphy&category_id=5&attribution=John`
- `GET /api/v1/categories`
- `GET /api/v1/attributions`

**Technical Notes:**
- Debounce search input (300ms using Flow)
- Cache category/attribution lists in DataStore with 24-hour TTL
- Use Material 3 SearchBar component

---

#### 5. Law of the Day
**Priority:** P0 (Must Have)

**User Stories:**
- As a user, I want to see a featured "Law of the Day" on the home screen
- As a user, I want a daily push notification for Law of the Day (opt-in)
- As a user, I want to view past Laws of the Day

**Acceptance Criteria:**
- ✅ Dedicated "Law of the Day" card on home screen
- ✅ Special styling/badge to distinguish it
- ✅ Tap to view full details
- ✅ Share button directly from card
- ✅ Push notification opt-in during onboarding
- ✅ Notification sent at user-selected time (default 9 AM local time)

**API Endpoints:**
- `GET /api/v1/law-of-day`

**Technical Notes:**
- Use `WorkManager` for daily scheduled notifications
- Fetch Law of the Day on app launch and cache
- Firebase Cloud Messaging (FCM) for push notifications

---

#### 6. Submit New Law
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to submit my own Murphy's Law
- As a user, I want to optionally attribute my submission
- As a user, I want to select a category for my submission
- As a user, I want confirmation when submitted

**Acceptance Criteria:**
- ✅ Form with law text field (10-1000 chars, validated)
- ✅ Optional title field
- ✅ Optional author name and email fields
- ✅ "Submit anonymously" switch
- ✅ Category dropdown (required)
- ✅ Form validation with inline errors
- ✅ Success confirmation Snackbar
- ✅ Submission status: "Your law is under review"

**API Endpoints:**
- `POST /api/v1/laws`
- `GET /api/v1/categories` (for dropdown)

**Technical Notes:**
- Use Compose `TextField` with validation state
- Disable submit button until valid
- Clear form after successful submission
- Email validation: Android `Patterns.EMAIL_ADDRESS`

---

#### 7. Sod's Law Calculator
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to calculate the probability of something going wrong
- As a user, I want to see the mathematical formula
- As a user, I want to share calculation results

**Acceptance Criteria:**
- ✅ Input sliders for:
  - Urgency (U): 1-10
  - Complexity (C): 1-10
  - Importance (I): 1-10
  - Skill Level (S): 1-10
  - Frequency (F): 1-10
- ✅ Real-time probability calculation
- ✅ Formula display: `((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))`
- ✅ Result interpretation (Low/Medium/High risk)
- ✅ Color-coded result (green/yellow/red)
- ✅ Share via Android share sheet
- ✅ Optional: Email results (uses existing API)

**API Endpoints:**
- `POST /api/v1/share-calculation` (optional, for email)

**Technical Notes:**
- Formula rendering: Use Compose `Text` with formatted string
- Alternative: Render formula as SVG from backend, display in Image
- Share text: "My task has a {probability}% chance of going wrong! #MurphysLaw"

---

#### 8. Category Browsing
**Priority:** P1 (Should Have)

**User Stories:**
- As a user, I want to browse laws by category
- As a user, I want to see category descriptions
- As a user, I want to see how many laws are in each category

**Acceptance Criteria:**
- ✅ List of all categories with law counts
- ✅ Category descriptions/subtitles
- ✅ Tap category to view filtered law list
- ✅ Category icons/colors for visual distinction
- ✅ Alphabetical sorting

**API Endpoints:**
- `GET /api/v1/categories`
- `GET /api/v1/laws?category_id={id}`

**Technical Notes:**
- Cache category list with 24-hour TTL (Room)
- Use Material Icons for category icons
- Dynamic theming with Material You colors

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
- Use Glance framework (Jetpack Compose for widgets)
- WorkManager for daily updates
- RemoteViews for backward compatibility (Android 11-)

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
- Use Room database for local cache
- WorkManager for background sync
- ConnectivityManager for network monitoring

---

#### 11. Buttered Toast Calculator
**Priority:** P2 (Nice to Have)

**Features:**
- Physics-based toast landing calculator
- Input fields: height, gravity, overhang, butter factor
- Formula: `P = (1 - |((30√(H/g) · O · B)/(T + F) mod 1) - 0.5| · 2) · 100%`
- Visual toast animation (Compose Canvas)

**API Endpoints:**
- None (client-side calculation)

---

#### 12. Favorites/Bookmarks
**Priority:** P2 (Nice to Have)

**Features:**
- Bookmark laws for quick access
- Local storage (Room database)
- Favorites screen in navigation
- Sync favorites to backend (requires auth)

---

#### 13. Dark Theme
**Priority:** P2 (Nice to Have)

**Features:**
- System theme support (auto-switch)
- Manual toggle in settings
- Material You dynamic theming

**Technical Notes:**
- Use `isSystemInDarkTheme()` in Compose
- Define dark/light color schemes
- Support Material You wallpaper-based theming

---

## User Interface Design

### Navigation Structure

```
BottomNavigation
├─ Home
│  ├─ Law of the Day Card
│  ├─ Top Voted Laws Widget
│  ├─ Trending Laws Widget
│  └─ Recently Added Laws Widget
├─ Browse
│  ├─ Search Bar
│  ├─ Category Filter Chips
│  ├─ Law List (Infinite Scroll)
│  └─ Law Detail (New Screen)
├─ Categories
│  ├─ Category List
│  └─ Filtered Law List (New Screen)
├─ Calculators
│  ├─ Sod's Law Calculator
│  └─ Toast Calculator (v1.1)
└─ More
   ├─ Submit Law
   ├─ Favorites (v1.1)
   ├─ Settings
   │  ├─ Notification Preferences
   │  ├─ Theme Selection (v1.1)
   │  └─ About/Privacy Policy
   └─ About
```

### Screen Layouts

#### Home Screen (Material 3)
```
┌─────────────────────────┐
│ Top App Bar             │
│ "Murphy's Laws"         │
├─────────────────────────┤
│ 🌟 Law of the Day      │
│ ┌─────────────────────┐ │
│ │ Surface Container   │ │
│ │ "If anything can   │ │
│ │ go wrong, it will" │ │
│ │                     │ │
│ │ ⬆ 42   ⬇ 3   📤   │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Top Voted Laws          │
│ [Horizontal Pager]      │
├─────────────────────────┤
│ Trending Laws           │
│ [Horizontal Pager]      │
└─────────────────────────┘
│ Bottom Navigation       │
└─────────────────────────┘
```

#### Browse Screen
```
┌─────────────────────────┐
│ Search Bar 🔍          │
├─────────────────────────┤
│ [Tech] [Love] [Work]... │ ← Filter chips
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Law Title          │ │
│ │ Law text preview...│ │
│ │ Tech • Office      │ │
│ │ ⬆ 10   ⬇ 2        │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Another law...     │ │
│ └─────────────────────┘ │
│ ... (infinite scroll)   │
└─────────────────────────┘
│ Bottom Navigation       │
└─────────────────────────┘
```

#### Law Detail Screen
```
┌─────────────────────────┐
│ ← Back        📤 Share │
├─────────────────────────┤
│ Law Title (if exists)   │
│                         │
│ Full law text displayed │
│ with Material 3         │
│ typography...           │
│                         │
│ [Technology] [Office]   │ ← Chips
│                         │
│ ⬆ Upvote (42)          │
│ ⬇ Downvote (3)         │
│                         │
│ ─────────────────────── │
│ Attribution:            │
│ Submitted by John Doe   │
│ john@example.com        │
│                         │
│ Related Laws:           │
│ - Similar law 1         │
│ - Similar law 2         │
└─────────────────────────┘
```

#### Sod's Law Calculator
```
┌─────────────────────────┐
│ Sod's Law Calculator    │
├─────────────────────────┤
│ Urgency                 │
│ ━━━━━●━━━━━━━━━━━━━ 5  │
│                         │
│ Complexity              │
│ ━━━━━━━●━━━━━━━━━━━ 7  │
│                         │
│ Importance              │
│ ━━━━━━━━●━━━━━━━━━━ 8  │
│                         │
│ Skill Level             │
│ ━━━━━━●━━━━━━━━━━━━ 6  │
│                         │
│ Frequency               │
│ ━━━━●━━━━━━━━━━━━━━ 4  │
│                         │
│ ─────────────────────── │
│                         │
│ Formula:                │
│ ((U+C+I)×(10-S))/20×... │
│                         │
│ ┌─────────────────────┐ │
│ │ Result: 78.5% 🔴   │ │
│ │ "High risk"        │ │
│ └─────────────────────┘ │
│                         │
│ [Share Results]         │
└─────────────────────────┘
```

### Design System (Material 3)

#### Typography
- **Display Large:** Roboto, 57sp
- **Headline Large:** Roboto, 32sp
- **Headline Medium:** Roboto, 28sp
- **Title Large:** Roboto Medium, 22sp
- **Body Large:** Roboto, 16sp
- **Body Medium:** Roboto, 14sp
- **Label Large:** Roboto Medium, 14sp

#### Material 3 Color Roles (Light Theme)
- **Primary:** Dynamic (Material You) or #6750A4
- **OnPrimary:** #FFFFFF
- **PrimaryContainer:** #EADDFF
- **Secondary:** #625B71
- **Surface:** #FFFBFE
- **SurfaceVariant:** #E7E0EC
- **Error:** #B3261E

#### Material 3 Color Roles (Dark Theme)
- **Primary:** #D0BCFF
- **OnPrimary:** #381E72
- **PrimaryContainer:** #4F378B
- **Secondary:** #CCC2DC
- **Surface:** #1C1B1F
- **SurfaceVariant:** #49454F
- **Error:** #F2B8B5

#### Spacing (dp)
- **XS:** 4dp
- **S:** 8dp
- **M:** 16dp
- **L:** 24dp
- **XL:** 32dp

---

## Technical Requirements

### Platform Support
- **Minimum SDK:** 26 (Android 8.0 Oreo)
- **Target SDK:** 35 (Android 15)
- **Device Support:** Phones, Tablets, Foldables
- **Orientation:** Portrait (phones), All orientations (tablets)

### Architecture

#### Design Pattern
- **MVVM (Model-View-ViewModel)** with Jetpack Compose
- **Clean Architecture** (Domain, Data, Presentation layers)
- **Repository Pattern** for data access
- **Use Cases** for business logic

#### Project Structure
```
app/src/main/
├── java/com/murphyslaws/
│   ├── MurphysLawsApplication.kt  # App entry point
│   ├── MainActivity.kt             # Main activity
│   │
│   ├── data/
│   │   ├── local/
│   │   │   ├── LawDatabase.kt     # Room database
│   │   │   ├── dao/
│   │   │   │   ├── LawDao.kt
│   │   │   │   └── CategoryDao.kt
│   │   │   └── entities/
│   │   │       ├── LawEntity.kt
│   │   │       └── CategoryEntity.kt
│   │   ├── remote/
│   │   │   ├── ApiService.kt      # Retrofit interface
│   │   │   ├── dto/
│   │   │   │   ├── LawDto.kt
│   │   │   │   └── CategoryDto.kt
│   │   │   └── NetworkModule.kt   # Hilt module
│   │   └── repository/
│   │       ├── LawRepositoryImpl.kt
│   │       └── CategoryRepositoryImpl.kt
│   │
│   ├── domain/
│   │   ├── model/
│   │   │   ├── Law.kt             # Domain models
│   │   │   ├── Category.kt
│   │   │   └── Vote.kt
│   │   ├── repository/
│   │   │   ├── LawRepository.kt   # Interfaces
│   │   │   └── CategoryRepository.kt
│   │   └── usecase/
│   │       ├── GetLawsUseCase.kt
│   │       ├── VoteLawUseCase.kt
│   │       └── SearchLawsUseCase.kt
│   │
│   ├── presentation/
│   │   ├── home/
│   │   │   ├── HomeScreen.kt
│   │   │   ├── HomeViewModel.kt
│   │   │   └── components/
│   │   │       └── LawOfTheDayCard.kt
│   │   ├── browse/
│   │   │   ├── LawListScreen.kt
│   │   │   ├── LawListViewModel.kt
│   │   │   ├── LawDetailScreen.kt
│   │   │   ├── LawDetailViewModel.kt
│   │   │   └── components/
│   │   │       ├── LawCard.kt
│   │   │       └── VoteButtons.kt
│   │   ├── search/
│   │   │   ├── SearchScreen.kt
│   │   │   └── SearchViewModel.kt
│   │   ├── categories/
│   │   │   ├── CategoryListScreen.kt
│   │   │   └── CategoryViewModel.kt
│   │   ├── calculators/
│   │   │   ├── SodsLawCalculatorScreen.kt
│   │   │   └── CalculatorViewModel.kt
│   │   ├── submit/
│   │   │   ├── SubmitLawScreen.kt
│   │   │   └── SubmitViewModel.kt
│   │   └── navigation/
│   │       └── NavGraph.kt
│   │
│   ├── util/
│   │   ├── Constants.kt
│   │   ├── DeviceInfo.kt
│   │   ├── NetworkMonitor.kt
│   │   └── DateUtils.kt
│   │
│   └── di/
│       ├── AppModule.kt           # Hilt modules
│       ├── DatabaseModule.kt
│       └── NetworkModule.kt
│
├── res/
│   ├── values/
│   │   ├── colors.xml
│   │   ├── strings.xml
│   │   └── themes.xml
│   ├── drawable/
│   ├── mipmap/                    # App icons
│   └── xml/
│       └── network_security_config.xml
│
└── AndroidManifest.xml
```

### Dependencies (build.gradle.kts)

```kotlin
dependencies {
    // Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // Compose
    val composeBom = platform("androidx.compose:compose-bom:2024.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // Dependency Injection
    implementation("com.google.dagger:hilt-android:2.50")
    kapt("com.google.dagger:hilt-compiler:2.50")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")

    // Network
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Local Storage
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Paging
    implementation("androidx.paging:paging-runtime-ktx:3.2.1")
    implementation("androidx.paging:paging-compose:3.2.1")

    // WorkManager (for notifications)
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Coil (Image loading)
    implementation("io.coil-kt:coil-compose:2.5.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
```

### Networking

#### API Service (Retrofit)
```kotlin
interface ApiService {
    @GET("laws")
    suspend fun getLaws(
        @Query("limit") limit: Int = 25,
        @Query("offset") offset: Int = 0,
        @Query("sort") sort: String = "score",
        @Query("order") order: String = "desc",
        @Query("q") query: String? = null,
        @Query("category_id") categoryId: Int? = null,
        @Query("attribution") attribution: String? = null
    ): LawsResponse

    @GET("laws/{id}")
    suspend fun getLaw(@Path("id") id: Int): Law

    @POST("laws/{id}/vote")
    suspend fun voteLaw(
        @Path("id") id: Int,
        @Body voteRequest: VoteRequest,
        @Header("X-Device-ID") deviceId: String
    ): VoteResponse

    @DELETE("laws/{id}/vote")
    suspend fun unvoteLaw(
        @Path("id") id: Int,
        @Header("X-Device-ID") deviceId: String
    ): VoteResponse

    @GET("law-of-day")
    suspend fun getLawOfTheDay(): LawOfDayResponse

    @GET("categories")
    suspend fun getCategories(): CategoriesResponse

    @POST("laws")
    suspend fun submitLaw(@Body law: SubmitLawRequest): SubmitLawResponse

    @POST("share-calculation")
    suspend fun shareCalculation(@Body calculation: CalculationRequest): GenericResponse
}
```

#### Repository Implementation
```kotlin
class LawRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val lawDao: LawDao,
    private val networkMonitor: NetworkMonitor
) : LawRepository {

    override fun getLaws(
        limit: Int,
        offset: Int,
        query: String?,
        categoryId: Int?
    ): Flow<PagingData<Law>> = Pager(
        config = PagingConfig(pageSize = 25, enablePlaceholders = false),
        pagingSourceFactory = {
            LawPagingSource(apiService, lawDao, query, categoryId)
        }
    ).flow

    override suspend fun voteLaw(lawId: Int, voteType: VoteType): Result<VoteResponse> {
        return try {
            val deviceId = DeviceInfo.getDeviceId()
            val response = apiService.voteLaw(
                id = lawId,
                voteRequest = VoteRequest(voteType.value),
                deviceId = deviceId
            )
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

### Data Models

```kotlin
// Domain Model
data class Law(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String,
    val attributions: List<Attribution>?
) {
    val score: Int get() = upvotes - downvotes
}

// Network DTO
@Serializable
data class LawDto(
    val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    @SerialName("created_at") val createdAt: String,
    val attributions: List<AttributionDto>?
)

// Room Entity
@Entity(tableName = "laws")
data class LawEntity(
    @PrimaryKey val id: Int,
    val text: String,
    val title: String?,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String,
    val cachedAt: Long = System.currentTimeMillis()
)

enum class VoteType(val value: String) {
    UP("up"),
    DOWN("down")
}
```

### Local Storage

#### DataStore (SharedPreferences replacement)
```kotlin
class VoteManager @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val votesKey = stringPreferencesKey("user_votes")

    fun getVote(lawId: Int): Flow<VoteType?> = dataStore.data.map { prefs ->
        prefs[votesKey]?.let { json ->
            val votes = Json.decodeFromString<Map<String, String>>(json)
            votes[lawId.toString()]?.let { VoteType.valueOf(it.uppercase()) }
        }
    }

    suspend fun setVote(lawId: Int, voteType: VoteType) {
        dataStore.edit { prefs ->
            val currentVotes = prefs[votesKey]?.let {
                Json.decodeFromString<MutableMap<String, String>>(it)
            } ?: mutableMapOf()

            currentVotes[lawId.toString()] = voteType.value
            prefs[votesKey] = Json.encodeToString(currentVotes)
        }
    }
}
```

### Error Handling

```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val exception: Exception) : ApiResult<Nothing>()
    object Loading : ApiResult<Nothing>()
}

sealed class ApiError : Exception() {
    object NetworkError : ApiError()
    object ServerError : ApiError()
    data class HttpError(val code: Int) : ApiError()
    object RateLimitExceeded : ApiError()
    object Unknown : ApiError()
}

fun ApiError.toMessage(): String = when (this) {
    is ApiError.NetworkError -> "Network connection failed. Please check your internet."
    is ApiError.ServerError -> "Server error. Please try again later."
    is ApiError.HttpError -> "Error: HTTP $code"
    is ApiError.RateLimitExceeded -> "Too many requests. Please try again later."
    is ApiError.Unknown -> "An unknown error occurred."
}
```

### Performance Requirements
- **App Launch:** < 2 seconds (cold start)
- **Law List Load:** < 1 second (from cache), < 3 seconds (from API)
- **Search Results:** < 500ms (after debounce)
- **Vote Action:** < 200ms (optimistic UI)
- **Memory Usage:** < 100MB (typical), < 200MB (max)
- **APK Size:** < 10MB (base APK)

### Security Requirements
- **API Communication:** HTTPS only (Network Security Config)
- **Device ID:** UUID stored in encrypted DataStore
- **No Authentication:** Anonymous usage (for MVP)
- **Input Validation:** Client-side validation for all forms
- **Rate Limiting:** Respect backend rate limits (30 votes/min)

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### Acquisition
- **Google Play Downloads:** 20,000+ in first 3 months
- **Conversion Rate:** 5% of web users install app
- **Google Play Search Ranking:** Top 50 in "Entertainment" category

#### Engagement
- **Daily Active Users (DAU):** 2,000+ after 3 months
- **Session Duration:** 5+ minutes average
- **Sessions per User:** 3+ per week
- **Law of Day Open Rate:** 20%+ of users with notifications enabled

#### Retention
- **Day 1 Retention:** 50%+
- **Day 7 Retention:** 30%+
- **Day 30 Retention:** 15%+

#### Quality
- **Google Play Rating:** 4.5+ stars
- **Crash-Free Rate:** 99.5%+
- **Performance:** 95% of users experience < 3s load times
- **ANR Rate:** < 0.1%

#### Monetization (Future)
- **Ad Impressions:** 100,000+ per month
- **Ad Click-Through Rate:** 2%+

---

## Development Timeline

### Phase 1: Foundation (Weeks 1-2)
- ✅ Android Studio project setup
- ✅ Hilt dependency injection setup
- ✅ Retrofit API client implementation
- ✅ Room database setup
- ✅ Data models and repositories
- ✅ Basic navigation structure
- ✅ Material 3 theme setup

### Phase 2: Core Features (Weeks 3-5)
- ✅ Home screen with Law of the Day
- ✅ Browse laws list with Paging 3
- ✅ Law detail screen
- ✅ Voting functionality
- ✅ Search and filters
- ✅ Category browsing

### Phase 3: Secondary Features (Weeks 6-7)
- ✅ Submit law form
- ✅ Sod's Law Calculator
- ✅ Share functionality (Android Intent)
- ✅ Settings screen
- ✅ About/Privacy Policy pages

### Phase 4: Polish & Testing (Week 8)
- ✅ UI/UX polish
- ✅ Performance optimization
- ✅ Bug fixes
- ✅ Unit tests (ViewModels, Repositories, UseCases)
- ✅ UI tests (Compose UI tests)
- ✅ Accessibility audit (TalkBack, Large Text)

### Phase 5: Google Play Submission (Week 9)
- ✅ Google Play assets (screenshots, feature graphic)
- ✅ Google Play listing (description, keywords)
- ✅ Privacy policy update
- ✅ Internal testing track
- ✅ Submit for review

**Total Timeline:** 9 weeks (2.25 months) for MVP

---

## Future Enhancements

### Version 1.1 (Post-Launch)
- ✅ Home screen widgets (Glance)
- ✅ Offline mode with Room caching
- ✅ Buttered Toast Calculator
- ✅ Favorites/Bookmarks
- ✅ Material You dynamic theming

### Version 1.2
- ✅ User accounts (Google Sign-In)
- ✅ Cross-device sync (favorites, votes)
- ✅ Law submission voting (upvote pending submissions)
- ✅ Achievement system (e.g., "Voted on 100 laws")

### Version 1.3
- ✅ Social features (comments, discussions)
- ✅ Collections (user-curated lists)
- ✅ Advanced calculator (custom formulas)
- ✅ Android Auto support

### Version 2.0
- ✅ AI-powered law recommendations (ML Kit)
- ✅ Personalized feed based on interests
- ✅ Community features (user profiles, followers)
- ✅ Premium subscription (ad-free, exclusive content)

---

## Appendix

### Google Play Listing

#### App Name
Murphy's Laws - Life Observations

#### Short Description
Discover hundreds of Murphy's Laws - witty observations about things going wrong.

#### Full Description
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
• Beautiful Material You design

Whether you're a tech enthusiast, office worker, or just appreciate good humor,
Murphy's Laws has something for everyone.

PRIVACY:
No account required. No personal data collected. Browse anonymously.

FREE FOREVER:
All features are free. No in-app purchases.

Join thousands of users who appreciate the humor in life's inevitable mishaps!
```

#### Tags/Keywords
```
murphys law, sods law, humor, funny, quotes, laws, observations,
calculator, entertainment, jokes, material you
```

#### Category
Primary: Entertainment
Secondary: Books & Reference

#### Content Rating
Everyone

### Privacy Policy Updates
- Add Android-specific data collection (device ID for voting)
- Mention push notification data (FCM tokens)
- Update "How We Use Your Data" section
- Add section on Material You dynamic theming (wallpaper colors)

### Support & Feedback
- **Email:** support@murphys-laws.com
- **In-App:** Feedback form in Settings
- **GitHub:** Issue tracker for bug reports
- **Google Play:** Review responses within 24 hours

---

**Document Owner:** Development Team
**Stakeholders:** Product Manager, Android Engineers, QA, Design
**Review Cycle:** Monthly during development, quarterly post-launch
