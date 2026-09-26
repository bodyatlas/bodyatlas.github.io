// Pages for each buyer, and how-to guides that answer the searches those buyers make.
import { esc } from '../tools/partials.mjs';

const AUD = [
  { slug: 'law-firms', name: 'Law firms', title: 'Document automation for small law firms, without uploading client files',
    intro: 'Engagement letters, NDAs, demand letters, wills and leases: most firms draft the same documents every week from Word files that already exist. Clausery turns those files into questionnaires and assembles the finished document on the lawyer\'s own computer.',
    points: [['Confidentiality you can explain in one sentence', 'Client information is typed into the browser and the document is built there. It is never sent to Clausery or anyone else, so there is no vendor holding client data.'], ['Keep your precedents', 'Your Word templates keep their styles, numbering and letterhead. Add tags where details change; nothing is re-created in a new editor.'], ['Clients answer without a portal', 'Send a questionnaire as a single file. The client fills it in offline and returns an answers file you import into the draft.'], ['Encrypted on the device', 'Turn on a passphrase and everything stored in the browser is encrypted, with automatic locking when you step away.']],
    templates: ['engagement-letter', 'mutual-nda', 'one-way-nda', 'cease-and-desist-letter', 'promissory-note', 'payment-demand-letter'] },
  { slug: 'hr-teams', name: 'HR teams', title: 'Generate offer letters and HR documents in minutes, privately',
    intro: 'Offer letters, verification letters and contractor agreements contain salaries, addresses and personal data. Clausery produces them from your approved templates without putting that data in another cloud service.',
    points: [['Approved wording, every time', 'HR owns the template; managers answer questions. Optional clauses such as equity, bonus or relocation only appear when they apply.'], ['Personal data stays on the device', 'Salary and personal details are never uploaded, which keeps your records of processing and vendor reviews simple.'], ['Share templates across the team', 'Export a template pack to your shared drive; colleagues import it and draft from the same approved version.'], ['No per-document fees', 'Generate as many letters as you need on every plan.']],
    templates: ['offer-letter', 'internship-offer-letter', 'salary-increase-letter', 'employment-verification-letter', 'reference-letter', 'employment-termination-letter', 'independent-contractor-agreement'] },
  { slug: 'consultants', name: 'Consultants and agencies', title: 'Proposals, SOWs and contractor agreements without another subscription',
    intro: 'Statements of work, contractor agreements and client letters follow the same pattern every time. Clausery turns your Word versions into a two-minute questionnaire and keeps client details on your laptop.',
    points: [['Repeat deliverables and line items', 'List as many deliverables, milestones or fee lines as you need; the document repeats the paragraph or table row for each one.'], ['Totals calculated for you', 'Add computed fields such as a sum of line items, a date 30 days after signing, or an amount in words.'], ['Works on the road', 'Once loaded, Clausery works offline, including on a train or a client site without Wi-Fi.'], ['Your branding, untouched', 'Your template keeps its logo, fonts and layout.']],
    templates: ['consulting-agreement', 'statement-of-work', 'service-agreement', 'independent-contractor-agreement', 'payment-demand-letter'] },
];
const NAMES = { 'one-way-nda': 'One-way NDA', 'cease-and-desist-letter': 'Cease and desist letter', 'promissory-note': 'Promissory note', 'internship-offer-letter': 'Internship offer letter', 'salary-increase-letter': 'Salary increase letter', 'reference-letter': 'Reference letter', 'employment-termination-letter': 'Termination letter', 'consulting-agreement': 'Consulting agreement', 'service-agreement': 'Service agreement', 'engagement-letter': 'Engagement letter', 'mutual-nda': 'Mutual NDA', 'payment-demand-letter': 'Payment demand letter', 'offer-letter': 'Offer letter', 'employment-verification-letter': 'Employment verification letter', 'independent-contractor-agreement': 'Independent contractor agreement', 'statement-of-work': 'Statement of work' };

