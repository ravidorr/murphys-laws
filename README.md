# Murphy's Laws

A comprehensive collection of Murphy's Laws, humorous observations about life's tendency for things to go wrong at the worst possible moment. This project preserves and organizes the wisdom of Murphy's Laws and its many variations, submitted by people from around the world.

## About Murphy's Laws

Murphy's Law states: **"If anything can go wrong, it will."** This fundamental law was named after Captain Edward A. Murphy, an engineer working on Air Force Project MX981 in 1949 at Edwards Air Force Base. What started as a simple observation has evolved into a vast collection of life's ironies and inevitable mishaps.

## Features

### Law of the Day
A daily rotating "Law of the Day" feature that showcases the most popular Murphy's Laws on a rotating schedule:
- **Smart Selection**: Automatically selects the highest-voted law each day
- **Fair Rotation**: Laws are excluded from selection for 365 days after being featured
- **Alphabetical Tiebreaker**: When multiple laws have the same votes, they're sorted alphabetically
- **Pre-calculated**: New law selected at midnight UTC for instant loading

### Categorized Laws Collection
Over 40 specialized categories covering every aspect of life:
- **Technology**: Computers, phones, printers, and digital devices
- **Transportation**: Cars, buses, airplanes, and public transport
- **Workplace**: Office life, employees, bosses, and meetings
- **Personal Life**: Love, family, toddlers, and daily activities
- **Specialized Fields**: Medical, military, education, sports, and more

### Interactive Calculators

#### Sod's Law Calculator
An interactive web application that calculates the probability of things going wrong using the official British Gas formula:

**Formula**: `((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))`

Where:
- **U** = Urgency (1-9)
- **C** = Complexity (1-9)
- **I** = Importance (1-9)
- **S** = Skill level (1-9)
- **F** = Frequency (1-9)
- **A** = Activity factor (constant: 0.7)

#### Buttered Toast Landing Calculator
A physics-based calculator that estimates the probability of a buttered toast landing butter-side down when it falls off a surface:

**Formula**: `P = (1 - |((30√(H/g) · O · B)/(T + F) mod 1) - 0.5| · 2) · 100%`

Where:
- **H** = Height of fall (cm)
- **g** = Gravity (cm/s²)
- **O** = Initial overhang/push (cm)
- **B** = Butter factor (weight distribution)
- **F** = Air friction/drag
- **T** = Toast inertia (density and shape)

### Real-Life Stories
A collection of user-submitted stories demonstrating Murphy's Laws in action, including philosophical debates about the nature of these universal truths.

## Origin Story

This collection began in the late 1990s when Raanan Avidor, a science fiction enthusiast inspired by Larry Niven's references to Murphy's Law, started a simple homepage on Geocities. After posting a personal Murphy's Law experience, emails started pouring in from people around the world sharing their own stories and laws. 

What started as a learning exercise in HTML became a comprehensive archive of life's inevitable ironies, demonstrating that Murphy's Law truly is universal.

## The Great Debate: Murphy's Law vs. Faith

The collection includes a fascinating philosophical debate between various readers about whether Murphy's Laws conflict with religious beliefs. This discussion showcases different perspectives on fatalism, optimism, and the role of humor in coping with life's challenges.

## Development

### Prerequisites

- Node.js 18+ and npm
- sqlite3 CLI available on PATH

### Getting Started

```bash
# Install dependencies
npm ci

# Start local API server (SQLite-backed, CORS enabled)
npm run api
# Serves on http://127.0.0.1:8787

# Start frontend dev server (Vite, proxies /api → 127.0.0.1:8787)
npm run dev
# Dev server: http://127.0.0.1:5175
```

### Common Commands

**Building**
```bash
npm run build                    # Build production assets
npm run preview                  # Preview production build (port 5173)
```

**Testing**
```bash
npm test                         # Run unit tests (Vitest)
npm run test:watch               # Watch mode
npm run test:coverage            # Run tests with coverage report
npm run e2e                      # End-to-end tests (Playwright)
```

**Test Coverage**
- Views: Sod's Law Calculator, Buttered Toast Calculator, Home, Browse, Law Detail, Auth
- Components: Simple calculator widgets, Header, Law cards, Submit form
- Utilities: Voting system, API client, Sanitization, Attribution rendering
- Current coverage: High coverage across critical paths

**Linting**
```bash
npm run lint                     # Lint JavaScript
npm run lint:fix                 # Auto-fix JavaScript
npm run lint:css                 # Lint CSS
npm run lint:css:fix             # Auto-fix CSS
```

**Database Management**
```bash
npm run migrate                  # Run database migrations
npm run db:init                  # Initialize schema
npm run db:import                # Import data from markdown
npm run db:rebuild               # Rebuild DB from scratch
```

