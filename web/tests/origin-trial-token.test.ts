import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The WebMCP origin-trial token in web/index.html. Chrome ignores a token that is for another origin or feature,
// is third-party, or has expired, and then the tools silently disappear, so this reads the token itself.
// It does not verify the signature: a hand-edited payload would still pass here and be rejected by Chrome.
// To renew: register at https://developer.chrome.com/origintrials/ for https://murphys-laws.com with
// subdomain matching ON and third-party matching OFF, and replace the token in index.html.

/** Warn from this far out, so the renewal is seen before CI turns red. */
const WARN_DAYS_BEFORE_EXPIRY = 45;
/** Fail below this, because the tools are about to disappear. */
const FAIL_DAYS_BEFORE_EXPIRY = 7;

interface OriginTrialPayload {
  origin: string;
  feature: string;
  expiry: number;
  isSubdomain?: boolean;
  isThirdParty?: boolean;
}

function readToken(): OriginTrialPayload {
  const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf-8');
  const tags = new DOMParser().parseFromString(html, 'text/html').querySelectorAll('meta[http-equiv="origin-trial"]');
  expect(tags, 'index.html needs exactly one origin-trial meta tag').toHaveLength(1);
  const bytes = Buffer.from(tags[0]!.getAttribute('content') ?? '', 'base64');
  // Version byte, 64-byte signature, 4-byte payload length, then the JSON payload
  expect(bytes.length, 'the origin-trial token is too short to be a token').toBeGreaterThan(69);
  expect([2, 3], 'unexpected origin-trial token version').toContain(bytes[0]);
  const length = bytes.readUInt32BE(65);
  expect(bytes.length, 'the origin-trial token payload length does not match the token').toBe(69 + length);
  return JSON.parse(bytes.subarray(69, 69 + length).toString('utf-8'));
}

describe('WebMCP origin-trial token', () => {
  it('is a first-party WebMCP token for the production origin, subdomains included', () => {
    const token = readToken();
    expect(token.feature).toBe('WebMCP');
    expect(token.origin).toBe('https://murphys-laws.com:443');
    expect(token.isSubdomain).toBe(true);
    expect(token.isThirdParty).not.toBe(true);
  });

  it(`has more than ${FAIL_DAYS_BEFORE_EXPIRY} days left (warns below ${WARN_DAYS_BEFORE_EXPIRY})`, () => {
    const daysLeft = (readToken().expiry - Date.now() / 1000) / 86400;
    if (daysLeft <= WARN_DAYS_BEFORE_EXPIRY) {
      console.warn(`The WebMCP origin-trial token expires in ${Math.floor(daysLeft)} days. Renew it (see the top of this file).`);
    }
    expect(daysLeft, 'renew the WebMCP origin-trial token (see the comment at the top of this file)').toBeGreaterThan(
      FAIL_DAYS_BEFORE_EXPIRY,
    );
  });
});
