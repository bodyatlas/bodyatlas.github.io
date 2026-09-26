const page = (path, title, description, body) => ({ path, title, description, body: (rel) => `<section class="section"><div class="wrap prose">${body(rel)}</div></section>` });
export const pages = [
page('legal/privacy.html', 'Privacy policy', 'Clausery privacy policy: the app processes documents only in your browser and collects no personal data.', (rel) => `
<h1>Privacy policy</h1>
<p class="muted">Effective 24 September 2026</p>
<h2>Summary</h2>
<p>Clausery is designed so that we cannot see your data. The application runs entirely in your web browser, stores its data only on your device, and only ever requests its own files from the site that serves it; it never sends your templates, answers or documents anywhere. We do not operate accounts, analytics, or servers that receive your templates, answers or documents.</p>
<h2>What the app processes</h2>
<p>Templates (.docx files), the answers you enter, generated documents, settings and license keys are processed in your browser and stored in its local database. This data is under your control and is never transmitted to us or to any third party by the app.</p>
<h2>What the website host receives</h2>
<p>The public instance is served as static files by GitHub Pages. Like any web server, GitHub may log the IP address, browser type and requested URLs of visitors for security and operational purposes, under <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub's privacy statement</a>. We do not add cookies, analytics or tracking of any kind, and we receive no visitor data from GitHub.</p>
<h2>Purchases and support</h2>
<p>If you buy a license or contact us, we receive the information you provide (typically your name, email address and organisation) and payment details are handled by the payment provider shown at checkout, under their privacy policy. We use this information to issue license keys, provide support and send invoices, and keep it for as long as required by tax and accounting law. We do not sell or share it for marketing.</p>
<h2>Your rights</h2>
<p>Because the app holds no data about you, the data-subject rights under the GDPR, UK GDPR and CCPA apply to the purchase and support records described above. Email <a href="mailto:privacy@clausery.app">privacy@clausery.app</a> to access, correct or delete them.</p>
<h2>Children</h2>
<p>Clausery is a business tool and is not directed at children.</p>
<h2>Changes</h2>
<p>We will post changes to this policy on this page with a new effective date.</p>`),

page('legal/terms.html', 'Terms of service', 'Terms under which Clausery is provided: license, acceptable use, warranties and liability.', (rel) => `
<h1>Terms of service</h1>
<p class="muted">Effective 24 September 2026</p>
<h2>1. The service</h2>
<p>Clausery ("the software") is a browser application for assembling documents from templates you supply. It is provided by Clausery ("we"). By using the software you agree to these terms.</p>
<h2>2. License</h2>
<p>We grant you a non-exclusive, non-transferable right to use the software for your internal business purposes. Free-plan features may be used without charge. Paid features are unlocked by a license key issued to a named user or, for Team licenses, to a number of seats; keys may not be shared beyond the licensed users. You may not remove notices, resell the software, or circumvent license verification.</p>
<h2>3. Your content</h2>
<p>You own your templates, answers and generated documents. The software processes them only on your device. You are responsible for the content of your templates and for reviewing every generated document before use.</p>
<h2>4. Not legal, tax or professional advice</h2>
<p>The software fills in templates. It does not provide legal, tax, financial or other professional advice, and the sample templates are illustrations only, not forms suitable for any particular jurisdiction or purpose.</p>
<h2>5. Data on your device</h2>
<p>Your data is stored in your browser. You are responsible for backups. We cannot recover data that is deleted, lost, or encrypted with a forgotten passphrase.</p>
<h2>6. Fees</h2>
<p>Paid plans are billed as shown at purchase. Except where required by law, fees are non-refundable, but we will refund any purchase made in error within 14 days on request.</p>
<h2>7. Warranty and liability</h2>
<p>The software is provided "as is". To the maximum extent permitted by law, we disclaim all warranties, and our total liability arising from the software or these terms is limited to the amount you paid us in the twelve months before the claim. We are not liable for indirect or consequential loss.</p>
<h2>8. Termination</h2>
<p>You may stop using the software at any time. We may terminate a license for breach of these terms. Sections 3–7 survive termination.</p>
<h2>9. Governing law</h2>
<p>These terms are governed by the laws of the jurisdiction in which Clausery is established, and disputes are subject to the courts of that jurisdiction, without prejudice to mandatory consumer protection where it applies.</p>
<h2>10. Contact</h2>
<p><a href="mailto:hello@clausery.app">hello@clausery.app</a></p>`),

page('legal/dpa.html', 'Data processing statement', 'For procurement and compliance teams: why Clausery involves no processing of personal data by the vendor, and what to record.', (rel) => `
<h1>Data processing statement</h1>
<p class="muted">For procurement, privacy and information-security reviews</p>
<h2>Role of the vendor</h2>
<p>Clausery does not process personal data on behalf of customers. The software executes on the customer's devices; no customer content is transmitted to, stored by, or accessible to the vendor. Consequently the vendor is not a <em>processor</em> under Article 28 GDPR (or a service provider under the CCPA) for content handled in the software, and a data processing agreement covering that content is not required. We are happy to sign a short attestation to this effect for your records.</p>
<h2>Records of processing</h2>
<p>When recording the use of Clausery in a register of processing activities, the accurate description is: <em>"Document assembly software executed locally in employees' browsers; no transfer to the supplier; data stored on managed endpoints under the organisation's device policies."</em></p>
<h2>Sub-processors</h2>
<p>None for customer content. The public web host (GitHub Pages) serves the application files and receives standard web-server logs from visitors' browsers; customers who prefer no third party in the delivery path can <a href="${rel}docs/self-hosting.html">self-host</a>.</p>
<h2>Security measures</h2>
<p>See the <a href="${rel}docs/security.html">security overview</a>: client-side architecture, strict content security policy, no third-party code at runtime, optional AES-256-GCM encryption at rest, offline license verification.</p>
<h2>International transfers</h2>
<p>None by the vendor.</p>
<h2>Contact</h2>
<p><a href="mailto:privacy@clausery.app">privacy@clausery.app</a></p>`),
];
