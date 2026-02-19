# TypeScript Migration Runbook (Monorepo)

Last updated: 2026-02-18
Repository: `murphys-laws`
Owner: Engineering

## Purpose

This document is the end-to-end, step-by-step, file-by-file plan to finish migrating the codebase from JavaScript to TypeScript while keeping production stable.

It includes:

1. Current migration status.
2. Exact file-by-file conversion order.
3. Validation gates after every phase.
4. Rollback-safe deployment sequence.

## Scope

In scope:

- `backend/src/**`
- `backend/tests/**`
- `backend/scripts/**` (runtime-critical and operational scripts)
- `shared/modules/**`
- Type-system hardening in `web/src/**` and `web/tests/**` (already `.ts`)

Out of scope:

- `node_modules`, `coverage`, `dist`, generated artifacts.
- Android/iOS native code.

---

## Current Status (As of 2026-02-18)

### Completed

- TypeScript bootstrap added for backend:
  - `backend/package.json`
  - `backend/tsconfig.json`
  - `backend/tsconfig.strict-src.json`
- Web API contract typing fixes:
  - `web/src/types/app.d.ts`
  - `web/src/utils/api.ts`
- High-risk backend runtime fixes shipped:
  - `backend/src/controllers/laws.controller.ts`
  - `backend/src/controllers/votes.controller.ts`
  - `backend/src/routes/router.ts`
  - `backend/src/server/api-server.ts`
  - `backend/scripts/deploy.mjs`
  - Direct TS runtime entrypoint cutover complete:
    - `backend/src/server/api-server.ts` (self-start + env bootstrap)
    - `backend/scripts/api-server.mjs` removed
- Tests added for new behavior:
  - `backend/tests/controllers/laws.controller.test.ts`
  - `backend/tests/controllers/votes.controller.test.ts`
  - `backend/tests/router.test.ts`
- Migration completion status for JS -> TS scope:
  - `backend/src/**`: TypeScript-only
  - `backend/tests/**`: TypeScript-only
  - `shared/modules/**`: TypeScript-only
  - `backend` test suite: passing locally (`221/221`)
  - `web` test suite: passing locally (`2005/2005`)

### Inventory Snapshot

- Backend source not yet TypeScript:
  - 0 files
- Backend tests not yet TypeScript:
  - 0 files
- Shared modules not yet TypeScript:
  - 0 files
- Web source/tests:
  - `web/src`: already TypeScript (`*.ts`)
  - `web/tests`: already TypeScript (`*.test.ts`)

### Known blocker

- No active migration blocker in this workspace.
- Note for local environment parity: native modules may need a rebuild when Node architecture changes:
  - `npm rebuild better-sqlite3 canvas`
- Local sandbox note: direct socket bind checks for server startup may return `EPERM` in this environment.

### Coverage of Previously Found Points

This runbook tracks each previously identified item:

1. Invalid numeric query `NaN` risk and 500s:
   - fixed in runtime code and covered in migration phases.
2. Wrong web API contracts:
   - fixed in shared web types and tracked for call-site follow-up.
3. Unsafe route regex generation:
   - fixed in router and covered by dedicated test.
4. Deploy syncing stale `backend/utils` duplicate:
   - fixed in deploy and called out in final cleanup.
5. Invalid JSON body handling returning 500 instead of 400:
   - fixed in controllers and covered by dedicated tests.

Readiness points captured:

1. Backend still JS-first runtime:
   - explicitly tracked file-by-file for `src`, `tests`, and scripts.
2. Web strict mode effectively disabled:
   - strictness ramp-up plan included.
3. Backend TS toolchain initially absent:
   - bootstrap now present and documented.
4. Strict dry-run debt concentration:
   - baselines preserved below.
5. Test validation blocker:
   - resolved in this workspace after native module rebuild.

### Baseline Strictness Debt (Reference Snapshot)

These are the baseline numbers from the readiness review, used as migration KPIs:

1. Web strict dry-run: `303` errors.
   - top files:
     - `web/src/views/buttered-toast-calculator.ts`
     - `web/src/views/sods-calculator.ts`
     - `web/src/components/sod-calculator-simple.ts`
2. Backend src strict dry-run: `193` errors.
   - top files:
     - `backend/src/controllers/laws.controller.mjs`
     - `backend/src/services/og-image.service.mjs`
     - `backend/src/services/laws.service.mjs`

---

## Migration Principles

