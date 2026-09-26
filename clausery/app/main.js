/* Clausery app bootstrap: opens the local store, checks the license, handles the vault lock, wires routes. */
import { APP_VERSION, DEFAULT_SETTINGS, licensePublicKey, CHECKOUT_URLS, CONTACT_EMAIL, SITE_URL } from './config.js';
import { Store, LockedError } from './lib/store.js';
import { Plan, FEATURE_LABELS } from './lib/plan.js';
import { verifyKey } from './lib/license.js';
import { Router } from './ui/router.js';
import { h, icon, toast, modal, confirmDialog, setTitle, setChildren, closeAllModals } from './ui/dom.js';
import { nowISO } from './lib/schema.js';
import * as templatesView from './ui/views/templates.js';
import * as designerView from './ui/views/designer.js';
import * as draftsView from './ui/views/drafts.js';
import * as interviewView from './ui/views/interview.js';
import * as settingsView from './ui/views/settings.js';
import * as lockView from './ui/views/lock.js';

const store = new Store();
const plan = new Plan();
const router = new Router();
const main = document.getElementById('main');
const statusEl = document.getElementById('status');
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

const ctx = {
  version: APP_VERSION, store, plan, router, main, settings: { ...DEFAULT_SETTINGS }, siteUrl: SITE_URL, contactEmail: CONTACT_EMAIL, checkoutUrls: CHECKOUT_URLS,
  navigate: (p) => router.go(p),
  templates: {
    list: async () => (await store.all('templates')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    get: (id) => store.get('templates', id),
    save: async (t) => { t.updatedAt = nowISO(); return store.put('templates', t); },
    remove: async (id) => { await store.delete('templates', id); await store.delete('files', id).catch(() => {}); },
    getFile: async (id) => { const f = await store.get('files', id); return f ? f.bytes : null; },
    saveFile: (id, bytes) => store.put('files', { id, bytes }),
    count: () => store.count('templates'),
  },
  drafts: {
    list: async () => (await store.all('drafts')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    get: (id) => store.get('drafts', id),
    save: async (d) => { d.updatedAt = nowISO(); return store.put('drafts', d); },
    remove: (id) => store.delete('drafts', id),
  },
  async saveSettings(patch) {
    Object.assign(ctx.settings, patch);
    await store.setSetting('settings', ctx.settings);
    applyTheme();
    renderStatus();
  },
  async setLicense(key) {
    if (!key) { await store.delete('settings', 'license'); plan.set('free'); renderStatus(); return { ok: true }; }
    const res = await verifyKey(key, licensePublicKey());
    if (res.ok) { await store.setSetting('license', key); plan.set(res.plan, res.payload); renderStatus(); }
    return res;
  },
  requirePlan(feature, opts = {}) {
    if (feature === 'templates' ? plan.canAddTemplate(opts.count || 0) : plan.can(feature)) return true;
    upgradeModal(feature);
    return false;
  },
  /** Views add async functions here to flush pending work before the key is dropped; cleared on every navigation. */
  lockHooks: new Set(),
  /** Unsaved in-memory edits by record id, kept across lock/unlock so a lock never discards work. Never cleared here. */
  pendingEdits: new Map(),
  async lock() {
    if (!store.vaultMeta || store.locked) return;
    for (const hook of [...ctx.lockHooks]) { try { await hook(); } catch (e) { console.error(e); } }
    store.setKey(null);
    closeAllModals();
    armIdle();
    await router.resolve();
    renderStatus();
  },
  armIdle: () => armIdle(),
  renderStatus,
};

function applyTheme() {
  const t = ctx.settings.theme || 'system';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('clausery.theme', t); } catch { /* ignore */ }
}

function renderStatus() {
  setChildren(statusEl, 
    h('span.badge', { title: plan.payload ? 'Licensed' : 'Free plan' }, plan.isPaid ? icon('sparkle', 13) : null, plan.name),
    store.vaultMeta ? h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => ctx.lock(), title: 'Lock the workspace now' }, icon('lock', 15), h('span.nav-label', 'Lock')) : null,
  );
}

function upgradeModal(feature) {
  const label = feature === 'templates' ? 'More than 3 templates' : FEATURE_LABELS[feature] || feature;
  modal({
    title: 'Available on Pro',
    body: h('div.stack',
      h('p', h('strong', label), ' is part of Clausery Pro. Everything still runs in your browser; a license simply unlocks the feature.'),
      h('ul.feature-list', Object.values(FEATURE_LABELS).map((f) => h('li', icon('check', 16), f))),
      h('p.small.muted', 'Already have a key? Enter it under Settings → License.')),
    actions: [
      { label: 'Enter license key', onClick: () => { router.go('/settings'); setTimeout(() => document.getElementById('license-key')?.focus(), 300); } },
      { label: 'See plans', primary: true, onClick: () => { window.open('../pricing/', '_blank', 'noopener'); return false; } },
    ],
  });
}

