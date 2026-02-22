#!/usr/bin/env node
/**
 * Port Validation Script
 *
 * Validates that ports are consistent across configuration files:
 * - web/vite.config.ts
 * - backend/ecosystem.config.cjs
 * - nginx.conf (repo root)
 *
 * Run this before deployment to catch port mismatches.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(BACKEND_ROOT, '..');

const colors: Record<string, string> = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(msg: string, color: string = 'reset'): void {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function extractPort(content: string, pattern: RegExp): number | null {
  const match = content.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

try {
  log('\nValidating port configuration consistency...\n', 'blue');

  const viteConfig = readFileSync(resolve(REPO_ROOT, 'web', 'vite.config.ts'), 'utf-8');
  const vitePreviewPort = extractPort(viteConfig, /preview:\s*\{[^}]*port:\s*(\d+)/);
  const viteServerPort = extractPort(viteConfig, /server:\s*\{[^}]*port:\s*(\d+)/);

  const ecosystemConfig = readFileSync(resolve(BACKEND_ROOT, 'ecosystem.config.cjs'), 'utf-8');
  const ecosystemFrontendPort = extractPort(ecosystemConfig, /vite preview[^}]*--port\s+(\d+)/);

  const nginxConfig = readFileSync(resolve(REPO_ROOT, 'nginx.conf'), 'utf-8');
  const proxyPassMatches = nginxConfig.matchAll(/proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/g);
  const ports = Array.from(proxyPassMatches).map((m) => parseInt(m[1], 10));
  const nginxFrontendPort = ports[0] ?? null;
  const nginxApiPort = ports[1] ?? null;

  const apiServer = readFileSync(resolve(BACKEND_ROOT, 'src/server/api-server.ts'), 'utf-8');
  const apiDefaultPort = extractPort(apiServer, /PORT\s*\|\|\s*(\d+)/);

  log('Found Ports:', 'blue');
  console.log(`  web/vite.config.ts (preview):   ${vitePreviewPort ?? 'NOT FOUND'}`);
  console.log(`  web/vite.config.ts (server):    ${viteServerPort ?? 'NOT FOUND'}`);
  console.log(`  ecosystem.config.cjs:           ${ecosystemFrontendPort ?? 'NOT FOUND'}`);
  console.log(`  nginx.conf (frontend):          ${nginxFrontendPort ?? 'NOT FOUND'}`);
  console.log(`  nginx.conf (api):               ${nginxApiPort ?? 'NOT FOUND'}`);
  console.log(`  src/server/api-server.ts:       ${apiDefaultPort ?? 'NOT FOUND'}`);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (vitePreviewPort !== ecosystemFrontendPort) {
    errors.push(`Frontend port mismatch: vite.config.ts (${vitePreviewPort}) != ecosystem.config.cjs (${ecosystemFrontendPort})`);
  }

  if (vitePreviewPort !== nginxFrontendPort) {
    errors.push(`Frontend port mismatch: vite.config.ts (${vitePreviewPort}) != nginx.conf (${nginxFrontendPort})`);
  }

  if (nginxApiPort !== apiDefaultPort) {
    warnings.push(`API port mismatch: nginx.conf (${nginxApiPort}) != src/server/api-server.ts default (${apiDefaultPort})`);
  }

  console.log();
  if (errors.length === 0 && warnings.length === 0) {
    log('All ports are consistent!', 'green');
    log(`   Frontend: ${vitePreviewPort}`, 'green');
    log(`   API: ${nginxApiPort}`, 'green');
    process.exit(0);
  } else {
    if (errors.length > 0) {
      log('Port Configuration Errors:', 'red');
      errors.forEach((err) => log(`   - ${err}`, 'red'));
    }
    if (warnings.length > 0) {
      log('\nPort Configuration Warnings:', 'yellow');
      warnings.forEach((warn) => log(`   - ${warn}`, 'yellow'));
      log('   (Warnings are OK if you set PORT env var on the droplet)', 'yellow');
    }

    if (errors.length > 0) {
      log('\nFix ports in the configuration files before deploying.', 'blue');
      process.exit(1);
    } else {
      log('\nNo critical errors found.', 'green');
      process.exit(0);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`\nError reading configuration files: ${message}`, 'red');
  process.exit(1);
}
