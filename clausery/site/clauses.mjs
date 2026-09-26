// Clause library: one page per common contract clause (site/data/clauses.mjs) with a plain-English explanation,
// copyable sample wording, what to check, and the same clause with Clausery tags. Pages link to the free templates
// that use each clause, and template pages link back (site/library.mjs).
import { esc } from '../tools/partials.mjs';
import { CLAUSES, GROUPS } from './data/clauses.mjs';
import { LIB } from './library.mjs';

export const PUBLISHED = '2026-09-26';
const TPL = Object.fromEntries(LIB.map((t) => [t.slug, t.name]));
for (const c of CLAUSES) {
  if (!GROUPS.includes(c.group)) throw new Error(`${c.slug}: unknown group ${c.group}`);
  for (const s of c.templates) if (!TPL[s]) throw new Error(`${c.slug}: unknown template ${s}`);
}

const faqLd = (faq) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>`;
const crumbsLd = (items) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: 'https://bodyatlas.github.io/clausery/' + url })) })}</script>`;
const paras = (text) => text.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('');
const short = (c) => c.name.replace(/ clause$/, '');

// Which clauses a reader should expect in each kind of document, for the index page.
const BY_DOC = [
  ['NDA', ['confidentiality-clause', 'governing-law-clause', 'entire-agreement-clause', 'notices-clause', 'survival-clause', 'electronic-signature-clause']],
  ['Service or consulting agreement', ['payment-terms-clause', 'late-payment-interest-clause', 'warranty-clause', 'limitation-of-liability-clause', 'indemnification-clause', 'intellectual-property-clause', 'termination-for-convenience-clause', 'termination-for-cause-clause', 'force-majeure-clause', 'dispute-resolution-clause', 'governing-law-clause']],
  ['Contractor agreement', ['independent-contractor-clause', 'intellectual-property-clause', 'confidentiality-clause', 'non-solicitation-clause', 'payment-terms-clause', 'termination-for-convenience-clause']],
  ['Offer letter or employment contract', ['at-will-employment-clause', 'confidentiality-clause', 'intellectual-property-clause', 'non-solicitation-clause', 'non-compete-clause']],
];
const BY_SLUG = Object.fromEntries(CLAUSES.map((c) => [c.slug, c]));
for (const [, list] of BY_DOC) for (const s of list) if (!BY_SLUG[s]) throw new Error(`clause index: unknown clause ${s}`);

const COPY_CSS = `<style>
.clause-box { position: relative; background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: var(--radius-sm); padding: 1.25rem 1.25rem .5rem; margin: 1rem 0; font-family: Georgia, "Times New Roman", serif; }
.clause-box p { margin: 0 0 1rem; }
.clause-tools { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.check-list { list-style: none; padding: 0; } .check-list li { border-bottom: 1px solid var(--border); padding: .9rem 0; } .check-list strong { display: block; margin-bottom: .25rem; }
</style>`;

