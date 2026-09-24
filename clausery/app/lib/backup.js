/* Clausery backup and template packs: JSON files that carry the whole workspace (or a set of templates)
   between machines or into a firm's shared drive. The .docx bytes are stored as base64 inside the JSON. */
import { toB64, fromB64 } from './vault.js';

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
    if (typeof docx === 'string' && docx) files.push({ id: t.id, bytes: fromB64(docx).buffer });
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
