# Murphy's Laws - Server Maintenance Guide

## Server Inventory

### 1. Murphy's Main Server
- **Host Alias:** `murphys-main` or `murphys`
- **Hostname:** murphys-laws.com
- **IP:** Resolved via DNS
- **OS:** Ubuntu 24.04.3 LTS
- **Services:** Nginx, PM2, Node.js API server
- **User:** ravidor

### 2. n8n Automation Server
- **Host Alias:** `murphys-n8n`
- **Hostname:** 45.55.74.28
- **OS:** Ubuntu 24.04.3 LTS
- **Services:** n8n (Docker container)
- **User:** ravidor

## SSH Access

All servers use the SSH config file at `~/.ssh/config`. To connect:

```bash
# Main server
ssh murphys-main

# n8n server
ssh murphys-n8n
```

## Murphy's Main Server - Update Procedure

### 1. Check System Status

```bash
# Check OS and kernel version
ssh murphys-main 'uname -a && cat /etc/os-release | head -n 3'

# Refresh package metadata, then list everything pending
ssh murphys-main 'sudo apt-get update -qq && apt list --upgradable 2>/dev/null'

# How many of those are security updates? (this is the one that matters)
ssh murphys-main 'apt list --upgradable 2>/dev/null | grep -Ei "security|esm" | wc -l'

# Check if reboot is required, and which package(s) caused it
ssh murphys-main 'if [ -f /var/run/reboot-required ]; then echo "Reboot required:"; cat /var/run/reboot-required.pkgs; else echo "No reboot required"; fi'
```

#### Decision rule: do we need to patch right now?

| Signal | Action |
|---|---|
| Security-update count > 0 | Patch within the next maintenance window. |
| Security-update count = 0, only routine updates pending | Defer. Roll into the next monthly patch cycle. |
| `reboot-required.pkgs` contains `linux-image-*` | The pending kernel update only takes effect on reboot, so schedule one. |
| `reboot-required.pkgs` contains only userspace daemons (e.g. `libssl`, `dbus`) | Often resolvable with `systemctl restart` of affected services instead of a full reboot. |

The status-report email's "17 pending updates" figure alone is **not** a signal: it conflates routine updates with security updates. Always check the security count and the reboot reason before acting.

### 2. Run Updates

```bash
# Take a fresh database snapshot before patching
ssh murphys-main 'sudo /usr/local/bin/backup-murphys-db.sh' \
  || ssh murphys-main 'cp /var/lib/murphys/murphys.db /var/backups/murphys/murphys_$(date +%Y%m%d_%H%M%S)_pre-patch.db'

# Update package lists and upgrade all packages
ssh murphys-main 'sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y'
```

> The first line tries the project's existing backup script if present; otherwise falls back to a manual copy. Confirm the actual path/script name on the server and replace as needed before running.

### 3. Reboot (if required)

```bash
# Reboot the server
ssh murphys-main 'sudo reboot'

# Wait 30 seconds for reboot
sleep 30
```

### 4. Verify Services After Reboot

```bash
# Check uptime and kernel version
ssh murphys-main 'uptime && echo "---" && uname -r && echo "---" && systemctl is-system-running'

# Verify no reboot is required
ssh murphys-main 'if [ -f /var/run/reboot-required ]; then echo "Reboot still required"; else echo "No reboot required - system is up to date!"; fi'

# Check Nginx status
ssh murphys-main 'systemctl status nginx --no-pager -l | head -n 10'

# Check Node.js processes
ssh murphys-main 'ps aux | grep -E "node|pm2" | grep -v grep'

# Check pm2 (runs as root via pm2-root.service; plain `sudo pm2` fails because pm2
# lives under /root/.nvm and sudo does not load root's login shell)
ssh murphys-main 'systemctl status pm2-root.service --no-pager -l | head -n 12'
ssh murphys-main 'sudo -i pm2 list'

# Confirm the API is listening on its loopback port
ssh murphys-main 'ss -tln | grep ":8787"'

# Test the API directly (bypasses nginx) and through nginx via the real hostname.
# Do NOT curl http://localhost: the bare vhost does not match murphys-laws.com and
# returns 404 even when the site is healthy.
ssh murphys-main 'curl -s -o /dev/null -w "API /api/health: %{http_code} %{time_total}s\n" http://127.0.0.1:8787/api/health'
ssh murphys-main 'curl -sI -o /dev/null -w "Public  /        : %{http_code} %{time_total}s\n" https://murphys-laws.com/'

# Check disk and memory
ssh murphys-main 'df -h / && echo "---" && free -h'
```

