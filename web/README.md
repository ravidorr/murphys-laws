# Murphy's Laws - Web Application

Vanilla JavaScript web application with Vite.

## Requirements

- Node.js 22+

## Setup

```bash
cd web
npm install

# Start development server
npm run dev
```

Open <http://localhost:5173>

## Build

```bash
# Build for production (includes SSG)
npm run build

# Preview production build
npm run preview
```

**Static Site Generation (SSG):**

The build process runs `npm run ssg` which pre-renders pages for SEO and social sharing:
- Category pages (`/category/{slug}`)
- Content pages (About, Privacy, Terms, etc.)
- Individual law pages (`/law/{id}`) with correct Open Graph meta tags
- Sitemap.xml generation

Law pages include dynamic OG image URLs (`/api/v1/og/law/{id}.png`) for rich social media previews.

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E UI mode
npm run test:e2e:ui
```

Uncovered branches are tracked in `uncovered-branches.md`; `uncovered-branches-agent.md` describes how to work through the checklist.

## Linting

```bash
# Lint JavaScript
npm run lint

# Fix JavaScript issues
npm run lint:fix

# Lint CSS
npm run lint:css

# Fix CSS issues
npm run lint:css:fix
```

## Configuration

**API Base URL:**

Set via environment variables:
- `VITE_API_URL` - Primary API URL (default: empty string for same origin)
- `VITE_API_FALLBACK_URL` - Fallback API URL (default: <http://127.0.0.1:8787>)

**Example `.env`:**
```
VITE_API_URL=https://murphys-laws.com
VITE_API_FALLBACK_URL=http://127.0.0.1:8787
VITE_SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
```

**Error Tracking (Sentry):**

Sentry is used for production error monitoring. Set `VITE_SENTRY_DSN` to enable error tracking. Errors are automatically captured and reported to Sentry.

For source map uploads during build (better stack traces), also set:
- `SENTRY_AUTH_TOKEN` - Sentry auth token
- `SENTRY_ORG` - Sentry organization slug  
- `SENTRY_PROJECT` - Sentry project slug

## AdSense

 To prevent "Google-served ads on screens without publisher-content" violations (common in SPAs), AdSense loading is deferred:

 1. **Script Removal:** The AdSense script is NOT in `index.html` head.
 2. **Deferred Loading:** `src/utils/ads.ts` injects the script dynamically.
 3. **Initialization:** `main.ts` calls `initAdSense()` after the app mounts and content is rendered.
 4. **Static Shell:** `index.html` contains a static HTML shell to ensure crawlers never see an empty page.

## Features

### Progressive Web App (PWA)

The application is a fully installable PWA with offline support.

**Capabilities:**
- **Installable**: Users can install the app to their home screen from any browser
- **Offline Support**: Previously viewed content is cached for offline access
- **Auto-updates**: Service worker automatically updates when new versions are deployed

**Caching Strategies:**

| Resource | Strategy | TTL |
|----------|----------|-----|
| Static assets (JS, CSS) | CacheFirst | Versioned |
| Images | CacheFirst | 30 days |
| Categories API | StaleWhileRevalidate | 1 hour |
| Laws API | NetworkFirst | 1 hour |
| Law of the Day | NetworkFirst | 24 hours |
| Google Fonts | CacheFirst | 1 year |

**Install Prompt:**
- Custom install prompt appears after user engagement (3+ page views, 2+ laws viewed, 30+ seconds)
- Calculator usage triggers immediate prompt (high-intent action)
- iOS Safari users see step-by-step "Add to Home Screen" instructions
- 7-day cooldown after user dismisses prompt

**Configuration:**

PWA is configured in `vite.config.js` using `vite-plugin-pwa`. The plugin generates:
- `manifest.webmanifest` - App manifest with icons, theme colors, screenshots
- `sw.js` - Service worker with Workbox caching
- Auto-injects manifest link and registers service worker

**Development:**

Service worker is disabled in development mode (`devOptions.enabled: false`) to avoid caching issues. Test PWA features with production build:

```bash
npm run build
npm run preview
```

### Page Export

The application includes a universal export feature accessible from the header (download icon next to theme toggle).

**Supported Formats:**
- **PDF** - Formatted document with header, page numbers, and site branding (uses jsPDF)
- **CSV** - Structured data export with Full Text column (available for law lists and categories)
- **Markdown** - Numbered list format with attribution on separate lines, clickable footer link
- **Plain Text** - Simple text format with footer

**Export by Page Type:**

| Page | PDF | CSV | Markdown | Text |
|------|-----|-----|----------|------|
| Browse / Search Results | Yes | Yes | Yes | Yes |
| Favorites | Yes | Yes | Yes | Yes |
| Category Laws | Yes | Yes | Yes | Yes |
| Single Law | Yes | Yes | Yes | Yes |
| Categories List | Yes | Yes | Yes | Yes |
| Content Pages (About, etc.) | Yes | No | Yes | Yes |
| Calculators | - | - | - | - |
| 404 Page | - | - | - | - |

*Calculators and 404 page do not support export (button disabled).*

**Architecture:**
- `src/utils/export-context.ts` - Page content registration system (singleton context)
- `src/utils/export.ts` - Format-specific export functions
- `src/components/export-menu.ts` - Header dropdown component

**Usage:**
Pages register their exportable content using `setExportContent()` and clear it on unmount with `clearExportContent()`. The export menu automatically updates available formats based on content type.

### Social Sharing

The application provides a unified sharing system used across laws and calculators.

**Supported Platforms:**
- Twitter/X, Facebook, LinkedIn, Reddit, WhatsApp, Email
- Copy text (law text or calculation result)
- Copy link (shareable URL)

**Two Display Modes:**

| Mode | Component | Used In |
|------|-----------|---------|
| Dropdown popover | `SocialShare()` | Law cards, Law of the Day |
| Inline buttons | `renderInlineShareButtonsHTML()` + `initInlineShareButtons()` | Calculators |

**Single Source of Truth:**

All share options are defined in `SHARE_PLATFORMS` constant in `src/components/social-share.ts`. Adding, changing, or removing a share platform updates all locations automatically.

**Architecture:**
- `src/components/social-share.ts` - Share component (dropdown and inline variants)
- `SHARE_PLATFORMS` - Configuration for all share platforms
- `buildShareUrls()` - Centralized URL generation for all platforms

**Responsive Behavior (Inline Buttons):**
- Desktop: Buttons fit as many per row as possible (max-width 180px each)
- Tablet (<=768px): Buttons grow to fill space (max-width 50% each)
- Mobile (<=480px): Icon-only 44px square buttons

## Design System

The application uses CSS custom properties (variables) for consistent design tokens.

### Spacing Scale

Based on a 4px base unit. Use these for margins, padding, and gaps:

| Variable | Value | Pixels |
|----------|-------|--------|
| `--space-1` | 0.25rem | 4px |
| `--space-2` | 0.5rem | 8px |
| `--space-3` | 0.75rem | 12px |
| `--space-4` | 1rem | 16px |
| `--space-5` | 1.25rem | 20px |
| `--space-6` | 1.5rem | 24px |
| `--space-8` | 2rem | 32px |
| `--space-10` | 2.5rem | 40px |
| `--space-12` | 3rem | 48px |
| `--space-16` | 4rem | 64px |

### Typography Scale

Major Third (1.25) ratio. Use these for font sizes:

| Variable | Value | Pixels |
|----------|-------|--------|
| `--text-xs` | 0.75rem | 12px |
| `--text-sm` | 0.875rem | 14px |
| `--text-base` | 1rem | 16px |
| `--text-lg` | 1.125rem | 18px |
| `--text-xl` | 1.25rem | 20px |
| `--text-2xl` | 1.5rem | 24px |
| `--text-3xl` | 1.875rem | 30px |
| `--text-4xl` | 2.25rem | 36px |
| `--text-5xl` | 3rem | 48px |

**Line Heights:** `--leading-none` (1), `--leading-tight` (1.25), `--leading-snug` (1.375), `--leading-normal` (1.5), `--leading-relaxed` (1.625)

**Font Weights:** `--font-normal` (400), `--font-medium` (500), `--font-semibold` (600), `--font-bold` (700), `--font-extrabold` (800)

### High-Contrast Mode

The application supports users who prefer increased contrast via `@media (prefers-contrast: more)`.

**Features:**
- Thicker borders (2px) on cards, buttons, and inputs
- Stronger border colors
- Enhanced focus indicators (3px outline)
- Underlined links (except buttons)

**Testing High-Contrast Mode:**

Since browser DevTools may not support `prefers-contrast` emulation, use the data attribute toggle:

```javascript
// Enable high-contrast mode
document.documentElement.setAttribute('data-contrast', 'more')

