// Centralized API utilities
import { API_BASE_URL, API_FALLBACK_URL, DEFAULT_FETCH_HEADERS } from './constants.js';

/**
 * Fetches from API with automatic fallback
 * @param {string} endpoint - API endpoint (e.g., '/api/v1/laws')
 * @param {URLSearchParams|Object} params - Query parameters
 * @returns {Promise<any>} JSON response
 */
export async function fetchAPI(endpoint, params = {}) {
  const qs = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(params);

  const queryString = qs.toString();
  const primaryUrl = `${API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;

  try {
    const r = await fetch(primaryUrl, { headers: DEFAULT_FETCH_HEADERS });
    if (!r.ok) {
      throw new Error(`Primary fetch not ok: ${r.status}`);
    }

    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('Primary returned non-JSON');
    }

    return await r.json();
  } catch {
    const fallbackUrl = `${API_FALLBACK_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
    const r2 = await fetch(fallbackUrl, { headers: DEFAULT_FETCH_HEADERS });

    if (!r2.ok) {
      throw new Error(`Fallback fetch not ok: ${r2.status}`);
    }

    return await r2.json();
  }
}

/**
 * Fetches a single law by ID
 * @param {number|string} lawId - Law ID
 * @returns {Promise<Object>} Law object
 */
export async function fetchLaw(lawId) {
  const numericId = Number(lawId);
  if (!Number.isFinite(numericId)) {
    throw new Error('Invalid law ID');
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/laws/${numericId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch law: ${response.status}`);
  }

  return await response.json();
}

/**
 * Fetches laws with pagination and sorting
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Number of laws to fetch
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.sort - Sort field
 * @param {string} options.order - Sort order (asc/desc)
 * @param {string} options.q - Search query
 * @param {number} options.category_id - Category ID to filter by
 * @param {string} options.attribution - Attribution name to filter by
 * @returns {Promise<Object>} Response with data and total
 */
export async function fetchLaws({ limit = 25, offset = 0, sort = 'score', order = 'desc', q = '', category_id, category_slug, attribution } = {}) {
  const params = {
    limit: String(limit),
    offset: String(offset),
    sort,
    order
  };

  if (q && q.trim()) {
    params.q = q.trim();
  }

  if (category_id) {
    params.category_id = String(category_id);
  }

  if (category_slug) {
    params.category_slug = String(category_slug);
  }

  if (attribution && attribution.trim()) {
    params.attribution = attribution.trim();
  }

  return await fetchAPI('/api/v1/laws', params);
}

/**
 * Fetches the Law of the Day
 * Returns the daily rotating law selected by the algorithm:
 * - Highest upvotes
 * - Not featured in last 365 days
 * - If tie, sorted alphabetically by text
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchLawOfTheDay() {
  const response = await fetchAPI('/api/v1/law-of-day');
  // Return in same format as fetchLaws for compatibility
  return { data: [response.law], total: 1, limit: 1, offset: 0 };
}

/**
 * Fetches top voted laws
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchTopVoted(limit = 3) {
  return await fetchLaws({ limit, offset: 0, sort: 'upvotes', order: 'desc' });
}

/**
 * Fetches trending laws (recently voted)
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchTrending(limit = 3) {
  return await fetchLaws({ limit, offset: 0, sort: 'last_voted_at', order: 'desc' });
}

/**
 * Fetches recently added laws
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchRecentlyAdded(limit = 3) {
  return await fetchLaws({ limit, offset: 0, sort: 'created_at', order: 'desc' });
}

/**
 * Fetches all categories
 * @returns {Promise<Object>} Response with category data
 */
export async function fetchCategories() {
  return await fetchAPI('/api/v1/categories');
}

