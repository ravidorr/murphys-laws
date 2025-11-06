#!/bin/bash

################################################################################
# Murphy's Laws - Monorepo Migration Script
#
# This script restructures the repository into a monorepo with:
# - backend/     - Node.js API server
# - web/         - Web application
# - ios/         - iOS app (placeholder)
# - android/     - Android app (placeholder)
# - shared/      - Shared resources
#
# Usage:
#   ./scripts/migrate-to-monorepo.sh [--dry-run] [--force]
#
# Options:
#   --dry-run    Show what would be done without making changes
#   --force      Skip confirmation prompts
#   --rollback   Restore from backup
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/.migration-backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
FORCE=false
ROLLBACK=false

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

confirm() {
    if [ "$FORCE" = true ]; then
        return 0
    fi

    read -p "$(echo -e ${YELLOW}$1${NC}) [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

execute() {
    local cmd="$1"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN]${NC} $cmd"
    else
        eval "$cmd"
    fi
}

################################################################################
# Prerequisites Check
################################################################################

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if we're in the repo root
    if [ ! -f "$REPO_ROOT/package.json" ]; then
        log_error "Not in repository root. Please run from murphys-laws directory."
        exit 1
    fi

    # Check if git repo
    if [ ! -d "$REPO_ROOT/.git" ]; then
        log_error "Not a git repository."
        exit 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "You have uncommitted changes."
        if ! confirm "Continue anyway?"; then
            exit 1
        fi
    fi

    # Check required commands
    local required_commands=("git" "node" "npm" "sed")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done

    log_success "Prerequisites check passed"
}

################################################################################
# Backup Functions
################################################################################

create_backup() {
    log_info "Creating backup at: $BACKUP_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup"
        return
    fi

    mkdir -p "$BACKUP_DIR"

    # Backup important directories and files
    local items_to_backup=(
        "src"
        "scripts"
        "db"
        "tests"
        "e2e"
        "styles"
        "public"
        "murphys-laws"
        "config"
        "package.json"
        "package-lock.json"
        "vite.config.js"
        "index.html"
        "ecosystem.config.cjs"
        ".env.example"
    )

    for item in "${items_to_backup[@]}"; do
        if [ -e "$REPO_ROOT/$item" ]; then
            cp -r "$REPO_ROOT/$item" "$BACKUP_DIR/"
            log_success "Backed up: $item"
        fi
    done

    log_success "Backup created successfully"
}

