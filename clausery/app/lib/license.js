/* Clausery licensing: offline-verifiable license keys.
   A key is `CLSY-<payload>.<signature>` where payload is base64url(JSON) and signature is an Ed25519 signature
   over the payload bytes made with the vendor's private key (tools/license.mjs). Verification needs only the
   public key, so it works with no network and no vendor dependency. Works in browsers and Node via WebCrypto. */

export const PLANS = {
  free: { name: 'Free', maxTemplates: 3, computed: false, intake: false, vault: false, packs: false },
  pro: { name: 'Pro', maxTemplates: Infinity, computed: true, intake: true, vault: true, packs: true },
  team: { name: 'Team', maxTemplates: Infinity, computed: true, intake: true, vault: true, packs: true },
  enterprise: { name: 'Enterprise', maxTemplates: Infinity, computed: true, intake: true, vault: true, packs: true },
};

const PREFIX = 'CLSY-';
const subtle = () => globalThis.crypto && globalThis.crypto.subtle;

export function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function parseKey(key) {
  const raw = String(key || '').trim().replace(/\s+/g, '');
  if (!raw.startsWith(PREFIX)) return { ok: false, error: 'This does not look like a Clausery license key.' };
  const [payloadB64, sigB64, ...rest] = raw.slice(PREFIX.length).split('.');
  if (!payloadB64 || !sigB64 || rest.length) return { ok: false, error: 'The license key is incomplete.' };
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))); } catch { return { ok: false, error: 'The license key is corrupted.' }; }
  if (!payload || typeof payload !== 'object' || !payload.plan || !PLANS[payload.plan]) return { ok: false, error: 'The license key names an unknown plan.' };
  return { ok: true, payload, payloadB64, sigB64 };
}

async function importPublicKey(publicKeyB64) {
  return subtle().importKey('raw', b64urlDecode(publicKeyB64), { name: 'Ed25519' }, false, ['verify']);
}

/** Verify a key against the public key. Returns { ok, plan, payload, error, expired }. `now` is injectable for tests. */
export async function verifyKey(key, publicKeyB64, now = new Date()) {
  const parsed = parseKey(key);
  if (!parsed.ok) return parsed;
  if (!subtle()) return { ok: false, error: 'This browser cannot verify license keys (WebCrypto is unavailable).' };
  let valid;
  try {
    const pub = await importPublicKey(publicKeyB64);
    valid = await subtle().verify({ name: 'Ed25519' }, pub, b64urlDecode(parsed.sigB64), new TextEncoder().encode(parsed.payloadB64));
  } catch (e) {
    return { ok: false, error: 'License verification is not supported by this browser: ' + (e.message || e) };
  }
  if (!valid) return { ok: false, error: 'The license signature is invalid.' };
  const p = parsed.payload;
  if (p.expires) {
    const exp = new Date(p.expires + (p.expires.length === 10 ? 'T23:59:59' : ''));
    if (Number.isFinite(exp.getTime()) && exp < now) return { ok: false, expired: true, payload: p, error: `This license expired on ${p.expires}.` };
  }
  return { ok: true, plan: p.plan, payload: p };
}

/** Sign a payload with an Ed25519 CryptoKey (used by tools/license.mjs; exported for tests). */
export async function signPayload(payload, privateKey) {
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await subtle().sign({ name: 'Ed25519' }, privateKey, new TextEncoder().encode(payloadB64));
  return PREFIX + payloadB64 + '.' + b64urlEncode(new Uint8Array(sig));
}

export function planFeatures(plan) { return PLANS[plan] || PLANS.free; }
export function describeLicense(payload) {
  if (!payload) return 'Free plan';
  const bits = [PLANS[payload.plan]?.name || payload.plan];
  if (payload.name) bits.push('for ' + payload.name);
  if (payload.seats) bits.push(`${payload.seats} seat${payload.seats === 1 ? '' : 's'}`);
  if (payload.expires) bits.push('until ' + payload.expires);
  return bits.join(' · ');
}