// Disable high-contrast mode
document.documentElement.removeAttribute('data-contrast')
```

### CSS Architecture

```
styles/
├── main.css              # Entry point, imports all partials
└── partials/
    ├── variables.css     # Design tokens (colors, spacing, typography)
    ├── reset.css         # CSS reset/normalize
    ├── base.css          # Base element styles
    ├── layout.css        # Layout utilities
    ├── components.css    # Reusable components (buttons, cards, tooltips)
    ├── sections.css      # Page section styles
    ├── theme.css         # Dark mode and high-contrast mode
    ├── utilities.css     # Utility classes
    ├── calculator.css    # Calculator-specific styles
    └── print.css         # Print styles
```

## Project Structure

```
web/
├── src/
│   ├── main.ts              # Entry point (includes PWA registration)
│   ├── router.ts            # Client-side routing
│   ├── views/               # Page views
│   ├── components/          # Reusable components
│   │   ├── install-prompt.ts    # PWA install prompt
│   │   ├── update-notification.ts # PWA update notification
│   │   └── ...
│   ├── modules/             # Shared logic
│   └── utils/               # Helper functions
├── styles/                  # CSS stylesheets
├── public/
│   ├── offline.html         # Offline fallback page
│   ├── android-chrome-*.png # PWA icons
│   └── ...
├── tests/                   # Unit tests
└── e2e/                     # End-to-end tests
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
