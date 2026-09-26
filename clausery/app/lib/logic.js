/* Clausery questionnaire engine: which fields are visible, which answers are valid, what computed fields
   evaluate to, and the final data object handed to the document renderer. Pure functions, no DOM. */
import { compile, referenceDetails, truthy, formatDate, parseDate, validate as validateExpr, makeScope } from './expr.js';
import { isReservedKey } from './schema.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RX = /^[+()\d\s.-]{6,}$/;

export function coerce(field, raw) {
  switch (field.type) {
    case 'checkbox': return raw === true || raw === 'true' || raw === 'on' || raw === 1;
    case 'number': case 'money': {
      if (raw === '' || raw == null) return null;   // never '' : an empty amount must add as nothing, not join as text
      if (typeof raw === 'number') return raw;
      const s = String(raw).trim().replace(/^[A-Z]{3}\s+|\s+[A-Z]{3}$/, '');   // "USD 500" / "500 EUR"
      if (/[A-Za-z]/.test(s)) return String(raw);   // "ABC-123", "12abc": keep bad input so validation can say "Enter a number"
      const cleaned = s.replace(/[^\d.-]/g, '');
      const n = parseFloat(cleaned);
      return cleaned !== '' && Number.isFinite(n) ? n : String(raw);
    }
    case 'repeat': return Array.isArray(raw) ? raw : [];
    default: return raw == null ? '' : String(raw);
  }
}

function compileSafe(src, cache) {
  const s = (src || '').trim();
  if (!s) return null;
  if (cache.has(s)) return cache.get(s);
  let fn;
  try { fn = compile(s); } catch (e) { fn = { error: e.message }; }
  cache.set(s, fn);
  return fn;
}

const isComputed = (f) => f.type === 'computed' || (f.role === 'condition' && !!f.expr);
const blankFor = (f) => (f.type === 'checkbox' ? false : f.type === 'repeat' ? [] : f.type === 'number' || f.type === 'money' ? null : '');
function refsOf(src) { try { return referenceDetails(src || ''); } catch { return new Map(); } }

/**
 * Plan the order in which fields are evaluated. Every field (top-level and inside groups) is a node, evaluated after
 * everything its "show only when" rule and its expression refer to, so a hidden answer is already blank and a computed
 * value already known when something else reads it. Node ids: "key" at top level, "group.child" inside a group.
 * A top-level expression that reads `items.rate` depends on that child only; one that uses the whole list (count(items),
 * sum(items, "rate")) depends on every child. Row nodes always follow their group.
 * Cycles: a loop made only of expressions (a = b + 1, b = a + 1) is reported on the fields in the loop; a loop that
 * passes through a "show only when" rule is broken silently and those fields are evaluated in declaration order.
 */
function planFields(fields) {
  const nodes = [], byId = new Map();
  for (const f of fields) {
    const n = { id: f.key, field: f, group: null, deps: [] }; nodes.push(n); byId.set(n.id, n);
    if (f.type === 'repeat') for (const c of f.children || []) { const cn = { id: `${f.key}.${c.key}`, field: c, group: f, deps: [] }; nodes.push(cn); byId.set(cn.id, cn); }
  }
  for (const n of nodes) {
    const link = (src, kind) => {
      for (const [name, members] of refsOf(src)) {
        if (n.group && byId.has(`${n.group.key}.${name}`)) { const sib = `${n.group.key}.${name}`; if (sib !== n.id || kind === 'expr') n.deps.push({ id: sib, kind }); continue; }
        const target = byId.get(name);
        if (!target || target.group || (name === n.id && kind !== 'expr')) continue;
        n.deps.push({ id: name, kind });
        if (target.field.type === 'repeat' && !(n.group && n.group.key === name)) {
          for (const c of target.field.children || []) if (members === null || members.includes(c.key)) n.deps.push({ id: `${name}.${c.key}`, kind });
        }
      }
    };
    link(n.field.showIf, 'show');
    if (isComputed(n.field)) link(n.field.expr, 'expr');
    if (n.group) n.deps.push({ id: n.group.key, kind: 'group' });
  }
  const order = [], state = new Map(), cyclic = new Set(), stack = [];
  const visit = (id, kind) => {
    const st = state.get(id);
    if (st === 2) return;
    if (st === 1) {
      const at = stack.findIndex((e) => e.id === id);
      const loop = stack.slice(at);
      if (kind === 'expr' && loop.slice(1).every((e) => e.kind === 'expr')) loop.forEach((e) => cyclic.add(e.id));
      return;
    }
    state.set(id, 1); stack.push({ id, kind });
    for (const d of byId.get(id).deps) visit(d.id, d.kind);
    stack.pop(); state.set(id, 2); order.push(byId.get(id));
  };
  for (const n of nodes) visit(n.id, null);
  return { order, cyclic };
}

const CYCLE_MSG = 'This computed field depends on itself.';
const UNAVAILABLE_MSG = 'This computed field depends on a field that could not be calculated.';

