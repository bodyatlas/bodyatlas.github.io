/* Clausery questionnaire engine: which fields are visible, which answers are valid, what computed fields
   evaluate to, and the final data object handed to the document renderer. Pure functions, no DOM. */
import { compile, references, truthy, formatDate, parseDate, validate as validateExpr, makeScope } from './expr.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RX = /^[+()\d\s.-]{6,}$/;

export function coerce(field, raw) {
  switch (field.type) {
    case 'checkbox': return raw === true || raw === 'true' || raw === 'on' || raw === 1;
    case 'number': case 'money': {
      if (raw === '' || raw == null) return '';
      if (typeof raw === 'number') return raw;
      const cleaned = String(raw).replace(/[^\d.\-eE]/g, '');
      const n = parseFloat(cleaned);
      return cleaned !== '' && Number.isFinite(n) ? n : String(raw);   // keep bad input so validation can say "Enter a number"
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

/** Order computed fields so dependencies evaluate first; reports cycles. */
function orderComputed(fields) {
  const computed = fields.filter((f) => f.type === 'computed' || (f.role === 'condition' && f.expr));
  const keys = new Set(computed.map((f) => f.key));
  const deps = new Map();
  for (const f of computed) { let r = []; try { r = references(f.expr || ''); } catch { /* reported later */ } deps.set(f.key, r.filter((k) => keys.has(k) && k !== f.key)); }
  const done = new Set(), out = [], visiting = new Set(), cyclic = new Set();
  const visit = (k, path) => {
    if (done.has(k)) return; if (visiting.has(k)) { path.forEach((p) => cyclic.add(p)); return; }
    visiting.add(k); for (const d of deps.get(k) || []) visit(d, [...path, d]); visiting.delete(k); done.add(k); out.push(k);
  };
  for (const f of computed) visit(f.key, [f.key]);
  const byKey = new Map(computed.map((f) => [f.key, f]));
  return { order: out.map((k) => byKey.get(k)), cyclic };
}

/**
 * Evaluate the whole form.
 * @returns {{ visible: Record<string, boolean>, errors: Record<string, string>, computed: Record<string, any>, values: Record<string, any>, complete: boolean, exprErrors: Record<string,string> }}
 * Paths: top-level "key"; repeat rows "group[2].child" (0-based index).
 */
export function evaluateForm(template, answers, settings = {}) {
  const cache = new Map();
  const fields = template.fields || [];
  const values = {};
  for (const f of fields) if (f.type !== 'computed') values[f.key] = coerce(f, answers ? answers[f.key] : undefined);
  const visible = {}, errors = {}, computed = {}, exprErrors = {};
  const scope = makeScope(values);

  // computed (top-level), in dependency order
  const { order, cyclic } = orderComputed(fields);
  for (const f of order) {
    if (cyclic.has(f.key)) { exprErrors[f.key] = 'This computed field depends on itself.'; values[f.key] = null; continue; }
    const fn = compileSafe(f.expr, cache);
    if (!fn) { values[f.key] = null; continue; }
    if (fn.error) { exprErrors[f.key] = fn.error; values[f.key] = null; continue; }
    try { values[f.key] = fn(scope); } catch (e) { exprErrors[f.key] = e.message; values[f.key] = null; }
    if (f.type === 'computed') computed[f.key] = values[f.key];
  }

  const isVisible = (f, sc, path) => {
    const fn = compileSafe(f.showIf, cache);
    if (!fn) return true;
    if (fn.error) { exprErrors[path] = fn.error; return true; }
    try { return truthy(fn(sc)); } catch (e) { exprErrors[path] = e.message; return true; }
  };

  for (const f of fields) {
    const v = isVisible(f, scope, f.key);
    visible[f.key] = v;
    if (!v) continue;
    if (f.type === 'repeat') {
      const rows = values[f.key];
      const outRows = [];
      if (f.min && rows.length < f.min) errors[f.key] = `Add at least ${f.min} ${f.min === 1 ? (f.itemLabel || 'item').toLowerCase() : (f.itemLabel || 'item').toLowerCase() + 's'}.`;
      if (f.max && rows.length > f.max) errors[f.key] = `No more than ${f.max} ${(f.itemLabel || 'item').toLowerCase()}s are allowed.`;
      rows.forEach((row, i) => {
        const rowValues = {};
        for (const c of f.children || []) if (c.type !== 'computed') rowValues[c.key] = coerce(c, row ? row[c.key] : undefined);
        rowValues._index = i + 1;
        const rowScope = makeScope(rowValues, scope);
        for (const c of f.children || []) {
          if (c.type === 'computed' || (c.role === 'condition' && c.expr)) {
            const fn = compileSafe(c.expr, cache);
            if (fn && !fn.error) { try { rowValues[c.key] = fn(rowScope); } catch (e) { exprErrors[`${f.key}[${i}].${c.key}`] = e.message; } }
            else if (fn && fn.error) exprErrors[`${f.key}[${i}].${c.key}`] = fn.error;
          }
        }
        for (const c of f.children || []) {
          const path = `${f.key}[${i}].${c.key}`;
          const cv = isVisible(c, rowScope, path);
          visible[path] = cv;
          if (!cv || c.type === 'computed') continue;
          const err = validateValue(c, rowValues[c.key]);
          if (err) errors[path] = err;
        }
        outRows.push(rowValues);
      });
      values[f.key] = outRows;   // never write evaluated rows back into the answers object
      continue;
    }
    if (f.type === 'computed') continue;
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
      if (f.format === 'money') return formatValue({ type: 'money', currency: f.currency, decimals: f.decimals }, typeof v === 'number' ? v : parseFloat(v), settings);
      if (f.format === 'number') return formatValue({ type: 'number', decimals: f.decimals }, typeof v === 'number' ? v : parseFloat(v), settings);
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
  for (const f of template.fields || []) {
    const vis = ev.visible[f.key] !== false;
    if (f.type === 'repeat') {
      data[f.key] = !vis ? [] : (ev.values[f.key] || []).map((row, i, arr) => {
        const r = { _index: i + 1, _first: i === 0, _last: i === arr.length - 1, _count: arr.length };
        for (const c of f.children || []) r[c.key] = ev.visible[`${f.key}[${i}].${c.key}`] === false ? (c.type === 'checkbox' ? false : '') : formatValue(c, row[c.key], settings);
        return r;
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
