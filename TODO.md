# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## Security

- [ ] **Make the disaster-recovery PM2 step work on a fresh droplet:** `backend/ecosystem.config.cjs` hardcodes `/root/.nvm/versions/node/v22.20.0/bin/node` (while `.nvmrc` says 22.16.0), but `DISASTER-RECOVERY.md` installs nvm and pm2 for the `ravidor` user and runs the PM2 step as root. Install Node and pm2 for root at the version the config names, or make the interpreter follow `.nvmrc`.
- [ ] **Renew `/.well-known/security.txt` before 2027-11-06:** the `Expires` date in `nginx.conf` must be moved forward. A test in `nginx-scanner-defense.test.ts` fails 30 days before it passes.

## Performance

- [ ] **Serve `/manifest.webmanifest` with its real type:** the server sends the manifest as `application/octet-stream`
  (`/etc/nginx/mime.types` has no `webmanifest` entry), so it is not compressed either (`gzip_types` lists
  `application/manifest+json`). Add a new `location = /manifest.webmanifest` with `types { application/manifest+json webmanifest; }`,
  and repeat `add_header Cache-Control "no-cache";` in it: an exact-match location wins over the regex rule that sets that header today, and
  its `add_header` is not inherited, so leaving it out would silently undo the manifest's revalidation. Update the location model in
  `web/tests/nginx-performance.test.ts` too. Do not put `types` in the existing regex location: it would strip the `text/plain` and
  `text/xml` mapping from `robots.txt` and the sitemaps (a `types` block replaces the whole inherited map).
- [ ] **Revalidate the prerendered pages:** send `Cache-Control: no-cache` for them, so a deploy shows up on the next visit (they send no
  `Cache-Control` today, so browsers decide how long to keep them), and decide the same for `ads.txt`, `llms.txt`, `llms-full.txt` and
  `social/home.webp`, which send none either.
