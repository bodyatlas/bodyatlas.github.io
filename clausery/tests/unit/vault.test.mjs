import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, encryptRecord, decryptRecord, isEncrypted, deriveKey, fromB64 } from '../../app/lib/vault.js';

test('vault round-trips records, including binary docx buffers', async () => {
  const { meta, key } = await createVault('correct horse battery staple');
  const buf = new Uint8Array([80, 75, 3, 4, 1, 2, 3]).buffer;
  const rec = { id: 't1', name: 'NDA', answers: { a: 1, b: ['x', 'y'] }, docx: buf, nested: { when: '2026-09-24' } };
  const wrapped = await encryptRecord(key, rec);
  assert.equal(isEncrypted(wrapped), true);
  assert.ok(!JSON.stringify([...new Uint8Array(wrapped.data)]).includes('NDA'));
  const back = await decryptRecord(key, wrapped);
  assert.equal(back.name, 'NDA');
  assert.deepEqual(back.answers, rec.answers);
  assert.ok(back.docx instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(back.docx)], [80, 75, 3, 4, 1, 2, 3]);
  assert.equal(await unlockVault(meta, 'correct horse battery staple') !== null, true);
  assert.equal(await unlockVault(meta, 'wrong'), null);
});

test('plaintext records pass through decryptRecord untouched', async () => {
  const { key } = await createVault('x');
  const rec = { id: 1 };
  assert.equal(await decryptRecord(key, rec), rec);
});

test('key derivation is deterministic for the same salt and NFKC-normalised passphrase', async () => {
  const salt = fromB64('AAECAwQFBgcICQoLDA0ODw==');
  const k1 = await deriveKey('café', salt, 1000);
  const k2 = await deriveKey('café', salt, 1000);
  const { encryptBytes, decryptBytes } = await import('../../app/lib/vault.js');
  const ct = await encryptBytes(k1, new TextEncoder().encode('hello'));
  assert.equal(new TextDecoder().decode(await decryptBytes(k2, ct)), 'hello');
});
