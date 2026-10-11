# Operational email rendering design

## Goal

Replace the daily operational email's terminal-style pasted reports with a
Gmail-safe HTML summary, compact fully expanded detail sections, and an
equivalent plain-text MIME alternative. The report must have one visual system,
show all populated findings, and preserve standalone report commands.

## Design

`daily-report.sh` remains the cron entry point but becomes a thin launcher.
A new TypeScript renderer owns collection orchestration, a validated daily
report model, multipart MIME construction, and delivery through `sendmail`.

Each embedded report producer retains its existing human-readable standalone
output and gains a structured JSON mode:

- `log-analyzer.sh` returns counts and detail arrays for traffic, errors, and
  security findings.
- `analyze-resource-peaks.sh` returns peak metric values and timestamps.
- `vulnerability-scanner.sh` returns its summary and findings.
- `cost-optimization-report.sh` returns inventory, current resource data,
  capacity analysis, recommendations, and action items.

The renderer consumes those JSON contracts and renders each report through one
shared section and key-value/list convention. It must not embed child titles,
ASCII tables, `=` separators, or preformatted standalone prose. Weekly and
monthly content remains conditionally included on the same calendar schedule.

The HTML part uses email-compatible table-based layout and inline styles.
Every dynamic string is escaped before rendering. It starts with an at-a-glance
health summary, then presents compact but fully expanded sections because
Gmail cannot reliably provide native expandable email sections. The preview
text is present for inbox previews but hidden in the rendered message. The
plain-text alternative mirrors the same hierarchy and content without HTML.

The new structured log-analyzer path must avoid pipeline subshell mutation so
that status-code rows, URLs, IP addresses, user agents, samples, and
application errors are retained in both standalone and daily outputs.

The renderer also exposes a test-email mode that renders a synthetic report
containing every optional section. It may deliver only when
`DAILY_REPORT_TEST_RECIPIENT` is explicitly set, ensuring test messages never
default to the production alert recipient.

## Compatibility

- The existing root cron schedule and `sendmail` transport remain unchanged.
- Direct human-readable modes, including cost `--no-email`, peak
  `--no-header`, vulnerability scanner markers, and log analyzer stdout,
  continue to work for operators and existing scripts.
- The daily email becomes the sole presentation owner for embedded content.
- HTML output must be suitable for Gmail desktop and mobile without JavaScript,
  external stylesheets, Flexbox, Grid, or interactive controls.

## Testing

Add behavioral tests with temporary fixture logs, metrics, inventory, and
mocked executables:

1. Verify each producer's JSON mode is valid and preserves its intended facts.
2. Verify the log analyzer emits all detail rows, including rows formerly lost
   through pipeline subshells.
3. Capture the MIME input sent to a mocked `sendmail` and assert HTML and
   plain-text parts contain the same expected sections and findings.
4. Assert no embedded producer separator, title, or fixed-width table appears
   in the rendered daily email.
5. Assert HTML metacharacters from laws, URLs, user agents, and logs are
   escaped, while their text remains visible.
6. Cover normal daily, Sunday vulnerability, first-of-month cost and backup,
   and fifteenth-of-month peak-report variants.
7. Retain shell syntax checks and capacity-analysis coverage.
8. Run the test-email mode with fixtures that include every optional section
   and send the resulting multipart message to
   `DAILY_REPORT_TEST_RECIPIENT`. Verify the received email's HTML and
   plain-text parts contain every expected section and populated detail.

## Scope

This change is limited to operational report producers, the daily delivery
path, deployment of the new renderer, and tests/documentation needed to run
them. It does not change monitoring thresholds, infrastructure capacity
decisions, report schedules, or the content retention policy.
