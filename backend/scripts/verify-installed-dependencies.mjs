#!/usr/bin/env node
/**
 * Post-install check for the backend's runtime dependencies.
 *
 * `npm ci` can exit 0 and still leave a package unusable (a half-written node_modules/nodemailer with
 * no entry file made the health check crash on Nov 8 and Nov 11, 2026). This resolves every package in
 * package.json "dependencies" the way an ESM `import` does, without running any of their code, and
 * exits 1 naming each one that cannot be found, so a deploy stops instead of the monitoring breaking.
 *
 * Plain JavaScript on purpose: it must not need tsx, which is itself one of the packages it checks.
 *
 * Usage: node backend/scripts/verify-installed-dependencies.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { dependencies = {} } = JSON.parse(readFileSync(resolve(backendRoot, 'package.json'), 'utf8'));

const broken = [];
for (const name of Object.keys(dependencies)) {
  try {
    import.meta.resolve(name);
  } catch (error) {
    broken.push(`${name}: ${error.message.split('\n')[0]}`);
  }
}

if (broken.length > 0) {
  console.error(`${broken.length} installed dependenc${broken.length === 1 ? 'y' : 'ies'} cannot be resolved:`);
  for (const line of broken) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(`All ${Object.keys(dependencies).length} runtime dependencies resolve.`);