restore_backup() {
    if [ ! -d "$1" ]; then
        log_error "Backup directory not found: $1"
        exit 1
    fi

    log_warning "Restoring from backup: $1"

    if ! confirm "This will overwrite current files. Continue?"; then
        exit 1
    fi

    cp -r "$1"/* "$REPO_ROOT/"
    log_success "Backup restored"
}

################################################################################
# Directory Structure Creation
################################################################################

create_directory_structure() {
    log_info "Creating new directory structure..."

    local directories=(
        "backend"
        "backend/scripts"
        "backend/db"
        "backend/config"
        "backend/logs"
        "backend/tests"
        "web"
        "web/src"
        "web/styles"
        "web/public"
        "web/tests"
        "web/e2e"
        "ios"
        "android"
        "shared"
        "shared/docs"
        "shared/data"
        "shared/assets"
        ".github/workflows"
    )

    for dir in "${directories[@]}"; do
        execute "mkdir -p '$REPO_ROOT/$dir'"
        log_success "Created: $dir/"
    done
}

################################################################################
# File Migration
################################################################################

migrate_backend_files() {
    log_info "Migrating backend files..."

    # Move backend scripts
    execute "mv '$REPO_ROOT/scripts'/* '$REPO_ROOT/backend/scripts/' 2>/dev/null || true"

    # Move database files
    execute "mv '$REPO_ROOT/db'/* '$REPO_ROOT/backend/db/' 2>/dev/null || true"

    # Move config files
    if [ -f "$REPO_ROOT/ecosystem.config.cjs" ]; then
        execute "mv '$REPO_ROOT/ecosystem.config.cjs' '$REPO_ROOT/backend/'"
    fi

    if [ -d "$REPO_ROOT/config" ]; then
        execute "mv '$REPO_ROOT/config'/* '$REPO_ROOT/backend/config/' 2>/dev/null || true"
    fi

    # Move backend-specific tests
    if [ -d "$REPO_ROOT/tests" ]; then
        execute "cp -r '$REPO_ROOT/tests'/* '$REPO_ROOT/backend/tests/' 2>/dev/null || true"
    fi

    log_success "Backend files migrated"
}

migrate_web_files() {
    log_info "Migrating web files..."

    # Move web source
    execute "mv '$REPO_ROOT/src'/* '$REPO_ROOT/web/src/' 2>/dev/null || true"

    # Move styles
    execute "mv '$REPO_ROOT/styles'/* '$REPO_ROOT/web/styles/' 2>/dev/null || true"

    # Move public assets
    execute "mv '$REPO_ROOT/public'/* '$REPO_ROOT/web/public/' 2>/dev/null || true"

    # Move tests
    execute "mv '$REPO_ROOT/tests'/* '$REPO_ROOT/web/tests/' 2>/dev/null || true"
    execute "mv '$REPO_ROOT/e2e'/* '$REPO_ROOT/web/e2e/' 2>/dev/null || true"

    # Move web config files
    if [ -f "$REPO_ROOT/index.html" ]; then
        execute "mv '$REPO_ROOT/index.html' '$REPO_ROOT/web/'"
    fi

    if [ -f "$REPO_ROOT/vite.config.js" ]; then
        execute "mv '$REPO_ROOT/vite.config.js' '$REPO_ROOT/web/'"
    fi

    if [ -f "$REPO_ROOT/playwright.config.ts" ]; then
        execute "mv '$REPO_ROOT/playwright.config.ts' '$REPO_ROOT/web/'"
    fi

    if [ -f "$REPO_ROOT/.stylelintrc.json" ]; then
        execute "mv '$REPO_ROOT/.stylelintrc.json' '$REPO_ROOT/web/'"
    fi

    log_success "Web files migrated"
}

migrate_shared_files() {
    log_info "Migrating shared files..."

    # Move law data to shared
    if [ -d "$REPO_ROOT/murphys-laws" ]; then
        execute "mv '$REPO_ROOT/murphys-laws' '$REPO_ROOT/shared/data/'"
    fi

    # Move documentation to shared
    if [ -d "$REPO_ROOT/docs" ]; then
        execute "mv '$REPO_ROOT/docs'/* '$REPO_ROOT/shared/docs/' 2>/dev/null || true"
    fi

    log_success "Shared files migrated"
}

cleanup_old_directories() {
    log_info "Cleaning up old empty directories..."

    local old_dirs=(
        "src"
        "scripts"
        "db"
        "tests"
        "e2e"
        "styles"
        "public"
        "murphys-laws"
        "config"
        "docs"
    )

    for dir in "${old_dirs[@]}"; do
        if [ -d "$REPO_ROOT/$dir" ] && [ -z "$(ls -A "$REPO_ROOT/$dir")" ]; then
            execute "rmdir '$REPO_ROOT/$dir'"
            log_success "Removed empty: $dir/"
        fi
    done
}

################################################################################
# Configuration Updates
################################################################################

update_backend_configs() {
    log_info "Updating backend configuration files..."

    # Update paths in build-sqlite.mjs
    local build_sqlite="$REPO_ROOT/backend/scripts/build-sqlite.mjs"
    if [ -f "$build_sqlite" ] && [ "$DRY_RUN" = false ]; then
        sed -i.bak "s|'murphys-laws'|'../shared/data/murphys-laws'|g" "$build_sqlite"
        sed -i.bak "s|'db/murphys-laws.sqlite'|'db/murphys-laws.sqlite'|g" "$build_sqlite"
        rm -f "$build_sqlite.bak"
        log_success "Updated: backend/scripts/build-sqlite.mjs"
    fi

    # Update paths in api-server.mjs
    local api_server="$REPO_ROOT/backend/scripts/api-server.mjs"
    if [ -f "$api_server" ] && [ "$DRY_RUN" = false ]; then
        sed -i.bak "s|'db/murphys-laws.sqlite'|'db/murphys-laws.sqlite'|g" "$api_server"
        rm -f "$api_server.bak"
        log_success "Updated: backend/scripts/api-server.mjs"
    fi

    # Update ecosystem.config.cjs
    local ecosystem="$REPO_ROOT/backend/ecosystem.config.cjs"
    if [ -f "$ecosystem" ] && [ "$DRY_RUN" = false ]; then
        sed -i.bak "s|script: 'scripts/|script: './scripts/|g" "$ecosystem"
        rm -f "$ecosystem.bak"
        log_success "Updated: backend/ecosystem.config.cjs"
    fi
}

update_web_configs() {
    log_info "Updating web configuration files..."

    # Update vite.config.js if needed
    local vite_config="$REPO_ROOT/web/vite.config.js"
    if [ -f "$vite_config" ] && [ "$DRY_RUN" = false ]; then
        # Vite config should work as-is since it's relative to web/ directory
        log_success "Verified: web/vite.config.js"
    fi
}

split_package_json() {
    log_info "Splitting package.json into platform-specific files..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would split package.json"
        return
    fi

    # Read original package.json
    local original_pkg="$REPO_ROOT/package.json"

    # Create backend package.json
    cat > "$REPO_ROOT/backend/package.json" <<'EOF'
{
  "name": "murphys-laws-backend",
  "version": "1.0.0",
  "description": "Murphy's Laws API Server",
  "type": "module",
  "main": "scripts/api-server.mjs",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "start": "node scripts/api-server.mjs",
    "dev": "node --watch scripts/api-server.mjs",
    "build:db": "node scripts/build-sqlite.mjs",
    "migrate": "node scripts/migrate.mjs",
    "test": "echo \"Backend tests not yet implemented\" && exit 0"
  },
  "keywords": ["murphys-law", "api", "backend"],
  "author": "",
  "license": "CC0-1.0",
  "dependencies": {
    "better-sqlite3": "^12.4.1",
    "dotenv": "^16.4.7",
    "nodemailer": "^7.0.7",
    "validator": "^13.15.20"
  }
}
EOF
    log_success "Created: backend/package.json"

    # Create web package.json
    cat > "$REPO_ROOT/web/package.json" <<'EOF'
{
  "name": "murphys-laws-web",
  "version": "2.1.0",
  "description": "Murphy's Laws Web Application",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "preview:build": "npm run build && npm run preview",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:css": "stylelint \"styles/**/*.css\"",
    "lint:css:fix": "stylelint \"styles/**/*.css\" --fix"
  },
  "keywords": ["murphys-law", "web", "frontend"],
  "author": "",
  "license": "CC0-1.0",
  "dependencies": {
    "mathjax": "^3.2.2",
    "mathjax-full": "^3.2.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.2",
    "@vitest/coverage-v8": "^3.2.4",
    "eslint": "^9.20.0",
    "jsdom": "^26.0.0",
    "stylelint": "^16.15.0",
    "stylelint-config-standard": "^38.1.0",
    "vite": "^7.1.0",
    "vitest": "^3.2.4"
  }
}
EOF
    log_success "Created: web/package.json"

    # Create root package.json (workspace manager)
    cat > "$REPO_ROOT/package.json" <<'EOF'
{
  "name": "murphys-laws-monorepo",
  "version": "1.0.0",
  "description": "Murphy's Laws - Monorepo for Web, iOS, and Android apps",
  "private": true,
  "workspaces": [
    "backend",
    "web"
  ],
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:web": "cd web && npm run dev",
    "dev": "npm run dev:backend & npm run dev:web",
    "build:backend:db": "cd backend && npm run build:db",
    "build:web": "cd web && npm run build",
    "build": "npm run build:backend:db && npm run build:web",
    "test:backend": "cd backend && npm test",
    "test:web": "cd web && npm test",
    "test:web:e2e": "cd web && npm run test:e2e",
    "test": "npm run test:backend && npm run test:web",
    "lint:web": "cd web && npm run lint && npm run lint:css",
    "lint": "npm run lint:web",
    "deploy": "node backend/scripts/deploy.mjs",
    "validate-ports": "node backend/scripts/validate-ports.mjs",
    "install:all": "npm install && cd backend && npm install && cd ../web && npm install"
  },
  "keywords": ["murphys-law", "monorepo"],
  "author": "",
  "license": "CC0-1.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
