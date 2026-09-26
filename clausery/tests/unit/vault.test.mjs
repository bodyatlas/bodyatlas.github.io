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

// ---------------------------------------------------------------- Store + vault lifecycle (in-memory IndexedDB fake)
// Just enough of the IndexedDB API for store.js: requests resolve asynchronously, every transaction stages its
// writes and commits them on completion, and a failing request aborts the whole transaction.
function fakeIndexedDB() {
  const dbs = new Map();
  const later = (fn) => setTimeout(fn, 0);
  function transaction(db, names, mode) {
    const staged = new Map(); let pending = 0, failed = null, done = false;
    const tx = { mode, error: null, objectStore(name) {
      if (!staged.has(name)) staged.set(name, new Map(db.data.get(name)));
      const rows = staged.get(name);
      const op = (fn) => {
        pending++;
        const r = {};
        later(() => {
          try { if (failed) throw failed; r.result = fn(); r.onsuccess && r.onsuccess({ target: r }); }
          catch (e) { r.error = e; failed = e; tx.error = e; r.onerror && r.onerror({ target: r }); }
          pending--; settle();
        });
        return r;
      };
      return {
        put: (rec) => op(() => { if (db.failPut && db.failPut(name, rec)) throw new Error('QuotaExceededError (simulated)'); rows.set(rec.id, structuredClone(rec)); return rec.id; }),
        get: (id) => op(() => structuredClone(rows.get(id))),
        getAll: () => op(() => [...rows.values()].map((r) => structuredClone(r))),
        delete: (id) => op(() => { rows.delete(id); }),
        clear: () => op(() => { rows.clear(); }),
        count: () => op(() => rows.size),
      };
    } };
    function settle() { if (done || pending) return; done = true; if (failed) { tx.onabort && tx.onabort({ target: tx }); return; } for (const [n, rows] of staged) db.data.set(n, rows); tx.oncomplete && tx.oncomplete({ target: tx }); }
    later(settle);
    return tx;
  }
  return {
    dbs,
    open(name) {
      const r = {};
      later(() => {
        let db = dbs.get(name);
        if (!db) {
          db = { data: new Map(), failPut: null, objectStoreNames: { contains: (n) => db.data.has(n) }, createObjectStore: (n) => { db.data.set(n, new Map()); }, close() {}, transaction: (names, mode) => transaction(db, [].concat(names), mode) };
          dbs.set(name, db); r.result = db; r.onupgradeneeded && r.onupgradeneeded({ target: r });
        }
        r.result = db; r.onsuccess && r.onsuccess({ target: r });
      });
      return r;
    },
  };
}

async function freshStore() {
  const idb = fakeIndexedDB();
  globalThis.indexedDB = idb;
  const { Store } = await import('../../app/lib/store.js');
  const store = new Store('clausery-test-' + Math.random());
  await store.open();
  return { store, idb, db: idb.dbs.get(store.name) };
}
const rawRows = (db, name) => [...db.data.get(name).values()];

test('store refuses writes to encrypted stores while locked (never falls back to plaintext)', async () => {
  const { store, db } = await freshStore();
  const { meta, key } = await createVault('pass phrase ok');
  await store.put('drafts', { id: 'd1', title: 'plain' });
  await store.rekey(key, meta);
  assert.equal(store.locked, false);
  store.setKey(null);
  assert.equal(store.locked, true);
  await assert.rejects(store.put('drafts', { id: 'd2', title: 'SECRET' }), { name: 'LockedError' });
  await assert.rejects(store.delete('drafts', 'd1'), { name: 'LockedError' });
  await assert.rejects(store.clear('drafts'), { name: 'LockedError' });
  await assert.rejects(store.all('drafts'), { name: 'LockedError' });
  assert.ok(rawRows(db, 'drafts').every(isEncrypted));
  assert.equal(rawRows(db, 'drafts').length, 1);
  await store.setSetting('theme', 'dark');   // settings stay writable while locked
  store.setKey(key);
  assert.deepEqual((await store.all('drafts')).map((d) => d.title), ['plain']);
});

