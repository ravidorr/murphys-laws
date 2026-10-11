# Operational Metrics Schema

Hourly collectors write CSV files under `/var/log/performance-metrics/` (configurable via `METRICS_DIR`).

## File naming

- `metrics-<role>-<YYYY-MM>.csv` where `role` is `main-app` (legacy `n8n` files may remain from retired hosts).
- Legacy files named `metrics-<YYYY-MM>.csv` (no role) are treated as `main-app`.

## CSV header (row 1)

| Column | Description |
|--------|-------------|
| `timestamp` | UTC ISO-8601 (`YYYY-MM-DDTHH:MM:SSZ`) |
| `role` | `main-app` (legacy collectors may have written `n8n`) |
| `frontend_response_ms` | HTTPS GET homepage; empty if skipped or failed |
| `api_response_ms` | HTTPS GET health/API; empty if skipped or failed |
| `db_query_ms` | From API health JSON `dbQueryTime`; empty if unavailable |
| `memory_used_mb` | `MemTotal - MemAvailable` from `free -m` |
| `memory_available_mb` | `MemAvailable` from `free -m` |
| `memory_pressure_percent` | `100 * (1 - MemAvailable/MemTotal)` |
| `swap_used_mb` | Swap used |
| `swap_in` | `/proc/vmstat` pswpin since boot (cumulative swap pages in) |
| `swap_out` | `/proc/vmstat` pswpout since boot (cumulative swap pages out) |
| `cpu_cores` | `nproc` |
| `cpu_load_1m` | Load average 1m |
| `cpu_load_5m` | Load average 5m |
| `cpu_load_15m` | Load average 15m |
| `cpu_normalized_percent` | `100 * load_1m / cpu_cores` |
| `disk_used_gb` | Root filesystem used |
| `disk_available_gb` | Root filesystem available |
| `disk_percent` | Root filesystem use percent |
| `db_size_mb` | SQLite size (main-app only) |
| `pm2_api_restarts` | PM2 restart counter for API process |
| `pm2_api_uptime_hours` | Hours since PM2 process start |
| `pm2_api_rss_mb` | PM2 API RSS |
| `pm2_api_memory_limit_mb` | PM2 `max_memory_restart` at collection time (env override if PM2 unavailable) |
| `collector_errors` | Semicolon-separated error tokens, or empty |

## Roles

### main-app

Set via `backend/config/operational-metrics-main-app.env` (see `.example`).

- Probes `FRONTEND_URL` and `API_URL`.
- Reads `DB_PATH`.
- Records PM2 process `murphys-api` only (frontend is served by Nginx).

## Capacity decisions

Monthly cost reports call `analyze-capacity-metrics.ts`, which requires ~30 days of hourly samples before sizing recommendations. Decisions are one of:

- `Collecting baseline`
- `No change justified`
- `Manual review candidate`

Automatic droplet resize or consolidation is never performed from report output.

## Infrastructure inventory

Monthly cost reports read `$REPO_ROOT/backend/config/infrastructure-inventory.json` (not committed; copy from `infrastructure-inventory.json.example` on the droplet).

Set `"verified": true` only after confirming `monthly_usd_estimate` for **every** `provider` in the file (for example DigitalOcean for the application droplet and droplet backups, Network Solutions for domain registration). The report treats the file-wide flag as verification of the entire inventory, not individual line items.

## Baseline rollout (30 days)

1. Deploy updated scripts via `npm run deploy` or the GitHub deploy workflow.
2. On the main droplet, copy `backend/config/operational-metrics-main-app.env.example` to `/etc/murphys-laws/operational-metrics.env` if not already present.
3. Confirm hourly cron: `0 * * * * /usr/local/bin/performance-tracker.sh >> /var/log/performance-tracker.log 2>&1`
4. Leave droplet size unchanged for 30 days.
5. Review the monthly cost section in the daily email on the 1st; expect `Collecting baseline` until coverage thresholds are met.
