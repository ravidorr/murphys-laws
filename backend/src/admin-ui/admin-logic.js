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
export function buildUpdateBody(law, { status, title, text, notes, categoryId }) {
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
  if (categoryId !== undefined && !isSoleCategory(law, categoryId)) {
    body.category_id = categoryId;
  }
  return body;
}

/** True when the law already has exactly this one category, so selecting it again changes nothing. */
function isSoleCategory(law, categoryId) {
  const current = law.categories || [];
  return current.length === 1 && current[0].id === categoryId;
}

/** Value for the category selector: the single category, or '' (the disabled placeholder option) when the law has none or several. */
export function categorySelectValue(law) {
  const current = law.categories || [];
  return current.length === 1 ? String(current[0].id) : '';
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
  if (status === 403) {
    return 'This request was refused. Reload the page and sign in again.';
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
  corollary: 'This law is a corollary, so no thank-you was sent; the thank-you belongs to its parent law.',
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

/*
 * Split review. These limits mirror shared/modules/corollary-parser.ts, which the server enforces; the page cannot
 * import from outside its own directory, so the numbers are repeated here and the server stays the authority.
 */
export const MAX_COROLLARIES = 5;
const TEXT_MIN = 10;
const TEXT_MAX = 1000;
const TITLE_MAX = 200;

/** What a bullet can become: a corollary of the law, or part of the parent text. No other relation is offered. */
export const TREAT_OPTIONS = [
  { value: 'corollary', label: 'Corollary' },
  { value: 'keep', label: 'Keep in parent text' },
];

const isCorollaryRow = (row) => row.treatAs === 'corollary';

export function countCorollaries(rows) {
  return rows.filter(isCorollaryRow).length;
}

export function canAddCorollary(rows) {
  return countCorollaries(rows) < MAX_COROLLARIES;
}

/**
 * One editable row per bullet the server found. Labeled bullets start as corollaries and unlabeled ones stay in the
 * parent text, so nothing is split unless it looks like a corollary. Labeled bullets beyond the maximum start as kept.
 */
export function seedSplitRows(candidates) {
  let corollaries = 0;
  return candidates.items.map((item) => {
    const asCorollary = item.labeled && corollaries < MAX_COROLLARIES;
    if (asCorollary) {
      corollaries += 1;
    }
    return { title: item.title || '', text: item.text, treatAs: asCorollary ? 'corollary' : 'keep', manual: false };
  });
}

/** The parent text with every kept bullet put back after it, as a bulleted line. */
export function composeParentText(parentText, rows) {
  const kept = rows
    .filter((row) => !isCorollaryRow(row))
    .map((row) => {
      const title = row.title.trim();
      const text = row.text.trim();
      return `• ${title ? `${title}: ${text}` : text}`;
    });
  return kept.length === 0 ? parentText.trim() : `${parentText.trim()}\n\n${kept.join('\n')}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The banner sentence on the card. */
export function describeCandidates(candidates) {
  const found = candidates.items.length;
  const labeled = candidates.items.filter((item) => item.labeled).length;
  if (labeled === found) {
    return `${plural(found, 'corollary', 'corollaries')} found in the law text.`;
  }
  return `${plural(found, 'bullet', 'bullets')} found in the law text, ${labeled === 0 ? `none labeled as a corollary` : `${labeled} of them labeled as corollaries`}.`;
}

/** The footer wording for the number of corollaries that will be published with the parent. */
export function describeSplit(corollaries) {
  const total = corollaries + 1;
  return {
    button: corollaries === 0 ? 'Approve and publish the law' : `Approve and publish ${total} laws`,
    summary: `Approving publishes ${total} laws: the parent and ${plural(corollaries, 'corollary', 'corollaries')}. Category and author name are copied to each corollary, and the submitter gets one thank-you email, for the parent.`,
  };
}

const sameText = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/** Problems that would stop the split, in plain words. The server checks the same rules again. */
export function validateSplit({ parentText, rows }) {
  const problems = [];
  const corollaryRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => isCorollaryRow(row));
  if (corollaryRows.length === 0) {
    problems.push('Choose at least one bullet to publish as a corollary.');
  }
  if (corollaryRows.length > MAX_COROLLARIES) {
    problems.push(`A law can have at most ${MAX_COROLLARIES} corollaries. Keep the others in the parent text.`);
  }
  const composed = composeParentText(parentText, rows);
  if (composed.length < TEXT_MIN || composed.length > TEXT_MAX) {
    problems.push(`The law text must be between ${TEXT_MIN} and ${TEXT_MAX} characters.`);
  }
  const seen = new Set([sameText(composed)]);
  for (const { row, index } of corollaryRows) {
    const label = `Bullet ${index + 1}`;
    const text = row.text.trim();
    if (text.length < TEXT_MIN || text.length > TEXT_MAX) {
      problems.push(`${label} must be between ${TEXT_MIN} and ${TEXT_MAX} characters.`);
    } else if (seen.has(sameText(text))) {
      problems.push(`${label} repeats another corollary or the law text.`);
    }
    seen.add(sameText(text));
    if (row.title.trim().length > TITLE_MAX) {
      problems.push(`${label} title must be at most ${TITLE_MAX} characters.`);
    }
  }
  return problems;
}

/** The explicit request the server applies: the guard, the composed parent text, the corollaries to create and any title, notes or category change. */
export function buildSplitBody(law, { title, notes, categoryId, parentText, rows }) {
  const body = { parent_text: composeParentText(parentText, rows) };
  if (typeof law.updated_at === 'string') {
    body.updated_at = law.updated_at;
  }
  Object.assign(body, buildUpdateBody(law, { title, notes, categoryId }));
  body.corollaries = rows
    .filter(isCorollaryRow)
    .map((row) => ({ title: row.title.trim() || null, text: row.text.trim() }));
  return body;
}

/*
 * Submissions: a law the submitter sent with corollaries is one card. The server nests the corollaries under it as
 * `children` (every status); these helpers decide what the card says and sends. A rejected corollary no longer counts.
 */

/** The corollaries of a card that are still part of the submission: not rejected. */
export function liveChildren(law) {
  return (law.children || []).filter((child) => child.status !== 'rejected');
}

/** The pill on a card with corollaries, "1 law + 2 corollaries"; empty when it has none still in the running. */
export function describeSubmission(law) {
  const live = liveChildren(law).length;
  return live === 0 ? '' : `1 law + ${plural(live, 'corollary', 'corollaries')}`;
}

/** Button wording: "Approve all 3" counts the law and its corollaries that are not rejected. */
export function describeQueueActions(law) {
  const live = liveChildren(law).length;
  return {
    approve: live === 0 ? 'Approve' : `Approve all ${live + 1}`,
    reject: live === 0 ? 'Reject' : 'Reject all',
  };
}

/**
 * The saves a card's corollary fields need: one body per corollary that changed, each carrying its own updated_at guard.
 * `values` maps a corollary id to what is in its title and text fields. Rejected corollaries are never sent.
 */
export function buildChildUpdates(law, values) {
  const updates = [];
  for (const child of liveChildren(law)) {
    const edit = values[child.id];
    if (!edit) {
      continue;
    }
    const body = buildUpdateBody(child, { title: edit.title, text: edit.text });
    if (Object.keys(body).length > 0) {
      if (typeof child.updated_at === 'string') {
        body.updated_at = child.updated_at;
      }
      updates.push({ id: child.id, body });
    }
  }
  return updates;
}

/** Problems in the corollary fields that the server would refuse, named by the corollary's place on the card. */
export function validateChildEdits(law, values) {
  const problems = [];
  (law.children || []).forEach((child, index) => {
    const edit = values[child.id];
    if (child.status === 'rejected' || !edit) {
      return;
    }
    const label = `Corollary ${index + 1}`;
    const length = edit.text.trim().length;
    if (length < TEXT_MIN || length > TEXT_MAX) {
      problems.push(`${label} must be between ${TEXT_MIN} and ${TEXT_MAX} characters.`);
    }
    if (edit.title.trim().length > TITLE_MAX) {
      problems.push(`${label} title must be at most ${TITLE_MAX} characters.`);
    }
  });
  return problems;
}

/** Appended to the "updated" message when a status change moved the law's corollaries too. */
export function describeCascade(cascaded) {
  return Number.isInteger(cascaded) && cascaded > 0 ? ` ${plural(cascaded, 'corollary', 'corollaries')} moved with it.` : '';
}
