/* Clausery service worker: makes the app work offline. Same-origin only; never touches other origins.
   Strategy: app shell + engine precached at install; HTML network-first (fresh deploys win), other assets
   stale-while-revalidate. Bump VERSION on every release (tools/release.mjs does it). */
const VERSION = '1.0.0';
const CACHE = 'clausery-' + VERSION;
const BASE = new URL('./', self.location).pathname;
const PRECACHE = [
  '', 'index.html', 'site.css', 'app/', 'app/index.html', 'app/styles.css', 'app/main.js', 'app/config.js', 'app/theme.js', 'app/manifest.webmanifest',
  'app/lib/expr.js', 'app/lib/schema.js', 'app/lib/logic.js', 'app/lib/render.js', 'app/lib/store.js', 'app/lib/vault.js', 'app/lib/license.js', 'app/lib/backup.js', 'app/lib/plan.js', 'app/lib/form.js',
  'app/ui/dom.js', 'app/ui/router.js', 'app/ui/views/templates.js', 'app/ui/views/designer.js', 'app/ui/views/drafts.js', 'app/ui/views/interview.js', 'app/ui/views/settings.js', 'app/ui/views/lock.js',
  'vendor/docs.js', 'vendor/intake-runtime.js', 'samples/mutual-nda.docx', 'samples/engagement-letter.docx', 'samples/offer-letter.docx', 'assets/icon.svg',
].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
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
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(async () => (await caches.match(req)) || (await caches.match(BASE + 'app/index.html')) || Response.error()));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || network;
  }));
});
