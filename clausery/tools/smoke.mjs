// Headless smoke test of the app: boot, load a sample, open the designer, create a draft, fill, generate.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
/** Start tools/serve.mjs on a port and resolve once it is listening (no fixed sleeps). */
function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['tools/serve.mjs', String(port)], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'inherit'] });
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    child.stdout.on('data', (d) => { if (String(d).includes('serving')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('server exited with ' + code)); });
  });
}

import { readFileSync } from 'node:fs';

const server = await startServer(4199);
const browser = await chromium.launch();
const page = await browser.newPage({ acceptDownloads: true });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
try {
  await page.goto('http://127.0.0.1:4199/clausery/app/', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Templates")', { timeout: 10000 });
  console.log('templates view ok');
  await page.click('button:has-text("Use this sample") >> nth=1');   // engagement letter
  await page.waitForSelector('input[aria-label="Template name"]', { timeout: 10000 });
  console.log('designer ok, name =', await page.inputValue('input[aria-label="Template name"]'));
  console.log('fields:', await page.locator('.field-item').count(), 'sections:', await page.locator('[data-section-id]').count());
  await page.click('.field-item[data-key="client_name"] .field-main');
  await page.waitForSelector('.inspector input.input');
  const labelInput = page.locator('.inspector label.field:has(.field-label:text-is("Label")) input');
  await labelInput.fill('Client full name');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('.toast:has-text("saved")');
  console.log('save ok');
  await page.click('button:has-text("New draft")');
  await page.waitForSelector('.stepper', { timeout: 10000 });
  console.log('interview ok; steps:', await page.locator('.stepper li').count());
  console.log('label rendered:', await page.locator('.field-label:has-text("Client full name")').count());
  // fill section 1 fields
  const fill = async (path, val) => { const el = page.locator(`[name="${path}"]`); if (await el.count()) { const tag = await el.evaluate((e) => e.tagName + ':' + e.type); if (tag.includes('checkbox')) { if (val) await el.check(); } else if (tag.startsWith('SELECT')) await el.selectOption(val); else await el.fill(String(val)); } else console.log('missing', path); };
  await fill('letter_date', '2026-10-01');
  await fill('client_name', 'Acme Ltd'); await fill('client_address', '1 Main St'); await fill('matter_description', 'Lease review'); await fill('client_salutation', 'Ms Doe');
  await page.click('button:has-text("Next")');
  await fill('firm_name', 'Doe & Partners');
  // repeat group
  const addBtn = page.locator('button:has-text("Add attorney")');
  if (await addBtn.count()) { await addBtn.click(); await fill('attorneys[0].name', 'Jane Doe'); await fill('attorneys[0].role', 'Partner'); await fill('attorneys[0].rate', '450'); }
  await fill('fee_hourly', true); await fill('has_retainer', true); await fill('retainer_amount', '5000'); await fill('payment_days', '30'); await fill('responsible_attorney', 'Jane Doe');
  // go to review via stepper
  const steps = page.locator('.stepper li'); const n = await steps.count(); await steps.nth(n - 1).click();
  await page.waitForSelector('h2:has-text("Review & generate")');
  console.log('review notice:', (await page.locator('.notice').first().innerText()).slice(0, 120).replace(/\n/g, ' '));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download .docx")')]);
  const path = await download.path();
  const { PizZip, Docxtemplater } = await import('/home/user/bodyatlas.github.io/clausery/vendor/docs.js');
  const text = new Docxtemplater(new PizZip(readFileSync(path)), { paragraphLoop: true }).getFullText();
  console.log('docx contains Acme:', text.includes('Acme Ltd'), '| retainer $5,000.00:', text.includes('$5,000.00'), '| attorney:', text.includes('Jane Doe, Partner'), '| no flat fee:', !text.includes('flat fee of'));
  await page.click('button:has-text("Preview")');
  await page.waitForSelector('.preview-wrap section.docx', { timeout: 15000 });
  console.log('preview pages:', await page.locator('.preview-wrap section.docx').count());
  await page.goto('http://127.0.0.1:4199/clausery/app/#/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Settings")');
  console.log('settings ok');
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
} catch (e) { console.log('FAILED:', e.message.split('\n')[0]); await page.screenshot({ path: 'test-results/fail.png', fullPage: true }); }
console.log('console issues:', errors.length ? errors : 'none');
await browser.close(); server.kill();