### Architecture

**Frontend** (`src/`)
- Framework-free vanilla JavaScript with hash routing
- Entry point: `src/main.js`
- Views: `src/views/` (home, browse, law-detail, sods-calculator, buttered-toast-calculator, etc.)
- Components: `src/components/` (header, navigation, calculator widgets)
- Utilities: `src/utils/` (API, voting, sanitization, DOM helpers)
- Styling: `styles/site.css` (prefer classes over inline styles)
- MathJax integration for formula rendering with interactive tooltips

**Backend**
- API server: `scripts/api-server.mjs` (Node.js + SQLite)
- Endpoints: `/api/health`, `/api/laws`, `/api/laws/:id`, `/api/law-of-day`
- Data pipeline: Markdown files → SQLite via `scripts/build-sqlite.mjs`
- Cron job: `scripts/select-law-of-day.mjs` (daily at midnight UTC)

**Dev Servers**
- API: `127.0.0.1:8787` (npm run api)
- Vite dev: `127.0.0.1:5175` with `/api` proxy
- Preview: `localhost:5173` (for Playwright e2e)

### Database Changes

⚠️ **IMPORTANT**: Never commit `murphys.db` directly! This file contains production user data.

To make database schema changes, use the migration system:

```bash
# 1. Create a migration file
cat > db/migrations/002_my_change.sql << 'EOF'
ALTER TABLE laws ADD COLUMN my_column TEXT;
EOF

# 2. Test locally
npm run migrate

# 3. Commit and deploy
git add db/migrations/002_my_change.sql
git commit -m "feat: Add my_column to laws"
git push
```

**See [DATABASE.md](./docs/DATABASE.md) for complete documentation.**

A git hook will prevent you from accidentally committing the database file.

## 🏗️ Infrastructure & Security

### Server Architecture

The application runs on two DigitalOcean droplets:

**Main Application Droplet** (murphys-laws.com - 167.99.53.90)
- Frontend (Vite preview) on localhost:5175
- API server on localhost:8787
- Nginx reverse proxy (ports 80/443)
- PM2 process manager (murphys-api, murphys-frontend)

**n8n Automation Droplet** (n8n.murphys-laws.com - 45.55.74.28)
- n8n workflow automation (Docker)
- Automated health monitoring
- Email alerting system

### Security Hardening

Both droplets are fully hardened with:

**SSH Security**
- Root login disabled
- Password authentication disabled
- Key-only authentication (ravidor user)
- Fail2ban protecting against brute force attacks

**Firewall (UFW)**
- Only SSH (22), HTTP (80), HTTPS (443) open
- All other ports blocked by default
- Frontend and API bound to localhost only

**Fail2ban**
- Active monitoring and IP banning
- 3 max retries in 10 minutes
- 1-hour ban duration

**SSL/TLS**
- Let's Encrypt certificates
- Auto-renewal configured
- HSTS headers enabled

### Automated Monitoring & Alerting

**Enhanced Daily Status Reports** (8:00 AM UTC)
- System status (uptime, disk, memory, CPU load)
- Service health (nginx, fail2ban, SSH, postfix)
- PM2 process status and restart counts
- Database metrics (size, growth, query performance)
- Performance metrics (response times, memory trends)
- Bandwidth usage and top requested URLs
- Security summary (failed logins, bans)
- SSL certificate expiration (30/14/7 day warnings)
- Backup status and age verification
- Resource utilization analysis
- Pending system updates

**Application Health Monitoring** (Every 5 Minutes)
- HTTP endpoint response time tracking
- API health checks with database performance
- Frontend/API availability monitoring
- Automatic service restart on failures (after 3 consecutive failures)
- Performance degradation alerts (>5s response time)

**Performance Tracking** (Hourly)
- Frontend/API response time metrics
- Database query performance
- Memory usage trends
- CPU load patterns
- Disk space growth
- PM2 process restart tracking
- Metrics stored as CSV for trend analysis

**SSL Certificate Monitoring** (Daily at 9:00 AM UTC)
- Certificate expiration tracking (30/14/7 day alerts)
- Certificate chain validation
- Auto-renewal verification
- Domain validation in SANs
- Certificate permissions check

**Security & Vulnerability Scanning** (Weekly, Sunday 3:00 AM UTC)
- System package vulnerabilities
- npm/Node.js dependency scanning
- SSL/TLS configuration audit
- SSH configuration review
- Firewall status verification
- fail2ban effectiveness
- Open ports audit
- Recently modified system files
- Docker security (if applicable)

**Log Analysis & Attack Detection** (Daily at 11:00 PM UTC)
- SQL injection attempt detection
- XSS attack pattern recognition
- Path traversal attempts
- Command injection detection
- Brute force attack monitoring
- Rate limiting effectiveness
- 4xx/5xx error analysis
- Suspicious user agent detection
- Top attacking IPs identification

