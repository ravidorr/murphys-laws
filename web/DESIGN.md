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
# Murphy's Law Archive - Design System

## Overview

Murphy's Law Archive is an archive, not an app. The product celebrates
the history of a truism; the visual system should feel like a tidy
reference work with a dry sense of humor rather than a trendy SaaS
dashboard. Typography carries most of the personality; chrome stays
quiet. Color is used to reinforce meaning (success, error, favorite,
calculator state) and almost never for decoration.

Tone: archive, academic, dry humor. Density: comfortable but not airy.
Accessibility is non-negotiable; the token values in this file are tuned
for WCAG 2.1 AA contrast in both light and dark modes.

## Colors

The palette is neutral-first. A single deep blue carries interaction.
Semantic palettes (success, error, warning, orange, dark, favorite)
are used by the calculators and form feedback surfaces. All light-mode
tokens are paired with a dark-mode counterpart (prefixed `dark-`)
activated via `prefers-color-scheme: dark` or `:root[data-theme="dark"]`.

- Neutral surfaces: `bg`, `fg`, `muted-fg`, `text-high-contrast`,
  `surface`, and `surface-border`.
- Links: `link`, `link-visited`, and `link-hover` are the light-mode
  counterparts to the dark link tokens.
- Brand: `primary` for brand badge, `btn-primary-bg` / `btn-primary-fg`
  for primary calls-to-action. `btn-primary-bg` is tuned darker than a
  default Tailwind blue to pass WCAG AA on white.
- Semantic: `success`, `error`, `favorite-color`, `important`, plus
  paired `-bg` / `-text` / `-border` tokens for badges and callouts.
- Third-party social brands: `brand-social-*` tokens are external brand
  values, but they still belong here because every platform must render
  the same X, Facebook, LinkedIn, Reddit, WhatsApp, and email actions.
- Calculator states: `calc-ok` / `calc-warn` / `calc-orange` / `calc-danger`
  / `calc-dark` map to the semantic palette.

Tokens that rely on runtime alpha or `color-mix()` (borders, shadows,
hover layers) are intentionally not represented as YAML tokens because
DESIGN.md requires literal `#HEX` values. Treat them as implementation
details of the CSS, not as part of the design contract. See
`web/styles/partials/variables.css` and `theme.css` for the actual
definitions.

## Typography

The web uses a single family, **Work Sans**, with a system-font fallback
stack. The type scale is a Major Third (1.25) progression from 12 px
caption to 48 px display. Weights run 400 / 500 / 600 / 700 / 800;
600 is the default for headings. Line heights are tight on display
copy (1.1-1.25) and relaxed on body (1.5).

The `typography` tokens in the YAML front matter are semantic levels
(`display`, `h1`..`h4`, `body-lg`..`body-sm`, `caption`) composed
from the atomic `--text-*`, `--font-*`, and `--leading-*` primitives
in `variables.css`.

## Layout

Spacing follows a 4 px base unit: `space-1` (4 px) through `space-16`
(64 px). The scale is not linear - it skips through Fibonacci-adjacent
steps (1, 2, 3, 4, 5, 6, 8, 10, 12, 16) to keep composition rhythmic.

Layouts are content-first, single-column on mobile, with a centered
max-width on desktop. The header uses a sticky translucent surface
(`color-mix` over `bg`); the footer uses a lightly tinted surface
(`color-mix` over `bg` at ~90%).

## Elevation & Depth

Elevation is the combination of a `color-mix` surface tint and a
stacked `box-shadow` (inset highlight plus outer drop). It is not
tokenized; the three tiers below live directly in
`web/styles/partials/theme.css` and `components.css`, not in YAML:

- Resting cards: subtle ~8 px blur at low alpha over a lightly tinted
  surface (`color-mix(in oklab, var(--bg) 88%, white 12%)` in dark
  mode, `var(--bg)` in light mode).
- Floating surfaces (dropdowns, modals): 20-24 px blur at higher alpha
  over the same tinted surface, with a 1 px inset highlight.
- High-contrast mode: elevations collapse to 2 px solid borders via
  `prefers-contrast: more` or `:root[data-contrast="more"]`; shadows
  are effectively dropped.

## Shapes

Corner radii use a five-level scale, exposed as the `rounded` tokens
in the YAML front matter: `sm` 4 px, `md` 6 px, `lg` 8 px, `xl` 12 px,
`full` 9999 px (pill). Checkboxes use `sm`; the brand badge uses `md`;
buttons, icon buttons, inputs, selects, and pagination use `lg`; cards,
dropdowns, and modals use `xl`. There is no "none" level: zero radius is
reserved for deliberate structural joins inside compound components.

All interactive controls have a minimum 44 px hit area. Standard icons are
24 px, button icons and checkboxes are 20 px, and the square brand badge is
44 px. These values are the `--component-*` variables in `variables.css`
and generate the native `DS.Component` namespaces.

## Components

