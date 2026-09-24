// Builds the static marketing/docs/legal pages from site/*.mjs page modules into the deploy tree.
// Run with `npm run build:site`. Outputs are committed so GitHub Pages needs no build step.
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { head, footer } from './partials.mjs';

const pages = [];
for (const f of readdirSync('site').filter((f) => f.endsWith('.mjs'))) {
  const mod = await import('../site/' + f);
  for (const p of mod.pages) pages.push(p);
}
for (const p of pages) {
  const rel = p.path.split('/').filter(Boolean).length - (p.path.endsWith('/') || p.path === '' ? 0 : 1) > 0 ? '../'.repeat(p.path.split('/').filter(Boolean).length - (p.path.endsWith('/') || p.path === '' ? 0 : 1)) : './';
  const out = p.path === '' ? 'index.html' : p.path.endsWith('/') ? p.path + 'index.html' : p.path;
  const html = (head({ title: p.title, description: p.description, path: p.path, extraHead: p.extraHead || '' }) + p.body(rel) + footer(rel)).replace(/<pre>/g, '<pre tabindex="0">');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log('wrote', out);
}
