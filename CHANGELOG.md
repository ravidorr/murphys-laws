# Changelog

All notable changes to the Murphy's Laws project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.136] - 2026-11-03

### Changed
- Stopped the deploy from printing "Errors detected in logs" after every healthy release (issue #349). What was wrong:
  the deploy piped `pm2 logs murphys-api --lines 20 --nostream` into `grep -i "error\|module.*version"`, and PM2 prints
  a header before the lines of each log file, so the header of the error log
  (`/root/murphys-laws/backend/logs/api-error-1.log last 20 lines:`) matched on the word "error" in a file name, while the
  last 20 lines held no error. The check is now `backend/scripts/check-pm2-health.sh`, which skips the banner and the
  headers and still looks for `error` and `module.*version` (the native module mismatch of
  `shared/docs/PREVENTING-502-ERRORS.md`) in the log lines. It also skips a log file that was not written to since the
  restart: the deploy touches `backend/logs/.pm2-restart` just before `pm2 start`, and a file older than it holds only
  output of earlier runs (a tie counts as written after the restart, so a startup crash is never skipped; PM2 does not
  timestamp the lines here, so the lines of a file that was written to are still the last 20, which may include older ones). It
  only warns, as before; neither a failure of the script nor of the `touch` can fail the deploy, and each prints a
  WARNING instead of passing unnoticed. A header of an unexpected shape cannot make it skip the next file. `backend/tests/scripts/check-pm2-health.test.ts` runs it over sample `pm2 logs` output (a healthy deploy prints
  nothing; an error written after the restart still warns) and `scripts/deploy-workflow.test.ts` checks the wiring. The
  deploy script is 20 characters shorter (14,927, from 14,947). Why `backend/logs` holds over a hundred numbered
  `api-error-N.log` files was not confirmed: the lead is that `backend/ecosystem.config.cjs` sets `error_file` and `out_file` without `merge_logs`, so PM2
  adds the process id to the names, and the deploy runs `pm2 delete all` and `pm2 start`; the ecosystem file is unchanged.
  Backend bumped to `2.3.101`; root to `2.6.266`.
>>>>>>> Stashed changes
- The health monitor now runs a check that could not run again, twice and 45 seconds apart, before it emails "Health
  Check Could Not Run". What was wrong: the 2026-11-13 07:40 UTC mail (`Cannot find package .../dotenv/index.js`) was not
  a broken install. The deploy of 07:37 UTC was inside `npm ci`, which empties `backend/node_modules` for about 20 to 60
  seconds (07:39:59 to 07:40:18 that time; longer if `npm ci` itself is retried), and the 5-minute monitor run at 07:40:01 started the check in that window.
  The site was healthy, the runs at 07:35 and 07:45 passed, and `node_modules` is intact; the monitor log shows three
  such mails since 2026-11-08, each one a deploy collision. Besides the noise, the 6-hour cooldown per exit code meant a
  collision mail could silence a real broken-install mail sent within the next 6 hours. Now `health-monitor.sh` waits
  and runs the check again when it could not run (exit 2, an invalid alert recipient, is not retried); the last attempt
  decides the outcome, so a run that then works is healthy, one that finds an outage is counted as one, and one that
  still cannot run mails once, with that attempt's output (the output of the earlier attempts is kept in the monitor
  log). A retry can land while the same deploy restarts the API and send "Health Check Failed (1/3)" instead; the next
  healthy run clears it. The worst case (three runs of 120 s and two pauses) stays
  under the 15 minute lock timeout; a run past the 5-minute interval makes the next cron run skip itself. `deploy.yml`
  is untouched (it is near GitHub's expression length limit). Tests cover a transient failure, two, a persistent one,
  exit 2, and an outage found on the retry. Backend bumped to `2.3.100`; root to `2.6.262`.
- The deploy step's script has room to grow again (issue #350). It holds `${{ secrets[...] }}` expressions, so GitHub
  compiles the whole script into one expression and refuses a workflow whose expression is over 21,000 characters; the
  script was at 19,765. Two self-contained blocks moved from `.github/workflows/deploy.yml` into scripts that the deploy
  already uploads and syncs, like `install-law-of-day-cron.sh`: `backend/scripts/install-maintenance-scripts.sh` (the
  copies of the monitoring and report scripts into `/usr/local/bin`, with the example configuration files) and
  `backend/scripts/remove-scanner-cron.sh` (the removal of the standalone vulnerability scanner line from root's
  crontab). The deploy output, the `==> ...` markers, the order and the exit statuses are the same (except that a failure a script
  does not handle itself names a line of that script, with its file name, not of the deploy script): the deploy still
  prints the marker of the crontab cleanup itself, passes the exit status of the maintenance installer on (a failed copy
  of a script that must not go stale still fails the deploy), and treats a cleanup that cannot run as a warning, as it
  treated every problem of that block before. A release without `install-maintenance-scripts.sh` is now refused before
  the live site is touched, like one without a monitoring script. The crontab tests of `scripts/deploy-workflow.test.ts`
  run the real script through the deploy's call, with every assertion kept, the installer has its own tests, and the
  backend's deploy-wiring tests read the installer where they read the workflow's copies. The
  deploy script is now about 15,000 characters. The test that fails above 20,000 characters stays, and a second one
  prints a warning, in its output and in the job summary of the run, without failing, above 18,000. Secrets still
  reach `backend/.env` the way they did. Backend bumped to `2.3.99`; root to `2.6.261`.
- Registered the site for the WebMCP origin trial: `web/index.html` now carries the `origin-trial` token for
  `https://murphys-laws.com` (first-party, subdomains included), so Chrome 149 and later offer the WebMCP tools without the
  `enable-webmcp-testing` flag. The token expires on 2027-03-30. `origin-trial-token.test.ts` reads it, fails if it is
  not a first-party WebMCP token for that origin (subdomains included), warns from 45 days before it expires and fails
  below 7 days, so the tools do not vanish unnoticed. The renewal is in `TODO.md`.
  Web bumped to `3.4.133`; root to `2.6.269`.
- The WebMCP `search_laws` tool now refuses while the signup or submit-a-law form holds input the visitor typed (a text
  field or text area with text, a ticked box or a changed choice), because opening the results leaves the page and those
  forms keep no draft. It returns an error telling the agent to ask the visitor first. Search forms (`role="search"`)
  are ignored, since their text is only a query. Web bumped to `3.4.131`; root to `2.6.265`.
- The site now offers WebMCP tools to browser agents, so an agent can search, filter, calculate and draft a submission
  without scraping the page. WebMCP is Chrome's origin-trial API (`document.modelContext.registerTool`, the imperative
  form: the declarative `toolname` attributes only work on `<form>` elements and several of these controls are not one).
  Browsers without it are unaffected: every call is a no-op there. `web/src/utils/webmcp.ts` registers a tool for a view
  and returns the function that removes it; it keeps one registration per tool name (a view that re-renders replaces its
  own tool instead of leaving one bound to markup that is gone), and a rejected or throwing registration is a
  `console.warn`, never an error for the visitor. `web/src/utils/webmcp-tools.ts` defines the tools, and each view removes
  its tools through the router's `cleanup` hook when the page is left (the category page does it itself, because its
  search component is created after a request and the router only collects cleanups present when a view returns, and
  it builds no search component once the visitor has left, so a late answer cannot replace the next page's tool):
  - `search_laws` (read-only): fills the header search form and submits it, so the same handler, tracking and navigation
    run as for a visitor. The header is on every page, so it is the one place this tool is offered from.
  - `filter_laws` (read-only): runs the advanced search on Browse and the category pages with a category id and/or a
    submitter, optionally with a keyword. It shows those filters in the form first (clearing the controls it did not
    set) and then calls the same `onSearch` the Search button calls, so the form always matches the results and a later
    click on Search does not drop the tool's keyword or category.
  - `calculate_sods_law` and `calculate_buttered_toast` (read-only, pure calculations): return the calculator's result
    for the values given and never move the page's sliders. The first is offered by the home page widget and the full
    Sod's Law page, the second by the full Buttered Toast page. The two formulas and their result bands now live in
    `web/src/utils/sods-law.ts` and `web/src/utils/buttered-toast.ts`, shared by the sliders and the tools, so the
    widget and the full pages can no longer drift apart (same numbers, bands and wording as before; the home widget and
    the Sod's Law page each had their own copy). The unused `buttered-toast-calculator-simple` component keeps its own copy.
  - `subscribe_daily_email`: enters an address in the Law of the Day signup form and focuses Subscribe, but does not
    submit, because submitting sends an email to that address; a missing or invalid address is rejected without touching
    the field, and an address the visitor already typed is never overwritten.
  - `draft_law_submission`: fills the submit-a-law form (text, and optionally title, category and author) and fires the
    form's own `input` and `change` events, so its validation and duplicate check run. It never ticks the CC0
    public-domain release or presses Submit, which stay with the visitor, and it refuses to overwrite anything the
    visitor already entered (text, title, author or a chosen category). Corollaries and the email field are not offered.
  Search and filter submit one tick after the tool returns, so the router's cleanup cannot remove the tool in the middle
  of its own call. Not covered: the search form on the empty favorites page, which does not search yet (it stores the
  query in `sessionStorage` under `searchQuery`, which nothing reads, and Browse takes the query from the URL, so a
  visitor lands on the unfiltered archive), the vote and bookmark buttons (an agent-callable vote would invite
  ballot-stuffing) and the admin moderation page. The origin-trial token is not part of this change, so the tools only
  appear in Chrome with the `enable-webmcp-testing` flag until one is registered. New tests: `webmcp.test.ts`,
  `webmcp-views.test.ts` and `calculator-scoring.test.ts`. Web bumped to `3.4.130`; root to `2.6.264`.
- Documented that the production cron ignores `CRON_TZ=UTC` (issue #351). The server's cron is the Debian and Ubuntu
  `cron` package (`3.0pl1-184ubuntu2`, not cronie), whose `crontab(5)` documents only `TZ` and whose changelog carries a
  `No-multiple-timezones.patch`, so the Law of the Day job runs in the server's time zone, which is `Etc/UTC` (documentary
  evidence; no test job was run). The `CRON_TZ=UTC` line stays in `backend/config/cron.d/murphys-laws-law-of-day` (harmless,
  and cronie honors it), but the comments in that file and in `backend/scripts/install-law-of-day-cron.sh`, the installer's
  warning for a server that is not in UTC, and `shared/docs/DEPLOYMENT.md` now say plainly that the line is ignored, and
  that the warning is printed at deploy time only and compares the current UTC offset. The installer's comments also say
  that on the server `/usr/bin/node` is a symlink to nvm `v22.20.0` (the node PM2 runs) while the job runs the deploy's
  `v22.16.0`, which both deploy paths pass as `LAW_OF_DAY_NODE_BIN` (same major version, so the installer's checks would
  accept either). `DEPLOYMENT.md` gains a "Verified server facts" section (the nginx symlink, the time zone, the cron
  flavour and the node paths, checked read-only on 2026-11-13). The only code change is the wording of the installer's
  warning. Backend bumped to `2.3.98`; root to `2.6.260`.
- The home page now reports a Law of the Day that fails to load, and checks what the API sends (issue #347). What was
  wrong: `fetchAndRender()` in `web/src/views/home.ts` ended in a `.catch` that showed the error state and told nobody,
  so a broken `/api/v1/law-of-day` stayed invisible until a visitor complained; the same `.catch` also caught an
  exception thrown while showing the law and presented it as "could not be loaded", with no trace; and the only check of
  the answer was that it had a first item, so a law without an `id` or a `text` went straight to the renderer and the
  export content. What changed: `requestLawOfTheDay` (`web/src/utils/api.ts`) now checks the law once, where the answer
  arrives (an integer `id` above 0 and a text with something in it, the two fields the renderer and the export need; the
  inline script in `index.html` applies the same rule to the early request's answer, where it used to accept any truthy
  `id`), and throws a `LawOfTheDayShapeError` whose `reason` is `shape`; `fetchAPI` throws an `ApiStatusError` that carries the
  HTTP status (its message is unchanged). The home view handles the request and the rendering separately: a request
  that failed is reported with `reportLawOfTheDayFailure` (a Sentry message such as `Law of the Day failed to load: 503`
  or `...: shape`, with the reason and the detail as context), and an exception while showing the law is reported with
  `Sentry.captureException` (`stage: render`). Failures that are expected on a bad connection (timeout, abort, network,
  and any failure while the browser is offline) are only a breadcrumb, as for the early request. Error events are not
  sampled, so the page sends at most one Law of the Day event per page load, shared with the early request's report:
  later failures, retries included, leave a breadcrumb only. Sentry's `beforeSend` in `main.ts` only filters by message
  and stack, so the limit is decided where the event is sent. The error state and its retry button are unchanged. A
  response without a law (`{ "law": null }`) used to show "no daily law available"; it is now the error state with the
  retry button, like the 404 the API sends when no law is published. The comment above `fetchLawOfTheDay()` now lists
  the whole selection rule of `LawService.selectLawOfTheDay` (published laws only, no corollary of a published law,
  the 365-day rule and its fallback, and a pick already recorded for the day is kept), which is the second part of issue
  #356. New tests: `home-law-of-day-failures.test.ts` (failure status, malformed payloads, transient failures, offline, a
  render exception, one event per page load, the retry). Web bumped to `3.4.128`; root to `2.6.258`.
- The "Browse Murphy's Laws by Category" page (`/categories`) is redesigned (issue #346). What was wrong: the page nested
  one `.categories-grid` inside another, so the seven category groups were laid out as columns of a three-column grid
  (a ragged 3 + 3 + 1 arrangement, "Specialized" alone in a column with 22 cards) and the page was 8,218 px tall at
  1440 px; the links took the browser's default link look (blue, underlined, the colour of the card's `<a>`) so the
  title, the description and the count were all underlined; an unscoped selector in `theme.css`
  (`.category-card--rich` in the `[data-contrast="more"]` blocks, outside any theme or contrast scope) forced a 2 px
  black border on every card in every mode; the card's dark background used `--dark-bg-secondary`, a token that does
  not exist; the footers of cards in a row did not line up; and the pre-rendered page used different markup (centered
  heading, no descriptions, no arrow) from the app. What changed: the groups now stack full width, each with a heading,
  its description and a rule, over its own grid of equal-height cards (`repeat(auto-fill, minmax(min(100%, 18rem), 1fr))`,
  so 3 columns at 1440 px, 2 at 768 px and 1 at 375 px; the page is 5,776 px tall at 1440 px); the featured row is a
  grid that fills its row and is two columns on a phone. Nothing is underlined at rest. The card is the link and the
  cue is the card itself: on hover and on keyboard focus the title is underlined, the border and the count take the
  link colour and the arrow moves one step (not with `prefers-reduced-motion`, which also removes the card's transitions); a pressed card dims rather than moves, as DESIGN.md asks; the focus outline is the existing
  3 px ring, in the light link colour in dark mode (the blue ring was about 2.7:1 against the dark page). The arrow is always
  visible, so touch visitors, who never hover, can see the card opens. The count is no longer preceded by a list icon.
  The footer sits at the bottom of every card, so counts line up across a row, and the description is clamped to three
  lines by CSS only (the JavaScript cut at 147 characters is gone; the full text stays in the page). The card and the
  groups are rendered by one module, `web/src/utils/category-cards.ts`, used by the app and by the static build, so the
  pre-rendered `/categories` now has the same heading, intro, groups, descriptions (the API's, instead of "Explore N
  laws in this category."), counts and arrow as the app, `[^1]` footnote markers stripped from the titles, and the
  display-name overrides applied; `fetchAllCategories` keeps the description. A search that finds nothing now says
  "No categories match" instead of "Categories are being loaded". The `theme.css` selectors are scoped to their theme
  and contrast blocks. No other page uses these classes (checked), so `/category/*`, the home page and the browse
  page are unchanged. Content note: all 55 category descriptions are longer than 150 characters, so every card shows a
  clamped description. New tests: `category-cards.test.ts`, the categories view and static-build tests, an axe run of
  `/categories` in both themes and `e2e/categories-cards.spec.ts` (nothing underlined at rest, title underlined on
  hover, focus outline, stacked clusters and equal card heights). The text helper of the static-build test reads the page with `DOMParser` instead of stripping tags with a regular
  expression (CodeQL `js/incomplete-multi-character-sanitization`). The space between the clusters is a margin (`.category-cluster + .category-cluster`, `var(--space-12)`) and not a flex
  `gap`, which the Kindle browser ignores (DESIGN.md, Kindle browser baseline): the wrapper is no longer a flex column, and
  the e2e test checks the 48 px as a margin. The card footer is a flex row without `gap`, and the card grids use grid
  `gap`, which the contract does not list as unsupported. Web bumped to `3.4.126`; root to `2.6.255`.
- The "Corollary of" banner on a corollary's law page now sits below the law card and above the "In context" section
  (issue #345); it used to sit above the card, under the breadcrumb. A parent law's Corollaries section was already in
  that place, so both pieces now follow the same order: card, then corollary pieces, then context. The order is set in
  `law-detail.html` for the app and in `buildStaticLawDetailContent` for the prerendered page (`ssg.ts`), and both
  render through `renderParentBanner`, so a direct visit does not jump when the app takes over. The banner's bottom
  margin is `var(--space-12)`, the 3rem the cards and the Corollaries list use, so the card, the banner and the context
  are 48 px apart (it was 16 px, as the gap to the card below). The prerendered law card also gets `mb-12`, as the app's
  card has: without it the prerendered card touched the banner, the Corollaries list and the context, and the page grew
  48 px at each of those joins when the app replaced it (measured: card to Corollaries list 0 px prerendered, 48 px in
  the app; now 48 px in both). `DESIGN.md` describes the new place. Tests: `law-detail-corollaries.test.ts` pins the
  order card, banner, context for a corollary and card, Corollaries, context for a parent, `ssg.test.ts` pins the same
  order and the card margin in the prerendered HTML, and `e2e/corollaries.spec.ts` checks the banner's position in a
  browser. Checked in a browser on a corollary, a parent and a plain law, light and dark, at 1280 px and 375 px wide.
  Web bumped to `3.4.123`; root to `2.6.252`.
- A corollary can no longer be the Law of the Day (issue #344). `LawService.selectLawOfTheDay` is the only place the
  pick is made (the 00:00 UTC cron script `select-law-of-day.ts` and the API's first request of the day, which also serves
  the email, push, embed and feed, all call it; the web page, the apps, the CLI and the MCP server only read
  `/api/v1/law-of-day`), and both of its queries, the one-year candidate query and the fallback that ignores the year
  when every law was featured, now leave out corollaries, using the same rule as the corollary filter of the law list
  and the related laws (`EXCLUDE_PUBLISHED_COROLLARIES`: a `COROLLARY_OF` row whose parent is published; a corollary of
  an unpublished law still shows as an ordinary law on its page and stays eligible). Under the one-level rule an excluded
  corollary always has a published parent that is not a corollary, so nothing is left to pick only when no law is
  published, which is unchanged: the service returns null, the job logs an error and exits 1, the API answers 404. A pick
  already recorded for the day is not re-examined and no data is changed, so a corollary recorded before this fix stays
  that day's law until the next UTC day. `law-of-the-day-selection.test.ts` and `select-law-of-day.test.ts` gain a
  `law_relations` table and tests (a corollary with the most votes is skipped, also in the fallback, other relations and
  children of unpublished parents stay eligible, a recorded pick is left alone, a cron run against a real database);
  four of them fail on the previous code. The service test file no longer depends on the date it runs on: its day is
  today's UTC date as SQLite reads it (the one-year rule is evaluated on SQLite's clock, which no fake timer reaches)
  and every history date is counted back from that day, where the old `daysAgo` dates came from `Date.now()` and
  collided with a fixed day, so the file would have failed from the first UTC midnight after it was written. Run with
  the JavaScript and SQLite clocks both moved forward by 1, 2 and 400 days it passes; the old file fails at 1 day.
  `shared/docs/DEPLOYMENT.md` says so. Backend bumped to `2.3.95`; root to
  `2.6.251`.
- The deploy workflow was rejected by GitHub ("workflow file issue": the runs for the nginx guard commits ended in failure
  with no job, so no deploy could start). The `script` of the "Deploy and restart services" step contains
  `${{ secrets[...] }}` expressions, so GitHub compiles the whole script into one expression, and an expression may be at
  most 21,000 characters; the script had grown from 19,162 to 21,292 characters with the nginx guard and its comments
  (actionlint does not know the limit). The comments of the script are shortened (the nginx guard, the reload, the
  `select-law-of-day.mjs` exclusion and the asset retention), with no change to any command, to 19,765 characters. A
  new test in `scripts/deploy-workflow.test.ts` fails when any workflow string that contains `${{` is longer than 20,000
  characters, with a message that explains the limit; it fails on the previous `deploy.yml` (21,292) and the largest
  other such string is 645 characters. The long reasoning of the guard stays in `shared/docs/DEPLOYMENT.md`. Root
  bumped to `2.6.250`.
- A bad `nginx.conf` can no longer be half-deployed. (1) CI: a new `nginx config` job in `lockfile-sync.yml` (a `needs`
  of the required `lockfile-sync` gate, whose name and the names of the other jobs are unchanged, so a failing nginx
  check fails that check) runs `scripts/check-nginx-config.sh` in an `ubuntu:24.04` container, the server's
  distribution, with the distribution nginx 1.24.0 and `libnginx-mod-http-brotli-static`: the file is installed as
  `sites-available/murphys-laws`, enabled through `sites-enabled` with the default site removed, next to throwaway
  stand-ins for the certificate, the key, the Diffie-Hellman parameters (the RFC 7919 group Certbot ships) and Certbot's
  `options-ssl-nginx.conf`, and `nginx -t` runs on it. The package install retries three times with a timeout on each
  `apt-get` call (the apt calls take at most 7 minutes, as in the `bc` step), finishes an interrupted `dpkg` before each
  try (a timeout can kill `apt-get` mid-unpack) and fails the job with the exit status when it never succeeds. The
  script refuses to run where a certificate or the site file already exists, so it cannot replace the real ones on a
  server. Run against the real `nginx.conf` in the container it passes; with an unknown directive added it fails with
  `unknown directive "brotli_nonexistent"`, with an unterminated block with `unexpected end of file, expecting "}"`, and
  with the brotli package missing the script says so, while a plain `nginx -t` on the same file fails with `unknown
  directive "brotli_static"` (the job installs the package itself, so it does not say whether the production server has
  it). (2) The GitHub Actions deploy installed `nginx.conf` and ran `nginx -t` only after `rsync --delete` had replaced
  `web/dist`, the backend, the scripts, the database schema and migrations and the config and after the asset pruning,
  so a rejected file left the new frontend next to the old backend until the next deploy. It now copies the uploaded
  `nginx.conf` into `sites-available` and runs `nginx -t` before the first `rsync`, with the restore-on-rejection and
  `exit` behaviour unchanged (the previous site file is put back, or the new one removed on a server that had none, and
  the deploy fails with the nginx message), so nothing on the live tree changes when nginx says no. Only the reload
  stays late: it still comes after the rsyncs, the installs and the pruning, so nginx does not serve the new
  configuration next to the old web build. Until the reload the previous site file is kept, and an exit trap puts it
  back if a sync, an install or the reload fails, so on any failure the script can see the new file does not wait on
  disk for an unrelated reload (Certbot renewal, a package upgrade, a reboot) to load it next to a half-copied release;
  after a successful reload the backup is removed (a removal that fails only warns) and a later failure leaves the site
  file alone. (3) `npm run deploy` ran `cp && nginx -t && reload` with no restore, after the other syncs, so a rejected
  file stayed in `sites-available` for the next reload or restart to fail on. It now uploads `nginx.conf` as
  `nginx.conf.next`, and one `ssh` command backs up the site file, installs the upload, runs `nginx -t` and on rejection
  restores the previous file (or removes the new one), deletes the upload and fails, before the first sync. On
  acceptance the backup stays; a failure of a sync or of the reload restores the previous file by a second `ssh`
  command, and after the reload the upload becomes the repository copy `nginx.conf` and the backup is removed (a failure
  of that last step only warns). The reload comes after the syncs. Tests: `scripts/lockfile-sync-workflow.test.ts` pins
  the new job (container, order of steps, retries and bounds for both apt steps, the gate matrix now over three results,
  125 combinations); `scripts/check-nginx-config.test.ts` runs the script with stand-ins for nginx and openssl;
  `scripts/deploy-workflow.test.ts` runs the whole part of the deploy step that precedes the root section with a
  recording `sudo` and pins that nothing on the live tree is replaced before `nginx -t`, that a rejection replaces and
  reloads nothing, and (against the old order) that the check would notice; `scripts/deploy-script-nginx.test.ts` runs
  `npm run deploy` itself with stand-ins for `npm`, `rsync`, `ssh`, `tsx` and, on the server side, `sudo` (which stands
  in for `nginx` and `systemctl` too), run by `sh`, so the quoting chain of the remote commands is the real one; both
  deploy paths are also tested for a failure after nginx accepted the file (a sync, the reload) and after the reload.
  `shared/docs/DEPLOYMENT.md` ("A rejected nginx configuration") and `shared/docs/DISASTER-RECOVERY.md` describe it.
  Backend bumped to `2.3.94` (`backend/scripts/deploy.ts`); root to `2.6.249`.
- `analyze-resource-peaks.sh` now checks its window and reads every month file the window touches. The review of the
  earlier month-boundary fix found six older faults, all fixed here. (1) The 30-day cutoff was read from `date` inside
  `awk` and never checked: when `date` failed or printed nothing the cutoff was empty, every row passed the filter and
  the script reported an unbounded window as "Last 30 days". Now the time is read once (`date +%s`), the cutoff and the
  months are formatted from that one instant and checked (a UTC `YYYY-MM-DDTHH:MM:SSZ` cutoff, `YYYY-MM` months), all
  before anything is printed; if `date` cannot give them the script prints `Error: could not work out the start of the
  N-day window` (or `...the months of the N-day window`) on stderr, prints nothing on stdout (so the JSON caller never
  parses half a document) and exits 1. The cutoff and the first month are one instant, which they were not before (the
  month was found with a local `date -d "-N days"`, which keeps the wall-clock time and so lands an hour off the exact
  cutoff when daylight saving time changes inside the window); the time is read with GNU `date -d @<seconds>` or BSD
  `date -r <seconds>`, and under `LC_ALL=C`, so the comparisons of timestamps and months are byte-wise whatever the
  locale of the shell (cron and a login shell differ). (2) The days
  argument is validated: a whole number from 1 to 365, otherwise a usage error (exit 2) on stderr. `-5` and `abc` used
  to be ignored, `0` gave an empty window, `99999999999999999999` an empty cutoff, and `366` was accepted (the limit is
  new). Leading zeros are decimal (`030` is 30). An argument the script does not know is a usage error too (it was
  ignored), as are days given twice (the last one used to win silently), a `--format` other than `text` or `json` and a
  role (`--role` or `METRICS_ROLE`) that does not start with a letter or a digit and go on with letters, digits, `-` or
  `_`, because it goes into the file names. (3) It read only the files of two months, the current and the previous
  one, whatever the window: a window longer than the previous month's reach (above 31 days, or early in a month: 30
  days from Mar 1 or 2 start on Jan 30 or 31) silently left rows out. It now reads the file of every month from the
  local month of the cutoff to the current one (at most 13 for 365 days), each once, with the same local-month file
  names as `performance-tracker.sh`, the legacy `metrics-YYYY-MM.csv` names only for the `main-app` role and the `n8n`
  role's own files only; a month without a file is skipped. The next month is stepped from the month's number, never
  by adding a month to a date. (4) A trailing `--format` or `--role` with no value made the argument loop spin forever
  (`shift 2` with one argument left shifts nothing); it is now a usage error with exit status 2. (5) A metric that no
  row had a reading for was printed blank (`"value":" MB","timestamp":""`; `Min MemAvailable MB` was already left
  out): the peaks started as unset variables, which compare as 0, so a metric that is 0 in every row (the swap,
  usually) was never recorded yet was still printed, and a blank CPU reading with a blank load became a CPU of 0 %. A
  peak is now recorded from the first reading, so the swap shows `0 MB` with its timestamp (the daily report's `PEAK
  RESOURCE USAGE` section showed a blank swap row until now), and an empty, negative or non-numeric cell, a column the
  header lacks or a row shorter than the header is a missing reading, never a 0. A metric with no reading at all is
  left out of `metrics` in the JSON and named in a new `missingMetrics` array (present only when something is
  missing; `mapPeakSection` in `render-daily-report.ts` reads `metrics` and `sampleCount` and ignores it, so the
  daily report leaves such a metric out, and a `null` value would have made its `.replace` throw), and is a row `n/a`
  with the timestamp `-` in the text table. Rows whose first field is not a UTC timestamp are not counted, and a CRLF
  line ending no longer sticks to the last column. For data with a positive peak in every metric the JSON is byte for
  byte what it was. (6) The file list was an unquoted string, so a metrics directory with a space in its path broke;
  it is an array now, quoted at every use, and the script uses no `mapfile` and no associative arrays, so it runs under
  the bash 3.2 of macOS and the bash of the server. Failures no longer leave half an output: awk's result is held
  until awk has succeeded and the banner is printed after it, a file that exists but cannot be read is an error that
  names it, and "Metrics directory ... not found" and
  "No metrics files found ..." (which now names the months) go to stderr, where the daily report logs a failed run
  (they were on stdout), still with exit 1. Callers checked: the daily report runs `--format json --role main-app` on
  the 15th and reads `sampleCount` and `metrics`; the deploy only copies the script; `cost-optimization-report.sh`
  does not call it. `analyze-resource-peaks-month-boundary.test.ts` gained tests for each point (the stand-in `date`
  now formats an epoch, and can fail, print nothing, print garbage, lack `-d` and `-r`, work for the cutoff only or
  give a first month that cannot be walked; the runs have a time limit so a loop that never ends fails instead of
  hanging) and runs the window against the real `date` of the machine in three zones and a zone with daylight saving
  time against the stand-in. Each fix was reverted in turn and the tests of its point failed, except for `LC_ALL=C`
  (no test sets a locale) and two guards that change no result (the early exit on a first month after the current one, which the 14-month limit gives the same
  error for, and the load test before the CPU fallback, which the peak tracker's own skip of negative readings makes
  redundant). Backend bumped to `2.3.93`; root to `2.6.248`.
- The iOS app version is now the same in every file that records it, and a check keeps it so. It was written in three
  places that had drifted: `ios/project.yml` and `ios/MurphysLaws/Info.plist` said `1.2.14 (30)`, but the committed
  `ios/MurphysLaws.xcodeproj/project.pbxproj` (which a local Xcode build uses; the iOS CI regenerates it from
  `project.yml` with XcodeGen) still said `1.2.4 (20)` in both its Debug and Release configurations (the project-level
  `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, which the app and both test targets inherit; no target sets its
  own). Nobody noticed because `npm run check:versions` only checked that a change bumped `Info.plist` and
  `project.yml`, never that the files agree. The project file now says `1.2.14 (30)`, edited in those four lines only:
  regenerating it with XcodeGen was tried and not used, because it also rewrites unrelated parts of the file (it drops
  the entries of the generated, gitignored `DesignSystem/Tokens.swift` and adds `cranes-law.md`). The iOS version is
  not bumped: a change to the project file alone does not call for an iOS bump under `check:versions`, because the
  project file is one of the version files, not a trigger. `npm run check:versions` (and so the pre-commit hook) now
  also fails when `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.yml`, `CFBundleShortVersionString` /
  `CFBundleVersion` in `Info.plist` and every `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.pbxproj` are
  not all the same, naming the values each file has. It fails, and does not skip, when one of the three files cannot
  be read, has no version, has a version line it cannot read (rather than dropping that line from the comparison) or
  has fewer than two of each version (the Debug and Release configurations). Tests in `scripts/check-version-bumps.test.ts` cover agreement,
  each kind of drift, the unreadable and unparseable cases and the command's exit status on a staged scratch
  repository, and run the same check on the files of the repository, so `npm run test:scripts` (which CI runs) catches
  a drift that a commit made without the hook would bring in. Root bumped to `2.6.247`.
- nginx now serves the precompressed brotli copies of the hashed assets (`brotli_static on;` in the `/assets/` location,
  next to `gzip_static on;`). A client that sends `Accept-Encoding: br` gets the `.br` file the build already writes
  next to each `.js`, `.css` and `.svg` file (measured on a build of the web app: the main bundle, 429 KB raw, is
  108 KB instead of 131 KB as the `.gz` file; the three JavaScript bundles and the stylesheet together go from 360 KB
  to 294 KB), gzip-only clients still get the `.gz` file and the rest the plain file. There is no dynamic brotli: every
  other response keeps gzip. The directive needs the `libnginx-mod-http-brotli-static` package (Ubuntu 24.04 universe,
  `1.0.0~rc-5build1`, for the distribution's nginx 1.24), which was installed on the production server on 2026-11-13
  (`/etc/nginx/modules-enabled/50-mod-http-brotli-static.conf` is in place and `nginx -t` passes), so this release can
  be deployed; the filter package is not needed and not installed. A new droplet gets the package with nginx
  (`DISASTER-RECOVERY.md`), and the module must stay installed until a release that removes `brotli_static` is
  deployed (`DEPLOYMENT.md`, section "Brotli for the precompressed assets", has the install, verification and
  rollback order). Checked in an `ubuntu:24.04` container with nginx 1.24.0, the package above and this `nginx.conf`:
  a browser's `Accept-Encoding` gets `content-encoding: br` with a body that decodes to the original, `gzip` gets the
  `.gz` file, no header gets the plain file, each with one `Cache-Control` and `Vary: Accept-Encoding` (from
  `gzip_vary on;`, which must stay), a script outside `/assets/` is never sent as br, and without the module
  `nginx -t` fails with `unknown directive "brotli_static"`. The nginx test requires exactly the one brotli directive,
  in the hashed-assets location, `gzip_vary on;` at the server level and the module in the disaster-recovery install
  line. Web bumped to `3.4.122`; root to `2.6.246`.
- The web build is deterministic: one commit builds one set of bundle file names. The Sentry release name was
  `murphys-laws-web@<Date.now()>`, and the Sentry plugin (which runs in the deploy build, where `SENTRY_UPLOAD` is
  set) compiles it into the entry chunk, so every deploy build gave `index-*.js` and `index-legacy-*.js` (and with
  them every prerendered page and `sw.js`) a new hash even when the same commit was built again (a re-run, a rollback
  and redeploy): returning visitors re-downloaded the bundle, `dist/assets` grew by two files per build and the
  service worker was replaced each time. The release is now one string resolved once (`web/scripts/app-release.ts`):
  `VITE_APP_VERSION` (the commit SHA, set from `github.sha` in the deploy and the web CI builds; read from the
  environment of the shell or the job, not from `web/.env`), else `git rev-parse HEAD`, else `<package version>-dev`
  (with a warning; a build with `SENTRY_UPLOAD` set refuses it), never the clock. A `VITE_APP_VERSION` that is not a
  valid Sentry release name stops the build. The release is passed both to the Sentry plugin (source map upload) and,
  through `define`, to `Sentry.init({ release })`, so the browser and the uploaded maps are given the same name (a
  deploy that has `SENTRY_UPLOAD` set but lacks a Sentry credential skips the plugin, as before, and uploads
  nothing). Two builds of the same commit are byte-identical in `dist/`, with and without the Sentry plugin
  (JavaScript, CSS, legacy bundle, polyfills, `sw.js`, HTML, `.gz` and `.br`); a new commit (or a source change) moves
  only the entry chunks (and `sw.js` and the pages that reference them), because the commit SHA is part of the entry
  chunk; the polyfills and the stylesheet keep their names until they change. Sentry's Releases list now shows the
  40-character commit SHA instead of `murphys-laws-web@<timestamp>` (on a pull request, `github.sha` is the merge
  commit, which only matters to builds that do not upload). Tests pin the release resolution, that the release the
  Sentry plugin is given is the one compiled into the bundle, that the build files read no clock, random number or
  host name and that every web build step of the workflows is given the commit. `sw.js` is still a hash of the whole
  build output, so it changes when the prerendered pages change with the database (an existing test pins that); it no
  longer changes on its own.
  Web bumped to `3.4.121`; root to `2.6.245`.
- The Law of the Day is picked at 00:00 UTC by a scheduled job again, instead of by the first request of the day. The
  nightly job had never run: its `>> logs/law-of-day.log` redirect pointed at `/root/murphys-laws/logs`, which the
  deploy's cleanup of old root-level files (`rm -rf ... logs`) deletes on every release, so the shell failed before
  `node` started (cron logged the start every night), and the first request to `/api/v1/law-of-day` after midnight
  picked the law instead: of the 12 picks from Nov 1 to Nov 12, none came before 00:03 UTC and 10 fell between
  00:22 and 00:26. Behind it, the server kept running a Feb 22 copy of `select-law-of-day.mjs`, because the upload to
  the staging directory never deletes and each deploy synced that copy back. Now:
  the schedule is a file in the repository, `backend/config/cron.d/murphys-laws-law-of-day`, that every deploy
  (`deploy.yml` and `npm run deploy`) installs to `/etc/cron.d` through `backend/scripts/install-law-of-day-cron.sh`,
  after the dependencies are installed and the migrations ran. The script is idempotent, replaces the file in one
  step (a dot-named temporary file in `/etc/cron.d`, which cron ignores, then a rename; mode 644, owned by root; a hand
  edit is overwritten), creates `backend/logs` (the job's log is `backend/logs/law-of-day.log`, in a directory the
  deploy keeps), and removes the old `select-law-of-day.mjs` line from root's crontab so the job cannot run twice, and
  the old `.mjs` itself, but only after the new job is installed and the old line is gone: both deploy paths keep rsync
  from deleting the old script (`--exclude`, which also keeps the stale staging copy from being copied back), so a
  refused install, or an old line that could not be removed, leaves the line and the file it runs as they were. The job runs the node that the deploy runs with, not a fixed
  `/usr/bin/node`: both paths pass it as `LAW_OF_DAY_NODE_BIN` (`deploy.yml`: the nvm node on the PATH of the root
  part of the script; `npm run deploy`: the nvm node on the server, not `process.execPath`, which is the node of the
  machine running the deploy) and the installer writes that absolute path into the job's command in place of
  `/usr/bin/node` (the default when none is given), so a Node upgrade is picked up by the next deploy; the path must be
  plain characters (an empty one, from a deploy that could not find its node, is refused, not replaced by the default),
  and the written file is checked (final newline, no `%` outside the comments, the node on the script in a line that
  is not a comment) before it replaces anything. The installer is run with stdin closed. It refuses to install, before changing anything, a
  job that could not start: no schedule file, `select-law-of-day.ts`, `backend/node_modules/tsx`, `.nvmrc` or
  `crontab`, or a node (the one the job runs) that is missing, cannot report its version, is not the major
  version of `.nvmrc` or cannot load `better-sqlite3`. The crontab edit follows the rule of the
  scanner cleanup above (including its warning when `crontab -l` prints something): root's crontab is read into a variable and written back only from a successful read, only
  when the old line was there and only when something other than blank lines remains, so it is never emptied (an old
  line that is the only entry stays, with a warning); every other failure leaves it as it was and only prints a
  `WARNING:` line. Both deploy paths treat a failed install as a warning and go on with the release, since the API
  picks the law on the first request of the day when the job is not installed; in `deploy.yml` the install step sits
  after the crontab cleanup and before the PM2 restart (outside the "testing nginx and reloading" step), in
  `npm run deploy` after the migrations and before the restart. The file sets `CRON_TZ=UTC`, which cronie honors and
  the Debian and Ubuntu cron package does not document, so the installer warns when the server's time zone is not UTC
  (the pick is for the current UTC day whenever the job runs, but a run before 00:00 UTC no longer picks ahead of the
  first visitor). The cron command is grouped in braces so that a failing `cd` is logged too. The job runs `select-law-of-day.ts` through the
  `tsx` that PM2 uses for the API. The script no longer carries its own copy of the pick logic through the `sqlite3`
  command line: it calls the new `LawService.selectLawOfTheDay`, which `getLawOfTheDay` now uses too, with the same
  query as before (highest-voted law not featured in the last 365 days, alphabetical tiebreak, any published law when
  all were featured). The check and the insert run in one `BEGIN IMMEDIATE` transaction that takes SQLite's write
  lock first (the 5 s busy timeout covers a wait), so when the job and a request meet at midnight, or two jobs start
  together, exactly one picks and the others use that pick; the replacement pick for a law unpublished during the day
  is kept. Every run logs one timestamped result line (picked, already picked, or an error with a non-zero exit), after the
  database service's own untimestamped connection line, and the database is opened the way the API does
  (`resolveDatabasePath`, so a missing file is an error instead of a new, empty one). Tests
  cover the pick with two real connections to one database file (the lock, and finding the other process's pick), the
  tiebreak, the script, the exact cron command run through `sh -c` against a real database (twice in a row, and three
  at the same moment), the installer (crontab with and without the old line, only the old line, no crontab, every
  failing step, the checks of tsx, `.nvmrc` and Node, the node written into the job and the paths refused, the time
  zone, mode and temporary files of the cron file), the schedule file, a pick that waits for a held write lock, and both
  deploy paths, including the real scripts rsync and the install step of the deploy script run with an installer that
  fails. The documented daily email and notification jobs wrote to `../logs` (the same missing directory); their docs
  now use `backend/logs`, but they are still not installed on the server and stay that way until SMTP and the VAPID
  keys are set. Backend bumped to `2.3.92`; root to `2.6.244`.
- The deploy can no longer empty root's crontab, and the asset pruning gets more time. The deploy step that removes the
  retired standalone vulnerability scanner cron job ran
  `sudo crontab -l | grep -v vulnerability-scanner.sh | sudo crontab - || true`: when `crontab -l` failed for any reason
  other than "no crontab for root" (permissions, an I/O error, a transient failure), `grep` printed nothing and
  `crontab -` replaced the whole crontab with an empty one, which would delete every scheduled job on the server
  (backup, daily report, health monitor, performance tracker, Law of the Day selection), and nothing reported it
  (`|| true` also hid a failed write). `grep -v` also exits 1 when it filters out every line, which nothing reported
  either, and the empty result was written anyway. The step now reads the crontab into a variable and writes it back
  only from a successful read, only when a scanner line was actually there, and only when something other than blank
  lines remains: an empty or blank result is never written, so a crontab whose only entry is the scanner line is left
  as it is. "No crontab for root" is left alone (a line that `sudo` prints first does not hide it, and `LC_ALL=C`
  keeps the message recognizable). The cleanup is housekeeping and must never block a release (a failure after the
  migrations and before the PM2 restart would leave the old API running against the new schema), so every problem
  only prints a plain `WARNING:` line and the deploy goes on, and the step never calls `exit`: any other failed read,
  a `grep` that errors (exit 2) in any of the three searches, a temporary file that cannot be created, a failed write
  and a crontab whose only entry is the scanner line all leave the crontab as it was (`crontab -` replaces it
  atomically), and a temporary file that cannot be removed only warns. Other lines are kept byte for byte (a rewrite drops trailing blank lines and adds a missing final
  newline). Text that `crontab -l` prints to stderr on success never reaches the crontab, and `crontab -l` reads no
  standard input, so it cannot swallow the lines of the script that `sudo bash <<'INNER'` is reading. Twenty new
  tests in `scripts/deploy-workflow.test.ts` (49 in all) cover this: eighteen run that part of the deploy script as
  written, with stand-ins for `sudo`, `crontab`, `mktemp`, `rm` and `grep`, and each failure asserts the crontab untouched,
  the warning printed and the lines after the block still running: a failed read (with a message, without one, and
  with a last line that is not "no crontab"), no crontab, one or several scanner lines, no scanner line, only the
  scanner line, an empty and a blank crontab, Windows line endings without a final newline, a 20000-line crontab,
  stderr noise, `sudo` noise, a `grep` error in each of the three searches, a failed write, a failed `mktemp` and a failed `rm`, a
  script read from standard input, and the shell options of the deploy script (`set -e` and an ERR trap, with and without
  `pipefail`); the other two check where the block sits (no `exit`, no `|| true`, no read piped into a write) and the
  pruning timeout. `shared/docs/DEPLOYMENT.md` describes the behavior.
  The asset pruning block of the same script (`timeout 90 node .../prune-stale-assets.mjs`) took about 69 seconds on
  the 1-vCPU production server in its first real run, because it parses 14 days of nginx logs. That is too close to its
  90-second limit: a timeout only warns and never fails the deploy, but it would quietly turn pruning off. The limit is
  now 180 seconds, still well inside the ten minutes that `appleboy/ssh-action` allows the whole script (its default
  `command_timeout`, which `deploy.yml` does not set). A test keeps the limit above twice the measured run and at
  most a third of the ssh action's. Root bumped to `2.6.242`.
- The home page now holds the app bundle until the Law of the Day answer has arrived. On a cold HTTP/2 connection the
  0.6 KB answer of the early request queued behind the bundle (173 KB over the wire): the answer reached the browser
  300 to 400 ms after the stylesheet (nginx's own log showed 80 to 300 ms between the request and the sent response
  while Node took 5 to 8 ms), so the law, the largest contentful paint, painted that much later than it could. The SSG
  (`holdAppEntry` in `web/scripts/ssg.ts`) turns the module script of the built `dist/index.html` into an inert
  `#app-entry` placeholder, and a separate inline ES5 block in `index.html`, before the stylesheet, starts the bundle by
  adding the module script once the early request has settled (with the law, or without it: a failed request resolves
  to null, and the app still reports the failure from `window.__earlyLawOfDay.error` as before). The hold ends at the
  latest 1000 ms after the block ran, so a slow, failed or hung API cannot keep the app from loading, and a loader that
  throws starts it at once; an add that fails leaves the later trigger a retry. The hold only decides when the bundle
  starts: the early request keeps its shared 10 s window, and the app's own fallback request gets what is left of it.
  The module is added only once parsing has ended, which is when the browser would run an ordinary deferred module
  script, because `main.ts` needs `#app`. The block starts the bundle at once when there is no early request: on a path
  other than `/` and `/index.html` (the service worker answers navigations it cannot fetch with the home page, and the
  backend builds the runtime pages of laws and categories published after the last build from `dist/index.html`, so
  those carry the placeholder too), on a legacy `/#/...` hash route, and in a browser without `fetch` or `Promise`. The
  pages the SSG builds from the shell, the 404 page and the nomodule legacy entry are unchanged, and the app still
  adopts the early answer (`consumeEarlyLawOfTheDay`), with the cache bypass after a vote untouched. The build fails if
  the shell has not exactly one such module script, and `validateHomePage` fails it when the home page lacks the
  placeholder (in the form the loader accepts) or the loader, keeps an ordinary entry script, or preloads an asset with
  a `modulepreload` link (which would fetch chunks while the bundle is held back; there is none today); its tag
  patterns read case and whitespace as a browser does, and the loader is taken only from an inline script (no `src`, no
  `type`). The loader trusts the element with the id `app-entry` as a script source only if it is a `script` of type
  `text/plain` whose `data-src` is a file name in `/assets/` ending in `.js` (no scheme, host, `..` or subdirectory), so
  injected markup that takes the id cannot make the page load a script from somewhere else. `scripts/check-web-budgets.mjs` reads the
  bundle from the placeholder. Trade-off, measured on the real network (about 142 ms RTT to production) with 4x CPU
  throttling and cold loads, comparing production's page with and without the change (medians of 14 runs per arm,
  repeated with 8 runs after the change was rebased): largest contentful paint 1112 ms to 664 ms (450 ms earlier;
  390 ms in the repeat) with no bandwidth cap, and 948 ms to 768 ms (180 ms earlier; 170 ms in the repeat) with the
  network capped at 1.6 Mbps; total blocking time unchanged (within 10 ms); but the app mounts and the bundle finishes
  later, by 185 to 245 ms with no cap and 135 to 175 ms at 1.6 Mbps, because the bundle is requested after the answer
  instead of with it. The prerendered page is readable and its links work in that window, but search, votes and the
  calculators need the bundle. Tests: `web/tests/app-entry-loader.test.ts` runs the real loader (every path above, the
  parser ordering, a throwing promise, a failing add, each kind of untrusted placeholder) and then together with the real early script (the answer, a
  failure, a hung request, other paths, a hash route, no `fetch`, one request with the vote cache bypass);
  `web/tests/ssg.test.ts` covers `holdAppEntry` and `validateHomePage`. The e2e suite covers the answer, a failed request, a 503, a hung API, an API
  slower than the cap, a route without a page of its own and an untouched other page. Web bumped to `3.4.120`; root to
  `2.6.240`.
- Built web assets no longer pile up on the server. The deploy uploads `web/dist/` into a persistent staging
  directory with no delete and mirrors that directory into the web root with `rsync --delete`, so every release left
  its hashed bundles behind (1,185 files and about 650 MB in `assets/` after nine months), and the `.gz` and `.br`
  copies the build now writes would make it grow faster. A new `backend/scripts/prune-stale-assets.mjs` runs in the
  deploy after the sync and before nginx is reloaded, on the staging copy and the web root (pruning only the web
  root would be undone by the next rsync, and pruning only staging would leave the files in the web root until the
  next release). It keeps every file whose name appears in a text file of the current build outside `assets/` (the
  prerendered pages, the manifest, `sw.js` with the precache list inside it), every file named by any kept script or
  stylesheet (imports, `__vite__mapDeps` lists, CSS `url()` references, including old files kept by another rule),
  everything modified in the last 30 days, every file the retained nginx access logs (about 14 days with the
  server's logrotate rule) show being requested successfully, and the `.gz`, `.br` and `.map` siblings of a kept
  file. It deletes only older files that none of that keeps, one named file at a time, never a directory, link or
  anything that is not a regular file. It deletes nothing when a check fails: no `index.html` or `assets/`, an
  `index.html` that names no entry script, an entry script or stylesheet it names that is missing, an unreadable
  file or access log (or one that does not look like an nginx access log, such as an `.xz` rotation), no access log
  that exists or no asset request in them (the glob passes the literal pattern when no log matches, so a missing log
  stops the run instead of switching the log rule off), fewer than five files kept, or a plan that would delete more
  than 90% of the files. A run over a big backlog that the limit would stop can be allowed by hand with
  `--max-delete-fraction <0 to 1>` (look at a `--dry-run` first); the deploy never passes it. All directories are
  planned before the first deletion, and only regular files outside `assets/` are read (a named pipe would block it;
  a dangling link among the text files stops the run, which deletes nothing). A name counts as mentioned whatever its
  extension (`.mp3`, `.eot`) and however it is written (`logo@2x-HASH.webp`, a name with a space, written out or as `%20`), and kept SVG,
  JSON and HTML files in `assets/` are traced like scripts, so none of these depends on the 30-day
  rule. `--dry-run` reports without deleting, a second run finds nothing, and a file that cannot be deleted is named
  and counted (exit code 3) without stopping the rest. The deploy only warns, with a plain `WARNING:` line in the
  deploy log that has the exit code, when the script does not complete (it is cut off after 180 seconds): it never
  blocks a release. Tests cover the keep rules, the age limit to the millisecond, each abort, the deletion failures,
  the new flag and the deploy wiring; the script reaches 100% line and branch coverage in its own test file (the
  backend coverage gate only covers `src/`). The deploy step's pruning block is also run as written, with stand-ins
  for `sudo` and `timeout`, against throwaway staging and web-root copies in `scripts/deploy-workflow.test.ts`:
  stale files go from both, and a missing access log, a failed safety check, a `node` that exits 127 (as a missing
  one does) or a crashing script (exit 1, 3 or 127) only warn while the deploy goes on. The script also starts when it
  is reached through a symbolic link (its entry-point check, `isEntryPoint`, compares real paths and, like `runCli`
  and `run`, is tested in-process; only the one line that applies the exit code is excluded from coverage). A file whose
  name has a space or another escaped character is also kept when the access log shows it requested, because the logged
  path is read both as written (`my%20file.png`) and decoded once.
  Root bumped to `2.6.237` and backend to `2.3.90`.
- The root scripts tests (`scripts/*.test.ts`, `npm run test:scripts`) now run in CI on every pull request and every
  push to `main`. Only four of them (the workflow and lockfile contract tests) ran before, so a fixture dated 2026-10-10
  went stale on 2026-11-09 (the metrics analyzers only read the last 30 days) and failed unnoticed for days. They run in
  the `Root checks` workflow (`lockfile-sync.yml`, no path filter; the suite itself takes about 20 seconds) as a new
  `Scripts tests` job next to `Lockfile versions`; the `lockfile-sync` check that the repository already requires is now
  reported by a gate job that needs both, so a failing scripts test blocks the merge without any change to the
  repository ruleset. The job installs `bc` (the cost report script needs it, the runner image may not have it, the
  server does), retrying the apt mirror three times with every apt call bounded and the failing exit status reported,
  and `npm run ci` runs the suite too. A newer push to a pull request cancels the older run, but a run on `main` has a
  group of its own and is never cancelled by the next merge. The workflow contract tests that `lockfile-sync` used to
  run by name are part of the suite, and a new `lockfile-sync-workflow.test.ts` pins the triggers, runs the gate script
  and the `bc` step against every outcome, forbids the common ways of swallowing or skipping a failure, and pins the
  required check name. Root bumped to `2.6.233`.
- The web app now samples every Sentry transaction for the performance measurement window: `tracesSampleRate` in
  `web/src/main.ts` goes from `0.1` to `1.0`. Only about 9 pageloads a day were being sampled, too few for the
  scheduled performance reports of 2026-11-15 and 2026-11-19, and traffic is small, so the Sentry quota cost of 100% is
  expected to be trivial. The rate applies to the pageload and navigation transactions the browser tracing integration
  creates. A new test (`web/tests/sentry-sampling.test.ts`) pins the rate in the source of `main.ts`, which is the entry
  point and cannot be imported in a unit test. The backend's `initSentry` is unchanged: its own rate stays `0.1`.
  `TODO.md` gets an item to revisit the web rate after the 2026-11-19 report. Web bumped to `3.4.117`; root to `2.6.232`.
- The early Law of the Day request is bounded to one shared 10 s window and its failures are reported. A dead or hung
  API now reaches the error card about 10 s after the page started, not about 20 s. The early request and the app's own
  request share one 10 s window that begins when the early request starts: the app waits for the early request only
  until that window ends, even if its promise never settles, and its own fallback request gets what is left of it
  (`max(0, 10 s - elapsed)`, never more than 10 s, passed to `fetchAPI` as `timeoutMs` and also enforced with a timer, so
  it holds without `AbortController`). If the early request timed out, or ran out the clock, nothing is left and the app
  goes straight to the error card with no second try; a request that failed quickly (503, network, parse or shape error)
  leaves nearly the whole window, so the fallback request stays useful. The error card's button and a page without an
  early request still get a full 10 s. Where a slow bundle arrives after the window has ended there is no fallback
  request either, only the error card, whose button fetches again. The inline script also bounds its
  request with its own timer, which covers browsers that have `fetch` but no `AbortController` (there it had no timeout
  at all). A failure is no longer invisible: the script records why on
  `window.__earlyLawOfDay.error` (the HTTP status, `timeout`, `abort`, `network` (including a connection lost while the
  body is read), `parse`, `shape`, `error` (including a `fetch` that throws before any request is made) or `paint`)
  while its promise still never rejects, so nothing reaches the unhandled-rejection banner: it resolves to `null`, or to
  the law when only the paint failed. When the app falls back, adopts a law whose early paint failed, or drops an early
  result (another API than the app uses, older than a minute, or started before the last vote), it adds a Sentry
  breadcrumb and, except for the outcomes it already treats as noise (`timeout`, `abort`, `network`, `stale`, `voted`),
  sends one warning message. A throwing paint (also inside the `readystatechange` listener, or while scheduling it) is
  caught and recorded instead of reaching the error banner, and the law and the
  promise are settled in one step, so they cannot disagree. The script is skipped on legacy `/#/...` hash routes, which
  the router rewrites to another path (a bare `/#/` still runs it). The build now fails when `__API_BASE_URL__` survives in `dist/index.html`, in `404.html`
  or in any generated page checked by the SSG (a missing `earlyApiBasePlugin`), and the prerender e2e spec asserts that the
  page requests exactly `<origin>/api/v1/law-of-day` once, and the app makes no second request (its `**/api/**` mock used to
  answer a wrong URL as well). New tests run the real inline script and then the app's `peekEarlyLawOfTheDay`,
  `consumeEarlyLawOfTheDay` and `fetchLawOfTheDay` against it, for the same origin and for a configured
  `VITE_API_URL`, and cover every failure reason, a hung body, a late answer after the timeout, and a failing paint. Comment
  fixes: the index.html comment now cites the measured real-user P75 LCP of 13.4 s, the 60 s adoption window is documented
  as a bound on staleness only (a result inside it is used even across midnight UTC), and `peekEarlyLawOfTheDay` documents
  when it returns null. `web/DESIGN.md` records the layout contract between the prerendered home skeleton and the app's
  Search the Archive card and Law of the Day zone, with the e2e guard that enforces it. The Law of the Day error path in
  the home view now goes through the same `onDailyLawShown` helper as the success path. The fresh fetch for a minute
  after a vote is unchanged: the early script and the app's own fallback request (with its shorter window) both still send
  `cache: 'no-cache'` inside that minute, and `fetchAPI` takes the cache mode and the timeout as one options object.
  Web bumped to `3.4.116`; root to `2.6.228`.
- Scripts and stylesheets without a content hash are no longer cached for a year. `nginx.conf` applied its one-year rule
  (`Expires` in 2027 plus `Cache-Control: max-age=31536000` and `public, no-transform`) to every `.js`, `.css` and image
  file, so `/sw.js`, `/offline.js` and `/styles/*` (including `variables.css`, which every build regenerates) kept their
  URL while their content changed. Browsers already skip the HTTP cache when they check `/sw.js` itself, so the files that
  could really stay stale were `/offline.js` and the stylesheets, which the service worker's precache also reads through
  the HTTP cache. They now send a single `Cache-Control: no-cache` (stored, but revalidated before each use; the `ETag`
  makes that a `304` with no body), as do `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` and
  `/image-sitemap.xml` (which sent no `Cache-Control` before). Any `.js` or `.css` file without a content hash gets this
  by default, so a future unhashed script is safe. Hashed assets stay `immutable` and the images keep their one-year
  lifetime (images rarely change; a changed one can stay stale in browsers for a long time). Checked in an
  nginx 1.24 container for every file class with `nginx -t` and `curl -I`;
  `web/tests/nginx-performance.test.ts` models the location precedence and pins the headers of each class, and
  `shared/docs/DEPLOYMENT.md` has the table and how to repeat the check. The manifest is still served as
  `application/octet-stream` and the pages still send no `Cache-Control` (both in `TODO.md`).
  The service worker's precache now bypasses the HTTP cache (`cache: 'reload'`) for the unhashed scripts, stylesheets
  and the manifest. Returning visitors already hold `/offline.js` and `/styles/*` in their HTTP cache with a one-year
  lifetime from earlier fetches, and `Cache.addAll` reads through that cache, so a new worker would have precached the
  old copies and kept them stale for up to a year. This is a one-time transition: those cached copies are refreshed at
  the next service worker install, and from then on the `no-cache` header keeps them current. Hashed bundles and
  images are still precached through the HTTP cache, so an install does not download them again. Web bumped to
  `3.4.114`; root to `2.6.226`.
- The deploy now stops when nginx rejects the new configuration. Its nginx step ran
  `sudo nginx -t && sudo systemctl reload nginx`, and under `set -e` a failure in an `&&` list that is not its last
  command does not stop the script, so a rejected `nginx.conf` stayed in `sites-available` while the deploy went on
  (migrations, PM2 restart) and reported success, and the next reload or restart could not load the file. The step
  now keeps the previous site file (or notes that there was none), installs the new one and runs `nginx -t` in one
  condition, restores the previous file when either fails, does not reload, and fails the deploy; a backup or restore
  that cannot be made fails it loudly instead of being ignored. A test runs that part of the deploy script with
  stand-ins for `sudo`, `nginx`, `systemctl`, `cp` and `mktemp` (accepted configuration, rejected one with and without
  a previous file, a backup that cannot be made, an install that fails). `backend/scripts/deploy.ts`
  (`npm run deploy`) has the same `&&` pattern: it fails there too but leaves the rejected file in place, and is
  unchanged. `shared/docs/DEPLOYMENT.md` describes the behavior.
  Root bumped to `2.6.224`.
- `GET /api/v1/law-of-day` now sends `Cache-Control: public, max-age=N` with a 200, so a browser or shared cache can
  reuse the response and repeat visits and the early home page request cost less. N is the lesser of 60 and the whole
  seconds left in the UTC day the law was featured on, so a cached response never outlives 00:00 UTC, when the next law
  is chosen (the last second sends `max-age=0`). There is no `stale-while-revalidate`, which would let a cache serve
  yesterday's law after midnight. The response also sends `Vary: Origin`, because the CORS origin it echoes depends on
  the request's Origin when `ALLOWED_ORIGINS` is a list. The 404 and error responses send no `Cache-Control`. The vote
  counts in the law can now be up to 60 seconds old, and a law rejected by a moderator can show for up to 60 seconds
  more. The body is unchanged. The OpenAPI spec and API docs describe the headers. Backend bumped to `2.3.86`, root to
  `2.6.222`.
- The Law of the Day is fetched fresh, not from the HTTP cache, for a minute after the visitor votes, so the card cannot
  show a count that leaves out the vote next to a voted highlight now that the API response is cacheable for up to 60
  seconds. Casting or removing a vote stores its time in `localStorage` (`murphy_last_vote_at`, `utils/recent-vote.ts`).
  `fetchLawOfTheDay` then requests with `cache: 'no-cache'` while the vote is under a minute old, the early inline
  script in `index.html` (ES5) does the same when a reload starts it inside that minute, and an early result that was
  requested before the last vote is no longer adopted, so a visit that went from the home page to a law page, voted
  there and came back refetches. Storage errors are ignored (the cache then just ages out), and a stored value that is
  not a time, or is far ahead of the clock, is ignored rather than bypassing the cache for good. The iOS app's
  law-of-day request now uses `.reloadIgnoringLocalCacheData` (a `cachePolicy` parameter on `APIService.request`), so
  `URLSession` no longer answers a pull-to-refresh after a vote from the 60 second cache. The Android app's OkHttp
  client has no cache, and the SDK, CLI and MCP server use Node `fetch`, which has none, so they always ask the server.
  Web bumped to `3.4.112`; iOS to `1.2.13 (29)`; root to `2.6.223`.
- The footer ad and Google Analytics (gtag) no longer start on the visitor's first click, key press or scroll (the slow
  "Email address" key press in Sentry's INP samples). The footer ad now loads once the page has loaded and the browser
  is idle (`requestIdleCallback` with a 3 s bound, a 3 s timer in Safari), and still also when the footer nears the
  viewport. gtag, which already had an idle fallback, now loads on whichever comes first: `load` followed by an idle
  moment (same 3 s bound), or a 5 s ceiling from the moment the app starts, so a visitor who leaves before a late `load`
  is still counted. The existing guards stay (canonical host, Kindle, `hideAds`, minimum content re-checked when the idle
  callback fires, `adslot:init`), and a callback that fires after navigation replaced the footer does nothing. The ad is
  scheduled only on a first full page load, as before: on in-app navigations, and when the app renders after `load`, the
  router has already cleared the page, so there is no `<main>` while the footer is built and it schedules nothing.
  Trade-offs: the ad now loads for every visitor who finishes loading the page, including ones who never interact (bots,
  bounces, Lighthouse), so ad requests can rise, the 50 ms `ensureAdsense` poll runs for all of them, and on hosts other
  than `murphys-laws.com` the empty ad shell now appears after load without any interaction. The ad slot reserves no
  space, so an idle-timed ad on a short page can count as layout shift, where a shift right after a click was excluded.
  An idle callback with a timeout can still fire on a busy thread, and gtag already loaded on idle before, so the INP
  benefit is unproven (the outlier was one session). Tests replace the interaction triggers with an idle queue and pin the
  3 s and 5 s bounds.
  Web bumped to `3.4.111`; root to `2.6.220`.
- The home page no longer waits for the app bundle before it can show the Law of the Day, the element that was the
  largest contentful paint on `/` (real-user P75 LCP 13.4 s, always `a.lod-link`). A small inline script in `index.html`,
  placed before the stylesheet, requests `/api/v1/law-of-day` as soon as the HTML arrives and paints the law into the
  prerendered zone when the page is parsed. The request goes to the API the app is built for (the build puts
  `VITE_API_URL` into the script; same origin when unset), and the bundle adopts the response (no second request, no
  spinner) only if it came from the URL the app itself would request; otherwise, or if the early request failed or is
  older than a minute, it makes its own request. The prerendered home page now matches
  what the app renders so the first paint is also the last largest paint: `<main>` no longer adds a second container
  (the prerendered page was 32 px narrower, so the quote wrapped differently and the app's later render was a larger
  element that moved LCP back to the bundle's render time), the Search the Archive card is one shared string
  (`views/home-archive-search.ts`) used by the app and the build, and the Law of the Day zone has the app's reserved
  height and title. The no-JavaScript card and the search form still work. Measured in Chrome with the production build
  under CPU and network throttling: LCP 0.6 s instead of 1.2 s (150 ms RTT, 1.6 Mbps, 4x CPU) and 1.1 s instead of 2.1 s
  (300 ms RTT, 0.8 Mbps, 6x CPU), a single LCP entry, CLS 0. Tests run the inline script from `index.html` (home only,
  never rejects, 10 s timeout, paints text as text) and check its markup against the component's for every attribution
  shape. Two guards keep the prerendered and app layouts together: a unit test compares the prerendered home skeleton
  with the app's, and a Playwright spec (`e2e/prerender-law-of-day.spec.ts`, run against the production build, which the
  e2e CI job now builds first) checks at four phone and desktop sizes, for short, medium, long and titled
  (multi-attribution) laws, that the early quote has the app quote's x, width and height, is never lower, and is the last LCP entry.
  Web bumped to `3.4.110`; root to `2.6.219`.
- Both deploy paths (`npm run deploy` and the Deploy to Production workflow) now run
  `backend/scripts/verify-installed-dependencies.mjs` right after `npm ci`. It resolves every runtime dependency in
  `backend/package.json` the way an ESM `import` does, checks that the file it resolves to exists (an `exports` map
  makes `import.meta.resolve` return a URL without looking for the file), and stops the deploy, naming each package it cannot find, before
  the migrations and the restart. An install that exits 0 but leaves a package without its entry file (the broken
  `nodemailer` that crashed the health check on Nov 8 and Nov 11) now fails the deploy instead of the monitoring.
  Tests run the script against good, missing and entry-less packages and pin its place in both deploy paths (a renamed
  or removed anchor line fails them instead of passing the ordering check).
  Root bumped to `2.6.211`.
- The Web CI e2e job no longer hangs or fails on a slow apt mirror. It has a 20-minute limit, installs only chromium
  (the one browser the suite uses) with up to three attempts for the system packages and the download, caches the browser
  by Playwright version, and uploads the screenshots and videos of failed tests. A newer push to a pull request now
  cancels the older Web CI run; runs on main always finish. A contract test covers these settings. Root bumped to `2.6.207`.
- Advanced Search no longer changes the page when a category is picked; choose a category and press Search.
- Removed the category helper text under the Category dropdown.
- Compression and HTTP/2 (nginx 1.24 on the droplet). nginx now compresses CSS, JavaScript, JSON, XML, SVG and plain
  text (`gzip_types` was at its default, text/html only, so the 559 KB main bundle and the 119 KB stylesheet went out
  uncompressed even to clients that asked for gzip) and sends `Vary: Accept-Encoding`. `npm run build` now ends with
  `web/scripts/precompress-assets.ts`, which writes `.gz` (level 9) and `.br` (quality 11) copies of the JS, CSS and SVG files under
  `web/dist/assets/`; nginx serves the `.gz` copies with `gzip_static`, so the 1 vCPU server compresses nothing for
  them (measured on the real files: 559 KB to 173 KB gzip and 144 KB brotli, 119 KB to 18 KB gzip and 15 KB brotli).
  Brotli was left off at first: its nginx module was not installed on the server and an unknown directive would fail
  `nginx -t` during the deploy (the first entry of this section enables it). Content-hashed files under `/assets/` now carry one
  `Cache-Control: public, max-age=31536000, immutable` header instead of two (`max-age=31536000` from `expires` plus
  `public, no-transform`) and no longer an `Expires` header; the other static files keep their current headers. Both TLS server blocks now
  `listen 443 ssl http2;`. Checked against nginx 1.24.0 with a self-signed certificate: ALPN selects h2, `return 444`
  ends that request without a response and logs `"GET /x HTTP/2.0" 444` to scanner.log, which the
  `nginx-scanner` fail2ban filter (checked with `fail2ban-regex` 1.0.2) still counts, and plain HTTP sent to the
  TLS port still ends in a 444 logged to scanner.log. Tests pin the compression, caching and HTTP/2 directives.
  Root bumped to `2.6.218` and web to `3.4.109`.
- A second access log, `/var/log/nginx/access_timed.log`, written beside the unchanged combined access log with
  `$request_time`, `$upstream_response_time`, `$upstream_connect_time` and the protocol (`rt=`, `urt=`, `uct=`,
  `proto=`). Until now server time could not be read from the logs. Nothing parses it, and the existing
  `/var/log/nginx/*.log` logrotate rule covers it.

### Fixed
- The daily report could name a Law of the Day that visitors never saw (issue #356). `render-daily-report.ts` read the
  day's law from `law_of_the_day_history` with `LIMIT 1` and no `ORDER BY`, and did not check that the law is still
  published. The table only has `UNIQUE(law_id, featured_date)`, so a day can have two rows (a pick that was
  unpublished and replaced the same day), and which one the report printed was unspecified: it could be the rejected
  law. The query now uses the same rule as `LawsService.findFeaturedLawId`, which decides what the API serves for a
  recorded day: the newest history row (`ORDER BY lod.rowid DESC`) whose law has `status = 'published'`. When no
  published law is recorded for the day the report still says "No law of the day set for <date>". The tests run the
  report's real query against a database built from the migrations: two rows for one day (the newest wins, even when
  its law has the lower id), three rows recorded out of id order (the newest wins, not the first, lowest or highest
  id), an unpublished pick recorded before and after its replacement, an unpublished-only day, a row for another day,
  and an empty day. The other half of #356, the out-of-date `fetchLawOfTheDay` doc comment, shipped
  with the web change for #347 (#361). Backend bumped to `2.3.97`; root to `2.6.259`.
- Starting the API server on a port that is already taken no longer reports a fatal `Error: listen EADDRINUSE` to
  Sentry from a development machine (issue JAVASCRIPT-1C, environment `development`). `startApiServer` had no `error`
  listener on the HTTP server, so the failed `listen` escaped as an uncaught exception, which the Sentry SDK captures
  as a fatal event before the process dies. It now listens for the server's `error` event. For `EADDRINUSE` it prints
  "Port N on HOST is already in use; stop the process that holds it or set PORT to another port"; then, outside
  production, it exits with code 1 and reports nothing. In production (`NODE_ENV=production`) it prints the same
  message and still throws the error, because a held port there means the API is down and Sentry should hear about it.
  Any other server error is thrown as before. The cause of the clash on the developer's machine is not known: `npm run
  dev` kills the holder of the port first (`predev`), so `npm start`, running `tsx` directly or a process that is not
  this server are likelier than a second `npm run dev:backend`. Tests in `api-server.test.ts` pin the exact message,
  the exit outside production, the rethrow in production and the rethrow of other errors, and the real server was run
  against an occupied port to check the message and the exit code. Backend bumped to `2.3.96`; root to `2.6.256`.
- The web test "gives the retry the whole 10 s when the early request failed at once" no longer fails now and then
  with 9999 where it expects 10000. It read the real clock: `setEarly()` stamps the early request's start with
  `Date.now()`, and the retry subtracts the time that has passed since from the 10 s window, so a tick of 1 ms between
  the two calls left 9999 ms. It failed once in the web CI `test-and-build` job and in two local pre-commit runs. The
  test now freezes the clock with fake timers, so the elapsed time is exactly 0 and the assertion is unchanged
  (`AbortSignal.timeout` called with `10_000`). Other tests that depended on the real clock are frozen the same way:
  "keeps the cache bypass on the retry..." asserted that the retry got more than 6000 and at most 7000 ms, and now
  asserts exactly 7000; and the `right after a vote` tests of the inline script, whose vote times are offsets from
  `Date.now()` (59 s ago must bypass the cache, and a stall of over a second under load could break that; 60 s ago, the
  boundary, now falls exactly on it instead of just past it). Verified by making `Date.now` advance by 1 ms on every
  call: the old test fails with 9999 and the new one passes, and `api.test.ts`, `early-law-of-day.test.ts` and
  `home.test.ts` passed 40 of 40 runs (and 20 of 20 with `--pool=threads`). No production code changed. Root bumped to
  `2.6.238` and web to `3.4.118`.
- `analyze-resource-peaks.sh` no longer skips the previous month's metrics file, or reads the current month's twice, on
  the days when the previous month is too short, and its 30-day cutoff is now UTC. It found the previous month with
  `date -d "1 month ago"`, which GNU date resolves to the current month when the day does not exist a month earlier (in
  a year that is not a leap year Mar 29 -> "Feb 29" -> Mar 1, and Mar 30 and 31 roll over too; in a leap year only Mar 30
  and 31; plus the 31st of May, July, October and December). On Mar 29 and 30 (only Mar 30 in a leap year) the peaks of
  the last days of February were left out of the 30-day window, and on all of those days the current month's file was
  listed twice, so its rows were counted double (`sampleCount`, "Total records analyzed"). The daily report runs the
  script only on the 15th, so this hit manual runs. The previous month is now worked out from the current month's
  number, which works the same with GNU and BSD `date`. The cutoff string was built with `date -d "-30 days"` and
  printed with a literal `Z`, but without `-u` it carried the local wall-clock time, while the CSV timestamps are UTC
  (`performance-tracker.sh` writes them with `date -u`); the 30-day window was shifted by the host's zone offset (up to
  14 hours, nothing on a host set to UTC). It now uses `date -u`, with the BSD form `date -u -v-30d` as the fallback.
  The month in the file name stays local, as the collector names the file with a local `date +%Y-%m`. The only other
  month arithmetic in the scripts is the "Next review" date (`+1 month`) of `cost-optimization-report.sh`, which the
  daily report runs on the 1st (UTC), so it is safe there on a host set to UTC; a manual run on the 29th to 31st can
  still roll over. `analyze-resource-peaks-month-boundary.test.ts` pins the days around month ends, leap years, the
  months 08 and 09, the year change, the `n8n` role, the file name's local month, and the cutoff in UTC, UTC+14 and
  UTC-11 with both GNU and BSD `date`, using a stand-in `date` that rolls months over the way GNU date does, honours
  `-u` and `TZ`, and fails the test on any call it does not understand. The peaks test in
  `operational-email-rendering.test.ts` asserts an exact sample count (`1`) again, which the entry below had to loosen
  until this fix. Root bumped to `2.6.234` and backend to `2.3.87`.
- The `analyze-resource-peaks --format json` test no longer fails once its fixture is a month old, and the
  `cost-optimization-report` one beside it no longer passes on a stale fixture. `scripts/operational-email-rendering.test.ts`
  wrote a metrics row dated `2026-10-10`, but `analyze-resource-peaks.sh` reads only the current and the previous month's
  CSV, and it and the capacity analyzer behind the cost report only count rows from the last 30 days, measured from the
  real clock. From 9 November 2026 the row fell outside the window, the script printed `{"sampleCount":0,"metrics":[]}` and
  the assertions failed. The cost test had kept passing because it accepted "Collecting baseline" whatever the sample
  count; it now asserts that decision and that exactly one sample is counted, and the peaks test asserts the sample count
  and one metric's value and timestamp. The fixture is dated one day before the test runs. The scripts are unchanged in
  this entry. The peaks test asserted at least one sample rather than exactly one at the time, because on day 29, 30 or
  31 of a month whose predecessor is shorter, `analyze-resource-peaks.sh` computed the previous month with
  `date -d "1 month ago"`, which landed in the current month, and read the same CSV twice; the entry above fixes the
  script and makes that count exact again. Root bumped to `2.6.231`.
- `health-check.sh` no longer sends a false "[CRITICAL] Frontend/API Error - HTTP" alert with an empty status for a
  healthy site (the Nov 12 10:16 UTC alerts). It passed `-w` to curl twice and curl keeps only the last, so the status
  code was never printed and the empty value never equalled `200`. It now reads the status and the time from one
  `-w`, and takes curl's own exit status (it read the status of `local`, always 0, so a real connection failure was
  never reported as "Down"). The "Down" log line and alert now include curl's error text (`-S`, first 300 bytes).
  The response time is worked out with shell arithmetic instead of `bc`, which a minimal host may not have: before,
  a missing `bc` made every response read as 0 ms and silenced the slow-response warning. If curl's timing cannot be
  read it is logged and shown as "unknown". Two failures of the check itself are no longer mistaken for the site:
  curl exiting 0 with no usable status raises "[CRITICAL] ... Check Failed", and a failed `mktemp` logs that the check
  was not run instead of reporting a "Down" site. The temporary file now goes under `$TMPDIR`. Tests run
  `check_http_endpoint` with a curl that, like the real one, honors only the last `-w` and prints its error text only
  with `-S`, and cover 200, other statuses, a failed connection, a slow response, sub-millisecond and unreadable
  timings, unusable curl output, `mktemp` failure, temporary-file cleanup and the alert cooldown.
  Backend bumped to `2.3.83`; root to `2.6.215`.
- Select dropdown carets are now inset from the border in every dropdown.
  Web bumped to `3.4.50`; root to `2.6.136`.

---

## [2.6.12] - 2026-08-11

### Fixed
- Preserved escaped HTML entities while highlighting raw search suggestions.
  Web bumped to `3.4.10`; root to `2.6.12`.

---

## [2.6.11] - 2026-08-11

### Fixed
- Hardened search suggestion rendering, trusted-client rate limiting, submitted-law
  visibility, transactional submissions, and related-law limit validation.
- Corrected law text entity rendering and restored backend test type checking.
  Backend bumped to `2.3.3`; web to `3.4.9`; MCP to `1.2.3`; root to `2.6.11`.
- Updated transitive dependencies to resolve all high-severity npm audit findings.
- Updated the MCP SDK and its Hono server dependency to resolve all remaining npm audit findings.

---

## [Unreleased]

### Fixed

- The backend no longer sends Sentry events from local development or tests (issue #359). What was wrong: `initSentry`
  initialised Sentry whenever `SENTRY_DSN` was set, so a developer machine whose root `.env` carried the production DSN
  reported its own crashes as real errors (a fatal `EADDRINUSE` from a local run paged the team). It now returns early
  unless `NODE_ENV` is `production`, which production sets in `backend/.env`; the web bundle was already guarded the
  same way. The `NODE_ENV || 'development'` fallback and its `v8 ignore` block are gone, since only production reaches
  `Sentry.init`. `.env.example` says the backend reports only in production, and the `initSentry` tests cover the
  production and non-production branches. Backend bumped to `2.3.102`, root to `2.6.268`.

### Added

- The backend now names its Sentry release (issue #360). What was missing: the web bundle sets `release` from
  `VITE_APP_VERSION` (the commit SHA) and uploads its source maps to it, but `initSentry` set none, so an API error
  could only be resolved outright (no "resolve in next release"), and Sentry could not say which deploy introduced or
  reopened it. `initSentry` now passes `release` from `SENTRY_RELEASE` (trimmed; unset or blank leaves it undefined),
  and `deploy.yml` writes `SENTRY_RELEASE=${{ github.sha }}` into the backend `.env` beside `SENTRY_DSN`: the name the
  web build gets from `resolveAppRelease` when `VITE_APP_VERSION` is the SHA, so web and API releases line up. Tests
  cover a set, a blank and an unset variable, and that the deploy writes it and uses the same name as the web build.
  Not done: creating the release and associating commits from the deploy (suspect commits), which needs a Sentry
  step with `sentry-cli`. Backend bumped to `2.3.103`, root to `2.6.269`.

- A "Crane's Law: No Free Lunch" article at `/cranes-law`, for readers who search for Crane's law. Crane's law is the name
  Arthur Bloch's 1977 Murphy's Law collection gives to "there is no such thing as a free lunch", and the archive already
  had it as a bare law page. The article explains the saying, the saloon free lunch behind it and how it spread, and
  gives the history of the name as far as its sources go: it was in print as "Crane's Law" by 1969, but none of the
  sources say who Crane was, so the page says that instead of guessing. Where Wikipedia and Quote Investigator disagree
  about the first appearance of the saying, the page says so. It is prerendered and in the sitemap like the other
  articles, with one shared title and meta description for the prerendered page and the app, links into Murphy's
  original laws, and the law page for Crane's law now leads its links with the article. Web bumped to `3.4.115`, iOS to
  `1.2.14` (build 30), Android to `1.2.14` (code 21), root to `2.6.227`.

### Changed

- The "Related Laws" list on a law page no longer shows the same three newest laws on every page of a category, or
  corollaries of unrelated laws. `GET /api/v1/laws/{id}/related` still ranks by votes, but it no longer returns
  corollaries of published laws (a law page already lists its own), and laws with the same score and upvotes, which is
  nearly all of them, are now ordered by a fixed pattern that depends on the current law's id. Each page gets its own
  mix, and the mix stays the same until votes or the published laws change. A corollary whose parent law is not
  published still counts as an ordinary law, as in the law list. The prerendered pages leave corollaries out of their
  related links too, so a corollary does not show up before the page loads and then disappear. Backend bumped to
  `2.3.84`, web to `3.4.107`, root to `2.6.216`.
- On screens narrower than 600px, the Sod's Law Calculator keeps a compact score pinned to the bottom of the screen
  while the sliders are in view, so visitors see the score change as they move a slider instead of scrolling down to
  it. The pinned score is a labelled group (named after the "Probability of Things Going Wrong:" heading), a slider that
  takes focus scrolls into view above it instead of under it, it keeps clear of the home indicator on phones with
  one, and in high-contrast mode it gets a solid top edge and no shadow. The compact 30px score now also applies while
  the score sits in the page on a phone, not only while it is pinned. The "sample score" note stays out of the pinned bar
  on a phone, and the slider scroll margins are scoped to each calculator so the Buttered Toast rule no longer overrides
  the taller Sod's Law one. Also restores the 100% web coverage gate and the Buttered Toast phone tests, which were red on
  main: a test now covers a home search submitted without the shared search flow, and the toast pinned-bar tests scroll
  the sliders into view first, since a sticky bar only reaches the bottom edge once its card is on screen. Web bumped to
  `3.4.101`; root to `2.6.205`.
- The Sod's Law calculator's share buttons now sit directly under the score, headed "Share This Score", instead of in a
  separate "Share Your Results" card below it, so sharing stays next to each new result. The heading uses the shared `section-title` style, and the gap below the
  share buttons is wider so the "Copied!" message no longer touches the Related Scenarios card. Web bumped to `3.4.98`;
  root to `2.6.202`.
- The Sod's Law Calculator now labels the score shown on first load as a sample from the default settings and asks
  visitors to move the sliders to score their own task. The note hides after the first slider move and does not show
  when the page opens from a shared link that carries at least one valid setting (a link with only invalid values keeps
  it). The note is styled as small semibold text under the score. Web bumped to `3.4.97`; root to `2.6.201`.
- A search from the home or header search box now lands on its results on the Browse page: the page scrolls past the
  intro and Advanced Search form to the results card (or its empty state) and moves focus to the card title. The card
  is titled "Search Results" while a search or filter is active, and "All Laws" otherwise. The scroll also happens
  when the search fails to load (it lands on the Try Again message), leaves room for the header only while the header is
  pinned (it scrolls away with the page on the legacy display), and is skipped when the Browse page was replaced while
  the search loaded or the visitor has already scrolled. Web bumped to `3.4.95`; root to `2.6.199`.
- The Buttered Toast calculator now keeps a prompt to move a slider beside the default result until the visitor
  adjusts one, instead of losing its only invitation when the default result is calculated on load.
  Visitors who arrive from a shared link see "Move any slider above to see how the odds change." instead, since the
  shared result is not a starting point. Web bumped to `3.4.89`; root to `2.6.193`.
- "Submit a Law" in the Browse empty state now carries the words of the search that found nothing to the submit page
  (`/submit?text=...`), which prefills the Law Text box and runs the duplicate check on them. The text is removed from the address once the
  form has read it, so a reload or a return to the page starts from an empty form, and the check on text the visitor did
  not type is not reported to analytics. Web bumped to `3.4.81`; root to `2.6.185`.
- The Real-Life Examples hub now invites readers to submit their own law while they read, not only after the article:
  a "Submit your own" button ends the button row under the title and a prompt sits right before the example stories.
  The article button row's accessible name is now "Explore and contribute". Web bumped to `3.4.78`; root to `2.6.182`.
- The Submit a Law form now starts with the required Law Text box; the Law Title field follows it and its label reads
  "Law Title (optional)".
- The "Submit your own" button after an article (including the Real-Life Examples hub) now sits on its own below the
  featured-laws card instead of in that card's footer, so it still shows when the featured laws fail to load or the
  category has none. The static build renders it the same way. Web bumped to `3.4.79`; root to `2.6.183`.
- The Submit a Law form (`SubmitLawSection`) accepts an optional starting text and category slug, so a page that sends
  a visitor to it, such as a search that found nothing, can hand off what they were looking for instead of an empty
  form. The text fills the Law Text box (trimmed, at most 1000 characters) without showing the short-text error, and
  the category is preselected; a category the visitor has already chosen is kept when fresh categories load. Web bumped
  to `3.4.80`; root to `2.6.184`.
- Category pages now send the Pendo `search_result_opened` event when a visitor opens a law from the category list,
  as Browse does: card clicks, law-text link clicks and keyboard opens each report `open_method`, the law's rank,
  page, result count and category, with `search_surface` set to `category_detail`.
  A card click also sends the `archive.result_open` product event (`surface: category_detail`), as Browse does; the
  other open methods stay Pendo-only. Web bumped to `3.4.88`; root to `2.6.192`.
- The Buttered Toast formula no longer shrinks to unreadably small text on phones. On screens wider than 768px it still
  scales down to fit its box but never below the phone formula size (`--text-2xl`); at 768px and below it uses the shared
  responsive formula sizes (36px, then 24px at 480px and below) and scrolls sideways inside its own box instead. The
  formula box is now announced as a labelled group. Web bumped to `3.4.87`; root to `2.6.191`.
- The Buttered Toast calculator no longer opens with its formula: the sliders come first, and the formula now sits
  directly below the probability result, ahead of the Share Your Results card. Web bumped to `3.4.85`; root to `2.6.189`.
- When a Browse search finds nothing, the empty state now has a "Clear filters" button beside "Submit a Law". It does
  the same thing as the search panel's Clear button, so visitors can widen the search right where the message is. The
  button only appears when a filter is active. Pressing it moves keyboard focus to the Search box so it is not lost
  when the list redraws, and clearing no longer records an `archive.search` event. Web bumped to `3.4.84`; root to
  `2.6.188`.
- Law text on law cards (category lists, browse, home and related laws) now carries a thin, always-visible underline
  in a solid colour that meets 3:1 contrast in both themes, so visitors on touch screens, who never see the hover
  state, can tell a law opens. The static build's law cards carry the same underline from first paint. Hover and
  keyboard focus darken the underline as before. Web bumped to `3.4.93`; root to `2.6.197`.
- On phones (narrower than 600px), the Buttered Toast calculator's probability now stays pinned to the bottom of the
  screen as a compact bar while the sliders are in view, so each slider move shows its effect without scrolling down
  to the result. The bar is named by its heading for screen readers, has a top edge (a solid one in high-contrast and
  forced-colors modes), reserves less room for the back-to-top button, and a focused slider is scrolled clear of it.
  Until the first slider move, the starting-point hint takes its own full-width row inside the bar. Web bumped to
  `3.4.92`; root to `2.6.196`.
- Law cards on a category page now end with a small link that says what opening the law adds beyond the card: "Read
  the full law", or "See the law this corollary belongs to" for a corollary. The link is a 44 px tall target, uses the
  link colors and is hidden when printing. Opens from it are reported to Pendo with `open_method: 'law_page_cue'`, apart
  from title links. Other law lists are unchanged. Web bumped to `3.4.91`; root to `2.6.195`.
- On a category page, the "Explore nearby" links now follow the law list and its pagination instead of sitting above
  the sort control, so the laws are the first next step. The static build now renders the links after the pre-rendered law cards too, so
  first paint matches, and the links have top spacing under the pagination. Web bumped to `3.4.90`; root to `2.6.194`.

### Added

- The Buttered Toast calculator now sends a `calculator_viewed` Pendo event with the result shown on load (the default
  result, or the shared one when the page opens from a shared link). `calculator_used` still fires only after a slider
  moves, so visitors who only read the first result now show up in the calculator funnel. Its tests pin the reported
  result and risk level for the default, shared and invalid-link cases. Web bumped to `3.4.104`; root to `2.6.210`.
- Submitters can add corollaries when they submit a law, and the moderation queue treats a law and its corollaries as
  one submission. `POST /api/v1/laws` accepts an optional `corollaries` list (at most 5; each `text` 10-1000
  characters, optional `title` up to 200; no repeats of each other or the law text; the body is capped at 32 KB, 413
  above it) and answers 201 with the created `corollaries`. They are created in review in the same transaction as the
  law, share its category and are credited by name only: the email stays on the law, so only the law is thanked. The
  moderator's new-submission email lists them, and the thank-you sent on approval lists the ones that went live. In
  `GET /api/v1/admin/laws` a corollary whose law is in the same filtered set is no longer a card of its own: it is
  attached to the law as `children` (any status), searching a corollary's text returns the law, and the list total never
  counts a nested corollary: the "In review" badge matches it, while the Published and Rejected badges still count rows. The moderation page shows
  the corollaries nested under the law as editable rows with "Reject this corollary", and the buttons read "Approve
  all N" and "Reject all"; corollary edits are saved first, then the law, and the existing status cascade publishes or
  rejects the rest. The submit form gains an optional Corollaries group (up to five boxes with a counter, a
  "Submit law with N corollaries" button, and a hint that moves corollary-labeled bullets typed into the law text into
  boxes), and the corollaries section of a law page links to it ("Corollaries are added when you submit a law"; it opens the form for a new law, not an existing one, and the form says corollaries cannot yet be added to a published law). The SDK `submitLaw`
  accepts `corollaries`, the CLI `submit` takes a repeatable `--corollary`, and the MCP `submit_law` tool takes
  `corollaries`. The design contract gains `corollary-fieldset` and `corollary-field`. Backend bumped to `2.3.78`; web to
  `3.4.73`; SDK to `0.2.3`; CLI to `0.2.0`; MCP to `1.3.0`; root to `2.6.175`.
- Corollaries on the law page. `GET /api/v1/laws/:id` now returns `corollaries` (published children of a published
  parent, in the order they were linked, with vote counts) and `corollary_of` (the published parent, or null); list rows
  carry `corollary_of_id`, and `exclude_corollaries` uses the same published-parent rule, so a corollary whose parent
  is not published stays listed as an ordinary law. A parent's page shows a Corollaries section above Related laws
  (linked title, text and vote buttons, or plain counts on the static site; no extra request); a corollary's page shows a "Corollary of" banner and a
  breadcrumb through its parent. A corollary titled just "Corollary" is named from its text in the cards, the banner
  and the breadcrumb (the page H1 is unchanged, so the "Law Page H1 for Generic Titles" item stays open). The static
  site renders both into the HTML from the law list, with no extra requests and no new structured data. The design
  contract gains `corollary-list`, `corollary-card` and `parent-banner`. The SDK `Law` type, the MCP `get_law` tool
  and the CLI `get` command show corollaries. Also fixes two web bugs the new cards exposed: a click on the thumb icon
  inside a vote button was ignored (the icon is an SVG, which the handler skipped), and the law page's own
  `[data-nav]` handler navigated a second time, without the id, after a breadcrumb link. Backend bumped to `2.3.77`; web to `3.4.72`; SDK to `0.2.2`;
  CLI to `0.1.3`; MCP to `1.2.6`; root to `2.6.174`.
- Admins can split corollaries out of a submitted law on the moderation page. A law in review whose text is a
  sentence followed by bullets shows a banner and a "Review split" button; the inline review lists each bullet
  (labeled ones start as "Corollary", unlabeled ones as "Keep in parent text"), recomposes the parent text live,
  allows at most five corollaries and approves them in one step. New `POST /api/v1/admin/laws/:id/split` publishes the
  parent and creates the corollaries as published laws in one transaction (guarded by `updated_at`, 409 when stale;
  categories copied; children are credited by name only; one thank-you, for the parent). `GET /api/v1/admin/laws`
  adds `corollary_candidates` to such laws. A parent's status change now carries to its corollaries (leaving
  published moves published corollaries along, approving publishes in-review ones, rejecting rejects them), and a
  corollary cannot be published while its law is not. A law that already has corollaries is not offered the split, and
  a page that is out of date gets a 409 so it reloads. Saving an edit to a law in review returns fresh
  `corollary_candidates`, so "Review split" appears (or goes) without a reload, and the review lists every problem with a
  split instead of only the first. Backend bumped to `2.3.76`; root to `2.6.173`.
- Foundation for first-class corollaries (no visible change yet). A corollary is a law row linked to its parent
  through `law_relations` (child is `from_law_id`, parent is `to_law_id`, type `COROLLARY_OF`).
  `shared/modules/corollary-parser.ts` finds bulleted corollaries in a law's text (markers `•`, `-`, `*`, `–`,
  `1.`, `1)`; wrapped lines join the bullet above) and exports the shared limits (at most 5 per parent, text 10-1000
  characters, title 200). Migration `023` adds two non-unique indexes on `law_relations`. `law-relations.service.ts`
  adds `createCorollaryChildren` (atomic; copies the categories the caller passes; name-only attribution, never an
  email), `getCorollaries` and `getCorollaryOf` (published on both ends), `isChild`, `hasCorollaries` and
  `linkCorollary` (no duplicate relation; one level, one parent, at most 5 per parent). Backend bumped to `2.3.73`;
  root to `2.6.170`.
- A `triage-404s` skill (`.claude/skills/triage-404s/SKILL.md`) for the daily report's 404 list. It checks each
  path against the repo and the server logs (read-only, with reported strings quoted as untrusted data), picks
  one verdict per path (already handled, notify about an image, redirect, ignore, fix link or create content,
  block as scanner, or needs a human), and opens one draft PR per run, only when something needs changing. Redirects are written for the path
  without its query string, and a report row missing from the list is looked up in the logs.

### Changed

- The Submit a Law page puts the cursor in the Law Text box when it opens, so visitors can start writing without
  hunting for it. It does this only with a mouse or trackpad (no on-screen keyboard pops up over the guidance) and only
  when the box is already fully on screen, so the page does not scroll and the guidance above stays in view. Web bumped
  to `3.4.77`; root to `2.6.181`.
- The Submit a Law guidance now opens with "Start writing right away" instead of telling visitors to search first, since
  the form has no search control and already lists possible duplicates as they type. Web bumped to `3.4.75`; root to
  `2.6.179`.
- The Submit a Law form now comes straight after the section header. The review notice, writing tips and good-law
  examples moved from above the form into a collapsed "Tips for a good law" disclosure under the Law Text box, so the
  box is no longer pushed below the fold on small screens. The disclosure's summary is a 44 px tap target with hover and
  focus styles, built from design tokens only. Web bumped to `3.4.76`; root to `2.6.180`.
- The `triage-404s` skill now opens its pull request ready for review instead of as a draft, as the other pull
  requests in this repository are. No version bump: it is documentation only.
- `/sitemap.gz` now redirects to `/sitemap.xml` instead of being dropped. Search Console still held a 2006 sitemap
  submission at that path, and the scanner map matched `.gz` and answered `444` with no response, so Search Console
  reported "Couldn't fetch" and every retry counted as a fail2ban strike. Only `/sitemap.gz` (with or without a query
  string) is exempt from the `.gz` scanner pattern; other `.gz` paths (`/backup.gz`, `/old/sitemap.gz`) are still dropped. Root bumped to `2.6.168`.
- The admin moderation page (`/admin`) now shows the site's favicon and touch icon. It declares the icons explicitly,
  and its Content-Security-Policy allows images from its own origin (`img-src 'self'`), which it blocked before
  because the policy started from `default-src 'none'`.
- The admin moderation page (`/admin`) now looks like the main site: the sticky header with the brand badge (linking to
  the archive), the site's cards for sign-in and for each law (pill and details in the header, fields in the body,
  Approve, Reject, Move to review and Save edits in the footer), outline and filled buttons with hover, pressed, focus
  and disabled states, a message-style status notice, the same elevation in dark mode, and outline buttons with the site's dark-mode fill and borders. The brand badge links to the archive and the
  page heading stays a plain heading, outside that link. Only canonical tokens from
  `web/styles/partials/variables.css` are used; `tests/admin-ui-tokens.test.ts` still checks they match.
- A migration that fails now stops where it fails and is rolled back. `backend/scripts/migration-runner.ts`
  starts the `sqlite3` CLI with `-bail`, so the first failing statement stops the run; before, the CLI carried on
  after an error, through the file's closing `COMMIT`, and only then did the script report it, so a migration
  could be half applied. A file that starts with its own `BEGIN` keeps its transaction and must end with one
  `COMMIT`; any other file is wrapped in a transaction by the runner and must not `COMMIT` or `ROLLBACK`. The
  row in `schema_migrations` is written in the same transaction as the migration, so a migration is applied and
  recorded, or neither. A file that breaks those rules is refused before that migration runs. The command exits
  non-zero with a message naming the migration and quoting sqlite3's error and, when sqlite3 reports a line, the
  failing statement; later migrations are not tried. In the deploy, `npm run migrate` runs under `set -e`, so a failed migration stops the deploy before the
  services restart; the build step migrates the database copy first, so it fails earlier still, before anything
  is uploaded. `migrate()` takes an optional migrations folder (for tests). `MURPHYS_DB_PATH` is unchanged.
  `shared/docs/DATABASE_MIGRATIONS.md` describes the behaviour; the matching `TODO.md` entry is removed. Backend bumped to `2.3.72`; root to `2.6.167`.
- The production deploy prerenders the site from a sanitized, freshly migrated COPY of the production database,
  taken at build time. The copy is never committed, never uploaded and never kept as an artifact. This fixes the
  deadlock where the build ran before the server migrated: a data fix such as migration 022 could not reach
  production because the build failed on the rows it was meant to clean, so every deploy on `main` stopped at
  "Build project".
  - `.github/workflows/deploy.yml`: a new step before the build streams `backend/scripts/sanitize-db-copy.sh` to the server over
    the SSH access the deploy already uses (the server still runs the previous release, so the script cannot be
    uploaded first). On the server it takes a consistent `sqlite3 .backup` of the live database (safe while the API
    writes, WAL included) into a private temp directory, sanitizes that copy, writes it to stdout and deletes the
    directory. The runner verifies it again (nothing outside the allowlist has rows, no contact value, no voter
    identifier, `integrity_check`, at least one published law), then `npm run build:web` migrates the copy with this
    release's migrations (the ones the deploy runs on the server afterwards), starts the local API on it and
    prerenders from `http://127.0.0.1:8787`. A step right after the build with `if: always()` deletes the copy and the key file. Any
    failure before the upload stops the deploy: there is no fallback to the archive or to a stale site, and nothing
    between the fetch and the upload has `continue-on-error`. The key is read from the environment into a `0600`
    file in `$RUNNER_TEMP` (never into the script text or the log) and removed as soon as the copy is fetched; the
    host key is pinned when the optional `SERVER_HOST_KEY` secret is set (`ssh-keyscan -t ed25519 <host>`); without it ssh trusts whatever key it sees first (an empty per-run `known_hosts`), with a warning, and the upload and deploy actions do not check it either.
  - Sanitizing is an allowlist: only `laws`, `categories`, `law_categories`, `attributions`, `law_relations`,
    `votes`, `law_of_the_day_history`, `law_annotations`, `schema_migrations` and the `laws_fts` search index keep
    rows. Every other table (today `email_subscriptions`, `push_subscriptions` and
    `facebook_data_deletion_requests`, tomorrow whatever is added) keeps its definition, so the migrations still
    apply, but loses all rows. In the kept tables, only published laws stay (migration 022 parks the laws it cannot
    clean in `in_review`, with the address still in them); `laws.raw_markdown`, `laws.admin_notes`,
    `laws.approval_email_sent_at`, `attributions.contact_value` (blanked to `''`) and `attributions.source_fragment`
    are blanked, and `votes.voter_identifier` becomes `'v' || id`, so vote counts, the
    `(law_id, voter_identifier)` unique index and score ordering are unchanged. Law titles and text, attribution
    names and notes are public today and are left as they are, so migration 022 and the build see exactly what
    production serves (the copy on the runner is deleted at the end of the job). The copy leaves WAL mode before
    anything is changed, `secure_delete` is on, the search index is rebuilt and the file is `VACUUM`ed, so no
    deleted row survives in a free page or a `-wal` file. The script is idempotent, needs only the `sqlite3`
    CLI, prints only status lines and never a row, and also runs locally (`sanitize`, `verify` and `export` modes). The planner statistics tables
    (`sqlite_stat1/3/4`) are emptied too: with STAT4 they hold sampled index keys, voter identifiers among them. A column
    that a migration of the same deploy adds does not exist on the server yet and is skipped.
  - `backend/scripts/migrate.ts` and the API (`npm --prefix backend start`) read the SQLite path from the new
    `MURPHYS_DB_PATH` variable when it is set and not blank, and use `backend/murphys.db` otherwise, so production
    does not change. A path that names a missing, empty or non-file target is an error, because SQLite would create
    a database there and the migrations would seed it with about a hundred laws. The migration logic moved to
    `backend/scripts/migration-runner.ts` (exported `migrate(dbPath)`), and `migrate.ts` is a plain entry point that
    always runs it (no "run as main" check, which could turn another way of calling it into a silent no-op).
    `scripts/build-web-with-local-api.mjs` migrates that file instead of building the archive when the variable is
    set; pull-request CI (`web-ci.yml`) leaves it unset and keeps its seeded archive build.
  - The `seeded_build` option of the manual run is removed. If the server cannot be reached the deploy cannot
    upload or migrate either, and a build from the archive describes the wrong laws.
  - Tests: `backend/tests/scripts/sanitize-db-copy.test.ts` builds a fixture with extra personal-data tables, an
    unknown future table, an unpublished law with an address, votes, subscriptions and a WAL file, exports through
    the real script (also streamed to `bash -s`), and asserts that no personal value appears anywhere in the raw
    bytes of the copy, that vote counts and the unique index survive, that the copy migrates and serves the API
    through `MURPHYS_DB_PATH`, that migrating the sanitized copy gives the same public data as migrating the unsanitized
    backup, that a sentinel written into every text column of several historical schemas survives only in reviewed
    columns, that every column of a kept table is blanked or reviewed as safe, that each `verify` violation is rejected
    with its own message, and that no scratch directory is left behind. `scripts/build-web-with-local-api.test.ts` runs
    the build script with a stand-in `npm` (archive build, database copy, relative path, failing migration, a blank,
    missing, empty or directory path, a busy port).
    `scripts/deploy-workflow.test.ts` runs the fetch step with a stand-in `ssh` (success, pinned host key, unreachable server, a shell that prints first,
    empty answer, unsanitized copy, missing secret). A dry run of the whole build path on a 2025 snapshot (migration
    009) prerendered 2,466 law pages.
  - `backend/murphys-production.db` is no longer tracked (`git rm --cached`; it was already in `.gitignore`). It was
    committed once, on 2025-11-16, and the repository is public: the file is still in the history, with 1,229
    email addresses in `attributions.contact_value` and the vote identifiers. Removing it from the history needs a
    history rewrite and a force-push, which is the owner's decision and has not been done.
  Backend bumped to `2.3.68`; root to `2.6.163`.
- `TODO.md` now lists open work only. The finished and cancelled entries, and the "Implemented from Reviews" and
  "Completed" sections, are gone, along with the sections they left empty. What shipped is recorded here.
- `AGENTS.md` now tells agents to open pull requests ready for review instead of as drafts, which is how this
  repository's pull requests have been opened. No version bump: it is documentation only.

### Fixed

- Daily 404 report of 13 November 2026 (99 requests from midnight to about 05:00 UTC): more scanner probes are dropped
  and `/law` is redirected. Dropped (`444`, logged to `scanner.log`): the Nmap Scripting Engine (by user agent: it asked
  for `/nmaplowercheck…`, `/HNAP1`, `/evox/about` and `POST /sdk`, and `/sdk` itself is not blocked), a sweep of
  framework debug and secret files from `34.79.37.102` and others (`/_debugbar/open`, `/_ignition/health-check`,
  `/debug/default/toolbar`, `/telescope/requests`, `/elmah.axd`, `/trace.axd`, `/app/etc/local.xml`, `/Vagrantfile`,
  `/GoogleService-Info.plist`, `/metrics`, `/nginx_status`, `/json/version`, about 30 key, token and cloud-credential
  files such as `/key.pem`, `/id_rsa`, `/aws.json`, `/firebase.json`, `/serviceAccountKey.json`, `/config/mongoid.yml`),
  and DNS-over-HTTPS resolver probes from `43.173.75.80` (`/dns-query`, `/doh`, `/resolve`). The names that are generic
  (`/metrics`, `/auth.json`, `/now.json`, `/resolve` and the like) match only as a whole root path, so `/api/v1/metrics`,
  `/auth.md` and a search such as `/browse?q=metrics` still pass; the extension list gains `axd|pem|key|conf|plist`.
  `/law` now redirects to `/browse` (Tor exits, Googlebot and a domain-list bot asked for it; the breadcrumb puts
  Browse above a law). Left alone on purpose: our own post-deploy smoke test (`/definitely-not-a-real-page`, 7
  requests from `node`, expected to be a 404), the AgentDrivesAgent readiness crawler (`/auth.md`, `/SKILL.md`, `/mcp`,
  `/signup`, `/pricing`, `/.well-known/agent-card.json`, the OAuth and skills discovery files; no MCP, agent or OAuth
  endpoint exists, and the test keeps them out of the scanner map so they stay plain 404s), CensysInspect's random-token canaries, `/write-for-us` and
  `/contribute`, and a single `/subscription`. Not fixed here: `/api/v1/laws/1719` and `/848` return 404 because those
  laws are not published, but their old prerendered pages (9 November) are still served with 200 from the deploy
  staging copy, which the deploy never prunes.
  Web bumped to `3.4.127`; root to `2.6.257`.
- Sentry no longer reports `Can only call Window.setInterval on instances of Window` (JAVASCRIPT-1B), seen once from
  Mobile Safari on an iPad. Every frame was in `av-eu1.startpage.com/__av/...`, Startpage's anonymous-view proxy, which
  re-serves our Google tag script from its own origin with a rewritten `window`; the error is thrown by that copy, not by
  our code. `startpage.com` and its subdomains join the Sentry `denyUrls` (kept in `sentry-ignore-patterns.ts` as
  `SENTRY_DENIED_URLS` so a test covers them), so errors whose throwing frame is a Startpage URL are dropped. A message
  filter was avoided on purpose: it would also hide the same error if our own bundle ever threw it.
  Web bumped to `3.4.105`; root to `2.6.212`.
- Daily 404 report of 12 November 2026 (38 requests so far that day): more scanner probes are dropped and two crawler
  typos are redirected. Dropped (`444`, logged to `scanner.log`): one spoofed-Googlebot sweep of build and secret files
  (`/Gemfile`, `/Gemfile.lock`, `/yarn.lock`, `/Jenkinsfile`, `/app.json`, `/database.yml`, `/local.py`,
  `/local_settings.py`, `/config.py`, `/secrets.py`, `/credentials.py`, `/config/credentials.yml.enc`,
  `/config/master.key`, `/config/environment.rb`, and a bare `/env` and `/env.txt`; the same names came from 8 to 12
  addresses since 29 October), Microsoft Remote Desktop Web Access (`/RDWeb`, 21 requests from 7 addresses) and the Metabase
  setup-token probe `/api/session/properties` (CVE-2023-38646, 8 addresses). Each pattern is anchored to the path, so a
  search such as `/browse?q=config.py` still passes, and the agent map is unchanged, so the Googlebot user agent itself
  is never blocked, only these paths (the sweep's Googlebot is spoofed: its address has no reverse DNS). `/browse)` and `/categories)` now
  redirect to `/browse` and `/categories`: `llms.txt` links them as markdown, and crawlers that keep the closing
  parenthesis asked for the wrong URL. Left alone: `/app-ads.txt` (the apps show no ads), `/pendo.js`, the random-token
  canaries `/envcheck-8fd5d32d5a7b.html`, `/uczhdksmg7` and `/e8ssw0odzmq` (Censys sent two of them), the stale
  `/assets/assets/tex-chtml-*.js` (nothing in the current source loads MathJax, so no redirect target exists), a one-address
  burst of stager-style paths (`/WuEL`, `/SiteLoader` and others). `/img/art.com_logo.gif`, the art.com logo that the
  old site's pages and Facebook's link crawler still ask for, is restored in `web/public/img` (a 117x28 GIF, checked by
  the legacy-image test) instead of answering 404.
  Web bumped to `3.4.103`; root to `2.6.209`.
- Submitting the home page "Search the Archive" box with nothing typed now opens Browse All Laws instead of quietly
  re-rendering the home page. The `archive.search` event for a blank submit reports `result: 'blank'`, so it can be told
  apart from the Browse All Laws link (`result: 'browse'`). Web bumped to `3.4.96`; root to `2.6.200`.
- A law page opened from a link no longer swaps the law it arrived with for an error screen when the law request fails
  for a reason other than the law being missing (a refused request, a server error, a timeout or a network failure).
  The router now hands the prerendered page to the first view, which shows the prerendered law at once instead of a
  spinner while the request runs. If the request fails, the law stays on screen under an alert saying some features
  couldn't load, with a Try Again button. Try Again is disabled while the retry runs, the law stays visible, and focus
  returns to the button when the retry fails again. A missing law (the API answers 404, or the ID can't name a law)
  still shows "Law Not Found", and only a 404 marks the page `noindex`; a failure that keeps the prerendered law leaves
  robots at `index, follow`. The Try Again button carries no `aria-label` that differs from its visible text. The
  `law_not_found` event gains `showed_prerendered_law: true`, set only when the fallback keeps the prerendered law on
  screen. Web bumped to `3.4.94`; root to `2.6.198`.
- Opening a shared Sod's Law Calculator link now shows the score and message for the shared slider values right away,
  instead of the default result until a slider moves. The sliders also announce the shared values to screen readers
  (`aria-valuenow` and `aria-valuetext` were left at the template default), and the share text and link match the
  score on screen. Web bumped to `3.4.86`; root to `2.6.190`.
- The law page shows "Law Not Found" only when the law is missing (the API answers 404, or the ID can't name a law).
  A forbidden answer, a server error, a network error or a timeout now shows "We couldn't load this law" with Try Again
  as the main action, instead of saying the law doesn't exist or may have been removed. The load-failure card is an
  alert, its heading accents the first word like the other headings, and after a retry that fails again focus moves to the
  new Try Again button instead of dropping to the page. The Try Again button no longer carries an `aria-label` that
  differs from its visible text, in either state. Analytics are unchanged: a load failure still sends the
  `law_not_found` event, told apart from a missing law only by its `failure_reason` (`http_error`, `server_error`,
  `network`, `timeout`, `invalid_response` or `unknown`, against `not_found`, `missing_id` or `invalid_id`).
  Web bumped to `3.4.83`; root to `2.6.187`.
- A category search that finds nothing no longer says no laws have been submitted for the category yet. It now says
  nothing in the category matches the search, offers a "Clear search" button that resets the search form and shows the
  category's laws again, and its submit button reads "Submit a Law", the same as Browse. Clearing the search moves
  keyboard focus to the search form's keyword input so focus is not lost when the list re-renders. Web bumped to
  `3.4.81`; root to `2.6.185`.
- Daily 404 report of 11 November 2026 (47 requests that day): the production bundles no longer link to source maps that do not
  exist, more scanner probes are dropped, and the sized Apple icons are redirected. Every JS file the build emitted ended in
  `//# sourceMappingURL=...`, but the Sentry upload deletes the maps from `dist`, so crawlers and scrapers that follow the
  comment got a 404 (about 260 requests from 67 addresses in the previous two weeks, the largest group in the log); the build now
  uses `sourcemap: 'hidden'`, which still emits the maps for the upload and leaves the comment out. Dropped (`444`,
  logged to `scanner.log`): the Drupal paths `/node/<id>`, `/node/<id>.json`, `/core/modules/...` and `/user/login`,
  Magento `/pub/static`, Craft `/actions/users` and below and Joomla `/language/<locale>/*.xml`, all from one CMS sweep; each
  pattern is anchored to the path, so a search such as `/browse?q=user/login` still passes. `/apple-touch-icon-120x120.png`
  (11 requests from iPhones in the previous two weeks) and the 152x152 and 167x167 iPad sizes, each with its `-precomposed` name, now
  redirect to `/apple-touch-icon.png`, like the 240x240 sizes. Left alone: the `.well-known` discovery probes,
  `/app-ads.txt` (the apps show no ads), `/sellers.json`, `/dsrdelete.json`, and the bare `/blog`, `/cms`, `/news`,
  `/press`, `/site` and `/feedback` guesses. Web bumped to `3.4.74`; root to `2.6.176`.
- Migration 024 deletes `law_relations` rows whose child or parent law no longer exists. The table declares cascading
  foreign keys, but SQLite's own default is off, so a connection enforces them only if its driver or the caller turns
  them on: better-sqlite3 (the API) does, the `sqlite3` CLI does not. Scripts such as `review-laws.ts` delete laws
  through the CLI, as can a manual session, so a law deleted there leaves its relation rows behind (production held 5:
  three `COROLLARY_OF` and two `COMMENT_ON`). Reads that join `laws` never showed them, but the corollary rules read
  `law_relations` alone, so a `COROLLARY_OF` orphan could make a surviving law count as a corollary or as having
  corollaries, count toward a parent's limit of five, and withhold the split offer from an in-review law. The two
  `COMMENT_ON` rows were never read by the API and are removed only for tidiness. The migration is safe to run twice,
  and relations between laws that exist (any status, duplicates included) are untouched. Backend bumped to `2.3.80`;
  root to `2.6.178`.
- The migration runner no longer reports a write error in place of what happened to `sqlite3`. When `sqlite3` stops
  before it has read all of its input, writing the migration to it fails with `EPIPE`, which Node reports as a spawn
  error, but only if `sqlite3` had stopped before the write finished. `failureReason` in
  `backend/scripts/migration-runner.ts` put that first, so the message read `spawnSync sqlite3 EPIPE` instead of
  `sqlite3 was stopped by SIGKILL` or `sqlite3 exited with status N`, depending on the timing. The order is now:
  sqlite3's own error, a spawn error that is a real cause (not installed, output over the buffer limit), the signal,
  the exit status; `EPIPE` stays on the error's `cause` and is never the message. An exit 0 that left part of the
  migration unread is now a failure (it was reported as applied), and is reported as such. This was the cause of the
  intermittent `migration-runner.test.ts` failure ("reports the signal when sqlite3 is killed, and records nothing")
  that failed CI twice and passed on re-run; new tests use a migration larger than the pipe buffer so the `EPIPE`
  always happens and the report never depends on timing. Backend bumped to `2.3.78`; root to `2.6.175`.
- Daily 404 report of 10 November 2026: more scanner probes are dropped and two sitemap-index guesses are redirected.
  Dropped (`444`, logged to `scanner.log`): Cisco ASA login probes (`/+CSCOE+/logon.html`, `/+CSCOT+/...`),
  `/eventmanager`, `/server-status`, `/server-info`, `/debug/vars`, `/solr/...`, Joomla component assets
  (`/media/com_*/`, `/components/com_*/`) and `.sqlite`, `.sqlite3` and `.db` files. Each pattern is anchored to the
  path, so a search such as `/browse?q=solr/admin` still passes. `/sitemap_index.xml` and `/sitemap-index.xml` now
  redirect to `/sitemap.xml`, like `/sitemaps.xml`. Web bumped to `3.4.71`; root to `2.6.169`.
- The production deploy prerenders the site from a sanitized, freshly migrated copy of the production database (see
  the entry above) instead of from a database built from the archive. The two number and publish laws differently, so on 9 November 2026 every sampled law page (75 of 75)
  described a different law from the one `/api/v1/laws/<id>` returns for the same ID, 38 law pages in the sitemap
  were for laws the API no longer has (Search Console's soft 404s), and 26 laws in the API (IDs 2466 to 2516) had no
  page or sitemap entry. Pull-request CI keeps its seeded local-API build.
  - The build's API requests (`web/scripts/ssg.ts`, `fetchWithRetry`) now have a 30 second deadline that also covers reading the body, and one retry after two
    seconds on a network error, a timeout, a 429 or a 5xx. Other 4xx answers are not retried. A network failure or
    timeout that persists stops the build with the URL, the cause and the attempt count, and a 429 or 5xx that
    persists stops it with the HTTP status (the log line before it names the URL and the start of the answer's body;
    a 200 that is not JSON is reported with its first 200 characters). The build runs before the upload step, so a
    failed build leaves the live site untouched. Each category page also has to agree with itself now: the category
    list's law count and the first page's total (both count every category a law is in) must match, so an API that
    ignores the category filter stops the build instead of publishing a category page with the wrong laws.
  - `scripts/deploy-workflow.test.ts` (also run by the Lockfile sync workflow) checks the order of the build and upload
    steps. `fetchAllCategories` takes a base URL like the other API readers.
  - Search Console still needs two steps once this is live: resubmit `sitemap.xml`, then press "Validate fix" on the
    "Soft 404" issue.

  Web bumped to `3.4.69`; root to `2.6.161`.
- Fixes for problems behind Search Console's page-indexing report of 9 November 2026. The largest one, static law
  pages that describe a different law from the one the API serves for the same ID, is fixed by the entry above:
  - A law page that the backend renders itself (a law published after the last build, such as `/law/2513`)
    declared `https://murphys-laws.com/law/2513/` as its canonical, `og:url`, `twitter:url` and JSON-LD `url` and
    `@id`. nginx redirects the trailing-slash form back to `/law/2513`, so the canonical pointed at a redirect. The
    URL no longer ends in a slash.
  - A prerendered law page whose law the API no longer has (38 of them were in the sitemap, for example `/law/1719`)
    stayed `index, follow` and showed its "not found" state only after JavaScript ran, which Google reports as a
    soft 404. The page is now marked `noindex, follow` when the API answers 404, unless the user has already left it.
    The tag is set by JavaScript, so Google drops the page once it renders it again (Search Console will then list
    it as "Excluded by noindex"). A timeout, a 5xx or a network failure
    does not, so a law that exists is never de-indexed because the API was slow while Googlebot rendered it, and a
    retry that finds the law makes the page indexable again.
  - The site build (`web/scripts/ssg.ts`) logged a warning and carried on with **no law pages and no law URLs in
    the sitemap** when the law list could not be read, and it accepted a partial or repeated list. It now stops
    when the API errors, returns nothing, returns a different number of laws than its own total, returns the same
    law twice, or reports a different total halfway through the paging. It also reads the list sorted by
    `created_at`, which votes do not change (the API breaks ties by ID), so paging is stable, and puts it back into
    the order the default listing used. The first page of laws that the browse and category pages show stops the
    build on an API failure or an empty page with a positive total, instead of publishing pages with no laws on
    them. The build also stops when the browse total does not match the full list, or when a law is in a category
    the category API does not list (such a law would be prerendered yet linked from no list page).
  - The 25 laws with an editorial annotation were looked up by hardcoded ID (`2, 4, 8, ...`). Those are the IDs a
    database built from the archive gives them; production gives them IDs between 2381 and 2470. Migration 016 names
    them by slug, which the API list does not carry, so the build now finds them by title. The one that carries the
    annotation wins when another law shares a title, so the same build works against either database. A reviewed law
    that is missing, or whose title is annotated on more than one law, still stops the build.
  - `/index.htm`, the old site's home page, redirects to `/` instead of returning 404.
  - The JSON API is served with `X-Robots-Tag: noindex`. robots.txt gives Googlebot its own group that does not
    disallow `/api/` (the `*` group does, and the pages call the API while rendering), so Google crawled the API as
    pages: `/api/v1/laws`, `/api/v1/categories` and both feeds are listed as "crawled, currently not indexed",
    `/api/v1`, `/api/v1/` and `/api/v1/health` as "not found", and the `www` RSS feed as a duplicate. The header
    keeps them out of the index without stopping the fetch. The OG image location keeps its own headers.

  Backend bumped to `2.3.66`; web to `3.4.66`; root to `2.6.158`.
- Old `/murphy/*` pages no longer redirect to the home page, which Google reports as a soft 404 (19 of the 60 soft
  404s, 19 of the 33 "not found" and 15 of the 115 "crawled, currently not indexed" in the 9 November 2026
  Search Console exports were `/murphy/*` URLs):
  - Each legacy page that has a current equivalent now has an exact `location = /murphy/<file>` redirect (written
    for the path without its query string, with the file's exact case): 34 redirects to 31 category pages, 28 of the redirects new (for example
    `murphy-golf.html` to `/category/murphys-golf-laws`, `murphy-EMT.htm` to `/category/murphys-emt-laws`; they
    include the `.html` forms of `murphy-cas` and `murphy-cars` and the extensionless `murphy-laws`, a truncated
    backlink), plus `life-by-murphys-law.html` ("Real Life Example" in the old menu) to `/examples` and `about.html` to `/about`.
    The file names come from the Search Console exports and the old site's menu in the Internet Archive.
  - `/murphy/murphy-true.html` was redirected to `/examples`, but it is the old "Murphy's laws origin" page (the
    Desert Wings article on Edwards Air Force Base). It now goes to `/origin-story`.
  - Every other URL under `/murphy/` (`links.html`, `murphy-original.html`, scripts, images, and bad backlinks such as
    `murphy-true.html:D`, `murphy-true.htmlkd`, `murphy-laws.html` followed by a space, `murphy-` and `murphy`)
    answers `410 Gone` instead of redirecting home, with the site's own 404 page as the body (`error_page 404 410
    /404.html`; without it nginx sends its bare built-in 410 page). For pages that will not come back, 410 is at least as
    strong a removal signal as 404, and it never looks like a soft 404. `^~` still keeps regex locations from taking these paths.
  - `/murphy` and `/murphy/` (the old section index, which other sites may still link to; neither is in the
    Search Console exports) still redirect to `/`, and move to 410 if they show up as soft 404s later; the
    trailing-slash rewrite turns `/murphy/` into `/murphy` first, and `/murphy/murphy-laws.html/` takes two hops
    to the category. None of these URLs match the scanner maps, so none is dropped or counted by fail2ban.
  - The daily report's "Top 404 URLs" counts only status 404, so `/murphy/*` hits now appear as 410 and drop out of it, which is
    intended: the 410 is the settled answer for those URLs.
  - Tests in `nginx-scanner-defense.test.ts` pin the table of redirects (and fail when nginx.conf has one that the
    table lacks), check that every target is a real category (from `shared/data`, after nginx's slug renames) or
    content page, and cover the 410, the garbage URLs, the scanner maps, robots.txt and the sitemap builder.

  Root bumped to `2.6.159`.
- Law pages no longer show email addresses. Contact details belong in `attributions.contact_value`, which no public
  endpoint serves, but they had leaked into what the pages and the API show: 23 laws built from the archive and 25
  in production (an earlier scan counted 66 and 69 pages, which include the lists that link to these laws and one
  false positive, `mother@#?!&*`). Three shapes:
  - An attribution name that was an address, from a link such as `[name@aol.com](http://name@aol.com)` or
    `[name@aol.com](mailto:name@aol.com)` (23 attributions in production, for example `Eppeguy@aol.com`). In the
    archive build the address was also part of the law text (`Sent by Karacourt@aol.com.`).
  - A `[Name](mailto:...)` link that an older import had cut inside the address. Law 1264's title ended
    `Sent [by Takura Razemba](mailto` and its text was `tamzanzw@yahoo.com).`; law 892's note was
    `and [getalife](mailto:getalife1@webtv` and its text ended with the tail `net).`. The build's privacy check only
    looked for `mailto:`. It failed a build from production data on the three pages that list law 1264 only by
    accident: the law card's `aria-label` joins the title and text with a colon, which turned `(mailto` and
    `tamzanzw@...` into `mailto:`.
  - The parser (`backend/scripts/build-sqlite.ts`) now masks an address used as link text (`Anonymous`, the label
    `sanitizeDisplayName` already uses), records a `http://name@host.tld` target as an email contact (one without a dotted host, or with a path, stays a link), drops a leading
    `by` from an attribution name, and removes the target of a truncated `[Name](mailto...` link at the end of a
    text (the link text stays), a leftover `mailto:` target and any bare address. The address stays in
    `contact_value`.
  - Migration `022_strip_law_contact_details.sql` cleans the production rows by content, not by ID (production IDs
    differ from the archive's), with `GLOB` and string functions only. Names that are addresses become `Anonymous`
    (the address stays in `contact_value`). A cut title whose text is only the rest of the address moves its
    sentence to the text, the title becomes `NULL` and the submitter's attribution is added when the law has none.
    A broken note becomes `and getalife` and the stray `net).` tail is removed (only from a text without a
    parenthesis). A note that still holds a contact detail is set to `NULL`, and a published law whose title or text
    still does goes back to `in_review` instead of staying public; none of the 2,453 production laws should.
    `GLOB` cannot say that a domain has no space in it, so it is a deliberate superset, and a false positive costs a
    moderator a look. The migration is idempotent, wrapped in one transaction, and its updates go through the
    search-index triggers from migration 019. The deploy builds the site from a copy of the production
    database that it migrates first (see the entry above), so the build already sees the cleaned rows.
  - The build's privacy check (`validateGeneratedPage` in `web/scripts/ssg.ts`) now rejects `mailto` without the
    colon and an email address in any law or category page, so a leak stops the build. Pattern: letters, digits and
    `._%+-` before the `@`, a dotted domain ending in a letters-only label that is not a file extension, so
    `logo@2x.png`, JSON-LD `@context` and `mother@#?!&*` do not count. The archive build passes it (0 addresses in
    2,465 law pages).
  Backend bumped to `2.3.67`; web to `3.4.70`; root to `2.6.162`.
- The daily report's command injection count (28,131 in the 9 November report) was not real. Six of the ten
  patterns in `backend/scripts/log-analyzer.sh` began with an unescaped `|` (`|cat`, `|nc`, `|wget`, `|curl`,
  `|bash`, `|sh`). Run through `grep -E`, that is "empty or cat", which GNU grep matches on every line, so each
  request was counted once per pattern and the sample list was the first two log lines six times over, followed by
  two `&category_id=` lines. `&cat` also matched the site's own `&category_id=` API calls, and the old `$(cat`
  pattern could never match (its `$` was an anchor), so subshell attempts were never counted at all. The patterns
  now escape the pipe, match each shell metacharacter literally and URL-encoded (`%7C`, `%26`, `%3B`, `%60`,
  `%24%28`), and accept `+`, `%20`, `%09`, `%0a` and `%0d` as spaces after it. After `|`, backtick and `$(` the
  command must end at a word boundary. After `&` and `;` it must not be followed by a letter, digit, `_`, `=` or
  `&`, so `&category_id=23` and `&cat=5` stay out of the count while `;cat</proc/self/environ` and
  `;cat${IFS}/etc/passwd` are counted, and literal whitespace is not accepted there, because a semicolon, a space
  and `CAT` appear together in User-Agents such as `(Linux; Android 11; CAT S62 Pro)`. A script test
  (`backend/tests/scripts/log-analyzer.test.ts`) runs the real script against a log of ordinary traffic modelled on
  the 9 November lines and 23 attack shapes, pins the exact count and sample, and, where bash 4 and `jq` exist (CI),
  checks the `--format json` path that the daily report uses. The script's last step, which prunes old reports with
  `find /tmp`, now stays at the top of `/tmp` (`-maxdepth 1`), so an unreadable directory there (CI runners have
  `systemd-private-*`) no longer makes the whole script exit 1, and the test points that step at its sandbox.
  Backend bumped to `2.3.64`; root to `2.6.156`.
- The daily report's security scans (`backend/scripts/log-analyzer.sh`) now count today's requests, once each. They
  read the whole access log, so the counts covered whatever the log retained; every nginx access-log count,
  sample and IP, including the JSON `securityFindings` and `summary`, now comes from lines whose timestamp starts
  with today's `[dd/Mon/yyyy:`, so a bare date in a URL, referrer or User-Agent does not pull in another day.
- A line that matched several patterns was counted once per pattern. Each category now runs one scan with its
  patterns joined into one alternation, so a request counts once per category, and the grand total counts a
  request that matches two categories once (the text summary says so when the categories add up to more than the
  total). The sample lines and attacking IPs use the same patterns and date filter as the count.
- The SQL patterns matched anywhere in the line, including the referrer and User-Agent, with `.*` spanning
  unrelated text, so `update`, `set`, `delete` and `from` in a browser string, `q=update settings` or `q=order+1=1`
  counted as an attack. All four scans now look at the request field only, and each SQL pattern names a whole
  attack shape (for example `union select`, `select ... from ... where`, `insert into ... values`,
  `update x set y=`, with or without spaces around the `=`, `drop table`, `xp_cmdshell`, and `or`/`and` tautologies such as `or 1=1` and `or '1'='1`),
  with spaces, `+`, `%20`, `%09`, `%0a` and `/**/` accepted between the words. The bare `--` pattern never matched
  anything, because `grep -iE "--"` ends option parsing and takes the log path as its pattern; a double hyphen now
  counts as a SQL comment only after a quote, `;` or `)`, plain or as `%2D%2D`. `document.cookie` no longer
  matches any character for the dot, and the traversal pattern `\.\.\/` no longer makes GNU grep 3.8 warn about a
  stray backslash.
- On macOS, where bash is 3.2 and `wc` pads its output, the JSON report no longer uses `mapfile` and the request
  total no longer carries leading spaces. `LOG_ANALYZER_DATE` (`dd/Mon/yyyy`) now analyses another day of the
  access log, such as yesterday's to rerun a report. `backend/tests/scripts/log-analyzer.test.ts` uses it to pin
  "today", covers a multi-day log, a line that matches several patterns, the `--` and word-boundary cases,
  and keywords in the referrer and User-Agent, and runs its JSON tests wherever `jq` exists instead of only on
  bash 4. Backend bumped to `2.3.65`; root to `2.6.157`.
- CI no longer fails a whole job when a download from an outside host fails. On 2026-11-09 GitHub Releases answered
  504 for the prebuilt `canvas` binary, so `npm ci` fell back to a compile the runner cannot do, and the Web,
  Backend, MCP, SDK and CodeQL jobs failed on changes that touched none of that. Every `npm ci` that can fetch a
  native binary now tries up to three times with a pause between tries: the CI workflows, CodeQL, the MCP registry
  publish and the deploy's runner-side install go through a small composite action, `.github/actions/npm-ci`, and
  the backend install on the production server, which a composite action cannot reach, has the same loop inline.
  The Android builds in CI and CodeQL first fetch the Gradle distribution through a second composite action,
  `.github/actions/gradle-distribution`, because the wrapper gives up after 10 seconds. Only those two downloads
  are retried: the Maven and Google artifacts the Android build fetches, and the Rollup `npm install` steps, still
  run once, and a failing build or test still fails on its first run. A permanent failure such as an out-of-sync
  lockfile is retried too, which adds about a minute before the job fails with npm's own error. A script test
  (`scripts/npm-ci-action.test.ts`) now runs both actions' scripts against a fake `npm` and `gradlew` (three tries,
  waits of 20 and 40 seconds, none after the last, a failing exit when all fail), parses every workflow to fail if
  an `npm ci` that runs install scripts is left without the retry, and checks that each local action a workflow uses
  exists and that every input it passes is declared. Those script tests, and the CodeQL workflow test, now run in
  the Lockfile sync workflow on every pull request. Root bumped to `2.6.155`.
- Triaged the 404s from the 9 November daily report. Probes for `/wallet/...`, `/build/manifest.json` and
  `/ipfs/...` are now dropped as scanner paths. `/security.txt` redirects to `/.well-known/security.txt`, and
  the sized `/apple-touch-icon-240x240.png` and `-precomposed` names redirect to `/apple-touch-icon.png`.
  The structured-data logo on five pages pointed at `/favicon-512x512.png`, a file that was never published
  (Googlebot-Image kept asking for it); it now points at `/android-chrome-512x512.png`, the old URL redirects
  there, and a test checks that every image URL built from `SITE_URL` or `baseUrl` (folders included) exists in `web/public`.
  The probe patterns also match `/ipfs` without a slash and any query string.
  The old Yahoo "Pick of the Week" badge that legacy pages still link to is served again at `/img/pick_of_the_week.gif`. Web bumped to
  `3.4.65`; root to `2.6.153`.
- The disaster-recovery runbook and the monitoring deploy guide told a reader to copy
  `config/nginx-rate-limiting.conf` and `config/nginx-murphys-laws-enhanced.conf`. Neither is at the repository root
  (both are under `backend/config/`), and the enhanced config has no scanner defense and no `scanner.log`, so
  following the old steps would have either failed or replaced the live site config with one that leaves the
  scanner jail with nothing to read. Both guides now install the root `nginx.conf`, the file the droplet actually
  runs. The recovery steps now update DNS and then issue the certificate before installing it, because that file
  points at the certificate and `nginx -t` fails until it exists, and the certificate needs the names to resolve
  to the new droplet. Both guides name the PM2 config at `backend/ecosystem.config.cjs`, where the file is (installing the Node it points at on a fresh droplet is still open, in `TODO.md`). The recovery steps also open `/root` and the checkout to the nginx worker, which the droplet has and a fresh Ubuntu does not, and check for a 200 rather than a 403. The monitoring
  guide no longer promises rate limiting, 429 responses and security headers that the live config does not have;
  it checks the scanner defense instead. A new test checks that every repository file that a runbook `cp` or `scp`
  line copies is tracked by git, and Web CI now also runs when `shared/docs/**` changes, so a runbook edit gets that check. Web bumped
  to `3.4.64`; root to `2.6.152`.
- The daily report's "Fail2ban Currently Banned" and "Fail2ban Total Bans" figures read only the `sshd` jail, so
  bans from the `nginx-scanner` jail could never appear, and nothing said when that jail was down. They now sum
  both jails and show the split, such as `2 (SSH 0, scanners 2)`, under the same labels. A jail that cannot be
  read gets its own warning row ("Fail2ban scanners jail: unavailable - see the daily-report log") and a line in
  the daily-report log with the reason, instead of dropping out; each read times out after 10 seconds. When
  fail2ban is not running at all, no ban lines appear, as before. The text report from `vulnerability-scanner.sh`
  (not the daily email) lists each jail on its own line in its FAIL2BAN STATUS block, with "not running or
  unreadable" for one it cannot read. Backend bumped to `2.3.63`; root to `2.6.151`.
- The `nginx-scanner` fail2ban jail never banned anyone. Debian and Ubuntu ship `backend = systemd` as the default
  for every jail (`jail.d/defaults-debian.conf`), and a systemd jail reads the journal and ignores `logpath`. On
  the droplet the jail showed journal matches instead of a file list and counted no failures, while `scanner.log`
  held about 600 `444` lines (as of 2026-11-08) that its filter matches. The jail now sets `backend = auto`, so
  the drops from the scanner defense count as strikes (5 in 10 minutes, banned on ports 80 and 443 for 24
  hours). Tests pin that the `[nginx-scanner]` section sets a file backend exactly once, watches the log nginx
  writes, and uses the filter on the web ports. Existing installs need `backend = auto` added to
  `/etc/fail2ban/jail.d/nginx-scanner.local` and a `sudo fail2ban-client reload`. The disaster-recovery steps now
  install the scanner jail, and the monitoring doc checks it. Web bumped to `3.4.63`; root to `2.6.150`.
- The `nginx-scanner` fail2ban jail's header comment said a false positive bans an address "from SSH and HTTP".
  The jail only sets `port = http,https`, so a ban blocks the website for 24 hours and leaves SSH alone; the
  comment now says that, that a ban does not affect the separate `sshd` jail, that installing the file enables the
  jail, and how to lift a ban. No behaviour change. Root bumped to `2.6.149`.
- Handled more of the daily report. nginx now drops a `POST /` with a 444, so the bots that post to the home
  page dozens of times a day (about 1,000 in 15 days from many addresses, per the production access logs) are
  logged to `scanner.log` and counted by fail2ban instead of getting a 405. The match is exactly `POST /` with
  no query string, so `GET`, `HEAD` and every POST to `/api` or `/subscription/*` are unchanged; nothing in the
  site posts to `/`. `/users/sign_in` and `/users/sign_up`
  (GitLab and Rails sign-in guesses) are dropped like the other guessed account paths. Bare `/murphy` now
  redirects home: the trailing-slash rewrite turned old `/murphy/` backlinks into `/murphy`, which had no
  page, so those links now take two hops (`/murphy/` to `/murphy` to the home page). The MCPCensus crawler's
  weekly probes for MCP discovery files (`/mcp`, `/.well-known/mcp*`, `/AGENTS.md` and others, seen in the
  production logs) are left as 404s, which is correct because the MCP server is a stdio npm package (see
  `mcp/server.json`), not a hosted endpoint. Web bumped to `3.4.61`; root to `2.6.147`.
- Cleared the rest of the daily report's 404s. `/img/pvtmurphy.gif`, the Pvt. Murphy's Law banner from the old
  site, is now served. Bing's `/sitemaps.xml` redirects to `/sitemap.xml` and the guessed `/favicon.png` to
  `/favicon-32x32.png`, like the existing `apple-touch-icon-precomposed.png` redirect. nginx now drops with a
  444 (so fail2ban counts it) SonicWall `/api/sonicos/...`, CrushFTP `/WebInterface`, a bare `/wp`, any
  `/health/...` probe such as `/health/liveliness` (the pattern only matched `/health` and `/health/`), and the
  `rawgrab` scanner by user agent. `/sellers.json` is left alone: a 404 is the right answer for a file the site
  does not have. (`POST /` was still a 405 at this point; the entry above drops it.) Web bumped to `3.4.60`;
  root to `2.6.146`.
- A well-formed plain HTTP request sent to the TLS port (443) no longer shows up as a `400` on
  `GET /favicon.ico` in the daily report. nginx raises error 497 for it and answered "400 The plain HTTP request was sent to HTTPS
  port" into the main access log; real browsers never do this, scanners do (a forged Firefox 65 user agent from
  neighboring addresses). Both TLS server blocks now drop it without a response and log it to `scanner.log` as
  a `444`, like the other scanner hits, so it counts toward the existing fail2ban jail (5 strikes in 10 minutes,
  banned for a day). Port 80 still redirects to HTTPS and normal HTTPS requests are unchanged. A test requires the
  rule in every server block that listens for TLS and checks that the fail2ban filter counts the new log line.
  A malformed request (HTTP/1.1 without a Host header, say) is rejected before error 497 and still gets a plain 400.
  Web bumped to `3.4.59`; root to `2.6.145`.

### Added

- `llms.txt`, `llms-full.txt` and `mcp/README.md` now say the MCP server is stdio-only: it runs locally from
  `npx`, there is no hosted or remote MCP endpoint (nothing is served at `/mcp` or `/.well-known/mcp`), and an
  agent that cannot run local processes should use the REST API. The Registry name
  `com.murphys-laws/murphys-laws` and a link to its Registry entry are given too. The Registry's `server.json`
  already declares the stdio transport, but crawlers that read only `llms.txt` cannot see it, and MCP server
  cards describe remote servers only ([SEP-2127](https://modelcontextprotocol.io/seps/2127-mcp-server-cards)),
  so there was nowhere to say it where they look. The MCPCensus crawler
  ([documentation](https://www.radixia.ai/census/crawler)) fetches `llms.txt` and `llms-full.txt` and then
  probes `/mcp` and `/.well-known/mcp*`, as the production access logs show. A test pins that nginx and
  `web/public` serve nothing at those paths and that the three files keep saying so, so they get updated if a
  remote endpoint is ever added. Web bumped to `3.4.62`; root to `2.6.148`.
- `/.well-known/security.txt` (RFC 9116) now answers with the GitHub private reporting link from `SECURITY.md`,
  so scanners and researchers looking for a security contact find one instead of a 404. It is served as UTF-8 text, as RFC 9116 requires. Its `Expires` date is
  2027-11-06 and must be renewed before then; a test fails 30 days before it passes, and `TODO.md` tracks it. nginx also drops the Jenkins `/crumbIssuer` probe, the
  `/code/blocks/exec/*` and `/run` code-execution probes (with or without `/api/v1/`), and the root `/health` and
  `/version` fingerprinting requests with a 444 for fail2ban; the real health check is `/api/health`.
  Web bumped to `3.4.58`; root to `2.6.144`.
- `/img/10001844.gif`, the Peter's Laws poster image from the old site, is now served. Facebook's link crawler
  kept requesting it and getting a 404. Web bumped to `3.4.56`; root to `2.6.142`.
- BreadcrumbList structured data on the calculator pages and every content page (about, privacy, terms, origin
  story, contact, examples and its subpages, the long-form articles, and the curated lists), in both the prerendered
  HTML and the client-side route rendering. Names and URLs are absolute and match the page titles.
  Web bumped to `3.4.53`; root to `2.6.139`.
- nginx now redirects `/about-us` to `/about` and `/contact-us` to `/contact` (301). A research crawler
  requested both each day and got a 404 from the daily report. Web bumped to `3.4.51`; root to `2.6.137`.
- Floating "Back to top" button on long pages (browse, categories and the rest). It appears after 600 px of scroll,
  is a real 44 px `<button>` with an `aria-label` and a visible focus ring, scrolls smoothly unless
  `prefers-reduced-motion` is set, supports high-contrast and forced-colors modes, hides while the install prompt or
  update toast is showing, is not mounted on Kindle, and is hidden in print. Web bumped to `3.4.55`; root to `2.6.141`.

### Changed

- nginx now drops guessed-path sweeps with a 444 and logs them to the scanner log for fail2ban: signup and
  account forms (`/account/create`, `/auth/signup`, `/create-account`, `/email-signup`, `/footer-signup`,
  `/contact-form`), generic company-site pages (`/company`, `/services`, `/team`, `/products`, `/vpn`, and the
  German and Spanish variants), and the `/api/usage/stats` probe (with or without a trailing slash) and any `/v1/auth/*` path. They came from two single-IP
  sweeps and no page or endpoint here uses those names. Web bumped to `3.4.57`; root to `2.6.143`.
- Rewrote the Sod's Law and Buttered Toast calculator meta descriptions with specific value propositions (150 to 160
  characters, unique per page, matching each calculator's real inputs). They now come from one
  `CALCULATOR_META_DESCRIPTIONS` constant in `web/src/utils/constants.ts` that feeds the prerendered meta,
  `og:description`, `twitter:description` and `WebApplication` JSON-LD, the runtime `updatePageMetadata` calls, and
  the client JSON-LD, so hydration no longer swaps in different wording. The SSG output validation fails the build
  if the three description tags drift from it. Web bumped to `3.4.55`; root to `2.6.141`.
- Redesigned the Share menu so it fits without scrolling: a "Share to" row of social icons (X, Facebook,
  LinkedIn, Reddit, WhatsApp, Email) comes first, then Copy link, Copy text, Save as image, Copy embed code and, on
  browsers that support it, Share with your device. Action rows use plain gray icons and 44px targets; only the
  social icons keep brand colors. Web bumped to `3.4.50`; root to `2.6.136`.
- The daily Law of the Day email and the subscription confirmation email now look like Murphy's Law Archive: the
  site header (the "M" badge, wordmark and tagline), the site colours and type, the law as large quote-style text
  with its category and attribution when it has them, a real "Read, vote and share" or "Confirm and start the
  daily email" button, and a clearly visible Unsubscribe link in the footer. Both use a shared 600px table layout
  (`shared/modules/email-layout.ts`) that holds up on a phone and has dark-mode styles, and both still send a
  plain-text alternative; the `List-Unsubscribe` headers are unchanged. Email clients ignore stylesheets, so the
  colors are generated from `web/styles/partials/variables.css` into `shared/modules/email-tokens.generated.ts`
  (`npm run design:export:email`; `design:check` fails when it drifts). Inline styles are confined to
  `email-layout.ts`, the only new entry in the design conformance allowlist. Backend bumped to `2.3.62`; root to
  `2.6.135`.
- The daily email confirm and unsubscribe pages (confirm prompt, subscribed, unsubscribed, link not recognized) now look
  like part of the site: the site header and wordmark, a centred card, the standard primary button and link styles,
  the utility footer, light and dark themes, a visible keyboard focus ring, and a phone layout. They load
  `variables.css` and a new `web/public/styles/subscription-pages.css` from the web build, with no inline styles,
  and still work with no JavaScript (the buttons are form posts). `noindex` and `Cache-Control: no-store` are
  unchanged. Web bumped to `3.4.49`; backend to `2.3.61`; root to `2.6.133`.
- The Deploy to Production workflow can now be started by hand (`workflow_dispatch`), so changed repository
  secrets such as the SMTP settings can reach the server without an unrelated merge. A manual run does nothing
  unless it starts from `main`, and it skips the daily email template smoke test, which compares against the
  previous push. Root bumped to `2.6.132`.
- Every law page is now linked from other pages in the static HTML. Before, 1,561 of 2,465 law pages (63%) had no
  internal link pointing at them, so search engines could only find them through `sitemap.xml`, and most of the
  rest had one to three. "Related laws" used to be the first three laws of the category for every law in it, so
  only those few laws received links. It now follows the category as a ring (the next law, and the laws one and two
  strides further on), which gives each law exactly three inbound links and any law within a few hops. Category
  pages list every law of the category as links (the first page stays as cards), and Browse lists the laws that have
  no category. After the change no law page is unlinked and the minimum is one inbound link (median four).
  `npm run seo:audit` now fails the build when a law page has no internal link pointing to it. Web bumped to
  `3.4.48`; root to `2.6.131`.

### Added

- Daily Law of the Day browser notification (Web Push). The home page signup card has a "Notify me in this browser"
  button where the browser supports push; the service worker shows the notification and opens the law when it is
  clicked. New `push_subscriptions` table (migration 021), `GET /api/v1/push/public-key`,
  `POST` and `DELETE /api/v1/push/subscriptions`, and a `npm run push:daily` cron job that records each send,
  deletes subscriptions the push service reports gone (404, 410), and sends nothing until `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set (`.env.example`, `shared/docs/DEPLOYMENT.md`). Subscription
  endpoints are limited to the real push services (FCM, Mozilla, Apple, Windows), so the job cannot be aimed at an
  arbitrary URL. Adds the `web-push` dependency. The privacy policy describes the stored data. Web bumped to
  `3.4.47`; backend to `2.3.60`; root to `2.6.130`; iOS to `1.2.12 (28)`; Android to `1.2.13 (20)`.

### Added

- Daily Law of the Day email. Visitors subscribe from the home page, confirm from the first email (double
  opt-in), and get the day's law each morning with an unsubscribe link and one-click `List-Unsubscribe` headers.
  New `email_subscriptions` table (migration 020), `POST /api/v1/subscriptions`, `/subscription/confirm` and
  `/subscription/unsubscribe` pages (nginx and the service worker pass them through), and a
  `npm run email:daily` job for cron (see `shared/docs/DEPLOYMENT.md`). Confirmation emails are rate limited
  per client and per address, and the daily send is recorded per subscriber so a re-run never mails anyone
  twice. Confirm and unsubscribe links only show a button; the POST does the change, so mail scanners cannot
  opt anyone in or out, and an old confirmation email cannot undo an unsubscribe. `npm run deploy` now runs the
  database migrations before restarting the API. The privacy policy describes the stored data. Web bumped to `3.4.46`; backend to `2.3.59`; root to
  `2.6.129`; iOS to `1.2.11 (27)`; Android to `1.2.12 (19)`.

- The 404 page is funny again and no longer looks like a modal. Unknown URLs now get a generated
  `404.html` inside the full site shell, with a large 404, a rotating Murphy-style line, and a few
  suggested laws, in the standard empty-state card. The in-app 404 view uses the same markup and lines.
  Web bumped to `3.4.42`; root to `2.6.125`.

### Added

- Embeddable law cards. `/embed/law/:id` and `/embed/law-of-day` are standalone, noindexed pages meant for an
  iframe, and every law page advertises an oEmbed endpoint, `GET /api/v1/oembed?url=<law URL>`, so WordPress,
  Notion, Slack and similar sites can unfurl a law URL into the same card. The backend renders both (new
  `EmbedService`, nginx route, service-worker bypass), keep rendered cards for five minutes, and size the oEmbed
  and copied iframe height to the law text. The card styles live in `web/public/styles/embed.css` and use the
  shared tokens. The developers page documents the snippet and the endpoint.
- The Share menu on a law has "Copy embed code" and "Save as image" (the existing law image endpoint), plus "Share
  with your device" where the browser has the system share sheet. Embed copies and system shares are reported as
  `law_shared` with `share_method` `copy_embed` and `native_share`; image saves as `save_image`. If the system
  share sheet fails to open, the link is copied instead. Clicking a link inside a law card no longer also opens
  the law. The iframe
  and law-image helpers live in `shared/modules/law-embed.ts`. Web bumped to `3.4.42`; backend to `2.3.57`; root
  to `2.6.125`; iOS to `1.2.9 (25)`; Android to `1.2.10 (17)`.
- The copied iframe no longer uses an inline `style` attribute, which `design:conformance` forbids; it uses
  `frameborder="0"` and the card caps its own width. Web bumped to `3.4.43`; root to `2.6.126`; iOS to `1.2.10 (26)`;
  Android to `1.2.11 (18)`.
- The Share popover caps its height (`min(30rem, 100vh - 2rem)`) and scrolls, and the flip-above check uses that height,
  so the longer menu cannot be cut off on a short screen or near the bottom of a page (Novus review). Web bumped to
  `3.4.44`; root to `2.6.127`.
- oEmbed honors a `maxwidth` below 240 instead of returning a wider card, and Enter or Space on Save as image in a
  Favorites card no longer opens the law instead of downloading (Codex review). Web bumped to `3.4.45`; backend to
  `2.3.58`; root to `2.6.128`.
- `/img/Murphys-law-book.gif` now serves the Murphy's Law 25th Anniversary Edition cover, which crawlers were
  requesting and getting a 404. `/.well-known/tdmrep.json` now answers with the TDM reservation file (AI mining
  not reserved), matching what `robots.txt` already allows. Web bumped to `3.4.37`; root to `2.6.121`.
- `web/DESIGN.md` now has a "Kindle browser baseline" section recording the e-ink Kindle user agents the app
  detects (`Kindle/` and `Kindle Build/`), the unsupported features found so far (flex `gap`, range media
  queries, missing DOM methods), how the code handles them, and which items are still unverified (the engine
  version and the modern CSS listed in #203). Documentation only; no version bump. The old-engine regression
  check stays open in `TODO.md`, with a new item to verify the baseline on a device.

### Fixed

- The footer `<nav>` landmark is now labelled "Footer navigation" instead of the vague "Utility", so screen
  reader landmark lists identify it clearly next to the menu and breadcrumb navs. Web bumped to `3.4.52`;
  root to `2.6.138`.
- Law pages no longer share generic titles. 2,112 of 2,465 law pages were titled "Murphy's Law" or "Corollary", so
  search engines saw them as near-duplicates. Generic titles are now derived from the law text, descriptions are
  padded to a useful length and cut at word boundaries, and any remaining collisions get the law id. The static
  site and the client router build them with the same helper (`buildLawSeo`). The law schema `headline` and
  breadcrumb name follow the same rule.
- `/favorites` is `noindex, follow` and is no longer listed in `sitemap.xml`, since its content is per-user.
- `sitemap.xml` has a real `lastmod` on every URL and no longer emits `changefreq` or `priority`, which search
  engines ignore. Category dates come from their newest law. `shared/content/metadata.json` gained entries for the
  content pages that lacked a date.
- `/browse`, `/categories` and every category page now ship `BreadcrumbList` (and `CollectionPage` for the first
  two) in the static HTML instead of only after client-side rendering.
- Expanded the thin `/best-murphys-laws`, `/funniest-murphys-laws`, `/murphys-laws-about-technology` and
  `/calculator/buttered-toast` pages with sourced explanations and internal links.

- Added `npm run seo:audit` (`web/scripts/seo-audit.ts`) audits a built `dist/`: duplicate titles and descriptions,
  canonical and noindex mismatches, length limits, missing JSON-LD and sitemap hygiene. It exits non-zero on
  blocking problems. It reads the built HTML without regex tag stripping and decodes entities in a single pass.
  `npm run build` now runs it after the static build and fails on blocking problems.
- Review fixes: the client no longer rewrites the head of a prerendered law page, so titles the static build made
  unique stay unique; category list entries are named after the law text; `/favorites` sets `noindex` itself and the
  router resets the robots tag on client navigation; `lastmod` is left out when no real date is known; disambiguated
  titles and descriptions no longer put an ellipsis before the id. The Buttered Toast page now describes the
  calculator's actual inputs (Height of Fall, Gravity, Push Force, Butter Factor, Air Friction, Toast Density) and the
  funniest-laws page names the benign violation theory's authors. Web bumped to `3.4.39`; root to `2.6.122`; iOS to
  `1.2.8 (24)`; Android to `1.2.9 (16)`.
- Laws published after the last static build are served by the backend fallback, which now uses the same title,
  description and headline logic as the static site. The logic lives in `shared/modules/law-seo.ts`, imported by the
  web build, the web client and the backend. The fallback's JSON-LD now escapes every `<` as `\u003c`. Backend
  bumped to `2.3.56`; web to `3.4.41`; root to `2.6.124`.
- nginx now drops `docker-compose*.yml`, `Dockerfile*`, `readme.html` and `license.txt` probes with a
  444 so fail2ban counts them, instead of logging them as 404s.
- Sentry now drops the `queueMicrotask is not defined` `ReferenceError` (JAVASCRIPT-1A). It came from a headless
  Chrome crawler spoofing an iPhone user agent, whose stripped-down environment lacks `queueMicrotask`, which the
  Sentry SDK calls when the page is hidden; it is not our code. Web bumped to `3.4.36`; root to `2.6.119`.
- `BACKUP-RESTORE.md` now says the B2 bucket's 30-day Object Lock default is applied in compliance mode, which is
  what the console produced on the first backup, instead of recommending governance. It explains why compliance
  also covers a droplet key that holds `bypassGovernance` or `deleteFiles`, and tells the operator to confirm
  `Compliance Mode - Expires On` in one object's details after the first backup.
- Lockfile versions no longer drift from `package.json`. `npm run lockfiles:sync`
  (`scripts/sync-lockfile-versions.ts`) copies each `package.json` version into the lockfile fields that record
  it: the root and `backend/` lockfiles' own version lines, and the root lockfile's workspace entries, with the
  workspaces taken from the root `package.json`. It changes only those fields, so nothing is reformatted. The
  pre-commit hook runs it with `--stage` whenever a `package.json` is staged, so the lockfiles are fixed and
  staged instead of the commit being blocked, and a new `Lockfile sync` workflow runs it with `--check` on every
  pull request (add it to the required status checks). This is the drift that left `packages.backend.version` at
  `2.3.52` in the root lockfile after the backend bump to `2.3.53` (Codex review on #220). The ship skill and
  `AGENTS.md` also now say to review your own change before opening a pull request. Root bumped to `2.6.117`.
- The backup restore test's sample line now replaces CR and LF in a law's title or text with spaces before
  cutting it to 120 characters, so a law with a line break no longer spreads the emailed report's sample over
  several lines. A restored database with no laws now fails the test instead of passing with a blank sample, and
  a failed integrity check or query reports sqlite3's own error text. Backend bumped to `2.3.54`.
- The monthly backup restore test (`backend/scripts/test-backup-restore.sh`) printed an empty `Sample law:` line
  because its query, `SELECT title FROM laws LIMIT 1`, had no ordering and `title` is optional (most laws are
  single-line quotes with no title). It now selects the first law by `id`, showing its title, or its text when
  the title is missing or empty, cut to 120 characters so the emailed report stays on one line. Tests restore a
  backup for each of those cases. Backend bumped to `2.3.53` (also in the root lockfile's workspace entry);
  root to `2.6.116`.
- Pinned `minimatch` to `^11.0.1` through npm `overrides` in the root and `backend/` `package.json`, because `eslint`, `@eslint/config-array`, `@typescript-eslint/typescript-estree` and `glob` all cap it at `^10.x`, so Dependabot could not reach a non-vulnerable release and its security update run failed with `security_update_not_possible`. Both lockfiles now resolve `minimatch` to `11.0.3`; lint and all test suites pass against it. Remove the overrides once those packages ship releases that allow `minimatch` 11. Backend bumped to `2.3.52`; root to `2.6.115`.
- Resolved the production Sentry issues on `thcom`. Safari with blocked site data threw a `SecurityError`
  from `typeof localStorage` before the `try` in `getTheme` and `setTheme` could catch it, which broke the
  first render (JAVASCRIPT-11); the check now sits inside the `try`. Sentry now drops the iOS
  "browsing context is going away" `AbortError` (JAVASCRIPT-14) and the "Maximum call stack size exceeded"
  `RangeError` whose frames all name the current page itself, which is the Google iOS app's injected script
  and never our bundle (JAVASCRIPT-15 to 18); frames with no filename or any other URL keep the event, so a
  recursion bug in our own scripts is still reported.
  JAVASCRIPT-19 was a development-only `c.name` query fixed earlier (`c.title AS name`). Web bumped to
  `3.4.35`; root to `2.6.114`.
- The fail2ban filter for scanner hits (`config/fail2ban/filter.d-nginx-scanner.conf`) matched nothing on
  fail2ban 1.0.2, which strips the timestamp from each line before matching, so the jail would never have
  banned anyone. It now matches the `444` lines on the client address alone (ending in `\s`, since fail2ban
  trims a trailing space), documents the `fail2ban-regex` check to run after installing it, and a test pins
  the pattern. Web bumped to `3.4.34`; root to `2.6.113`.

### Added

- Encrypted off-site backups (issue #219), to a Backblaze B2 bucket at a different provider than the droplet.
  `backup-murphys.sh` encrypts the database and `.env` backups with GPG (AES-256, symmetric) on the droplet and
  uploads them with `rclone`'s native `b2` backend, naming each object with a timestamp so every run adds a new object (B2 versioning keeps any same-name rerun). Retention
  (30 days, like the local copies) is enforced by a B2 lifecycle rule: `OFFSITE_PRUNE=lifecycle` is the default, so
  the server never deletes from the bucket and its application key needs only list, read and write on the one
  bucket (`OFFSITE_PRUNE=server` remains for a bucket without Object Lock and needs `deleteFiles`). The docs set
  out a threat model for a compromised droplet: a single-bucket key without delete or governance-bypass rights,
  B2 versioning, Object Lock with a 30-day default retention (governance recommended, compliance explained), and
  the exact lifecycle rule. Cloudflare R2 is not supported because it has no versioning or Object Lock. When
  off-site is configured and any step fails, the run exits non-zero, logs `ERROR: Off-site copy: FAILED (...)` and
  emails the alert recipient; the local backup is kept. A config file that exists but gives no remote counts as
  misconfigured, not as "not configured". The setup is a root-only file on the server
  (`/etc/murphys-laws/offsite-backup.env` plus a passphrase file), so nothing secret is in the repo, and without it
  the run still logs `Off-site copy: not configured`. The logic is in the new `backend/scripts/backup-offsite.sh`,
  which the deploy installs beside the other scripts; the deploy now installs `backup-murphys.sh` strictly too, so
  an old copy can never keep running without the off-site step. The monthly `test-backup-restore.sh` gains test 9:
  the newest off-site database and env copies must exist, be under 30 hours old, download, decrypt, and pass
  `integrity_check`, a `laws` query and the SMTP key check, and no copy older than 35 days may be listed (that
  means the lifecycle rule is missing); an unconfigured off-site copy now fails that test. The
  daily report shows the last off-site result from the backup log (a warning, also in its summary, unless it is an
  `ok` under 30 hours old from the latest backup run, so one missed or interrupted run shows at the next report),
  and the reminder and cost reports no longer claim a "20/20" run or "off-site not configured".
  `BACKUP-RESTORE.md` documents the setup, a restore drill from a clean machine that uses only the bucket and the
  passphrase stored in a password manager (the passphrase must also live off the droplet), restoring from the
  bucket and passphrase rotation. Tests run the real scripts against a directory-backed fake `rclone` with the
  real `gpg` and `sqlite3`. Backend bumped to `2.3.55`; root to `2.6.118`.

- Scanner defense in `nginx.conf`. Requests for secrets, source control, CMS and PHP exploit paths
  (`/.env*`, `/.git/*`, `/wp-login.php`, PHPUnit `eval-stdin.php`, percent-encoded variants) and exploit-kit
  user agents such as `libredtail-http` now get `444` (connection closed, no response) before any other
  handling. Blocked hits are logged to `/var/log/nginx/scanner.log` instead of the main access log, so the
  daily log report's 404 count reflects real traffic. Added fail2ban filter and jail files under
  `config/fail2ban/` that ban repeat offenders for 24 hours (installed by hand on the droplet). The patterns
  match the URL path only, so searches such as `/browse?q=error.log` are never blocked, and the `www` and
  port 80 servers drop and log scanners the same way. Web bumped to `3.4.32`; root to `2.6.111`.
- Permanent redirects for old-site URLs that still get backlinks and bot traffic: `/murphy/*.html` pages go to
  the matching category, `/examples` or `/contact` (anything else under `/murphy/` goes home), `/old/index.htm`
  goes home, and `/apple-touch-icon-precomposed.png` goes to `/apple-touch-icon.png`.
- `/.well-known/traffic-advice` answers Google's prefetch proxy with a 200 instead of a 404.

### Fixed

- The backend admin GitHub sign-in startup test no longer fails on machines whose local `.env` sets some
  of the admin or OAuth variables (it blanks them first). Backend bumped to `2.3.51`.

### Changed

- Kindle detection matches e-ink Kindle user agents only (`Kindle/` and the newer Silk-based `Kindle Build/`),
  so colour Fire tablets keep ads, analytics and the full header. Web bumped to `3.4.31`; root to `2.6.110`.
- Tracked the remaining Kindle follow-ups in `TODO.md` (browser baseline docs, old-engine regression
  check, narrowing the Silk match, revisiting hidden "Script error." events). Root bumped to `2.6.109`.
- Kindle (e-ink) browser header keeps the search box, now shorter, and hides only the download and
  theme buttons. Web bumped to `3.4.30`; root to `2.6.108`.
- Kindle (e-ink) browser: no Google ads or analytics load (the ad script covered the top of the screen
  and threw opaque "Script error." events), the footer ad shell is hidden, the "M" badge no longer
  animates (the pulse ghosted on e-ink), its "Menu" tooltip is hidden, and the header is static (it was
  drawn over the page while scrolling) and no longer wraps the title.
  The "Something went wrong" banner now ignores opaque cross-origin "Script error." events, has a
  Refresh button that actually reloads the page (a link to the current URL did nothing on Kindle) and
  a Dismiss button. Removes the temporary on-screen error diagnostic. Web bumped to `3.4.29`; root to
  `2.6.107`.

### Added

- Origin Story page shows the rocket sled photo with alt text and a caption, served at
  `/img/sledtrk.jpg` (the path the old site used, so old emails and pages that still embed it keep
  working). The figure is added by the web app and the static prerender, not the shared markdown, so the
  mobile apps are unaffected. The build now fails if the prerendered Origin Story page loses its photo
  or the image is missing from the output. Web bumped to `3.4.26`; root to `2.6.99`.
- Added `.github/FUNDING.yml` so the repository shows a GitHub Sponsors button for `ravidorr`
  (the button is driven by this file, not by `package.json`). Root bumped to `2.6.91`.
- Admin "Sign in with GitHub" (#186). The admin page shows a sign-in button; an allowlisted GitHub
  login (`ADMIN_GITHUB_USERS`) gets an 8 hour signed session cookie (`HttpOnly`, `Secure`,
  `SameSite=Strict`, signed with `ADMIN_SESSION_SECRET`, stateless so rotating the secret signs
  everyone out) and no longer needs to paste a token. New routes
  `GET /api/v1/admin/auth/github`, `GET /api/v1/admin/auth/github/callback`,
  `GET /api/v1/admin/auth/session` (always `200`) and `POST /api/v1/admin/auth/logout`. The sign-in error page uses the admin stylesheet, with no inline styles. The callback checks a signed
  `state` cookie, answers `403` for a login that is not on the allowlist and shares the failed-login
  rate limit, which is checked (without using it up) before GitHub is contacted so a blocked client cannot keep
  causing outbound requests. Cookie-authenticated writes must send `X-Admin-Request: 1` and an `Origin` equal to
  `BASE_URL`. `ADMIN_API_TOKEN` keeps working (CLI, MCP and a collapsed "Use an API token instead"
  fallback in the page) with no CSRF requirement. New config: `GITHUB_OAUTH_CLIENT_ID`,
  `GITHUB_OAUTH_CLIENT_SECRET`, `ADMIN_GITHUB_USERS`, `ADMIN_SESSION_SECRET`; the deploy workflow
  reads the first two from the repository secrets `ADMIN_GITHUB_OAUTH_CLIENT_ID` and
  `ADMIN_GITHUB_OAUTH_CLIENT_SECRET` because secret names cannot start with `GITHUB_`.
  Backend bumped to `2.3.42`; root to `2.6.88`.

### Changed

- CodeQL no longer runs the Kotlin and Swift analyses on pull requests that do not touch `android/`, `ios/`,
  `shared/` or the design token sources (`web/DESIGN.md`, `web/styles/partials/variables.css`). The macOS Swift
  build was the slowest check on unrelated pull requests. Pushes to `main` and the weekly schedule still run every
  language. Root bumped to `2.6.105`.

- Admin sign-in redesign. The signed-out `/admin` page now shows one centered "Admin sign-in" card with a
  primary "Sign in with GitHub" button and an outline "Use an API token" toggle that opens the token form
  inline, replacing the two controls crammed into the page header. When GitHub sign-in is not configured
  the card shows the token form directly with a note saying why. The card uses the `card card--section`
  shell from `web/DESIGN.md`. Backend bumped to `2.3.50`; root to `2.6.104`.

- The daily report's "Pending approvals" link now points to `/admin` instead of `/api/v1/admin/ui`.
  `/admin` is the canonical page URL and `/api/v1/admin/ui` is the original alias; both serve the same
  page. The link now needs the host in `BASE_URL` to route `/admin` to the API (nginx and the Vite
  proxies already do). The admin page path now lives in one constant, `ADMIN_PAGE_PATH`, used by the router, the sign-in redirects and the report. Backend bumped to `2.3.49`; root to `2.6.103`.
- Added an npm `overrides` entry that pins `re2js` to `2.9.1` under `markdownlint`, fixing the quadratic-time
  lookbehind denial-of-service advisory GHSA-gg6h-894w-4m9c that failed the dependency audit.
  `markdownlint-cli2` and `markdownlint` are already at their latest releases and pin `re2js` `2.8.6`, so
  the override can be removed once `markdownlint` ships a patched `re2js`. Root bumped to `2.6.101`.
- iOS: the `Int: Identifiable` extension used for sheets is now `@retroactive`, which silences the Swift
  compiler warning that it could clash if Apple adds the conformance. All workflows use
  `actions/checkout@v7` and `actions/setup-node@v7` (already used by `dependency-audit.yml`), ending the
  Node.js 20 deprecation warning. iOS bumped to `1.2.6` / build `22`; root to `2.6.100`.
- `health-monitor.sh` is the only sender of production health alerts and no longer depends on SMTP (#198).
  - `health-check.ts` always runs its checks: without SMTP settings or a recipient it warns and skips only
    the email. A new `--no-email` mode reports by exit code and output only. Exit codes: `2` only for an
    invalid recipient, `3` passed with warnings that were not emailed, `4` the script failed unexpectedly;
    an exit `1` now always comes with a `Health check FAILED` line. Each check's timeout now covers reading
    the response body (an API that sent its headers and then stalled used to hang the run);
    `HEALTH_CHECK_TIMEOUT_MS` changes the 10 seconds.
  - `health-monitor.sh` runs it with `--no-email`, so one run sends at most one email and a missing SMTP
    setting can no longer stop the monitoring or the restarts. Only an exit `1` with that line counts
    towards a restart; a check that could not run (a crash, `tsx` or `node` missing, a timeout, being
    killed) sends a "could not run" alert and restarts nothing.
  - Mail is rate-limited. The outage is emailed once (retried on the next failing run if that mail could
    not be sent, and the mark expires after 6 hours), then the restart mail (its subject says so if
    `pm2 restart all` failed) and the critical mail as before. "Could not run" is sent at most once per
    exit code every 6 hours, "could not run after restart" has its own cooldown, and the slow-site warning
    is sent at most once a day. A healthy run clears only the outage mark, so a check that flaps does not
    mail on every flap, and a mail that could not be sent starts no cooldown. Malformed or future times in
    the state files count as due, and the monitor warns (and mails once) when it cannot save the failure
    count.
  - The run is bounded and cleaned up: one run at a time (a lock directory, taken over when stale), a
    `timeout 120` backstop where `timeout` exists, private temporary files removed on exit, state written
    atomically, and the failure count reset before a restart so a run killed during it cannot restart again
    at once. There is still no dead-man ping when the check could not run.
  - `HEALTH_CHECK_EMAIL_TO` now applies only to `health-check.ts` and `health-check.sh` run by themselves.
    Docs updated (`HEALTH-CHECK.md`, `SERVER_MAINTENANCE.md`, `.env.example`).
    Backend bumped to `2.3.48`; root to `2.6.96` (the numbers skip because the branch carried two commits
    that each bumped before they were squashed).
- No monitoring email goes to a built-in personal address any more; the recipient now comes from
  configuration.
  - Order: `ALERT_EMAIL`, then `EMAIL_TO` (the admin address the server already uses for notices).
    `health-check.ts` and `health-check.sh` also honor `HEALTH_CHECK_EMAIL_TO` first. Blank values count
    as unset. A recipient setting may be a comma-separated list; the shell scripts and `health-check.ts`
    send to each address and reject a list that contains an invalid one.
  - TypeScript (`health-check.ts` and the daily report) share one resolver and one list parser in
    `scripts/alert-recipient.ts`, and stop with an error when no recipient is configured or one is invalid
    (the daily report checks before it collects anything). Because cron has no environment, both read the
    recipient from the server's `.env` files, as the shell scripts do, skipping a file that cannot be read.
  - The five shell scripts that send mail (`health-check.sh`, `health-monitor.sh`, `ssl-monitor.sh`,
    `cost-optimization-report.sh`, `test-backup-restore.sh`) share a new `alert-email.sh`. It looks in the
    environment and then in `$ALERT_ENV_FILE`, the root `.env` and `backend/.env`, parsing the usual forms
    the way dotenv does and never executing the files. It checks the address, calls `mail` with `--`, and
    reports a distinct status for sent, no recipient, invalid recipient and mail failure. A script that
    cannot find the helper (beside itself, or under `$REPO_ROOT`) stops with
    `FATAL: cannot load alert-email.sh` instead of losing every alert. `vulnerability-scanner.sh` sends no
    email (the daily report includes its output), so its hard-coded address and unused `send_report` are
    simply removed.
  - With no address, the shell scripts warn on stderr and in syslog (`logger -t murphys-alerts`), skip the
    email, and exit with code `2` when the run would otherwise have succeeded, so cron notices. A run that
    failed for its own reasons keeps its own exit code, and a suppressed repeat alert is not a failure.
  - Alert logs and state are honest. `ALERT SENT` and the cooldown (`health-check.sh`) or once-a-day
    (`ssl-monitor.sh`) state are recorded only after `mail` accepted the message, so a dropped alert can no
    longer hide the next one. Failures log `ALERT NOT SENT (reason)` (`Report NOT emailed (reason)` in the
    report scripts), and `health-monitor.sh` no longer claims "Alert sent." regardless of the result. `mail`
    exiting 0 only means the local mail system accepted the message (documented).
  - `health-check.ts` no longer says "Alert email sent" when the email failed (it prints
    `ALERT EMAIL NOT SENT`) and uses distinct exit codes: `1` a check failed, `2` misconfigured (no SMTP
    settings, or a missing or invalid recipient), `3` only warnings and the alert could not be delivered.
  - `health-monitor.sh` ran `backend/scripts/health-check.mjs`, which no longer exists, so every run counted
    as a failed check. It now runs `health-check.ts` through `tsx`. Only a real failure (exit `1`) counts
    towards a restart; a check that could not run (exit `2`, or `126`/`127`/`137` when `tsx` or `node`
    cannot be started) sends a "could not run" alert and restarts nothing, and exit `3` counts as healthy.
  - Deploy: the workflow checks, in its own step before anything is uploaded, that `ALERT_EMAIL` or
    `EMAIL_TO` is set (a blank or whitespace-only secret counts as unset), and the server script checks that
    the monitoring scripts arrived before it changes anything live. `npm run deploy` makes the same file
    check before its first sync. The helper and the scripts that load it are installed with failures not
    ignored, and the cause is shown; `npm run deploy` now also installs `health-monitor.sh` and
    `ssl-monitor.sh`. The optional `ALERT_EMAIL` and `HEALTH_CHECK_EMAIL_TO` are left out of the server
    `.env` when their secrets are not set.
  - Docs: `shared/docs/HEALTH-CHECK.md` (which script honors which variable, exit codes, how to add or
    remove the secrets), `DEPLOY-MONITORING.md`, the backup-test guides, `DISASTER-RECOVERY.md` (the rebuilt
    `.env` now has a recipient), `GITHUB-SECRETS-SETUP.md`, `backend/README.md` and `.env.example`. Runbook
    examples use a `<your-email>` placeholder (the Emergency Contacts entry is kept), and the unused
    address in `log-analyzer.sh` is gone. In `render-daily-report.ts` the sendmail error now says why
    `sendmail` could not be started.
  - Tests run the monitoring scripts in a sandbox with a fake `mail` that records each argument, a local
    SMTP server and site for `health-check.ts`, the whole of `health-monitor.sh` with a fake `tsx` and
    `pm2`, the daily report's cron entry point with no environment, and the extracted alert functions of the
    other scripts.
  - In production, monitoring email now goes to the `EMAIL_TO` secret's address unless `ALERT_EMAIL` (or,
    for the health check, `HEALTH_CHECK_EMAIL_TO`) is set. Backend bumped to `2.3.45`; root to `2.6.93`.
- `.env.example` reorganized into sections with a header explaining where to copy it and that every
  variable is optional, a default noted for each variable, and a single `BASE_URL` entry that now
  covers the admin GitHub sign-in as well as the daily report. Added the variables the code
  reads that were missing (`VITE_API_URL`, `VITE_SITE_URL`, `WEB_DIST_PATH`, `PM2_PATH` and the
  `HEALTH_CHECK_*` settings) and a note that `FACEBOOK_APP_SECRET` is not read by any code yet.
  Root bumped to `2.6.90`.
- MCP Release workflow: the registry-version logic now lives in `scripts/mcp-registry-state.ts`
  with unit tests built from a multi-version registry response (it reads the entry the registry
  flags as latest and fails loudly when that is ambiguous), replacing inline `jq`. The workflow
  checks npm and registry state before installing anything and exits early when both already
  have the version, and it only triggers on paths that change the published package
  (`mcp/src`, `mcp/bin`, `mcp/package.json`, `mcp/server.json`, `mcp/tsconfig.build.json`,
  `mcp/README.md`). Root bumped to `2.6.87`.

### Fixed

- Kindle and other older e-ink browsers: removed reliance on flex `gap` so headings, proof-point
  pills, and action buttons keep their spacing (#203); the static header now includes primary
  navigation links, so it works without JavaScript (#204); the build now emits a transpiled legacy
  bundle with polyfills, and the static Law of the Day shows a real law instead of an "Enable
  JavaScript" message (#205). The legacy build emits its CSS as a file instead of injecting it at
  runtime, and the design conformance scan skips only the generated core-js polyfill bundle. Older
  browsers also get small DOM polyfills (`replaceChildren`, `replaceWith`, `after`, `toggleAttribute`)
  and a timeout-signal fallback for `AbortSignal.timeout`, so views no longer throw and leave a blank
  page. If the first render still throws, the router restores the prerendered page and reports the
  error to Sentry instead of leaving a blank page. The service worker does not precache the legacy
  bundles. Web bumped to `3.4.27`; root to `2.6.102`.

- Backend coverage no longer prints a `'const' declarations must be initialized` parse error: the
  type declaration files (`backend/src/admin-ui/*.d.ts`) are now excluded from coverage like other
  non-runtime files. They hold only types, and the totals are unchanged (100% statements, branches,
  functions and lines). Backend bumped to `2.3.43`; root to `2.6.89`.
- The MCP Release workflow now asks the registry for the latest version only
  (`version=latest`). The search endpoint lists every published version, so the first match
  could be an older release, which made the workflow try to re-publish an existing version
  and fail after every MCP change merged to main. Root bumped to `2.6.86`.

### Security

- Upgraded `vitest` and `@vitest/coverage-v8` to `4.1.12` in every workspace, which pulls in
  the patched `@vitest/mocker` `4.1.12` and clears the four open Dependabot alerts (root and
  backend lockfiles). Dev-only dependencies. Backend bumped to `2.3.41`; root to `2.6.85`.

### Added

- Admins can change the category of a submitted law. `POST /api/v1/admin/laws/:id`
  accepts `category_id` (a positive integer: 400 `category_id must be a positive integer`
  if malformed, 400 `Unknown category` if no such category exists), which replaces all of the law's categories with that one in
  the same transaction as the other edits, so category listings, counts and filters
  update at once. The admin list also returns every category, the moderation page has a
  category selector on each law, and the audit log line records the previous and new
  category ids. Submitters cannot edit categories; this stays an admin action.
  Backend bumped to `2.3.40`; root to `2.6.84` (lockfiles kept in sync).

- The admin moderation page is now served at `https://murphys-laws.com/admin`
  (and `/admin` locally and through the Vite dev and preview servers). The backend serves it at
  `/admin` with the same token rules and security headers as `/api/v1/admin/ui`
  (still available), nginx proxies `/admin` to the API, the service worker lets it
  pass through uncached (including `/admin/`), nginx shows the normal 404 page when
  the admin is disabled, and `robots.txt` disallows it for every crawler group, including the named ones. Docs and tests updated.
  Backend bumped to `2.3.39`; web to `3.4.23`; root to `2.6.83`.

- Daily email report now has a "Pending approvals" section with the number of submitted
  laws waiting for review and, when there are any, a link to the admin moderation page
  built from the configured `BASE_URL` (falling back to the site URL; the path is
  `/api/v1/admin/ui`). A zero count says so and omits the link; if the count cannot be
  read (including a missing database or a hung query) the report still sends, flags the
  count as unavailable, and logs the failure. The report script reads `BASE_URL` from the
  environment or the root/backend `.env`, since the cron launcher does not load it. A `BASE_URL` that is not a plain http(s) URL (for example one with a query or fragment) is logged and ignored. Backend bumped to `2.3.38`; root to `2.6.82`.

- Thank-you email to the submitter when an admin approves a pending law that has a
  valid email address (new `law-approval-email-template` and
  `EmailService.sendLawApprovedEmail`). It needs SMTP, goes to one plain address, never
  blocks moderation, and is recorded in `laws.approval_email_sent_at` (migration 018)
  so approving a law again does not email twice; a failed send is retried by the next
  approval. The admin API returns `thank_you` (`queued` or `skipped` with a reason) and
  the page says whether one is being sent or why not. Failures are logged by law id and
  error codes only. Backend bumped to `2.3.37`; root to `2.6.81`.

- Moderation tooling for submitted laws: token-protected `GET /api/v1/admin/laws`
  and `POST /api/v1/admin/laws/:id` endpoints (list by status with search, approve,
  reject, edit text/title, admin notes, with a 409 on concurrent edits) and a
  standalone page at `/api/v1/admin/ui`. Everything is disabled (404) unless
  `ADMIN_API_TOKEN` is set to 32+ characters; the deploy workflow writes it to the
  server `.env` from the GitHub secret of the same name and warns when it is empty.
  Failed admin logins are rate limited, changes are logged, and admin routes stay out
  of the public OpenAPI spec. Request bodies are capped at 16 KB and the page
  handles conflicts, deleted laws, malformed replies, and concurrent refreshes.
  CORS now allows the `Authorization` header.
  Backend bumped to `2.3.35`; root to `2.6.79`.

### Fixed

- Search index no longer drops a published law when it is updated without its text or
  title changing (admin notes, category). The update triggers from migration 015 had no
  guaranteed order, so the removal could undo the re-insert; migration 019 removes the old
  entry BEFORE the update, inserts AFTER it, and rebuilds the index from published laws.
- Law of the day no longer returns 404 (and breaks the deploy health check) when the
  featured law is unpublished; a new published law is picked instead.
- Resolved CodeQL findings in the admin page DOM test by parsing the page HTML
  instead of stripping `<script>` tags with a regular expression.

### Changed

- Daily Status Report: drop bullets from the law of the day, performance,
  traffic, backup, log analysis, nginx, and path traversal/command injection
  sections in favour of label/value and plain rows; add subheadings and up to 10
  distinct example requests per HTTP error status to the nginx section
  (`errorSamples` from `log-analyzer.sh`); parse the status from the field after
  the quoted request. No dependency changes (the MCP package and its lockfile entries are untouched). Backend bumped to `2.3.34`; root to `2.6.78`.

### Fixed

- Harden the Daily Status Report: log the collector name and error to stderr
  (`/var/log/daily-report.log`) when the PM2, log analysis, backup, resource
  peak, vulnerability, or cost collectors fail, and let `daily-report.sh` use the
  `tsx` installed in `backend/node_modules` instead of downloading it through
  `npx` on every run. Failure-logging tests mock `execFileSync` so they run no
  host commands. Backend bumped to `2.3.35`; root to `2.6.79`.

- Restore the Daily Status Report's API status, PM2 status, and log analysis:
  tolerate the banner and `[PM2]` diagnostics `pm2 jlist` prints before its JSON, and ignore non-numeric
  nginx status fields (`"-"` from malformed requests) in `log-analyzer.sh`.
  Backend bumped to `2.3.33`; root to `2.6.77`.

- Resolve the high-severity dependency audit findings: update `vite` to `7.3.7`
  (launch-editor and dev-server advisories) and `markdownlint-cli2` to `0.24.0`
  (pulls in `markdown-it` `15.0.3` and a patched `braces`). Web bumped to
  `3.4.22`; root to `2.6.76`.

### Changed

- Identify each browser to Novus analytics with a random, stable visitor id kept
  in localStorage instead of the agent's own anonymous id, so funnels, retention
  and usage totals count this sign-in-free site's visitors. The id is generated
  in the browser, never derived from anything, and is read only on the canonical
  production host. If storage or randomness is unavailable the agent falls back
  to its anonymous id. Existing visitors restart under new ids. Root bumped to
  `2.6.76`; web to `3.4.22`.

- Automate MCP npm and registry releases with version-contract checks and
  idempotent post-merge publication. Root bumped to `2.6.69`.

- Pin patched `smol-toml` and `katex` versions under the Markdownlint CLI
  toolchain via npm overrides because upstream still declares vulnerable exact
  ranges, and remove the corresponding dependency audit exceptions. Root bumped
  to `2.6.65`.

- Harden Lighthouse CI: warm up preview routes before collection, assert LCP and
  CLS on the **median** of three runs, and use a **3000 ms** CI LCP ceiling while
  documenting **2500 ms** as the product target in `web/DESIGN.md`. Root bumped
  to `2.6.66`.

- Replace GitHub automatic CodeQL setup with a repository-owned advanced
  workflow that scans Actions, JavaScript/TypeScript, Python, Ruby, Android
  Kotlin, and iOS Swift using explicit native builds where required, and disable
  GitHub default CodeQL setup so advanced SARIF uploads are accepted. Root bumped
  to `2.6.64`.

- Document the approved advanced CodeQL workflow design for complete
  interpreted and native language coverage.

- Add a blank line between README badges and the introduction.

### Changed

- Add verified Shields.io badge rows to the root README.

### Fixed

- Discover `npm` dynamically for Android `exportDesignTokens` (NVM, version
  managers, and system paths) and extend `PATH` so Gradle preBuild succeeds in
  Android Studio when the IDE shell omits Node. Bump Android Gradle Plugin, KSP,
  and Gradle wrapper for current toolchain compatibility. Android bumped to
  `1.2.7`; root to `2.6.75`.

- Apply pointer category picks immediately while keyboard navigation applies on
  Enter, preserve the current category on Clear even before category options
  load, discard stale category responses after navigation, route cross-category
  searches to the selected category or Browse, and keep mobile filter actions
  side by side. Web bumped to `3.4.21`; root to `2.6.74`.

- Correct the README footer's incomplete acknowledgement sentence. Root bumped to `2.6.73`.

- Buffer retried MCP Registry responses before parsing them. Root bumped to
  `2.6.72`.

- Retry bounded MCP Registry reads after transient failures. Root bumped to
  `2.6.71`.

- Use npm 11.5.1 for OIDC trusted publishing and avoid coalescing pending MCP
  releases. Root bumped to `2.6.70`.

- Resolve CodeQL findings by limiting workflow tokens, removing shell-command
  interpolation, and constructing user-visible HTML with DOM APIs. Web bumped
  to `3.4.19`; root to `2.6.67`.

- Parse the Novus script fixture with the DOM parser instead of a regular
  expression so CodeQL's HTML-filtering rule cannot be bypassed by tag spacing.
  Web bumped to `3.4.20`; root to `2.6.68`.

- Daily report HTML: long label cells use a fixed 38% column with normal word
  breaks (avoids Gmail letter-stacking on `MAIN DROPLET`); section bullets render
  as full-width list lines so they do not inherit wide label columns. Backend
  bumped to `2.3.32`; root to `2.6.62`.

- Wrap daily report HTML at MIME tag boundaries so Postfix line folding does not
  break tags (for example `<td`) in Gmail; fold by UTF-8 byte length at `>` or
  whitespace without splitting entities. Backend bumped to `2.3.28`; root to
  `2.6.58`.

### Changed

- Shrink-to-fit daily report table label columns (`width:1%`, `nowrap`) so value
  cells use remaining width; long labels wrap below 360px. Backend bumped to
  `2.3.30`; root to `2.6.60`.

- Restyle the daily operational email HTML and plain-text parts to match the
  table-based design spec (640px card, glance glyphs, callouts, cost sub-headings),
  and use `!` for attention in HTML to match plain-text `[!]`. See
  `docs/superpowers/specs/2026-10-11-daily-report-email-design.md`. Backend bumped
  to `2.3.26`; root to `2.6.56`.
- Reserve vulnerability scan checkmarks for clean scans; show warning callouts when
  `totalIssues` is non-zero.

- Tag `--test-email` subjects with a UTC timestamp and send an automatic template
  smoke email after deploy when `render-daily-report.ts` changes and
  `DAILY_REPORT_TEST_RECIPIENT` is configured in GitHub Actions.

- Render the consolidated daily operational email through a TypeScript MIME
  renderer with matching HTML and plain-text parts, structured JSON report
  producers, restored log detail rows, and a `--test-email` mode that sends only
  when `DAILY_REPORT_TEST_RECIPIENT` is set. Backend bumped to `2.3.24`; root to
  `2.6.54`.
- Harden the daily email renderer with PM2 API status in the summary, stale
  backup warnings, preserved `systemctl` output, richer vulnerability JSON, and
  sudo-safe `--test-email` documentation.
- Allowlist operational email inline CSS in the design conformance gate.
- Apply summary tone colors to section rows in daily email HTML, align the
  vulnerability test fixture, and use live PM2 status in `--test-email` when
  available.
- Require per-provider billing verification before marking infrastructure
  inventory verified; align cost report UNVERIFIED copy with mixed providers.
- Store verified infrastructure inventory under `/etc/murphys-laws/` (default
  `INVENTORY_FILE`) so deploy rsync does not delete it; migrate legacy path on
  deploy.
  Backend bumped to `2.3.23`; root to `2.6.53`.
- Documented Network Solutions as the murphys-laws.com registrar in the
  infrastructure inventory example, including amortized multi-year domain costs.
  Backend bumped to `2.3.21`; root to `2.6.51`.
- Retired n8n automation entirely: removed the second droplet from cost reports,
  inventory, backup/DR runbooks, server maintenance, and health-check docs.
  Backend bumped to `2.3.20`; root to `2.6.50`.
- Corrected remaining single-host wording in deploy monitoring and backup-test docs.
- Reworked monthly cost optimization reporting to use 30-day operational metrics,
  explicit capacity decisions, and no automatic consolidation or downsizing
  recommendations. Extended performance tracking, hardened backup integrity checks,
  and aligned deployment monitoring docs. Backend bumped to `2.3.19`; root to `2.6.49`.
- Fixed daily metrics awk invocation, per-sample PM2 headroom checks, n8n peak
  file selection, and swap vmstat counters (`pswpin`/`pswpout`).
- Read PM2 memory limits from live process config, document n8n collector install,
  and add n8n capacity section to the monthly cost report.
- Allow n8n optional API probes and document repo checkout on the n8n droplet for
  capacity analysis.
- Preserve empty n8n probe URLs, improve bc ratio precision, and run capacity
  analysis with the repo-pinned tsx binary. Backend bumped to `2.3.19`; root to `2.6.49`.

### Added
- Article pages (Origin Story, Real-Life Examples, Murphy's Law vs Sod's Law, the
  work and project-management articles, and the themed examples pages) now show a
  row of archive buttons under the title and three vote-able laws from the matching
  category after the article, so readers who land on an article have a next step
  into the archive. Clicks are reported to Pendo as `article_cta_clicked`. Origin
  Story lists its archive links before its outside citations, external links in
  site content open in a new tab, the Sod's Law explainer links straight to the
  original and office laws, and article links use the canonical
  `murphys-computer-laws` category slug.
- Added the build-time root-package version to the web footer. Web bumped to
  `3.4.18`; root to `2.6.40`.
- Added the canonical agent guide, policy and support documents, an LLM index,
  and a design-system showcase that references the authoritative web tokens.
  Root bumped to `2.6.37`.
- The web app now loads the Novus by Pendo agent and initializes it once per page
  load with an anonymous visitor, enabling product analytics and in-app guides.
  Both loading and initialization are limited to the canonical production host, so
  local, preview, Playwright and Lighthouse runs never download or start it.
  Recorded URLs keep only the `category_id`, `sort`, `order` and `page` query
  parameters, so visitor-typed search text (`q`, `attribution`) is never sent.
  Web bumped to `3.4.11`; root to `2.6.13`.
- Pendo Track Events for archive search, voting, sharing, favorites, calculator
  results, law submissions, exports, PWA install prompts, and theme changes, so
  product analytics can see the interactions that page views and clicks miss.
  Events go through a guarded `pendo.track()` helper that does nothing until the
  Pendo agent is loaded.
- Hardened archive discovery and release quality with FTS relevance search,
  duplicate-similarity scoring, reviewed editorial metadata, richer static
  rendering and canonical routing, accessibility fixes, production-only
  telemetry, and automated smoke, budget, audit, and Lighthouse gates. Backend
  bumped to `2.3.0`; web to `3.4.0`; SDK to `0.2.0`; CLI to `0.1.1`; MCP to
  `1.2.2`; iOS to `1.2.2` / build `18`; Android to `1.2.3` / versionCode `10`;
  root to `2.6.0`.

### Changed
- Added an expiring, reviewed allowlist for high and critical full-audit
  advisories, enforced before push and in CI. The shared privacy policy is now
  the sole canonical source, and project guidance reflects actual validation
  behavior. Root bumped to `2.6.38`.
- Renamed the canonical agent guide to `AGENTS.md` so supported coding agents
  discover it automatically. Root bumped to `2.6.39`.
- Deployment health checks now use bounded retries for local API endpoints and
  report the final HTTP status and response body if an endpoint is still
  unavailable. Root bumped to `2.6.36`; backend to `2.3.10`.
- Raised backend and web coverage gates to 100% for statements, branches,
  functions, and lines, with tests covering all tracked runtime paths. Web CI now
  runs the coverage command, and backend coverage includes both production and
  development logo-path branches. Root bumped to `2.6.34`; backend to `2.3.8`;
  web to `3.4.17`.
- Enforced coverage thresholds locally and in CI for the Node packages, iOS, and Android,
  and require applicable CI checks before pull requests can merge. Root bumped to `2.6.30`;
  SDK to `0.2.1`; CLI to `0.1.2`; MCP to `1.2.5`; iOS to `1.2.5` / build `21`; and Android
  to `1.2.6` / versionCode `13`.
- Documented the complete public API contract in OpenAPI, including vote
  creation and removal, submitter search, Open Graph images, current
  submission rate limits, and rate-limit error responses. The frontend API
  reference now matches the published contract.
  Backend bumped to `2.3.7`; web to `3.4.16`; iOS to `1.2.4` / build `20`;
  Android to `1.2.5` / versionCode `12`; root to `2.6.29`.
- Added a dedicated TypeScript project for Playwright E2E tests, so Node and
  Playwright types are checked alongside the web application. Web bumped to
  `3.4.14`; root to `2.6.22`.
- Re-enabled the repository's pre-commit and commit-message safeguards. Root bumped
  to `2.6.21`.
- Refreshed the project checklist to reflect shipped submission, category, calculator FAQ,
  comparison, and examples content. Root bumped to `2.6.15`.
- Android CI now enables KVM acceleration, caches Gradle state, builds only
  required debug artifacts, cancels superseded runs, and enforces a 30-minute
  timeout. Root bumped to `2.6.6`.
- Aligned the web, iOS, and Android implementations with the authoritative
  cross-platform design system, added generated platform tokens and canonical
  components, and enforced the no-React/no-inline-CSS contract in source and
  generated web output. Backend bumped to `2.3.1`; web to `3.4.3`; iOS to
  `1.2.3` / build `19`; Android to `1.2.4` / versionCode `11`; root to `2.6.3`.

### Fixed
- Removed the retired n8n droplet from the monthly backup reminder and aligned
  restore checks with the database and environment backups that are actually
  created. Backend bumped to `2.3.11`; root to `2.6.41`.
- Ensured the manual deployment script installs the updated backup restore
  checker. Backend bumped to `2.3.12`; root to `2.6.42`.
- Decoded escaped Android SDK paths from `local.properties`, so Windows installations
  run local Android coverage when the SDK is available. Root bumped to `2.6.33`.
- Gave each required CI gate a unique status-check name so branch protection recognizes
  successful workflows. Root bumped to `2.6.32`.
- Kept design-system validation compatible with selective CI filters, made required
  CI gates fail closed when path detection fails, and skip local Android coverage only
  when no usable SDK is configured. Root bumped to `2.6.31`.
- The first-visit "Ready for Offline" notice now slides away and is removed about
  5 seconds after it appears, instead of staying on screen and covering page content
  until dismissed. Its Got it button, and the install prompt's buttons, also work
  when browser translation wraps their labels. Web bumped to `3.4.13`; root to
  `2.6.20`.
- Updated the MCP TypeScript SDK to resolve a high-severity OAuth credential
  forwarding vulnerability. MCP bumped to `1.2.4`.
- Production deployments now synchronize a stale PM2 daemon with the installed
  CLI before querying its process metadata. Root bumped to `2.6.19`.
- Production deployments now install dependencies from a committed backend lockfile,
  preventing stale server-side dependency trees from breaking npm installs. Root bumped
  to `2.6.18`.
- Production deployments now provision PM2 for a newly installed Node runtime.
  Root bumped to `2.6.17`.
- Production deployments now install the Node version pinned in `.nvmrc` when it
  is absent from NVM. Root bumped to `2.6.16`.
- Sorting browse or category results no longer reports the reload as a new search
  when it supersedes an in-flight search. Web bumped to `3.4.12`; root to
  `2.6.14`.
- Buttered Toast calculator formulas now scale to the available card width without horizontal scrolling. Web
  bumped to `3.4.8`; root to `2.6.10`.
- Legacy calculator URLs now permanently redirect to their canonical calculator pages
  instead of returning a static 404. Root bumped to `2.6.9`.
- Archive routes now preserve backend rendering for newly published laws and
  categories, return real 404s for unknown paths, and keep canonical category
  slugs aligned across generated pages, UI links, API documentation, and AI
  discovery files. Backend bumped to `2.3.2`; web to `3.4.7`; root to `2.6.8`.
- Dark-mode autocomplete matches now use the highlight foreground token, so
  matched text remains high-contrast on the yellow highlight surface. Web
  bumped to `3.4.6`; root to `2.6.7`.
- Updated service workers now remain waiting until the user chooses Refresh,
  and offline-readiness notifications appear only after the initial
  installation. Web bumped to `3.4.5`; root to `2.6.5`.
- Unlisted same-origin API routes now bypass service-worker Cache Storage, so
  dynamic responses such as advanced-search submitters cannot become
  indefinitely stale. Web bumped to `3.4.4`; root to `2.6.4`.
- Service-worker cache revisions now hash all generated deployable content, so
  content-only SSG deployments install a fresh cache instead of retaining
  stale HTML under an unchanged URL-derived revision. Only the application
  shell and static assets are precached; generated pages use network-first
  runtime caching.
- Static 404 and offline pages now load a generated copy of the authoritative
  design tokens, keeping their external fallback stylesheet fully styled in
  production builds without inline CSS.
- CTA labels now stay on one line, keeping text and icons side by side across
  desktop and mobile layouts. Web bumped to `3.4.2`; root to `2.6.2`.
- Pinned iOS CI to the macOS 15 runner that provides Xcode 16.4, and stabilized
  homepage loading so the Daily Law updates inside reserved space without
  shifting the rest of the page. Web bumped to `3.4.1`; root to `2.6.1`.
- Updated `typescript-eslint` and dependency overrides for `ejs`, `js-yaml`,
  `postcss`, and `brace-expansion` to clear newly published high-severity
  development-tooling advisories.
- Updated `markdownlint-cli2` and `sharp` to clear newly published
  high-severity vulnerabilities in their transitive dependencies.
- Updated security dependencies to remove all high-severity npm audit findings.
  Backend bumped to `2.2.1`; root bumped to `2.5.12`.
- Accessibility E2E scans now wait for the asynchronously loaded stylesheet
  before checking contrast, avoiding false positives from browser-default
  button styles.
- Sentry now drops native browser fetch timeout and cancellation messages
  (`signal timed out` and `The user aborted a request.`) at `beforeSend`.
  These originate from the app's 10-second `AbortSignal.timeout` and browser
  navigation/unload, not application exceptions. Web bumped to `3.3.7`; root
  to `2.5.11`.
- Sentry now drops the three cross-browser fetch transport rejections at
  `beforeSend` - `Failed to fetch` (Chrome / Edge),
  `NetworkError when attempting to fetch resource.` (Firefox), and `Load failed`
  (Safari). These come from disconnected clients (offline mobile, captive
  portals, dropped cell signal), not application bugs; views like
  `category-detail.ts` that catch fetch errors and call
  `Sentry.captureException` were flooding the dashboard with user-connectivity
  noise. Web bumped to `3.3.6`; root to `2.5.10`.

### Changed
- Refreshed `package-lock.json` to clear all 8 outstanding `npm audit`
  advisories (2 high + 6 moderate). `npm update` re-resolved
  `fast-uri` to `3.1.2` (via `@modelcontextprotocol/sdk` -> `ajv@8.20.0`) and
  `@babel/plugin-transform-modules-systemjs` to `7.29.7` (via
  `vite-plugin-pwa` -> `workbox-build@7.4.1` -> `@babel/preset-env@7.29.7`);
  follow-on `npm audit fix` cleared the remaining moderates (`qs`, `ws`,
  `hono`, `brace-expansion`, `ip-address`, `express-rate-limit`). Lockfile-only
  change; no `package.json` edits. Root bumped to `2.5.9`.

### Fixed
- `isFetchTransportError` now treats `DOMException` with name `TimeoutError`
  (and `AbortError`) as a transport error, so `fetchSuggestions` no longer
  forwards stalled autocomplete requests to Sentry after the 10-second
  `AbortSignal.timeout` fires. Also accepts `DOMException` directly because
  jsdom and some older runtimes don't extend `Error`. Web bumped to `3.3.5`;
  root to `2.5.8`.
- API fetches now abort after 10 seconds via `AbortSignal.timeout`, so a stalled
  backend fails fast instead of letting Firefox hang for ~60 s. Voting and
  submission timeouts surface as "The request timed out. Please try again."
  rather than the generic network error. Web bumped to `3.3.4`; root to `2.5.7`.
- Law-list cards now use the same elevated card shadow, border, and row padding
  scale as other archive cards, so Browse widgets no longer look visually flatter
  than neighboring card surfaces. Web bumped to `3.3.3`; root to `2.5.4`.
- Forced PostCSS resolution to `8.5.12` so Vite and Stylelint no longer pull in
  the vulnerable `postcss <8.5.10` dev-tooling copy flagged by `npm audit`.
  Root bumped to `2.5.3`.

### Added
- Growth follow-up surfaces for the archive: new internal-link modules connect
  laws, categories, calculators, hubs, and examples; calculators now use stable
  shareable state helpers, scenario links, and FAQ structured data; submissions
  now show good-law examples, duplicate candidates, and post-submit next steps;
  new SEO hubs cover best laws, funny laws, work, technology, and Murphy's Law
  vs. Sod's Law; examples now have work, travel, technology, and everyday-life
  subpages; daily-law distribution links expose RSS/Atom and the Law of the Day
  API; and backend API additions expose duplicate checks and related categories
  for discovery loops. Backend bumped to `2.2.0`; web bumped to `3.3.0`; iOS
  app bumped to `1.2.0` / build `16`; Android app bumped to `1.2.0` /
  versionCode `7`; root to `2.5.0`.
- Optional dead-man-switch ping in `backend/scripts/health-monitor.sh`. The script now sources `/etc/default/health-monitor` (root-owned, mode 600, never committed) and pings `HEALTHCHECKS_PING_URL` after every successful health check, including the post-restart recovery path. With nothing configured the script behaves identically, so dev environments are unaffected. This closes the structural gap where the on-box health monitor cannot alert when the box itself (or its Postfix relay) is dead: Healthchecks.io alarms when pings stop arriving. Setup procedure and alert-ladder semantics documented in [shared/docs/SERVER_MAINTENANCE.md](shared/docs/SERVER_MAINTENANCE.md). Backend bumped to `2.1.1`; root to `2.4.37`.
- Work Sans variable font bundled in the Android app for visual parity with web. [android/app/src/main/res/font/work_sans_variable.ttf](android/app/src/main/res/font/work_sans_variable.ttf) (~360 KB, single VF covers all weights via the `wght` axis), wrapped by a hand-authored `WorkSans` `FontFamily` in [android/app/src/main/java/com/murphyslaws/ui/theme/WorkSans.kt](android/app/src/main/java/com/murphyslaws/ui/theme/WorkSans.kt). The FontFamily registers the variable font at four weight slots (Normal 400, Medium 500, SemiBold 600, Bold 700) with `FontVariation.Settings(FontVariation.weight(...))` so Compose's typography system resolves `.weight(...)` requests to the correct axis position. Requires API 26+, which matches the app's `minSdk`. [shared/design-tokens/export-android-tokens.ts](shared/design-tokens/export-android-tokens.ts) now emits `fontFamily = WorkSans` for every `DS.Typography.<level>`, replacing the `FontFamily.Default` (Roboto) placeholder from PR Android-1. PR Android-3 (final phase) of the design-tokens-mobile rollout. Bundling a new font is user-visible, so Android app bumped MINOR to `1.1.0` / versionCode `4`; root to `2.4.23`.

### Changed
- Android now targets SDK 37, uses the latest Gradle, Kotlin, Compose, Hilt,
  Navigation, serialization, and test dependencies, and keeps resource
  packaging excludes aligned with the shipped license files. Android app
  bumped to `1.2.2` / versionCode `9`; root to `2.5.6`.
- Documented that law-list card widgets share the elevated section-card surface
  while keeping flush bodies for full-width row dividers. Root bumped to `2.5.5`.
- Web card surfaces now use a canonical card shell and variant class system
  across section widgets, law-list widgets, category cards, content pages,
  empty states, and law detail runtime/SSG output. Legacy class names remain as
  compatibility aliases while the CSS now scopes list, content, section, empty,
  and category card behavior through explicit variants. Web bumped to `3.3.2`;
  root to `2.5.2`.
- Web archive UI polish now formats homepage proof points and Daily Law
  distribution links as design-system chips, removes the extra Trending /
  Recently Added wrapper heading, aligns law-list card dividers with other
  cards, shows a fallback when related laws are empty, shortens the technology
  hub intro to avoid clipping, and falls back to readable calculator formulas
  when MathJax is unavailable. Web bumped to `3.3.1`; iOS app bumped to
  `1.2.1` / build `17`; Android app bumped to `1.2.1` / versionCode `8`;
  root to `2.5.1`.
- Web site audit surfaces now render useful static content for core internal
  routes, including homepage, developers, favorites, submit, calculators,
  categories, and law detail pages. The archive experience now has richer law
  detail context, grouped category hubs, stronger origin/examples content,
  canonical calculator structured data, and privacy-safe product metrics.
  Web bumped to `3.2.13`; iOS app bumped to `1.1.11` / build `15`;
  Android app bumped to `1.1.2` / versionCode `6`; root to `2.4.38`.
- iOS law cards now keep footer controls aligned and include a share action in
  the vote row instead of a category pill. iOS app bumped to `1.1.10` / build
  `14`; root to `2.4.36`.
- iOS submit-law category selection now uses the same category row treatment as
  browsing and filters. iOS app bumped to `1.1.7` / build `11`; root to
  `2.4.33`.
- iOS category browsing and filter selection now use consistent list rows instead
  of mixed grid and form layouts. iOS app bumped to `1.1.5` / build `9`;
  root to `2.4.31`.
- iOS cleanup removes Codex-generated documentation artifacts, moves law integration
  coverage into the unit test target, and updates SwiftUI change handlers for iOS 17.
  iOS app bumped to `1.1.4` / build `8`; root to `2.4.30`.
- Web, iOS, and Android now share the same design-system tokens for social brand colors,
  risk colors, tooltip colors, links, surfaces, spacing, radii, and typography. Remaining
  non-token values are documented in `web/DESIGN.md` as platform or asset exceptions.
- Design-token tests now live alongside the moved tooling in `shared/design-tokens/` and run through the root `design:check` command.
- Design-token tooling moved from `web/scripts/` to `shared/design-tokens/`, with root-level `npm run design:*` commands as the single cross-platform command surface. `web/package.json` no longer exposes duplicate design-token scripts. Root bumped to `2.4.24`.
- Backend, CLI, MCP, and SDK CI now run on pull requests and `main` pushes only, avoiding duplicate `test` jobs when a feature branch with an open PR is updated.
- Android screens now consume `DS.Color.*` for vote thumbs and markdown link colour: vote-up `Color(0xFF10b981)` -> `DS.Color.success`, vote-down `Color(0xFFef4444)` -> `DS.Color.error` across [SearchScreen.kt](android/app/src/main/java/com/murphyslaws/presentation/search/SearchScreen.kt), [LawDetailScreen.kt](android/app/src/main/java/com/murphyslaws/presentation/lawdetail/LawDetailScreen.kt), [HomeScreen.kt](android/app/src/main/java/com/murphyslaws/presentation/home/HomeScreen.kt), [LawListCard.kt](android/app/src/main/java/com/murphyslaws/presentation/components/LawListCard.kt); markdown links now use `DS.Color.btnPrimaryBg` in light mode and `DS.Color.darkLink` in dark mode via [MarkdownParser.kt](android/app/src/main/java/com/murphyslaws/util/MarkdownParser.kt); RiskLevel LOW/HIGH `Color.Green` / `Color.Red` -> `DS.Color.success` / `DS.Color.error` in [RiskLevel.kt](android/app/src/main/java/com/murphyslaws/domain/model/RiskLevel.kt). RiskLevel MEDIUM stays as `Color(0xFFFFA500)` with a comment because no DS token matches the bright friendly orange affordance (DESIGN.md's `orange-text` is the dark-brown calculator-pair foreground, not a chip indicator). Third-party brand colours for the social-share icons (X, Facebook, LinkedIn, Reddit, Email) intentionally stay inline; they aren't part of the Murphy's Laws design system. PR Android-2 of the design-tokens-mobile rollout. Android app bumped to `1.0.2` / versionCode `3`; root to `2.4.22`.

### Added
- Android design-token codegen. New [shared/design-tokens/export-android-tokens.ts](shared/design-tokens/export-android-tokens.ts) (wired as `npm run design:export:android`) reads `shared/DESIGN.md` and emits `Tokens.kt`, day/night `ds_*` color resources, and spacing/radius dimens for Android consumers. Generated outputs stay gitignored and are produced by the `exportDesignTokens` Gradle task before `preBuild`; Android app bumped to `1.0.1` / versionCode `2`; root to `2.4.21`.

### Changed
- Android CI now runs on pull requests and `main` pushes only, avoiding duplicate `build-and-test` jobs when a feature branch with an open PR is updated.
- Android theme now consumes generated DS tokens for Material color and typography slots, replacing the drifted hand-maintained `Color.kt` constants and the previous `Roboto for now` typography placeholder.
- Web CI now runs on pull requests and `main` pushes only, avoiding duplicate `test-and-build` and `e2e-tests` jobs when a feature branch with an open PR is updated. Root bumped to `2.4.20`.
- iOS CI now runs on pull requests and `main` pushes only, avoiding duplicate macOS jobs when a feature branch with an open PR is updated. Root bumped to `2.4.18`.
- iOS skeleton-loading shimmer now consumes `DS.Color.mutedFg` (light + dark from the Asset Catalog) instead of hand-branching on `@Environment(\.colorScheme)` with hardcoded `Color(white:)` greys. [ios/MurphysLaws/Views/Home/SkeletonViews.swift](ios/MurphysLaws/Views/Home/SkeletonViews.swift). The dark-mode swap is now driven by the system trait collection via `Assets.xcassets/DS/muted-fg.colorset`, matching how every other DS color works. PR iOS-2 of the design-tokens-mobile rollout; calculator and vote-thumb surfaces are explicitly out of scope (HIG-idiomatic semantic colors `.green` / `.orange` / `.red` are correct on iOS), and no rank-style surface exists on iOS to migrate yet. iOS app bumped to `1.0.2` / build `3`; root to `2.4.17`.

### Fixed
- Autocomplete suggestions no longer report transient mobile fetch failures to
  Sentry while still failing quietly for users. Web bumped to `3.2.14`; root to
  `2.4.39`.
- iOS skeleton loading placeholders now hide their source shapes under the
  shimmer overlay while preserving circular and rounded silhouettes, preventing
  content bleed during loading states. iOS app bumped to `1.1.9` / build `13`;
  root to `2.4.35`.
- iOS navigation UI tests now wait for category row content on the Categories
  tab, matching the new list layout used by the app. iOS app bumped to `1.1.6`
  / build `10`; root to `2.4.32`.
- iOS CI test builds now compile after the cleanup branch by keeping
  generated Xcode project references in sync and aligning integration tests
  with Swift concurrency isolation.
- Pre-commit now enforces required root, package, iOS, and Android version bumps
  for staged release-bearing changes so ship metadata cannot be missed. Root bumped to `2.4.29`.
- `shared/docs/SERVER_MAINTENANCE.md` corrected to match the live `murphys-main` server: the
  `sudo -i pm2 list` recipe (which fails because pm2 lives in root's nvm and is not on sudo's
  PATH) is replaced with a working `sudo bash -c "exec $(...)"` invocation that resolves the
  binary via glob and survives node version upgrades; the pre-update DB-backup step now calls
  the actual script `/usr/local/bin/backup-murphys.sh` (the doc had a non-existent `-db`
  variant) and references the real DB path `/root/murphys-laws/backend/murphys.db` instead of
  a guessed `/var/lib/...`; OS string bumped to Ubuntu 24.04.4 LTS; "Automated Security
  Updates" section reframed from "install and enable" to "audit existing config" since
  `unattended-upgrades` 2.9.1 is already installed and configured (which is why kernel
  packages auto-install but `Reboot Required` periodically lights up). Root bumped to `2.4.28`.
- Nested iOS project configuration now points `INFOPLIST_FILE` at the app plist
  path that exists relative to that project root.
- iOS test plan wiring now lives in `project.yml`, so XcodeGen regeneration in CI
  preserves the shared scheme's test-discovery settings.
- iOS test discovery stabilized with an explicit test plan
  (`MurphysLaws.xctestplan`) wired into the shared scheme, disabling
  parallel execution so Xcode discovers tests reliably in CI and locally.
- iOS filter-chip removal UI test now uses stable accessibility identifiers for
  the browse filter button and chip remove action.
- iOS navigation UI tests now wait on stable SwiftUI accessibility identifiers for
  filters, submit form fields, and category law rows, reducing CI timing flakiness.
- iOS shared content loading now falls back to top-level bundled resources, matching
  how XcodeGen copies `shared/content` into the app bundle for CI tests.
- iOS navigation UI tests now pass the launch argument the app actually checks for,
  enabling UI test setup during launches.
- iOS deep links now parse the host-based URLs emitted by `DeepLinkBuilder`, and
  `DeepLinkHandler` is injected above `ContentView` so deep-link handling boots at runtime.
- iOS UI tests no longer compile a duplicate app entry point from the UI test
  bundle, avoiding missing app-service symbols in CI.
- iOS README now describes the project as CC0 public-domain content instead of using
  copyright wording.
- iOS project cleanup now uses XcodeGen as the source of truth, removes stale root-level
  Swift duplicates, bundles shared content once, and places app support files in the app
  target so the generated project builds again. iOS app bumped to `1.1.3` / build `7`;
  root to `2.4.27`.
- iOS CI now builds against a generic simulator and selects an available
  iPhone simulator for tests, avoiding failures when the runner image does not
  include a hardcoded simulator name. Simulator selection now extracts the UUID
  field so device names with parentheses do not break the destination.
- iOS category color buckets are distinct again, restoring separate visual
  treatment for slug hash buckets 3 and 6; submit loading now uses a stable
  black scrim in dark mode instead of brightening the page with adaptive
  foreground color. iOS app bumped to `1.1.2` / build `6`; root to `2.4.26`.
- iOS XcodeGen now compiles `MarkdownContentTests.swift` with the unit test target instead of the UI test bundle, avoiding linker failures from `@testable import MurphysLaws` references to app-only content-loading symbols.
- [ios/MurphysLawsTests/CategoryRepositoryTests.swift](ios/MurphysLawsTests/CategoryRepositoryTests.swift) now module-qualifies the remaining explicit `Category` type annotations so the repository tests compile when the Objective-C runtime's `Category` typedef is also visible.
- [ios/MurphysLawsTests/CategoryRepositoryTests.swift](ios/MurphysLawsTests/CategoryRepositoryTests.swift) helper `deduplicateByTitle` now uses module-qualified `MurphysLaws.Category` for its parameter, return, and local types so the file compiles in the test bundle. The C typedef `typedef struct objc_category *Category` from the Objective-C runtime is visible to test files via `@testable import MurphysLaws` (the runtime import is implicit), creating an ambiguous type lookup that production files don't see because `MurphysLaws.Category` wins ambient resolution inside its own module. The previously committed (hand-edited) `project.pbxproj` had silently dropped this file from the test target to dodge the error; once `xcodegen generate` rebuilds the project from `project.yml` the file is included again, surfacing the latent breakage. Call sites elsewhere in the file (`Category(id: ...)` initializers) disambiguate via initializer signature and don't need the qualifier. Credit: P1 surfaced by Codex review on this PR.
- iOS CI now regenerates the Xcode project via XcodeGen before `xcodebuild`. The committed [ios/MurphysLaws.xcodeproj/project.pbxproj](ios/MurphysLaws.xcodeproj/project.pbxproj) doesn't list the freshly-regenerated `DesignSystem/Tokens.swift` as a source, so `xcodebuild` skipped it and the build failed with `cannot find 'DS' in scope` even after the regen step succeeded. Workflow now installs XcodeGen via `brew install xcodegen` and runs `xcodegen generate` after the design-token regen, rebuilding `project.pbxproj` from `project.yml` so every file under `MurphysLaws/` (including the gitignored generated outputs) is picked up. Drops the now-redundant `if [ -f project.pbxproj ]` gate and the `Skip` branch since the project is always regenerated. Credit: P1 flagged by Codex review on this PR.
- [ios/project.yml](ios/project.yml) cleaned up so XcodeGen runs cleanly: dropped the `info:` block whose `properties:` regenerated `Info.plist` from YAML on every `xcodegen generate` (clobbering the hand-edited `CFBundleShortVersionString` / `CFBundleVersion`), and added a `**/Info.plist` glob exclude on the `MurphysLaws/` source scan. The glob (vs a bare `Info.plist`) is required because there's also a stray scaffolded plist at [ios/MurphysLaws/Repositories/Info.plist](ios/MurphysLaws/Repositories/Info.plist) (likely leftover from an earlier framework-style structure) that XcodeGen would otherwise pick up as a second Copy Bundle Resources entry, surfacing the same `Multiple commands produce ... MurphysLaws.app/Info.plist` build error the bare-name fix was meant to avoid. The hand-authored [ios/MurphysLaws/Info.plist](ios/MurphysLaws/Info.plist) is now the single source of truth, consumed via the existing `INFOPLIST_FILE` setting. Verified locally: regen no longer touches `Info.plist`, version numbers stay at the values the ship skill set, and the regenerated `project.pbxproj` lists both `DesignSystem/Tokens.swift` and `SkeletonViews.swift` as sources with zero references to the stray `Repositories/Info.plist`.
- iOS and Android CI workflows ([.github/workflows/ios-ci.yml](.github/workflows/ios-ci.yml), [.github/workflows/android-ci.yml](.github/workflows/android-ci.yml)) now install Node and run `npm ci` before the platform build so the gitignored design-token outputs (`Tokens.swift` / `Tokens.kt` / colorsets / `colors.xml` / `dimens.xml`) regenerate from `shared/DESIGN.md`. Without this, the iOS build of this PR (the first to reference `DS.Color.*` from app code) failed with `cannot find 'DS' in scope`; the same trap waits for Android in PR Android-1. iOS workflow gains an explicit `Regenerate iOS design tokens` step (`npm run design:export:ios`) before `xcodebuild`; Android relies on the existing `exportDesignTokens` Gradle task wired into `preBuild`, which now finds `npm` on PATH. Path filters expanded to also trigger on `shared/DESIGN.md` and `web/scripts/export-{ios,android}-tokens.ts` so generator changes get validated against the platform builds. Closes the gap exposed when PR iOS-1 (#92) merged with the gitignored-outputs model but before any Swift code consumed `DS`.

### Added
- Work Sans variable font bundled in the iOS app for visual parity with web. [ios/MurphysLaws/Resources/Fonts/WorkSans-VariableFont_wght.ttf](ios/MurphysLaws/Resources/Fonts/WorkSans-VariableFont_wght.ttf) (~360 KB, single VF covers all weights via the `wght` axis), registered via `UIAppFonts` in [Info.plist](ios/MurphysLaws/Info.plist), and shipped through the XcodeGen-managed source tree. [shared/design-tokens/export-ios-tokens.ts](shared/design-tokens/export-ios-tokens.ts) now emits `Font.custom("WorkSans-Regular", size:).weight(...)` for every `DS.Typography.<level>` so SwiftUI picks up the bundled font by its PostScript name. Resolves the placeholder `Font.system(size:)` from PR iOS-1. PR iOS-3 of the design-tokens-mobile rollout. Bundling a new font is a user-visible change, so iOS app bumped MINOR to `1.1.0` / build `4`; root to `2.4.19`.
- iOS design-token codegen. New [shared/design-tokens/export-ios-tokens.ts](shared/design-tokens/export-ios-tokens.ts) (wired as `npm run design:export:ios`) reads `shared/DESIGN.md` and emits a SwiftUI `DS` namespace at `ios/MurphysLaws/DesignSystem/Tokens.swift` plus a per-token Asset Catalog folder at `ios/MurphysLaws/Assets.xcassets/DS/`. The `DS` namespace exposes `DS.Color.*` (Asset Catalog references for system-managed dark-mode pairing), `DS.Spacing.s1..s16`, `DS.Radius.sm..full`, and `DS.Typography.<level>` with pre-computed additive `lineSpacing` (since SwiftUI's `lineSpacing` is additive while CSS `line-height` is a multiplier). Asymmetric web/dark pairings are explicitly mapped via `DARK_PAIR_OVERRIDES`: `bg`->`dark-bg-primary`, `fg`->`dark-fg-primary`, `success-text`->`dark-success-fg` (and the parallel `error/warning/orange-text`->`dark-*-fg`), plus `dark-bg`->`dark-dark-bg` and `dark-text`->`dark-dark-fg` for the calc-dark "dark emphasis" surface. The skip rule for `dark-`-prefixed tokens lets override keys through, and the `darkOnly` pass guards against double-emission, so `DS.Color.darkBg` adapts to dark mode just like every other paired colour. Dark-mode-stable tokens (`white`, `success`, `error`, `important`, gradients) skip pairing per the `NO_DARK_PAIR` set. **Generated outputs are gitignored**: `ios/MurphysLaws/DesignSystem/` and `ios/MurphysLaws/Assets.xcassets/DS/` are produced fresh by [ios/generate-xcode-project.sh](ios/generate-xcode-project.sh) before `xcodegen generate`, and on demand via `npm run design:export:ios`. There's no committed baseline to drift from, which is why `--check` is a smoke test (verify the generator runs, returns non-empty `Tokens.swift` and at least one colorset) rather than a diff comparison. Typography uses `Font.system` placeholders until Work Sans is bundled (deferred; PR iOS-3). 26 vitest cases. iOS app bumped to `1.0.1` / build `2`; root to `2.4.17`. `web/package.json` not bumped (per ship skill: `web/scripts/` tooling that emits to other platforms is not a user-facing web change).

### Fixed
- Pre-commit drift guard no longer auto-stages WIP Markdown body edits on `web/DESIGN.md` or `shared/DESIGN.md`. [shared/design-tokens/sync-design-tokens.ts](shared/design-tokens/sync-design-tokens.ts) gains a `--hook` mode that refuses to run (and fails the commit with a helpful error) if either output has unstaged changes in the working tree. Without the guard, a developer editing the DESIGN.md body and a variables.css token in parallel would have the body edits silently carried through on commit via `extractBody()` + `git add`. The guard is hook-only; `npm run design:sync` still works unconditionally. Credit: flagged by Codex review on [#86](https://github.com/ravidorr/murphys-laws/pull/86). 5 new vitest cases.
- Pre-commit hook no longer races on `web/styles/partials/variables.css`. The broader `web/styles/**/*.css` glob in [.lintstagedrc.json](.lintstagedrc.json) is scoped down to `web/styles/**/!(variables).css` so it doesn't match variables.css, and variables.css's task array now runs stylelint -> sync -> git add sequentially in a single ordered pipeline. Previously both globs matched variables.css and lint-staged ran them concurrently; sync could read pre-stylelint-fix CSS. Current output was still correct (stylelint auto-fixes don't change variable values, and the sync's `normalizeHex` neutralises shorthand / casing differences) but the race was a latent footgun for any future change to either tool. Credit: flagged by Codex review on [#86](https://github.com/ravidorr/murphys-laws/pull/86).

### Added
- Cross-platform token mirror at [shared/DESIGN.md](shared/DESIGN.md). [shared/design-tokens/sync-design-tokens.ts](shared/design-tokens/sync-design-tokens.ts) now regenerates `shared/DESIGN.md` in lockstep with `web/DESIGN.md`; the shared file carries identical YAML front matter (52 colors, 9 typography scales, 5 rounding levels, 10 spacing tokens, 21 components) but strips the web-specific Markdown body (elevation story, Stitch workflow, component contracts tuned for vanilla-TS). iOS (`ios/`) and Android (`android/`) consumers can read the same token catalogue the web uses without depending on web prose. `npm run design:check` and the pre-commit `lint-staged` hook both validate/regenerate the mirror alongside `web/DESIGN.md`, so edits to `variables.css` are single-source-of-truth. 7 new vitest cases cover `buildSharedDesignMd` plus the dual-output behaviour of `run`.

### Added
- `npm run design:export` emits the DESIGN.md token catalogue as a [Design Tokens Community Group (DTCG)](https://tr.designtokens.org/format/) JSON document at `web/.design-exports/design-tokens.dtcg.json` (gitignored). Designers can import the file into Figma Variables (via Tokens Studio or Figma's native JSON import) or feed it into Style Dictionary / any DTCG-aware pipeline without hand-translating `web/DESIGN.md`'s YAML. Output reuses the `parseCssVariables` + `classifyTokens` pipeline from [shared/design-tokens/sync-design-tokens.ts](shared/design-tokens/sync-design-tokens.ts), so the export can never drift from what `design:check` publishes. Nested shape: `color.*`, `dimension.spacing.*`, `dimension.radius.*`, `typography.*` (composite tokens), `component.*` (references into the base tokens). The export is intentionally NOT in `ci:web`; `design:check` remains the server-side gate. 22 new vitest cases cover the build / reference rewriting / type inference / run-mode behaviour.

### Added
- Five more chrome components in the `COMPONENTS` contract driven by [shared/design-tokens/sync-design-tokens.ts](shared/design-tokens/sync-design-tokens.ts): `notification`, `header`, `footer`, `breadcrumb`, `search-autocomplete`. These are the pieces AI agents most often regenerate without consulting the design contract, so pinning them as explicit token references in `web/DESIGN.md`'s YAML front matter makes the contract binding on those surfaces too. Component count 16 -> 21; ignored-warning count 35 -> 34 (`muted-fg` is now referenced by `footer` / `breadcrumb` so it drops out of the unreferenced bucket). Translucent backgrounds on `header` and floating surfaces remain intentionally untokenized (see "Elevation & Depth" in the Markdown body) because DESIGN.md requires literal `#HEX`. One new vitest case asserts presence of each new component.

### Added
- `web/DESIGN.md`: adopted Google Labs' [DESIGN.md](https://github.com/google-labs-code/design.md) format as the web's design-system contract. YAML front matter (52 colors, 9 typography levels, 5 rounding tokens, 10 spacing tokens, 15 components) is regenerated from `web/styles/partials/variables.css` by `shared/design-tokens/sync-design-tokens.ts`; the Markdown body is authored (tone, a11y posture, elevation, shapes, workflow). New `npm run design:check` in `web/` runs drift detection plus `@google/design.md lint` and is wired into `ci:web`; WCAG-AA contrast failures are promoted from warnings to errors so sub-threshold pairs fail the build. Stitch-generated mockups live in `web/.stitch/` (gitignored) and are never shipped. Adds 35 vitest cases and pins `@google/design.md@0.1.1` as a web devDependency.

### Added
- A11y focus trap on the PWA install prompt ([web/src/components/install-prompt.ts](web/src/components/install-prompt.ts)). Opening either variant (generic / iOS) now moves keyboard focus to the primary CTA on the next paint, traps Tab / Shift+Tab inside the dialog, dismisses on Escape (via the existing `data-action="dismiss"` path so the 7-day cooldown still applies), and restores focus to the previously-focused element on close. Both variants gain `aria-modal="true"` to match the newly-enforced modal behavior. The document-level keydown listener tears down on `hideInstallPrompt` and `_resetForTesting`, so no listener leaks between sessions. 17 new vitest cases; no change to the 76 pre-existing install-prompt tests. Closes the a11y gap called out in the Stitch dogfood write-up.
- `rank` component contract in `web/DESIGN.md` (and matching entry in the `COMPONENTS` constant in [shared/design-tokens/sync-design-tokens.ts](shared/design-tokens/sync-design-tokens.ts)) so the `text-high-contrast` token, used by `.rank` numerals on top-voted / trending / recently-added lists via [web/styles/partials/utilities.css](web/styles/partials/utilities.css), is no longer flagged as unreferenced by `@google/design.md lint`. Component count 15 -> 16; ignored-warning count 36 -> 35. `dark-text-high-contrast` stays in the ignored bucket; paired `dark-*` tokens are theme-swapped via `theme.css` rather than referenced by component contracts, consistent with the rest of the dark-mode palette.
- Pre-commit drift guard in [.lintstagedrc.json](.lintstagedrc.json): staging `web/styles/partials/variables.css` now runs `tsx shared/design-tokens/sync-design-tokens.ts` and auto-stages the regenerated `web/DESIGN.md`. CI's `design:check` is still the server-side gate; this is a client-side nudge that saves a round-trip.

### Changed
- PWA install prompt (`web/src/components/install-prompt.ts` + `web/styles/partials/install-prompt.css`) redesigned, first Stitch dogfood: primary `Install` / `Got it` is now a full-width filled row, secondary `Not now` (generic only) is a bordered button, and `Never show again` is a text-only tertiary. Adds a tinted icon plate behind the app icon. Microcopy shifted on-brand ("Preserve the documentation of inevitable failure for offline consultation." and "Add this archive to your home screen for immediate reference."). Behavior, `data-action` contract, `role="dialog"` / aria wiring, and the `install-prompt-visible` enter animation are unchanged; all 76 existing install-prompt tests still pass without edits. Dogfood write-up appended to `web/DESIGN.md` under `## Workflow`.
- Android toolchain bumped: Android Gradle Plugin `9.1.1` -> `9.2.0` and Gradle wrapper `9.3.1` -> `9.4.1`. Keeps the Android build on current toolchain releases; no app code changes.

### Fixed
- Resolved two high-severity `npm audit` advisories via `npm audit fix`: `@xmldom/xmldom` `0.9.9` -> `0.9.10` and `speech-rule-engine` `4.1.3` -> `4.1.4` (both transitive via MathJax). Unblocks the pre-push audit hook; no consumer code changes.

### Added
- GitHub Actions workflow `.github/workflows/mcp-registry-publish.yml` that re-publishes `com.murphys-laws/murphys-laws` to the MCP Registry whenever `mcp/server.json` changes on `main` (or via manual `workflow_dispatch`). Guardrails: reads the version out of `server.json`, verifies the referenced `murphys-laws-mcp@<version>` actually exists on npm (otherwise aborts), installs `mcp-publisher`, authenticates via DNS using a new `MCP_PUBLISHER_PRIVATE_KEY` repo secret, publishes, and verifies the live registry entry by filtering the search response for an exact `server.name` match (not `servers[0]`, since search ordering is not guaranteed). Key rotation instructions in `mcp/README.md`.

### Fixed
- `mcp-registry-publish.yml` is now idempotent: the registry rejects duplicate-version publishes with a 400 error, so a `workflow_dispatch` or path-trigger re-run with no version change used to fail. New pre-flight step queries the registry for the current version and skips the publish (and auth/install) steps when `server.json`'s version is already live. Verification always runs, so a green workflow always means "registry matches server.json" - whether we just published or the state was already correct.

### Fixed
- `mcp/server.json` description trimmed from 140 chars to 79 so it passes the MCP Registry's `description <= 100` validation. The old longer description on `mcp/package.json` is unchanged (npm has no such limit). The MCP Registry now lists `com.murphys-laws/murphys-laws@1.2.1` and resolves to `npm:murphys-laws-mcp@1.2.1`.

### Changed
- `murphys-laws-mcp` bumped to `1.2.1`: corrected `mcpName` (and the matching `name` in `mcp/server.json`) from `murphys-laws.com/murphys-laws` to the reverse-DNS form `com.murphys-laws/murphys-laws` required by the [MCP Registry naming rules](https://modelcontextprotocol.io/registry/authentication). The old value was malformed - neither a `io.github.*` nor a reverse-DNS `com.*` namespace - which is why the initial registry submission never actually landed (registry search still returns 0 hits). The npm package, stdio behavior, and 7 tool surface are otherwise unchanged.
- `mcp/server.json` pinned both its own `version` and the bundled npm `packages[0].version` to `1.2.1` so registry publish (once credentials are set up) reflects the current artifact on npm.
- `.gitignore` now excludes `.config/`. That directory holds local-only MCP Registry signing keys (Ed25519 private key, DNS-based auth); it must never enter git.

### Added
- `sdk/README.md` and `cli/README.md` gained "Cookbook" sections with real usage patterns (pagination, cron posters, jq pipelines, discriminated-union submit handling, injected `fetch` for tests, custom User-Agents, running against a local backend, exit-code-driven shell logic).
- All three published package READMEs (`sdk/`, `cli/`, `mcp/`) now carry CI status and coverage badges in addition to npm version / downloads / license.

### Changed
- `murphys-laws-mcp` bumped to `1.2.0`: each of the 7 tool files now calls the SDK's typed methods (`api.searchLaws`, `api.getRandomLaw`, etc.) instead of the low-level `api.get`/`api.post` with hand-rolled response interfaces. Net `-109` lines across `mcp/src/`; the biggest win is `submit-law.ts` which delegates category-slug resolution and discriminated-union error handling to the SDK. No behavior change for AI hosts using the server; the 7 tool names, descriptions, and output formatting are identical.

### Fixed
- `npm audit` no longer reports the two moderate advisories that had been nagging every push: `dompurify` bumped `3.3.3 -> 3.4.0` (transitive via `jspdf` in web) and `hono` bumped `4.12.12 -> 4.12.14` (transitive via `@modelcontextprotocol/sdk` in mcp). Resolved cleanly with `npm audit fix`; no consumer code changes. All 3105 tests still pass.
- `npm run lint:md` now ignores the gitignored `CLAUDE.md`, `.cursor/**`, and `.claude/**` paths. These local-only config files don't exist on a fresh clone but were producing noisy errors whenever a contributor had them present locally. CI was never affected - this just quiets local `npm run lint:md` output.
- `cli-ci.yml` and `mcp-ci.yml` now build the SDK before running typecheck / lint / tests. `murphys-laws-sdk`'s `main` points at `dist/index.js`, and `npm ci` alone doesn't build workspace members, so consumers couldn't resolve the module on a fresh runner.

### Added
- GitHub Actions workflows `sdk-ci.yml`, `cli-ci.yml`, and `mcp-ci.yml` so SDK/CLI/MCP now run typecheck + lint + test (95% coverage) + build on every push/PR that touches them. CLI and MCP workflows also trigger on `sdk/**` changes so SDK-breaking refactors are caught in consumer packages. `mcp-ci.yml` additionally runs a stdio handshake smoke test that boots the server and asserts `tools/list` returns 7 tools.
- Vitest suite for `murphys-laws-mcp`: 48 tests across `format.ts`, each of the 7 tool registrations (with mocked SDK client), and `server.ts` wiring. 100% coverage. `mcp/` also gains an ESLint config mirroring the other workspaces.
- `murphys-laws-sdk` (`sdk/`) package: typed TypeScript client over the public REST API, zero runtime deps. Ships typed methods for all `/api/v1/*` endpoints plus a discriminated `SubmitLawResult` union. Published at `0.1.0`.
- `murphys-laws-cli` (`cli/`) package: command-line wrapper around the API (`murphy search`, `random`, `today`, `get`, `categories`, `category`, `submit`). Supports `--json`, `--no-color`, `--base-url`, `--user-agent`. Exit codes document success (0), not-found (1), usage error (2), rate-limited (3), network error (4). Published at `0.1.0`.
- Write endpoints now emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` response headers on both success and 429 responses so clients can back off proactively.
- `shared/docs/API.md` gained a versioning & stability section (`/api/v1/` is stable, breaking changes ship under `/api/v2/`, deprecations via `Deprecation`/`Sunset` headers) and User-Agent guidance.
- `/developers` page now documents the SDK, CLI, current per-minute write rate limits, and the new `X-RateLimit-*` headers.
- MCP (Model Context Protocol) server (`mcp/`) with 7 tools for AI agent integration: `search_laws`, `get_random_law`, `get_law_of_the_day`, `get_law`, `list_categories`, `get_laws_by_category`, `submit_law`
- MCP server published to npm as `murphys-laws-mcp` - install with `npx murphys-laws-mcp` (no clone needed)
- MCP server submitted to the [MCP Registry](https://registry.modelcontextprotocol.io) for discovery by AI hosts
- `/developers` page on the website with REST API docs, MCP setup, feeds, and machine-readable resources
- `llms-full.txt` with detailed API docs, example responses, all 55 category slugs, and MCP setup instructions
- MCP section in `llms.txt` linking to full reference and listing available tools

### Changed
- `murphys-laws-mcp` bumped to `1.1.2`: added dev-only vitest + eslint deps and config for the new test suite. Build output (`dist/`) unchanged; published runtime behavior unchanged. Also split `tsconfig.build.json` from `tsconfig.json` so tests compile under the same strict TS settings without getting shipped in the tarball.
- `murphys-laws-mcp` bumped to `1.1.1`: removed the backwards-compatible `api-client.ts` shim; all tools now import `MurphysLawsClient` and `ApiError` directly from `murphys-laws-sdk`. MCP handshake `serverInfo.version` now reads from `package.json` at runtime so it stays in sync on every bump (previously hard-coded to `1.0.0`). Outgoing API calls send `User-Agent: murphys-laws-mcp/<version>`.
- Root `README.md` gained a discoverability table with live npm version badges for the SDK, CLI, and MCP packages. Each sub-package README also carries npm version/downloads/license shields.
- `murphys-laws-mcp` bumped to `1.1.0`: now consumes the new `murphys-laws-sdk`. Behavior unchanged; the local `api-client.ts` remains as a backwards-compatible shim that delegates to the SDK and will be removed in the next minor.
- Root `package.json` workspaces now include `sdk` and `cli`; CI/test/lint scripts gained `ci:sdk`, `ci:cli`, `test:sdk`, `test:cli`, `lint:sdk`, `lint:cli` entries with the same 95% coverage gate as the other workspaces.
- Rate limits documented on `/developers` and in `shared/docs/API.md` now match the code (3 submissions/min, 30 votes/min) instead of the stale per-hour numbers.
- Clean up iOS `.gitignore`: replace the scoped `xcuserdata` entries with the idiomatic `**/xcuserdata/` pattern, narrow the blanket `project.xcworkspace/xcshareddata/` rule to `**/IDEWorkspaceChecks.plist` (so legitimate shared workspace settings stay tracked), and `git rm --cached` the two previously-tracked `UserInterfaceState.xcuserstate` files so they stop producing diffs every time Xcode is opened. The ignore rule added in the AGP bump PR was not enough on its own because the files were already tracked.
- Refine the `ship` skill: only bump a sub-package's version (`web/`, `backend/`, `mcp/`) when code inside that sub-package actually changed. The root `package.json` still bumps on every ship (drives the Sentry release tag); sub-package bumps are gated on actual diffs so Sentry sub-package releases stop corresponding to zero-change ships.
- Bump Android Gradle Plugin from `9.1.0` to `9.1.1` (patch update); add `ios/*.xcodeproj/project.xcworkspace/xcuserdata/` to `.gitignore` so Xcode's per-user IDE state stops showing up as a diff
- MCP server rewritten to use the public REST API instead of direct SQLite access, making it fully standalone and publishable to npm
- Track `.claude/` project config in git (`settings.json`, `launch.json`, `skills/`); exclude ephemeral paths (`worktrees/`, `settings.local.json`, `memory/`)
- Add `ship` skill: step-by-step end-of-change workflow (version bump, CHANGELOG, rebase, commit, push, PR)

### Fixed
- Suppress Sentry noise from Android WebView JS-to-Java bridge teardown (`Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone`). Fired on `beforeunload` inside the Facebook in-app browser when its injected keyboard-logging bridge's Java object has already been GC'd. Not our code, not actionable. Pattern `/Java object is gone/i` also covers equivalent teardown races in other Android in-app browsers.
- Fix jsdom 28 ESM breakage: added `html-encoding-sniffer` override to 4.0.0 (the `@exodus/bytes` transitive dep is ESM-only, breaking vitest's jsdom environment)
- Fix flaky rate-limit test: replaced `vi.advanceTimersByTime` (hung due to module-level `setInterval`) with `vi.setSystemTime`; added `afterEach` cleanup
- Fix high-severity `serialize-javascript` vulnerability (GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v): upgraded `vite-plugin-pwa` to `^1.0.0` (adds vite@7 support, removes need for `legacy-peer-deps`), added npm `overrides` to force `serialize-javascript@7.0.5` throughout the tree
- Drop Sentry noise from GA gtag beacon failures: "Non-Error promise rejection captured with value: undefined" has no stack trace and is not actionable - added to the ignore list
- Suppress Sentry noise from `window.webkit.messageHandlers` TypeError thrown by Google FundingChoices/AdSense scripts probing for iOS native WebView in the Facebook in-app browser
- Fix duplicate Sentry captures for unhandled rejections: remove manual `captureException` from the `unhandledrejection` handler since Sentry's SDK already auto-captures these; also suppress the error banner when `event.reason` is null/undefined
- Drop Sentry errors originating in third-party ad scripts (googlesyndication.com, doubleclick.net, googleadservices.com) via Sentry `denyUrls`; these are AdSense bugs outside our control
- Suppress false "Something went wrong" error banner for DuckDuckGo Mobile users - WebKit throws a `SecurityError` DOMException with message `invalid origin` when blocking service worker registration; suppression now scoped to `SecurityError` only so unrelated origin/CORS errors still surface to users
- Bump brace-expansion, nodemailer, picomatch via `npm audit fix` (moderate vulnerabilities)
- Remove redundant app tarball from backup script (code is in git); fix .env backup path from `APP_DIR/.env` to `APP_DIR/backend/.env`

### Changed
- Add CLAUDE.md to .gitignore; add .claude/settings.json with acceptEdits mode and command allowlist

## [2.1.1] - 2026-03-21

### Fixed
- Service worker `navigateFallbackDenylist` now excludes root-level `.txt`, `.xml`, `.json`, `.rss`, `.atom` files so `/llms.txt`, `/robots.txt`, `/openapi.json`, and sitemaps are served as-is instead of returning `index.html`
- Add unit tests (`sw-denylist.test.ts`) validating the denylist regex against static files, API routes, and SPA routes; removed misleading e2e tests that bypassed the SW entirely
- Bump version to 2.1.1

## [2.1.0] - 2026-03-21

### Added
- `llms.txt` for AI agent discovery
- OpenAPI spec (`backend/src/openapi.ts`) auto-generated to `web/public/openapi.json` at build time via new `build:openapi` script
- `GET /api/v1/laws/random` endpoint returns a random published law
- `GET /api/v1/openapi.json` endpoint serves the spec dynamically
- `Link: rel="describedby"` header on all API JSON responses pointing to the OpenAPI spec
- JSON-LD structured data (`Article` + `Quotation` schema) injected into law detail pages for better agent/search engine understanding
- `web/public/openapi.json` added to `.gitignore` (generated by CI, not committed)

### Changed
- `robots.txt`: disallow `/api/` for generic crawlers; explicitly allow `/api/` for known AI agent bots (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.)
- `npm run build` now includes `build:openapi` step
- Bump version to 2.1.0

## [2.0.59] - 2026-03-03

### Fixed
- Fix CI branch coverage gap: annotate platform-specific `truncateText` while loop in `og-image.service.ts` (canvas text measurement returns 0 on Linux headless); annotate unreachable `?? null` fallbacks in `http-helpers.ts`; annotate defensive `??`/`?.` on `req.url`/`req.headers` in `attributions.controller.ts`; add tests for `searchSubmitters` with missing/invalid `q` and `limit` params
- Versions: bump root to 2.0.59, backend to 2.0.14, web to 3.1.33

## [2.0.58] - 2026-03-02

### Changed
- Raise web branch coverage threshold from 92% to 95%; annotate unreachable branches with `/* v8 ignore start/stop */` in `advanced-search.ts`, `law-detail.ts`, `social-share.ts`, `mathjax.ts`, `buttered-toast-calculator.ts`, `sods-calculator.ts`, `category-detail.ts`
- Raise backend branch coverage threshold from 93% to 95%; annotate unreachable setInterval callback and env-var fallback defaults in `rate-limit.ts` and `api-server.ts`
- Add coverage test files: `browse-coverage.test.ts`, `buttered-toast-calculator.test.ts`, `favorites-view.test.ts`, `footer-coverage.test.ts`, `home-coverage.test.ts`, `law-detail-coverage.test.ts`, `mathjax.test.ts`, `social-share.test.ts`
- Fix CI branch coverage gap: annotate platform-specific `truncateText` while loop in `og-image.service.ts` (canvas text measurement returns 0 on Linux headless); annotate unreachable `?? null` in `http-helpers.ts`; annotate defensive `??`/`?.` on `req.url`/`req.headers` in `attributions.controller.ts`; add tests for `searchSubmitters` with missing/invalid `q` and `limit` params
- Versions: bump root to 2.0.58, backend to 2.0.13, web to 3.1.32

## [2.0.57] - 2026-02-28

### Changed
- Backend: strip Markdown escape backslashes (e.g. \=, \+, \*, \!, \-, \.) from law text and titles to ensure clean data for all consumers (Web, Android, iOS). Added migration 014 and updated `build-sqlite.ts` importer with stripping logic and `ON CONFLICT DO UPDATE` support.
- Web: upgrade vite-plugin-pwa to ^1.2.0 to resolve Vite 7 peer dependency conflict.
- Security: added root override for `serialize-javascript` to fix high-severity vulnerabilities.
- Versions: bump root to 2.0.57, backend to 2.0.12, web to 3.1.31.

## [2.0.56] - 2026-02-28

### Fixed
- Web: vote buttons (Upvote, Downvote) sometimes did not respond when clicking the button icon or count; clicks were handled only when the event target was the button element. Handlers now use `closest('button[data-vote]')` so clicks on inner elements trigger voting consistently. Bump root to 2.0.56, web to 3.1.30.

## [2.0.55] - 2026-02-28

### Fixed
- Web: pagination buttons (Browse and Category detail) sometimes did not respond when clicking the button label or icon; clicks were handled only when the event target was the button element. Handlers now use `closest('button[data-page]')` so clicks on inner elements (e.g. `.btn-text`, icon) trigger page navigation consistently. Bump root to 2.0.55, web to 3.1.29.

## [2.0.51] - 2025-02-27

### Removed
- docs/print-ads-debug-console-script.js (one-off production DOM inspection script; print ad selectors are stable, script no longer needed)

## [Unreleased]

### Fixed
- Web: do not show "Something went wrong" banner for known Service Worker transient errors (update/registration failures); still report to Sentry. Add isServiceWorkerTransientError in error-handler with tests; README documents banner vs Sentry. Bump root to 2.0.44, web to 3.1.18.
- PWA: exclude 404.html from service worker precache so install does not fail when server returns 404 for GET /404.html (avoids "Something went wrong" banner from bad-precaching-response). Browse view: catch render/loadPage rejections and harden loadPage error-path so unhandled rejections do not trigger error banner. Sentry: ignore bad-precaching-response. Bump root to 2.0.39, web to 3.1.13.
- Remove law-of-day API preload from index.html to avoid console warning "preloaded but not used within a few seconds" (preload was only consumed on home after SPA boot; on other routes it was never used). Bump root to 2.0.40, web to 3.1.14.
- PWA: handle registration.update() promise rejection (InvalidStateError in Firefox when SW registration is stale). Extract scheduleServiceWorkerUpdateCheck to utils and add unit tests. Bump root to 2.0.41, web to 3.1.15.
- Sentry: ignore InvalidStateError "object is not, or is no longer, usable" (stale SW registration; code already handles via .catch). Bump root to 2.0.42, web to 3.1.16.
- PWA install prompt: safe localStorage get/set helpers to avoid SecurityError in insecure contexts (Safari). Sentry: only ignore browser extension errors; remove SW/SDK/module patterns so we don't hide app errors. README: note only extension errors filtered. Bump root to 2.0.43, web to 3.1.17.

### Changed
- Web: law detail show only one of "Sent by" or "Submitted by" (no duplication); bookmark icon viewBox 0 0 24 24 so size matches vote icons; add test for attribution/submitted dedup. Bump root to 2.0.47, web to 3.1.21.
- Web: favorite button in its own vote-group (border matches up/down); bookmark icon viewBox -24 -24 72 72; tests for viewBox and vote-group wrapper; TODO bookmark not heart. Bump root to 2.0.46, web to 3.1.20.
- Web: hide footer ad shell until ad load is triggered (footer in view or user interaction); no empty "Advertisement" placeholder until then. Observe footer for intersection; add test and README. Bump root to 2.0.45, web to 3.1.19.
- Vote tooltip: single combined tooltip on vote-group ("Upvote or downvote. Votes are anonymous; no login required."); remove per-button tooltips so they do not hide each other; bump root to 2.0.38, web to 3.1.12
- Print: hide all ads in print with broader selectors ([id*="google_ads"], div:has(> iframe) for ad iframe wrappers)
- Ad display: hideAds only on NotFound route; footer-ad-shell hidden when hideAds or insufficient content; print hides .footer-ad-shell, ins, .adsbygoogle, [data-ad-slot] so side-rail ads hidden; bump root to 2.0.37, web to 3.1.11
- Vote UX: move "Votes are anonymous; no login required." to tooltip on vote-group; use data-tooltip on up/down vote buttons (Law of the Day, law detail, law cards); remove .vote-hint; bump root to 2.0.36, web to 3.1.10
- AdSense: scope footer ad CSS to .footer-ad-shell so Google-injected side-rail ads do not get width: 100% and block clicks on main content; bump root to 2.0.35, web to 3.1.9
- Law detail: when law has no title, show "Murphy's Law" with "Murphy's" in accent-text instead of plain "Law"; bump root to 2.0.34, web to 3.1.8
- Favorite: bookmark-with-star icon (outline/filled) instead of heart; vote-group container for up/down buttons; law card title h3.section-title; backend/api fixes; bump root to 2.0.33, web to 3.1.7
- Share: all options (Copy link, X, Email, Facebook, etc.) in popover for cleaner UI; remove always-visible top row; bump root to 2.0.32, web to 3.1.6
- Breadcrumb: single separator before each item after Home (remove duplicate separator after Home); bump root to 2.0.31, web to 3.1.5
- Home: Science of Murphy's Law section is a plain section (always visible); removed details/summary and related CSS; bump root to 2.0.30, web to 3.1.4
- Deploy workflow: install Rollup Linux native binary after npm ci (same fix as backend/web CI); bump root to 2.0.29
- Web CI: install Rollup Linux native binary after npm ci (same fix as backend); bump root to 2.0.28
- Backend CI: install Rollup Linux native binary after npm ci to fix optional deps bug on ubuntu-latest; bump root to 2.0.27
- npm audit fix (lockfile)
- Remove all v8 ignore comments from web and backend (coverage now counts previously excluded branches); backend branch threshold 95% -> 93%, web branch threshold 93% -> 92% after excluded code no longer ignored; bump root to 2.0.26, web to 3.1.3
- Web: use local html-validate disable for typeahead listbox instead of turning prefer-native-element off globally
- Expert UX review fixes: privacy (no contact_value/mailto in API or UI), Submitted By typeahead, PWA prompt once per session after user action with Never show again, download menu on calculators, share URL normalization and copy-link toast, ad gutter, clickable law cards, pagination hint, favorites empty state copy, Sod's Law calculator percentage format; bump root to 2.0.25, backend to 2.0.11, web to 3.1.2
- Web: branch coverage tests across components and views; mathjax test uses setLoaderForTesting to avoid vi.doMock stderr; uncovered-branches.md regenerated from lcov; bump web to 3.1.1

### Added
- QA teardown: SSG pre-render first page of laws on Browse and Category detail pages; retry buttons on all error states (browse, category, home, law-detail); noscript fallback in index.html; URL-addressable filters and pagination on browse and category; share popover (top channels visible, rest in popover); random law navigation on law detail; category tag chips and deep links on cards and law detail; category display-name overrides for editorial consistency; submission flow improvements (email help text, honeypot, success copy); origin story tl;dr and source notes; user-visible error boundary and Sentry context for unhandled errors; lazy-load jsPDF for PDF export
- Pre-commit: run backend tests with coverage (same as CI) so coverage threshold failures are caught locally
- Backend: SpaController and HtmlInjectionService tests; http-helpers and html-injection branch coverage tests to meet 95% threshold
- Server-side HTML injection for /law/:id and /category/:slug (AdSense first-paint content): HtmlInjectionService, SpaController, getCategoryBySlug; nginx proxies those paths to backend; initial response includes law/category title and description in main, with title and meta description in head
- Category pages: expanded descriptions (migration 013) to 2-4 sentences of unique copy per category; category detail view shows full description in a prominent intro section with "About the laws in this category" heading (AdSense / strengthen category pages)
- Law detail pages: "In context" editorial block with category-specific copy to add substantial content per page (AdSense / thin-content); backend returns category_slug and category_name with single-law API; law-context-copy utility and tests
- Categories table: law_context column and migration 012 with per-category "In context" copy; single-law API returns category_context from primary category; frontend uses API value with default fallback
- Backup script in repo: `backend/scripts/backup-murphys.sh` (excludes backend/web node_modules to reduce backup size); deployed to `/usr/local/bin` via deploy and CI
- Backend: tests and coverage for 95% plan (api-server, router, email, database, facebook-signed-request, http-helpers, og-image, feed, laws service/controller; vitest thresholds 95%)

## [2.0.54] - 2025-02-27

### Fixed
- Web: My Favorites showed "1 law saved" but not the law content when a favorite was saved with empty title/text (e.g. from card click before fix). Global favorite handler now extracts title and text from `.law-card-text a`; law-detail related-law handler does the same. Favorites view fetches law from API when stored favorite has no text and re-renders with enriched data. Bump root to 2.0.54, web to 3.1.28.

## [2.0.53] - 2025-02-27

### Changed
- Web: footer ad shell placeholder has no size until ad loads; when ad is displayed it uses its own size. README AdSense visibility note updated. Bump root to 2.0.53, web to 3.1.27.

## [2.0.52] - 2025-02-27

### Changed
- Root `npm run test` now runs all tests (backend unit, web unit, web E2E). Use `npm run test:backend`, `npm run test:web`, or `npm run test:web:e2e` for subsets. README, DEPENDENCY_MAJOR_UPGRADES, GEMINI, MOBILE-REPOSITORY-STRUCTURE docs updated. Bump root to 2.0.52, web to 3.1.26.

### Fixed
- Law detail: prevent law title/quote truncation (overflow-wrap, min-width); In context same card style as Related Laws; increase law context text line-height
- Backup: apply 30-day retention to env_*backup files (find now matches murphys_* and env_*); bump backend to 2.0.10
- Backend: add test for isRunAsMain() true branch so branch coverage meets 95% threshold
- Backend: add getLaw tests for category_context (law_context set vs empty) so branch coverage meets 95% in CI
- Backend CI: avoid Sentry/git in test step (global Sentry mock in Vitest setup, SENTRY_DSN unset in workflow)
- Web: filter Sentry noise "feature named `performanceMetrics` was not found" (Sentry SDK/third-party, not app code); extract ignore patterns to `sentry-ignore-patterns.ts` and add tests
- Web: PWA install prompt no longer throws SecurityError in insecure contexts; guard localStorage getItem/setItem in try/catch (HTTP, file://, cross-origin iframes)

### Changed
- Trailing slash: standardize to no trailing slash (SSG, router, law URLs); router normalizes URL on load; www to non-www redirect in _redirects; bump web to 3.1.0
- Home: declutter (Browse CTA elevated, Science section in collapsible details); voting tooltips and "anonymous, no login" copy; form errors and success use ARIA live regions
- Home: remove hero section (h1 + tagline) from SPA and SSG; bump web to 3.0.21
- Articles: refreshed long-form copy and titles – "Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)" and "Project Management vs. The Universe: A Survival Guide"; home links and view meta updated; bump root to 2.0.23, web to 3.0.20
- Comment style in browse and category-detail: use hyphen instead of em-dash
- Browse view: set document.title and meta description on load (AdSense per-page metadata)
- Breadcrumb: use text separator (›) between items for reliable visibility; category detail description: vertical margin and horizontal padding for spacing
- Category detail: merge intro into laws card; description appears in card header before search info; remove redundant category-intro-card and its CSS; add test for description order
- Category detail: breadcrumb shows chevron separators between all items; category intro moved into a card below Advanced Search with category name as card title and H1
- Document markdownlint-cli2 .mjs exception (tool does not support .ts config) in `.markdownlint-cli2.mjs` and docs/DEPENDENCY_MAJOR_UPGRADES.md; bump root to 2.0.18
- Backend: convert six remaining scripts to TypeScript (log-manager, export-law-updates, select-law-of-day, review-laws, show-recent-updates, deploy); root deploy uses npx tsx; deploy runs from repo root and syncs vite.config.ts; bump backend to 2.0.9
- Backend: convert five DB scripts to TypeScript (build-sqlite, migrate, migration-safety-check, generate-add-laws-migration, generate-populate-categories-migration); parse-attributions test imports from build-sqlite.ts; remove build-sqlite.d.mts; bump backend to 2.0.8
- Backend: convert five infra scripts to TypeScript (validate-node-version, cleanup-ports, validate-ports, sanitize-husky-hooks, health-check); root and backend package.json use tsx; bump backend to 2.0.7
- Backend: move parse-attributions test from web to backend (parse-attributions.test.ts), assert parseAttributions from build-sqlite; bump backend to 2.0.6
- Web: convert all five scripts to TypeScript (sanitize-husky-hooks, check-coverage, uncovered-branches-from-lcov, optimize-images, ssg); add scripts to tsconfig; husky and root use npx tsx; bump web to 3.0.19, add tsx to root devDependencies
- Backend + web: convert ESLint configs to TypeScript (eslint.config.ts, eslint.config.test.ts); add jiti for .ts config loading; bump backend to 2.0.5, web to 3.0.18
- Web: convert vite.config.js to TypeScript (vite.config.ts); bump web to 3.0.17
- Bump root 2.0.14, backend 2.0.4, web 3.0.16
- Web: branch coverage tests (export-menu, install-prompt, law-of-day, not-found, browse, structured-data) and uncovered-branches checklist

## [2.0.50] - 2025-02-27

### Changed
- Run web E2E tests (Playwright) on pre-commit and in web-ci workflow; skip pre-commit E2E with SKIP_E2E_CHECK=1. Bump minimatch override to 10.2.4 (npm audit). Bump root to 2.0.50, web to 3.1.24.

## [2.0.49] - 2025-02-27

### Fixed
- PWA: use `navigateFallback: '/index.html'` instead of `/offline.html` so direct navigation to SPA routes (e.g. `/favorites`) serves the app shell and the router runs; offline page remains for actual offline/catch handling only. E2E: add SPA fallback test; path-based URLs and combobox locator for search; Playwright config as plain object to avoid ESM resolution with `"type": "module"`. Search autocomplete: set `role="combobox"` for axe aria-allowed-attr; advanced-search attribution input gets combobox role. Bump root to 2.0.49, web to 3.1.23.

## [2.0.48] - 2025-02-26

### Changed
- Web: favorite button uses the same filled bookmark icon for both add and remove states (previously outline for add, filled for remove); state indicated by .favorited class and tooltip only. Bump root to 2.0.48, web to 3.1.22.

## [2.0.10] - 2026-02-21

### Fixed
- Web build: Sentry Vite plugin no longer throws "Cannot read properties of undefined (reading 'ignore')" by only enabling the plugin when SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are all set, and by passing explicit `include: ['./dist']`
- Deploy: add diagnostics (set -e, echo markers, trap) and safer .env heredoc delimiter; remove duplicate nginx block

### Changed
- CI: use fetch-depth: 0 on checkout in backend-ci and web-ci to avoid git exit 128 when tools need full history
- Bump root 2.0.10, backend 2.0.3, web 3.0.14

## [2.0.9] - 2026-02-21

### Changed
- Bump root 2.0.9, backend 2.0.2, web 3.0.13
- CI: attach `cause` to wrapped errors (backend email.service, scripts); fix web indentation and TypeScript (submit-law, search-autocomplete, navigation, install-prompt); deploy checkout fetch-depth: 0
- Pre-commit: run typecheck and lint (backend + web) before tests; add SKIP_CI_CHECK=1 bypass
- Root: add npm run ci, ci:backend, ci:web to match CI locally

### Fixed
- Web: pin typescript-eslint to 8.56.0 and add overrides for ESLint 10 compatibility (scopeManager.addGlobals); bump web to 3.0.10
- Web: ensure dist HTML passes html-validate (aria-labels on header/main, remove redundant role=main, trim SSG output to avoid trailing whitespace)

### Changed
- Bump to 2.0.7; npm audit fix --force (downgrade @sentry/node to 9.20, add typescript-eslint)
- Audit fixes: upgrade vite-plugin-pwa to 1.2.0 (critical ejs/json-schema); upgrade @sentry/node to 9.47.1; add root overrides for minimatch 10.2.1 and regenerate lockfile (fixes all 14 high). Pre-push blocks on high/critical. 10 moderate (ajv in eslint stack) remain with no non-breaking fix. Remove unused @sentry/node from web deps.

### Added
- CI and pre-push guardrails: typecheck and lint in web/backend CI; backend coverage thresholds (vitest.config.ts); npm audit in CI and pre-push; commit-msg hook (min length); lint-staged includes TypeScript; HTML validation step in web CI
- Backend: IOgImageLawService.getLaw return type allows undefined for LawService compatibility

### Changed
- Home: move "The Science of Murphy's Law" section below "Submit a Law"

## [2.0.10] - 2026-02-20

### Changed
- Web: upgrade ESLint `no-explicit-any` from warn to error (all `any` eliminated); allow `!= null` in `eqeqeq` rule for idiomatic null/undefined checks
- Web: fix `export.ts` to use `Category.title` (API field) instead of legacy `Category.name` for PDF, CSV, Markdown, and plain text exports
- Web: add JSDoc to `Category` interface marking `name` as `@deprecated` in favor of `title`

## [2.0.9] - 2026-02-19

### Changed
- Web: enable full `strict: true` TypeScript -- remove `noImplicitAny: false`, `strictNullChecks: false`, and `useUnknownInCatchVariables: false` overrides from `tsconfig.json`
- Web: fix 97 `noImplicitAny` errors across 10 source files (typed `Object.keys()` casts for calculator `for...in` loops, `ExportData` union narrowing via type assertions, MathJax ambient module declaration, `Record<string, unknown>` for dynamic index access)
- Web: fix 1 `useUnknownInCatchVariables` error (`instanceof Error` narrowing in `law-of-day.ts`)

## [2.0.8] - 2026-02-19

### Changed
- Web: fix 182 `strictNullChecks` errors across 23 source files (prep for enabling `strictNullChecks: true`)
- Web: add null guards for `querySelector` results, `getAttribute` returns, `dataset` properties, and regex capture groups
- Web: type all `[]` array initializations explicitly to avoid `never[]` inference under strict null checks
- Web: add `?? ''` fallbacks for `noUncheckedIndexedAccess` on record/array lookups (`button.ts`, `icons.ts`, `theme.ts`, `router.ts`)
- Web: null-safe calculator slider access with runtime validation and type narrowing across 4 calculator files

## [2.0.7] - 2026-02-19

### Changed
- Web: eliminate all remaining `any` usage in source (`as any` casts, `: any` annotations, `Promise<any>` returns)
- Web: add explicit parameter and return types to all exported functions (prep for `noImplicitAny: true`)
- Web: extract shared `copy-actions.ts` and `navigation.ts` utilities, reducing ~60 lines of duplicate event handling across views
- Web: improve type safety in `export-context.ts` (literal union for `ContentType`, `ExportData` union type), `category-cache.ts` (typed `JSON.parse`), `error-handler.ts` (generic `withRetry<T>`, `safeAsync<T>`), and `submit-law.ts` (`SubmitLawPayload` interface)
- Web: fix `global.d.ts` MathJax typing, `HTMLSelectElement` cast, unused variable warning in `main.ts`

## [2.0.6] - 2026-02-19

### Added
- Branch coverage tests: header ExportMenu cleanup, trending/browse/voting/home/categories cleanup and copy-text, structured-data setCategoryItemListSchema
- Branch coverage checklist in `web/uncovered-branches.md`; process and format rules in `web/uncovered-branches-agent.md`

### Changed
- Web coverage branch threshold set to 88%; use `web/uncovered-branches.md` and `web/uncovered-branches-agent.md` to work through uncovered branches

## [2.0.5] - 2026-02-19

### Fixed
- Web tests: use `globalThis` instead of `global` for DOM/browser type compatibility; type callback mocks (`onUpdate`, `onDismiss`, `updateSW`, `preventDefault`) with `Mock<() => void>` for Vitest 4

## [2.0.4] - 2026-02-19

### Added
- Pre-commit: fail when CHANGELOG.md is not staged and there are other staged changes (SKIP_CHANGELOG_CHECK=1 to bypass)

### Changed
- CHANGELOG history filled from git commit log (2.0.2, 2.6.1 entries and compare links)

## [2.0.3] - 2026-02-19

### Fixed
- Lint and type fixes: MathJax `Window` type (`Record<string, unknown>`), debounce generic args, unused imports/vars
- CSS: added standard `line-clamp` alongside `-webkit-line-clamp` for compatibility (components.css, sections.css)
- Documentation: CHANGELOG, TODO, web README (file references), coverage thresholds (96% functions, 95.5% branches)
- Pre-commit: require CHANGELOG.md staged when there are other staged changes

## [2.0.2] - 2026-02-19

### Changed
- Backend runs TypeScript source via tsx in PM2 (no JS build step)
- Complete TypeScript migration for backend and shared modules

### Fixed
- Deploy: run backend via local tsx CLI in PM2
- CI: repair deploy SSG imports and workspace trigger paths
- CI: remove darwin-only root dependencies
- Lockfile and workflow alignment to .nvmrc

## [2.6.1] - 2026-02-05

### Added
- Monthly peak resource usage report in daily status email

### Changed
- Theme toggle icons and home page content (Murphy's Law description in section-subheader, intro consolidated into single card)
- Content depth enhancements across key pages (Google Ads policy compliance review)

### Fixed
- Theme toggle icons not rendering correctly
- Sentry: filter browser extension internal messaging, ServiceWorker registration/update, and transient errors
- Sentry: stop reporting AdSense load failures, GA script errors, module import failures
- Service worker InvalidStateError handling
- Localhost fallback URL removed (production errors)
- Dynamic import failures handled gracefully
- Page title bottom padding, redundant categories description removed
- H1 alignment and heading hierarchy standardized
- Calculator slider readonly state in accessibility tree

## [2.6.0] - 2026-01-30

### Added
- Spacing scale CSS variables (`--space-1` through `--space-16`)
- Typography scale CSS variables (`--text-xs` through `--text-5xl`, line heights, font weights)
- High-contrast mode support (`@media (prefers-contrast: more)` and `data-contrast="more"`)
- Tooltip on disabled submit button with accessibility fix for hover on disabled elements
- Icon button borders in high-contrast mode (vote, favorite, theme, download buttons)
- Design System documentation in web README
- CHANGELOG.md following Keep a Changelog format
- Pre-commit reminder for changelog updates

### Changed
- Category cards now have uniform 120px height with text truncation
- Standardized placeholder text across all search inputs to "Search laws..."

### Fixed
- Tooltips now work on disabled buttons (added `pointer-events: auto`)
- Disabled button styling uses color instead of opacity to preserve tooltip visibility

## [1.0.7] - 2026-01-30

### Added
- Inline share buttons for calculator pages (replacing dropdown)
- Markdown linter with emoji and em-dash rules

### Fixed
- iOS CI updated to use iPhone 16 simulator for Xcode 16.4

## [1.0.6] - 2026-01-30

### Changed
- Markdown linter now enforces no-emoji and no-em-dash rules

## [1.0.5] - 2026-01-30

### Added
- Markdown linter with auto-fix support for documentation consistency

## [2.5.8] - 2026-01-29

### Added
- Favorite button on Law of the Day widget
- Advanced Search and sort controls on category pages
- Examples link in footer navigation
- Voice search support and comprehensive SEO improvements
- FAQ structured data on calculator pages

### Changed
- Calculator share buttons redesigned to match law share popover style
- Card structure standardized with header/body/footer pattern
- Form control heights standardized to match buttons (44px)
- Origin Story and Examples links moved to header dropdown menu

### Fixed
- Filled heart icon now shows on page load for favorited laws
- SVG click handling on favorites page
- Empty state shows after unfavoriting last law
- Slider value contrast in dark mode for WCAG AA compliance
- Sticky header positioning
- PWA install prompt dark mode and hover contrast

## [2.4.1] - 2026-01-29

### Added
- PWA support with offline caching, install prompt, and auto-updates
- Structured data fixes and FAQ schema for SEO

### Fixed
- Structured data URLs aligned with sitemap for SEO consistency

## [2.4.0] - 2026-01-27

### Added
- Progressive Web App (PWA) with offline support
- Custom install prompt with engagement-based triggers
- Service worker with smart caching strategies
- iOS Safari "Add to Home Screen" instructions

## [2.3.0] - 2026-01-26

### Added
- Universal page export (PDF, CSV, Markdown, Plain Text)
- Sentry error tracking integration
- Dynamic Open Graph images for per-law social sharing
- Schema versioning for localStorage cache

### Changed
- Export menu renamed to "Download" for clarity

### Fixed
- Navigation prevented when clicking buttons inside law cards
- SSG pagination now fetches all laws from API
- Law URLs have trailing slash to prevent circular redirects

## [2.2.0] - 2026-01-25

### Added
- User Favorites/Bookmarks with localStorage persistence
- Unified tooltip system across components
- Card-based layout for favorites page

### Fixed
- Horizontal scroll from tooltips prevented

## [2.1.0] - 2026-01-24

### Added
- Browse Laws by Category page with responsive grid
- Reusable button component with consistent icon placement
- Descriptions for all 55 categories
- Related laws API endpoint
- Unified loading states component

### Changed
- SubmitLawSection improved accessibility with required indicators

### Fixed
- Category descriptions for 9 categories with production slug mismatches
- Law Not Found page redesigned

## [2.0.0] - 2026-01-23

### Added
- Search autocomplete with debounced suggestions
- RSS and Atom feed support (`/api/v1/feed.rss`, `/api/v1/feed.atom`)
- Print-optimized CSS for law pages
- Keyboard shortcuts with help modal (press `?`)
- Manual dark mode toggle (auto/light/dark)
- WhatsApp share button

### Changed
- Share buttons unified with popover menu design

### Fixed
- Share dropdown clipping by section-card overflow
- Keyboard help modal reopening behavior

## [1.5.0] - 2026-01-21

### Added
- Tooltip on theme toggle button

### Fixed
- Keyboard modal and theme tooltip interactions

## [1.4.0] - 2025-12-15

### Added
- Android app with Kotlin and Jetpack Compose
- Material 3 UI matching web design
- Sod's Law Calculator in Android app
- More screen with markdown content support
- Pagination support in Android app

### Changed
- Android UI redesigned to match iOS and web
- Vote functionality with full test coverage
- Search functionality with icon-based results

## [1.3.0] - 2025-11-15

### Added
- iOS app with SwiftUI
- Skeleton loading views
- Enhanced launch screen
- Comprehensive iOS UI tests

### Changed
- iOS app loads content from shared markdown files
- Configuration management system added

### Fixed
- Various iOS compilation and compatibility issues
- Voting synchronization and UI updates

## [1.2.0] - 2025-11-07

### Added
- Monorepo structure for iOS and Android apps
- Shared legal content in markdown files
- Automated monorepo migration script

### Changed
- Project restructured as npm workspace
- Deployment configuration updated for monorepo

## [1.1.0] - 2025-11-01

### Added
- API versioning (`/api/v1/`)
- Comprehensive mobile app documentation
- Branch coverage tests achieving >95%

### Changed
- Enhanced markdown content handling

## [1.0.0] - 2025-10-20

### Added
- Law of the Day feature with daily rotation
- Social sharing functionality (X, Facebook, LinkedIn, Reddit, Email)
- Open Graph tags for social sharing
- Daily status report emails
- Breadcrumb navigation on detail pages
- Template system for content pages
- Buttered Toast Calculator with test coverage
- Advanced search component for filtering laws
- Category selection in law submission

### Changed
- Calculator styles consolidated
- Voting architecture refactored
- Law list widgets improved
- Sod's Law email template centralized

### Fixed
- Daily report formatting and accuracy
- Law text quote handling in database

## [0.9.0] - 2025-10-10

### Added
- Health check script for monitoring
- Google Analytics integration
- Performance optimizations (preconnect, deferred CSS)
- Local SVG icons (replaced Font Awesome)
- Daily rotating Law of the Day

### Changed
- Accessibility improvements for 100/100 score
- Dark mode contrast fixes

### Fixed
- Layout shifts (CLS) improvements
- Footer layout shift fix

## [0.8.0] - 2025-10-01

### Added
- Stitch-style Law of the Day widget
- Material Symbols for voting buttons
- Pagination with First/Prev/Next/Last and ellipses
- Enhanced browsing with search functionality
- Voting functionality for laws
- Law submission endpoint

### Changed
- Header branding to "Murphy's Law of the Day"
- Hero section moved to main layout

## [0.7.0] - 2025-09-30

### Added
- Warp terminal session documentation
- E2E tests with Playwright
- API server in Playwright webServer

## [0.6.0] - 2025-09-08

### Added
- Enhanced navigation in tests and UI
- Build before preview script

## [0.5.0] - 2025-08-10

### Added
- Favicons and site manifest
- Dark mode styles
- MathJax integration for formulas

### Changed
- SQL schema updated (removed language parameter)
- Blockquote formatting improved

## [0.4.0] - 2025-08-08

### Added
- API integration for Home and LawDetail views
- Vitest setup with jsdom and coverage
- Playwright E2E tests
- Husky pre-commit hooks
- ESLint and Stylelint configuration

### Changed
- Migrated from React/TSX to vanilla JavaScript
- CSS refactored to utility classes
- Folder aliases added (`@folders`)

### Fixed
- Footer link contrast in dark mode

## [0.3.0] - 2025-08-08

### Added
- Vite-based Murphy's Laws site
- Calculator view with MathJax
- Browse view with pagination
- Unit tests foundation

### Removed
- React/TSX components
- Inline CSS (replaced with utility classes)

## [0.2.0] - 2025-08-07

### Added
- New Murphy's Laws sections
- TODO tracking (moved to GitHub Wiki)

### Removed
- Outdated Murphy's Laws files (moved to backup)
- .DS_Store files from repository

## [0.1.0] - 2025-07-12

### Added
- Initial project structure
- Murphy's Laws content database
- Basic file organization

[Unreleased]: https://github.com/ravidorr/murphys-laws/compare/v2.0.57...HEAD
[2.0.57]: https://github.com/ravidorr/murphys-laws/compare/v2.0.56...v2.0.57
[2.0.56]: https://github.com/ravidorr/murphys-laws/compare/v2.0.55...v2.0.56
[2.0.55]: https://github.com/ravidorr/murphys-laws/compare/v2.0.54...v2.0.55
[2.0.54]: https://github.com/ravidorr/murphys-laws/compare/v2.0.53...v2.0.54
[2.0.53]: https://github.com/ravidorr/murphys-laws/compare/v2.0.52...v2.0.53
[2.0.52]: https://github.com/ravidorr/murphys-laws/compare/v2.0.51...v2.0.52
[2.0.51]: https://github.com/ravidorr/murphys-laws/compare/v2.0.10...v2.0.51
[2.0.10]: https://github.com/ravidorr/murphys-laws/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/ravidorr/murphys-laws/compare/v2.0.8...v2.0.9
[2.0.8]: https://github.com/ravidorr/murphys-laws/compare/v2.0.7...v2.0.8
[2.0.7]: https://github.com/ravidorr/murphys-laws/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/ravidorr/murphys-laws/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/ravidorr/murphys-laws/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/ravidorr/murphys-laws/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/ravidorr/murphys-laws/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/ravidorr/murphys-laws/compare/v2.6.1...v2.0.2
[2.6.1]: https://github.com/ravidorr/murphys-laws/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/ravidorr/murphys-laws/compare/v1.0.7...v2.6.0
[1.0.7]: https://github.com/ravidorr/murphys-laws/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/ravidorr/murphys-laws/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/ravidorr/murphys-laws/releases/tag/v1.0.5
