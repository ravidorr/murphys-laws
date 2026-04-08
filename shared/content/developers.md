# Developers

Murphy's Law Archive offers a free REST API, an MCP server for AI agents, and machine-readable feeds. Integrate 1,500+ laws into your apps, bots, and workflows.

## MCP Server

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server lets AI agents and LLM-powered tools access Murphy's Laws directly. Install it with a single command:

```
npx murphys-laws-mcp
```

### Claude Desktop Configuration

Add this to your Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "murphys-laws": {
      "command": "npx",
      "args": ["-y", "murphys-laws-mcp"]
    }
  }
}
```

That's it. No API key, no database, no setup.

### Available Tools

- **`search_laws`** — Search laws by keyword with optional category filter
- **`get_random_law`** — Get a random Murphy's Law
- **`get_law_of_the_day`** — Get today's featured law (rotates daily)
- **`get_law`** — Get a specific law by ID
- **`list_categories`** — List all 55 categories with slugs and law counts
- **`get_laws_by_category`** — Browse laws in a specific category
- **`submit_law`** — Submit a new law for review

[View on npm](https://www.npmjs.com/package/murphys-laws-mcp) | [Source on GitHub](https://github.com/ravidorr/murphys-laws/tree/main/mcp)

## REST API

The REST API is free, requires no authentication for read endpoints, and returns JSON.

**Base URL:** `https://murphys-laws.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/laws` | List and search laws. Params: `q`, `category_slug`, `limit`, `offset`, `sort`, `order` |
| GET | `/api/v1/laws/:id` | Get a single law with attributions and category |
| GET | `/api/v1/laws/random` | Get a random published law |
| GET | `/api/v1/law-of-day` | Today's featured law (selected daily by popularity) |
| GET | `/api/v1/categories` | All 55 categories with law counts |
| GET | `/api/v1/categories/:id` | Single category details |
| POST | `/api/v1/laws` | Submit a new law for review |

### Example

```
curl "https://murphys-laws.com/api/v1/laws?q=computer&limit=2"
```

[View the OpenAPI spec](/openapi.json)

## Feeds

Subscribe to new laws via standard feed formats:

- [RSS 2.0](/api/v1/feed.rss) — Recent laws and law of the day
- [Atom 1.0](/api/v1/feed.atom) — Recent laws and law of the day

## Machine-Readable Resources

These files help AI crawlers, search engines, and developer tools understand the site:

- [llms.txt](/llms.txt) — Concise reference for AI agents
- [llms-full.txt](/llms-full.txt) — Full API reference with examples and all category slugs
- [openapi.json](/openapi.json) — OpenAPI 3.0.3 specification
- [robots.txt](/robots.txt) — Crawler and AI bot rules

## Rate Limits

**Reads** (GET) are unlimited — query as often as you need.

**Writes** are rate-limited per IP to prevent abuse:

- Law submissions: 5 per hour
- Votes: 60 per hour
