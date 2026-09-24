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
  const origins = new Set();
  page.on('request', (r) => origins.add(new URL(r.url()).origin));
  await openApp(page);
  await useSample(page, 2);
  await page.click('button:has-text("New draft")');
  await page.waitForSelector('.stepper');
  expect([...origins]).toEqual(['http://127.0.0.1:4173']);
});
