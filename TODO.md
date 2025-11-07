# Murphy's Laws - TODO

## 🔴 Urgent / High Priority

### Re-enable E2E Tests
**Status:** Blocked - API proxy issue in CI
**Location:** `.github/workflows/web-ci.yml` (currently commented out)

**Problem:**
E2E tests are temporarily disabled because the Vite dev server's API proxy doesn't work in CI. The frontend loads successfully, but API calls to `/api/v1/law-of-day` and `/api/v1/laws` fail, causing no dynamic content to render.

**What We've Tried:**
- ✅ Fixed health check endpoint paths (`/api/health`)
- ✅ Fixed port configuration (5175)
- ✅ Changed host binding to `0.0.0.0`
- ✅ Fixed database creation with all migrations
- ✅ Corrected test selectors
- ✅ Verified backend CORS configuration

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

## 🟢 Potential Next Steps for Murphy's Laws

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
