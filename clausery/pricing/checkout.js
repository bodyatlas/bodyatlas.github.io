/* Pricing page: point the plan buttons at the configured checkout links, or at a contact email when none is set. */
import { CHECKOUT_URLS, CONTACT_EMAIL } from '../app/config.js';

for (const a of document.querySelectorAll('[data-checkout]')) {
  const url = CHECKOUT_URLS[a.dataset.checkout];
  if (url) { a.href = url; a.rel = 'noopener'; }
  else { a.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('Clausery ' + a.dataset.checkout + ' license'); a.textContent = 'Request a ' + a.dataset.checkout + ' key'; }
}
