# Murphy's Laws API Documentation

REST API for the Murphy's Laws Archive. All endpoints return JSON unless otherwise noted.

**Base URL:** `https://murphys-laws.com` (production) or `http://127.0.0.1:8787` (development)

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Laws](#laws)
  - [Voting](#voting)
  - [Categories](#categories)
  - [Attributions](#attributions)
  - [Feeds](#feeds)
- [Error Responses](#error-responses)
- [Data Models](#data-models)

---

## Authentication

The API is publicly accessible. No authentication is required for read operations.

Write operations (submitting laws, voting) use IP-based identification for rate limiting.

---

## Rate Limiting

Rate limits are enforced on write operations:

| Operation | Limit |
|-----------|-------|
| Submit law | 5 per hour per IP |
| Vote | 60 per hour per IP |

When rate limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

---

## Endpoints

### Health

#### GET /api/health

Health check endpoint for monitoring.

**Response:**

```json
{
  "ok": true,
  "dbQueryTime": 2
}
```

**Error Response (503):**

```json
{
  "ok": false,
  "error": "Database unavailable",
  "dbError": "Error message"
}
```

---

### Laws

#### GET /api/v1/laws

List laws with pagination, filtering, and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 25 | Results per page (max: 25) |
| `offset` | integer | 0 | Pagination offset |
| `q` | string | - | Search query (searches text and title) |
| `category_id` | integer | - | Filter by category ID |
| `category_slug` | string | - | Filter by category slug |
| `attribution` | string | - | Filter by attribution name (partial match) |
| `sort` | string | `score` | Sort field: `score`, `upvotes`, `created_at`, `last_voted_at` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "title": "Murphy's Law",
      "text": "Anything that can go wrong will go wrong.",
      "file_path": "murphys-laws.md",
      "line_number": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "attributions": [
        {
          "name": "Edward A. Murphy Jr.",
          "contact_type": "text",
          "contact_value": null,
          "note": null
        }
      ],
      "upvotes": 150,
      "downvotes": 5,
      "score": 145
    }
  ],
  "limit": 25,
  "offset": 0,
  "total": 1500,
  "q": "",
  "category_id": null,
  "category_slug": null,
  "attribution": "",
  "sort": "score",
  "order": "desc"
}
```

---

#### GET /api/v1/laws/suggestions

Get search suggestions for autocomplete. Returns top matching laws based on search query.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (minimum 2 characters) |
| `limit` | integer | No | 10 | Number of suggestions to return (max: 20) |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "text": "Anything that can go wrong will go wrong.",
      "title": "Murphy's Law",
      "score": 145
    },
    {
      "id": 2,
      "text": "If anything can go wrong, it will.",
      "title": null,
      "score": 120
    }
  ]
}
```

**Response Fields:**

- `id` (integer): Law ID
- `text` (string): Law text
- `title` (string, nullable): Law title (if available)
- `score` (integer): Law score (upvotes - downvotes)

**Error Responses:**

- `400 Bad Request` - Query parameter missing or shorter than 2 characters

**Notes:**

- Results are prioritized by text matches over title matches
- Results are sorted by score (descending) after matching priority
- Only published laws are returned
- Optimized for fast autocomplete responses

---

#### GET /api/v1/laws/:id

Get a single law by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Law ID |

**Response:**

```json
{
  "id": 1,
  "title": "Murphy's Law",
  "text": "Anything that can go wrong will go wrong.",
  "file_path": "murphys-laws.md",
  "line_number": 1,
  "attributions": [
    {
      "name": "Edward A. Murphy Jr.",
      "contact_type": "text",
      "contact_value": null,
      "note": null
    }
  ],
  "upvotes": 150,
  "downvotes": 5,
  "category_id": 1,
  "category_ids": [1, 5]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `category_id` | integer or null | Primary category ID (first category, for backward compatibility) |
| `category_ids` | array | Array of all category IDs the law belongs to |

**Error Responses:**

- `400 Bad Request` - Invalid law ID
- `404 Not Found` - Law not found

---

#### GET /api/v1/laws/:id/related

Get related laws from the same category(ies) as the specified law, sorted by score.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Law ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 5 | Number of related laws to return (1-10) |

**Response:**

```json
{
  "data": [
    {
      "id": 2,
      "title": "Murphy's Extended Law",
      "text": "Everything that can go wrong will go wrong at the worst possible time.",
      "upvotes": 120,
      "downvotes": 3,
      "score": 117
    },
    {
      "id": 5,
      "title": "O'Toole's Commentary",
      "text": "Murphy was an optimist.",
      "upvotes": 95,
      "downvotes": 2,
      "score": 93
    }
  ],
  "law_id": 1
}
```

**Notes:**

- Returns laws from the same category(ies) as the specified law
- Excludes the specified law from results
- Only returns published laws
- Returns empty array if the law has no categories or no related laws exist

**Error Responses:**

- `400 Bad Request` - Invalid law ID

---

#### POST /api/v1/laws

Submit a new law for review.

**Request Body:**

```json
{
  "text": "Everything that can go wrong will go wrong at the worst possible time.",
  "title": "Murphy's Extended Law",
  "author": "John Doe",
  "email": "john@example.com",
  "category_id": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Law text (10-1000 characters) |
| `title` | string | No | Optional title for the law |
| `author` | string | No | Author/submitter name |
| `email` | string | No | Author email (for attribution) |
| `category_id` | integer | No | Category to assign the law to |

**Response (201):**

```json
{
  "id": 1501,
  "title": "Murphy's Extended Law",
  "text": "Everything that can go wrong will go wrong at the worst possible time.",
  "status": "in_review",
  "message": "Law submitted successfully and is pending review"
}
```

**Error Responses:**

- `400 Bad Request` - Validation error (text too short/long, invalid category)
- `429 Too Many Requests` - Rate limit exceeded

---

#### GET /api/v1/law-of-day

Get the Law of the Day. A new law is selected daily based on upvotes, avoiding recently featured laws.

**Response:**

```json
{
  "law": {
    "id": 42,
    "title": "Cole's Law",
    "text": "Thinly sliced cabbage.",
    "file_path": "murphys-laws.md",
    "line_number": 42,
    "attributions": [],
    "upvotes": 200,
    "downvotes": 10
  },
  "featured_date": "2024-01-15"
}
```

**Error Response (404):**

```json
{
  "error": "No published laws available"
}
```

---

### Voting

#### POST /api/v1/laws/:id/vote

Vote on a law (upvote or downvote). Replaces any existing vote.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Law ID |

**Request Body:**

```json
{
  "vote_type": "up"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `vote_type` | string | Yes | `"up"` or `"down"` |

**Response:**

```json
{
  "law_id": 42,
  "vote_type": "up",
  "upvotes": 201,
  "downvotes": 10
}
```

**Error Responses:**

- `400 Bad Request` - Invalid vote_type
- `404 Not Found` - Law not found
- `429 Too Many Requests` - Rate limit exceeded

---

#### DELETE /api/v1/laws/:id/vote

Remove your vote from a law.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Law ID |

**Response:**

```json
{
  "law_id": 42,
  "upvotes": 200,
  "downvotes": 10
}
```

**Error Responses:**

- `404 Not Found` - Law not found
- `429 Too Many Requests` - Rate limit exceeded

---

### Categories

#### GET /api/v1/categories

List all categories.

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "slug": "murphys-laws",
      "title": "Murphy's Laws",
      "law_count": 150
    },
    {
      "id": 2,
      "slug": "murphys-technology-laws",
      "title": "Murphy's Technology Laws",
      "law_count": 45
    }
  ]
}
```

---

#### GET /api/v1/categories/:id

Get a single category by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Category ID |

**Response:**

```json
{
  "id": 1,
  "slug": "murphys-laws",
  "title": "Murphy's Laws",
  "law_count": 150
}
```

**Error Response (404):**

```json
{
  "error": "Category not found"
}
```

---

### Attributions

#### GET /api/v1/attributions

List all unique attribution names (law contributors).

**Response:**

```json
{
  "data": [
    "Edward A. Murphy Jr.",
    "John Doe",
    "Jane Smith"
  ]
}
```

---

### Feeds

#### GET /api/v1/feed.rss

RSS 2.0 feed containing the Law of the Day and 10 most recent laws.

**Response:**

- Content-Type: `application/rss+xml; charset=utf-8`
- Cache-Control: `public, max-age=3600`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Murphy's Law Archive</title>
    <link>https://murphys-laws.com</link>
    <description>Explore Murphy's Law history...</description>
    <language>en-us</language>
    <lastBuildDate>Mon, 15 Jan 2024 12:00:00 GMT</lastBuildDate>
    <atom:link href="https://murphys-laws.com/api/v1/feed.rss" rel="self" type="application/rss+xml"/>
    <item>
      <title>[Law of the Day] Murphy's Law</title>
      <link>https://murphys-laws.com/#/law:1</link>
      <description>Anything that can go wrong will go wrong.</description>
      <pubDate>Mon, 15 Jan 2024 00:00:00 GMT</pubDate>
      <guid isPermaLink="false">law-1</guid>
      <author>Edward A. Murphy Jr.</author>
    </item>
    <!-- More items... -->
  </channel>
</rss>
```

---

#### GET /api/v1/feed.atom

Atom 1.0 feed containing the Law of the Day and 10 most recent laws.

**Response:**

- Content-Type: `application/atom+xml; charset=utf-8`
- Cache-Control: `public, max-age=3600`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Murphy's Law Archive</title>
  <subtitle>Explore Murphy's Law history...</subtitle>
  <link href="https://murphys-laws.com" rel="alternate"/>
  <link href="https://murphys-laws.com/api/v1/feed.atom" rel="self" type="application/atom+xml"/>
  <id>https://murphys-laws.com/</id>
  <updated>2024-01-15T12:00:00.000Z</updated>
  <entry>
    <title>[Law of the Day] Murphy's Law</title>
    <link href="https://murphys-laws.com/#/law:1" rel="alternate"/>
    <id>https://murphys-laws.com/law/1</id>
    <updated>2024-01-15T00:00:00.000Z</updated>
    <content type="text">Anything that can go wrong will go wrong.</content>
    <author>
      <name>Edward A. Murphy Jr.</name>
    </author>
  </entry>
  <!-- More entries... -->
</feed>
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created (for POST requests) |
| `400` | Bad Request - Invalid parameters or validation error |
| `404` | Not Found - Resource does not exist |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |
| `503` | Service Unavailable - Database unavailable |

---

## Data Models

### Law

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `title` | string | Optional title (e.g., "Murphy's Law") |
| `text` | string | The law text |
| `file_path` | string | Source file path |
| `line_number` | integer | Line number in source file |
| `created_at` | string | ISO 8601 timestamp |
| `attributions` | array | List of attributions |
| `upvotes` | integer | Number of upvotes |
| `downvotes` | integer | Number of downvotes |
| `score` | integer | upvotes - downvotes (in list responses) |
| `category_id` | integer or null | Primary category ID (in single law responses) |
| `category_ids` | array | All category IDs (in single law responses) |

### Attribution

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Contributor name |
| `contact_type` | string | Type: `"email"`, `"url"`, or `"text"` |
| `contact_value` | string | Contact information (may be null) |
| `note` | string | Optional note about the attribution |

### Category

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier |
| `slug` | string | URL-friendly identifier |
| `title` | string | Display name |
| `law_count` | integer | Number of laws in category |

---

## CORS

The API supports Cross-Origin Resource Sharing (CORS) for all origins. All responses include:

```
Access-Control-Allow-Origin: *
```

---

## Examples

### Fetch laws sorted by newest first

```bash
curl "https://murphys-laws.com/api/v1/laws?sort=created_at&order=desc&limit=10"
```

### Search for laws containing "computer"

```bash
curl "https://murphys-laws.com/api/v1/laws?q=computer"
```

### Get laws in a specific category

```bash
curl "https://murphys-laws.com/api/v1/laws?category_slug=murphys-technology-laws"
```

### Get related laws

```bash
curl "https://murphys-laws.com/api/v1/laws/1/related?limit=3"
```

### Submit a new law

```bash
curl -X POST "https://murphys-laws.com/api/v1/laws" \
  -H "Content-Type: application/json" \
  -d '{"text": "The probability of a bug increases with the number of lines of code.", "author": "Anonymous Developer"}'
```

### Vote on a law

```bash
curl -X POST "https://murphys-laws.com/api/v1/laws/42/vote" \
  -H "Content-Type: application/json" \
  -d '{"vote_type": "up"}'
```

### Subscribe to the RSS feed

```
https://murphys-laws.com/api/v1/feed.rss
```
