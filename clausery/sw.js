/* Clausery service worker: makes the app work offline. Same-origin only; never touches other origins.
   Strategy: the app files listed in PRECACHE are fetched once at install and then served from the cache with no
   background requests (a new release ships a new VERSION, which installs a fresh cache). Pages are network-first so a
   deploy is visible at once; offline, app routes fall back to the app shell and other pages to offline.html.
   VERSION and PRECACHE are written by tools/release.mjs; do not edit them by hand. */
const VERSION = '1.1.0';
const CACHE = 'clausery-' + VERSION;
const BASE = new URL('./', self.location).pathname;
// PRECACHE:BEGIN
const PRECACHE = [
  '',
  'app/',
  'app/config.js',
  'app/index.html',
  'app/lib/backup.js',
  'app/lib/expr.js',
  'app/lib/form.js',
  'app/lib/intake.js',
  'app/lib/license.js',
  'app/lib/logic.js',
  'app/lib/plan.js',
  'app/lib/render.js',
  'app/lib/schema.js',
  'app/lib/store.js',
  'app/lib/vault.js',
  'app/lib/versions.js',
  'app/main.js',
  'app/manifest.webmanifest',
  'app/styles.css',
  'app/theme.js',
  'app/ui/dom.js',
  'app/ui/router.js',
  'app/ui/views/designer.js',
  'app/ui/views/drafts.js',
  'app/ui/views/interview.js',
  'app/ui/views/lock.js',
  'app/ui/views/settings.js',
  'app/ui/views/templates.js',
  'assets/icon-192.png',
  'assets/icon.svg',
  'index.html',
  'offline.html',
  'samples/employment-verification-letter.docx',
  'samples/engagement-letter.docx',
  'samples/independent-contractor-agreement.docx',
  'samples/mutual-nda.docx',
  'samples/offer-letter.docx',
  'samples/payment-demand-letter.docx',
  'samples/statement-of-work.docx',
  'site.css',
  'site.js',
  'vendor/docs.js',
  'vendor/intake-runtime.js'
];
// PRECACHE:END
const PRECACHE_URLS = new Set(PRECACHE.map((p) => BASE + p));

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache so a release never precaches a stale copy of a file
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled([...PRECACHE_URLS].map((u) => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('clausery-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(async () => (await caches.match(req, { ignoreSearch: true }))
        || (url.pathname.startsWith(BASE + 'app/') ? await caches.match(BASE + 'app/index.html') : null)
        || (await caches.match(BASE + 'offline.html'))
        || Response.error()));
    return;
  }
  if (PRECACHE_URLS.has(url.pathname)) {
    // released files never change within a VERSION: answer from the cache and do not touch the network
    e.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); } return res; })));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