const GUIDES = [
  { slug: 'automate-word-templates', title: 'How to automate a Word template without uploading it anywhere',
    description: 'A step-by-step guide to turning any Word document into a reusable, fill-in-the-blanks template with questions, conditional clauses and lists, entirely in your browser.',
    body: (rel) => `
<p class="lead">If you copy last month's letter and hunt for every name and date to change, this guide is for you. It takes about ten minutes for your first template.</p>
<h2>1. Pick a document you draft often</h2>
<p>Start with something you produce at least weekly: an engagement letter, an NDA, an offer letter. Open your best recent version in Word.</p>
<h2>2. Replace the details that change with tags</h2>
<p>Select a detail that changes, such as the client's name, and type a tag in curly braces instead: <code>{client_name}</code>. Use the same tag everywhere the same detail appears. Use letters, digits and underscores, and choose descriptive names; Clausery guesses the question type from them, so <code>{start_date}</code> becomes a date picker and <code>{retainer_amount}</code> a money field.</p>
<pre><code>This Agreement is made on {effective_date} between {client_name} and {firm_name}.</code></pre>
<h2>3. Make optional paragraphs conditional</h2>
<p>Wrap text that only sometimes applies in a section: <code>{#has_retainer}</code> before it and <code>{/has_retainer}</code> after it. Clausery asks a yes/no question and removes the paragraph when the answer is no. For the opposite case, use <code>{^has_retainer}…{/has_retainer}</code>.</p>
<h2>4. Repeat lists</h2>
<p>For parties, attorneys, deliverables or line items, wrap one item in a loop: <code>{#attorneys}{name}, {role}{/attorneys}</code>. The questionnaire lets you add as many as you need. In a table, put the opening tag in the first cell of a row and the closing tag in the last cell.</p>
<h2>5. Save as .docx and drop it into Clausery</h2>
<p>Open <a href="${rel}app/">Clausery</a> and drop the file on the Templates page. Every tag becomes a question. Rename questions, add help text and group them into sections in the designer, then click <em>New draft</em>.</p>
<h2>6. Generate the document</h2>
<p>Answer the questions and download the finished .docx, or print to PDF. Your formatting is kept exactly, and nothing was uploaded at any point.</p>
<p>Want to see a finished example first? Open one of the <a href="${rel}templates/">free templates</a>, or read the full <a href="${rel}docs/templates.html">template syntax</a>.</p>` },
  { slug: 'conditional-clauses-in-word', title: 'Conditional clauses in Word: include or remove paragraphs automatically',
    description: 'How to make parts of a Word document appear only when they apply: yes/no sections, either/or wording, clauses based on amounts or dates, and removing empty lines.',
    body: (rel) => `
<p class="lead">Most contracts and letters have parts that only apply sometimes: a retainer, a guarantor, a bonus, a jurisdiction clause. Here is how to make Word documents include or drop those parts automatically.</p>
<h2>Yes/no sections</h2>
<pre><code>{#has_guarantor}
GUARANTEE
{guarantor_name} guarantees the tenant's obligations.
{/has_guarantor}</code></pre>
<p>Clausery asks "Has guarantor?" and removes the whole block, including its paragraphs, when the answer is no. Questions inside the block, such as the guarantor's name, are only asked when the answer is yes.</p>
<h2>Either/or wording</h2>
<pre><code>{#is_remote}This is a remote position.{/is_remote}{^is_remote}You will work from our {office} office.{/is_remote}</code></pre>
<p><code>{^…}</code> is the opposite of <code>{#…}</code>: it keeps its text when the answer is no.</p>
<h2>Clauses based on amounts, dates or choices</h2>
<p>A section does not have to be a yes/no question. In the designer, change the section's question to <em>Computed</em> and give it a rule such as <code>salary &gt; 100000</code>, <code>fee_type == "flat"</code> or <code>years_between(start_date, today()) &gt;= 5</code>. The clause appears when the rule is true. See <a href="${rel}docs/logic.html">logic and calculations</a> for everything the rules can do.</p>
<h2>Avoiding blank lines</h2>
<p>Put the opening and closing tags each on their own line, as in the examples above. Clausery then removes those lines along with the section, so the document never has gaps where a clause used to be.</p>
<p><a class="btn btn-primary" href="${rel}app/">Try it with your own document</a></p>` },
  { slug: 'client-intake-without-a-portal', title: 'Client intake without a portal: collect answers by email, privately',
    description: 'How to send clients a questionnaire they can fill in offline and return as a file, so you can generate documents from their answers without a client portal or account.',
    body: (rel) => `
<p class="lead">Client portals mean another login for the client and another system holding their data. Clausery takes a different route: the questionnaire travels as a file.</p>
<h2>How it works</h2>
<ol>
  <li>In any draft, open the review step and choose <em>Create client intake form</em>. You get a single HTML file that contains only the questions, with no document and no previous answers.</li>
  <li>Email it to the client, or share it the way you already share documents with them.</li>
  <li>The client double-clicks the file. It opens in their browser, works offline, validates their answers and lets them save progress.</li>
  <li>When finished they save an answers file and send it back. You import it into the draft and generate the document.</li>
</ol>
<h2>Why firms like it</h2>
<ul>
  <li>No accounts, passwords or portal invitations for clients.</li>
  <li>The form cannot send data anywhere; its security policy blocks all network access.</li>
  <li>Answers arrive as one tidy file instead of an email thread.</li>
</ul>
<p>Client intake forms are part of <a href="${rel}pricing/">Clausery Pro</a>. Read the <a href="${rel}docs/intake.html">intake documentation</a> for details.</p>` },

  { slug: 'mail-merge-vs-document-automation', title: 'Mail merge vs document automation: which one do you need?',
    description: 'Mail merge fills the same blanks from a spreadsheet; document automation also includes or removes clauses, repeats lists and calculates. How to tell which one your documents need.',
    body: (rel) => `
<p class="lead">Word's mail merge is free and already on your computer. For some documents it is all you need. For others it becomes a maze of copies and manual edits. Here is how to tell the difference.</p>
<h2>What mail merge does well</h2>
<p>Mail merge takes rows from a spreadsheet and fills the same blanks in the same document: a name, an address, an amount. It is ideal for the same letter to many people, such as a price-change notice to 300 customers.</p>
<h2>Where mail merge runs out</h2>
<ul>
  <li><strong>Optional clauses.</strong> A retainer paragraph that applies to some clients and not others means keeping two versions of the document, or deleting text by hand afterwards.</li>
  <li><strong>Lists of different lengths.</strong> One matter has one attorney, the next has four. Mail merge has no natural way to repeat a paragraph or a table row per item.</li>
  <li><strong>Either/or wording.</strong> "Remote" versus "based at our London office", or past versus present tense in a verification letter.</li>
  <li><strong>Calculations.</strong> Totals, dates 30 days after signing, amounts in words.</li>
  <li><strong>Guidance for the person filling it in.</strong> A spreadsheet column has no help text, no validation and no way to hide questions that do not apply.</li>
</ul>
<h2>What document automation adds</h2>
<p>Document automation turns a template into a questionnaire. Each answer can fill a blank, switch a clause on or off, repeat a block for each item in a list, or feed a calculation. The person drafting answers questions instead of editing a document, and the output is consistent every time.</p>
<h2>A quick test</h2>
<p>If every copy of your document has exactly the same paragraphs, use mail merge. If you ever delete, copy or rewrite paragraphs after merging, you need document automation.</p>
<h2>Trying it on your own document</h2>
<p>Clausery uses tags you type straight into Word, so your mail merge template is already most of the way there. Replace merge fields with tags like <code>{client_name}</code>, wrap optional paragraphs in <code>{#has_retainer}…{/has_retainer}</code>, and drop the file into <a href="${rel}app/">the app</a>. It is free for up to three templates and nothing is uploaded. The <a href="${rel}guides/automate-word-templates.html">step-by-step guide</a> walks through it.</p>` },
  { slug: 'repeating-lists-and-tables-in-word', title: 'Repeating lists and table rows in Word templates',
    description: 'How to make a Word template repeat a paragraph, bullet or table row for every party, attorney, deliverable or line item, with separators and numbering.',
    body: (rel) => `
<p class="lead">Contracts and letters often list things: parties, attorneys, deliverables, beneficiaries, line items. The number changes every time. Here is how to make a Word template handle any number of them.</p>
<h2>Repeat a paragraph or bullet</h2>
<pre><code>{#deliverables}
• {title}: {description}, due {due_date}
{/deliverables}</code></pre>
<p>Everything between <code>{#deliverables}</code> and <code>{/deliverables}</code> is written once per deliverable. In the questionnaire, the person drafting clicks <em>Add deliverable</em> as many times as needed, and each item has its own title, description and due date.</p>
<h2>Repeat a table row</h2>
<p>Put the opening tag at the start of the first cell of a row and the closing tag at the end of the last cell of the same row:</p>
<table><thead><tr><th>Item</th><th>Quantity</th><th>Price</th></tr></thead><tbody><tr><td><code>{#items}{name}</code></td><td><code>{qty}</code></td><td><code>{price}{/items}</code></td></tr></tbody></table>
<p>The whole row repeats, so the table grows with the list and keeps your borders and shading.</p>
<h2>Commas between names</h2>
<p>To write "Ann, Ben and Cara"-style lists, use the built-in <code>{_last}</code> marker, which is true on the final item:</p>
<pre><code>{#parties}{name}{^_last}, {/_last}{/parties}</code></pre>
<p><code>{_index}</code> gives the item number (1, 2, 3) and <code>{_count}</code> the total, which is useful for "Schedule {_index} of {_count}".</p>
<h2>Optional details inside an item</h2>
<p>Conditions work inside lists too: <code>{#attorneys}{name}{#is_partner}, Partner{/is_partner}{/attorneys}</code> asks a yes/no question for each attorney.</p>
<h2>Totals</h2>
<p>A computed field such as <code>sum(items.price)</code> adds up a column, and <code>count(items)</code> counts the rows. See <a href="${rel}docs/logic.html">logic and calculations</a>.</p>
<p>The free <a href="${rel}templates/statement-of-work.html">statement of work</a> and <a href="${rel}templates/engagement-letter.html">engagement letter</a> templates both use repeating lists, if you want a working example.</p>` },
  { slug: 'confidentiality-checklist-document-software', title: 'Choosing document software when client confidentiality matters: a checklist',
    description: 'Questions to ask before putting client or employee information into any document or drafting tool: where data is processed, who can access it, sub-processors, retention and exit.',
    body: (rel) => `
<p class="lead">Professional confidentiality duties and data protection law both expect you to know where client information goes when you use software. These are the questions worth asking any vendor, including us.</p>
<h2>Where is the data processed?</h2>
<ul>
  <li>Is the information you type sent to the vendor's servers, or processed on your own device?</li>
  <li>In which countries are those servers? Are there transfers outside your jurisdiction?</li>
  <li>Is it used to train AI models, or shared with an AI provider?</li>
</ul>
<h2>Who can access it?</h2>
<ul>
  <li>Can the vendor's staff read your documents? Under what circumstances?</li>
  <li>Which sub-processors (hosting, email, analytics, AI) receive it?</li>
  <li>What happens if the vendor receives a subpoena or suffers a breach?</li>
</ul>
<h2>How is it protected?</h2>
<ul>
  <li>Is data encrypted in transit and at rest? Who holds the keys?</li>
  <li>What independent assurance exists (for example SOC 2 or ISO 27001 reports)?</li>
  <li>How are user accounts protected (single sign-on, two-factor authentication)?</li>
</ul>
<h2>Retention and exit</h2>
<ul>
  <li>How long is data kept after you delete it or cancel?</li>
  <li>Can you export everything in an open format?</li>
  <li>Will your templates keep working if the vendor disappears?</li>
</ul>
<h2>How Clausery answers these</h2>
<p>Clausery was designed so that most of these questions have a short answer: documents are built in your browser and stored on your device, so there is no vendor server holding client data, no sub-processor for your content and nothing to breach on our side. Your templates are ordinary Word files and your data exports are plain JSON. The details, including what the web host can see, are in the <a href="${rel}docs/security.html">security overview</a> and the <a href="${rel}legal/dpa.html">data processing statement</a>.</p>
<p class="small muted">This checklist is general information, not legal advice. Your professional rules and data protection obligations depend on your jurisdiction.</p>` },
];

