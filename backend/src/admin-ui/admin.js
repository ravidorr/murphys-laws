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
  TREAT_OPTIONS,
  seedSplitRows,
  countCorollaries,
  canAddCorollary,
  describeCandidates,
  describeSplit,
  validateSplit,
  composeParentText,
  buildSplitBody,
  describeSubmission,
  describeQueueActions,
  buildChildUpdates,
  validateChildEdits,
  describeCascade,
  validateLawText,
} from './admin-logic.js';

const state = { token: '', login: '', status: 'in_review', q: '', offset: 0, total: 0, counts: {}, categories: [] };
// Whether the server offers GitHub sign-in; learned from the session check when the page opens.
let oauthAvailable = false;
// Until the session check answers, the sign-in card stays hidden so it never shows a guess about GitHub sign-in.
let sessionChecked = false;
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
  // A connected API token has no login name, but the list it loaded means the admin is in.
  const connected = signedIn || !$('toolbar').hidden;
  $('session').hidden = !signedIn;
  $('session-login').textContent = state.login;
  $('signin').hidden = connected || !sessionChecked;
  $('signin').classList.toggle('is-token-only', !oauthAvailable);
  $('signin-intro').hidden = !oauthAvailable;
  $('signin-footer').hidden = oauthAvailable;
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
    setBusy(actions, false);
    const ok = await load({}, false);
    say(ok
      ? `Law #${law.id} changed since you loaded it. The list was reloaded; apply your edit again.`
      : error.message, true);
    return;
  }
  if (error.status === 400 && error.message === 'Unknown category') {
    setBusy(actions, false);
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

/**
 * The inline split review for a law whose text holds bullets. It takes over the card's Law field, banner and footer until the
 * moderator approves or cancels; the title, category and notes fields of the card are reused, not repeated.
 * Nothing is split unless the moderator approves, and the server applies exactly the body built here.
 */
function openSplitReview({ law, item, card, reviewButton }) {
  const candidates = law.corollary_candidates;
  const rows = seedSplitRows(candidates);
  let busy = false;

  const heading = el('h3', 'card-title split-title', 'Review the split');
  heading.id = `split-title-${law.id}`;
  heading.tabIndex = -1;
  const intro = el('p', 'meta', `${describeCandidates(candidates)} Check each one before publishing.`);

  const parentText = el('textarea');
  parentText.rows = 3;
  parentText.maxLength = 1000;
  parentText.value = candidates.parent_text;
  const parentField = field(`split-parent-${law.id}`, 'Law text, corollaries removed', parentText);

  const composed = el('div', 'split-composed');
  const composedText = el('p', 'split-composed-text');
  composed.append(el('p', 'meta', 'Law text as it will be published, with the bullets you keep'), composedText);

  const rowsEl = el('div', 'split-rows');
  const addButton = el('button', 'btn split-add', '+ Add a corollary by hand');
  addButton.type = 'button';
  const problem = el('ul', 'split-problem');
  problem.setAttribute('aria-live', 'polite');

  const panel = el('section', 'split-review');
  panel.setAttribute('aria-labelledby', heading.id);
  panel.append(
    heading,
    intro,
    parentField,
    composed,
    el('p', 'meta split-link', 'Each one is saved as its own law and linked to the parent'),
    rowsEl,
    addButton,
    problem,
  );

  const summary = el('p', 'split-summary');
  const cancel = el('button', 'btn', 'Cancel');
  cancel.type = 'button';
  const approve = el('button', 'btn btn-primary');
  approve.type = 'button';
  const footer = el('div', 'split-actions card-footer');
  const buttons = el('div', 'split-buttons');
  buttons.append(cancel, approve);
  footer.append(summary, buttons);

  let views = [];
  const refresh = () => {
    const corollaries = countCorollaries(rows);
    const problems = validateSplit({ parentText: parentText.value, rows });
    const wording = describeSplit(corollaries);
    const keeping = rows.some((row) => row.treatAs !== 'corollary');
    composed.hidden = !keeping;
    composedText.textContent = composeParentText(parentText.value, rows);
    summary.textContent = wording.summary;
    approve.textContent = wording.button;
    approve.disabled = busy || problems.length > 0;
    problem.hidden = problems.length === 0;
    // Every problem is listed, so the moderator sees how much is left to fix instead of finding them one at a time.
    problem.replaceChildren(...problems.map((message) => el('li', null, message)));
    addButton.disabled = !canAddCorollary(rows);
    for (const view of views) {
      const isCorollary = view.row.treatAs === 'corollary';
      view.titleField.hidden = !isCorollary;
      // A row that is not a corollary cannot become one while the maximum is reached.
      view.select.options[0].disabled = !isCorollary && !canAddCorollary(rows);
    }
  };

  const buildRow = (row, index) => {
    const prefix = `split-${law.id}-${index}`;
    const box = el('fieldset', 'split-row');
    box.append(el('legend', null, `Bullet ${index + 1}`));

    const select = el('select');
    for (const option of TREAT_OPTIONS) {
      const node = el('option', null, option.label);
      node.value = option.value;
      select.append(node);
    }
    select.value = row.treatAs;
    select.id = `${prefix}-treat`;
    const treatLabel = el('label', null, 'Treat as');
    treatLabel.htmlFor = select.id;
    const treat = el('div', 'split-treat');
    treat.append(treatLabel, select);
    const head = el('div', 'split-row-head');
    head.append(treat);
    if (row.manual) {
      const remove = el('button', 'btn split-remove', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove bullet ${index + 1}`);
      remove.addEventListener('click', () => {
        rows.splice(rows.indexOf(row), 1);
        renderRows();
        refresh();
        addButton.focus();
      });
      head.append(remove);
    }

    const titleInput = el('input');
    titleInput.type = 'text';
    titleInput.maxLength = 200;
    titleInput.value = row.title;
    titleInput.addEventListener('input', () => { row.title = titleInput.value; refresh(); });
    const titleField = field(`${prefix}-title`, 'Title', titleInput);
    titleField.classList.add('field--title');

    const textInput = el('textarea');
    textInput.rows = 2;
    textInput.maxLength = 1000;
    textInput.value = row.text;
    textInput.addEventListener('input', () => { row.text = textInput.value; refresh(); });

    select.addEventListener('change', () => { row.treatAs = select.value; refresh(); });
    box.append(head, titleField, field(`${prefix}-text`, 'Text', textInput));
    views.push({ row, select, titleField, titleInput });
    return box;
  };
  const renderRows = () => {
    views = [];
    rowsEl.replaceChildren(...rows.map(buildRow));
  };

  const setReviewing = (reviewing) => {
    card.textField.hidden = reviewing;
    card.banner.hidden = reviewing;
    card.actions.hidden = reviewing;
  };
  const close = () => {
    panel.remove();
    footer.remove();
    setReviewing(false);
    reviewButton.focus();
  };

  const approveSplit = async () => {
    // A disabled button never fires in a browser; the check keeps a stray call from sending an invalid split.
    if (busy || approve.disabled) {
      return;
    }
    const body = buildSplitBody(law, {
      title: card.title.value,
      notes: card.notes.value,
      categoryId: card.category.value === '' ? undefined : Number(card.category.value),
      parentText: parentText.value,
      rows,
    });
    busy = true;
    setBusy(footer, true);
    panel.inert = true;
    let reply;
    try {
      reply = await api(`/api/v1/admin/laws/${law.id}/split`, { method: 'POST', body: JSON.stringify(body) });
      if (!isLawReply(reply)) {
        throw new ApiError('The server reply could not be read. Reload the list to check the law.', 0);
      }
    } catch (error) {
      await recoverFromSaveError(error, law, item, footer);
      busy = false;
      panel.inert = false;
      refresh();
      if (panel.isConnected) {
        // The button that had focus was disabled during the request; give focus back to it.
        (approve.disabled ? cancel : approve).focus();
      }
      return;
    }

    // The split is saved from here on, so nothing below may leave the review open and resubmittable.
    const laws = (Array.isArray(reply.corollaries) ? reply.corollaries.length : countCorollaries(rows)) + 1;
    const thanks = describeThankYou(reply.thank_you);
    const ok = await load({}, false);
    if (ok) {
      say(`Law #${law.id} was split into ${laws} laws.${thanks}`);
      messageEl.focus();
      return;
    }
    // The list could not refresh, so the card still on screen is stale: put it back as it was.
    busy = false;
    panel.inert = false;
    close();
    say(`Law #${law.id} was split into ${laws} laws, but the list could not refresh. Click a tab to reload.${thanks}`, true);
  };

  addButton.addEventListener('click', () => {
    rows.push({ title: '', text: '', treatAs: 'corollary', manual: true });
    renderRows();
    refresh();
    views[views.length - 1].titleInput.focus();
  });
  parentText.addEventListener('input', refresh);
  cancel.addEventListener('click', close);
  approve.addEventListener('click', approveSplit);

  renderRows();
  refresh();
  setReviewing(true);
  card.textField.after(panel);
  card.actions.after(footer);
  heading.focus();
}

/**
 * The corollaries submitted with a law, as editable rows nested under it. Each has its own Reject button; a rejected one
 * stays visible but locked. `views` receives the fields of the rows that can still be saved.
 */
function renderChildren(law, views, rejectChild) {
  const section = el('section', 'children');
  const heading = el('h3', 'children-title', 'Corollaries submitted with this law');
  heading.id = `children-title-${law.id}`;
  section.setAttribute('aria-labelledby', heading.id);
  const rows = el('div', 'children-rows');

  law.children.forEach((child, index) => {
    const rejected = child.status === 'rejected';
    const prefix = `child-${child.id}`;
    const box = el('fieldset', rejected ? 'child-row is-rejected' : 'child-row');
    box.append(el('legend', null, `Corollary ${index + 1}`));

    const head = el('div', 'child-row-head');
    head.append(el('span', `pill pill-${child.status}`, STATUS_LABELS[child.status] || child.status));
    if (!rejected) {
      const reject = el('button', 'btn btn-danger', 'Reject this corollary');
      reject.type = 'button';
      reject.setAttribute('aria-label', `Reject corollary ${index + 1}`);
      reject.addEventListener('click', () => rejectChild(child));
      head.append(reject);
    }

    const childTitle = el('input');
    childTitle.type = 'text';
    childTitle.maxLength = 200;
    childTitle.value = child.title || '';
    const childText = el('textarea');
    childText.rows = 2;
    childText.maxLength = 1000;
    childText.value = child.text;
    childTitle.disabled = rejected;
    childText.disabled = rejected;
    box.append(head, field(`${prefix}-title`, 'Name', childTitle), field(`${prefix}-text`, 'Text', childText));
    if (!rejected) {
      views.push({ child, title: childTitle, text: childText });
    }
    rows.append(box);
  });

  section.append(heading, rows);
  return section;
}

function renderLaw(law, serverCategories = state.categories) {
  const item = el('li', 'law card card--section');
  const head = el('div', 'law-head card-header');
  head.append(
    el('span', `pill pill-${law.status}`, STATUS_LABELS[law.status] || law.status),
    el('span', 'meta', `#${law.id} · ${formatDate(law.created_at)} · ${describeSubmitter(law.attributions)}`),
  );

  const categories = (law.categories || []).map((c) => c.name).join(', ');
  if (categories) {
    head.append(el('span', 'meta', categories));
  }
  const submission = describeSubmission(law);
  if (submission) {
    head.append(el('span', 'pill-count', submission));
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

  const actions = el('div', 'actions card-footer');
  // What each corollary's fields hold right now, by corollary id; filled in when the fields are built below.
  const childViews = [];
  const childValues = () => Object.fromEntries(childViews.map(({ child, title: t, text: x }) => [child.id, { title: t.value, text: x.value }]));

  const listIds = (ids) => ids.map((id) => `#${id}`).join(', ');

  /**
   * A corollary request failed. Edits already saved by this click have new updated_at values the card does not know, so
   * after any partial save, and after a conflict or a vanished corollary, the list is reloaded and the message says what
   * was saved. Other failures with nothing saved are shown as they are. When the reload itself fails, its own message
   * (a lost connection or an ended session) is left on screen.
   */
  const recoverFromChildError = async (error, child, saved = []) => {
    setBusy(actions, false);
    const conflict = error.status === 409 || (error.status === 404 && error.message === 'Law not found');
    if (!conflict && saved.length === 0) {
      handleError(error);
      return;
    }
    const ok = await load({}, false);
    if (!ok) {
      return;
    }
    const kept = saved.length > 0 ? ` Saved: ${listIds(saved)}.` : '';
    say(conflict
      ? `Corollary #${child.id} changed since you loaded it. The list was reloaded; apply your edit again.${kept}`
      : `Corollary #${child.id} was not saved: ${error.message}${kept} The list was reloaded; apply the remaining edits again.`, true);
  };

  /** True when a field on the card differs from what was loaded, so a reload would throw an edit away. */
  const hasUnsavedEdits = () => {
    const lawEdits = buildUpdateBody(law, { title: title.value, text: text.value, notes: notes.value,
      categoryId: category.value === '' ? undefined : Number(category.value),
    });
    return Object.keys(lawEdits).length > 0 || buildChildUpdates(law, childValues()).length > 0;
  };

  const save = async (status) => {
    const body = buildUpdateBody(law, { status, title: title.value, text: text.value, notes: notes.value,
      categoryId: category.value === '' ? undefined : Number(category.value),
    });
    // Rejecting the law rejects its corollaries, so their fields are neither checked nor saved.
    const values = status === 'rejected' ? {} : childValues();
    // A refusal the server is sure to give is caught before the first corollary is saved, so no click ends half saved.
    const problems = validateChildEdits(law, values);
    const textProblem = body.text === undefined ? null : validateLawText(body.text);
    if (textProblem) {
      problems.unshift(textProblem);
    }
    if (problems.length > 0) {
      say(problems.join(' '), true);
      return;
    }
    const childUpdates = buildChildUpdates(law, values);
    if (Object.keys(body).length === 0 && childUpdates.length === 0) {
      say(`Law #${law.id} has no changes.`);
      return;
    }
    if (typeof law.updated_at === 'string') {
      body.updated_at = law.updated_at;
    }

    setBusy(actions, true);
    const seqAtStart = loadSeq;
    // Corollary edits go first, each guarded by its own updated_at: approving the law moves the corollaries and would
    // make their pending edits conflict.
    const savedChildren = [];
    for (const update of childUpdates) {
      const child = law.children.find((candidate) => candidate.id === update.id);
      try {
        await api(`/api/v1/admin/laws/${update.id}`, { method: 'POST', body: JSON.stringify(update.body) });
        savedChildren.push(update.id);
      } catch (error) {
        await recoverFromChildError(error, child, savedChildren);
        return;
      }
    }
    if (Object.keys(body).filter((key) => key !== 'updated_at').length === 0) {
      const ok = await load({}, false);
      say(ok ? `Law #${law.id} updated.` : `Law #${law.id} was saved, but the list could not refresh. Click a tab to reload.`, !ok);
      return;
    }
    let reply;
    try {
      reply = await api(`/api/v1/admin/laws/${law.id}`, { method: 'POST', body: JSON.stringify(body) });
      if (!isLawReply(reply)) {
        throw new ApiError('The server reply could not be read. Reload the list to check the law.', 0);
      }
    } catch (error) {
      if (savedChildren.length > 0 && error.status !== 409) {
        // The corollary edits are saved but the card still holds their old updated_at, so retrying from it would conflict.
        setBusy(actions, false);
        const ok = await load({}, false);
        if (ok) {
          say(`The law was not saved: ${error.message} Corollaries saved: ${listIds(savedChildren)}. The list was reloaded; apply the law edits again.`, true);
        }
        return;
      }
      await recoverFromSaveError(error, law, item, actions);
      return;
    }

    try {
      const updated = reply.data;
      const thanks = describeThankYou(reply.thank_you);
      const cascade = describeCascade(reply.cascaded);
      // A list refresh that ran during the save (or is still running) cannot be patched locally, and neither can a
      // save that touched the law's corollaries: they were moved with it or saved beside it.
      const concurrent = inFlightLoads > 0 || loadSeq !== seqAtStart || !item.isConnected || reply.cascaded > 0 || childUpdates.length > 0 || Boolean(law.children);
      loadSeq += 1;
      if (concurrent) {
        const ok = await load({}, false);
        say(ok ? `Law #${law.id} updated.${cascade}${thanks}` : `Law #${law.id} was saved, but the list could not refresh. Click a tab to reload.${cascade}${thanks}`, !ok);
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

  /** Rejects one corollary on its own; its law and the other corollaries stay as they are. */
  const rejectChild = async (child) => {
    // The list is reloaded afterwards, which would throw away any edit still sitting in a field.
    if (hasUnsavedEdits()) {
      say(`Law #${law.id}: save or undo your edits before rejecting a corollary.`, true);
      return;
    }
    setBusy(item, true);
    try {
      await api(`/api/v1/admin/laws/${child.id}`, { method: 'POST', body: JSON.stringify({ status: 'rejected', updated_at: child.updated_at }) });
    } catch (error) {
      await recoverFromChildError(error, child);
      setBusy(item, false);
      return;
    }
    const ok = await load({}, false);
    if (ok) {
      say(`Corollary #${child.id} was rejected.`);
      return;
    }
    // The card on screen still shows it as live; give the buttons back so the admin can retry or reload.
    setBusy(item, false);
    say(`Corollary #${child.id} was rejected, but the list could not refresh. Click a tab to reload.`, true);
  };

  const addAction = (label, className, status) => {
    const button = el('button', `btn ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', () => save(status));
    actions.append(button);
  };
  const wording = describeQueueActions(law);
  if (law.status !== 'published') {
    addAction(wording.approve, 'btn-primary', 'published');
  }
  if (law.status !== 'rejected') {
    addAction(wording.reject, 'btn-danger', 'rejected');
  }
  if (law.status !== 'in_review') {
    addAction('Move to review', '', 'in_review');
  }
  addAction('Save edits', '', undefined);
  if (law.status === 'in_review' && wording.reject !== 'Reject') {
    actions.append(el('span', 'actions-note', 'Rejecting the law rejects its corollaries'));
  }

  const textField = field(`text-${law.id}`, 'Law', text);
  const body = el('div', 'card-body');
  body.append(field(`title-${law.id}`, 'Title', title), textField);
  if (law.corollary_candidates) {
    const banner = el('div', 'split-banner');
    const reviewButton = el('button', 'btn', 'Review split');
    reviewButton.type = 'button';
    reviewButton.addEventListener('click', () => {
      // The review starts from the saved text, so an unsaved edit to the Law field would be lost on approval.
      if (text.value.trim() !== law.text.trim()) {
        say(`Law #${law.id}: save or undo your edit to the law text before reviewing the split.`, true);
        return;
      }
      openSplitReview({
        law,
        item,
        card: { textField, banner, actions, title, notes, category },
        reviewButton,
      });
    });
    const note = el('p', 'split-banner-text');
    note.append(el('strong', null, describeCandidates(law.corollary_candidates)), ' Split them so each becomes its own law, linked to this one.');
    banner.append(note, reviewButton);
    body.append(banner);
  }
  if (law.children && law.children.length > 0) {
    body.append(renderChildren(law, childViews, rejectChild));
  }
  body.append(field(`category-${law.id}`, 'Category', category), field(`notes-${law.id}`, 'Admin notes', notes));
  item.append(head, body, actions);
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
    renderAuth();
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
  sessionChecked = true;
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
