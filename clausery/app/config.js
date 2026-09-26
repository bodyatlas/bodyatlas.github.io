/* Clausery deployment configuration. Edit this file when you deploy your own copy. */
export const APP_NAME = 'Clausery';
export const APP_VERSION = '1.2.0';

/* Public site URL (no trailing slash). Used for links in exported files and the intake form footer. */
export const SITE_URL = 'https://bodyatlas.github.io/clausery';

/* Base64url Ed25519 public key that license keys are verified against. Generate a key pair with
   `npm run license -- keygen`; keep the private key offline and paste the public key here. */
export const LICENSE_PUBLIC_KEY = 'q8doGh6iJJpRQVi1ow0EADMDQMw9oJhMTl_p1ZpE0GE';

/* Hosted checkout links (Stripe Payment Links, Lemon Squeezy, Paddle...). Leave empty to show a contact link instead. */
export const CHECKOUT_URLS = { pro: '', team: '' };
export const CONTACT_EMAIL = 'hello@clausery.app';

/* Locale defaults for new workspaces. */
export const DEFAULT_SETTINGS = { locale: '', currency: 'USD', dateFormat: 'long', theme: 'system', firmName: '', autoLockMinutes: 15 };

/* In local development only, a public key can be overridden for end-to-end tests. Never applies on a real host. */
export function licensePublicKey() {
  try {
    const host = globalThis.location && globalThis.location.hostname;
    if ((host === 'localhost' || host === '127.0.0.1') && globalThis.localStorage) {
      const k = globalThis.localStorage.getItem('clausery.dev.publicKey');
      if (k) return k;
    }
  } catch { /* ignore */ }
  return LICENSE_PUBLIC_KEY;
}
