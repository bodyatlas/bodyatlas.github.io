import { test, expect } from '@playwright/test';
import { openApp, useSample, fill, docxText } from './helpers.mjs';

test.describe('core drafting flow', () => {
  test('imports a sample, edits the questionnaire, drafts and generates a .docx', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await openApp(page);
    await useSample(page, 1);   // engagement letter
    await expect(page.locator('input[aria-label="Template name"]')).toHaveValue('Engagement letter');
    await expect(page.locator('.field-item')).toHaveCount(18);
    await expect(page.locator('.field-item[data-key="attorneys"] .badge.type')).toHaveText('Repeating group');
    await expect(page.locator('.field-item[data-key="has_retainer"] .badge.type')).toHaveText('Condition');

    // rename a field and save
    await page.click('.field-item[data-key="client_name"] .field-main');
    await page.locator('.inspector label.field:has(.field-label:text-is("Label")) input').fill('Client full name');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.toast')).toContainText('saved');

    // draft
    await page.click('button:has-text("New draft")');
    await page.waitForSelector('.stepper');
    await expect(page.locator('.stepper li')).toHaveCount(3);
    await fill(page, 'letter_date', '2026-10-01');
    await fill(page, 'firm_name', 'Doe & Partners');
    await fill(page, 'matter_description', 'a lease review');
    await page.click('button:has-text("Add attorney")');
    await fill(page, 'attorneys[0].name', 'Jane Doe'); await fill(page, 'attorneys[0].role', 'Partner'); await fill(page, 'attorneys[0].rate', '450');
    await fill(page, 'fee_hourly', true);
    await fill(page, 'has_retainer', true);
    await expect(page.locator('[data-path="retainer_amount"]')).toBeVisible();
    await fill(page, 'retainer_amount', '5000');
    await fill(page, 'payment_days', '30'); await fill(page, 'responsible_attorney', 'Jane Doe');
    await page.click('button:has-text("Next")');
    await expect(page.locator('.field-label:has-text("Client full name")')).toBeVisible();
    await fill(page, 'client_name', 'Acme Ltd'); await fill(page, 'client_address', '1 Main St\nSpringfield'); await fill(page, 'client_salutation', 'Ms Smith');
    await page.click('button:has-text("Review")');
    await expect(page.locator('.notice-ok')).toContainText('Everything is answered');

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download .docx")')]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const text = await docxText(await download.path());
    expect(text).toContain('Acme Ltd');
    expect(text).toContain('Jane Doe, Partner');
    expect(text).toContain('$450.00 per hour');
    expect(text).toContain('retainer) of $5,000.00');
    expect(text).not.toContain('flat fee of');
    expect(text).not.toContain('No advance deposit');
    expect(text).toContain('October 1, 2026');

    await page.click('button:has-text("Preview")');
    await expect(page.locator('.preview-wrap section.docx').first()).toBeVisible();
    await page.goto('app/#/drafts');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr .badge')).toHaveText('Generated');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('free plan allows three templates and then asks to upgrade', async ({ page }) => {
    await openApp(page);
    for (let i = 0; i < 3; i++) { await useSample(page, i); await page.goto('app/#/templates'); await page.waitForSelector('h1:has-text("Templates")'); }
    await expect(page.locator('.cards article[data-template-id]')).toHaveCount(3);
    await page.locator('button:has-text("Use this sample")').nth(0).click();
    await expect(page.locator('.modal-title')).toHaveText('Available on Pro');
  });

  test('draft answers survive a reload and validation blocks skipping required fields on Next', async ({ page }) => {
    await openApp(page);
    await useSample(page, 0);   // NDA
    await page.click('button:has-text("New draft")');
    await page.waitForSelector('.stepper');
    await fill(page, 'effective_date', '2026-11-01');
    await fill(page, 'purpose', 'a joint venture');
    await page.waitForTimeout(700);   // autosave debounce
    await page.reload();
    await page.waitForSelector('.stepper');
    await expect(page.locator('[name="purpose"]')).toHaveValue('a joint venture');
    await page.click('button:has-text("Next")');
    await expect(page.locator('.field-error:visible').first()).toContainText('required');
    await expect(page.locator('.toast')).toContainText('Complete the highlighted');
  });
});

test('template library "Fill it in now" opens a ready draft, and reuses the template on a second visit', async ({ page }) => {
  await page.goto('templates/payment-demand-letter.html');
  await page.click('a:has-text("Fill it in now")');
  await page.waitForSelector('.stepper');
  await expect(page).toHaveURL(/#\/drafts\/d_/);
  await expect(page.locator('#main .badge').first()).toHaveText('Payment demand letter');
  await page.goto('app/#/start/payment-demand-letter');
  await page.waitForSelector('.stepper');
  await page.goto('app/#/templates');
  await expect(page.locator('.cards article[data-template-id]')).toHaveCount(1);
  await page.goto('app/#/drafts');
  await expect(page.locator('tbody tr')).toHaveCount(2);
});