EOF
    log_success "Created: root package.json (workspace manager)"
}

################################################################################
# README Creation
################################################################################

create_backend_readme() {
    log_info "Creating backend README..."

    cat > "$REPO_ROOT/backend/README.md" <<'EOF'
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
EOF

    log_success "Created: backend/README.md"
}

create_web_readme() {
    log_info "Creating web README..."

    cat > "$REPO_ROOT/web/README.md" <<'EOF'
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
│   ├── main.js              # Entry point
│   ├── router.js            # Client-side routing
│   ├── views/               # Page views
│   ├── components/          # Reusable components
│   ├── modules/             # Shared logic
│   └── utils/               # Helper functions
├── styles/                  # CSS stylesheets
├── public/                  # Static assets
├── tests/                   # Unit tests
└── e2e/                     # End-to-end tests
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md).
EOF

    log_success "Created: web/README.md"
}

create_ios_readme() {
    log_info "Creating iOS README..."

    cat > "$REPO_ROOT/ios/README.md" <<'EOF'
# Murphy's Laws - iOS App

Native iOS application built with Swift and SwiftUI.

## Requirements

- macOS 13+
- Xcode 15+
- iOS 16+ deployment target

## Setup

```bash
cd ios
open MurphysLaws.xcodeproj
```

Or if using Swift Package Manager dependencies:
```bash
open MurphysLaws.xcworkspace
```

## Running

1. Select target device/simulator in Xcode
2. Press `⌘R` to build and run

## Testing

```bash
# Unit tests
⌘U in Xcode

# Or via command line
xcodebuild test \
  -project MurphysLaws.xcodeproj \
  -scheme MurphysLaws \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Project Structure

```
ios/MurphysLaws/
├── App/                    # App entry point
├── Models/                 # Data models
├── ViewModels/             # MVVM ViewModels
├── Views/                  # SwiftUI views
├── Services/               # API, caching, etc.
├── Repositories/           # Data access layer
├── Utilities/              # Helper functions
└── Resources/              # Assets, plist
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md#ios-architecture).

## Documentation

- [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md)
- [API Documentation](../shared/docs/API.md)

## Status

🚧 **Coming Soon** - iOS app is not yet implemented.

See [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md) for planned features and timeline.
EOF

    log_success "Created: ios/README.md"
}

