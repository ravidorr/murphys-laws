---
name: ship
description: >
  End-of-change shipping workflow for the murphys-laws project. Use this skill whenever
  code has been added, changed, or deleted and the changes are ready to be committed and
  shipped — even if the user just says "ship it", "commit and push", "make a PR", or
  "bump version". Covers version bumping, CHANGELOG, commit, rebase, push, and PR creation.
---

# Ship - murphys-laws end-of-change workflow

Run these steps in order every time code changes are ready to ship.

---

## 1. Understand what changed

Before touching versions or commit messages, get oriented:

```bash
git diff --stat HEAD
git status
```

Read the changed files so you can write a meaningful CHANGELOG entry and commit message.
Pick the right conventional-commit prefix:
- `fix:` - bug fix, error suppression, crash prevention
- `feat:` - new capability visible to users
- `chore:` - maintenance, dependency bump, config, tooling, tests

---

## 2. Bump versions

Bump the root `package.json` on every ship. Bump a sub-package's `package.json` **only if code inside that sub-package actually changed**.

| File | Scheme | Example | When to bump |
|------|--------|---------|--------------|
| `package.json` (root) | `MAJOR.MINOR.PATCH` | `2.1.1` → `2.1.2` | Always. Drives the Sentry `release` tag across the repo. |
| `web/package.json` | `MAJOR.MINOR.PATCH` | `3.1.35` → `3.1.36` | Only when files under `web/` changed. Version is embedded in built web assets and Sentry web releases. |
| `backend/package.json` | `MAJOR.MINOR.PATCH` | `2.0.14` → `2.0.15` | Only when files under `backend/` changed. |
| `mcp/package.json` | `MAJOR.MINOR.PATCH` | - | Only when files under `mcp/` changed. |

Increment only the **PATCH** segment of each unless the change warrants MINOR (new user-facing feature) or MAJOR (breaking change).

> **Why this rule?** Sub-package versions tag releases *for that sub-package*. Bumping `web/package.json` when no web code changed creates a phantom web release in Sentry dashboards that corresponds to zero user-facing change, which is the opposite of "keep dashboards clean". The root bump is always fine because it tags the monorepo-level ship.

### How to decide what changed

Before bumping, inspect the staged diff per sub-package:

```bash
git diff --cached --stat -- web/
git diff --cached --stat -- backend/
git diff --cached --stat -- mcp/
```

If a directory shows no output, do **not** bump that sub-package's version. `package-lock.json` updates driven purely by the root version bump do not count as a sub-package change.

---

## 3. Add a CHANGELOG entry

Open `CHANGELOG.md`. Under `## [Unreleased]`, add a bullet under the appropriate heading (`### Fixed`, `### Changed`, or `### Added`). Add the heading if it doesn't exist yet.

Keep the bullet concise and user-facing - one sentence that describes *what changed and why it matters*, not the implementation detail. Match the tone of existing entries.

**Example format:**
```
### Fixed
- Suppress Sentry noise from `window.webkit.messageHandlers` TypeError thrown by Google
  FundingChoices/AdSense scripts probing for iOS native WebView in the Facebook in-app browser
```

---

## 4. Rebase on main

Always rebase on `origin/main` before committing. Main may have fixes (e.g. the `serialize-javascript` vulnerability fix) that the pre-push hook requires. Without this rebase the hook will fail.

```bash
git fetch origin main
git rebase origin/main
```

If there are conflicts, resolve them (keep both sides unless they're contradictory), then `git rebase --continue`. After resolving:
- Check `SENTRY_IGNORED_ERROR_PATTERNS` pattern count in `web/tests/sentry-ignore-patterns.test.ts` and update the assertion if main added new patterns.

---

## 5. Commit

Stage all relevant changed files by name - never `git add .` blindly:

```bash
git add <file1> <file2> ...
```

Then commit using a heredoc so formatting is preserved:

```bash
git commit -m "$(cat <<'EOF'
<prefix>: <short imperative description, max 72 chars, no period>

<body: what changed and why, wrapped at 100 chars, 1-3 sentences,
casual developer-to-developer tone - no jargon, no buzzwords>
EOF
)"
```

### Commit message rules
- **No JIRA prefix** - this project doesn't use JIRA
- Lowercase after the prefix colon
- Imperative mood: "add", "fix", "suppress", "bump", "remove"
- No trailing period on the subject line
- Body explains *what* and *why*, not *how*
- Avoid: "comprehensive", "robust", "enhanced", "leveraged", "implemented"

**Good examples:**
```
fix: suppress webkit.messageHandlers Sentry noise from ad scripts; bump to 2.1.2 / 3.1.36

Google FundingChoices/AdSense scripts probe window.webkit.messageHandlers to detect iOS native
WebViews. In the Facebook in-app browser, window.webkit exists but messageHandlers doesn't,
causing a TypeError that was flooding Sentry.
```

```
chore: bump vite-plugin-pwa to 1.x and force serialize-javascript 7.0.5

Fixes two high-severity GHSA advisories that were blocking the pre-push audit hook.
The pwa plugin's API is unchanged for our use case.
```

---

## 6. Push

```bash
git push -u origin <current-branch>
```

If the pre-push hook fails with an **npm audit** error, you likely missed step 4 - the fix lives on main. Go back and rebase. Do not use `--no-verify`.

If the hook fails for another reason (lint, typecheck, test), fix the underlying issue and create a new commit rather than amending.

---

## 7. Open a PR

```bash
gh pr create \
  --title "<prefix>: <same short description as commit subject>" \
  --body "$(cat <<'EOF'
## Summary

- <bullet: what changed>
- <bullet: why it matters / what it fixes>

## Test plan

- [ ] <specific thing to verify>
EOF
)"
```

Return the PR URL to the user.

---

## Quick-reference checklist

```
[ ] Read the diff - understand what changed
[ ] Bump root package.json patch
[ ] Bump web/package.json patch
[ ] Add CHANGELOG bullet under [Unreleased]
[ ] git fetch origin main && git rebase origin/main
[ ] git add <files>
[ ] git commit (no JIRA, conventional prefix, body ≤100 cols)
[ ] git push -u origin <branch>
[ ] gh pr create
[ ] Return PR URL
```
