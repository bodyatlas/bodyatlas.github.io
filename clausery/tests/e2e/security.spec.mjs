import { test, expect } from '@playwright/test';
import { openApp, useSample } from './helpers.mjs';
import { webcrypto } from 'node:crypto';

async function devLicense(plan = 'pro') {
  const { signPayload, b64urlEncode } = await import('../../app/lib/license.js');
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64urlEncode(new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey)));
  const key = await signPayload({ v: 1, id: 'E2E', plan, name: 'E2E Tester', seats: 1, issued: '2026-09-24', expires: '2099-01-01' }, kp.privateKey);
  return { pub, key };
}

test('license activation unlocks Pro features, bad keys are rejected', async ({ page }) => {
  const { pub, key } = await devLicense();
  await page.goto('app/');
  await page.evaluate((k) => localStorage.setItem('clausery.dev.publicKey', k), pub);
  await page.reload();
  await page.goto('app/#/settings');
  await page.waitForSelector('#license-key');
  await page.fill('#license-key', 'CLSY-nope.nope');
  await page.click('button:has-text("Activate")');
  await expect(page.locator('.toast')).toContainText('corrupted');
  await page.fill('#license-key', key);
  await page.click('button:has-text("Activate")');
  await expect(page.locator('.toast-ok').last()).toContainText('Pro plan activated');
  await expect(page.locator('#status .badge')).toContainText('Pro');
  await page.reload();
  await page.waitForSelector('#status .badge:has-text("Pro")');
});

test('encrypted workspace: enable, lock, wrong passphrase, unlock, data intact', async ({ page }) => {
  const { pub, key } = await devLicense();
  await openApp(page);
  await page.evaluate((k) => localStorage.setItem('clausery.dev.publicKey', k), pub);
  await useSample(page, 0);
  await page.goto('app/#/settings');
  await page.fill('#license-key', key); await page.click('button:has-text("Activate")');
  await expect(page.locator('.toast-ok').last()).toBeVisible();
  await page.click('button:has-text("Turn on encryption")');
  await page.fill('.modal input[type=password] >> nth=0', 'correct horse battery');
  await page.fill('.modal input[type=password] >> nth=1', 'correct horse battery');
  await page.click('.modal button:has-text("Continue")');
  await expect(page.locator('.toast-ok').last()).toContainText('Encryption enabled');
  // records are now ciphertext in IndexedDB
  const encrypted = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('clausery'); r.onsuccess = () => { const tx = r.result.transaction('templates'); const g = tx.objectStore('templates').getAll(); g.onsuccess = () => res(g.result.every((x) => x.__enc === 1 && !x.name)); }; }));
  expect(encrypted).toBe(true);
  await page.click('#status button:has-text("Lock")');
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
  await page.fill('input[type=password]', 'wrong'); await page.click('button:has-text("Unlock")');
  await expect(page.locator('#lock-err')).toContainText('not correct');
  await page.fill('input[type=password]', 'correct horse battery'); await page.click('button:has-text("Unlock")');
  await page.goto('app/#/templates');
  await expect(page.locator('.cards article[data-template-id]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
});

test('the app makes no requests to other origins', async ({ page }) => {
  const own = new URL(test.info().project.use.baseURL).origin;
  const origins = new Set();
  page.on('request', (r) => origins.add(new URL(r.url()).origin));
  await openApp(page);
  await useSample(page, 2);
  await page.click('button:has-text("New draft")');
  await page.waitForSelector('.stepper');
  expect([...origins]).toEqual([own]);
});

/** Raw IndexedDB rows of a store, bypassing the app's Store wrapper. */
const rawRows = (page, store) => page.evaluate((st) => new Promise((res) => { const r = indexedDB.open('clausery'); r.onsuccess = () => { const g = r.result.transaction(st).objectStore(st).getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; }; }), store);

async function enableEncryption(page, passphrase = 'correct horse battery') {
  const { pub, key } = await devLicense();
  await openApp(page);
  await page.evaluate((k) => localStorage.setItem('clausery.dev.publicKey', k), pub);
  await useSample(page, 0);
  await page.goto('app/#/settings');
  await page.fill('#license-key', key); await page.click('button:has-text("Activate")');
  await expect(page.locator('.toast-ok').last()).toBeVisible();
  await page.click('button:has-text("Turn on encryption")');
  await page.fill('.modal input[type=password] >> nth=0', passphrase);
  await page.fill('.modal input[type=password] >> nth=1', passphrase);
  await page.click('.modal button:has-text("Continue")');
  await expect(page.locator('.toast-ok').last()).toContainText('Encryption enabled');
  expect((await rawRows(page, 'templates')).every((x) => x.__enc === 1)).toBe(true);
  expect((await rawRows(page, 'settings')).some((x) => x.id === 'vault')).toBe(true);
}

