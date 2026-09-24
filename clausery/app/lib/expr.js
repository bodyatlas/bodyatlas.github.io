/* Clausery expression language: a small, safe evaluator for questionnaire conditions and computed fields.
   No eval, no prototype access: identifiers resolve only against the plain answers object passed in.

   Grammar (precedence low → high):
     or          : and ("or" | "||") and
     and         : not ("and" | "&&") not
     not         : ("not" | "!") not | comparison
     comparison  : additive (("==" | "!=" | "<" | "<=" | ">" | ">=" | "in") additive)?
     additive    : multiplicative (("+" | "-") multiplicative)*
     multiplicative : unary (("*" | "/" | "%") unary)*
     unary       : "-" unary | postfix
     postfix     : primary ("." IDENT)*
     primary     : NUMBER | STRING | true | false | null | IDENT | IDENT "(" args ")" | "(" or ")" | "[" list "]"
   Values: numbers, strings, booleans, null, arrays, plain objects (repeat rows). */

const FUNCTIONS = {
  upper: (s) => str(s).toUpperCase(),
  lower: (s) => str(s).toLowerCase(),
  title: (s) => str(s).replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  trim: (s) => str(s).trim(),
  len: (v) => (Array.isArray(v) ? v.length : str(v).length),
  count: (v) => (Array.isArray(v) ? v.length : v == null || v === '' ? 0 : 1),
  concat: (...a) => a.map(str).join(''),
  join: (list, sep = ', ') => (Array.isArray(list) ? list.map(str).join(str(sep)) : str(list)),
  sum: (list, key) => (Array.isArray(list) ? list.reduce((t, x) => t + num(key == null ? x : pick(x, key)), 0) : num(list)),
  min: (...a) => Math.min(...flat(a).map(num)),
  max: (...a) => Math.max(...flat(a).map(num)),
  round: (v, d = 0) => { const m = 10 ** num(d); return Math.round(num(v) * m) / m; },
  floor: (v) => Math.floor(num(v)),
  ceil: (v) => Math.ceil(num(v)),
  abs: (v) => Math.abs(num(v)),
  number: (v) => num(v),
  string: (v) => str(v),
  if: (c, a, b = null) => (truthy(c) ? a : b),
  coalesce: (...a) => a.find((x) => x != null && x !== '') ?? null,
  contains: (list, v) => (Array.isArray(list) ? list.some((x) => looseEq(x, v)) : str(list).includes(str(v))),
  empty: (v) => !truthy(v),
  plural: (n, one, many) => (Math.abs(num(n)) === 1 ? str(one) : many == null ? str(one) + 's' : str(many)),
  today: () => localISODate(new Date()),
  year: (d) => { const p = parseDate(d); return p ? p.getFullYear() : null; },
  days_between: (a, b) => { const x = parseDate(a), y = parseDate(b); return x && y ? Math.round((y - x) / 86400000) : null; },
  years_between: (a, b) => { const x = parseDate(a), y = parseDate(b); if (!x || !y) return null; let n = y.getFullYear() - x.getFullYear(); const m = y.getMonth() - x.getMonth(); if (m < 0 || (m === 0 && y.getDate() < x.getDate())) n--; return n; },
  add_days: (d, n) => { const p = parseDate(d); if (!p) return null; p.setDate(p.getDate() + num(n)); return localISODate(p); },
  add_months: (d, n) => { const p = parseDate(d); if (!p) return null; p.setMonth(p.getMonth() + num(n)); return localISODate(p); },
  add_years: (d, n) => { const p = parseDate(d); if (!p) return null; p.setFullYear(p.getFullYear() + num(n)); return localISODate(p); },
  format_number: (v, decimals = 0, locale) => new Intl.NumberFormat(locale || undefined, { minimumFractionDigits: num(decimals), maximumFractionDigits: num(decimals) }).format(num(v)),
  format_money: (v, currency = 'USD', locale) => new Intl.NumberFormat(locale || undefined, { style: 'currency', currency: str(currency) || 'USD' }).format(num(v)),
  format_date: (d, style = 'long', locale) => formatDate(d, style, locale),
  words: (n) => numberToWords(num(n)),
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

export class ExprError extends Error {
  constructor(message, pos) { super(message); this.name = 'ExprError'; this.pos = pos; }
}

// ---------------------------------------------------------------- helpers
function str(v) { return v == null ? '' : Array.isArray(v) ? v.map(str).join(', ') : typeof v === 'object' ? '' : String(v); }
function num(v) { if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; const n = parseFloat(String(v ?? '').replace(/[^0-9.\-eE]/g, '')); return Number.isFinite(n) ? n : 0; }
function flat(a) { return a.flatMap((x) => (Array.isArray(x) ? x : [x])); }
function pick(o, key) { return o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, key) ? o[key] : null; }
export function truthy(v) { if (Array.isArray(v)) return v.length > 0; if (v == null) return false; if (typeof v === 'string') return v.trim() !== '' && v !== 'false' && v !== '0'; if (typeof v === 'object') return true; return !!v; }
function looseEq(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === 'number' || typeof b === 'number') return num(a) === num(b) && (a !== '' && b !== '');
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  return str(a) === str(b);
}
function compare(a, b) { if (typeof a === 'number' || typeof b === 'number') return num(a) - num(b); const x = str(a), y = str(b); return x < y ? -1 : x > y ? 1 : 0; }
function localISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function parseDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getTime());
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
}
export function formatDate(v, style = 'long', locale) {
  const d = parseDate(v); if (!d) return str(v);
  if (style === 'iso') return localISODate(d);
  const opts = style === 'short' ? { year: 'numeric', month: 'numeric', day: 'numeric' }
    : style === 'medium' ? { year: 'numeric', month: 'short', day: 'numeric' }
    : style === 'full' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat(locale || undefined, opts).format(d);
}
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberToWords(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return 'minus ' + numberToWords(-n);
  n = Math.floor(n);
  if (n < 20) return n === 0 ? 'zero' : ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
  const units = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [u, name] of units) if (n >= u) return numberToWords(Math.floor(n / u)) + ' ' + name + (n % u ? (n % u < 100 ? ' and ' : ' ') + numberToWords(n % u) : '');
  return String(n);
}

