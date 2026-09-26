# Security policy

Clausery is a client-side application: there is no server that stores customer data. Security issues that matter are therefore in the browser code (template parsing, expression evaluation, encryption at rest, license verification, content security policy) and in the build pipeline.

## Reporting

Email **security@clausery.app** with a description and, if possible, a minimal reproduction. We aim to acknowledge reports within two business days and to publish a fix and a changelog entry as soon as one is available. Please do not test against deployments you do not control.

## Scope

- The application under `clausery/app`, `clausery/src`, `clausery/sw.js` and the generated site pages
- The vendored document engine build (`clausery/tools/build-vendor.mjs`)
- The license tooling (`clausery/tools/license.mjs`)

## Design notes

- No `eval` or `Function`; expressions are interpreted by `app/lib/expr.js`
- No inline or third-party scripts; CSP `default-src 'self'`
- Encryption at rest: AES-256-GCM, PBKDF2-SHA256 (600k iterations), WebCrypto only
- Licenses: Ed25519 signatures verified with an embedded public key
- Dependencies are pinned and bundled into the repository; runtime has no CDN dependencies
