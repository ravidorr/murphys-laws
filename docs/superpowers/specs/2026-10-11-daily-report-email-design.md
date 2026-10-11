# Daily Status Report email: design spec for `renderHtmlReport()`

Target: `backend/scripts/render-daily-report.ts`. Presentation only. Do not change data collected, section order, or when sections appear. All dynamic values are HTML-escaped before interpolation (`${...}` below = escaped value or tone token).

## Constraints
Table layout, inline styles on td/span only, no margin on td, no border-radius, no flex/grid/media queries/JS/web fonts. One fluid layout for desktop and Gmail mobile. Keep the hidden preview div first in `<body>`. Plain-text part keeps the same order and `━━━` dividers.

## Tokens

| Token | Value |
|---|---|
| font | `Arial,Helvetica,sans-serif` (mono for commands: `'Courier New',Courier,monospace`) |
| ink | `#111827` |
| muted | `#4b5563` |
| rule / rule-strong | `#e5e7eb` (1px rows) / `#111827` (2px sections) |
| canvas / card | `#f3f4f6` / `#ffffff` |
| success | text `#15803d`, tint `#f0fdf4`, border `#bbf7d0` |
| warning | text `#a16207`, tint `#fefce8`, border `#fde68a` |
| critical | text `#b91c1c`, tint `#fef2f2`, border `#fecaca` |
| type | 22/28 title, 15/20 glance value, 14/20 body, 13/20 label, 12 caps, 11 sub-head; bold or normal only |
| spacing | card padding 20px, section gap 28px (margin on section table), row 8px vertical, callout 10-12px |

## Status states (glyph + border style, never color alone)

| State | Glyph | Treatment |
|---|---|---|
| Healthy | ✓ `&#10003;` | solid green border, `#f0fdf4` fill |
| Attention | `!` | solid amber border, `#fefce8` fill |
| Check failed / Unknown | ? | **dashed** amber border, `#fefce8` (glance) or `#f3f4f6` (callout) fill |
| Down | ✕ `&#10005;` | solid `#b91c1c` fill, white glyph |

## Patterns

### A. Shell
```html
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#f3f4f6;"><div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f3f4f6"><tr><td align="center" style="padding:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff" style="max-width:640px;background:#ffffff;border-top:4px solid #111827;"><tr><td style="padding:20px;">…sections…</td></tr></table></td></tr></table></body>
```

### B. Header
```html
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#4b5563;padding:0 0 4px 0;">Murphy's Laws Server</td></tr><tr><td style="font-size:22px;line-height:28px;font-weight:bold;color:#111827;">Daily Status Report</td></tr><tr><td style="font-size:14px;color:#4b5563;padding:2px 0 0 0;">${date}</td></tr></table>
```

### C. Glyph square (At a glance)
```html
<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px dashed #a16207;background:#fefce8;color:#a16207;font-size:14px;font-weight:bold;">?</span>
```
Attention: `border:1px solid #a16207`, glyph `!`, 14px. Healthy: green values, `&#10003;`. Down: `border:1px solid #b91c1c;background:#b91c1c;color:#ffffff`, `&#10005;`.

### D. At a glance (one row per existing item, same order)
```html
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0 0 0;"><tr><td colspan="3" style="padding:10px 0 6px 0;border-top:2px solid #111827;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#111827;">At a glance</td></tr>
<tr><td width="1%" style="width:1%;white-space:nowrap;padding:10px 8px 10px 0;border-top:1px solid #e5e7eb;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#4b5563;vertical-align:middle;">${label}</td>
<td width="1%" style="width:1%;white-space:nowrap;padding:10px 8px 10px 0;border-top:1px solid #e5e7eb;vertical-align:middle;">${glyphSpan}</td>
<td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:15px;line-height:20px;font-weight:bold;color:${toneColor};vertical-align:middle;">${value}</td></tr></table>
```

### E. Section header (one table per section)
```html
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0 0;"><tr><td colspan="2" style="padding:10px 0 6px 0;border-top:2px solid #111827;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#111827;">${title}<span style="font-weight:normal;color:#4b5563;"> (${suffix})</span></td></tr>…rows…</table>
```
Suffix span only when the title has a parenthetical (e.g. "Last 30 Days").

