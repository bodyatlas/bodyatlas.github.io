import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['', 'pricing/', 'docs/', 'docs/templates.html', 'docs/security.html', 'legal/privacy.html', '404.html', 'templates/', 'templates/statement-of-work.html', 'compare/gavel-alternative.html', 'for/law-firms.html', 'guides/automate-word-templates.html', 'free-tools/amount-in-words.html', 'free-tools/deadline-calculator.html', 'free-tools/template-checker.html', 'press/'];
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

// The service worker precache list is checked by tests/unit/release.test.mjs (completeness, existence, versions).

test('mobile menu opens under a strict script policy (no inline handlers)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('pricing/');
  const btn = page.locator('.menu-btn');
  await expect(page.locator('#site-nav')).toBeHidden();
  await btn.click();
  await expect(page.locator('#site-nav')).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('[onclick]').count()).toBe(0);
  await expect(page.locator('[data-checkout="pro"]')).toHaveText(/Request a pro key|Get Pro/);
});

test('free tools work in the page', async ({ page }) => {
  await page.goto('free-tools/amount-in-words.html');
  await page.fill('#amount', '3500');
  await expect(page.locator('#result')).toHaveText('Three Thousand Five Hundred Dollars');
  await page.goto('free-tools/deadline-calculator.html');
  await page.fill('#start', '2026-01-31'); await page.selectOption('#unit', 'months'); await page.fill('#amount', '1');
  await expect(page.locator('#result')).toHaveText('Saturday, February 28, 2026');
  await page.goto('free-tools/template-checker.html');
  await page.setInputFiles('#file', 'samples/engagement-letter.docx');
  await expect(page.locator('#report')).toContainText('No problems found');
  await expect(page.locator('#report table tbody tr')).toHaveCount(15);
  await expect(page.locator('#report')).toContainText('For each item: Name, Role, Rate');
});
