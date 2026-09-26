/* Word template checker: reads a .docx in the browser, reports broken tags and shows the questionnaire Clausery would
   build. The file never leaves the computer. */
import { inspectDocx, describeTemplateError, isDocxError } from '../app/lib/render.js';
import { inferQuestionnaire, FIELD_TYPES, KEY_RX, isReservedKey } from '../app/lib/schema.js';
import { checkDocxSize } from '../app/lib/backup.js';

const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

async function check(file) {
  const out = $('report'); out.replaceChildren(); out.hidden = false;
  if (!/\.docx$/i.test(file.name)) { out.append(el('p', 'Choose a Word document saved as .docx. Older .doc files must be re-saved as .docx first.', 'bad')); return; }
  const bytes = await file.arrayBuffer();
  try { checkDocxSize(bytes); } catch (e) { out.append(el('p', e.message, 'bad')); return; }
  let insp;
  try { insp = inspectDocx(bytes); } catch (e) {
    out.append(el('h2', 'Problems to fix in Word'));
    const ul = el('ul'); for (const m of (isDocxError(e) ? describeTemplateError(e) : ['This file could not be opened as a Word document.'])) ul.append(el('li', m, 'bad')); out.append(ul); return;
  }
  const bad = [...new Set(insp.order.map((o) => o.key).filter((k) => !isReservedKey(k) && !KEY_RX.test(k)))];
  if (bad.length) { out.append(el('h2', 'Tag names to fix')); const ul = el('ul'); for (const k of bad) ul.append(el('li', `{${k}}: tag names use letters, digits and underscores and start with a letter.`, 'bad')); out.append(ul); }
  const q = inferQuestionnaire(insp);
  if (!q.fields.length) { out.append(el('p', 'No {tags} were found. Add tags such as {client_name} where details change, then check again.', 'bad')); return; }
  out.append(el('h2', bad.length ? 'Everything else looks good' : 'No problems found'));
  const parts = [...new Set(insp.order.map((o) => o.part || 'body'))];
  out.append(el('p', `${new Set(insp.order.map((o) => o.key)).size} tags in ${parts.length} part${parts.length === 1 ? '' : 's'} of the document (${parts.join(', ')}). Clausery would ask ${q.fields.length} questions in ${q.sections.length} section${q.sections.length === 1 ? '' : 's'}.`, 'ok'));
  for (const w of q.warnings) out.append(el('p', w, 'warn'));
  const table = el('table'); const head = el('tr'); for (const h of ['Question', 'Type', 'Asked when']) head.append(el('th', h)); table.append(el('thead')); table.firstChild.append(head);
  const body = el('tbody');
  for (const f of q.fields) {
    const tr = el('tr'); const kind = f.role === 'condition' && f.type === 'checkbox' ? 'Yes / no' : FIELD_TYPES[f.type].label;
    const name = el('td', f.label); if (f.children && f.children.length) name.append(el('div', 'For each item: ' + f.children.map((c) => c.label).join(', '), 'small'));
    tr.append(name, el('td', kind), el('td', f.showIf || 'Always')); body.append(tr);
  }
  table.append(body); const wrap = el('div', null, 'table-wrap'); wrap.tabIndex = 0; wrap.append(table); out.append(wrap);
  out.append(el('p', 'Happy with it? Open Clausery and drop the same file on the Templates page to turn it into a working questionnaire.'));
}

if (typeof document !== 'undefined' && $('file')) {
  $('file').addEventListener('change', () => { const f = $('file').files[0]; if (f) check(f); });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) check(f); });
}
