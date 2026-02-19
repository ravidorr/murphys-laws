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
- `SENTRY_DSN` - Sentry error tracking DSN (optional, for production monitoring)

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

**Test Structure:**
- 18 test files covering all layers (221 tests)
- Services: `laws`, `categories`, `votes`, `attributions`, `feed`, `og-image`
- Controllers: `laws`, `categories`, `votes`, `health`, `attributions`, `feed`, `og-image`
- Middleware: `cors`, `rate-limit`
- Utils: `helpers`, `http-helpers`

## Deployment

See [Deployment Guide](../shared/docs/DEPLOYMENT.md).

## Architecture Docs

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
