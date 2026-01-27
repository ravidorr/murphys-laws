# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## SEO Recommendations (External / Manual)
- [ ] **Link Reclamation:** Identify broken links on high-authority sites (e.g., .edu domains) that mention 'Murphy\'s Law' and reach out to suggest our archive as a replacement reference.
- [ ] **Calculator Outreach:** Pitch the 'Buttered Toast Landing Calculator' to physics and science education blogs as a fun, interactive teaching tool to generate fresh backlinks.
- [x] **Per-Law Open Graph Images:** ~~Generate dynamic OG images for each law to improve social sharing appearance.~~ Done - implemented `GET /api/v1/og/law/:id.png` endpoint that generates PNG images using node-canvas. Images are cached for 1 day and include law title, text, and branding. See `backend/src/services/og-image.service.mjs`.
- [x] **Print Styles:** ~~Add print-optimized CSS for law pages.~~ Done - added `web/styles/partials/print.css` with `@media print` rules. Hides interactive elements (search, widgets, pagination, vote buttons) and optimizes typography for clean paper output.

## UX Improvements (Require Backend Work)
- [x] **Search Autocomplete/Suggestions:** ~~Add debounced search suggestions as the user types in the header search field. Requires a new backend endpoint (`/api/v1/laws/suggestions`) to return top matching laws. Include keyboard navigation (arrow keys, Enter) for the dropdown.~~ Done - added debounced search autocomplete (240ms delay, configurable) with keyboard navigation (ArrowDown/ArrowUp, Enter, Escape) and WCAG-compliant contrast. Backend endpoint `/api/v1/laws/suggestions` returns top matching laws optimized for autocomplete.
- [x] **Related Laws Section on Law Detail Page:** ~~Show 3-5 related laws from the same category on the law detail page. Requires adding a `getRelatedLaws(lawId, categoryId)` method to `backend/src/services/laws.service.mjs` and a new API endpoint.~~ Done - law detail page displays related laws from the same category with voting and share functionality.
- [x] **Category Descriptions:** ~~Add descriptions to category pages. Requires database migration to add `description` column to categories table, then populate descriptions for all 55 categories.~~ Done - added migration `010_populate_category_descriptions.sql` with witty descriptions for all 55 categories. Descriptions display on category detail pages with fallback text and are included in structured data.
- [x] **Browse Laws by Category Page:** ~~Add a dedicated page to browse all categories with their descriptions.~~ Done - added `/categories` route with responsive grid of clickable category cards showing title, description, and law count. Accessible via hamburger menu "Browse Laws by Category" option.
- ~~**Site Statistics API Endpoint:** Create `/api/v1/stats` endpoint to expose aggregate statistics (total laws count, category count, total votes). This would enable displaying live stats on the About page (e.g., "Browse over X laws across Y categories").~~ (Cancelled)
- ~~**Advanced Filtering:** Add filters for date range, minimum votes, and exclude categories.~~ (Cancelled)

## UX Improvements (Frontend Only)
- [x] **User Favorites/Bookmarks:** ~~Allow users to save favorite laws using localStorage. Show favorites count and a dedicated favorites page.~~ Done - added heart button to law cards (toggles favorite state), dedicated `/favorites` page with empty state, localStorage persistence. Feature controlled by `VITE_FEATURE_FAVORITES` env var or localStorage admin override (`murphys_ff_favorites`).
- ~~**Copy as Image:** Add "copy as image" feature to share buttons.~~ (Cancelled)

## User Engagement (Require Backend Work)
- [x] **RSS Feed:** ~~Provide RSS/Atom feed for new laws and Law of the Day.~~ Done - added `/api/v1/feed.rss` (RSS 2.0) and `/api/v1/feed.atom` (Atom 1.0) endpoints. Feeds include Law of the Day plus 10 most recent laws. Added autodiscovery links to `index.html`.
- [ ] **Email Notifications:** Allow users to subscribe to new laws in specific categories.
- [ ] **Comments/Discussions:** Allow users to comment on laws (requires moderation system).
- [ ] **Law Collections:** Create curated "featured collections" (e.g., "Top 10 for Developers", "Classic Murphy's Laws").

## Content Strategy (Future Enhancements)
- [ ] **Content-Rich Category Pages:** Enhance category landing pages with more descriptive text, unique images, and curated content beyond just a list of laws. This might require adding 'long_description' to the `categories` table.
- [ ] **User Generated Content Moderation Interface:** Develop an admin interface to review, approve, edit, or reject submitted laws. This would build upon the existing `status` column in the `laws` table.
- [ ] **Law Tags:** Add a tagging system beyond categories for better discoverability.
- ~~**Law History:** Track edits/versions of laws for transparency.~~ (Cancelled)

