# Changelog

All notable changes to the Murphy's Laws project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- iOS CI now runs on pull requests and `main` pushes only, avoiding duplicate macOS jobs when a feature branch with an open PR is updated. Root bumped to `2.4.18`.
- iOS skeleton-loading shimmer now consumes `DS.Color.mutedFg` (light + dark from the Asset Catalog) instead of hand-branching on `@Environment(\.colorScheme)` with hardcoded `Color(white:)` greys. [ios/MurphysLaws/Views/Home/SkeletonViews.swift](ios/MurphysLaws/Views/Home/SkeletonViews.swift). The dark-mode swap is now driven by the system trait collection via `Assets.xcassets/DS/muted-fg.colorset`, matching how every other DS color works. PR iOS-2 of the design-tokens-mobile rollout; calculator and vote-thumb surfaces are explicitly out of scope (HIG-idiomatic semantic colors `.green` / `.orange` / `.red` are correct on iOS), and no rank-style surface exists on iOS to migrate yet. iOS app bumped to `1.0.2` / build `3`; root to `2.4.17`.

### Fixed
- iOS XcodeGen now compiles `MarkdownContentTests.swift` with the unit test target instead of the UI test bundle, avoiding linker failures from `@testable import MurphysLaws` references to app-only content-loading symbols.
- [ios/MurphysLawsTests/CategoryRepositoryTests.swift](ios/MurphysLawsTests/CategoryRepositoryTests.swift) now module-qualifies the remaining explicit `Category` type annotations so the repository tests compile when the Objective-C runtime's `Category` typedef is also visible.
- [ios/MurphysLawsTests/CategoryRepositoryTests.swift](ios/MurphysLawsTests/CategoryRepositoryTests.swift) helper `deduplicateByTitle` now uses module-qualified `MurphysLaws.Category` for its parameter, return, and local types so the file compiles in the test bundle. The C typedef `typedef struct objc_category *Category` from the Objective-C runtime is visible to test files via `@testable import MurphysLaws` (the runtime import is implicit), creating an ambiguous type lookup that production files don't see because `MurphysLaws.Category` wins ambient resolution inside its own module. The previously committed (hand-edited) `project.pbxproj` had silently dropped this file from the test target to dodge the error; once `xcodegen generate` rebuilds the project from `project.yml` the file is included again, surfacing the latent breakage. Call sites elsewhere in the file (`Category(id: ...)` initializers) disambiguate via initializer signature and don't need the qualifier. Credit: P1 surfaced by Codex review on this PR.
- iOS CI now regenerates the Xcode project via XcodeGen before `xcodebuild`. The committed [ios/MurphysLaws.xcodeproj/project.pbxproj](ios/MurphysLaws.xcodeproj/project.pbxproj) doesn't list the freshly-regenerated `DesignSystem/Tokens.swift` as a source, so `xcodebuild` skipped it and the build failed with `cannot find 'DS' in scope` even after the regen step succeeded. Workflow now installs XcodeGen via `brew install xcodegen` and runs `xcodegen generate` after the design-token regen, rebuilding `project.pbxproj` from `project.yml` so every file under `MurphysLaws/` (including the gitignored generated outputs) is picked up. Drops the now-redundant `if [ -f project.pbxproj ]` gate and the `Skip` branch since the project is always regenerated. Credit: P1 flagged by Codex review on this PR.
- [ios/project.yml](ios/project.yml) cleaned up so XcodeGen runs cleanly: dropped the `info:` block whose `properties:` regenerated `Info.plist` from YAML on every `xcodegen generate` (clobbering the hand-edited `CFBundleShortVersionString` / `CFBundleVersion`), and added a `**/Info.plist` glob exclude on the `MurphysLaws/` source scan. The glob (vs a bare `Info.plist`) is required because there's also a stray scaffolded plist at [ios/MurphysLaws/Repositories/Info.plist](ios/MurphysLaws/Repositories/Info.plist) (likely leftover from an earlier framework-style structure) that XcodeGen would otherwise pick up as a second Copy Bundle Resources entry, surfacing the same `Multiple commands produce ... MurphysLaws.app/Info.plist` build error the bare-name fix was meant to avoid. The hand-authored [ios/MurphysLaws/Info.plist](ios/MurphysLaws/Info.plist) is now the single source of truth, consumed via the existing `INFOPLIST_FILE` setting. Verified locally: regen no longer touches `Info.plist`, version numbers stay at the values the ship skill set, and the regenerated `project.pbxproj` lists both `DesignSystem/Tokens.swift` and `SkeletonViews.swift` as sources with zero references to the stray `Repositories/Info.plist`.
- iOS and Android CI workflows ([.github/workflows/ios-ci.yml](.github/workflows/ios-ci.yml), [.github/workflows/android-ci.yml](.github/workflows/android-ci.yml)) now install Node and run `npm ci` before the platform build so the gitignored design-token outputs (`Tokens.swift` / `Tokens.kt` / colorsets / `colors.xml` / `dimens.xml`) regenerate from `shared/DESIGN.md`. Without this, the iOS build of this PR (the first to reference `DS.Color.*` from app code) failed with `cannot find 'DS' in scope`; the same trap waits for Android in PR Android-1. iOS workflow gains an explicit `Regenerate iOS design tokens` step (`npm --prefix web run design:export:ios`) before `xcodebuild`; Android relies on the existing `exportDesignTokens` Gradle task wired into `preBuild`, which now finds `npm` on PATH. Path filters expanded to also trigger on `shared/DESIGN.md` and `web/scripts/export-{ios,android}-tokens.ts` so generator changes get validated against the platform builds. Closes the gap exposed when PR iOS-1 (#92) merged with the gitignored-outputs model but before any Swift code consumed `DS`.

### Added
- iOS design-token codegen. New [web/scripts/export-ios-tokens.ts](web/scripts/export-ios-tokens.ts) (wired as `npm --prefix web run design:export:ios`) reads `shared/DESIGN.md` and emits a SwiftUI `DS` namespace at `ios/MurphysLaws/DesignSystem/Tokens.swift` plus a per-token Asset Catalog folder at `ios/MurphysLaws/Assets.xcassets/DS/`. The `DS` namespace exposes `DS.Color.*` (Asset Catalog references for system-managed dark-mode pairing), `DS.Spacing.s1..s16`, `DS.Radius.sm..full`, and `DS.Typography.<level>` with pre-computed additive `lineSpacing` (since SwiftUI's `lineSpacing` is additive while CSS `line-height` is a multiplier). Asymmetric web/dark pairings are explicitly mapped via `DARK_PAIR_OVERRIDES`: `bg`->`dark-bg-primary`, `fg`->`dark-fg-primary`, `success-text`->`dark-success-fg` (and the parallel `error/warning/orange-text`->`dark-*-fg`), plus `dark-bg`->`dark-dark-bg` and `dark-text`->`dark-dark-fg` for the calc-dark "dark emphasis" surface. The skip rule for `dark-`-prefixed tokens lets override keys through, and the `darkOnly` pass guards against double-emission, so `DS.Color.darkBg` adapts to dark mode just like every other paired colour. Dark-mode-stable tokens (`white`, `success`, `error`, `important`, gradients) skip pairing per the `NO_DARK_PAIR` set. **Generated outputs are gitignored**: `ios/MurphysLaws/DesignSystem/` and `ios/MurphysLaws/Assets.xcassets/DS/` are produced fresh by [ios/generate-xcode-project.sh](ios/generate-xcode-project.sh) before `xcodegen generate`, and on demand via `npm --prefix web run design:export:ios`. There's no committed baseline to drift from, which is why `--check` is a smoke test (verify the generator runs, returns non-empty `Tokens.swift` and at least one colorset) rather than a diff comparison. Typography uses `Font.system` placeholders until Work Sans is bundled (deferred; PR iOS-3). 26 vitest cases. iOS app bumped to `1.0.1` / build `2`; root to `2.4.17`. `web/package.json` not bumped (per ship skill: `web/scripts/` tooling that emits to other platforms is not a user-facing web change).

### Fixed
- Pre-commit drift guard no longer auto-stages WIP Markdown body edits on `web/DESIGN.md` or `shared/DESIGN.md`. [web/scripts/sync-design-tokens.ts](web/scripts/sync-design-tokens.ts) gains a `--hook` mode that refuses to run (and fails the commit with a helpful error) if either output has unstaged changes in the working tree. Without the guard, a developer editing the DESIGN.md body and a variables.css token in parallel would have the body edits silently carried through on commit via `extractBody()` + `git add`. The guard is hook-only; `npm run design:sync` still works unconditionally. Credit: flagged by Codex review on [#86](https://github.com/ravidorr/murphys-laws/pull/86). 5 new vitest cases.
- Pre-commit hook no longer races on `web/styles/partials/variables.css`. The broader `web/styles/**/*.css` glob in [.lintstagedrc.json](.lintstagedrc.json) is scoped down to `web/styles/**/!(variables).css` so it doesn't match variables.css, and variables.css's task array now runs stylelint -> sync -> git add sequentially in a single ordered pipeline. Previously both globs matched variables.css and lint-staged ran them concurrently; sync could read pre-stylelint-fix CSS. Current output was still correct (stylelint auto-fixes don't change variable values, and the sync's `normalizeHex` neutralises shorthand / casing differences) but the race was a latent footgun for any future change to either tool. Credit: flagged by Codex review on [#86](https://github.com/ravidorr/murphys-laws/pull/86).

### Added
- Cross-platform token mirror at [shared/DESIGN.md](shared/DESIGN.md). [web/scripts/sync-design-tokens.ts](web/scripts/sync-design-tokens.ts) now regenerates `shared/DESIGN.md` in lockstep with `web/DESIGN.md`; the shared file carries identical YAML front matter (52 colors, 9 typography scales, 5 rounding levels, 10 spacing tokens, 21 components) but strips the web-specific Markdown body (elevation story, Stitch workflow, component contracts tuned for vanilla-TS). iOS (`ios/`) and Android (`android/`) consumers can read the same token catalogue the web uses without depending on web prose. `npm run design:check` and the pre-commit `lint-staged` hook both validate/regenerate the mirror alongside `web/DESIGN.md`, so edits to `variables.css` are single-source-of-truth. 7 new vitest cases cover `buildSharedDesignMd` plus the dual-output behaviour of `run`.

### Added
- `npm --prefix web run design:export` emits the DESIGN.md token catalogue as a [Design Tokens Community Group (DTCG)](https://tr.designtokens.org/format/) JSON document at `web/.design-exports/design-tokens.dtcg.json` (gitignored). Designers can import the file into Figma Variables (via Tokens Studio or Figma's native JSON import) or feed it into Style Dictionary / any DTCG-aware pipeline without hand-translating `web/DESIGN.md`'s YAML. Output reuses the `parseCssVariables` + `classifyTokens` pipeline from [web/scripts/sync-design-tokens.ts](web/scripts/sync-design-tokens.ts), so the export can never drift from what `design:check` publishes. Nested shape: `color.*`, `dimension.spacing.*`, `dimension.radius.*`, `typography.*` (composite tokens), `component.*` (references into the base tokens). The export is intentionally NOT in `ci:web`; `design:check` remains the server-side gate. 22 new vitest cases cover the build / reference rewriting / type inference / run-mode behaviour.

### Added
- Five more chrome components in the `COMPONENTS` contract driven by [web/scripts/sync-design-tokens.ts](web/scripts/sync-design-tokens.ts): `notification`, `header`, `footer`, `breadcrumb`, `search-autocomplete`. These are the pieces AI agents most often regenerate without consulting the design contract, so pinning them as explicit token references in `web/DESIGN.md`'s YAML front matter makes the contract binding on those surfaces too. Component count 16 -> 21; ignored-warning count 35 -> 34 (`muted-fg` is now referenced by `footer` / `breadcrumb` so it drops out of the unreferenced bucket). Translucent backgrounds on `header` and floating surfaces remain intentionally untokenized (see "Elevation & Depth" in the Markdown body) because DESIGN.md requires literal `#HEX`. One new vitest case asserts presence of each new component.

### Added
- `web/DESIGN.md`: adopted Google Labs' [DESIGN.md](https://github.com/google-labs-code/design.md) format as the web's design-system contract. YAML front matter (52 colors, 9 typography levels, 5 rounding tokens, 10 spacing tokens, 15 components) is regenerated from `web/styles/partials/variables.css` by `web/scripts/sync-design-tokens.ts`; the Markdown body is authored (tone, a11y posture, elevation, shapes, workflow). New `npm run design:check` in `web/` runs drift detection plus `@google/design.md lint` and is wired into `ci:web`; WCAG-AA contrast failures are promoted from warnings to errors so sub-threshold pairs fail the build. Stitch-generated mockups live in `web/.stitch/` (gitignored) and are never shipped. Adds 35 vitest cases and pins `@google/design.md@0.1.1` as a web devDependency.

### Added
- A11y focus trap on the PWA install prompt ([web/src/components/install-prompt.ts](web/src/components/install-prompt.ts)). Opening either variant (generic / iOS) now moves keyboard focus to the primary CTA on the next paint, traps Tab / Shift+Tab inside the dialog, dismisses on Escape (via the existing `data-action="dismiss"` path so the 7-day cooldown still applies), and restores focus to the previously-focused element on close. Both variants gain `aria-modal="true"` to match the newly-enforced modal behavior. The document-level keydown listener tears down on `hideInstallPrompt` and `_resetForTesting`, so no listener leaks between sessions. 17 new vitest cases; no change to the 76 pre-existing install-prompt tests. Closes the a11y gap called out in the Stitch dogfood write-up.
- `rank` component contract in `web/DESIGN.md` (and matching entry in the `COMPONENTS` constant in [web/scripts/sync-design-tokens.ts](web/scripts/sync-design-tokens.ts)) so the `text-high-contrast` token, used by `.rank` numerals on top-voted / trending / recently-added lists via [web/styles/partials/utilities.css](web/styles/partials/utilities.css), is no longer flagged as unreferenced by `@google/design.md lint`. Component count 15 -> 16; ignored-warning count 36 -> 35. `dark-text-high-contrast` stays in the ignored bucket; paired `dark-*` tokens are theme-swapped via `theme.css` rather than referenced by component contracts, consistent with the rest of the dark-mode palette.
- Pre-commit drift guard in [.lintstagedrc.json](.lintstagedrc.json): staging `web/styles/partials/variables.css` now runs `tsx web/scripts/sync-design-tokens.ts` and auto-stages the regenerated `web/DESIGN.md`. CI's `design:check` is still the server-side gate; this is a client-side nudge that saves a round-trip.

### Changed
- PWA install prompt (`web/src/components/install-prompt.ts` + `web/styles/partials/install-prompt.css`) redesigned, first Stitch dogfood: primary `Install` / `Got it` is now a full-width filled row, secondary `Not now` (generic only) is a bordered button, and `Never show again` is a text-only tertiary. Adds a tinted icon plate behind the app icon. Microcopy shifted on-brand ("Preserve the documentation of inevitable failure for offline consultation." and "Add this archive to your home screen for immediate reference."). Behavior, `data-action` contract, `role="dialog"` / aria wiring, and the `install-prompt-visible` enter animation are unchanged; all 76 existing install-prompt tests still pass without edits. Dogfood write-up appended to `web/DESIGN.md` under `## Workflow`.
- Android toolchain bumped: Android Gradle Plugin `9.1.1` -> `9.2.0` and Gradle wrapper `9.3.1` -> `9.4.1`. Keeps the Android build on current toolchain releases; no app code changes.

### Fixed
- Resolved two high-severity `npm audit` advisories via `npm audit fix`: `@xmldom/xmldom` `0.9.9` -> `0.9.10` and `speech-rule-engine` `4.1.3` -> `4.1.4` (both transitive via MathJax). Unblocks the pre-push audit hook; no consumer code changes.

### Added
- GitHub Actions workflow `.github/workflows/mcp-registry-publish.yml` that re-publishes `com.murphys-laws/murphys-laws` to the MCP Registry whenever `mcp/server.json` changes on `main` (or via manual `workflow_dispatch`). Guardrails: reads the version out of `server.json`, verifies the referenced `murphys-laws-mcp@<version>` actually exists on npm (otherwise aborts), installs `mcp-publisher`, authenticates via DNS using a new `MCP_PUBLISHER_PRIVATE_KEY` repo secret, publishes, and verifies the live registry entry by filtering the search response for an exact `server.name` match (not `servers[0]`, since search ordering is not guaranteed). Key rotation instructions in `mcp/README.md`.

### Fixed
- `mcp-registry-publish.yml` is now idempotent: the registry rejects duplicate-version publishes with a 400 error, so a `workflow_dispatch` or path-trigger re-run with no version change used to fail. New pre-flight step queries the registry for the current version and skips the publish (and auth/install) steps when `server.json`'s version is already live. Verification always runs, so a green workflow always means "registry matches server.json" - whether we just published or the state was already correct.

### Fixed
- `mcp/server.json` description trimmed from 140 chars to 79 so it passes the MCP Registry's `description <= 100` validation. The old longer description on `mcp/package.json` is unchanged (npm has no such limit). The MCP Registry now lists `com.murphys-laws/murphys-laws@1.2.1` and resolves to `npm:murphys-laws-mcp@1.2.1`.

### Changed
- `murphys-laws-mcp` bumped to `1.2.1`: corrected `mcpName` (and the matching `name` in `mcp/server.json`) from `murphys-laws.com/murphys-laws` to the reverse-DNS form `com.murphys-laws/murphys-laws` required by the [MCP Registry naming rules](https://modelcontextprotocol.io/registry/authentication). The old value was malformed - neither a `io.github.*` nor a reverse-DNS `com.*` namespace - which is why the initial registry submission never actually landed (registry search still returns 0 hits). The npm package, stdio behavior, and 7 tool surface are otherwise unchanged.
- `mcp/server.json` pinned both its own `version` and the bundled npm `packages[0].version` to `1.2.1` so registry publish (once credentials are set up) reflects the current artifact on npm.
- `.gitignore` now excludes `.config/`. That directory holds local-only MCP Registry signing keys (Ed25519 private key, DNS-based auth); it must never enter git.

### Added
- `sdk/README.md` and `cli/README.md` gained "Cookbook" sections with real usage patterns (pagination, cron posters, jq pipelines, discriminated-union submit handling, injected `fetch` for tests, custom User-Agents, running against a local backend, exit-code-driven shell logic).
- All three published package READMEs (`sdk/`, `cli/`, `mcp/`) now carry CI status and coverage badges in addition to npm version / downloads / license.

### Changed
- `murphys-laws-mcp` bumped to `1.2.0`: each of the 7 tool files now calls the SDK's typed methods (`api.searchLaws`, `api.getRandomLaw`, etc.) instead of the low-level `api.get`/`api.post` with hand-rolled response interfaces. Net `-109` lines across `mcp/src/`; the biggest win is `submit-law.ts` which delegates category-slug resolution and discriminated-union error handling to the SDK. No behavior change for AI hosts using the server; the 7 tool names, descriptions, and output formatting are identical.

### Fixed
- `npm audit` no longer reports the two moderate advisories that had been nagging every push: `dompurify` bumped `3.3.3 -> 3.4.0` (transitive via `jspdf` in web) and `hono` bumped `4.12.12 -> 4.12.14` (transitive via `@modelcontextprotocol/sdk` in mcp). Resolved cleanly with `npm audit fix`; no consumer code changes. All 3105 tests still pass.
- `npm run lint:md` now ignores the gitignored `CLAUDE.md`, `.cursor/**`, and `.claude/**` paths. These local-only config files don't exist on a fresh clone but were producing noisy errors whenever a contributor had them present locally. CI was never affected - this just quiets local `npm run lint:md` output.
- `cli-ci.yml` and `mcp-ci.yml` now build the SDK before running typecheck / lint / tests. `murphys-laws-sdk`'s `main` points at `dist/index.js`, and `npm ci` alone doesn't build workspace members, so consumers couldn't resolve the module on a fresh runner.

### Added
- GitHub Actions workflows `sdk-ci.yml`, `cli-ci.yml`, and `mcp-ci.yml` so SDK/CLI/MCP now run typecheck + lint + test (95% coverage) + build on every push/PR that touches them. CLI and MCP workflows also trigger on `sdk/**` changes so SDK-breaking refactors are caught in consumer packages. `mcp-ci.yml` additionally runs a stdio handshake smoke test that boots the server and asserts `tools/list` returns 7 tools.
- Vitest suite for `murphys-laws-mcp`: 48 tests across `format.ts`, each of the 7 tool registrations (with mocked SDK client), and `server.ts` wiring. 100% coverage. `mcp/` also gains an ESLint config mirroring the other workspaces.
- `murphys-laws-sdk` (`sdk/`) package: typed TypeScript client over the public REST API, zero runtime deps. Ships typed methods for all `/api/v1/*` endpoints plus a discriminated `SubmitLawResult` union. Published at `0.1.0`.
- `murphys-laws-cli` (`cli/`) package: command-line wrapper around the API (`murphy search`, `random`, `today`, `get`, `categories`, `category`, `submit`). Supports `--json`, `--no-color`, `--base-url`, `--user-agent`. Exit codes document success (0), not-found (1), usage error (2), rate-limited (3), network error (4). Published at `0.1.0`.
- Write endpoints now emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` response headers on both success and 429 responses so clients can back off proactively.
- `shared/docs/API.md` gained a versioning & stability section (`/api/v1/` is stable, breaking changes ship under `/api/v2/`, deprecations via `Deprecation`/`Sunset` headers) and User-Agent guidance.
- `/developers` page now documents the SDK, CLI, current per-minute write rate limits, and the new `X-RateLimit-*` headers.
- MCP (Model Context Protocol) server (`mcp/`) with 7 tools for AI agent integration: `search_laws`, `get_random_law`, `get_law_of_the_day`, `get_law`, `list_categories`, `get_laws_by_category`, `submit_law`
- MCP server published to npm as `murphys-laws-mcp` - install with `npx murphys-laws-mcp` (no clone needed)
- MCP server submitted to the [MCP Registry](https://registry.modelcontextprotocol.io) for discovery by AI hosts
- `/developers` page on the website with REST API docs, MCP setup, feeds, and machine-readable resources
- `llms-full.txt` with detailed API docs, example responses, all 55 category slugs, and MCP setup instructions
- MCP section in `llms.txt` linking to full reference and listing available tools

### Changed
- `murphys-laws-mcp` bumped to `1.1.2`: added dev-only vitest + eslint deps and config for the new test suite. Build output (`dist/`) unchanged; published runtime behavior unchanged. Also split `tsconfig.build.json` from `tsconfig.json` so tests compile under the same strict TS settings without getting shipped in the tarball.
- `murphys-laws-mcp` bumped to `1.1.1`: removed the backwards-compatible `api-client.ts` shim; all tools now import `MurphysLawsClient` and `ApiError` directly from `murphys-laws-sdk`. MCP handshake `serverInfo.version` now reads from `package.json` at runtime so it stays in sync on every bump (previously hard-coded to `1.0.0`). Outgoing API calls send `User-Agent: murphys-laws-mcp/<version>`.
- Root `README.md` gained a discoverability table with live npm version badges for the SDK, CLI, and MCP packages. Each sub-package README also carries npm version/downloads/license shields.
- `murphys-laws-mcp` bumped to `1.1.0`: now consumes the new `murphys-laws-sdk`. Behavior unchanged; the local `api-client.ts` remains as a backwards-compatible shim that delegates to the SDK and will be removed in the next minor.
- Root `package.json` workspaces now include `sdk` and `cli`; CI/test/lint scripts gained `ci:sdk`, `ci:cli`, `test:sdk`, `test:cli`, `lint:sdk`, `lint:cli` entries with the same 95% coverage gate as the other workspaces.
- Rate limits documented on `/developers` and in `shared/docs/API.md` now match the code (3 submissions/min, 30 votes/min) instead of the stale per-hour numbers.
- Clean up iOS `.gitignore`: replace the scoped `xcuserdata` entries with the idiomatic `**/xcuserdata/` pattern, narrow the blanket `project.xcworkspace/xcshareddata/` rule to `**/IDEWorkspaceChecks.plist` (so legitimate shared workspace settings stay tracked), and `git rm --cached` the two previously-tracked `UserInterfaceState.xcuserstate` files so they stop producing diffs every time Xcode is opened. The ignore rule added in the AGP bump PR was not enough on its own because the files were already tracked.
- Refine the `ship` skill: only bump a sub-package's version (`web/`, `backend/`, `mcp/`) when code inside that sub-package actually changed. The root `package.json` still bumps on every ship (drives the Sentry release tag); sub-package bumps are gated on actual diffs so Sentry sub-package releases stop corresponding to zero-change ships.
- Bump Android Gradle Plugin from `9.1.0` to `9.1.1` (patch update); add `ios/*.xcodeproj/project.xcworkspace/xcuserdata/` to `.gitignore` so Xcode's per-user IDE state stops showing up as a diff
- MCP server rewritten to use the public REST API instead of direct SQLite access, making it fully standalone and publishable to npm
- Track `.claude/` project config in git (`settings.json`, `launch.json`, `skills/`); exclude ephemeral paths (`worktrees/`, `settings.local.json`, `memory/`)
- Add `ship` skill: step-by-step end-of-change workflow (version bump, CHANGELOG, rebase, commit, push, PR)

### Fixed
- Suppress Sentry noise from Android WebView JS-to-Java bridge teardown (`Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone`). Fired on `beforeunload` inside the Facebook in-app browser when its injected keyboard-logging bridge's Java object has already been GC'd. Not our code, not actionable. Pattern `/Java object is gone/i` also covers equivalent teardown races in other Android in-app browsers.
- Fix jsdom 28 ESM breakage: added `html-encoding-sniffer` override to 4.0.0 (the `@exodus/bytes` transitive dep is ESM-only, breaking vitest's jsdom environment)
- Fix flaky rate-limit test: replaced `vi.advanceTimersByTime` (hung due to module-level `setInterval`) with `vi.setSystemTime`; added `afterEach` cleanup
- Fix high-severity `serialize-javascript` vulnerability (GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v): upgraded `vite-plugin-pwa` to `^1.0.0` (adds vite@7 support, removes need for `legacy-peer-deps`), added npm `overrides` to force `serialize-javascript@7.0.5` throughout the tree
- Drop Sentry noise from GA gtag beacon failures: "Non-Error promise rejection captured with value: undefined" has no stack trace and is not actionable - added to the ignore list
- Suppress Sentry noise from `window.webkit.messageHandlers` TypeError thrown by Google FundingChoices/AdSense scripts probing for iOS native WebView in the Facebook in-app browser
- Fix duplicate Sentry captures for unhandled rejections: remove manual `captureException` from the `unhandledrejection` handler since Sentry's SDK already auto-captures these; also suppress the error banner when `event.reason` is null/undefined
- Drop Sentry errors originating in third-party ad scripts (googlesyndication.com, doubleclick.net, googleadservices.com) via Sentry `denyUrls`; these are AdSense bugs outside our control
- Suppress false "Something went wrong" error banner for DuckDuckGo Mobile users - WebKit throws a `SecurityError` DOMException with message `invalid origin` when blocking service worker registration; suppression now scoped to `SecurityError` only so unrelated origin/CORS errors still surface to users
- Bump brace-expansion, nodemailer, picomatch via `npm audit fix` (moderate vulnerabilities)
- Remove redundant app tarball from backup script (code is in git); fix .env backup path from `APP_DIR/.env` to `APP_DIR/backend/.env`

### Changed
- Add CLAUDE.md to .gitignore; add .claude/settings.json with acceptEdits mode and command allowlist

## [2.1.1] - 2026-03-21

### Fixed
- Service worker `navigateFallbackDenylist` now excludes root-level `.txt`, `.xml`, `.json`, `.rss`, `.atom` files so `/llms.txt`, `/robots.txt`, `/openapi.json`, and sitemaps are served as-is instead of returning `index.html`
- Add unit tests (`sw-denylist.test.ts`) validating the denylist regex against static files, API routes, and SPA routes; removed misleading e2e tests that bypassed the SW entirely
- Bump version to 2.1.1

## [2.1.0] - 2026-03-21

### Added
- `llms.txt` for AI agent discovery
- OpenAPI spec (`backend/src/openapi.ts`) auto-generated to `web/public/openapi.json` at build time via new `build:openapi` script
- `GET /api/v1/laws/random` endpoint returns a random published law
- `GET /api/v1/openapi.json` endpoint serves the spec dynamically
- `Link: rel="describedby"` header on all API JSON responses pointing to the OpenAPI spec
- JSON-LD structured data (`Article` + `Quotation` schema) injected into law detail pages for better agent/search engine understanding
- `web/public/openapi.json` added to `.gitignore` (generated by CI, not committed)

### Changed
- `robots.txt`: disallow `/api/` for generic crawlers; explicitly allow `/api/` for known AI agent bots (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.)
- `npm run build` now includes `build:openapi` step
- Bump version to 2.1.0

## [2.0.59] - 2026-03-03

### Fixed
- Fix CI branch coverage gap: annotate platform-specific `truncateText` while loop in `og-image.service.ts` (canvas text measurement returns 0 on Linux headless); annotate unreachable `?? null` fallbacks in `http-helpers.ts`; annotate defensive `??`/`?.` on `req.url`/`req.headers` in `attributions.controller.ts`; add tests for `searchSubmitters` with missing/invalid `q` and `limit` params
- Versions: bump root to 2.0.59, backend to 2.0.14, web to 3.1.33

## [2.0.58] - 2026-03-02

### Changed
- Raise web branch coverage threshold from 92% to 95%; annotate unreachable branches with `/* v8 ignore start/stop */` in `advanced-search.ts`, `law-detail.ts`, `social-share.ts`, `mathjax.ts`, `buttered-toast-calculator.ts`, `sods-calculator.ts`, `category-detail.ts`
- Raise backend branch coverage threshold from 93% to 95%; annotate unreachable setInterval callback and env-var fallback defaults in `rate-limit.ts` and `api-server.ts`
- Add coverage test files: `browse-coverage.test.ts`, `buttered-toast-calculator.test.ts`, `favorites-view.test.ts`, `footer-coverage.test.ts`, `home-coverage.test.ts`, `law-detail-coverage.test.ts`, `mathjax.test.ts`, `social-share.test.ts`
- Fix CI branch coverage gap: annotate platform-specific `truncateText` while loop in `og-image.service.ts` (canvas text measurement returns 0 on Linux headless); annotate unreachable `?? null` in `http-helpers.ts`; annotate defensive `??`/`?.` on `req.url`/`req.headers` in `attributions.controller.ts`; add tests for `searchSubmitters` with missing/invalid `q` and `limit` params
- Versions: bump root to 2.0.58, backend to 2.0.13, web to 3.1.32

## [2.0.57] - 2026-02-28

### Changed
- Backend: strip Markdown escape backslashes (e.g. \=, \+, \*, \!, \-, \.) from law text and titles to ensure clean data for all consumers (Web, Android, iOS). Added migration 014 and updated `build-sqlite.ts` importer with stripping logic and `ON CONFLICT DO UPDATE` support.
- Web: upgrade vite-plugin-pwa to ^1.2.0 to resolve Vite 7 peer dependency conflict.
- Security: added root override for `serialize-javascript` to fix high-severity vulnerabilities.
- Versions: bump root to 2.0.57, backend to 2.0.12, web to 3.1.31.

## [2.0.56] - 2026-02-28

### Fixed
- Web: vote buttons (Upvote, Downvote) sometimes did not respond when clicking the button icon or count; clicks were handled only when the event target was the button element. Handlers now use `closest('button[data-vote]')` so clicks on inner elements trigger voting consistently. Bump root to 2.0.56, web to 3.1.30.

## [2.0.55] - 2026-02-28

### Fixed
- Web: pagination buttons (Browse and Category detail) sometimes did not respond when clicking the button label or icon; clicks were handled only when the event target was the button element. Handlers now use `closest('button[data-page]')` so clicks on inner elements (e.g. `.btn-text`, icon) trigger page navigation consistently. Bump root to 2.0.55, web to 3.1.29.

## [2.0.51] - 2025-02-27

### Removed
- docs/print-ads-debug-console-script.js (one-off production DOM inspection script; print ad selectors are stable, script no longer needed)

## [Unreleased]

### Fixed
- Web: do not show "Something went wrong" banner for known Service Worker transient errors (update/registration failures); still report to Sentry. Add isServiceWorkerTransientError in error-handler with tests; README documents banner vs Sentry. Bump root to 2.0.44, web to 3.1.18.
- PWA: exclude 404.html from service worker precache so install does not fail when server returns 404 for GET /404.html (avoids "Something went wrong" banner from bad-precaching-response). Browse view: catch render/loadPage rejections and harden loadPage error-path so unhandled rejections do not trigger error banner. Sentry: ignore bad-precaching-response. Bump root to 2.0.39, web to 3.1.13.
- Remove law-of-day API preload from index.html to avoid console warning "preloaded but not used within a few seconds" (preload was only consumed on home after SPA boot; on other routes it was never used). Bump root to 2.0.40, web to 3.1.14.
- PWA: handle registration.update() promise rejection (InvalidStateError in Firefox when SW registration is stale). Extract scheduleServiceWorkerUpdateCheck to utils and add unit tests. Bump root to 2.0.41, web to 3.1.15.
- Sentry: ignore InvalidStateError "object is not, or is no longer, usable" (stale SW registration; code already handles via .catch). Bump root to 2.0.42, web to 3.1.16.
- PWA install prompt: safe localStorage get/set helpers to avoid SecurityError in insecure contexts (Safari). Sentry: only ignore browser extension errors; remove SW/SDK/module patterns so we don't hide app errors. README: note only extension errors filtered. Bump root to 2.0.43, web to 3.1.17.

### Changed
- Web: law detail show only one of "Sent by" or "Submitted by" (no duplication); bookmark icon viewBox 0 0 24 24 so size matches vote icons; add test for attribution/submitted dedup. Bump root to 2.0.47, web to 3.1.21.
- Web: favorite button in its own vote-group (border matches up/down); bookmark icon viewBox -24 -24 72 72; tests for viewBox and vote-group wrapper; TODO bookmark not heart. Bump root to 2.0.46, web to 3.1.20.
- Web: hide footer ad shell until ad load is triggered (footer in view or user interaction); no empty "Advertisement" placeholder until then. Observe footer for intersection; add test and README. Bump root to 2.0.45, web to 3.1.19.
- Vote tooltip: single combined tooltip on vote-group ("Upvote or downvote. Votes are anonymous; no login required."); remove per-button tooltips so they do not hide each other; bump root to 2.0.38, web to 3.1.12
- Print: hide all ads in print with broader selectors ([id*="google_ads"], div:has(> iframe) for ad iframe wrappers)
- Ad display: hideAds only on NotFound route; footer-ad-shell hidden when hideAds or insufficient content; print hides .footer-ad-shell, ins, .adsbygoogle, [data-ad-slot] so side-rail ads hidden; bump root to 2.0.37, web to 3.1.11
- Vote UX: move "Votes are anonymous; no login required." to tooltip on vote-group; use data-tooltip on up/down vote buttons (Law of the Day, law detail, law cards); remove .vote-hint; bump root to 2.0.36, web to 3.1.10
- AdSense: scope footer ad CSS to .footer-ad-shell so Google-injected side-rail ads do not get width: 100% and block clicks on main content; bump root to 2.0.35, web to 3.1.9
- Law detail: when law has no title, show "Murphy's Law" with "Murphy's" in accent-text instead of plain "Law"; bump root to 2.0.34, web to 3.1.8
- Favorite: bookmark-with-star icon (outline/filled) instead of heart; vote-group container for up/down buttons; law card title h3.section-title; backend/api fixes; bump root to 2.0.33, web to 3.1.7
- Share: all options (Copy link, X, Email, Facebook, etc.) in popover for cleaner UI; remove always-visible top row; bump root to 2.0.32, web to 3.1.6
- Breadcrumb: single separator before each item after Home (remove duplicate separator after Home); bump root to 2.0.31, web to 3.1.5
- Home: Science of Murphy's Law section is a plain section (always visible); removed details/summary and related CSS; bump root to 2.0.30, web to 3.1.4
- Deploy workflow: install Rollup Linux native binary after npm ci (same fix as backend/web CI); bump root to 2.0.29
- Web CI: install Rollup Linux native binary after npm ci (same fix as backend); bump root to 2.0.28
- Backend CI: install Rollup Linux native binary after npm ci to fix optional deps bug on ubuntu-latest; bump root to 2.0.27
- npm audit fix (lockfile)
- Remove all v8 ignore comments from web and backend (coverage now counts previously excluded branches); backend branch threshold 95% -> 93%, web branch threshold 93% -> 92% after excluded code no longer ignored; bump root to 2.0.26, web to 3.1.3
- Web: use local html-validate disable for typeahead listbox instead of turning prefer-native-element off globally
- Expert UX review fixes: privacy (no contact_value/mailto in API or UI), Submitted By typeahead, PWA prompt once per session after user action with Never show again, download menu on calculators, share URL normalization and copy-link toast, ad gutter, clickable law cards, pagination hint, favorites empty state copy, Sod's Law calculator percentage format; bump root to 2.0.25, backend to 2.0.11, web to 3.1.2
- Web: branch coverage tests across components and views; mathjax test uses setLoaderForTesting to avoid vi.doMock stderr; uncovered-branches.md regenerated from lcov; bump web to 3.1.1

### Added
- QA teardown: SSG pre-render first page of laws on Browse and Category detail pages; retry buttons on all error states (browse, category, home, law-detail); noscript fallback in index.html; URL-addressable filters and pagination on browse and category; share popover (top channels visible, rest in popover); random law navigation on law detail; category tag chips and deep links on cards and law detail; category display-name overrides for editorial consistency; submission flow improvements (email help text, honeypot, success copy); origin story tl;dr and source notes; user-visible error boundary and Sentry context for unhandled errors; lazy-load jsPDF for PDF export
- Pre-commit: run backend tests with coverage (same as CI) so coverage threshold failures are caught locally
- Backend: SpaController and HtmlInjectionService tests; http-helpers and html-injection branch coverage tests to meet 95% threshold
- Server-side HTML injection for /law/:id and /category/:slug (AdSense first-paint content): HtmlInjectionService, SpaController, getCategoryBySlug; nginx proxies those paths to backend; initial response includes law/category title and description in main, with title and meta description in head
- Category pages: expanded descriptions (migration 013) to 2-4 sentences of unique copy per category; category detail view shows full description in a prominent intro section with "About the laws in this category" heading (AdSense / strengthen category pages)
- Law detail pages: "In context" editorial block with category-specific copy to add substantial content per page (AdSense / thin-content); backend returns category_slug and category_name with single-law API; law-context-copy utility and tests
- Categories table: law_context column and migration 012 with per-category "In context" copy; single-law API returns category_context from primary category; frontend uses API value with default fallback
- Backup script in repo: `backend/scripts/backup-murphys.sh` (excludes backend/web node_modules to reduce backup size); deployed to `/usr/local/bin` via deploy and CI
- Backend: tests and coverage for 95% plan (api-server, router, email, database, facebook-signed-request, http-helpers, og-image, feed, laws service/controller; vitest thresholds 95%)

## [2.0.54] - 2025-02-27

### Fixed
- Web: My Favorites showed "1 law saved" but not the law content when a favorite was saved with empty title/text (e.g. from card click before fix). Global favorite handler now extracts title and text from `.law-card-text a`; law-detail related-law handler does the same. Favorites view fetches law from API when stored favorite has no text and re-renders with enriched data. Bump root to 2.0.54, web to 3.1.28.

## [2.0.53] - 2025-02-27

### Changed
- Web: footer ad shell placeholder has no size until ad loads; when ad is displayed it uses its own size. README AdSense visibility note updated. Bump root to 2.0.53, web to 3.1.27.

## [2.0.52] - 2025-02-27

### Changed
- Root `npm run test` now runs all tests (backend unit, web unit, web E2E). Use `npm run test:backend`, `npm run test:web`, or `npm run test:web:e2e` for subsets. README, DEPENDENCY_MAJOR_UPGRADES, GEMINI, MOBILE-REPOSITORY-STRUCTURE docs updated. Bump root to 2.0.52, web to 3.1.26.

### Fixed
- Law detail: prevent law title/quote truncation (overflow-wrap, min-width); In context same card style as Related Laws; increase law context text line-height
- Backup: apply 30-day retention to env_*backup files (find now matches murphys_* and env_*); bump backend to 2.0.10
- Backend: add test for isRunAsMain() true branch so branch coverage meets 95% threshold
- Backend: add getLaw tests for category_context (law_context set vs empty) so branch coverage meets 95% in CI
- Backend CI: avoid Sentry/git in test step (global Sentry mock in Vitest setup, SENTRY_DSN unset in workflow)
- Web: filter Sentry noise "feature named `performanceMetrics` was not found" (Sentry SDK/third-party, not app code); extract ignore patterns to `sentry-ignore-patterns.ts` and add tests
- Web: PWA install prompt no longer throws SecurityError in insecure contexts; guard localStorage getItem/setItem in try/catch (HTTP, file://, cross-origin iframes)

### Changed
- Trailing slash: standardize to no trailing slash (SSG, router, law URLs); router normalizes URL on load; www to non-www redirect in _redirects; bump web to 3.1.0
- Home: declutter (Browse CTA elevated, Science section in collapsible details); voting tooltips and "anonymous, no login" copy; form errors and success use ARIA live regions
- Home: remove hero section (h1 + tagline) from SPA and SSG; bump web to 3.0.21
- Articles: refreshed long-form copy and titles – "Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)" and "Project Management vs. The Universe: A Survival Guide"; home links and view meta updated; bump root to 2.0.23, web to 3.0.20
- Comment style in browse and category-detail: use hyphen instead of em-dash
- Browse view: set document.title and meta description on load (AdSense per-page metadata)
- Breadcrumb: use text separator (›) between items for reliable visibility; category detail description: vertical margin and horizontal padding for spacing
- Category detail: merge intro into laws card; description appears in card header before search info; remove redundant category-intro-card and its CSS; add test for description order
- Category detail: breadcrumb shows chevron separators between all items; category intro moved into a card below Advanced Search with category name as card title and H1
- Document markdownlint-cli2 .mjs exception (tool does not support .ts config) in `.markdownlint-cli2.mjs` and docs/DEPENDENCY_MAJOR_UPGRADES.md; bump root to 2.0.18
- Backend: convert six remaining scripts to TypeScript (log-manager, export-law-updates, select-law-of-day, review-laws, show-recent-updates, deploy); root deploy uses npx tsx; deploy runs from repo root and syncs vite.config.ts; bump backend to 2.0.9
- Backend: convert five DB scripts to TypeScript (build-sqlite, migrate, migration-safety-check, generate-add-laws-migration, generate-populate-categories-migration); parse-attributions test imports from build-sqlite.ts; remove build-sqlite.d.mts; bump backend to 2.0.8
- Backend: convert five infra scripts to TypeScript (validate-node-version, cleanup-ports, validate-ports, sanitize-husky-hooks, health-check); root and backend package.json use tsx; bump backend to 2.0.7
- Backend: move parse-attributions test from web to backend (parse-attributions.test.ts), assert parseAttributions from build-sqlite; bump backend to 2.0.6
- Web: convert all five scripts to TypeScript (sanitize-husky-hooks, check-coverage, uncovered-branches-from-lcov, optimize-images, ssg); add scripts to tsconfig; husky and root use npx tsx; bump web to 3.0.19, add tsx to root devDependencies
- Backend + web: convert ESLint configs to TypeScript (eslint.config.ts, eslint.config.test.ts); add jiti for .ts config loading; bump backend to 2.0.5, web to 3.0.18
- Web: convert vite.config.js to TypeScript (vite.config.ts); bump web to 3.0.17
- Bump root 2.0.14, backend 2.0.4, web 3.0.16
- Web: branch coverage tests (export-menu, install-prompt, law-of-day, not-found, browse, structured-data) and uncovered-branches checklist

## [2.0.50] - 2025-02-27

### Changed
- Run web E2E tests (Playwright) on pre-commit and in web-ci workflow; skip pre-commit E2E with SKIP_E2E_CHECK=1. Bump minimatch override to 10.2.4 (npm audit). Bump root to 2.0.50, web to 3.1.24.

## [2.0.49] - 2025-02-27

### Fixed
- PWA: use `navigateFallback: '/index.html'` instead of `/offline.html` so direct navigation to SPA routes (e.g. `/favorites`) serves the app shell and the router runs; offline page remains for actual offline/catch handling only. E2E: add SPA fallback test; path-based URLs and combobox locator for search; Playwright config as plain object to avoid ESM resolution with `"type": "module"`. Search autocomplete: set `role="combobox"` for axe aria-allowed-attr; advanced-search attribution input gets combobox role. Bump root to 2.0.49, web to 3.1.23.

## [2.0.48] - 2025-02-26

### Changed
- Web: favorite button uses the same filled bookmark icon for both add and remove states (previously outline for add, filled for remove); state indicated by .favorited class and tooltip only. Bump root to 2.0.48, web to 3.1.22.

## [2.0.10] - 2026-02-21

### Fixed
- Web build: Sentry Vite plugin no longer throws "Cannot read properties of undefined (reading 'ignore')" by only enabling the plugin when SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are all set, and by passing explicit `include: ['./dist']`
- Deploy: add diagnostics (set -e, echo markers, trap) and safer .env heredoc delimiter; remove duplicate nginx block

### Changed
- CI: use fetch-depth: 0 on checkout in backend-ci and web-ci to avoid git exit 128 when tools need full history
- Bump root 2.0.10, backend 2.0.3, web 3.0.14

## [2.0.9] - 2026-02-21

### Changed
- Bump root 2.0.9, backend 2.0.2, web 3.0.13
- CI: attach `cause` to wrapped errors (backend email.service, scripts); fix web indentation and TypeScript (submit-law, search-autocomplete, navigation, install-prompt); deploy checkout fetch-depth: 0
- Pre-commit: run typecheck and lint (backend + web) before tests; add SKIP_CI_CHECK=1 bypass
- Root: add npm run ci, ci:backend, ci:web to match CI locally

### Fixed
- Web: pin typescript-eslint to 8.56.0 and add overrides for ESLint 10 compatibility (scopeManager.addGlobals); bump web to 3.0.10
- Web: ensure dist HTML passes html-validate (aria-labels on header/main, remove redundant role=main, trim SSG output to avoid trailing whitespace)

### Changed
- Bump to 2.0.7; npm audit fix --force (downgrade @sentry/node to 9.20, add typescript-eslint)
- Audit fixes: upgrade vite-plugin-pwa to 1.2.0 (critical ejs/json-schema); upgrade @sentry/node to 9.47.1; add root overrides for minimatch 10.2.1 and regenerate lockfile (fixes all 14 high). Pre-push blocks on high/critical. 10 moderate (ajv in eslint stack) remain with no non-breaking fix. Remove unused @sentry/node from web deps.

### Added
- CI and pre-push guardrails: typecheck and lint in web/backend CI; backend coverage thresholds (vitest.config.ts); npm audit in CI and pre-push; commit-msg hook (min length); lint-staged includes TypeScript; HTML validation step in web CI
- Backend: IOgImageLawService.getLaw return type allows undefined for LawService compatibility

### Changed
- Home: move "The Science of Murphy's Law" section below "Submit a Law"

## [2.0.10] - 2026-02-20

### Changed
- Web: upgrade ESLint `no-explicit-any` from warn to error (all `any` eliminated); allow `!= null` in `eqeqeq` rule for idiomatic null/undefined checks
- Web: fix `export.ts` to use `Category.title` (API field) instead of legacy `Category.name` for PDF, CSV, Markdown, and plain text exports
- Web: add JSDoc to `Category` interface marking `name` as `@deprecated` in favor of `title`

## [2.0.9] - 2026-02-19

### Changed
- Web: enable full `strict: true` TypeScript -- remove `noImplicitAny: false`, `strictNullChecks: false`, and `useUnknownInCatchVariables: false` overrides from `tsconfig.json`
- Web: fix 97 `noImplicitAny` errors across 10 source files (typed `Object.keys()` casts for calculator `for...in` loops, `ExportData` union narrowing via type assertions, MathJax ambient module declaration, `Record<string, unknown>` for dynamic index access)
- Web: fix 1 `useUnknownInCatchVariables` error (`instanceof Error` narrowing in `law-of-day.ts`)

## [2.0.8] - 2026-02-19

### Changed
- Web: fix 182 `strictNullChecks` errors across 23 source files (prep for enabling `strictNullChecks: true`)
- Web: add null guards for `querySelector` results, `getAttribute` returns, `dataset` properties, and regex capture groups
- Web: type all `[]` array initializations explicitly to avoid `never[]` inference under strict null checks
- Web: add `?? ''` fallbacks for `noUncheckedIndexedAccess` on record/array lookups (`button.ts`, `icons.ts`, `theme.ts`, `router.ts`)
- Web: null-safe calculator slider access with runtime validation and type narrowing across 4 calculator files

## [2.0.7] - 2026-02-19

### Changed
- Web: eliminate all remaining `any` usage in source (`as any` casts, `: any` annotations, `Promise<any>` returns)
- Web: add explicit parameter and return types to all exported functions (prep for `noImplicitAny: true`)
- Web: extract shared `copy-actions.ts` and `navigation.ts` utilities, reducing ~60 lines of duplicate event handling across views
- Web: improve type safety in `export-context.ts` (literal union for `ContentType`, `ExportData` union type), `category-cache.ts` (typed `JSON.parse`), `error-handler.ts` (generic `withRetry<T>`, `safeAsync<T>`), and `submit-law.ts` (`SubmitLawPayload` interface)
- Web: fix `global.d.ts` MathJax typing, `HTMLSelectElement` cast, unused variable warning in `main.ts`

## [2.0.6] - 2026-02-19

### Added
- Branch coverage tests: header ExportMenu cleanup, trending/browse/voting/home/categories cleanup and copy-text, structured-data setCategoryItemListSchema
- Branch coverage checklist in `web/uncovered-branches.md`; process and format rules in `web/uncovered-branches-agent.md`

### Changed
- Web coverage branch threshold set to 88%; use `web/uncovered-branches.md` and `web/uncovered-branches-agent.md` to work through uncovered branches

## [2.0.5] - 2026-02-19

### Fixed
- Web tests: use `globalThis` instead of `global` for DOM/browser type compatibility; type callback mocks (`onUpdate`, `onDismiss`, `updateSW`, `preventDefault`) with `Mock<() => void>` for Vitest 4

## [2.0.4] - 2026-02-19

### Added
- Pre-commit: fail when CHANGELOG.md is not staged and there are other staged changes (SKIP_CHANGELOG_CHECK=1 to bypass)

### Changed
- CHANGELOG history filled from git commit log (2.0.2, 2.6.1 entries and compare links)

## [2.0.3] - 2026-02-19

### Fixed
- Lint and type fixes: MathJax `Window` type (`Record<string, unknown>`), debounce generic args, unused imports/vars
- CSS: added standard `line-clamp` alongside `-webkit-line-clamp` for compatibility (components.css, sections.css)
- Documentation: CHANGELOG, TODO, web README (file references), coverage thresholds (96% functions, 95.5% branches)
- Pre-commit: require CHANGELOG.md staged when there are other staged changes

## [2.0.2] - 2026-02-19

### Changed
- Backend runs TypeScript source via tsx in PM2 (no JS build step)
- Complete TypeScript migration for backend and shared modules

### Fixed
- Deploy: run backend via local tsx CLI in PM2
- CI: repair deploy SSG imports and workspace trigger paths
- CI: remove darwin-only root dependencies
- Lockfile and workflow alignment to .nvmrc

## [2.6.1] - 2026-02-05

### Added
- Monthly peak resource usage report in daily status email

### Changed
- Theme toggle icons and home page content (Murphy's Law description in section-subheader, intro consolidated into single card)
- Content depth enhancements across key pages (Google Ads policy compliance review)

### Fixed
- Theme toggle icons not rendering correctly
- Sentry: filter browser extension internal messaging, ServiceWorker registration/update, and transient errors
- Sentry: stop reporting AdSense load failures, GA script errors, module import failures
- Service worker InvalidStateError handling
- Localhost fallback URL removed (production errors)
- Dynamic import failures handled gracefully
- Page title bottom padding, redundant categories description removed
- H1 alignment and heading hierarchy standardized
- Calculator slider readonly state in accessibility tree

## [2.6.0] - 2026-01-30

### Added
- Spacing scale CSS variables (`--space-1` through `--space-16`)
- Typography scale CSS variables (`--text-xs` through `--text-5xl`, line heights, font weights)
- High-contrast mode support (`@media (prefers-contrast: more)` and `data-contrast="more"`)
- Tooltip on disabled submit button with accessibility fix for hover on disabled elements
- Icon button borders in high-contrast mode (vote, favorite, theme, download buttons)
- Design System documentation in web README
- CHANGELOG.md following Keep a Changelog format
- Pre-commit reminder for changelog updates

### Changed
- Category cards now have uniform 120px height with text truncation
- Standardized placeholder text across all search inputs to "Search laws..."

### Fixed
- Tooltips now work on disabled buttons (added `pointer-events: auto`)
- Disabled button styling uses color instead of opacity to preserve tooltip visibility

## [1.0.7] - 2026-01-30

### Added
- Inline share buttons for calculator pages (replacing dropdown)
- Markdown linter with emoji and em-dash rules

### Fixed
- iOS CI updated to use iPhone 16 simulator for Xcode 16.4

## [1.0.6] - 2026-01-30

### Changed
- Markdown linter now enforces no-emoji and no-em-dash rules

## [1.0.5] - 2026-01-30

### Added
- Markdown linter with auto-fix support for documentation consistency

## [2.5.8] - 2026-01-29

### Added
- Favorite button on Law of the Day widget
- Advanced Search and sort controls on category pages
- Examples link in footer navigation
- Voice search support and comprehensive SEO improvements
- FAQ structured data on calculator pages

### Changed
- Calculator share buttons redesigned to match law share popover style
- Card structure standardized with header/body/footer pattern
- Form control heights standardized to match buttons (44px)
- Origin Story and Examples links moved to header dropdown menu

### Fixed
- Filled heart icon now shows on page load for favorited laws
- SVG click handling on favorites page
- Empty state shows after unfavoriting last law
- Slider value contrast in dark mode for WCAG AA compliance
- Sticky header positioning
- PWA install prompt dark mode and hover contrast

## [2.4.1] - 2026-01-29

### Added
- PWA support with offline caching, install prompt, and auto-updates
- Structured data fixes and FAQ schema for SEO

### Fixed
- Structured data URLs aligned with sitemap for SEO consistency

## [2.4.0] - 2026-01-27

### Added
- Progressive Web App (PWA) with offline support
- Custom install prompt with engagement-based triggers
- Service worker with smart caching strategies
- iOS Safari "Add to Home Screen" instructions

## [2.3.0] - 2026-01-26

### Added
- Universal page export (PDF, CSV, Markdown, Plain Text)
- Sentry error tracking integration
- Dynamic Open Graph images for per-law social sharing
- Schema versioning for localStorage cache

### Changed
- Export menu renamed to "Download" for clarity

### Fixed
- Navigation prevented when clicking buttons inside law cards
- SSG pagination now fetches all laws from API
- Law URLs have trailing slash to prevent circular redirects

## [2.2.0] - 2026-01-25

### Added
- User Favorites/Bookmarks with localStorage persistence
- Unified tooltip system across components
- Card-based layout for favorites page

### Fixed
- Horizontal scroll from tooltips prevented

## [2.1.0] - 2026-01-24

### Added
- Browse Laws by Category page with responsive grid
- Reusable button component with consistent icon placement
- Descriptions for all 55 categories
- Related laws API endpoint
- Unified loading states component

### Changed
- SubmitLawSection improved accessibility with required indicators

### Fixed
- Category descriptions for 9 categories with production slug mismatches
- Law Not Found page redesigned

## [2.0.0] - 2026-01-23

### Added
- Search autocomplete with debounced suggestions
- RSS and Atom feed support (`/api/v1/feed.rss`, `/api/v1/feed.atom`)
- Print-optimized CSS for law pages
- Keyboard shortcuts with help modal (press `?`)
- Manual dark mode toggle (auto/light/dark)
- WhatsApp share button

### Changed
- Share buttons unified with popover menu design

### Fixed
- Share dropdown clipping by section-card overflow
- Keyboard help modal reopening behavior

## [1.5.0] - 2026-01-21

### Added
- Tooltip on theme toggle button

### Fixed
- Keyboard modal and theme tooltip interactions

## [1.4.0] - 2025-12-15

### Added
- Android app with Kotlin and Jetpack Compose
- Material 3 UI matching web design
- Sod's Law Calculator in Android app
- More screen with markdown content support
- Pagination support in Android app

### Changed
- Android UI redesigned to match iOS and web
- Vote functionality with full test coverage
- Search functionality with icon-based results

## [1.3.0] - 2025-11-15

### Added
- iOS app with SwiftUI
- Skeleton loading views
- Enhanced launch screen
- Comprehensive iOS UI tests

### Changed
- iOS app loads content from shared markdown files
- Configuration management system added

### Fixed
- Various iOS compilation and compatibility issues
- Voting synchronization and UI updates

## [1.2.0] - 2025-11-07

### Added
- Monorepo structure for iOS and Android apps
- Shared legal content in markdown files
- Automated monorepo migration script

### Changed
- Project restructured as npm workspace
- Deployment configuration updated for monorepo

## [1.1.0] - 2025-11-01

### Added
- API versioning (`/api/v1/`)
- Comprehensive mobile app documentation
- Branch coverage tests achieving >95%

### Changed
- Enhanced markdown content handling

## [1.0.0] - 2025-10-20

### Added
- Law of the Day feature with daily rotation
- Social sharing functionality (X, Facebook, LinkedIn, Reddit, Email)
- Open Graph tags for social sharing
- Daily status report emails
- Breadcrumb navigation on detail pages
- Template system for content pages
- Buttered Toast Calculator with test coverage
- Advanced search component for filtering laws
- Category selection in law submission

### Changed
- Calculator styles consolidated
- Voting architecture refactored
- Law list widgets improved
- Sod's Law email template centralized

### Fixed
- Daily report formatting and accuracy
- Law text quote handling in database

## [0.9.0] - 2025-10-10

### Added
- Health check script for monitoring
- Google Analytics integration
- Performance optimizations (preconnect, deferred CSS)
- Local SVG icons (replaced Font Awesome)
- Daily rotating Law of the Day

### Changed
- Accessibility improvements for 100/100 score
- Dark mode contrast fixes

### Fixed
- Layout shifts (CLS) improvements
- Footer layout shift fix

## [0.8.0] - 2025-10-01

### Added
- Stitch-style Law of the Day widget
- Material Symbols for voting buttons
- Pagination with First/Prev/Next/Last and ellipses
- Enhanced browsing with search functionality
- Voting functionality for laws
- Law submission endpoint

### Changed
- Header branding to "Murphy's Law of the Day"
- Hero section moved to main layout

## [0.7.0] - 2025-09-30

### Added
- Warp terminal session documentation
- E2E tests with Playwright
- API server in Playwright webServer

## [0.6.0] - 2025-09-08

### Added
- Enhanced navigation in tests and UI
- Build before preview script

## [0.5.0] - 2025-08-10

### Added
- Favicons and site manifest
- Dark mode styles
- MathJax integration for formulas

### Changed
- SQL schema updated (removed language parameter)
- Blockquote formatting improved

## [0.4.0] - 2025-08-08

### Added
- API integration for Home and LawDetail views
- Vitest setup with jsdom and coverage
- Playwright E2E tests
- Husky pre-commit hooks
- ESLint and Stylelint configuration

### Changed
- Migrated from React/TSX to vanilla JavaScript
- CSS refactored to utility classes
- Folder aliases added (`@folders`)

### Fixed
- Footer link contrast in dark mode

## [0.3.0] - 2025-08-08

### Added
- Vite-based Murphy's Laws site
- Calculator view with MathJax
- Browse view with pagination
- Unit tests foundation

### Removed
- React/TSX components
- Inline CSS (replaced with utility classes)

## [0.2.0] - 2025-08-07

### Added
- New Murphy's Laws sections
- TODO tracking (moved to GitHub Wiki)

### Removed
- Outdated Murphy's Laws files (moved to backup)
- .DS_Store files from repository

## [0.1.0] - 2025-07-12

### Added
- Initial project structure
- Murphy's Laws content database
- Basic file organization

[Unreleased]: https://github.com/ravidorr/murphys-laws/compare/v2.0.57...HEAD
[2.0.57]: https://github.com/ravidorr/murphys-laws/compare/v2.0.56...v2.0.57
[2.0.56]: https://github.com/ravidorr/murphys-laws/compare/v2.0.55...v2.0.56
[2.0.55]: https://github.com/ravidorr/murphys-laws/compare/v2.0.54...v2.0.55
[2.0.54]: https://github.com/ravidorr/murphys-laws/compare/v2.0.53...v2.0.54
[2.0.53]: https://github.com/ravidorr/murphys-laws/compare/v2.0.52...v2.0.53
[2.0.52]: https://github.com/ravidorr/murphys-laws/compare/v2.0.51...v2.0.52
[2.0.51]: https://github.com/ravidorr/murphys-laws/compare/v2.0.10...v2.0.51
[2.0.10]: https://github.com/ravidorr/murphys-laws/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/ravidorr/murphys-laws/compare/v2.0.8...v2.0.9
[2.0.8]: https://github.com/ravidorr/murphys-laws/compare/v2.0.7...v2.0.8
[2.0.7]: https://github.com/ravidorr/murphys-laws/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/ravidorr/murphys-laws/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/ravidorr/murphys-laws/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/ravidorr/murphys-laws/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/ravidorr/murphys-laws/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/ravidorr/murphys-laws/compare/v2.6.1...v2.0.2
[2.6.1]: https://github.com/ravidorr/murphys-laws/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/ravidorr/murphys-laws/compare/v1.0.7...v2.6.0
[1.0.7]: https://github.com/ravidorr/murphys-laws/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/ravidorr/murphys-laws/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/ravidorr/murphys-laws/releases/tag/v1.0.5
