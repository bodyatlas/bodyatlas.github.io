import { test, expect } from '@playwright/test';
import { openApp, useSample, fill } from './helpers.mjs';
import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

test('client intake form round trip: export, fill offline, import answers', async ({ page, context }) => {
  const { signPayload, b64urlEncode } = await import('../../app/lib/license.js');
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64urlEncode(new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey)));
  const key = await signPayload({ v: 1, id: 'E2E', plan: 'pro', expires: '2099-01-01' }, kp.privateKey);
  await openApp(page);
  await page.evaluate((k) => localStorage.setItem('clausery.dev.publicKey', k), pub);
  await page.goto('app/#/settings'); await page.fill('#license-key', key); await page.click('button:has-text("Activate")');
  await expect(page.locator('.toast-ok').last()).toBeVisible();
  await page.goto('app/#/templates'); await useSample(page, 2);   // offer letter
  await page.click('button:has-text("New draft")'); await page.waitForSelector('.stepper');
  const steps = page.locator('.stepper li'); await steps.nth(await steps.count() - 1).click();
  await page.click('button:has-text("Create client intake form")');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.modal button:has-text("Download intake form")')]);
  const htmlPath = await dl.path();
  const html = readFileSync(htmlPath, 'utf8');
  expect(html).toContain('clausery-intake-data');
  expect(html).not.toContain('samples/');
  const filePath = htmlPath + '.html'; writeFileSync(filePath, html);

  // the client opens the file from disk, with no network
  const client = await context.newPage();
  await client.route('**/*', (route) => (/^(file|data|blob):/.test(route.request().url()) ? route.continue() : route.abort()));
  await client.goto(pathToFileURL(filePath).href);
  await expect(client.locator('h1')).toHaveText('Offer of employment');
  await fill(client, 'candidate_first_name', 'Sam'); await fill(client, 'candidate_full_name', 'Sam Lee'); await fill(client, 'job_title', 'Engineer');
  await client.click('button:has-text("Save answers")');
  await expect(client.locator('.notice-warn')).toContainText('still needed');
  for (const [k, v] of Object.entries({ offer_date: '2026-10-01', company_name: 'Acme', manager_name: 'Pat', manager_title: 'CTO', start_date: '2026-11-02', pay_basis: 'annual', salary: '150000', pto_days: '20', work_country: 'United States', employment_terms: 'at will', response_deadline: '2026-10-08', signatory_name: 'Jo', signatory_title: 'CEO' })) await fill(client, k, v);
  await fill(client, 'is_remote', true);
  await client.click('button:has-text("Add benefit")'); await fill(client, 'benefits[0].item', 'Health insurance');
  const [answers] = await Promise.all([client.waitForEvent('download'), client.click('button:has-text("Save answers")')]);
  const answersPath = await answers.path();
  expect(JSON.parse(readFileSync(answersPath, 'utf8')).answers.candidate_full_name).toBe('Sam Lee');

  // the firm imports the answers
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Import answers")')]);
  await chooser.setFiles(answersPath);
  await expect(page.locator('.toast-ok').last()).toContainText('imported');
  await expect(page.locator('.notice-ok')).toContainText('Everything is answered');
  await expect(page.locator('dl.kv')).toContainText('Sam Lee');
});
