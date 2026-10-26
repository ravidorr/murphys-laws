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

# Where alerts go, first one set wins: HEALTH_CHECK_EMAIL_TO, ALERT_EMAIL (shared by all the monitoring
# scripts), then EMAIL_TO (the admin address the server already uses). There is no built-in address:
# with none set, health-check.ts and health-check.sh still run their checks but warn and skip the email.
EMAIL_TO=admin@example.com
# ALERT_EMAIL=ops@example.com
# HEALTH_CHECK_EMAIL_TO=alerts@example.com

# Optional overrides
HEALTH_CHECK_FRONTEND_URL=https://murphys-laws.com
HEALTH_CHECK_API_URL=https://murphys-laws.com/api/health
EMAIL_FROM=noreply@murphys-laws.com
```

In production the deploy workflow writes `EMAIL_TO`, `ALERT_EMAIL` and `HEALTH_CHECK_EMAIL_TO` to the
server's `backend/.env` (the deploy does not write a root `.env`) from the repository secrets of the same
names. The optional `ALERT_EMAIL` and `HEALTH_CHECK_EMAIL_TO` are left out when their secrets are not set, and
the deploy stops, before overwriting the file, when neither `ALERT_EMAIL` nor `EMAIL_TO` is set, because the
monitoring scripts would then have nowhere to send alerts.

Cron gives the scripts no environment, so they read the recipient from these files, in this order: the file
named by `ALERT_ENV_FILE` (the one durable manual override: a separate file the deploy never rewrites, and
the variable must be exported to the cron job), then `/root/murphys-laws/.env`, then
`/root/murphys-laws/backend/.env`. The first file with a value wins. `health-check.ts` reads the same files in
the same order as `health-check.sh` and the daily report.

Which script honors which variable:

- `health-check.ts` and `health-check.sh`, when run by themselves, use `HEALTH_CHECK_EMAIL_TO`, then
  `ALERT_EMAIL`, then `EMAIL_TO`.
- Every other monitoring script uses `ALERT_EMAIL`, then `EMAIL_TO`, and ignores `HEALTH_CHECK_EMAIL_TO`. That
  includes every email `health-monitor.sh` sends: in production it runs `health-check.ts --no-email` and does
  all the emailing itself, so `HEALTH_CHECK_EMAIL_TO` does not apply to production alerts. The others are
  `ssl-monitor.sh`, `cost-optimization-report.sh`, `test-backup-restore.sh` and the daily report.
  (`vulnerability-scanner.sh` sends no email; the daily report includes its output.)

Unlike the API, which falls back to `admin@murphys-laws.com` when `EMAIL_TO` is empty, the monitoring scripts
have no built-in address, so with none of the three set they send nothing. They do not do that quietly:
the daily report stops with an error (it runs once a day, so that error shows up daily), `health-check.ts`
still runs its checks but prints a warning and `ALERT EMAIL NOT SENT` when a check fails, and the shell
scripts write the warning to stderr and to syslog (`logger -t
murphys-alerts`) and log that nothing was sent: `ALERT NOT SENT (reason)` in `health-check.sh`,
`ssl-monitor.sh` and `health-monitor.sh`, and `Report NOT emailed (reason)` in `test-backup-restore.sh` and
`cost-optimization-report.sh` (which prints it to stderr only). The shell scripts
load `alert-email.sh` from beside themselves, or else from the repo copy under `backend/scripts/`; one that
finds neither stops with `FATAL: cannot load alert-email.sh`.

A recipient setting may hold several addresses as a comma-separated list (`ops@example.com, oncall@example.com`).
The shell scripts and `health-check.ts` send to each one; the shell scripts check every address and drop the
message, with a warning, if any is invalid. (The daily report sends through `sendmail -t` and is meant for a
single address.)

`mail` exiting 0 only means the local mail system accepted the message. If that system is down or cannot
deliver, the message can still queue or bounce after `ALERT SENT` was logged, so check the mail queue
(`mailq`) if alerts you expect do not arrive.

`health-check.ts` exit codes: `0` healthy, `1` a check failed, `2` the alert recipient is invalid (nothing was
checked), `3` it passed with warnings that were not emailed (`--no-email`, or the email could not be sent).
Missing SMTP settings or a missing recipient no longer stop it: the checks still run and only the email is
skipped (with a warning).

`health-monitor.sh` runs it through `tsx` every 5 minutes with `--no-email`, and is the only sender in
production, so a run sends at most one email and SMTP settings cannot stop the monitoring. It counts only exit
code `1` towards a restart. Exit code `3` is healthy but reported; any other code (`2`, `126` or `127` when
`tsx`, `npx` or `node` cannot be started, `137` when the check is killed) means the check could not run,
which says nothing about the site: it leaves the failure count alone, restarts nothing and does not ping the
dead-man switch. What it emails, and how often:

- First failure: "Health Check Failed (1/3)". If that mail could not be sent, the next failing run tries
  again (so an outage that ends before the restart is still reported); once it is delivered, further failures
  before the restart send nothing.
- Third failure: the restart mail, then "CRITICAL" if the retest still fails.
- "Health Check Could Not Run": at most once per exit code every 6 hours.
- "Performance Degraded" (slow responses): at most once a day.
- A healthy run clears these cooldowns and the "outage already reported" mark, so a new problem is reported
  at once. A mail that could not be sent
  does not start a cooldown. The cooldown files are in `/var/tmp/health-monitor-alerts/`. Under cron's minimal `PATH`, `tsx` starts with the `node` found on that `PATH`
(normally `/usr/bin/node`, not an nvm one), so confirm `/usr/bin/node --version` on the server.

So that cron notices an alert or report that could not be sent, the shell scripts that send mail
(`health-check.sh`, `ssl-monitor.sh`, `health-monitor.sh`, `cost-optimization-report.sh`,
`test-backup-restore.sh`) exit with code `2` when the run would otherwise have succeeded but nothing could be
delivered (no recipient, an invalid one, or `mail` failing). A run that failed for its own reasons keeps its
own exit code. A suppressed repeat alert (cooldown or once a day) is not a delivery failure.

### Sending production alerts to a different address

To redirect **all** monitoring email, set the repository secret `ALERT_EMAIL`. To redirect only the health
check's own emails when `health-check.ts` or `health-check.sh` runs by itself, set `HEALTH_CHECK_EMAIL_TO`
instead; it does not change the production alerts from `health-monitor.sh`, which go to `ALERT_EMAIL`, then
`EMAIL_TO`. Either use GitHub (repository **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**) or the CLI, which prompts for the value so it stays out of your
shell history:

```bash
gh secret set ALERT_EMAIL --repo ravidorr/murphys-laws
```

```bash
gh secret set HEALTH_CHECK_EMAIL_TO --repo ravidorr/murphys-laws
```

The secret only reaches the server on the next deploy (a push to `main`, or re-run the latest
"Deploy to Production" run from the Actions tab). To confirm, run `gh secret list --repo ravidorr/murphys-laws`
(it lists names only), then wait for the next failure alert or trigger one with a deliberately wrong
`HEALTH_CHECK_API_URL`.

To go back to the next address in the order, delete the secret and deploy again:

```bash
gh secret delete ALERT_EMAIL --repo ravidorr/murphys-laws
```

An empty secret is treated as not set, so alerts then go to the next address in the order.

## Usage

### Manual Run

```bash
npx tsx backend/scripts/health-check.ts
```

### Exit Codes

- `0` - All health checks passed
- `1` - One or more health checks failed (email alert sent when SMTP and a recipient are configured)
- `2` - The alert recipient is invalid, so no check ran
- `3` - Passed with warnings that were not emailed (`--no-email`, or the email could not be sent)

Add `--no-email` to report by exit code and output only (this is how `health-monitor.sh` runs it).

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
npx tsx backend/scripts/health-check.ts
```

Test with custom URLs:

```bash
HEALTH_CHECK_FRONTEND_URL=http://localhost:5175 \
HEALTH_CHECK_API_URL=http://localhost:5175/api/health \
npx tsx backend/scripts/health-check.ts
```

## Troubleshooting

### "SMTP not configured" warning

The checks still run, but no alert email is sent. Set `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` in your `.env`
file to get emails from `health-check.ts` itself. (`health-monitor.sh` does not need them: it sends its mail
through the local `mail` command.)

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

**Location**: `backend/scripts/health-check.ts`

**Checks Performed**:
1. Frontend: GET request to main URL, expects 200 status and `text/html` content-type
2. API: GET request to `/api/health`, expects 200 status and `{"ok": true}` response

**Email Provider Examples**:
- Gmail: Use App Passwords (not regular password)
- SendGrid: Use API key as password
- AWS SES: Use SMTP credentials from SES console
- Mailgun: Use SMTP credentials from Mailgun settings