test('locking during a pending autosave never leaves plaintext; writes while locked are refused; dialogs close', async ({ page }) => {
  await enableEncryption(page);
  await page.goto('app/#/templates');
  await page.click('.cards article button:has-text("New draft")');
  await page.waitForSelector('.stepper');
  await page.fill('input[aria-label="Draft name"]', 'Secret client matter');
  await page.click('#status button:has-text("Lock")');   // inside the 400 ms autosave debounce
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
  await page.waitForTimeout(800);
  const drafts = await rawRows(page, 'drafts');
  expect(drafts.length).toBeGreaterThan(0);
  expect(drafts.every((x) => x.__enc === 1)).toBe(true);
  expect(JSON.stringify(drafts)).not.toContain('Secret client matter');
  // the store refuses every write to an encrypted store while no key is loaded
  const results = await page.evaluate(async () => {
    const s = window.__clausery.store;
    const attempt = (p) => p.then(() => 'ok', (e) => e.name);
    return [await attempt(s.put('drafts', { id: 'leak', title: 'plaintext' })), await attempt(s.delete('drafts', 'leak')), await attempt(s.clear('templates')), s.locked];
  });
  expect(results).toEqual(['LockedError', 'LockedError', 'LockedError', true]);
  expect((await rawRows(page, 'drafts')).every((x) => x.__enc === 1 && x.id !== 'leak')).toBe(true);
  await page.fill('input[type=password]', 'correct horse battery'); await page.keyboard.press('Enter');
  await page.waitForSelector('.stepper');
  // an open dialog is closed by the lock instead of staying usable over the lock screen
  await page.goto('app/#/settings');
  await page.click('button:has-text("Change passphrase")');
  await expect(page.locator('.modal')).toHaveCount(1);
  await page.evaluate(() => window.__clausery.lock());
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(false);
});

test('closing a dialog restores page scrolling and keeps focus in the page', async ({ page }) => {
  await openApp(page);
  await useSample(page, 0);
  await page.goto('app/#/templates');
  await page.click('button[aria-label^="More actions"]');
  await page.click('.modal button:has-text("Delete")');
  await expect(page.locator('.modal-title')).toHaveText('Delete template?');
  // a destructive confirm starts on Cancel, not on the close icon
  expect(await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(document.activeElement.textContent.trim())))))).toBe('Cancel');
  await page.click('.modal button:has-text("Cancel")');
  await expect(page.locator('.modal')).toHaveCount(0);
  expect(await page.evaluate(() => [document.body.classList.contains('modal-open'), window.getComputedStyle(document.body).overflow])).toEqual([false, 'visible']);
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await expect(page.locator('.cards article[data-template-id]')).toHaveCount(1);
});

test('the inactivity timer is re-armed after unlocking', async ({ page }) => {
  await enableEncryption(page);
  await page.evaluate(() => window.__clausery.saveSettings({ autoLockMinutes: 0.03 }));   // 1.8 s
  await page.click('#status button:has-text("Lock")');
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
  await page.fill('input[type=password]', 'correct horse battery'); await page.keyboard.press('Enter');
  await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  await page.waitForTimeout(4000);   // no interaction at all
  await expect(page.locator('h1:has-text("Workspace locked")')).toBeVisible();
  expect(await page.evaluate(() => window.__clausery.store.locked)).toBe(true);
});

test('a second tab follows vault changes instead of writing with a stale key', async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage(), b = await context.newPage();
  await enableEncryption(a);
  await a.goto('app/#/templates');
  await a.click('.cards article button:has-text("New draft")');
  await a.waitForSelector('.stepper');
  await b.goto('app/#/settings');
  await b.fill('input[type=password]', 'correct horse battery'); await b.keyboard.press('Enter');
  await b.click('button:has-text("Turn off")');
  await b.fill('.modal input[type=password]', 'correct horse battery');
  await b.click('.modal button:has-text("Continue")');
  await expect(b.locator('.toast').last()).toContainText('Encryption turned off');
  expect((await rawRows(b, 'settings')).some((x) => x.id === 'vault')).toBe(false);
  await a.waitForFunction(() => window.__clausery.store.vaultMeta === null);
  await a.fill('input[aria-label="Draft name"]', 'Typed after turn-off');
  await a.waitForTimeout(800);
  const drafts = await rawRows(a, 'drafts');
  expect(drafts.every((x) => x.__enc !== 1)).toBe(true);
  expect(drafts.some((x) => x.title === 'Typed after turn-off')).toBe(true);
  await a.reload();
  await expect(a.locator('.stepper')).toBeVisible();   // not locked out with 'vault settings are missing'
  await context.close();
});

test('encrypted records without vault settings can be removed without losing readable ones', async ({ page }) => {
  await openApp(page);
  await useSample(page, 0);
  // an orphaned encrypted draft: ciphertext in the drafts store, no 'vault' settings record
  await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('clausery'); r.onsuccess = () => { const tx = r.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ id: 'd_orphan', __enc: 1, data: new Uint8Array([1, 2, 3]) }); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }));
  await page.goto('app/#/templates');
  await page.reload();
  await expect(page.locator('h1:has-text("Some records cannot be opened")')).toBeVisible();
  await page.click('button:has-text("Remove unreadable records and continue")');
  await page.click('.modal button:has-text("Remove unreadable records")');
  await expect(page.locator('.toast-ok').last()).toContainText('1 unreadable record removed');
  await page.goto('app/#/templates');
  await expect(page.locator('.cards article[data-template-id]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('h1:has-text("Templates")')).toBeVisible();
});
