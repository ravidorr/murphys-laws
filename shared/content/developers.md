# Developers

Murphy's Law Archive offers a free REST API, a TypeScript SDK, a command-line
interface, an MCP server for AI agents, and machine-readable feeds. Integrate
1,500+ laws into your apps, bots, and workflows with no API key.

## MCP Server

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server lets
AI agents and LLM-powered tools access Murphy's Laws directly. Install it with
a single command:

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

- `search_laws`: Search laws by keyword with optional category filter
- `get_random_law`: Get a random Murphy's Law
- `get_law_of_the_day`: Get today's featured law (rotates daily)
- `get_law`: Get a specific law by ID
- `list_categories`: List all categories with slugs and law counts
- `get_laws_by_category`: Browse laws in a specific category
- `submit_law`: Submit a new law for review

[View on npm](https://www.npmjs.com/package/murphys-laws-mcp) | [Source on GitHub](https://github.com/ravidorr/murphys-laws/tree/main/mcp)

## CLI

`murphys-laws-cli` wraps the REST API so you can search, inspect, or submit
laws from the terminal. Use it for scripting, shell aliases, or a quick morale
boost during deploys.

```
npx murphys-laws-cli random
npx murphys-laws-cli search "computer" --limit 3
npx murphys-laws-cli today --json
```

Global flags include `--json` for machine-readable output, `--base-url` to
target a local or self-hosted server, and `--user-agent` to override the
default.

[View on npm](https://www.npmjs.com/package/murphys-laws-cli) | [Source on GitHub](https://github.com/ravidorr/murphys-laws/tree/main/cli)

## TypeScript SDK

`murphys-laws-sdk` is a small typed client for the REST API. Zero runtime
dependencies, uses the platform `fetch`, and ships ESM types.

```ts
import { MurphysLawsClient } from 'murphys-laws-sdk';

const client = new MurphysLawsClient({ userAgent: 'my-app/1.0' });
const law = await client.getRandomLaw();
console.log(law.text);
```

[View on npm](https://www.npmjs.com/package/murphys-laws-sdk) | [Source on GitHub](https://github.com/ravidorr/murphys-laws/tree/main/sdk)

## REST API

The REST API is free, requires no authentication for read endpoints, and
returns JSON. All versioned endpoints live under `/api/v1/` and are stable.

**Base URL:** `https://murphys-laws.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/laws` | List and search laws. Params: `q`, `category_slug`, `limit`, `offset`, `sort`, `order` |
| GET | `/api/v1/laws/:id` | Get a single law with attributions and category |
| GET | `/api/v1/laws/random` | Get a random published law |
| GET | `/api/v1/law-of-day` | Today's featured law (selected daily by popularity) |
| GET | `/api/v1/categories` | All categories with law counts |
| GET | `/api/v1/categories/:id` | Single category details |
| POST | `/api/v1/laws` | Submit a new law for review |

### Example

```
curl -H 'User-Agent: my-app/1.0' "https://murphys-laws.com/api/v1/laws?q=computer&limit=2"
```

Scripted clients should send a meaningful `User-Agent`. Generic or blank
User-Agents may be rate-limited more aggressively.

[View the OpenAPI spec](/openapi.json) |
[Full API docs](https://github.com/ravidorr/murphys-laws/blob/main/shared/docs/API.md)

## Feeds

Subscribe to new laws via standard feed formats:

- [RSS 2.0](/api/v1/feed.rss): Recent laws and law of the day
- [Atom 1.0](/api/v1/feed.atom): Recent laws and law of the day

## Machine-Readable Resources

These files help AI crawlers, search engines, and developer tools understand
the site:

- [llms.txt](/llms.txt): Concise reference for AI agents
- [llms-full.txt](/llms-full.txt): Full API reference with examples and all category slugs
- [openapi.json](/openapi.json): OpenAPI 3.0.3 specification
- [robots.txt](/robots.txt): Crawler and AI bot rules

## Versioning and stability

`/api/v1/` is stable. We will not rename or remove existing fields, nor change
response semantics in incompatible ways. Breaking changes ship under a new
prefix (e.g. `/api/v2/`), and deprecations are announced via `Deprecation` and
`Sunset` response headers. Additive changes (new optional fields, new
endpoints, new headers) may happen at any time within `/api/v1/`.

## Rate Limits

**Reads** (GET) are not rate-limited today. Treat the `X-RateLimit-*` response
headers as authoritative rather than hard-coding these numbers.

**Writes** are rate-limited per IP to prevent abuse:

- Law submissions: 3 per minute
- Votes: 30 per minute

Write responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset` so clients can back off proactively. When rate limited,
the API returns `429 Too Many Requests` with a `Retry-After` header.
