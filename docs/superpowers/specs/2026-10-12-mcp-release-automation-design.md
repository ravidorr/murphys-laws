# MCP Release Automation Design

## Context

The repository publishes `murphys-laws-mcp` to npm and registers the package in
the MCP Registry. The existing registry workflow assumes the npm artifact has
already been published. It failed when `mcp/server.json` requested a package
version that npm did not have.

The MCP package is currently `1.2.5`, and npm now provides that version. The
registry manifest is being repaired from `1.2.2` to `1.2.5`.

## Goals

- Use `mcp/package.json` as the single authoritative MCP release version.
- Prevent `mcp/server.json` from drifting from the npm package version.
- Publish npm and MCP Registry releases in a single, ordered, idempotent
  workflow after an MCP release merges to `main`.
- Use npm trusted publishing through GitHub Actions OIDC, not an npm token
  stored as a repository secret.
- Keep pull requests free to declare a new package version before it exists on
  npm.

## Non-goals

- Publish npm packages from pull requests.
- Change the MCP Registry DNS authentication mechanism.
- Automatically generate or push version-bump commits.

## Version Contract

The following values must be identical:

- `mcp/package.json` `version`
- `mcp/server.json` top-level `version`
- `mcp/server.json` `packages[0].version`

A release-contract test parses the three files and fails on a mismatch. MCP CI
and the release workflow both execute it.

The existing generic version-bump check continues to require an MCP package
version bump for normal `mcp/` changes. A narrow migration exception permits
only the current repair: `mcp/server.json` may change without a package bump
when both manifest versions are corrected to the already-existing package
version, no MCP source files change, and the previous manifest was mismatched.
The exception is covered by tests and cannot permit a future version mismatch.

## MCP Release Workflow

The existing `MCP Registry Publish` workflow becomes the `MCP Release` workflow.
It runs on pushes to `main` that change `mcp/**`, plus manual dispatch for
recovery. Editing the workflow file itself does not trigger a release.

The workflow has `contents: read` and `id-token: write` permissions. Before
the first automated publish, npm must be configured to trust this repository
and workflow through npm Trusted Publishing.

### Stages

1. **Validate**
   - Check out the merged commit and install the root workspace dependencies.
   - Run the release-contract test.
   - Build the SDK because the MCP package imports its built output.
   - Run MCP type checking, linting, coverage tests, and build.

2. **Publish npm**
   - Read the canonical package name and version from `mcp/package.json`.
   - Query npm for that exact package version.
   - If it exists, verify the reported version and skip publication.
   - If it does not exist, publish the `murphys-laws-mcp` workspace with npm
     OIDC provenance.

3. **Wait for npm**
   - Poll npm for the exact version with a finite retry limit.
   - Stop the workflow if the version is not publicly visible before the
     limit. The registry stage must not run in that case.

4. **Publish MCP Registry**
   - Query the MCP Registry by exact server name and target version.
   - If the target version is already present, skip publication.
   - Otherwise authenticate with the existing DNS private-key secret and
     publish `mcp/server.json`.
   - Verify the exact target version is publicly visible in the MCP Registry.

The workflow uses a release-specific concurrency group so only one MCP release
can publish at a time. Manual reruns safely verify and skip existing npm or
registry releases.

## Tests and Documentation

- Add release-contract tests for matching versions, each mismatch case, and
  the one-time manifest synchronization repair.
- Add workflow-contract tests for the release triggers, OIDC permission,
  npm idempotency, bounded polling, and registry verification.
- Update `mcp/README.md` with the npm Trusted Publishing setup prerequisite,
  release sequence, and manual-dispatch recovery procedure.

## Failure Handling

- A failed validation or npm publish prevents registry publication.
- npm visibility timeout leaves the package published but unregistered;
  manual dispatch resumes after npm becomes visible.
- Registry publication failure leaves npm published but preserves a retry-safe
  manifest. Manual dispatch retries the registry stage without republishing
  npm.