1. Convert in dependency order (lowest-level utilities first).
2. Keep each phase small enough to validate quickly.
3. Never mix broad refactors with behavior changes.
4. Keep runtime deployable at every checkpoint.
5. Treat test migration as part of each phase, not a final afterthought.

---

## Phase 0: Stabilize Tooling and Runtime Strategy

Goal: make TS-first backend runtime possible before mass file renames, using direct TS execution (`tsx`) during migration.

### Files to update

- `[x]` `backend/package.json`
  - Add build/runtime scripts for TS compilation and dist execution.
  - Add `dev:ts`, `build`, `start:dist` style scripts.
- `[x]` `backend/tsconfig.json`
  - Keep gradual mode for migration.
- `[x]` `backend/tsconfig.strict-src.json`
  - Keep strict checks for selected scope.
- `[x]` `backend/tsconfig.tests.json` (new)
  - Dedicated test compile scope for Vitest and test-only globals.
- `[x]` `backend/tsconfig.build.json` (new)
  - Emit compiled JS to `backend/dist`.
  - Include `backend/src/**/*.ts` and `shared/modules/**/*.ts` once converted.
- `[x]` `backend/ecosystem.config.cjs`
  - Configure PM2 to run source with `node --import tsx`.
- `[x]` `backend/scripts/deploy.mjs`
  - Deploy backend runtime source files for direct TS runtime.
  - Keep import specifiers aligned to `.ts` for migrated backend modules.

### Validation gate

Run:

```bash
cd backend
npm run typecheck
npm run typecheck:strict:src
```

If test environment is fixed:

```bash
npm test
```

---

## Phase 0.5: Shared Contract Alignment (Web + Backend API Shape)

Goal: ensure TypeScript models match backend runtime payloads before deeper migration.

### Contract files

- `[x]` `web/src/types/app.d.ts`
  - `Law.attributions` corrected to attribution-object array.
  - category model updated for backend `title` shape.
  - related laws/list response types added.
- `[x]` `web/src/utils/api.ts`
  - related-laws return type corrected to `{ data, law_id }`.
  - categories response shape aligned.

### Required call-site verification (explicitly tracked)

- `[x]` `web/src/views/categories.ts`
- `[x]` `web/src/views/category-detail.ts`
- `[x]` `web/src/views/law-detail.ts`
- `[x]` `web/src/utils/attribution.ts`

### Validation gate

```bash
cd web
npm run typecheck
npx eslint src/types src/utils/api.ts src/views/categories.ts src/views/category-detail.ts src/views/law-detail.ts src/utils/attribution.ts
```

---

## Phase 1: Convert Backend Foundation (Utilities, Middleware, Router)

Convert these first because almost every other backend file depends on them.

### 1.1 Utilities

- `[x]` `backend/src/utils/constants.js` -> `backend/src/utils/constants.ts`
- `[x]` `backend/src/utils/helpers.js` -> `backend/src/utils/helpers.ts`
- `[x]` `backend/src/utils/facebook-signed-request.js` -> `backend/src/utils/facebook-signed-request.ts`
- `[x]` `backend/src/utils/http-helpers.js` -> `backend/src/utils/http-helpers.ts`

### 1.2 Middleware

- `[x]` `backend/src/middleware/cors.mjs` -> `backend/src/middleware/cors.ts`
- `[x]` `backend/src/middleware/rate-limit.mjs` -> `backend/src/middleware/rate-limit.ts`

### 1.3 Router

- `[x]` `backend/src/routes/router.mjs` -> `backend/src/routes/router.ts`

### 1.4 Immediate dependent import updates

Update imports in these files after foundation conversion:

- `[x]` `backend/src/controllers/attributions.controller.mjs`
- `[x]` `backend/src/controllers/categories.controller.mjs`
- `[x]` `backend/src/controllers/health.controller.mjs`
- `[x]` `backend/src/controllers/laws.controller.mjs`
- `[x]` `backend/src/controllers/og-image.controller.mjs`
- `[x]` `backend/src/controllers/votes.controller.mjs`
- `[x]` `backend/src/services/feed.service.mjs`
- `[x]` `backend/src/services/laws.service.mjs`
- `[x]` `backend/scripts/api-server.mjs`
- `[x]` `backend/tests/utils/helpers.test.js`
- `[x]` `backend/tests/utils/http-helpers.test.js`
- `[x]` `backend/tests/middleware/cors.test.js`
- `[x]` `backend/tests/middleware/rate-limit.test.js`
- `[x]` `backend/tests/router.test.js`

### Validation gate

