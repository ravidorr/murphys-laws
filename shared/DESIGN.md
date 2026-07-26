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
  surface: "#ffffff"
  surface-border: "#d1d5db"
  link: "#0d5ea1"
  link-visited: "#6d28d9"
  link-hover: "#084b83"
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
  risk-low: "#15803d"
  risk-medium: "#ffa500"
  risk-high: "#b91c1c"
  orange-bg: "#ffe9d6"
  orange-text: "#6a2e00"
  dark-bg: "#f0d6d6"
  dark-text: "#2b0000"
  important: "#b91c1c"
  white: "#ffffff"
  highlight: "#fef08a"
  tooltip-bg: "#1f2937"
  tooltip-fg: "#f9fafb"
  tooltip-bg-inverse: "#ffffff"
  tooltip-fg-inverse: "#1f2937"
  brand-social-x: "#000000"
  brand-social-facebook: "#1877f2"
  brand-social-linkedin: "#0a66c2"
  brand-social-reddit: "#ff4500"
  brand-social-whatsapp: "#25d366"
  brand-social-email: "#4b5563"
  brand-social-icon-fg: "#ffffff"
  gradient-blue: "#2563eb"
  gradient-dark-1: "#2d2d2d"
  gradient-dark-2: "#1a1a1a"
  dark-bg-primary: "#0b0b11"
  dark-fg-primary: "#e9eaee"
  dark-muted-fg: "#9ca3af"
  dark-primary: "#6366f1"
  dark-text-high-contrast: "#ffffff"
  dark-surface: "#15151d"
  dark-surface-border: "#4b5563"
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
  border: "#00000040"
  border-high-contrast-dark: "#ffffff80"
  control-border: "#0000002e"
  control-surface: "#00000006"
  dark-accent: "#a5b4fc"
  dark-border: "#ffffff40"
  dark-border-hover: "#ffffff59"
  dark-border-muted: "#ffffff38"
  dark-border-strong: "#ffffff52"
  dark-error: "#f87171"
  dark-success: "#4ade80"
  highlight-fg: "#111827"
  overlay-scrim: "#00000099"
  shadow-blue: "#0d5ea14d"
  shadow-blue-dark: "#0d5ea166"
  shadow-blue-transparent: "#0d5ea100"
  shadow-dark: "#0000004d"
  shadow-high-contrast-light: "#00000040"
  shadow-high-contrast-medium: "#00000059"
  shadow-light: "#00000026"
  shadow-medium: "#00000033"
  shadow-subtle: "#0000001a"
  shadow-white-faint: "#ffffff14"
  shadow-white-inset: "#ffffff1a"
  shadow-white-outline: "#ffffff24"
  shadow-white-subtle: "#ffffff0f"
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
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
    height: "44px"
  btn-outline:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
    height: "44px"
  icon-button:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    width: "44px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
  section-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
    height: "44px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
    height: "44px"
  checkbox:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    width: "20px"
    height: "20px"
  slider:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.full}"
    typography: "{typography.body-md}"
    height: "44px"
  modal:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
  nav-dropdown:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
  brand-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    width: "44px"
    height: "44px"
  blockquote:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
  pagination:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
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
    rounded: "{rounded.xl}"
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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    typography: "{typography.body-md}"
  tooltip:
    backgroundColor: "{colors.tooltip-bg}"
    textColor: "{colors.tooltip-fg}"
    rounded: "{rounded.md}"
    typography: "{typography.caption}"
  tooltip-inverse:
    backgroundColor: "{colors.tooltip-bg-inverse}"
    textColor: "{colors.tooltip-fg-inverse}"
    rounded: "{rounded.md}"
    typography: "{typography.caption}"
  social-share-button:
    backgroundColor: "{colors.brand-social-email}"
    textColor: "{colors.brand-social-icon-fg}"
    rounded: "{rounded.full}"
    typography: "{typography.caption}"
  calculator-result:
    backgroundColor: "{colors.orange-bg}"
    textColor: "{colors.orange-text}"
    rounded: "{rounded.xl}"
    typography: "{typography.display}"
  bottom-navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-fg}"
    rounded: "{rounded.xl}"
    typography: "{typography.caption}"
  form-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    typography: "{typography.body-md}"
  law-card-mini:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    typography: "{typography.body-md}"
  category-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    typography: "{typography.body-md}"
  proof-point:
    textColor: "{colors.fg}"
    typography: "{typography.body-sm}"
  message:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    typography: "{typography.body-sm}"
  vote-group:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    height: "44px"
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
- **Approved non-token exceptions:** the "Unavoidable Platform Exceptions"
  section in [web/DESIGN.md](../web/DESIGN.md).
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
