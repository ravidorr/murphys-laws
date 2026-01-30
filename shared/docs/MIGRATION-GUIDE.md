# Murphy's Laws - Monorepo Migration Guide

**Last Updated:** November 6, 2025
**Migration Script:** `scripts/migrate-to-monorepo.sh`

---

## Table of Contents

1. [Overview](#overview)
2. [What Changes](#what-changes)
3. [Prerequisites](#prerequisites)
4. [Migration Steps](#migration-steps)
5. [Verification](#verification)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

This guide walks through migrating the Murphy's Laws repository from its current structure to a monorepo structure that supports web, iOS, and Android applications.

### Current Structure
```
murphys-laws/
├── src/ # Web frontend
├── scripts/ # Backend API
├── db/ # Database
├── tests/ # Tests
├── styles/ # CSS
├── public/ # Assets
└── murphys-laws/ # Law data
```

### New Structure (Monorepo)
```
murphys-laws/
├── backend/ # Node.js API (moved from scripts/)
├── web/ # Web app (moved from src/)
├── ios/ # iOS app (new)
├── android/ # Android app (new)
└── shared/ # Shared resources
 ├── docs/ # Documentation
 └── data/ # Law data
```

---

## What Changes

### File Movements

| Current Location | New Location | Purpose |
|-----------------|--------------|---------|
| `src/` | `web/src/` | Web frontend source |
| `scripts/` | `backend/scripts/` | API server scripts |
| `db/` | `backend/db/` | SQLite database |
| `styles/` | `web/styles/` | CSS stylesheets |
| `public/` | `web/public/` | Static assets |
| `tests/` | `web/tests/` | Unit tests |
| `e2e/` | `web/e2e/` | E2E tests |
| `murphys-laws/` | `shared/data/murphys-laws/` | Law markdown files |
| `docs/` | `shared/docs/` | Documentation |

### Configuration Changes

**`package.json`:**
- **Current:** Single `package.json` at root
- **New:** Three `package.json` files:
- `package.json` (root) - Workspace manager
- `backend/package.json` - Backend dependencies
- `web/package.json` - Web dependencies

**Scripts:**
- **Current:** `npm run dev` → starts Vite
- **New:**
- `npm run dev` → starts both backend + web
- `npm run dev:backend` → backend only
- `npm run dev:web` → web only

**Paths:**
- Backend references to law data: `'murphys-laws'` → `'../shared/data/murphys-laws'`
- All relative imports updated automatically

### New Files Created

- `backend/README.md` - Backend setup and API docs
- `web/README.md` - Web app development guide
- `ios/README.md` - iOS app placeholder
- `android/README.md` - Android app placeholder
- `shared/README.md` - Shared resources guide
- `.github/workflows/backend-ci.yml` - Backend CI/CD
- `.github/workflows/web-ci.yml` - Web CI/CD
- `.github/workflows/ios-ci.yml` - iOS CI/CD (placeholder)
- `.github/workflows/android-ci.yml` - Android CI/CD (placeholder)

---

## Prerequisites

### Before You Begin

1. **Commit all changes:**
 ```bash
 git status
 git add .
 git commit -m "chore: prepare for monorepo migration"
 ```

1. **Ensure clean working directory:**
 ```bash
 git status
 # Should show: "nothing to commit, working tree clean"
 ```

1. **Backup important files (optional but recommended):**
 ```bash
 cp -r . ../murphys-laws-backup
 ```

### System Requirements

- **Git:** Repository management
- **Node.js 22+:** Package management
- **npm:** Dependency installation
- **sed:** Path updates (usually pre-installed on Linux/macOS)
- **Bash 4+:** Script execution

**Check versions:**
```bash
git --version
node --version
npm --version
sed --version
bash --version
```

---

## Migration Steps

### Step 1: Review the Script

```bash
# View what the script will do
less scripts/migrate-to-monorepo.sh
```

### Step 2: Dry Run (Recommended)

Test the migration without making any changes:

```bash
cd /path/to/murphys-laws
chmod +x scripts/migrate-to-monorepo.sh
./scripts/migrate-to-monorepo.sh --dry-run
```

**Output:**
- Shows all commands that would be executed
- Indicates file movements
- Displays configuration changes
- No actual changes are made

### Step 3: Run Migration

Execute the actual migration:

```bash
./scripts/migrate-to-monorepo.sh
```

**Interactive Prompts:**
1. Confirms prerequisites
2. Shows file movements
3. Asks: "Proceed with migration? [y/N]"

**What Happens:**
1. Creates backup in `.migration-backup-<timestamp>/`
2. Creates new directory structure
3. Moves all files to new locations
4. Updates paths in configuration files
5. Splits `package.json` into workspace structure
6. Creates platform-specific READMEs
7. Creates GitHub Actions workflows
8. Updates `.gitignore`
9. Installs dependencies for all workspaces
10. Verifies migration integrity

**Duration:** ~2-5 minutes depending on repository size

**Output Example:**
```
ℹ Starting monorepo migration...

Current structure:
 src/ → web/src/
 scripts/ → backend/scripts/
 db/ → backend/db/
 docs/ → shared/docs/

Proceed with migration? [y/N] y

ℹ Creating backup at: .migration-backup-20250106-143022
 Backed up: src
 Backed up: scripts
...
 Backup created successfully

ℹ Creating new directory structure...
 Created: backend/
 Created: web/
...

 Migration complete!

ℹ Backup location: .migration-backup-20250106-143022
ℹ To rollback: ./scripts/migrate-to-monorepo.sh --rollback .migration-backup-20250106-143022

ℹ Next steps:
 1. Review changes: git status
 2. Test backend: cd backend && npm run build:db && npm start
 3. Test web: cd web && npm run dev
 4. Commit changes: git add . && git commit -m 'chore: migrate to monorepo structure'
```

### Step 4: Force Mode (Skip Confirmations)

For automated scripts or if you're confident:

```bash
./scripts/migrate-to-monorepo.sh --force
```

 **Warning:** This skips all confirmation prompts!

---

## Verification

### After Migration

1. **Review Git Status:**
 ```bash
 git status
 ```

 **Expected:**
- Many files deleted (old locations)
- Many files added (new locations)
- New files created (READMEs, workflows)

1. **Check Directory Structure:**
 ```bash
 ls -la
 # Should show: backend/ web/ ios/ android/ shared/
 ```

1. **Verify Backend:**
 ```bash
 cd backend
 ls
 # Should show: scripts/ db/ package.json README.md

 # Test database build
 npm run build:db

 # Start API server
 npm start
 # Should start on http://127.0.0.1:8787
 ```

1. **Verify Web:**
 ```bash
 cd ../web
 ls
 # Should show: src/ styles/ public/ package.json README.md

 # Start dev server
 npm run dev
 # Should start on http://localhost:5173
 ```

1. **Verify Shared:**
 ```bash
 cd ../shared
 ls data/
 # Should show: murphys-laws/

 ls docs/
 # Should show: MOBILE-IOS-PRD.md, MOBILE-ANDROID-PRD.md, etc.
 ```

1. **Test API Endpoints:**
 ```bash
 # With backend running
 curl http://127.0.0.1:8787/api/v1/laws?limit=5
 # Should return JSON with laws
 ```

1. **Test Web App:**
 ```bash
 # With web dev server running
 # Open http://localhost:5173 in browser
 # Should load homepage with Law of the Day
 ```

### Automated Verification

The script includes built-in verification:

```bash
./scripts/migrate-to-monorepo.sh
# ...migration runs...
# At the end:
ℹ Verifying migration...
 Migration verification passed!
```

---

## Rollback

### If Something Goes Wrong

The script creates an automatic backup before making any changes.

**Find Backup:**
```bash
ls -la .migration-backup-*
# Example: .migration-backup-20250106-143022/
```

**Restore from Backup:**
```bash
./scripts/migrate-to-monorepo.sh --rollback .migration-backup-20250106-143022
```

**Manual Rollback:**
If the script fails, you can manually restore:

```bash
# 1. Remove new directories
rm -rf backend/ web/ ios/ android/ shared/

# 2. Restore from backup
cp -r .migration-backup-20250106-143022/* .

# 3. Restore original package.json
git checkout package.json

# 4. Verify
git status
```

**Git Rollback:**
If changes are committed:

```bash
# Find commit before migration
git log --oneline

# Revert to previous commit
git reset --hard <commit-hash>
```

---

## Troubleshooting

### Issue: "Not in repository root"

**Cause:** Script is being run from wrong directory.

**Solution:**
```bash
cd /path/to/murphys-laws
./scripts/migrate-to-monorepo.sh
```

---

### Issue: "You have uncommitted changes"

**Cause:** Working directory has unsaved changes.

**Solutions:**

**Option 1: Commit changes**
```bash
git add .
git commit -m "chore: save work before migration"
./scripts/migrate-to-monorepo.sh
```

**Option 2: Stash changes**
```bash
git stash
./scripts/migrate-to-monorepo.sh
git stash pop
```

**Option 3: Continue anyway**
```bash
./scripts/migrate-to-monorepo.sh
# Answer "y" when prompted about uncommitted changes
```

---

### Issue: "Required command not found: sed"

**Cause:** Missing system utility.

**Solution (Ubuntu/Debian):**
```bash
sudo apt-get install sed
```

**Solution (macOS):**
```bash
# sed is pre-installed, but if missing:
brew install gnu-sed
```

---

### Issue: Backend doesn't start after migration

**Symptoms:**
```bash
cd backend
npm start
# Error: Cannot find module '../shared/data/murphys-laws'
```

**Cause:** Path updates didn't apply correctly.

**Solution:**
```bash
# Check build-sqlite.mjs
cat backend/scripts/build-sqlite.mjs | grep murphys-laws
# Should show: '../shared/data/murphys-laws'

# If incorrect, manually update:
cd backend/scripts
sed -i "s|'murphys-laws'|'../shared/data/murphys-laws'|g" build-sqlite.mjs
```

---

### Issue: Web app can't find API

**Symptoms:**
- Web app loads but shows "Failed to fetch laws"

**Cause:** API server not running or wrong port.

**Solution:**
```bash
# Terminal 1: Start backend
cd backend
npm start
# Should see: "API server listening on port 8787"

# Terminal 2: Start web
cd web
npm run dev
# Should see: "Local: http://localhost:5173"
```

---

### Issue: npm install fails

**Symptoms:**
```bash
npm install
# Error: ERESOLVE unable to resolve dependency tree
```

**Solution 1: Delete lock files**
```bash
rm package-lock.json
rm backend/package-lock.json
rm web/package-lock.json
npm install
```

**Solution 2: Use --legacy-peer-deps**
```bash
npm install --legacy-peer-deps
cd backend && npm install --legacy-peer-deps
cd ../web && npm install --legacy-peer-deps
```

---

### Issue: Git shows too many changes

**Cause:** This is expected! Files were moved.

**Solution:**
```bash
# Review changes
git status

# See moved files (not added/deleted)
git diff --summary --find-renames

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "chore: migrate to monorepo structure

- Move backend to backend/
- Move web to web/
- Move shared resources to shared/
- Split package.json into workspaces
- Add platform-specific READMEs
- Add CI/CD workflows for all platforms"
```

---

## FAQ

### Q: Will this break my existing deployment?

**A:** No, but you'll need to update deployment scripts.

**Before:**
```bash
npm run build # Built web app
```

**After:**
```bash
npm run build:web # Build web app
# OR
cd web && npm run build
```

**Update `scripts/deploy.mjs`:**
```javascript
// Change paths
const WEB_DIR = path.join(__dirname, '..', 'web');
const DIST_DIR = path.join(WEB_DIR, 'dist');
```

---

### Q: Do I need to update my CI/CD?

**A:** Yes, if you have custom CI/CD. The script creates new GitHub Actions workflows.

**Old CI:**
```yaml
- run: npm test
- run: npm run build
```

**New CI:**
```yaml
- run: npm run test:web
- run: npm run build:web
```

Or use the new workflows:
- `.github/workflows/backend-ci.yml`
- `.github/workflows/web-ci.yml`

---

### Q: Can I undo the migration?

**A:** Yes! Use the rollback command:

```bash
./scripts/migrate-to-monorepo.sh --rollback .migration-backup-<timestamp>
```

Or manually restore from backup:
```bash
cp -r .migration-backup-<timestamp>/* .
```

---

### Q: What if I already have ios/ or android/ directories?

**A:** The script will NOT overwrite existing directories. Move or rename them first:

```bash
mv ios ios-old
mv android android-old
./scripts/migrate-to-monorepo.sh
```

---

### Q: Can I run this on a non-main branch?

**A:** Yes! Recommended for safety:

```bash
git checkout -b migration/monorepo-structure
./scripts/migrate-to-monorepo.sh
# Test everything
git commit -am "chore: migrate to monorepo"
git push -u origin migration/monorepo-structure
# Create PR for review
```

---

### Q: How long does the migration take?

**A:** 2-5 minutes depending on repository size.

**Breakdown:**
- Backup creation: 30 seconds
- File movements: 1 minute
- Configuration updates: 30 seconds
- Dependency installation: 2-3 minutes

---

### Q: Will my git history be preserved?

**A:** Yes! Git tracks file movements.

```bash
git log --follow web/src/main.js
# Shows history from src/main.js
```

---

### Q: Do I need to update documentation links?

**A:** The script updates most links automatically. Check these:
- README.md - Updated by script
- Documentation links in code - May need manual update

**Example manual update:**
```javascript
// Old
import { API_URL } from '../config/constants.js';

// New (if moved)
import { API_URL } from '../shared/config/constants.js';
```

---

### Q: What happens to .env files?

**A:** `.env` stays at root. Both backend and web can access it.

**If you want platform-specific .env:**
```bash
# Create platform-specific env files
cp .env backend/.env
cp .env web/.env

# Update .gitignore
echo "backend/.env" >> .gitignore
echo "web/.env" >> .gitignore
```

---

### Q: How do I add iOS/Android projects later?

**A:** The migration creates placeholder directories with READMEs.

**iOS:**
```bash
cd ios
# Create Xcode project
# File > New > Project > iOS > App
# Save in murphys-laws/ios/
```

**Android:**
```bash
cd android
# Create Android Studio project
# File > New > New Project > Empty Activity
# Save in murphys-laws/android/
```

---

## Post-Migration Checklist

After successful migration, verify:

- [ ] Backend starts successfully (`cd backend && npm start`)
- [ ] Web dev server starts (`cd web && npm run dev`)
- [ ] Database builds correctly (`cd backend && npm run build:db`)
- [ ] Tests pass (`npm test`)
- [ ] All documentation links work
- [ ] CI/CD workflows are green
- [ ] Deployment script works (if applicable)
- [ ] All git files are tracked correctly
- [ ] README.md reflects new structure
- [ ] Team members can clone and run the repo

---

## Next Steps

After migration is complete and verified:

1. **Commit Changes:**
 ```bash
 git add .
 git commit -m "chore: migrate to monorepo structure"
 ```

1. **Push to Remote:**
 ```bash
 git push origin <branch-name>
 ```

1. **Update Team:**
- Share migration guide with team
- Update onboarding documentation
- Run team walkthrough if needed

1. **Create iOS/Android Projects:**
- Follow [iOS PRD](../shared/docs/MOBILE-IOS-PRD.md)
- Follow [Android PRD](../shared/docs/MOBILE-ANDROID-PRD.md)

1. **Update CI/CD:**
- Review GitHub Actions workflows
- Update any external CI/CD (if applicable)

1. **Monitor:**
- Watch for issues in first few days
- Check deployment pipeline
- Gather team feedback

---

## Support

**Issues?**
- Review this guide's [Troubleshooting](#troubleshooting) section
- Check script output for specific errors
- Contact development team

**Questions?**
- See [FAQ](#faq) section
- Review [Repository Structure Guide](MOBILE-REPOSITORY-STRUCTURE.md)

---

**Document Owner:** Development Team
**Last Tested:** November 6, 2025
**Script Version:** 1.0.0
