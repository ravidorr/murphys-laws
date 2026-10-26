# GitHub Secrets Configuration

The GitHub Actions deployment workflow requires the following secrets to be configured in your repository.

## Required Secrets

Navigate to: **GitHub Repository -> Settings -> Secrets and variables -> Actions -> Repository secrets**

### 1. SERVER_HOST
- **Value**: `167.99.53.90`
- **Description**: IP address of the main production droplet

### 2. SERVER_USER
- **Value**: `ravidor`
- **Description**: SSH username for connecting to the droplet

### 3. SSH_PRIVATE_KEY
- **Value**: Contents of `~/.ssh/id_ed25519_digitalocean` (private key)
- **Description**: SSH private key for authentication
- **How to get it**:
 ```bash
 cat ~/.ssh/id_ed25519_digitalocean
 ```
- **Format**: Should start with `-----BEGIN OPENSSH PRIVATE KEY-----` and end with `-----END OPENSSH PRIVATE KEY-----`
- **Important**: Copy the entire key including the header and footer lines

### 4. SMTP_HOST
- **Value**: Your SMTP server hostname (e.g., `mail.smtp2go.com`)
- **Description**: Email server for sending notifications

### 5. SMTP_PORT
- **Value**: SMTP port (usually `587` or `465`)
- **Description**: Email server port

### 6. SMTP_USER
- **Value**: Your SMTP username
- **Description**: Email server authentication username

### 7. SMTP_PASS
- **Value**: Your SMTP password
- **Description**: Email server authentication password

### 8. EMAIL_FROM
- **Value**: `alerts@murphys-laws.com` (or your preferred from address)
- **Description**: From address for system emails

### 9. EMAIL_TO
- **Value**: The admin address that should receive notices and monitoring email
- **Description**: Receives new-submission notices (the API falls back to `admin@murphys-laws.com` when it is empty). The monitoring scripts and the daily report also use it when `ALERT_EMAIL` is not set, and have no built-in fallback. The deploy therefore stops, before anything reaches the server, unless `ALERT_EMAIL` or `EMAIL_TO` is set (a blank or whitespace-only value counts as not set).

## Optional Secrets

An optional secret that is not set is left out of the server's `.env` (an empty value counts as not set everywhere).

### ALERT_EMAIL
- **Value**: An address for all monitoring email (health monitor, SSL monitor, cost report, backup restore test, daily report, health check). The shell scripts and the health check also accept several addresses as a comma-separated list.
- **Description**: Overrides `EMAIL_TO` for those scripts only

### HEALTH_CHECK_EMAIL_TO
- **Value**: An address for health-check alerts only
- **Description**: Overrides `ALERT_EMAIL` and `EMAIL_TO` for `health-check.ts` and `health-check.sh` when they run by themselves. It does not change production alerts: `health-monitor.sh` runs the check with `--no-email` and sends its own mail to `ALERT_EMAIL`, then `EMAIL_TO`. See `HEALTH-CHECK.md` for how to add and remove it.

## How to Add/Update Secrets

1. Go to your GitHub repository
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** -> **Actions**
4. Click **New repository secret** (or edit existing)
5. Enter the **Name** (exactly as shown above, case-sensitive)
6. Paste the **Value**
7. Click **Add secret** or **Update secret**

## Verify Configuration

After updating the secrets:

1. Make any small change and push to main branch
2. Go to **Actions** tab in GitHub
3. Watch the deployment workflow run
4. Check for success or failure
5. If it fails, click on the failed run to see detailed logs

## Current Status

The deployment is currently failing with:
```
ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain
```

This indicates the SSH_PRIVATE_KEY secret either:
- Is not set
- Contains the wrong key
- Is formatted incorrectly (missing headers/footers)

## Testing SSH Connection

To verify the key works before adding to GitHub:

```bash
# Test SSH connection with the key
ssh -i ~/.ssh/id_ed25519_digitalocean ravidor@167.99.53.90 "echo 'SSH connection successful'; hostname"
```

Should output:
```
SSH connection successful
nodejs-s-1vcpu-1gb-nyc3-01
```

---

**Last Updated**: 2025-10-26
