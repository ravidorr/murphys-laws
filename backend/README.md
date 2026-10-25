# Murphy's Laws - Backend API

Node.js API server serving web, iOS, and Android clients.

## Requirements

- Node.js 22+
- SQLite 3

## Setup

```bash
cd backend
npm install

# Environment config is in the project root (.env)
# Copy .env.example to .env at the project root if not already done
cp ../.env.example ../.env

# Build database from markdown files
npm run build:db

# Start API server (development)
npm run dev

# Start API server (production)
npm start
```

The API server will run on `http://127.0.0.1:8787` by default.

## API Endpoints

All endpoints use the `/api/v1/` prefix. See [API Documentation](../shared/docs/API.md) for details.

**Core Endpoints:**
- `GET /api/v1/laws` - List laws (paginated, filtered)
- `GET /api/v1/laws/{id}` - Get single law
- `POST /api/v1/laws` - Submit new law
- `POST /api/v1/laws/{id}/vote` - Vote on law
- `GET /api/v1/law-of-day` - Get law of the day
- `GET /api/v1/categories` - List categories
- `GET /api/v1/feed.rss` - RSS 2.0 feed (Law of the Day + recent laws)
- `GET /api/v1/feed.atom` - Atom 1.0 feed (Law of the Day + recent laws)
- `GET /api/v1/og/law/{id}.png` - Dynamic Open Graph image for social sharing

## Admin Moderation

Submitted laws are stored as `in_review` and the public API only returns `published` laws. A token-protected
admin API and a small page let you approve, reject, and edit them on a running server. These routes are
intentionally not in the public OpenAPI spec.

- Page: `https://murphys-laws.com/admin` in production (nginx proxies `/admin` to the API), `http://localhost:8787/admin` locally, or `http://localhost:5175/admin` through the Vite dev server; `/api/v1/admin/ui` still works. Click **Sign in with GitHub**, or open **Use an API token instead** and paste the token (kept in memory only).
- `GET /api/v1/admin/laws` - query `status` (`in_review` default, `published`, `rejected`, `all`), `q` (max 200 characters), `limit` (1-100, default 50), `offset`. Returns `data`, `total`, and per-status `counts`.
- `POST /api/v1/admin/laws/{id}` - JSON body (max 16 KB, else `413`) with any of `status`, `text` (10-1000 characters), `title` (max 200), `admin_notes` (max 2000, `null` clears). Send the law's `updated_at` to get a `409` if someone else changed it first; omit it (or send `null`) for last write wins.
- Auth: either `Authorization: Bearer <ADMIN_API_TOKEN>` or a GitHub sign-in session cookie (see below). Without a token of at least 32 characters and without GitHub sign-in configured, every admin route and the page return `404` (an unset and a too-short token look the same to clients; the startup log tells them apart). Failed logins are limited to 10 per minute per IP (valid requests are not limited). Approving a pending law (`in_review` to `published`) that has a valid email contact also starts a thank-you email to the submitter through the configured SMTP settings. The response and page report `thank_you`: `queued` means a send was started (delivery is not confirmed), `skipped` comes with a reason (`no_email`, `invalid_email`, `not_configured`, `already_sent`, `error`), and it is `null` for anything that is not an approval. Success is stored in `laws.approval_email_sent_at`, so moving a law back to review and approving it again does not email twice; a failed send is not stored and is retried by the next approval. Send failures never block moderation, and our log lines contain only the law id plus the error and SMTP response codes. Each change is logged as one JSON line with the law id, caller IP, changed fields and status before/after, never the text or notes.

**Production setup:** create the GitHub Actions secret `ADMIN_API_TOKEN` (for example `openssl rand -hex 32`) before the
deploy; the workflow writes it to the server `.env` and warns when it is empty. The server logs `Admin API enabled` or
`Admin API disabled (...)` at startup. A token set by hand on the server is overwritten by the next deploy.

**Sign in with GitHub (optional):** the admin page can sign in an allowlisted GitHub user instead of asking for a token.
The API token keeps working next to it (for the CLI, MCP and as a fallback) and needs no CSRF header.