/**
 * Evaluate the whole form.
 * Order rule: fields are evaluated in dependency order (see planFields). For each field its "show only when" rule is
 * decided first; a hidden answer is then blanked ('' / false / []) before any computed field or later rule reads it,
 * and a hidden computed field is null. Repeat rows are evaluated child by child in the same way, so top-level totals
 * see row-level computed values and never see hidden row answers.
 * @returns {{ visible: Record<string, boolean>, errors: Record<string, string>, computed: Record<string, any>, values: Record<string, any>, complete: boolean, exprErrors: Record<string,string> }}
 * Paths: top-level "key"; repeat rows "group[2].child" (0-based index).
 */
export function evaluateForm(template, answers, settings = {}) {
  const cache = new Map();
  const fields = template.fields || [];
  const values = {}, visible = {}, errors = {}, computed = {}, exprErrors = {};
  for (const f of fields) values[f.key] = isComputed(f) ? null : coerce(f, answers ? answers[f.key] : undefined);
  const scope = makeScope(values);
  const rowsOf = new Map();   // group key -> [{ values, scope }]
  for (const f of fields) {
    if (f.type !== 'repeat') continue;
    const rows = values[f.key].map((row, i) => {
      const rv = {};
      for (const c of f.children || []) rv[c.key] = isComputed(c) ? null : coerce(c, row ? row[c.key] : undefined);
      rv._index = i + 1;
      return { values: rv, scope: makeScope(rv, scope) };
    });
    rowsOf.set(f.key, rows);
    values[f.key] = rows.map((r) => r.values);   // never write evaluated rows back into the answers object
  }

  const isVisible = (f, sc, path) => {
    const fn = compileSafe(f.showIf, cache);
    if (!fn) return true;
    if (fn.error) { exprErrors[path] = fn.error; return true; }
    try { return truthy(fn(sc)); } catch (e) { exprErrors[path] = e.message; return true; }
  };
  const failed = new Set();   // computed nodes with no value: in a cycle, broken, or depending on one of those
  const evalComputed = (f, sc, path, vis, blocked) => {
    if (blocked) { exprErrors[path] = blocked; return { ok: false, value: null }; }
    if (!vis) return { ok: true, value: null };
    const fn = compileSafe(f.expr, cache);
    if (!fn) return { ok: true, value: null };
    if (fn.error) { exprErrors[path] = fn.error; return { ok: false, value: null }; }
    try { return { ok: true, value: fn(sc) }; } catch (e) { exprErrors[path] = e.message; return { ok: false, value: null }; }
  };

  const { order, cyclic } = planFields(fields);
  for (const n of order) {
    const f = n.field;
    const blocked = cyclic.has(n.id) ? CYCLE_MSG : n.deps.some((d) => d.kind === 'expr' && failed.has(d.id)) ? UNAVAILABLE_MSG : null;
    if (!n.group) {
      const vis = isVisible(f, scope, f.key);
      visible[f.key] = vis;
      if (!isComputed(f)) { if (!vis) { values[f.key] = blankFor(f); if (f.type === 'repeat') rowsOf.set(f.key, []); } continue; }
      const r = evalComputed(f, scope, f.key, vis, blocked);
      if (!r.ok) failed.add(n.id);
      values[f.key] = r.value;
      if (f.type === 'computed') computed[f.key] = r.value;
      continue;
    }
    // a child of a group: evaluated for every row
    const g = n.group;
    for (const [i, row] of (rowsOf.get(g.key) || []).entries()) {
      const path = `${g.key}[${i}].${f.key}`;
      const vis = isVisible(f, row.scope, path);
      visible[path] = vis;
      if (!isComputed(f)) { if (!vis) row.values[f.key] = blankFor(f); continue; }
      row.values[f.key] = evalComputed(f, row.scope, path, vis, blocked).value;
    }
    if (isComputed(f)) { const fn = compileSafe(f.expr, cache); if (blocked || (fn && fn.error)) failed.add(n.id); }
  }

  // validation of what is visible
  for (const f of fields) {
    if (!visible[f.key] || isComputed(f)) continue;
    if (f.type === 'repeat') {
      const rows = values[f.key];
      const one = (f.itemLabel || 'item').toLowerCase();
      if (f.min && rows.length < f.min) errors[f.key] = `Add at least ${f.min} ${f.min === 1 ? one : one + 's'}.`;
      if (f.max && rows.length > f.max) errors[f.key] = `No more than ${f.max} ${one}s are allowed.`;
      rows.forEach((rv, i) => {
        for (const c of f.children || []) {
          const path = `${f.key}[${i}].${c.key}`;
          if (!visible[path] || isComputed(c)) continue;
          const err = validateValue(c, rv[c.key]);
          if (err) errors[path] = err;
        }
      });
      continue;
    }
    const err = validateValue(f, values[f.key]);
    if (err) errors[f.key] = err;
  }
  return { visible, errors, computed, values, exprErrors, complete: Object.keys(errors).length === 0 };
}

