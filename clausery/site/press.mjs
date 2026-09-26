// Press kit: facts, boilerplate and assets for journalists, directories and bloggers.
export const pages = [{
  path: 'press/', title: 'Press kit',
  description: 'Clausery press kit: product facts, a short and a long description, screenshots, logo and contact details.',
  body: (rel) => `<section class="section"><div class="wrap prose">
<h1>Press kit</h1>
<p class="lead">Everything you need to write about or list Clausery. All text on this page may be quoted freely.</p>
<h2>In one sentence</h2>
<p>Clausery is document automation that runs entirely in the browser: it turns your own Word templates into guided questionnaires and builds finished documents without uploading any client data.</p>
<h2>Short description (50 words)</h2>
<p>Clausery turns the Word templates law firms, HR teams and consultants already use into guided questionnaires, then assembles the finished .docx on the user's own computer. Nothing is uploaded, no account is needed and it works offline. Conditional clauses, repeating lists, calculations and client intake forms are included. Free for three templates.</p>
<h2>Long description</h2>
<p>Small law firms, HR teams and consultancies draft the same documents every week: engagement letters, NDAs, offer letters, statements of work. Document automation tools could save hours, but they are cloud services that need client data uploaded to the vendor, which many firms are unwilling or not permitted to do.</p>
<p>Clausery takes a different architecture. It is a set of static files that runs in the browser. Templates are ordinary Word documents with tags such as <code>{client_name}</code> and <code>{#has_retainer}…{/has_retainer}</code>; Clausery reads them, builds a questionnaire, and generates the finished document locally. Data is stored in the browser, optionally encrypted with a passphrase. Clients can answer questionnaires offline through a single HTML file they return by email. There is no vendor database, so there is nothing to breach and nothing to assess in a vendor security review.</p>
<h2>Facts</h2>
<table><tbody>
<tr><th scope="row">Launched</th><td>September 2026</td></tr>
<tr><th scope="row">Website</th><td><a href="${rel}">bodyatlas.github.io/clausery</a></td></tr>
<tr><th scope="row">Pricing</th><td>Free for 3 templates; Pro $19 per user per month; Team $49 per month for 5 seats; Enterprise on request</td></tr>
<tr><th scope="row">For</th><td>Solo and small law firms, HR teams, consultants and agencies</td></tr>
<tr><th scope="row">Platform</th><td>Any modern browser on desktop or mobile; installable; works offline</td></tr>
<tr><th scope="row">Free resources</th><td><a href="${rel}templates/">17 Word templates</a>, <a href="${rel}free-tools/">drafting tools</a>, <a href="${rel}guides/">guides</a></td></tr>
<tr><th scope="row">Security</th><td>Client-side processing, AES-256-GCM encryption at rest, strict content security policy, no third-party requests. <a href="${rel}docs/security.html">Security overview</a></td></tr>
</tbody></table>
<h2>Images</h2>
<ul>
<li><a href="${rel}assets/screenshot-interview.png">Screenshot: questionnaire with document preview</a> (1200×800 PNG)</li>
<li><a href="${rel}assets/screenshot-designer.png">Screenshot: template designer</a> (1200×800 PNG)</li>
<li><a href="${rel}assets/og.png">Social card</a> (1200×630 PNG)</li>
<li><a href="${rel}assets/icon.svg">Logo mark</a> (SVG) and <a href="${rel}assets/icon-512.png">512×512 PNG</a></li>
</ul>
<h2>Contact</h2>
<p>Press and partnerships: <strong>hello@clausery.app</strong></p>
</div></section>`,
}];
