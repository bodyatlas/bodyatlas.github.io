import { h, icon, toast, modal, confirmDialog, relativeTime, setChildren } from '../dom.js';
import { newDraft, uid } from '../../lib/schema.js';
import { summarize } from '../../lib/logic.js';

export async function render(ctx) {
  const [drafts, templates] = await Promise.all([ctx.drafts.list(), ctx.templates.list()]);
  const tmap = new Map(templates.map((t) => [t.id, t]));

  async function create() {
    if (!templates.length) { toast('Add a template first.', { type: 'warn' }); ctx.navigate('/templates'); return; }
    let sel;
    const m = modal({ title: 'New draft', body: h('div.stack', h('label.field', h('span.field-label', 'Template'), sel = h('select.select', { autofocus: true }, templates.map((t) => h('option', { value: t.id }, t.name))))),
      actions: [{ label: 'Cancel' }, { label: 'Start', primary: true, onClick: async () => { const t = tmap.get(sel.value); const d = newDraft(t); await ctx.drafts.save(d); ctx.navigate('/drafts/' + d.id); } }] });
    await m.closed;
  }

  const rowEl = (d) => {
    const t = tmap.get(d.templateId);
    return h('tr', { dataset: { draftId: d.id } },
      h('td', h('a', { href: '#/drafts/' + d.id, style: { fontWeight: 600 } }, d.title || (t ? summarize(t, d.answers) : '') || 'Untitled draft'), h('div.small.muted', t ? t.name : 'Template deleted')),
      h('td', h('span.badge', { class: d.status === 'generated' ? 'badge-ok' : '' }, d.status === 'generated' ? 'Generated' : 'In progress')),
      h('td.small.muted', relativeTime(d.updatedAt)),
      h('td.actions',
        h('a.btn.btn-sm', { href: '#/drafts/' + d.id }, t ? 'Open' : 'View'),
        h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': 'Duplicate draft', onclick: async () => { const copy = { ...structuredClone(d), id: uid('d_'), title: (d.title || 'Draft') + ' (copy)', status: 'draft', generatedAt: null }; await ctx.drafts.save(copy); toast('Draft duplicated.'); ctx.router.resolve(); } }, icon('copy', 15)),
        h('button.btn.btn-ghost.btn-icon.btn-sm', { type: 'button', 'aria-label': 'Delete draft', onclick: async () => { if (!await confirmDialog({ title: 'Delete draft?', message: 'The answers in this draft will be removed from this device.', confirmLabel: 'Delete', danger: true })) return; await ctx.drafts.remove(d.id); ctx.router.resolve(); } }, icon('trash', 15))));
  };

  setChildren(ctx.main, h('div.container',
    h('div.page-head', h('div', h('h1', 'Drafts'), h('p.sub', 'Every answered questionnaire, ready to generate again at any time.')), h('button.btn.btn-primary', { type: 'button', onclick: create }, icon('plus', 16), 'New draft')),
    drafts.length ? h('div.card', { style: { padding: 0, overflow: 'auto' } }, h('table.table', h('thead', h('tr', h('th', 'Draft'), h('th', 'Status'), h('th', 'Updated'), h('th', { class: 'actions' }, h('span.sr-only', 'Actions')))), h('tbody', drafts.map(rowEl))))
      : h('div.empty', h('h2', 'No drafts yet'), h('p', 'Start a draft from any template and answer the questions. Drafts save automatically as you type.'), h('button.btn.btn-primary', { type: 'button', onclick: create }, 'New draft')),
  ));
}
