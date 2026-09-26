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
   Values: numbers, strings, booleans, null, arrays, plain objects (repeat rows).
   Chains of the same operator (a + b + c, x or y or z) parse to one flat node, so only real nesting
   (parentheses, calls, lists, prefix operators) counts towards the depth limit. */

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
  add_months: (d, n) => { const p = parseDate(d); return p ? localISODate(addMonths(p, num(n))) : null; },
  add_years: (d, n) => { const p = parseDate(d); return p ? localISODate(addMonths(p, num(n) * 12)) : null; },
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
/** A number, a boolean, or text that is entirely a number ("60000", " 1.5 "); not "" or "12 Main St". */
function isNumeric(v) { return typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))); }
function looseEq(a, b) {
  if (a == null && b == null) return true;
  // numeric comparison only when both sides are numbers (or numeric text): 0 == "none" and 0 == null are false
  if (typeof a === 'number' || typeof b === 'number') return isNumeric(a) && isNumeric(b) && num(a) === num(b);
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  return str(a) === str(b);
}
/* Ordering: numeric when both sides are numeric (numbers typed as text compare as numbers); a number against
   non-numeric text or an empty answer is incomparable (every < <= > >= is false); text against text is alphabetical. */
function compare(a, b) {
  if (isNumeric(a) && isNumeric(b)) return num(a) - num(b);
  if (typeof a === 'number' || typeof b === 'number') return NaN;
  const x = str(a), y = str(b); return x < y ? -1 : x > y ? 1 : 0;
}
function localISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/** Month arithmetic that clamps to the last day of the target month (Jan 31 + 1 month = Feb 28), like Excel's EDATE. */
function addMonths(p, months) {
  const total = p.getFullYear() * 12 + p.getMonth() + Math.trunc(months);
  const y = Math.floor(total / 12), m = total - y * 12;
  return new Date(y, m, Math.min(p.getDate(), new Date(y, m + 1, 0).getDate()));
}
export function parseDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getTime());
  if (typeof v !== 'string') return null;
  const s = v.trim();
  // ISO dates (optionally followed by a time) and partial dates (2026, 2026-09) are built as local dates and must be real calendar dates
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:$|T)/.exec(s);
  if (m) {
    const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
    const out = new Date(y, mo - 1, d);
    return out.getFullYear() === y && out.getMonth() === mo - 1 && out.getDate() === d ? out : null;
  }
  // written or slashed dates ("September 24, 2026", "9/24/2026") need a four-digit year; bare numbers like "1" are not dates
  if (!/\d{4}/.test(s) || !/[A-Za-z/]/.test(s)) return null;
  const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d;
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
const MAX_DEPTH = 100;   // nesting levels (parentheses, calls, lists, prefix operators, member chains); chains of one operator do not nest

export function parse(src) {
  const tokens = tokenize(String(src ?? ''));
  let p = 0, depth = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const isOp = (v) => peek().type === 'op' && peek().value === v;
  const isKw = (v) => peek().type === 'kw' && peek().value === v;
  const expect = (v) => { if (!isOp(v)) throw new ExprError(`Expected "${v}"`, peek().pos); return next(); };
  // every construct that recurses into the grammar goes through nest(), so the parser (and later the evaluator) never overflows the stack
  const nest = (fn) => { if (++depth > MAX_DEPTH) throw new ExprError('Expression too deep', peek().pos); try { return fn(); } finally { depth--; } };

  function or() { const items = [and()]; while (isKw('or') || isOp('||')) { next(); items.push(and()); } return items.length === 1 ? items[0] : { t: 'or', items }; }
  function and() { const items = [not()]; while (isKw('and') || isOp('&&')) { next(); items.push(not()); } return items.length === 1 ? items[0] : { t: 'and', items }; }
  function not() { if (isKw('not') || isOp('!')) { next(); return { t: 'not', e: nest(not) }; } return comparison(); }
  function comparison() {
    const left = additive();
    if (peek().type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(peek().value)) { const op = next().value; return { t: 'cmp', op, l: left, r: additive() }; }
    if (isKw('in')) { next(); return { t: 'in', l: left, r: additive() }; }
    return left;
  }
  function chain(operand, ops) {
    const items = [operand()], opList = [];
    while (ops.some((o) => isOp(o))) { opList.push(next().value); items.push(operand()); }
    return items.length === 1 ? items[0] : { t: 'arith', ops: opList, items };
  }
  function additive() { return chain(multiplicative, ['+', '-']); }
  function multiplicative() { return chain(unary, ['*', '/', '%']); }
  function unary() { if (isOp('-')) { next(); return { t: 'neg', e: nest(unary) }; } return postfix(); }
  function postfix() {
    let e = primary(), n = 0;
    while (isOp('.')) {
      next(); const id = next(); if (id.type !== 'ident') throw new ExprError('Expected property name', id.pos);
      if (++n > MAX_DEPTH) throw new ExprError('Expression too deep', id.pos);
      e = { t: 'member', o: e, k: id.value };
    }
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
        if (!isOp(')')) { args.push(nest(or)); while (isOp(',')) { next(); args.push(nest(or)); } }
        expect(')');
        if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, tok.value)) throw new ExprError(`Unknown function "${tok.value}"`, tok.pos);
        return { t: 'call', f: tok.value, args };
      }
      return { t: 'id', n: tok.value };
    }
    if (tok.type === 'op' && tok.value === '(') { const e = nest(or); expect(')'); return e; }
    if (tok.type === 'op' && tok.value === '[') { const items = []; if (!isOp(']')) { items.push(nest(or)); while (isOp(',')) { next(); items.push(nest(or)); } } expect(']'); return { t: 'list', items }; }
    throw new ExprError(tok.type === 'eof' ? 'Unexpected end of expression' : `Unexpected "${tok.value}"`, tok.pos);
  }
  const ast = or();
  if (peek().type !== 'eof') throw new ExprError(`Unexpected "${peek().value}"`, peek().pos);
  return ast;
}

