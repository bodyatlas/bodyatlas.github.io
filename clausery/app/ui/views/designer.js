/* Template designer: edit the questionnaire (sections, fields, logic) generated from a .docx. */
import { h, icon, toast, modal, confirmDialog, promptDialog, pickFile, readFile, setTitle, setChildren } from '../dom.js';
import { FIELD_TYPES, DATE_FORMATS, CATEGORIES, makeField, makeSection, validateTemplate, normalizeTemplate, inferQuestionnaire, humanize, KEY_RX, blankAnswers } from '../../lib/schema.js';
import { inspectDocx, describeTemplateError, isDocxError } from '../../lib/render.js';
import { checkExpression } from '../../lib/logic.js';
import { renderForm } from '../../lib/form.js';
import { FUNCTION_NAMES } from '../../lib/expr.js';

const CURRENCIES = ['', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'INR', 'SGD', 'NZD', 'ZAR', 'BRL', 'MXN', 'SEK', 'NOK', 'DKK'];

export async function render(ctx, { id }) {
  const stored = await ctx.templates.get(id);
  if (!stored) { setChildren(ctx.main, h('div.empty', h('h2', 'Template not found'), h('a.btn', { href: '#/templates' }, 'Back to templates'))); return; }
  const t = normalizeTemplate(structuredClone(stored));
  setTitle(t.name);
  let selected = null;           // { field, parent } where parent is a repeat group for children
  let tab = 'fields';
  ctx.dirty = false;
  const markDirty = () => { ctx.dirty = true; saveBtn.disabled = false; };

  // ---------------------------------------------------------------- header
  const nameInput = h('input.input', { value: t.name, 'aria-label': 'Template name', oninput: (e) => { t.name = e.target.value; markDirty(); } });
  const catSelect = h('select.select', { 'aria-label': 'Category', onchange: (e) => { t.category = e.target.value; markDirty(); } }, CATEGORIES.map((c) => h('option', { value: c, selected: c === t.category }, c)));
  const descInput = h('input.input', { value: t.description, placeholder: 'Short description shown on the template card', 'aria-label': 'Description', oninput: (e) => { t.description = e.target.value; markDirty(); } });
  const saveBtn = h('button.btn.btn-primary', { type: 'button', disabled: true, onclick: save }, icon('check', 16), 'Save');

  async function save() {
    const problems = validateTemplate(t);
    if (problems.length) { modal({ title: 'Fix these before saving', body: h('ul', problems.map((p) => h('li', p))), actions: [{ label: 'OK', primary: true }] }); return false; }
    await ctx.templates.save(t);
    ctx.dirty = false; saveBtn.disabled = true;
    toast('Template saved.', { type: 'ok' });
    return true;
  }

  async function replaceFile() {
    const file = await pickFile('.docx'); if (!file) return;
    const bytes = await readFile(file);
    let insp;
    try { insp = inspectDocx(bytes); } catch (e) { if (isDocxError(e)) modal({ title: 'The document has a problem', body: h('ul', describeTemplateError(e).map((m) => h('li', m))), actions: [{ label: 'OK', primary: true }] }); else toast('This file could not be opened.', { type: 'danger' }); return; }
    await ctx.templates.saveFile(t.id, bytes);
    t.fileName = file.name; t.tags = insp.order.map((o) => o.key);
    mergeTags(insp);
    markDirty(); toast('Document replaced. New tags were added as fields; removed tags are flagged.', { type: 'ok', timeout: 6000 });
    refresh();
  }

  /** Add fields for tags that exist in the document but not in the questionnaire. */
  function mergeTags(insp) {
    const q = inferQuestionnaire(insp);
    const have = new Set(t.fields.map((f) => f.key));
    let added = 0;
    for (const f of q.fields) {
      if (have.has(f.key)) {
        const mine = t.fields.find((x) => x.key === f.key);
        if (mine.type === 'repeat' && f.type === 'repeat') for (const c of f.children) if (!mine.children.some((x) => x.key === c.key)) { mine.children.push(c); added++; }
        continue;
      }
      f.sectionId = t.sections[0].id; t.fields.push(f); added++;
    }
    return added;
  }

  // ---------------------------------------------------------------- field list
  const docTags = new Set(t.tags || []);
  const flatKeys = () => { const keys = []; for (const f of t.fields) { keys.push(f.key); if (f.type === 'repeat') for (const c of f.children) keys.push(f.key + '.' + c.key); } return keys; };
  const unusedFields = () => t.fields.filter((f) => f.type !== 'computed' && docTags.size && !docTags.has(f.key));
  const missingTags = () => [...docTags].filter((k) => !t.fields.some((f) => f.key === k || (f.type === 'repeat' && f.children.some((c) => c.key === k))));

  const listEl = h('div');
  const inspectorEl = h('div.inspector.card');

  function fieldItem(f, parent) {
    const isSel = selected && selected.field === f;
    const siblings = parent ? parent.children : t.fields.filter((x) => x.sectionId === f.sectionId);
    const idx = siblings.indexOf(f);
    const move = (dir) => { const arr = parent ? parent.children : t.fields; const i = arr.indexOf(f); const j = siblings[idx + dir]; const k = arr.indexOf(j); if (k < 0) return; arr.splice(i, 1); arr.splice(k, 0, f); markDirty(); refresh(); };
    return h('li.field-item', { class: [parent ? 'child' : '', isSel ? 'selected' : ''].join(' '), dataset: { key: f.key } },
      h('span.order', h('button.btn.btn-ghost', { type: 'button', 'aria-label': `Move ${f.label || f.key} up`, disabled: idx <= 0, onclick: () => move(-1) }, '▲'), h('button.btn.btn-ghost', { type: 'button', 'aria-label': `Move ${f.label || f.key} down`, disabled: idx >= siblings.length - 1, onclick: () => move(1) }, '▼')),
      h('button.field-main', { type: 'button', 'aria-pressed': isSel ? 'true' : 'false', onclick: () => { selected = { field: f, parent }; refresh(); } },
        h('span', h('div', f.label || f.key, f.required && f.type !== 'checkbox' ? h('span.req', { 'aria-hidden': 'true' }, ' *') : null), h('div.key', '{' + f.key + '}', f.showIf ? h('span.muted', ' · shown if ' + f.showIf) : null)),
        h('span.badge.type', f.role === 'condition' && f.type === 'checkbox' ? 'Condition' : FIELD_TYPES[f.type]?.label || f.type),
        docTags.size && !docTags.has(f.key) && !parent && f.type !== 'computed' ? h('span.badge.badge-warn', { title: 'This tag is not in the document' }, 'not in doc') : null));
  }

  function renderList() {
    const missing = missingTags();
    setChildren(listEl, 
      t.warnings && t.warnings.length ? h('div.notice.notice-warn', icon('warn'), h('div', t.warnings.map((w) => h('div', w)))) : null,
      missing.length ? h('div.notice.notice-info', icon('info'), h('div', `Tags in the document without a question: ${missing.map((m) => '{' + m + '}').join(', ')}. `, h('button.btn.btn-sm', { type: 'button', onclick: async () => { const bytes = await ctx.templates.getFile(t.id); mergeTags(inspectDocx(bytes)); markDirty(); refresh(); } }, 'Add them'))) : null,
      t.sections.map((s, si) => h('div', { dataset: { sectionId: s.id } },
        h('div.section-head', h('h3', s.title), h('span.muted.small', `${t.fields.filter((f) => f.sectionId === s.id).length} fields`), h('span.grow'),
          h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': 'Move section up', disabled: si === 0, onclick: () => { t.sections.splice(si, 1); t.sections.splice(si - 1, 0, s); markDirty(); refresh(); } }, icon('up', 14)),
          h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': 'Move section down', disabled: si === t.sections.length - 1, onclick: () => { t.sections.splice(si, 1); t.sections.splice(si + 1, 0, s); markDirty(); refresh(); } }, icon('down', 14)),
          h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => editSection(s) }, icon('edit', 14), 'Edit')),
        h('ul.field-list', { 'aria-label': 'Fields in ' + s.title }, t.fields.filter((f) => f.sectionId === s.id).flatMap((f) => [fieldItem(f, null), ...(f.type === 'repeat' ? f.children.map((c) => fieldItem(c, f)) : [])])),
      )),
      h('div.row', { style: { marginTop: '1rem' } },
        h('button.btn.btn-sm', { type: 'button', onclick: async () => { const title = await promptDialog({ title: 'New section', label: 'Section title', placeholder: 'e.g. Parties' }); if (!title) return; t.sections.push(makeSection(title)); markDirty(); refresh(); } }, icon('plus', 14), 'Add section'),
        h('button.btn.btn-sm', { type: 'button', onclick: addComputed }, icon('sparkle', 14), 'Add computed field'),
        h('button.btn.btn-sm', { type: 'button', onclick: addCustom }, icon('plus', 14), 'Add question')),
    );
  }

  async function editSection(s) {
    let title, desc;
    const m = modal({ title: 'Edit section', body: h('div.stack', h('label.field', h('span.field-label', 'Title'), title = h('input.input', { value: s.title, autofocus: true })), h('label.field', h('span.field-label', 'Introduction (optional)'), desc = h('textarea.textarea', { rows: 3 }, s.description || ''))),
      actions: [
        t.sections.length > 1 ? { label: 'Delete section', class: 'btn-danger', onClick: async () => { const target = t.sections.find((x) => x !== s); for (const f of t.fields) if (f.sectionId === s.id) f.sectionId = target.id; t.sections.splice(t.sections.indexOf(s), 1); markDirty(); refresh(); } } : null,
        { label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { s.title = title.value.trim() || s.title; s.description = desc.value; markDirty(); refresh(); } },
      ].filter(Boolean) });
    await m.closed;
  }

  async function addComputed() {
    if (!ctx.requirePlan('computed')) return;
    const key = await askKey('New computed field', 'total_fee');
    if (!key) return;
    const f = makeField(key, 'computed', { sectionId: t.sections[0].id, label: humanize(key) });
    t.fields.push(f); selected = { field: f, parent: null }; markDirty(); refresh();
  }
  async function addCustom() {
    const key = await askKey('New question', 'client_reference');
    if (!key) return;
    const f = makeField(key, 'text', { sectionId: t.sections[0].id });
    t.fields.push(f); selected = { field: f, parent: null }; markDirty(); refresh();
    if (docTags.size && !docTags.has(key)) toast(`Add {${key}} to the Word document to use this answer in the output.`, { timeout: 7000 });
  }
  async function askKey(title, placeholder) {
    const raw = await promptDialog({ title, label: 'Tag name (as it appears in the document, without braces)', placeholder, help: 'Letters, digits and underscores. Example: total_fee' });
    if (raw == null) return null;
    const key = raw.trim();
    if (!KEY_RX.test(key)) { toast('Use only letters, digits and underscores, starting with a letter.', { type: 'warn' }); return null; }
    if (flatKeys().includes(key)) { toast('That tag name is already used.', { type: 'warn' }); return null; }
    return key;
  }

  // ---------------------------------------------------------------- inspector
  function renderInspector() {
    if (!selected) { setChildren(inspectorEl, h('h3', 'Field settings'), h('p.muted', 'Select a field on the left to change its label, type, help text, options and logic.'), h('h3', { style: { marginTop: '1.5rem' } }, 'Document'), docInfo()); return; }
    const { field: f, parent } = selected;
    const upd = () => { markDirty(); renderList(); };
    const row = (label, control, help) => h('label.field', h('span.field-label', label), control, help ? h('span.field-help', help) : null);
    const text = (prop, ph, cb) => h('input.input', { value: f[prop] ?? '', placeholder: ph || '', oninput: (e) => { f[prop] = e.target.value; if (cb) cb(); upd(); } });
    const num = (prop) => h('input.input', { type: 'number', value: f[prop] ?? '', oninput: (e) => { f[prop] = e.target.value === '' ? null : Number(e.target.value); upd(); } });
    const exprInput = (prop, ph) => { const err = h('span.field-error', { role: 'alert', hidden: true }); const inp = h('input.input.mono', { value: f[prop] || '', placeholder: ph, spellcheck: false, oninput: (e) => { f[prop] = e.target.value; const m = e.target.value.trim() ? checkExpression(e.target.value) : null; err.textContent = m || ''; err.hidden = !m; upd(); } }); return h('div', inp, err); };
    const typeOptions = Object.entries(FIELD_TYPES).filter(([k]) => parent ? !['repeat'].includes(k) : true);
    const keysHint = 'Available names: ' + (parent ? parent.children.map((c) => c.key).concat(t.fields.filter((x) => x.type !== 'repeat').map((x) => x.key)) : t.fields.map((x) => x.key)).filter((k) => k !== f.key).join(', ');

    setChildren(inspectorEl, 
      h('div.row.row-between', h('h3', { style: { margin: 0 } }, 'Field settings'), h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': 'Close field settings', onclick: () => { selected = null; refresh(); } }, icon('x', 16))),
      h('p.small.mono.muted', { style: { marginTop: '.25rem' } }, '{' + (parent ? parent.key + '} › {' : '') + f.key + '}'),
      row('Label', text('label')),
      row('Type', h('select.select', { onchange: (e) => { const nt = e.target.value; const keep = { key: f.key, label: f.label, help: f.help, sectionId: f.sectionId, showIf: f.showIf, role: f.role, children: f.children }; const nf = makeField(f.key, nt, keep); if (nt !== 'repeat') delete nf.children; if (f.role === 'condition' && nt !== 'checkbox' && nt !== 'computed') nf.role = 'value'; if (f.role === 'condition' && nt === 'computed') { nf.role = 'condition'; nf.format = 'boolean'; } Object.keys(f).forEach((k) => delete f[k]); Object.assign(f, nf); upd(); renderInspector(); } }, typeOptions.map(([k, v]) => h('option', { value: k, selected: k === f.type }, v.label))),
        f.role === 'condition' ? 'This tag controls a section of the document ({#' + f.key + '}…{/' + f.key + '}). Keep it as Yes / no, or make it Computed to decide from other answers.' : f.type === 'repeat' ? 'A repeating group renders its content once per item.' : null),
      f.type !== 'checkbox' && f.type !== 'computed' && f.type !== 'repeat' ? h('label.check', h('input', { type: 'checkbox', checked: !!f.required, onchange: (e) => { f.required = e.target.checked; upd(); } }), h('span', 'Required')) : null,
      row('Help text', text('help', 'Shown under the question'), null),
      !['checkbox', 'computed', 'repeat', 'date', 'select', 'radio'].includes(f.type) ? row('Placeholder', text('placeholder')) : null,
      ['text', 'textarea', 'number', 'money', 'email', 'phone', 'date'].includes(f.type) ? row('Default answer', f.type === 'date' ? h('input.input', { type: 'date', value: f.default || '', oninput: (e) => { f.default = e.target.value || null; upd(); } }) : h('input.input', { value: f.default ?? '', oninput: (e) => { f.default = e.target.value === '' ? null : (['number', 'money'].includes(f.type) ? Number(e.target.value) : e.target.value); upd(); } })) : null,
      f.type === 'checkbox' ? row('Default', h('select.select', { onchange: (e) => { f.default = e.target.value === 'true'; upd(); } }, h('option', { value: 'false', selected: !f.default }, 'No'), h('option', { value: 'true', selected: !!f.default }, 'Yes'))) : null,
      (f.type === 'select' || f.type === 'radio') ? row('Options (one per line, "value | Label" to store a different value)', h('textarea.textarea', { rows: 5, oninput: (e) => { f.options = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [v, lab] = l.split('|').map((x) => x.trim()); return { value: v, label: lab || v }; }); upd(); } }, (f.options || []).map((o) => o.value === o.label || !o.label ? o.value : `${o.value} | ${o.label}`).join('\n'))) : null,
      f.type === 'date' ? row('Format in document', h('select.select', { onchange: (e) => { f.format = e.target.value; upd(); } }, Object.entries(DATE_FORMATS).map(([k, ex]) => h('option', { value: k, selected: k === f.format }, `${k} · ${ex}`)))) : null,
      f.type === 'money' ? h('div.grid-2', row('Currency', h('select.select', { onchange: (e) => { f.currency = e.target.value; upd(); } }, CURRENCIES.map((c) => h('option', { value: c, selected: c === (f.currency || '') }, c || 'Workspace default')))), row('Decimals', num('decimals'))) : null,
      f.type === 'number' ? h('div.grid-2', row('Decimals', num('decimals')), row('Minimum', num('min')), row('Maximum', num('max'))) : null,
      f.type === 'money' ? h('div.grid-2', row('Minimum', num('min')), row('Maximum', num('max'))) : null,
      f.type === 'text' ? row('Maximum length', num('maxLength')) : null,
      f.type === 'repeat' ? h('div.grid-2', row('Item name', text('itemLabel', 'e.g. Attorney')), row('Minimum items', num('min')), row('Maximum items', num('max'))) : null,
      f.type === 'repeat' ? h('div', h('button.btn.btn-sm', { type: 'button', onclick: async () => { const key = await askKey('New field in ' + f.label, 'email'); if (!key) return; f.children.push(makeField(key, 'text')); upd(); } }, icon('plus', 14), 'Add field to group')) : null,
      f.type === 'computed' || (f.role === 'condition' && f.type === 'computed') ? row('Expression', exprInput('expr', 'e.g. sum(attorneys.rate) * 1.2'), keysHint + '. Functions: ' + FUNCTION_NAMES.join(', ')) : null,
      f.type === 'computed' && f.role !== 'condition' ? row('Show as', h('select.select', { onchange: (e) => { f.format = e.target.value; upd(); } }, ['text', 'number', 'money', 'date', 'boolean'].map((k) => h('option', { value: k, selected: k === (f.format || 'text') }, k)))) : null,
      row('Show only when', exprInput('showIf', 'e.g. has_retainer or fee_type == "flat"'), 'Leave empty to always show. ' + keysHint),
      !parent ? row('Section', h('select.select', { onchange: (e) => { f.sectionId = e.target.value; upd(); } }, t.sections.map((s) => h('option', { value: s.id, selected: s.id === f.sectionId }, s.title)))) : null,
      h('div.row', { style: { marginTop: '1rem' } },
        h('button.btn.btn-danger.btn-sm', { type: 'button', onclick: async () => { if (!await confirmDialog({ title: 'Remove field?', message: docTags.has(f.key) ? `{${f.key}} is still in the document; it will render blank until you add it back.` : `Remove "${f.label}" from the questionnaire?`, confirmLabel: 'Remove', danger: true })) return; const arr = parent ? parent.children : t.fields; arr.splice(arr.indexOf(f), 1); selected = null; markDirty(); refresh(); } }, icon('trash', 14), 'Remove')),
    );
  }

  function docInfo() {
    return h('div.stack-sm', h('div.kv', h('dt', 'File'), h('dd', t.fileName || '—'), h('dt', 'Tags found'), h('dd', String(docTags.size)), h('dt', 'Questions'), h('dd', String(t.fields.length))),
      h('div.row', h('button.btn.btn-sm', { type: 'button', onclick: replaceFile }, icon('upload', 14), 'Replace document'), h('button.btn.btn-sm', { type: 'button', onclick: async () => { const bytes = await ctx.templates.getFile(t.id); const added = mergeTags(inspectDocx(bytes)); if (added) { markDirty(); refresh(); } toast(added ? `${added} new field${added === 1 ? '' : 's'} added.` : 'The questionnaire already covers every tag.', { type: 'ok' }); } }, 'Re-scan tags')),
      unusedFields().length ? h('p.small.muted', 'Fields not in the document: ' + unusedFields().map((f) => f.key).join(', ')) : null);
  }

  // ---------------------------------------------------------------- tabs
  const content = h('div');
  function renderTab() {
    if (tab === 'fields') { setChildren(content, h('div.designer', listEl, inspectorEl)); renderList(); renderInspector(); return; }
    if (tab === 'preview') {
      const answers = blankAnswers(t);
      setChildren(content, h('div.narrow.stack', h('div.notice.notice-info', icon('info'), 'This is how the questionnaire will look. Answers typed here are not saved.'), ...t.sections.map((s) => h('div.card', h('h2', s.title), s.description ? h('p.muted', s.description) : null, renderForm({ template: t, answers, settings: ctx.settings, sectionId: s.id }).element))));
      return;
    }
    if (tab === 'text') {
      ctx.templates.getFile(t.id).then((bytes) => { const insp = inspectDocx(bytes); setChildren(content, h('div.narrow', h('p.muted.small', 'Plain text of the document with its tags, for reference.'), h('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)', fontSize: '.85rem', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' } }, insp.text))); });
    }
  }
  const tabs = h('div.tabs', { role: 'tablist' }, [['fields', 'Questions'], ['preview', 'Preview questionnaire'], ['text', 'Document text']].map(([k, label]) => h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', onclick: () => { tab = k; for (const b of tabs.children) b.setAttribute('aria-selected', b.dataset.tab === k ? 'true' : 'false'); renderTab(); }, dataset: { tab: k } }, label)));

  function refresh() { if (tab === 'fields') { renderList(); renderInspector(); } else renderTab(); }

  setChildren(ctx.main, h('div.container',
    h('div.row', { style: { marginBottom: '.75rem' } }, h('a.btn.btn-ghost.btn-sm', { href: '#/templates' }, icon('back', 16), 'Templates')),
    h('div.card', { style: { marginBottom: '1rem' } }, h('div.grid-2', h('label.field', h('span.field-label', 'Template name'), nameInput), h('label.field', h('span.field-label', 'Category'), catSelect)), h('label.field', { style: { marginBottom: 0 } }, h('span.field-label', 'Description'), descInput)),
    h('div.row.row-between', { style: { marginBottom: '.5rem' } }, tabs, h('div.row', h('button.btn', { type: 'button', onclick: async () => { if (ctx.dirty && !(await save())) return; const { newDraft } = await import('../../lib/schema.js'); const d = newDraft(t); await ctx.drafts.save(d); ctx.navigate('/drafts/' + d.id); } }, icon('plus', 16), 'New draft'), saveBtn)),
    content,
  ));
  renderTab();
}
