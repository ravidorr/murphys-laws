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
# Build for production
npm run build

# Preview production build
npm run preview
```

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
