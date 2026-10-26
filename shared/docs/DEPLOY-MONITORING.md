# Deploying Enhanced Monitoring and Security Infrastructure

This guide walks through deploying all the new monitoring, security, and performance features to the production servers.

## Overview

The following enhancements have been created:

**Health & Performance Monitoring:**
- Enhanced health checks with response time tracking
- Performance metrics collection (hourly)
- Automated service restart on failures (every 5 minutes)

**Security Enhancements:**
- Enhanced nginx rate limiting
- Comprehensive security headers (including CSP)
- SSL certificate monitoring with chain validation
- Weekly vulnerability scanning
- Daily log analysis with attack detection

**Operational Improvements:**
- Enhanced daily status reports
- Disaster recovery documentation
- Backup restore procedures
- Cost optimization reporting

## How Monitoring Works

The monitoring system uses two approaches:

**Independent Cron Jobs:**
- `health-monitor.sh` - Runs every 5 minutes to check service health and restart failed services
- `performance-tracker.sh` - Runs hourly to collect performance metrics (response times, memory, CPU, disk)

**Integrated Daily Report:**
The `daily-report.sh` script (runs at 5 AM UTC) consolidates multiple monitoring tasks into a single comprehensive email:
- System status (uptime, memory, disk, services, PM2 processes)
- Database metrics (size, growth, activity)
- Website activity (submissions, votes)
- Performance metrics (from hourly collection)
- Murphy's Law of the Day
- Traffic & bandwidth analysis
- Security summary (failed SSH, fail2ban)
- **SSL certificate monitoring** (expiration check, validation)
- **Log analysis & attack detection** (suspicious patterns, security issues)
- **Vulnerability scanning** (Sundays only - CVEs, outdated packages)
- **Cost optimization report** (1st of month only - evidence-based capacity summary; see [OPERATIONAL-METRICS.md](./OPERATIONAL-METRICS.md))

This consolidated approach reduces email noise while providing comprehensive daily insights.

## Prerequisites

- SSH access to the main application droplet
- Sudo/root privileges
- Existing backup of current configuration

## Deployment Steps

### Part 1: Deploy to Main Application Droplet (167.99.53.90)

#### 1. Upload New Scripts

```bash
# From your local machine in the project directory
scp backend/scripts/alert-email.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/health-monitor.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/performance-tracker.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/analyze-resource-peaks.sh ravidor@167.99.53.90:/tmp/
scp backend/config/operational-metrics-main-app.env.example ravidor@167.99.53.90:/tmp/
scp backend/scripts/ssl-monitor.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/vulnerability-scanner.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/log-analyzer.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/daily-report.sh ravidor@167.99.53.90:/tmp/
scp backend/scripts/cost-optimization-report.sh ravidor@167.99.53.90:/tmp/
```

#### 2. Install Scripts on Server

The scripts have no built-in alert address. They email `ALERT_EMAIL`, or `EMAIL_TO` (the admin address the
server already uses for notices) when that is not set, looking in the environment first and then in the
`.env` files (`$ALERT_ENV_FILE` if set, then `/root/murphys-laws/.env`, then
`/root/murphys-laws/backend/.env`; the deploy writes only `backend/.env`, from the repository secrets, and the
deploy stops if neither `ALERT_EMAIL` nor `EMAIL_TO` is set). `health-check` also honors `HEALTH_CHECK_EMAIL_TO` first. Unlike the API, they do not
fall back to `admin@murphys-laws.com`: with no address configured a script logs `ALERT NOT SENT` (or `Report NOT emailed`), warns on
stderr and in syslog (`logger -t murphys-alerts`), and skips the email instead of failing. To use a different
address, set the repository secret `ALERT_EMAIL` and deploy (a value typed into `backend/.env` by hand is
overwritten by the next deploy; to keep one by hand, put it in a separate file and export `ALERT_ENV_FILE`
pointing at it in the cron job). Every script that sends mail sources `alert-email.sh` from its own directory,
so install it next to them as below (the GitHub deploy and `npm run deploy` both do; a script falls back to
the repo copy under `backend/scripts/`); a script that cannot find either stops with `FATAL: cannot load alert-email.sh` rather than losing alerts quietly. The recipient can be a comma-separated list. `mail` exiting 0 only means the
local mail system accepted the message, so check `mailq` if an alert you expect does not arrive. A script that
could not deliver its alert or report exits with code `2` (when it would otherwise have succeeded) so cron
notices; see `HEALTH-CHECK.md`.

