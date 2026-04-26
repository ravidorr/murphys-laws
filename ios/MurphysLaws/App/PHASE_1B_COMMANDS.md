# Phase 1B: Fix Content Duplication

## Problem
Both `MurphysLaws/Resources/content/` and `../shared/content/` are being copied to app bundle, creating duplicate `metadata.json`.

## Solution
Choose ONE source of truth for content. Recommended: Use `shared/content` as the canonical source.

---

## Commands to Execute

### Step 1: Check What Content Exists

```bash
# See what's in the iOS-specific content
ls -la MurphysLaws/Resources/content/

# See what's in shared content
ls -la ../shared/content/

# Compare metadata.json files
diff MurphysLaws/Resources/content/metadata.json ../shared/content/metadata.json 2>/dev/null || echo "Files are identical or one doesn't exist"
```

**Question to answer:** Are these files identical or different?

---

### Step 2: Update project.yml to Fix Content Duplication

**Edit `project.yml` and update the `MurphysLaws` target:**

**Option A: If files are IDENTICAL (use shared only):**

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
          
          # Exclude local content copy (use shared instead)
          - "Resources/content"
          
          # Specific problem files
          - "App/CHECKLIST.md"
          - "App/README.md"
          - "Repositories/Config.plist.template"
          - "Repositories/validate-config.sh"
      
      # Use shared content as the single source of truth
      - path: ../shared/content
        type: group
        name: Content
    
    # Keep the rest of your existing MurphysLaws config below this
```

**Option B: If files are DIFFERENT (keep iOS version only):**

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
      
      # Don't include shared/content separately - using iOS version
      # - path: ../shared/content
      #   type: group
    
    # Keep the rest of your existing MurphysLaws config below this
```

**Recommended:** Use **Option A** (shared content) unless there's a specific iOS-only reason to differ.

Save the file.

---

### Step 3: Regenerate Project

```bash
xcodegen generate
```

---

### Step 4: Test Build Again

```bash
open MurphysLaws.xcodeproj
# Press Cmd+B in Xcode
```

---

## Expected Results

### Success
No duplicate `metadata.json` error.

You might now see errors about missing Swift files like:
```
error: Cannot find 'AnalyticsService' in scope
```
→ **Perfect!** This means Phase 1 is complete, and we're ready for Phase 2.

### Another duplicate error
Example: `Multiple commands produce '.../something-else.json'`
→ Add that file/directory to the excludes list

### Build succeeds but app crashes
→ Content might not be loading correctly - may need to adjust content path in code

---

## After This Step

Once the duplicate resource errors are gone (even if you have missing symbol errors), report back with:

1. Did duplicate `metadata.json` error go away? (Yes/No)
2. What errors show now (if any)?
3. Which option did you use (A or B)?

Then we'll proceed to **Phase 2: Move Files from UITests to App**!

---

## Quick Reference

**If you need to check what's being bundled:**
```bash
# After build succeeds, check app bundle contents
find ~/Library/Developer/Xcode/DerivedData/MurphysLaws-*/Build/Products/Debug-iphonesimulator/MurphysLaws.app -name "*.json"
```