- [ ] **Revisit the web Sentry `tracesSampleRate` after the 2026-11-19 performance report:** `web/src/main.ts` samples 100% of
  transactions (it was 10%) so the 2026-11-15 and 2026-11-19 reports have enough real-user samples. Lower it again if quota
  or noise is a concern, and update `web/tests/sentry-sampling.test.ts` and the comment beside the option with it (the
  backend's `initSentry` has its own rate, still 10%).

## Site data

- [ ] **Let a visitor add a corollary to a law that is already published:** the submit form only creates a new law
  together with its corollaries, so the "submit a law" link in the corollaries section of a law page opens that form. Attaching one to an
  existing law needs a parent field on the submit API, the same moderation path as the other corollaries, and a rule
  for who may do it (published laws were left out of the first version on purpose).

- [ ] **Remove `backend/murphys-production.db` from the git history:** the public repository still holds the file
  committed on 2025-11-16 (1,229 contact addresses in `attributions.contact_value` and the vote identifiers). It is
  untracked now, but only a history rewrite and a force-push remove it, which is the owner's decision.

## Design Review Findings (Jan 2026)

The following items were identified during comprehensive UX, UI, Accessibility, Microcopy, and SEO skill reviews but not yet implemented.

### UX Improvements
- [ ] **Consolidate Browse Page Sidebars:** "Top Voted", "Trending Now", and "Recently Added" sections show similar laws. Consolidate into single "Popular" section or convert to sort options only.
- [ ] **Expand Search Field on Desktop:** Currently collapsed behind icon. Consider showing expanded search input on desktop widths for better discoverability.
- [ ] **Simplify Home Page:** Home page has Law of Day + 2 calculators + submit form. Consider removing calculators from home page (they have dedicated pages) to focus on content discovery.

### UI Improvements
- [ ] **Implement 12-Column Grid System:** Current layout lacks consistent grid. Define explicit 12-column grid with 24px gutters for more precise layouts.
- [ ] **Standardize Section Spacing:** Some areas feel cramped while others have excessive whitespace. Audit and standardize using the new spacing scale.

### Accessibility Improvements
- [ ] **Add Skip Links for Calculator Sections:** Long home page could benefit from skip links to jump to specific calculators.

### SEO Improvements
- [ ] **"What is Murphy's Law?" Section:** Add a dedicated section or expand the home page description to target featured snippet for "What is Murphy's Law?" queries.

### Microcopy Improvements
- [ ] **Review Error States:** Audit all error messages for consistency and helpfulness. Ensure they follow pattern: What happened + Why + What to do next.
- [ ] **Empty State Improvements:** Review empty states (no search results, no favorites) for tone and helpfulness.
- [ ] **Button Label Audit:** Review all button labels for action clarity (e.g., "Submit" vs "Submit Your Law").

---

## SEO Recommendations (External / Manual)
- [ ] **Link Reclamation:** Identify broken links on high-authority sites (e.g., .edu domains) that mention 'Murphy\'s Law' and reach out to suggest our archive as a replacement reference.
- [ ] **Calculator Outreach:** Pitch the 'Buttered Toast Landing Calculator' to physics and science education blogs as a fun, interactive teaching tool to generate fresh backlinks.

## SEO Recommendations (Content & Technical)
- [ ] **Law Page H1 for Generic Titles:** About 1,892 laws are titled "Murphy's Law" or "Corollary", so their visible H1 is identical. The head title and schema now come from the law text. Decide whether the H1 should too, or retitle the laws in the database. (Corollary cards, the "Corollary of" banner and the corollary breadcrumb already name such laws from their text via `lawDisplayTitle`; the H1 of every law page, corollaries included, is still the stored title.)
- [ ] **Long Article Titles:** `/why-murphys-law-feels-true` and `/murphys-law-project-management` have titles over 60 characters (editorial pun headlines) that search results will truncate.
- [ ] **Small Category Pages:** `/category/murphys-marine-corps-laws` and `/category/murphys-sport-laws` stay under 150 words because they hold few laws. Merge or enrich them.
- [ ] **Internal Linking Improvements:** (Every law page is now linked from other pages in the static HTML; the rest is still open.) Add "related categories" links on category pages, cross-link calculators from relevant law pages, and add "See also" sections to content pages.
- [ ] **Visual Content:** Add historical photos (Edward Murphy, Dr. John Stapp, rocket sled experiments), infographics showing Murphy's Law variations, and embedded video explaining the origin story.
- [ ] **Glossary/Index Page:** Create a page listing all law authors/attributions with links, targeting long-tail "who said [law name]" queries.
- [ ] **User Stories Section:** Implement user-submitted stories with moderation for fresh user-generated content and social proof.

## User Engagement (Require Backend Work)
- [ ] **Email Notifications:** Allow users to subscribe to new laws in specific categories. (The daily Law of the Day email shipped; per-category subscriptions have not.)
- [ ] **Comments/Discussions:** Allow users to comment on laws (requires moderation system).
- [ ] **Law Collections:** Create curated "featured collections" (e.g., "Top 10 for Developers", "Classic Murphy's Laws").

## Content Strategy (Future Enhancements)
- [ ] **Content-Rich Category Pages:** Enhance category landing pages with more descriptive text, unique images, and curated content beyond just a list of laws. This might require adding 'long_description' to the `categories` table.
- [ ] **User Generated Content Moderation Interface:** Develop an admin interface to review, approve, edit, or reject submitted laws. This would build upon the existing `status` column in the `laws` table.
- [ ] **Law Tags:** Add a tagging system beyond categories for better discoverability.

## Mobile Apps (iOS / Android)
- [ ] **WhatsApp Share (Android):** Add WhatsApp share button to Android app. Requires updating `SocialShareHelper.kt`, `SocialIcons.kt`, and `LawDetailScreen.kt`.
- [ ] **WhatsApp Share (iOS):** iOS uses native `ShareLink` which already shows WhatsApp if installed. Consider adding a dedicated WhatsApp button for consistency with other platforms.

## Technical / Performance
- [ ] **Code Splitting:** Lazy load calculator code to reduce initial bundle size.
- [ ] **Prefetching:** Prefetch related laws on hover for faster navigation.

## Kindle / E-ink Browser
- [ ] **Verify the Kindle baseline on a device:** `web/DESIGN.md` records no Kindle engine version, and the modern CSS listed in #203 (`color-mix()`, `:is()`, `:where()`, `:has()`, `@layer`, `@container`, `inset`, `aspect-ratio`, nesting) is unverified. Identify the engine and test these on a Kindle, then update the baseline section. From #203.
- [ ] **Old-engine regression check:** Add a regression check for old engines, for example a stylelint or browserslist compatibility rule or a Playwright run on an old engine, so layouts that rely only on flex `gap` or other modern CSS are caught. From #203.
- [ ] **Revisit hidden "Script error." events:** The window `error` handler in `web/src/main.ts` skips the banner for opaque cross-origin "Script error." events (`isOpaqueScriptError()` in `web/src/utils/error-handler.ts`). Revisit if a real first-party error ever turns up behind one.