```bash
# SSH into the server
ssh ravidor@167.99.53.90

# The health check itself (backend/scripts/health-check.ts) ships with the deploy and is run from the
# repo through tsx by health-monitor.sh; nothing to copy by hand.

# Move shell scripts to /usr/local/bin
# alert-email.sh is sourced by the other scripts; install it next to them (they fall back to the repo copy)
sudo cp /tmp/alert-email.sh /usr/local/bin/
sudo cp /tmp/health-monitor.sh /usr/local/bin/
sudo cp /tmp/performance-tracker.sh /usr/local/bin/
sudo cp /tmp/ssl-monitor.sh /usr/local/bin/
sudo cp /tmp/vulnerability-scanner.sh /usr/local/bin/
sudo cp /tmp/log-analyzer.sh /usr/local/bin/
sudo cp /tmp/cost-optimization-report.sh /usr/local/bin/

# Make all scripts executable
sudo chmod +x /usr/local/bin/health-monitor.sh
sudo chmod +x /usr/local/bin/performance-tracker.sh
sudo chmod +x /usr/local/bin/ssl-monitor.sh
sudo chmod +x /usr/local/bin/vulnerability-scanner.sh
sudo chmod +x /usr/local/bin/log-analyzer.sh
sudo chmod +x /usr/local/bin/cost-optimization-report.sh

# Replace the daily status report
sudo cp /tmp/daily-report.sh /usr/local/bin/daily-report.sh
sudo chmod +x /usr/local/bin/daily-report.sh
```

#### 3. Update API Server (for DB Performance Tracking)

```bash
# Deploy latest code
cd /root/murphys-laws
git pull

# Rebuild if needed
npm ci
npm run build

# Restart services
pm2 restart all
```

#### 4. Update PM2 Configuration (Enhanced Auto-Restart)

```bash
# Upload new ecosystem config
# From local machine:
scp ecosystem.config.cjs ravidor@167.99.53.90:/tmp/

# On server:
sudo cp /tmp/ecosystem.config.cjs /root/murphys-laws/
cd /root/murphys-laws
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

#### 5. Configure Cron Jobs

```bash
# Edit crontab
sudo crontab -e

# Add or update these lines:
```

```cron
# Backup (daily at 4 AM UTC)
0 4 * * * /usr/local/bin/backup-murphys.sh >> /var/log/backup-murphys.log 2>&1

# Law of the Day selection (daily at midnight UTC)
0 0 * * * cd /root/murphys-laws && /usr/bin/node backend/scripts/select-law-of-day.mjs >> logs/law-of-day.log 2>&1

# Daily status report (5 AM UTC) - includes SSL monitoring, log analysis, vulnerability scan, and cost report
0 5 * * * /usr/local/bin/daily-report.sh >> /var/log/daily-report.log 2>&1

# Health monitoring (every 5 minutes) - proactive service restart and real-time alerts
*/5 * * * * /usr/local/bin/health-monitor.sh >> /var/log/health-monitor.log 2>&1

# Performance tracking (hourly)
0 * * * * /usr/local/bin/performance-tracker.sh >> /var/log/performance-tracker.log 2>&1
```

**Note:** SSL monitoring, log analysis, vulnerability scanning (Sundays), and cost optimization (1st of month) are all integrated into the daily-report.sh script and run as part of the daily status report at 5 AM UTC.

The daily report launcher delegates to `backend/scripts/render-daily-report.ts`, which
builds a Gmail-safe HTML summary with fully expanded detail sections and a matching
plain-text MIME alternative. Standalone report scripts keep their text output and also
expose `--format json` for the renderer.

After deploy, send an all-sections smoke test only to an explicit recipient:

```bash
sudo DAILY_REPORT_TEST_RECIPIENT=<your-email> \
  /usr/local/bin/daily-report.sh --test-email
