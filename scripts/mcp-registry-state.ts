import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Reads the MCP Registry search response for the MCP Release workflow. The search endpoint lists
// every published version of a server, in no guaranteed order, so the "live" version is the entry
// the registry itself flags as latest. Picking the first match once made the workflow compare
// against an old release and try to re-publish an existing version.

const OFFICIAL_META_KEY = 'io.modelcontextprotocol.registry/official';

type RegistryEntry = {
  server?: { name?: unknown; version?: unknown };
  _meta?: Record<string, { isLatest?: unknown } | undefined>;
};

export type RegistryResponse = { servers?: RegistryEntry[] };

type NamedVersion = { version: string; isLatest: boolean };

function entriesNamed(response: RegistryResponse, name: string): NamedVersion[] {
  const found: NamedVersion[] = [];
  for (const entry of response.servers ?? []) {
    if (entry.server?.name === name && typeof entry.server.version === 'string') {
      found.push({
        version: entry.server.version,
        isLatest: entry._meta?.[OFFICIAL_META_KEY]?.isLatest === true,
      });
    }
  }
  return found;
}

/**
 * Returns the live (latest) version of `name`, or '' when the registry has no entry for it.
 * Throws when the response cannot identify one latest version, so the workflow stops instead of
 * guessing.
 */
export function findLiveRegistryVersion(response: RegistryResponse, name: string): string {
  const entries = entriesNamed(response, name);
  if (entries.length === 0) {
    return '';
  }

  const latest = entries.filter((entry) => entry.isLatest);
  if (latest.length === 1) {
    return latest[0].version;
  }
  if (latest.length === 0 && entries.length === 1) {
    return entries[0].version;
  }

  const versions = entries.map((entry) => entry.version).join(', ');
  throw new Error(`Registry response for '${name}' does not identify one latest version (${versions})`);
}

export function registryNeedsPublish(liveVersion: string, expectedVersion: string): boolean {
  return liveVersion !== expectedVersion;
}

/**
 * Command line entry point: `<response-file> <server-name> <expected-version>`.
 * Returns `live_version=` and `needs_publish=` lines ready to append to $GITHUB_OUTPUT.
 */
export function runRegistryStateCli(args: string[]): string {
  const [responseFile, name, expectedVersion] = args;
  if (!responseFile || !name || !expectedVersion) {
    throw new Error('Usage: mcp-registry-state.ts <response-file> <server-name> <expected-version>');
  }

  const response = JSON.parse(readFileSync(responseFile, 'utf8')) as RegistryResponse;
  const liveVersion = findLiveRegistryVersion(response, name);
  return [
    `live_version=${liveVersion}`,
    `needs_publish=${registryNeedsPublish(liveVersion, expectedVersion)}`,
  ].join('\n');
}

/* v8 ignore start -- command line wrapper; the logic above is covered by unit tests */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(runRegistryStateCli(process.argv.slice(2)));
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
/* v8 ignore stop */
