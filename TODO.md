# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## Security

- [ ] **Make the disaster-recovery PM2 step work on a fresh droplet:** `backend/ecosystem.config.cjs` hardcodes `/root/.nvm/versions/node/v22.20.0/bin/node` (while `.nvmrc` says 22.16.0), but `DISASTER-RECOVERY.md` installs nvm and pm2 for the `ravidor` user and runs the PM2 step as root. Install Node and pm2 for root at the version the config names, or make the interpreter follow `.nvmrc`.
- [ ] **Renew `/.well-known/security.txt` before 2027-11-06:** the `Expires` date in `nginx.conf` must be moved forward. A test in `nginx-scanner-defense.test.ts` fails 30 days before it passes.

## Site data

- [ ] **Build the site after the server has migrated:** `.github/workflows/deploy.yml` builds the web from the production
  API before it uploads and migrates, so the static pages show production data as it was before the deploy's
  migrations (a data fix appears one deploy later), and a build change that needs a new API field cannot ship in the same
  deploy as the backend change that adds it. Upload and migrate first, then build against the new API and upload
  `web/dist` in a second step (keeping the "no partial site" guarantee: the old `dist` stays until the new one is complete).
- [ ] **Law pages show email addresses in their text:** 66 of the 2,465 pages built from the archive, and 69 of the 2,453
  built from production, contain something that looks like an address (for example `name@aol.com`). The build's
  privacy check only looks for `mailto:`. Find out where the addresses come from (law text, attribution notes)
  and strip them in the parser and in the production rows.
- [ ] **Old `/murphy/*` pages redirect to the home page, which Google reports as soft 404:** the `location ^~ /murphy/`
  catch-all in `nginx.conf` sends every unmatched legacy page (19 of the 60 soft 404s, for example
  `/murphy/murphy-golf.html`) to `/`. Map the ones that have a current category (golf, nurses, EMT, employees,
  commerce, real estate, and so on) to it with an exact redirect, and answer the rest with 404 or 410.

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
- [ ] **Law Page H1 for Generic Titles:** About 1,892 laws are titled "Murphy's Law" or "Corollary", so their visible H1 is identical. The head title and schema now come from the law text. Decide whether the H1 should too, or retitle the laws in the database.
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
