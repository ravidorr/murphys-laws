---
name: triage-404s
description: >
  Triage the HTTP 404 list from the Murphy's Laws Daily Status Report (the report emailed by the
  server's daily-report cron). Use this skill when the user pastes, or attaches a screenshot of, that
  report's 404 section, or says "these are the 404s I got in the daily report" or "triage the 404s". It
  analyzes every path, decides one verdict per path (already handled, image to notify about, ignore,
  redirect, block as scanner, fix link or create content, or needs a human), opens a draft PR for the
  clear-cut ones, and reports the rest. Do not use it for a 404 seen while developing locally.
---

# Triage 404s - murphys-laws

Input: the 404 rows of the daily report, as pasted text or a screenshot. Each row is a path and
usually a count, sometimes an IP and user agent. Output: one verdict per path, a draft PR for the
clear-cut verdicts, and a short report of everything else.

Work in the order below. Do not skip the evidence step; most wrong verdicts in past rounds came from
deciding from the path alone.

## 0. Preflight

- Never edit in a checkout that has staged or unstaged work. Check `git status` and the branch first.
- Check that nobody is already on it: `gh pr list --state open` and `git branch -r`. A path that an open
  PR already covers is "already handled" for this round.
- Make the changes in a fresh worktree off `origin/main`. Name the branch after the report date, and
  add a suffix (`-2`) if that branch or an open PR already exists:
  `git fetch origin main && git worktree add -b fix/404-<yyyy-mm-dd> ../murphys-laws-404-<yyyy-mm-dd> origin/main`
- Run `npm run install:all` in the worktree if `node_modules` is missing, so the pre-commit hook can run.
- Read `nginx.conf` (root) and `web/tests/nginx-scanner-defense.test.ts` before deciding anything. They
  hold the current rules, and a path the rules already cover is not a new problem.

## 1. Parse

Make a table: path (exactly as reported, query string included), count, and IP/user agent if shown.
Read a screenshot carefully and say which rows were unreadable instead of guessing. Merge duplicates
that differ only by case, trailing slash or query string, but keep the original strings for the tests.

## 2. Gather evidence (read-only)

For every path:

**Repo**
- Is it a real route? Check the routes in `web/src/router.ts`, the files in `web/public/`,
  `shared/content`, the sitemap builder in `web/scripts/ssg.ts` (the sitemap is generated at build time,
  not checked in), `web/public/robots.txt` and `web/public/llms.txt`. The API spec comes from
  `backend/src/openapi.ts`. `web/public/_redirects` is not read by nginx, so a path listed there is
  not handled on the droplet.
- Does anything link to it? `grep -rn "<path>" web shared backend mcp sdk`. An internal link to a missing
  page is a bug on our side.
- Is it already covered in `nginx.conf` (a `location =`, a redirect, or a scanner map pattern)? Test the
  pattern against the exact reported string before concluding. A match means "already handled": the
  report predates the deploy. No match means a gap.
- Did it ever exist? `git log --all --oneline -- <path>` and `git log -S"<path>"`.

**Server** (`ssh murphys-main`). Run only commands that read: `grep`, `zgrep`, `zcat`, `sort`, `uniq`,
`wc`, `ls`, `awk`, `fail2ban-client status`, `systemctl is-active`. The rule is "nothing that writes":
no output redirection (`>`, `>>`), no `tee`, no `awk` that prints to a file, no edits, no reloads, no
`fail2ban-client set`, no `apt`. If the fix needs a server action, hand the user the exact command at
the end.
- Pull the matching lines from `/var/log/nginx/access.log` and every rotated file, with
  `zgrep -h "<path>" /var/log/nginx/access.log*` (`zgrep` reads plain and gzipped files; do not use a
  `[.gz]` glob, which misses `access.log.1`). Note: how many requests, how many distinct IPs, first and
  last seen, the user agents, the referrers, the methods, and whether the status was always 404.
- Check `/var/log/nginx/scanner.log` to see whether similar paths are already being dropped.

**Outside** (only when the repo and logs do not settle it)
- Search the web for the path or user agent (for example a crawler name) to learn what it is.

## 3. Decide one verdict per path

A rule "matches" only when every condition in its "Use when" cell holds. Take the first rule that
matches.

