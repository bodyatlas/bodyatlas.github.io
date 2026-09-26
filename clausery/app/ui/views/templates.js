import { h, icon, toast, modal, confirmDialog, pickFile, readFile, relativeTime, setChildren } from '../dom.js';
import { inspectDocx, describeTemplateError, isDocxError } from '../../lib/render.js';
import { inferQuestionnaire, newTemplate, newDraft, normalizeTemplate, uid, KEY_RX, isReservedKey } from '../../lib/schema.js';
import { decodeBundle, encodePack, downloadBlob, safeFilename, checkDocxSize } from '../../lib/backup.js';

export const SAMPLES = [
  { slug: 'mutual-nda', file: 'mutual-nda.docx', name: 'Mutual NDA', category: 'Legal', description: 'Two-party confidentiality agreement with optional carve-outs, jurisdiction and notice emails.' },
  { slug: 'engagement-letter', file: 'engagement-letter.docx', name: 'Engagement letter', category: 'Legal', description: 'Law firm engagement letter with a repeating attorney list, hourly or flat fee, optional retainer.' },
  { slug: 'offer-letter', file: 'offer-letter.docx', name: 'Offer of employment', category: 'HR', description: 'Offer letter with remote/office variants, optional bonus and equity, and a benefits list.' },
  { slug: 'independent-contractor-agreement', file: 'independent-contractor-agreement.docx', name: 'Independent contractor agreement', category: 'Business', description: 'Hourly or fixed-fee contractor agreement with IP ownership choice, confidentiality and termination.' },
  { slug: 'statement-of-work', file: 'statement-of-work.docx', name: 'Statement of work', category: 'Business', description: 'SOW with a repeating deliverables list, fixed-price or time-and-materials fees and acceptance terms.' },
  { slug: 'employment-verification-letter', file: 'employment-verification-letter.docx', name: 'Employment verification letter', category: 'HR', description: 'Confirms current or past employment, with optional salary and purpose lines.' },
  { slug: 'payment-demand-letter', file: 'payment-demand-letter.docx', name: 'Payment demand letter', category: 'Finance', description: 'Polite demand for an overdue balance with optional invoice number, interest and next steps.' },
];

export async function importDocxFile(ctx, file, { name } = {}) {
  const count = await ctx.templates.count();
  if (!ctx.requirePlan('templates', { count })) return null;
  if (!/\.docx$/i.test(file.name || name || '')) { toast('Choose a Word document (.docx). Older .doc files must be re-saved as .docx first.', { type: 'warn', timeout: 7000 }); return null; }
  const bytes = await readFile(file);
  try { checkDocxSize(bytes); } catch (e) { showTemplateErrors([e.message]); return null; }
  let inspection;
  try { inspection = inspectDocx(bytes); }
  catch (e) {
    if (isDocxError(e)) { showTemplateErrors(describeTemplateError(e)); return null; }
    toast('This file could not be opened as a Word document.', { type: 'danger' }); console.error(e); return null;
  }
  const badTags = invalidTagMessages(inspection);
  if (badTags.length) { showTemplateErrors(badTags); return null; }
  const q = inferQuestionnaire(inspection);
  const t = newTemplate({ name: name || file.name.replace(/\.docx$/i, '').replace(/[-_]+/g, ' '), fileName: file.name, sections: q.sections, fields: q.fields, tags: inspection.order.map((o) => o.key), warnings: q.warnings });
  await ctx.templates.save(t);
  await ctx.templates.saveFile(t.id, bytes);
  if (!q.fields.length) toast('No {tags} were found in this document. Add tags like {client_name} in Word, then replace the file in the template editor.', { type: 'warn', timeout: 9000 });
  return t;
}

/** Tags whose names the questionnaire cannot use (spaces, hyphens, dots): told at upload, so the author fixes Word first
    instead of finding out when the designer refuses to save. */
export function invalidTagMessages(inspection) {
  const bad = [...new Set((inspection.order || []).map((o) => o.key).filter((k) => !isReservedKey(k) && !KEY_RX.test(k)))];
  return bad.map((k) => { const fixed = String(k).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^[^A-Za-z]+/, '') || 'tag_name'; return `The tag {${k}} has characters that are not allowed. Tag names use letters, digits and underscores and start with a letter, for example {${fixed}}.`; });
}

