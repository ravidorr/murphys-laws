# Murphy's Laws - Agent Guide

Canonical instructions for AI coding agents. `CLAUDE.md` and `GEMINI.md` point here; edit this file only.

## Project

Murphy's Laws is a monorepo for a web PWA, Node.js API, iOS and Android apps, a TypeScript SDK, a CLI, and an MCP server.

## Commands

- Install: `npm run install:all`
- Lint: `npm run lint`
- Test: `npm test`
- Coverage: Node packages run 100% coverage checks for relevant staged changes before commit and in CI. Mobile platform checks enforce their configured thresholds in CI and may be deferred locally when the required toolchain is unavailable.
- Build: `npm run build`
- Node/workspace CI: `npm run ci`
- Mobile CI: use the iOS and Android GitHub Actions workflows for platform-specific validation.

## Rules

- Never commit with `--no-verify`, push with `--no-verify`, force-push, or use an environment variable that bypasses a hook. Fix the cause when a safeguard fails.
- This repository uses GitHub issues for ticketing. Do not require an issue for every change.
- Keep changes focused, use descriptive semantic commit messages, and open pull requests as drafts.
- Linters are strict. Do not weaken ESLint, Stylelint, html-validate, markdownlint, TypeScript, tests, or coverage thresholds to pass.
- Add or update tests for code changes. Use `/* v8 ignore */` only for genuinely untestable code paths.
- UI work uses `web/DESIGN.md` as the authoritative design contract and `web/styles/partials/variables.css` as the authoritative token values. `shared/DESIGN.md` is a generated cross-platform mirror. `design-system/` is a documentation wrapper and showcase. Do not add a competing token source or use inline styles.
- Pin Node with `.nvmrc`; the package manager is npm. Keep `package-lock.json` committed.
- Update `CHANGELOG.md` and run `npm run check:versions` before committing. Root-level source, configuration, and documentation changes may require a root version bump; package documentation-only changes do not.
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