| # | Verdict | Use when | Action |
|---|---------|----------|--------|
| 1 | **Already handled** | `nginx.conf` (or an open PR) already redirects, blocks or serves the exact path, and you tested the pattern against the reported string. This includes served `/.well-known/` files (`traffic-advice`, `security.txt`, `tdmrep.json`) and paths the scanner maps already drop (for example `/robots.txt.bak`). | No change. Say which rule covers it and that the report likely predates the deploy. A pattern that does not match the string is a gap, so go on to the next rules. |
| 2 | **Image: notify** | The path is an image or media file (`.gif .png .jpg .jpeg .webp .svg .ico .avif`, or under `/img/`, `/images/`, `/social/`) and rule 1 did not match. An image path that is plainly a scanner probe (inside `wp-content`, `uploads` with a script name, a dotdirectory) goes to rule 6 instead. | Do not change anything. Tell the user the path, count, referrer, user agent, and whether a file with that name or a close name exists in the repo or git history. They decide whether to restore, redirect or ignore it. |
| 3 | **Ignore** | A correct 404 for a legitimate crawler or protocol probe that no real visitor depends on: MCP discovery (`/mcp`, `/.well-known/mcp*`; this server is stdio-only), other `/.well-known/*` paths we do not serve, a variant of a file we do not publish (for example `/llms.json`), or a harmless crawler. Note that `llms.txt` and `llms-full.txt` exist, so they are rule 1 or a real route. | No code change. Optionally name the crawler in the report. Do not block good-faith crawlers. |
| 4 | **Redirect** | A legacy or mistyped URL of a real page, with one obvious target that exists (an old `/murphy/*` page, a plural or alias of a category, `/sitemaps.xml`-style typos). | Add an exact-match `location = <path>` with `return 301` to the target (see section 5), plus a test. The target must exist: verify it. |
| 5 | **Fix link or create content** | A plausible URL a real visitor or search engine would use that no redirect target covers: a broken internal link, a renamed law or category, a page we should have. | Fix the link at its source. If new content is needed, report it as a proposal; do not invent site content. |
| 6 | **Block as scanner** | An exploit or reconnaissance probe: dotfiles and secrets, CMS/PHP/Java/appliance paths, guessed admin/auth/API paths, encoded evasion, or an exploit-kit user agent, and no real user would request it. | Add an anchored pattern (see section 5), plus tests. Requires all of: not a real route, not linked anywhere, not in the sitemap, and the pattern cannot match a real URL or a query string. |
| 7 | **Needs a human** | You cannot tell which of rules 3 to 6 applies, or the choice is a product decision (for example a path that could be a real feature). | See section 4. |

Rules 4 and 5 come before 6 on purpose: a path with a real page behind it is never a scanner path.

When the evidence is only "a harmless crawler asked for something we do not have", the verdict is
ignore. When you cannot tell harmless from hostile, the verdict is "needs a human", not a guess.
Whatever settles it, a block needs the full block conditions above: a block is the costliest mistake,
because it feeds fail2ban and a wrong ban costs a real visitor access for a day.

Add a new verdict only if none fit, and name it in the report so the user can decide whether it should
become a permanent one.

## 4. Resolve ambiguity

For each "needs a human" row, call the `advisor` tool once with the evidence you gathered and the two
verdicts you are choosing between. If the session has no `advisor` tool, skip to the unresolved case.
- If the advisor settles it, use that verdict and record the reason. A block reached this way still
  needs every block condition from rule 6; otherwise the verdict is ignore.
- If it does not, leave the path unchanged and report it as unresolved, with the evidence and the
  options. Add a line for it to `TODO.md` in the same PR if one is opened.
- An unresolved path is left out of the PR. The other paths still go ahead.

## 5. Make the changes (clear-cut verdicts only)

Only verdicts 4 and 6, and the link fix of 5, produce changes. A run produces **one branch and one
draft PR for every 404 it received**, never one PR per path and never a second PR for a different
concern. If the changes span packages (for example nginx rules plus a link fix in `web/src`), they still
go in the same PR; bump each affected package's version in it. If no path needs a change, open no PR.

**Rules for `nginx.conf`**
- Scanner path patterns go in the `$scanner_path` map. Anchor them with a segment boundary:
  `^[^?]*(^|/)name` or `^/name`. The `[^?]*` keeps a query string from matching, and the `(^|/)` stops a
  pattern from matching the tail of a longer real path. End with `([/?]|$)` or `(\?|$)` so a longer real
  path never matches.
