# Operational Email Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the daily operational report as a readable Gmail-safe HTML
email with a complete matching plain-text alternative, without exposing
terminal-format child reports.

**Architecture:** A TypeScript renderer becomes the daily email presentation
owner. Shell report scripts retain their existing standalone text output while
adding JSON modes that the renderer validates, combines with host metrics, and
renders into one multipart MIME message. The cron-facing shell script remains
a small launcher.

**Tech Stack:** Node.js 22, TypeScript, Bash, `node:test`, `tsx`, SQLite CLI,
`sendmail`, HTML email with inline CSS.

## Global Constraints

- Preserve the current cron schedule and `sendmail` transport.
- Preserve standalone text modes, including cost `--no-email`, peak
  `--no-header`, vulnerability summary markers, and log-analyzer stdout.
- Use a multipart `alternative` message: HTML primary and equivalent text
  fallback.
- Use inline CSS and table-based HTML only. Do not use JavaScript, external
  stylesheets, Flexbox, Grid, or expandable HTML controls.
- Escape every dynamic value before it enters HTML.
- External test delivery is allowed only when
  `DAILY_REPORT_TEST_RECIPIENT` is explicitly set.
- Add behavioral tests for all changed code, retain shell syntax checks, update
  `CHANGELOG.md`, and run `npm run check:versions` before committing.

---

### Task 1: Build the shared email renderer and MIME contract

**Files:**

- Create: `backend/scripts/render-daily-report.ts`
- Create: `scripts/operational-email-rendering.test.ts`

**Interfaces:**

- Produces `DailyReport`, `ReportSection`, `renderPlainTextReport`,
  `renderHtmlReport`, `buildMultipartMessage`, and `escapeHtml`.
- Consumes only a validated `DailyReport`, so rendering is independent from
  shell commands and host state.

- [ ] **Step 1: Write failing renderer tests**

Create fixtures with a summary, key-value rows, bullet lists, a warning, and a
value containing `<script>alert(1)</script> &`. Assert that:

```ts
const model: DailyReport = {
  date: '2026-10-11',
  subjectSuffix: '',
  preview: 'System status and security findings',
  summary: [{ label: 'API', value: 'Healthy', tone: 'success' }],
  sections: [{
    title: 'TRAFFIC & BANDWIDTH',
    items: [{ label: 'Top URL', value: '</script> & /laws' }],
  }],
};

assert.match(renderHtmlReport(model), /&lt;\/script&gt; &amp; \/laws/);
assert.match(renderPlainTextReport(model), /Top URL: <\/script> & \/laws/);
assert.doesNotMatch(renderHtmlReport(model), /━━━━━━━━|====|<pre>/);
assert.match(buildMultipartMessage(model).message, /multipart\/alternative/);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts
```

Expected: failure because the renderer module does not exist.

- [ ] **Step 3: Implement the renderer**

Define these explicit data shapes and rendering functions:

```ts
export interface ReportItem {
  label?: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'critical';
}

export interface ReportSection {
  title: string;
  items: ReportItem[];
}

export interface DailyReport {
  date: string;
  subjectSuffix: string;
  preview: string;
  summary: ReportItem[];
  sections: ReportSection[];
}
```