export function validateValue(f, v) {
  const empty = v === '' || v == null || (Array.isArray(v) && v.length === 0);
  if (f.required && f.type !== 'checkbox' && empty) return 'This field is required.';
  if (empty) return null;
  switch (f.type) {
    case 'email': return EMAIL_RX.test(String(v).trim()) ? null : 'Enter a valid email address.';
    case 'phone': return PHONE_RX.test(String(v).trim()) ? null : 'Enter a valid phone number.';
    case 'number': case 'money': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'Enter a number.';
      if (f.min != null && f.min !== '' && v < f.min) return `Must be at least ${f.min}.`;
      if (f.max != null && f.max !== '' && v > f.max) return `Must be at most ${f.max}.`;
      return null;
    }
    case 'date': return parseDate(v) ? null : 'Enter a valid date.';
    case 'select': case 'radio': return (f.options || []).some((o) => o.value === v) ? null : 'Choose one of the options.';
    case 'text': if (f.maxLength && String(v).length > f.maxLength) return `Keep this under ${f.maxLength} characters.`; return null;
    default: return null;
  }
}

/** Format one answer for insertion into the document. */
export function formatValue(f, v, settings = {}) {
  const locale = settings.locale || undefined;
  if (v == null) return '';
  switch (f.type) {
    case 'checkbox': return !!v;
    case 'date': return v === '' ? '' : formatDate(v, f.format || settings.dateFormat || 'long', locale);
    case 'money': { if (v === '' || typeof v !== 'number') return ''; const currency = f.currency || settings.currency || 'USD'; try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: f.decimals ?? 2, maximumFractionDigits: f.decimals ?? 2 }).format(v); } catch { return String(v); } }
    case 'number': { if (v === '' || typeof v !== 'number') return ''; const d = f.decimals; return new Intl.NumberFormat(locale, d == null ? { maximumFractionDigits: 10 } : { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    case 'select': case 'radio': { const o = (f.options || []).find((x) => x.value === v); return o ? (o.label || o.value) : String(v); }
    case 'computed': {
      if (typeof v === 'boolean') return v;
      if (v == null) return '';
      if (f.format === 'money' || f.format === 'number') {
        // only real numbers are formatted; text results (if(has_fee, fee, ""), format_money(...)) pass through instead of printing "$NaN"
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n)) return Array.isArray(v) ? v.join(', ') : String(v);
        return formatValue({ type: f.format, currency: f.currency, decimals: f.decimals }, n, settings);
      }
      if (f.format === 'date') return formatDate(v, f.dateFormat || settings.dateFormat || 'long', locale);
      if (f.format === 'boolean') return truthy(v);
      return Array.isArray(v) ? v.join(', ') : String(v);
    }
    default: return String(v);
  }
}

/** The object passed to the .docx renderer. Hidden fields render blank; conditions become booleans; groups become arrays. */
export function buildRenderData(template, answers, settings = {}) {
  const ev = evaluateForm(template, answers, settings);
  const data = {};
  const fields = template.fields || [];
  const topKeys = new Set(fields.map((f) => f.key));
  for (const f of fields) {
    const vis = ev.visible[f.key] !== false;
    if (f.type === 'repeat') {
      data[f.key] = !vis ? [] : (ev.values[f.key] || []).map((row, i, arr) => {
        const r = {};
        for (const c of f.children || []) {
          if (isReservedKey(c.key)) continue;
          const hidden = ev.visible[`${f.key}[${i}].${c.key}`] === false;
          const v = c.role === 'condition' && c.expr ? !hidden && truthy(row[c.key])   // a computed condition drives a section: boolean, never "0"
            : hidden ? (c.type === 'checkbox' ? false : '') : formatValue(c, row[c.key], settings);
          // a blank row value for a key that is also asked outside the group is left out, so the renderer falls back to that answer
          if (v === '' && topKeys.has(c.key)) continue;
          r[c.key] = v;
        }
        return Object.assign(r, { _index: i + 1, _first: i === 0, _last: i === arr.length - 1, _count: arr.length });   // built-ins always win
      });
      continue;
    }
    if (f.role === 'condition' && f.expr) { data[f.key] = vis && truthy(ev.values[f.key]); continue; }
    if (!vis) { data[f.key] = f.type === 'checkbox' ? false : ''; continue; }
    data[f.key] = formatValue(f, ev.values[f.key], settings);
  }
  // convenience: firm profile and today's date are always available to templates
  data._today = formatDate(new Date(), settings.dateFormat || 'long', settings.locale || undefined);
  if (settings.firmName) data._firm_name = settings.firmName;
  return { data, evaluation: ev };
}

/** Human summary of a draft for lists: first non-empty text answers. */
export function summarize(template, answers, max = 3) {
  const out = [];
  for (const f of template.fields || []) {
    if (['text', 'email', 'select', 'radio'].includes(f.type)) { const v = answers && answers[f.key]; if (v) out.push(String(v)); }
    if (out.length >= max) break;
  }
  return out.join(' · ');
}

export function checkExpression(src) { return validateExpr(src); }
