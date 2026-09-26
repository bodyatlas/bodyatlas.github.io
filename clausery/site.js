/* Clausery site script: the mobile menu and the clause library copy button. External so the pages work under a strict script-src 'self' policy. */
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.menu-btn');
  if (!btn) return;
  const nav = document.getElementById(btn.getAttribute('aria-controls'));
  if (!nav) return;
  btn.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
});
// Clause library: copy the sample wording as plain text, one paragraph per line.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest && e.target.closest('.copy-btn');
  if (!btn) return;
  const src = document.getElementById(btn.dataset.copy);
  const status = btn.parentElement.querySelector('.copy-status');
  if (!src) return;
  const text = [...src.querySelectorAll('p')].map((p) => p.textContent.trim()).join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    if (status) status.textContent = 'Copied to the clipboard.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(src);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    if (status) status.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected text.';
  }
});
