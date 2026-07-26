const canonicalOrigin = process.env.SMOKE_BASE_URL || 'https://murphys-laws.com';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchResponse(url) {
  return fetch(url, { redirect: 'manual' });
}

async function expectRedirect(url, location) {
  const response = await fetchResponse(url);
  assert(response.status === 301, `${url}: expected 301, received ${response.status}`);
  assert(response.headers.get('location') === location, `${url}: expected Location ${location}, received ${response.headers.get('location')}`);
}

async function expectPage(route, { forbidMailto = false } = {}) {
  const url = `${canonicalOrigin}${route}`;
  const response = await fetchResponse(url);
  assert(response.status === 200, `${url}: expected 200, received ${response.status}`);
  const html = await response.text();
  assert(html.includes(`<link rel="canonical" href="${url}">`), `${url}: missing canonical link`);
  assert((html.match(/<h1\b/gi) || []).length === 1, `${url}: expected exactly one h1`);
  assert(!/Loading laws/i.test(html), `${url}: contains loading-only static content`);
  if (forbidMailto) assert(!/mailto:/i.test(html), `${url}: exposes a contributor email link`);
}

async function expectNotFound(route) {
  const url = `${canonicalOrigin}${route}`;
  const response = await fetchResponse(url);
  assert(response.status === 404, `${url}: expected 404, received ${response.status}`);
  const html = await response.text();
  assert(/<meta name="robots" content="noindex">/i.test(html), `${url}: 404 page must be noindex`);
}

await expectRedirect('http://murphys-laws.com/browse', `${canonicalOrigin}/browse`);
await expectRedirect('https://www.murphys-laws.com/browse', `${canonicalOrigin}/browse`);
await expectRedirect(`${canonicalOrigin}/submit/`, `${canonicalOrigin}/submit`);
await expectRedirect(`${canonicalOrigin}/calculator`, `${canonicalOrigin}/calculator/sods-law`);
await expectRedirect(`${canonicalOrigin}/toastcalculator`, `${canonicalOrigin}/calculator/buttered-toast`);
await expectRedirect(`${canonicalOrigin}/category/murphys-computers-laws`, `${canonicalOrigin}/category/murphys-computer-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-cars-4x4-laws`, `${canonicalOrigin}/category/murphys-4x4-car-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-cars-open-road-laws`, `${canonicalOrigin}/category/murphys-law-of-the-open-road`);
await expectRedirect(`${canonicalOrigin}/category/murphys-cowboy-action-shooting-laws`, `${canonicalOrigin}/category/murphys-cowboy-action-shooting-cas-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-helicopters-war-laws`, `${canonicalOrigin}/category/murphys-helicopters-warfare-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-marine-corp-laws`, `${canonicalOrigin}/category/murphys-marine-corps-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-mechanics-laws`, `${canonicalOrigin}/category/murphys-laws-of-mechanics`);
await expectRedirect(`${canonicalOrigin}/category/murphys-repairmen-laws`, `${canonicalOrigin}/category/murphys-repairmans-laws`);
await expectRedirect(`${canonicalOrigin}/category/murphys-tanks-war-laws`, `${canonicalOrigin}/category/murphys-tank-warfare-laws`);

await expectPage('/browse');
await expectPage('/categories');
await expectPage('/submit');
await expectPage('/calculator/sods-law');
await expectPage('/category/murphys-technology-laws', { forbidMailto: true });
await expectPage('/law/1354', { forbidMailto: true });
await expectNotFound('/definitely-not-a-real-page');

const api = await fetchResponse(`${canonicalOrigin}/api/v1/laws?limit=1`);
assert(api.ok, `API smoke check failed with ${api.status}`);

console.log(`Production smoke checks passed for ${canonicalOrigin}.`);
