# Murphy's Laws - TODO

## Urgent / High Priority

### Re-enable E2E Tests
**Status:** Blocked - API proxy issue in CI
**Location:** `.github/workflows/web-ci.yml` (currently commented out)

**Problem:**
E2E tests are temporarily disabled because the Vite dev server's API proxy doesn't work in CI. The frontend loads successfully, but API calls to `/api/v1/law-of-day` and `/api/v1/laws` fail, causing no dynamic content to render.

**What We've Tried:**
- Fixed health check endpoint paths (`/api/health`)
- Fixed port configuration (5175)
- Changed host binding to `0.0.0.0`
- Fixed database creation with all migrations
- Corrected test selectors
- Verified backend CORS configuration

**Possible Solutions:**
1. **Debug Vite proxy in CI:**
 - Add logging to see if proxy receives requests
 - Check if backend server is actually accessible from Vite process
 - Investigate CI networking/process isolation issues

2. **Alternative approach:**
 - Use built files instead of dev server
 - Set up nginx or static server with proxy configuration
 - Or run backend and frontend on same origin

3. **Simplify tests:**
 - Focus on static content and navigation only
 - Move API-dependent tests to integration tests that mock responses

**Files to modify when re-enabling:**
- `.github/workflows/web-ci.yml` - Uncomment `e2e-tests` job
- `web/playwright.config.ts` - May need configuration adjustments
- `web/e2e/navigation.spec.ts` - Tests are ready, just need working API

**References:**
- Commit: `972775b` - Where E2E tests were disabled
- Playwright docs: https://playwright.dev/docs/test-webserver

---

## Recently Fixed (Nov 2025)

### Backend Refactoring to Modular Architecture
**Status:** Complete
**Files:** `backend/src/*`, `backend/tests/*`, `backend/scripts/api-server.mjs`, `backend/package.json`

**Problem:** The backend API server was a monolithic file (~1000 lines) with all logic in `api-server.mjs`, making it difficult to test, maintain, and extend.

**Solution:** Refactored to a **modular layered architecture** following best practices:

**New Structure:**
- **Controllers** (5 files): Handle HTTP requests/responses
  - `laws.controller.mjs`, `votes.controller.mjs`, `categories.controller.mjs`, `attributions.controller.mjs`, `health.controller.mjs`
- **Services** (6 files): Business logic and database operations
  - `laws.service.mjs`, `votes.service.mjs`, `categories.service.mjs`, `attributions.service.mjs`, `database.service.mjs`, `email.service.mjs`
- **Middleware** (2 files): Cross-cutting concerns
  - `cors.mjs`, `rate-limit.mjs`
- **Routes** (1 file): Centralized routing
  - `router.mjs`
- **Utils** (4 files): Helper functions
  - `constants.js`, `helpers.js`, `http-helpers.js`, `facebook-signed-request.js`

**Testing:**
- Added **Vitest** as test framework
- Created **13 comprehensive unit tests** covering:
  - All 5 controllers
  - All 4 main services (laws, categories, votes, attributions)
  - Both middleware components (CORS, rate limiting)
  - Utility functions
- Test command: `npm test` (previously returned placeholder message)
- Coverage tracking enabled

**Benefits:**
- **Maintainability**: Clear separation of concerns
- **Testability**: Each component can be tested in isolation
- **Scalability**: Easy to add new features/endpoints
- **Code Quality**: Reduced from ~1000 lines to ~18 modular files

### MathJax Formula Rendering
**Status:** Fixed
**Files:** `web/src/views/sods-calculator.js`, `web/src/views/buttered-toast-calculator.js`

**Problem:** Mathematical formulas were displaying as raw LaTeX code instead of rendered math notation.

**Root Cause:** Timing issue - formulas were set before MathJax loaded, and MathJax rendering was called before DOM updates completed.

**Solution:**
- Deferred initial formula rendering until `ensureMathJax()` resolves
- Wrapped `MathJax.typesetPromise()` in `requestAnimationFrame()` to ensure DOM is updated before processing

---

## Recently Completed

### iOS App MVP
**Status:** Complete - All core features implemented
**Location:** `ios/MurphysLaws/`

**What's Done:**
- MVVM architecture with Repository pattern
- Complete data models (Law, Category, Attribution, Vote)
- API service with URLSession (no external dependencies)
- Repository layer with caching (UserDefaults)
- ViewModels for all features
- Complete UI implementation:
 - Home view with Law of the Day
 - Browse laws with search and filters
 - Category browsing with grid layout
 - Law detail with voting functionality
 - Sod's Law Calculator with interactive sliders
 - Submit law form with categories and attribution
 - Settings and about pages

**Next Steps for iOS:**
- Create Xcode project file (.xcodeproj)
- Add app icons and launch screen
- Configure Info.plist and entitlements
- Unit test coverage for ViewModels
- UI test coverage with XCTest
- App Store submission preparation

**Documentation:**
- README: `ios/README.md`
- Setup Guide: `ios/SETUP.md`
- PRD: `shared/docs/MOBILE-IOS-PRD.md`

---

## Potential Next Steps for Murphy's Laws

## User Engagement Features
- Comments/Discussion: Allow users to share stories about when they've experienced each law
- User Accounts: Enable users to save favorite laws, track their submissions
- Law Collections: Let users create themed collections (e.g., "Work Laws", "Tech Laws")

## Content Enhancements
- Categories/Tags: Organize laws by theme (work, life, technology, relationships)
- Related Laws: Show similar or related laws on detail pages
- Law Origins: Add historical context and original sources where known

## Gamification
- Badges/Achievements: Award badges for voting, submitting, commenting
- Leaderboards: Top contributors, most upvoted submissions
- Daily Streak: Encourage users to visit daily to see Law of the Day

## Technical Improvements
- API Rate Limiting: Add proper rate limiting to prevent abuse
- Analytics Dashboard: Track popular laws, user engagement, traffic sources
- Mobile App: PWA (Progressive Web App) support or native mobile app
- Newsletter: Weekly digest of top laws via email
- RSS Feed: Allow users to subscribe to new laws

## Moderation & Quality
- Duplicate Detection: Flag potential duplicate submissions
- Submission Guidelines: More detailed rules for what makes a good Murphy's Law
- Admin Dashboard: Better tools for reviewing and managing submissions
- Report System: Let users flag inappropriate content