### F. Label / value row
```html
<tr><td width="1%" style="width:1%;white-space:nowrap;padding:8px 12px 8px 0;border-top:1px solid #e5e7eb;font-size:13px;line-height:20px;color:#4b5563;vertical-align:top;">${label}</td>
<td style="width:99%;padding:8px 0;border-top:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;vertical-align:top;word-break:break-word;">${value}</td></tr>
```
Timestamp suffix: `<span style="font-size:12px;color:#4b5563;">(${ts})</span>`. Flagged value: `color:#a16207;font-weight:bold;` with `!` prefix. Bold value (no color change) only for cost, capacity decision, next review.

### G. Bullet row
```html
<tr><td width="1%" style="width:1%;white-space:nowrap;padding:6px 8px 6px 0;font-size:14px;line-height:20px;color:#4b5563;vertical-align:top;">&bull;</td>
<td style="width:99%;padding:6px 0;font-size:14px;line-height:20px;color:#111827;vertical-align:top;word-break:break-word;">${text}</td></tr>
```
Passing results: marker `&#10003;` with `color:#15803d;font-weight:bold;`.

### H. Callout
```html
<tr><td colspan="2" style="padding:8px 0 4px 0;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td style="padding:10px 12px;background:#fefce8;border:1px solid #fde68a;font-size:14px;line-height:20px;color:#111827;"><span style="color:#a16207;font-weight:bold;">! </span>${text}</td></tr></table></td></tr>
```
Check failed: `background:#f3f4f6;border:1px dashed #a16207`, prefix `?`. Critical: `#fef2f2` / `#fecaca` / `#b91c1c` / `&#10005;`.

### I. Sub-heading row (static labels, cost report: "Resources", "Decision")
```html
<tr><td colspan="2" style="padding:16px 0 4px 0;font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#4b5563;">${label}</td></tr>
```

### J. Command block
```html
<tr><td colspan="2"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e7eb;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:18px;color:#111827;word-break:break-all;">${cmd}</td></tr></table></td></tr>
```

### K. Closing row
Row F with `border-top:2px solid #111827` on both tds and bold value (used for "Next review").

## Per-section layout (order unchanged)
- **At a glance:** API → `?` dashed, "Unknown". Security → `!`, "2 path traversal attempts detected".
- **System Status:** F rows (Uptime, Memory).
- **PM2 Applications:** "Unable to retrieve PM2 status" as check-failed callout (H).
- **Traffic & Bandwidth:** F rows; "404: 2 requests" as F with `•` + code in the label cell; Top URL value uses `word-break:break-word`.
- **Peak Resource Usage (Last 30 Days):** F rows with timestamp suffix; CPU row flagged amber when a tone is supplied.
- **Weekly Vulnerability Scan:** G rows with ✓.
- **Monthly Cost Optimization Report:** F rows Generated, Inventory, Estimated monthly cost (bold) → sub-heading "Resources": Memory, Swap, CPU, Traffic → sub-heading "Decision": Capacity decision (bold), callout "Peak normalized CPU 88.0% exceeds 50%." (amber, if tone supplied), G rows for remaining bullets → K "Next review".
- **Monthly Backup Test Reminder:** amber callout containing "Monthly Action Required…" (bold) plus the "It's time…" sentence; line "MAIN DROPLET (murphys-laws.com):" bold with `ssh murphys-main` in mono; J block for the sudo command; G rows for the three checklist lines.

## Plain-text mapping

| HTML pattern | Plain text |
|---|---|
| Preview div | none |
| Header | `Daily Status Report` / date |
| Glance row | `API: [?] Unknown` / `Security: [!] 2 path traversal attempts detected` |
| Glyph tags | ✓ `[OK]`, ! `[!]`, ? `[?]`, ✕ `[X]` |
| Section header | `━━━━…` (40) / TITLE / `━━━━…` |
| Label/value | `Uptime: up 2 days` |
| Flagged value | `CPU normalized %: [!] 88 % (2026-10-09T08:00:00Z)` |
| Bullet | `• text` |
| Passing bullet | `• [OK] text` |
| Callout | `• [!] text` / `• [?] text` |
| Sub-heading | blank line only |
| Command block | `• sudo /usr/local/bin/test-backup-restore.sh` |

## Open decisions
1. Header title/date and the "Resources"/"Decision" sub-headings are new presentational text.
2. CPU highlight (Peak section and cost callout) requires the renderer to pass a tone for that value; leave plain if not wanted.
3. The `[OK]/[!]/[?]/[X]` tags in plain text are derived from the existing tone mapping.

## Acceptance checks
Renders without horizontal scroll at 360px in Gmail mobile; text contrast ≥4.5:1; test with `</script> & /laws` and apostrophes to confirm escaping; text and HTML parts list the same items in the same order.