The `components` section in the YAML front matter assigns color, shape,
typography, and size tokens to the shipped primitives:

- Core: button, outline button, icon button, and icon.
- Forms: form field, input, select, checkbox, and slider.
- Cards: card, law-card-mini, category-card, and proof-point.
- Feedback: calculator result, message, notification, and vote group.
- Navigation: brand badge, breadcrumb, and pagination.

Dark-mode overrides are handled in `theme.css`; every component is
theme-aware and uses semantic `dark-*` counterparts. Breadcrumb and
pagination are web navigation patterns. Native apps use platform navigation,
search, sheets, safe-area behavior, and system focus treatment.

### States

Every interactive component defines default, hover, focus-visible, pressed,
disabled, and loading states. Form and feedback components additionally define
success and error states. State changes use semantic attributes and predefined
classes on web, and native control state on iOS and Android; presentation never
depends on inline values or presentation data in domain models.

Buttons and inputs use a visible blue focus ring. Hover transitions use
150-200 ms; pressed states dim rather than move. Under
`prefers-reduced-motion: reduce`, non-essential transitions and animations
are removed.

## Card System

Cards use one canonical shell plus explicit variants. Keep old class names as
compatibility aliases while migrating markup; do not create new one-off card
selectors.

### Base Contract

Use `card` for the outer surface. Use these regions inside it:

- `card-header` for the title and summary area. Header dividers are full-width.
- `card-title` for the title text only. It should not add its own divider.
- `card-body` for normal padded content.
- `card-body--flush` when the body contains full-width rows, such as law lists.
- `card-footer` for full-width action or metadata rows.

### Variants

Use a variant class with `card` so the surface intent is explicit:

- `card--section`: homepage widgets, Law of the Day, submit modules, advanced
  search, and law-detail supporting sections. Legacy alias: `section-card`.
- `card--content`: long-form Markdown/content pages with wider reading spacing.
  Legacy alias: `content-card`.
- `card--law-list`: stacked law-list widgets such as Top Voted, Trending Now,
  and Recently Added. Legacy alias: `law-list-card`. The child rows remain
  `law-card-mini` and are not standalone card shells. Law-list widgets use the
  same elevated surface treatment as section cards while keeping their body
  flush for full-width row dividers.
- `card--category`: category tiles. Use `category-card--rich` for the current
  grouped category cards and `category-card--compact` only for older compact
  directory tiles. Legacy alias: `category-card`.
- `card--empty`: empty states such as 404 and empty favorites.

### Rules

- Do not use broad selectors like `.card .card-title` for variant-specific
  behavior. Target the variant instead.
- Do not add a second card system with parallel header/body/footer names.
  `section-header`, `section-body`, and `section-footer` may remain for
  semantic sections, but their visual behavior must map to card regions.
- Runtime and SSG markup must use the same card shell for the same page type.
- Dark mode, high-contrast mode, and print styles should target the canonical
  variants first, with legacy aliases only for compatibility.

## Do's and Don'ts

- Do keep type doing the heavy lifting. Chrome should be quiet.
- Do use Work Sans through `--font-sans` and monospace text through
  `--font-mono`.
- Do use semantic color tokens (`success-*`, `error-*`, etc.) - never
  raw hex in components.
- Do use a real icon library: 24 px by default and 20 px inside buttons.
- Do keep every interactive target at least 44 by 44 px.
- Do keep contrast at WCAG AA or better. The token values already pass;
  reach for them, not "close enough" shades.
- Don't introduce Material Design 3 components or styles. Stitch will
  default to MD3; steer it with this DESIGN.md and discard MD3-specific
  output.
- Don't ship emojis in UI copy - ESLint and markdownlint both reject
  them repo-wide.
- Don't use React, ReactDOM, JSX, TSX, Babel-in-browser, or React tooling.
  Web UI is semantic HTML rendered by vanilla TypeScript DOM helpers.
- Don't use inline CSS: no `style` attributes, `<style>` elements,
  JavaScript `.style` mutations, CSS-in-JS, injected stylesheets, or inline
  custom properties. Put all CSS in external partials and express runtime
  state with semantic elements, attributes, and predefined classes.
- Don't leave raw third-party brand colors in platform code. Add or use
  a `brand-social-*` token so web, iOS, and Android stay aligned.
- Don't edit the YAML front matter by hand. It is regenerated from
  `variables.css` by `npm run design:sync` from the repo root.

## Workflow

This DESIGN.md is the single source of truth for agents (Cursor,
Claude, Stitch, Figma). The authoritative values live in
`web/styles/partials/variables.css`. The sync script
`shared/design-tokens/sync-design-tokens.ts` parses that file and regenerates
the YAML front matter above; it does not touch this Markdown body.

- **Change a concrete token value:** edit `variables.css`, then run
  `npm run design:sync`. CI enforces no drift via
  `npm run design:check` in `ci:web`.
