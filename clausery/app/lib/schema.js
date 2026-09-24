/* Clausery data model: templates, fields, sections, drafts; plus inference of a questionnaire from a template's tags.
   Everything here is plain JSON so it can be stored, exported and diffed. */

export const SCHEMA_VERSION = 1;

export const FIELD_TYPES = {
  text: { label: 'Short text' }, textarea: { label: 'Long text' }, number: { label: 'Number' }, money: { label: 'Money' },
  date: { label: 'Date' }, select: { label: 'Dropdown' }, radio: { label: 'Choice' }, checkbox: { label: 'Yes / no' },
  email: { label: 'Email' }, phone: { label: 'Phone' }, computed: { label: 'Computed' }, repeat: { label: 'Repeating group' },
};
export const DATE_FORMATS = { long: 'September 24, 2026', medium: 'Sep 24, 2026', short: '9/24/2026', full: 'Thursday, September 24, 2026', iso: '2026-09-24' };
export const CATEGORIES = ['Legal', 'HR', 'Business', 'Finance', 'Real estate', 'Other'];

export function uid(prefix = '') {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const nowISO = () => new Date().toISOString();

export function humanize(key) {
  return String(key || '').replace(/[_-]+/g, ' ').trim().split(/\s+/)
    .map((w, i) => (w.length === 1 ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

const RX = {
  condition: /^(has|is|if|show|include|with|no|needs|want|use|fee|pay|opt|allow|require|should|will|can)_/i,
  plural: /(?:[^s]s|ies|list|items|entries|parties|children|people)$/i,
};
const TOKENS = {
  date: new Set(['date', 'on', 'deadline', 'dob', 'birthday', 'birthdate', 'expiry', 'expires', 'expiration', 'commencement', 'effective', 'until', 'signed', 'dated', 'closing', 'anniversary']),
  email: new Set(['email', 'e-mail', 'mail']),
  phone: new Set(['phone', 'tel', 'telephone', 'mobile', 'fax', 'cell']),
  money: new Set(['amount', 'fee', 'fees', 'salary', 'rate', 'price', 'retainer', 'total', 'cost', 'deposit', 'rent', 'wage', 'wages', 'payment', 'compensation', 'budget', 'balance', 'premium', 'penalty', 'consideration']),
  number: new Set(['years', 'days', 'months', 'weeks', 'hours', 'count', 'number', 'qty', 'quantity', 'percent', 'percentage', 'pct', 'num', 'age', 'shares', 'units', 'term']),
  long: new Set(['address', 'description', 'purpose', 'notes', 'details', 'summary', 'scope', 'reason', 'comments', 'background', 'recitals', 'terms']),
};

export function inferFieldType(key) {
  const toks = String(key).toLowerCase().split(/[_-]+/).filter(Boolean);
  const has = (set) => toks.some((t) => set.has(t));
  if (has(TOKENS.date) || /^(start|end)$/.test(toks[toks.length - 1] || '') && toks.length > 1) return 'date';
  if (has(TOKENS.email)) return 'email';
  if (has(TOKENS.phone)) return 'phone';
  if (has(TOKENS.number)) return 'number';
  if (has(TOKENS.money)) return 'money';
  if (has(TOKENS.long)) return 'textarea';
  return 'text';
}
export function inferSectionRole(key, { inverted = false, hasChildren = false } = {}) {
  if (inverted) return 'condition';
  if (RX.condition.test(key)) return 'condition';
  if (hasChildren && RX.plural.test(key)) return 'repeat';
  return 'condition';
}

export function makeField(key, type = 'text', extra = {}) {
  const f = { key, label: humanize(key), type, required: type !== 'checkbox' && type !== 'computed', help: '', placeholder: '', default: null, sectionId: null, showIf: '', role: 'value' };
  if (type === 'select' || type === 'radio') f.options = [];
  if (type === 'date') f.format = 'long';
  if (type === 'money') { f.currency = ''; f.decimals = 2; }
  if (type === 'number') f.decimals = null;
  if (type === 'computed') { f.expr = ''; f.format = 'text'; f.required = false; }
  if (type === 'repeat') { f.children = []; f.itemLabel = 'Item'; f.min = 0; f.max = null; f.role = 'repeat'; f.required = false; }
  if (type === 'checkbox') { f.default = false; f.required = false; }
  return Object.assign(f, extra);
}

export function makeSection(title, extra = {}) { return { id: uid('s_'), title, description: '', ...extra }; }

export function newTemplate(extra = {}) {
  const t = { id: uid('t_'), schema: SCHEMA_VERSION, name: 'Untitled template', description: '', category: 'Legal', fileName: '', createdAt: nowISO(), updatedAt: nowISO(), sections: [], fields: [], tags: [], warnings: [] };
  return Object.assign(t, extra);
}
export function newDraft(template, extra = {}) {
  return { id: uid('d_'), templateId: template.id, templateName: template.name, title: '', answers: blankAnswers(template), status: 'draft', createdAt: nowISO(), updatedAt: nowISO(), generatedAt: null, notes: '', ...extra };
}

/** Build a questionnaire (sections + fields) from the tags found in a .docx (see render.inspectDocx). */
export function inferQuestionnaire(inspection) {
  const { order = [], inverted = [] } = inspection;
  const invertedSet = new Set(inverted);
  const fields = []; const byKey = new Map(); const warnings = [];
  const sectionNodes = new Map();   // key -> { role, children: [] }
  for (const o of order) if (o.section && !sectionNodes.has(o.key)) sectionNodes.set(o.key, { key: o.key, children: [], parent: o.parent });
  for (const o of order) {
    if (o.parent && sectionNodes.has(o.parent)) sectionNodes.get(o.parent).children.push(o);
  }
  for (const n of sectionNodes.values()) n.role = inferSectionRole(n.key, { inverted: invertedSet.has(n.key), hasChildren: n.children.some((c) => !c.section) });

  const ancestorsOf = (o) => o.ancestors || (o.parent ? [{ key: o.parent, inverted: false }] : []);
  const parentIsRepeat = (o) => { const a = ancestorsOf(o); for (let i = a.length - 1; i >= 0; i--) { const n = sectionNodes.get(a[i].key); if (n && n.role === 'repeat') return n.key; } return null; };
  // fields inside {#condition} sections are only relevant when that condition holds (or fails, for {^inverted}): hide them otherwise
  const conditionChain = (o) => {
    const a = ancestorsOf(o); const chain = [];
    let start = 0; for (let i = a.length - 1; i >= 0; i--) { const n = sectionNodes.get(a[i].key); if (n && n.role === 'repeat') { start = i + 1; break; } }
    for (let i = start; i < a.length; i++) { const n = sectionNodes.get(a[i].key); if (n && n.role === 'condition') chain.push(a[i].inverted ? 'not ' + a[i].key : a[i].key); }
    return chain.join(' and ');
  };
  const add = (f) => { if (byKey.has(f.key)) return byKey.get(f.key); byKey.set(f.key, f); fields.push(f); return f; };

  for (const o of order) {
    const repeatParent = parentIsRepeat(o);
    if (o.section) {
      const n = sectionNodes.get(o.key);
      if (repeatParent) {
        // nested section inside a repeat: becomes a child of that group
        const group = byKey.get(repeatParent);
        if (group && !group.children.some((c) => c.key === o.key)) {
          if (n.role === 'repeat') warnings.push(`Nested repeating group "${o.key}" inside "${repeatParent}" is not supported yet; it was added as a yes/no field.`);
          group.children.push(makeField(o.key, 'checkbox', { role: 'condition', showIf: conditionChain(o) }));
        }
        continue;
      }
      if (n.role === 'repeat') add(makeField(o.key, 'repeat', { itemLabel: humanize(singular(o.key)), showIf: conditionChain(o) }));
      else add(makeField(o.key, 'checkbox', { role: 'condition', showIf: conditionChain(o) }));
      continue;
    }
    if (repeatParent) {
      const group = byKey.get(repeatParent);
      if (group && !group.children.some((c) => c.key === o.key)) group.children.push(makeField(o.key, inferFieldType(o.key), { showIf: conditionChain(o) }));
      continue;
    }
    add(makeField(o.key, inferFieldType(o.key), { showIf: conditionChain(o) }));
  }

  // group top-level fields into sections by shared prefix (party_a_*, client_*) when a prefix has 3+ fields
  const prefixOf = (k) => { const m = /^([a-z]+(?:_[a-z])?)_/i.exec(k); return m && !RX.condition.test(k) ? m[1] : null; };
  const counts = {};
  for (const f of fields) { const p = prefixOf(f.key); if (p) counts[p] = (counts[p] || 0) + 1; }
  const sections = [];
  const sectionFor = {};
  for (const f of fields) {
    const p = prefixOf(f.key);
    const title = p && counts[p] >= 3 ? humanize(p) : 'General';
    if (!sectionFor[title]) { const s = makeSection(title); sections.push(s); sectionFor[title] = s.id; }
    f.sectionId = sectionFor[title];
  }
  if (sections.length > 1) { const g = sections.find((s) => s.title === 'General'); if (g) { sections.splice(sections.indexOf(g), 1); sections.unshift(g); } }
  return { sections, fields, warnings };
}

export function singular(key) {
  if (/ies$/i.test(key)) return key.replace(/ies$/i, 'y');
  if (/(children)$/i.test(key)) return key.replace(/children$/i, 'child');
  if (/(people)$/i.test(key)) return key.replace(/people$/i, 'person');
  if (/(parties)$/i.test(key)) return key.replace(/parties$/i, 'party');
  if (/(ss|us|is)$/i.test(key)) return key;
  return key.replace(/s$/i, '');
}

/** Default answers for a template. */
export function blankAnswers(template) {
  const a = {};
  for (const f of template.fields || []) {
    if (f.type === 'repeat') a[f.key] = Array.from({ length: Math.max(0, f.min || 0) }, () => blankRow(f));
    else if (f.type === 'computed') continue;
    else a[f.key] = f.default ?? (f.type === 'checkbox' ? false : '');
  }
  return a;
}
export function blankRow(group) {
  const r = {};
  for (const c of group.children || []) if (c.type !== 'computed') r[c.key] = c.default ?? (c.type === 'checkbox' ? false : '');
  return r;
}

/** Bring older or hand-edited templates up to the current shape. Returns a new object. */
export function normalizeTemplate(t) {
  const out = { ...newTemplate(), ...t };
  out.schema = SCHEMA_VERSION;
  out.sections = Array.isArray(out.sections) && out.sections.length ? out.sections.map((s) => ({ ...makeSection(''), ...s })) : [makeSection('General')];
  const validSection = new Set(out.sections.map((s) => s.id));
  const fix = (f, inGroup) => {
    const type = FIELD_TYPES[f.type] ? f.type : 'text';
    const g = { ...makeField(f.key, type), ...f, type };
    if (!inGroup) { if (!validSection.has(g.sectionId)) g.sectionId = out.sections[0].id; } else delete g.sectionId;
    if (g.type === 'repeat') g.children = (g.children || []).filter((c) => c && c.key && c.type !== 'repeat').map((c) => fix(c, true));
    if ((g.type === 'select' || g.type === 'radio') && !Array.isArray(g.options)) g.options = [];
    return g;
  };
  out.fields = (out.fields || []).filter((f) => f && typeof f.key === 'string').map((f) => fix(f, false));
  return out;
}

export const KEY_RX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Structural validation of a template definition; returns a list of problems (empty when fine). */
export function validateTemplate(t) {
  const problems = [];
  if (!t.name || !t.name.trim()) problems.push('The template needs a name.');
  const seen = new Set();
  for (const f of t.fields || []) {
    if (!KEY_RX.test(f.key)) problems.push(`Field key "${f.key}" is not valid (letters, digits and underscores only).`);
    if (seen.has(f.key)) problems.push(`Field key "${f.key}" is used twice.`);
    seen.add(f.key);
    if (!FIELD_TYPES[f.type]) problems.push(`Field "${f.key}" has an unknown type.`);
    if ((f.type === 'select' || f.type === 'radio') && (!f.options || !f.options.length)) problems.push(`Field "${f.label || f.key}" needs at least one option.`);
    if (f.type === 'computed' && !(f.expr || '').trim()) problems.push(`Computed field "${f.label || f.key}" has no expression.`);
    if (f.type === 'repeat') {
      const cs = new Set();
      for (const c of f.children || []) { if (!KEY_RX.test(c.key)) problems.push(`Key "${c.key}" in group "${f.key}" is not valid.`); if (cs.has(c.key)) problems.push(`Key "${c.key}" is used twice in group "${f.key}".`); cs.add(c.key); }
    }
  }
  return problems;
}