test('rekey commits ciphertext and vault metadata together and leaves everything readable when it fails', async () => {
  const { store, db } = await freshStore();
  const buf = new Uint8Array([80, 75, 3, 4]).buffer;
  for (let i = 0; i < 3; i++) { await store.put('templates', { id: 't' + i, name: 'T' + i }); await store.put('files', { id: 't' + i, bytes: buf }); await store.put('drafts', { id: 'd' + i, title: 'D' + i }); }
  const { meta, key } = await createVault('first pass phrase');

  // 1. WebCrypto fails half way through: nothing on disk changes, no key, no vault record
  const realEncrypt = globalThis.crypto.subtle.encrypt.bind(globalThis.crypto.subtle);
  let calls = 0;
  globalThis.crypto.subtle.encrypt = (...a) => { if (++calls === 5) return Promise.reject(new Error('simulated transient failure')); return realEncrypt(...a); };
  await assert.rejects(store.rekey(key, meta), /simulated/);
  globalThis.crypto.subtle.encrypt = realEncrypt;
  assert.equal(store.key, null); assert.equal(store.vaultMeta, null);
  for (const s of ['templates', 'files', 'drafts']) assert.ok(rawRows(db, s).every((r) => !isEncrypted(r)), s + ' untouched');
  assert.equal(await store.getSetting('vault'), null);

  // 2. the database rejects a write: the transaction aborts as a whole, the old state (plaintext, no vault) stays
  db.failPut = (name) => name === 'files';
  await assert.rejects(store.rekey(key, meta), /Quota/);
  db.failPut = null;
  assert.equal(store.key, null); assert.equal(store.vaultMeta, null);
  for (const s of ['templates', 'files', 'drafts']) { assert.equal(rawRows(db, s).length, 3); assert.ok(rawRows(db, s).every((r) => !isEncrypted(r)), s + ' untouched'); }
  assert.equal(await store.getSetting('vault'), null);
  assert.deepEqual((await store.all('templates')).map((t) => t.name), ['T0', 'T1', 'T2']);

  // 3. success: every record encrypted and the vault record written in the same transaction
  await store.rekey(key, meta);
  assert.equal(store.vaultMeta, meta);
  for (const s of ['templates', 'files', 'drafts']) assert.ok(rawRows(db, s).every(isEncrypted), s + ' encrypted');
  assert.deepEqual(await store.getSetting('vault'), meta);
  assert.deepEqual([...new Uint8Array((await store.get('files', 't1')).bytes)], [80, 75, 3, 4]);

  // 4. change passphrase: a failing commit keeps the OLD key and metadata consistent with the data
  const second = await createVault('second pass phrase');
  db.failPut = (name) => name === 'settings';
  await assert.rejects(store.rekey(second.key, second.meta), /Quota/);
  db.failPut = null;
  assert.equal(store.key, key); assert.deepEqual(store.vaultMeta, meta);
  assert.deepEqual(await store.getSetting('vault'), meta);
  assert.deepEqual((await store.all('drafts')).map((d) => d.title), ['D0', 'D1', 'D2']);
  await store.rekey(second.key, second.meta);
  assert.deepEqual(await store.getSetting('vault'), second.meta);
  assert.equal(await unlockVault(await store.getSetting('vault'), 'second pass phrase') !== null, true);
  assert.deepEqual((await store.all('drafts')).map((d) => d.title), ['D0', 'D1', 'D2']);

  // 5. turn off: plaintext again and the vault record removed in the same transaction
  await store.rekey(null, null);
  assert.equal(store.key, null); assert.equal(store.vaultMeta, null); assert.equal(store.locked, false);
  for (const s of ['templates', 'files', 'drafts']) assert.ok(rawRows(db, s).every((r) => !isEncrypted(r)), s + ' plaintext');
  assert.equal(await store.getSetting('vault'), null);
});

test('writes issued during a rekey wait for it and use the new key', async () => {
  const { store, db } = await freshStore();
  await store.put('drafts', { id: 'd1', title: 'one' });
  const { meta, key } = await createVault('pass phrase ok');
  const rekeying = store.rekey(key, meta);
  const write = store.put('drafts', { id: 'd2', title: 'two' });
  await Promise.all([rekeying, write]);
  assert.ok(rawRows(db, 'drafts').every(isEncrypted));
  assert.deepEqual((await store.all('drafts')).map((d) => d.title).sort(), ['one', 'two']);
});

test('store change listeners get a remote flag and a vault event from other tabs', async () => {
  const { store } = await freshStore();
  const seen = [];
  store.onChange((s, id, info) => seen.push([s, id, info.remote]));
  await store.put('drafts', { id: 'd1' });
  store.channel.onmessage({ data: { type: 'change', store: 'drafts', id: 'd9' } });
  store.channel.onmessage({ data: { type: 'vault' } });
  assert.deepEqual(seen, [['drafts', 'd1', false], ['drafts', 'd9', true], ['vault', null, true]]);
});