export const pages = [
  {
    path: 'clauses/', title: 'Contract clause library: sample wording explained',
    description: `Plain-English explanations and free sample wording for ${CLAUSES.length} common contract clauses: indemnity, limitation of liability, force majeure, confidentiality, non-compete, termination and more.`,
    extraHead: crumbsLd([['Home', ''], ['Clause library', 'clauses/']]),
    body: (rel) => `
<section class="section"><div class="wrap" style="max-width:60rem">
  <nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › Clause library</nav>
  <p class="eyebrow" style="margin-top:1rem">Free clause library</p>
  <h1>Contract clauses, explained in plain English</h1>
  <p class="lead">What each clause does, sample wording you can copy, the points worth negotiating, and how to make the variable parts fill themselves in. ${CLAUSES.length} clauses, free, with no sign-up.</p>
  ${GROUPS.map((g) => `<h2 style="margin-top:2.5rem">${esc(g)}</h2>
  <div class="grid grid-3">${CLAUSES.filter((c) => c.group === g).map((c) => `<a class="feature" style="text-decoration:none;color:inherit" href="${rel}clauses/${c.slug}.html"><h3 style="font-size:1.05rem">${esc(c.name)}</h3><p class="small">${esc(c.what.split('. ')[0].replace(/\.$/, ''))}.</p></a>`).join('')}</div>`).join('')}

  <h2 style="margin-top:3rem">Which clauses does my document need?</h2>
  <p>A starting point for the most common documents. Every deal is different, so treat this as a checklist, not a rule.</p>
  <div class="table-wrap" tabindex="0"><table class="compare"><thead><tr><th scope="col">Document</th><th scope="col">Clauses to expect</th></tr></thead><tbody>
    ${BY_DOC.map(([doc, list]) => `<tr><th scope="row">${esc(doc)}</th><td>${list.map((s) => `<a href="${rel}clauses/${s}.html">${esc(short(BY_SLUG[s]))}</a>`).join(', ')}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="small muted" style="margin-top:2rem">This library is general information, not legal advice. Laws differ between countries and states; have wording reviewed for your situation before you rely on it.</p>
</div></section>`,
  },
  ...CLAUSES.map((c) => {
    const faq = [...c.faq, ['Can I use this sample wording as it is?', 'It is a general starting point. Contract law differs between countries and states, and the right wording depends on the deal, so have it reviewed before you rely on it.']];
    const related = CLAUSES.filter((x) => x.group === c.group && x.slug !== c.slug);
    return {
      path: `clauses/${c.slug}.html`, title: `${c.name}: meaning and sample wording`, feed: true, published: PUBLISHED,
      description: `${c.what.split('. ')[0].replace(/\.$/, '')}. Free sample ${c.name.toLowerCase()} wording, what to check, and FAQs.`.slice(0, 300),
      extraHead: COPY_CSS + faqLd(faq) + crumbsLd([['Home', ''], ['Clause library', 'clauses/'], [c.name, `clauses/${c.slug}.html`]]),
      body: (rel) => `
<section class="section"><div class="wrap prose">
  <nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}clauses/">Clause library</a> › ${esc(c.name)}</nav>
  <p class="eyebrow" style="margin-top:1rem">${esc(c.group)}</p>
  <h1>${esc(c.name)}: meaning and sample wording</h1>
  <p class="lead">${esc(c.what)}</p>

  <h2>When to use it</h2>
  <p>${esc(c.when)}</p>

  <h2>Sample ${esc(c.name.toLowerCase())}</h2>
  <div class="clause-box" id="clause-text">${paras(c.sample)}</div>
  <div class="clause-tools"><button class="btn copy-btn" type="button" data-copy="clause-text">Copy the clause</button><span class="small muted copy-status" role="status"></span></div>

  <h2>What to check</h2>
  <ul class="check-list">${c.points.map(([h, p]) => `<li><strong>${esc(h)}</strong>${esc(p)}</li>`).join('')}</ul>
${c.auto ? `
  <h2>Make the variable parts fill themselves in</h2>
  <p>In a Word template, replace the details that change with <code>{tags}</code> and wrap optional wording in a section. <a href="${rel}">Clausery</a> turns them into questions, so each document only includes the parts that apply:</p>
  <pre><code>${esc(c.auto)}</code></pre>
  <p class="small">Paste this into your own template, then check it with the free <a href="${rel}free-tools/template-checker.html">template tag checker</a> or read the <a href="${rel}docs/templates.html">template syntax</a>.</p>` : ''}

  <h2>Questions</h2>
  <div class="faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>

  <h2>Free templates that use it</h2>
  <ul>${c.templates.map((s) => `<li><a href="${rel}templates/${s}.html">${esc(TPL[s])}</a></li>`).join('')}</ul>
${related.length ? `
  <h2>Related clauses</h2>
  <ul>${related.map((x) => `<li><a href="${rel}clauses/${x.slug}.html">${esc(x.name)}</a></li>`).join('')}</ul>` : ''}

  <div class="feature" style="margin-top:2.5rem"><h2 style="font-size:1.15rem;margin-top:0">Stop editing contracts by hand</h2><p>Clausery turns your Word templates into short questionnaires and builds the finished document in your browser. Nothing is uploaded, and it is free for up to three templates.</p><p style="margin-top:1rem"><a class="btn btn-primary" href="${rel}app/">Open Clausery</a> <a class="btn" href="${rel}templates/">Free templates</a></p></div>
  <p class="small muted" style="margin-top:2rem">This page is general information, not legal advice. Laws differ between countries and states; have wording reviewed for your situation before you rely on it.</p>
</div></section>`,
    };
  }),
];
