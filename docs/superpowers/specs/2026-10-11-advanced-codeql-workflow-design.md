# Advanced CodeQL workflow design

## Goal

Replace GitHub's automatic CodeQL setup with a repository-owned workflow that
reliably scans all detected source languages, including Android Kotlin and iOS
Swift.

## Scope

- Analyze GitHub Actions, JavaScript/TypeScript, Python, Ruby, Kotlin, and
  Swift with CodeQL's default query suite.
- Run on pull requests, pushes to `main`, and a weekly schedule.
- Use manual builds for Kotlin and Swift so CodeQL observes their compilers.
- Preserve the existing Android and iOS CI prerequisites needed to build the
  native apps.
- Disable automatic CodeQL setup after the advanced workflow is present.

## Architecture

Create one `.github/workflows/codeql.yml` workflow with three independently
reporting analysis jobs:

1. **Interpreted languages** runs on Ubuntu and analyzes Actions,
   JavaScript/TypeScript, Python, and Ruby. It uses CodeQL's no-build mode.
2. **Kotlin** runs on Ubuntu. It configures Node 22, installs root dependencies
   with `npm ci`, configures JDK 17 and the Android SDK, initializes CodeQL in
   manual build mode, then builds the Android project with Gradle.
3. **Swift** runs on macOS 15. It configures Node 22, installs root
   dependencies with `npm ci`, selects Xcode 16.4, regenerates iOS design
   tokens and the Xcode project, initializes CodeQL in manual build mode, then
   builds the iOS app with `xcodebuild`.

Each job grants only `contents: read` and `security-events: write`.

## Build rationale

The Android build invokes `npm run design:export:android`, which executes the
repository-local `tsx` binary. Automatic CodeQL setup did not run `npm ci`, so
the Java/Kotlin analyzer failed with `tsx: not found`. Installing root
dependencies before the Gradle build makes that binary available.

Automatic setup also tried `swift build` on macOS. The application imports
UIKit, which is unavailable to the Swift Package Manager's macOS build target.
The advanced workflow instead uses the existing Xcode-based iOS build path and
an iOS Simulator destination.

## Error handling

A failed prerequisite or native build fails its CodeQL job and prevents an
incomplete scan from being reported as successful. The other language jobs
remain independent, so a platform-specific build failure does not suppress
results from the remaining languages.

After the workflow is merged and confirmed to report all six language
categories, disable GitHub's automatic CodeQL setup. This avoids duplicated
analysis and prevents GitHub from silently removing failing compiled-language
analyzers again.

## Verification

Add a repository test that protects the workflow contract by checking that the
CodeQL workflow retains:

- all six language targets;
- pull-request, `main`, and weekly triggers;
- least-privilege CodeQL permissions;
- manual build mode and dependency setup for Kotlin and Swift; and
- the Gradle and Xcode build commands.

Run the workflow from a pull request to verify CodeQL produces completed
results for every language category. Then disable automatic setup and confirm
the repository's CodeQL configuration points only to the advanced workflow.