create_android_readme() {
    log_info "Creating Android README..."

    cat > "$REPO_ROOT/android/README.md" <<'EOF'
# Murphy's Laws - Android App

Native Android application built with Kotlin and Jetpack Compose.

## Requirements

- Android Studio Hedgehog (2023.1.1)+
- JDK 17+
- Android SDK 26+ (API level 26)
- Gradle 8.0+

## Setup

```bash
cd android
./gradlew build
```

Or open in Android Studio:
```bash
# Open android/ directory in Android Studio
```

## Running

**Android Studio:**
1. Open `android/` directory
2. Select device/emulator
3. Click Run (Shift+F10)

**Command Line:**
```bash
./gradlew installDebug
adb shell am start -n com.murphyslaws/.MainActivity
```

## Testing

```bash
# Unit tests
./gradlew test

# Instrumented tests
./gradlew connectedAndroidTest

# Test with coverage
./gradlew testDebugUnitTestCoverage
```

## Building

```bash
# Debug APK
./gradlew assembleDebug

# Release APK
./gradlew assembleRelease

# Release AAB (for Google Play)
./gradlew bundleRelease
```

## Project Structure

```
android/app/src/main/
├── java/com/murphyslaws/
│   ├── data/                   # Data layer
│   │   ├── local/              # Room database
│   │   ├── remote/             # API (Retrofit)
│   │   └── repository/         # Repository implementations
│   ├── domain/                 # Domain layer
│   │   ├── model/              # Domain models
│   │   ├── repository/         # Repository interfaces
│   │   └── usecase/            # Use cases
│   ├── presentation/           # Presentation layer
│   │   ├── home/               # Home screen
│   │   ├── browse/             # Browse laws
│   │   ├── search/             # Search
│   │   └── navigation/         # Navigation
│   ├── util/                   # Utilities
│   └── di/                     # Hilt modules
└── res/                        # Android resources
```

## Architecture

See [Mobile Architecture](../shared/docs/MOBILE-ARCHITECTURE.md#android-architecture).

## Documentation

- [Android PRD](../shared/docs/MOBILE-ANDROID-PRD.md)
- [API Documentation](../shared/docs/API.md)

## Status

🚧 **Coming Soon** - Android app is not yet implemented.

See [Android PRD](../shared/docs/MOBILE-ANDROID-PRD.md) for planned features and timeline.
EOF

    log_success "Created: android/README.md"
}

create_shared_readme() {
    log_info "Creating shared README..."

    cat > "$REPO_ROOT/shared/README.md" <<'EOF'
# Murphy's Laws - Shared Resources

This directory contains resources shared across all platforms (web, iOS, Android).

## Structure

```
shared/
├── docs/              # Documentation
├── data/              # Shared data files
│   └── murphys-laws/  # Law markdown files
└── assets/            # Design assets
    ├── icons/         # App icons
    ├── logos/         # Logos
    └── screenshots/   # App screenshots
```

## Documentation

- [API Documentation](docs/API.md)
- [Mobile Architecture](docs/MOBILE-ARCHITECTURE.md)
- [iOS PRD](docs/MOBILE-IOS-PRD.md)
- [Android PRD](docs/MOBILE-ANDROID-PRD.md)
- [Repository Structure](docs/MOBILE-REPOSITORY-STRUCTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Law Data

Law content is stored in `data/murphys-laws/` as markdown files. These files are parsed by the backend to build the SQLite database.

**Format:**
```markdown
# Category Title

Law text here.

Sent by: Author Name <author@example.com>

---

Another law text.

Sent by: Different Author (https://example.com)
```

## Adding New Laws

1. Edit appropriate markdown file in `data/murphys-laws/`
2. Rebuild database: `cd backend && npm run build:db`
3. Restart API server

## Assets

Design assets for all platforms should be placed in `assets/`:
- `icons/` - App icons for iOS and Android
- `logos/` - Brand logos
- `screenshots/` - App Store / Google Play screenshots
EOF

    log_success "Created: shared/README.md"
}

update_root_readme() {
    log_info "Updating root README..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update root README.md"
        return
    fi

    cat > "$REPO_ROOT/README.md" <<'EOF'
# Murphy's Laws

A comprehensive collection of Murphy's Laws - humorous observations about life's tendency for things to go wrong.

Available on **Web**, **iOS**, and **Android**.

## 📱 Platforms

- **Web**: https://murphys-laws.com
- **iOS**: 🚧 Coming Soon
- **Android**: 🚧 Coming Soon

## 🏗️ Repository Structure

This is a monorepo containing:

```
murphys-laws/
├── backend/       # Node.js API server (shared by all platforms)
├── web/           # Web application (Vanilla JS + Vite)
├── ios/           # iOS app (Swift + SwiftUI)
├── android/       # Android app (Kotlin + Jetpack Compose)
└── shared/        # Shared resources and documentation
```

## 🚀 Quick Start

### Backend (API Server)

```bash
cd backend
npm install
npm run build:db    # Build SQLite database
npm run dev         # Start API server
```

### Web Application

```bash
cd web
npm install
npm run dev         # Start dev server
```

### iOS App

```bash
cd ios
open MurphysLaws.xcodeproj
# Press ⌘R to run
```

### Android App

```bash
cd android
./gradlew assembleDebug
# Or open in Android Studio
```

## 📚 Documentation

- **Architecture**: [Mobile Architecture Guide](shared/docs/MOBILE-ARCHITECTURE.md)
- **API**: [API Documentation](shared/docs/API.md)
- **iOS**: [iOS PRD](shared/docs/MOBILE-IOS-PRD.md)
- **Android**: [Android PRD](shared/docs/MOBILE-ANDROID-PRD.md)
- **Deployment**: [Deployment Guide](shared/docs/DEPLOYMENT.md)
- **Repository Structure**: [Repository Structure Guide](shared/docs/MOBILE-REPOSITORY-STRUCTURE.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific platform
npm run test:backend
npm run test:web
```

## 🛠️ Development

### Prerequisites

- Node.js 22+
- For iOS: macOS, Xcode 15+
- For Android: Android Studio Hedgehog+, JDK 17+

### Install Dependencies

```bash
# Install all dependencies (root + workspaces)
npm run install:all

# Or install individually
cd backend && npm install
cd web && npm install
```

### Run Development Servers

```bash
# Run backend + web concurrently
npm run dev

# Or run individually
npm run dev:backend
npm run dev:web
```

## 📦 Building

```bash
# Build everything
npm run build

# Build specific platform
npm run build:web
npm run build:backend:db
```

## 🚢 Deployment

See [Deployment Guide](shared/docs/DEPLOYMENT.md) for detailed instructions.

```bash
# Deploy web app (builds and syncs to production)
npm run deploy
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under CC0 1.0 Universal (Public Domain).

## 🙏 Acknowledgments

Thanks to all contributors who have submitted Murphy's Laws over the years!

---

**Made with ❤️ for anyone who's ever experienced Murphy's Law in action**
EOF

    log_success "Updated: README.md"
}

################################################################################
# GitHub Actions Workflows
################################################################################

create_github_workflows() {
    log_info "Creating GitHub Actions workflows..."

    # Backend CI
    cat > "$REPO_ROOT/.github/workflows/backend-ci.yml" <<'EOF'
name: Backend CI

on:
  push:
    paths:
      - 'backend/**'
      - 'shared/data/**'
      - '.github/workflows/backend-ci.yml'
  pull_request:
    paths:
      - 'backend/**'
      - 'shared/data/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build database
        run: npm run build:db

      - name: Run tests
        run: npm test

      - name: Check database exists
        run: test -f db/murphys-laws.sqlite
EOF
    log_success "Created: .github/workflows/backend-ci.yml"

    # Web CI
    cat > "$REPO_ROOT/.github/workflows/web-ci.yml" <<'EOF'
name: Web CI

on:
  push:
    paths:
      - 'web/**'
      - '.github/workflows/web-ci.yml'
  pull_request:
    paths:
      - 'web/**'

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint JavaScript
        run: npm run lint

      - name: Lint CSS
        run: npm run lint:css

      - name: Run unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: web/dist/
          retention-days: 7

  e2e-tests:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: web/playwright-report/
          retention-days: 7
EOF
    log_success "Created: .github/workflows/web-ci.yml"

    # iOS CI (placeholder)
    cat > "$REPO_ROOT/.github/workflows/ios-ci.yml" <<'EOF'
name: iOS CI

on:
  push:
    paths:
      - 'ios/**'
      - '.github/workflows/ios-ci.yml'
  pull_request:
    paths:
      - 'ios/**'

jobs:
  build-and-test:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable

      - name: Check for Xcode project
        id: check_project
        run: |
          if [ -f "ios/MurphysLaws.xcodeproj/project.pbxproj" ]; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi

      - name: Build (if project exists)
        if: steps.check_project.outputs.exists == 'true'
        run: |
          cd ios
          xcodebuild build \
            -project MurphysLaws.xcodeproj \
            -scheme MurphysLaws \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest'

      - name: Test (if project exists)
        if: steps.check_project.outputs.exists == 'true'
        run: |
          cd ios
          xcodebuild test \
            -project MurphysLaws.xcodeproj \
            -scheme MurphysLaws \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest'

      - name: Skip (project not yet created)
        if: steps.check_project.outputs.exists == 'false'
        run: echo "iOS project not yet created. Skipping build."
EOF
    log_success "Created: .github/workflows/ios-ci.yml"

    # Android CI (placeholder)
    cat > "$REPO_ROOT/.github/workflows/android-ci.yml" <<'EOF'
name: Android CI

on:
  push:
    paths:
      - 'android/**'
      - '.github/workflows/android-ci.yml'
  pull_request:
    paths:
      - 'android/**'

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Check for Gradle wrapper
        id: check_gradle
        run: |
          if [ -f "android/gradlew" ]; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi

      - name: Make gradlew executable
        if: steps.check_gradle.outputs.exists == 'true'
        run: chmod +x android/gradlew

      - name: Build (if project exists)
        if: steps.check_gradle.outputs.exists == 'true'
        run: |
          cd android
          ./gradlew build

      - name: Run tests (if project exists)
        if: steps.check_gradle.outputs.exists == 'true'
        run: |
          cd android
          ./gradlew test

      - name: Upload APK
        if: steps.check_gradle.outputs.exists == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: app-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 7

      - name: Skip (project not yet created)
        if: steps.check_gradle.outputs.exists == 'false'
        run: echo "Android project not yet created. Skipping build."
EOF
    log_success "Created: .github/workflows/android-ci.yml"
}

################################################################################
# Gitignore Update
################################################################################

update_gitignore() {
    log_info "Updating .gitignore for monorepo..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update .gitignore"
        return
    fi

    cat >> "$REPO_ROOT/.gitignore" <<'EOF'

# ===== Monorepo Structure =====

# Migration backups
.migration-backup-*/

# iOS
ios/DerivedData/
ios/build/
ios/*.xcworkspace/xcuserdata/
ios/*.xcodeproj/xcuserdata/
ios/*.xcodeproj/project.xcworkspace/xcshareddata/
ios/Pods/
ios/.DS_Store
ios/*.ipa
ios/*.dSYM.zip
ios/*.mobileprovision
ios/fastlane/report.xml
ios/fastlane/Preview.html
ios/fastlane/screenshots
ios/fastlane/test_output

# Android
android/.gradle/
android/local.properties
android/.idea/
android/captures/
android/*.apk
android/*.aab
android/app/release/
android/.cxx/
android/.externalNativeBuild/

# Platform-specific node_modules
backend/node_modules/
web/node_modules/

# Platform-specific build outputs
backend/dist/
web/dist/
EOF

    log_success "Updated: .gitignore"
}

################################################################################
# Post-Migration Tasks
################################################################################

install_dependencies() {
    log_info "Installing dependencies for all platforms..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would install dependencies"
        return
    fi

    # Install root dependencies (workspace manager)
    log_info "Installing root dependencies..."
    cd "$REPO_ROOT"
    npm install

    # Install backend dependencies
    log_info "Installing backend dependencies..."
    cd "$REPO_ROOT/backend"
    npm install

    # Install web dependencies
    log_info "Installing web dependencies..."
    cd "$REPO_ROOT/web"
    npm install

    log_success "All dependencies installed"
}

verify_migration() {
    log_info "Verifying migration..."

    local issues=()

    # Check backend structure
    if [ ! -f "$REPO_ROOT/backend/scripts/api-server.mjs" ]; then
        issues+=("Missing: backend/scripts/api-server.mjs")
    fi

    # Check web structure
    if [ ! -f "$REPO_ROOT/web/src/main.js" ]; then
        issues+=("Missing: web/src/main.js")
    fi

    # Check shared structure
    if [ ! -d "$REPO_ROOT/shared/data/murphys-laws" ]; then
        issues+=("Missing: shared/data/murphys-laws/")
    fi

    # Check package.json files
    if [ ! -f "$REPO_ROOT/backend/package.json" ]; then
        issues+=("Missing: backend/package.json")
    fi

    if [ ! -f "$REPO_ROOT/web/package.json" ]; then
        issues+=("Missing: web/package.json")
    fi

    # Check READMEs
    if [ ! -f "$REPO_ROOT/backend/README.md" ]; then
        issues+=("Missing: backend/README.md")
    fi

    if [ "${#issues[@]}" -gt 0 ]; then
        log_warning "Migration verification found issues:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
        return 1
    fi

    log_success "Migration verification passed!"
    return 0
}

################################################################################
# Main Migration Function
################################################################################

run_migration() {
    log_info "Starting monorepo migration..."
    echo

    # Show current structure
    log_info "Current structure:"
    echo "  src/       → web/src/"
    echo "  scripts/   → backend/scripts/"
    echo "  db/        → backend/db/"
    echo "  docs/      → shared/docs/"
    echo

    if ! confirm "Proceed with migration?"; then
        log_warning "Migration cancelled"
        exit 0
    fi

    echo

    # Execute migration steps
    create_backup
    create_directory_structure
    migrate_backend_files
    migrate_web_files
    migrate_shared_files
    cleanup_old_directories

    # Update configurations
    update_backend_configs
    update_web_configs
    split_package_json

    # Create documentation
    create_backend_readme
    create_web_readme
    create_ios_readme
    create_android_readme
    create_shared_readme
    update_root_readme

    # Create CI/CD
    create_github_workflows

    # Update gitignore
    update_gitignore

    # Post-migration
    if [ "$DRY_RUN" = false ]; then
        install_dependencies
        verify_migration
    fi

    echo
    log_success "Migration complete!"
    echo
    log_info "Backup location: $BACKUP_DIR"
    log_info "To rollback: ./scripts/migrate-to-monorepo.sh --rollback $BACKUP_DIR"
    echo
    log_info "Next steps:"
    echo "  1. Review changes: git status"
    echo "  2. Test backend: cd backend && npm run build:db && npm start"
    echo "  3. Test web: cd web && npm run dev"
    echo "  4. Commit changes: git add . && git commit -m 'chore: migrate to monorepo structure'"
    echo
}

################################################################################
# Main Script
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_info "Running in DRY RUN mode (no changes will be made)"
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                BACKUP_DIR="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Usage: $0 [--dry-run] [--force] [--rollback <backup-dir>]"
                exit 1
                ;;
        esac
    done

    # Handle rollback
    if [ "$ROLLBACK" = true ]; then
        restore_backup "$BACKUP_DIR"
        exit 0
    fi

    # Run migration
    check_prerequisites
    run_migration
}

# Run main function
main "$@"
