---
version: alpha
name: "Murphy's Law Archive"
description: "Design tokens and component contracts for murphys-laws.com. Derived from web/styles/partials/variables.css; the Markdown body below is authored."
colors:
  bg: "#ffffff"
  fg: "#111827"
  muted-fg: "#4b5563"
  primary: "#030213"
  text-high-contrast: "#000000"
  btn-primary-bg: "#0d5ea1"
  btn-primary-fg: "#ffffff"
  success: "#15803d"
  success-bg: "#dcfce7"
  success-border: "#86efac"
  success-text: "#166534"
  success-dark: "#0b3d22"
  error: "#b91c1c"
  error-bg: "#fee2e2"
  error-border: "#fca5a5"
  error-text: "#991b1b"
  error-dark: "#5e0010"
  favorite-color: "#c2185b"
  favorite-bg: "#fce4ec"
  favorite-border: "#f48fb1"
  warning-bg: "#fff8e1"
  warning-text: "#5a4300"
  orange-bg: "#ffe9d6"
  orange-text: "#6a2e00"
  dark-bg: "#f0d6d6"
  dark-text: "#2b0000"
  important: "#b91c1c"
  white: "#ffffff"
  highlight: "#fef08a"
  gradient-blue: "#2563eb"
  gradient-dark-1: "#2d2d2d"
  gradient-dark-2: "#1a1a1a"
  dark-bg-primary: "#0b0b11"
  dark-fg-primary: "#e9eaee"
  dark-muted-fg: "#9ca3af"
  dark-primary: "#6366f1"
  dark-text-high-contrast: "#ffffff"
  dark-link: "#9ecbff"
  dark-link-visited: "#b8a6ff"
  dark-link-hover: "#cfe5ff"
  dark-success-bg: "#103424"
  dark-success-fg: "#c9f1dd"
  dark-warning-bg: "#3b2f07"
  dark-warning-fg: "#ffe29a"
  dark-orange-bg: "#402214"
  dark-orange-fg: "#ffd9bf"
  dark-error-bg: "#3c151d"
  dark-error-fg: "#ffc4cc"
  dark-dark-bg: "#2a1b1b"
  dark-dark-fg: "#f0d6d6"
  dark-favorite-color: "#f06292"
  dark-favorite-bg: "#3c1525"
typography:
  display:
    fontFamily: "Work Sans, system-ui"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Work Sans, system-ui"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.25
  h2:
    fontFamily: "Work Sans, system-ui"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.25
  h3:
    fontFamily: "Work Sans, system-ui"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.375
  h4:
    fontFamily: "Work Sans, system-ui"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.375
  body-lg:
    fontFamily: "Work Sans, system-ui"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Work Sans, system-ui"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Work Sans, system-ui"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Work Sans, system-ui"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  btn-primary:
    backgroundColor: "{colors.btn-primary-bg}"
    textColor: "{colors.btn-primary-fg}"
    rounded: "{rounded.md}"
    typography: "{typography.body-md}"
  btn-outline:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    typography: "{typography.body-md}"
  card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  section-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    typography: "{typography.body-md}"
  modal:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  nav-dropdown:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
  brand-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
  blockquote:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
  pagination:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
  calc-ok:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-text}"
  calc-warn:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning-text}"
  calc-orange:
    backgroundColor: "{colors.orange-bg}"
    textColor: "{colors.orange-text}"
  calc-danger:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error-text}"
  calc-dark:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-text}"
  rank:
    textColor: "{colors.text-high-contrast}"
    typography: "{typography.body-md}"
    width: "24px"
  notification:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-sm}"
  header:
    textColor: "{colors.fg}"
    typography: "{typography.body-md}"
  footer:
    textColor: "{colors.muted-fg}"
    typography: "{typography.body-sm}"
  breadcrumb:
    textColor: "{colors.muted-fg}"
    typography: "{typography.body-sm}"
  search-autocomplete:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
---
# Murphy's Law Archive - Design Tokens (Shared)

This file is a **generated token-only mirror** of [web/DESIGN.md](../web/DESIGN.md).
It exists so cross-platform consumers (iOS in `ios/`, Android in `android/`)
can read the same token values the web uses, without depending on web-specific
prose (elevation story, Stitch workflow, component contracts tuned for
vanilla-TS components).

## Source of truth

- **Authoritative values:** [web/styles/partials/variables.css](../web/styles/partials/variables.css).
- **Authoritative contract:** [web/DESIGN.md](../web/DESIGN.md) (YAML front matter + Markdown body).
- **This file:** the YAML front matter above only. Regenerated in lockstep with
  `web/DESIGN.md` by [shared/design-tokens/sync-design-tokens.ts](design-tokens/sync-design-tokens.ts).

## Do not hand-edit

Every run of `npm run design:sync` rewrites this file. Edits made
directly to `shared/DESIGN.md` are lost on the next sync, and CI's
`npm run design:check` fails the build if the mirror drifts.

## Cross-platform mapping

Interpretation of the tokens on each platform is defined by the platform
implementation, not by this file. Known mappings:

- **Web** (authoritative): `web/styles/partials/variables.css` exports each
  token as a CSS custom property (`--bg`, `--space-4`, ...). Dark-mode
  counterparts (`--dark-*`) are applied via `:root[data-theme="dark"]` in
  [web/styles/partials/theme.css](../web/styles/partials/theme.css).
- **iOS / Android:** expected to bind each token to a platform-native colour /
  dimension resource and swap the `dark-*` counterparts under the platform's
  dark-mode trigger. Specifics live in the respective platform implementation,
  not here; see [shared/docs/MOBILE-ARCHITECTURE.md](./docs/MOBILE-ARCHITECTURE.md).

## Schema

The YAML front matter follows the [Google Labs `design.md`](https://github.com/google-labs-code/design.md)
schema, version `0.1.1`. A DTCG (Design Tokens Community Group) JSON export
of the same catalogue can be generated on demand via
`npm run design:export`.
