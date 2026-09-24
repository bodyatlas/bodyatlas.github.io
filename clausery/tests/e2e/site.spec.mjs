import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['', 'pricing/', 'docs/', 'docs/templates.html', 'docs/security.html', 'legal/privacy.html', '404.html'];
for (const p of PAGES) {
  test(`site page ${p || 'home'} renders and has no serious accessibility violations`, async ({ page }) => {
    const res = await page.goto(p);
    expect(res.status()).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('the app has no serious accessibility violations on its main screens', async ({ page }) => {
  await page.goto('app/');
  await page.waitForSelector('h1:has-text("Templates")');
  for (const step of ['templates', 'designer', 'interview', 'settings']) {
    if (step === 'designer') { await page.locator('button:has-text("Use this sample")').nth(1).click(); await page.waitForSelector('input[aria-label="Template name"]'); await page.click('.field-item[data-key="client_name"] .field-main'); }
    if (step === 'interview') { await page.click('button:has-text("New draft")'); await page.waitForSelector('.stepper'); }
    if (step === 'settings') { await page.goto('app/#/settings'); await page.waitForSelector('h1:has-text("Settings")'); }
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${step} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), step).toEqual([]);
  }
});

test('offline: the service worker precache list only names files that exist', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const sw = readFileSync('sw.js', 'utf8');
  const list = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('].map'));
  const files = [...list.matchAll(/'([^',]+)'/g)].map((m) => m[1]).filter((f) => f && !f.endsWith('/'));
  const missing = files.filter((f) => !existsSync(f));
  expect(missing).toEqual([]);
});
