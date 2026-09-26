// "Alternative to X" pages. They state plainly where the other product is the better choice: buyers comparing tools
// trust a page that admits trade-offs, and every claim here must stay accurate.
import { esc } from '../tools/partials.mjs';

const ROWS = ['Where your documents are processed', 'Account needed', 'Works offline', 'Uses your own Word templates', 'Conditional clauses and repeating lists', 'Calculations', 'Client questionnaires', 'Integrations with practice management', 'Price'];
const CLAUSERY = ['Your browser only; nothing is uploaded', 'No', 'Yes', 'Yes', 'Yes', 'Yes (Pro)', 'Offline intake file you email to the client', 'None: files in, files out', 'Free for 3 templates; Pro $19 per user per month'];

const COMPETITORS = [
  { slug: 'gavel-alternative', name: 'Gavel', title: 'Gavel alternative that keeps client data on your computer',
    intro: 'Gavel is a well-regarded cloud platform for legal document automation and client workflows. Clausery does the core job, turning Word templates into guided questionnaires, without sending client data to a vendor.',
    them: ['Vendor cloud', 'Yes', 'No', 'Yes', 'Yes', 'Yes', 'Hosted, branded client portal', 'Yes, including Clio', 'Lite from about $83 to $99 per month; higher tiers about $250 to $417 per month'],
    chooseThem: ['You want a hosted client portal with payments and online workflows', 'You rely on its integrations with your practice management system', 'Your firm is comfortable with cloud processing of client data'],
    chooseUs: ['Client confidentiality rules or client instructions make uploads hard to justify', 'You want to start in minutes with the Word files you already have', 'You want a free tier with unlimited documents, or a flat low price per user'] },
  { slug: 'clio-draft-alternative', name: 'Clio Draft', title: 'Clio Draft alternative for firms that cannot upload client files',
    intro: 'Clio Draft (formerly Lawyaw) is document automation that lives inside the Clio ecosystem. Clausery is independent of any practice management system and never uploads the documents it builds.',
    them: ['Vendor cloud', 'Yes', 'No', 'Yes', 'Yes', 'Yes', 'Hosted forms', 'Deep Clio Manage integration', 'Quote-based; third-party 2026 guides report roughly $49 to $149 per user per month'],
    chooseThem: ['Your firm runs on Clio Manage and wants matter data to fill documents automatically', 'You want its court form library', 'You prefer one vendor for practice management and drafting'],
    chooseUs: ['You do not use Clio, or want drafting that works without it', 'You need client data to stay on firm devices', 'You want predictable pricing without a practice management subscription'] },
  { slug: 'hotdocs-alternative', name: 'HotDocs', title: 'HotDocs alternative: lightweight document automation in the browser',
    intro: 'HotDocs has been a standard for enterprise document assembly for decades. Clausery is a much lighter tool: no installation, no server, and no component library to learn, for firms that need the essentials.',
    them: ['Desktop authoring with server or cloud deployment', 'Yes', 'Authoring on desktop', 'Yes', 'Yes, very advanced', 'Yes', 'Yes, through its interview platform', 'Enterprise integrations', 'Quote-based enterprise pricing'],
    chooseThem: ['You automate hundreds of complex, interlinked documents', 'You need enterprise administration, auditing and integrations', 'You have dedicated template authors'],
    chooseUs: ['You want to automate your ten most-used documents this afternoon', 'Nobody on the team should have to learn a template language', 'Budget or procurement rules out an enterprise contract'] },
  { slug: 'docassemble-alternative', name: 'docassemble', title: 'docassemble alternative that needs no server',
    intro: 'docassemble is a powerful, free, open-source platform for guided interviews, widely used in access-to-justice projects. It runs on a server you host. Clausery runs in the browser with nothing to install or host.',
    them: ['Your own server', 'Depends on your setup', 'No', 'Yes, plus its own formats', 'Yes, very advanced', 'Yes, with Python', 'Yes, web interviews', 'Through code and APIs', 'Free, open source; you pay for hosting and maintenance'],
    chooseThem: ['You need public-facing web interviews at scale', 'You have developers comfortable with Python and YAML', 'You need logic beyond what a form designer offers'],
    chooseUs: ['You have no server, no developer and no IT budget', 'Your templates live in Word and should stay there', 'You want a questionnaire from a template in minutes, without code'] },
];

export const pages = [
  { path: 'compare/', title: 'Compare document automation tools',
    description: 'How Clausery compares with Gavel, Clio Draft, HotDocs and docassemble: where documents are processed, setup, features and price.',
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem">
  <h1>How Clausery compares</h1>
  <p class="lead">Every tool on this list is good at something. The main difference with Clausery is architectural: your documents are built on your own computer, so there is no vendor that holds your clients' data.</p>
  <ul>${COMPETITORS.map((c) => `<li><a href="${rel}compare/${c.slug}.html">Clausery vs ${esc(c.name)}</a></li>`).join('')}</ul>
</div></section>` },
  ...COMPETITORS.map((c) => ({
    path: `compare/${c.slug}.html`, title: c.title,
    description: `${c.intro}`.slice(0, 290),
    body: (rel) => `<section class="section"><div class="wrap" style="max-width:52rem">
  <nav class="small muted" aria-label="Breadcrumb"><a href="${rel}">Home</a> › <a href="${rel}compare/">Compare</a> › ${esc(c.name)}</nav>
  <h1 style="margin-top:1rem">${esc(c.title)}</h1>
  <p class="lead">${esc(c.intro)}</p>
  <div class="table-wrap" tabindex="0" style="margin-top:2rem"><table class="compare"><thead><tr><th scope="col"></th><th scope="col">Clausery</th><th scope="col">${esc(c.name)}</th></tr></thead><tbody>
    ${ROWS.map((r, i) => `<tr><td>${esc(r)}</td><td>${esc(CLAUSERY[i])}</td><td>${esc(c.them[i])}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="small muted">Based on public information as of 2026. Products change; check with the vendor.</p>
  <div class="grid grid-2" style="margin-top:2rem">
    <div class="feature"><h2 style="font-size:1.15rem">Choose ${esc(c.name)} if</h2><ul>${c.chooseThem.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="feature"><h2 style="font-size:1.15rem">Choose Clausery if</h2><ul>${c.chooseUs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
  </div>
  <h2 style="margin-top:2.5rem">Try it with your own template</h2>
  <p>Open the app, drop in a Word document with tags like <code>{client_name}</code>, and you have a questionnaire. Or start from one of the <a href="${rel}templates/">free templates</a>.</p>
  <p><a class="btn btn-primary btn-lg" href="${rel}app/">Open Clausery, free</a></p>
</div></section>`,
  })),
];
