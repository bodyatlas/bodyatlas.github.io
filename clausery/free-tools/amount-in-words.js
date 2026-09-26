/* Amount in words: converts a number to the wording used in contracts, cheques and promissory notes. Runs locally. */
import { numberToWords } from '../app/lib/expr.js';

const CURRENCIES = {
  USD: ['dollar', 'dollars', 'cent', 'cents', '$'], EUR: ['euro', 'euros', 'cent', 'cents', '€'], GBP: ['pound', 'pounds', 'penny', 'pence', '£'],
  CAD: ['Canadian dollar', 'Canadian dollars', 'cent', 'cents', 'CA$'], AUD: ['Australian dollar', 'Australian dollars', 'cent', 'cents', 'A$'],
  INR: ['rupee', 'rupees', 'paisa', 'paise', '₹'], ZAR: ['rand', 'rand', 'cent', 'cents', 'R'], NONE: ['', '', '', '', ''],
};
const $ = (id) => document.getElementById(id);
const title = (s) => s.replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bAnd\b/g, 'and');

export function amountInWords(raw, currency = 'USD', style = 'legal', caps = 'title') {
  const cleaned = String(raw).replace(/[,\s]/g, '').replace(/^[^\d.-]+/, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return { error: 'Enter a number such as 1250 or 1,250.50 (up to two decimal places).' };
  const value = Number(cleaned);
  if (Math.abs(value) >= 1e15) return { error: 'Enter an amount below one quadrillion.' };
  const whole = Math.floor(Math.abs(value)); const cents = Math.round((Math.abs(value) - whole) * 100);
  const [one, many, sub, subs, sym] = CURRENCIES[currency] || CURRENCIES.USD;
  const neg = value < 0 ? 'minus ' : '';
  let words = numberToWords(whole);
  const unit = whole === 1 ? one : many;
  let text;
  if (style === 'cheque') text = `${neg}${words}${unit ? ' ' + unit : ''} and ${String(cents).padStart(2, '0')}/100`;
  else if (style === 'plain') text = `${neg}${words}${cents ? ' point ' + String(cents).padStart(2, '0').split('').map((d) => numberToWords(+d)).join(' ') : ''}`;
  else text = `${neg}${words}${unit ? ' ' + unit : ''}${cents ? ` and ${numberToWords(cents)} ${cents === 1 ? sub : subs}` : ''}`;
  if (caps === 'title') text = title(text); else if (caps === 'upper') text = text.toUpperCase();
  const figure = (value < 0 ? '-' : '') + (sym || '') + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: cents || style === 'cheque' ? 2 : 0, maximumFractionDigits: 2 });
  return { text, withFigure: `${text} (${figure})` };
}

function run() {
  const r = amountInWords($('amount').value, $('currency').value, $('style').value, $('caps').value);
  $('error').textContent = r.error || ''; $('error').hidden = !r.error;
  $('result').textContent = r.error ? '' : r.text; $('result-figure').textContent = r.error ? '' : r.withFigure;
}
if (typeof document !== 'undefined' && $('amount')) {
  for (const id of ['amount', 'currency', 'style', 'caps']) $(id).addEventListener('input', run);
  for (const b of document.querySelectorAll('[data-copy]')) b.addEventListener('click', () => {
    const text = $(b.dataset.copy).textContent; const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); });
  run();
}
