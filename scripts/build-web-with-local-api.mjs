import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${signal || code}`));
    });
  });
}

async function waitForApi(apiProcess, getLogs) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Local API exited before becoming healthy.\n${getLogs()}`);
    }
    try {
      const response = await fetch('http://127.0.0.1:8787/api/health');
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the local API.\n${getLogs()}`);
}

try {
  const existingApi = await fetch('http://127.0.0.1:8787/api/health');
  if (existingApi.ok) {
    throw new Error('Port 8787 already has a healthy API. Stop it before running the reproducible web build.');
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Port 8787')) throw error;
}

await run('npm', ['--prefix', 'backend', 'run', 'build:db']);

let apiLogs = '';
const apiProcess = spawn('npm', ['--prefix', 'backend', 'start'], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
const recordApiLog = (chunk) => {
  apiLogs = `${apiLogs}${chunk.toString()}`.slice(-12000);
};
apiProcess.stdout.on('data', recordApiLog);
apiProcess.stderr.on('data', recordApiLog);

try {
  await waitForApi(apiProcess, () => apiLogs);
  await run('npm', ['--prefix', 'web', 'run', 'build'], {
    env: { ...process.env, API_BASE_URL: 'http://127.0.0.1:8787' },
  });
} finally {
  if (apiProcess.exitCode === null) {
    if (process.platform === 'win32') apiProcess.kill('SIGTERM');
    else process.kill(-apiProcess.pid, 'SIGTERM');
  }
}
