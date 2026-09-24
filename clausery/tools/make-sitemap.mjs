// Writes sitemap.xml and robots.txt for the public pages (the app itself is noindex).
import { writeFileSync, globSync } from 'node:fs';
const base = 'https://bodyatlas.github.io/clausery/';
const pages = globSync('**/*.html', { cwd: process.cwd(), exclude: (f) => f.startsWith('node_modules') || f.startsWith('app/') || f.startsWith('test-results') || f === '404.html' || f.startsWith('playwright-report') })
  .map((f) => f.replace(/index\.html$/, '')).sort();
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod><priority>${p === '' ? '1.0' : p.startsWith('docs') ? '0.6' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
writeFileSync('sitemap.xml', xml);
writeFileSync('robots.txt', `User-agent: *\nAllow: /clausery/\nDisallow: /clausery/app/\nSitemap: ${base}sitemap.xml\n`);
console.log(`sitemap: ${pages.length} pages`);
