import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface FileScanLocalThis {
  root?: string;
  content?: string;
}

const root = path.resolve(__dirname, '..');

function readWebFile(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('design-token leftovers', () => {
  it.each([
    ['index.html'],
    ['public/404.html'],
    ['public/offline.html'],
  ])('keeps critical CSS aligned with current DS values in %s', (relativePath) => {
    const localThis: FileScanLocalThis = {};
    localThis.content = readWebFile(relativePath);

    expect(localThis.content).toContain('--btn-primary-bg: #0d5ea1;');
    expect(localThis.content).toContain('--muted-fg: #4b5563;');
    expect(localThis.content).toContain('--primary: #6366f1;');
    expect(localThis.content).not.toContain('--btn-primary-bg: #1173d4;');
    expect(localThis.content).not.toContain('--muted-fg: #6b7280;');
    expect(localThis.content).not.toContain('--primary: #4f46e5;');
  });

  it('defines canonical card variants with compatibility aliases', () => {
    const components = readWebFile('styles/partials/components.css');
    expect(components).toContain('.card--section');
    expect(components).toContain('.section-card');
    expect(components).toContain('.card--content');
    expect(components).toContain('.content-card');
    expect(components).toContain('.card--law-list');
    expect(components).toContain('.law-list-card');
    expect(components).toContain('.card--empty');
    expect(components).toContain('.card-body--flush');
  });

  it('does not keep stale implementation colors outside variables.css', () => {
    const localThis: FileScanLocalThis = {};
    localThis.root = root;
    const files = [
      'styles/partials/update-notification.css',
      'styles/partials/layout.css',
      'styles/partials/components.css',
      'styles/partials/sections.css',
    ];
    const banned = [
      '#1173d4',
      'rgb(17 115 212',
      '#e91e63',
      '#1f2937',
      '#f9fafb',
    ];

    for (const file of files) {
      localThis.content = readWebFile(file);
      for (const value of banned) {
        expect(localThis.content, `${file} still contains ${value}`).not.toContain(value);
      }
    }
  });

  it('keeps social brand colors in shared CSS variables only', () => {
    const localThis: FileScanLocalThis = {};
    localThis.content = readWebFile('styles/partials/variables.css');

    expect(localThis.content).toContain('--brand-social-x: #000;');
    expect(localThis.content).toContain('--brand-social-facebook: #1877f2;');
    expect(localThis.content).toContain('--brand-social-linkedin: #0a66c2;');
    expect(localThis.content).toContain('--brand-social-reddit: #ff4500;');
    expect(localThis.content).toContain('--brand-social-email: #4b5563;');
    expect(localThis.content).toContain('--brand-social-icon-fg: #fff;');
  });
});
