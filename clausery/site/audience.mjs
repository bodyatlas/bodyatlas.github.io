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
  { slug: 'how-to-write-an-offer-letter', title: 'How to write a job offer letter (with a free template)',
    description: 'What to put in a job offer letter: role, start date, pay, bonus, equity, benefits, conditions and at-will wording, plus the mistakes that cause disputes later.',
    body: (rel) => `
<p class="lead">An offer letter turns a verbal "we'd love to have you" into something the candidate can accept. It should be short, clear and consistent with the contract and policies that follow it.</p>
<h2>What to include</h2>
<ol>
  <li><strong>The role.</strong> Job title, who they report to, and whether the job is full-time or part-time.</li>
  <li><strong>Where they will work.</strong> Office, hybrid or remote. If remote, say whether they must live in a particular country or state, which affects tax and employment law.</li>
  <li><strong>Start date.</strong> A specific date, or "on a date to be agreed" if it depends on a notice period.</li>
  <li><strong>Pay.</strong> Base salary or hourly rate, the pay period, and whether the role is exempt from overtime where that applies.</li>
  <li><strong>Variable pay.</strong> Bonus target and whether it is discretionary. Equity: number of options or units, vesting schedule and cliff, and that the grant is subject to board approval and the plan documents.</li>
  <li><strong>Benefits and time off.</strong> A short list, pointing to the plan documents rather than restating them.</li>
  <li><strong>Conditions.</strong> Background checks, references, right-to-work checks, signing a confidentiality and invention assignment agreement.</li>
  <li><strong>How to accept, and by when.</strong> An expiry date keeps the process moving.</li>
</ol>
<h2>Wording that causes problems later</h2>
<ul>
  <li><strong>Annual salary described as a guarantee.</strong> "Your salary will be $90,000 per year" can be read as a promise of a year's employment. Stating the pay period avoids that.</li>
  <li><strong>"Permanent position" or "job security".</strong> In the US these can undermine <a href="${rel}clauses/at-will-employment-clause.html">at-will employment</a>. Outside the US, the letter should mention notice and the full contract.</li>
  <li><strong>Equity promises without conditions.</strong> Always make grants subject to approval and the plan.</li>
  <li><strong>Terms that conflict with the employment contract.</strong> If a contract follows, say which document prevails.</li>
</ul>
<h2>Restrictive covenants</h2>
<p>If the job comes with a <a href="${rel}clauses/non-compete-clause.html">non-compete</a> or <a href="${rel}clauses/non-solicitation-clause.html">non-solicitation</a> restriction, mention it in the offer letter. Several US states require candidates to be told before they accept, and some ban non-competes for employees altogether.</p>
<h2>Write it once, reuse it for every hire</h2>
<p>The free <a href="${rel}templates/offer-letter.html">offer letter template</a> already handles remote or office wording, optional bonus and equity, a benefits list and conditions. Open it in Clausery, answer the questions for each candidate and download a finished Word letter. Candidate details stay on your computer. For interns, use the <a href="${rel}templates/internship-offer-letter.html">internship offer letter</a>.</p>
<p class="small muted">General information, not legal advice. Employment law varies by country and state.</p>` },
  { slug: 'how-to-write-a-payment-demand-letter', title: 'How to write a demand letter for unpaid invoices',
    description: 'A step-by-step guide to asking a customer for overdue payment in writing: what to include, tone, deadlines, interest, and what to do if they still do not pay.',
    body: (rel) => `
<p class="lead">Most late invoices are paid after a clear, polite letter with a firm deadline. Here is how to write one that gets paid without damaging the relationship.</p>
<h2>Before you write</h2>
<ul>
  <li>Check the contract or terms for the <a href="${rel}clauses/payment-terms-clause.html">payment terms</a> and any <a href="${rel}clauses/late-payment-interest-clause.html">late payment interest</a> clause.</li>
  <li>Gather the invoice numbers, dates, amounts and any partial payments.</li>
  <li>Check the <a href="${rel}clauses/notices-clause.html">notices clause</a> for how formal notices must be sent.</li>
</ul>
<h2>What the letter should say</h2>
<ol>
  <li><strong>Who owes what.</strong> The customer's legal name, the amount outstanding, and the invoices it relates to.</li>
  <li><strong>What it was for and when it was due.</strong> One sentence each.</li>
  <li><strong>A deadline.</strong> Seven to fourteen days is common. Use the free <a href="${rel}free-tools/deadline-calculator.html">deadline calculator</a> to get the exact date.</li>
  <li><strong>How to pay.</strong> Bank details or a payment link, and a reference to quote.</li>
  <li><strong>Interest, if the contract allows it.</strong> In the UK, businesses can also claim statutory interest on late commercial payments.</li>
  <li><strong>An invitation to talk.</strong> If they dispute the invoice or need a payment plan, ask them to say so before the deadline.</li>
  <li><strong>What happens next.</strong> Collection, suspension of services or legal proceedings. Only mention steps you are prepared to take.</li>
</ol>
<h2>Tone</h2>
<p>Stay factual. Threats you do not intend to carry out, or statements about the customer's honesty, can backfire and in some cases break debt collection rules. Consumer debts are regulated more strictly than business debts in most countries.</p>
<h2>If they still do not pay</h2>
<p>Many courts expect a formal pre-action letter before a claim is issued, and some prescribe what it must contain. Small claims courts are designed for business debts without lawyers. Check your local rules before starting proceedings.</p>
<h2>Use the free template</h2>
<p>The <a href="${rel}templates/payment-demand-letter.html">payment demand letter template</a> includes optional invoice numbers, interest and next steps. Fill it in online and download a Word letter in a couple of minutes, without uploading customer details anywhere. For amounts in words, try the <a href="${rel}free-tools/amount-in-words.html">amount in words converter</a>.</p>
<p class="small muted">General information, not legal advice. Debt collection and pre-action rules vary by jurisdiction.</p>` },
  { slug: 'what-to-include-in-a-statement-of-work', title: 'What to include in a statement of work (SOW)',
    description: 'The sections every statement of work needs: scope, deliverables, timeline, fees, assumptions, acceptance and change control, with examples of what goes wrong when they are missing.',
    body: (rel) => `
<p class="lead">A statement of work describes one project under a master agreement. It is where most project disputes start, usually because something was vague. These sections prevent that.</p>
<h2>1. Reference to the master agreement</h2>
<p>Name the master services or consulting agreement the SOW sits under, and say which document wins if they conflict. Legal terms such as <a href="${rel}clauses/limitation-of-liability-clause.html">liability</a> and <a href="${rel}clauses/intellectual-property-clause.html">intellectual property</a> belong in the master agreement, not in each SOW.</p>
<h2>2. Scope and objectives</h2>
<p>What the project is for, and what is out of scope. An explicit "out of scope" list is the cheapest protection against scope creep.</p>
<h2>3. Deliverables</h2>
<p>Each deliverable with a description specific enough to test: "a responsive five-page website with a contact form", not "a website". Add a due date for each.</p>
<h2>4. Timeline and milestones</h2>
<p>Key dates, and which ones depend on the client providing content, access or feedback.</p>
<h2>5. Fees and payment</h2>
<p>Fixed price with a payment schedule tied to milestones, or time and materials with rates and an estimate or cap. Include expenses and <a href="${rel}clauses/payment-terms-clause.html">payment terms</a>.</p>
<h2>6. Assumptions and client responsibilities</h2>
<p>What the price assumes: number of revision rounds, access to systems, response times for feedback. When an assumption proves wrong, it becomes the basis for a change request.</p>
<h2>7. Acceptance</h2>
<p>How deliverables are reviewed, how long the client has, and what happens if they do not respond. "Deemed accepted after ten business days" avoids projects that never formally finish.</p>
<h2>8. Change control</h2>
<p>How changes are requested, priced and approved in writing. See the <a href="${rel}clauses/amendment-clause.html">amendment clause</a>.</p>
<h2>Write SOWs in minutes</h2>
<p>The free <a href="${rel}templates/statement-of-work.html">statement of work template</a> lists any number of deliverables with due dates, switches between fixed price and time and materials, and includes assumptions and acceptance. Answer the questions in Clausery and download a finished Word SOW. For the master terms, start with the <a href="${rel}templates/service-agreement.html">service agreement</a> or <a href="${rel}templates/consulting-agreement.html">consulting agreement</a>.</p>` },
  { slug: 'what-to-include-in-an-nda', title: 'What to include in an NDA: a clause-by-clause checklist',
    description: 'The clauses a non-disclosure agreement needs, from the definition of confidential information to exclusions, term, return of information and governing law, and when to use a mutual or one-way NDA.',
    body: (rel) => `
<p class="lead">A non-disclosure agreement is short, but each clause does a specific job. Here is what to check before you send or sign one.</p>
<h2>Mutual or one-way?</h2>
<p>If only one side is sharing information, such as a founder pitching to an investor or a company briefing a contractor, a <a href="${rel}templates/one-way-nda.html">one-way NDA</a> is simpler. If both sides will share, as in partnership or acquisition talks, use a <a href="${rel}templates/mutual-nda.html">mutual NDA</a>.</p>
<h2>The clauses</h2>
<ol>
  <li><strong>Parties.</strong> Correct legal names and entity types. An NDA signed by the wrong group company may not protect the one that shares the information.</li>
  <li><strong>Purpose.</strong> What the information may be used for, described narrowly: "evaluating a possible distribution agreement", not "business purposes".</li>
  <li><strong>Definition of confidential information.</strong> Whether it covers only marked information or anything reasonably understood to be confidential. See the <a href="${rel}clauses/confidentiality-clause.html">confidentiality clause</a>.</li>
  <li><strong>Exclusions.</strong> Public information, information already known, information received from someone else, and independent development.</li>
  <li><strong>Obligations.</strong> Use only for the purpose, disclose only to people who need to know, and protect with reasonable care.</li>
  <li><strong>Compelled disclosure.</strong> What happens if a court or regulator requires disclosure.</li>
  <li><strong>Return or destruction.</strong> On request or when talks end, with an exception for automatic backups.</li>
  <li><strong>Term.</strong> How long the agreement lasts and how long the obligations <a href="${rel}clauses/survival-clause.html">survive</a> afterwards.</li>
  <li><strong>No licence and no obligation to proceed.</strong> Sharing information does not grant rights in it or commit anyone to a deal.</li>
  <li><strong>Remedies.</strong> Acknowledging that an injunction may be appropriate, since damages rarely fix a leak.</li>
  <li><strong>Governing law and jurisdiction.</strong> See the <a href="${rel}clauses/governing-law-clause.html">governing law clause</a>.</li>
</ol>
<h2>Things to avoid</h2>
<ul>
  <li>Non-solicitation or non-compete terms hidden in an NDA, which the other side may not expect.</li>
  <li>Clauses that stop someone reporting wrongdoing to a regulator, which are unenforceable in many places.</li>
  <li>An NDA that is later wiped out by the <a href="${rel}clauses/entire-agreement-clause.html">entire agreement clause</a> of the main contract.</li>
</ul>
<h2>Send one in two minutes</h2>
<p>Both NDA templates are free to download as Word files or fill in online. Clausery asks for the parties, purpose, term and governing law, includes the optional clauses you choose, and produces a finished document without uploading anything.</p>` },
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
    path: `guides/${g.slug}.html`, title: g.title, description: g.description, feed: true, published: '2026-09-26',
    extraHead: `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: '2026-09-26', author: { '@type': 'Organization', name: 'Clausery' } })}</script>`,
    body: (rel) => `<section class="section"><div class="wrap prose"><nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}guides/">Guides</a></nav><h1 style="margin-top:1rem">${esc(g.title)}</h1>${g.body(rel)}</div></section>`,
  })),
];
