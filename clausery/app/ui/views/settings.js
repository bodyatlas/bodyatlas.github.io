import { h, icon, toast, modal, confirmDialog, promptDialog, pickFile, readFile, setChildren } from '../dom.js';
import { createVault, unlockVault } from '../../lib/vault.js';
import { describeLicense } from '../../lib/license.js';
import { FEATURE_LABELS } from '../../lib/plan.js';
import { encodeWorkspace, decodeBundle, downloadBlob, safeFilename } from '../../lib/backup.js';
import { estimateUsage, requestPersistence } from '../../lib/store.js';
import { normalizeTemplate, DATE_FORMATS } from '../../lib/schema.js';
import { VERSIONS } from '../../lib/versions.js';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'INR', 'SGD', 'NZD', 'ZAR', 'BRL', 'MXN', 'SEK', 'NOK', 'DKK'];

export async function render(ctx) {
  const s = ctx.settings;
  const section = (id, title, sub, ...body) => h('section.card', { id, 'aria-labelledby': id + '-h' }, h('h2', { id: id + '-h' }, title), sub ? h('p.muted', sub) : null, ...body);
  const row = (label, control, help) => h('label.field', h('span.field-label', label), control, help ? h('span.field-help', help) : null);

  // ---- firm profile
  const profile = section('profile', 'Firm profile', 'Defaults used when formatting answers into documents.',
    h('div.grid-2',
      row('Firm or company name', h('input.input', { value: s.firmName || '', oninput: (e) => ctx.saveSettings({ firmName: e.target.value }) }), 'Available to templates as {_firm_name}.'),
      row('Locale for dates and numbers', h('select.select', { onchange: (e) => ctx.saveSettings({ locale: e.target.value }) }, [['', 'Browser default'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-CA', 'English (Canada)'], ['en-AU', 'English (Australia)'], ['de-DE', 'Deutsch'], ['fr-FR', 'Français'], ['es-ES', 'Español'], ['nl-NL', 'Nederlands'], ['it-IT', 'Italiano'], ['pt-BR', 'Português (Brasil)'], ['sv-SE', 'Svenska']].map(([v, l]) => h('option', { value: v, selected: v === (s.locale || '') }, l)))),
      row('Default currency', h('select.select', { onchange: (e) => ctx.saveSettings({ currency: e.target.value }) }, CURRENCIES.map((c) => h('option', { value: c, selected: c === s.currency }, c)))),
      row('Default date format', h('select.select', { onchange: (e) => ctx.saveSettings({ dateFormat: e.target.value }) }, Object.entries(DATE_FORMATS).map(([k, ex]) => h('option', { value: k, selected: k === s.dateFormat }, `${k} · ${ex}`))))));

  // ---- appearance
  const appearance = section('appearance', 'Appearance', null,
    h('fieldset', h('legend', 'Theme'), h('div.radios', [['system', 'Match the system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('label.check', h('input', { type: 'radio', name: 'theme', value: v, checked: (s.theme || 'system') === v, onchange: () => ctx.saveSettings({ theme: v }) }), h('span', l))))));

  // ---- license
  const keyInput = h('textarea.textarea#license-key', { rows: 3, placeholder: 'CLSY-…', spellcheck: false, 'aria-label': 'License key' });
  const licenseStatus = () => ctx.plan.payload ? h('div.notice.notice-ok', icon('check'), h('div', h('strong', describeLicense(ctx.plan.payload)), h('div.small', 'Licensed to this browser profile. Keep your key: you need it on each device.')))
    : h('div.notice', icon('info'), h('div', h('strong', 'Free plan. '), 'Up to 3 templates, unlimited drafts and documents. ', h('a', { href: '../pricing/', target: '_blank', rel: 'noopener' }, 'Compare plans')));
  const licenseBox = h('div', licenseStatus());
  const license = section('license', 'License', 'Keys are verified offline with a signature. No account, no phone-home.',
    licenseBox,
    h('ul.feature-list', { style: { margin: '1rem 0' } }, Object.entries(FEATURE_LABELS).map(([k, l]) => h('li', ctx.plan.can(k) ? icon('check', 16) : h('span', { style: { width: '16px', display: 'inline-block', color: 'var(--muted)' } }, '·'), l))),
    h('div.stack-sm', row('License key', keyInput), h('div.row',
      h('button.btn.btn-primary', { type: 'button', onclick: async () => { const k = keyInput.value.trim(); if (!k) { toast('Paste a license key first.', { type: 'warn' }); keyInput.focus(); return; } const res = await ctx.setLicense(k); if (res.ok) { toast(`${ctx.plan.name} plan activated.`, { type: 'ok' }); keyInput.value = ''; ctx.router.resolve(); } else toast(res.error, { type: 'danger', timeout: 8000 }); } }, icon('key', 16), 'Activate'),
      ctx.plan.payload ? h('button.btn.btn-ghost', { type: 'button', onclick: async () => { if (!await confirmDialog({ title: 'Remove license?', message: 'This browser goes back to the Free plan. Your templates and drafts are untouched.', confirmLabel: 'Remove' })) return; await ctx.setLicense(''); toast('License removed.'); ctx.router.resolve(); } }, 'Remove license') : null)));

  // ---- security / vault
  const vaultOn = !!ctx.store.vaultMeta;
  async function askPassphrase(title, confirm = true) {
    let p1, p2, err;
    const m = modal({ title, body: h('form.stack', { onsubmit: (e) => { e.preventDefault(); m.body.closest('.modal').querySelector('.modal-actions .btn-primary').click(); } },
      h('p.small.muted', 'Choose a long passphrase you will remember. There is no reset: it never leaves this browser.'),
      row('Passphrase', p1 = h('input.input', { type: 'password', autocomplete: 'new-password', minlength: 8, autofocus: true })),
      confirm ? row('Repeat passphrase', p2 = h('input.input', { type: 'password', autocomplete: 'new-password' })) : null, err = h('span.field-error', { role: 'alert', hidden: true })),
      actions: [{ label: 'Cancel', value: null }, { label: 'Continue', primary: true, onClick: () => { if (p1.value.length < 8) { err.textContent = 'Use at least 8 characters.'; err.hidden = false; return false; } if (confirm && p1.value !== p2.value) { err.textContent = 'The passphrases do not match.'; err.hidden = false; return false; } return p1.value; } }] });
    return m.closed;
  }
  // rekey writes the re-encrypted records and the vault metadata in one transaction, so a failure changes nothing
  async function applyVault(key, meta, okMessage) {
    try { await ctx.store.rekey(key, meta); }
    catch (e) { console.error(e); toast('Could not change the encryption settings (' + (e.message || e) + '). Nothing was changed.', { type: 'danger', timeout: 8000 }); return false; }
    ctx.renderStatus(); toast(okMessage, { type: 'ok' }); ctx.router.resolve();
    return true;
  }
  const security = section('security', 'Security', 'Encrypt everything stored in this browser with a passphrase (AES-256-GCM, key derived with PBKDF2). The workspace locks after inactivity.',
    vaultOn ? h('div.notice.notice-ok', icon('lock'), h('div', h('strong', 'Encryption is on. '), 'Templates, documents and drafts are encrypted at rest on this device.')) : h('div.notice', icon('unlock'), h('div', h('strong', 'Encryption is off. '), 'Data is stored in the browser\'s local database in clear text (still only on this device).')),
    h('div.row', { style: { marginTop: '1rem' } },
      !vaultOn ? h('button.btn.btn-primary', { type: 'button', onclick: async () => { if (!ctx.requirePlan('vault')) return; const pass = await askPassphrase('Turn on encryption'); if (!pass) return; const { meta, key } = await createVault(pass); await applyVault(key, meta, 'Encryption enabled.'); } }, icon('lock', 16), 'Turn on encryption') : null,
      vaultOn ? h('button.btn', { type: 'button', onclick: async () => { const pass = await askPassphrase('New passphrase'); if (!pass) return; const { meta, key } = await createVault(pass); await applyVault(key, meta, 'Passphrase changed.'); } }, 'Change passphrase') : null,
      vaultOn ? h('button.btn', { type: 'button', onclick: () => ctx.lock() }, icon('lock', 16), 'Lock now') : null,
      vaultOn ? h('button.btn.btn-ghost', { type: 'button', onclick: async () => { const pass = await askPassphrase('Confirm passphrase to turn encryption off', false); if (!pass) return; const key = await unlockVault(ctx.store.vaultMeta, pass); if (!key) { toast('That passphrase is not correct.', { type: 'danger' }); return; } await applyVault(null, null, 'Encryption turned off.'); } }, 'Turn off') : null),
    vaultOn ? row('Lock after inactivity', h('select.select', { style: { maxWidth: '240px' }, onchange: (e) => ctx.saveSettings({ autoLockMinutes: Number(e.target.value) }) }, [[0, 'Never'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']].map(([v, l]) => h('option', { value: v, selected: Number(s.autoLockMinutes) === v }, l)))) : null);

  // ---- data
  const usage = await estimateUsage();
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const [tCount, dCount] = [await ctx.store.count('templates'), await ctx.store.count('drafts')];
  const data = section('data', 'Your data', 'Everything lives in this browser profile. Back it up regularly; clearing site data deletes it.',
    h('dl.kv', h('dt', 'Templates'), h('dd', String(tCount)), h('dt', 'Drafts'), h('dd', String(dCount)), usage ? [h('dt', 'Storage used'), h('dd', `${(usage.usage / 1048576).toFixed(1)} MB of ${(usage.quota / 1073741824).toFixed(1)} GB available`)] : null, h('dt', 'Protected from eviction'), h('dd', persisted ? 'Yes' : h('span', 'No ', h('button.btn.btn-sm', { type: 'button', onclick: async () => { const ok = await requestPersistence(); toast(ok ? 'Storage is now persistent.' : 'The browser declined. Bookmarking or installing the app usually helps.', { type: ok ? 'ok' : 'warn' }); ctx.router.resolve(); } }, 'Request')))),
    h('div.row', { style: { marginTop: '1rem' } },
      h('button.btn.btn-primary', { type: 'button', onclick: async () => { const [templates, files, drafts, settings] = await Promise.all([ctx.store.all('templates'), ctx.store.all('files'), ctx.store.all('drafts'), ctx.store.all('settings')]); const json = encodeWorkspace({ templates, files, drafts, settings, appVersion: ctx.version }); downloadBlob(new Blob([JSON.stringify(json)], { type: 'application/json' }), safeFilename('clausery-backup-' + new Date().toISOString().slice(0, 10), 'json')); toast('Backup downloaded. Store it somewhere safe; it is not encrypted.', { type: 'ok', timeout: 7000 }); } }, icon('download', 16), 'Download backup'),
      h('button.btn', { type: 'button', onclick: async () => {
        const file = await pickFile('.json,application/json'); if (!file) return;
        let b; try { b = decodeBundle(await readFile(file, 'text')); } catch (e) { toast(e.message, { type: 'danger', timeout: 7000 }); return; }
        const mode = await new Promise((resolve) => modal({ title: 'Restore backup', body: h('div.stack', h('p', `${b.templates.length} template${b.templates.length === 1 ? '' : 's'} and ${b.drafts.length} draft${b.drafts.length === 1 ? '' : 's'}${b.exportedAt ? ', exported ' + new Date(b.exportedAt).toLocaleString() : ''}.`), h('p', 'Merge keeps what is already here and adds or updates items from the backup. Replace erases the current workspace first.')), actions: [{ label: 'Cancel', value: null }, { label: 'Replace everything', class: 'btn-danger', value: 'replace' }, { label: 'Merge', primary: true, value: 'merge' }], onClose: resolve }));
        if (!mode) return;
        if (mode === 'replace') { for (const st of ['templates', 'files', 'drafts']) await ctx.store.clear(st); }
        for (const t of b.templates) { await ctx.templates.save(normalizeTemplate(t)); const f = b.files.find((x) => x.id === t.id); if (f) await ctx.templates.saveFile(t.id, f.bytes); }
        for (const d of b.drafts) await ctx.drafts.save(d);
        for (const st of b.settings) if (st.id === 'settings') await ctx.saveSettings(st.value || {});
        toast('Backup restored.', { type: 'ok' }); ctx.router.resolve();
      } }, icon('upload', 16), 'Restore backup'),
      h('button.btn.btn-ghost', { type: 'button', style: { color: 'var(--danger)' }, onclick: async () => { const typed = await promptDialog({ title: 'Erase this workspace?', label: 'Type DELETE to erase every template, draft and setting on this device', placeholder: 'DELETE' }); if (typed !== 'DELETE') return; await ctx.store.wipe(); ctx.store.vaultMeta = null; ctx.store.setKey(null); ctx.plan.set('free'); toast('Workspace erased.'); location.reload(); } }, icon('trash', 16), 'Erase workspace')));

  // ---- about
  const about = section('about', 'About', null,
    h('dl.kv', h('dt', 'Version'), h('dd', ctx.version), h('dt', 'Document engine'), h('dd', `docxtemplater ${VERSIONS.docxtemplater} · pizzip ${VERSIONS.pizzip} · docx-preview ${VERSIONS['docx-preview']}`), h('dt', 'Network use'), h('dd', 'Only Clausery\'s own files, from the site that serves it. Nothing you enter is ever sent anywhere; check the Network tab of your browser to verify.'), h('dt', 'Links'), h('dd', h('a', { href: '../docs/', target: '_blank', rel: 'noopener' }, 'Documentation'), ' · ', h('a', { href: '../docs/security.html', target: '_blank', rel: 'noopener' }, 'Security'), ' · ', h('a', { href: '../legal/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy'), ' · ', h('a', { href: '../changelog.html', target: '_blank', rel: 'noopener' }, 'Changelog'))));

  setChildren(ctx.main, h('div.narrow.stack', h('div.page-head', h('div', h('h1', 'Settings'))), profile, appearance, license, security, data, about));
}
