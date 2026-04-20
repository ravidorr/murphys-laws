export const HELP_TEXT = `murphy - Murphy's Laws command-line interface

Usage:
  murphy <command> [args] [options]

Commands:
  search <query>          Search laws by text
  random                  Print a random law
  today                   Print today's featured law
  get <id>                Fetch a specific law by id
  categories              List all categories
  category <slug>         List laws in a category
  submit <text>           Submit a new law for review

Options:
  --json                  Emit machine-readable JSON
  --no-color              Disable ANSI colors (also honors NO_COLOR)
  --base-url <url>        Override API base URL (default https://murphys-laws.com)
  --user-agent <ua>       Override User-Agent header
  --limit <n>             Result count (search/category)
  --offset <n>            Pagination offset (search)
  --category <slug>       Filter by category slug (search)
  --sort <field>          Sort field: score|created_at|id
  --order <asc|desc>      Sort direction
  --title <string>        Title for submit
  --author <string>       Author for submit
  --text <string>         Text for submit (alternative to positional)
  -h, --help              Show this help
  -v, --version           Show CLI version

Exit codes:
  0  success
  1  not found
  2  usage error
  3  rate limited
  4  network error
`;
