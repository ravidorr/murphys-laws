# murphys-laws-cli

[![npm version](https://img.shields.io/npm/v/murphys-laws-cli.svg)](https://www.npmjs.com/package/murphys-laws-cli)
[![npm downloads](https://img.shields.io/npm/dm/murphys-laws-cli.svg)](https://www.npmjs.com/package/murphys-laws-cli)
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

## License

CC0-1.0.
