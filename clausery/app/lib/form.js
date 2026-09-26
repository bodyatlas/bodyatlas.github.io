/* Clausery form renderer: turns a template's fields into accessible HTML inputs and keeps them in sync with the
   questionnaire engine. Shared by the app's interview view and by exported client intake forms. No framework. */
import { h, icon, setChildren } from '../ui/dom.js';
import { evaluateForm } from './logic.js';
import { blankRow } from './schema.js';
import { formatValue } from './logic.js';

/** Animated scrolling only for people who have not asked the OS for reduced motion. */
export const scrollBehavior = () => (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', CHF: 'CHF', JPY: '¥', INR: '₹', SGD: 'S$', NZD: 'NZ$', ZAR: 'R', BRL: 'R$', MXN: 'MX$', SEK: 'kr', NOK: 'kr', DKK: 'kr' };

/**
 * @param {object} o
 * @param {object} o.template  template definition
 * @param {object} o.answers   mutable answers object (edited in place)
 * @param {object} o.settings  firm settings (locale, currency, dateFormat)
 * @param {string|null} o.sectionId  render only this section's fields (null = all)
 * @param {(answers:object, path:string)=>void} o.onChange
 * @param {boolean} o.showErrors  show validation errors immediately (otherwise after a field is touched)
 */
export function renderForm({ template, answers, settings = {}, sectionId = null, onChange, showErrors = false }) {
  const touched = new Set();
  let showAll = showErrors;
  const nodes = new Map();      // path -> { wrap, input, error, field }
  const fields = (template.fields || []).filter((f) => sectionId == null || f.sectionId === sectionId);
  const root = h('div.form', { role: 'group' });

  function changed(path) { touched.add(path); const ev = evaluateForm(template, answers, settings); update(ev); if (onChange) onChange(answers, path, ev); }

  function control(field, get, set, path, rowScope) {
    const id = 'f_' + path.replace(/[^\w]+/g, '_');
    const common = { id, name: path, 'aria-describedby': `${id}_help ${id}_err`, required: !!field.required && field.type !== 'checkbox' };
    let input;
    const val = get();
    switch (field.type) {
      case 'textarea': input = h('textarea.textarea', { ...common, placeholder: field.placeholder || '', rows: 4, oninput: (e) => { set(e.target.value); changed(path); } }, val ?? ''); break;
      case 'number': input = h('input.input', { ...common, type: 'number', inputmode: 'decimal', step: field.decimals ? (1 / 10 ** field.decimals).toString() : 'any', min: field.min ?? null, max: field.max ?? null, placeholder: field.placeholder || '', value: val === '' || val == null ? '' : val, oninput: (e) => { set(e.target.value); changed(path); } }); break;
      case 'money': {
        const cur = field.currency || settings.currency || 'USD';
        input = h('input.input', { ...common, type: 'number', inputmode: 'decimal', step: (1 / 10 ** (field.decimals ?? 2)).toString(), min: field.min ?? null, max: field.max ?? null, placeholder: field.placeholder || '0.00', value: val === '' || val == null ? '' : val, oninput: (e) => { set(e.target.value); changed(path); } });
        return { input, el: h('div.input-money', h('span.prefix', { 'aria-hidden': 'true' }, CURRENCY_SYMBOLS[cur] || cur), input) };
      }
      case 'date': input = h('input.input', { ...common, type: 'date', value: val || '', oninput: (e) => { set(e.target.value); changed(path); } }); break;
      case 'email': input = h('input.input', { ...common, type: 'email', autocomplete: 'off', placeholder: field.placeholder || 'name@example.com', value: val ?? '', oninput: (e) => { set(e.target.value); changed(path); } }); break;
      case 'phone': input = h('input.input', { ...common, type: 'tel', autocomplete: 'off', placeholder: field.placeholder || '', value: val ?? '', oninput: (e) => { set(e.target.value); changed(path); } }); break;
      case 'select': input = h('select.select', { ...common, onchange: (e) => { set(e.target.value); changed(path); } }, h('option', { value: '' }, field.placeholder || 'Choose…'), (field.options || []).map((o) => h('option', { value: o.value, selected: o.value === val }, o.label || o.value))); break;
      case 'radio': {
        const group = h('div.radios', { role: 'radiogroup', 'aria-labelledby': id + '_label', 'aria-describedby': common['aria-describedby'] }, (field.options || []).map((o, i) => h('label.check', h('input', { type: 'radio', name: path, value: o.value, id: i === 0 ? id : null, checked: o.value === val, onchange: () => { set(o.value); changed(path); } }), h('span', o.label || o.value))));
        return { input: group, el: group, labelledBy: true };
      }
      case 'checkbox': {
        input = h('input', { type: 'checkbox', id, name: path, checked: !!val, 'aria-describedby': common['aria-describedby'], onchange: (e) => { set(e.target.checked); changed(path); } });
        return { input, el: h('label.check', { for: id }, input, h('span', field.label, field.required ? h('span.req', { 'aria-hidden': 'true' }, '*') : null)), inline: true };
      }
      case 'computed': {
        // a <label for> cannot point at a div, so the value box names itself from the label element
        const box = h('div.computed-value', { id, role: 'status', 'aria-live': 'polite', 'aria-labelledby': id + '_label' });
        return { input: box, el: box, computed: true, labelledBy: true };
      }
      default: input = h('input.input', { ...common, type: 'text', autocomplete: 'off', placeholder: field.placeholder || '', maxlength: field.maxLength || null, value: val ?? '', oninput: (e) => { set(e.target.value); changed(path); } });
    }
    return { input, el: input };
  }

  function fieldBlock(field, get, set, path, rowScope) {
    const c = control(field, get, set, path, rowScope);
    const id = c.input.id || ('f_' + path.replace(/[^\w]+/g, '_'));
    const help = h('span.field-help', { id: id + '_help' }, field.help || '');
    if (!field.help) help.hidden = true;
    const err = h('span.field-error', { id: id + '_err', role: 'alert' });
    err.hidden = true;
    let wrap;
    if (c.inline) wrap = h('div.field', { dataset: { path } }, c.el, help, err);
    else wrap = h('div.field', { dataset: { path } }, h(c.labelledBy ? 'div' : 'label', { class: 'field-label', for: c.labelledBy ? null : id, id: id + '_label' }, field.label || field.key, field.required && !c.computed ? h('span.req', { 'aria-hidden': 'true' }, '*') : null, field.required && !c.computed ? h('span.sr-only', ' (required)') : null), c.el, help, err);
    nodes.set(path, { wrap, input: c.input, error: err, field, computed: c.computed });
    return wrap;
  }

  function renderRepeat(field) {
    const rows = Array.isArray(answers[field.key]) ? answers[field.key] : (answers[field.key] = []);
    const label = field.itemLabel || 'Item';
    const list = h('div.repeat-rows');
    const errTop = h('span.field-error', { role: 'alert' }); errTop.hidden = true;
    const group = h('fieldset.repeat-group', { dataset: { path: field.key } }, h('legend', field.label || field.key, field.help ? h('span.field-help', field.help) : null), list, errTop,
      h('button.btn.btn-sm', { type: 'button', onclick: () => { if (field.max && rows.length >= field.max) return; rows.push(blankRow(field)); rebuild(); changed(field.key); const last = list.lastElementChild; const inp = last && last.querySelector('input, select, textarea'); if (inp) inp.focus(); } }, icon('plus', 16), `Add ${label.toLowerCase()}`));
    nodes.set(field.key, { wrap: group, input: null, error: errTop, field, repeat: true });
    function rebuild() {
      for (const k of [...nodes.keys()]) if (k.startsWith(field.key + '[')) nodes.delete(k);
      setChildren(list, ...rows.map((row, i) => h('div.repeat-row', { dataset: { path: `${field.key}[${i}]` } },
        h('div.repeat-row-head', h('span', `${label} ${i + 1}`), h('div.row',
          h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': `Move ${label.toLowerCase()} ${i + 1} up`, disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; rebuild(); changed(field.key); } }, icon('up', 14)),
          h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': `Move ${label.toLowerCase()} ${i + 1} down`, disabled: i === rows.length - 1, onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; rebuild(); changed(field.key); } }, icon('down', 14)),
          h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': `Remove ${label.toLowerCase()} ${i + 1}`, disabled: rows.length <= (field.min || 0), onclick: () => { rows.splice(i, 1); rebuild(); changed(field.key); } }, icon('trash', 14)))),
        h('div.grid-2', (field.children || []).map((c) => fieldBlock(c, () => row[c.key], (v) => { row[c.key] = v; }, `${field.key}[${i}].${c.key}`))))));
    }
    rebuild();
    return group;
  }

  for (const f of fields) {
    if (f.type === 'repeat') root.append(renderRepeat(f));
    else root.append(fieldBlock(f, () => answers[f.key], (v) => { answers[f.key] = v; }, f.key));
  }

  function update(ev) {
    for (const [path, n] of nodes) {
      const visible = ev.visible[path] !== false;
      n.wrap.hidden = !visible;
      if (n.computed) {
        const v = ev.values[n.field.key];
        const err = ev.exprErrors[path];
        n.input.textContent = err ? '' : (v == null || v === '' ? '—' : String(formatValue(n.field, v, settings)));
        n.error.textContent = err || ''; n.error.hidden = !err;
        continue;
      }
      const msg = ev.errors[path];
      const show = !!msg && visible && (showAll || touched.has(path));
      n.error.textContent = show ? msg : ''; n.error.hidden = !show;
      if (n.input && n.input.setAttribute) { if (show) n.input.setAttribute('aria-invalid', 'true'); else n.input.removeAttribute('aria-invalid'); }
    }
  }

  const api = {
    element: root,
    update,
    setShowErrors(v) { showAll = v; update(evaluateForm(template, answers, settings)); },
    focusFirstError() {
      for (const [, n] of nodes) if (!n.error.hidden && n.input && n.input.focus) { n.input.focus(); n.wrap.scrollIntoView({ block: 'center', behavior: scrollBehavior() }); return true; }
      return false;
    },
  };
  update(evaluateForm(template, answers, settings));
  return api;
}