export function showTemplateErrors(messages) {
  modal({ title: 'The template has a problem', body: h('div.stack', h('p', 'Fix these in Word and upload the file again:'), h('ul', messages.map((m) => h('li', m))), h('p.small.muted', 'Tags look like {client_name}. Sections look like {#has_retainer}…{/has_retainer}. See the docs for the full syntax.')), actions: [{ label: 'OK', primary: true }] });
}

async function importSample(ctx, s) {
  const count = await ctx.templates.count();
  if (!ctx.requirePlan('templates', { count })) return null;
  const res = await fetch('../samples/' + s.file);
  if (!res.ok) { toast('The sample could not be loaded.', { type: 'danger' }); return null; }
  const blob = await res.blob();
  const file = new File([blob], s.file, { type: blob.type });
  const t = await importDocxFile(ctx, file, { name: s.name });
  if (t) { t.category = s.category; t.description = s.description; t.sample = s.slug; await ctx.templates.save(t); }
  return t;
}

async function loadSample(ctx, s) {
  const t = await importSample(ctx, s);
  if (t) ctx.navigate('/templates/' + t.id);
}

/** Deep link from the public template library (#/start/<slug>): reuse the sample if it is already in the workspace,
    otherwise import it, then open a new draft straight away so a visitor is filling it in within one click. */
export async function startFromSample(ctx, { slug }) {
  const s = SAMPLES.find((x) => x.slug === slug);
  if (!s) { toast('That template is not available.', { type: 'warn' }); ctx.navigate('/templates'); return; }
  const existing = (await ctx.templates.list()).find((t) => t.sample === slug || t.fileName === s.file);
  const t = existing || await importSample(ctx, s);
  if (!t) { ctx.router.go('/templates', true); return; }
  const d = newDraft(t);
  await ctx.drafts.save(d);
  ctx.router.go('/drafts/' + d.id, true);
}

async function importPack(ctx) {
  const file = await pickFile('.json,application/json'); if (!file) return;
  let bundle;
  try { bundle = decodeBundle(await readFile(file, 'text')); } catch (e) { toast(e.message, { type: 'danger', timeout: 7000 }); return; }
  if (bundle.kind === 'workspace') { toast('That is a full workspace backup. Restore it from Settings → Data.', { type: 'warn', timeout: 7000 }); return; }
  const existing = new Set((await ctx.templates.list()).map((t) => t.id));
  let count = await ctx.templates.count(), added = 0;
  for (const t of bundle.templates) {
    if (!existing.has(t.id) && !ctx.requirePlan('templates', { count })) break;
    const file = bundle.files.find((f) => f.id === t.id);
    if (!file) continue;
    await ctx.templates.save(normalizeTemplate(t));
    await ctx.templates.saveFile(t.id, file.bytes);
    if (!existing.has(t.id)) count++;
    added++;
  }
  toast(`${added} template${added === 1 ? '' : 's'} imported from "${bundle.name || file.name}".`, { type: 'ok' });
  ctx.router.resolve();
}

