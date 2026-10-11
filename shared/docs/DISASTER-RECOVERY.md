# Disaster Recovery Runbook

This document provides step-by-step procedures for recovering from various disaster scenarios for the Murphy's Laws infrastructure.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [Backup Locations](#backup-locations)
3. [Recovery Scenarios](#recovery-scenarios)
   - [Database Corruption](#scenario-1-database-corruption)
   - [Main Droplet Complete Failure](#scenario-2-main-droplet-complete-failure)
   - [SSL Certificate Expiration](#scenario-3-ssl-certificate-expiration)
   - [Application Not Responding](#scenario-4-application-not-responding)
4. [Service Restoration Checklist](#service-restoration-checklist)

---

## Emergency Contacts

- **Primary Administrator**: <ravidor@gmail.com>
- **Domain Registrar**: (Add registrar info)
- **Hosting Provider**: DigitalOcean
- Main Droplet IP: 167.99.53.90
- **DNS Provider**: DigitalOcean
- **Email Services**:
- Forwarding: ImprovMX (improvmx.com)
- SMTP: smtp2go.com

---

## Backup Locations

### Main Application Droplet (167.99.53.90)

**Local Backups**: `/root/backups/`
- Database: `murphys_db_YYYYMMDD_HHMMSS.db`
- Environment: `env_YYYYMMDD_HHMMSS.bak`
- Application: `murphys-laws-YYYY-MM-DD-HHMMSS.tar.gz`
- Retention: 30 days
- Schedule: Daily at 2:00 AM UTC

**Backup Script**: `/usr/local/bin/backup-murphys.sh`

n8n automation was retired; recovery procedures cover the main application droplet only.

### Testing Backups

```bash
# Test database backup integrity
sqlite3 /root/backups/murphys-2025-01-15-020000.db "PRAGMA integrity_check;"

# Expected output: ok
```

---

## Recovery Scenarios

### Scenario 1: Database Corruption

**Symptoms**:
- Application errors: "Database unavailable"
- SQLite integrity check fails
- Health check endpoint returns 503

**Recovery Steps**:

1. **Stop services**:
 ```bash
 ssh ravidor@167.99.53.90
 pm2 stop all
 ```

1. **Verify database is corrupted**:
 ```bash
 sqlite3 /root/murphys-laws/backend/murphys.db "PRAGMA integrity_check;"
 ```

1. **Find latest backup**:
 ```bash
 ls -lt /root/backups/*.db | head -1
 ```

1. **Restore database**:
 ```bash
 cp /root/backups/murphys-YYYY-MM-DD-HHMMSS.db /root/murphys-laws/backend/murphys.db
 ```

1. **Verify restored database**:
 ```bash
 sqlite3 /root/murphys-laws/backend/murphys.db "PRAGMA integrity_check;"
 sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"
 ```

1. **Restart services**:
 ```bash
 pm2 restart all
 ```

1. **Verify application**:
 ```bash
 curl https://murphys-laws.com/api/health
 ```

**Expected Recovery Time**: 5-10 minutes
**Data Loss**: Up to 24 hours (since last backup)

---

### Scenario 2: Main Droplet Complete Failure

**Symptoms**:
- Server unreachable
- SSH connection refused
- Website down

**Recovery Steps**:

1. **Create new DigitalOcean droplet**:
- OS: Ubuntu 24.04 LTS
- Size: 1GB RAM minimum
- Region: NYC3 (or nearest to users)
- Add SSH key: `~/.ssh/id_ed25519_digitalocean.pub`

1. **Initial server setup**:
 ```bash
 # SSH into new droplet
 ssh root@<NEW_IP>

 # Update system
 apt update && apt upgrade -y

 # Install required packages
 apt install -y nginx git sqlite3 certbot python3-certbot-nginx \
 fail2ban ufw nodejs npm jq bc curl wget

 # Create user
 adduser ravidor
 usermod -aG sudo ravidor
 mkdir -p /home/ravidor/.ssh
 cp /root/.ssh/authorized_keys /home/ravidor/.ssh/
 chown -R ravidor:ravidor /home/ravidor/.ssh
 chmod 700 /home/ravidor/.ssh
 chmod 600 /home/ravidor/.ssh/authorized_keys
 ```

1. **Security hardening**:
 ```bash
 # Configure SSH
 sed -i 's/^#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
 sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
 systemctl restart sshd

 # Configure firewall
 ufw default deny incoming
 ufw default allow outgoing
 ufw allow 22/tcp
 ufw allow 80/tcp
 ufw allow 443/tcp
 ufw --force enable

 # Configure fail2ban
 cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
EOF
 systemctl enable fail2ban
 systemctl start fail2ban
 ```

1. **Install Node.js (via nvm)**:
 ```bash
 sudo -u ravidor bash << 'EOF'
 curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
 source ~/.bashrc
 nvm install
 nvm use
 npm install -g pm2
 EOF
 ```

1. **Clone repository**:
 ```bash
 cd /root
 git clone https://github.com/ravidorr/murphys-laws.git
 cd murphys-laws
 ```

1. **Restore database from backup**:

 If you have access to old droplet:
 ```bash
 scp ravidor@167.99.53.90:/root/backups/murphys-*.db /root/murphys-laws/backend/murphys.db
 ```

 If old droplet is gone, you'll need to rebuild from source:
 ```bash
 npm ci
 npm run build:backend:db
 ```

1. **Configure environment**:
 ```bash
 cat > .env << 'EOF'
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=alerts@murphys-laws.com
EOF
 ```

1. **Build application**:
 ```bash
 npm ci
 npm run build
 ```

1. **Install and start PM2**:
 ```bash
 pm2 start ecosystem.config.cjs
 pm2 save
 pm2 startup
 ```

1. **Configure nginx**:
 ```bash
 # Copy enhanced nginx config
 cp config/nginx-rate-limiting.conf /etc/nginx/conf.d/rate-limiting.conf
 cp config/nginx-murphys-laws-enhanced.conf /etc/nginx/sites-available/murphys-laws
 ln -s /etc/nginx/sites-available/murphys-laws /etc/nginx/sites-enabled/
 rm /etc/nginx/sites-enabled/default

 # Test configuration
 nginx -t

 # Restart nginx
 systemctl restart nginx
 ```

1. **Configure SSL certificate**:
 ```bash
 certbot --nginx -d murphys-laws.com -d www.murphys-laws.com \
 --non-interactive --agree-tos --email ravidor@gmail.com
 ```

1. **Install monitoring scripts**:
 ```bash
 # Copy scripts
 cp scripts/daily-report.sh /usr/local/bin/daily-report.sh
 cp scripts/health-monitor.sh /usr/local/bin/health-monitor.sh
 cp scripts/performance-tracker.sh /usr/local/bin/performance-tracker.sh
 cp scripts/ssl-monitor.sh /usr/local/bin/ssl-monitor.sh
 cp scripts/vulnerability-scanner.sh /usr/local/bin/vulnerability-scanner.sh
 cp scripts/log-analyzer.sh /usr/local/bin/log-analyzer.sh

 # Make executable
 chmod +x /usr/local/bin/*.sh

 # Configure cron jobs
 crontab -e
 ```

 Add these lines:
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

The daily report uses `backend/scripts/render-daily-report.ts` for multipart HTML and
plain-text delivery. After deploy, validate formatting with:

```bash
sudo DAILY_REPORT_TEST_RECIPIENT=ravidor@gmail.com \
  /usr/local/bin/daily-report.sh --test-email
```

1. **Update DNS**:
- Update A record for murphys-laws.com to <NEW_IP>
- Update A record for <www.murphys-laws.com> to <NEW_IP>
- Wait for DNS propagation (5-30 minutes)

1. **Verify services**:
 ```bash
 # Check PM2
 pm2 list

 # Check nginx
 curl -I https://murphys-laws.com

 # Check API
 curl https://murphys-laws.com/api/health

 # Check SSL
 curl -vI https://murphys-laws.com 2>&1 | grep "SSL certificate"
 ```

**Expected Recovery Time**: 2-4 hours
**Data Loss**: Up to 24 hours (database) + any recent submissions

---

### Scenario 3: SSL Certificate Expiration

**Symptoms**:
- Browser shows "Your connection is not private"
- SSL certificate expired warning

**Recovery Steps**:

1. **Check certificate status**:
 ```bash
 openssl x509 -enddate -noout -in /etc/letsencrypt/live/murphys-laws.com/cert.pem
 ```

1. **Renew certificate**:
 ```bash
 certbot renew --force-renewal
 ```

1. **Restart nginx**:
 ```bash
 systemctl restart nginx
 ```

1. **Verify renewal**:
 ```bash
 curl -vI https://murphys-laws.com 2>&1 | grep "expire date"
 ```

1. **Check auto-renewal is enabled**:
 ```bash
 systemctl status certbot.timer
 systemctl enable certbot.timer
 ```

**Expected Recovery Time**: 5 minutes
**Data Loss**: None

---

### Scenario 4: Application Not Responding

**Symptoms**:
- 502 Bad Gateway
- Health checks failing
- PM2 processes stopped

**Recovery Steps**:

1. **Check PM2 status**:
 ```bash
 ssh ravidor@167.99.53.90
 pm2 list
 pm2 logs
 ```

1. **Restart PM2 processes**:
 ```bash
 pm2 restart all
 ```

1. **If restart fails, check logs**:
 ```bash
 tail -100 /root/murphys-laws/logs/api-error.log
 tail -100 /root/murphys-laws/logs/frontend-error.log
 ```

1. **Check for port conflicts**:
 ```bash
 lsof -i :5175
 lsof -i :8787
 ```

1. **If needed, rebuild and redeploy**:
 ```bash
 cd /root/murphys-laws
 git pull
 npm ci
 npm run build
 pm2 restart all
 ```

1. **Verify health**:
 ```bash
 curl https://murphys-laws.com/api/health
 ```

**Expected Recovery Time**: 5-15 minutes
**Data Loss**: None

---

## Service Restoration Checklist

After any recovery, verify these services:

- [ ] Website loads: <https://murphys-laws.com>
- [ ] API responds: <https://murphys-laws.com/api/health>
- [ ] SSL certificate valid
- [ ] Database accessible and not corrupted
- [ ] PM2 processes running
- [ ] Nginx running and configured correctly
- [ ] Fail2ban active
- [ ] UFW firewall active
- [ ] Cron jobs configured
- [ ] Email alerts working (send test)
- [ ] Backups running
- [ ] Monitoring scripts operational
- [ ] DNS resolving correctly

---

## Testing Disaster Recovery

**Recommended**: Test recovery procedures quarterly

1. **Test database restore**:
 ```bash
 # On development/staging environment
 cp /root/backups/murphys-latest.db /tmp/test-restore.db
 sqlite3 /tmp/test-restore.db "PRAGMA integrity_check;"
 ```

1. **Test backup retrieval**:
 ```bash
 # Verify backups are accessible
 ls -lh /root/backups/
 ```

1. **Document any issues** encountered during testing

2. **Update runbook** with lessons learned

---

## Post-Recovery Actions

1. **Investigate root cause** of the incident
2. **Document** what happened and how it was resolved
3. **Update** monitoring to detect similar issues earlier
4. **Review** backup procedures
5. **Send** post-mortem report (if needed)
6. **Schedule** follow-up to verify stability

---

## Contact Information for Recovery

- **DigitalOcean Support**: <https://cloud.digitalocean.com/support>
- **Certbot/Let's Encrypt**: <https://community.letsencrypt.org>
- **GitHub Support**: <https://support.github.com>

---

**Last Updated**: 2025-01-26
**Next Review Date**: 2025-04-26
