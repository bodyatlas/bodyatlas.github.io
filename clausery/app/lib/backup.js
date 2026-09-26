/* Clausery backup and template packs: JSON files that carry the whole workspace (or a set of templates)
   between machines or into a firm's shared drive. The .docx bytes are stored as base64 inside the JSON. */
import { toB64, fromB64 } from './vault.js';
import { PizZip } from '../../vendor/docs.js';

/** Caps on a template document: a .docx is a zip, and a tiny file can inflate to gigabytes (a "zip bomb") that would
    freeze or crash the tab on every open. The central directory carries each entry's inflated size, so the check costs
    nothing and nothing is inflated. Real templates are far below these limits. */
export const DOCX_LIMITS = { file: 20 * 1024 * 1024, entry: 25 * 1024 * 1024, total: 100 * 1024 * 1024, entries: 2000 };
const mb = (n) => (n / 1048576).toFixed(n >= 10 * 1048576 ? 0 : 1);
export function checkDocxSize(bytes, label = 'This document') {
  const size = bytes.byteLength ?? bytes.length ?? 0;
  if (size > DOCX_LIMITS.file) throw new Error(`${label} is ${mb(size)} MB; a template can be at most ${mb(DOCX_LIMITS.file)} MB.`);
  let zip;
  try { zip = new PizZip(bytes); } catch { return; }   // not a zip: the caller's parser reports that with its own message
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  if (entries.length > DOCX_LIMITS.entries) throw new Error(`${label} contains ${entries.length} parts; a template can have at most ${DOCX_LIMITS.entries}.`);
  let total = 0;
  for (const e of entries) {
    const inflated = (e._data && e._data.uncompressedSize) || 0;
    if (inflated > DOCX_LIMITS.entry) throw new Error(`${label} has a part (${e.name}) that unpacks to ${mb(inflated)} MB; parts can be at most ${mb(DOCX_LIMITS.entry)} MB.`);
    total += inflated;
  }
  if (total > DOCX_LIMITS.total) throw new Error(`${label} unpacks to ${mb(total)} MB; a template can unpack to at most ${mb(DOCX_LIMITS.total)} MB.`);
}

export const WORKSPACE_FORMAT = 'clausery.workspace';
export const PACK_FORMAT = 'clausery.pack';
export const FORMAT_VERSION = 1;

export function encodeWorkspace({ templates, files, drafts, settings, appVersion }) {
  return {
    format: WORKSPACE_FORMAT, version: FORMAT_VERSION, app: appVersion, exportedAt: new Date().toISOString(),
    templates: templates.map((t) => ({ ...t, docx: encodeFile(files.find((f) => f.id === t.id)) })),
    drafts,
    settings: (settings || []).filter((s) => !['license', 'vault'].includes(s.id)),
  };
}

export function encodePack({ templates, files, appVersion, name }) {
  return {
    format: PACK_FORMAT, version: FORMAT_VERSION, app: appVersion, exportedAt: new Date().toISOString(), name: name || 'Template pack',
    templates: templates.map((t) => ({ ...t, docx: encodeFile(files.find((f) => f.id === t.id)) })),
  };
}

function encodeFile(f) { return f && f.bytes ? toB64(new Uint8Array(f.bytes)) : null; }

/** Parse and validate a backup or pack; returns { kind, templates, files, drafts, settings } or throws a friendly error. */
export function decodeBundle(json) {
  let data = json;
  if (typeof json === 'string') { try { data = JSON.parse(json); } catch { throw new Error('This file is not valid JSON.'); } }
  if (!data || typeof data !== 'object') throw new Error('This file is not a Clausery backup.');
  if (data.format !== WORKSPACE_FORMAT && data.format !== PACK_FORMAT) throw new Error('This file is not a Clausery backup or template pack.');
  if (typeof data.version !== 'number' || data.version > FORMAT_VERSION) throw new Error(`This file was made by a newer Clausery (format ${data.version}). Update the app to import it.`);
  if (!Array.isArray(data.templates)) throw new Error('The file contains no templates.');
  const templates = [], files = [];
  for (const t of data.templates) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('A template in the file is malformed.');
    const { docx, ...meta } = t;
    templates.push(meta);
    if (typeof docx === 'string' && docx) {
      if (docx.length > DOCX_LIMITS.file * 1.4) throw new Error(`The document of template "${t.name}" is larger than ${mb(DOCX_LIMITS.file)} MB.`);   // base64 is 4/3 of the bytes
      const bytes = fromB64(docx).buffer;
      checkDocxSize(bytes, `The document of template "${t.name}"`);
      files.push({ id: t.id, bytes });
    }
  }
  const drafts = Array.isArray(data.drafts) ? data.drafts.filter((d) => d && typeof d.id === 'string' && typeof d.templateId === 'string') : [];
  const settings = Array.isArray(data.settings) ? data.settings.filter((s) => s && typeof s.id === 'string' && !['license', 'vault'].includes(s.id)) : [];
  return { kind: data.format === PACK_FORMAT ? 'pack' : 'workspace', templates, files, drafts, settings, exportedAt: data.exportedAt, name: data.name };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

export function safeFilename(name, ext) {
  const base = String(name || 'document').normalize('NFKD').replace(/[^\w\s.-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'document';
  return ext ? `${base}.${ext}` : base;
}
