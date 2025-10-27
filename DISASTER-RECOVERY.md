# Disaster Recovery Runbook

This document provides step-by-step procedures for recovering from various disaster scenarios for the Murphy's Laws infrastructure.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [Backup Locations](#backup-locations)
3. [Recovery Scenarios](#recovery-scenarios)
4. [Complete Server Rebuild](#complete-server-rebuild)
5. [Database Recovery](#database-recovery)
6. [SSL Certificate Recovery](#ssl-certificate-recovery)
7. [Service Restoration Checklist](#service-restoration-checklist)

---

## Emergency Contacts

- **Primary Administrator**: ravidor@gmail.com
- **Domain Registrar**: (Add registrar info)
- **Hosting Provider**: DigitalOcean
  - Main Droplet IP: 167.99.53.90
  - n8n Droplet IP: 45.55.74.28
- **DNS Provider**: DigitalOcean
- **Email Services**:
  - Forwarding: ImprovMX (improvmx.com)
  - SMTP: smtp2go.com

---

## Backup Locations

### Main Application Droplet (167.99.53.90)

**Local Backups**: `/root/backups/`
- Database: `murphys-YYYY-MM-DD-HHMMSS.db`
- Environment: `.env-YYYY-MM-DD-HHMMSS`
- Application: `murphys-laws-YYYY-MM-DD-HHMMSS.tar.gz`
- Retention: 30 days
- Schedule: Daily at 2:00 AM UTC

**Backup Script**: `/usr/local/bin/backup-murphys.sh`

### n8n Automation Droplet (45.55.74.28)

**Local Backups**: `/root/backups/`
- Database: `n8n-YYYY-MM-DD-HHMMSS.db`
- Configuration: `n8n-config-YYYY-MM-DD-HHMMSS.tar.gz`
- Retention: 30 days
- Schedule: Daily at 2:00 AM UTC

**GitHub Backup**: https://github.com/ravidorr/n8n-workflows (Private)
- Individual workflow JSON files
- Version controlled
- Unlimited retention
- Automated push: Daily at 2:00 AM UTC

**Backup Script**: `/usr/local/bin/backup-n8n.sh`

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

2. **Verify database is corrupted**:
   ```bash
   sqlite3 /root/murphys-laws/murphys.db "PRAGMA integrity_check;"
   ```

3. **Find latest backup**:
   ```bash
   ls -lt /root/backups/*.db | head -1
   ```

4. **Restore database**:
   ```bash
   cp /root/backups/murphys-YYYY-MM-DD-HHMMSS.db /root/murphys-laws/murphys.db
   ```

5. **Verify restored database**:
   ```bash
   sqlite3 /root/murphys-laws/murphys.db "PRAGMA integrity_check;"
   sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;"
   ```

6. **Restart services**:
   ```bash
   pm2 restart all
   ```

7. **Verify application**:
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

2. **Initial server setup**:
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

3. **Security hardening**:
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

4. **Install Node.js (via nvm)**:
   ```bash
   sudo -u ravidor bash << 'EOF'
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install 22
   nvm use 22
   npm install -g pm2
   EOF
   ```

5. **Clone repository**:
   ```bash
   cd /root
   git clone https://github.com/ravidorr/murphys-laws.git
   cd murphys-laws
   ```

6. **Restore database from backup**:

   If you have access to old droplet:
   ```bash
   scp ravidor@167.99.53.90:/root/backups/murphys-*.db /root/murphys-laws/murphys.db
   ```

   If old droplet is gone, you'll need to rebuild from source:
   ```bash
   npm ci
   npm run db:rebuild
   ```

7. **Configure environment**:
   ```bash
   cat > .env << 'EOF'
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=alerts@murphys-laws.com
EOF
   ```

8. **Build application**:
   ```bash
   npm ci
   npm run build
   ```

9. **Install and start PM2**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```

10. **Configure nginx**:
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

11. **Configure SSL certificate**:
    ```bash
    certbot --nginx -d murphys-laws.com -d www.murphys-laws.com \
            --non-interactive --agree-tos --email ravidor@gmail.com
    ```

12. **Install monitoring scripts**:
    ```bash
    # Copy scripts
    cp scripts/enhanced-daily-status-report.sh /usr/local/bin/daily-status-report.sh
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

    # Backup (daily at 2 AM)
    0 2 * * * /usr/local/bin/backup-murphys.sh
    ```

13. **Update DNS**:
    - Update A record for murphys-laws.com to <NEW_IP>
    - Update A record for www.murphys-laws.com to <NEW_IP>
    - Wait for DNS propagation (5-30 minutes)

14. **Verify services**:
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

### Scenario 3: n8n Droplet Failure

**Recovery Steps**:

1. **Create new droplet** (same as main droplet steps 1-3)

2. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   systemctl enable docker
   systemctl start docker
   ```

3. **Create n8n directory**:
   ```bash
   mkdir -p /var/lib/docker/volumes/n8n_data/_data
   ```

4. **Restore workflows from GitHub**:
   ```bash
   cd /home/deploy
   git clone https://github.com/ravidorr/n8n-workflows.git
   ```

5. **Start n8n**:
   ```bash
   docker run -d \
     --name n8n \
     --restart unless-stopped \
     -p 127.0.0.1:5678:5678 \
     -v n8n_data:/home/node/.n8n \
     -e N8N_HOST=n8n.murphys-laws.com \
     -e N8N_PROTOCOL=https \
     n8nio/n8n
   ```

6. **Configure nginx for n8n**:
   ```bash
   # Create nginx config
   cat > /etc/nginx/sites-available/n8n << 'EOF'
server {
    server_name n8n.murphys-laws.com;

    location / {
        proxy_pass http://127.0.0.1:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 80;
}
EOF

   ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

7. **Configure SSL**:
   ```bash
   certbot --nginx -d n8n.murphys-laws.com \
           --non-interactive --agree-tos --email ravidor@gmail.com
   ```

8. **Import workflows**:
   - Access n8n UI: https://n8n.murphys-laws.com
   - Import each workflow JSON from GitHub

9. **Install monitoring scripts**:
   (Same as main droplet, but use n8n-specific scripts)

10. **Update DNS**:
    - Update A record for n8n.murphys-laws.com to <NEW_IP>

**Expected Recovery Time**: 1-2 hours
**Data Loss**: Minimal (workflows backed up to GitHub)

---

### Scenario 4: SSL Certificate Expiration

**Symptoms**:
- Browser shows "Your connection is not private"
- SSL certificate expired warning

**Recovery Steps**:

1. **Check certificate status**:
   ```bash
   openssl x509 -enddate -noout -in /etc/letsencrypt/live/murphys-laws.com/cert.pem
   ```

2. **Renew certificate**:
   ```bash
   certbot renew --force-renewal
   ```

3. **Restart nginx**:
   ```bash
   systemctl restart nginx
   ```

4. **Verify renewal**:
   ```bash
   curl -vI https://murphys-laws.com 2>&1 | grep "expire date"
   ```

5. **Check auto-renewal is enabled**:
   ```bash
   systemctl status certbot.timer
   systemctl enable certbot.timer
   ```

**Expected Recovery Time**: 5 minutes
**Data Loss**: None

---

### Scenario 5: Application Not Responding

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

2. **Restart PM2 processes**:
   ```bash
   pm2 restart all
   ```

3. **If restart fails, check logs**:
   ```bash
   tail -100 /root/murphys-laws/logs/api-error.log
   tail -100 /root/murphys-laws/logs/frontend-error.log
   ```

4. **Check for port conflicts**:
   ```bash
   lsof -i :5175
   lsof -i :8787
   ```

5. **If needed, rebuild and redeploy**:
   ```bash
   cd /root/murphys-laws
   git pull
   npm ci
   npm run build
   pm2 restart all
   ```

6. **Verify health**:
   ```bash
   curl https://murphys-laws.com/api/health
   ```

**Expected Recovery Time**: 5-15 minutes
**Data Loss**: None

---

## Service Restoration Checklist

After any recovery, verify these services:

- [ ] Website loads: https://murphys-laws.com
- [ ] API responds: https://murphys-laws.com/api/health
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
- [ ] n8n workflows active (if applicable)

---

## Testing Disaster Recovery

**Recommended**: Test recovery procedures quarterly

1. **Test database restore**:
   ```bash
   # On development/staging environment
   cp /root/backups/murphys-latest.db /tmp/test-restore.db
   sqlite3 /tmp/test-restore.db "PRAGMA integrity_check;"
   ```

2. **Test backup retrieval**:
   ```bash
   # Verify backups are accessible
   ls -lh /root/backups/
   ```

3. **Document any issues** encountered during testing

4. **Update runbook** with lessons learned

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

- **DigitalOcean Support**: https://cloud.digitalocean.com/support
- **Certbot/Let's Encrypt**: https://community.letsencrypt.org
- **GitHub Support**: https://support.github.com

---

**Last Updated**: 2025-01-26
**Next Review Date**: 2025-04-26
