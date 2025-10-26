# Deploying Enhanced Monitoring and Security Infrastructure

This guide walks through deploying all the new monitoring, security, and performance features to the production servers.

## Overview

The following enhancements have been created:

**Health & Performance Monitoring:**
- Enhanced health checks with response time tracking
- Performance metrics collection (hourly)
- Automated service restart on failures

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

## Prerequisites

- SSH access to both droplets
- Sudo/root privileges
- Existing backup of current configuration

## Deployment Steps

### Part 1: Deploy to Main Application Droplet (167.99.53.90)

#### 1. Upload New Scripts

```bash
# From your local machine in the project directory
scp scripts/health-check.mjs ravidor@167.99.53.90:/tmp/
scp scripts/health-monitor.sh ravidor@167.99.53.90:/tmp/
scp scripts/performance-tracker.sh ravidor@167.99.53.90:/tmp/
scp scripts/ssl-monitor.sh ravidor@167.99.53.90:/tmp/
scp scripts/vulnerability-scanner.sh ravidor@167.99.53.90:/tmp/
scp scripts/log-analyzer.sh ravidor@167.99.53.90:/tmp/
scp scripts/enhanced-daily-status-report.sh ravidor@167.99.53.90:/tmp/
scp scripts/cost-optimization-report.sh ravidor@167.99.53.90:/tmp/
```

#### 2. Install Scripts on Server

```bash
# SSH into the server
ssh ravidor@167.99.53.90

# Move health check script to project directory (it's a Node.js script)
sudo cp /tmp/health-check.mjs /root/murphys-laws/scripts/
sudo chmod +x /root/murphys-laws/scripts/health-check.mjs

# Move shell scripts to /usr/local/bin
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
sudo cp /tmp/enhanced-daily-status-report.sh /usr/local/bin/daily-status-report.sh
sudo chmod +x /usr/local/bin/daily-status-report.sh
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
# Daily status report (8 AM UTC)
0 8 * * * /usr/local/bin/daily-status-report.sh

# Health monitoring (every 5 minutes)
*/5 * * * * /usr/local/bin/health-monitor.sh

# Performance tracking (hourly)
0 * * * * /usr/local/bin/performance-tracker.sh

# SSL monitoring (daily at 9 AM)
0 9 * * * /usr/local/bin/ssl-monitor.sh

# Vulnerability scanning (weekly, Sunday at 3 AM)
0 3 * * 0 /usr/local/bin/vulnerability-scanner.sh

# Log analysis (daily at 11 PM)
0 23 * * * /usr/local/bin/log-analyzer.sh

# Cost optimization report (monthly, 1st day at 10 AM)
0 10 1 * * /usr/local/bin/cost-optimization-report.sh

# Backup (daily at 2 AM) - should already exist
0 2 * * * /usr/local/bin/backup-murphys.sh
```

#### 6. Update Nginx Configuration (Rate Limiting & Security Headers)

**⚠️  IMPORTANT**: Test nginx configuration before applying!

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
node scripts/health-check.mjs

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

### Part 2: Deploy to n8n Droplet (45.55.74.28)

The n8n droplet uses similar monitoring but doesn't need all the application-specific scripts.

```bash
# From local machine
scp scripts/enhanced-daily-status-report.sh ravidor@45.55.74.28:/tmp/

# SSH into n8n server
ssh ravidor@45.55.74.28

# Install script
sudo cp /tmp/enhanced-daily-status-report.sh /usr/local/bin/daily-status-report.sh
sudo chmod +x /usr/local/bin/daily-status-report.sh

# The daily report should already be in cron from previous setup
# Verify:
sudo crontab -l | grep daily-status-report
```

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

### n8n Droplet

- [ ] Enhanced daily report sent
- [ ] All monitoring scripts active
- [ ] n8n running in Docker
- [ ] Workflows backed up to GitHub

### Testing Email Alerts

```bash
# Send a test email from each droplet
echo "Test from main droplet" | mail -s "Test Alert" ravidor@gmail.com

ssh ravidor@45.55.74.28 "echo 'Test from n8n droplet' | mail -s 'Test Alert' ravidor@gmail.com"

# Check your email for both messages
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
# Health monitoring
tail -f /var/log/health-monitor.log

# Performance tracking
tail -f /var/log/performance-tracker.log

# SSL monitoring
tail -f /var/log/ssl-monitor.log

# Vulnerability scanning
tail -f /var/log/vulnerability-scanner.log

# Log analysis
tail -f /var/log/log-analyzer.log

# Daily reports
tail -f /var/log/daily-status-report.log
```

---

## Expected First-Week Schedule

**Daily (8 AM UTC)**:
- Enhanced status report email

**Daily (9 AM UTC)**:
- SSL certificate monitoring email (if issues)

**Daily (11 PM UTC)**:
- Log analysis report email

**Every 5 Minutes**:
- Health check (alerts only on failures)

**Hourly**:
- Performance metrics collected (silent, check logs)

**Weekly (Sunday 3 AM)**:
- Vulnerability scan email

**Monthly (1st, 10 AM)**:
- Cost optimization report email

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
echo "Test" | mail -s "Test" ravidor@gmail.com

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
4. **Test backup restore** procedure (see BACKUP-RESTORE.md)
5. **Update disaster recovery documentation** with any changes
6. **Schedule quarterly review** of monitoring effectiveness

---

## Documentation Updates

After successful deployment, update:

- [ ] README.md with new monitoring features
- [ ] DISASTER-RECOVERY.md if procedures changed
- [ ] BACKUP-RESTORE.md if backup procedures changed
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

For major issues, refer to DISASTER-RECOVERY.md for rollback procedures.
