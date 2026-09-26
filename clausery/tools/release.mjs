// Stamps the release: writes package.json's version into sw.js (VERSION), app/config.js (APP_VERSION) and regenerates
// the service worker's PRECACHE list from the files on disk so it can never drift from the app.
// Run with `npm run release` after bumping "version" in package.json (it also runs as part of `npm run build`).
import { readFileSync, writeFileSync, globSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
export function precacheList() {
  const patterns = ['app/index.html', 'app/*.css', 'app/*.webmanifest', 'app/**/*.js', 'vendor/*.js', 'samples/*.docx', 'assets/icon.svg', 'assets/icon-192.png', 'site.css', 'site.js', 'offline.html', 'index.html'];
  const files = new Set();
  for (const p of patterns) for (const f of globSync(p)) files.add(f.split('\\').join('/'));
  return ['', 'app/', ...[...files].sort()];
}

let sw = readFileSync('sw.js', 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
sw = sw.replace(/\/\/ PRECACHE:BEGIN[\s\S]*?\/\/ PRECACHE:END/, `// PRECACHE:BEGIN\nconst PRECACHE = ${JSON.stringify(precacheList(), null, 2).replace(/"/g, "'")};\n// PRECACHE:END`);
writeFileSync('sw.js', sw);
let cfg = readFileSync('app/config.js', 'utf8');
cfg = cfg.replace(/export const APP_VERSION = '[^']*';/, `export const APP_VERSION = '${version}';`);
writeFileSync('app/config.js', cfg);
console.log(`release ${version}: sw.js VERSION, app/config.js APP_VERSION and ${precacheList().length} precache entries written`);