**Cost Optimization Reports** (Monthly, 1st at 10:00 AM UTC)
- Resource utilization analysis
- Droplet sizing recommendations
- Bandwidth usage tracking
- Service cost breakdown
- Potential savings identification
- Long-term cost projections

**Email Delivery**: via smtp2go.com to ravidor@gmail.com
- Main droplet: alerts@murphys-laws.com
- n8n droplet: n8n-alerts@murphys-laws.com
- Alert cooldown: 1 hour per issue type (prevents spam)

### Automated Backups

**Main Application** (Daily 2:00 AM UTC)
- Database (murphys.db)
- Environment configuration (.env)
- Full application code (excluding node_modules, logs, .git)
- Retention: 30 days
- Location: `/root/backups/`
- Log: `/var/log/backup-murphys.log`

**n8n Workflows** (Daily 2:00 AM UTC)
- Database backup (SQLite)
- Configuration backup
- **GitHub backup**: https://github.com/ravidorr/n8n-workflows (private)
- Individual JSON files per workflow
- Version controlled with automatic commits
- Retention: 30 days local, unlimited on GitHub

### Automatic Security Updates

- Unattended-upgrades enabled on both droplets
- Security patches applied automatically
- Kernel updates with reboot notifications
- Package updates tracked and reported

### Log Management

**Log Rotation** (via logrotate)
- Nginx logs: 14 days
- Application logs: 30 days
- Security monitor logs: 30 days
- Backup logs: 12 weeks
- PM2 logs: Managed by pm2-logrotate module

**PM2 Log Rotation**
- Max log size: 10MB
- Retention: 30 rotations
- Compression: Enabled
- Daily rotation at midnight

### Service Monitoring Scripts

**Health Check & Monitoring**
- `/root/murphys-laws/scripts/health-check.mjs` - Node.js health checker with response time tracking
- `/usr/local/bin/health-monitor.sh` - Automated service restart on failures (every 5 min)
- `/usr/local/bin/performance-tracker.sh` - Performance metrics collection (hourly)

**Security & Analysis**
- `/usr/local/bin/enhanced-security-monitor.sh` - Security monitoring (every 6 hours)
- `/usr/local/bin/ssl-monitor.sh` - SSL certificate monitoring with chain validation (daily)
- `/usr/local/bin/vulnerability-scanner.sh` - Weekly vulnerability scans (Sunday 3 AM)
- `/usr/local/bin/log-analyzer.sh` - Attack detection and log analysis (daily 11 PM)

**Reporting & Status**
- `/usr/local/bin/daily-report.sh` - Consolidated daily health report (5 AM UTC)
- `/usr/local/bin/cost-optimization-report.sh` - Monthly cost analysis (1st, 10 AM)

**Backup Operations**
- `/usr/local/bin/backup-murphys.sh` - Application and database backup (daily 2 AM)
- `/usr/local/bin/backup-workflows-to-github.sh` - n8n workflow GitHub sync (daily 2 AM)

### Network Security

**Port Configuration**
- SSH: 22 (restricted)
- HTTP: 80 (nginx)
- HTTPS: 443 (nginx)
- Frontend: 5175 (localhost only)
- API: 8787 (localhost only)
- n8n: 5678 (localhost only, Docker)
- Postfix: 25 (localhost only)

**Nginx Rate Limiting**
- General app: 10 requests/second per IP (burst: 20)
- API endpoints: 5 requests/second per IP (burst: 10)
- Calculators: 10 requests/minute per IP (burst: 5)
- Connection limit: 10 concurrent connections per IP
- Rate-limited requests return 429 status
- Logging enabled for rate limit triggers

**Security Headers**
- X-Frame-Options: SAMEORIGIN (clickjacking protection)
- X-Content-Type-Options: nosniff
- X-XSS-Protection: enabled with blocking mode
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation, microphone, camera disabled
- HSTS: max-age 31536000 with includeSubDomains and preload
- Content-Security-Policy: Configured for Google Analytics, GTM, and app requirements
- Server tokens hidden (nginx version not disclosed)

**PM2 Auto-Recovery**
- Memory limit: 500MB per process (auto-restart on exceed)
- Exponential backoff for restart delays
- Maximum 10 restarts with 10s minimum uptime
- Listen/kill timeouts configured
- Automatic restart on crashes

**Postfix Email Relay**
- Configured for localhost only
- SMTP relay via smtp2go.com
- TLS encryption enabled
- Sender rewriting to verified domains

### Disabled Unnecessary Services

To reduce attack surface:
- ModemManager
- multipathd
- udisks2
- fwupd
- packagekit

