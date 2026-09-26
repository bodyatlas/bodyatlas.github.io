/* Builds minimal .docx files (body, header, footer, footnote) for engine tests, and reads text back out of rendered ones. */
import { PizZip } from '../../vendor/docs.js';
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const P = (text) => `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
export function makeDocx({ body = [], header = [], footer = [], footnote = [] } = {}) {
  const zip = new PizZip();
  const paras = (list) => list.map((x) => (x.startsWith('<w:p') ? x : P(x))).join('');
  let rels = '';
  let sect = '';
  let types = '';
  if (header.length) { rels += '<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'; sect += '<w:headerReference w:type="default" r:id="rIdH"/>'; types += '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'; zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${paras(header)}</w:hdr>`); }
  if (footer.length) { rels += '<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'; sect += '<w:footerReference w:type="default" r:id="rIdF"/>'; types += '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'; zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${paras(footer)}</w:ftr>`); }
  let bodyXml = paras(body);
  if (footnote.length) {
    rels += '<Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>';
    types += '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>';
    zip.file('word/footnotes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${NS}><w:footnote w:id="1">${paras(footnote)}</w:footnote></w:footnotes>`);
    bodyXml += '<w:p><w:r><w:t>See note</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>';
  }
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${types}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}<w:sectPr>${sect}</w:sectPr></w:body></w:document>`);
  return zip.generate({ type: 'nodebuffer' });
}
export function partText(blobOrBuf, file) { return new PizZip(blobOrBuf).file(file).asText().replace(/<[^>]+>/g, ''); }
export function paragraphs(blobOrBuf, file = 'word/document.xml') { const xml = new PizZip(blobOrBuf).file(file).asText(); return (xml.match(/<w:p(?:\s[^>]*[^/>])?>[\s\S]*?<\/w:p>/g) || []).map((p) => p.replace(/<[^>]+>/g, '')); }
