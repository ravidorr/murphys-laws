# Murphy's Laws

A comprehensive collection of Murphy's Laws - humorous observations about life's tendency for things to go wrong.

Available on **Web**, **iOS**, and **Android**.

## Platforms

- **Web**: <https://murphys-laws.com> (PWA - installable, works offline)
- **iOS**: Coming Soon
- **Android**: Coming Soon

## AI & Developer Integration

Four official ways to integrate Murphy's Laws. No API key for reads.

| Package | npm | Purpose |
|---------|-----|---------|
| [`murphys-laws-sdk`](sdk/) | [![npm](https://img.shields.io/npm/v/murphys-laws-sdk.svg?label=)](https://www.npmjs.com/package/murphys-laws-sdk) | Typed TypeScript client, zero deps |
| [`murphys-laws-cli`](cli/) | [![npm](https://img.shields.io/npm/v/murphys-laws-cli.svg?label=)](https://www.npmjs.com/package/murphys-laws-cli) | Command-line interface (`npx murphys-laws-cli`) |
| [`murphys-laws-mcp`](mcp/) | [![npm](https://img.shields.io/npm/v/murphys-laws-mcp.svg?label=)](https://www.npmjs.com/package/murphys-laws-mcp) | Model Context Protocol server for AI agents |
| [REST API](shared/docs/API.md) | - | Public HTTP API at `https://murphys-laws.com/api/v1/` |

Full details and examples on the [developer landing page](https://murphys-laws.com/developers).

### REST API

Public API at `https://murphys-laws.com/api/v1/`, no auth required for reads.

- [API Documentation](shared/docs/API.md)
- [OpenAPI spec](https://murphys-laws.com/openapi.json)
- [llms.txt](https://murphys-laws.com/llms.txt) | [llms-full.txt](https://murphys-laws.com/llms-full.txt)

### TypeScript SDK

[`murphys-laws-sdk`](sdk/) on [npm](https://www.npmjs.com/package/murphys-laws-sdk) is a tiny typed client over the REST API with zero runtime dependencies.

```ts
import { MurphysLawsClient } from 'murphys-laws-sdk';
const law = await new MurphysLawsClient().getRandomLaw();
```

### Command-line interface

[`murphys-laws-cli`](cli/) on [npm](https://www.npmjs.com/package/murphys-laws-cli) wraps the API for scripts and terminal use.

```bash
npx murphys-laws-cli random
npx murphys-laws-cli search "computer" --limit 3
```

### MCP Server (Model Context Protocol)

An [MCP server](mcp/) lets AI agents (Claude Desktop, Cursor, VS Code Copilot) query Murphy's Laws directly.

Quick start, no clone needed:

```json
{
  "mcpServers": {
    "murphys-laws": {
      "command": "npx",
      "args": ["-y", "murphys-laws-mcp"]
    }
  }
}
```

7 tools: `search_laws`, `get_random_law`, `get_law_of_the_day`, `get_law`, `list_categories`, `get_laws_by_category`, `submit_law`.

See [mcp/README.md](mcp/README.md) or [npm](https://www.npmjs.com/package/murphys-laws-mcp), or the [developer landing page](https://murphys-laws.com/developers) for the full picture.

## Repository Structure

This is a monorepo containing:

```
murphys-laws/
├── backend/        # Node.js API server (TypeScript runtime via tsx)
├── web/            # Web application (TypeScript + Vite)
├── mcp/            # MCP server for AI agent integration (npm: murphys-laws-mcp)
├── sdk/            # TypeScript SDK over the public REST API (npm: murphys-laws-sdk)
├── cli/            # Command-line interface (npm: murphys-laws-cli)
├── ios/            # iOS app (Swift + SwiftUI)
├── android/        # Android app (Kotlin + Jetpack Compose)
└── shared/         # Shared resources and documentation
```

## Quick Start

### Backend (API Server)

```bash
cd backend
npm install
npm run build:db # Build SQLite database
npm run dev # Start API server
npm start # Run API from src/server/api-server.ts via tsx
```

### Web Application

```bash
cd web
npm install
npm run dev # Start dev server
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

## Documentation

- **Architecture**: [Mobile Architecture Guide](shared/docs/MOBILE-ARCHITECTURE.md)
- **MCP Server**: [MCP README](mcp/README.md)
- **API**: [API Documentation](shared/docs/API.md)
- **iOS**: [iOS PRD](shared/docs/MOBILE-IOS-PRD.md)
- **Android**: [Android PRD](shared/docs/MOBILE-ANDROID-PRD.md)
- **Deployment**: [Deployment Guide](shared/docs/DEPLOYMENT.md)
- **Repository Structure**: [Repository Structure Guide](shared/docs/MOBILE-REPOSITORY-STRUCTURE.md)

## Testing

```bash
# Run all tests (backend unit, web unit, web E2E)
npm test

# Test a subset only
npm run test:backend   # Backend Vitest suite
npm run test:web       # Web Vitest suite only (no E2E)
npm run test:web:e2e   # Web E2E (Playwright) only
```

## Development

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

**Note**: The `predev` script automatically cleans up any orphaned processes using ports 8787 and 5175 before starting.

### Troubleshooting Port Issues

If you encounter `EADDRINUSE` errors (port already in use):

```bash
# Check which processes are using development ports
npm run cleanup-ports

# Automatically kill processes using development ports
npm run cleanup-ports --kill

# Or manually check and kill
lsof -i :8787  # Check API port
lsof -i :5175  # Check frontend port
kill <PID>     # Kill the process
```

## Building

```bash
# Build everything
npm run build

# Build specific platform
npm run build:web
npm run build:backend:db
```

## TypeScript Runtime Architecture

- Backend runs TypeScript source directly with `tsx` (no JS build step required for startup).
- Canonical backend runtime entrypoint: `backend/src/server/api-server.ts`.
- PM2 runtime uses Node loader: `node --import tsx`.
- Shared runtime templates are TypeScript in `shared/modules/*.ts`.

## Deployment

See [Deployment Guide](shared/docs/DEPLOYMENT.md) for detailed instructions.

```bash
# Deploy web app (builds and syncs to production)
npm run deploy
```

## Keyboard Shortcuts (Web)

Press `?` anywhere on the site to see all available shortcuts:

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `↑` / `↓` | Navigate search suggestions (when autocomplete is open) |
| `Enter` | Select search suggestion (when autocomplete is open) |
| `Escape` | Close search suggestions / modal / popover |
| `j` | Next law card |
| `k` | Previous law card |
| `?` | Show shortcuts help |
| `Enter` / `Space` | Activate focused card |

**Search Autocomplete:** When typing in the search field, suggestions appear automatically. Use arrow keys to navigate, Enter to select, or Escape to close.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under CC0 1.0 Universal (Public Domain).

## Acknowledgments

Thanks to all contributors who have submitted Murphy's Laws over the years!

---

**Made with for anyone who's ever experienced Murphy's Law in action**
