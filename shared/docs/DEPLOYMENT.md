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

### On Droplet (167.99.53.90)

1. **Add swap space** (critical for 1GB droplet):
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

1. **Create PM2 ecosystem config** (`ecosystem.config.cjs`):
```javascript
module.exports = {
 apps: [
 {
 name: 'murphys-api',
 script: './node_modules/tsx/dist/cli.mjs',
 args: './src/server/api-server.ts',
 interpreter: '/root/.nvm/versions/node/v22.20.0/bin/node',
 cwd: '/root/murphys-laws/backend',
 // ... config ...
 }
 ]
};
```

**Note:** Frontend is served directly by Nginx from `/root/murphys-laws/web/dist/`. No Vite preview server or PM2 process is needed for the frontend.

1. **Enable PM2 auto-start**:
```bash
pm2 startup systemd
# Run the command it outputs
pm2 save
```

1. **Configure Nginx**:
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

**IMPORTANT:** Nginx configuration details:
- Frontend is served as static files from `/root/murphys-laws/web/dist/`
- API proxy points to port **8787** (Node.js API server)
- No Vite preview server is used in production
- Canonical host is `https://murphys-laws.com`. Configure Nginx to redirect
  `https://www.murphys-laws.com` to the apex host with a permanent redirect so
  search engines do not split ranking signals across both hosts.
- **Custom 404 Page:** Configured via `error_page 404 /404.html;` to serve the styled `404.html` while returning the correct 404 status code (critical for AdSense). The PWA excludes `404.html` from service worker precache so install does not fail when GET `/404.html` returns 404 (e.g. when the file is only served as fallback). PWA `navigateFallback` is `/index.html` (app shell) so non-precached routes get the SPA and the client router can run; `offline.html` is used only for offline/catch handling.
- **AdSense:** The build includes deferred AdSense loading to prevent "No Content" violations.

---

## Port Configuration

### API Port

The API server runs on port **8787**. This is configured in:
- `backend/src/server/api-server.ts` (default port)
- `nginx.conf` (proxy_pass to API)

### Port Validation

Before deploying, validate port consistency:

```bash
npm run validate-ports
```

This ensures the API port is consistent across all configuration files.

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
rsync -avz --delete web/dist/ ravidor@167.99.53.90:/root/murphys-laws/web/dist/

# 3. Restart services
ssh ravidor@167.99.53.90 "cd /root/murphys-laws/backend && pm2 restart ecosystem.config.cjs"

# 4. Check status
ssh ravidor@167.99.53.90 "pm2 list"
```

---

## Compression and HTTP/2

`nginx.conf` compresses text responses (`gzip_types`: CSS, JavaScript, JSON, XML, SVG and plain text) and offers HTTP/2
(`listen 443 ssl http2;`, the syntax of nginx 1.24; `http2 on;` only exists from 1.25.1).

`npm run build` ends with `web/scripts/precompress-assets.ts`, which writes a `.gz` (level 9) and a `.br` (quality 11)
copy next to every `.js`, `.css` and `.svg` file in `web/dist/assets/` when the copy is smaller than the original. nginx serves the
`.gz` copy of the content-hashed files with `gzip_static`, so the server does no compression work for them. The deploy
workflow uploads all of `web/dist/`, so the copies reach the server with the rest of the build. A `.gz` or `.br` file
belongs to its original. Both deploy paths replace `web/dist/` with `rsync --delete`, so the copies follow their originals;
if you prune files by hand on the server, remove the matching `.gz` and `.br` files too.

### A rejected nginx configuration

The deploy copies `nginx.conf` into `/etc/nginx/sites-available/murphys-laws`, runs `nginx -t` and only then reloads
nginx. A configuration that `nginx -t` rejects (for example a directive from a module the server does not have) makes
the GitHub Actions deploy put the previous site file back, skip the reload and fail at that step, so nothing after it
(migrations, PM2 restart) runs and the running nginx keeps its previous configuration. Fix the cause (install the module
or correct the file) and deploy again. `npm run deploy` and a manual `cp` do not restore the previous file: after a
failed `nginx -t` there, copy the old file back before anything reloads or restarts nginx. An `nginx -t` that passes
does not prove the reload took effect: `systemctl reload` only signals nginx, so look at `/var/log/nginx/error.log`
after a release that changes the listeners.

### Root's crontab during a deploy

The vulnerability scanner runs from the daily report, so the GitHub Actions deploy removes any standalone
`vulnerability-scanner.sh` entry from root's crontab. This is housekeeping and never blocks a release: it reads the
crontab first, writes it back only from a read that succeeded, only when such a line was there and only when something
other than blank lines remains, and every problem only prints a `WARNING:` line in the deploy log while the deploy goes
on. A server with no crontab for root is left alone. A failed read (for example a permissions error), a failing `grep`,
a temporary file that cannot be created or a failed write leaves the crontab exactly as it was (a temporary file that
cannot be removed only warns), and so does a crontab
whose only entry is the scanner line (an empty crontab is never written). So a failed read can no longer delete the
other scheduled jobs. If the log shows one of these warnings, run `sudo crontab -l` on the server to see why; the
standalone entry, if it is still there, would run the scan a second time next to the daily report.

### Follow-up: enabling brotli (not active yet)

nginx does not serve the `.br` files yet, because the brotli module is not installed on the droplet and nginx rejects
an unknown directive. A `brotli_static on;` line deployed before the module exists makes `nginx -t` fail in the deploy
step (see "A rejected nginx configuration" above for what the deploy does then). Do these steps in this order:

1. On the droplet, install the Ubuntu 24.04 packages (universe, built for the distribution's nginx 1.24):
   `sudo apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static`
2. Check that they loaded and the config is still valid: `ls /etc/nginx/modules-enabled | grep brotli`, then
   `sudo nginx -t && sudo systemctl reload nginx` (the package install may already have reloaded nginx).
3. In a pull request, add `brotli_static on;` to the `location ~* "^/assets/..."` block of `nginx.conf`, next to
   `gzip_static on;`. Optionally add `brotli on; brotli_comp_level 5; brotli_types` with the same list as `gzip_types`
   in the server block for the files that have no `.br` copy. Extend `web/tests/nginx-performance.test.ts`, which
   currently asserts that no brotli directive is present.
4. Verify after the deploy: `curl -sI -H 'Accept-Encoding: br' https://murphys-laws.com/assets/<file>` shows
   `Content-Encoding: br` and `Vary: Accept-Encoding`; with `Accept-Encoding: gzip` it still shows `gzip`.
