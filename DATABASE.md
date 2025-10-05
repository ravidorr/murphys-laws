# Database Management Guide

## ⚠️ IMPORTANT: Never commit murphys.db directly!

The production database contains user data (votes, submissions) that must never be overwritten.

## How to Make Schema Changes

### Step 1: Create a Migration File

```bash
# Create a new numbered migration in db/migrations/
cat > db/migrations/002_add_my_feature.sql << 'EOF'
-- Your SQL changes here
ALTER TABLE laws ADD COLUMN my_column TEXT;
EOF
```

### Step 2: Test Locally

```bash
# Run migrations to apply your changes
npm run migrate

# Verify it worked
sqlite3 murphys.db "SELECT * FROM laws LIMIT 1;"
```

### Step 3: Commit and Deploy

```bash
git add db/migrations/002_add_my_feature.sql
git commit -m "feat: Add my_column to laws table"
git push
```

GitHub Actions will automatically run the migration on production when you merge to `main`.

## Migration Naming Convention

- `001_initial_schema.sql` - Initial database setup
- `002_add_featured_column.sql` - Add a new column
- `003_create_comments_table.sql` - Create a new table
- `004_add_index_on_votes.sql` - Add database index

Always use sequential numbers (001, 002, 003...).

## Common Mistakes to Avoid

❌ **DON'T:** Modify `murphys.db` and commit it
❌ **DON'T:** Run SQL directly on production server
❌ **DON'T:** Remove `murphys.db` from `.gitignore`

✅ **DO:** Create migration files
✅ **DO:** Test migrations locally first
✅ **DO:** Use `npm run migrate` to apply changes

## Troubleshooting

### "Migration already applied" error
This is expected - migrations only run once. The system tracks them in `schema_migrations` table.

### Need to undo a migration?
Create a new migration that reverses the change:
```sql
-- migrations/005_remove_my_column.sql
ALTER TABLE laws DROP COLUMN my_column;
```

### Local database out of sync?
Download fresh copy from production:
```bash
scp -i ~/.ssh/murphys_deploy root@45.55.124.212:~/murphys-laws/murphys.db ./murphys.db
```

## Production Database Backup

The deployment workflow automatically backs up the database before each deploy to `murphys.db.backup` on the server.

To manually backup:
```bash
# On server
cd ~/murphys-laws
cp murphys.db "murphys.db.backup.$(date +%Y%m%d_%H%M%S)"
```
