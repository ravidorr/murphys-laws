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

Bump the root `package.json` on every ship. Bump a sub-package's version file **only if user-facing code inside that sub-package actually changed**.

| File | Field(s) | Scheme | Example | When to bump |
|------|----------|--------|---------|--------------|
| `package.json` (root) | `version` | `MAJOR.MINOR.PATCH` | `2.1.1` → `2.1.2` | Always. Drives the Sentry `release` tag across the repo. |
| `web/package.json` | `version` | `MAJOR.MINOR.PATCH` | `3.1.35` → `3.1.36` | Only when files that ship in the web bundle changed: `web/**` user-facing code, OR any `shared/` path the web SSG bakes in (today: `shared/content/**`, see [web/scripts/ssg.ts](web/scripts/ssg.ts) constant `SHARED_CONTENT_DIR`). Version is embedded in built web assets and Sentry web releases. **Design-token tooling under `shared/design-tokens/` that emits artifacts for OTHER platforms is NOT a web change for versioning purposes** - bumping web for it creates phantom Sentry web releases. |
| `backend/package.json` | `version` | `MAJOR.MINOR.PATCH` | `2.0.14` → `2.0.15` | Only when files under `backend/` changed. |
| `cli/package.json` | `version` | `MAJOR.MINOR.PATCH` | `0.1.0` → `0.1.1` | Only when files under `cli/` changed. |
| `mcp/package.json` | `version` | `MAJOR.MINOR.PATCH` | `1.2.1` → `1.2.2` | Only when files under `mcp/` changed. |
| `sdk/package.json` | `version` | `MAJOR.MINOR.PATCH` | `0.1.0` → `0.1.1` | Only when files under `sdk/` changed. |
| `ios/project.yml` AND `ios/MurphysLaws/Info.plist` | `MARKETING_VERSION` / `CFBundleShortVersionString` (semver) AND `CURRENT_PROJECT_VERSION` / `CFBundleVersion` (monotonic build number) | semver + integer | `1.0.1` → `1.0.2`, build `2` → `3` | Only when files that ship in the iOS app binary changed: `ios/**`, OR any `shared/` path bundled into the app (today: `shared/content/**`, declared in [ios/project.yml](ios/project.yml) `sources:`). Surfaces in TestFlight, App Store, Sentry iOS dashboards. Keep the same value in `project.yml` and `Info.plist` so XcodeGen regeneration is a no-op. |
| `android/app/build.gradle.kts` | `versionName` (semver) AND `versionCode` (monotonic int) | semver + integer | `versionName "1.0.1"`, `versionCode 2` → `versionName "1.0.2"`, `versionCode 3` | Only when files that ship in the Android app binary changed: `android/**`, OR any `shared/` path copied into app assets (today: `shared/content/**`, declared in the `copySharedContent` task in [android/app/build.gradle.kts](android/app/build.gradle.kts)). Surfaces in Play Console and Sentry Android dashboards. |

Increment only the **PATCH** segment of each unless the change warrants MINOR (new user-facing feature, e.g. bundling a new font, adding a screen, opt-in API) or MAJOR (breaking change). When you bump MINOR or MAJOR on any version file, **alert the user explicitly per the version-bump rule** and confirm before proceeding.

> **Why this rule?** Sub-package versions tag releases *for that sub-package*. Bumping `web/package.json` when no user-facing web code changed creates a phantom web release in Sentry dashboards that corresponds to zero user-facing change, which is the opposite of "keep dashboards clean". The same logic applies to iOS / Android: shipping iOS code with `CFBundleVersion` unchanged makes Sentry iOS dashboards useless for triage. The root bump is always fine because it tags the monorepo-level ship.

### How to decide what changed

Before bumping, inspect the staged diff per platform. **Note that `shared/content/` ships in all three platform binaries (web SSG, iOS resource bundle, Android assets), so it must be probed alongside each platform's own directory:**

