# API Endpoints Used by Frontend

This document lists all API endpoints used by the Murphy's Laws frontend application. All endpoints are versioned with `/api/v1/` prefix for mobile app support.

## Base URLs

- **Primary API**: Configured via `API_BASE_URL` (from `VITE_API_URL` or `API_URL` env var, defaults to empty string)
- **Fallback API**: Configured via `API_FALLBACK_URL` (from `VITE_API_FALLBACK_URL` or `API_FALLBACK_URL` env var, defaults to `http://127.0.0.1:8787`)

## API Versioning

All API endpoints use the `/api/v1/` prefix:
- **Versioned endpoints**: `/api/v1/{endpoint}` - Use this for all API calls

The frontend uses `/api/v1/` endpoints by default. Mobile apps should also use `/api/v1/` endpoints.

## API Endpoints

### 1. Laws Endpoints

#### GET `/api/v1/laws`
Fetch laws with pagination, sorting, and filtering.

**Query Parameters:**
- `limit` (number): Number of laws to fetch (default: 25)
- `offset` (number): Offset for pagination (default: 0)
- `sort` (string): Sort field - `'score'`, `'upvotes'`, `'last_voted_at'`, `'created_at'` (default: `'score'`)
- `order` (string): Sort order - `'asc'` or `'desc'` (default: `'desc'`)
- `q` (string): Search query text (optional)
- `category_id` (number): Filter by category ID (optional)
- `attribution` (string): Filter by attribution name (optional)

**Response:**
```json
{
 "data": [/* array of law objects */],
 "total": 1234,
 "limit": 25,
 "offset": 0
}
```

**Used in:**
- `web/src/utils/api.ts` - `fetchLaws()` function
- `web/src/views/browse.ts` - Browse page with pagination
- `web/src/components/top-voted.ts` - Top voted laws widget
- `web/src/components/trending.ts` - Trending laws widget
- `web/src/components/recently-added.ts` - Recently added laws widget

---

#### GET `/api/v1/laws/suggestions`
Fetch search suggestions for autocomplete as user types.

**Query Parameters:**
- `q` (string, required): Search query text (minimum 2 characters)
- `limit` (number, optional): Number of suggestions to return (default: 10, max: 20)

**Response:**
```json
{
 "data": [
   {
     "id": 1,
     "text": "Law text...",
     "title": "Law title (optional)",
     "score": 5
   }
 ]
}
```

**Used in:**
- `web/src/utils/api.ts` - `fetchSuggestions()` function
- `web/src/components/search-autocomplete.ts` - Header search autocomplete dropdown

---

#### GET `/api/v1/laws/{id}`
Fetch a single law by ID.

**Path Parameters:**
- `id` (number): Law ID

**Response:**
```json
{
 "id": 1,
 "text": "Law text...",
 "title": "Law title",
 "author": "Author name",
 "upvotes": 10,
 "downvotes": 2,
 "attributions": [/* array of attribution objects */],
 "submittedBy": "Submitter name",
 "created_at": "2024-01-01T00:00:00Z",
 "category_id": 1,
 "category_ids": [1, 5]
}
```

**Used in:**
- `web/src/utils/api.ts` - `fetchLaw()` function
- `web/src/views/law-detail.ts` - Law detail page

---

#### GET `/api/v1/laws/{id}/related`
Fetch related laws from the same category(ies).

**Path Parameters:**
- `id` (number): Law ID

**Query Parameters:**
- `limit` (number): Number of related laws to return (1-10, default: 5)

**Response:**
```json
{
 "data": [
   {
     "id": 2,
     "title": "Related Law Title",
     "text": "Related law text...",
     "upvotes": 15,
     "downvotes": 1,
     "score": 14
   }
 ],
 "law_id": 1
}
```

**Used in:**
- `web/src/utils/api.ts` - `fetchRelatedLaws()` function
- `web/src/views/law-detail.ts` - Law detail page related laws section

---

#### POST `/api/v1/laws`
Submit a new law for review.

**Request Body:**
```json
{
 "text": "Law text (required, min 10 chars)",
 "title": "Law title (optional)",
 "author": "Author name (optional)",
 "email": "author@example.com (optional)",
 "category_id": 1
}
```

**Response:**
```json
{
 "id": 123,
 "title": "Law title",
 "text": "Law text",
 "status": "in_review",
 "message": "Law submitted successfully and is pending review"
}
```

**Used in:**
- `web/src/components/submit-law.ts` - Submit law form

---

### 2. Voting Endpoints

#### POST `/api/v1/laws/{id}/vote`
Vote on a law (upvote or downvote).

**Path Parameters:**
- `id` (number): Law ID

