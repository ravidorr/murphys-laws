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
  isListReply,
  isLawReply,
  describeThankYou,
  categorySelectValue,
} from './admin-logic.js';

const state = { token: '', login: '', status: 'in_review', q: '', offset: 0, total: 0, counts: {}, categories: [] };
// Whether the server offers GitHub sign-in; learned from the session check when the page opens.
let oauthAvailable = false;
let loadSeq = 0;
let inFlightLoads = 0;
const INITIAL_STATE = { ...state };

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
    // A typed API token wins; otherwise the GitHub session cookie is used, and its writes must carry the CSRF header.
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    } else {
      headers['X-Admin-Request'] = '1';
    }
    response = await fetch(path, { ...options, credentials: 'same-origin', headers });
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
    throw new ApiError(errorMessage(response.status, data && data.error), response.status);
  }
  return data;
}

/** Shows the signed-in bar or the sign-in controls, depending on how the admin is connected. */
function renderAuth() {
  const signedIn = Boolean(state.login);
  $('session').hidden = !signedIn;
  $('session-login').textContent = state.login;
  $('signin').hidden = signedIn;
  $('github-signin').hidden = !oauthAvailable;
  $('token-fallback').open = !oauthAvailable;
}

/** After a rejected token or an ended session everything is reset and hidden until the admin connects again. */
function disconnect() {
  Object.assign(state, INITIAL_STATE);
  $('search').value = '';
  $('toolbar').hidden = true;
  $('pager').hidden = true;
  lawsEl.replaceChildren();
  renderAuth();
}

