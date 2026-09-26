/* Clausery intake runtime: bundled into vendor/intake-runtime.js and inlined into exported intake forms.
   Renders the questionnaire, validates, and lets the client save/load an answers .json file. Works from file://. */
import { h, icon, setChildren } from '../../app/ui/dom.js';
import { renderForm } from '../../app/lib/form.js';
import { evaluateForm } from '../../app/lib/logic.js';
import { blankAnswers } from '../../app/lib/schema.js';
import { sanitizeAnswers } from '../../app/lib/intake.js';

export function mount(root, dataEl) {
  let data;
  try { data = JSON.parse(dataEl.textContent); } catch { root.textContent = 'This intake form is damaged.'; return; }
  const { template, settings, intro, siteUrl } = data;
  const answers = blankAnswers(template);
  const status = h('div', { 'aria-live': 'polite' });
  const forms = [];
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: async () => {
    const f = fileInput.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j || j.format !== 'clausery.answers' || typeof j.answers !== 'object' || !j.answers) throw new Error('not an answers file'); Object.assign(answers, sanitizeAnswers(template, j.answers).answers); rebuild(); flash('Your saved answers were loaded.', 'ok'); }
    catch { flash('That file is not a saved answers file from this form.', 'warn'); }
    fileInput.value = '';
  } });
  function flash(msg, type) { setChildren(status, h('div.notice', { class: 'notice-' + type }, icon(type === 'ok' ? 'check' : 'warn', 18), h('div', msg))); status.scrollIntoView({ block: 'nearest' }); }
  function download(name, text) { const a = h('a', { href: 'data:application/json;charset=utf-8,' + encodeURIComponent(text), download: name }); document.body.append(a); a.click(); a.remove(); }
  function payload() { return JSON.stringify({ format: 'clausery.answers', version: 1, templateName: template.name, templateId: template.id, exportedAt: new Date().toISOString(), answers }, null, 2); }
  const fname = template.name.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-') || 'answers';

  const container = h('div');
  function rebuild() {
    forms.length = 0;
    setChildren(container, ...template.sections.map((s) => { const f = renderForm({ template, answers, settings, sectionId: s.id, onChange: () => {} }); forms.push(f); return h('div.card', h('h2', s.title), s.description ? h('p.muted', s.description) : null, f.element); }));
  }
  rebuild();

  setChildren(root, h('div.wrap',
    h('div.card', settings.firmName ? h('p.muted.small', { style: { marginBottom: '.25rem' } }, settings.firmName) : null, h('h1', template.name), intro ? h('p', intro) : null,
      h('div.notice', icon('info', 18), h('div', 'This form runs only on your computer. Nothing is sent anywhere until you save the answers file and send it yourself.')),
      h('div.row', h('button.btn.btn-sm', { type: 'button', onclick: () => fileInput.click() }, icon('upload', 14), 'Load saved answers'), fileInput)),
    container, status,
    h('div.card', h('h2', 'Finish'), h('p.muted.small', 'Save progress at any time and come back later, or save the final answers and send the file back.'),
      h('div.row',
        h('button.btn', { type: 'button', onclick: () => { download(fname + '-answers-in-progress.json', payload()); flash('Progress saved. Load it again with "Load saved answers".', 'ok'); } }, icon('download', 16), 'Save progress'),
        h('button.btn.btn-primary', { type: 'button', onclick: () => { const ev = evaluateForm(template, answers, settings); forms.forEach((f) => f.setShowErrors(true)); const n = Object.keys(ev.errors).length; if (n) { flash(`${n} answer${n === 1 ? ' is' : 's are'} still needed. They are highlighted above.`, 'warn'); forms.some((f) => f.focusFirstError()); return; } download(fname + '-answers.json', payload()); flash('Answers saved. Please send the downloaded file back to ' + (settings.firmName || 'the sender') + '.', 'ok'); } }, icon('check', 16), 'Save answers'))),
    h('p.foot', 'Powered by ', siteUrl ? h('a', { href: siteUrl, rel: 'noopener' }, 'Clausery') : 'Clausery', ' · document automation that never leaves the browser'),
  ));
}
