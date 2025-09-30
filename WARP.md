# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository type: Vite-powered vanilla JS web app with a lightweight local API and SQLite-backed data pipeline.

Environment prerequisites
- Node.js 18+ and npm
- sqlite3 CLI available on PATH (used by the local API server)
- macOS-friendly; commands are cross-platform except where noted

Common commands
- Install dependencies
  - npm ci

- Start local API (SQLite-backed, CORS enabled)
  - npm run api
  - Serves on http://127.0.0.1:8787

- Start frontend dev server (Vite, proxies /api → 127.0.0.1:8787)
  - npm run dev
  - Dev server: http://127.0.0.1:5175

- Build production assets
  - npm run build

- Preview the production build locally (used by Playwright e2e)
  - npm run preview
  - Preview server: http://localhost:5173

- Lint JavaScript
  - npm run lint
  - Auto-fix: npm run lint:fix

- Lint CSS
  - npm run lint:css
  - Auto-fix: npm run lint:css:fix

- Unit tests (Vitest / jsdom)
  - Run all: npm test
  - Watch mode: npm run test:watch
  - Single file: npx vitest tests/router.test.js
  - Single test by name: npx vitest tests/home.test.js -t "renders Law of the Day"
  - Coverage: npx vitest --coverage

- End-to-end tests (Playwright)
  - Runs against npm run preview (port 5173) via playwright.config.ts
  - Run e2e: npm run e2e
  - Single spec: npx playwright test e2e/navigation.spec.ts -g "home → browse via header"

- SQLite content pipeline
  - Initialize schema: npm run db:init
  - Generate and import data from markdown: npm run db:import
  - Rebuild DB from scratch: npm run db:rebuild
  - Generate SQL to a file: npm run db:sql > db/import.sql

High-level architecture
- Frontend (src/)
  - Framework-free: DOM is created with plain JS. A tiny hash router (src/router.js) maps #/routes to render functions.
  - Entry (src/main.js) wires routes and page layout, mounts the app, and configures MathJax v3 for the calculator view.
  - Views (src/views/*):
    - home.js fetches paginated laws from /api/laws and renders “Law of the Day”, trending, and recently added blocks with client-side pagination controls.
    - browse.js is a simple router target showing the current search query.
    - law-detail.js fetches /api/laws/:id, renders the law and its attributions, and exposes up/down-vote UX hooks.
    - calculator.js renders an interactive Sod’s Law calculator; math is rendered via MathJax (typeset triggered after route mount).
    - auth.js and submit-law.js provide minimal forms/placeholders for future integration.
  - UI components (src/ui/*): header.js contains the top navigation, search form, and route buttons.
  - Styling: central CSS in styles/site.css. Prefer adding classes and editing this stylesheet rather than using inline styles.
  - Aliases (vite.config.js):
    - @src → src
    - @views → src/views
    - @ui → src/ui

- Dev servers and ports
  - API server: 127.0.0.1:8787 (npm run api)
  - Vite dev: 127.0.0.1:5175 with a proxy to the API at /api
  - Preview: http://localhost:5173 for production build preview and Playwright e2e

- Data pipeline (markdown → SQLite → API)
  - Source content lives in murphys-laws/*.md and related markdown files at the repo root.
  - scripts/build-sqlite.mjs parses markdown lists, infers titles/corollaries/attributions, and emits SQL statements that populate a normalized schema (db/schema.sql) with laws, categories, attributions, and law_relations.
  - npm run db:init applies schema; npm run db:import executes the generated SQL against murphys.db.
  - scripts/api-server.mjs is a small Node HTTP server that shells out to sqlite3 in JSON mode. It exposes:
    - GET /api/health
    - GET /api/laws?limit&offset[&q]
    - GET /api/laws/:id
  - Vite’s dev proxy forwards /api/* to the API server so the frontend can fetch during development without CORS hassles.

- Testing strategy
  - Unit tests (Vitest) in tests/* exercise the router and views with jsdom. Coverage uses V8 provider.
  - E2E tests (Playwright) in e2e/* navigate through header actions and basic flows. playwright.config.ts spins up npm run preview automatically.

Repository conventions
- CSS: Avoid inline styles. Centralize styling in styles/site.css and reference classes from views/components.
- Imports: Prefer the Vite aliases (@src, @views, @ui) in both app code and tests.
- Git workflow: Use feature branches and rebase on master before opening a PR. Update any relevant documentation before committing.

Notes for Warp
- When running the app locally, start the API (npm run api) first, then start the Vite dev server (npm run dev). The dev server proxies /api calls to 127.0.0.1:8787.
- For E2E, you don’t need to start anything manually—npm run e2e will build and preview on port 5173 via Playwright’s webServer config.
