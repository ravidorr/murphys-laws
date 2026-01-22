# Murphy's Laws

A comprehensive collection of Murphy's Laws - humorous observations about life's tendency for things to go wrong.

Available on **Web**, **iOS**, and **Android**.

## Platforms

- **Web**: https://murphys-laws.com
- **iOS**: Coming Soon
- **Android**: Coming Soon

## Repository Structure

This is a monorepo containing:

```
murphys-laws/
├── backend/        # Node.js API server (shared by all platforms)
├── web/            # Web application (Vanilla JS + Vite)
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
- **API**: [API Documentation](shared/docs/API.md)
- **iOS**: [iOS PRD](shared/docs/MOBILE-IOS-PRD.md)
- **Android**: [Android PRD](shared/docs/MOBILE-ANDROID-PRD.md)
- **Deployment**: [Deployment Guide](shared/docs/DEPLOYMENT.md)
- **Repository Structure**: [Repository Structure Guide](shared/docs/MOBILE-REPOSITORY-STRUCTURE.md)

## Testing

```bash
# Run all tests
npm test

# Test specific platform
npm run test:backend  # 15 Vitest unit tests (controllers, services, middleware)
npm run test:web      # Web application tests
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
| `j` | Next law card |
| `k` | Previous law card |
| `?` | Show shortcuts help |
| `Escape` | Close modal/popover |
| `Enter` / `Space` | Activate focused card |

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
