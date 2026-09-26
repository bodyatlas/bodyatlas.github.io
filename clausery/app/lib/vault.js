/* Clausery vault: optional encryption at rest for the workspace (IndexedDB) using WebCrypto only.
   Passphrase → PBKDF2-SHA256 (600k iterations) → AES-256-GCM key. Nothing is ever sent anywhere; losing
   the passphrase loses the data, which is the point. The same code runs in Node for tests. */

const ITERATIONS = 600000;
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n) { return globalThis.crypto.getRandomValues(new Uint8Array(n)); }

export async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await subtle().importKey('raw', enc.encode(String(passphrase).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Create vault metadata for a new passphrase: salt + a verifier that proves a later passphrase is right. */
export async function createVault(passphrase) {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt);
  const verifier = await encryptBytes(key, enc.encode('clausery-vault-ok'));
  return { meta: { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toB64(salt), verifier: toB64(verifier) }, key };
}

/** Unlock: returns the key or null when the passphrase is wrong. */
export async function unlockVault(meta, passphrase) {
  const key = await deriveKey(passphrase, fromB64(meta.salt), meta.iterations || ITERATIONS);
  try {
    const plain = await decryptBytes(key, fromB64(meta.verifier));
    return dec.decode(plain) === 'clausery-vault-ok' ? key : null;
  } catch { return null; }
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12);
  return out;
}
export async function decryptBytes(key, packed) {
  const p = packed instanceof Uint8Array ? packed : new Uint8Array(packed);
  const iv = p.slice(0, 12), ct = p.slice(12);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct));
}

/** Encrypt any JSON-serialisable record (ArrayBuffers are supported via a tagged base64 field). */
export async function encryptRecord(key, record) {
  const bytes = enc.encode(JSON.stringify(record, replacer));
  return { __enc: 1, data: await encryptBytes(key, bytes) };
}
export async function decryptRecord(key, wrapped) {
  if (!wrapped || wrapped.__enc !== 1) return wrapped;
  return JSON.parse(dec.decode(await decryptBytes(key, wrapped.data)), reviver);
}
export function isEncrypted(v) { return !!(v && typeof v === 'object' && v.__enc === 1); }

function replacer(k, v) {
  if (v instanceof ArrayBuffer) return { __bytes: toB64(new Uint8Array(v)) };
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) return { __bytes: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
  return v;
}
function reviver(k, v) { return v && typeof v === 'object' && typeof v.__bytes === 'string' && Object.keys(v).length === 1 ? fromB64(v.__bytes).buffer : v; }

export function toB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
export function fromB64(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
