/*
 * Pure logic for the moderation page, kept apart from admin.js (DOM and fetch) so it can be unit tested.
 * admin.js imports this file, so it must stay listed in AdminUiController's ASSETS.
 */
export const PAGE_SIZE = 25;

export const STATUSES = [
  { value: 'in_review', label: 'In review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export const STATUS_LABELS = {
  in_review: 'In review',
  published: 'Published',
  rejected: 'Rejected',
};

export function buildListUrl({ status, q, offset }) {
  const params = new URLSearchParams({ status, limit: String(PAGE_SIZE), offset: String(offset) });
  if (q) {
    params.set('q', q);
  }
  return `/api/v1/admin/laws?${params}`;
}

/** Only fields that changed are sent, so a note edit never overwrites text. */
export function buildUpdateBody(law, { status, title, text, notes }) {
  const body = {};
  if (status !== undefined && status !== law.status) {
    body.status = status;
  }
  if (title !== undefined && title.trim() !== (law.title || '')) {
    body.title = title.trim() || null;
  }
  if (text !== undefined && text.trim() !== law.text) {
    body.text = text.trim();
  }
  if (notes !== undefined && notes.trim() !== (law.admin_notes || '')) {
    body.admin_notes = notes.trim() || null;
  }
  return body;
}

export function pageLabel(total, offset, count) {
  if (total === 0) {
    return 'No laws';
  }
  return `${offset + 1}-${offset + count} of ${total}`;
}

export function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function describeSubmitter(attributions) {
  const first = attributions && attributions[0];
  if (!first) {
    return 'Anonymous';
  }
  const name = first.name || 'Anonymous';
  return first.contact_type === 'email' && first.contact_value ? `${name} <${first.contact_value}>` : name;
}

export function errorMessage(status, fallback) {
  if (status === 401) {
    return 'Token rejected. Check ADMIN_API_TOKEN and try again.';
  }
  if (status === 404) {
    return fallback && fallback !== 'Not Found' ? fallback : 'Admin API is not enabled on this server.';
  }
  if (status === 429) {
    return 'Too many requests. Wait a minute and retry.';
  }
  return fallback || `Request failed (${status}).`;
}

/**
 * Counts, list total and whether the card leaves the current view after a status change.
 * Pass `to = null` when the law no longer exists.
 */
export function applyStatusChange({ counts, total, filter }, from, to) {
  const next = { ...counts };
  if (from !== to) {
    next[from] = Math.max(0, (next[from] ?? 0) - 1);
    if (to !== null) {
      next[to] = (next[to] ?? 0) + 1;
    }
  }
  const removed = filter !== 'all' ? to !== filter : to === null;
  return { counts: next, total: removed ? Math.max(0, total - 1) : total, removed };
}

export function isListReply(data) {
  return Boolean(data)
    && Array.isArray(data.data)
    && Number.isFinite(data.total)
    && Boolean(data.counts)
    && typeof data.counts === 'object';
}

export function isLawReply(data) {
  return Boolean(data) && Boolean(data.data) && typeof data.data === 'object' && typeof data.data.status === 'string';
}

const THANK_YOU_SKIPPED = {
  not_configured: 'Email is not set up on the server, so no thank-you was sent.',
  already_sent: 'A thank-you was already sent for this law.',
  no_email: 'The submitter left no email address, so no thank-you was sent.',
  invalid_email: 'The submitter\'s email address is not valid, so no thank-you was sent.',
  error: 'The thank-you email could not be started. Check the server logs.',
};

/** Text appended to the "updated" message about the submitter's thank-you email; empty when not an approval. */
export function describeThankYou(thankYou) {
  if (!thankYou) {
    return '';
  }
  if (thankYou.status === 'queued') {
    return ' Thank-you email is being sent (delivery is not confirmed).';
  }
  return ` ${THANK_YOU_SKIPPED[thankYou.reason] || 'No thank-you email was sent.'}`;
}
