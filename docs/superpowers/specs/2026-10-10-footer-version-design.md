# Footer application version design

## Goal

Display the application version from the root `package.json` in the web footer,
as requested in GitHub issue 151. The version appears after the existing CC0
licensing sentence, rather than on the About page.

## Design

Add a web module that imports the root `package.json` and exports its
`version`. Vite resolves the JSON import while creating the web bundle, so the
footer receives the same version value that was present in the root package
manifest for that build.

The existing footer template will retain its license link, Creative Commons
icons, and wording. It will append `Version: X.Y.Z`, with `X.Y.Z` supplied by
the build-time version module.

## Testing

Use test-driven development:

1. Add a footer test that expects the displayed version to equal the root
   package manifest's version.
2. Run the focused test and confirm it fails before production code changes.
3. Add the build-time version module and render its value in the footer.
4. Re-run focused tests, type checking, linting, and the production web build.

## Scope

This change affects only the web footer and its tests. It does not change the
About page, license content, release-version policy, or runtime configuration.
