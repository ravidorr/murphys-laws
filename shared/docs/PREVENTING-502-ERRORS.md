# Preventing 502 Bad Gateway Errors

This guide explains how to prevent 502 errors caused by Node.js version mismatches and native module compilation issues.

## Root Cause

502 Bad Gateway errors occur when PM2 uses a different Node.js version than the one used to compile native modules like `better-sqlite3`.

**The Problem Chain:**
1. PM2 uses system Node.js (`/usr/bin/node`) instead of NVM Node.js
2. `better-sqlite3` was compiled for Node.js v22 (MODULE_VERSION 127)
3. PM2 runs the app with Node.js v18 (MODULE_VERSION 108)
4. Module version mismatch → API crashes → 502 errors

## Prevention Strategy

### 1. System Node Must Match NVM Node (One-Time Setup)

**Why:** PM2 may ignore the `interpreter` setting in `ecosystem.config.cjs` and fall back to `/usr/bin/node`.

**Solution:** Make system Node.js a symlink to NVM Node.js:

```bash
# On production server
ssh root@167.99.53.90

# Check current versions
/usr/bin/node --version                           # System Node
~/.nvm/versions/node/v22.20.0/bin/node --version  # NVM Node

# If they differ, create symlink
sudo mv /usr/bin/node /usr/bin/node.bak
sudo ln -s ~/.nvm/versions/node/v22.20.0/bin/node /usr/bin/node

# Verify
/usr/bin/node --version  # Should output v22.20.0
```

### 2. Validate Before Every Deployment

The deployment script now includes automatic validation:

```bash
npm run deploy
```

This runs:
- `npm run validate:node-server` - Checks Node.js versions on server
- Validates PM2 processes are using correct Node.js
- Rebuilds native modules if needed

**Manual validation:**

```bash
# Validate local Node.js
cd backend && npm run validate:node

# Validate server Node.js
cd backend && npm run validate:node-server
```

### 3. Always Rebuild Native Modules After npm install

Native modules must be recompiled after:
- `npm install` or `npm ci`
- Node.js version upgrades
- System updates (kernel, libraries)

**The deployment script now automatically rebuilds:**

```bash
# In deploy.mjs
npm ci && npm rebuild better-sqlite3
```

**Manual rebuild if needed:**

```bash
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd /root/murphys-laws/backend && npm rebuild better-sqlite3'"
```

### 4. Always Use NVM Environment with PM2

When running PM2 commands on the server, always source NVM first:

```bash
# ✓ Correct
sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 restart all'

# ✗ Incorrect (may use wrong Node.js)
pm2 restart all
```

### 5. Monitor PM2 Logs for Module Errors

Check logs after deployments or restarts:

```bash
# View recent logs
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 logs murphys-api --lines 50 --nostream'"

# Watch logs in real-time
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 logs murphys-api'"
```

**Look for these error patterns:**
- `NODE_MODULE_VERSION 127 requires 109` (or similar)
- `Error loading shared library`
- `Module did not self-register`

## Quick Fix Checklist

If 502 errors occur:

### Step 1: Check if API is running
```bash
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 list'"
```

### Step 2: Check PM2 logs
```bash
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 logs murphys-api --err --lines 50 --nostream'"
```

### Step 3: If MODULE_VERSION error found
```bash
# Validate Node.js versions
npm run validate:node-server

# Rebuild native modules
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd /root/murphys-laws/backend && npm rebuild better-sqlite3'"

# Restart PM2
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 restart murphys-api'"
```

### Step 4: Verify fix
```bash
# Check logs are clean
ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 logs murphys-api --lines 20 --nostream'"

# Test API endpoints
curl https://murphys-laws.com/api/v1/health
curl https://murphys-laws.com/api/v1/law-of-day
```

## Understanding NODE_MODULE_VERSION

Each Node.js major version has a different MODULE_VERSION:

| Node.js Version | NODE_MODULE_VERSION |
|-----------------|---------------------|
| v18.x           | 108                 |
| v20.x           | 115                 |
| v22.x           | 127                 |

**Example error:**
```
The module was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 108.
```

This means:
- Module was compiled for Node.js v22 (MODULE_VERSION 127)
- PM2 is running Node.js v18 (MODULE_VERSION 108)
- **Fix:** Ensure PM2 uses Node.js v22

## Automated Prevention

The following automations are now in place:

1. **Deployment script** (`deploy.mjs`):
   - Validates Node.js versions before deploying
   - Rebuilds native modules after `npm ci`
   - Restarts PM2 with NVM environment

2. **Validation scripts**:
   - `npm run validate:node` - Local validation
   - `npm run validate:node-server` - Server validation
   - Checks system Node, NVM Node, and PM2 interpreter

3. **Documentation**:
   - Updated DEPLOYMENT.md with Node.js version management
   - This prevention guide
   - System update checklist

## Best Practices

1. **Never manually run `npm install` on production** - Use the deployment script
2. **Always validate after system updates** - Run `npm run validate:node-server`
3. **Pin Node.js version in package.json** - Already set to `>=22.0.0`
4. **Monitor PM2 logs** - Check for errors after deployments
5. **Use deployment script** - Never manually copy files and restart

## Testing the Prevention Strategy

After implementing these changes, test with:

```bash
# 1. Deploy with validation
npm run deploy

# 2. Verify Node.js versions
npm run validate:node-server

# 3. Check PM2 process Node.js version
ssh root@167.99.53.90 "ps -p \$(pgrep -f murphys-api) -o command="

# 4. Test API endpoints
curl https://murphys-laws.com/api/v1/law-of-day
curl https://murphys-laws.com/api/v1/laws?limit=5
```

All tests should pass without 502 errors.

## Further Reading

- [Node.js Addons - NODE_MODULE_VERSION](https://nodejs.org/api/addons.html#addons_native_abstractions_for_node_js)
- [PM2 Documentation - Interpreter](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [better-sqlite3 - Troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)
