# Design System

The authoritative design contract is [web/DESIGN.md](../web/DESIGN.md), and the authoritative CSS token values are in [web/styles/partials/variables.css](../web/styles/partials/variables.css). [shared/DESIGN.md](../shared/DESIGN.md) is a generated token-only cross-platform mirror and must not be edited by hand.

This directory is a documentation wrapper and static showcase. It must not become a second editable token source.

## Structure

- `tokens.css` imports the canonical web CSS variables for showcase use.
- `index.html` provides a static token and component preview.
- `showcase.css` styles the preview using canonical variables.

## Rules

- Update `web/DESIGN.md` and its source variables, then run the existing design-token checks and exports.
- Do not hard-code colors, spacing, or font sizes in application UI.
- Keep components accessible and meet WCAG 2.1 AA contrast requirements.
- Treat token changes as visible changes and record them in `CHANGELOG.md`.

## Viewing

Open `index.html` in a browser. It loads the canonical web variables through `tokens.css`; it does not define a separate token set.
