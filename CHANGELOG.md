# Changelog

All notable changes to the Murphy's Laws project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Web: update components, utils, and views (calculators, trending, keyboard help, categories, favorites, not-found, copy/nav/voting/icons/content)
- Docs: CHANGELOG and web README point to uncovered-branches docs (replace stale BRANCH_COVERAGE_95 reference); bump to 2.0.8 / 3.0.12

## [2.0.9] - 2026-02-21

### Changed
- Bump root 2.0.9, backend 2.0.2, web 3.0.13
- CI: attach `cause` to wrapped errors (backend email.service, scripts); fix web indentation and TypeScript (submit-law, search-autocomplete, navigation, install-prompt); deploy checkout fetch-depth: 0
- Pre-commit: run typecheck and lint (backend + web) before tests; add SKIP_CI_CHECK=1 bypass
- Root: add npm run ci, ci:backend, ci:web to match CI locally

### Fixed
- Web: pin typescript-eslint to 8.56.0 and add overrides for ESLint 10 compatibility (scopeManager.addGlobals); bump web to 3.0.10
- Web: ensure dist HTML passes html-validate (aria-labels on header/main, remove redundant role=main, trim SSG output to avoid trailing whitespace)

### Changed
- Bump to 2.0.7; npm audit fix --force (downgrade @sentry/node to 9.20, add typescript-eslint)
- Audit fixes: upgrade vite-plugin-pwa to 1.2.0 (critical ejs/json-schema); upgrade @sentry/node to 9.47.1; add root overrides for minimatch 10.2.1 and regenerate lockfile (fixes all 14 high). Pre-push blocks on high/critical. 10 moderate (ajv in eslint stack) remain with no non-breaking fix. Remove unused @sentry/node from web deps.

### Added
- CI and pre-push guardrails: typecheck and lint in web/backend CI; backend coverage thresholds (vitest.config.ts); npm audit in CI and pre-push; commit-msg hook (min length); lint-staged includes TypeScript; HTML validation step in web CI
- Backend: IOgImageLawService.getLaw return type allows undefined for LawService compatibility

### Changed
- Home: move "The Science of Murphy's Law" section below "Submit a Law"

## [2.0.10] - 2026-02-20

### Changed
- Web: upgrade ESLint `no-explicit-any` from warn to error (all `any` eliminated); allow `!= null` in `eqeqeq` rule for idiomatic null/undefined checks
- Web: fix `export.ts` to use `Category.title` (API field) instead of legacy `Category.name` for PDF, CSV, Markdown, and plain text exports
- Web: add JSDoc to `Category` interface marking `name` as `@deprecated` in favor of `title`

## [2.0.9] - 2026-02-19

### Changed
- Web: enable full `strict: true` TypeScript -- remove `noImplicitAny: false`, `strictNullChecks: false`, and `useUnknownInCatchVariables: false` overrides from `tsconfig.json`
- Web: fix 97 `noImplicitAny` errors across 10 source files (typed `Object.keys()` casts for calculator `for...in` loops, `ExportData` union narrowing via type assertions, MathJax ambient module declaration, `Record<string, unknown>` for dynamic index access)
- Web: fix 1 `useUnknownInCatchVariables` error (`instanceof Error` narrowing in `law-of-day.ts`)

## [2.0.8] - 2026-02-19

### Changed
- Web: fix 182 `strictNullChecks` errors across 23 source files (prep for enabling `strictNullChecks: true`)
- Web: add null guards for `querySelector` results, `getAttribute` returns, `dataset` properties, and regex capture groups
- Web: type all `[]` array initializations explicitly to avoid `never[]` inference under strict null checks
- Web: add `?? ''` fallbacks for `noUncheckedIndexedAccess` on record/array lookups (`button.ts`, `icons.ts`, `theme.ts`, `router.ts`)
- Web: null-safe calculator slider access with runtime validation and type narrowing across 4 calculator files

## [2.0.7] - 2026-02-19

