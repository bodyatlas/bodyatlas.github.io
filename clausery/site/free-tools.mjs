// Free drafting tools: small utilities people search for (amount in words, deadline calculator, template checker).
// Each runs entirely in the page from an external module (strict CSP friendly) and points to Clausery for the full job.
const TOOL_CSS = `<style>
.tool { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; margin: 1.5rem 0; }
.tool label { display: block; font-weight: 600; margin-bottom: .3rem; }
.tool .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.tool input, .tool select, .tool textarea { width: 100%; padding: .55rem .65rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg); color: var(--text); font: inherit; }
.tool .out { font-size: 1.2rem; font-weight: 600; padding: 1rem; background: var(--accent-soft); color: var(--text); border-radius: var(--radius-sm); min-height: 3rem; }
.tool .out-row { display: flex; gap: .75rem; align-items: flex-start; margin-top: .75rem; } .tool .out-row .out { flex: 1; }
.tool .err, .bad { color: #b42318; } .ok { color: var(--ok); } .warn { color: var(--warn); }
#drop { border: 2px dashed var(--border-strong); border-radius: var(--radius); padding: 2rem; text-align: center; }
#drop.over { border-color: var(--accent); background: var(--accent-soft); }
#report table { width: 100%; border-collapse: collapse; font-size: .92rem; } #report th, #report td { text-align: left; padding: .5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
#report .small { font-size: .85rem; color: var(--muted); }
</style>`;
const crumbs = (rel, name) => `<nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}free-tools/">Free tools</a> › ${name}</nav>`;
const cta = (rel) => `<div class="feature" style="margin-top:2.5rem"><h2 style="font-size:1.15rem">Draft the whole document, not just one line</h2><p>Clausery turns your Word templates into questionnaires and builds the finished document in your browser, with amounts in words, dates and totals calculated for you. Free for up to three templates.</p><p style="margin-top:1rem"><a class="btn btn-primary" href="${rel}app/">Open Clausery</a> <a class="btn" href="${rel}templates/">Free templates</a></p></div>`;
const appLd = (name, desc, url) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name, description: desc, url: 'https://bodyatlas.github.io/clausery/' + url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } })}</script>`;

const TOOLS = [
  { slug: 'amount-in-words', name: 'Amount in words converter', desc: 'Write any amount in words for contracts, cheques and promissory notes, such as "One Thousand Two Hundred and Fifty Dollars and 50/100".' },
  { slug: 'deadline-calculator', name: 'Contract deadline calculator', desc: 'Add or subtract days, business days, weeks, months or years from a date, with month-end handling and your own holidays.' },
  { slug: 'template-checker', name: 'Word template tag checker', desc: 'Check a .docx template for broken {tags} and see the questionnaire it would produce. The file never leaves your computer.' },
];

export const pages = [
  { path: 'free-tools/', title: 'Free drafting tools', description: 'Free tools for people who draft documents: amount in words, contract deadline calculator and a Word template tag checker. They all run in your browser.',
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem"><h1>Free drafting tools</h1><p class="lead">Small tools for everyday drafting. They run entirely in your browser; nothing you type is sent anywhere.</p>
<div class="grid grid-3" style="margin-top:2rem">${TOOLS.map((t) => `<a class="feature" style="text-decoration:none;color:inherit" href="${rel}free-tools/${t.slug}.html"><h2 style="font-size:1.1rem">${t.name}</h2><p>${t.desc}</p></a>`).join('')}</div></div></section>` },

  { path: 'free-tools/amount-in-words.html', title: 'Amount in words converter for contracts and cheques', description: TOOLS[0].desc,
    extraHead: TOOL_CSS + appLd(TOOLS[0].name, TOOLS[0].desc, 'free-tools/amount-in-words.html') + `<script type="module" src="amount-in-words.js"></script>`,
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem">${crumbs(rel, 'Amount in words')}
<h1 style="margin-top:1rem">Amount in words converter</h1>
<p class="lead">Contracts, promissory notes and cheques often state an amount twice, in words and in figures, so a typo in one is caught by the other. Type an amount to get the wording.</p>
<div class="tool">
  <div class="row">
    <div><label for="amount">Amount</label><input id="amount" inputmode="decimal" value="1250.50" autocomplete="off"></div>
    <div><label for="currency">Currency</label><select id="currency"><option value="USD">US dollars</option><option value="EUR">Euros</option><option value="GBP">Pounds sterling</option><option value="CAD">Canadian dollars</option><option value="AUD">Australian dollars</option><option value="INR">Rupees</option><option value="ZAR">Rand</option><option value="NONE">No currency</option></select></div>
    <div><label for="style">Style</label><select id="style"><option value="legal">Contract (and fifty cents)</option><option value="cheque">Cheque (and 50/100)</option><option value="plain">Plain number</option></select></div>
    <div><label for="caps">Capitals</label><select id="caps"><option value="title">Title Case</option><option value="upper">UPPER CASE</option><option value="lower">lower case</option></select></div>
  </div>
  <p id="error" class="err" role="alert" hidden></p>
  <div class="out-row"><div class="out" id="result" aria-live="polite"></div><button class="btn" type="button" data-copy="result">Copy</button></div>
  <div class="out-row"><div class="out" id="result-figure"></div><button class="btn" type="button" data-copy="result-figure">Copy</button></div>
</div>
<h2>How amounts are usually written</h2>
<ul><li>In contracts, the amount in words normally comes first, followed by the figure in brackets: <em>Five Thousand Dollars ($5,000)</em>.</li><li>On cheques, cents are written as a fraction: <em>Five Thousand and 00/100</em>.</li><li>Many agreements say which one wins if they differ; words usually do.</li></ul>
<p>In Clausery templates, the <code>words()</code> function does this automatically, for example <code>words(fee)</code>. See <a href="${rel}docs/logic.html">logic and calculations</a>.</p>
${cta(rel)}</div></section>` },

  { path: 'free-tools/deadline-calculator.html', title: 'Contract deadline calculator (business days, months, years)', description: TOOLS[1].desc,
    extraHead: TOOL_CSS + appLd(TOOLS[1].name, TOOLS[1].desc, 'free-tools/deadline-calculator.html') + `<script type="module" src="deadline-calculator.js"></script>`,
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem">${crumbs(rel, 'Deadline calculator')}
<h1 style="margin-top:1rem">Contract deadline calculator</h1>
<p class="lead">Work out notice periods, payment due dates, renewal dates and response deadlines. Month arithmetic stops at month end, so January 31 plus one month is the last day of February.</p>
<div class="tool">
  <div class="row">
    <div><label for="start">Start date</label><input id="start" type="date"></div>
    <div><label for="amount">Number</label><input id="amount" type="number" min="0" step="1" value="30"></div>
    <div><label for="unit">Unit</label><select id="unit"><option value="days">Calendar days</option><option value="business">Business days (Mon–Fri)</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></div>
    <div><label for="direction">Direction</label><select id="direction"><option value="after">After the start date</option><option value="before">Before the start date</option></select></div>
  </div>
  <label for="holidays">Holidays to skip for business days (optional, one date per line or comma-separated, YYYY-MM-DD)</label>
  <textarea id="holidays" rows="2" placeholder="2026-12-25, 2027-01-01"></textarea>
  <p id="error" class="err" role="alert" hidden></p>
  <div class="out" id="result" aria-live="polite" style="margin-top:1rem"></div>
  <p class="small muted" id="result-note" style="margin-top:.5rem"></p>
</div>
<h2>Things to check</h2>
<ul><li><strong>Is the start day counted?</strong> This calculator counts from the day after the start date, which is the usual rule, but some contracts and courts say otherwise.</li><li><strong>Weekends and holidays.</strong> Many rules move a deadline that falls on a non-business day to the next business day.</li><li><strong>Time zones and cut-off times.</strong> "By 5pm" or "close of business" matters for filings and notices.</li></ul>
<p class="small muted">A calculation aid, not legal advice. Court and statutory deadlines follow their own rules.</p>
<p>Clausery templates can calculate these dates for you with <code>add_days</code>, <code>add_months</code> and <code>add_years</code>.</p>
${cta(rel)}</div></section>` },

  { path: 'free-tools/template-checker.html', title: 'Word template tag checker', description: TOOLS[2].desc,
    extraHead: TOOL_CSS + appLd(TOOLS[2].name, TOOLS[2].desc, 'free-tools/template-checker.html') + `<script type="module" src="template-checker.js"></script>`,
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem">${crumbs(rel, 'Template checker')}
<h1 style="margin-top:1rem">Word template tag checker</h1>
<p class="lead">Check a Word template before you use it: unclosed tags, mismatched sections and invalid names are reported with a plain-English fix, and you see the exact questionnaire it would produce. The file is read in your browser and never uploaded.</p>
<div class="tool">
  <div id="drop"><p><strong>Drop a .docx file here</strong> or choose one</p><label for="file" class="sr-only">Word template</label><input id="file" type="file" accept=".docx"></div>
  <div id="report" aria-live="polite" hidden style="margin-top:1.5rem"></div>
</div>
<h2>What it checks</h2>
<ul><li>Tags that are opened but not closed, such as <code>{client_name</code></li><li>Sections that do not match, such as <code>{#has_retainer}</code> closed by <code>{/retainer}</code></li><li>Tag names with spaces, hyphens or dots</li><li>Tags in the body, headers, footers, footnotes and endnotes</li></ul>
<p>New to tags? Read <a href="${rel}guides/automate-word-templates.html">how to automate a Word template</a> or the full <a href="${rel}docs/templates.html">template syntax</a>.</p>
${cta(rel)}</div></section>` },
];