## n8n Server - Update Procedure

### 1. Check Current Version

```bash
# Check if n8n container is running
ssh murphys-n8n 'sudo docker ps | grep n8n'

# Check current n8n version
ssh murphys-n8n 'sudo docker exec n8n-n8n-1 n8n --version'

# Check Docker image creation date
ssh murphys-n8n 'sudo docker image inspect n8nio/n8n:latest --format="{{.Created}}"'
```

### 2. Update n8n

```bash
# Navigate to docker-compose directory and update
ssh murphys-n8n 'cd /opt/n8n && sudo docker compose pull && sudo docker compose up -d'

# Alternative: Pull and recreate in one command
ssh murphys-n8n 'cd /opt/n8n && sudo docker compose up -d --pull always'
```

### 3. Verify Update

```bash
# Wait for n8n to start
sleep 10

# Check container status
ssh murphys-n8n 'sudo docker ps --filter name=n8n-n8n-1 --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'

# Check new version
ssh murphys-n8n 'sudo docker exec n8n-n8n-1 n8n --version'

# Test web interface
ssh murphys-n8n 'curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:5678'
```

### 4. View n8n Logs (if needed)

```bash
# View recent logs
ssh murphys-n8n 'sudo docker logs n8n-n8n-1 --tail 50'

# Follow logs in real-time
ssh murphys-n8n 'sudo docker logs n8n-n8n-1 -f'
```

## n8n Configuration

The n8n service is configured via Docker Compose:

- **Config file:** `/opt/n8n/docker-compose.yml`
- **Environment file:** `/opt/n8n/.env`
- **Data volume:** `n8n_data` (mapped to `/home/node/.n8n` in container)
- **Database:** SQLite with vacuum on startup
- **Port:** 127.0.0.1:5678 (localhost only)

## Automated Security Updates (unattended-upgrades)

To stop the daily status email's "pending updates" count from being a manual decision, configure `unattended-upgrades` on the main server to apply **security updates only**, automatically. Kernel-triggered reboots stay manual.

### 1. Install and enable

```bash
ssh murphys-main 'sudo apt-get install -y unattended-upgrades apt-listchanges'
ssh murphys-main 'sudo dpkg-reconfigure -f noninteractive unattended-upgrades'
```

### 2. Configure the policy

Write `/etc/apt/apt.conf.d/52unattended-upgrades-local` (a higher-numbered file overrides the package default, so we never edit `50unattended-upgrades` directly):

```text
// Apply only security pockets. Explicitly leave -updates, -proposed, and -backports off.
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Never auto-reboot; the daily report surfaces reboot-required and we patch + reboot deliberately.
Unattended-Upgrade::Automatic-Reboot "false";

// Clean up old kernels/packages so /boot doesn't fill up.
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// If a package upgrade fails, retry once on the next run rather than blocking forever.
Unattended-Upgrade::MinimalSteps "true";

// Mail the operator on failure only (set this to a real address or leave unset to use logs).
// Unattended-Upgrade::Mail "ops@murphys-laws.com";
// Unattended-Upgrade::MailReport "on-change";
```

And `/etc/apt/apt.conf.d/20auto-upgrades` (this is what the timer reads):

```text
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
```

### 3. Verify it runs

```bash
# Dry-run: show what unattended-upgrades would install on the next pass
ssh murphys-main 'sudo unattended-upgrade --dry-run --debug 2>&1 | tail -n 40'

# Confirm the systemd timer is active
ssh murphys-main 'systemctl list-timers apt-daily-upgrade.timer --no-pager'

# Inspect the most recent run
ssh murphys-main 'sudo tail -n 50 /var/log/unattended-upgrades/unattended-upgrades.log'
```

