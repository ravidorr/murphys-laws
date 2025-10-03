// Application constants

// Pagination
export const LAWS_PER_PAGE = 25;
export const MAX_PAGINATION_BUTTONS = 7;

// Polling intervals
export const MATHJAX_POLL_INTERVAL = 50;
export const MATHJAX_DEFER_TIMEOUT = 0;

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_FALLBACK_URL = import.meta.env.VITE_API_FALLBACK_URL || 'http://127.0.0.1:8787';

// Fetch defaults
export const DEFAULT_FETCH_HEADERS = {
  'Accept': 'application/json'
};
