import { h, icon, confirmDialog, promptDialog, toast, setChildren } from '../dom.js';
import { unlockVault } from '../../lib/vault.js';

export async function render(ctx, { onUnlocked }) {
  const meta = ctx.store.vaultMeta;
  if (meta && meta.missing) return renderOrphaned(ctx, onUnlocked);
  let input, err, busy = false;
  const form = h('form.stack', { onsubmit: async (e) => {
    e.preventDefault(); if (busy) return; busy = true; err.hidden = true;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Unlocking…';
    try {
      const key = await unlockVault(meta, input.value);
      if (!key) { err.textContent = 'That passphrase is not correct.'; err.hidden = false; input.select(); }
      else { ctx.store.setKey(key); ctx.renderStatus(); ctx.armIdle(); onUnlocked(); return; }
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

/** Encrypted records exist but the encryption settings that could open them are gone (for example encryption was turned
    off in another tab while this one kept writing). No passphrase can recover them, so offer to remove just those
    records and keep everything that is still readable, instead of a lock screen with no way out. */
function renderOrphaned(ctx, onUnlocked) {
  setChildren(ctx.main, h('div.lock', h('div.card.stack',
    h('div.row', h('img.logo-mark', { src: '../assets/icon.svg', alt: '' }), h('h1', { style: { marginBottom: 0 } }, 'Some records cannot be opened')),
    h('p', 'Part of this workspace is encrypted, but the encryption settings needed to open it are no longer on this device. This can happen when encryption is turned off in one tab while another tab is still saving.'),
    h('p', 'Those records cannot be recovered with any passphrase. Templates and drafts that are not encrypted are safe and stay as they are.'),
    h('button.btn.btn-primary', { type: 'button', onclick: async () => {
      if (!await confirmDialog({ title: 'Remove unreadable records?', message: 'Only the records that can no longer be opened are deleted. Everything else stays. If you have a backup, you can restore it afterwards in Settings.', confirmLabel: 'Remove unreadable records', danger: true })) return;
      const n = await ctx.store.dropEncryptedRecords();
      ctx.store.vaultMeta = null; ctx.store.setKey(null); ctx.renderStatus();
      toast(`${n} unreadable record${n === 1 ? '' : 's'} removed.`, { type: 'ok' });
      onUnlocked();
    } }, 'Remove unreadable records and continue'),
  )));
}