```bash
cd backend
npm run typecheck
npm run typecheck:strict:src
npx eslint src/utils src/middleware src/routes tests/utils tests/middleware tests/router.test.js
```

---

## Phase 2: Convert Backend Services (Data and Business Layer)

Canonical runtime conversion order from the migration review (authoritative sequence):

1. `backend/src/utils/constants.js` -> `constants.ts`
2. `backend/src/utils/helpers.js` -> `helpers.ts`
3. `backend/src/utils/http-helpers.js` -> `http-helpers.ts`
4. `backend/src/utils/facebook-signed-request.js` -> `facebook-signed-request.ts`
5. `backend/src/middleware/cors.mjs` -> `cors.ts`
6. `backend/src/middleware/rate-limit.mjs` -> `rate-limit.ts`
7. `backend/src/services/database.service.mjs` -> `database.service.ts`
8. `backend/src/services/attributions.service.mjs` -> `attributions.service.ts`
9. `backend/src/services/categories.service.mjs` -> `categories.service.ts`
10. `backend/src/services/votes.service.mjs` -> `votes.service.ts`
11. `backend/src/services/laws.service.mjs` -> `laws.service.ts`
12. `backend/src/services/feed.service.mjs` -> `feed.service.ts`
13. `backend/src/services/email.service.mjs` -> `email.service.ts`
14. `backend/src/services/og-image.service.mjs` -> `og-image.service.ts`
15. `backend/src/controllers/attributions.controller.mjs` -> `attributions.controller.ts`
16. `backend/src/controllers/categories.controller.mjs` -> `categories.controller.ts`
17. `backend/src/controllers/health.controller.mjs` -> `health.controller.ts`
18. `backend/src/controllers/votes.controller.mjs` -> `votes.controller.ts`
19. `backend/src/controllers/laws.controller.mjs` -> `laws.controller.ts`
20. `backend/src/controllers/feed.controller.mjs` -> `feed.controller.ts`
21. `backend/src/controllers/og-image.controller.mjs` -> `og-image.controller.ts`
22. `backend/src/routes/router.mjs` -> `router.ts`
23. `backend/scripts/api-server.mjs` -> `api-server.ts`

### 2.1 Core data services

- `[x]` `backend/src/services/database.service.mjs` -> `backend/src/services/database.service.ts`
- `[x]` `backend/src/services/categories.service.mjs` -> `backend/src/services/categories.service.ts`
- `[x]` `backend/src/services/attributions.service.mjs` -> `backend/src/services/attributions.service.ts`
- `[x]` `backend/src/services/votes.service.mjs` -> `backend/src/services/votes.service.ts`
- `[x]` `backend/src/services/laws.service.mjs` -> `backend/src/services/laws.service.ts`

### 2.2 Output/integration services

- `[x]` `backend/src/services/feed.service.mjs` -> `backend/src/services/feed.service.ts`
- `[x]` `backend/src/services/email.service.mjs` -> `backend/src/services/email.service.ts`
- `[x]` `backend/src/services/og-image.service.mjs` -> `backend/src/services/og-image.service.ts`

### 2.3 Service tests

- `[x]` `backend/tests/services/attributions.service.test.js` -> `.ts`
- `[x]` `backend/tests/services/categories.service.test.js` -> `.ts`
- `[x]` `backend/tests/services/feed.service.test.js` -> `.ts`
- `[x]` `backend/tests/services/laws.service.test.js` -> `.ts`
- `[x]` `backend/tests/services/og-image.service.test.js` -> `.ts`
- `[x]` `backend/tests/services/votes.service.test.js` -> `.ts`

### Validation gate

```bash
cd backend
npm run typecheck
npm run typecheck:strict:src
npx eslint src/services tests/services
```

If environment blocker is removed:

```bash
npm test -- tests/services
```

---

## Phase 3: Convert Backend Controllers (HTTP Layer)

### 3.1 Controllers

- `[x]` `backend/src/controllers/attributions.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/categories.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/feed.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/health.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/laws.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/og-image.controller.mjs` -> `.ts`
- `[x]` `backend/src/controllers/votes.controller.mjs` -> `.ts`

### 3.2 Controller tests

- `[x]` `backend/tests/controllers/attributions.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/categories.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/feed.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/health.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/laws.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/og-image.controller.test.js` -> `.ts`
- `[x]` `backend/tests/controllers/votes.controller.test.js` -> `.ts`

### Validation gate

```bash
cd backend
npm run typecheck
npm run typecheck:strict:src
npx eslint src/controllers tests/controllers
```