### Changed
- Web: eliminate all remaining `any` usage in source (`as any` casts, `: any` annotations, `Promise<any>` returns)
- Web: add explicit parameter and return types to all exported functions (prep for `noImplicitAny: true`)
- Web: extract shared `copy-actions.ts` and `navigation.ts` utilities, reducing ~60 lines of duplicate event handling across views
- Web: improve type safety in `export-context.ts` (literal union for `ContentType`, `ExportData` union type), `category-cache.ts` (typed `JSON.parse`), `error-handler.ts` (generic `withRetry<T>`, `safeAsync<T>`), and `submit-law.ts` (`SubmitLawPayload` interface)
- Web: fix `global.d.ts` MathJax typing, `HTMLSelectElement` cast, unused variable warning in `main.ts`

## [2.0.6] - 2026-02-19

### Added
- Branch coverage tests: header ExportMenu cleanup, trending/browse/voting/home/categories cleanup and copy-text, structured-data setCategoryItemListSchema
- Branch coverage checklist in `web/uncovered-branches.md`; process and format rules in `web/uncovered-branches-agent.md`

### Changed
- Web coverage branch threshold set to 88%; use `web/uncovered-branches.md` and `web/uncovered-branches-agent.md` to work through uncovered branches

## [2.0.5] - 2026-02-19

### Fixed
- Web tests: use `globalThis` instead of `global` for DOM/browser type compatibility; type callback mocks (`onUpdate`, `onDismiss`, `updateSW`, `preventDefault`) with `Mock<() => void>` for Vitest 4

## [2.0.4] - 2026-02-19

### Added
- Pre-commit: fail when CHANGELOG.md is not staged and there are other staged changes (SKIP_CHANGELOG_CHECK=1 to bypass)

### Changed
- CHANGELOG history filled from git commit log (2.0.2, 2.6.1 entries and compare links)

## [2.0.3] - 2026-02-19

### Fixed
- Lint and type fixes: MathJax `Window` type (`Record<string, unknown>`), debounce generic args, unused imports/vars
- CSS: added standard `line-clamp` alongside `-webkit-line-clamp` for compatibility (components.css, sections.css)
- Documentation: CHANGELOG, TODO, web README (file references), coverage thresholds (96% functions, 95.5% branches)
- Pre-commit: require CHANGELOG.md staged when there are other staged changes

## [2.0.2] - 2026-02-19

### Changed
- Backend runs TypeScript source via tsx in PM2 (no JS build step)
- Complete TypeScript migration for backend and shared modules

### Fixed
- Deploy: run backend via local tsx CLI in PM2
- CI: repair deploy SSG imports and workspace trigger paths
- CI: remove darwin-only root dependencies
- Lockfile and workflow alignment to .nvmrc

## [2.6.1] - 2026-02-05

### Added
- Monthly peak resource usage report in daily status email

