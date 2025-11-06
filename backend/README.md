# Murphy's Laws - Backend API

Node.js API server serving web, iOS, and Android clients.

## Requirements

- Node.js 22+
- SQLite 3

## Setup

```bash
cd backend
npm install

# Copy environment config
cp ../.env.example .env

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

## Testing

```bash
npm test
```

## Deployment

See [Deployment Guide](../shared/docs/DEPLOYMENT.md).

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
