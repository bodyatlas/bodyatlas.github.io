import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

test('package.json, sw.js and app/config.js carry the same version', () => {
  const pkg = JSON.parse(read('package.json')).version;
  assert.equal(/const VERSION = '([^']+)'/.exec(read('sw.js'))[1], pkg, 'run npm run release');
  assert.equal(/export const APP_VERSION = '([^']+)'/.exec(read('app/config.js'))[1], pkg, 'run npm run release');
});

test('the service worker precaches every app file, and only files that exist', () => {
  const sw = read('sw.js');
  const block = sw.slice(sw.indexOf('// PRECACHE:BEGIN'), sw.indexOf('// PRECACHE:END'));
  const listed = new Set([...block.matchAll(/'([^']*)'/g)].map((m) => m[1]));
  const required = ['app/index.html', 'app/*.css', 'app/**/*.js', 'vendor/*.js', 'samples/*.docx', 'offline.html']
    .flatMap((p) => globSync(p, { cwd: root })).map((f) => f.split('\\').join('/'));
  const missing = required.filter((f) => !listed.has(f));
  assert.deepEqual(missing, [], 'run npm run release to regenerate the precache list');
  const ghosts = [...listed].filter((f) => f && !f.endsWith('/') && !existsSync(join(root, f)));
  assert.deepEqual(ghosts, []);
});
