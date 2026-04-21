# murphys-laws-mcp

[![npm version](https://img.shields.io/npm/v/murphys-laws-mcp.svg)](https://www.npmjs.com/package/murphys-laws-mcp)
[![npm downloads](https://img.shields.io/npm/dm/murphys-laws-mcp.svg)](https://www.npmjs.com/package/murphys-laws-mcp)
[![CI](https://github.com/ravidorr/murphys-laws/actions/workflows/mcp-ci.yml/badge.svg)](https://github.com/ravidorr/murphys-laws/actions/workflows/mcp-ci.yml)
[![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/ravidorr/murphys-laws/actions/workflows/mcp-ci.yml)
[![license](https://img.shields.io/npm/l/murphys-laws-mcp.svg)](https://creativecommons.org/publicdomain/zero/1.0/)

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

## MCP Registry publishing

This server is listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as `com.murphys-laws/murphys-laws`. Registry metadata is re-published automatically by [.github/workflows/mcp-registry-publish.yml](../.github/workflows/mcp-registry-publish.yml) whenever `mcp/server.json` changes on `main` (or via `workflow_dispatch`).

Prerequisites for the automation:

1. A DNS TXT record on `murphys-laws.com` containing `v=MCPv1; k=ed25519; p=<PUBLIC_KEY>` (already set; the public key is in the [authentication docs](https://modelcontextprotocol.io/registry/authentication)).
2. A repo secret `MCP_PUBLISHER_PRIVATE_KEY` holding the matching Ed25519 private key as hex (no separators).

### Key rotation (when needed)

```bash
# Generate a fresh keypair (on a machine with OpenSSL 3)
mkdir -p ~/.config/mcp && cd ~/.config/mcp
openssl genpkey -algorithm Ed25519 -out murphys-laws.key.pem
chmod 600 murphys-laws.key.pem

# Derive the new TXT record value
PUBLIC_KEY="$(openssl pkey -in murphys-laws.key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}"
# Replace the old TXT record on murphys-laws.com with this value

# Extract the hex private key for the GitHub secret
openssl pkey -in murphys-laws.key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n'
# Paste the hex output into repo Settings -> Secrets -> MCP_PUBLISHER_PRIVATE_KEY
```

The private key file at `~/.config/mcp/murphys-laws.key.pem` is the only local copy; back it up to a password manager.

## License

CC0 1.0 Universal (Public Domain)