If environment blocker is removed:

```bash
npm test -- tests/controllers
```

---

## Phase 4: Convert Backend Entry and Remaining Tests

### 4.1 Runtime entrypoint

- `[x]` `backend/scripts/api-server.mjs`
  - Move server bootstrap logic into `backend/src/server/api-server.ts`.
  - Compatibility wrapper removed after runtime cutover validation.

### 4.2 Remaining test files

- `[x]` `backend/tests/router.test.js` -> `.ts`
- `[x]` `backend/tests/utils/helpers.test.js` -> `.ts`
- `[x]` `backend/tests/utils/http-helpers.test.js` -> `.ts`
- `[x]` `backend/tests/middleware/cors.test.js` -> `.ts`
- `[x]` `backend/tests/middleware/rate-limit.test.js` -> `.ts`

### 4.3 Update backend tsconfig include patterns

- `[x]` `backend/tsconfig.json`
  - Include only migrated TS runtime/test scopes (`src/**/*.ts`, `tests/**/*.ts`, `shared/modules/**/*.ts`).
- `[x]` `backend/tsconfig.strict-src.json`
  - Exclude tests/scripts as designed (including `shared/modules/**/*.test.ts`).

### Validation gate

```bash
cd backend
npm run typecheck
npm run typecheck:strict:src
npx eslint tests
```

If environment blocker is removed:

```bash
npm test
```

Backend test migration order from the original review (preserved):

1. Convert utility tests first:
   - `backend/tests/utils/helpers.test.js`
   - `backend/tests/utils/http-helpers.test.js`
2. Convert middleware tests:
   - `backend/tests/middleware/cors.test.js`
   - `backend/tests/middleware/rate-limit.test.js`
3. Convert service tests in order:
   - `attributions`, `categories`, `votes`, `laws`, `feed`, `og-image`
4. Convert controller tests in order:
   - `health`, `categories`, `attributions`, `votes`, `laws`, `feed`, `og-image`
5. Add typed mock helper factories:
   - request/response factories
   - DB stub factories
   - service stub factories

---

## Phase 5: Convert Shared Modules

These are imported by both backend and web tests, so convert after backend core stabilizes.

- `[x]` `shared/modules/law-submission-email-template.js` -> `shared/modules/law-submission-email-template.ts`
- `[x]` `shared/modules/sods-email-template.js` -> `shared/modules/sods-email-template.ts`
- `[x]` `shared/modules/sods-email-template.test.js` -> `shared/modules/sods-email-template.test.ts`

Also update imports in:

- `[x]` `backend/src/services/email.service.ts` (or `.mjs` until converted)
- `[x]` `web/tests/law-submission-email-template.test.ts`
- `[x]` `web/tests/sods-email-template.test.ts`

### Validation gate

```bash
cd backend && npm run typecheck
cd ../web && npm run typecheck
```

---

## Phase 6: Convert/Retain Operational Scripts (Explicit Decision Per File)

For each file below, choose one of:

- `Convert to TS` (if business-critical and shared logic).
- `Keep as JS/MJS` (if one-off ops script with low change frequency).

Files:

- `[x]` `backend/scripts/build-sqlite.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/check-coverage.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/cleanup-ports.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/deploy.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/export-law-updates.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/generate-add-laws-migration.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/generate-populate-categories-migration.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/health-check.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/log-manager.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/migrate.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/migration-safety-check.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/review-laws.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/sanitize-husky-hooks.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/select-law-of-day.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/show-recent-updates.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/validate-node-version.mjs` (keep as `.mjs`)
- `[x]` `backend/scripts/validate-ports.mjs` (keep as `.mjs`)

Recommended default:

- Keep shell-facing ops scripts in `.mjs`.
- Convert only scripts reused by runtime or requiring stronger typing guarantees.

---

## Phase 7: Harden Type Safety (Strict Mode Ramp-Up)

### 7.1 Backend strictness

- `[x]` `backend/tsconfig.json`
  - Transition:
    - `allowJs: true` -> `false`
    - `checkJs: false` -> remove when JS eliminated
    - `strict: false` -> `true`
- `[x]` `backend/eslint.config.js`
  - Add TypeScript parser/rules for backend TS files.

### 7.2 Web strictness

- `[x]` `web/tsconfig.json`
  - Ramp toward:
    - `strict: true`
    - `noUncheckedIndexedAccess: true`
    - `exactOptionalPropertyTypes: true` (if feasible)
  - Current transition state:
    - `strict` and `noUncheckedIndexedAccess` enabled.
    - `exactOptionalPropertyTypes` deferred until `strictNullChecks` is fully enabled.
