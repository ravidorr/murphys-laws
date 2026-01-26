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

Open http://localhost:5173

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
- `VITE_API_FALLBACK_URL` - Fallback API URL (default: http://127.0.0.1:8787)

**Example `.env`:**
```
VITE_API_URL=https://murphys-laws.com
VITE_API_FALLBACK_URL=http://127.0.0.1:8787
```

## AdSense
 
 To prevent "Google-served ads on screens without publisher-content" violations (common in SPAs), AdSense loading is deferred:
 
 1.  **Script Removal:** The AdSense script is NOT in `index.html` head.
 2.  **Deferred Loading:** `src/utils/ads.js` injects the script dynamically.
 3.  **Initialization:** `main.js` calls `initAdSense()` after the app mounts and content is rendered.
 4.  **Static Shell:** `index.html` contains a static HTML shell to ensure crawlers never see an empty page.
 
 ## Project Structure

```
web/
├── src/
│ ├── main.js           # Entry point
│ ├── router.js         # Client-side routing
│ ├── views/            # Page views
│ ├── components/       # Reusable components
│ ├── modules/          # Shared logic
│ └── utils/            # Helper functions
├── styles/             # CSS stylesheets
├── public/             # Static assets
├── tests/              # Unit tests
└── e2e/                # End-to-end tests
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