- Register a GitHub OAuth app with the callback URL `https://murphys-laws.com/api/v1/admin/auth/github/callback` (no scopes are needed; only the public profile is read).
- Set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `ADMIN_GITHUB_USERS` (comma-separated logins, case-insensitive) and `ADMIN_SESSION_SECRET` (32+ characters). If any is missing, sign-in stays off and the startup log says `Admin GitHub sign-in disabled (...)`. `BASE_URL` (default `https://murphys-laws.com`) must be the origin the browser uses, because the callback URL and the CSRF origin check are built from it (for example `http://localhost:5175` with the Vite dev server).
- GitHub Actions secrets cannot start with `GITHUB_`, so the deploy workflow reads `ADMIN_GITHUB_OAUTH_CLIENT_ID` and `ADMIN_GITHUB_OAUTH_CLIENT_SECRET` and writes them to the server `.env` as `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`; `ADMIN_GITHUB_USERS` and `ADMIN_SESSION_SECRET` keep their names. The workflow warns when the set is only partly filled in.
- Routes: `GET /api/v1/admin/auth/github` (redirects to GitHub with a random `state`), `GET /api/v1/admin/auth/github/callback` (checks `state`, exchanges the code, returns `403` for a login that is not on the allowlist), `GET /api/v1/admin/auth/session` (always `200`: who is signed in, if anyone, and whether sign-in is offered) and `POST /api/v1/admin/auth/logout`. Failed sign-ins count toward the same 10 per minute limit as wrong tokens.
- The session is a signed, stateless cookie (`admin_session`: `HttpOnly`, `Secure` on https, `SameSite=Strict`, valid for 8 hours). Nothing is stored on the server, so rotating `ADMIN_SESSION_SECRET` signs everyone out; removing a login from `ADMIN_GITHUB_USERS` ends that user's session at the next request.
- Writes made with the cookie must send `X-Admin-Request: 1` and an `Origin` equal to `BASE_URL`, otherwise they get `403`; the admin page does this itself.

## Database

SQLite database located at `db/murphys-laws.sqlite`.

**Rebuild database:**
```bash
npm run build:db
```

**Run migrations:**
```bash
npm run migrate
```

## Configuration

Environment variables (`.env`):
- `PORT` - API server port (default: 8787)
- `SMTP_HOST` - Email SMTP host
- `SMTP_PORT` - Email SMTP port
- `SMTP_USER` - Email username
- `SMTP_PASS` - Email password
- `EMAIL_FROM` - Sender address, also what submitters see on thank-you emails (default: `noreply@murphys-laws.com`)
- `EMAIL_TO` - Receives new-submission notices (default: `admin@murphys-laws.com`)
- `SENTRY_DSN` - Sentry error tracking DSN (optional, for production monitoring)
- `ADMIN_API_TOKEN` - Bearer token (32+ characters) enabling the admin moderation API and page (optional)
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `ADMIN_GITHUB_USERS`, `ADMIN_SESSION_SECRET`, `BASE_URL` - Enable "Sign in with GitHub" for the admin page (optional; see Admin Moderation)

## Architecture

The backend follows a **modular layered architecture**:

```
backend/
├── src/
│   ├── controllers/     # Request handlers (6 controllers)
│   ├── services/        # Business logic (7 services)
│   ├── middleware/      # Express middleware (CORS, rate limiting)
│   ├── routes/          # Route definitions
│   ├── server/          # Runtime bootstrap (api-server.ts)
│   └── utils/           # Helper functions
├── tests/
│   ├── controllers/     # Controller unit tests
│   ├── services/        # Service unit tests
│   ├── middleware/      # Middleware unit tests
│   └── utils/           # Utility unit tests
├── scripts/             # Operational/deploy scripts (.mjs)
└── ../shared/modules/   # Shared TypeScript runtime templates
```

**Key Components:**
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and database operations
- **Middleware**: CORS, rate limiting, error handling
- **Routes**: API endpoint definitions
- **Runtime Entry**: `src/server/api-server.ts` (executed via `tsx`)

## Testing

The backend has **comprehensive unit test coverage** using Vitest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Coverage thresholds (lines, functions, branches, statements) are 95%. The same run is used in pre-commit and in CI. Coverage can vary slightly between local and CI (e.g. Node/v8 version), so keeping branch coverage clearly above 95% avoids CI-only failures.

**Test Structure:**
- 25 test files covering all layers (321 tests)
- Services: `laws`, `categories`, `votes`, `attributions`, `feed`, `og-image`
- Controllers: `laws`, `categories`, `votes`, `health`, `attributions`, `feed`, `og-image`
- Middleware: `cors`, `rate-limit`
- Utils: `helpers`, `http-helpers`

## Deployment

See [Deployment Guide](../shared/docs/DEPLOYMENT.md).

## Architecture Docs

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
