# Database Migration Guide

## Overview

This project has two types of database scripts:

### 1. **Migration Scripts** (Schema Changes)
- **Purpose**: Change database structure (tables, columns, indexes)
- **Location**: `db/migrations/*.sql`
- **Tracking**: Applied migrations tracked in `schema_migrations` table
- **Run with**: `npm run migrate`

**Examples of migrations:**
- Adding a new column: `ALTER TABLE laws ADD COLUMN category_id INTEGER`
- Creating a table: `CREATE TABLE IF NOT EXISTS votes (...)`
- Adding an index: `CREATE INDEX idx_votes_law_id ON votes(law_id)`

### 2. **Seeding Scripts** (Initial Data)
- **Purpose**: Populate database from source markdown files
- **Location**: `murphys-laws/*.md` → `scripts/build-sqlite.mjs`
- **Run with**: `npm run db:import` or `npm run db:rebuild`

**This is for initial data population only**, not for updating production data.

## Updating Law Content in Production

When you edit laws using `npm run review`, those changes are saved to your local `murphys.db` file. To deploy these content changes to production **without overwriting voting data**, use data migrations:

### Step-by-Step Workflow:

#### 1. **Edit Laws Locally**
```bash
npm run review
# Use the CLI to edit law titles and text
```

#### 2. **Find Which Laws You Modified**
```bash
npm run db:show-updates
```

This shows recently updated laws with their IDs.

#### 3. **Generate a Data Migration**
```bash
npm run db:export-updates 2373 2374 2375 2376 2377 2378 2379
```

Replace the numbers with the actual law IDs you want to deploy.

This creates a new file in `db/migrations/` like:
```
db/migrations/002_update_law_content_20251020.sql
```

#### 4. **Review the Migration File**
Open the generated file to verify it only updates the fields you want:

```sql
-- Data migration: Update law content
-- Generated: 2025-10-20T15:42:00.000Z
-- Laws updated: 2373, 2374, 2375

BEGIN TRANSACTION;

-- Update law #2373
UPDATE laws SET
  title = 'Finagle''s First Law',
  text = 'If an experiment works, something has gone wrong',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 2373;

-- Update law #2374
UPDATE laws SET
  title = 'Finagle''s Second Law',
  text = 'No matter what the anticipated result...',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 2374;

COMMIT;
```

**Note**: This migration **only** updates `title`, `text`, and `updated_at`. It preserves:
- Vote counts (`upvotes`, `downvotes`)
- Vote timestamps (`last_voted_at`)
- Creation date (`created_at`)
- All other metadata

#### 5. **Commit the Migration**
```bash
git add db/migrations/002_update_law_content_20251020.sql
git commit -m "data: update Finagle's and Niven's laws content"
git push
```

#### 6. **Deploy to Production**
On your production server:
```bash
git pull
npm run migrate
```

The migration system will:
1. Check `schema_migrations` table
2. See that `002_update_law_content_20251020.sql` hasn't been applied
3. Run it automatically
4. Mark it as applied

## Migration vs Seeding: Quick Reference

| Feature | Migration | Seeding |
|---------|-----------|---------|
| **Purpose** | Schema changes & data updates | Initial data population |
| **When to use** | Deploying structure or content changes | Fresh database setup |
| **Production safe** | ✅ Yes - preserves existing data | ❌ No - can overwrite data |
| **Versioned** | ✅ Yes - numbered files | ⚠️  Regenerated from markdown |
| **Tracked** | ✅ Yes - in `schema_migrations` | ❌ No tracking |
| **Command** | `npm run migrate` | `npm run db:import` |

## Available Commands

```bash
# View recently updated laws
npm run db:show-updates [limit]

# Generate migration for specific law IDs
npm run db:export-updates <id1> <id2> <id3> ...

# Apply all pending migrations
npm run migrate

# Edit laws interactively (CLI)
npm run review

# Initial database setup (dev only)
npm run db:rebuild
```

## Best Practices

1. **Never run `npm run db:import` in production** - it can overwrite votes
2. **Always use migrations for production updates** - they're tracked and safe
3. **Test migrations locally first** - apply them to your local db before deploying
4. **Use descriptive migration names** - helps team understand what changed
5. **Keep migrations small** - easier to review and rollback if needed

## Automated Deployment with GitHub Actions

**Good news:** Migrations run automatically when you push to `main`! 🎉

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:
1. ✅ Runs pre-migration safety checks
2. ✅ Backs up the production database
3. ✅ Applies pending migrations
4. ✅ Restores backup if migration fails
5. ✅ Shows migration results in GitHub Actions logs

### Automated Workflow:

```bash
# 1. Edit laws locally
npm run review

# 2. See what changed
npm run db:show-updates

# 3. Generate migration
npm run db:export-updates 42 123

# 4. Commit and push
git add db/migrations/002_update_law_content_*.sql
git commit -m "data: update Murphy's Law and Cole's Law"
git push  # ← Migrations run automatically!
```

### What Happens Automatically:

```
git push origin main
    ↓
[GitHub Actions]
    1. Checkout code & install dependencies
    2. Build project
    3. Deploy to server
    4. SSH into production server:
       → Backup database (murphys.db.backup)
       → Pull latest code (including migration files)
       → Restore production database
       → Run safety checks (table structure, data counts)
       → Create pre-migration backup
       → Run migrations (npm run migrate:safe)
       → Verify success or rollback
       → Show applied migrations in logs
       → Restart PM2 services
```

### Viewing Migration Results:

After pushing, go to:
- GitHub → Actions tab → Click your deployment run
- Look for "Update server and restart services" step
- You'll see output like:

```
🔍 Running pre-migration safety checks...
✓ Database file exists
✓ Table 'laws' exists
✓ Table 'votes' exists
📊 Database has 2379 laws and 15420 votes
💾 Pre-migration backup created: 8.45 MB

Running database migrations...
Applied migrations: 1
Total migration files: 2

Applying migration: 002_update_law_content_20251020.sql
✓ Applied: 002_update_law_content_20251020.sql

✅ Migrations completed successfully

📋 Applied migrations:
002_update_law_content_20251020.sql|2025-10-20 15:30:45
001_initial_schema.sql|2025-10-05 14:08:58
```

## Manual Deployment (Optional)

If you need to run migrations manually on production:

```bash
# SSH into server
ssh root@your-server.com

# Go to project directory
cd ~/murphys-laws

# Run migrations with safety checks
npm run migrate:safe
```

## Troubleshooting

**Q: How do I know which migrations have been applied?**
```bash
sqlite3 murphys.db "SELECT * FROM schema_migrations ORDER BY filename;"
```

**Q: What if I need to rollback a migration?**
Migrations don't have automatic rollback. You need to manually create a new migration that reverses the changes.

**Q: Can I edit a migration file after it's been applied?**
No. Once applied and tracked in `schema_migrations`, editing the file won't re-run it. Create a new migration instead.

**Q: How do I handle conflicting law IDs between dev and production?**
Law IDs are auto-incremented and may differ. Consider using `first_seen_file_path` and `first_seen_line_number` as unique identifiers if you need to update laws by source location instead of ID.
