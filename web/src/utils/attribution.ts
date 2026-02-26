// Attribution rendering utilities (privacy: never expose contact_value / mailto in UI)
import { escapeHtml } from './sanitize.ts';
import type { Attribution } from '../types/app.d.ts';

/** True if string looks like an email (do not show as submitter display name). */
export function isEmailLikeDisplay(s: string): boolean {
  if (typeof s !== 'string' || !s.trim()) return true;
  const t = s.trim();
  return t.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * Safe display label for "Submitted by" - name if display-safe, else "Anonymous".
 */
export function submittedByLabel(attributions: (Attribution | null)[] | null | undefined): string {
  const first = Array.isArray(attributions) ? attributions[0] : null;
  const name = (first && typeof first.name === 'string') ? first.name.trim() : '';
  if (!name || isEmailLikeDisplay(name)) return 'Anonymous';
  return name;
}

/**
 * Renders a single attribution object to HTML - name and note only, no links.
 * @param {Object} att - Attribution object or null
 * @returns {string} HTML string for attribution
 */
export function renderAttribution(att: Attribution | null) {
  if (!att) return '';

  const { name, note } = att;
  const who = name && typeof name === 'string' && name.trim() ? escapeHtml(name.trim()) : '';
  const safeNote = note && typeof note === 'string' && note.trim() ? escapeHtml(note.trim()) : '';
  return who ? `${who}${safeNote ? ` - ${safeNote}` : ''}` : safeNote || '';
}

/**
 * Renders the first attribution line for a law
 * @param {Object} law - Law or object with optional attributions and author
 * @returns {string} HTML string for first attribution
 */
export function firstAttributionLine(law: { attributions?: (Attribution | null)[] | null; author?: string | null }) {
  const a = Array.isArray(law.attributions) ? law.attributions[0] : null;
  if (!a) {
    return law.author ? `- ${escapeHtml(law.author)}` : '';
  }
  return `Sent by ${renderAttribution(a)}`;
}

/**
 * Renders a full list of attributions
 * @param {Array} atts - Array of attribution objects or null/undefined
 * @returns {string} HTML string with all attributions
 */
export function renderAttributionsList(atts: (Attribution | null)[] | null | undefined = []) {
  if (!atts || atts.length === 0) return '';
  const items = atts.map(renderAttribution).filter(Boolean).join(', ');
  return items ? `<p class="small mb-4">Sent by ${items}</p>` : '';
}
