// Attribution rendering utilities
import { escapeHtml, sanitizeUrl } from './sanitize.js';

/**
 * Renders a single attribution object to HTML
 * @param {Object} att - Attribution object
 * @returns {string} HTML string for attribution
 */
export function renderAttribution(att) {
  if (!att) return '';

  const { name, contact_type, contact_value, note } = att;
  let who = name ? escapeHtml(name) : '';

  if (contact_type === 'email' && contact_value) {
    const safeEmail = escapeHtml(contact_value);
    who = `<a href="mailto:${safeEmail}">${escapeHtml(name)}</a>`;
  } else if (contact_type === 'url' && contact_value) {
    const safeUrl = sanitizeUrl(contact_value);
    if (safeUrl) {
      who = `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`;
    }
  }

  const safeNote = note ? escapeHtml(note) : '';
  return `${who}${safeNote ? ` — ${safeNote}` : ''}`;
}

/**
 * Renders the first attribution line for a law
 * @param {Object} law - Law object with attributions array
 * @returns {string} HTML string for first attribution
 */
export function firstAttributionLine(law) {
  const a = Array.isArray(law.attributions) ? law.attributions[0] : null;
  if (!a) {
    return law.author ? `— ${escapeHtml(law.author)}` : '';
  }
  return `Sent by ${renderAttribution(a)}`;
}

/**
 * Renders a full list of attributions
 * @param {Array} atts - Array of attribution objects
 * @returns {string} HTML string with all attributions
 */
export function renderAttributionsList(atts = []) {
  if (!atts || atts.length === 0) return '';
  const items = atts.map(renderAttribution).filter(Boolean).join(', ');
  return items ? `<p class="small mb-4">Sent by ${items}</p>` : '';
}
