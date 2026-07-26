# Design conformance allowlist

The conformance gate intentionally excludes only these narrow sources:

- `web/styles/partials/variables.css`: authoritative token definitions.
- `web/styles/partials/print.css`: print-only color, type, and pagination behavior.
- `android/**/SocialIcons.kt`: third-party vector path geometry.
- Generated `Tokens.swift`, `Tokens.kt`, `math-formula.css`, asset catalogs,
  and Android resource values: authoritative exporter output, not hand-authored
  presentation.
- `DesignSystemComponents.swift`: the canonical SwiftUI component and
  presentation-token definitions consumed as `DS.*` throughout iOS.
- Native safe-area, system-navigation, and vector/asset geometry.
- Browser-generated PDF document geometry and pagination.
- `Constants.Performance` and equivalent non-visual timing or cache limits.

No application source is allowlisted for React, JSX/TSX, inline CSS, stylesheet
injection, raw component sizing, or UI emoji.
