import { h, icon, confirmDialog, promptDialog, toast, setChildren } from '../dom.js';
import { unlockVault } from '../../lib/vault.js';

export async function render(ctx, { onUnlocked }) {
  const meta = ctx.store.vaultMeta;
  let input, err, busy = false;
  const form = h('form.stack', { onsubmit: async (e) => {
    e.preventDefault(); if (busy) return; busy = true; err.hidden = true;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Unlocking…';
    try {
      if (meta.missing) throw new Error('The vault settings are missing but records are encrypted. Restore a backup or wipe the workspace.');
      const key = await unlockVault(meta, input.value);
      if (!key) { err.textContent = 'That passphrase is not correct.'; err.hidden = false; input.select(); }
      else { ctx.store.setKey(key); ctx.renderStatus(); onUnlocked(); return; }
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { busy = false; btn.disabled = false; btn.textContent = 'Unlock'; }
  } },
    h('label.field', h('span.field-label', 'Passphrase'), input = h('input.input', { type: 'password', autocomplete: 'current-password', autofocus: true, 'aria-describedby': 'lock-err' }), err = h('span.field-error', { id: 'lock-err', role: 'alert', hidden: true })),
    h('button.btn.btn-primary.btn-lg', { type: 'submit', style: { width: '100%' } }, icon('unlock'), 'Unlock'),
  );
  setChildren(ctx.main, h('div.lock', h('div.card.stack',
    h('div.row', h('img.logo-mark', { src: '../assets/icon.svg', alt: '' }), h('div', h('h1', { style: { marginBottom: 0 } }, 'Workspace locked'), h('p.muted.small', { style: { margin: 0 } }, 'Your templates and drafts are encrypted on this device.'))),
    form,
    h('p.small.muted', 'Forgot the passphrase? There is no recovery: the data was encrypted with it and never left this browser. ', h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: async () => {
      const typed = await promptDialog({ title: 'Wipe this workspace?', label: 'Type DELETE to erase every template and draft on this device', placeholder: 'DELETE' });
      if (typed !== 'DELETE') return;
      if (!await confirmDialog({ title: 'Last check', message: 'This permanently deletes everything stored in this browser. Continue?', confirmLabel: 'Erase everything', danger: true })) return;
      await ctx.store.wipe(); ctx.store.vaultMeta = null; ctx.store.setKey(null); ctx.plan.set('free'); toast('Workspace erased.', { type: 'ok' }); location.reload();
    } }, 'Wipe workspace')),
  )));
}
