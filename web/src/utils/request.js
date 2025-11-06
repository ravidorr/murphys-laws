// Generic API request utility with automatic fallback
// Eliminates ~325 lines of duplicate fetch logic across voting, submissions, etc.

import { API_BASE_URL, API_FALLBACK_URL } from './constants.js';

/**
 * Generic API request handler with automatic fallback and error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/laws')
 * @param {Object} options - Fetch options
 * @param {string} options.method - HTTP method (GET, POST, DELETE, etc.)
 * @param {Object} options.body - Request body (will be JSON.stringified)
 * @param {Object} options.headers - Additional headers
 * @param {boolean} options.skipFallback - Skip fallback URL on error
 * @returns {Promise<any>} JSON response
 * @throws {Error} With user-friendly error message
 */
export async function apiRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    skipFallback = false
  } = options;

  // Build request options
  const requestOptions = {
    method,
    headers: {
      'Accept': 'application/json',
      ...headers
    }
  };

  // Add body if provided
  if (body !== null) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(body);
  }

  // Try primary URL first
  const primaryUrl = `${API_BASE_URL}${endpoint}`;

  try {
    return await fetchWithErrorHandling(primaryUrl, requestOptions);
  } catch (primaryError) {
    // If skipFallback is true or no fallback configured, throw error
    if (skipFallback || !API_FALLBACK_URL) {
      throw primaryError;
    }

    // Try fallback URL
    const fallbackUrl = `${API_FALLBACK_URL}${endpoint}`;
    return await fetchWithErrorHandling(fallbackUrl, requestOptions);
  }
}

/**
 * Fetch with comprehensive error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} JSON response
 * @throws {Error} With user-friendly error message
 */
async function fetchWithErrorHandling(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    // Network errors (offline, timeout, etc.)
    throw new Error('Network error. Please check your connection and try again.');
  }

  // Handle non-OK responses
  if (!response.ok) {
    let errorMessage;

    // Try to parse error from JSON response
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else {
        // JSON parsed successfully but no error property, use status-based message
        errorMessage = getErrorMessageForStatus(response.status);
      }
    } catch {
      // If can't parse JSON, provide user-friendly message based on status
      errorMessage = getErrorMessageForStatus(response.status);
    }

    throw new Error(errorMessage);
  }

  // Parse and return JSON response
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server. Please try again.');
  }
}

/**
 * Get user-friendly error message for HTTP status code
 * @param {number} status - HTTP status code
 * @returns {string} User-friendly error message
 */
function getErrorMessageForStatus(status) {
  if (status === 404) {
    return 'The requested resource was not found. Please make sure the API server is running.';
  }

  if (status === 429) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }

  if (status === 400) {
    return 'Invalid request. Please check your input.';
  }

  if (status === 401 || status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status >= 500) {
    return 'The server encountered an error. Please try again later.';
  }

  return `Request failed (error ${status}). Please try again.`;
}

/**
 * Convenience method for GET requests
 * @param {string} endpoint - API endpoint
 * @param {URLSearchParams|Object} params - Query parameters
 * @returns {Promise<any>} JSON response
 */
export async function apiGet(endpoint, params = {}) {
  const qs = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(params);

  const queryString = qs.toString();
  const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

  return apiRequest(fullEndpoint, { method: 'GET' });
}

/**
 * Convenience method for POST requests
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<any>} JSON response
 */
export async function apiPost(endpoint, body) {
  return apiRequest(endpoint, {
    method: 'POST',
    body
  });
}

/**
 * Convenience method for DELETE requests
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>} JSON response
 */
export async function apiDelete(endpoint) {
  return apiRequest(endpoint, {
    method: 'DELETE'
  });
}
