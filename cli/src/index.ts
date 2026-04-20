import { runCli } from './cli.js';
import { VERSION } from './version.js';

export async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    isStdoutTTY: Boolean(process.stdout.isTTY),
    version: VERSION,
  });
  process.exit(code);
}

export { runCli } from './cli.js';
export { VERSION } from './version.js';
