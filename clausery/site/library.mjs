// Free template library: one page per shipped sample, generated from the real .docx so the question list always matches
// what the app asks. Each page offers the Word template download and a one-click "fill it in your browser" deep link.
import { readFileSync } from 'node:fs';
import { inspectDocx } from '../app/lib/render.js';
import { inferQuestionnaire, FIELD_TYPES } from '../app/lib/schema.js';
import { esc } from '../tools/partials.mjs';

const LIB = [
  { slug: 'mutual-nda', file: 'mutual-nda.docx', name: 'Mutual NDA', title: 'Free mutual NDA template (Word)', category: 'Legal',
    intro: 'A two-way non-disclosure agreement for when both sides will share confidential information: partnership talks, M&A conversations, joint ventures, vendor evaluations.',
    who: 'Founders, in-house counsel and law firms who send NDAs every week and are tired of editing party names by hand.',
    clauses: ['Parties, entity types and short names', 'Purpose of the disclosure', 'Definition of confidential information, with optional standard carve-outs', 'Use and protection obligations', 'Term and survival period', 'Governing law, with optional exclusive jurisdiction', 'Notices, with optional email copies', 'Signature blocks'],
    faq: [['Is a mutual NDA different from a one-way NDA?', 'Yes. A mutual NDA protects information flowing in both directions. Use a one-way NDA when only one party discloses.'], ['Can I change the clauses?', 'Yes. Download the Word file, edit any wording you like, keep the {tags}, and upload it to Clausery. Your formatting is kept exactly.']] },
  { slug: 'engagement-letter', file: 'engagement-letter.docx', name: 'Engagement letter', title: 'Free law firm engagement letter template (Word)', category: 'Legal',
    intro: 'An engagement letter that sets out scope, the team, fees and billing for a new matter. It supports hourly or flat fees, an optional retainer, and a list of attorneys with their rates.',
    who: 'Solo practitioners and small firms who open new matters every week.',
    clauses: ['Client and matter details', 'Scope of the engagement', 'Team: any number of attorneys with role and hourly rate', 'Hourly or flat fee', 'Optional advance fee deposit held in trust', 'Costs, billing and payment terms', 'Termination', 'Client acceptance block'],
    faq: [['Does this meet my state bar\'s requirements?', 'It is a general sample. Rules on engagement letters, fees and trust accounts vary by jurisdiction; adapt the wording to your rules before use.'], ['Can I list more than one attorney?', 'Yes. The attorney list repeats for as many people as you add, each with a role and rate.']] },
  { slug: 'offer-letter', file: 'offer-letter.docx', name: 'Offer letter', title: 'Free job offer letter template (Word)', category: 'HR',
    intro: 'A job offer letter with remote or office variants, salary, optional bonus and equity, a benefits list and offer conditions.',
    who: 'HR teams, recruiters and founders hiring without an HR system.',
    clauses: ['Role, manager and location (remote or office)', 'Start date', 'Base salary', 'Optional bonus target', 'Optional equity grant with vesting', 'Benefits list and paid time off', 'Conditions such as a background check', 'Acceptance block'],
    faq: [['Is this an employment contract?', 'No. It is an offer letter. Employment terms, at-will language and required notices depend on your country and state.'], ['Can I reuse it for every hire?', 'Yes. Answer the questions for each candidate and download a finished letter in seconds; every draft is kept for later.']] },
  { slug: 'independent-contractor-agreement', file: 'independent-contractor-agreement.docx', name: 'Independent contractor agreement', title: 'Free independent contractor agreement template (Word)', category: 'Business',
    intro: 'A contractor agreement covering services, hourly or fixed fees, invoicing, independent status, ownership of work product, confidentiality and termination.',
    who: 'Businesses hiring freelancers, and freelancers who want their own paper.',
    clauses: ['Parties and services', 'Start date and optional end date', 'Hourly rate with optional monthly cap, or a fixed fee', 'Invoicing and expenses', 'Independent contractor status', 'Who owns the work product', 'Confidentiality', 'Termination and governing law'],
    faq: [['Does this decide whether someone is legally a contractor?', 'No. Classification depends on how the work is actually done under your local law, not on the contract wording alone.'], ['Can the contractor keep ownership of their work?', 'Yes. One question switches between assignment to the client and a licence to the client.']] },
  { slug: 'statement-of-work', file: 'statement-of-work.docx', name: 'Statement of work', title: 'Free statement of work (SOW) template (Word)', category: 'Business',
    intro: 'A statement of work with a list of deliverables and due dates, a timeline, fixed-price or time-and-materials fees, assumptions and acceptance.',
    who: 'Agencies, consultants and IT service providers who write a SOW for every project.',
    clauses: ['Reference to the master agreement', 'Project summary', 'Deliverables: any number, each with a description and due date', 'Timeline', 'Fixed price or time and materials', 'Assumptions', 'Review and acceptance period', 'Sign-off'],
    faq: [['Do I need a master agreement?', 'This SOW refers to one. If you do not have a master services agreement, add the missing terms or use the contractor agreement template.'], ['Can I add a deliverables table?', 'Yes. In Word, put the loop tags in a table row and the row repeats for each deliverable.']] },
  { slug: 'employment-verification-letter', file: 'employment-verification-letter.docx', name: 'Employment verification letter', title: 'Free employment verification letter template (Word)', category: 'HR',
    intro: 'A letter confirming that someone works, or used to work, for your company, with their job title, dates and employment type, and optionally their salary.',
    who: 'HR and office managers answering requests from landlords, lenders and visa applications.',
    clauses: ['Current or former employee wording', 'Job title and dates', 'Full-time, part-time or other employment type', 'Optional salary line', 'Optional purpose of the letter', 'Contact for further verification', 'Signature'],
    faq: [['Should I include salary?', 'Only with the employee\'s consent and where local law allows it. The salary line is optional.'], ['Does it work for former employees?', 'Yes. One question switches the wording to past tense and asks for an end date.']] },
  { slug: 'payment-demand-letter', file: 'payment-demand-letter.docx', name: 'Payment demand letter', title: 'Free payment demand letter template (Word)', category: 'Finance',
    intro: 'A firm but polite letter asking a customer to pay an overdue balance by a deadline, with optional invoice number, interest and next steps.',
    who: 'Small businesses, freelancers and bookkeepers chasing late invoices.',
    clauses: ['Debtor details and amount due', 'What the payment was for and when it was due', 'Pay-by date and payment instructions', 'Optional interest', 'Invitation to dispute or agree a payment plan', 'Optional next steps'],
    faq: [['Is this a formal letter before action?', 'No. Some courts require specific pre-action steps and wording; check your local rules before starting proceedings.'], ['Can I send it by email?', 'Yes. Download the Word file or print it to PDF and attach it.']] },
];

