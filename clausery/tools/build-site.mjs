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

// GitHub Pages serves only the 404.html at the repository root, for every missing URL on the whole site. The root also
// hosts an unrelated project, so this page is neutral, self-contained (inline CSS, absolute links) and links to both.
writeFileSync('../404.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Page not found</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="The page you were looking for does not exist.">
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: #f6f4ef; color: #1b1f27; }
  main { max-width: 34rem; text-align: center; }
  h1 { font-size: 1.8rem; margin: 0 0 .5rem; }
  nav { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; margin-top: 1.25rem; }
  a { padding: .6rem 1.1rem; border-radius: 7px; border: 1px solid #b9b2a2; color: inherit; text-decoration: none; font-weight: 600; }
  a:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) { body { background: #0f1419; color: #e8ebef; } a { border-color: #46526a; } }
</style>
</head>
<body>
<main id="main">
  <h1>Page not found</h1>
  <p>The address may be mistyped, or the page has moved.</p>
  <nav aria-label="Sites"><a href="/">Layered Body Atlas</a><a href="/clausery/">Clausery</a></nav>
</main>
</body>
</html>
`);
console.log('wrote ../404.html (repository root)');