// ---------------------------------------------------------------- evaluator
function arith(op, a, b) {
  // "+" joins text whenever either side is text (even "5" + 5 = "55"); Number and Money answers are real numbers, so they add
  if (op === '+') return typeof a === 'string' || typeof b === 'string' ? str(a) + str(b) : num(a) + num(b);
  if (op === '-') return num(a) - num(b);
  if (op === '*') return num(a) * num(b);
  if (op === '/') return num(b) === 0 ? null : num(a) / num(b);
  return num(b) === 0 ? null : num(a) % num(b);
}
function evalNode(n, scope, depth) {
  if (depth > 1000) throw new ExprError('Expression too deep', 0);   // belt and braces: parse() already bounds nesting
  switch (n.t) {
    case 'lit': return n.v;
    case 'list': return n.items.map((i) => evalNode(i, scope, depth + 1));
    case 'id': return scope.get(n.n);
    case 'member': { const o = evalNode(n.o, scope, depth + 1); if (Array.isArray(o)) return o.map((row) => pick(row, n.k)); return pick(o, n.k); }
    case 'call': return FUNCTIONS[n.f](...n.args.map((a) => evalNode(a, scope, depth + 1)));
    case 'neg': return -num(evalNode(n.e, scope, depth + 1));
    case 'not': return !truthy(evalNode(n.e, scope, depth + 1));
    case 'and': { let v = true; for (const i of n.items) { v = evalNode(i, scope, depth + 1); if (!truthy(v)) return false; } return v; }
    case 'or': { let v = null; for (const i of n.items) { v = evalNode(i, scope, depth + 1); if (truthy(v)) return v; } return v; }
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
    case 'arith': {
      let acc = evalNode(n.items[0], scope, depth + 1);
      for (let i = 1; i < n.items.length; i++) acc = arith(n.ops[i - 1], acc, evalNode(n.items[i], scope, depth + 1));
      return acc;
    }
  }
  throw new ExprError('Invalid expression node', 0);
}

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

/**
 * The identifiers an expression references, with the member keys read off each one:
 * "sum(items.rate) + count(items) * fee" → { items: null, fee: [] } (null = the whole value is used, not just named members).
 */
export function referenceDetails(src) {
  const out = new Map();
  const walk = (n, memberOf) => {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'id') {
      if (!out.has(n.n)) out.set(n.n, memberOf == null ? null : [memberOf]);
      else if (out.get(n.n) !== null) { if (memberOf == null) out.set(n.n, null); else if (!out.get(n.n).includes(memberOf)) out.get(n.n).push(memberOf); }
      return;
    }
    if (n.t === 'member') { walk(n.o, n.o.t === 'id' ? n.k : null); return; }
    for (const k of ['l', 'r', 'e', 'o']) if (n[k]) walk(n[k], null);
    if (n.args) n.args.forEach((a) => walk(a, null));
    if (n.items) n.items.forEach((i) => walk(i, null));
  };
  walk(parse(src), null);
  return out;
}

/** Returns the identifiers an expression references (for dependency ordering). */
export function references(src) { return [...referenceDetails(src).keys()]; }

/** Validate an expression; returns null when fine or an error message. */
export function validate(src) {
  try { parse(src); return null; } catch (e) {
    if (!(e instanceof ExprError)) return 'Expression too deep';
    return e.message + (typeof e.pos === 'number' ? ` (at position ${e.pos + 1})` : '');
  }
}