function questionsFor(file) {
  const q = inferQuestionnaire(inspectDocx(readFileSync(new URL(`../samples/${file}`, import.meta.url))));
  const kind = (f) => (f.role === 'condition' && f.type === 'checkbox' ? 'Yes / no' : FIELD_TYPES[f.type].label);
  return q.fields.map((f) => ({ label: f.label, kind: kind(f), when: f.showIf, children: (f.children || []).map((c) => c.label) }));
}

const faqLd = (faq) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })}</script>`;
const crumbsLd = (items) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: 'https://bodyatlas.github.io/clausery/' + url })) })}</script>`;
const COMMON_FAQ = [
  ['Is it really free?', 'Yes. The template download is free, and the Clausery app is free for up to three templates with unlimited documents. No account or card is needed.'],
  ['Is my information uploaded anywhere?', 'No. Clausery runs entirely in your browser. Your answers and the finished document are created and stored on your own device.'],
  ['Is this legal advice?', 'No. These are general samples. Laws differ between countries and states, so have the wording reviewed for your situation before you rely on it.'],
];

export const pages = [
  {
    path: 'templates/', title: 'Free Word document templates',
    description: 'Free Word (.docx) templates for NDAs, engagement letters, offer letters, contractor agreements, statements of work and more. Fill them in your browser; nothing is uploaded.',
    extraHead: crumbsLd([['Home', ''], ['Templates', 'templates/']]),
    body: (rel) => `
<section class="section"><div class="wrap">
  <p class="eyebrow">Free template library</p>
  <h1>Free Word templates you can fill in without uploading anything</h1>
  <p class="lead">Download any template as a normal Word file, or fill it in right here: answer a few questions and get a finished .docx. Everything happens in your browser, so client and employee details never leave your computer.</p>
  <div class="grid grid-3" style="margin-top:2rem">
    ${LIB.map((t) => `<a class="feature" style="text-decoration:none;color:inherit" href="${rel}templates/${t.slug}.html"><span class="badge">${t.category}</span><h2 style="font-size:1.15rem;margin-top:.75rem">${esc(t.name)}</h2><p>${esc(t.intro)}</p></a>`).join('')}
  </div>
  <p class="small muted" style="margin-top:2rem">These are general samples, not legal advice. Have them reviewed for your jurisdiction before use.</p>
</div></section>`,
  },
  ...LIB.map((t) => {
    const qs = questionsFor(t.file);
    const faq = [...t.faq, ...COMMON_FAQ];
    return {
      path: `templates/${t.slug}.html`, title: t.title,
      description: `${t.intro} Download the free Word template or fill it in online in minutes. Nothing is uploaded.`.slice(0, 300),
      extraHead: faqLd(faq) + crumbsLd([['Home', ''], ['Templates', 'templates/'], [t.name, `templates/${t.slug}.html`]]),
      body: (rel) => `
<section class="section"><div class="wrap" style="max-width:52rem">
  <nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}templates/">Templates</a> › ${esc(t.name)}</nav>
  <h1 style="margin-top:1rem">${esc(t.title)}</h1>
  <p class="lead">${esc(t.intro)}</p>
  <div class="actions" style="display:flex;gap:.75rem;flex-wrap:wrap;margin:1.5rem 0">
    <a class="btn btn-primary btn-lg" href="${rel}app/#/start/${t.slug}">Fill it in now, free</a>
    <a class="btn btn-lg" href="${rel}samples/${t.file}" download>Download the Word template</a>
  </div>
  <p class="small muted">No sign-up. Your answers stay in your browser. <strong>Who it is for:</strong> ${esc(t.who)}</p>

  <h2 style="margin-top:2.5rem">What is in the ${esc(t.name.toLowerCase())}</h2>
  <ul>${t.clauses.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>

  <h2 style="margin-top:2.5rem">The questions you answer</h2>
  <p>Clausery turns the template into a short questionnaire. Optional parts only appear when they apply.</p>
  <div class="table-wrap" tabindex="0"><table class="compare"><thead><tr><th scope="col">Question</th><th scope="col">Type</th><th scope="col">Asked when</th></tr></thead><tbody>
    ${qs.map((q) => `<tr><td>${esc(q.label)}${q.children.length ? `<div class="small muted">For each item: ${esc(q.children.join(', '))}</div>` : ''}</td><td>${esc(q.kind)}</td><td class="small">${q.when ? `<code>${esc(q.when)}</code>` : 'Always'}</td></tr>`).join('')}
  </tbody></table></div>

  <h2 style="margin-top:2.5rem">How to use it</h2>
  <ol class="steps" style="grid-template-columns:1fr">
    <li><h3>Open it</h3><p>Click <em>Fill it in now</em>. The template opens in Clausery with its questionnaire ready.</p></li>
    <li><h3>Answer the questions</h3><p>Work through the sections. Drafts save as you type, on your device.</p></li>
    <li><h3>Download the document</h3><p>Get a finished Word file with your formatting intact, or print it to PDF.</p></li>
  </ol>
  <p>Prefer to start from your own wording? Download the Word file, edit it, keep the <code>{tags}</code>, and upload it to Clausery. See the <a href="${rel}docs/templates.html">template syntax</a>.</p>

  <h2 style="margin-top:2.5rem">Questions</h2>
  <div class="faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>

  <h2 style="margin-top:2.5rem">More free templates</h2>
  <ul>${LIB.filter((x) => x.slug !== t.slug).map((x) => `<li><a href="${rel}templates/${x.slug}.html">${esc(x.name)}</a></li>`).join('')}</ul>
  <p class="small muted" style="margin-top:2rem">This template is a general sample and not legal advice. Laws vary by jurisdiction; have it reviewed before use.</p>
</div></section>`,
    };
  }),
];
