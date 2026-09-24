import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectDocx, renderDocx } from '../../app/lib/render.js';
import { inferQuestionnaire, newTemplate, blankAnswers, normalizeTemplate, validateTemplate, humanize, makeField, singular } from '../../app/lib/schema.js';
import { evaluateForm, buildRenderData, formatValue, coerce } from '../../app/lib/logic.js';
import { PizZip, Docxtemplater } from '../../vendor/docs.js';

const load = (n) => readFileSync(new URL(`../../samples/${n}.docx`, import.meta.url));
const textOf = async (blob) => new Docxtemplater(new PizZip(Buffer.from(await blob.arrayBuffer())), { paragraphLoop: true }).getFullText();

test('humanize and singular', () => {
  assert.equal(humanize('party_a_name'), 'Party A name');
  assert.equal(humanize('client_name'), 'Client name');
  assert.equal(singular('attorneys'), 'attorney');
  assert.equal(singular('parties'), 'party');
  assert.equal(singular('children'), 'child');
  assert.equal(singular('address'), 'address');
});

test('inference from the engagement letter: repeat group, conditions, types, sections', () => {
  const insp = inspectDocx(load('engagement-letter'));
  const q = inferQuestionnaire(insp);
  const byKey = Object.fromEntries(q.fields.map((f) => [f.key, f]));
  assert.equal(byKey.attorneys.type, 'repeat');
  assert.deepEqual(byKey.attorneys.children.map((c) => c.key), ['name', 'role', 'rate']);
  assert.equal(byKey.attorneys.children[2].type, 'money');
  assert.equal(byKey.attorneys.itemLabel, 'Attorney');
  assert.equal(byKey.fee_hourly.type, 'checkbox');
  assert.equal(byKey.fee_flat.role, 'condition');
  assert.equal(byKey.flat_fee.type, 'money');
  assert.equal(byKey.has_retainer.role, 'condition');
  assert.equal(byKey.retainer_amount.type, 'money');
  assert.equal(byKey.retainer_amount.showIf, 'has_retainer');
  assert.equal(byKey.flat_fee_terms.showIf, 'fee_flat');
  assert.equal(byKey.client_name.showIf, '');
  const offer = Object.fromEntries(inferQuestionnaire(inspectDocx(load('offer-letter'))).fields.map((f) => [f.key, f]));
  assert.equal(offer.office_location.showIf, 'not is_remote');   // inside {^is_remote}
  assert.equal(offer.bonus_target.showIf, 'has_bonus');
  assert.equal(byKey.letter_date.type, 'date');
  assert.equal(byKey.client_address.type, 'textarea');
  assert.equal(byKey.payment_days.type, 'number');
  assert.ok(q.sections.find((s) => s.title === 'Client'));
  assert.equal(q.warnings.length, 0);
  // inverted section {^has_retainer} is a condition, and only listed once
  assert.equal(q.fields.filter((f) => f.key === 'has_retainer').length, 1);
});

test('inference from the NDA groups party fields into sections', () => {
  const q = inferQuestionnaire(inspectDocx(load('mutual-nda')));
  const titles = q.sections.map((s) => s.title);
  assert.deepEqual(titles, ['General', 'Party A', 'Party B']);
  const f = q.fields.find((x) => x.key === 'party_a_email');
  assert.equal(f.type, 'email');
  assert.equal(q.sections.find((s) => s.id === f.sectionId).title, 'Party A');
});

test('evaluateForm: required, visibility, repeat rows, computed', () => {
  const t = newTemplate({
    fields: [
      makeField('client_name'), makeField('has_retainer', 'checkbox', { role: 'condition' }),
      makeField('retainer_amount', 'money', { showIf: 'has_retainer' }),
      makeField('attorneys', 'repeat', { min: 1, children: [makeField('name'), makeField('rate', 'money'), makeField('senior', 'checkbox', { showIf: 'rate > 500' })] }),
      makeField('total_rate', 'computed', { expr: 'sum(attorneys.rate)', format: 'money' }),
      makeField('double', 'computed', { expr: 'total_rate * 2' }),
      makeField('loop_a', 'computed', { expr: 'loop_b + 1' }), makeField('loop_b', 'computed', { expr: 'loop_a + 1' }),
    ],
  });
  let ev = evaluateForm(t, blankAnswers(t));
  assert.equal(ev.errors.client_name, 'This field is required.');
  assert.equal(ev.visible.retainer_amount, false);
  assert.equal(ev.errors.retainer_amount, undefined);
  assert.equal(ev.errors['attorneys[0].name'], 'This field is required.');   // min:1 pre-creates one blank row
  assert.match(evaluateForm(t, { ...blankAnswers(t), attorneys: [] }).errors.attorneys, /at least 1 item/);
  assert.equal(ev.exprErrors.loop_a, 'This computed field depends on itself.');

  ev = evaluateForm(t, { client_name: 'Acme', has_retainer: true, retainer_amount: 'abc', attorneys: [{ name: 'Ann', rate: '600' }, { name: '', rate: 200 }] });
  assert.equal(ev.visible.retainer_amount, true);
  assert.equal(ev.errors.retainer_amount, 'Enter a number.');
  assert.equal(ev.errors['attorneys[1].name'], 'This field is required.');
  assert.equal(ev.visible['attorneys[0].senior'], true);
  assert.equal(ev.visible['attorneys[1].senior'], false);
  assert.equal(ev.computed.total_rate, 800);
  assert.equal(ev.computed.double, 1600);
  assert.equal(ev.complete, false);

  const { data, evaluation } = buildRenderData(t, { client_name: 'Acme', has_retainer: false, retainer_amount: 5000, attorneys: [{ name: 'Ann', rate: 600 }] }, { locale: 'en-US', currency: 'USD' });
  assert.equal(evaluation.complete, true);
  assert.equal(data.retainer_amount, '');            // hidden → blank
  assert.equal(data.has_retainer, false);
  assert.equal(data.total_rate, '$600.00');
  assert.equal(data.double, '1200');
  assert.deepEqual(data.attorneys[0], { _index: 1, _first: true, _last: true, _count: 1, name: 'Ann', rate: '$600.00', senior: false });
  assert.match(data._today, /\d{4}/);
});

