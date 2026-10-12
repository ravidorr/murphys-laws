import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageJson = {
  name?: unknown;
  version?: unknown;
};

type ServerJson = {
  version?: unknown;
  packages?: Array<{
    identifier?: unknown;
    version?: unknown;
  }>;
};

export function validateMcpReleaseVersions(
  packageJson: PackageJson,
  serverJson: ServerJson,
): string[] {
  const packageVersion = packageJson.version;
  const serverVersion = serverJson.version;
  const registryPackage = serverJson.packages?.[0];
  const errors: string[] = [];

  if (typeof packageVersion !== 'string') {
    return ['mcp/package.json must define a string version'];
  }

  if (typeof serverVersion !== 'string' || serverVersion !== packageVersion) {
    errors.push(`mcp/server.json version must match mcp/package.json version ${packageVersion}`);
  }

  if (typeof registryPackage?.version !== 'string' || registryPackage.version !== packageVersion) {
    errors.push(
      `mcp/server.json packages[0].version must match mcp/package.json version ${packageVersion}`,
    );
  }

  if (registryPackage?.identifier !== packageJson.name) {
    errors.push('mcp/server.json packages[0].identifier must match mcp/package.json name');
  }

  return errors;
}

export function checkMcpReleaseContract(repositoryRoot: string): void {
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'mcp/package.json'), 'utf8'),
  ) as PackageJson;
  const serverJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'mcp/server.json'), 'utf8'),
  ) as ServerJson;
  const errors = validateMcpReleaseVersions(packageJson, serverJson);

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

const thisFile = fileURLToPath(import.meta.url);

if (process.argv[1] === thisFile) {
  checkMcpReleaseContract(path.resolve(path.dirname(thisFile), '..'));
}
