# Fixing Android Build Error

## Error Description
```
Error running 'app'
Error loading build artifacts from: android/app/build/intermediates/apk_ide_redirect_file/debug/createDebugApkListingFileRedirect/redirect.txt
```

This error occurs when Android Studio cannot find the build artifacts file because the project hasn't been built yet, or the build cache is corrupted.

## Quick Fix (Recommended)

### Option 1: Using the Fix Script
1. Open a terminal in the project root
2. Run the fix script:
   ```bash
   cd android
   chmod +x fix-build-error.sh
   ./fix-build-error.sh
   ```

### Option 2: Manual Steps in Android Studio
1. **Clean the Project**
   - Go to `Build > Clean Project`
   - Wait for the process to complete

2. **Rebuild the Project**
   - Go to `Build > Rebuild Project`
   - Wait for Gradle to download dependencies and build

3. **Invalidate Caches (if still having issues)**
   - Go to `File > Invalidate Caches / Restart`
   - Select `Invalidate and Restart`

### Option 3: Command Line
```bash
cd android

# Clean and rebuild
./gradlew clean assembleDebug

# Or for release build
./gradlew clean assembleRelease
```

## Alternative Fixes

### Delete Build Directories
If the above doesn't work, try manually deleting the build directories:

```bash
cd android

# Remove build directories
rm -rf app/build
rm -rf build
rm -rf .gradle

# Rebuild
./gradlew assembleDebug
```

### Sync Gradle Files
In Android Studio:
1. Click `File > Sync Project with Gradle Files`
2. Wait for sync to complete
3. Try running the app again

## Requirements
- **Java/JDK**: Version 17 or higher
- **Internet Connection**: Required for downloading Gradle dependencies
- **Android SDK**: Ensure Android SDK is properly configured

## Verifying the Fix
After running the fix:
1. The build should complete successfully
2. The redirect.txt file should be created at:
   ```
   android/app/build/intermediates/apk_ide_redirect_file/debug/createDebugApkListingFileRedirect/redirect.txt
   ```
3. You should be able to run the app from Android Studio without errors

## If Issues Persist
1. Check your internet connection (Gradle needs to download dependencies)
2. Verify your JDK version: `java -version` (should be 17+)
3. Check Android Studio's Event Log for specific error messages
4. Ensure the Android SDK is properly installed and configured

## Project Configuration
- **compileSdk**: 34
- **minSdk**: 26
- **targetSdk**: 34
- **Gradle**: 8.4
- **Android Gradle Plugin**: 8.3.2
- **Kotlin**: 1.9.23