export const pages = [
  ...AUD.map((a) => ({
    path: `for/${a.slug}.html`, title: a.title, description: a.intro.slice(0, 290),
    body: (rel) => `<section class="hero"><div class="wrap" style="display:block;max-width:52rem">
  <p class="eyebrow">For ${esc(a.name.toLowerCase())}</p>
  <h1>${esc(a.title)}</h1>
  <p class="lead">${esc(a.intro)}</p>
  <div class="actions"><a class="btn btn-primary btn-lg" href="${rel}app/">Open Clausery, free</a><a class="btn btn-lg" href="${rel}templates/">Browse free templates</a></div>
</div></section>
<section class="section section-alt"><div class="wrap"><div class="grid grid-2">
  ${a.points.map(([h, p]) => `<div class="feature"><h2 style="font-size:1.15rem">${esc(h)}</h2><p>${esc(p)}</p></div>`).join('')}
</div></div></section>
<section class="section"><div class="wrap" style="max-width:52rem">
  <h2>Start from a free template</h2>
  <ul>${a.templates.map((s) => `<li><a href="${rel}templates/${s}.html">${esc(NAMES[s])}</a></li>`).join('')}</ul>
</div></section>`,
  })),
  { path: 'guides/', title: 'Guides', description: 'Practical guides to automating Word documents, conditional clauses and client intake, without uploading client data.',
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem"><h1>Guides</h1><ul>${GUIDES.map((g) => `<li><a href="${rel}guides/${g.slug}.html">${esc(g.title)}</a><div class="small muted">${esc(g.description)}</div></li>`).join('')}</ul></div></section>` },
  ...GUIDES.map((g) => ({
    path: `guides/${g.slug}.html`, title: g.title, description: g.description,
    extraHead: `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: '2026-09-26', author: { '@type': 'Organization', name: 'Clausery' } })}</script>`,
    body: (rel) => `<section class="section"><div class="wrap prose"><nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}guides/">Guides</a></nav><h1 style="margin-top:1rem">${esc(g.title)}</h1>${g.body(rel)}</div></section>`,
  })),
];
