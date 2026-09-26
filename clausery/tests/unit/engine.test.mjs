/* Engine behaviour on real (minimal) .docx files: inference of the questionnaire from tags in every part of the document,
   evaluation order (visibility before values, rows before totals), reserved keys, and paragraph tidying before rendering. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocx, partText, paragraphs } from './docx-helper.mjs';
import { inspectDocx, renderDocx, tidyLoneSectionTags } from '../../app/lib/render.js';
import { inferQuestionnaire, newTemplate, blankAnswers, makeField, normalizeTemplate, validateTemplate, inferFieldType, inferSectionRole, isReservedKey, KEY_RX } from '../../app/lib/schema.js';
import { evaluateForm, buildRenderData, formatValue, coerce } from '../../app/lib/logic.js';

const buf = async (blob) => Buffer.from(await blob.arrayBuffer());
const bodyText = async (bytes, data) => partText(await buf(renderDocx(bytes, data)), 'word/document.xml');
const shape = (q) => q.fields.map((f) => [f.key, f.type, (f.children || []).map((c) => c.key)]);
const US = { locale: 'en-US', currency: 'USD' };

test('F09: tags in headers, footers and footnotes become questions and are filled', async () => {
  const bytes = makeDocx({ body: ['Dear {client_name},'], header: ['Our ref: {matter_ref} {#hdr_cond}CONFIDENTIAL{/hdr_cond}'], footer: ['Footer {footer_tag}'], footnote: ['Note {note_tag}'] });
  const insp = inspectDocx(bytes);
  assert.deepEqual(insp.order.map((o) => [o.key, o.part]), [['client_name', 'body'], ['matter_ref', 'header'], ['hdr_cond', 'header'], ['footer_tag', 'footer'], ['note_tag', 'footnote']]);
  assert.equal(insp.order[1].file, 'word/header1.xml');
  assert.match(insp.text, /^Dear \{client_name\},/);
  assert.match(insp.text, /\[header\] Our ref: \{matter_ref\}/);
  assert.match(insp.text, /\[footer\] Footer \{footer_tag\}/);
  const q = inferQuestionnaire(insp);
  assert.deepEqual(q.fields.map((f) => f.key), ['client_name', 'matter_ref', 'hdr_cond', 'footer_tag', 'note_tag']);
  assert.equal(q.fields[2].type, 'checkbox');
  const t = newTemplate(q);
  const out = await buf(renderDocx(bytes, buildRenderData(t, { ...blankAnswers(t), client_name: 'Acme', matter_ref: 'M-1', hdr_cond: true, footer_tag: 'F', note_tag: 'N' }).data));
  assert.equal(partText(out, 'word/header1.xml'), 'Our ref: M-1 CONFIDENTIAL');
  assert.equal(partText(out, 'word/footer1.xml'), 'Footer F');
  assert.equal(partText(out, 'word/footnotes.xml'), 'Note N');
});

test('F05: an inverted {^group} block is the empty-list branch of a repeating group, not a yes/no', async () => {
  const bytes = makeDocx({ body: ['Attorneys:', '{#attorneys}- {name}, {rate} per hour{/attorneys}', '{^attorneys}No attorneys assigned.{/attorneys}'] });
  const q = inferQuestionnaire(inspectDocx(bytes));
  assert.deepEqual(shape(q), [['attorneys', 'repeat', ['name', 'rate']]]);
  assert.equal(q.warnings.length, 0);
  const t = newTemplate(q);
  assert.equal(await bodyText(bytes, buildRenderData(t, { attorneys: [] }).data), 'Attorneys:No attorneys assigned.');
  assert.equal(await bodyText(bytes, buildRenderData(t, { attorneys: [{ name: 'Ann', rate: 500 }, { name: 'Bob', rate: 300 }] }, US).data), 'Attorneys:- Ann, $500.00 per hour- Bob, $300.00 per hour');
  // tags inside the empty branch are ordinary questions shown when the list is empty
  const q2 = inferQuestionnaire(inspectDocx(makeDocx({ body: ['{#items}{name};{/items}{^items}Contact {fallback_contact}{/items}'] })));
  assert.deepEqual(shape(q2), [['items', 'repeat', ['name']], ['fallback_contact', 'text', []]]);
  assert.equal(q2.fields[1].showIf, 'not items');
  // inverted yes/no sections are still conditions
  assert.equal(inferQuestionnaire(inspectDocx(makeDocx({ body: ['{^has_spouse}Single{/has_spouse}'] }))).fields[0].type, 'checkbox');
});

test('F21/F22/F30: section roles and field types for tricky names', () => {
  assert.equal(inferSectionRole('bonus', { hasChildren: true, childKeys: ['bonus_amount'] }), 'condition');
  assert.equal(inferSectionRole('status', { hasChildren: true, childKeys: ['x'] }), 'condition');
  assert.equal(inferSectionRole('terms', { hasChildren: true, childKeys: ['terms_text', 'terms_days'] }), 'condition');
  assert.equal(inferSectionRole('attorneys', { hasChildren: true, childKeys: ['name'] }), 'repeat');
  assert.equal(inferSectionRole('parties', { hasChildren: true, childKeys: ['party_name'] }), 'repeat');
  assert.equal(inferSectionRole('items', { hasChildren: false }), 'condition');
  const q = inferQuestionnaire(inspectDocx(makeDocx({ body: ['{#bonus}You are eligible for a bonus of {bonus_amount}.{/bonus}'] })));
  assert.deepEqual(shape(q), [['bonus', 'checkbox', []], ['bonus_amount', 'money', []]]);
  assert.equal(q.fields[1].showIf, 'bonus');
  assert.deepEqual(['case_number', 'suite_number', 'invoice_no', 'tax_id', 'account_number'].map(inferFieldType), ['text', 'text', 'text', 'text', 'text']);
  assert.deepEqual(['number_of_employees', 'employee_count', 'phone_number', 'number', 'term_years'].map(inferFieldType), ['number', 'number', 'phone', 'number', 'number']);
  assert.deepEqual(['flat_fee_terms', 'fee_description', 'payment_terms', 'flat_fee', 'payment_days'].map(inferFieldType), ['textarea', 'textarea', 'textarea', 'money', 'number']);
  assert.equal(coerce(makeField('n', 'number'), 'ABC-123'), 'ABC-123');
  assert.equal(coerce(makeField('n', 'number'), '12abc'), '12abc');
  assert.equal(coerce(makeField('n', 'number'), ''), null);
  assert.equal(coerce(makeField('m', 'money'), '$1,200.50'), 1200.5);
  assert.equal(coerce(makeField('m', 'money'), 'USD 500'), 500);
  assert.equal(evaluateForm(newTemplate({ fields: [makeField('n', 'number')] }), { n: '12abc' }).errors.n, 'Enter a number.');
});

test('F08: engine built-ins are never questions and always win over stale children', async () => {
  const bytes = makeDocx({ body: ['{#parties}{name}{^_last}, {/_last}{/parties}', '{#parties}{_index} of {_count}: {name}{#_first} (lead){/_first}{/parties}', 'Dated {_today} by {_firm_name}'] });
  const q = inferQuestionnaire(inspectDocx(bytes));
  assert.deepEqual(shape(q), [['parties', 'repeat', ['name']]]);
  const t = newTemplate(q);
  const { data, evaluation } = buildRenderData(t, { parties: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }, { firmName: 'ACME LLP', locale: 'en-US' });
  assert.deepEqual(evaluation.errors, {});
  assert.equal(await bodyText(bytes, data), `A, B, C1 of 3: A (lead)2 of 3: B3 of 3: CDated ${data._today} by ACME LLP`);
  // a template saved by an older version with a "_last" child: normalize drops it, and the render data keeps the built-in anyway
  const stale = newTemplate({ fields: [makeField('parties', 'repeat', { children: [makeField('name'), makeField('_last', 'checkbox', { role: 'condition' })] }), makeField('_today')] });
  assert.deepEqual(normalizeTemplate(stale).fields.map((f) => [f.key, (f.children || []).map((c) => c.key)]), [['parties', ['name']]]);
  assert.deepEqual(buildRenderData(stale, { parties: [{ name: 'A', _last: false }, { name: 'B', _last: false }] }).data.parties.map((r) => r._last), [false, true]);
  assert.ok(isReservedKey('_index') && !isReservedKey('index'));
  assert.ok(!KEY_RX.test('_mine') && KEY_RX.test('mine_1'));
  assert.ok(validateTemplate({ name: 'x', fields: [{ key: '_x', type: 'text' }] }).some((p) => /starting with a letter/.test(p)));
});

test('F20/F59/F31: a key used in two ways (value + loop, section + value, top level + row)', async () => {
  // plain tag before the loop with the same key: still a repeating group with its children, no crash
  let bytes = makeDocx({ body: ['There are {attorneys} attorneys.', '{#attorneys}- {name}{#is_partner} (partner){/is_partner}{/attorneys}'] });
  let q = inferQuestionnaire(inspectDocx(bytes));
  assert.deepEqual(shape(q), [['attorneys', 'repeat', ['name', 'is_partner']]]);
  assert.match(q.warnings[0], /"attorneys" is used both as a plain tag and as a repeating section/);
  assert.deepEqual(shape(inferQuestionnaire(inspectDocx(makeDocx({ body: ['{#attorneys}- {name}{/attorneys}', 'There are {attorneys} attorneys.'] })))), [['attorneys', 'repeat', ['name']]]);
  // "show only if filled": a section that is also a value is a text answer, and the section follows it
  bytes = makeDocx({ body: ['{#spouse_name}Spouse: {spouse_name}{/spouse_name}'] });
  q = inferQuestionnaire(inspectDocx(bytes));
  assert.deepEqual(q.fields.map((f) => [f.key, f.type, f.role, f.showIf]), [['spouse_name', 'text', 'value', '']]);
  assert.match(q.warnings[0], /used both as a section and as a value/);
  let t = newTemplate(q);
  assert.equal(await bodyText(bytes, buildRenderData(t, { spouse_name: 'Jo' }).data), 'Spouse: Jo');
  assert.equal(await bodyText(bytes, buildRenderData(t, { spouse_name: '' }).data), '');
  // a tag used outside and inside a group is asked once and reaches every row
  for (const body of [['Firm: {firm}', '{#attorneys}{name} at {firm}{/attorneys}'], ['{#attorneys}{name} at {firm}{/attorneys}', 'Firm: {firm}']]) {
    bytes = makeDocx({ body });
    q = inferQuestionnaire(inspectDocx(bytes));
    assert.deepEqual(shape(q).sort(), [['attorneys', 'repeat', ['name']], ['firm', 'text', []]]);
    assert.match(q.warnings[0], /"firm" appears both inside \{#attorneys\} and outside it/);
    t = newTemplate(q);
    const text = await bodyText(bytes, buildRenderData(t, { firm: 'ACME', attorneys: [{ name: 'A' }, { name: 'B' }] }).data);
    assert.ok(text.includes('A at ACME') && text.includes('B at ACME') && text.includes('Firm: ACME'), text);
  }
  // an older template that asks the same key in both places: a blank row value falls back to the top-level answer
  t = newTemplate({ fields: [makeField('firm'), makeField('attorneys', 'repeat', { children: [makeField('name'), makeField('firm')] })] });
  assert.equal(await bodyText(bytes, buildRenderData(t, { firm: 'ACME', attorneys: [{ name: 'A', firm: '' }, { name: 'B', firm: 'Other' }] }).data), 'A at ACMEB at OtherFirm: ACME');
});

test('F06: hidden answers are blank for calculations and later rules too', () => {
  const t = newTemplate({ fields: [
    makeField('has_retainer', 'checkbox', { role: 'condition' }), makeField('retainer_amount', 'money', { showIf: 'has_retainer' }), makeField('flat_fee', 'money'),
    makeField('total_due', 'computed', { expr: 'retainer_amount + flat_fee', format: 'money' }),
    makeField('big_retainer_terms', 'text', { showIf: 'retainer_amount > 1000' }), makeField('big_retainer', 'computed', { role: 'condition', expr: 'retainer_amount > 1000' }),
  ] });
  const off = buildRenderData(t, { has_retainer: false, retainer_amount: 5000, flat_fee: 100, big_retainer_terms: 'x' }, US);
  assert.equal(off.data.retainer_amount, '');
  assert.equal(off.data.total_due, '$100.00');
  assert.equal(off.data.big_retainer_terms, '');
  assert.equal(off.data.big_retainer, false);
  assert.equal(off.evaluation.visible.big_retainer_terms, false);
  const on = buildRenderData(t, { has_retainer: true, retainer_amount: 5000, flat_fee: 100, big_retainer_terms: 'x' }, US);
  assert.equal(on.data.total_due, '$5,100.00');
  assert.equal(on.data.big_retainer_terms, 'x');
  assert.equal(on.data.big_retainer, true);
  // a rule may refer to a computed field declared later
  const t2 = newTemplate({ fields: [makeField('note', 'text', { showIf: 'total > 100' }), makeField('a', 'money'), makeField('total', 'computed', { expr: 'a * 2' })] });
  assert.equal(evaluateForm(t2, { note: 'n', a: 100 }).visible.note, true);
  assert.equal(evaluateForm(t2, { note: 'n', a: 10 }).visible.note, false);
  // hidden computed fields are blank for others as well
  const t3 = newTemplate({ fields: [makeField('show', 'checkbox'), makeField('helper', 'computed', { expr: '10', showIf: 'show' }), makeField('total', 'computed', { expr: 'helper + 1' })] });
  assert.equal(evaluateForm(t3, { show: false }).computed.total, 1);
  assert.equal(evaluateForm(t3, { show: true }).computed.total, 11);
  // rows: a hidden child is blank for row calculations and top-level totals
  const t4 = newTemplate({ fields: [
    makeField('items', 'repeat', { children: [makeField('taxable', 'checkbox'), makeField('amount', 'money'), makeField('tax', 'money', { showIf: 'taxable' }), makeField('line_total', 'computed', { expr: 'amount + tax', format: 'money' })] }),
    makeField('grand_total', 'computed', { expr: 'sum(items.tax) + sum(items.amount)', format: 'money' }),
  ] });
  const rows = buildRenderData(t4, { items: [{ taxable: false, tax: 50, amount: 100 }, { taxable: true, tax: 20, amount: 100 }] }, US);
  assert.equal(rows.data.items[0].tax, '');
  assert.equal(rows.data.items[0].line_total, '$100.00');
  assert.equal(rows.data.items[1].line_total, '$120.00');
  assert.equal(rows.data.grand_total, '$220.00');
});

test('F07/F18: row computed children feed top-level totals, in dependency order, whatever the declaration order', () => {
  const items = () => makeField('items', 'repeat', { children: [makeField('qty', 'number'), makeField('price', 'money'), makeField('line_total', 'computed', { expr: 'qty * price', format: 'money' })] });
  const answers = { items: [{ qty: 2, price: 10 }, { qty: 3, price: 5 }] };
  for (const fields of [[items(), makeField('grand_total', 'computed', { expr: 'sum(items.line_total)', format: 'money' })], [makeField('grand_total', 'computed', { expr: 'sum(items.line_total)', format: 'money' }), items()]]) {
    const { data, evaluation } = buildRenderData(newTemplate({ fields }), answers, US);
    assert.deepEqual(evaluation.exprErrors, {});
    assert.deepEqual(data.items.map((r) => r.line_total), ['$20.00', '$15.00']);
    assert.equal(data.grand_total, '$35.00');
  }
  // a row child may use a top-level total that is itself a sum over another child
  const t = newTemplate({ fields: [items(), makeField('grand_total', 'computed', { expr: 'sum(items.line_total)' }), makeField('shares', 'computed', { expr: 'join(items.share, "; ")' })] });
  t.fields[0].children.push(makeField('share', 'computed', { expr: 'round(line_total / grand_total * 100)' }));
  const ev = evaluateForm(t, answers);
  assert.deepEqual(ev.exprErrors, {});
  assert.deepEqual(ev.values.items.map((r) => r.share), [57, 43]);
  assert.equal(ev.computed.shares, '57; 43');
  assert.equal(evaluateForm(newTemplate({ fields: [items(), makeField('g', 'computed', { expr: 'sum(items, "line_total")' })] }), answers).computed.g, 35);
  // forward references between row children resolve; a same-named top-level answer never leaks in
  const t2 = newTemplate({ fields: [makeField('subtotal', 'number'), makeField('items', 'repeat', { children: [makeField('qty', 'number'), makeField('with_tax', 'computed', { expr: 'subtotal * 1.2' }), makeField('subtotal', 'computed', { expr: 'qty * 10' })] })] });
  const row = evaluateForm(t2, { subtotal: 999, items: [{ qty: 2 }] }).values.items[0];
  assert.equal(row.subtotal, 20);
  assert.equal(row.with_tax, 24);
  // cycles between row children are reported per row
  const t3 = newTemplate({ fields: [makeField('items', 'repeat', { children: [makeField('a', 'computed', { expr: 'b + 1' }), makeField('b', 'computed', { expr: 'a + 1' }), makeField('c', 'computed', { expr: 'a + 1' })] })] });
  const ev3 = evaluateForm(t3, { items: [{}, {}] });
  assert.equal(ev3.exprErrors['items[0].a'], 'This computed field depends on itself.');
  assert.equal(ev3.exprErrors['items[1].b'], 'This computed field depends on itself.');
  assert.equal(ev3.exprErrors['items[0].c'], 'This computed field depends on a field that could not be calculated.');
  assert.deepEqual(ev3.values.items[0], { a: null, b: null, c: null, _index: 1 });
});

test('F46: only the fields in a cycle are "depends on itself"; their dependents are flagged, not silently computed', () => {
  const fields = { A: 'B', B: 'C', C: 'B', D: 'A + 1', E: '5' };
  for (const keys of [['A', 'B', 'C', 'D', 'E'], ['D', 'C', 'B', 'A', 'E'], ['E', 'D', 'A', 'C', 'B']]) {
    const ev = evaluateForm(newTemplate({ fields: keys.map((k) => makeField(k, 'computed', { expr: fields[k] })) }), {});
    assert.equal(ev.exprErrors.B, 'This computed field depends on itself.');
    assert.equal(ev.exprErrors.C, 'This computed field depends on itself.');
    assert.equal(ev.exprErrors.A, 'This computed field depends on a field that could not be calculated.');
    assert.equal(ev.exprErrors.D, 'This computed field depends on a field that could not be calculated.');
    assert.equal(ev.computed.D, null);
    assert.equal(ev.computed.E, 5);
  }
  assert.equal(evaluateForm(newTemplate({ fields: [makeField('me', 'computed', { expr: 'me + 1' })] }), {}).exprErrors.me, 'This computed field depends on itself.');
  // a loop through a "show only when" rule is not an expression cycle: no error, declaration order decides
  const ev = evaluateForm(newTemplate({ fields: [makeField('x', 'number', { showIf: 'total > 0' }), makeField('total', 'computed', { expr: 'x + 1' })] }), { x: 5 });
  assert.deepEqual(ev.exprErrors, {});
  assert.equal(ev.computed.total, 6);
  // a broken expression makes its dependents unavailable too
  const ev2 = evaluateForm(newTemplate({ fields: [makeField('bad', 'computed', { expr: '1 +' }), makeField('dep', 'computed', { expr: 'bad * 2' })] }), {});
  assert.match(ev2.exprErrors.bad, /Unexpected end/);
  assert.equal(ev2.exprErrors.dep, 'This computed field depends on a field that could not be calculated.');
});

test('F23/F47/F48: formatting of computed text as money, default date format, sections driven by computed rows', () => {
  const money = (extra = {}) => makeField('c', 'computed', { format: 'money', ...extra });
  assert.equal(formatValue(money(), '', US), '');
  assert.equal(formatValue(money(), null, US), '');
  assert.equal(formatValue(money(), '$1,234.50', US), '$1,234.50');
  assert.equal(formatValue(money(), '12', US), '$12.00');
  assert.equal(formatValue(money(), 12, US), '$12.00');
  assert.equal(formatValue(money(), '12abc', US), '12abc');
  assert.equal(formatValue(makeField('c', 'computed', { format: 'number' }), 'n/a', US), 'n/a');
  const t = newTemplate({ fields: [makeField('has_fee', 'checkbox'), makeField('fee', 'money'), makeField('fee_total', 'computed', { expr: 'if(has_fee, fee, "")', format: 'money' }), makeField('pretty', 'computed', { expr: 'format_money(fee, "USD", "en-US")', format: 'money' })] });
  assert.deepEqual(buildRenderData(t, { has_fee: false, fee: 12 }, US).data, { has_fee: false, fee: '$12.00', fee_total: '', pretty: '$12.00', _today: buildRenderData(t, {}, US).data._today });
  // new date fields follow the workspace default format
  assert.equal(makeField('d', 'date').format, '');
  assert.equal(formatValue(makeField('d', 'date'), '2026-09-24', { dateFormat: 'short', locale: 'en-US' }), '9/24/2026');
  assert.equal(formatValue(makeField('d', 'date'), '2026-09-24', { locale: 'en-US' }), 'September 24, 2026');
  assert.equal(formatValue(makeField('d', 'date', { format: 'iso' }), '2026-09-24', { dateFormat: 'short' }), '2026-09-24');
  // a computed condition in a row is a boolean for the renderer, never the text "0"
  const t2 = newTemplate({ fields: [makeField('items', 'repeat', { children: [makeField('rate', 'money'), makeField('senior', 'computed', { role: 'condition', expr: 'rate - 500', format: 'text' })] })] });
  assert.deepEqual(buildRenderData(t2, { items: [{ rate: 500 }, { rate: 900 }] }).data.items.map((r) => r.senior), [false, true]);
  // impossible dates are rejected by validation instead of rolling over
  const d = newTemplate({ fields: [makeField('d', 'date')] });
  assert.equal(evaluateForm(d, { d: '2026-02-30' }).errors.d, 'Enter a valid date.');
  assert.equal(evaluateForm(d, { d: '1' }).errors.d, 'Enter a valid date.');
  assert.equal(evaluateForm(d, { d: '2026-02-28' }).errors.d, undefined);
});

test('F61: whitespace after a section tag alone in its paragraph does not leave blank paragraphs', async () => {
  const plain = makeDocx({ body: ['A', '{#has_guarantor}', 'GUARANTEE text', '{/has_guarantor}', 'B'] });
  const spaced = makeDocx({ body: ['A', '{#has_guarantor} ', 'GUARANTEE text', ' {/has_guarantor}\t', 'B'] });
  for (const has_guarantor of [false, true]) {
    const want = paragraphs(await buf(renderDocx(plain, { has_guarantor })));
    assert.deepEqual(want, has_guarantor ? ['A', 'GUARANTEE text', 'B'] : ['A', 'B']);
    assert.deepEqual(paragraphs(await buf(renderDocx(spaced, { has_guarantor }))), want);
  }
  // whitespace split over several runs, and a tab element
  const split = makeDocx({ body: ['A', '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>{#x}</w:t></w:r><w:r><w:tab/></w:r></w:p>', 'X', '<w:p><w:r><w:t>{/x}</w:t></w:r><w:r><w:t xml:space="preserve">  </w:t></w:r></w:p>', 'B'] });
  assert.deepEqual(paragraphs(await buf(renderDocx(split, { x: false }))), ['A', 'B']);
  assert.deepEqual(paragraphs(await buf(renderDocx(split, { x: true }))), ['A', 'X', 'B']);
  assert.deepEqual(inspectDocx(split).order.map((o) => o.key), ['x']);
  // only lone section tags are touched; ordinary text and inline tags keep their spacing
  const xml = '<w:p><w:r><w:t xml:space="preserve">Hello {name} </w:t></w:r></w:p><w:p w:rsidR="1"/><w:p><w:r><w:t xml:space="preserve"> {#a}</w:t></w:r></w:p><w:pPr/>';
  assert.equal(tidyLoneSectionTags(xml), '<w:p><w:r><w:t xml:space="preserve">Hello {name} </w:t></w:r></w:p><w:p w:rsidR="1"/><w:p><w:r><w:t xml:space="preserve">{#a}</w:t></w:r></w:p><w:pPr/>');
});
