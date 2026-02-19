# Major dependency upgrade plan

Concrete version targets and migration checklist for major upgrades. Do these in separate branches; run full test suites and manual smoke tests after each.

---

## Root

| Package               | Current | Target  | Notes |
|-----------------------|---------|---------|--------|
| markdownlint-cli2     | ^0.21.0 | ^0.21.x | Already on 0.21 (safe bump done). No further major planned. |
| Optional: @esbuild/darwin-x64, @rollup/rollup-darwin-x64 | ^0.25.x / ^4.52.x | Latest optional | Optional; bump when updating Vite/esbuild elsewhere. |

---

## Web

| Package               | Current | Target  | Migration checklist |
|-----------------------|---------|---------|----------------------|
| @sentry/browser       | ^9.x    | ^10.x   | Sentry 10 migration guide; update `Sentry.init` and any API changes; re-test error reporting. |
| @sentry/vite-plugin   | ^3.x    | ^4.x    | Bump with @sentry/browser; check Vite plugin options. |
| eslint                | ^9.x    | ^10.x   | ESLint 10 flat config only; align with @eslint/js and typescript-eslint. |
| @eslint/js            | ^9.x    | ^10.x   | Bump with eslint. |
| jsdom                 | ^26.x   | ^28.x   | Check JSDOM 28 changelog; "Not implemented: navigation" and other test env behavior. |
| jspdf                 | ^2.x    | ^4.x    | jspdf 4 has API changes; update export/PDF code and tests. |
| mathjax / mathjax-full| ^3.2.x  | (skipped)| MathJax 4 uses different packages (@mathjax/src etc.); stay on 3.x unless doing full migration. |
| stylelint             | ^16.x   | ^17.x   | Stylelint 17 release notes; rule renames/removals. |
| stylelint-config-standard | ^36.x | ^40.x   | Bump with stylelint 17; may need config updates. |
| vitest                | ^3.x    | ^4.x    | Vitest 4 migration; update config and any deprecated APIs; run web tests. |
| @vitest/coverage-v8   | ^3.x    | ^4.x    | Bump with vitest 4. |

---

## Backend

| Package         | Current | Target  | Migration checklist |
|-----------------|---------|---------|----------------------|
| dotenv          | ^16.x   | ^17.x   | dotenv 17 changelog; behavior changes if any. |
| nodemailer      | ^7.x    | ^8.x    | Nodemailer 8 API/options; update email.service and tests. |
| @sentry/node    | ^9.x    | ^10.x   | Sentry 10 migration; align with @sentry/browser. |

---

## Suggested order

1. **Sentry (web + backend)** – One major version across @sentry/browser, @sentry/vite-plugin, @sentry/node.
2. **Vitest (web)** – Vitest 4 + @vitest/coverage-v8; backend already on Vitest 4.
3. **ESLint (web + backend)** – ESLint 10 + @eslint/js; ensure flat config and typescript-eslint compatibility.
4. **stylelint (web)** – stylelint 17 + stylelint-config-standard 40.
5. **jsdom (web)** – 28; fix or mock navigation in tests.
6. **jspdf (web)** – 4; update PDF generation and tests.
7. **mathjax (web)** – 4; update math rendering and tests.
8. **dotenv (backend)** – 17.
9. **nodemailer (backend)** – 8.

---

## After each upgrade

- `npm install` at repo root.
- `npm run test:backend` and `npm run test:web`.
- Run `npm run test:web:e2e` if Playwright is involved.
- Run lint: `npm run lint`.
- Manual smoke: build, preview, and key user flows.
