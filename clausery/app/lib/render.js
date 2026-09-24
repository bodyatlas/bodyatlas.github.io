/* Clausery render layer: everything that touches .docx bytes, built on the vendored engine (vendor/docs.js).
   - inspectDocx: list the template's tags (with nesting and inverted sections) and its plain text
   - renderDocx: fill a template with data and return the finished .docx as a Blob
   - previewDocx: render a .docx into an HTML container for on-screen preview and printing
   - describeTemplateError: turn docxtemplater's error objects into messages a template author can act on */
import { PizZip, Docxtemplater, InspectModule, renderAsync } from '../../vendor/docs.js';

const OPTIONS = { paragraphLoop: true, linebreaks: true };

function nullGetter(part) {
  if (!part.module) return '';          // a plain {tag} with no value renders as empty text
  if (part.module === 'rawxml') return '';
  return '';
}

export function inspectDocx(bytes) {
  const zip = new PizZip(bytes);
  const im = InspectModule();
  const doc = new Docxtemplater(zip, { ...OPTIONS, modules: [im], nullGetter });
  const structured = im.getStructuredTags();
  const order = [];      // document order, with the chain of enclosing sections for each tag
  const inverted = new Set();
  const walk = (parts, ancestors) => {
    for (const p of parts) {
      if (p.type !== 'placeholder' || !p.value) continue;
      if (p.inverted) inverted.add(p.value);
      const parent = ancestors.length ? ancestors[ancestors.length - 1].key : null;
      order.push({ key: p.value, parent, ancestors, section: !!p.subparsed, inverted: !!p.inverted, lIndex: p.lIndex });
      if (p.subparsed) walk(p.subparsed, [...ancestors, { key: p.value, inverted: !!p.inverted }]);
    }
  };
  walk(structured, []);
  return { tags: im.getAllTags(), order, inverted: [...inverted], text: doc.getFullText() };
}

export function renderDocx(bytes, data) {
  const zip = new PizZip(bytes);
  const doc = new Docxtemplater(zip, { ...OPTIONS, nullGetter });
  doc.render(data);
  return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}

export async function previewDocx(blobOrBytes, container, styleContainer) {
  container.replaceChildren();
  await renderAsync(blobOrBytes, container, styleContainer || container, {
    className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, ignoreFonts: false,
    breakPages: true, ignoreLastRenderedPageBreak: true, experimental: true, trimXmlDeclaration: true,
    useBase64URL: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true, renderChanges: false, renderComments: false,
  });
}

/** Human explanations for docxtemplater template errors (unclosed tags, mismatched sections, etc.). */
export function describeTemplateError(err) {
  const props = err && err.properties;
  const list = props && Array.isArray(props.errors) ? props.errors : err ? [err] : [];
  const out = [];
  for (const e of list) {
    const p = e.properties || {};
    let msg;
    switch (p.id) {
      case 'unclosed_tag': msg = `The tag "${p.xtag}" is opened but never closed. Every {tag} needs a closing brace.`; break;
      case 'unopened_tag': msg = `A closing brace was found for "${p.xtag}" without an opening brace.`; break;
      case 'unclosed_loop': msg = `The section {#${p.xtag}} is never closed. Add {/${p.xtag}} where the section ends.`; break;
      case 'unopened_loop': msg = `{/${p.xtag}} closes a section that was never opened. Add {#${p.xtag}} where it starts.`; break;
      case 'closing_tag_does_not_match_opening_tag': msg = `Section tags do not match: {#${p.openingtag}} is closed by {/${p.closingtag}}.`; break;
      case 'duplicate_open_tag': msg = `Two opening braces in a row near "${p.xtag}". Use a single { to start a tag.`; break;
      case 'duplicate_close_tag': msg = `Two closing braces in a row near "${p.xtag}". Use a single } to end a tag.`; break;
      case 'no_xml_tag_found_at_left': case 'no_xml_tag_found_at_right': msg = `A raw XML tag {@${p.xtag}} is not inside a paragraph.`; break;
      case 'scopeparser_execution_failed': msg = `The tag "${p.tag}" could not be evaluated.`; break;
      default: msg = e.message || String(e);
    }
    const where = p.file && p.file !== 'word/document.xml' ? ` (in ${p.file})` : '';
    const ctx = p.context ? ` Context: "${String(p.context).slice(0, 80)}"` : '';
    out.push(msg + where + ctx);
  }
  return out.length ? [...new Set(out)] : ['The file could not be read as a Word template.'];
}

export function isDocxError(err) {
  return !!(err && (err.name === 'TemplateError' || err.name === 'RenderingError' || err.name === 'XTTemplateError' || (err.properties && err.properties.errors)));
}