### What this changes about the daily status email

After this is in place, the report's "Pending Updates: N" line is mostly **non-security** updates (e.g. `-updates` pocket). The signals that still demand action are unchanged:

- `Reboot Required: YES` with a kernel package in `reboot-required.pkgs` → schedule a reboot.
- A non-zero security count that has stayed > 0 for multiple days → unattended-upgrades is failing; check the log above.

## Quick Reference Commands

### General System Info

```bash
# Check system uptime
ssh <host> 'uptime'

# Check disk usage
ssh <host> 'df -h'

# Check memory usage
ssh <host> 'free -h'

# Check running processes
ssh <host> 'ps aux | grep <service>'
```

### Docker Commands (for n8n)

```bash
# List all containers
ssh murphys-n8n 'sudo docker ps -a'

# Stop n8n container
ssh murphys-n8n 'cd /opt/n8n && sudo docker compose stop'

# Start n8n container
ssh murphys-n8n 'cd /opt/n8n && sudo docker compose start'

# Restart n8n container
ssh murphys-n8n 'cd /opt/n8n && sudo docker compose restart'

# View Docker Compose config
ssh murphys-n8n 'sudo cat /opt/n8n/docker-compose.yml'
```

## Troubleshooting

### Main Server Issues

**Service not starting after reboot:**
```bash
ssh murphys-main 'sudo systemctl status <service-name>'
ssh murphys-main 'sudo journalctl -u <service-name> -n 50'
```

**PM2 processes not running:**
```bash
ssh murphys-main 'pm2 list'
ssh murphys-main 'pm2 restart all'
ssh murphys-main 'pm2 logs'
```

### n8n Issues

**Container not starting:**
```bash
# Check Docker logs
ssh murphys-n8n 'sudo docker logs n8n-n8n-1'

# Check if port is in use
ssh murphys-n8n 'sudo netstat -tulpn | grep 5678'

# Restart Docker service
ssh murphys-n8n 'sudo systemctl restart docker'
```

**Database issues:**
```bash
# The database is in the n8n_data volume
# To inspect the volume
ssh murphys-n8n 'sudo docker volume inspect n8n_data'

# To back up the data volume
ssh murphys-n8n 'sudo docker run --rm -v n8n_data:/data -v $(pwd):/backup ubuntu tar czf /backup/n8n-backup-$(date +%Y%m%d).tar.gz /data'
```

## Update History

| Date | Server | Action | Old Version | New Version |
|------|--------|--------|-------------|-------------|
| 2025-12-19 | murphys-main | System updates + reboot | 6.8.0-88 kernel | 6.8.0-90 kernel |
| 2025-12-19 | murphys-n8n | n8n major version upgrade | 1.121.3 | 2.0.3 |
| 2026-04-26 | murphys-main | Reboot only (kernel package already installed; 0 security updates pending; 17 routine updates deferred) | 6.8.0-107 kernel | 6.8.0-110 kernel |

## Best Practices

1. **Always check current status before updates** - Know what version you're running and what services are active
2. **Read update notes** - For major version upgrades (like n8n 1.x → 2.x), check release notes for breaking changes
3. **Backup before major updates** - Especially for n8n data volume before major version upgrades
4. **Verify after updates** - Don't assume success, always verify services are running correctly
5. **Monitor logs** - Check logs for any errors or warnings after updates
6. **Update during low-traffic periods** - Schedule updates when user impact is minimal
7. **Keep this document updated** - Add any new procedures or lessons learned

## Emergency Contacts

- **Hosting Provider:** DigitalOcean
- **SSH Keys:** `~/.ssh/id_ed25519_digitalocean`

## Notes

- Ubuntu uses phased updates, so not all available updates may install immediately
- The n8n container uses SQLite for storage, which is vacuumed on startup
- n8n is only accessible on localhost (127.0.0.1:5678) - likely proxied through Nginx on main server
