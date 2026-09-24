/* Interview: answer a template's questionnaire section by section, then preview and generate the document. */
import { h, icon, toast, modal, confirmDialog, pickFile, readFile, debounce, setTitle, announce, setChildren } from '../dom.js';
import { renderForm } from '../../lib/form.js';
import { evaluateForm, buildRenderData, summarize } from '../../lib/logic.js';
import { renderDocx, previewDocx, describeTemplateError, isDocxError } from '../../lib/render.js';
import { downloadBlob, safeFilename } from '../../lib/backup.js';
import { nowISO } from '../../lib/schema.js';
import { buildIntakeHtml, parseAnswersFile } from '../../lib/intake.js';

export async function render(ctx, { id }) {
  const draft = await ctx.drafts.get(id);
  if (!draft) { setChildren(ctx.main, h('div.empty', h('h2', 'Draft not found'), h('a.btn', { href: '#/drafts' }, 'Back to drafts'))); return; }
  const template = await ctx.templates.get(draft.templateId);
  if (!template) { setChildren(ctx.main, h('div.empty', h('h2', 'The template for this draft was deleted'), h('p', 'The answers are still stored. Re-import the template pack or delete the draft.'), h('a.btn', { href: '#/drafts' }, 'Back to drafts'))); return; }
  const bytes = await ctx.templates.getFile(template.id);
  setTitle(draft.title || template.name);

  const steps = [...template.sections.map((s) => ({ id: s.id, title: s.title, description: s.description })), { id: '__review', title: 'Review & generate' }];
  let stepIndex = Math.max(0, Math.min(steps.length - 1, Number(sessionStorage.getItem('clausery.step.' + id)) || 0));
  let form = null;
  let evaluation = evaluateForm(template, draft.answers, ctx.settings);

  const persist = debounce(async () => { await ctx.drafts.save(draft); }, 400);
  const onChange = (answers, path, ev) => { evaluation = ev; draft.status = 'draft'; renderStepper(); persist(); };

  const titleInput = h('input.input', { value: draft.title || '', placeholder: 'Draft name (optional)', 'aria-label': 'Draft name', oninput: (e) => { draft.title = e.target.value; setTitle(draft.title || template.name); persist(); } });
  const stepperEl = h('nav.stepper', { 'aria-label': 'Sections' });
  const bodyEl = h('div');

  function sectionErrors(sid) { return Object.keys(evaluation.errors).filter((p) => { const key = p.split(/[[.]/)[0]; const f = template.fields.find((x) => x.key === key); return f && f.sectionId === sid && evaluation.visible[key] !== false; }).length; }
  function sectionAnswered(sid) { return template.fields.filter((f) => f.sectionId === sid && f.type !== 'computed' && evaluation.visible[f.key] !== false).every((f) => { const v = draft.answers[f.key]; return f.type === 'checkbox' || f.type === 'repeat' || (v !== '' && v != null); }); }

  function renderStepper() {
    const total = Object.keys(evaluation.errors).length;
    setChildren(stepperEl, 
      h('div.progress', { 'aria-hidden': 'true' }, h('div', { style: { width: Math.round(100 * (stepIndex) / (steps.length - 1)) + '%' } })),
      h('ol', { style: { marginTop: '.75rem' } }, steps.map((s, i) => { const errs = s.id === '__review' ? 0 : sectionErrors(s.id); const done = s.id !== '__review' && !errs && sectionAnswered(s.id); return h('li', { class: [errs ? 'errors' : '', done ? 'done' : ''].join(' '), 'aria-current': i === stepIndex ? 'step' : null, tabindex: 0, onclick: () => go(i, true), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i, true); } } }, h('span.num', done ? icon('check', 13) : String(i + 1)), h('span', s.title), errs ? h('span.cnt', `${errs} to fix`) : null); })),
      total ? h('p.small.muted', { style: { marginTop: '.75rem' } }, `${total} answer${total === 1 ? '' : 's'} still needed.`) : h('p.small', { style: { marginTop: '.75rem', color: 'var(--ok)' } }, 'All required answers are in.'),
    );
  }

  function go(i, force = false) {
    if (i < 0 || i >= steps.length) return;
    if (i > stepIndex && form && !force) { form.setShowErrors(true); if (sectionErrors(steps[stepIndex].id) && form.focusFirstError()) { toast('Complete the highlighted answers, or use the section list to skip ahead.', { type: 'warn' }); return; } }
    stepIndex = i; sessionStorage.setItem('clausery.step.' + id, String(i)); renderStep(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStep() {
    renderStepper();
    const step = steps[stepIndex];
    if (step.id === '__review') { form = null; renderReview(); return; }
    form = renderForm({ template, answers: draft.answers, settings: ctx.settings, sectionId: step.id, onChange });
    setChildren(bodyEl, h('div.card', h('h2', step.title), step.description ? h('p.muted', step.description) : null, form.element,
      h('div.interview-nav', h('button.btn', { type: 'button', disabled: stepIndex === 0, onclick: () => go(stepIndex - 1) }, icon('back', 16), 'Back'), h('button.btn.btn-primary', { type: 'button', onclick: () => go(stepIndex + 1) }, stepIndex === steps.length - 2 ? 'Review' : 'Next', icon('chevron', 16)))));
    const first = form.element.querySelector('input, select, textarea'); if (first && stepIndex > 0) first.focus({ preventScroll: true });
    announce(`Section ${stepIndex + 1} of ${steps.length}: ${step.title}`);
  }

  function renderReview() {
    const { data, evaluation: ev } = buildRenderData(template, draft.answers, ctx.settings);
    evaluation = ev;
    const errs = Object.entries(ev.errors).filter(([p]) => ev.visible[p.split(/[[.]/)[0]] !== false);
    const previewWrap = h('div.preview-wrap.print-area', { hidden: true });
    const previewBtn = h('button.btn', { type: 'button', onclick: async () => { previewBtn.disabled = true; try { const blob = renderDocx(bytes, data); previewWrap.hidden = false; await previewDocx(blob, previewWrap); previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { fail(e); } finally { previewBtn.disabled = false; } } }, icon('eye', 16), 'Preview');
    const fail = (e) => { if (isDocxError(e)) modal({ title: 'The document could not be generated', body: h('ul', describeTemplateError(e).map((m) => h('li', m))), actions: [{ label: 'OK', primary: true }] }); else { console.error(e); toast('Generation failed: ' + (e.message || e), { type: 'danger', timeout: 8000 }); } };
    const generate = async () => {
      try {
        const blob = renderDocx(bytes, data);
        downloadBlob(blob, safeFilename((draft.title || summarize(template, draft.answers, 1) || template.name) + ' - ' + template.name, 'docx'));
        draft.status = 'generated'; draft.generatedAt = nowISO(); await ctx.drafts.save(draft); renderStepper();
        toast('Document downloaded. It was generated entirely in this browser.', { type: 'ok', timeout: 6000 });
      } catch (e) { fail(e); }
    };
    const answered = template.fields.filter((f) => f.type !== 'computed' && f.type !== 'repeat' && ev.visible[f.key] !== false && draft.answers[f.key] !== '' && draft.answers[f.key] != null).length;
    const totalQ = template.fields.filter((f) => f.type !== 'computed' && f.type !== 'repeat' && ev.visible[f.key] !== false).length;
    setChildren(bodyEl, h('div.stack',
      h('div.card',
        h('h2', 'Review & generate'),
        errs.length ? h('div.notice.notice-warn', icon('warn'), h('div', h('strong', `${errs.length} answer${errs.length === 1 ? '' : 's'} still needed. `), 'You can generate anyway; missing answers render blank.', h('ul', { style: { margin: '.5rem 0 0' } }, errs.slice(0, 8).map(([p, m]) => { const key = p.split(/[[.]/)[0]; const f = template.fields.find((x) => x.key === key); const si = steps.findIndex((s) => s.id === (f && f.sectionId)); return h('li', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go(si); } }, f ? f.label : p), ': ', m); }), errs.length > 8 ? h('li', `…and ${errs.length - 8} more`) : null)))
          : h('div.notice.notice-ok', icon('check'), h('div', h('strong', 'Everything is answered. '), `${answered} of ${totalQ} questions.`)),
        h('div.row', { style: { marginTop: '1rem' } }, h('button.btn.btn-primary.btn-lg', { type: 'button', onclick: generate }, icon('download', 18), 'Download .docx'), previewBtn, h('button.btn', { type: 'button', onclick: async () => { if (previewWrap.hidden) { previewBtn.click(); await new Promise((r) => setTimeout(r, 800)); } window.print(); } }, icon('print', 16), 'Print / Save as PDF')),
        h('p.small.muted', { style: { marginTop: '1rem', marginBottom: 0 } }, 'The Word file is assembled in your browser from the template and these answers. Nothing is uploaded.')),
      h('div.card',
        h('h3', 'Answers'),
        h('dl.kv', template.fields.filter((f) => ev.visible[f.key] !== false).flatMap((f) => { const v = data[f.key]; const shown = f.type === 'repeat' ? (v.length ? v.map((r) => (f.children || []).filter((c) => c.type !== 'checkbox').map((c) => r[c.key]).filter(Boolean).join(', ')).join('; ') : '—') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : (v === '' ? '—' : String(v)); return [h('dt', f.label), h('dd', { style: { color: shown === '—' ? 'var(--muted)' : '' } }, shown)]; })),
        h('div.row', { style: { marginTop: '1rem' } },
          h('button.btn.btn-sm', { type: 'button', onclick: importAnswers }, icon('upload', 14), 'Import answers (.json)'),
          h('button.btn.btn-sm', { type: 'button', onclick: exportAnswers }, icon('download', 14), 'Export answers (.json)'),
          h('button.btn.btn-sm', { type: 'button', onclick: exportIntake }, icon('share', 14), 'Create client intake form'))),
      previewWrap,
    ));
  }

  async function importAnswers() {
    const file = await pickFile('.json,application/json'); if (!file) return;
    try {
      const { answers, templateName } = parseAnswersFile(await readFile(file, 'text'));
      if (templateName && templateName !== template.name && !await confirmDialog({ title: 'Different template', message: `These answers were collected for "${templateName}". Import them into this ${template.name} draft anyway?`, confirmLabel: 'Import' })) return;
      let n = 0;
      for (const f of template.fields) if (Object.prototype.hasOwnProperty.call(answers, f.key)) { draft.answers[f.key] = answers[f.key]; n++; }
      await ctx.drafts.save(draft); evaluation = evaluateForm(template, draft.answers, ctx.settings);
      toast(`${n} answer${n === 1 ? '' : 's'} imported.`, { type: 'ok' }); renderStep();
    } catch (e) { toast(e.message, { type: 'danger', timeout: 7000 }); }
  }
  function exportAnswers() {
    const payload = { format: 'clausery.answers', version: 1, templateName: template.name, templateId: template.id, exportedAt: nowISO(), answers: draft.answers };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeFilename((draft.title || template.name) + ' answers', 'json'));
  }
  async function exportIntake() {
    if (!ctx.requirePlan('intake')) return;
    let intro;
    const m = modal({ title: 'Client intake form', size: 'lg', body: h('div.stack',
      h('p', 'Creates a single HTML file with this questionnaire (no document, no answers). Send it to the client; they open it on their computer, fill it in offline, and send back the answers file, which you import here.'),
      h('label.field', h('span.field-label', 'Message to the client'), intro = h('textarea.textarea', { rows: 3 }, `Please complete the questions below for your ${template.name}. When you are done, choose "Save answers" and email us the file.`)),
      h('p.small.muted', 'The form works from a file on their computer or any web host, with no account and no data sent anywhere.')),
      actions: [{ label: 'Cancel' }, { label: 'Download intake form', primary: true, onClick: async () => { const html = await buildIntakeHtml({ template, settings: ctx.settings, intro: intro.value, siteUrl: ctx.siteUrl, version: ctx.version }); downloadBlob(new Blob([html], { type: 'text/html' }), safeFilename(template.name + ' intake', 'html')); toast('Intake form downloaded.', { type: 'ok' }); } }] });
    await m.closed;
  }

  setChildren(ctx.main, h('div.container',
    h('div.row.row-between', { style: { marginBottom: '1rem' } }, h('div.row', h('a.btn.btn-ghost.btn-sm', { href: '#/drafts' }, icon('back', 16), 'Drafts'), h('span.badge', template.name)), h('div', { style: { minWidth: '260px' } }, titleInput)),
    h('div.interview', stepperEl, bodyEl),
  ));
  renderStep();
}
