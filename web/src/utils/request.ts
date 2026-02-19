// Generic API request utility with error handling
// Eliminates ~325 lines of duplicate fetch logic across voting, submissions, etc.

import { API_BASE_URL } from './constants.ts';

/**
 * Generic API request handler with error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/v1/laws')
 * @param {Object} options - Fetch options
 * @param {string} options.method - HTTP method (GET, POST, DELETE, etc.)
 * @param {Object} options.body - Request body (will be JSON.stringified)
 * @param {Object} options.headers - Additional headers
 * @returns {Promise<unknown>} JSON response
 * @throws {Error} With user-friendly error message
 */
interface ApiRequestOptions {
  method?: string;
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>;
}

export async function apiRequest(endpoint: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const {
    method = 'GET',
    body = null,
    headers = {}
  } = options;

  // Build request options
  const requestOptions: RequestInit & { headers: Record<string, string> } = {
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

  const url = `${API_BASE_URL}${endpoint}`;
  return await fetchWithErrorHandling(url, requestOptions);
}

/**
 * Fetch with comprehensive error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<unknown>} JSON response
 * @throws {Error} With user-friendly error message
 */
async function fetchWithErrorHandling(url: string, options: RequestInit): Promise<unknown> {
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
function getErrorMessageForStatus(status: number): string {
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
 * @returns {Promise<unknown>} JSON response
 */
export async function apiGet(endpoint: string, params: URLSearchParams | Record<string, string> = {}): Promise<unknown> {
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
 * @returns {Promise<unknown>} JSON response
 */
export async function apiPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  return apiRequest(endpoint, {
    method: 'POST',
    body
  });
}

/**
 * Convenience method for DELETE requests
 * @param {string} endpoint - API endpoint
 * @returns {Promise<unknown>} JSON response
 */
export async function apiDelete(endpoint: string): Promise<unknown> {
  return apiRequest(endpoint, {
    method: 'DELETE'
  });
}
