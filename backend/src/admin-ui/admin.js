import {
  STATUSES,
  STATUS_LABELS,
  PAGE_SIZE,
  buildListUrl,
  buildUpdateBody,
  pageLabel,
  formatDate,
  describeSubmitter,
  errorMessage,
  applyStatusChange,
} from './admin-logic.js';

const state = { token: '', status: 'in_review', q: '', offset: 0, total: 0, counts: {} };
let loadSeq = 0;

const $ = (id) => document.getElementById(id);
const lawsEl = $('laws');
const messageEl = $('message');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function say(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('is-error', isError);
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and retry.', 0);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    if (response.ok) {
      throw new ApiError('Server returned an unreadable response.', response.status);
    }
    data = {};
  }
  if (!response.ok) {
    throw new ApiError(errorMessage(response.status, data.error), response.status);
  }
  return data;
}

/** After a rejected token the list and filters stay hidden until the admin connects again. */
function disconnect() {
  state.token = '';
  $('toolbar').hidden = true;
  $('pager').hidden = true;
  lawsEl.replaceChildren();
}

function handleError(error) {
  if (error.status === 401) {
    disconnect();
  }
  say(error.message, true);
}

function renderTabs() {
  const tabs = $('tabs');
  tabs.replaceChildren();
  for (const { value, label } of STATUSES) {
    const count = value === 'all'
      ? Object.values(state.counts).reduce((sum, n) => sum + n, 0)
      : state.counts[value] ?? 0;
    const button = el('button', 'tab', `${label} (${count})`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.status === value));
    button.addEventListener('click', () => load({ status: value, offset: 0 }));
    tabs.append(button);
  }
}

function renderPager() {
  const shown = lawsEl.children.length;
  $('pager').hidden = state.total <= PAGE_SIZE;
  $('page-label').textContent = pageLabel(state.total, state.offset, shown);
  $('prev').disabled = state.offset === 0;
  $('next').disabled = state.offset + shown >= state.total;
}

function field(id, labelText, control) {
  const wrap = el('div', 'field');
  const label = el('label', null, labelText);
  label.htmlFor = id;
  control.id = id;
  wrap.append(label, control);
  return wrap;
}

function setBusy(actions, busy) {
  actions.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
}

/** Rebuild the list when a save emptied the current page. */
async function refillIfEmpty() {
  if (lawsEl.children.length > 0) {
    renderPager();
    return;
  }
  if (state.total === 0) {
    say('Nothing to show for this filter.');
    renderPager();
    return;
  }
  await load({ offset: Math.max(0, state.offset - PAGE_SIZE) }, false);
}

function renderLaw(law) {
  const item = el('li', 'law');
  const head = el('div', 'law-head');
  head.append(
    el('span', `pill pill-${law.status}`, STATUS_LABELS[law.status] || law.status),
    el('span', 'meta', `#${law.id} · ${formatDate(law.created_at)} · ${describeSubmitter(law.attributions)}`),
  );
  const categories = (law.categories || []).map((c) => c.name).join(', ');
  if (categories) {
    head.append(el('span', 'meta', categories));
  }

  const title = el('input');
  title.type = 'text';
  title.maxLength = 200;
  title.value = law.title || '';
  const text = el('textarea');
  text.rows = 3;
  text.maxLength = 1000;
  text.value = law.text;
  const notes = el('input');
  notes.type = 'text';
  notes.maxLength = 2000;
  notes.value = law.admin_notes || '';

  const actions = el('div', 'actions');
  const save = async (status) => {
    const body = buildUpdateBody(law, { status, title: title.value, text: text.value, notes: notes.value });
    if (Object.keys(body).length === 0) {
      say(`Law #${law.id} has no changes.`);
      return;
    }
    setBusy(actions, true);
    let updated;
    try {
      ({ data: updated } = await api(`/api/v1/admin/laws/${law.id}`, {
        method: 'POST',
        body: JSON.stringify({ ...body, updated_at: law.updated_at }),
      }));
    } catch (error) {
      setBusy(actions, false);
      handleError(error);
      return;
    }

    const change = applyStatusChange({ counts: state.counts, total: state.total, filter: state.status }, law.status, updated.status);
    state.counts = change.counts;
    state.total = change.total;
    renderTabs();
    if (change.removed) {
      item.remove();
    } else {
      item.replaceWith(renderLaw(updated));
    }
    say(`Law #${law.id} updated.`);
    await refillIfEmpty();
  };

  const addAction = (label, className, status) => {
    const button = el('button', `btn ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', () => save(status));
    actions.append(button);
  };
  if (law.status !== 'published') {
    addAction('Approve', 'btn-primary', 'published');
  }
  if (law.status !== 'rejected') {
    addAction('Reject', 'btn-danger', 'rejected');
  }
  if (law.status !== 'in_review') {
    addAction('Move to review', '', 'in_review');
  }
  addAction('Save edits', '', undefined);

  item.append(
    head,
    field(`title-${law.id}`, 'Title', title),
    field(`text-${law.id}`, 'Law', text),
    field(`notes-${law.id}`, 'Admin notes', notes),
    actions,
  );
  return item;
}

/**
 * Fetches a page for the requested filter. State changes only after the fetch succeeds, and a newer
 * request makes older, slower responses be ignored.
 */
async function load(patch = {}, announce = true) {
  const next = { ...state, ...patch };
  const seq = ++loadSeq;
  let data;
  try {
    data = await api(buildListUrl(next));
  } catch (error) {
    if (seq === loadSeq) {
      handleError(error);
    }
    return false;
  }
  if (seq !== loadSeq) {
    return false;
  }

  if (data.data.length === 0 && data.total > 0 && next.offset > 0) {
    return load({ ...patch, offset: Math.max(0, next.offset - PAGE_SIZE) }, announce);
  }

  Object.assign(state, next, { total: data.total, counts: data.counts });
  $('toolbar').hidden = false;
  renderTabs();
  lawsEl.replaceChildren(...data.data.map(renderLaw));
  renderPager();
  if (announce) {
    say(data.total === 0 ? 'Nothing to show for this filter.' : '');
  }
  return true;
}

$('connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.token = $('token').value.trim();
  load({ offset: 0 });
});

$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  load({ q: $('search').value.trim(), offset: 0 });
});

$('prev').addEventListener('click', () => load({ offset: Math.max(0, state.offset - PAGE_SIZE) }));
$('next').addEventListener('click', () => load({ offset: state.offset + PAGE_SIZE }));
