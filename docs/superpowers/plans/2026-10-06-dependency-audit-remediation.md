# Dependency Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all audit findings with compatible patched releases and
document any upstream advisory that has no compatible remediation.

**Architecture:** Update vulnerable direct dependencies in the manifests that own
them, then let npm regenerate the single root lockfile and select patched
transitive dependencies. Treat the dependency graph as the source of truth:
validate each affected workspace after its dependency family is updated, and
make source or test changes only for observed breaking API changes.

**Tech Stack:** npm workspaces, TypeScript, Vitest, Vite, Sentry, Nodemailer,
Sharp, Markdownlint.

## Global Constraints

- Do not bypass the audit hook.
- Keep Node versions within `>=22.16.0 <23`.
- Permit major package upgrades approved by the user.
- Do not force an incompatible transitive dependency override.
- Document an unresolved advisory in `docs/DEPENDENCY_AUDIT_EXCEPTIONS.md` and
  remove the exception when a compatible upstream release exists.
- Run package-specific checks before the complete monorepo check.

---

### Task 1: Refresh packages with compatible patched releases

**Files:**
- Modify: `package.json:70-88`
- Modify: `web/package.json:37-57`
- Modify: `backend/package.json:35-55`
- Modify: `mcp/package.json:46-62`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: The npm workspace configuration in `package.json`.
- Produces: A lockfile that resolves patched versions of all direct and
  transitive dependencies.

- [ ] **Step 1: Capture the current audit baseline**

Run:

```bash
npm audit --json > /tmp/murphys-laws-audit-before.json
```

Expected: The JSON summary reports 33 vulnerabilities.

- [ ] **Step 2: Upgrade direct dependencies that own audit paths**

Run:

```bash
npm install --save-dev fast-uri@latest markdownlint-cli2@latest \
  --workspace-root
npm install --save-dev @sentry/vite-plugin@latest \
  @vitest/coverage-v8@latest vitest@latest sharp@latest \
  --workspace murphys-laws-web
npm install nodemailer@latest --workspace murphys-laws-backend
npm install @hono/node-server@latest --workspace murphys-laws-mcp
```

Expected: npm updates the owning package manifests and root lockfile without
using `--force`, `--legacy-peer-deps`, or `--ignore-scripts`.

- [ ] **Step 3: Check the remaining audit graph**

Run:

```bash
npm audit
```

Expected: Either zero vulnerabilities or a list naming a remaining direct
owner. If any of `fast-uri`, `markdownlint-cli2`, `@sentry/vite-plugin`,
`vitest`, `@vitest/coverage-v8`, `sharp`, `nodemailer`, or
`@hono/node-server` remains, rerun its corresponding install command from
Step 2, then rerun this command. Record any finding that cannot be upgraded
without breaking the owning package's declared dependency range.

- [ ] **Step 4: Confirm package metadata is internally consistent**

Run:

```bash
npm install
git diff --check
```

Expected: npm makes no further manifest change and `git diff --check` exits 0.

- [ ] **Step 5: Commit the dependency graph update**

Run:

```bash
git add package.json web/package.json backend/package.json mcp/package.json package-lock.json
git commit -m "chore: remediate npm audit vulnerabilities"
```

Expected: The commit contains only manifests and lockfile changes.

### Task 2: Validate Sentry build integration

**Files:**
- Modify if required: `web/vite.config.ts`
- Modify if required: `web/tests/**/*.test.ts`
- Test: `web/vite.config.ts` through the web build

**Interfaces:**
- Consumes: `sentryVitePlugin` from `@sentry/vite-plugin`.
- Produces: A Vite configuration accepted by the upgraded Sentry plugin.

- [ ] **Step 1: Typecheck the web workspace**

Run:

```bash
npm --prefix web run typecheck
```

Expected: Exit 0. If the Sentry plugin types reject an option in
`web/vite.config.ts`, replace only that option with its documented equivalent
and retain the existing release and source-map behavior.

- [ ] **Step 2: Build the web workspace**

Run:

```bash
npm run build:web
```

Expected: Vite completes and invokes the upgraded Sentry plugin without a
configuration error.

- [ ] **Step 3: Run Sentry-adjacent web tests**

Run:

```bash
npm --prefix web test -- \
  tests/api.test.ts tests/categories.test.ts tests/category-detail.test.ts \
  tests/error-handler.test.ts tests/export.test.ts tests/metrics.test.ts \
  tests/router.test.ts tests/search-autocomplete.test.ts
```

Expected: All Sentry mocks and reporting assertions pass.

- [ ] **Step 4: Commit compatibility changes if any**

Run:

```bash
git add web/vite.config.ts web/tests
git commit -m "fix(web): align Sentry build integration"
```

Expected: Create this commit only when Task 2 changed source or tests.

### Task 3: Validate Nodemailer and package tooling

**Files:**
- Modify if required: `backend/src/services/email.service.ts`
- Modify if required: `backend/scripts/health-check.ts`
- Modify if required: `backend/tests/services/email.service.test.ts`
- Test: `backend/tests/services/email.service.test.ts`

**Interfaces:**
- Consumes: `nodemailer.createTransport` and its `Transporter` return type.
- Produces: Email delivery and the health-check mail transport working with the
  upgraded Nodemailer release.

- [ ] **Step 1: Typecheck the backend**

Run:

```bash
npm --prefix backend run typecheck
```

Expected: Exit 0. If the Nodemailer upgrade changes the transporter types,
update the affected annotation in `email.service.ts` and the matching test
mock type in `email.service.test.ts`.

- [ ] **Step 2: Run email service tests**

Run:

```bash
npm --prefix backend test -- tests/services/email.service.test.ts
```

Expected: The transport creation and send behavior tests pass.

- [ ] **Step 3: Run root Markdownlint**

Run:

```bash
npm run lint:md
```

Expected: The upgraded Markdownlint tooling accepts the existing configuration
and documentation.

- [ ] **Step 4: Commit compatibility changes if any**

Run:

```bash
git add backend/src/services/email.service.ts backend/scripts/health-check.ts \
  backend/tests/services/email.service.test.ts
git commit -m "fix(backend): align email transport types"
```

Expected: Create this commit only when Task 3 changed source or tests.

### Task 4: Verify the complete remediation

**Files:**
- Verify: `package.json`
- Verify: `web/package.json`
- Verify: `backend/package.json`
- Verify: `mcp/package.json`
- Verify: `package-lock.json`

**Interfaces:**
- Consumes: The complete updated npm workspace graph.
- Produces: A clean audit result and a validated monorepo.

- [ ] **Step 1: Run workspace quality gates**

Run:

```bash
npm run ci:backend
npm run ci:web
npm run ci:sdk
npm run ci:cli
npm run ci:mcp
```

Expected: Every command exits 0 and coverage thresholds remain unchanged.

- [ ] **Step 2: Run the final audit**

Run:

```bash
npm audit
```

Expected: No unresolved finding except an advisory recorded in
`docs/DEPENDENCY_AUDIT_EXCEPTIONS.md` that has no compatible patched release.

- [ ] **Step 3: Confirm the change set**

Run:

```bash
git diff --check
git status --short
```

Expected: No whitespace errors and no uncommitted generated files.

- [ ] **Step 4: Commit any remaining tracked update**

Run:

```bash
git add package-lock.json
git commit -m "chore: refresh dependency lockfile"
```

Expected: Create this commit only if a verification command updated the
lockfile after Task 1.
