import { readFileSync } from 'node:fs';
export async function docxText(path) {
  const { PizZip, Docxtemplater } = await import('../../vendor/docs.js');
  return new Docxtemplater(new PizZip(readFileSync(path)), { paragraphLoop: true }).getFullText();
}
/** Fill a field by its form name whatever its input type. */
export async function fill(page, name, value) {
  const el = page.locator(`[name="${name}"]`).first();
  const tag = await el.evaluate((e) => e.tagName + ':' + (e.type || ''));
  if (tag.endsWith('checkbox')) { if (value) await el.check(); else await el.uncheck(); }
  else if (tag.startsWith('SELECT')) await el.selectOption(String(value));
  else await el.fill(String(value));
}
export async function openApp(page) {
  await page.goto('app/');
  await page.waitForSelector('h1:has-text("Templates")');
}
export async function useSample(page, index) {
  await page.locator('button:has-text("Use this sample")').nth(index).click();
  await page.waitForSelector('input[aria-label="Template name"]');
}
