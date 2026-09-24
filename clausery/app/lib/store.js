/* Clausery store: IndexedDB persistence with optional at-rest encryption (see vault.js).
   Object stores: templates (metadata), files (docx bytes by template id), drafts, settings (key/value).
   All reads/writes go through this module so encryption is transparent to the UI. */
import { encryptRecord, decryptRecord, isEncrypted } from './vault.js';

const DB_NAME = 'clausery';
const DB_VERSION = 1;
const STORES = ['templates', 'files', 'drafts', 'settings'];
const ENCRYPTED_STORES = new Set(['templates', 'files', 'drafts']);

export class Store {
  constructor(name = DB_NAME) { this.name = name; this.db = null; this.key = null; this.listeners = new Set(); }

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

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(store, id) { for (const fn of this.listeners) { try { fn(store, id); } catch (e) { console.error(e); } } }

  tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  req(r) { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }

  async wrap(store, record) {
    if (ENCRYPTED_STORES.has(store) && this.key) return { id: record.id, ...(await encryptRecord(this.key, record)) };
    return record;
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
    await this.open();
    if (!record || !record.id) throw new Error('Records need an id.');
    await this.req(this.tx(store, 'readwrite').put(await this.wrap(store, record)));
    this.emit(store, record.id);
    return record;
  }
  async delete(store, id) { await this.open(); await this.req(this.tx(store, 'readwrite').delete(id)); this.emit(store, id); }
  async clear(store) { await this.open(); await this.req(this.tx(store, 'readwrite').clear()); this.emit(store, null); }
  async count(store) { await this.open(); return this.req(this.tx(store).count()); }

  // settings are small plaintext key/value pairs (theme, license, vault metadata, firm profile)
  async getSetting(key, fallback = null) { const r = await this.get('settings', key); return r ? r.value : fallback; }
  async setSetting(key, value) { return this.put('settings', { id: key, value }); }

  /** Re-encrypt (or decrypt, when key is null) every record in the encrypted stores with a new key. */
  async rekey(newKey) {
    await this.open();
    const snapshot = {};
    for (const s of ENCRYPTED_STORES) snapshot[s] = await this.all(s);
    const oldKey = this.key;
    this.key = newKey;
    try {
      for (const s of ENCRYPTED_STORES) {
        const os = this.tx(s, 'readwrite');
        await this.req(os.clear());
        for (const rec of snapshot[s]) await this.req(os.put(await this.wrap(s, rec)));
      }
    } catch (e) { this.key = oldKey; throw e; }
    this.emit('*', null);
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

  async wipe() {
    await this.open();
    for (const s of STORES) await this.req(this.tx(s, 'readwrite').clear());
    this.emit('*', null);
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
