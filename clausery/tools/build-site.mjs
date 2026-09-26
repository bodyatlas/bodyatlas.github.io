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
  const html = (head({ title: p.title, description: p.description, path: p.path, extraHead: p.extraHead || '', ogImage: p.ogImage }) + p.body(rel) + footer(rel)).replace(/<pre>/g, '<pre tabindex="0">');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log('wrote', out);
}

// Atom feed of guides and clause pages (pages marked `feed: true`), for feed readers and aggregators. Dates come from
// each page's `published` field, never the build time, so rebuilding does not make every entry look new.
const BASE = 'https://bodyatlas.github.io/clausery/';
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const feed = pages.filter((p) => p.feed).sort((a, b) => (b.published + b.path).localeCompare(a.published + a.path));
const updated = feed.map((p) => p.published).sort().at(-1);
writeFileSync('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Clausery: guides and clause library</title>
  <subtitle>Practical guides to drafting and automating documents, and plain-English explanations of contract clauses.</subtitle>
  <link rel="self" href="${BASE}feed.xml"/>
  <link rel="alternate" href="${BASE}"/>
  <id>${BASE}</id>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>Clausery</name></author>
${feed.map((p) => `  <entry>
    <title>${xmlEsc(p.title)}</title>
    <link href="${BASE}${p.path}"/>
    <id>${BASE}${p.path}</id>
    <updated>${p.published}T00:00:00Z</updated>
    <summary>${xmlEsc(p.description)}</summary>
  </entry>`).join('\n')}
</feed>
`);
console.log(`wrote feed.xml (${feed.length} entries)`);

// llms.txt (llmstxt.org): a plain summary and link map for AI assistants and answer engines.
const section = (prefix) => pages.filter((p) => p.path.startsWith(prefix) && !p.path.endsWith('/')).map((p) => `- [${p.title}](${BASE}${p.path}): ${p.description}`).join('\n');
writeFileSync('llms.txt', `# Clausery

> Clausery is browser-based document automation. It turns ordinary Word (.docx) templates with {tags} into guided questionnaires and generates finished documents entirely on the user's device: no upload, no account, works offline. Free for up to three templates with unlimited documents; the Pro plan adds unlimited templates, calculations, an encrypted workspace and client intake forms.

Key facts:
- Documents are assembled in the browser; template files, answers and generated documents are never sent to a server.
- Templates are normal Word files. Tags: {name} for a value, {#condition}...{/condition} for optional text, {^condition}...{/condition} for the opposite, and {#list}...{/list} for repeating paragraphs or table rows.
- Pro plan: optional passphrase encryption of everything stored in the browser (AES-256-GCM) with auto-lock.
- Free Word templates, a contract clause library and free drafting tools are available without sign-up.
- Clausery is software, not a law firm, and does not give legal advice.

## Product
- [Home](${BASE}): what Clausery does and who it is for
- [Open the app](${BASE}app/): runs in the browser, no sign-up
- [Pricing](${BASE}pricing/): Free, Pro, Team and Enterprise plans
- [Security](${BASE}docs/security.html): how data stays on the device
- [Documentation](${BASE}docs/): getting started, template syntax, logic, client intake

## Free Word templates
${section('templates/')}

## Contract clause library
${section('clauses/')}

## Guides
${section('guides/')}

## Free tools
${section('free-tools/')}

## Comparisons
${section('compare/')}
`);
console.log('wrote llms.txt');

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