```bash
git diff --cached --stat -- web/ shared/content/
git diff --cached --stat -- backend/
git diff --cached --stat -- cli/
git diff --cached --stat -- mcp/
git diff --cached --stat -- sdk/
git diff --cached --stat -- ios/ shared/content/
git diff --cached --stat -- android/ shared/content/
```

If a directory shows no output, do **not** bump that platform's version. `package-lock.json` updates driven purely by the root version bump do not count as a sub-package change.

A PR that touches **only** `shared/content/` (e.g. a copy fix on `about.md`) is a real release on every platform that bundles it: web users see a new build, iOS / Android users get an update via TestFlight / Play. The version files must reflect that. Skipping the bump on iOS / Android specifically can block the next upload because App Store Connect / Play Console reject duplicate `CFBundleVersion` / `versionCode`.

For `web/`, the diff alone isn't enough: also check whether the changed files are user-facing (`web/src/**`, `web/styles/**`, `web/index.html`, `shared/content/**`) versus build-time tooling (`shared/design-tokens/**` exporters that emit to other platforms). Tooling-only diffs do not warrant a `web/package.json` bump.

For package directories (`backend/`, `cli/`, `mcp/`, `sdk/`), treat any package-local source,
test, CLI binary, config, or build wiring change as a package release unless it is clearly
documentation-only. If the package behavior, build, generated types, tests, or published files
change, bump that package.

For platform apps (`ios/`, `android/`), treat app source, app resources, project/Gradle wiring,
and shared bundled content as release-bearing. Do not dismiss a change as "cleanup" if it
touches files that compile into, configure, or bundle the app.

The pre-commit hook runs `npm run check:versions` against staged files. If it fails, bump the
listed version files and stage them; do not bypass the check.

If `ios/project.yml` `sources:` or `android/app/build.gradle.kts` `copySharedContent` (or the equivalent build glue) ever expands to consume more `shared/` paths, update this skill so the probes match the new reality.

### iOS specifics

Two files must move in lockstep so `xcodegen generate` doesn't reset one to the other:

- `ios/project.yml` lines under `settings:` -> `MARKETING_VERSION` (semver string), `CURRENT_PROJECT_VERSION` (build number string).
- `ios/MurphysLaws/Info.plist` -> `<key>CFBundleShortVersionString</key>` (semver), `<key>CFBundleVersion</key>` (build number).

The build number (`CURRENT_PROJECT_VERSION` / `CFBundleVersion`) is monotonic across all ships, regardless of whether semver bumped. App Store Connect rejects uploads with a build number that's already been used.

### Android specifics

`android/app/build.gradle.kts` -> `defaultConfig {}` block:

- `versionName = "1.0.2"` -- semver string. Surfaces to users in Play Store.
- `versionCode = 3` -- monotonic integer. Play Console rejects uploads with a duplicate `versionCode`.

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
[ ] Read the diff - understand what changed AND which platform binaries it lands in
[ ] Bump root package.json (always)
[ ] If user-facing web/ code OR shared/content/ changed: bump web/package.json
[ ] If backend/ code changed: bump backend/package.json
[ ] If cli/ code changed: bump cli/package.json
[ ] If mcp/ code changed: bump mcp/package.json
[ ] If sdk/ code changed: bump sdk/package.json
[ ] If ios/ code OR shared/content/ changed: bump MARKETING_VERSION+CURRENT_PROJECT_VERSION
    in ios/project.yml AND CFBundleShortVersionString+CFBundleVersion in
    ios/MurphysLaws/Info.plist (lockstep)
[ ] If android/ code OR shared/content/ changed: bump versionName + versionCode in
    android/app/build.gradle.kts
[ ] Add CHANGELOG bullet under [Unreleased]
[ ] git fetch origin main && git rebase origin/main
[ ] git add <files>
[ ] git commit (no JIRA, conventional prefix, body ≤100 cols)
[ ] git push -u origin <branch>
[ ] gh pr create
[ ] Return PR URL
```
