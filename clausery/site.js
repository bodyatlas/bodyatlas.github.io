/* Clausery site script: the mobile menu. External so the pages work under a strict script-src 'self' policy. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.menu-btn');
  if (!btn) return;
  const nav = document.getElementById(btn.getAttribute('aria-controls'));
  if (!nav) return;
  btn.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
});
