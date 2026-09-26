#!/usr/bin/env node
/* Clausery license CLI (vendor side). Usage:
     npm run license -- keygen [--out keys/]            create an Ed25519 key pair (private key stays with you)
     npm run license -- issue --key keys/private.pem --plan pro --name "Jane Doe" --email jane@x.com [--seats 1] [--expires 2027-12-31] [--id L-0001]
     npm run license -- verify --public <base64url> <license-key>
   Never commit the private key. Paste the printed public key into app/config.js (LICENSE_PUBLIC_KEY). */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { signPayload, verifyKey, b64urlEncode } from '../app/lib/license.js';

const subtle = webcrypto.subtle;
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };

function pem(label, bytes) { return `-----BEGIN ${label}-----\n${Buffer.from(bytes).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`; }
function unpem(text) { return Buffer.from(text.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64'); }

async function keygen() {
  const out = opt('out', 'keys');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('pkcs8', kp.privateKey);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  mkdirSync(out, { recursive: true });
  const privPath = join(out, 'private.pem'), pubPath = join(out, 'public.txt');
  if (existsSync(privPath) && !args.includes('--force')) { console.error(`${privPath} already exists. Use --force to overwrite.`); process.exit(1); }
  writeFileSync(privPath, pem('PRIVATE KEY', priv), { mode: 0o600 });
  writeFileSync(pubPath, b64urlEncode(pub) + '\n');
  console.log(`Private key: ${privPath}  (keep offline, never commit)`);
  console.log(`Public key:  ${b64urlEncode(pub)}`);
  console.log('Paste the public key into app/config.js as LICENSE_PUBLIC_KEY.');
}

async function issue() {
  const keyPath = opt('key'); if (!keyPath) { console.error('--key <private.pem> is required'); process.exit(1); }
  const plan = opt('plan', 'pro'); if (!['pro', 'team', 'enterprise'].includes(plan)) { console.error('--plan must be pro, team or enterprise'); process.exit(1); }
  const privateKey = await subtle.importKey('pkcs8', unpem(readFileSync(keyPath, 'utf8')), { name: 'Ed25519' }, false, ['sign']);
  const payload = { v: 1, id: opt('id', 'L-' + Date.now().toString(36).toUpperCase()), plan, name: opt('name', ''), email: opt('email', ''), seats: parseInt(opt('seats', plan === 'team' ? '5' : '1'), 10), issued: new Date().toISOString().slice(0, 10) };
  const exp = opt('expires'); if (exp) payload.expires = exp;
  const key = await signPayload(payload, privateKey);
  console.log(key);
}

async function verify() {
  const pub = opt('public'); const key = args.filter((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--public').pop();
  if (!pub || !key) { console.error('usage: verify --public <base64url> <key>'); process.exit(1); }
  const res = await verifyKey(key, pub);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 2);
}

const commands = { keygen, issue, verify };
if (!commands[cmd]) { console.log('usage: license <keygen|issue|verify> [options]'); process.exit(1); }
commands[cmd]().catch((e) => { console.error(e.message || e); process.exit(1); });
