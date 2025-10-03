// Centralized API utilities
import { API_BASE_URL, API_FALLBACK_URL, DEFAULT_FETCH_HEADERS } from './constants.js';

/**
 * Fetches from API with automatic fallback
 * @param {string} endpoint - API endpoint (e.g., '/api/laws')
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
  } catch (err) {
    console.error('API fetch failed, falling back to direct API:', err);

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

  const response = await fetch(`${API_BASE_URL}/api/laws/${numericId}`);
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
 * @returns {Promise<Object>} Response with data and total
 */
export async function fetchLaws({ limit = 25, offset = 0, sort = 'score', order = 'desc', q = '' } = {}) {
  const params = {
    limit: String(limit),
    offset: String(offset),
    sort,
    order
  };

  if (q && q.trim()) {
    params.q = q.trim();
  }

  return await fetchAPI('/api/laws', params);
}

/**
 * Fetches the Law of the Day (top-voted law)
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchLawOfTheDay() {
  return await fetchLaws({ limit: 1, offset: 0, sort: 'score', order: 'desc' });
}

/**
 * Fetches top voted laws
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchTopVoted(limit = 4) {
  return await fetchLaws({ limit, offset: 0, sort: 'score', order: 'desc' });
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
