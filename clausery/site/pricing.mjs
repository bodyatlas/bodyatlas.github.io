export const pages = [{
  path: 'pricing/', title: 'Pricing',
  description: 'Clausery pricing: free for up to three templates; Pro from $19 per user per month; Team and Enterprise plans for firms that want packs, encryption, intake forms and self-hosting.',
  body: (rel) => `
<section class="section">
  <div class="wrap">
    <div style="text-align:center;max-width:44rem;margin:0 auto 2.5rem">
      <h1>Simple pricing. No per-document fees.</h1>
      <p class="lead" style="margin:0 auto">Every plan runs entirely in your browser. A license is a signed key that unlocks features offline; it never checks in with a server.</p>
    </div>
    <div class="plans">
      <div class="plan">
        <h3>Free</h3>
        <p class="muted">For trying it out and small practices.</p>
        <p class="price">$0</p>
        <ul>
          <li>Up to 3 templates</li>
          <li>Unlimited drafts and documents</li>
          <li>Conditional clauses and repeating groups</li>
          <li>Preview, .docx download, print to PDF</li>
          <li>Backups and answer files</li>
          <li class="no">Calculations</li>
          <li class="no">Encrypted workspace</li>
          <li class="no">Client intake forms</li>
        </ul>
        <a class="btn" href="${rel}app/">Open the app</a>
      </div>
      <div class="plan featured">
        <span class="badge" style="position:absolute;top:-.8rem;left:1.5rem">Most popular</span>
        <h3>Pro</h3>
        <p class="muted">For solo practitioners and professionals.</p>
        <p class="price">$19 <small>/ user / month</small></p>
        <p class="small muted">or $190 per year</p>
        <ul>
          <li>Unlimited templates</li>
          <li>Everything in Free</li>
          <li>Calculations and computed fields</li>
          <li>Encrypted workspace with auto-lock</li>
          <li>Client intake forms</li>
          <li>Template packs</li>
          <li>Email support</li>
        </ul>
        <a class="btn btn-primary" href="#buy" data-checkout="pro">Get Pro</a>
      </div>
      <div class="plan">
        <h3>Team</h3>
        <p class="muted">For firms and departments up to 25 people.</p>
        <p class="price">$49 <small>/ month</small></p>
        <p class="small muted">5 seats included, $9 per extra seat</p>
        <ul>
          <li>Everything in Pro</li>
          <li>Seat-based team license</li>
          <li>Shared template packs and onboarding call</li>
          <li>Priority support</li>
        </ul>
        <a class="btn" href="#buy" data-checkout="team">Get Team</a>
      </div>
      <div class="plan">
        <h3>Enterprise</h3>
        <p class="muted">For larger firms with IT and compliance requirements.</p>
        <p class="price">Custom</p>
        <ul>
          <li>Everything in Team</li>
          <li>Self-hosted on your domain or intranet</li>
          <li>Custom branding of the app and intake forms</li>
          <li>Template authoring services</li>
          <li>Security documentation and DPA</li>
          <li>Invoicing and volume pricing</li>
        </ul>
        <a class="btn" href="mailto:hello@clausery.app?subject=Clausery%20Enterprise">Talk to us</a>
      </div>
    </div>
    <p class="small muted" style="text-align:center;margin-top:1.5rem">Prices in USD, excluding VAT/sales tax where applicable. Licenses are per named user; a Team license covers a number of seats.</p>
  </div>
</section>

<section class="section section-alt" id="buy">
  <div class="wrap" style="max-width:48rem">
    <h2>How buying works</h2>
    <ol>
      <li><strong>Check out</strong> through our hosted payment page. You receive a license key by email within minutes.</li>
      <li><strong>Paste the key</strong> in the app under Settings → License. The key is verified offline with a cryptographic signature; the app never contacts a license server.</li>
      <li><strong>Use it on every device</strong> you work from. Keep the key somewhere safe; it is your proof of purchase.</li>
    </ol>
    <p id="checkout-note" class="small muted">Checkout links are configured by the operator of this deployment. If a button above does nothing, email <a href="mailto:hello@clausery.app">hello@clausery.app</a> and we will send a key and an invoice.</p>
  </div>
</section>

<section class="section" id="compare">
  <div class="wrap" style="max-width:52rem">
    <h2>What the alternatives cost</h2>
    <p class="muted">Prices as of 2026, for orientation. They are good products for firms that are comfortable with cloud processing of client data.</p>
    <div class="table-wrap">
    <table class="compare">
      <thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Where documents are processed</th></tr></thead>
      <tbody>
        <tr><td>Gavel (document automation)</td><td>Lite from about $83 to $99 per month; higher tiers about $250 to $417 per month (vendor pricing page)</td><td>Vendor cloud</td></tr>
        <tr><td>Clio Draft</td><td>Quote-based; third-party 2026 guides report roughly $49 to $149 per user per month</td><td>Vendor cloud</td></tr>
        <tr><td>Proposal and contract suites (PandaDoc, Better Proposals)</td><td>$13 to $49 per user per month</td><td>Vendor cloud</td></tr>
        <tr><td><strong>Clausery Pro</strong></td><td><strong>$19 per user per month</strong></td><td><strong>Your browser</strong></td></tr>
      </tbody>
    </table>
    </div>
    <p class="small muted">Sources: vendor pricing pages and 2026 comparison articles (Capterra, SaaSworthy, Owlesq, ClientStackLab). Prices change; check the vendors for current figures.</p>
  </div>
</section>

<section class="section section-alt" id="faq">
  <div class="wrap" style="max-width:48rem">
    <h2>Pricing questions</h2>
    <div class="faq">
      <details><summary>Is there a free trial of Pro?</summary><p>The Free plan has no time limit, so you can evaluate the core product for as long as you like. If you need to test a Pro feature before buying, email us for a 14-day key.</p></details>
      <details><summary>What happens when a license expires?</summary><p>The app falls back to the Free plan. Everything you created stays on your device and keeps working; only the Pro-gated features pause until you renew.</p></details>
      <details><summary>Do you offer discounts for legal aid, nonprofits or education?</summary><p>Yes: 50% off Pro and Team. Email us from your organisation's address.</p></details>
      <details><summary>Can I get an invoice or pay by bank transfer?</summary><p>Team and Enterprise customers can pay by invoice. Contact us.</p></details>
    </div>
  </div>
</section>
<script type="module" src="${rel}pricing/checkout.js"></script>`,
}];
