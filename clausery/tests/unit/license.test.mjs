import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyKey, signPayload, parseKey, b64urlEncode, planFeatures, describeLicense } from '../../app/lib/license.js';

const subtle = globalThis.crypto.subtle;
async function keypair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64urlEncode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)));
  return { kp, pub };
}

test('a signed key verifies and exposes its plan', async () => {
  const { kp, pub } = await keypair();
  const key = await signPayload({ v: 1, id: 'L-1', plan: 'pro', name: 'Jane Doe', email: 'jane@example.com', seats: 1, issued: '2026-09-24', expires: '2027-09-24' }, kp.privateKey);
  assert.match(key, /^CLSY-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const res = await verifyKey(key, pub, new Date('2026-10-01'));
  assert.equal(res.ok, true);
  assert.equal(res.plan, 'pro');
  assert.equal(res.payload.name, 'Jane Doe');
  assert.equal(planFeatures(res.plan).intake, true);
  assert.equal(describeLicense(res.payload), 'Pro · for Jane Doe · 1 seat · until 2027-09-24');
});

test('whitespace and line breaks in a pasted key are tolerated', async () => {
  const { kp, pub } = await keypair();
  const key = await signPayload({ v: 1, id: 'L-2', plan: 'team', seats: 5 }, kp.privateKey);
  const messy = key.slice(0, 20) + '\n ' + key.slice(20);
  assert.equal((await verifyKey(messy, pub)).ok, true);
});

test('tampered payloads and wrong public keys are rejected', async () => {
  const { kp, pub } = await keypair();
  const other = await keypair();
  const key = await signPayload({ v: 1, id: 'L-3', plan: 'pro' }, kp.privateKey);
  const [payload, sig] = key.slice(5).split('.');
  const forged = 'CLSY-' + b64urlEncode(new TextEncoder().encode(JSON.stringify({ v: 1, id: 'L-3', plan: 'enterprise' }))) + '.' + sig;
  assert.equal((await verifyKey(forged, pub)).ok, false);
  assert.match((await verifyKey(forged, pub)).error, /signature is invalid/);
  assert.equal((await verifyKey(key, other.pub)).ok, false);
  assert.equal((await verifyKey('CLSY-' + payload + '.AAAA', pub)).ok, false);
});

test('expired keys report expiry', async () => {
  const { kp, pub } = await keypair();
  const key = await signPayload({ v: 1, id: 'L-4', plan: 'pro', expires: '2026-01-31' }, kp.privateKey);
  const res = await verifyKey(key, pub, new Date('2026-02-01'));
  assert.equal(res.ok, false);
  assert.equal(res.expired, true);
  assert.equal((await verifyKey(key, pub, new Date('2026-01-31T12:00:00'))).ok, true);
});

test('malformed keys give friendly errors', () => {
  assert.match(parseKey('hello').error, /does not look like/);
  assert.match(parseKey('CLSY-abc').error, /incomplete/);
  assert.match(parseKey('CLSY-!!!.abc').error, /corrupted/);
  assert.match(parseKey('CLSY-' + b64urlEncode(new TextEncoder().encode('{"plan":"gold"}')) + '.abc').error, /unknown plan/);
});