5. Roll back by reverting the pull request and deploying. The packages can stay installed;
   `sudo apt remove libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static` removes them.

---

## Browser caching

The static files nginx serves from `web/dist/` are governed by four caching rules (the nested locations of `location /` in
`nginx.conf`, first match wins; `web/tests/nginx-performance.test.ts` pins the table). Everything else sends no
`Cache-Control` at all: the pages, `ads.txt`, `llms.txt`, `llms-full.txt`, `offline.html`, `.webp` images, unhashed `.woff2`
fonts and source maps.

| Files | `Cache-Control` |
| --- | --- |
| Content-hashed files under `/assets/` (`index-DZClfRb6.js`) | `public, max-age=31536000, immutable` |
| Other `.js` and `.css`, including `/sw.js`, `/offline.js` and `/styles/*` | `no-cache` |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/image-sitemap.xml` | `no-cache` |
| Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.svg`) | `max-age=31536000` and `public, no-transform` (`expires 1y` plus `add_header`) |

`no-cache` means the browser may store the file but must revalidate it before every use; nginx answers with a `304` from the
`ETag` and `Last-Modified` it already sends. A script, stylesheet or data file that keeps its URL while its content changes
belongs in the `no-cache` rows: a script or stylesheet without a hash that is added later lands there by default. Images are
a deliberate exception: they rarely change and are not content-hashed, so they keep the one-year lifetime, and a changed
image can stay stale in browsers for up to a year. The service worker precaches the unhashed scripts, stylesheets and the
manifest with `cache: 'reload'`, so a new worker never takes an old copy from the browser's HTTP cache. A `location` that sets its own `add_header` drops the
ones inherited from above, so give each location exactly one `add_header Cache-Control`. Do not add `expires` to it unless
you want the second header on purpose, as the image rule does (`expires 1y` sends `max-age` and an `Expires` date).

To check a change against a real nginx 1.24 without touching the server, run the `nginx:1.24` image with `nginx.conf`
mounted as `/etc/nginx/conf.d/site.conf` (an empty file over `default.conf`), a built `web/dist` mounted at
`/root/murphys-laws/web/dist` (run `chmod 755 /root` in the container so the worker can read it), and a throwaway
self-signed certificate plus the `options-ssl-nginx.conf` and `ssl-dhparams.pem` paths the file includes under
`/etc/letsencrypt/`. Then `nginx -t` and `curl -skI --resolve murphys-laws.com:<port>:127.0.0.1 https://murphys-laws.com:<port>/sw.js`.

---

## Monitoring

### Check Service Status

```bash
ssh ravidor@167.99.53.90 "pm2 list"
```

### View Logs

```bash
# PM2 logs
ssh root@167.99.53.90 "pm2 logs"

# API logs
ssh root@167.99.53.90 "tail -f /root/murphys-laws/backend/logs/api-out.log"

# Nginx access logs
ssh root@167.99.53.90 "tail -f /var/log/nginx/access.log"

# Nginx error logs
ssh root@167.99.53.90 "tail -f /var/log/nginx/error.log"
```

