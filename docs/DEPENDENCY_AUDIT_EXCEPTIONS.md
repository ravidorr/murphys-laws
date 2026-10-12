# Dependency audit exceptions

All exceptions are enforced by `config/audit-exceptions.json` and expire on
2026-11-09. Renewals require a new review.

## `braces` stack exhaustion through the Stylelint toolchain

- Advisory: `GHSA-vfj7-8cjw-p6xm`
- Severity: high
- Dependency path: `stylelint` -> `fast-glob` -> `micromatch` ->
  `braces@^3.0.2`.
- Reachability: the vulnerable package is used only by development-time CSS
  linting. `braces@3.0.3` is the latest compatible release. The patched major
  release is incompatible with Micromatch's declared `^3.0.2` dependency
  range, so forcing it would leave the lint toolchain unsupported.
- Resolution: remove this exception when Micromatch or Stylelint accepts a
  patched compatible `braces` release.