## Mobile Apps (iOS / Android)
- [ ] **WhatsApp Share (Android):** Add WhatsApp share button to Android app. Requires updating `SocialShareHelper.kt`, `SocialIcons.kt`, and `LawDetailScreen.kt`.
- [ ] **WhatsApp Share (iOS):** iOS uses native `ShareLink` which already shows WhatsApp if installed. Consider adding a dedicated WhatsApp button for consistency with other platforms.

## Technical / Performance
- [x] **PWA / Service Worker:** ~~Add offline support and make the app installable.~~ Done - implemented using vite-plugin-pwa with Workbox. Features: installable app with custom install prompt, offline fallback page, smart caching strategies for API responses (StaleWhileRevalidate for categories, NetworkFirst for laws), auto-update notifications. iOS Safari users see step-by-step "Add to Home Screen" instructions. See `web/src/components/install-prompt.js` and `web/src/components/update-notification.js`.
- [ ] **Code Splitting:** Lazy load calculator code to reduce initial bundle size.
- [x] **API Response Caching:** ~~Cache categories and attributions more aggressively on the client.~~ Done - implemented localStorage caching with 1-hour TTL, cache-first strategy with background refresh, and schema versioning for forward compatibility. See `web/src/utils/category-cache.js`.
- [ ] **Prefetching:** Prefetch related laws on hover for faster navigation.
- [x] **Error Tracking:** ~~Integrate Sentry or similar service for production error monitoring.~~ Done - integrated Sentry for both frontend (@sentry/browser) and backend (@sentry/node). Errors are captured via Sentry.captureException/captureMessage. Source maps uploaded during build for better stack traces. See `.env.example` for configuration.
- [x] **Export to PDF/CSV:** ~~Allow users to export search results or collections.~~ Done - added universal page export feature accessible from header. Supports PDF, CSV, Markdown, and plain text formats. Uses jsPDF for PDF generation. Export available on law pages, categories, and content pages. Calculators and 404 excluded (interactive tools don't benefit from static export). See `web/src/utils/export.js` and `web/src/utils/export-context.js`.

## Completed

### UX Improvements
- [x] **Dark Mode Toggle:** ~~Add manual dark mode control (currently follows system preference only).~~ Done - added three-state toggle (auto/light/dark) to header with localStorage persistence. Theme applies immediately on page load to prevent flash.
- [x] **WhatsApp Share (Web):** ~~Add WhatsApp sharing option to share popover.~~ Done - added WhatsApp share button between Reddit and Email in the share menu.
- [x] **Keyboard Shortcuts:** ~~Add global shortcuts like `/` for search focus, `j/k` for navigating law cards, `?` for help modal.~~ Done - added keyboard shortcuts with accessible help modal. Press `?` anywhere to see available shortcuts.

### Technical Debt / Code Quality
- [x] **Refactor `main.js` `onSearch`:** ~~The `onSearch` function in `web/src/main.js` currently handles both search queries and category navigation. Consider separating these concerns for better modularity and clarity.~~ Done - separated into `handleCategoryNavigation`, `handleSearchNavigation`, and `handleClearFilters` functions.
- [x] **Error Handling:** ~~Implement more robust error handling and user feedback for API calls, especially in cases where data fails to load.~~ Done - created `web/src/utils/error-handler.js` with retry logic, `safeAsync` wrapper, and `createRetryable` utility.
- [x] **Lazy Loading Images/Components:** ~~Investigate lazy loading for images and potentially less critical components to improve initial page load performance.~~ Done - created `web/src/utils/lazy-loader.js` with `lazyLoad`, `lazyImage`, and `batchLazyLoad` utilities. Added `loading="lazy"` to footer images.
- [x] **Accessibility Audit:** ~~Conduct a thorough accessibility audit to ensure the site is usable by individuals with disabilities.~~ Done - audit confirmed excellent coverage: skip link, focus management, ARIA attributes (155 usages), keyboard navigation, e2e tests with axe-core for WCAG AA.

### Performance
- [x] **Image Optimization:** ~~Implement automated image optimization (e.g., WebP conversion, responsive images) for all images used on the site.~~ Done - created `web/scripts/optimize-images.mjs` using Sharp. Optimized `home.png` from 482KB to 127KB (73% savings), generated WebP at 35KB (93% savings). Run with `npm run optimize:images`.
- [x] **Critical CSS Generation:** ~~Explore tools to automatically generate critical CSS for each page to further improve LCP.~~ Already implemented - inline critical CSS exists in `index.html` with async stylesheet loading.