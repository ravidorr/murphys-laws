#!/usr/bin/env node
/**
 * Port Validation Script
 *
 * Validates that ports are consistent across all configuration files:
 * - vite.config.js
 * - ecosystem.config.cjs
 * - nginx.conf
 *
 * Run this before deployment to catch port mismatches.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

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

function extractPort(content, pattern) {
  const match = content.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

try {
  log('\n🔍 Validating port configuration consistency...\n', 'blue');

  // Read vite.config.js
  const viteConfig = readFileSync(resolve(ROOT, 'vite.config.js'), 'utf-8');
  const vitePreviewPort = extractPort(viteConfig, /preview:\s*\{[^}]*port:\s*(\d+)/);
  const viteServerPort = extractPort(viteConfig, /server:\s*\{[^}]*port:\s*(\d+)/);

  // Read ecosystem.config.cjs
  const ecosystemConfig = readFileSync(resolve(ROOT, 'ecosystem.config.cjs'), 'utf-8');
  const ecosystemFrontendPort = extractPort(ecosystemConfig, /vite preview[^}]*--port\s+(\d+)/);

  // Read nginx.conf
  const nginxConfig = readFileSync(resolve(ROOT, 'nginx.conf'), 'utf-8');
  // Match first proxy_pass (frontend) and second proxy_pass (API)
  const proxyPassMatches = nginxConfig.matchAll(/proxy_pass\s+http:\/\/127\.0\.0\.1:(\d+)/g);
  const ports = Array.from(proxyPassMatches).map(m => parseInt(m[1], 10));
  const nginxFrontendPort = ports[0] || null;
  const nginxApiPort = ports[1] || null;

  // Read api-server.mjs for default port
  const apiServer = readFileSync(resolve(ROOT, 'scripts/api-server.mjs'), 'utf-8');
  const apiDefaultPort = extractPort(apiServer, /PORT\s*\|\|\s*(\d+)/);

  // Display found ports
  log('📋 Found Ports:', 'blue');
  console.log(`  vite.config.js (preview):     ${vitePreviewPort || 'NOT FOUND'}`);
  console.log(`  vite.config.js (server):      ${viteServerPort || 'NOT FOUND'}`);
  console.log(`  ecosystem.config.cjs:         ${ecosystemFrontendPort || 'NOT FOUND'}`);
  console.log(`  nginx.conf (frontend):        ${nginxFrontendPort || 'NOT FOUND'}`);
  console.log(`  nginx.conf (api):             ${nginxApiPort || 'NOT FOUND'}`);
  console.log(`  api-server.mjs (default):     ${apiDefaultPort || 'NOT FOUND'}`);

  // Validate frontend ports
  const errors = [];
  const warnings = [];

  if (vitePreviewPort !== ecosystemFrontendPort) {
    errors.push(`Frontend port mismatch: vite.config.js (${vitePreviewPort}) != ecosystem.config.cjs (${ecosystemFrontendPort})`);
  }

  if (vitePreviewPort !== nginxFrontendPort) {
    errors.push(`Frontend port mismatch: vite.config.js (${vitePreviewPort}) != nginx.conf (${nginxFrontendPort})`);
  }

  if (nginxApiPort !== apiDefaultPort) {
    warnings.push(`API port mismatch: nginx.conf (${nginxApiPort}) != api-server.mjs default (${apiDefaultPort})`);
  }

  // Report results
  console.log();
  if (errors.length === 0 && warnings.length === 0) {
    log('✅ All ports are consistent!', 'green');
    log(`   Frontend: ${vitePreviewPort}`, 'green');
    log(`   API: ${nginxApiPort}`, 'green');
    process.exit(0);
  } else {
    if (errors.length > 0) {
      log('❌ Port Configuration Errors:', 'red');
      errors.forEach(err => log(`   - ${err}`, 'red'));
    }
    if (warnings.length > 0) {
      log('\n⚠️  Port Configuration Warnings:', 'yellow');
      warnings.forEach(warn => log(`   - ${warn}`, 'yellow'));
      log('   (Warnings are OK if you set PORT env var on the droplet)', 'yellow');
    }

    if (errors.length > 0) {
      log('\n💡 Fix ports in the configuration files before deploying.', 'blue');
      process.exit(1);
    } else {
      log('\n✅ No critical errors found.', 'green');
      process.exit(0);
    }
  }
} catch (error) {
  log(`\n❌ Error reading configuration files: ${error.message}`, 'red');
  process.exit(1);
}
