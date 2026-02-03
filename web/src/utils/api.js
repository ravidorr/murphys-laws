// Centralized API utilities
import * as Sentry from '@sentry/browser';
import { API_BASE_URL, DEFAULT_FETCH_HEADERS } from './constants.js';

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
  const url = `${API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;

  const response = await fetch(url, { headers: DEFAULT_FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  // Check content-type if headers are available (may not be in test mocks)
  if (response.headers && typeof response.headers.get === 'function') {
    const ct = response.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }
  }

  return await response.json();
}

/**
 * Fetches a single law by ID
 * @param {number|string} lawId - Law ID
 * @returns {Promise<Object>} Law object
 */
export async function fetchLaw(lawId) {
  const numericId = Number(lawId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('Invalid law ID');
  }

  const endpoint = `/api/v1/laws/${numericId}`;
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, { headers: DEFAULT_FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch law: ${response.status}`);
  }

  // Check content-type if headers are available (may not be in test mocks)
  if (response.headers && typeof response.headers.get === 'function') {
    const ct = response.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }
  }

  return await response.json();
}

/**
 * Fetches related laws for a given law ID
 * @param {number|string} lawId - Law ID to find related laws for
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Maximum number of related laws to return (1-10, default 5)
 * @returns {Promise<Object>} Response with data array of related laws and law_id
 */
export async function fetchRelatedLaws(lawId, { limit = 5 } = {}) {
  const numericId = Number(lawId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('Invalid law ID');
  }

  const params = {};
  if (limit && limit !== 5) {
    params.limit = String(limit);
  }

  return await fetchAPI(`/api/v1/laws/${numericId}/related`, params);
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

/**
 * Fetches search suggestions for autocomplete
 * @param {Object} options - Fetch options
 * @param {string} options.q - Search query (min 2 characters)
 * @param {number} options.limit - Number of suggestions to fetch (default: 10, max: 20)
 * @returns {Promise<Object>} Response with suggestions data
 */
export async function fetchSuggestions({ q, limit = 10 } = {}) {
  if (!q || q.trim().length < 2) {
    return { data: [] };
  }

  const params = {
    q: q.trim(),
    limit: String(Math.min(limit, 20))
  };

  try {
    return await fetchAPI('/api/v1/laws/suggestions', params);
  } catch (error) {
    // Gracefully handle errors - return empty array
    Sentry.captureException(error);
    return { data: [] };
  }
}

