---
name: triage-404s
description: >
  Triage the HTTP 404 list from the Murphy's Laws Server Daily Status Report. Use this skill whenever
  the user pastes (or attaches a screenshot of) the report's 404 section, says "these are the 404s I
  got", "triage the 404s", or asks what to do about a path that 404s. It analyzes every path, decides
  one verdict per path (ignore, redirect, block as scanner, fix link or create content, notify about an
  image, already handled, or needs a human), opens a draft PR for the clear-cut ones, and reports the
  rest.
---

# Triage 404s - murphys-laws

Input: the 404 rows of the daily report, as pasted text or a screenshot. Each row is a path and
usually a count, sometimes an IP and user agent. Output: one verdict per path, a draft PR for the
clear-cut verdicts, and a short report of everything else.

Work in the order below. Do not skip the evidence step; most wrong verdicts in past rounds came from
deciding from the path alone.

## 0. Preflight

- Never edit in a checkout that has staged or unstaged work. Check `git status` and the branch first.
- Make the changes in a fresh worktree off `origin/main`:
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
- Is it a real route? Check `web/src` routes, `web/public/`, `web/public/_redirects`, `shared/content`,
  `sitemap`, `robots.txt`, `llms.txt`, `openapi.json`.
- Does anything link to it? `grep -rn "<path>" web shared backend mcp sdk`. An internal link to a missing
  page is a bug on our side.
- Is it already covered in `nginx.conf` (a `location =`, a redirect, or a scanner map pattern)? Then it
  is probably "already handled": the report predates the deploy, or the pattern has a gap. Test the
  pattern against the exact string before concluding.
- Did it ever exist? `git log --all --oneline -- <path>` and `git log -S"<path>"`.

**Server** (`ssh murphys-main`, read-only commands only: `grep`, `zgrep`, `zcat`, `awk`, `sort`,
`uniq`, `ls`, `systemctl is-active`)
- Pull the matching lines from `/var/log/nginx/access.log` and the rotated `access.log.*[.gz]`. Note:
  how many requests, how many distinct IPs, first and last seen, the user agents, the referrers, the
  methods, and whether the status was always 404.
- Check `/var/log/nginx/scanner.log` to see whether similar paths are already being dropped.
- Never run a write over ssh (no edits, no reloads, no `fail2ban-client set`, no `apt`). If the fix
  needs a server action, hand the user the exact command at the end.

**Outside** (only when the repo and logs do not settle it)
- Search the web for the path or user agent (for example a crawler name) to learn what it is.

## 3. Decide one verdict per path

Take the first rule that matches.

| # | Verdict | Use when | Action |
|---|---------|----------|--------|
| 1 | **Image: notify** | The path is an image or media file (`.gif .png .jpg .jpeg .webp .svg .ico .avif`, or under `/img/`, `/images/`, `/social/`). | Do not change anything. Tell the user the path, count, referrer, user agent, and whether a file with that name or a close name exists in the repo or git history. They decide whether to restore, redirect or ignore it. |
| 2 | **Already handled** | `nginx.conf` already redirects, blocks or serves it, and the pattern matches the exact string. | No change. Say which rule covers it and that the report likely predates the deploy. If the pattern does not match, it is a gap: treat it as the verdict it should have. |
| 3 | **Ignore** | A correct 404 for a legitimate crawler or protocol probe: MCP discovery (`/mcp`, `/.well-known/mcp*`, `llms*` variants), `/.well-known/*` paths we do not serve, `/robots.txt` variants, an unknown but harmless crawler. | No code change. Optionally name the crawler in the report. Do not block good-faith crawlers. |
| 4 | **Redirect** | A legacy or mistyped URL of a real page, with one obvious target that exists (an old `/murphy/*` page, a plural or alias of a category, `/sitemaps.xml`-style typos). | Add an exact-match `location = <path>` with `return 301` to the target (see section 5), plus a test. The target must exist: verify it. |
| 5 | **Block as scanner** | An exploit or reconnaissance probe: dotfiles and secrets, CMS/PHP/Java/appliance paths, guessed admin/auth/API paths, encoded evasion, or a known scanner user agent, and no real user would request it. | Add an anchored pattern to `$scanner_path` (or the agent map), plus tests. Requires all of: not a real route, not linked anywhere, not in the sitemap, and the pattern cannot match a real URL or a query string. |
| 6 | **Fix link or create content** | A plausible URL a real visitor or search engine would use: a broken internal link, a renamed law or category, a page we should have. | Fix the link at its source, or redirect if the page moved. If new content is needed, report it as a proposal; do not invent site content. |
| 7 | **Needs a human** | You cannot tell which of the above applies, or the choice is a product decision (for example a path that could be a real feature). | See section 4. |