- Scanner agent patterns go into the one existing alternation in `$scanner_agent`. The test asserts a
  single agent pattern, so add to the alternation instead of adding a second entry. Only add names of
  exploit-kit tools (the existing list shows the kind). Never add a generic HTTP client: `curl`, `wget`,
  `python-requests`, `Go-http-client`, `node`, `okhttp`. The site's own health checks and monitoring use
  curl and Node `fetch`, and the jail only ignores `127.0.0.1/8` and `::1`, so such a block would ban our
  own host. Prefer a path block when one would do.
- Redirects are exact-match `location = /path { return 301 https://murphys-laws.com/target; }`. A
  category alias keeps `$is_args$args` on the target, as the neighbouring blocks do.
- Remember the trailing-slash rewrite near the top of the main server block: `/x/` becomes `/x` before
  location matching.
- Keep comments in the file's style: say what the rule drops or redirects and why.

**Tests** (`web/tests/nginx-scanner-defense.test.ts`)
- Block rules: add the exact reported strings to the matching `it.each` list, and add a nearby real
  route that must still pass. For an agent pattern, also assert that an ordinary browser user agent
  and a monitoring one (`curl/8.4.0`) still pass.
- Plain redirects: add the pair to the `nginx legacy URL redirects` table. That table asserts
  `return 301 https://murphys-laws.com<target>;` with the `;` right after the target.
- Redirects that keep the query string end in `$is_args$args;`, so the table cannot cover them. Add a
  separate assertion that includes the suffix; do not drop `$is_args$args` and do not loosen the
  table's assertion. A new legacy category slug also goes into `legacyCategorySlugs` in
  `web/tests/category-slug-docs.test.ts` and `CATEGORY_SLUG_ALIASES` in `backend/scripts/build-sqlite.ts`
  (a `backend/` change, so it needs a backend bump).
- Assert that every redirect target exists (a route, or a file in `web/public/`), as the existing
  `favicon-32x32.png` test does.
- Run the test file and make sure it fails without your change.

**Repo rules (AGENTS.md)**
- Update `CHANGELOG.md` under `[Unreleased]` / `### Fixed`, and record the bumps in the entry, as the
  neighbouring entries do ("Web bumped to `x`; root to `y`").
- Version bumps follow `scripts/check-version-bumps.ts` and `.claude/skills/ship/SKILL.md` section 2, and
  the hook checks each commit on its own. `nginx.conf` needs a root `package.json` bump. The test file
  under `web/` needs a `web/package.json` bump. A link fix under `web/src` needs the web bump, and one
  under `shared/content` also needs the iOS and Android bumps. A change under `backend/` needs a backend
  bump. A run that changes only markdown needs no bump. Run `npm run check:versions`; the pre-commit hook
  syncs the lockfiles.
- Run `npm run lint` and `npm test`. Never use `--no-verify`, and never weaken a linter or a
  threshold. `npm run lint` skips `.claude/**` when it lints markdown, so read a changed skill file
  yourself.
- Commit message: conventional prefix, for example `fix: drop <thing> probes from the 404 report`.
  No Claude co-author trailer and no Claude attribution line, in the commit or the PR.
- Before opening the PR, run `/pr-review-toolkit:review-pr` on your own change and fix what it finds
  (AGENTS.md requires the review first).
- Open the PR as a **draft**. Title in the same conventional style. The global "Jira ticket first" title
  rule does not apply here: this repo uses GitHub issues, so do not add a Jira prefix or a `[Jira]`
  link. Body: no section titles, a short intro, then bullets with the actual changes, one line per
  path and its verdict. No "Generated with" line.
- After opening the PR, call `mcp__ccd_pr__get_status` once (or `gh pr view --json statusCheckRollup`
  if that tool does not exist). Do not poll CI.
- Do not merge: merges that need `--admin` are run by the user.

**Deploying**
- A merged `nginx.conf` ships by itself: `.github/workflows/deploy.yml` copies it to
  `/etc/nginx/sites-available/murphys-laws`, runs `sudo nginx -t` and reloads nginx. Tell the user it
  goes live on the next deploy. Hand over manual commands (`nginx -t` first, then a reload) only if a
  deploy is not going to run, and never run them over ssh.

## 6. Report

End with one table, in the order of the report, then the short lists. Keep it plain:

| Path | Count | Verdict | Evidence | Outcome |
|------|-------|---------|----------|---------|

Then:
- **Opened:** the one PR link, with the paths it covers.
- **Needs your decision:** images (with the evidence) and unresolved paths (with the options).
- **Needs you to run:** any server command.
- **Ignored on purpose:** paths left alone and why, so the next report's repeat does not look new.

If nothing needed a change, say so and do not open a PR.
