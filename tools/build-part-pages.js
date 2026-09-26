#!/usr/bin/env node
/* tools/build-part-pages.js - writes one static, crawlable page per anatomical structure to parts/<slug>/index.html,
   an A-Z index at parts/index.html and sitemap.xml. Run `npm install && npm run build:parts` after changing systems/*.js
   and commit the output: visitors still get a build-free static site.

   The structure notes live inside the system modules, so the script builds every module (male and female body) in Node
   exactly as the viewer does and reads userData.part from each mesh. Mirrored left/right parts whose notes are identical
   share one page (e.g. femur-l + femur-r -> /parts/femur/); pairs whose notes differ get a page per side. */
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = 'https://bodyatlas.github.io';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'parts');

// ------------------------------------------------------------------ load the atlas modules
const THREE = globalThis.THREE = require('three');
for (const f of ['core/landmarks.js', 'core/helpers.js', 'core/registry.js']) require(path.join(ROOT, f));
const { ANATOMY, H } = globalThis;
for (const id of ANATOMY.MODULE_IDS) require(path.join(ROOT, 'systems', id + '.js'));

const byId = new Map();
for (const sex of ['male', 'female']) {
  for (const id of ANATOMY.MODULE_IDS) {
    for (const mesh of H.parts(ANATOMY.build(id, { sex, quality: 1 }))) {
      const p = mesh.userData.part;
      if (!byId.has(p.id)) {
        mesh.updateWorldMatrix(true, false);
        const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        byId.set(p.id, Object.assign({ sexes: [], center: c }, p));
      }
      byId.get(p.id).sexes.push(sex);
    }
  }
}
const all = [...byId.values()];

// ------------------------------------------------------------------ group parts into pages
const SIDE_WORD = /^(Left|Right) /;
const pages = [];
const pageOf = new Map(); // part id -> page
const used = new Set();
for (const p of all) {
  if (used.has(p.id)) continue;
  const m = /^(.*)-([lr])$/.exec(p.id);
  const twin = m && byId.get(m[1] + (m[2] === 'l' ? '-r' : '-l'));
  const same = twin && SIDE_WORD.test(p.name) && p.name.replace(SIDE_WORD, '') === twin.name.replace(SIDE_WORD, '') &&
    JSON.stringify(p.info) === JSON.stringify(twin.info) && p.latin === twin.latin && !byId.has(m[1]);
  const members = same ? [p, twin].sort((a, b) => (a.side === 'L' ? -1 : 1)) : [p];
  const name = same ? cap(p.name.replace(SIDE_WORD, '')) : p.name;
  const page = { slug: same ? m[1] : p.id, name, part: members[0], members };
  for (const x of members) { used.add(x.id); pageOf.set(x.id, page); }
  pages.push(page);
}
pages.sort((a, b) => a.name.localeCompare(b.name, 'en'));
const slugs = new Set();
for (const pg of pages) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pg.slug)) throw new Error('bad slug ' + pg.slug);
  if (slugs.has(pg.slug)) throw new Error('duplicate slug ' + pg.slug);
  slugs.add(pg.slug);
}
const children = new Map();
for (const p of all) if (p.parent && pageOf.has(p.parent)) {
  const parentPage = pageOf.get(p.parent), kid = pageOf.get(p.id);
  if (parentPage === kid) continue;
  if (!children.has(parentPage)) children.set(parentPage, new Set());
  children.get(parentPage).add(kid);
}

// ------------------------------------------------------------------ helpers
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function clip(s, n) {
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1); const i = cut.lastIndexOf(' ');
  return cut.slice(0, i > n * 0.6 ? i : n - 1).replace(/[\s,;:.–-]+$/, '') + '…';
}
const REGION_NAMES = { head: 'Head', neck: 'Neck', thorax: 'Thorax', abdomen: 'Abdomen', pelvis: 'Pelvis', armL: 'Arm', armR: 'Arm', legL: 'Leg', legR: 'Leg', body: 'Whole body' };
function viewerHref(p) { return '/#part=' + p.id + (p.sexes.indexOf('male') < 0 ? '&sex=female' : ''); }
function systemName(id) { return (H.SYSTEMS[id] || { name: id }).name; }
function sexNote(p) {
  if (p.sexes.length === 2) return '';
  return p.sexes[0] === 'female' ? 'Shown on the female body.' : 'Shown on the male body.';
}

