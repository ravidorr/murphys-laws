import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The WebMCP origin-trial token in web/index.html. Chrome ignores a token that is for another origin or feature,
// is third-party, or has expired, and then the tools silently disappear, so this reads the token itself.
// To renew: register at https://developer.chrome.com/origintrials/ for https://murphys-laws.com with
// third-party matching OFF, and replace the token in index.html.

const RENEW_DAYS_BEFORE_EXPIRY = 14;

function readToken(): { origin: string; feature: string; expiry: number; isSubdomain?: boolean; isThirdParty?: boolean } {
  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf-8');
  const match = /<meta http-equiv="origin-trial" content="([^"]+)">/.exec(html);
  expect(match, 'index.html needs an origin-trial meta tag').not.toBeNull();
  const bytes = Buffer.from(match![1]!, 'base64');
  // Version byte, 64-byte signature, 4-byte payload length, then the JSON payload
  const length = bytes.readUInt32BE(65);
  return JSON.parse(bytes.subarray(69, 69 + length).toString('utf-8'));
}

describe('WebMCP origin-trial token', () => {
  it('is a first-party WebMCP token for the production origin', () => {
    const token = readToken();
    expect(token.feature).toBe('WebMCP');
    expect(token.origin).toBe('https://murphys-laws.com:443');
    expect(token.isThirdParty).toBeUndefined();
  });

  it(`is valid for at least ${RENEW_DAYS_BEFORE_EXPIRY} more days`, () => {
    const secondsLeft = readToken().expiry - Date.now() / 1000;
    expect(secondsLeft / 86400, 'renew the WebMCP origin-trial token (see the comment at the top of this file)').toBeGreaterThan(
      RENEW_DAYS_BEFORE_EXPIRY,
    );
  });
});
