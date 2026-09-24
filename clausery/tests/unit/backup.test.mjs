import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWorkspace, encodePack, decodeBundle, safeFilename } from '../../app/lib/backup.js';

test('workspace export/import round-trips templates, files and drafts, but never license or vault settings', () => {
  const bytes = new Uint8Array([1, 2, 3, 250]).buffer;
  const json = encodeWorkspace({
    templates: [{ id: 't1', name: 'NDA', fields: [] }], files: [{ id: 't1', bytes }],
    drafts: [{ id: 'd1', templateId: 't1', answers: { a: 1 } }],
    settings: [{ id: 'theme', value: 'dark' }, { id: 'license', value: 'secret' }, { id: 'vault', value: {} }], appVersion: '1.0.0',
  });
  const back = decodeBundle(JSON.stringify(json));
  assert.equal(back.kind, 'workspace');
  assert.deepEqual(back.templates, [{ id: 't1', name: 'NDA', fields: [] }]);
  assert.deepEqual([...new Uint8Array(back.files[0].bytes)], [1, 2, 3, 250]);
  assert.equal(back.drafts.length, 1);
  assert.deepEqual(back.settings.map((s) => s.id), ['theme']);
});

test('template packs carry no drafts', () => {
  const back = decodeBundle(encodePack({ templates: [{ id: 't1', name: 'X' }], files: [], appVersion: '1', name: 'Firm pack' }));
  assert.equal(back.kind, 'pack');
  assert.equal(back.name, 'Firm pack');
  assert.equal(back.drafts.length, 0);
});

test('bad files are rejected with readable messages', () => {
  assert.throws(() => decodeBundle('nope'), /not valid JSON/);
  assert.throws(() => decodeBundle({ format: 'other' }), /not a Clausery backup/);
  assert.throws(() => decodeBundle({ format: 'clausery.workspace', version: 99, templates: [] }), /newer Clausery/);
  assert.throws(() => decodeBundle({ format: 'clausery.workspace', version: 1, templates: [{ id: 1 }] }), /malformed/);
});

test('safe filenames', () => {
  assert.equal(safeFilename('Acme / NDA: v2', 'docx'), 'Acme-NDA-v2.docx');
  assert.equal(safeFilename('', 'docx'), 'document.docx');
});
