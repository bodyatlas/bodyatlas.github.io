// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver, ...) about every page in sitemap.xml, so new and changed
// pages are crawled within hours instead of weeks. Run after a deploy: `npm run indexnow`. Free; no account needed.
// The key file 43da30a088aa172433f07307beadfda7.txt proves ownership; it lives in this folder, so it covers every URL under /clausery/.
import { readFileSync } from 'node:fs';

const KEY = '43da30a088aa172433f07307beadfda7';
const HOST = 'bodyatlas.github.io';
const urls = [...readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/clausery/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${urls.length} URLs submitted, HTTP ${res.status} ${res.statusText}`);
if (!res.ok && res.status !== 202) { console.log(await res.text()); process.exit(1); }
