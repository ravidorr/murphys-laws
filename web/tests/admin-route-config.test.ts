import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('admin UI route configuration', () => {
  it('nginx proxies an exact /admin location to the API and hides disabled-page errors', () => {
    const conf = read('nginx.conf');
    const start = conf.indexOf('location = /admin {');
    expect(start).toBeGreaterThan(-1);
    const block = conf.slice(start, conf.indexOf('}', start));

    expect(block).toContain('proxy_pass http://127.0.0.1:8787;');
    expect(block).toContain('proxy_intercept_errors on;');
    for (const header of ['Host', 'X-Real-IP', 'X-Forwarded-For', 'X-Forwarded-Proto']) {
      expect(block).toContain(`proxy_set_header ${header}`);
    }
  });

  it('nginx still redirects /admin/ to /admin before location matching', () => {
    expect(read('nginx.conf')).toContain('rewrite ^/(.+)/$ /$1 permanent;');
  });

  it('robots.txt keeps crawlers out of /admin for all agents', () => {
    const robots = read('web/public/robots.txt');
    const allAgents = robots.slice(robots.indexOf('User-agent: *'), robots.indexOf('# Sitemap locations'));

    expect(allAgents).toContain('Disallow: /admin');
    expect(allAgents).toContain('Disallow: /api/');
  });

  it('the Vite dev server proxies /admin to the API like /api', () => {
    const config = read('web/vite.config.ts');
    const dev = config.slice(config.indexOf('server: {'), config.indexOf('preview: {'));

    expect(dev).toMatch(/'\/api': \{\s+target: 'http:\/\/127\.0\.0\.1:8787'/);
    expect(dev).toMatch(/'\/admin': \{\s+target: 'http:\/\/127\.0\.0\.1:8787'/);
  });
});