```

The command exits without sending when `DAILY_REPORT_TEST_RECIPIENT` is unset.
Test messages include a UTC timestamp in the subject (`[test 2026-10-11T12:08:10Z]`) so
repeat runs do not collapse into one Gmail thread.

When `backend/scripts/render-daily-report.ts` changes on a push to `main`, the deploy
workflow sends one template smoke email if the repository secret
`DAILY_REPORT_TEST_RECIPIENT` is configured (same explicit recipient as manual runs).

#### 6. Update Nginx Configuration (Rate Limiting & Security Headers)

**IMPORTANT**: Test nginx configuration before applying!

```bash
# Upload nginx configs
# From local machine:
scp config/nginx-rate-limiting.conf ravidor@167.99.53.90:/tmp/
scp config/nginx-murphys-laws-enhanced.conf ravidor@167.99.53.90:/tmp/

# On server:
# Backup current configuration
sudo cp /etc/nginx/sites-available/murphys-laws /etc/nginx/sites-available/murphys-laws.backup-$(date +%Y%m%d)

# Add rate limiting configuration to nginx.conf
sudo cp /tmp/nginx-rate-limiting.conf /etc/nginx/conf.d/rate-limiting.conf

# Review the new server configuration
cat /tmp/nginx-murphys-laws-enhanced.conf

# IMPORTANT: Review the CSP (Content Security Policy) in the config
# Make sure it includes all domains your app needs (Google Analytics, GTM, etc.)

# If satisfied, apply it:
sudo cp /tmp/nginx-murphys-laws-enhanced.conf /etc/nginx/sites-available/murphys-laws

# Test configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# If test fails, restore backup:
# sudo cp /etc/nginx/sites-available/murphys-laws.backup-YYYYMMDD /etc/nginx/sites-available/murphys-laws
```

#### 7. Test All New Features

```bash
# Test health check
cd /root/murphys-laws
npx tsx backend/scripts/health-check.ts

# Expected: Should report frontend and API response times

# Test performance tracker
/usr/local/bin/performance-tracker.sh

# Check that metrics file was created
ls -lh /var/log/performance-metrics/

# Test SSL monitor
/usr/local/bin/ssl-monitor.sh

# Test vulnerability scanner (will take a few minutes)
/usr/local/bin/vulnerability-scanner.sh

# Test log analyzer
/usr/local/bin/log-analyzer.sh

# Check all logs for errors
tail -100 /var/log/health-monitor.log
tail -100 /var/log/performance-tracker.log
tail -100 /var/log/ssl-monitor.log
```

#### 8. Verify Services

```bash
# Check that all PM2 processes are running
pm2 list

# Check nginx status
sudo systemctl status nginx

# Check fail2ban
sudo systemctl status fail2ban

# Test website
curl -I https://murphys-laws.com

# Test API health endpoint (should include dbQueryTime now)
curl https://murphys-laws.com/api/health

# Check rate limiting is working
# Run this command multiple times rapidly:
for i in {1..30}; do curl -I https://murphys-laws.com; done
# Should eventually see 429 (Too Many Requests) responses
```

---

### Retired n8n automation

n8n is no longer used. The former n8n droplet and workflow backups are retired.
Monitoring and capacity reports cover the main application host only. Historical
`metrics-n8n-*.csv` files may remain under `/var/log/performance-metrics/` but are
not included in monthly reports.

---

## Verification Checklist

After deployment, verify:

### Main Droplet

- [ ] Health check runs successfully
- [ ] Performance metrics being collected hourly
- [ ] Health monitor running every 5 minutes
- [ ] SSL monitor runs daily
- [ ] Vulnerability scanner runs weekly
- [ ] Log analyzer runs daily
- [ ] Enhanced daily report sent at 8 AM
- [ ] Nginx rate limiting active
- [ ] Security headers present (check with: `curl -I https://murphys-laws.com`)
- [ ] PM2 auto-restart configured
- [ ] All PM2 processes running
- [ ] Email alerts working

