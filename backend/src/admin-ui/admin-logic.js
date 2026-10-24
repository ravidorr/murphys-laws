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
    return 'Admin API is not enabled on this server.';
  }
  if (status === 429) {
    return 'Too many requests. Wait a minute and retry.';
  }
  return fallback || `Request failed (${status}).`;
}
