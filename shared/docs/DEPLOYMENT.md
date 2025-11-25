# Deployment Guide

## Overview

This guide explains how to safely deploy Murphy's Laws to the production droplet without causing CPU/memory issues.

## Problem We Fixed

**Previous issue:** Running `npm run preview` on the droplet triggered `vite build` every time, causing:
- Multiple concurrent builds (33+ restarts)
- 100% CPU usage
- Out of memory (OOM) on 1GB droplet
- System crash/freeze

**Solution:** Build locally, deploy only `dist/` folder, serve pre-built files.

---

## One-Time Setup (Already Done)

These steps have been completed but are documented for reference:

### On Droplet (45.55.124.212)

1. **Add swap space** (critical for 1GB droplet):
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

2. **Create PM2 ecosystem config** (`ecosystem.config.cjs`):
```javascript
module.exports = {
 apps: [
 {
 name: 'murphys-api',
 script: 'scripts/api-server.mjs',
 // ... config ...
 },
 {
 name: 'murphys-frontend',
 script: 'npx',
 args: 'vite preview --host 0.0.0.0 --port 5175', // No build!
 // ... config ...
 }
 ]
};
```

3. **Enable PM2 auto-start**:
```bash
pm2 startup systemd
# Run the command it outputs
pm2 save
```

4. **Configure Nginx**:
```bash
# Copy nginx config from repo
sudo cp /root/murphys-laws/nginx.conf /etc/nginx/sites-available/murphys-laws

# Enable the site
sudo ln -sf /etc/nginx/sites-available/murphys-laws /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

**IMPORTANT:** Ensure nginx ports match your vite.config.js:
- Frontend proxy should point to port **5175** (not 5173)
- API proxy should point to port **8787**

---

## Port Configuration

All ports must be consistent across configuration files to avoid 502 errors.

### Port Validation

Before deploying, validate port consistency:

```bash
npm run validate-ports
```

This checks:
- `vite.config.js` (preview port)
- `ecosystem.config.cjs` (PM2 args)
- `nginx.conf` (proxy_pass ports)
- `scripts/api-server.mjs` (API default port)

The validation runs automatically before `npm run deploy`.

### Current Ports

- **Frontend**: 5175
- **API**: 8787

### Fixing Port Mismatches

If you get a 502 Bad Gateway error:

```bash
# On droplet - check which port Vite is using
ssh root@45.55.124.212 "ss -tlnp | grep -E '5175|5173'"

# Check nginx config
ssh root@45.55.124.212 "grep proxy_pass /etc/nginx/sites-available/murphys-laws"

# If mismatch, update nginx to use port 5175
ssh root@45.55.124.212 "sed -i 's|proxy_pass http://127.0.0.1:5173;|proxy_pass http://127.0.0.1:5175;|' /etc/nginx/sites-available/murphys-laws && nginx -t && systemctl reload nginx"
```

---

## Deployment Workflow

### Option 1: Automated Deployment (Recommended)

From your local machine:

```bash
npm run deploy
```

This script:
1. Validates port configuration (`npm run validate-ports`)
2. Builds project locally (`npm run build`)
3. Syncs `dist/` to droplet via rsync
4. Restarts PM2 services
5. Shows service status

### Option 2: Manual Deployment

```bash
# 1. Build locally
npm run build

# 2. Sync to droplet
rsync -avz --delete dist/ root@45.55.124.212:/root/murphys-laws/dist/

# 3. Restart services
ssh root@45.55.124.212 "cd /root/murphys-laws && pm2 restart ecosystem.config.cjs"

# 4. Check status
ssh root@45.55.124.212 "pm2 list"
```

---

## Monitoring

### Check Service Status

```bash
ssh root@45.55.124.212 "pm2 list"
```

### View Logs

```bash
# PM2 logs
ssh root@45.55.124.212 "pm2 logs"

# API logs
ssh root@45.55.124.212 "tail -f /root/murphys-laws/logs/api-out.log"

# Frontend logs
ssh root@45.55.124.212 "tail -f /root/murphys-laws/logs/frontend-out.log"
```

### Check System Resources

```bash
ssh root@45.55.124.212 "free -h && top -b -n 1 | head -15"
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check PM2 logs
ssh root@45.55.124.212 "pm2 logs --err --lines 50"

# Check if ports are in use
ssh root@45.55.124.212 "lsof -i :5175 && lsof -i :8787"

# Restart services
ssh root@45.55.124.212 "cd /root/murphys-laws && pm2 restart all"
```

### High CPU/Memory Usage

```bash
# Check what's running
ssh root@45.55.124.212 "ps aux | grep -E 'node|vite|npm' | grep -v grep"

# If you see 'vite build' processes, kill them:
ssh root@45.55.124.212 "pkill -9 -f 'vite build'"

# Restart PM2 properly
ssh root@45.55.124.212 "pm2 restart ecosystem.config.cjs"
```

### Need to Rebuild Everything on Droplet

```bash
ssh root@45.55.124.212
cd /root/murphys-laws

# Stop services
pm2 stop all

# Build (only if necessary!)
npm run build