### Testing Email Alerts

```bash
echo "Test from main droplet" | mail -s "Test Alert" <your-email>
```

---

## Rollback Procedures

If something goes wrong:

### Nginx Rollback

```bash
# Restore previous nginx config
sudo cp /etc/nginx/sites-available/murphys-laws.backup-YYYYMMDD /etc/nginx/sites-available/murphys-laws
sudo nginx -t
sudo systemctl reload nginx
```

### PM2 Rollback

```bash
# Restore previous ecosystem config from git history
cd /root/murphys-laws
git checkout HEAD~1 ecosystem.config.cjs
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

### Remove Scripts

```bash
# If a script is causing issues, simply remove it
sudo rm /usr/local/bin/problematic-script.sh

# And remove from cron
sudo crontab -e
# Delete the problematic line
```

---

## Monitoring the Monitors

After deployment, check these log files daily for the first week:

```bash
# Health monitoring (every 5 minutes)
tail -f /var/log/health-monitor.log

# Performance tracking (hourly)
tail -f /var/log/performance-tracker.log

# Daily reports (includes SSL, log analysis, vulnerability scan, cost report)
tail -f /var/log/daily-report.log

# Individual script logs (if run manually or as part of daily report)
tail -f /var/log/consolidated-daily-report.log
```

---

## Expected First-Week Schedule

**Every 5 Minutes**:
- Health monitoring runs (alerts only on failures)

**Hourly**:
- Performance metrics collected (silent, check logs)

**Daily at Midnight UTC**:
- Law of the Day selection
- Index.html regeneration

**Daily at 4 AM UTC**:
- Database and application backup

**Daily at 5 AM UTC**:
- Comprehensive status report email including:
  - System status
  - Database metrics
  - Website activity
  - Performance metrics (from hourly collection)
  - Murphy's Law of the Day
  - Traffic & bandwidth
  - Security summary
  - SSL certificate status
  - Log analysis & attack detection
  - Vulnerability scan (Sundays only)
  - Cost optimization report (1st of month only)

---

## Troubleshooting

### Cron Jobs Not Running

```bash
# Check cron service
sudo systemctl status cron

# Check cron logs
grep CRON /var/log/syslog | tail -20

# Verify crontab
sudo crontab -l

# Test script manually
/usr/local/bin/health-monitor.sh
```

### Email Not Being Sent

```bash
# Check Postfix status
sudo systemctl status postfix

# Check mail logs
tail -100 /var/log/mail.log

# Test email manually
echo "Test" | mail -s "Test" <your-email>

# Verify SMTP configuration
cat /etc/postfix/sasl_passwd
```

### Nginx Rate Limiting Issues

```bash
# Check nginx error log
tail -100 /var/log/nginx/error.log

# Check if rate limit zones are defined
grep "limit_req_zone" /etc/nginx/conf.d/rate-limiting.conf

# Test rate limiting
for i in {1..50}; do curl -w "%{http_code}\n" -o /dev/null -s https://murphys-laws.com; done
# Should see some 429 responses
```

### PM2 Process Crashes

```bash
# Check PM2 logs
pm2 logs

# Check for memory issues
pm2 monit

# Review error logs
tail -100 /root/murphys-laws/logs/api-error.log
```

---

## Post-Deployment Tasks

1. **Monitor email alerts** for the first week
2. **Review performance metrics** after 7 days
3. **Check cost optimization report** after 30 days
4. **Test backup restore** procedure (see [BACKUP-RESTORE.md](./BACKUP-RESTORE.md))
5. **Update disaster recovery documentation** with any changes
6. **Schedule quarterly review** of monitoring effectiveness

---

## Documentation Updates

After successful deployment, update:

- [ ] README.md with new monitoring features
- [ ] [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) if procedures changed
- [ ] [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) if backup procedures changed
- [ ] Document any customizations or issues encountered

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Issues Encountered**: _______________
**Resolution Notes**: _______________

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in `/var/log/`
3. Test scripts individually
4. Verify cron jobs are scheduled
5. Check email configuration

For major issues, refer to [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) for rollback procedures.