test('evaluateForm never mutates the answers object (the form keeps live references to rows)', () => {
  const t = newTemplate({ fields: [makeField('attorneys', 'repeat', { children: [makeField('name'), makeField('rate', 'money')] }), makeField('total', 'computed', { expr: 'sum(attorneys.rate)' })] });
  const row = { name: 'Ann', rate: '100' };
  const answers = { attorneys: [row] };
  const ev = evaluateForm(t, answers);
  assert.equal(ev.computed.total, 100);
  assert.equal(answers.attorneys[0], row);
  assert.deepEqual(answers, { attorneys: [{ name: 'Ann', rate: '100' }] });
  row.rate = '250';
  assert.equal(evaluateForm(t, answers).computed.total, 250);
});

test('formatting', () => {
  assert.equal(formatValue(makeField('d', 'date', { format: 'long' }), '2026-09-24', { locale: 'en-US' }), 'September 24, 2026');
  assert.equal(formatValue(makeField('d', 'date', { format: 'iso' }), '2026-09-24'), '2026-09-24');
  assert.equal(formatValue(makeField('m', 'money'), 1234.5, { locale: 'en-US', currency: 'USD' }), '$1,234.50');
  assert.equal(formatValue(makeField('m', 'money', { currency: 'EUR', decimals: 0 }), 1234.5, { locale: 'de-DE' }).replace(/\s/g, ' '), '1.235 \u20ac');
  assert.equal(formatValue(makeField('n', 'number'), 3, { locale: 'en-US' }), '3');
  assert.equal(formatValue(makeField('n', 'number', { decimals: 2 }), 3, { locale: 'en-US' }), '3.00');
  assert.equal(formatValue(makeField('s', 'select', { options: [{ value: 'ca', label: 'California' }] }), 'ca'), 'California');
  assert.equal(coerce(makeField('m', 'money'), '$1,200.50'), 1200.5);
  assert.equal(coerce(makeField('c', 'checkbox'), 'on'), true);
});

test('end to end: infer, answer, render the offer letter', async () => {
  const bytes = load('offer-letter');
  const t = newTemplate({ ...inferQuestionnaire(inspectDocx(bytes)), name: 'Offer' });
  const answers = { ...blankAnswers(t), offer_date: '2026-10-01', candidate_first_name: 'Sam', candidate_full_name: 'Sam Lee', job_title: 'Engineer', company_name: 'Acme', manager_name: 'Pat', manager_title: 'CTO', is_remote: true, office_location: 'Austin', start_date: '2026-11-02', pay_basis: 'annual', salary: 150000, has_bonus: true, bonus_target: '10%', has_equity: false, benefits: [{ item: 'Health insurance' }, { item: '401(k) match' }], pto_days: 20, has_background_check: true, work_country: 'United States', employment_terms: 'at will', response_deadline: '2026-10-08', signatory_name: 'Jo', signatory_title: 'CEO' };
  const { data, evaluation } = buildRenderData(t, answers, { locale: 'en-US', currency: 'USD' });
  assert.equal(evaluation.complete, true, JSON.stringify(evaluation.errors));
  const text = await textOf(renderDocx(bytes, data));
  assert.ok(text.includes('This is a remote position.'));
  assert.ok(!text.includes('Austin'));
  assert.ok(text.includes('$150,000.00'));
  assert.ok(text.includes('Health insurance') && text.includes('401(k) match'));
  assert.ok(!text.includes('equity incentive plan'));
  assert.ok(text.includes('November 2, 2026'));
});

test('normalize and validate templates', () => {
  const t = normalizeTemplate({ id: 'x', name: 'X', fields: [{ key: 'a', type: 'nope' }, { key: 'g', type: 'repeat', children: [{ key: 'c' }] }, { key: 'sel', type: 'select' }, { key: 'calc', type: 'computed' }] });
  assert.equal(t.fields[0].type, 'text');
  assert.equal(t.sections.length, 1);
  assert.equal(t.fields[0].sectionId, t.sections[0].id);
  assert.equal(t.fields[1].children[0].type, 'text');
  const problems = validateTemplate({ ...t, fields: [...t.fields, { key: 'a', type: 'text' }, { key: '9bad', type: 'text' }] });
  assert.ok(problems.some((p) => /used twice/.test(p)));
  assert.ok(problems.some((p) => /"9bad" is not valid/.test(p)));
  assert.ok(problems.some((p) => /needs at least one option/.test(p)));
  assert.ok(problems.some((p) => /has no expression/.test(p)));
});