function handleError(error) {
  if (error.status === 401) {
    const endedSession = Boolean(state.login);
    disconnect();
    say(endedSession ? 'Your session ended. Sign in with GitHub again.' : error.message, true);
    return;
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

/** Rebuild the list when a save emptied the current page; reloads the same offset so the next laws move up. */
async function refillIfEmpty(lawId) {
  if (lawsEl.children.length > 0) {
    renderPager();
    return;
  }
  if (state.total === 0) {
    say('Nothing to show for this filter.');
    renderPager();
    return;
  }
  if (!(await load({}, false))) {
    say(`Law #${lawId} was saved, but the list could not refresh. Click a tab to reload.`, true);
  }
}

/** 409 and 404 leave a stale card behind, so the list is brought back in line with the server. */
async function recoverFromSaveError(error, law, item, actions) {
  if (error.status === 409) {
    const ok = await load({}, false);
    say(ok
      ? `Law #${law.id} changed since you loaded it. The list was reloaded; apply your edit again.`
      : error.message, true);
    return;
  }
  if (error.status === 400 && error.message === 'Unknown category') {
    const ok = await load({}, false);
    say(ok
      ? 'That category no longer exists. The list was reloaded; pick a category again.'
      : error.message, true);
    return;
  }
  if (error.status === 404 && error.message === 'Law not found') {
    const change = applyStatusChange({ counts: state.counts, total: state.total, filter: state.status }, law.status, null);
    state.counts = change.counts;
    state.total = change.total;
    renderTabs();
    item.remove();
    say(`Law #${law.id} no longer exists.`, true);
    await refillIfEmpty(law.id);
    return;
  }
  setBusy(actions, false);
  handleError(error);
}

/** The server's category list, plus any of the law's own categories it lacks (for example when the list was omitted). */
function categoryOptions(law, serverCategories) {
  const known = new Map(serverCategories.map((c) => [c.id, c]));
  for (const c of law.categories || []) {
    if (!known.has(c.id)) {
      known.set(c.id, c);
    }
  }
  return [...known.values()];
}

function renderLaw(law, serverCategories = state.categories) {
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

  const category = el('select');
  const unset = el('option', null, law.categories && law.categories.length > 1 ? 'Several categories (pick one to replace)' : 'No category');
  unset.value = '';
  // Clearing a category is not supported, so the placeholder is never a choice; it only shows the current state.
  unset.disabled = true;
  category.append(unset);
  for (const option of categoryOptions(law, serverCategories)) {
    const node = el('option', null, option.name);
    node.value = String(option.id);
    category.append(node);
  }
  category.value = categorySelectValue(law);

  const actions = el('div', 'actions');
  const save = async (status) => {
    const body = buildUpdateBody(law, { status, title: title.value, text: text.value, notes: notes.value,
      categoryId: category.value === '' ? undefined : Number(category.value),
    });
    if (Object.keys(body).length === 0) {
      say(`Law #${law.id} has no changes.`);
      return;
    }
    if (typeof law.updated_at === 'string') {
      body.updated_at = law.updated_at;
    }

    setBusy(actions, true);
    const seqAtStart = loadSeq;
    let reply;
    try {
      reply = await api(`/api/v1/admin/laws/${law.id}`, { method: 'POST', body: JSON.stringify(body) });
      if (!isLawReply(reply)) {
        throw new ApiError('The server reply could not be read. Reload the list to check the law.', 0);
      }
    } catch (error) {
      await recoverFromSaveError(error, law, item, actions);
      return;
    }

    try {
      const updated = reply.data;
      const thanks = describeThankYou(reply.thank_you);
      // A list refresh that ran during the save (or is still running) cannot be patched locally.
      const concurrent = inFlightLoads > 0 || loadSeq !== seqAtStart || !item.isConnected;
      loadSeq += 1;
      if (concurrent) {
        const ok = await load({}, false);
        say(ok ? `Law #${law.id} updated.${thanks}` : `Law #${law.id} was saved, but the list could not refresh. Click a tab to reload.${thanks}`, !ok);
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
      say(`Law #${law.id} updated.${thanks}`);
      await refillIfEmpty(law.id);
    } catch (error) {
      console.error('Admin page could not refresh after a save', error);
      setBusy(actions, false);
      say(`Law #${law.id} was saved, but the page could not refresh. Reload the page.`, true);
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
    field(`category-${law.id}`, 'Category', category),
    field(`notes-${law.id}`, 'Admin notes', notes),
    actions,
  );
  return item;
}

/**
 * Fetches a page for the requested filter. The new view is built before any state changes, so a failure
 * leaves the old view intact, and a newer request makes older, slower responses be ignored.
 */
async function load(patch = {}, announce = true) {
  const next = { ...state, ...patch };
  const seq = ++loadSeq;
  inFlightLoads += 1;
  try {
    const data = await api(buildListUrl(next));
    if (seq !== loadSeq) {
      return false;
    }
    if (!isListReply(data)) {
      throw new ApiError('The server reply could not be read. Reload the page.', 0);
    }
    if (data.data.length === 0 && data.total > 0 && next.offset > 0) {
      inFlightLoads -= 1;
      try {
        return await load({ ...patch, offset: Math.max(0, next.offset - PAGE_SIZE) }, announce);
      } finally {
        inFlightLoads += 1;
      }
    }

    const categories = Array.isArray(data.categories) ? data.categories : state.categories;
    const cards = data.data.map((item) => renderLaw(item, categories));
    Object.assign(state, next, { total: data.total, counts: data.counts, categories });
    $('toolbar').hidden = false;
    $('token').value = '';
    renderTabs();
    lawsEl.replaceChildren(...cards);
    renderPager();
    if (announce) {
      say(data.total === 0 ? 'Nothing to show for this filter.' : '');
    }
    return true;
  } catch (error) {
    if (seq === loadSeq) {
      if (!(error instanceof ApiError)) {
        console.error('Admin list could not be displayed', error);
      }
      handleError(error instanceof ApiError ? error : new ApiError('The server reply could not be displayed. Reload the page.', 0));
    }
    return false;
  } finally {
    inFlightLoads -= 1;
  }
}

/** Asks the server whether the browser already has a GitHub session and whether sign-in is offered at all. */
async function checkSession() {
  let response;
  let data = {};
  try {
    response = await fetch('/api/v1/admin/auth/session', { credentials: 'same-origin' });
    data = (await response.json()) || {};
  } catch {
    // Without an answer the page stays on the token form, which always works.
  }
  oauthAvailable = data.oauth === true;
  if (response && response.ok && data.authenticated === true && typeof data.login === 'string' && !state.token) {
    state.login = data.login;
    renderAuth();
    await load({ offset: 0 });
    return;
  }
  renderAuth();
}

$('sign-out').addEventListener('click', async () => {
  try {
    await api('/api/v1/admin/auth/logout', { method: 'POST' });
  } catch (error) {
    say(error.message, true);
    return;
  }
  disconnect();
  say('Signed out.');
});

$('connect-form').addEventListener('submit', (event) => {
  event.preventDefault();
  state.token = $('token').value.trim();
  load({ offset: 0 });
});

$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const ok = await load({ q: $('search').value.trim(), offset: 0 });
  if (!ok) {
    $('search').value = state.q;
  }
});

$('prev').addEventListener('click', () => load({ offset: Math.max(0, state.offset - PAGE_SIZE) }));
// Next continues after the laws still on screen, so cards removed by a save do not make laws get skipped.
$('next').addEventListener('click', () => load({ offset: state.offset + lawsEl.children.length }));

renderAuth();
checkSession();
