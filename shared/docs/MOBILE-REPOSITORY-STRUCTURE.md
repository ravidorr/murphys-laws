# Murphy's Laws - Repository Structure for Mobile Apps

**Last Updated:** November 6, 2025
**Decision:** Monorepo Approach (Recommended)

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure Options](#repository-structure-options)
3. [Recommended Structure: Monorepo](#recommended-structure-monorepo)
4. [Alternative Structures](#alternative-structures)
5. [CI/CD Integration](#cicd-integration)
6. [Version Management](#version-management)
7. [Migration Plan](#migration-plan)

---

## Overview

This document outlines the recommended repository structure for adding native iOS and Android apps to the Murphy's Laws project.

### Current State

```
murphys-laws/ # Single repository
├── src/ # Web app frontend (Vanilla JS)
├── scripts/ # Backend API server (Node.js)
├── db/ # SQLite database
├── docs/ # Documentation
├── tests/ # Web app tests
└── public/ # Static assets
```

### Goal

Add native iOS and Android apps that share the same backend API and database.

---

## Repository Structure Options

### Option 1: Monorepo (Recommended) ⭐

**Single repository containing web, iOS, Android, and backend**

**Pros:**
- Shared backend API - all platforms use same codebase
- Single source of truth for documentation
- Atomic commits across all platforms
- Unified issue tracking and project management
- Easier to keep API versions synchronized
- Simpler CI/CD pipeline coordination
- Single `git clone` for contributors

**Cons:**
- Larger repository size
- More complex CI/CD (need platform-specific jobs)
- iOS/Android developers must clone entire repo

**Best for:** Teams where backend and mobile are tightly coupled (your case)

---

### Option 2: Separate Repositories

**Three repositories: web, iOS, Android**

**Pros:**
- Smaller repository sizes
- Independent release cycles
- Easier permissions management per platform
- Simpler CI/CD per repo

**Cons:**
- API changes require coordinated updates across 3 repos
- Fragmented documentation
- Difficult to track cross-platform features
- More complex version management
- Separate issue trackers (or cross-repo references)

**Best for:** Independent apps with separate backends

---

### Option 3: Mobile Monorepo

**Two repositories: web + backend, mobile (iOS + Android)**

**Pros:**
- iOS and Android teams share repo
- Shared mobile documentation
- Backend separate from mobile
- Smaller web repo

**Cons:**
- API versioning harder to coordinate
- Backend changes require updates in 2 repos
- Duplicated documentation

**Best for:** Large teams with dedicated mobile/web divisions

---

## Recommended Structure: Monorepo

### Proposed Directory Structure

```
murphys-laws/ # Root repository
│
├── README.md # Main project README
├── LICENSE
├── .gitignore # Combined gitignore for all platforms
│
├── docs/ # Shared documentation
│ ├── README.md # Documentation index
│ ├── API.md # API endpoint documentation
│ ├── DATABASE.md # Database schema
│ ├── DEPLOYMENT.md # Deployment guide (web/API)
│ ├── MOBILE-IOS-PRD.md # iOS PRD
│ ├── MOBILE-ANDROID-PRD.md # Android PRD
│ ├── MOBILE-ARCHITECTURE.md # Mobile architecture
│ └── MOBILE-REPOSITORY-STRUCTURE.md # This file
│
├── backend/ # Shared backend (renamed from root)
│ ├── README.md # Backend-specific README
│ ├── package.json
│ ├── scripts/
│ │ ├── api-server.mjs # API server
│ │ ├── build-sqlite.mjs # Data importer
│ │ └── migrate.mjs # Database migrations
│ ├── db/
│ │ ├── schema.sql
│ │ └── migrations/
│ ├── tests/ # Backend tests
│ └── config/
│
├── web/ # Web application (moved from root)
│ ├── README.md # Web-specific README
│ ├── package.json
│ ├── vite.config.js
│ ├── index.html
│ ├── src/
│ │ ├── main.js
│ │ ├── router.js
│ │ ├── views/
│ │ ├── components/
│ │ ├── modules/
│ │ └── utils/
│ ├── styles/
│ ├── public/
│ ├── tests/ # Web tests
│ └── e2e/ # Web e2e tests
│
├── ios/ # iOS application
│ ├── README.md # iOS-specific README
│ ├── MurphysLaws.xcodeproj/ # Xcode project
│ ├── MurphysLaws.xcworkspace/ # Xcode workspace (if using SPM)
│ ├── MurphysLaws/ # Main app target
│ │ ├── App/
│ │ │ ├── MurphysLawsApp.swift
│ │ │ └── AppDelegate.swift
│ │ ├── Models/
│ │ │ ├── Law.swift
│ │ │ ├── Category.swift
│ │ │ └── Vote.swift
│ │ ├── ViewModels/
│ │ │ ├── LawListViewModel.swift
│ │ │ ├── LawDetailViewModel.swift
│ │ │ └── SearchViewModel.swift
│ │ ├── Views/
│ │ │ ├── Home/
│ │ │ ├── Browse/
│ │ │ ├── Search/
│ │ │ └── Calculators/
│ │ ├── Services/
│ │ │ ├── APIService.swift
│ │ │ ├── CacheService.swift
│ │ │ └── VotingService.swift
│ │ ├── Repositories/
│ │ │ └── LawRepository.swift
│ │ ├── Utilities/
│ │ │ ├── Constants.swift
│ │ │ ├── Extensions/
│ │ │ └── NetworkMonitor.swift
│ │ └── Resources/
│ │ ├── Assets.xcassets
│ │ └── Info.plist
│ ├── MurphysLawsTests/ # Unit tests
│ ├── MurphysLawsUITests/ # UI tests
│ └── Podfile # (if using CocoaPods, optional)
│
├── android/ # Android application
│ ├── README.md # Android-specific README
│ ├── build.gradle.kts # Project-level build file
│ ├── settings.gradle.kts
│ ├── gradle.properties
│ ├── app/
│ │ ├── build.gradle.kts # App-level build file
│ │ ├── proguard-rules.pro
│ │ └── src/
│ │ ├── main/
│ │ │ ├── AndroidManifest.xml
│ │ │ ├── java/com/murphyslaws/
│ │ │ │ ├── MurphysLawsApplication.kt
│ │ │ │ ├── MainActivity.kt
│ │ │ │ ├── data/
│ │ │ │ │ ├── local/
│ │ │ │ │ │ ├── LawDatabase.kt
│ │ │ │ │ │ ├── dao/
│ │ │ │ │ │ └── entities/
│ │ │ │ │ ├── remote/
│ │ │ │ │ │ ├── ApiService.kt
│ │ │ │ │ │ ├── dto/
│ │ │ │ │ │ └── NetworkModule.kt
│ │ │ │ │ └── repository/
│ │ │ │ ├── domain/
│ │ │ │ │ ├── model/
│ │ │ │ │ ├── repository/
│ │ │ │ │ └── usecase/
│ │ │ │ ├── presentation/
│ │ │ │ │ ├── home/
│ │ │ │ │ ├── browse/
│ │ │ │ │ ├── search/
│ │ │ │ │ └── navigation/
│ │ │ │ ├── util/
│ │ │ │ └── di/
│ │ │ └── res/
│ │ │ ├── values/
│ │ │ ├── drawable/
│ │ │ └── mipmap/
│ │ ├── test/ # Unit tests
│ │ └── androidTest/ # Instrumented tests
│ └── gradle/
│
├── shared/ # Shared resources (optional)
│ ├── assets/ # Design assets
│ │ ├── icons/
│ │ ├── logos/
│ │ └── screenshots/
│ └── data/ # Shared data
│ └── murphys-laws/ # Law markdown files
│
├── .github/ # GitHub configuration
│ ├── workflows/ # GitHub Actions
│ │ ├── backend-ci.yml # Backend tests
│ │ ├── web-ci.yml # Web tests and build
│ │ ├── ios-ci.yml # iOS build and test
│ │ └── android-ci.yml # Android build and test
│ ├── ISSUE_TEMPLATE/
│ │ ├── bug_report.md
│ │ ├── feature_request.md
│ │ ├── ios_bug.md
│ │ └── android_bug.md
│ └── CODEOWNERS # Code ownership
│
├── .gitignore # Combined gitignore
└── scripts/ # Repository management scripts
 ├── setup-ios.sh # iOS setup helper
 ├── setup-android.sh # Android setup helper
 └── sync-api-docs.sh # Sync API docs across platforms
```

---

## Detailed Structure Breakdown

### 1. Root Level Files

**`.gitignore` (Combined):**
```gitignore
# Node.js (Backend & Web)
node_modules/
npm-debug.log
.env
*.log

# Build outputs
dist/
build/
out/

# iOS
ios/DerivedData/
ios/build/
ios/*.xcworkspace/xcuserdata/
ios/*.xcodeproj/xcuserdata/
ios/Pods/
ios/.DS_Store
ios/*.ipa
ios/*.dSYM.zip

# Android
android/.gradle/
android/local.properties
android/.idea/
android/captures/
android/*.apk
android/*.aab
android/app/release/

# Database
*.sqlite
*.sqlite-journal
!db/schema.sql

# Editors
.vscode/
.idea/
*.swp
*.swo
.DS_Store
```

**`README.md` (Root):**
```markdown
# Murphy's Laws

A comprehensive collection of Murphy's Laws available on web, iOS, and Android.

## Platforms

- **Web**: https://murphys-laws.com
- **iOS**: Available on the App Store
- **Android**: Available on Google Play

## Repository Structure

- `backend/` - Shared Node.js API server
- `web/` - Web application (Vanilla JS + Vite)
- `ios/` - iOS app (Swift + SwiftUI)
- `android/` - Android app (Kotlin + Jetpack Compose)
- `docs/` - Documentation

## Quick Start

See platform-specific READMEs:
- [Backend Setup](backend/README.md)
- [Web Development](web/README.md)
- [iOS Development](ios/README.md)
- [Android Development](android/README.md)

## Documentation

- [API Documentation](docs/API.md)
- [Mobile Architecture](docs/MOBILE-ARCHITECTURE.md)
- [iOS PRD](docs/MOBILE-IOS-PRD.md)
- [Android PRD](docs/MOBILE-ANDROID-PRD.md)
```

---

### 2. Backend Directory

**`backend/README.md`:**
```markdown
# Murphy's Laws - Backend API

Node.js API server serving web, iOS, and Android clients.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run build:db # Build SQLite database
npm start # Start API server on port 8787
```

## API Endpoints

See [API Documentation](../docs/API.md)

## Testing

```bash
npm test
npm run test:coverage
```
```

---

### 3. Web Directory

**`web/README.md`:**
```markdown
# Murphy's Laws - Web Application

Vanilla JavaScript web application.

## Setup

```bash
cd web
npm install
npm run dev # Start dev server on port 5173
```

## Build

```bash
npm run build # Build for production
npm run preview # Preview production build
```

## Testing

```bash
npm test # Unit tests
npm run test:e2e # E2E tests
```
```

---

### 4. iOS Directory

**`ios/README.md`:**
```markdown
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

## Running

1. Select target device/simulator
2. Press ⌘R to build and run

## Testing

```bash
⌘U # Run unit tests
```

## Architecture

See [Mobile Architecture](../docs/MOBILE-ARCHITECTURE.md#ios-architecture)
```

---

### 5. Android Directory

**`android/README.md`:**
```markdown
# Murphy's Laws - Android App

Native Android application built with Kotlin and Jetpack Compose.

## Requirements

- Android Studio Hedgehog (2023.1.1)+
- JDK 17+
- Android SDK 26+ (API level 26)

## Setup

```bash
cd android
./gradlew build
```

## Running

1. Open `android/` in Android Studio
2. Select device/emulator
3. Click Run (Shift+F10)

## Testing

```bash
./gradlew test # Unit tests
./gradlew connectedAndroidTest # Instrumented tests
```

## Architecture

See [Mobile Architecture](../docs/MOBILE-ARCHITECTURE.md#android-architecture)
```

---

## CI/CD Integration

### GitHub Actions Workflow Structure

**`.github/workflows/backend-ci.yml`:**
```yaml
name: Backend CI

on:
 push:
 paths:
 - 'backend/**'
 - '.github/workflows/backend-ci.yml'
 pull_request:
 paths:
 - 'backend/**'

jobs:
 test:
 runs-on: ubuntu-latest
 defaults:
 run:
 working-directory: backend
 steps:
 - uses: actions/checkout@v3
 - uses: actions/setup-node@v3
 with:
 node-version: '22'
 - run: npm ci
 - run: npm test
 - run: npm run test:coverage
```

**`.github/workflows/web-ci.yml`:**
```yaml
name: Web CI

on:
 push:
 paths:
 - 'web/**'
 - 'backend/**' # Web depends on backend
 - '.github/workflows/web-ci.yml'
 pull_request:
 paths:
 - 'web/**'
 - 'backend/**'

jobs:
 test-and-build:
 runs-on: ubuntu-latest
 defaults:
 run:
 working-directory: web
 steps:
 - uses: actions/checkout@v3
 - uses: actions/setup-node@v3
 with:
 node-version: '22'
 - run: npm ci
 - run: npm test
 - run: npm run build
 - run: npm run test:e2e
```

**`.github/workflows/ios-ci.yml`:**
```yaml
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
 defaults:
 run:
 working-directory: ios
 steps:
 - uses: actions/checkout@v3
 - name: Build
 run: |
 xcodebuild build \
 -project MurphysLaws.xcodeproj \
 -scheme MurphysLaws \
 -destination 'platform=iOS Simulator,name=iPhone 15'
 - name: Test
 run: |
 xcodebuild test \
 -project MurphysLaws.xcodeproj \
 -scheme MurphysLaws \
 -destination 'platform=iOS Simulator,name=iPhone 15'
```

**`.github/workflows/android-ci.yml`:**
```yaml
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
 defaults:
 run:
 working-directory: android
 steps:
 - uses: actions/checkout@v3
 - uses: actions/setup-java@v3
 with:
 distribution: 'temurin'
 java-version: '17'
 - name: Build
 run: ./gradlew build
 - name: Test
 run: ./gradlew test
 - name: Upload APK
 uses: actions/upload-artifact@v3
 with:
 name: app-debug
 path: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Version Management

### Shared Version File

**`version.json`** (root):
```json
{
 "api_version": "1.0.0",
 "web_version": "2.1.0",
 "ios_version": "1.0.0",
 "android_version": "1.0.0",
 "minimum_api_version": "1.0.0"
}
```

### Platform-Specific Versioning

**Backend (`backend/package.json`):**
```json
{
 "version": "1.0.0",
 "engines": {
 "node": ">=22.0.0"
 }
}
```

**iOS (`ios/MurphysLaws/Info.plist`):**
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

**Android (`android/app/build.gradle.kts`):**
```kotlin
android {
 defaultConfig {
 versionCode = 1
 versionName = "1.0.0"
 }
}
```

---

## Migration Plan

### Phase 1: Restructure Existing Repository

**Step 1: Create new directories**
```bash
# Create platform directories
mkdir -p backend web ios android shared/assets shared/data

# Move existing files
mv src/ web/src/
mv scripts/ backend/scripts/
mv db/ backend/db/
mv tests/ web/tests/
mv e2e/ web/e2e/
mv styles/ web/styles/
mv public/ web/public/
mv murphys-laws/ shared/data/murphys-laws/

# Move config files
mv package.json web/package.json
mv vite.config.js web/vite.config.js
mv index.html web/index.html
# ... move other web-specific files
```

**Step 2: Update paths in package.json scripts**
```json
{
 "scripts": {
 "dev:backend": "cd backend && npm run dev",
 "dev:web": "cd web && npm run dev",
 "dev": "npm run dev:backend & npm run dev:web",
 "build:web": "cd web && npm run build",
 "test:backend": "cd backend && npm test",
 "test:web": "cd web && npm test"
 }
}
```

**Step 3: Update imports in backend**
```javascript
// backend/scripts/build-sqlite.mjs
const LAWS_DIR = '../shared/data/murphys-laws'; // Updated path
```

**Step 4: Update web imports**
```javascript
// web/src/utils/constants.js
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787';
```

### Phase 2: Add iOS Project

```bash
# Create iOS project via Xcode
# File > New > Project > iOS > App
# Location: murphys-laws/ios/
# Product Name: MurphysLaws
# Interface: SwiftUI
# Language: Swift
```

### Phase 3: Add Android Project

```bash
# Create Android project via Android Studio
# File > New > New Project > Empty Activity
# Name: Murphy's Laws
# Package name: com.murphyslaws
# Save location: murphys-laws/android/
# Language: Kotlin
# Minimum SDK: API 26 (Android 8.0)
```

### Phase 4: Setup CI/CD

```bash
# Create GitHub Actions workflows
mkdir -p .github/workflows
# Add workflow files as shown above
```

### Phase 5: Documentation Update

```bash
# Update all docs with new paths
# Update deployment docs
# Add platform-specific READMEs
```

---

## Alternative Structures

### Option A: Minimal Restructuring

If you prefer minimal disruption to the existing web/backend setup:

```
murphys-laws/ # Existing structure unchanged
├── src/ # Web frontend (keep as-is)
├── scripts/ # Backend (keep as-is)
├── db/ # Database (keep as-is)
├── mobile/ # NEW: Mobile apps only
│ ├── ios/
│ └── android/
└── docs/ # Documentation
```

**Pros:** Minimal changes to existing setup
**Cons:** Inconsistent structure, harder to navigate

---

### Option B: Platform-First Organization

```
murphys-laws/
├── platforms/
│ ├── web/
│ ├── ios/
│ └── android/
├── backend/
├── shared/
└── docs/
```

**Pros:** Clear platform separation
**Cons:** Extra nesting level

---

## Recommendation Summary

**Use the Monorepo structure** with these key principles:

1. **Single repository** for all platforms
2. **Clear directory separation** (backend/, web/, ios/, android/)
3. **Shared documentation** in docs/
4. **Platform-specific READMEs** in each directory
5. **Path-based CI/CD** triggers in GitHub Actions
6. **Shared data** in shared/ directory

**Why?**
- Your backend API is the single source of truth
- API changes affect all platforms equally
- Easier version management
- Simpler for contributors
- Better for your current team size

---

## Next Steps

1. **Review this structure** with your team
2. **Choose migration strategy** (full restructure vs. minimal)
3. **Create migration script** to move files
4. **Update documentation** with new paths
5. **Set up CI/CD** workflows
6. **Create iOS project** in `ios/` directory
7. **Create Android project** in `android/` directory

---

**Questions?**
- Does this structure work for your team?
- Prefer minimal restructuring?
- Need help with migration scripts?

**Document Owner:** Development Team
**Last Updated:** November 6, 2025