**Request Body:**
```json
{
 "vote_type": "up" // or "down"
}
```

**Response:**
```json
{
 "law_id": 123,
 "vote_type": "up",
 "upvotes": 10,
 "downvotes": 2
}
```

**Used in:**
- `web/src/utils/voting.ts` - `voteLaw()` function
- `web/src/views/law-detail.ts` - Law detail page voting
- `web/src/views/browse.ts` - Browse page voting (via `addVotingListeners()`)

---

#### DELETE `/api/v1/laws/{id}/vote`
Remove vote from a law.

**Path Parameters:**
- `id` (number): Law ID

**Response:**
```json
{
 "law_id": 123,
 "upvotes": 9,
 "downvotes": 2
}
```

**Used in:**
- `web/src/utils/voting.ts` - `unvoteLaw()` function
- `web/src/views/law-detail.ts` - Law detail page voting
- `web/src/views/browse.ts` - Browse page voting (via `addVotingListeners()`)

---

### 3. Law of the Day Endpoint

#### GET `/api/v1/law-of-day`
Get the law of the day (daily rotating law selected by algorithm).

**Response:**
```json
{
 "law": {
 "id": 1,
 "text": "Law text...",
 // ... other law fields
 }
}
```

**Note:** The frontend wraps this in a format compatible with `fetchLaws()`:
```json
{
 "data": [/* law object */],
 "total": 1,
 "limit": 1,
 "offset": 0
}
```

**Used in:**
- `web/src/utils/api.ts` - `fetchLawOfTheDay()` function
- `web/src/views/home.ts` - Home page "Law of the Day" widget

---

### 4. Categories Endpoints

#### GET `/api/v1/categories`
Get all categories.

**Response:**
```json
{
 "data": [
 {
 "id": 1,
 "title": "Category Name",
 // ... other fields
 }
 ]
}
```

**Used in:**
- `web/src/components/advanced-search.ts` - Advanced search filters
- `web/src/components/submit-law.ts` - Submit law form category dropdown

---

#### GET `/api/v1/categories/{id}`
Get a single category by ID.

**Path Parameters:**
- `id` (number): Category ID

**Response:**
```json
{
 "id": 1,
 "title": "Category Name",
 // ... other fields
}
```

**Used in:**
- `web/src/utils/search-info.ts` - Display category name in search info

---

### 5. Attributions Endpoint

#### GET `/api/v1/attributions`
Get all attributions (submitters).

**Response:**
```json
{
 "data": [
 {
 "name": "Attribution Name",
 // ... other fields
 }
 ]
}
```

**Used in:**
- `web/src/components/advanced-search.ts` - Advanced search filters (legacy dropdown; typeahead uses submitters)

**Note:** Law objects in `GET /api/v1/laws` and `GET /api/v1/laws/{id}` include `attributions` with only `name` and `note` (no `contact_value` or `contact_type` for privacy).

---

#### GET `/api/v1/submitters`
Search submitters for the "Submitted By" filter (typeahead).

**Query Parameters:**
- `q` (string, optional): Search query; matches names with LIKE `%q%`. Empty returns first N.
- `limit` (number, optional): Max results (default: 20, max: 100).

**Response:**
```json
{
  "data": ["Alice", "Alicia", "Anonymous"]
}
```

**Used in:**
- `web/src/components/advanced-search.ts` - Submitted By typeahead

---

## Summary

The generated [OpenAPI document](/openapi.json) is authoritative for the
endpoints it defines, but does not yet cover every public route. This guide
supplements it with frontend call sites and integration context.

### Write endpoints

1. `POST /api/v1/laws` - Submit a law for review
2. `POST /api/v1/laws/{id}/vote` - Add or replace a vote
3. `DELETE /api/v1/laws/{id}/vote` - Remove a vote

## Implementation Details

### API Server (`backend/src/server/api-server.ts`)
- All route handlers check for `/api/v1/...` paths directly
- Simple, clean routing without backward compatibility overhead

### Frontend (`web/src/utils/`)
- All API calls use `/api/v1/...` endpoints
- `API_VERSION_PREFIX` constant defined in `web/src/utils/constants.ts` as `/api/v1`
- API utility functions (`fetchAPI`, `apiRequest`, etc.) use v1 endpoints

### Notes
- **All endpoints** use `/api/v1/...` prefix
- Some endpoints use query parameters for filtering (GET `/api/v1/laws`)
- Some endpoints use path parameters (GET `/api/v1/laws/{id}`)
- POST endpoints require JSON request bodies
- All responses are JSON format
- Error responses include `error` field in JSON body
- Health check endpoint (`/api/health`) does not use versioning
- Facebook data deletion endpoint (`/api/facebook/data-deletion`) does not use versioning
