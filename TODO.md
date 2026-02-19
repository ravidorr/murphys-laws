# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## Design Review Findings (Jan 2026)

The following items were identified during comprehensive UX, UI, Accessibility, Microcopy, and SEO skill reviews but not yet implemented.

### UX Improvements
- [ ] **Move Submit Form to Dedicated Page:** The submit form on the home page creates cognitive overload. Move to dedicated `/submit` route to simplify home page and improve first-time visitor experience.
- [ ] **Consolidate Browse Page Sidebars:** "Top Voted", "Trending Now", and "Recently Added" sections show similar laws. Consolidate into single "Popular" section or convert to sort options only.
- [ ] **Add "Back to Top" Button:** Long pages (browse, categories) need a floating "back to top" button for easier navigation.
- [ ] **Expand Search Field on Desktop:** Currently collapsed behind icon. Consider showing expanded search input on desktop widths for better discoverability.
- [ ] **Simplify Home Page:** Home page has Law of Day + 2 calculators + submit form. Consider removing calculators from home page (they have dedicated pages) to focus on content discovery.
- [ ] **Group Categories:** 55 flat categories are hard to scan. Add groupings (e.g., "Technology", "Workplace", "Daily Life") or popularity badges.

### UI Improvements
- [ ] **Implement 12-Column Grid System:** Current layout lacks consistent grid. Define explicit 12-column grid with 24px gutters for more precise layouts.
- [ ] **Standardize Section Spacing:** Some areas feel cramped while others have excessive whitespace. Audit and standardize using the new spacing scale.

### Accessibility Improvements
- [x] **Investigate Slider Readonly State:** Calculator sliders show as "readonly" in accessibility tree. Fixed by adding explicit ARIA attributes (role="slider", aria-valuenow, aria-valuetext, aria-readonly="false") and keeping them in sync via JavaScript.
- [ ] **Rename Footer Navigation:** Footer nav has `aria-label="Utility"` which is vague. Change to "Footer navigation" or "Site links" for clarity.
- [ ] **Add Skip Links for Calculator Sections:** Long home page could benefit from skip links to jump to specific calculators.

### SEO Improvements
- [ ] **FAQ Structured Data for Calculators:** Add FAQ schema to Sod's Law and Buttered Toast calculators explaining how they work and what they calculate.
- [ ] **"What is Murphy's Law?" Section:** Add a dedicated section or expand the home page description to target featured snippet for "What is Murphy's Law?" queries.
- [ ] **Calculator Meta Descriptions:** Current calculator page meta descriptions could be more compelling with specific value propositions.

### Microcopy Improvements
- [ ] **Review Error States:** Audit all error messages for consistency and helpfulness. Ensure they follow pattern: What happened + Why + What to do next.
- [ ] **Empty State Improvements:** Review empty states (no search results, no favorites) for tone and helpfulness.
- [ ] **Button Label Audit:** Review all button labels for action clarity (e.g., "Submit" vs "Submit Your Law").

### Implemented from Reviews (Jan 2026)
- [x] **Home Page H1:** Added visible H1 "The Ultimate Murphy's Law Archive" with Murphy's Law definition. Critical for accessibility (WCAG 1.3.1) and SEO.
- [x] **Law Detail H1:** Changed law title from H3 to H1 for proper heading hierarchy.
- [x] **Spacing Scale CSS Variables:** Added `--space-1` through `--space-16` based on 4px unit.
- [x] **Typography Scale CSS Variables:** Added `--text-xs` through `--text-5xl` with line heights and font weights.
- [x] **Category Card Uniform Heights:** Fixed category cards to 120px height with text truncation.
- [x] **High-Contrast Mode:** Added `@media (prefers-contrast: more)` styles and `data-contrast="more"` manual toggle for testing. Includes thicker borders, enhanced focus indicators, and underlined links.
- [x] **Standardized Placeholder Text:** Changed all search placeholders to "Search laws..." for consistency.
- [x] **Disabled Button Tooltip:** Added tooltip "Complete required fields to submit" on disabled submit button with `pointer-events: auto` fix for hover.
- [x] **Icon Button Borders in High Contrast:** Added visible borders to vote, favorite, theme toggle, and download buttons in high-contrast mode.

---

## SEO Recommendations (External / Manual)
- [ ] **Link Reclamation:** Identify broken links on high-authority sites (e.g., .edu domains) that mention 'Murphy\'s Law' and reach out to suggest our archive as a replacement reference.
- [ ] **Calculator Outreach:** Pitch the 'Buttered Toast Landing Calculator' to physics and science education blogs as a fun, interactive teaching tool to generate fresh backlinks.
- [x] **Per-Law Open Graph Images:** ~~Generate dynamic OG images for each law to improve social sharing appearance.~~ Done - implemented `GET /api/v1/og/law/:id.png` endpoint that generates PNG images using node-canvas. Images are cached for 1 day and include law title, text, and branding. See `backend/src/services/og-image.service.mjs`.
- [x] **Print Styles:** ~~Add print-optimized CSS for law pages.~~ Done - added `web/styles/partials/print.css` with `@media print` rules. Hides interactive elements (search, widgets, pagination, vote buttons) and optimizes typography for clean paper output.

## SEO Recommendations (Content & Technical)
- [ ] **"Murphy's Law vs Sod's Law" Comparison Page:** Create a dedicated page explaining the differences between Murphy's Law and Sod's Law. This is a high-volume search query with no dedicated content currently.
- [ ] **"Murphy's Law Examples" Page:** Create a curated page targeting "Murphy's Law examples" keyword cluster with real-world scenarios organized by category.
- [ ] **Breadcrumb Schema on All Pages:** Add BreadcrumbList structured data to law detail pages, calculator pages, and content pages (currently only on browse and category pages).
- [ ] **Internal Linking Improvements:** Add "related categories" links on category pages, cross-link calculators from relevant law pages, and add "See also" sections to content pages.
- [ ] **Visual Content:** Add historical photos (Edward Murphy, Dr. John Stapp, rocket sled experiments), infographics showing Murphy's Law variations, and embedded video explaining the origin story.
- [ ] **Glossary/Index Page:** Create a page listing all law authors/attributions with links, targeting long-tail "who said [law name]" queries.
- [ ] **Educational Content:** Add articles like "Why does Murphy's Law feel so true?" (psychology/cognitive bias) and "How to use Murphy's Law in project management".
- [ ] **User Stories Section:** Implement user-submitted stories with moderation for fresh user-generated content and social proof.

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
- [x] **API Response Caching:** ~~Cache categories and attributions more aggressively on the client.~~ Done - implemented localStorage caching with 1-hour TTL, cache-first strategy with background refresh, and schema versioning for forward compatibility. See `web/src/utils/category-cache.ts`.
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
