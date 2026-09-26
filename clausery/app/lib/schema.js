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
  condition: /^(has|is|if|show|include|with|no|needs|want|use|fee|pay|opt|allow|require|should|will|can|mention|add|charges|reimburse)_/i,
  plural: /(?:[^s]s|ies|list|items|entries|parties|children|people)$/i,
};
const TOKENS = {
  date: new Set(['date', 'on', 'deadline', 'dob', 'birthday', 'birthdate', 'expiry', 'expires', 'expiration', 'commencement', 'effective', 'until', 'signed', 'dated', 'closing', 'anniversary']),
  email: new Set(['email', 'e-mail', 'mail']),
  phone: new Set(['phone', 'tel', 'telephone', 'mobile', 'fax', 'cell']),
  money: new Set(['amount', 'fee', 'fees', 'salary', 'rate', 'price', 'retainer', 'total', 'cost', 'deposit', 'rent', 'wage', 'wages', 'payment', 'compensation', 'budget', 'balance', 'premium', 'penalty', 'consideration']),
  number: new Set(['years', 'days', 'months', 'weeks', 'hours', 'count', 'number', 'qty', 'quantity', 'percent', 'percentage', 'pct', 'num', 'age', 'shares', 'units', 'term']),
  long: new Set(['address', 'description', 'purpose', 'notes', 'details', 'summary', 'scope', 'reason', 'comments', 'background', 'recitals', 'terms', 'instructions', 'assumptions', 'steps']),
};

/** Keys starting with "_" are supplied by the engine ({_index}, {_first}, {_last}, {_count}, {_today}, {_firm_name}) and are never questions. */
export const isReservedKey = (key) => /^_/.test(String(key || ''));

export function inferFieldType(key) {
  const toks = String(key).toLowerCase().split(/[_-]+/).filter(Boolean);
  const has = (set) => toks.some((t) => set.has(t));
  const last = toks[toks.length - 1] || '';
  if (has(TOKENS.date) || /^(start|end)$/.test(last) && toks.length > 1) return 'date';
  if (has(TOKENS.email)) return 'email';
  if (has(TOKENS.phone)) return 'phone';
  if (toks.length > 1 && /^(number|num|no|id)$/.test(last) && !toks.includes('of')) return 'text';   // case_number, invoice_no, tax_id are identifiers, not quantities
  if (has(TOKENS.long)) return 'textarea';
  if (toks.includes('interest') || toks.includes('tax') || toks.includes('vat')) return toks.includes('amount') ? 'money' : 'text';   // interest_rate / tax_rate are percentages, not money   // before number/money so flat_fee_terms and rate_description are free text
  if (has(TOKENS.number)) return 'number';
  if (has(TOKENS.money)) return 'money';
  return 'text';
}
/**
 * Whether a {#section} is a yes/no condition or a repeating group. An inverted {^key} occurrence does not decide:
 * {^items}Nothing listed{/items} is the empty-list branch of a group, which the renderer supports.
 * @param {{ hasChildren?: boolean, childKeys?: string[] }} opts childKeys are the plain tags directly inside the section
 */
export function inferSectionRole(key, { hasChildren = false, childKeys = [] } = {}) {
  if (RX.condition.test(key)) return 'condition';
  if (/(ss|us|is)$/i.test(key)) return 'condition';   // bonus, status, basis: not plurals
  if (childKeys.length && childKeys.every((k) => String(k).toLowerCase().startsWith(String(key).toLowerCase() + '_'))) return 'condition';   // {#bonus}{bonus_amount}{/bonus}
  if (hasChildren && RX.plural.test(key)) return 'repeat';
  return 'condition';
}