### Third-Party Services

The application integrates with the following external services:

**Email Services**
- **ImprovMX** (https://improvmx.com/) - Email forwarding for @murphys-laws.com domain
- **smtp2go** (https://app.smtp2go.com/) - SMTP relay for outbound emails (alerts, notifications)
  - Sender addresses: `alerts@murphys-laws.com`, `n8n-alerts@murphys-laws.com`
  - Free tier: 1,000 emails/month

**Analytics & Monetization**
- **Google Analytics** (https://analytics.google.com/) - Website traffic and user behavior analytics
- **Google AdSense** (https://adsense.google.com/) - Advertisement monetization
- **Google Tag Manager** (https://tagmanager.google.com/) - Tag and analytics management
  - Container ID: GTM-KD4H36BH

**Automation**
- **n8n** (https://n8n.io/) - Self-hosted workflow automation
  - Hosted on dedicated droplet: n8n.murphys-laws.com
  - Workflows backed up to GitHub: https://github.com/ravidorr/n8n-workflows

## 🚀 Deployment

**IMPORTANT**: Always deploy from your **local machine**, never build on the droplet!

### Deploy to Production

```bash
npm run deploy
```

This command:
1. ✅ Validates port configuration
2. 🔨 Builds the project locally
3. 📤 Syncs `dist/` folder to droplet
4. 🔄 Restarts services
5. ✅ Shows deployment status

### Deployment Rules

- ✅ **DO**: Run `npm run deploy` from your local machine
- ✅ **DO**: Let the script validate ports automatically
- ❌ **DON'T**: Run `npm run build` or `vite build` on the droplet (causes OOM crashes)
- ❌ **DON'T**: SSH into droplet to deploy manually

### Troubleshooting Deployments

See **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** for:
- Complete deployment guide
- Port configuration validation
- Troubleshooting 502 errors
- Monitoring and logs

### Email Notifications

The API server can send email notifications when new laws are submitted. To enable:

1. **Create a `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Configure SMTP settings** in `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=noreply@murphys-laws.com
   ```

3. **For Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password

4. **Restart the API server**:
   ```bash
   npm run api
   ```

Emails will be sent to `ravidor@gmail.com` with subject "New Murphy Law Submitted!"

## 📚 Operational Documentation

Comprehensive guides for infrastructure management:

**[DEPLOY-MONITORING.md](./docs/DEPLOY-MONITORING.md)** - Enhanced Monitoring Deployment
- Step-by-step deployment of all monitoring enhancements
- Cron job configuration
- Nginx rate limiting and security headers setup
- Testing and verification procedures
- Rollback instructions

**[DISASTER-RECOVERY.md](./docs/DISASTER-RECOVERY.md)** - Disaster Recovery Runbook
- Complete server rebuild procedures
- Database recovery steps
- SSL certificate recovery
- Service restoration checklist
- Recovery time estimates for various scenarios

**[BACKUP-RESTORE.md](./docs/BACKUP-RESTORE.md)** - Backup & Restore Procedures
- Manual backup procedures
- Database restore workflows
- Application restore steps
- n8n workflow recovery
- Backup testing and verification
- Off-site backup strategies

**[DATABASE.md](./docs/DATABASE.md)** - Database Management
- Schema migration system
- Safe update procedures
- Data integrity guidelines

**[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Application Deployment
- Standard deployment procedures
- Port validation
- Troubleshooting guides

## Contributing

This is a living collection! This archive preserves the wisdom and humor for future generations. The laws demonstrate universal truths that transcend culture, profession, and time.

## License

This work is licensed under [CC0 1.0 Universal (CC0 1.0) Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/). You can copy, modify, and distribute this work, even for commercial purposes, without asking permission.

See the [LICENSE](LICENSE) file for full details.

## Core Murphy's Laws

Here are some essential laws to get you started:

- **The Original**: If anything can go wrong, it will.
- **The Corollary**: If anything just cannot go wrong, it will anyway.
- **The Timing Law**: If anything can go wrong, it will at the worst possible moment.
- **O'Toole's Commentary**: Murphy was an optimist!
- **The Bread Law**: The chance of bread falling butter-side down is directly proportional to the cost of the carpet.

## Why Murphy's Laws Matter

Murphy's Laws serve as:
- **Stress Relief**: Humor helps us cope with inevitable frustrations
- **Preparedness**: Expecting problems helps us plan better
- **Universal Truth**: These experiences are shared across all humanity
- **Perspective**: Sometimes laughing is better than crying

---

*Remember: Murphy's Law isn't about pessimism, it's about finding humor in life's inevitable chaos and being prepared for the unexpected. After all, if you're reading this README, something probably just went wrong that brought you here!* 😄
