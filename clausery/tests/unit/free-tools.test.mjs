import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from '../../free-tools/amount-in-words.js';
import { addPeriod } from '../../free-tools/deadline-calculator.js';

test('amount in words: contract, cheque and plain styles', () => {
  assert.equal(amountInWords('1250.50', 'USD', 'legal').withFigure, 'One Thousand Two Hundred and Fifty Dollars and Fifty Cents ($1,250.50)');
  assert.equal(amountInWords('1,250.50', 'USD', 'cheque').text, 'One Thousand Two Hundred and Fifty Dollars and 50/100');
  assert.equal(amountInWords('1', 'GBP', 'legal').text, 'One Pound');
  assert.equal(amountInWords('2.01', 'GBP', 'legal').text, 'Two Pounds and One Penny');
  assert.equal(amountInWords('$5000', 'USD', 'legal', 'upper').text, 'FIVE THOUSAND DOLLARS');
  assert.match(amountInWords('12.345', 'USD').error, /two decimal places/);
  assert.match(amountInWords('abc', 'USD').error, /Enter a number/);
});

test('deadline calculator: month-end clamping, business days and holidays', () => {
  assert.equal(addPeriod('2026-01-31', 1, 'months').date, '2026-02-28');
  assert.equal(addPeriod('2024-02-29', 1, 'years').date, '2025-02-28');
  assert.equal(addPeriod('2026-09-25', 5, 'business').date, '2026-10-02');            // Friday + 5 business days
  assert.equal(addPeriod('2026-09-25', 5, 'business', 1, ['2026-09-28']).date, '2026-10-05');
  assert.equal(addPeriod('2026-10-05', 1, 'business', -1).date, '2026-10-02');         // Monday - 1 business day = Friday
  assert.equal(addPeriod('2026-09-25', 30, 'days', -1).date, '2026-08-26');
  assert.equal(addPeriod('2026-09-25', 2, 'weeks').date, '2026-10-09');
  assert.match(addPeriod('nope', 1, 'days').error, /valid start date/);
  assert.match(addPeriod('2026-09-25', -3, 'days').error, /whole number/);
});
