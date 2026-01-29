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
- `src/utils/api.js` - `fetchLaws()` function
- `src/views/browse.js` - Browse page with pagination
- `src/components/top-voted.js` - Top voted laws widget
- `src/components/trending.js` - Trending laws widget
- `src/components/recently-added.js` - Recently added laws widget

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
- `src/utils/api.js` - `fetchSuggestions()` function
- `src/components/search-autocomplete.js` - Header search autocomplete dropdown

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
- `src/utils/api.js` - `fetchLaw()` function
- `src/views/law-detail.js` - Law detail page

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
- `src/utils/api.js` - `fetchRelatedLaws()` function
- `src/views/law-detail.js` - Law detail page related laws section

---

#### POST `/api/v1/laws`
Submit a new law for review.

**Request Body:**
```json
{
 "text": "Law text (required, min 10 chars)",
 "title": "Law title (optional)",
 "author": "Author name (optional, required if not anonymous)",
 "email": "author@example.com (optional, required if not anonymous)",
 "anonymous": false,
 "category_id": 1
}
```

**Response:**
```json
{
 "id": 123,
 "message": "Law submitted successfully"
}
```

**Used in:**
- `src/components/submit-law.js` - Submit law form

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
 "upvotes": 10,
 "downvotes": 2
}
```

**Used in:**
- `src/utils/voting.js` - `voteLaw()` function
- `src/views/law-detail.js` - Law detail page voting
- `src/views/browse.js` - Browse page voting (via `addVotingListeners()`)

---

#### DELETE `/api/v1/laws/{id}/vote`
Remove vote from a law.

**Path Parameters:**
- `id` (number): Law ID

**Response:**
```json
{
 "upvotes": 9,
 "downvotes": 2
}
```

**Used in:**
- `src/utils/voting.js` - `unvoteLaw()` function
- `src/views/law-detail.js` - Law detail page voting
- `src/views/browse.js` - Browse page voting (via `addVotingListeners()`)

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
- `src/utils/api.js` - `fetchLawOfTheDay()` function
- `src/views/home.js` - Home page "Law of the Day" widget

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
- `src/components/advanced-search.js` - Advanced search filters
- `src/components/submit-law.js` - Submit law form category dropdown

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
- `src/utils/search-info.js` - Display category name in search info

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
- `src/components/advanced-search.js` - Advanced search filters

---

### 6. Share Calculation Endpoint

#### POST `/api/v1/share-calculation`
Share SOD (Sod's Law) calculation via email.

**Request Body:**
```json
{
 "email": "recipient@example.com",
 "taskDescription": "Task description",
 "senderName": "Sender Name",
 "senderEmail": "sender@example.com",
 "recipientName": "Recipient Name",
 "urgency": 5,
 "complexity": 5,
 "importance": 5,
 "skill": 5,
 "frequency": 5,
 "probability": "0.50",
 "interpretation": "Interpretation text"
}
```

**Response:**
```json
{
 "success": true,
 "message": "Email sent successfully"
}
```

**Used in:**
- Backend API endpoint available for programmatic email sharing
- Note: Web frontend calculators now use simple mailto: links via `src/modules/calculator-share.js`

---

## Summary

Total API endpoints: **12** (all use `/api/v1/...` prefix)

1. `GET /api/v1/laws` - List laws with filters
2. `GET /api/v1/laws/suggestions` - Get search suggestions for autocomplete
3. `GET /api/v1/laws/{id}` - Get single law
4. `GET /api/v1/laws/{id}/related` - Get related laws
5. `POST /api/v1/laws` - Submit new law
6. `POST /api/v1/laws/{id}/vote` - Vote on law
7. `DELETE /api/v1/laws/{id}/vote` - Remove vote
8. `GET /api/v1/law-of-day` - Get law of the day
9. `GET /api/v1/categories` - List all categories
10. `GET /api/v1/categories/{id}` - Get single category
11. `GET /api/v1/attributions` - List all attributions
12. `POST /api/v1/share-calculation` - Share calculation via email

## Implementation Details

### API Server (`scripts/api-server.mjs`)
- All route handlers check for `/api/v1/...` paths directly
- Simple, clean routing without backward compatibility overhead

### Frontend (`src/utils/`)
- All API calls use `/api/v1/...` endpoints
- `API_VERSION_PREFIX` constant defined in `src/utils/constants.js` as `/api/v1`
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

