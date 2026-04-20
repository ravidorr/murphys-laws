# murphys-laws-sdk

[![npm version](https://img.shields.io/npm/v/murphys-laws-sdk.svg)](https://www.npmjs.com/package/murphys-laws-sdk)
[![npm downloads](https://img.shields.io/npm/dm/murphys-laws-sdk.svg)](https://www.npmjs.com/package/murphys-laws-sdk)
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

## License

CC0-1.0.
