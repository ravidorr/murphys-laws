import { describe, expect, it } from 'vitest';
import type { ResolvedConfig } from 'vite';
import { API_BASE_PLACEHOLDER, earlyApiBasePlugin, injectEarlyApiBase } from '../scripts/early-api-base.ts';

const SCRIPT = `var url = '${API_BASE_PLACEHOLDER}/api/v1/law-of-day';`;

describe('injectEarlyApiBase', () => {
  it('leaves the same origin for an unset base', () => {
    expect(injectEarlyApiBase(SCRIPT, '')).toBe("var url = '/api/v1/law-of-day';");
  });

  it('puts the configured API base in front of the path', () => {
    expect(injectEarlyApiBase(SCRIPT, 'https://api.example.com')).toBe("var url = 'https://api.example.com/api/v1/law-of-day';");
  });

  it('writes the base as string content that cannot end the string or the script', () => {
    const base = `https://x.test/'"</script>&\\`;
    const result = injectEarlyApiBase(`return '${API_BASE_PLACEHOLDER}/api/v1/law-of-day';`, base);

    expect(result).not.toContain('</script>');
    expect(new Function(result)()).toBe(`${base}/api/v1/law-of-day`);
  });

  it('replaces every placeholder', () => {
    expect(injectEarlyApiBase(`${SCRIPT}${SCRIPT}`, 'https://a.test').match(/https:\/\/a\.test/g)).toHaveLength(2);
  });
});

describe('earlyApiBasePlugin', () => {
  const transform = (env: Record<string, unknown>, html: string) => {
    const plugin = earlyApiBasePlugin();
    (plugin.configResolved as (config: ResolvedConfig) => void)({ env } as unknown as ResolvedConfig);
    const hook = plugin.transformIndexHtml as { handler: (html: string) => string };
    return hook.handler(html);
  };

  it('injects VITE_API_URL', () => {
    expect(transform({ VITE_API_URL: 'https://api.example.com' }, SCRIPT)).toContain("'https://api.example.com/api/v1/law-of-day'");
  });

  it('keeps the same origin when VITE_API_URL is unset', () => {
    expect(transform({}, SCRIPT)).toBe("var url = '/api/v1/law-of-day';");
  });

  it('runs before the other HTML transforms', () => {
    expect((earlyApiBasePlugin().transformIndexHtml as { order: string }).order).toBe('pre');
  });
});
