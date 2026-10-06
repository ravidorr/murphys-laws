# Dependency audit remediation design

## Goal

Resolve every vulnerability for which the dependency graph has a compatible
patched release, without bypassing the repository's audit gate.

## Scope

- Upgrade vulnerable direct dependencies in their owning workspace manifests.
- Regenerate the root `package-lock.json` with npm.
- Update application code and tests only when a dependency's breaking API
  change requires it.
- Document any advisory that has no compatible upstream fix and remove the
  exception when one becomes available.

## Approach

Use supported dependency releases instead of forcing incompatible transitive
dependency versions through overrides. This keeps each package on a dependency
graph its maintainer supports and addresses vulnerable direct dependencies
directly.

The update includes the direct dependencies that currently introduce audit
findings, including web Sentry tooling and test tools, backend Nodemailer,
Markdownlint tooling, and image processing tooling. npm will update their
transitive dependency paths in the root lockfile.

## Compatibility and verification

For each breaking upgrade, inspect the package's migration guidance and update
only the affected call sites and tests. Verify the complete remediation with:

1. Package typechecks, linting, tests, and builds for every affected workspace.
2. `npm audit` reporting only documented advisories without a compatible
   upstream release.
3. The repository's normal push hook, without skip flags.
