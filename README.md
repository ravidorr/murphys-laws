# Murphy's Laws

A comprehensive collection of Murphy's Laws, humorous observations about life's tendency for things to go wrong at the worst possible moment. This project preserves and organizes the wisdom of Murphy's Laws and its many variations, submitted by people from around the world.

## About Murphy's Laws

Murphy's Law states: **"If anything can go wrong, it will."** This fundamental law was named after Captain Edward A. Murphy, an engineer working on Air Force Project MX981 in 1949 at Edwards Air Force Base. What started as a simple observation has evolved into a vast collection of life's ironies and inevitable mishaps.

## Features

### Categorized Laws Collection
Over 40 specialized categories covering every aspect of life:
- **Technology**: Computers, phones, printers, and digital devices
- **Transportation**: Cars, buses, airplanes, and public transport
- **Workplace**: Office life, employees, bosses, and meetings
- **Personal Life**: Love, family, toddlers, and daily activities
- **Specialized Fields**: Medical, military, education, sports, and more

### Sod's Law Calculator
An interactive web application that calculates the probability of things going wrong using the official British Gas formula:

**Formula**: `((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))`

Where:
- **U** = Urgency (1-9)
- **C** = Complexity (1-9) 
- **I** = Importance (1-9)
- **S** = Skill level (1-9)
- **F** = Frequency (1-9)
- **A** = Activity factor (constant: 0.7)

### Real-Life Stories
A collection of user-submitted stories demonstrating Murphy's Laws in action, including philosophical debates about the nature of these universal truths.

## Origin Story

This collection began in the late 1990s when Raanan Avidor, a science fiction enthusiast inspired by Larry Niven's references to Murphy's Law, started a simple homepage on Geocities. After posting a personal Murphy's Law experience, emails started pouring in from people around the world sharing their own stories and laws. 

What started as a learning exercise in HTML became a comprehensive archive of life's inevitable ironies, demonstrating that Murphy's Law truly is universal.

## The Great Debate: Murphy's Law vs. Faith

The collection includes a fascinating philosophical debate between various readers about whether Murphy's Laws conflict with religious beliefs. This discussion showcases different perspectives on fatalism, optimism, and the role of humor in coping with life's challenges.

## Development

### Prerequisites

- Node.js 18+ and npm
- sqlite3 CLI available on PATH

### Getting Started

```bash
# Install dependencies
npm ci

# Start local API server (SQLite-backed, CORS enabled)
npm run api
# Serves on http://127.0.0.1:8787

# Start frontend dev server (Vite, proxies /api → 127.0.0.1:8787)
npm run dev
# Dev server: http://127.0.0.1:5175
```

### Common Commands

**Building**
```bash
npm run build                    # Build production assets
npm run preview                  # Preview production build (port 5173)
```

**Testing**
```bash
npm test                         # Run unit tests (Vitest)
npm run test:watch               # Watch mode
npm run e2e                      # End-to-end tests (Playwright)
```

**Linting**
```bash
npm run lint                     # Lint JavaScript
npm run lint:fix                 # Auto-fix JavaScript
npm run lint:css                 # Lint CSS
npm run lint:css:fix             # Auto-fix CSS
```

**Database Management**
```bash
npm run migrate                  # Run database migrations
npm run db:init                  # Initialize schema
npm run db:import                # Import data from markdown
npm run db:rebuild               # Rebuild DB from scratch
```

### Architecture

**Frontend** (`src/`)
- Framework-free vanilla JavaScript with hash routing
- Entry point: `src/main.js`
- Views: `src/views/` (home, browse, law-detail, calculator, etc.)
- Components: `src/ui/` (header, navigation)
- Styling: `styles/site.css` (prefer classes over inline styles)

**Backend**
- API server: `scripts/api-server.mjs` (Node.js + SQLite)
- Endpoints: `/api/health`, `/api/laws`, `/api/laws/:id`
- Data pipeline: Markdown files → SQLite via `scripts/build-sqlite.mjs`

**Dev Servers**
- API: `127.0.0.1:8787` (npm run api)
- Vite dev: `127.0.0.1:5175` with `/api` proxy
- Preview: `localhost:5173` (for Playwright e2e)

### Database Changes

⚠️ **IMPORTANT**: Never commit `murphys.db` directly! This file contains production user data.

To make database schema changes, use the migration system:

```bash
# 1. Create a migration file
cat > db/migrations/002_my_change.sql << 'EOF'
ALTER TABLE laws ADD COLUMN my_column TEXT;
EOF

# 2. Test locally
npm run migrate

# 3. Commit and deploy
git add db/migrations/002_my_change.sql
git commit -m "feat: Add my_column to laws"
git push
```

**See [DATABASE.md](./DATABASE.md) for complete documentation.**

A git hook will prevent you from accidentally committing the database file.

### Email Notifications

The API server can send email notifications when new laws are submitted. To enable:

1. **Create a `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Configure SMTP settings** in `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=noreply@murphys-laws.com
   ```

3. **For Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password

4. **Restart the API server**:
   ```bash
   npm run api
   ```

Emails will be sent to `ravidor@gmail.com` with subject "New Murphy Law Submitted!"

## Contributing

This is a living collection! This archive preserves the wisdom and humor for future generations. The laws demonstrate universal truths that transcend culture, profession, and time.

## License

This work is licensed under [CC0 1.0 Universal (CC0 1.0) Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/). You can copy, modify, and distribute this work, even for commercial purposes, without asking permission.

See the [LICENSE](LICENSE) file for full details.

## Core Murphy's Laws

Here are some essential laws to get you started:

- **The Original**: If anything can go wrong, it will.
- **The Corollary**: If anything just cannot go wrong, it will anyway.
- **The Timing Law**: If anything can go wrong, it will at the worst possible moment.
- **O'Toole's Commentary**: Murphy was an optimist!
- **The Bread Law**: The chance of bread falling butter-side down is directly proportional to the cost of the carpet.

## Why Murphy's Laws Matter

Murphy's Laws serve as:
- **Stress Relief**: Humor helps us cope with inevitable frustrations
- **Preparedness**: Expecting problems helps us plan better
- **Universal Truth**: These experiences are shared across all humanity
- **Perspective**: Sometimes laughing is better than crying

---

*Remember: Murphy's Law isn't about pessimism, it's about finding humor in life's inevitable chaos and being prepared for the unexpected. After all, if you're reading this README, something probably just went wrong that brought you here!* 😄
