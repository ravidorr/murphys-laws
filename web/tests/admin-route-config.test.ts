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

  it('robots.txt repeats the /admin disallow in every named crawler group', () => {
    const robots = read('web/public/robots.txt');
    const namedGroups = robots
      .split(/\n\s*\n/)
      .filter((group) => /^User-agent: (?!\*)/m.test(group));

    expect(namedGroups.length).toBeGreaterThan(0);
    for (const group of namedGroups) {
      expect(group).toContain('Disallow: /admin');
    }
  });

  it('the Vite dev and preview servers proxy /admin to the API like /api', () => {
    const config = read('web/vite.config.ts');
    const sections = {
      dev: config.slice(config.indexOf('server: {'), config.indexOf('preview: {')),
      preview: config.slice(config.indexOf('preview: {'), config.indexOf('resolve: {')),
    };

    for (const section of Object.values(sections)) {
      expect(section).toMatch(/'\/api': \{\s+target: 'http:\/\/127\.0\.0\.1:8787'/);
      expect(section).toMatch(/'\/admin': \{\s+target: 'http:\/\/127\.0\.0\.1:8787'/);
    }
  });
});
