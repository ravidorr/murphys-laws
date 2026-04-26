# Step 3: Systematic Cleanup Plan

## Based on Step 2 Findings

**Current Critical Issues:**
1. Duplicate resources breaking build (CHECKLIST.md × 2)
2. App files in UITests target (AnalyticsService, ImageCache, DeepLinkHandler)
3. Root-level duplicate Swift files (13 files)
4. Test file in app target (LawIntegrationTests.swift)
5. Config.plist.template being included as resource
6. XcodeGen changes not committed (87 insertions, 2 deletions)

---

## CRITICAL: Do This First

### Create Safety Branch
```bash
cd /path/to/murphys-laws-ios/ios
git checkout -b fix/project-structure-cleanup
git status  # Verify you're on new branch
```

**DO NOT proceed without this!**

---

## Cleanup Sequence (In Order!)

### **Phase 1: Fix Immediate Build Blocker** (5 min)

#### Issue: Duplicate CHECKLIST.md breaking build

**Root cause:** project.yml includes all of `MurphysLaws/` as sources, which includes docs.

**Solution:** Update project.yml to exclude documentation files.

**Edit `project.yml`:**
```yaml
targets:
  MurphysLaws:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: MurphysLaws
        excludes:
          - "**/*.md"           # Exclude all markdown files
          - "**/*.template"     # Exclude templates
          - "**/Tests"          # Exclude test files
          - "App/CHECKLIST.md"
          - "App/README.md"
          - "Repositories/Config.plist.template"
    # ... rest of config
```

**Test:**
```bash
xcodegen generate
open MurphysLaws.xcodeproj
# Press Cmd+B - should now get past duplicate resource error
```

---

### **Phase 2: Move Files from UITests to App** (15 min)

#### Issue: AnalyticsService, ImageCache, DeepLinkHandler in wrong target

**Move these files:**
```bash
# Create necessary directories if they don't exist
mkdir -p MurphysLaws/Services
mkdir -p MurphysLaws/Navigation

# Move files from UITests to correct locations
git mv MurphysLawsUITests/AnalyticsService.swift MurphysLaws/Services/
git mv MurphysLawsUITests/ImageCache.swift MurphysLaws/Services/
git mv MurphysLawsUITests/DeepLinkHandler.swift MurphysLaws/Navigation/

# Verify moves
git status
```

**Regenerate project:**
```bash
xcodegen generate
```

**Verify in Xcode:**
```bash
open MurphysLaws.xcodeproj
# Check File Inspector → Target Membership for each moved file
# Should be in "MurphysLaws" app target now
```

---

### **Phase 3: Remove Root-Level Duplicates** (10 min)

#### Issue: 13 Swift files at root level duplicating structured versions

**These root files are DUPLICATES - DELETE THEM:**
```bash
# From ios/ directory
git rm ios/BrowseView.swift
git rm ios/CalculatorViewModel.swift
git rm ios/CategoryListViewModel.swift
git rm ios/EmptyStateView.swift
git rm ios/HomeView.swift
git rm ios/HomeViewModel.swift          # This one has LawCache - we'll address that
git rm ios/LawDetailView.swift
git rm ios/LawListViewModel.swift
git rm ios/MathFormulaView.swift
git rm ios/MoreView.swift
git rm ios/SubmitLawViewModel.swift
git rm ios/TypographyModifier.swift
git rm ios/VotingService.swift

# Verify removals
git status
```

**BEFORE deleting `ios/HomeViewModel.swift`:**

Check if the structured version (`MurphysLaws/ViewModels/HomeViewModel.swift`) needs LawCache functionality:

```bash
# Compare the two files
diff ios/HomeViewModel.swift ios/MurphysLaws/ViewModels/HomeViewModel.swift
```

**If root version has LawCache logic that's needed:**
1. Copy that logic to the structured version first
2. Then delete the root duplicate

**If LawCache is not needed:**
1. Just delete the root duplicate
2. Remove LawCache references from documentation

---

### **Phase 4: Fix Test File Location** (5 min)

#### Issue: LawIntegrationTests.swift in app target

**Move to test target:**
```bash
# If it's in MurphysLaws/App/
git mv MurphysLaws/App/LawIntegrationTests.swift MurphysLawsTests/

# Or find it first
find MurphysLaws -name "LawIntegrationTests.swift"
# Then move from wherever it is to MurphysLawsTests/
```

**Regenerate:**
```bash
xcodegen generate
```

---

### **Phase 5: Fix Config.plist Setup** (10 min)

#### Issue: Only template exists, actual file needed

**Create the actual Config.plist:**
```bash
# Create Resources directory if needed
mkdir -p MurphysLaws/Resources

# Copy template to create actual file
cp MurphysLaws/Repositories/Config.plist.template MurphysLaws/Resources/Config.plist

# Edit with development values
open MurphysLaws/Resources/Config.plist
```

**Edit Config.plist to have:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Environment</key>
    <string>development</string>
    <key>APIBaseURL</key>
    <string>https://murphys-laws.com/api/v1</string>
    <key>APIKey</key>
    <string></string>
    <key>EnableAnalytics</key>
    <false/>
    <key>EnableCrashReporting</key>
    <false/>
    <key>LogLevel</key>
    <string>debug</string>