export function makeField(key, type = 'text', extra = {}) {
  const f = { key, label: humanize(key), type, required: type !== 'checkbox' && type !== 'computed', help: '', placeholder: '', default: null, sectionId: null, showIf: '', role: 'value' };
  if (type === 'select' || type === 'radio') f.options = [];
  if (type === 'date') f.format = '';   // '' = the workspace's default date format
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
  const order = (inspection.order || []).filter((o) => !isReservedKey(o.key));
  const fields = []; const byKey = new Map(); const warnings = [];
  const sectionNodes = new Map();   // key -> { key, role, children: [] }
  const ancestorsOf = (o) => o.ancestors || (o.parent ? [{ key: o.parent, inverted: false }] : []);
  const nodeOf = (a) => sectionNodes.get(a.key);
  for (const o of order) if (o.section && !sectionNodes.has(o.key)) sectionNodes.set(o.key, { key: o.key, children: [] });
  for (const o of order) {
    const a = ancestorsOf(o);
    // only tags inside a {#key} occurrence count as its children; {^key} is the "empty" branch
    if (o.parent && sectionNodes.has(o.parent) && !(a.length && a[a.length - 1].inverted)) sectionNodes.get(o.parent).children.push(o);
  }
  const valueKeys = new Set(order.filter((o) => !o.section).map((o) => o.key));
  for (const n of sectionNodes.values()) {
    const kids = n.children.filter((c) => !c.section).map((c) => c.key);
    n.role = inferSectionRole(n.key, { hasChildren: kids.length > 0, childKeys: kids });
    if (n.role === 'repeat') {
      if (valueKeys.has(n.key)) warnings.push(`"${n.key}" is used both as a plain tag and as a repeating section. It was made a repeating group; the plain {${n.key}} tag will not print anything useful.`);
    } else if (valueKeys.has(n.key)) {
      // {#spouse_name}Spouse: {spouse_name}{/spouse_name}: a value whose section shows only when it is filled in
      n.role = 'value';
      warnings.push(`"${n.key}" is used both as a section and as a value; it was added as a text answer whose section is kept only when it is filled in.`);
    }
  }

  // the innermost enclosing {#group}; an inverted {^group} renders when the list is empty, so tags inside it are not row fields
  const repeatIndex = (o) => { const a = ancestorsOf(o); for (let i = a.length - 1; i >= 0; i--) { const n = nodeOf(a[i]); if (n && n.role === 'repeat' && !a[i].inverted) return i; } return -1; };
  const parentIsRepeat = (o) => { const i = repeatIndex(o); return i < 0 ? null : ancestorsOf(o)[i].key; };
  // fields inside {#condition} sections are only relevant when that condition holds (or fails, for {^inverted}): hide them otherwise
  const conditionChain = (o) => {
    const a = ancestorsOf(o); const chain = [];
    for (let i = repeatIndex(o) + 1; i < a.length; i++) {
      const n = nodeOf(a[i]);
      if (!n || a[i].key === o.key) continue;   // a value inside its own section is not hidden by itself
      if (n.role === 'repeat') { if (a[i].inverted) chain.push('not ' + a[i].key); }
      else chain.push(a[i].inverted ? 'not ' + a[i].key : a[i].key);
    }
    return chain.join(' and ');
  };
  // a tag used both outside and inside a group is asked once, at top level: the renderer finds it from inside the loop
  const topLevelValues = new Set(order.filter((o) => !o.section && !parentIsRepeat(o)).map((o) => o.key));
  const add = (f) => { if (byKey.has(f.key)) return byKey.get(f.key); byKey.set(f.key, f); fields.push(f); return f; };
  const addChild = (groupKey, f) => { const g = byKey.get(groupKey); if (g && Array.isArray(g.children) && !g.children.some((c) => c.key === f.key)) g.children.push(f); };
  const sharedWarned = new Set();

  // A tag can appear in several places (for example once under {#is_current} and once under {^is_current}); it must be
  // asked whenever any of those places renders, so the show-when rules of all its occurrences are combined with "or".
  const chainsByKey = new Map();
  for (const o of order) {
    const id = (parentIsRepeat(o) || '') + '|' + o.key;
    if (!chainsByKey.has(id)) chainsByKey.set(id, []);
    chainsByKey.get(id).push(conditionChain(o));
  }
  const combinedShowIf = (o) => combineChains(chainsByKey.get((parentIsRepeat(o) || '') + '|' + o.key) || ['']);

  for (const o of order) {
    const repeatParent = parentIsRepeat(o);
    const showIf = combinedShowIf(o);
    if (o.section) {
      const n = nodeOf(o);
      if (n.role === 'repeat') {
        if (repeatParent) {
          warnings.push(`Nested repeating group "${o.key}" inside "${repeatParent}" is not supported yet; it was added as a yes/no field.`);
          addChild(repeatParent, makeField(o.key, 'checkbox', { role: 'condition', showIf }));
          continue;
        }
        const group = makeField(o.key, 'repeat', { itemLabel: humanize(singular(o.key)), showIf });
        const existing = byKey.get(o.key);
        if (existing && existing.type !== 'repeat') { fields[fields.indexOf(existing)] = group; byKey.set(o.key, group); }   // {attorneys} came before {#attorneys}
        else add(group);
        continue;
      }
      const f = n.role === 'value' ? makeField(o.key, inferFieldType(o.key), { showIf }) : makeField(o.key, 'checkbox', { role: 'condition', showIf });
      if (repeatParent && !topLevelValues.has(o.key)) addChild(repeatParent, f); else add(f);
      continue;
    }
    if (repeatParent) {
      if (topLevelValues.has(o.key)) {
        if (!sharedWarned.has(o.key)) { sharedWarned.add(o.key); warnings.push(`"${o.key}" appears both inside {#${repeatParent}} and outside it; it is asked once and the same answer is used in every row.`); }
        continue;
      }
      addChild(repeatParent, makeField(o.key, inferFieldType(o.key), { showIf }));
      continue;
    }
    add(makeField(o.key, inferFieldType(o.key), { showIf }));
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

/** Combine the show-when chains of a tag's occurrences ("a and b", "a and not b", ...) into one rule. An occurrence with no
    condition wins outright; two chains that differ only in "x" versus "not x" merge (x or not x is always true). */
export function combineChains(chains) {
  let sets = [...new Set(chains)].map((c) => (c ? c.split(' and ') : []));
  if (sets.some((t) => t.length === 0)) return '';
  let merged = true;
  while (merged && sets.length > 1) {
    merged = false;
    outer: for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i], b = sets[j];
      if (a.length !== b.length) continue;
      const onlyA = a.filter((t) => !b.includes(t)), onlyB = b.filter((t) => !a.includes(t));
      if (onlyA.length === 1 && onlyB.length === 1 && (onlyA[0] === 'not ' + onlyB[0] || onlyB[0] === 'not ' + onlyA[0])) {
        const rest = a.filter((t) => t !== onlyA[0]);
        if (!rest.length) return '';
        sets = sets.filter((_, k) => k !== i && k !== j).concat([rest]);
        merged = true; break outer;
      }
    }
    sets = [...new Map(sets.map((t) => [t.join(' and '), t])).values()];
  }
  if (sets.length === 1) return sets[0].join(' and ');
  return sets.map((t) => (t.length > 1 ? '(' + t.join(' and ') + ')' : t[0])).join(' or ');
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
    if (g.type === 'repeat') g.children = (g.children || []).filter((c) => c && typeof c.key === 'string' && !isReservedKey(c.key) && c.type !== 'repeat').map((c) => fix(c, true));
    if ((g.type === 'select' || g.type === 'radio') && !Array.isArray(g.options)) g.options = [];
    return g;
  };
  out.fields = (out.fields || []).filter((f) => f && typeof f.key === 'string' && !isReservedKey(f.key)).map((f) => fix(f, false));   // "_" keys are engine built-ins
  return out;
}

export const KEY_RX = /^[A-Za-z][A-Za-z0-9_]*$/;   // a leading "_" is reserved for engine built-ins

/** Structural validation of a template definition; returns a list of problems (empty when fine). */
export function validateTemplate(t) {
  const problems = [];
  if (!t.name || !t.name.trim()) problems.push('The template needs a name.');
  const seen = new Set();
  for (const f of t.fields || []) {
    if (!KEY_RX.test(f.key)) problems.push(`Field key "${f.key}" is not valid (letters, digits and underscores only, starting with a letter).`);
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
