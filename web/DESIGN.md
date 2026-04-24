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

- Neutral surfaces: `bg`, `fg`, `muted-fg`, `text-high-contrast`.
- Brand: `primary` for brand badge, `btn-primary-bg` / `btn-primary-fg`
  for primary calls-to-action. `btn-primary-bg` is tuned darker than a
  default Tailwind blue to pass WCAG AA on white.
- Semantic: `success`, `error`, `favorite-color`, `important`, plus
  paired `-bg` / `-text` / `-border` tokens for badges and callouts.
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
`full` 9999 px (pill). Buttons use `md`, cards and modals use `lg`,
the brand badge uses `full`. There is no "none" level: zero radius is
a deliberate choice, not a token.

## Components

The `components` section in the YAML front matter assigns color and
shape tokens to the core shipped components. It is not exhaustive - it
covers the primitives that agents most often need to reproduce
(buttons, cards, inputs, modal, brand badge, blockquote, pagination,
and the calculator state pills). Dark-mode overrides are handled in
`theme.css`; agents should assume any component is theme-aware and
use the `dark-*` color tokens for dark surfaces.

## Do's and Don'ts

- Do keep type doing the heavy lifting. Chrome should be quiet.
- Do use semantic color tokens (`success-*`, `error-*`, etc.) - never
  raw hex in components.
- Do keep contrast at WCAG AA or better. The token values already pass;
  reach for them, not "close enough" shades.
- Don't introduce Material Design 3 components or styles. Stitch will
  default to MD3; steer it with this DESIGN.md and discard MD3-specific
  output.
- Don't ship emojis in UI copy - ESLint and markdownlint both reject
  them repo-wide.
- Don't use inline styles. `html-validate` blocks them; put styles in
  the relevant partial under `web/styles/partials/`.
- Don't edit the YAML front matter by hand. It is regenerated from
  `variables.css` by `npm run design:sync` in the `web` workspace.

## Workflow

This DESIGN.md is the single source of truth for agents (Cursor,
Claude, Stitch, Figma). The authoritative values live in
`web/styles/partials/variables.css`. The sync script
`web/scripts/sync-design-tokens.ts` parses that file and regenerates
the YAML front matter above; it does not touch this Markdown body.

- **Change a color or spacing value:** edit `variables.css`, then run
  `npm --prefix web run design:sync`. CI enforces no drift via
  `npm run design:check` in `ci:web`.
- **Change a typography level, component contract, or radius scale:**
  edit the constants at the top of `sync-design-tokens.ts` and re-run
  `design:sync`. These are semantic decisions that do not have a 1:1
  representation in CSS.
- **Use Stitch for ideation:** seed Stitch with this file. Keep
  generated mockups in `web/.stitch/` (gitignored). Do not ship
  Stitch-generated HTML/CSS; translate mockups by hand into the
  vanilla-TS components under `web/src/components/`.
- **Validate:** `npm --prefix web run design:check` runs
  `design:sync --check` for drift and `@google/design.md lint` for
  structural correctness and WCAG contrast.

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
