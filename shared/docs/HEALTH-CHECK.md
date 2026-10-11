# Health Check Script

Monitors the health of both the Murphy's Laws frontend and API servers and sends email alerts when failures are detected.

## Features

- Checks frontend server (HTML response)
- Checks API server (`/api/health` endpoint)
- Sends email alerts on failures
- 10-second timeout per check
- Detailed error reporting
- HTML email formatting

## Requirements

SMTP credentials must be configured in your `.env` file:

```env
# Required for health check emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional overrides
HEALTH_CHECK_FRONTEND_URL=https://murphys-laws.com
HEALTH_CHECK_API_URL=https://murphys-laws.com/api/health
HEALTH_CHECK_EMAIL_TO=ravidor@gmail.com
EMAIL_FROM=noreply@murphys-laws.com
```

## Usage

### Manual Run

```bash
npm run health-check
```

### Exit Codes

- `0` - All health checks passed
- `1` - One or more health checks failed (email alert sent)

## Production scheduling

On the main application server, run the health check from cron or
`/usr/local/bin/health-monitor.sh` (see `shared/docs/DEPLOY-MONITORING.md`).
n8n is not used for monitoring.

## Monitoring Recommendations

- **Production**: Run every 5 minutes
- **Development**: Run every 15-30 minutes
- **Critical periods**: Run every 1-2 minutes

## Alert Email Format

When a failure occurs, you'll receive an email with:
- Subject: `[Murphy's Laws] Health Check Failed`
- Details of which checks failed (Frontend, API, or both)
- Error messages
- Timestamp
- URLs that were checked

## Testing Locally

Test the health check with production URLs:

```bash
npm run health-check
```

Test with custom URLs:

```bash
HEALTH_CHECK_FRONTEND_URL=http://localhost:5175 \
HEALTH_CHECK_API_URL=http://localhost:5175/api/health \
npm run health-check
```

## Troubleshooting

### "SMTP not configured" Error

Make sure your `.env` file has `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` set.

### Timeouts

The script has a 10-second timeout per check. If checks consistently timeout:
- Check server response times
- Verify network connectivity
- Consider increasing timeout in the script

### Email Not Received

- Check spam folder
- Verify SMTP credentials
- Test SMTP connection manually
- Check server mail logs for delivery errors

## Script Details

**Location**: `backend/scripts/health-check.mjs`

**Checks Performed**:
1. Frontend: GET request to main URL, expects 200 status and `text/html` content-type
2. API: GET request to `/api/health`, expects 200 status and `{"ok": true}` response

**Email Provider Examples**:
- Gmail: Use App Passwords (not regular password)
- SendGrid: Use API key as password
- AWS SES: Use SMTP credentials from SES console
- Mailgun: Use SMTP credentials from Mailgun settings
