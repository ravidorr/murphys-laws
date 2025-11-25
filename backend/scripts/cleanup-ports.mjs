#!/usr/bin/env node
/**
 * Port Cleanup Script
 *
 * Finds and optionally kills processes using the development ports.
 * This prevents EADDRINUSE errors when starting dev servers.
 *
 * Usage:
 *   npm run cleanup-ports        # Check ports and prompt to kill
 *   npm run cleanup-ports --kill # Auto-kill without prompting
 */

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const PORTS = {
  api: 8787,
  frontend: 5175
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function findProcessOnPort(port) {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // lsof returns exit code 1 if no processes found
    return [];
  }
}

function getProcessInfo(pid) {
  try {
    const cmd = execSync(`ps -p ${pid} -o command=`, { encoding: 'utf-8' });
    return cmd.trim();
  } catch {
    return 'Unknown process';
  }
}

function killProcess(pid) {
  try {
    execSync(`kill ${pid}`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    log(`Failed to kill process ${pid}: ${error.message}`, 'red');
    return false;
  }
}

async function promptUser(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const autoKill = process.argv.includes('--kill');

  log('\nChecking for processes using development ports...\n', 'blue');

  let foundProcesses = false;
  const processesToKill = [];

  for (const [name, port] of Object.entries(PORTS)) {
    const pids = findProcessOnPort(port);

    if (pids.length > 0) {
      foundProcesses = true;
      log(`Port ${port} (${name}):`, 'yellow');

      for (const pid of pids) {
        const cmd = getProcessInfo(pid);
        console.log(`  PID ${pid}: ${cmd}`);
        processesToKill.push({ pid, port, name, cmd });
      }
      console.log();
    }
  }

  if (!foundProcesses) {
    log('All development ports are free!', 'green');
    process.exit(0);
  }

  // Ask user or auto-kill
  let shouldKill = autoKill;

  if (!autoKill) {
    log('Found processes using development ports.', 'yellow');
    shouldKill = await promptUser('Kill these processes? (y/n): ');
  }

  if (shouldKill) {
    log('\nKilling processes...', 'blue');
    let killedCount = 0;

    for (const { pid, port, name } of processesToKill) {
      if (killProcess(pid)) {
        log(`Killed process ${pid} on port ${port} (${name})`, 'green');
        killedCount++;
      }
    }

    log(`\nKilled ${killedCount}/${processesToKill.length} processes`, 'green');
    process.exit(0);
  } else {
    log('\nNo processes killed. Run with --kill to auto-kill without prompting.', 'blue');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\nError: ${error.message}`, 'red');
  process.exit(1);
});
