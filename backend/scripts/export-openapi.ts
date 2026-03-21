/**
 * Build script: exports the OpenAPI spec to web/public/openapi.json
 *
 * Run via: npx tsx backend/scripts/export-openapi.ts
 * Wired into the root "build:openapi" npm script.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENAPI_SPEC } from '../src/openapi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outputPath = resolve(__dirname, '..', '..', 'web', 'public', 'openapi.json');
writeFileSync(outputPath, JSON.stringify(OPENAPI_SPEC, null, 2) + '\n', 'utf-8');
console.log(`OpenAPI spec written to ${outputPath}`);