- **Change a typography level or component assignment:** edit the semantic
  contract in `sync-design-tokens.ts` and re-run `design:sync`.
- **Change a radius, font-family, or component metric value:** edit its CSS
  variable; the sync and native exporters parse it directly.
- **Generate iOS tokens:** run `npm run design:export:ios` from the repository
  root. From `ios/`, `generate-xcode-project.sh` targets that root script with
  `npm --prefix ..`; do not target the `web` workspace.
- **Use Stitch for ideation:** seed Stitch with this file. Keep
  generated mockups in `web/.stitch/` (gitignored). Do not ship
  Stitch-generated HTML/CSS; translate mockups by hand into the
  vanilla-TS components under `web/src/components/`.
- **Validate:** `npm run design:check` runs
  `design:sync --check` for drift and the repository-native DESIGN.md linter
  for structural correctness, WCAG contrast, and cross-platform exporter
  wiring.

## Unavoidable Platform Exceptions

These are the only approved non-token design values. Anything else must
use an existing token or add a new token/component contract before it
ships.

- **PWA browser chrome metadata**
  - Used in: `web/index.html` `meta[name="theme-color"]`.
  - Value pattern: literal light/dark hex values.
  - Why unavoidable: browser UI metadata cannot read CSS custom
    properties reliably across install surfaces.
  - Status: permanent platform exception; keep values synchronized with
    `bg` and `dark-bg-primary`.
  - Coverage: `web/tests/design-token-leftovers.test.ts` verifies the
    critical CSS tokens that sit beside this metadata.
- **Print-only black and white**
  - Used in: `web/styles/partials/print.css`.
  - Value pattern: print media black/white foregrounds and backgrounds.
  - Why unavoidable: hardcopy output needs predictable ink behavior
    independent of the interactive theme palette.
  - Status: permanent print exception.
  - Coverage: stylelint plus this documented exception.
- **High-contrast forced outlines**
  - Used in: `web/styles/partials/theme.css` high-contrast media and
    `[data-contrast="more"]` overrides.
  - Value pattern: raw maximum-contrast black/white outlines.
  - Why unavoidable: WCAG non-text contrast affordances must remain
    legible even if brand tokens shift.
  - Status: permanent accessibility exception.
  - Coverage: design lint and accessibility-oriented CSS tests.
- **Runtime alpha and vector internals**
  - Used in: shadows, overlays, `color-mix()` surfaces, data-URI select
    arrows, and vector path fills inside platform assets.
  - Value pattern: alpha channels or asset-internal fill values derived
    at render time.
  - Why unavoidable: DESIGN.md YAML accepts literal hex tokens, while
    these values are compositing instructions or embedded asset data.
  - Status: allowed only when the base color is tokenized or the value
    is isolated inside an asset.
  - Coverage: design-token leftover tests block stale app-facing colors
    from returning outside token definitions.

### First dogfood: install-prompt (2026-04-24)

First redesign driven by Stitch, on the PWA install prompt
(`web/src/components/install-prompt.ts`). Roughly one hour from prep to
open PR. Six mockups generated (generic and iOS, light and dark, two
iterations for the generic variant).

What Stitch got right: the action hierarchy. The shipping component
laid out Install / Not now / Never show again as three equal
rectangles in a row. Stitch promoted Install to a full-width primary,
demoted Not now to secondary, and rendered Never show again as a
text-only tertiary on the same row. That change alone is the entire
visual argument for keeping Stitch in the workflow. Microcopy also
improved: "Preserve the documentation of inevitable failure for
offline consultation." and "Add this archive to your home screen for
immediate reference." are on-brand in a way the shipping copy was not.
The tinted rounded icon plate was a small, cheap win.

What Stitch got wrong: almost everything below the pixel layer. Every
mockup came back as Tailwind plus Material Design 3 token names
(`surface`, `on-surface`, `primary-container`, `surface-tint`),
Material Symbols Outlined font icons (`book_4`, `ios_share`), a second
Google Fonts link, and a flattened `primary: #000000` in dark mode
that would have failed WCAG contrast. None of that shipped.
DESIGN.md's token palette was in the context but Stitch did not
consume it; it treated the file as style guidance and re-derived an
MD3 theme underneath. Translation was entirely hand-work: decision.md
first, then CSS, then markup, then a small `box-shadow: none` override
for the new tertiary to defeat theme.css's inset-shadow-as-border on
`button` in dark mode.

Test contract held. No class rename, no DOM restructure that broke a
selector, no a11y attribute lost. All 76 `install-prompt.test.ts`
tests and all 2624 web tests passed without a single edit to the test
file. design:check stayed at 0 errors, 0 warnings.

Verdict: use Stitch again, but only as an ideation partner. It is
good at hierarchy and on-brand microcopy and bad at respecting tokens
that are not in its default MD3 library. Keep mockups in
`web/.stitch/` (gitignored). Never paste Stitch HTML/CSS. Budget the
translation time; it is the real cost.
