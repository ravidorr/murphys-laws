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

## `katex` prototype pollution through Markdownlint

- Advisory: `GHSA-238p-pmpm-9mq7`
- Severity: low
- Dependency path: `markdownlint-cli2` -> `markdownlint` ->
  `micromark-extension-math` -> `katex@^0.16.0`.
- Reachability: the package is used only when linting repository Markdown.
  KaTeX `0.19.0` contains the fix but falls outside the extension's declared
  `^0.16.0` dependency range.
- Resolution: remove this exception when Markdownlint upgrades its math
  extension to accept a patched KaTeX version.

## `smol-toml` denial of service through Markdownlint

- Advisory: `GHSA-r4xh-jqrq-34v2`
- Severity: moderate
- Dependency path: `markdownlint-cli2` -> `smol-toml@1.8.0`.
- Reachability: the package is used only to read Markdownlint configuration.
  The patched `1.9.0` release is outside Markdownlint CLI's exact `1.8.0`
  dependency requirement.
- Resolution: remove this exception when Markdownlint CLI depends on a patched
  `smol-toml` release.
