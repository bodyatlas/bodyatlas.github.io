/* Deadline calculator: adds or subtracts calendar days, business days, weeks, months or years, with month-end clamping
   (January 31 + 1 month = February 28/29) and optional holidays. Runs locally. */
import { evaluate, parseDate, formatDate } from '../app/lib/expr.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addPeriod(start, amount, unit, direction = 1, holidays = []) {
  const d = parseDate(start); if (!d) return { error: 'Enter a valid start date.' };
  const n = Number(amount); if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Enter a whole number of 0 or more.' };
  const sign = direction < 0 ? -1 : 1;
  if (unit === 'months' || unit === 'years') {
    const fn = unit === 'months' ? 'add_months' : 'add_years';
    return { date: evaluate(`${fn}(d, n)`, { d: iso(d), n: sign * n }) };
  }
  if (unit === 'business') {
    const skip = new Set(holidays);
    let left = n; const cur = new Date(d);
    while (left > 0) { cur.setDate(cur.getDate() + sign); const w = cur.getDay(); if (w !== 0 && w !== 6 && !skip.has(iso(cur))) left--; }
    return { date: iso(cur) };
  }
  const cur = new Date(d); cur.setDate(cur.getDate() + sign * n * (unit === 'weeks' ? 7 : 1));
  return { date: iso(cur) };
}

const $ = (id) => document.getElementById(id);
function run() {
  const holidays = $('holidays').value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => { const p = parseDate(x); return p ? iso(p) : null; }).filter(Boolean);
  const r = addPeriod($('start').value, $('amount').value, $('unit').value, $('direction').value === 'before' ? -1 : 1, holidays);
  $('error').textContent = r.error || ''; $('error').hidden = !r.error;
  if (r.error) { $('result').textContent = ''; $('result-note').textContent = ''; return; }
  $('result').textContent = formatDate(r.date, 'full', 'en-US');
  const wd = parseDate(r.date).getDay();
  $('result-note').textContent = (wd === 0 || wd === 6) && $('unit').value !== 'business' ? 'This falls on a weekend. Check whether your contract or court rules move it to the next business day.' : r.date;
}
if (typeof document !== 'undefined' && $('start')) {
  $('start').value = iso(new Date());
  for (const id of ['start', 'amount', 'unit', 'direction', 'holidays']) $(id).addEventListener('input', run);
  run();
}
