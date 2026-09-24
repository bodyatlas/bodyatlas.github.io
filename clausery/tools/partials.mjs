// Shared HTML fragments for the static site pages (used by tools/build-site.mjs).
export const YEAR = '2026';
export function head({ title, description, path, extraHead = '' }) {
  const full = title === 'Clausery' ? 'Clausery — Document automation that never leaves your browser' : `${title} · Clausery`;
  const url = `https://bodyatlas.github.io/clausery/${path}`;
  const depth = path.split('/').filter(Boolean).length - (path.endsWith('/') || path === '' ? 0 : 1);
  const rel = depth > 0 ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(full)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Clausery">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://bodyatlas.github.io/clausery/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1b2a41">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="${rel}assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel}assets/icon-192.png">
<link rel="manifest" href="${rel}app/manifest.webmanifest">
<link rel="stylesheet" href="${rel}site.css">
<script src="${rel}app/theme.js"></script>
${extraHead}
</head>
<body>
<a class="sr-only" href="#main">Skip to content</a>
${header(rel, path)}
`;
}
export function header(rel, path) {
  const cur = (p) => (path.startsWith(p) && p !== '' ? ' aria-current="page"' : '');
  return `<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${rel}"><img src="${rel}assets/icon.svg" alt="" width="30" height="30"> Clausery</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" onclick="var n=document.getElementById('site-nav');var o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">Menu</button>
    <nav class="site-nav" id="site-nav" aria-label="Site">
      <a href="${rel}#features">Features</a>
      <a href="${rel}pricing/"${cur('pricing/')}>Pricing</a>
      <a href="${rel}docs/"${cur('docs/')}>Docs</a>
      <a href="${rel}docs/security.html"${path === 'docs/security.html' ? ' aria-current="page"' : ''}>Security</a>
      <a class="btn btn-primary" href="${rel}app/">Open the app</a>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">`;
}
export function footer(rel) {
  return `</main>
<footer class="site-footer">
  <div class="wrap">
    <div>
      <h4>Clausery</h4>
      <p>Document automation that never leaves your browser. Turn your own Word templates into guided questionnaires and generate finished documents, offline, with no account.</p>
    </div>
    <div>
      <h4>Product</h4>
      <a href="${rel}app/">Open the app</a>
      <a href="${rel}pricing/">Pricing</a>
      <a href="${rel}changelog.html">Changelog</a>
      <a href="${rel}docs/self-hosting.html">Self-hosting</a>
    </div>
    <div>
      <h4>Docs</h4>
      <a href="${rel}docs/">Getting started</a>
      <a href="${rel}docs/templates.html">Template syntax</a>
      <a href="${rel}docs/logic.html">Logic &amp; calculations</a>
      <a href="${rel}docs/intake.html">Client intake</a>
      <a href="${rel}docs/security.html">Security</a>
    </div>
    <div>
      <h4>Legal</h4>
      <a href="${rel}legal/privacy.html">Privacy</a>
      <a href="${rel}legal/terms.html">Terms</a>
      <a href="${rel}legal/dpa.html">Data processing</a>
      <a href="mailto:hello@clausery.app">Contact</a>
    </div>
    <div class="legal">© ${YEAR} Clausery. Clausery is software, not legal advice; documents you generate are your responsibility. Not affiliated with Microsoft; Word is a trademark of Microsoft Corporation.</div>
  </div>
</footer>
</body>
</html>
`;
}
export function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function docsNav(rel, path) {
  const items = [
    ['Start here', [['docs/', 'Getting started'], ['docs/templates.html', 'Template syntax'], ['docs/questionnaire.html', 'Designing the questionnaire'], ['docs/logic.html', 'Logic & calculations']]],
    ['Working with clients', [['docs/intake.html', 'Client intake forms'], ['docs/teams.html', 'Teams & template packs'], ['docs/backups.html', 'Backups & data']]],
    ['Trust', [['docs/security.html', 'Security'], ['docs/self-hosting.html', 'Self-hosting'], ['docs/faq.html', 'FAQ']]],
  ];
  return `<nav class="docs-nav" aria-label="Documentation">${items.map(([h, links]) => `<h4>${h}</h4>${links.map(([p, l]) => `<a href="${rel}${p}"${p === path ? ' aria-current="page"' : ''}>${l}</a>`).join('')}`).join('')}</nav>`;
}