Render one HTML heading per section with inline styles on table cells and
paragraphs. Render label-value data as two-column presentation tables and
unlabelled data as bullets. Emit the plain-text version from the same model
using one consistent label-and-value convention. Create a generated MIME
boundary, include `text/plain` first and `text/html` second, and escape
`&`, `<`, `>`, `"`, and `'` in every HTML value.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts
```

Expected: PASS, including escape, MIME, section-style, and text-equivalence
assertions.

- [ ] **Step 5: Commit the isolated renderer**

```bash
git add backend/scripts/render-daily-report.ts scripts/operational-email-rendering.test.ts
git commit -m "feat(ops): add daily email renderer"
```

### Task 2: Add structured child-report modes and retain complete findings

**Files:**

- Modify: `backend/scripts/log-analyzer.sh`
- Modify: `backend/scripts/analyze-resource-peaks.sh`
- Modify: `backend/scripts/vulnerability-scanner.sh`
- Modify: `backend/scripts/cost-optimization-report.sh`
- Modify: `scripts/operational-email-rendering.test.ts`
- Modify: `scripts/operational-cost-report.test.ts`

**Interfaces:**

- Each script accepts `--format json` and writes exactly one JSON document to
  stdout with diagnostics on stderr.
- Existing invocation modes keep their current human-readable stdout format.
- The JSON contracts feed `DailyReport` sections in Task 3.

- [ ] **Step 1: Write failing subprocess tests for producer JSON**

Use temporary directories and fixture files to execute each script with
controlled environment variables. Assert JSON parses and contains:

```ts
assert.deepEqual(logReport.statusCodes, [{ code: 404, count: 2 }]);
assert.deepEqual(logReport.topUrls, [{ url: '/missing', count: 2 }]);
assert.equal(peakReport.metrics[0].label, 'Memory pressure');
assert.equal(costReport.capacity.decision, 'No change justified');
assert.ok(vulnerabilityReport.summary.totalIssues >= 0);
```

Include log fixtures for status codes, top URLs, IP addresses, user agents,
404 URLs, 5xx samples, SQL samples and IPs, rate-limit IPs, and API errors.

- [ ] **Step 2: Run producer tests and confirm they fail**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts scripts/operational-cost-report.test.ts
```

Expected: failure because no producer accepts `--format json`.

- [ ] **Step 3: Implement JSON modes without regressing text modes**

Parse `--format json` before existing mode handling in every producer. Collect
rows into arrays before formatting, then use the same arrays for JSON and
human-readable text. In `log-analyzer.sh`, replace every
`producer | while read ...; do REPORT+=...; done` construct with
`while read ...; do ...; done < <(producer)` or an equivalent array-based
approach so modifications occur in the current shell.

Use these top-level JSON fields:

```text
log: { summary, statusCodes, topUrls, topIps, errors4xx, errors5xx,
       suspiciousUserAgents, securityFindings, applicationErrors }
peaks: { metrics: [{ label, value, timestamp }], sampleCount }
vulnerability: { summary, findings }
cost: { inventory, snapshot, capacity, recommendations, actionItems, nextReview }
```

Use `jq -n` or the existing Node capacity analyzer to serialize strings
safely. Do not hand-concatenate JSON containing log values.

- [ ] **Step 4: Run producer tests and standalone compatibility checks**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts scripts/operational-cost-report.test.ts
bash -n backend/scripts/log-analyzer.sh
bash -n backend/scripts/analyze-resource-peaks.sh
bash -n backend/scripts/vulnerability-scanner.sh
bash -n backend/scripts/cost-optimization-report.sh
```

Expected: PASS. Existing text-mode tests and manual invocations still produce
their expected titles and content.

- [ ] **Step 5: Commit structured producer contracts**

```bash
git add backend/scripts/log-analyzer.sh backend/scripts/analyze-resource-peaks.sh \
  backend/scripts/vulnerability-scanner.sh backend/scripts/cost-optimization-report.sh \
  scripts/operational-email-rendering.test.ts scripts/operational-cost-report.test.ts
git commit -m "feat(ops): expose structured report data"
```

### Task 3: Replace the monolithic shell email composition path

**Files:**

- Modify: `backend/scripts/render-daily-report.ts`
- Modify: `backend/scripts/daily-report.sh`
- Modify: `scripts/operational-email-rendering.test.ts`

**Interfaces:**

- `collectDailyReport(options)` returns `DailyReport`.
- `sendDailyReport(report, recipient)` pipes `buildMultipartMessage(report)`
  to `sendmail -t`.
- `render-daily-report.ts --test-email` forces every optional section and
  refuses delivery without `DAILY_REPORT_TEST_RECIPIENT`.

- [ ] **Step 1: Write failing orchestration tests**

Mock the executable paths for system commands and `sendmail`; use fixed date
and report fixtures. Assert:

```ts
assert.match(sentMessage, /Content-Type: multipart\/alternative/);
assert.match(sentMessage, /MONTHLY COST OPTIMIZATION REPORT/);
assert.match(sentMessage, /PEAK RESOURCE USAGE/);
assert.match(sentMessage, /WEEKLY VULNERABILITY SCAN/);
assert.match(sentMessage, /MONTHLY BACKUP TEST REMINDER/);
assert.doesNotMatch(sentMessage, /COST OPTIMIZATION REPORT\n.*====/s);
assert.throws(() => runRenderer('--test-email'), /DAILY_REPORT_TEST_RECIPIENT/);
```

- [ ] **Step 2: Run orchestration tests and confirm they fail**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts
```

