# Clausery

**Document automation that never leaves your browser.**

Clausery turns the Word templates a firm already uses into guided questionnaires and assembles finished `.docx` documents entirely client-side. No uploads, no account, no server: the product is a folder of static files that runs in the browser, stores data in IndexedDB, and works offline.

- **Live site:** https://bodyatlas.github.io/clausery/
- **App:** https://bodyatlas.github.io/clausery/app/
- **Docs:** https://bodyatlas.github.io/clausery/docs/

## Why

Law firms, HR teams and consultancies draft the same documents every week. The incumbent document-automation products (Gavel, Clio Draft, HotDocs and others) are cloud services priced from roughly $83 to $417 per month, and they require uploading client data to a vendor. Confidentiality is the top concern legal professionals raise about new tools. Clausery keeps the automation and removes the upload.

## Features

- Word `.docx` templates with `{tags}`, conditional and inverted sections, repeating groups (paragraphs, bullets, table rows)
- Questionnaire inferred from the template: types from tag names, sections from prefixes, nested tags auto-hidden
- Template designer: labels, help, types, options, formats, required, show-when rules, computed fields, sections
- Interview with section stepper, autosave, validation, review, on-screen preview, `.docx` download, print to PDF
- Safe expression language for logic and calculations (no `eval`)
- Optional encryption at rest (AES-256-GCM, PBKDF2) with auto-lock
- Offline client intake forms: a single HTML file the client fills in and returns as an answers file
- Backups, answer files, template packs for teams
- Offline-capable installable PWA, strict CSP, zero third-party requests
- Offline license keys (Ed25519) for Free / Pro / Team / Enterprise plans

## Repository layout

```
clausery/
  index.html, pricing/, docs/, legal/, 404.html   generated static pages (from site/*.mjs)
  app/                the application (ES modules, no framework, no build step)
    lib/              expr, schema, logic, render, store, vault, license, backup, form, intake, plan
    ui/               dom helpers, router, views
  vendor/             bundled document engine (docxtemplater, pizzip, docx-preview) – built by tools/build-vendor.mjs
  samples/            sample templates – built by tools/make-samples.mjs
  site/               page modules for the static site generator
  tools/              build, license CLI, dev server, checks, screenshots
  tests/unit          node:test suites
  tests/e2e           Playwright suites (app flow, security, intake, site accessibility)
  sw.js               service worker
```

## Development

```bash
cd clausery
npm ci
npm run build        # vendor bundle, samples, site pages, sitemap
npm run serve        # http://127.0.0.1:4173/clausery/
npm run verify       # lint + HTML checks + unit tests
npm run test:e2e     # Playwright (needs Chromium: npx playwright install chromium)
npm run screenshots  # regenerate marketing images and icons
```

Everything committed is what gets deployed: GitHub Pages serves the folder as-is. CI (`.github/workflows/clausery.yml`) lints, tests, checks HTML/links, verifies that generated files are up to date, and runs the end-to-end suite.

## Licensing keys

```bash
npm run license -- keygen                 # writes keys/private.pem (never commit) and prints the public key
npm run license -- issue --key keys/private.pem --plan pro --name "Jane Doe" --email jane@example.com --expires 2027-12-31
npm run license -- verify --public <publicKey> <key>
```

Put the public key in `app/config.js` (`LICENSE_PUBLIC_KEY`). Keys are verified in the browser with WebCrypto; no server is involved. Configure hosted checkout links in `CHECKOUT_URLS`.

## Security

See `SECURITY.md` and the [security overview](https://bodyatlas.github.io/clausery/docs/security.html).

## License

Copyright © 2026 Clausery. All rights reserved. Third-party components are used under their own licenses: docxtemplater (MIT), pizzip (MIT), jszip (MIT), docx-preview (Apache-2.0).
