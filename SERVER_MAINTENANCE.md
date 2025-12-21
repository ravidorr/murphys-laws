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

# Check pending updates
ssh murphys-main 'apt list --upgradable 2>/dev/null | wc -l'

# Check if reboot is required
ssh murphys-main 'if [ -f /var/run/reboot-required ]; then echo "Reboot required"; cat /var/run/reboot-required.pkgs; else echo "No reboot required"; fi'
```

### 2. Run Updates

```bash
# Update package lists and upgrade all packages
ssh murphys-main 'sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y'
```

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

# Test web server response
ssh murphys-main 'curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost'

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