Expected: failure because the renderer does not collect host data or implement
the controlled test-email mode.

- [ ] **Step 3: Implement collection, scheduling, and delivery**

Move the current daily data collection into typed collector functions in the
renderer. Invoke the four producers with `--format json`, validate required
fields, and map them into the shared model. Include weekly vulnerability data
only on Sunday, cost and backup data only on day 1, and peaks only on day 15.
Keep output concise by omitting empty lists and rendering populated findings
as readable bullets.

Replace `daily-report.sh` with an executable launcher equivalent to:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="${REPO_ROOT:-/root/murphys-laws}"
exec "$REPO_ROOT/node_modules/.bin/tsx" \
  "$REPO_ROOT/backend/scripts/render-daily-report.ts" "$@"
```

Implement `--test-email` to load the all-sections fixture, force optional
section inclusion, use `DAILY_REPORT_TEST_RECIPIENT` as the sole recipient,
and return a nonzero exit code before creating a message if that variable is
missing.

- [ ] **Step 4: Run orchestration and regression tests**

Run:

```bash
node --import tsx --test scripts/operational-email-rendering.test.ts scripts/backup-reminder.test.ts scripts/operational-cost-report.test.ts
```

Expected: PASS. Captured MIME contains every expected section, no duplicate
producer heading, all HTML metacharacters are escaped, and text/HTML provide
the same findings.

- [ ] **Step 5: Commit the new delivery path**

```bash
git add backend/scripts/render-daily-report.ts backend/scripts/daily-report.sh \
  scripts/operational-email-rendering.test.ts
git commit -m "feat(ops): render consolidated reports as email"
```

### Task 4: Document, validate, and deliver the all-sections test email

**Files:**

- Modify: `shared/docs/DEPLOY-MONITORING.md`
- Modify: `shared/docs/DISASTER-RECOVERY.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Operators run `DAILY_REPORT_TEST_RECIPIENT=<recipient>
  /usr/local/bin/daily-report.sh --test-email` after deployment.
- The command exits without sending if the variable is omitted.

- [ ] **Step 1: Document the new delivery format and safe smoke test**

Update both operations documents to describe the TypeScript renderer, the
multipart HTML/text output, the retained daily cron command, and this
post-deployment validation:

```bash
DAILY_REPORT_TEST_RECIPIENT=ravidor@gmail.com \
  sudo /usr/local/bin/daily-report.sh --test-email
```

State that it intentionally includes normal, Sunday, day-1, and day-15
sections, and must never be run without an explicit recipient.

- [ ] **Step 2: Update release notes**

Add a changelog entry describing the unified daily-email presentation,
structured report integration, restored populated log details, HTML escaping,
and the explicit-recipient test-email command.

- [ ] **Step 3: Run the full local verification suite**

Run:

```bash
npm run test:scripts
npm run lint:md
npm run check:versions
```

Expected: PASS. If `check:versions` requires a release increment, apply only
the required patch bump and rerun it. Do not use a minor or major bump without
explicit user confirmation.

- [ ] **Step 4: Deploy and send the controlled all-sections test email**

After the normal deployment completes, run only with the chosen explicit
recipient:

```bash
DAILY_REPORT_TEST_RECIPIENT=ravidor@gmail.com \
  ssh murphys-main 'sudo /usr/local/bin/daily-report.sh --test-email'
```

Verify the received Gmail message has the summary first, every optional
section, readable populated detail rows, no terminal-format child headings,
and a plain-text alternative in the raw message source.

- [ ] **Step 5: Commit documentation and release metadata**

```bash
git add shared/docs/DEPLOY-MONITORING.md shared/docs/DISASTER-RECOVERY.md CHANGELOG.md \
  package.json package-lock.json
git commit -m "docs(ops): document daily email rendering"
```
