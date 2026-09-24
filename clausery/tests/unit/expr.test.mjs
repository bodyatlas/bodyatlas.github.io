import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validate, references, compile, numberToWords, formatDate } from '../../app/lib/expr.js';

test('literals and arithmetic', () => {
  assert.equal(evaluate('1 + 2 * 3'), 7);
  assert.equal(evaluate('(1 + 2) * 3'), 9);
  assert.equal(evaluate('10 / 4'), 2.5);
  assert.equal(evaluate('10 / 0'), null);
  assert.equal(evaluate('7 % 3'), 1);
  assert.equal(evaluate('-5 + 2'), -3);
  assert.equal(evaluate('"a" + "b"'), 'ab');
  assert.equal(evaluate('"Total: " + 5'), 'Total: 5');
  assert.equal(evaluate('"5" + 5'), 10);
});

test('identifiers resolve only against data, never prototypes', () => {
  assert.equal(evaluate('client_name', { client_name: 'Acme' }), 'Acme');
  assert.equal(evaluate('missing'), null);
  assert.equal(evaluate('constructor'), null);
  assert.equal(evaluate('toString'), null);
  assert.equal(evaluate('__proto__'), null);
  assert.equal(evaluate('row.constructor', { row: { a: 1 } }), null);
});

test('comparisons are forgiving about string/number mixing', () => {
  assert.equal(evaluate('salary > 50000', { salary: '60000' }), true);
  assert.equal(evaluate('salary >= 60000', { salary: 60000 }), true);
  assert.equal(evaluate('state == "CA"', { state: 'CA' }), true);
  assert.equal(evaluate('state = "CA"', { state: 'NY' }), false);
  assert.equal(evaluate('state != "CA"', { state: 'NY' }), true);
  assert.equal(evaluate('flag == true', { flag: true }), true);
  assert.equal(evaluate('flag == true', { flag: 'false' }), false);
  assert.equal(evaluate('x == null', {}), true);
});

test('logic', () => {
  assert.equal(evaluate('a and b', { a: true, b: false }), false);
  assert.equal(evaluate('a or b', { a: false, b: 'yes' }), 'yes');
  assert.equal(evaluate('not a', { a: '' }), true);
  assert.equal(evaluate('!a && b', { a: false, b: true }), true);
  assert.equal(evaluate('a || b', { a: 0, b: 0 }), 0);
  assert.equal(evaluate('has_bonus and bonus_target > 10', { has_bonus: true, bonus_target: 15 }), true);
  assert.equal(evaluate('state in ["CA", "NY"]', { state: 'NY' }), true);
  assert.equal(evaluate('state in ["CA", "NY"]', { state: 'TX' }), false);
});

test('functions', () => {
  assert.equal(evaluate('upper(name)', { name: 'acme' }), 'ACME');
  assert.equal(evaluate('title("jane doe")'), 'Jane Doe');
  assert.equal(evaluate('len(items)', { items: [1, 2, 3] }), 3);
  assert.equal(evaluate('count(items)', { items: [] }), 0);
  assert.equal(evaluate('sum(items, "rate")', { items: [{ rate: 100 }, { rate: '250' }] }), 350);
  assert.equal(evaluate('sum(items.rate)', { items: [{ rate: 100 }, { rate: 50 }] }), 150);
  assert.equal(evaluate('join(items.name, "; ")', { items: [{ name: 'A' }, { name: 'B' }] }), 'A; B');
  assert.equal(evaluate('round(2.345, 2)'), 2.35);
  assert.equal(evaluate('if(x > 1, "many", "one")', { x: 3 }), 'many');
  assert.equal(evaluate('coalesce(a, b, "n/a")', { a: '', b: null }), 'n/a');
  assert.equal(evaluate('plural(n, "day")', { n: 1 }), 'day');
  assert.equal(evaluate('plural(n, "day")', { n: 3 }), 'days');
  assert.equal(evaluate('plural(n, "party", "parties")', { n: 2 }), 'parties');
  assert.equal(evaluate('contains(list, "b")', { list: ['a', 'b'] }), true);
  assert.equal(evaluate('format_money(1234.5, "USD", "en-US")'), '$1,234.50');
  assert.equal(evaluate('format_number(1234.567, 2, "en-US")'), '1,234.57');
  assert.equal(evaluate('words(1234)'), 'one thousand two hundred and thirty-four');
  assert.equal(numberToWords(0), 'zero');
  assert.equal(numberToWords(21), 'twenty-one');
  assert.equal(numberToWords(1000000), 'one million');
});

test('dates', () => {
  assert.equal(evaluate('add_days("2026-01-30", 3)'), '2026-02-02');
  assert.equal(evaluate('add_years(start, 3)', { start: '2026-09-24' }), '2029-09-24');
  assert.equal(evaluate('days_between("2026-01-01", "2026-01-31")'), 30);
  assert.equal(evaluate('years_between("2000-05-10", "2026-05-09")'), 25);
  assert.equal(evaluate('years_between("2000-05-10", "2026-05-10")'), 26);
  assert.equal(evaluate('year(d)', { d: '2026-09-24' }), 2026);
  assert.equal(formatDate('2026-09-24', 'long', 'en-US'), 'September 24, 2026');
  assert.equal(formatDate('2026-09-24', 'iso'), '2026-09-24');
  assert.equal(formatDate('2026-09-24', 'short', 'en-US'), '9/24/2026');
  assert.match(evaluate('today()'), /^\d{4}-\d{2}-\d{2}$/);
});

test('errors are reported, never thrown as raw JS errors', () => {
  assert.equal(validate('1 +'), 'Unexpected end of expression (at position 4)');
  assert.match(validate('foo('), /Unexpected end/);
  assert.match(validate('nope(1)'), /Unknown function "nope"/);
  assert.match(validate('"abc'), /Unterminated string/);
  assert.match(validate('1 $ 2'), /Unexpected character/);
  assert.equal(validate('a and (b or c)'), null);
  assert.throws(() => evaluate('1 +'), { name: 'ExprError' });
});

test('references and compile', () => {
  assert.deepEqual(references('a and (b or c) + sum(items.rate)').sort(), ['a', 'b', 'c', 'items']);
  const fn = compile('base * (1 + rate)');
  assert.equal(fn({ base: 100, rate: 0.2 }), 120);
  assert.equal(fn({ base: 50, rate: 0 }), 50);
});
