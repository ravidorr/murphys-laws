# Phase 1: Fix Immediate Build Blocker

## Commands to Execute

### Step 1: Create Safety Branch

```bash
# Navigate to iOS project directory
cd /path/to/murphys-laws-ios/ios

# Create new branch for cleanup
git checkout -b fix/project-structure-cleanup

# Verify you're on the new branch
git branch
```

You should see: `* fix/project-structure-cleanup`

---

### Step 2: Edit project.yml

Open `project.yml` in your editor:

```bash
open project.yml
```

**Find the `MurphysLaws` target section and replace it with this:**

```yaml
targets:
  MurphysLaws:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: MurphysLaws
        excludes:
          # Exclude all markdown documentation
          - "**/*.md"
          - "**/*README*"
          - "**/*CHECKLIST*"
          - "**/*SUMMARY*"
          - "**/*CORRECTIONS*"
          - "**/*HONEST*"
          - "**/*START_HERE*"
          - "**/*STEP_*"
          
          # Exclude templates
          - "**/*.template"
          - "**/*.template.*"
          
          # Exclude test files that ended up in app source
          - "**/Tests"
          - "**/*Tests.swift"
          - "**/*IntegrationTests.swift"
          
          # Specific problem files
          - "App/CHECKLIST.md"
          - "App/README.md"
          - "Repositories/Config.plist.template"
          - "Repositories/validate-config.sh"
      
      - path: ../shared/content
        type: group
    
    # Keep the rest of your existing MurphysLaws config below this
```

**Important:** Keep any other settings that were already in the `MurphysLaws` target (like `info`, `settings`, `dependencies`, etc.)

Save the file.

---

### Step 3: Regenerate Xcode Project

```bash
# Generate fresh project from updated project.yml
xcodegen generate
```

Expected output:
```
  Generating project...
  Writing project...
Created project at /path/to/MurphysLaws.xcodeproj
```

---

### Step 4: Check What Changed

```bash
# See what files were modified
git status
```

Expected to see:
```
modified: project.yml
modified: MurphysLaws.xcodeproj/project.pbxproj
```

---

### Step 5: Test the Build

```bash
# Open in Xcode
open MurphysLaws.xcodeproj
```

**In Xcode:**
1. Press `Cmd+B` or go to `Product → Build`
2. Wait for build to complete

---

## Expected Results

### Success: Duplicate error is gone
You should **NOT** see this error anymore:
```
error: Multiple commands produce '.../MurphysLaws.app/CHECKLIST.md'
```

### New errors may appear (this is OK!)
You might now see errors like:
```
error: Cannot find 'AnalyticsService' in scope
error: Cannot find type 'ImageCache'
```
→ **This is progress!** These are because files are in wrong target (Phase 2 will fix)

### If duplicate error still appears
→ Report back and we'll adjust the excludes pattern

---

## Report Back

After completing steps 1-5, tell me:

1. Did `xcodegen generate` complete successfully? (Yes/No)
2. What did `git status` show?
3. What happened when you built in Xcode?
   - Build succeeded?
   - Different error (copy the error message)?
   - Still showing duplicate CHECKLIST.md error?

Then we'll proceed to Phase 2!
