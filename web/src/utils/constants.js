// Web application constants
export const LAWS_PER_PAGE = 25;
export const LAW_CARD_MIN_HEIGHT = 400;
export const LAW_CARD_ITEM_HEIGHT = 120;
export const WIDGET_CARD_COUNT = 3;
export const MATHJAX_POLL_INTERVAL = 50;
export const MATHJAX_MAX_ATTEMPTS = 200;
export const SITE_NAME = "Murphy's Law Archive";
const getEnvVar = (k, d) => (typeof import.meta !== 'undefined' && import.meta.env?.[k]) || d;
export const SITE_URL = getEnvVar('VITE_SITE_URL', 'https://murphys-laws.com');
export const SITE_DEFAULT_DESCRIPTION = "Explore Murphy's Law history, browse corollaries, and experiment with interactive probability calculators for everyday mishaps.";
export const SITE_DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/social/home.png`;
export const SOCIAL_IMAGE_SOD = `${SITE_URL}/social/sods-calculator.png`;
export const SOCIAL_IMAGE_TOAST = `${SITE_URL}/social/buttered-toast-calculator.png`;
export const API_BASE_URL = getEnvVar('VITE_API_URL', '');
export const API_FALLBACK_URL = getEnvVar('VITE_API_FALLBACK_URL', 'http://127.0.0.1:8787');
export const API_SHARE_CALCULATION_ENDPOINT = '/api/v1/share-calculation';
export const DEFAULT_FETCH_HEADERS = { 'Accept': 'application/json' };
export const LOADING_MESSAGES = ['Loading... (what could go wrong?)', 'Loading... (fingers crossed)', 'Loading... (hopefully)', 'Loading... probably', 'Almost there... maybe'];
export function getRandomLoadingMessage() { return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]; }
