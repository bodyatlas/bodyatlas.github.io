export const pages = [
  {
    path: '404.html', title: 'Page not found', description: 'The page you were looking for does not exist.',
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:40rem;text-align:center"><p class="eyebrow">404</p><h1>That page is not here.</h1><p class="lead" style="margin:0 auto 1.5rem">The address may be wrong, or the page moved. Nothing you do in Clausery is stored on a server, so there is nothing to recover from here.</p><div class="actions" style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="${rel}">Go to the home page</a><a class="btn" href="${rel}app/">Open the app</a></div></div></section>`,
  },
  {
    path: 'changelog.html', title: 'Changelog', description: 'What changed in each Clausery release.',
    body: (rel) => `<section class="section"><div class="wrap prose">
<h1>Changelog</h1>
<h2>1.2.0 <span class="small muted">— 26 September 2026</span></h2>
<ul>
  <li>Contract clause library: plain-English explanations and copyable sample wording for 24 common clauses, each with the matching Clausery tags.</li>
  <li>New guides on offer letters, payment demand letters, statements of work and NDAs.</li>
  <li>Template pages link to explanations of the clauses they contain.</li>
  <li>Atom feed for guides and clauses, and an llms.txt summary for AI assistants.</li>
</ul>
<h2>1.1.0 <span class="small muted">— 26 September 2026</span></h2>
<ul>
  <li>Free template library of 17 Word templates: NDAs (mutual and one-way), engagement letter, consulting, service and independent contractor agreements, statement of work, offer, internship, salary increase, verification, reference, termination and resignation letters, payment demand, cease and desist, and a promissory note.</li>
  <li>One-click start: template pages open the questionnaire directly in the app.</li>
  <li>A tag used in several optional parts of a document is now asked whenever any of those parts applies.</li>
  <li>Better question types for instructions, assumptions, interest rates and last working days, and fewer optional sections mistaken for lists.</li>
</ul>
<h2>1.0.0 <span class="small muted">— 24 September 2026</span></h2>
<p>First public release.</p>
<ul>
  <li>Word (.docx) templates with tags, conditional and inverted sections, repeating groups in paragraphs, bullets and table rows.</li>
  <li>Automatic questionnaire from a template's tags: field types inferred from names, sections from shared prefixes, conditions applied to nested tags.</li>
  <li>Template designer: labels, help text, types, options, formats, required flags, show-when conditions, calculations, sections.</li>
  <li>Interview with section stepper, autosave, validation, review, on-screen preview, .docx download and print to PDF.</li>
  <li>Expression language for conditions and computed fields, with date, money and text functions.</li>
  <li>Local workspace in the browser database, backups, answer files, template packs.</li>
  <li>Optional encryption at rest (AES-256-GCM, PBKDF2) with auto-lock.</li>
  <li>Offline client intake forms as single HTML files.</li>
  <li>Offline-capable installable app (service worker), strict Content Security Policy, no third-party requests.</li>
  <li>Offline license keys (Ed25519 signatures) with Free, Pro, Team and Enterprise plans.</li>
</ul>
</div></section>`,
  },
];
