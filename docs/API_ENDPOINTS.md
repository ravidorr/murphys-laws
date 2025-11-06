# API Endpoints Used by Frontend

This document lists all API endpoints used by the Murphy's Laws frontend application. All endpoints are now versioned with `/api/v1/` prefix for mobile app support, while maintaining backward compatibility with `/api/` routes.

## Base URLs

- **Primary API**: Configured via `API_BASE_URL` (from `VITE_API_URL` or `API_URL` env var, defaults to empty string)
- **Fallback API**: Configured via `API_FALLBACK_URL` (from `VITE_API_FALLBACK_URL` or `API_FALLBACK_URL` env var, defaults to `http://127.0.0.1:8787`)

## API Versioning

All API endpoints support both versioned and non-versioned paths:
- **Versioned (recommended)**: `/api/v1/{endpoint}` - Use this for new mobile apps and frontend
- **Legacy (backward compatible)**: `/api/{endpoint}` - Still supported for backward compatibility

The frontend now uses `/api/v1/` endpoints by default. The API server automatically handles both versions and routes them to the same handlers.

## API Endpoints

### 1. Laws Endpoints

#### GET `/api/v1/laws` (or `/api/laws` for backward compatibility)
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

#### GET `/api/v1/laws/{id}` (or `/api/laws/{id}` for backward compatibility)
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
  // ... other fields
}
```

**Used in:**
- `src/utils/api.js` - `fetchLaw()` function
- `src/views/law-detail.js` - Law detail page

---

#### POST `/api/v1/laws` (or `/api/laws` for backward compatibility)
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

#### POST `/api/v1/laws/{id}/vote` (or `/api/laws/{id}/vote` for backward compatibility)
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

#### DELETE `/api/v1/laws/{id}/vote` (or `/api/laws/{id}/vote` for backward compatibility)
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

#### GET `/api/v1/law-of-day` (or `/api/law-of-day` for backward compatibility)
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

#### GET `/api/v1/categories` (or `/api/categories` for backward compatibility)
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

#### GET `/api/v1/categories/{id}` (or `/api/categories/{id}` for backward compatibility)
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

#### GET `/api/v1/attributions` (or `/api/attributions` for backward compatibility)
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

#### POST `/api/v1/share-calculation` (or `/api/share-calculation` for backward compatibility)
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
- `src/modules/sods-share.js` - SOD calculator email sharing functionality

---

## Summary

Total API endpoints: **10** (all support both `/api/v1/...` and `/api/...` paths)

1. `GET /api/v1/laws` - List laws with filters
2. `GET /api/v1/laws/{id}` - Get single law
3. `POST /api/v1/laws` - Submit new law
4. `POST /api/v1/laws/{id}/vote` - Vote on law
5. `DELETE /api/v1/laws/{id}/vote` - Remove vote
6. `GET /api/v1/law-of-day` - Get law of the day
7. `GET /api/v1/categories` - List all categories
8. `GET /api/v1/categories/{id}` - Get single category
9. `GET /api/v1/attributions` - List all attributions
10. `POST /api/v1/share-calculation` - Share calculation via email

## Implementation Details

### API Server (`scripts/api-server.mjs`)
- Uses `normalizeApiPath()` helper function to handle both `/api/v1/...` and `/api/...` routes
- All route handlers check the normalized pathname
- Backward compatibility maintained - old `/api/...` endpoints still work

### Frontend (`src/utils/`)
- All API calls now use `/api/v1/...` endpoints
- `API_VERSION_PREFIX` constant defined in `src/utils/constants.js` as `/api/v1`
- API utility functions (`fetchAPI`, `apiRequest`, etc.) updated to use v1 endpoints

### Notes
- **Versioned endpoints** (`/api/v1/...`) are recommended for new mobile apps and frontend code
- **Legacy endpoints** (`/api/...`) remain supported for backward compatibility
- Some endpoints use query parameters for filtering (GET `/api/v1/laws`)
- Some endpoints use path parameters (GET `/api/v1/laws/{id}`)
- POST endpoints require JSON request bodies
- All responses are JSON format
- Error responses include `error` field in JSON body
- Health check endpoint (`/api/health`) does not use versioning
- Facebook data deletion endpoint (`/api/facebook/data-deletion`) does not use versioning

