/* Clausery store: IndexedDB persistence with optional at-rest encryption (see vault.js).
   Object stores: templates (metadata), files (docx bytes by template id), drafts, settings (key/value).
   All reads/writes go through this module so encryption is transparent to the UI. */
import { encryptRecord, decryptRecord, isEncrypted } from './vault.js';

const DB_NAME = 'clausery';
const DB_VERSION = 1;
const STORES = ['templates', 'files', 'drafts', 'settings'];
const ENCRYPTED_STORES = new Set(['templates', 'files', 'drafts']);

export class Store {
  constructor(name = DB_NAME) {
    this.name = name; this.db = null; this.key = null; this.vaultMeta = null; this.listeners = new Set(); this.rekeying = null;
    // cross-tab sync: other tabs learn about writes and vault changes so they never keep a stale key
    this.channel = null;
    try {
      if (globalThis.BroadcastChannel) {
        this.channel = new globalThis.BroadcastChannel(name);
        this.channel.onmessage = (e) => { const m = e.data || {}; if (m.type === 'change') this.emit(m.store, m.id, { remote: true }); else if (m.type === 'vault') this.emit('vault', null, { remote: true }); };
        if (this.channel.unref) this.channel.unref();   // Node only (unit tests): do not keep the process alive
      }
    } catch { /* cross-tab sync is best effort */ }
  }

  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open the local database.'));
      req.onblocked = () => reject(new Error('The local database is open in another tab. Close it and reload.'));
    });
    this.db.onversionchange = () => { this.db.close(); this.db = null; };
    return this.db;
  }

  /** Set (or clear) the AES key used for encrypted stores. */
  setKey(key) { this.key = key || null; }
  get locked() { return !!this.vaultMeta && !this.key; }

  /** Listeners are called as fn(store, id, { remote }); remote changes come from another tab. */
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(store, id, info = { remote: false }) {
    for (const fn of this.listeners) { try { fn(store, id, info); } catch (e) { console.error(e); } }
    if (!info.remote) this.post({ type: 'change', store, id });
  }
  post(msg) { try { if (this.channel) this.channel.postMessage(msg); } catch { /* ignore */ } }

  tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  req(r) { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }

  async wrap(store, record) {
    if (!ENCRYPTED_STORES.has(store)) return record;
    if (this.locked) throw new LockedError();   // never fall back to plaintext in an encrypted workspace
    if (this.key) return { id: record.id, ...(await encryptRecord(this.key, record)) };
    return record;
  }
  /** Writes to encrypted stores are refused while locked and wait for a running rekey so they use the right key. */
  async writable(store) {
    await this.open();
    if (this.rekeying) await this.rekeying.catch(() => {});
    if (ENCRYPTED_STORES.has(store) && this.locked) throw new LockedError();
  }
  async unwrap(store, raw) {
    if (!raw) return raw;
    if (isEncrypted(raw)) {
      if (!this.key) throw new LockedError();
      return decryptRecord(this.key, raw);
    }
    return raw;
  }

  async get(store, id) { await this.open(); return this.unwrap(store, await this.req(this.tx(store).get(id))); }
  async all(store) {
    await this.open();
    const rows = await this.req(this.tx(store).getAll());
    const out = [];
    for (const r of rows) out.push(await this.unwrap(store, r));
    return out;
  }
  async put(store, record) {
    await this.writable(store);
    if (!record || !record.id) throw new Error('Records need an id.');
    await this.req(this.tx(store, 'readwrite').put(await this.wrap(store, record)));
    this.emit(store, record.id);
    return record;
  }
  async delete(store, id) { await this.writable(store); await this.req(this.tx(store, 'readwrite').delete(id)); this.emit(store, id); }
  async clear(store) { await this.writable(store); await this.req(this.tx(store, 'readwrite').clear()); this.emit(store, null); }
  async count(store) { await this.open(); return this.req(this.tx(store).count()); }

  // settings are small plaintext key/value pairs (theme, license, vault metadata, firm profile)
  async getSetting(key, fallback = null) { const r = await this.get('settings', key); return r ? r.value : fallback; }
  async setSetting(key, value) { return this.put('settings', { id: key, value }); }

  /** Re-encrypt (or decrypt, when newKey is null) every record in the encrypted stores and persist the matching
      vault metadata (null removes it) in ONE IndexedDB transaction, so ciphertext and salt/verifier can never
      disagree on disk and an interrupted run changes nothing. All crypto happens in memory before the transaction
      opens: a WebCrypto await inside a live transaction would let it auto-commit early. */
  async rekey(newKey, meta = null) {
    await this.open();
    if (this.rekeying) await this.rekeying;
    const run = async () => {
      const oldKey = this.key;
      const wrapped = {};
      for (const s of ENCRYPTED_STORES) {
        wrapped[s] = [];
        for (const rec of await this.all(s)) wrapped[s].push(newKey ? { id: rec.id, ...(await encryptRecord(newKey, rec)) } : rec);
      }
      this.key = newKey || null;   // writes queued behind this transaction must already use the new key
      try {
        const tx = this.db.transaction([...ENCRYPTED_STORES, 'settings'], 'readwrite');
        const done = new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('The local database rejected the change.'));
          tx.onabort = () => reject(tx.error || new Error('The local database change was aborted.'));
        });
        for (const s of ENCRYPTED_STORES) { const os = tx.objectStore(s); for (const rec of wrapped[s]) os.put(rec); }
        if (meta) tx.objectStore('settings').put({ id: 'vault', value: meta }); else tx.objectStore('settings').delete('vault');
        await done;
      } catch (e) { this.key = oldKey; throw e; }
      this.vaultMeta = meta || null;
    };
    this.rekeying = run();
    try { await this.rekeying; } finally { this.rekeying = null; }
    this.emit('*', null);
    this.post({ type: 'vault' });
  }

  /** Detect whether any stored record is encrypted (used when vault metadata is missing or inconsistent). */
  async hasEncryptedRecords() {
    await this.open();
    for (const s of ENCRYPTED_STORES) {
      const rows = await this.req(this.tx(s).getAll());
      if (rows.some(isEncrypted)) return true;
    }
    return false;
  }

  /** Recovery for encrypted records left without vault settings (no passphrase can ever open them): delete only those
      records, in one transaction, and keep every readable one. Returns how many were removed. */
  async dropEncryptedRecords() {
    await this.open();
    const stores = [...ENCRYPTED_STORES];
    const rows = {};
    for (const s of stores) rows[s] = (await this.req(this.tx(s).getAll())).filter(isEncrypted).map((r) => r.id);
    const tx = this.db.transaction(stores, 'readwrite');
    for (const s of stores) for (const id of rows[s]) tx.objectStore(s).delete(id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('aborted')); });
    this.emit('*', null);
    this.post({ type: 'vault' });
    return stores.reduce((n, s) => n + rows[s].length, 0);
  }

  async wipe() {
    await this.open();
    for (const s of STORES) await this.req(this.tx(s, 'readwrite').clear());
    this.emit('*', null);
    this.post({ type: 'vault' });
  }
}

export class LockedError extends Error { constructor() { super('The workspace is locked.'); this.name = 'LockedError'; } }

export async function estimateUsage() {
  try {
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; }
  } catch { /* ignore */ }
  return null;
}
export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return false;
}
