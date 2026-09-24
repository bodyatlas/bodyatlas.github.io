import { docsNav } from '../tools/partials.mjs';
const page = (path, title, description, body) => ({ path, title, description, body: (rel) => `<div class="wrap docs">${docsNav(rel, path)}<article class="docs-body">${body(rel)}</article></div>` });

export const pages = [
page('docs/', 'Getting started', 'Install nothing, sign up for nothing: tag a Word template, drop it into Clausery, answer the questions, download the document.', (rel) => `
<h1>Getting started</h1>
<p class="lead">Ten minutes from an existing Word document to a reusable, guided template.</p>
<h2>1. Tag a Word document</h2>
<p>Open any document you draft regularly in Microsoft Word (or LibreOffice, Google Docs exported as .docx). Replace each part that changes with a tag in curly braces:</p>
<pre><code>This Agreement is made on {effective_date} between {party_a_name} ("{party_a_short}")
and {party_b_name} ("{party_b_short}").</code></pre>
<p>Wrap optional passages in a section that starts with <code>{#name}</code> and ends with <code>{/name}</code>:</p>
<pre><code>{#has_retainer}Before we begin work, we require a retainer of {retainer_amount}.{/has_retainer}</code></pre>
<p>Save the file as <strong>.docx</strong>. The full syntax, including repeating lists and table rows, is in <a href="${rel}docs/templates.html">Template syntax</a>. Three ready-made samples are available in the app if you would rather start from one.</p>
<h2>2. Add it to Clausery</h2>
<p>Open <a href="${rel}app/">the app</a> and drop the file on the Templates page. Clausery reads the tags and builds a questionnaire: <code>{effective_date}</code> becomes a date question, <code>{retainer_amount}</code> a money question, <code>{#has_retainer}</code> a yes/no question, and questions inside a section are only shown when that section applies.</p>
<p>The template opens in the designer. Rename questions, add help text, reorder, group into sections, and adjust anything the automatic guesses got wrong. Save.</p>
<h2>3. Draft a document</h2>
<p>Click <strong>New draft</strong>. Work through the sections; answers save as you type. On the <strong>Review &amp; generate</strong> step, preview the result, download the .docx, or print to PDF. The draft stays in your list and can be regenerated after edits.</p>
<div class="note">Nothing in steps 1–3 leaves your computer. The app, once loaded, makes no network requests. You can confirm this in your browser's developer tools (Network tab).</div>
<h2>Where things are stored</h2>
<p>Templates, the original .docx files and drafts are kept in your browser's local database (IndexedDB) for this site. That means:</p>
<ul>
  <li>They are available on this device, in this browser profile, without a connection.</li>
  <li>They are not synced anywhere. Use <a href="${rel}docs/backups.html">backups</a> and template packs to move them.</li>
  <li>Clearing site data for this site deletes them. Turn on <em>protected storage</em> in Settings → Your data to reduce the risk of the browser evicting them.</li>
</ul>
<h2>Next steps</h2>
<ul>
  <li><a href="${rel}docs/questionnaire.html">Designing the questionnaire</a>: types, sections, conditions.</li>
  <li><a href="${rel}docs/logic.html">Logic &amp; calculations</a>: the expression language.</li>
  <li><a href="${rel}docs/intake.html">Client intake forms</a>: let clients answer offline.</li>
</ul>`),

page('docs/templates.html', 'Template syntax', 'Tags, conditional sections, repeating groups, table rows, line breaks and built-in values in Clausery Word templates.', (rel) => `
<h1>Template syntax</h1>
<p class="lead">Clausery templates are ordinary .docx files with tags. Formatting is yours: whatever style a tag has in Word, the answer inherits.</p>
<h2>Tags</h2>
<table><thead><tr><th>Write in Word</th><th>Meaning</th></tr></thead><tbody>
<tr><td><code>{client_name}</code></td><td>Replaced with the answer. Names use letters, digits and underscores.</td></tr>
<tr><td><code>{#has_spouse} … {/has_spouse}</code></td><td>Conditional section: kept when the answer is <em>yes</em> (or truthy), removed otherwise.</td></tr>
<tr><td><code>{^has_spouse} … {/has_spouse}</code></td><td>Inverted section: kept when the answer is <em>no</em>.</td></tr>
<tr><td><code>{#children}{name}, born {dob}{/children}</code></td><td>Repeating group: the content repeats once per item, and tags inside refer to that item.</td></tr>
<tr><td><code>{_today}</code></td><td>Today's date in the workspace date format.</td></tr>
<tr><td><code>{_firm_name}</code></td><td>The firm name from Settings.</td></tr>
</tbody></table>
<div class="warn">Type the braces as plain characters. Word's smart quotes are fine, but tags must not be split by formatting changes in the middle of a name (for example half bold): keep each tag in one run. If a tag is mangled, Clausery tells you which one when you upload.</div>
<h2>Conditional sections</h2>
<p>A section tag can wrap a few words, a sentence, a whole paragraph or several paragraphs. When the opening and closing tags are each alone in their own paragraph, the paragraphs themselves are removed, leaving no empty lines:</p>
<pre><code>{#has_guarantor}
GUARANTEE
The Guarantor, {guarantor_name}, guarantees the obligations of the Tenant.
{/has_guarantor}</code></pre>
<p>Questions that appear only inside a section are automatically shown only when that section applies. A section can also be driven by a calculation instead of a yes/no question: in the designer, change its type to <em>Computed</em> and give it an expression such as <code>amount &gt; 10000</code>.</p>
<h2>Repeating groups</h2>
<p>Use a repeating group for anything that comes in an unknown number: parties, attorneys, beneficiaries, schedule items.</p>
<pre><code>The following attorneys will work on the matter:
{#attorneys}
• {name}, {role} — {rate} per hour
{/attorneys}</code></pre>
<p>Inside a group these extra tags are available: <code>{_index}</code> (1, 2, 3…), <code>{_count}</code>, and the conditions <code>{#_first}</code> and <code>{#_last}</code>. The last one is useful for separators:</p>
<pre><code>{#parties}{name}{^_last}, {/_last}{/parties}</code></pre>
<h3>Table rows</h3>
<p>Put the opening tag in the first cell of a row and the closing tag in the last cell of the same row; the whole row repeats:</p>
<table><thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead><tbody><tr><td><code>{#items}{description}</code></td><td><code>{qty}</code></td><td><code>{amount}{/items}</code></td></tr></tbody></table>
<h2>Line breaks</h2>
<p>Long-text answers keep their line breaks, so an address typed on three lines comes out on three lines.</p>
<h2>Headers, footers and footnotes</h2>
<p>Tags work anywhere in the document, including headers, footers and footnotes.</p>
<h2>Naming tips</h2>
<p>Clausery guesses the question type from the tag name. You can change it afterwards, but good names save work:</p>
<ul>
  <li><code>*_date</code>, <code>signed_on</code>, <code>deadline</code> → date</li>
  <li><code>*_amount</code>, <code>fee</code>, <code>salary</code>, <code>rate</code>, <code>total</code> → money</li>
  <li><code>*_years</code>, <code>*_days</code>, <code>count</code>, <code>quantity</code>, <code>percent</code> → number</li>
  <li><code>*_email</code>, <code>*_phone</code> → email, phone</li>
  <li><code>address</code>, <code>description</code>, <code>notes</code> → long text</li>
  <li><code>has_*</code>, <code>is_*</code>, <code>include_*</code> as section names → yes/no condition</li>
  <li>Plural section names with tags inside (<code>attorneys</code>, <code>parties</code>) → repeating group</li>
  <li>Shared prefixes (<code>party_a_*</code>, <code>client_*</code>) → grouped into a section of the questionnaire</li>
</ul>
<h2>What is not supported</h2>
<ul>
  <li>Nested repeating groups (a list inside a list). Nested conditions inside a group are fine.</li>
  <li>Images or raw XML inserted from answers.</li>
  <li>Legacy .doc files: save as .docx first.</li>
</ul>`),

page('docs/questionnaire.html', 'Designing the questionnaire', 'How to shape the questions Clausery generates from a template: types, sections, help text, defaults, show-when rules and repeating groups.', (rel) => `
<h1>Designing the questionnaire</h1>
<p class="lead">The designer turns the automatic first draft into a form your colleagues or clients can answer without reading the template.</p>
<h2>Questions</h2>
<p>Select a question in the list to edit it. Every question has a label, an optional help text, a type, and a <em>Show only when</em> rule.</p>
<table><thead><tr><th>Type</th><th>Answer</th><th>In the document</th></tr></thead><tbody>
<tr><td>Short text, Long text</td><td>Text</td><td>As typed; long text keeps line breaks</td></tr>
<tr><td>Number</td><td>A number, with optional min/max and decimals</td><td>Formatted for the workspace locale (1,250.5)</td></tr>
<tr><td>Money</td><td>An amount in a currency</td><td>Currency-formatted ($1,250.50, €1.250,50)</td></tr>
<tr><td>Date</td><td>A date picker</td><td>Long (September 24, 2026), medium, short, full or ISO</td></tr>
<tr><td>Dropdown, Choice</td><td>One of a list of options; store a value different from the label with <code>value | Label</code></td><td>The label</td></tr>
<tr><td>Yes / no</td><td>A checkbox</td><td>Controls a conditional section</td></tr>
<tr><td>Email, Phone</td><td>Validated text</td><td>As typed</td></tr>
<tr><td>Computed</td><td>Not asked; calculated from other answers</td><td>Text, number, money, date or yes/no</td></tr>
<tr><td>Repeating group</td><td>A list of items, each with its own fields</td><td>Repeats the tagged content</td></tr>
</tbody></table>
<h2>Sections</h2>
<p>Sections become the steps of the interview. Add, rename and reorder them, and move questions between them with the <em>Section</em> setting. A short introduction per section helps the person answering understand what is being asked and why.</p>
<h2>Show only when</h2>
<p>Any question or group can be hidden until a condition holds. The rule is an expression over other answers, for example <code>has_retainer</code>, <code>fee_type == "flat"</code> or <code>count(attorneys) &gt; 1</code>. Hidden questions are not validated and render blank in the document. See <a href="${rel}docs/logic.html">Logic &amp; calculations</a>.</p>
<h2>Required answers and validation</h2>
<p>Required questions must be answered before the section is marked complete. The interview still lets people skip ahead and generate with gaps (blank in the output), because a half-finished draft is often more useful than a blocked one. The review step lists everything missing.</p>
<h2>Repeating groups</h2>
<p>Set the item name (Attorney, Party, Item), minimum and maximum counts, and the fields for each item. Fields inside a group can have their own <em>Show only when</em> rules that refer to the item's other fields, and to top-level answers.</p>
<h2>Changing the Word document</h2>
<p>Use <em>Replace document</em> in the designer to upload a new version of the .docx. New tags are added as questions, and questions whose tag no longer exists are flagged so you can remove or keep them. Existing labels, help and rules are preserved.</p>
<h2>Preview</h2>
<p>The <em>Preview questionnaire</em> tab shows the interview as others will see it, and <em>Document text</em> shows the plain text of the template with its tags for reference.</p>`),

page('docs/logic.html', 'Logic & calculations', 'The Clausery expression language: operators, functions for text, numbers, money and dates, and how to use it in show-when rules and computed fields.', (rel) => `
<h1>Logic &amp; calculations</h1>
<p class="lead">One small expression language is used for <em>Show only when</em> rules, computed fields and computed conditions. It is deliberately simple and safe: no code runs, only these operators and functions.</p>
<h2>Values</h2>
<p>Answers are referred to by their tag name: <code>salary</code>, <code>has_bonus</code>, <code>start_date</code>. Inside a repeating group, the item's own fields come first, then top-level answers. Literals: numbers <code>12</code>, <code>0.2</code>; text <code>"flat"</code>; <code>true</code>, <code>false</code>, <code>null</code>; lists <code>["CA", "NY"]</code>.</p>
<h2>Operators</h2>
<table><thead><tr><th>Operators</th><th>Notes</th></tr></thead><tbody>
<tr><td><code>+ - * / %</code></td><td>Arithmetic. <code>+</code> joins text when either side is text.</td></tr>
<tr><td><code>== != &lt; &lt;= &gt; &gt;=</code></td><td>Comparison. Numbers typed as text compare as numbers.</td></tr>
<tr><td><code>and or not</code> (also <code>&amp;&amp; || !</code>)</td><td>Logic. Empty text, 0, <code>false</code>, <code>null</code> and empty lists count as false.</td></tr>
<tr><td><code>x in ["a", "b"]</code></td><td>Membership.</td></tr>
<tr><td><code>items.rate</code></td><td>The list of one field across a repeating group.</td></tr>
</tbody></table>
<h2>Functions</h2>
<table><thead><tr><th>Function</th><th>Example → result</th></tr></thead><tbody>
<tr><td><code>upper, lower, title, trim</code></td><td><code>title("jane doe")</code> → Jane Doe</td></tr>
<tr><td><code>concat(a, b, …)</code></td><td><code>concat(first_name, " ", last_name)</code></td></tr>
<tr><td><code>len(x), count(list)</code></td><td><code>count(attorneys)</code> → 3</td></tr>
<tr><td><code>join(list, sep)</code></td><td><code>join(parties.name, "; ")</code></td></tr>
<tr><td><code>sum(list), sum(list, "field")</code></td><td><code>sum(items.amount)</code></td></tr>
<tr><td><code>min, max, round(x, d), floor, ceil, abs</code></td><td><code>round(total * 1.2, 2)</code></td></tr>
<tr><td><code>if(cond, a, b)</code></td><td><code>if(count(attorneys) &gt; 1, "attorneys", "attorney")</code></td></tr>
<tr><td><code>coalesce(a, b, …)</code></td><td>First non-empty value</td></tr>
<tr><td><code>contains(list, x), empty(x)</code></td><td><code>contains(states, "CA")</code></td></tr>
<tr><td><code>plural(n, "day")</code>, <code>plural(n, "party", "parties")</code></td><td><code>plural(term_years, "year")</code> → years</td></tr>
<tr><td><code>words(n)</code></td><td><code>words(1250)</code> → one thousand two hundred and fifty</td></tr>
<tr><td><code>format_number(x, decimals)</code>, <code>format_money(x, "EUR")</code></td><td><code>format_money(sum(items.amount), "USD")</code> → $12,500.00</td></tr>
<tr><td><code>today()</code></td><td>Today's date</td></tr>
<tr><td><code>format_date(d, "long")</code></td><td>Styles: long, medium, short, full, iso</td></tr>
<tr><td><code>add_days, add_months, add_years</code></td><td><code>add_days(signed_on, 30)</code></td></tr>
<tr><td><code>days_between(a, b), years_between(a, b), year(d)</code></td><td><code>years_between(dob, today())</code> → age</td></tr>
<tr><td><code>number(x), string(x)</code></td><td>Conversions</td></tr>
</tbody></table>
<h2>Computed fields</h2>
<p>Add a computed field in the designer (Pro), give it a tag name and an expression, and choose how it is shown in the document: text, number, money, date or yes/no. Use its tag in the Word document like any other: <code>{total_fee}</code>. Computed fields can use other computed fields; circular references are reported.</p>
<h3>Examples</h3>
<pre><code>total_fee          sum(attorneys.rate) * estimated_hours
term_end           add_years(effective_date, term_years)
salary_in_words    words(salary) + " dollars"
notice_period      if(years_of_service &gt; 5, "three months", "one month")
parties_list       join(parties.name, ", ")</code></pre>
<h2>Computed conditions</h2>
<p>A section can be controlled by an expression instead of a checkbox. Select the yes/no question created for the section, change its type to <em>Computed</em>, and enter for example <code>salary &gt; 100000 and is_executive</code>. The section renders when the expression is true.</p>
<h2>Errors</h2>
<p>Mistyped expressions are flagged in the designer with the position of the problem. At interview time, an expression that cannot be evaluated shows an error under its field and renders blank; it never blocks generation.</p>`),

page('docs/intake.html', 'Client intake forms', 'Collect answers from clients without a portal: export a self-contained HTML questionnaire, receive an answers file, import it into a draft.', (rel) => `
<h1>Client intake forms</h1>
<p class="lead">Clients answer the questionnaire on their own computer, offline, and send you a small answers file. No portal, no accounts, and their answers never touch a server.</p>
<h2>How it works</h2>
<ol>
  <li>Open any draft of the template and, on the review step, choose <strong>Create client intake form</strong> (Pro). Add a short message. Download the form: one .html file containing the questionnaire and nothing else (no document, no answers).</li>
  <li>Send the file to the client by whatever channel you already trust (email, secure file transfer). They double-click it. It opens in their browser from their disk; it needs no connection.</li>
  <li>They answer the questions, can save progress to continue later, and finally <strong>Save answers</strong>, which downloads <code>&lt;template&gt;-answers.json</code>. They send that file back.</li>
  <li>In the draft, choose <strong>Import answers</strong> and select the file. The answers are filled in; review and generate as usual.</li>
</ol>
<h2>What the client sees</h2>
<p>A clean form with your firm name, your message, the sections and questions exactly as in the app, the same validation, and two buttons: save progress and save answers. It works in any current browser on Windows, macOS, Linux, iOS and Android (on phones the file is opened from the downloads folder).</p>
<h2>Security notes</h2>
<ul>
  <li>The form contains the questionnaire structure (labels, help text, options), not the Word template and not previous answers.</li>
  <li>The answers file is plain JSON. Treat it like any client document: if you would encrypt an email attachment, encrypt this one too.</li>
  <li>The form's Content Security Policy blocks all network access, even if it were opened from a web server.</li>
</ul>
<h2>Hosting the form on your site</h2>
<p>Because the form is a single static file, you can also put it on your website or client extranet. Clients still answer locally and send back the file; nothing is posted to the server hosting the page.</p>`),

page('docs/teams.html', 'Teams & template packs', 'Share approved templates across a firm with template packs, and manage licenses for a team.', (rel) => `
<h1>Teams &amp; template packs</h1>
<p class="lead">Clausery has no central server, so sharing works the way your firm already shares files.</p>
<h2>Template packs</h2>
<p>A pack is a JSON file holding one or more templates: the Word document, the questionnaire and its logic. Export one from a template's menu (<em>Export as template pack</em>) or several at once from Settings (a workspace backup also contains drafts; a pack does not).</p>
<p>Put the pack on the shared drive or in your document-management system. Colleagues import it from the Templates page. Importing a pack that contains a template they already have updates it in place, so versioning is as simple as re-exporting after changes.</p>
<div class="note">Suggested practice: keep an "approved templates" folder with the current pack, and a changelog next to it. One person owns edits; everyone else imports.</div>
<h2>Drafts stay personal</h2>
<p>Drafts and their answers live in each person's browser. To hand a matter over, export the draft's answers (<em>Export answers</em> on the review step) and let the colleague import them into a draft of the same template.</p>
<h2>Licensing a team</h2>
<p>A Team license is one key with a seat count. Share the key with the people who use Clausery (Settings → License on each device). Keys are verified offline with a signature, so there is no activation server and no per-device registration. The honour system applies to seat counts, as it would with any offline license.</p>
<h2>Enterprise deployments</h2>
<p>Firms that want the app on their own domain (for example <code>draft.yourfirm.com</code>) or intranet can self-host it: it is a folder of static files. See <a href="${rel}docs/self-hosting.html">Self-hosting</a>.</p>`),

page('docs/backups.html', 'Backups & data', 'Where Clausery stores data, how to back it up, restore it, move it between computers, and how the encrypted workspace works.', (rel) => `
<h1>Backups &amp; data</h1>
<h2>Where data lives</h2>
<p>Everything is in your browser's IndexedDB for this site: templates (with the .docx bytes), drafts and settings. Different browsers and profiles on the same computer have separate workspaces.</p>
<h2>Backups</h2>
<p>Settings → Your data → <strong>Download backup</strong> saves a single JSON file with all templates, documents, drafts and settings (except the license key and the encryption passphrase). Restore it with <strong>Restore backup</strong>, choosing <em>Merge</em> or <em>Replace everything</em>.</p>
<p>Backups are not encrypted, even when the workspace is. Store them where you store client files.</p>
<h2>Moving to a new computer</h2>
<p>Download a backup, restore it on the new machine, enter your license key again. If you use the encrypted workspace, turn it on again on the new machine with the passphrase of your choice.</p>
<h2>Protected storage</h2>
<p>Browsers may evict site data under storage pressure. Settings shows whether this site's storage is protected and lets you request it; installing the app (browser menu → Install) usually grants it permanently.</p>
<h2>Encrypted workspace</h2>
<p>With encryption on (Pro), templates, documents and drafts are encrypted at rest with AES-256-GCM using a key derived from your passphrase (PBKDF2-SHA256, 600,000 iterations). The key exists only in memory while the workspace is unlocked; it locks after the inactivity period you choose. There is no recovery: a forgotten passphrase means the data is unreadable, which is the property you want from encryption. Keep a backup.</p>
<h2>Erasing</h2>
<p><strong>Erase workspace</strong> deletes everything Clausery stored in this browser. Clearing the site's data in the browser settings does the same.</p>`),

page('docs/security.html', 'Security', 'How Clausery keeps client data on the device: architecture, threat model, cryptography, content security policy, and how to verify it yourself.', (rel) => `
<h1>Security overview</h1>
<p class="lead">Clausery's security model is short because its architecture is short: there is no server side. This page is written for the person at your firm who has to sign off on new tools.</p>
<h2>Architecture</h2>
<ul>
  <li>The product is a set of static files (HTML, CSS, JavaScript) served from a web host. There is no backend, database, API or account system operated by us.</li>
  <li>All processing (reading .docx templates, evaluating answers, generating documents, encrypting storage) happens in the browser's JavaScript engine.</li>
  <li>Data at rest is in the browser's IndexedDB, scoped to the site origin and the browser profile.</li>
  <li>After the initial load, the app makes no network requests. The service worker caches the app for offline use and only serves same-origin files.</li>
</ul>
<h2>What we can see</h2>
<p>Nothing about your documents. The host serving the static files (GitHub Pages for the public instance) sees ordinary web-server traffic: the IP address and browser of whoever loads the app. There are no analytics, cookies, tracking pixels or third-party scripts. Fonts are system fonts.</p>
<h2>Cryptography</h2>
<ul>
  <li><strong>Encrypted workspace:</strong> AES-256-GCM with a random 96-bit nonce per record; key derived from the passphrase with PBKDF2-SHA256 (600,000 iterations, 128-bit random salt). Implemented with the browser's WebCrypto API only.</li>
  <li><strong>License keys:</strong> Ed25519 signatures over the license payload, verified with a public key embedded in the app. No license server.</li>
</ul>
<h2>Browser hardening</h2>
<ul>
  <li>Content Security Policy: <code>default-src 'self'</code>, no inline scripts, no remote scripts, <code>connect-src 'self'</code>, <code>object-src 'none'</code>, <code>form-action 'none'</code>.</li>
  <li>Referrer policy <code>no-referrer</code> in the app. The app page is marked <code>noindex</code>.</li>
  <li>Exported intake forms carry a CSP of <code>default-src 'none'</code> with inline-only script and style, so they cannot make network requests even when hosted.</li>
  <li>Expressions in templates are evaluated by a purpose-built interpreter, never by <code>eval</code>; identifiers resolve only against the answers object.</li>
</ul>
<h2>Threat model</h2>
<table><thead><tr><th>Threat</th><th>Position</th></tr></thead><tbody>
<tr><td>Breach of the vendor</td><td>Not applicable: we hold no customer data.</td></tr>
<tr><td>Interception in transit</td><td>Not applicable to documents: they are never transmitted. The app itself is served over HTTPS.</td></tr>
<tr><td>Compromised or shared device</td><td>The primary risk. Mitigations: encrypted workspace with auto-lock, backups stored on managed storage, standard device security.</td></tr>
<tr><td>Malicious template</td><td>A .docx is parsed as XML by an open-source library; no macros run. Templates cannot execute code or make requests.</td></tr>
<tr><td>Supply chain (the app's code)</td><td>Dependencies are pinned and bundled into the repository; the deploy is the repository content. No CDN scripts at runtime. Self-hosting lets you freeze a reviewed version.</td></tr>
</tbody></table>
<h2>Verify it</h2>
<ol>
  <li>Open the app, then open the browser's developer tools → Network. Import a template, draft and generate. Observe zero requests after the initial page load (the service worker may show cache hits).</li>
  <li>Disconnect from the network. Everything continues to work.</li>
  <li>Read the source: it is served unminified except for the bundled document library, whose exact upstream versions are listed in Settings → About.</li>
</ol>
<h2>Reporting a vulnerability</h2>
<p>Email <a href="mailto:security@clausery.app">security@clausery.app</a>. We aim to acknowledge within two business days. Please do not test against other people's deployments.</p>`),

page('docs/self-hosting.html', 'Self-hosting', 'Run Clausery on your own domain or intranet: it is a folder of static files with no build step and no server component.', (rel) => `
<h1>Self-hosting</h1>
<p class="lead">Clausery is a folder of static files. Any web server, object-storage bucket or intranet file share that serves HTTPS can host it.</p>
<h2>Deploy</h2>
<ol>
  <li>Get the release folder (the <code>clausery/</code> directory of the repository, or a release archive).</li>
  <li>Upload it to your host so that <code>index.html</code> is served at the root of the path you choose, for example <code>https://draft.yourfirm.com/</code> or <code>https://intranet/tools/clausery/</code>. All links are relative, so any base path works.</li>
  <li>Serve over HTTPS. Service workers and WebCrypto require a secure context (localhost is also allowed).</li>
  <li>Set <code>SITE_URL</code> in <code>app/config.js</code> to your address (used in exported intake forms).</li>
</ol>
<h2>Recommended headers</h2>
<pre><code>Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-cache   (for HTML; long max-age for vendor/ and assets/)</code></pre>
<h2>Licensing your deployment</h2>
<p>To issue your own license keys (Enterprise), generate a key pair with <code>npm run license -- keygen</code>, put the public key in <code>app/config.js</code> and keep the private key offline. Issue keys with <code>npm run license -- issue</code>. The app then accepts only keys signed by you.</p>
<h2>Updating</h2>
<p>Replace the folder with the new version. The service worker version changes with each release and users are prompted to reload. User data is in their browsers, not in the folder, so updates never touch it.</p>
<h2>GitHub Pages</h2>
<p>The public instance runs on GitHub Pages straight from the repository, with a CI workflow that lints, unit-tests and end-to-end tests every change. Forking the repository and enabling Pages gives you an identical setup in minutes.</p>`),

page('docs/faq.html', 'FAQ', 'Frequently asked questions about Clausery: compatibility, formatting, limits, browsers, offline use and licensing.', (rel) => `
<h1>Frequently asked questions</h1>
<h2>Which browsers are supported?</h2>
<p>Current versions of Chrome, Edge, Firefox and Safari on desktop and mobile. The encrypted workspace and license keys use WebCrypto Ed25519, available in Chrome/Edge 137+, Firefox 129+ and Safari 17+.</p>
<h2>Does it work with Google Docs or LibreOffice?</h2>
<p>Yes, as long as you export or save as .docx. Tags are plain text, so any editor can write them.</p>
<h2>My formatting looks different in the preview.</h2>
<p>The on-screen preview is an approximation rendered in the browser. The downloaded .docx is assembled from your original file and opens in Word with your exact formatting. Use <em>Print / Save as PDF</em> for a quick PDF, or open the .docx in Word for a print-perfect one.</p>
<h2>Is there a limit on template size or number of drafts?</h2>
<p>No fixed limit. Browsers typically allow hundreds of megabytes of local storage; a template is usually well under a megabyte and a draft a few kilobytes.</p>
<h2>Can several people work on one draft?</h2>
<p>Not at the same time; there is no server to coordinate. Hand over a draft by exporting and importing its answers file.</p>
<h2>Can I use it on my phone?</h2>
<p>Yes. The app is responsive and installable. Drafting long documents is more comfortable on a larger screen.</p>
<h2>What if Clausery disappears?</h2>
<p>Your copy keeps working: it is cached in your browser and can be self-hosted from the repository. Your templates are your .docx files; your data exports are plain JSON.</p>
<h2>How do I get a license key?</h2>
<p>See <a href="${rel}pricing/">Pricing</a>. Keys are delivered by email and entered once per device.</p>`),
];
