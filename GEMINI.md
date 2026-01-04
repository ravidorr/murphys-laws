# Project Context for Gemini

## Project Overview
This is a monorepo for "Murphy's Laws," a multi-platform application (Web, Android, iOS) with a Node.js/SQLite backend.
- **Goal:** Share and categorize Murphy's Laws.
- **Structure:**
  - `web/`: Vite + Vanilla JS. Uses `marked` for markdown and `mathjax` for rendering.
  - `backend/`: Node.js (ESM) + `better-sqlite3`. API server at `scripts/api-server.mjs`.
  - `android/`: Native Android (Kotlin).
  - `ios/`: Native iOS (Swift).
  - `shared/`: Shared assets, content, and documentation.

## Coding Conventions

### General
- **Tone:** Professional, direct, and concise.
- **Standards:** Mimic existing patterns in each subdirectory.
- **Git:** Use semantic commit messages (e.g., `feat:`, `fix:`, `docs:`, `chore:`).

### Web (`web/`)
- **Framework:** No heavy UI framework; pure Vanilla JS and CSS.
- **Testing:** `vitest` for unit tests, `playwright` for E2E.
- **Linting:** Run `npm run lint` and `npm run lint:css` to verify changes.

### Backend (`backend/`)
- **Database:** `better-sqlite3`. Schema is in `db/schema.sql`.
- **Migrations:** Use `scripts/migrate.mjs` for schema updates.
- **Engine:** Requires Node.js >= 22.0.0.

### Mobile
- **Android:** Modern Kotlin standards.
- **iOS:** Swift with a focus on the `MurphysLawsSource` directory.

## Critical Instructions
1. **Safety:** Always verify port availability using `scripts/cleanup-ports.mjs` if the server fails to start.
2. **Persistence:** When adding new laws or categories, ensure migrations are generated to keep the SQLite database in sync.
3. **Testing:** Proactively add tests for new logic in `web/tests` or `backend/tests`.

## Common Commands
- **Backend Dev:** `cd backend && npm run dev`
- **Web Dev:** `cd web && npm run dev`
- **Run Tests:** `npm test` (within respective directories)

## SSH Configuration & Usage

### SSH Config Setup
Add the following to your `~/.ssh/config` file to use the shorthand commands:

```ssh
Host murphys-main
    HostName 167.99.53.90
    User ravidor
    IdentityFile ~/.ssh/id_ed25519_digitalocean

Host murphys-n8n
    HostName 45.55.74.28
    User ravidor
    IdentityFile ~/.ssh/id_ed25519_digitalocean
```

### Common SSH Commands
- **Connect to Main Server:** `ssh murphys-main`
- **Connect to n8n Server:** `ssh murphys-n8n`
- **Check Main Status:** `ssh murphys-main 'uptime && pm2 list'`
- **Check n8n Status:** `ssh murphys-n8n 'sudo docker ps'`

Refer to `SERVER_MAINTENANCE.md` for detailed update procedures and disaster recovery steps.

## Documentation Index

### Core Project Docs
- `README.md`: Main project overview and entry point.
- `TODO.md`: Current backlog and pending tasks.
- `SERVER_MAINTENANCE.md`: Critical guide for server updates and maintenance.

### Architecture & Development
- `shared/docs/API_ENDPOINTS.md`: List of all available backend API routes.
- `shared/docs/DATABASE.md`: Schema details and SQLite management.
- `shared/docs/DATABASE_MIGRATIONS.md`: How to run and create migrations.
- `shared/docs/MOBILE-ARCHITECTURE.md`: Technical overview of Android and iOS apps.
- `shared/docs/MOBILE-REPOSITORY-STRUCTURE.md`: How mobile code is organized.

### Operations & Deployment
- `shared/docs/DEPLOYMENT.md`: Step-by-step production deployment guide.
- `shared/docs/DEPLOY-MONITORING.md`: How we monitor server health and n8n.
- `shared/docs/BACKUP-RESTORE.md`: Disaster recovery and backup procedures.
- `shared/docs/DISASTER-RECOVERY.md`: What to do when things break.
- `shared/docs/GITHUB-SECRETS-SETUP.md`: Necessary secrets for CI/CD.

### Platform Specifics
- `web/README.md`: Frontend development details.
- `backend/README.md`: Backend development details.
- `ios/README.md` & `ios/SETUP.md`: iOS environment setup.
- `shared/README.md`: Overview of shared assets and logic.