Add a new verdict only if none fit, and name it in the report so the user can decide whether it should
become a permanent one.

A path that matches both "redirect" and "block" is a redirect when a real page exists for it, otherwise
a block. When unsure between "ignore" and "block", ignore: a blocked path feeds fail2ban, and a wrong
ban costs a real visitor access.

## 4. Resolve ambiguity

For each "needs a human" row, call the `advisor` tool once with the evidence you gathered and the two
verdicts you are choosing between. If the advisor settles it, use that verdict and record the reason.
If it does not, do not guess: leave the path unchanged and report it as unresolved, with the evidence
and the options. Never open a PR for an unresolved path.

## 5. Make the changes (clear-cut verdicts only)

Only verdicts 4, 5 and the link-fix part of 6 produce changes. Put all the changes of one report in a
single branch and a single draft PR, unless a change is unrelated to the rest.

**Rules for `nginx.conf`**
- Scanner patterns go in the `$scanner_path` map. Anchor them with `^[^?]*` or `^/`, so a path in a
  query string never matches, and end with `([/?]|$)` or `(\?|$)` so a longer real path never matches.
- Redirects are exact-match `location = /path { return 301 https://murphys-laws.com/target; }`. Keep
  `$is_args$args` on category aliases, as the neighbouring blocks do.
- Remember the trailing-slash rewrite near the top of the main server block: `/x/` becomes `/x` before
  location matching.
- Keep comments in the file's style: say what the rule drops or redirects and why.

**Tests** (`web/tests/nginx-scanner-defense.test.ts`)
- Block rules: add the exact reported strings to the matching `it.each` list, and add a nearby real
  route that must still pass.
- Redirects: add the pair to the `nginx legacy URL redirects` table, and assert the target exists.
- Run the test file and make sure it fails without your change.

**Repo rules (AGENTS.md)**
- Update `CHANGELOG.md` under `[Unreleased]` / `### Fixed`.
- A root-level non-documentation change such as `nginx.conf` needs a root `package.json` version bump;
  run `npm run check:versions`. The pre-commit hook syncs the lockfiles.
- Run `npm run lint` and `npm test`. Never use `--no-verify`, and never weaken a linter or a
  threshold.
- Commit message: conventional prefix, for example `fix: drop <thing> probes from the 404 report`.
  No Claude co-author trailer and no Claude attribution line, in the commit or the PR.
- Open the PR as a **draft**. Title in the same conventional style (this repo uses GitHub issues, not
  Jira). Body: no section titles, a short intro, then bullets with the actual changes, one line per
  path and its verdict. No "Generated with" line.
- After opening the PR, call `mcp__ccd_pr__get_status` once. Do not poll CI.
- Run `/pr-review-toolkit:review-pr` on your own PR and fix what it finds before asking anyone else to
  look. Do not merge: merges that need `--admin` are run by the user.

**Deploying**
- A merged `nginx.conf` does not change the droplet by itself unless the deploy workflow installs it.
  Check how it ships. If it does not, give the user the exact commands to run (`nginx -t` first, then a
  reload) instead of running them over ssh.

## 6. Report

End with one table, in the order of the report, then the short lists. Keep it plain:

| Path | Count | Verdict | Evidence | Outcome |
|------|-------|---------|----------|---------|

Then:
- **Opened:** the PR link and what it covers.
- **Needs your decision:** images (with the evidence) and unresolved paths (with the options).
- **Needs you to run:** any server command.
- **Ignored on purpose:** paths left alone and why, so the next report's repeat does not look new.

If nothing needed a change, say so and do not open a PR.