# Restart
pm2 restart all
```

---

## Important Notes

- **DO** build locally and deploy `dist/`
- **DO** use `npm run deploy` for deployments
- **DON'T** run `npm run preview:build` on the droplet (it rebuilds)
- **DON'T** run `vite build` on the droplet unless absolutely necessary
- **DON'T** disable swap space

---

## Scheduled Jobs (Cron)

### Law of the Day Selection

The Law of the Day feature requires a daily cron job to pre-select tomorrow's law at midnight UTC:

```cron
0 0 * * * cd /root/murphys-laws && /usr/bin/node backend/scripts/select-law-of-day.mjs >> logs/law-of-day.log 2>&1
```

**What it does:**
- Runs daily at 00:00 UTC
- Selects highest-voted law not featured in last 365 days
- Alphabetical tiebreaker if multiple laws have same votes
- Stores selection in `law_of_the_day_history` table
- Logs output to `logs/law-of-day.log`

**Verification:**
```bash
# Check if cron job exists
sudo crontab -l | grep select-law-of-day

# Check recent selections
tail -20 /root/murphys-laws/logs/law-of-day.log

# Manually trigger selection (for testing)
cd /root/murphys-laws && sudo /usr/bin/node backend/scripts/select-law-of-day.mjs
```

---

## Node.js Version Management

### Critical: System Node Must Match NVM Node

**The Problem:**
PM2 may use `/usr/bin/node` (system Node.js) instead of the NVM version specified in `ecosystem.config.cjs`. This causes `better-sqlite3` and other native modules to fail with MODULE_VERSION mismatch errors, resulting in 502 Bad Gateway.

**The Solution:**
System Node.js (`/usr/bin/node`) must be a symlink to the NVM Node.js version:

```bash
# Check current versions
/usr/bin/node --version           # System Node
~/.nvm/versions/node/v22.20.0/bin/node --version  # NVM Node

# If they differ, create symlink (one-time setup)
sudo mv /usr/bin/node /usr/bin/node.bak
sudo ln -s ~/.nvm/versions/node/v22.20.0/bin/node /usr/bin/node

# Verify
/usr/bin/node --version           # Should match NVM version
```

### Validating Node.js Versions

Before deploying, validate that Node.js versions are correctly configured:

```bash
# Local validation
npm run validate:node

# Server validation (checks PM2 processes)
npm run validate:node-server
```

The validation checks:
- Local Node.js meets `package.json` requirements
- System Node.js matches NVM Node.js
- PM2 processes are using the correct Node.js version
- better-sqlite3 is compiled

### Deployment Script Enhancements

The `npm run deploy` script now automatically:
1. Validates Node.js versions on the server
2. Installs dependencies with `npm ci`
3. Rebuilds native modules with `npm rebuild better-sqlite3`
4. Restarts PM2 with NVM environment

This prevents MODULE_VERSION mismatch errors during deployments.

## System Updates & Native Modules

### After Kernel or Python Updates

When system packages are updated (especially kernel or Python versions), native Node.js modules must be rebuilt:

```bash
# SSH to the droplet
ssh root@167.99.53.90

# Rebuild native modules (e.g., better-sqlite3)
sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd /root/murphys-laws/backend && npm rebuild'

# Restart API to use rebuilt modules
sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 restart murphys-api'
```

**Why this is necessary:**
- Native modules like `better-sqlite3` are compiled against specific Node.js versions and kernel/library versions
- System updates or Node.js version changes can break these compiled binaries
- Symptoms: API crashes with module loading errors, 502 Bad Gateway, MODULE_VERSION mismatch

**When to rebuild:**
- After kernel updates (e.g., `6.8.0-87` → `6.8.0-88`)
- After Python/system library updates
- After Node.js version changes
- After `apt-get upgrade` or `apt-get dist-upgrade`
- After `npm ci` or `npm install` on the server

### System Update Checklist

1. Apply system updates:
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   sudo apt-get dist-upgrade -y  # For kernel updates
   ```

2. Reboot if kernel was updated:
   ```bash
   sudo reboot
   ```

3. After reboot, validate Node.js configuration:
   ```bash
   npm run validate:node-server
   ```

4. Rebuild native modules:
   ```bash
   ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd /root/murphys-laws/backend && npm rebuild'"
   ```

5. Restart PM2 services:
   ```bash
   ssh root@167.99.53.90 "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 restart all'"
   ```

6. Verify services are running:
   ```bash
   pm2 list
   curl https://murphys-laws.com/api/v1/health
   curl https://murphys-laws.com/api/v1/law-of-day
   ```

---

## Architecture

```
Local Dev Machine
 └─> npm run build (builds dist/)
 └─> npm run deploy
 └─> rsync dist/ to droplet
 └─> pm2 restart

Droplet (45.55.124.212)
 ├─> murphys-api (Node.js on :8787)
 └─> murphys-frontend (vite preview on :5175, serves pre-built dist/)
```

---

## Future Improvements

- Set up GitHub Actions for automated deployments
- Add health check endpoints
- Implement zero-downtime deployments
- Consider upgrading to 2GB droplet or using CDN for static assets