### Check System Resources

```bash
ssh ravidor@167.99.53.90 "free -h && top -b -n 1 | head -15"
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check PM2 logs
ssh root@167.99.53.90 "pm2 logs --err --lines 50"

# Check if API port is in use
ssh root@167.99.53.90 "lsof -i :8787"

# Restart services
ssh root@167.99.53.90 "cd /root/murphys-laws/backend && pm2 restart all"
```

### High CPU/Memory Usage

```bash
# Check what's running
ssh root@167.99.53.90 "ps aux | grep -E 'node|npm' | grep -v grep"

# Check PM2 process memory
ssh root@167.99.53.90 "pm2 list"

# Restart PM2 properly
ssh root@167.99.53.90 "cd /root/murphys-laws/backend && pm2 restart ecosystem.config.cjs"
```

### Frontend Not Loading (404 or 502 errors)

```bash
# Check Nginx is serving the correct directory
ssh root@167.99.53.90 "ls -la /root/murphys-laws/web/dist/"

# Check Nginx configuration
ssh root@167.99.53.90 "grep 'root /root' /etc/nginx/sites-available/murphys-laws"

# Check Nginx error logs
ssh root@167.99.53.90 "tail -50 /var/log/nginx/error.log"

# Verify permissions
ssh root@167.99.53.90 "namei -l /root/murphys-laws/web/dist/index.html"
```

---

## Important Notes

- **DO** build locally and deploy `web/dist/` folder
- **DO** use `npm run deploy` for deployments
- **DO** ensure Nginx has proper permissions to read `/root/murphys-laws/web/dist/`
- **DON'T** run `vite build` on the droplet (build locally)
- **DON'T** disable swap space
- **DON'T** run a Vite preview server in production (Nginx serves static files directly)

---

## Scheduled Jobs (Cron)

### Law of the Day Selection

A daily job picks the day's Law of the Day at midnight UTC, so it is chosen on a schedule and not by the first visitor of the day. **The deploy installs it; do not add it to a crontab by hand.** The schedule is the repository file `backend/config/cron.d/murphys-laws-law-of-day`, and both `deploy.yml` and `npm run deploy` run `backend/scripts/install-law-of-day-cron.sh` after the dependencies are installed and the migrations ran, on every deploy (it is safe to repeat). It:
- stops with an error, before changing anything, when the job could not start: the schedule file, `backend/scripts/select-law-of-day.ts`, `backend/node_modules/tsx`, `.nvmrc` or `crontab` is missing, or `/usr/bin/node` is missing, cannot report its version, is not the major Node version of `.nvmrc` or cannot load `better-sqlite3` (the job runs it, and `better-sqlite3` is built for the `.nvmrc` one; `/usr/bin/node` must be a symlink to the nvm node, see `PREVENTING-502-ERRORS.md`)
- replaces `/etc/cron.d/murphys-laws-law-of-day` in one step (a temporary file in `/etc/cron.d`, then a rename), mode 644 and owned by root, as cron requires; cron ignores a file there whose name contains a dot, so the name has none, and any edit made on the server is overwritten
- creates `backend/logs`, which the job's log is in (the deploy's cleanup of old root-level files removes `/root/murphys-laws/logs`, not this one)
- removes the old `select-law-of-day.mjs` line from root's crontab, so the job does not run twice, and the old `.mjs` script. The crontab is read into a variable and written back only from a successful read, only when that line was there and only when something other than blank lines remains: root's crontab is never emptied, and when the old line is its only entry it stays and the deploy prints a warning
- warns when the server's time zone is not UTC: cronie honors the `CRON_TZ=UTC` line of the file, but the Debian and Ubuntu `cron` package does not document it (Ubuntu 22.04's `crontab(5)` has only `TZ`, which affects the job's environment and not its schedule), so there the job runs in the server's time zone, at 00:00 local time. On a server east of UTC that is before 00:00 UTC, so the job only finds the day before already picked and the first visitor picks again. The pick is for the current UTC day whenever it runs, so it is still the right law

A failure of the installer is only a warning in the deploy (`WARNING: the Law of the Day schedule was not installed ...`) and never holds back a release, because the API picks the law on the first request of the day when the job is not installed. Look for that line in the deploy log when the pick time (below) is late.

The job is:

```cron
0 0 * * * root { cd /root/murphys-laws/backend && /usr/bin/node node_modules/tsx/dist/cli.mjs scripts/select-law-of-day.ts; } >> /root/murphys-laws/backend/logs/law-of-day.log 2>&1
```

