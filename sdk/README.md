# murphys-laws-sdk

[![npm version](https://img.shields.io/npm/v/murphys-laws-sdk.svg)](https://www.npmjs.com/package/murphys-laws-sdk)
[![npm downloads](https://img.shields.io/npm/dm/murphys-laws-sdk.svg)](https://www.npmjs.com/package/murphys-laws-sdk)
[![CI](https://github.com/ravidorr/murphys-laws/actions/workflows/sdk-ci.yml/badge.svg)](https://github.com/ravidorr/murphys-laws/actions/workflows/sdk-ci.yml)
[![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/ravidorr/murphys-laws/actions/workflows/sdk-ci.yml)
[![license](https://img.shields.io/npm/l/murphys-laws-sdk.svg)](https://creativecommons.org/publicdomain/zero/1.0/)

Tiny TypeScript SDK for the public [Murphy's Laws](https://murphys-laws.com) REST API.

No runtime dependencies. Uses the platform `fetch`.

## Install

```bash
npm install murphys-laws-sdk
```

Requires Node.js 22+ (or any modern browser with `fetch`).

## Usage

```ts
import { MurphysLawsClient } from 'murphys-laws-sdk';

const client = new MurphysLawsClient();

const random = await client.getRandomLaw();
console.log(random.text);

const results = await client.searchLaws({ q: 'debug', limit: 5 });
for (const law of results.data) {
  console.log(`#${law.id}: ${law.text}`);
}
```

## Options

```ts
new MurphysLawsClient({
  baseUrl: 'http://127.0.0.1:8787',
  userAgent: 'my-app/1.0.0',
  fetch: customFetch,
});
```

- `baseUrl` defaults to `https://murphys-laws.com`.
- `userAgent` defaults to `murphys-laws-sdk`. Override for your app per the
  API's User-Agent guidance.
- `fetch` defaults to `globalThis.fetch`. Inject your own for tests.

## API

| Method | Endpoint |
|--------|----------|
| `searchLaws(params)` | `GET /api/v1/laws` |
| `getRandomLaw()` | `GET /api/v1/laws/random` |
| `getLawOfTheDay()` | `GET /api/v1/law-of-day` |
| `getLaw(idOrSlug)` | `GET /api/v1/laws/:id` |
| `listCategories()` | `GET /api/v1/categories` |
| `getLawsByCategory(slug, params?)` | `GET /api/v1/laws?category_slug=...` |
| `submitLaw(input)` | `POST /api/v1/laws` |

`submitLaw` returns a discriminated `SubmitLawResult` union so you can handle
success, validation errors, and rate limiting without catching exceptions.

Network and unexpected non-2xx GET responses throw `ApiError` with `status`
and `body`.

## Cookbook

Real patterns, not toy examples.

### Paginate search results

```ts
const client = new MurphysLawsClient();
const PAGE_SIZE = 25;

async function *allResults(q: string) {
  let offset = 0;
  while (true) {
    const page = await client.searchLaws({ q, limit: PAGE_SIZE, offset });
    for (const law of page.data) yield law;
    offset += page.data.length;
    if (offset >= page.total || page.data.length === 0) return;
  }
}

for await (const law of allResults('computer')) {
  console.log(law.id, law.text);
}
```

### Handle submissions without `try/catch`

```ts
const result = await client.submitLaw({
  text: "Anything that can go wrong, will, and at the worst possible time.",
  author: 'Jane Doe',
  category_slug: 'computers',
});

switch (result.kind) {
  case 'success':
    console.log('submitted', result.data.id);
    break;
  case 'rate_limited':
    console.warn(`back off ${result.retryAfter}s`);
    break;
  case 'validation_error':
    console.error('rejected:', result.error);
    break;
  case 'unexpected_error':
    console.error(`unknown status ${result.status}:`, result.error);
    break;
}
```

### Tag your client with a meaningful User-Agent

The public API rate-limits requests with a generic User-Agent more
aggressively. Always identify your app.

```ts
const client = new MurphysLawsClient({
  userAgent: 'my-startup-etl/0.2 (contact: data@my-startup.example)',
});
```

### Run against a local backend

```ts
const client = new MurphysLawsClient({
  baseUrl: 'http://127.0.0.1:8787',
});
```

### Inject `fetch` for deterministic tests

```ts
const calls: string[] = [];
const client = new MurphysLawsClient({
  fetch: (url, init) => {
    calls.push(url.toString());
    return Promise.resolve(new Response(JSON.stringify({ id: 1, text: 'fake' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  },
});

await client.getRandomLaw();
// calls is now ['https://murphys-laws.com/api/v1/laws/random']
```

### Catch `ApiError` only when you need the status

```ts
import { ApiError } from 'murphys-laws-sdk';

try {
  const law = await client.getLaw(999999);
  console.log(law.text);
} catch (err) {
  if (err instanceof ApiError && err.status === 404) {
    console.log('no such law');
  } else {
    throw err;
  }
}
```

## License

CC0-1.0.
