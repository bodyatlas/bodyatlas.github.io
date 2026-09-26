// Writes sitemap.xml for the public pages and the site-wide robots.txt at the repository root (crawlers only read
// robots.txt at the origin root). No lastmod: an accurate one cannot be known before the commit that changes a page,
// and a build-time date would claim every page changed on every build.
import { writeFileSync, globSync } from 'node:fs';

const base = 'https://bodyatlas.github.io/clausery/';
const skip = (f) => /^(node_modules|app|test-results|playwright-report)\//.test(f) || f === '404.html' || f === 'offline.html' || /^google[0-9a-f]+\.html$/.test(f);   // search-console verification files
const pages = globSync('**/*.html').map((f) => f.split('\\').join('/')).filter((f) => !skip(f)).sort();
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((f) => {
  const p = f.replace(/index\.html$/, '');
  return `  <url><loc>${base}${p}</loc><priority>${p === '' ? '1.0' : p.startsWith('docs') ? '0.6' : '0.8'}</priority></url>`;
}).join('\n')}\n</urlset>\n`;
writeFileSync('sitemap.xml', xml);
writeFileSync('../robots.txt', `User-agent: *\nAllow: /\nDisallow: /clausery/app/\nSitemap: ${base}sitemap.xml\n`);
console.log(`sitemap: ${pages.length} pages; robots.txt written to the repository root`);
