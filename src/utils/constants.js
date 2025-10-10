// Application constants

// Pagination
export const LAWS_PER_PAGE = 25;

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_FALLBACK_URL = import.meta.env.VITE_API_FALLBACK_URL || 'http://127.0.0.1:8787';

// Fetch defaults
export const DEFAULT_FETCH_HEADERS = {
  'Accept': 'application/json'
};
