// Generates marketing screenshots, the Open Graph image and PNG icons with headless Chromium.
// Run with `npm run screenshots` (needs a built site: `npm run build`).
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

import { readFileSync, writeFileSync } from 'node:fs';

const port = 4177;
const server = await startServer(port);
const base = `http://127.0.0.1:${port}/clausery/`;
const browser = await chromium.launch();
try {
  // icons from the SVG
  const svg = readFileSync('assets/icon.svg', 'utf8');
  for (const size of [192, 512]) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;background:#1b2a41">${svg.replace(/width="64" height="64"/, `width="${size}" height="${size}"`)}</body></html>`);
    writeFileSync(`assets/icon-${size}.png`, await p.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } }));
    await p.close();
  }
  // Open Graph card
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:#1b2a41;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:72px;box-sizing:border-box">
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:36px">${svg.replace(/width="64" height="64"/, 'width="64" height="64"')}<span style="font-size:36px;font-weight:800;letter-spacing:-.01em">Clausery</span></div>
    <div style="font-size:64px;font-weight:800;line-height:1.1;letter-spacing:-.02em;max-width:1000px">Document automation that never leaves your browser.</div>
    <div style="font-size:28px;color:#b9c3d4;margin-top:28px;max-width:960px">Word templates become guided questionnaires. Finished documents are assembled on your computer. No uploads, no account, works offline.</div>
    <div style="position:absolute;right:72px;bottom:56px;background:#0f766e;color:#fff;font-size:22px;font-weight:700;padding:14px 22px;border-radius:10px">Free for up to 3 templates</div>
  </body></html>`);
  writeFileSync('assets/og.png', await og.screenshot({ type: 'png' }));
  await og.close();

  // app screenshots: seed a template + draft, then capture the interview and designer in light mode
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.goto(base + 'app/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Use this sample") >> nth=1');
  await page.waitForSelector('input[aria-label="Template name"]');
  await page.click('.field-item[data-key="attorneys"] .field-main');
  await page.waitForTimeout(300);
  writeFileSync('assets/screenshot-designer.png', await page.screenshot({ type: 'png' }));
  await page.click('button:has-text("New draft")');
  await page.waitForSelector('.stepper');
  const fill = async (name, v) => { const el = page.locator(`[name="${name}"]`); if (await el.count()) { const t = await el.first().evaluate((e) => e.type); if (t === 'checkbox') { if (v) await el.check(); } else await el.fill(String(v)); } };
  await fill('letter_date', '2026-10-01'); await fill('firm_name', 'Harlow & Reyes LLP'); await fill('matter_description', 'negotiation of the Pier 7 warehouse lease'); await fill('payment_days', '30'); await fill('responsible_attorney', 'Dana Reyes');
  await page.locator('.stepper li').nth(1).click();
  await fill('client_name', 'Northwind Logistics Ltd'); await fill('client_address', '400 Harbour Street\nSeattle, WA 98101'); await fill('client_salutation', 'Ms Okafor');
  await page.locator('.stepper li').nth(0).click();
  const add = page.locator('button:has-text("Add attorney")');
  if (await add.count()) { await add.click(); await fill('attorneys[0].name', 'Dana Reyes'); await fill('attorneys[0].role', 'Partner'); await fill('attorneys[0].rate', '520'); await add.click(); await fill('attorneys[1].name', 'Miguel Santos'); await fill('attorneys[1].role', 'Associate'); await fill('attorneys[1].rate', '310'); }
  await fill('fee_hourly', true); await fill('has_retainer', true); await fill('retainer_amount', '7500');
  await page.waitForTimeout(600);
  const steps = page.locator('.stepper li'); await steps.nth(await steps.count() - 1).click();
  await page.waitForSelector('h2:has-text("Review & generate")');
  await page.click('button:has-text("Preview")');
  await page.waitForSelector('.preview-wrap section.docx', { timeout: 15000 });
  await page.waitForTimeout(400);
  writeFileSync('assets/screenshot-interview.png', await page.screenshot({ type: 'png' }));
  await page.close();
  console.log('wrote assets/icon-192.png, icon-512.png, og.png, screenshot-designer.png, screenshot-interview.png');
} finally { await browser.close(); server.kill(); }