**What it does:**
- Runs daily at 00:00 UTC and picks today's (UTC) law
- Selects highest-voted law not featured in last 365 days, with an alphabetical tiebreaker
- Stores selection in `law_of_the_day_history` table, through the same `LawService.selectLawOfTheDay` the API uses
- Keeps one live pick per UTC day, however often it runs and even when it meets a request at midnight: the check and the insert are one `BEGIN IMMEDIATE` transaction, so the second to arrive finds the first one's pick. (A replacement pick is added for the same date only when the law picked was unpublished since.) The API still picks on a request if the job did not run
- Logs a timestamped line to `backend/logs/law-of-day.log` (`Picked law ...`, `Already picked ...`, or an error and a non-zero exit), after the untimestamped `Database connected` line of the database service
- Nothing alerts when the job fails or does not run, because the API quietly picks instead: look at the log and at `created_at` (below) now and then; a pick made after about 00:05 UTC means the job did not do it

**Verification:**
```bash
# The schedule is installed, and the old crontab line is gone (the grep prints nothing)
cat /etc/cron.d/murphys-laws-law-of-day
sudo crontab -l | grep select-law-of-day

# Cron started the job at midnight (this shows only that it started; the log line below says what it did)
sudo journalctl -u cron --since "yesterday" --no-pager | grep select-law-of-day
tail -5 /root/murphys-laws/backend/logs/law-of-day.log

# Today's pick was made at 00:00, not by a visitor (created_at is UTC)
sudo sqlite3 -readonly /root/murphys-laws/backend/murphys.db "SELECT featured_date, law_id, created_at FROM law_of_the_day_history ORDER BY id DESC LIMIT 3"

# Run it by hand (safe at any time: it only picks if today has no pick)
cd /root/murphys-laws/backend && sudo /usr/bin/node node_modules/tsx/dist/cli.mjs scripts/select-law-of-day.ts
```

To stop the schedule, delete `/etc/cron.d/murphys-laws-law-of-day` and the repository file together (the deploy reinstalls it otherwise); the API then picks on the first request of each day.

### Daily Law of the Day Email

Subscribers who confirmed their address get the day's law by email. Run this after the selection job (SMTP must be configured in the backend `.env`):

```cron
15 6 * * * cd /root/murphys-laws/backend && /usr/bin/npm run email:daily >> logs/daily-email.log 2>&1
```

**What it does:**
- Sends today's Law of the Day to every confirmed subscriber who has not had it yet
- Records each send, so running it twice (or after a partial failure) never mails anyone twice
- Exits non-zero if any send failed; the next run retries those subscribers

### Daily Law of the Day Browser Notification

Browsers subscribed to the notification get the day's law as a push message. Generate the VAPID key pair once and add it as the GitHub Actions secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` address). The deploy workflow writes them into `backend/.env` on every deploy, so a hand edit of that file would be overwritten. For a local run they go in `.env` (see `.env.example`):

```bash
cd /root/murphys-laws/backend && npx web-push generate-vapid-keys
```

Keep the pair: changing it drops every existing browser subscription. Then schedule the send after the selection job:

```cron
20 6 * * * cd /root/murphys-laws/backend && /usr/bin/npm run push:daily >> logs/daily-push.log 2>&1
```

**What it does:**
- Sends today's Law of the Day to every subscribed browser that has not had it yet and records each send
- Deletes subscriptions the push service reports as gone (404 or 410)
- Does nothing (and says so in the log) until all three VAPID variables are set
- Exits non-zero if any send failed; the next run retries those subscriptions

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
 └─> npm run build (builds web/dist/)
 └─> npm run deploy
     ├─> rsync web/dist/ to droplet
     ├─> rsync backend/ files to droplet
     └─> pm2 restart

Droplet (167.99.53.90)
 ├─> Nginx (serves static files from /root/murphys-laws/web/dist/)
 └─> murphys-api (Node.js API on :8787 via PM2)
```

**Production Request Flow:**
1. User requests `https://murphys-laws.com/` → Nginx serves `/root/murphys-laws/web/dist/index.html`
2. User requests `https://murphys-laws.com/assets/style.css` → Nginx serves static file with 1-year cache
3. User requests `https://murphys-laws.com/api/v1/laws` → Nginx proxies to Node.js API on `127.0.0.1:8787`

---

## Error Monitoring (Sentry)

The application uses Sentry for production error tracking. Errors from both the frontend and backend are reported to Sentry for monitoring and debugging.

### GitHub Secrets Required

Add these secrets to GitHub repository settings (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `SENTRY_DSN` | Sentry Data Source Name (required for error tracking) |
| `SENTRY_AUTH_TOKEN` | Auth token for source map uploads (optional but recommended) |
| `SENTRY_ORG` | Sentry organization slug (required for source maps) |
| `SENTRY_PROJECT` | Sentry project slug (required for source maps) |

---

## Future Improvements

- GitHub Actions automated deployments (implemented)
- Health check endpoints (implemented)
- Sentry error tracking (implemented)
- Implement zero-downtime deployments
- Consider upgrading to 2GB droplet or using CDN for static assets