// ---------------------------------------------------------------- lexer
const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'true', 'false', 'null']);
function tokenize(src) {
  const tokens = []; let i = 0;
  const push = (type, value, pos) => tokens.push({ type, value, pos });
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?|^[0-9]+\.?/.exec(src.slice(i));
      push('number', parseFloat(m[0]), i); i += m[0].length; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, out = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\' && j + 1 < src.length) { j++; } out += src[j]; j++; }
      if (j >= src.length) throw new ExprError('Unterminated string', i);
      push('string', out, i); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const word = m[0];
      if (KEYWORDS.has(word)) push('kw', word, i); else push('ident', word, i);
      i += word.length; continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { push('op', two, i); i += 2; continue; }
    if ('+-*/%<>()[],.!'.includes(c)) { push('op', c, i); i++; continue; }
    if (c === '=') { push('op', '==', i); i++; continue; }
    throw new ExprError(`Unexpected character "${c}"`, i);
  }
  push('eof', null, src.length);
  return tokens;
}

// ---------------------------------------------------------------- parser → AST
export function parse(src) {
  const tokens = tokenize(String(src ?? ''));
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const isOp = (v) => peek().type === 'op' && peek().value === v;
  const isKw = (v) => peek().type === 'kw' && peek().value === v;
  const expect = (v) => { if (!isOp(v)) throw new ExprError(`Expected "${v}"`, peek().pos); return next(); };

  function or() { let left = and(); while (isKw('or') || isOp('||')) { next(); left = { t: 'or', l: left, r: and() }; } return left; }
  function and() { let left = not(); while (isKw('and') || isOp('&&')) { next(); left = { t: 'and', l: left, r: not() }; } return left; }
  function not() { if (isKw('not') || isOp('!')) { next(); return { t: 'not', e: not() }; } return comparison(); }
  function comparison() {
    const left = additive();
    if (peek().type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(peek().value)) { const op = next().value; return { t: 'cmp', op, l: left, r: additive() }; }
    if (isKw('in')) { next(); return { t: 'in', l: left, r: additive() }; }
    return left;
  }
  function additive() { let left = multiplicative(); while (isOp('+') || isOp('-')) { const op = next().value; left = { t: 'bin', op, l: left, r: multiplicative() }; } return left; }
  function multiplicative() { let left = unary(); while (isOp('*') || isOp('/') || isOp('%')) { const op = next().value; left = { t: 'bin', op, l: left, r: unary() }; } return left; }
  function unary() { if (isOp('-')) { next(); return { t: 'neg', e: unary() }; } return postfix(); }
  function postfix() {
    let e = primary();
    while (isOp('.')) { next(); const id = next(); if (id.type !== 'ident') throw new ExprError('Expected property name', id.pos); e = { t: 'member', o: e, k: id.value }; }
    return e;
  }
  function primary() {
    const tok = next();
    if (tok.type === 'number') return { t: 'lit', v: tok.value };
    if (tok.type === 'string') return { t: 'lit', v: tok.value };
    if (tok.type === 'kw') { if (tok.value === 'true') return { t: 'lit', v: true }; if (tok.value === 'false') return { t: 'lit', v: false }; if (tok.value === 'null') return { t: 'lit', v: null }; throw new ExprError(`Unexpected "${tok.value}"`, tok.pos); }
    if (tok.type === 'ident') {
      if (isOp('(')) {
        next(); const args = [];
        if (!isOp(')')) { args.push(or()); while (isOp(',')) { next(); args.push(or()); } }
        expect(')');
        if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, tok.value)) throw new ExprError(`Unknown function "${tok.value}"`, tok.pos);
        return { t: 'call', f: tok.value, args };
      }
      return { t: 'id', n: tok.value };
    }
    if (tok.type === 'op' && tok.value === '(') { const e = or(); expect(')'); return e; }
    if (tok.type === 'op' && tok.value === '[') { const items = []; if (!isOp(']')) { items.push(or()); while (isOp(',')) { next(); items.push(or()); } } expect(']'); return { t: 'list', items }; }
    throw new ExprError(tok.type === 'eof' ? 'Unexpected end of expression' : `Unexpected "${tok.value}"`, tok.pos);
  }
  const ast = or();
  if (peek().type !== 'eof') throw new ExprError(`Unexpected "${peek().value}"`, peek().pos);
  return ast;
}