</dict>
</plist>
```

**Update project.yml to include Config.plist as a resource:**
```yaml
targets:
  MurphysLaws:
    # ... existing config
    sources:
      - path: MurphysLaws
        excludes:
          - "**/*.md"
          - "**/*.template"
          - "**/Tests"
          - "Repositories/Config.plist.template"  # Exclude template
    resources:
      - path: MurphysLaws/Resources/Config.plist
        buildPhase: resources
```

**Add to .gitignore:**
```bash
echo "MurphysLaws/Resources/Config.plist" >> .gitignore
```

**Regenerate:**
```bash
xcodegen generate
```

---

### **Phase 6: Verify and Test** (10 min)

```bash
# Regenerate one final time
xcodegen generate

# Check what changed
git status
git diff MurphysLaws.xcodeproj/project.pbxproj

# Open and build
open MurphysLaws.xcodeproj
```

**In Xcode:**
1. **Clean Build Folder**: `Product → Clean Build Folder` (Cmd+Shift+K)
2. **Build**: `Product → Build` (Cmd+B)
3. **Run Tests**: `Product → Test` (Cmd+U)

**Expected Result:**
- Build succeeds (or shows different errors - progress!)
- No duplicate resource errors
- No missing file errors from moved files

---

### **Phase 7: Commit Your Work** (5 min)

```bash
# Review all changes
git status
git diff

# Stage changes
git add .

# Commit
git commit -m "fix: Clean up project structure

- Update project.yml to exclude docs and templates from app bundle
- Move AnalyticsService, ImageCache, DeepLinkHandler from UITests to app
- Remove 13 root-level duplicate Swift files
- Move LawIntegrationTests to proper test target
- Create Config.plist from template in Resources/
- Add Config.plist to .gitignore
- Regenerate Xcode project from project.yml

Fixes:
- Duplicate CHECKLIST.md resource error
- Files in wrong Xcode targets
- Root-level file organization
- Config.plist availability

Issue: #cleanup"

# Push to remote
git push origin fix/project-structure-cleanup
```

---

## Detailed project.yml Updates

Here's the complete section you need in `project.yml`:

```yaml
targets:
  MurphysLaws:
    type: application
    platform: iOS
    deploymentTarget: "16.0"

    sources:
      - path: MurphysLaws
        excludes:
          # Exclude documentation
          - "**/*.md"
          - "**/*README*"
          - "**/*CHECKLIST*"
          - "**/*SUMMARY*"

          # Exclude templates
          - "**/*.template"

          # Exclude tests that ended up in app source
          - "**/Tests"
          - "**/*Tests.swift"

          # Specific excludes
          - "App/CHECKLIST.md"
          - "App/README.md"
          - "Repositories/Config.plist.template"

      # Include shared content if needed
      - path: ../shared/content
        type: group

    resources:
      - MurphysLaws/Resources/Config.plist
      - MurphysLaws/Resources/Assets.xcassets

    # Rest of your existing config...
```

---

## Success Criteria

After completing all phases:

- [ ] Build succeeds without duplicate resource errors
- [ ] AnalyticsService, ImageCache, DeepLinkHandler in app target
- [ ] No root-level Swift files (all in MurphysLaws/)
- [ ] LawIntegrationTests in MurphysLawsTests target
- [ ] Config.plist exists and loads
- [ ] xcodegen generate runs cleanly
- [ ] All changes committed to git branch
- [ ] App runs in simulator

---

## After Cleanup

Once this is complete, you'll be ready for:

**Step 4: Add Assets** (app icon, launch screen, colors)
**Step 5: SDK Integration** (actual Firebase/analytics)
**Step 6: Device Testing**
**Step 7: App Store Prep**

---

## Time Estimate

| Phase | Time | Running Total |
|-------|------|---------------|
| 1. Fix build blocker | 5 min | 5 min |
| 2. Move UITest files | 15 min | 20 min |
| 3. Remove duplicates | 10 min | 30 min |
| 4. Fix test location | 5 min | 35 min |
| 5. Config.plist | 10 min | 45 min |
| 6. Verify & test | 10 min | 55 min |
| 7. Commit | 5 min | **60 min** |

**Total: ~1 hour**

---

## If Something Goes Wrong

**Build still fails:**
- Check Xcode build errors carefully
- Verify file paths in project.yml
- Ensure xcodegen generate completed without errors

**Files missing:**
- Check git status to see what was moved/deleted
- Restore from git if needed: `git checkout -- filename`

**Can't commit:**
- Make sure you're on the feature branch
- Check git status for what changed
- May need to regenerate: `xcodegen generate`

**Nuclear option (if totally stuck):**
```bash
# Discard ALL changes and start over
git checkout main
git branch -D fix/project-structure-cleanup
# Start Phase 1 again
```

---

**Ready to proceed? Start with Phase 1 (Fix build blocker) and work through each phase in order!**