function head({ title, description, canonical, jsonld, depth }) {
  const up = depth ? '../'.repeat(depth) : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Layered Body Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${up}parts.css">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
`;
}
const FOOT = `<footer class="foot">
  <p>The Layered Body Atlas models are simplified illustrations for learning, not medical-grade scans or medical advice.</p>
  <p><a href="/">Open the 3D atlas</a> · <a href="/parts/">All structures A–Z</a></p>
</footer>
</body>
</html>
`;

// ------------------------------------------------------------------ structure pages
function partPage(pg) {
  const p = pg.part, info = p.info;
  const url = `${SITE}/parts/${pg.slug}/`;
  const latin = p.latin && p.latin.toLowerCase() !== pg.name.toLowerCase() ? p.latin : '';
  const title = clip(`${pg.name}${latin ? ' (' + latin + ')' : ''}: anatomy, function and size`, 70) + ' | Body Atlas';
  const lead = String(info.description || info.function).replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase());
  const description = clip(`${pg.name}${latin ? ' (' + latin + ')' : ''}: ${lead}`, 158);
  const sys = systemName(p.system);
  const facts = [['What it is', info.description], ['Function', info.function], ['Size', info.size], ['Clinical note', info.notes]].filter(f => f[1]);
  const parentPage = p.parent && pageOf.get(p.parent);
  const kids = [...(children.get(pg) || [])].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  // the ten closest structures of the same system and body region in the model (by bounding-box centre)
  const gap = o => Math.min(...pg.members.map(m => m.center.distanceTo(o.part.center)));
  const near = o => o !== pg && o.part.system === p.system && o !== parentPage && kids.indexOf(o) < 0 &&
    o.part.sexes.some(x => p.sexes.indexOf(x) >= 0) && REGION_NAMES[o.part.region] === REGION_NAMES[p.region];
  const nearby = pages.filter(near)
    .map(o => [o, gap(o)]).sort((a, b) => a[1] - b[1]).slice(0, 10).map(x => x[0]).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const open = pg.members.length > 1
    ? pg.members.map(m => `<a class="btn primary" href="${viewerHref(m)}">View ${m.side === 'L' ? 'left' : 'right'} in 3D</a>`).join('\n      ')
    : `<a class="btn primary" href="${viewerHref(p)}">View in 3D</a>`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url, url, name: title, description, isPartOf: { '@type': 'WebSite', name: 'Layered Body Atlas', url: SITE + '/' },
        about: { '@type': 'AnatomicalStructure', name: pg.name, alternateName: latin || undefined, description: info.description || undefined, bodyLocation: REGION_NAMES[p.region] }
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Body Atlas', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Structures', item: SITE + '/parts/' },
          { '@type': 'ListItem', position: 3, name: pg.name, item: url }
        ]
      }
    ]
  };
  const link = o => `<a href="../${o.slug}/">${esc(o.name)}</a>`;
  let rel = '';
  if (parentPage) rel += `\n    <p><span class="k">Part of</span> ${link(parentPage)}</p>`;
  if (kids.length) rel += `\n    <p><span class="k">Contains</span> ${kids.map(link).join(', ')}</p>`;
  if (nearby.length) rel += `\n    <p><span class="k">Nearby ${esc(sys.toLowerCase())} structures</span> ${nearby.map(link).join(', ')}</p>`;
  return head({ title, description, canonical: url, jsonld, depth: 1 }) + `<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Body Atlas</a> / <a href="../">Structures</a> / <span>${esc(pg.name)}</span></nav>
  <article>
    <h1>${esc(pg.name)}</h1>${latin ? `\n    <p class="latin" lang="la">${esc(latin)}</p>` : ''}
    <p class="chips"><span>${esc(sys)}</span><span>${esc(H.LAYER_NAMES[p.layer] || 'Layer ' + p.layer)}</span><span>${esc(REGION_NAMES[p.region] || p.region)}</span>${pg.members.length > 1 ? '<span>Left and right</span>' : p.side !== 'M' ? `<span>${p.side === 'L' ? 'Left side' : 'Right side'}</span>` : ''}</p>
    <p class="open">
      ${open}
    </p>${sexNote(p) ? `\n    <p class="muted">${sexNote(p)}</p>` : ''}
    <dl class="facts">
${facts.map(([k, v]) => `      <dt>${k}</dt>\n      <dd>${esc(v)}</dd>`).join('\n')}
    </dl>${rel ? `\n  </article>\n  <section class="related" aria-label="Related structures">${rel}\n  </section>` : '\n  </article>'}
</main>
` + FOOT;
}

// ------------------------------------------------------------------ A-Z index, grouped by system
function indexPage() {
  const url = SITE + '/parts/';
  const title = `All ${pages.length} structures of the human body, A–Z | Body Atlas`;
  const description = 'Every bone, muscle, organ, vessel, nerve and gland in the Layered Body Atlas, with Latin names, function, size and a clinical note, each viewable in 3D.';
  const bySys = new Map();
  for (const pg of pages) { const s = pg.part.system; if (!bySys.has(s)) bySys.set(s, []); bySys.get(s).push(pg); }
  const order = Object.keys(H.SYSTEMS).filter(s => bySys.has(s));
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': url, url, name: title, description };
  return head({ title, description, canonical: url, jsonld, depth: 0 }) + `<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Body Atlas</a> / <span>Structures</span></nav>
  <h1>Structures of the human body</h1>
  <p class="lede">${pages.length} structures from the Layered Body Atlas, grouped by body system. Each page has the Latin name, function, size and a clinical note, and opens the 3D model on that part.</p>
  <nav class="toc" aria-label="Body systems">${order.map(s => `<a href="#${s}">${esc(systemName(s))}</a>`).join(' ')}</nav>
${order.map(s => `  <section id="${s}">
    <h2>${esc(systemName(s))} <span class="muted">${bySys.get(s).length}</span></h2>
    <ul class="az">
${bySys.get(s).map(pg => `      <li><a href="${pg.slug}/">${esc(pg.name)}</a></li>`).join('\n')}
    </ul>
  </section>`).join('\n')}
</main>
` + FOOT;
}

// ------------------------------------------------------------------ write
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'parts.css'), path.join(OUT, 'parts.css'));
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());
for (const pg of pages) {
  fs.mkdirSync(path.join(OUT, pg.slug));
  fs.writeFileSync(path.join(OUT, pg.slug, 'index.html'), partPage(pg));
}
const urls = [SITE + '/', SITE + '/parts/', ...pages.map(pg => `${SITE}/parts/${pg.slug}/`)];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`${all.length} parts -> ${pages.length} pages in parts/, ${urls.length} URLs in sitemap.xml`);
