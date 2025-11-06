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
