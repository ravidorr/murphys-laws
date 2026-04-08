# murphys-laws-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents access to 1,500+ Murphy's Laws, corollaries, and humorous observations about life's tendency for things to go wrong.

Works with Claude Desktop, Cursor, VS Code Copilot, and any MCP-compatible host.

## Quick Start

Add to your MCP client config (e.g. `claude_desktop_config.json`):

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

## Tools

| Tool | Description |
|------|-------------|
| `search_laws` | Search laws by keyword with optional category filter |
| `get_random_law` | Get a random Murphy's Law |
| `get_law_of_the_day` | Get today's featured law (rotates daily) |
| `get_law` | Get a specific law by ID |
| `list_categories` | List all 55 categories with slugs and law counts |
| `get_laws_by_category` | Browse laws in a specific category |
| `submit_law` | Submit a new law for review |

## Example Usage

Once connected, you can ask your AI assistant things like:

- "What's today's Murphy's Law?"
- "Find Murphy's Laws about computers"
- "Give me a random Murphy's Law"
- "Browse the military laws category"
- "Submit a new Murphy's Law: 'The printer will always jam when you're in a hurry'"

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MURPHYS_API_URL` | `https://murphys-laws.com` | Base URL for the Murphy's Laws API |

### Local Development

If running from the monorepo source:

```bash
cd mcp
npm install
npm start          # Run the server
npm run dev        # Run with watch mode
npm run inspect    # Open MCP Inspector
```

## API

This MCP server uses the public [Murphy's Laws REST API](https://murphys-laws.com/api/v1/). No authentication required for reads. Rate limits apply only to writes (3 law submissions/minute).

- [API Docs](https://murphys-laws.com/developers)
- [OpenAPI Spec](https://murphys-laws.com/openapi.json)
- [llms.txt](https://murphys-laws.com/llms.txt)

## License

CC0 1.0 Universal (Public Domain)
