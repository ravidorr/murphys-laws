# murphys-laws-cli

[![npm version](https://img.shields.io/npm/v/murphys-laws-cli.svg)](https://www.npmjs.com/package/murphys-laws-cli)
[![npm downloads](https://img.shields.io/npm/dm/murphys-laws-cli.svg)](https://www.npmjs.com/package/murphys-laws-cli)
[![CI](https://github.com/ravidorr/murphys-laws/actions/workflows/cli-ci.yml/badge.svg)](https://github.com/ravidorr/murphys-laws/actions/workflows/cli-ci.yml)
[![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/ravidorr/murphys-laws/actions/workflows/cli-ci.yml)
[![license](https://img.shields.io/npm/l/murphys-laws-cli.svg)](https://creativecommons.org/publicdomain/zero/1.0/)

Command-line interface for the public [Murphy's Laws](https://murphys-laws.com)
REST API. Built on top of `murphys-laws-sdk`.

## Install

Run once with `npx`:

```bash
npx murphys-laws-cli random
```

Or install globally:

```bash
npm install -g murphys-laws-cli
murphy random
```

Requires Node.js 22+.

## Commands

```text
murphy search <query> [--limit N] [--offset N] [--category SLUG]
murphy random
murphy today
murphy get <id>
murphy categories
murphy category <slug> [--limit N]
murphy submit <text> [--title T] [--author A] [--category SLUG]
```

Submitting is rate-limited per the API's write policy.

## Global flags

- `--json` emit machine-readable JSON instead of formatted text
- `--no-color` disable ANSI colors. `NO_COLOR` env and non-TTY output also
  disable colors automatically
- `--base-url <url>` override API base URL (default
  `https://murphys-laws.com`); handy for running against a local backend
- `--user-agent <ua>` override User-Agent header
- `-h, --help` show help
- `-v, --version` show CLI version

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | not found (404) |
| 2 | usage error (bad arguments, unknown command, validation error) |
| 3 | rate limited (429) |
| 4 | network or unexpected error |

## Cookbook

### Print today's law on your shell prompt

```bash
# Add to your ~/.zshrc or ~/.bashrc
alias morale='npx --yes murphys-laws-cli today'
```

### Slack/Discord poster via cron

```bash
#!/usr/bin/env bash
# post-daily-law.sh
LAW=$(npx --yes murphys-laws-cli --json today | jq -r '.law.text')
curl -X POST -H 'Content-Type: application/json' \
  -d "{\"text\":\"Law of the Day: \${LAW}\"}" \
  "$SLACK_WEBHOOK_URL"
```

### Exit-code-driven shell logic

Capture the exit code into a variable - each `[ ... ]` check mutates `$?`, so
reading it across multiple branches clobbers the real CLI status.

```bash
murphy get "$LAW_ID" > /tmp/law.txt 2>/dev/null
status=$?

case "$status" in
  0) cat /tmp/law.txt ;;
  1) echo "law not found" ;;
  3) echo "rate limited, retrying later" ;;
  *) echo "unexpected error (exit $status)" ;;
esac
```

### Pipe JSON into jq for data work

```bash
# top 5 slugs by law_count
murphy --json categories | jq -r '.[] | [.law_count, .slug] | @tsv' \
  | sort -rn | head -5

# text of every computer law
murphy --json category computers --limit 100 | jq -r '.data[].text'
```

### Search and save as a file

```bash
murphy --json search "debug" --limit 25 \
  | jq '.data[] | {id, text, score}' \
  > debug-laws.json
```

### Point at a local backend during dev

```bash
murphy --base-url http://127.0.0.1:8787 random
```

### Submit with a custom User-Agent

```bash
murphy --user-agent "my-team-bot/1.0 (+https://team.example)" \
  submit "Anything that can go wrong, will, and at the worst possible time." \
  --author "Jane Doe" \
  --category computers
```

### Disable color for clean logs

```bash
murphy --no-color today > today.log
# or set the standard env var:
NO_COLOR=1 murphy today
```

## License

CC0-1.0.
