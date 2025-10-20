// Application constants

// Pagination
export const LAWS_PER_PAGE = 25;

// Site metadata
export const SITE_NAME = "Murphy's Law Archive";
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://murphys-laws.com';
export const SITE_DEFAULT_DESCRIPTION = "Explore Murphy's Law history, browse corollaries, and experiment with interactive probability calculators for everyday mishaps.";
export const SITE_DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/social/home.png`;
export const SOCIAL_IMAGE_SOD = `${SITE_URL}/social/sods-calculator.png`;
export const SOCIAL_IMAGE_TOAST = `${SITE_URL}/social/buttered-toast-calculator.png`;

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_FALLBACK_URL = import.meta.env.VITE_API_FALLBACK_URL || 'http://127.0.0.1:8787';
export const API_SHARE_CALCULATION_ENDPOINT = '/api/share-calculation';

// Fetch defaults
export const DEFAULT_FETCH_HEADERS = {
  'Accept': 'application/json'
};

// Loading messages - randomly selected for variety
export const LOADING_MESSAGES = [
  // Playfully pessimistic
  'Loading... (what could go wrong?)',
  'Loading... (fingers crossed)',
  'Loading... (hopefully)',

  // Self-aware irony
  'Loading... (Murphy says this will take longer than expected)',
  'Loading... (of course this is the slow part)',
  'Loading... (ironically, this is taking a while)',

  // Short & witty
  'Loading... probably',
  'Almost there... maybe',
  'Loading... predictably slow',

  // Murphy-themed
  'Loading... (what could possibly delay this?)',
  'Loading... (Murphy is watching)',
  'Loading... (this better work)',
  'Fetching data... (nothing ever goes smoothly)',
  'Loading... (naturally, this takes forever)'
];

/**
 * Get a random loading message
 * @returns {string} A random loading message
 */
export function getRandomLoadingMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}