export async function render(ctx) {
  const templates = await ctx.templates.list();
  const drafts = await ctx.drafts.list();
  const draftCount = (id) => drafts.filter((d) => d.templateId === id).length;

  const upload = async (file) => { const t = await importDocxFile(ctx, file); if (t) ctx.navigate('/templates/' + t.id); };
  const drop = h('div.dropzone', { tabindex: 0, role: 'button', 'aria-label': 'Upload a Word template', onclick: async () => { const f = await pickFile('.docx'); if (f) upload(f); }, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'), ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) upload(f); } },
    icon('upload', 28), h('div', h('strong', 'Drop a .docx template here'), ' or click to choose one'), h('div.small', 'Tags like {client_name} become questions automatically. The file stays on this device.'));

  const card = (t) => h('article.card', { dataset: { templateId: t.id } },
    h('div.row.row-between', h('span.badge', t.category || 'Other'), h('span.meta', relativeTime(t.updatedAt))),
    h('h3', { style: { marginTop: '.6rem' } }, t.name),
    h('p.meta', t.description || `${t.fields.length} question${t.fields.length === 1 ? '' : 's'} · ${draftCount(t.id)} draft${draftCount(t.id) === 1 ? '' : 's'}`),
    h('div.card-actions',
      h('button.btn.btn-primary.btn-sm', { type: 'button', onclick: async () => { const d = newDraft(t); await ctx.drafts.save(d); ctx.navigate('/drafts/' + d.id); } }, icon('plus', 15), 'New draft'),
      h('a.btn.btn-sm', { href: '#/templates/' + t.id }, icon('edit', 15), 'Edit'),
      h('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'More actions for ' + t.name, onclick: () => moreMenu(ctx, t) }, '…')));

  setChildren(ctx.main, h('div.container',
    h('div.page-head', h('div', h('h1', 'Templates'), h('p.sub', 'Your Word templates, turned into guided questionnaires.')),
      h('div.row', h('button.btn', { type: 'button', onclick: () => importPack(ctx) }, icon('download', 16), 'Import pack'), h('button.btn.btn-primary', { type: 'button', onclick: async () => { const f = await pickFile('.docx'); if (f) upload(f); } }, icon('upload', 16), 'Upload .docx'))),
    templates.length ? [h('h2.sr-only', 'Your templates'), h('div.cards', templates.map(card))] : h('div.empty', h('h2', 'No templates yet'), h('p', 'Upload one of your own Word documents with {tags}, or start from a sample to see how it works.')),
    h('div', { style: { marginTop: '1.5rem' } }, drop),
    h('h2', { style: { marginTop: '2rem' } }, 'Start from a sample'),
    h('div.cards', SAMPLES.map((s) => h('article.card.card-sm', h('span.badge', s.category), h('h3', { style: { marginTop: '.5rem' } }, s.name), h('p.meta', s.description), h('div.card-actions', h('button.btn.btn-sm', { type: 'button', onclick: () => loadSample(ctx, s) }, icon('plus', 15), 'Use this sample'))))),
  ));
}

function moreMenu(ctx, t) {
  const m = modal({ title: t.name, size: 'sm', body: h('div.stack-sm',
    h('button.btn', { type: 'button', style: { width: '100%', justifyContent: 'flex-start' }, onclick: async () => { m.close(); if (!ctx.requirePlan('templates', { count: await ctx.templates.count() })) return; const copy = { ...structuredClone(t), id: uid('t_'), name: t.name + ' (copy)' }; await ctx.templates.save(copy); await ctx.templates.saveFile(copy.id, await ctx.templates.getFile(t.id)); toast('Template duplicated.', { type: 'ok' }); ctx.router.resolve(); } }, icon('copy', 16), 'Duplicate'),
    h('button.btn', { type: 'button', style: { width: '100%', justifyContent: 'flex-start' }, onclick: async () => { m.close(); if (!ctx.requirePlan('packs')) return; const bytes = await ctx.templates.getFile(t.id); const pack = encodePack({ templates: [t], files: [{ id: t.id, bytes }], appVersion: ctx.version, name: t.name }); downloadBlob(new Blob([JSON.stringify(pack)], { type: 'application/json' }), safeFilename(t.name, 'clausery-pack.json')); } }, icon('share', 16), 'Export as template pack'),
    h('button.btn', { type: 'button', style: { width: '100%', justifyContent: 'flex-start' }, onclick: async () => { m.close(); const bytes = await ctx.templates.getFile(t.id); if (bytes) downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), t.fileName || safeFilename(t.name, 'docx')); } }, icon('file', 16), 'Download original .docx'),
    h('button.btn.btn-danger', { type: 'button', style: { width: '100%', justifyContent: 'flex-start' }, onclick: async () => { m.close(); const n = (await ctx.drafts.list()).filter((d) => d.templateId === t.id).length; const ok = await confirmDialog({ title: 'Delete template?', message: n ? `"${t.name}" and its ${n} draft${n === 1 ? '' : 's'} will be deleted from this device.` : `"${t.name}" will be deleted from this device.`, confirmLabel: 'Delete', danger: true }); if (!ok) return; for (const d of (await ctx.drafts.list()).filter((d) => d.templateId === t.id)) await ctx.drafts.remove(d.id); await ctx.templates.remove(t.id); toast('Template deleted.'); ctx.router.resolve(); } }, icon('trash', 16), 'Delete'),
  ) });
}
