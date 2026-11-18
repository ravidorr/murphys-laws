# Dependency audit exceptions

All exceptions are enforced by `config/audit-exceptions.json` and expire on
2026-12-18. Renewals require a new review.

## `picomatch` ReDoS through the lint, test and build toolchain

- Advisory: `GHSA-fc5q-39xc-vjpf`
- Severity: high
- Dependency path: `vitest`, `vite`, `stylelint`, `markdownlint-cli2` and
  `typescript-eslint` -> `tinyglobby`, `fdir`, `micromatch` or `globby` ->
  `picomatch@<=4.0.7`.
- Reachability: the vulnerable package runs only in development-time tooling
  (linting, tests, builds). `typescript-eslint` is a backend `devDependency`, so
  the production audit (`npm audit --omit=dev`) no longer sees it. Nothing
  passes untrusted input to these glob matchers.
- Resolution: `picomatch@4.0.7` is the latest release and the advisory lists no
  patched version. Remove this exception when a patched `picomatch` ships and the
  lockfile picks it up.

## Removed

- `GHSA-vfj7-8cjw-p6xm` (`braces` through Stylelint) expired on 2026-11-09 and the
  full audit no longer reports it.
