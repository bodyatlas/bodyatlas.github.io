// Static checks for the deploy tree: every HTML page has lang, title, description and viewport; internal links
// and asset references resolve to files; no external scripts or stylesheets (part of the no-third-party promise).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { globSync } from 'node:fs';

const root = process.cwd();
const files = globSync('**/*.html', { cwd: root, exclude: (f) => f.startsWith('node_modules') || f.startsWith('test-results') || f.startsWith('playwright-report') });
let problems = 0;
const fail = (f, msg) => { problems++; console.log(`${f}: ${msg}`); };
for (const f of files) {
  const html = readFileSync(join(root, f), 'utf8');
  if (!/<html[^>]*\slang="/i.test(html)) fail(f, 'missing <html lang>');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(f, 'missing <title>');
  if (!/<meta name="description" content="[^"]+"/i.test(html)) fail(f, 'missing meta description');
  if (!/<meta name="viewport"/i.test(html)) fail(f, 'missing viewport');
  if (!/<main[\s>]/i.test(html) && !/id="main"/.test(html)) fail(f, 'missing <main>');
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:)?\/\/[^"]+"/gi)) if (!/rel="(?:canonical|noopener)"/.test(m[0])) fail(f, 'external script/stylesheet: ' + m[0].slice(0, 80));
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|javascript:|tel:)/.test(url) || url === '') continue;
    let target = url.startsWith('/clausery/') ? join(root, url.slice('/clausery/'.length)) : resolve(dirname(join(root, f)), url);
    if (url.startsWith('/') && !url.startsWith('/clausery/')) { fail(f, 'absolute link outside the project: ' + url); continue; }
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) fail(f, 'broken link: ' + url);
  }
}
console.log(`${files.length} HTML files checked, ${problems} problem${problems === 1 ? '' : 's'}`);
process.exit(problems ? 1 : 0);