- `[x]` `web/eslint.config.js`
  - Ensure TS-first linting rules are enforced for all `src/**/*.ts` and `tests/**/*.ts`.

High-priority web strictness fix order (from readiness analysis):

1. `web/src/views/buttered-toast-calculator.ts`
2. `web/src/views/sods-calculator.ts`
3. `web/src/components/sod-calculator-simple.ts`
4. `web/src/components/buttered-toast-calculator-simple.ts`
5. `web/src/views/category-detail.ts`
6. `web/src/components/social-share.ts`
7. `web/src/utils/button.ts`
8. `web/src/components/search-autocomplete.ts`
9. `web/src/components/advanced-search.ts`
10. `web/src/views/categories.ts`
11. `web/src/main.ts`
12. `web/src/utils/attribution.ts`
13. `web/src/utils/law-card-renderer.ts`
14. `web/src/utils/export-context.ts`
15. `web/src/utils/export.ts`
16. `web/src/utils/error-handler.ts`
17. `web/src/utils/mathjax.ts`
18. `web/src/utils/icons.ts`
19. `web/src/views/browse.ts`
20. `web/src/views/law-detail.ts`

### Validation gate

```bash
cd backend && npm run typecheck && npm run lint
cd ../web && npm run typecheck && npm run lint
```

---

## Phase 8: Final Cutover and Cleanup

### Final cleanup checklist

- `[x]` Remove duplicated legacy files no longer used:
  - `backend/utils/constants.js`
  - `backend/utils/facebook-signed-request.js`
- `[x]` Remove temporary wrappers (if any) after production verification.
- `[x]` Ensure deploy script syncs only required backend artifacts.
- `[x]` Verify PM2 starts backend successfully with TS runtime loader (`--import tsx`).
- `[x]` Document final architecture in `README.md` and `backend/README.md`.

### Definition of done

Migration is complete only when all are true:

1. No JS/MJS source files remain in `backend/src` and `shared/modules` (except explicitly retained ops scripts).
2. Backend tests are TypeScript.
3. `backend` and `web` pass typecheck.
4. CI and local test suites pass.
5. Production deploy uses the approved TypeScript runtime strategy (direct `tsx` runtime or compiled output).

---

## Web Status and Remaining Work

Web app source and tests are already converted to `.ts`. Remaining work is strictness hardening and type quality improvements, not extension migration.

Key files already in TypeScript and requiring quality hardening over time:

- `web/src/main.ts`
- `web/src/router.ts`
- `web/src/utils/api.ts`
- `web/src/types/app.d.ts`
- `web/src/views/*.ts`
- `web/src/components/*.ts`
- `web/src/utils/*.ts`
- `web/tests/*.test.ts`

Focus areas:

1. Remove implicit `any` and ad-hoc type coercions.
2. Replace broad type assertions with precise interfaces.
3. Tighten API response and URL query typing.
4. Gradually enable stricter compiler flags.

---

## Execution Cadence (Recommended)

Use this delivery cadence to reduce risk:

1. One migration PR per phase.
2. One reviewer focused only on type/runtime correctness.
3. Mandatory gate: typecheck + lint + targeted tests before merge.
4. No unrelated refactors in migration PRs.

---

## Quality Gates to Finish Migration

1. `web`: `tsc --noEmit --strict` reports `0` errors.
2. `backend`: `tsc --noEmit --strict` reports `0` errors.
3. No `.js`/`.mjs` in runtime app paths:
   - `backend/src`
   - `shared/modules`
   - `web/src`
   - except explicitly exempted config/tooling files.
4. Full test suite green after dependency/environment repair.
5. Lint and coverage continue meeting project thresholds.
6. Migration checklist is tracked file-by-file with completion boxes.

---

## Immediate Execution Start

Planned immediate start remains:

1. Execute Step 0 (tooling hardening).
2. Execute Step 1 (contract and call-site alignment verification).
3. Continue backend runtime conversion in the canonical file order.

---

## Quick Commands

```bash
# Backend
cd backend
npm run typecheck
npm run typecheck:strict:src
npm run lint
npm test

# Web
cd ../web
npm run typecheck
npm run lint
npm test
```

If backend Vitest fails after switching Node/runtime architecture in local macOS environment:

```bash
npm rebuild better-sqlite3 canvas
```
