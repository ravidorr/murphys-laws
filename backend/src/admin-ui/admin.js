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
} from '/api/v1/admin/ui/admin-logic.js';

const state = { token: '', status: 'in_review', q: '', offset: 0, total: 0, counts: {} };

const $ = (id) => document.getElementById(id);
const lawsEl = $('laws');
const messageEl = $('message');

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
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(response.status, data.error));
  }
  return data;
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
    button.addEventListener('click', () => {
      state.status = value;
      state.offset = 0;
      load();
    });
    tabs.append(button);
  }
}

function renderPager(count) {
  $('pager').hidden = state.total <= PAGE_SIZE;
  $('page-label').textContent = pageLabel(state.total, state.offset, count);
  $('prev').disabled = state.offset === 0;
  $('next').disabled = state.offset + count >= state.total;
}

function field(id, labelText, control) {
  const wrap = el('div', 'field');
  const label = el('label', null, labelText);
  label.htmlFor = id;
  control.id = id;
  wrap.append(label, control);
  return wrap;
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
  title.value = law.title || '';
  const text = el('textarea');
  text.rows = 3;
  text.maxLength = 1000;
  text.value = law.text;
  const notes = el('input');
  notes.type = 'text';
  notes.value = law.admin_notes || '';

  const actions = el('div', 'actions');
  const save = async (status) => {
    const body = buildUpdateBody(law, { status, title: title.value, text: text.value, notes: notes.value });
    if (Object.keys(body).length === 0) {
      say(`Law #${law.id} has no changes.`);
      return;
    }
    actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await api(`/api/v1/admin/laws/${law.id}`, { method: 'POST', body: JSON.stringify(body) });
      say(`Law #${law.id} updated.`);
      await load(false);
    } catch (error) {
      say(error.message, true);
      actions.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
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

async function load(announce = true) {
  try {
    const data = await api(buildListUrl(state));
    state.total = data.total;
    state.counts = data.counts;
    $('toolbar').hidden = false;
    renderTabs();
    lawsEl.replaceChildren(...data.data.map(renderLaw));
    renderPager(data.data.length);
    if (announce) {
      say(data.total === 0 ? 'Nothing to show for this filter.' : '');
    }
  } catch (error) {
    say(error.message, true);
  }
}

$('connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.token = $('token').value.trim();
  state.offset = 0;
  load();
});

$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.q = $('search').value.trim();
  state.offset = 0;
  load();
});

$('prev').addEventListener('click', () => {
  state.offset = Math.max(0, state.offset - PAGE_SIZE);
  load();
});

$('next').addEventListener('click', () => {
  state.offset += PAGE_SIZE;
  load();
});