// ---------------------------------------------------------------- evaluator
function evalNode(n, scope, depth) {
  if (depth > 200) throw new ExprError('Expression too deep', 0);
  switch (n.t) {
    case 'lit': return n.v;
    case 'list': return n.items.map((i) => evalNode(i, scope, depth + 1));
    case 'id': return scope.get(n.n);
    case 'member': { const o = evalNode(n.o, scope, depth + 1); if (Array.isArray(o)) return o.map((row) => pick(row, n.k)); return pick(o, n.k); }
    case 'call': return FUNCTIONS[n.f](...n.args.map((a) => evalNode(a, scope, depth + 1)));
    case 'neg': return -num(evalNode(n.e, scope, depth + 1));
    case 'not': return !truthy(evalNode(n.e, scope, depth + 1));
    case 'and': return truthy(evalNode(n.l, scope, depth + 1)) ? evalNode(n.r, scope, depth + 1) : false;
    case 'or': { const l = evalNode(n.l, scope, depth + 1); return truthy(l) ? l : evalNode(n.r, scope, depth + 1); }
    case 'in': { const v = evalNode(n.l, scope, depth + 1), list = evalNode(n.r, scope, depth + 1); return Array.isArray(list) ? list.some((x) => looseEq(x, v)) : str(list).includes(str(v)); }
    case 'cmp': {
      const a = evalNode(n.l, scope, depth + 1), b = evalNode(n.r, scope, depth + 1);
      switch (n.op) {
        case '==': return looseEq(a, b); case '!=': return !looseEq(a, b);
        case '<': return compare(a, b) < 0; case '<=': return compare(a, b) <= 0;
        case '>': return compare(a, b) > 0; case '>=': return compare(a, b) >= 0;
      }
      break;
    }
    case 'bin': {
      const a = evalNode(n.l, scope, depth + 1), b = evalNode(n.r, scope, depth + 1);
      if (n.op === '+') return (typeof a === 'string' || typeof b === 'string') && !(isNumeric(a) && isNumeric(b)) ? str(a) + str(b) : num(a) + num(b);
      if (n.op === '-') return num(a) - num(b);
      if (n.op === '*') return num(a) * num(b);
      if (n.op === '/') return num(b) === 0 ? null : num(a) / num(b);
      if (n.op === '%') return num(b) === 0 ? null : num(a) % num(b);
      break;
    }
  }
  throw new ExprError('Invalid expression node', 0);
}
function isNumeric(v) { return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))); }

export function makeScope(data, parent) {
  const own = data && typeof data === 'object' ? data : {};
  return {
    get(name) {
      if (Object.prototype.hasOwnProperty.call(own, name)) return own[name];
      if (parent) return parent.get(name);
      return null;
    },
  };
}

/** Evaluate an expression string against a plain data object (or a scope from makeScope). */
export function evaluate(src, data = {}) {
  const scope = data && typeof data.get === 'function' ? data : makeScope(data);
  return evalNode(parse(src), scope, 0);
}

/** Compile once, evaluate many times. */
export function compile(src) {
  const ast = parse(src);
  return (data = {}) => evalNode(ast, data && typeof data.get === 'function' ? data : makeScope(data), 0);
}

/** Returns the identifiers an expression references (for dependency ordering). */
export function references(src) {
  const out = new Set();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'id') out.add(n.n);
    for (const k of ['l', 'r', 'e', 'o']) if (n[k]) walk(n[k]);
    if (n.args) n.args.forEach(walk);
    if (n.items) n.items.forEach(walk);
  };
  walk(parse(src));
  return [...out];
}

/** Validate an expression; returns null when fine or an error message. */
export function validate(src) {
  try { parse(src); return null; } catch (e) { return e.message + (typeof e.pos === 'number' ? ` (at position ${e.pos + 1})` : ''); }
}