### Changed
- Theme toggle icons and home page content (Murphy's Law description in section-subheader, intro consolidated into single card)
- Content depth enhancements across key pages (Google Ads policy compliance review)

### Fixed
- Theme toggle icons not rendering correctly
- Sentry: filter browser extension internal messaging, ServiceWorker registration/update, and transient errors
- Sentry: stop reporting AdSense load failures, GA script errors, module import failures
- Service worker InvalidStateError handling
- Localhost fallback URL removed (production errors)
- Dynamic import failures handled gracefully
- Page title bottom padding, redundant categories description removed
- H1 alignment and heading hierarchy standardized
- Calculator slider readonly state in accessibility tree

## [2.6.0] - 2026-01-30

### Added
- Spacing scale CSS variables (`--space-1` through `--space-16`)
- Typography scale CSS variables (`--text-xs` through `--text-5xl`, line heights, font weights)
- High-contrast mode support (`@media (prefers-contrast: more)` and `data-contrast="more"`)
- Tooltip on disabled submit button with accessibility fix for hover on disabled elements
- Icon button borders in high-contrast mode (vote, favorite, theme, download buttons)
- Design System documentation in web README
- CHANGELOG.md following Keep a Changelog format
- Pre-commit reminder for changelog updates

### Changed
- Category cards now have uniform 120px height with text truncation
- Standardized placeholder text across all search inputs to "Search laws..."

### Fixed
- Tooltips now work on disabled buttons (added `pointer-events: auto`)
- Disabled button styling uses color instead of opacity to preserve tooltip visibility

## [1.0.7] - 2026-01-30

### Added
- Inline share buttons for calculator pages (replacing dropdown)
- Markdown linter with emoji and em-dash rules

### Fixed
- iOS CI updated to use iPhone 16 simulator for Xcode 16.4

## [1.0.6] - 2026-01-30

### Changed
- Markdown linter now enforces no-emoji and no-em-dash rules

## [1.0.5] - 2026-01-30

### Added
- Markdown linter with auto-fix support for documentation consistency

## [2.5.8] - 2026-01-29

### Added
- Favorite button on Law of the Day widget
- Advanced Search and sort controls on category pages
- Examples link in footer navigation
- Voice search support and comprehensive SEO improvements
- FAQ structured data on calculator pages

### Changed
- Calculator share buttons redesigned to match law share popover style
- Card structure standardized with header/body/footer pattern
- Form control heights standardized to match buttons (44px)
- Origin Story and Examples links moved to header dropdown menu

### Fixed
- Filled heart icon now shows on page load for favorited laws
- SVG click handling on favorites page
- Empty state shows after unfavoriting last law
- Slider value contrast in dark mode for WCAG AA compliance
- Sticky header positioning
- PWA install prompt dark mode and hover contrast

## [2.4.1] - 2026-01-29

### Added
- PWA support with offline caching, install prompt, and auto-updates
- Structured data fixes and FAQ schema for SEO

### Fixed
- Structured data URLs aligned with sitemap for SEO consistency

## [2.4.0] - 2026-01-27

### Added
- Progressive Web App (PWA) with offline support
- Custom install prompt with engagement-based triggers
- Service worker with smart caching strategies
- iOS Safari "Add to Home Screen" instructions

## [2.3.0] - 2026-01-26

### Added
- Universal page export (PDF, CSV, Markdown, Plain Text)
- Sentry error tracking integration
- Dynamic Open Graph images for per-law social sharing
- Schema versioning for localStorage cache

### Changed
- Export menu renamed to "Download" for clarity

### Fixed
- Navigation prevented when clicking buttons inside law cards
- SSG pagination now fetches all laws from API
- Law URLs have trailing slash to prevent circular redirects

## [2.2.0] - 2026-01-25

### Added
- User Favorites/Bookmarks with localStorage persistence
- Unified tooltip system across components
- Card-based layout for favorites page

### Fixed
- Horizontal scroll from tooltips prevented

## [2.1.0] - 2026-01-24

### Added
- Browse Laws by Category page with responsive grid
- Reusable button component with consistent icon placement
- Descriptions for all 55 categories
- Related laws API endpoint
- Unified loading states component

### Changed
- SubmitLawSection improved accessibility with required indicators

### Fixed
- Category descriptions for 9 categories with production slug mismatches
- Law Not Found page redesigned

## [2.0.0] - 2026-01-23

### Added
- Search autocomplete with debounced suggestions
- RSS and Atom feed support (`/api/v1/feed.rss`, `/api/v1/feed.atom`)
- Print-optimized CSS for law pages
- Keyboard shortcuts with help modal (press `?`)
- Manual dark mode toggle (auto/light/dark)
- WhatsApp share button

### Changed
- Share buttons unified with popover menu design

### Fixed
- Share dropdown clipping by section-card overflow
- Keyboard help modal reopening behavior

## [1.5.0] - 2026-01-21

### Added
- Tooltip on theme toggle button

### Fixed
- Keyboard modal and theme tooltip interactions

## [1.4.0] - 2025-12-15

### Added
- Android app with Kotlin and Jetpack Compose
- Material 3 UI matching web design
- Sod's Law Calculator in Android app
- More screen with markdown content support
- Pagination support in Android app

### Changed
- Android UI redesigned to match iOS and web
- Vote functionality with full test coverage
- Search functionality with icon-based results

## [1.3.0] - 2025-11-15

### Added
- iOS app with SwiftUI
- Skeleton loading views
- Enhanced launch screen
- Comprehensive iOS UI tests

### Changed
- iOS app loads content from shared markdown files
- Configuration management system added

### Fixed
- Various iOS compilation and compatibility issues
- Voting synchronization and UI updates

## [1.2.0] - 2025-11-07

### Added
- Monorepo structure for iOS and Android apps
- Shared legal content in markdown files
- Automated monorepo migration script

### Changed
- Project restructured as npm workspace
- Deployment configuration updated for monorepo

## [1.1.0] - 2025-11-01

### Added
- API versioning (`/api/v1/`)
- Comprehensive mobile app documentation
- Branch coverage tests achieving >95%

### Changed
- Enhanced markdown content handling

## [1.0.0] - 2025-10-20

### Added
- Law of the Day feature with daily rotation
- Social sharing functionality (X, Facebook, LinkedIn, Reddit, Email)
- Open Graph tags for social sharing
- Daily status report emails
- Breadcrumb navigation on detail pages
- Template system for content pages
- Buttered Toast Calculator with test coverage
- Advanced search component for filtering laws
- Category selection in law submission

### Changed
- Calculator styles consolidated
- Voting architecture refactored
- Law list widgets improved
- Sod's Law email template centralized

### Fixed
- Daily report formatting and accuracy
- Law text quote handling in database

## [0.9.0] - 2025-10-10

### Added
- Health check script for monitoring
- Google Analytics integration
- Performance optimizations (preconnect, deferred CSS)
- Local SVG icons (replaced Font Awesome)
- Daily rotating Law of the Day

### Changed
- Accessibility improvements for 100/100 score
- Dark mode contrast fixes

### Fixed
- Layout shifts (CLS) improvements
- Footer layout shift fix

## [0.8.0] - 2025-10-01

### Added
- Stitch-style Law of the Day widget
- Material Symbols for voting buttons
- Pagination with First/Prev/Next/Last and ellipses
- Enhanced browsing with search functionality
- Voting functionality for laws
- Law submission endpoint

### Changed
- Header branding to "Murphy's Law of the Day"
- Hero section moved to main layout

## [0.7.0] - 2025-09-30

### Added
- Warp terminal session documentation
- E2E tests with Playwright
- API server in Playwright webServer

## [0.6.0] - 2025-09-08

### Added
- Enhanced navigation in tests and UI
- Build before preview script

## [0.5.0] - 2025-08-10

### Added
- Favicons and site manifest
- Dark mode styles
- MathJax integration for formulas

### Changed
- SQL schema updated (removed language parameter)
- Blockquote formatting improved

## [0.4.0] - 2025-08-08

### Added
- API integration for Home and LawDetail views
- Vitest setup with jsdom and coverage
- Playwright E2E tests
- Husky pre-commit hooks
- ESLint and Stylelint configuration

### Changed
- Migrated from React/TSX to vanilla JavaScript
- CSS refactored to utility classes
- Folder aliases added (`@folders`)

### Fixed
- Footer link contrast in dark mode

## [0.3.0] - 2025-08-08

### Added
- Vite-based Murphy's Laws site
- Calculator view with MathJax
- Browse view with pagination
- Unit tests foundation

### Removed
- React/TSX components
- Inline CSS (replaced with utility classes)

## [0.2.0] - 2025-08-07

### Added
- New Murphy's Laws sections
- TODO tracking (moved to GitHub Wiki)

### Removed
- Outdated Murphy's Laws files (moved to backup)
- .DS_Store files from repository

## [0.1.0] - 2025-07-12

### Added
- Initial project structure
- Murphy's Laws content database
- Basic file organization

[Unreleased]: https://github.com/ravidorr/murphys-laws/compare/v2.0.10...HEAD
[2.0.10]: https://github.com/ravidorr/murphys-laws/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/ravidorr/murphys-laws/compare/v2.0.8...v2.0.9
[2.0.8]: https://github.com/ravidorr/murphys-laws/compare/v2.0.7...v2.0.8
[2.0.7]: https://github.com/ravidorr/murphys-laws/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/ravidorr/murphys-laws/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/ravidorr/murphys-laws/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/ravidorr/murphys-laws/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/ravidorr/murphys-laws/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/ravidorr/murphys-laws/compare/v2.6.1...v2.0.2
[2.6.1]: https://github.com/ravidorr/murphys-laws/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/ravidorr/murphys-laws/compare/v1.0.7...v2.6.0
[1.0.7]: https://github.com/ravidorr/murphys-laws/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/ravidorr/murphys-laws/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/ravidorr/murphys-laws/releases/tag/v1.0.5
