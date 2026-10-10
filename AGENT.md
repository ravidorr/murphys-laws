# Murphy's Laws - Agent Guide

Canonical instructions for AI coding agents. `CLAUDE.md` and `GEMINI.md` point here; edit this file only.

## Project

Murphy's Laws is a monorepo for a web PWA, Node.js API, iOS and Android apps, a TypeScript SDK, a CLI, and an MCP server.

## Commands

- Install: `npm run install:all`
- Lint: `npm run lint`
- Test: `npm test`
- Coverage: run each affected package's coverage command; 100% lines, functions, branches, and statements are mandatory on push and in CI.
- Build: `npm run build`
- Full CI: `npm run ci`

## Rules

- Never commit with `--no-verify`, push with `--no-verify`, force-push, or use an environment variable that bypasses a hook. Fix the cause when a safeguard fails.
- This repository uses GitHub issues for ticketing. Do not require an issue for every change.
- Keep changes focused, use descriptive semantic commit messages, and open pull requests as drafts.
- Linters are strict. Do not weaken ESLint, Stylelint, html-validate, markdownlint, TypeScript, tests, or coverage thresholds to pass.
- Add or update tests for code changes. Use `/* v8 ignore */` only for genuinely untestable code paths.
- UI work uses `web/DESIGN.md` as the authoritative design contract and `web/styles/partials/variables.css` as the authoritative token values. `shared/DESIGN.md` is a generated cross-platform mirror. `design-system/` is a documentation wrapper and showcase. Do not add a competing token source or use inline styles.
- Pin Node with `.nvmrc`; the package manager is npm. Keep `package-lock.json` committed.
- Update `CHANGELOG.md` and apply the appropriate version bump when a release-bearing package changes. Documentation-only, test-only, and tooling-only changes do not require a release bump.
- Track open work in `TODO.md`.

## Structure

- `backend/` - Node.js API, SQLite database, migrations, and operational scripts.
- `web/` - Vite PWA using vanilla TypeScript.
- `ios/` - Swift and SwiftUI application.
- `android/` - Kotlin and Jetpack Compose application.
- `shared/` - Shared content, modules, design contracts, and documentation.
- `sdk/` - Published TypeScript client library.
- `cli/` - Published command-line interface.
- `mcp/` - Published Model Context Protocol server.
- `design-system/` - Design-system documentation and static showcase.
- `.husky/` - Git hooks.
- `.github/` - CI workflows and contribution templates.
