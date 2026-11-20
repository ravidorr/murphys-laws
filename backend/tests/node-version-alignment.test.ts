import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..', '..');
const nvmrc = readFileSync(resolve(repoRoot, '.nvmrc'), 'utf8').trim();
const nvmNodeDir = `/root/.nvm/versions/node/v${nvmrc}/bin`;

describe('production Node version', () => {
  it('keeps .nvmrc a full x.y.z version', () => {
    expect(nvmrc).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('runs the API under the nvm node of .nvmrc', () => {
    const ecosystem = readFileSync(resolve(repoRoot, 'backend/ecosystem.config.cjs'), 'utf8');
    expect(ecosystem).toContain(`interpreter: '${nvmNodeDir}/node'`);
  });

  it('looks for pm2 in the nvm node of .nvmrc when the daily report cannot find it', () => {
    const report = readFileSync(resolve(repoRoot, 'backend/scripts/render-daily-report.ts'), 'utf8');
    expect(report).toContain(`const defaultPath = '${nvmNodeDir}/pm2';`);
  });
});
