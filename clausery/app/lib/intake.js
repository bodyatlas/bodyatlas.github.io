/* Client intake forms: a self-contained HTML file with the questionnaire only. The client fills it in offline
   and saves an answers .json that the firm imports into a draft. Built from vendor/intake-runtime.js. */
import { coerce } from './logic.js';
import { blankRow } from './schema.js';

export async function buildIntakeHtml({ template, settings, intro, siteUrl, version }) {
  const runtime = await (await fetch(new URL('../../vendor/intake-runtime.js', import.meta.url))).text();
  const payload = {
    format: 'clausery.intake', version: 1, app: version, createdAt: new Date().toISOString(),
    template: { id: template.id, name: template.name, description: template.description, sections: template.sections, fields: template.fields },
    settings: { locale: settings.locale || '', currency: settings.currency || 'USD', dateFormat: settings.dateFormat || 'long', firmName: settings.firmName || '' },
    intro: intro || '', siteUrl: siteUrl || '',
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const title = `${template.name} · ${settings.firmName || 'Intake form'}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'">
<style>${INTAKE_CSS}</style>
</head>
<body>
<div id="intake"><noscript>This form needs JavaScript. Open it in a modern browser.</noscript></div>
<script id="clausery-intake-data" type="application/json">${json}</script>
<script>${runtime}</script>
<script>ClauseryIntake.mount(document.getElementById('intake'), document.getElementById('clausery-intake-data'));</script>
</body>
</html>`;
}

export function parseAnswersFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!data || data.format !== 'clausery.answers' || typeof data.answers !== 'object' || !data.answers || Array.isArray(data.answers)) throw new Error('This is not a Clausery answers file.');
  return { answers: data.answers, templateName: data.templateName || '', templateId: data.templateId || '' };
}

/** Pick the answers of a file that belong to this template, in the shape its fields expect (a hand-edited file may hold
    numbers, arrays or objects where a text is due). Returns the cleaned answers and how many fields they cover. */
export function sanitizeAnswers(template, raw) {
  const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const scalar = (f, v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'object') return undefined;
    if (typeof v === 'boolean' && f.type !== 'checkbox') return undefined;
    return coerce(f, v);
  };
  const out = {}; let n = 0;
  for (const f of template.fields || []) {
    if (f.type === 'computed' || !has(raw, f.key)) continue;
    const v = raw[f.key];
    if (f.type === 'repeat') {
      if (!Array.isArray(v)) continue;
      out[f.key] = v.filter((r) => r && typeof r === 'object' && !Array.isArray(r)).map((r) => { const row = blankRow(f); for (const c of f.children || []) { if (c.type === 'computed' || !has(r, c.key)) continue; const cv = scalar(c, r[c.key]); if (cv !== undefined) row[c.key] = cv; } return row; });
      n++;
    } else {
      const sv = scalar(f, v);
      if (sv === undefined) continue;
      out[f.key] = sv; n++;
    }
  }
  return { answers: out, count: n };
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export const INTAKE_CSS = `
:root{--bg:#f6f4ef;--surface:#fff;--surface-2:#f1eee7;--surface-3:#e8e4da;--text:#1b1f27;--muted:#5d6470;--border:#d9d4c8;--border-strong:#b9b2a2;--ink:#1b2a41;--accent:#0f766e;--accent-hover:#0b5f59;--accent-soft:#d8efe9;--accent-text:#fff;--danger:#b42318;--ok:#136b34;--ok-soft:#dcf5e3;--warn:#b45309;--warn-soft:#fef1dd;--focus:#2563eb;--radius:10px;--radius-sm:6px;--font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--mono:ui-monospace,Menlo,Consolas,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#0f1419;--surface:#171d25;--surface-2:#1f2731;--surface-3:#2a3340;--text:#e8ebef;--muted:#98a2b3;--border:#2e3846;--border-strong:#46526a;--accent:#2dd4bf;--accent-hover:#5eead4;--accent-soft:#123b39;--accent-text:#06201d;--danger:#f87171;--ok:#4ade80;--ok-soft:#0d3320;--warn:#fbbf24;--warn-soft:#3b2a08;--focus:#60a5fa}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 var(--font)}
.wrap{max-width:760px;margin:0 auto;padding:1.5rem 1rem 4rem}h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.15rem;margin:0 0 .75rem}p{margin:0 0 1em}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:1rem}
.muted{color:var(--muted)}.small{font-size:.875rem}.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 1rem}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem 1rem;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:inherit;font-weight:600;cursor:pointer}
.btn:hover{background:var(--surface-2)}.btn:disabled{opacity:.5;cursor:not-allowed}.btn-primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}.btn-primary:hover{background:var(--accent-hover)}.btn-sm{padding:.3rem .6rem;font-size:.85rem}.btn-ghost{background:transparent;border-color:transparent}.btn-icon{padding:.35rem}
.input,.select,.textarea{width:100%;padding:.5rem .65rem;border:1px solid var(--border-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font:inherit}.textarea{min-height:96px}
.input:focus,.select:focus,.textarea:focus{outline:2px solid var(--focus);outline-offset:0}.input[aria-invalid=true],.select[aria-invalid=true],.textarea[aria-invalid=true]{border-color:var(--danger)}
.field{display:block;margin-bottom:1rem}.field-label{display:block;font-weight:600;margin-bottom:.3rem}.req{color:var(--danger);margin-left:.2rem}.field-help{display:block;color:var(--muted);font-size:.85rem;margin-top:.3rem}.field-error{display:block;color:var(--danger);font-size:.85rem;margin-top:.3rem;font-weight:500}
.check{display:flex;align-items:flex-start;gap:.6rem;cursor:pointer}.check input{width:18px;height:18px;margin:.2rem 0 0;accent-color:var(--accent)}.radios{display:flex;flex-direction:column;gap:.4rem}
.input-money{display:flex}.input-money .prefix{display:flex;align-items:center;padding:0 .6rem;border:1px solid var(--border-strong);border-right:0;border-radius:var(--radius-sm) 0 0 var(--radius-sm);background:var(--surface-2);color:var(--muted)}.input-money .input{border-radius:0 var(--radius-sm) var(--radius-sm) 0}
fieldset{border:0;padding:0;margin:0;min-width:0}legend{font-weight:600;margin-bottom:.3rem;padding:0}
.repeat-group{border:1px solid var(--border);border-radius:var(--radius);padding:1rem;background:var(--surface-2);margin-bottom:1rem}.repeat-row{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-sm);padding:1rem 1rem .25rem;margin-bottom:.75rem}.repeat-row-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;font-weight:600}
.computed-value{padding:.5rem .65rem;background:var(--surface-2);border-radius:var(--radius-sm);font-family:var(--mono);font-size:.9rem;min-height:2.4em}
.notice{display:flex;gap:.6rem;padding:.75rem 1rem;border-radius:var(--radius-sm);background:var(--surface-2);border:1px solid var(--border);margin-bottom:1rem}.notice-ok{background:var(--ok-soft);color:var(--ok);border-color:transparent}.notice-warn{background:var(--warn-soft);color:var(--warn);border-color:transparent}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.icon{flex:none}.foot{text-align:center;color:var(--muted);font-size:.8rem;margin-top:2rem}.foot a{color:inherit}
.hidden{display:none!important}
`;
