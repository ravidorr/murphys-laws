# Dependency audit exceptions

## `@hono/node-server` encoded-backslash path traversal

- Advisory: `GHSA-frvp-7c67-39w9`
- Severity: moderate
- Dependency path: `@modelcontextprotocol/sdk` -> `@hono/node-server`
- Reachability: not reachable in this repository. The MCP package starts only
  `StdioServerTransport`; it does not import Hono, expose HTTP static files, or
  run on Windows in production.
- Resolution: remove this exception when the MCP SDK accepts
  `@hono/node-server >=2.0.5`.
