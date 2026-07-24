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

await expectRedirect('http://murphys-laws.com/browse', `${canonicalOrigin}/browse`);
await expectRedirect('https://www.murphys-laws.com/browse', `${canonicalOrigin}/browse`);
await expectRedirect(`${canonicalOrigin}/submit/`, `${canonicalOrigin}/submit`);

await expectPage('/browse');
await expectPage('/categories');
await expectPage('/submit');
await expectPage('/calculator/sods-law');
await expectPage('/category/murphys-technology-laws', { forbidMailto: true });
await expectPage('/law/1354', { forbidMailto: true });

const api = await fetchResponse(`${canonicalOrigin}/api/v1/laws?limit=1`);
assert(api.ok, `API smoke check failed with ${api.status}`);

console.log(`Production smoke checks passed for ${canonicalOrigin}.`);