function setNav(name) {
  for (const a of document.querySelectorAll('#nav a[data-nav]')) { if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
}

async function guarded(fn, params, navName, title) {
  ctx.lockHooks.clear();   // the previous view is unmounted now; the next one registers its own hooks
  if (store.locked) { setNav(null); setTitle('Locked'); await lockView.render(ctx, { onUnlocked: () => router.resolve() }); return; }
  setNav(navName); setTitle(title);
  setChildren(main, h('p.muted', 'Loading…'));
  try { await fn(ctx, params); }
  catch (e) {
    if (e instanceof LockedError) { await lockView.render(ctx, { onUnlocked: () => router.resolve() }); return; }
    console.error(e);
    setChildren(main, h('div.notice.notice-danger', icon('warn'), h('div', h('strong', 'Something went wrong. '), String(e.message || e))));
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

router
  .add('/', () => router.go('/templates', true))
  .add('/templates', (p) => guarded(templatesView.render, p, 'templates', 'Templates'))
  .add('/templates/:id', (p) => guarded(designerView.render, p, 'templates', 'Edit template'))
  .add('/drafts', (p) => guarded(draftsView.render, p, 'drafts', 'Drafts'))
  .add('/drafts/:id', (p) => guarded(interviewView.render, p, 'drafts', 'Draft'))
  .add('/settings', (p) => guarded(settingsView.render, p, 'settings', 'Settings'));
router.notFound = () => router.go('/templates', true);

// auto-lock after inactivity when a vault is enabled
let idleTimer;
function armIdle() {
  clearTimeout(idleTimer);
  const mins = Number(ctx.settings.autoLockMinutes) || 0;
  if (store.vaultMeta && !store.locked && mins > 0) idleTimer = setTimeout(() => { ctx.lock(); toast('Workspace locked after inactivity.', { type: 'info' }); }, mins * 60000);
}
for (const ev of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(ev, armIdle, { passive: true });
store.onChange((s, id, info) => { if (info && info.remote) { if (s === 'vault') onRemoteVault(); } else armIdle(); });

/** Another tab enabled, changed or turned off the vault: this tab's key is stale, so drop it and re-read the metadata. */
async function onRemoteVault() {
  store.setKey(null);
  store.vaultMeta = await store.getSetting('vault', null);
  if (!store.vaultMeta && await store.hasEncryptedRecords()) store.vaultMeta = { missing: true };
  renderStatus(); armIdle();
  await router.resolve();
}

async function boot() {
  document.getElementById('nav-version').textContent = 'v' + APP_VERSION;
  const navIcons = { templates: 'file', drafts: 'edit', settings: 'settings', docs: 'info' };
  for (const a of document.querySelectorAll('#nav a[data-nav]')) a.querySelector('.nav-icon').replaceWith(icon(navIcons[a.dataset.nav] || 'info'));
  try { await store.open(); } catch (e) { setChildren(main, h('div.notice.notice-danger', icon('warn'), h('div', h('strong', 'Clausery needs local storage. '), String(e.message || e), ' Private browsing modes and some privacy settings block IndexedDB.'))); return; }
  ctx.settings = { ...DEFAULT_SETTINGS, ...(await store.getSetting('settings', {})) };
  applyTheme();
  store.vaultMeta = await store.getSetting('vault', null);
  if (!store.vaultMeta && await store.hasEncryptedRecords()) store.vaultMeta = { missing: true };
  const licenseKey = await store.getSetting('license', null);
  if (licenseKey) {
    const res = await verifyKey(licenseKey, licensePublicKey());
    if (res.ok) plan.set(res.plan, res.payload); else { plan.set('free', null, res.error); toast(res.expired ? 'Your license has expired. The workspace is back on the Free plan.' : 'The stored license key is not valid for this deployment.', { type: 'warn', timeout: 8000 }); }
  }
  renderStatus();
  if ('serviceWorker' in navigator && !isLocal) {
    navigator.serviceWorker.register('../sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version of Clausery is ready.', { timeout: 0, action: { label: 'Reload', onClick: () => location.reload() } }); }); });
    }).catch(() => {});
  }
  window.addEventListener('beforeunload', (e) => { if (ctx.dirty) { e.preventDefault(); e.returnValue = ''; } });
  router.beforeLeave = async () => { if (!ctx.dirty) return true; const ok = await confirmDialog({ title: 'Discard unsaved changes?', message: 'You have unsaved changes in this template. Leave without saving?', confirmLabel: 'Discard', danger: true }); if (ok) ctx.dirty = false; return ok; };
  await router.resolve();
  armIdle();
}
boot();
window.__clausery = ctx;   // for debugging and end-to-end tests
