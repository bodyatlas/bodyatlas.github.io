/* Tiny DOM helpers: h() element builder, modals, toasts, confirm/prompt dialogs, relative dates. No framework. */

export function h(tag, props, ...children) {
  if (props && (props instanceof Node || typeof props !== 'object' || Array.isArray(props))) { children.unshift(props); props = null; }
  const m = /^([a-z0-9-]+)((?:[.#][\w-]+)*)$/i.exec(tag) || [null, tag, ''];
  const el = document.createElement(m[1] || 'div');
  const classes = [];
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) part[0] === '.' ? classes.push(part.slice(1)) : (el.id = part.slice(1));
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') classes.push(...String(v).split(/\s+/).filter(Boolean));
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'ref') v(el);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  if (classes.length) el.classList.add(...classes);
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const frag = (...children) => append(document.createDocumentFragment(), children);

const ICONS = {
  plus: 'M12 5v14M5 12h14', upload: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16', download: 'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', edit: 'M4 20h4l10-10-4-4L4 16v4zM13 7l4 4',
  copy: 'M8 8h12v12H8zM4 16V4h12', check: 'M5 12l5 5L20 7', x: 'M6 6l12 12M18 6L6 18', chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6', lock: 'M6 11h12v10H6zM9 11V7a3 3 0 016 0v4', unlock: 'M6 11h12v10H6zM9 11V7a3 3 0 015.8-1',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4', settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', up: 'M12 19V5m0 0l-6 6m6-6l6 6', down: 'M12 5v14m0 0l6-6m-6 6l-6-6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z', warn: 'M12 3l10 18H2zM12 9v5M12 17h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 11v6M12 7h.01', print: 'M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z',
  share: 'M4 12v8h16v-8M12 3v13m0-13l-4 4m4-4l4 4', key: 'M14 10a4 4 0 11-8 0 4 4 0 018 0zM14 10h7l-2 2 2 2', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4', sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
};
export function icon(name, size = 18) {
  const path = ICONS[name] || ICONS.info;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); s.append(p);
  s.classList.add('icon');
  return s;
}

// ---------------------------------------------------------------- toasts
let toastRoot;
export function toast(message, { type = 'info', timeout = 4000, action } = {}) {
  if (!toastRoot) { toastRoot = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(toastRoot); }
  const el = h('div.toast', { class: 'toast-' + type }, h('span', message), action ? h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => { action.onClick(); el.remove(); } }, action.label) : null,
    h('button.toast-close', { type: 'button', 'aria-label': 'Dismiss', onclick: () => el.remove() }, icon('x', 14)));
  toastRoot.append(el);
  if (timeout) setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); }, timeout);
  return el;
}

// ---------------------------------------------------------------- modals
let openModals = 0;
export function modal({ title, body, actions = [], size = 'md', onClose, closeLabel = 'Close', dismissible = true }) {
  const previouslyFocused = document.activeElement;
  let resolveClose;
  const closed = new Promise((r) => { resolveClose = r; });
  const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title-' + (++openModals), class: 'modal-' + size });
  const overlay = h('div.modal-overlay', { onclick: (e) => { if (e.target === overlay && dismissible) close(); } }, box);
  function close(result) {
    if (!overlay.isConnected) return;
    overlay.remove(); openModals--;
    document.body.classList.toggle('modal-open', openModals > 0);
    document.removeEventListener('keydown', onKey);
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose(result);
    resolveClose(result);
  }
  function onKey(e) {
    if (e.key === 'Escape' && dismissible) { e.preventDefault(); close(); }
    if (e.key === 'Tab') {  // focus trap
      const f = [...box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  const bodyEl = h('div.modal-body', typeof body === 'function' ? body({ close }) : body);
  box.append(
    h('div.modal-head', h('h2.modal-title', { id: box.getAttribute('aria-labelledby') }, title), dismissible ? h('button.btn.btn-ghost.btn-icon', { type: 'button', 'aria-label': closeLabel, onclick: () => close() }, icon('x')) : null),
    bodyEl,
    actions.length ? h('div.modal-actions', actions.map((a) => h('button.btn', { type: 'button', class: a.class || (a.primary ? 'btn-primary' : ''), disabled: a.disabled, onclick: async () => { const r = a.onClick ? await a.onClick({ close, body: bodyEl }) : undefined; if (r !== false && a.closes !== false) close(a.value ?? r); } }, a.label))) : null,
  );
  document.body.append(overlay); openModals++;
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { const f = box.querySelector('[autofocus], input, select, textarea, button.btn-primary, button'); if (f) f.focus(); });
  return { close, closed, element: box, body: bodyEl };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, cancelLabel = 'Cancel' }) {
  return modal({ title, body: h('p', message), actions: [{ label: cancelLabel, value: false }, { label: confirmLabel, primary: !danger, class: danger ? 'btn-danger' : 'btn-primary', value: true }] }).closed.then((r) => r === true);
}

export function promptDialog({ title, label, value = '', placeholder = '', type = 'text', confirmLabel = 'OK', help }) {
  let input;
  const m = modal({
    title,
    body: h('form.stack', { onsubmit: (e) => { e.preventDefault(); m.close(input.value); } },
      h('label.field', h('span.field-label', label), input = h('input.input', { type, value, placeholder, autofocus: true }), help ? h('span.field-help', help) : null)),
    actions: [{ label: 'Cancel', value: null }, { label: confirmLabel, primary: true, onClick: () => input.value }],
  });
  return m.closed;
}

// ---------------------------------------------------------------- misc
export function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (!Number.isFinite(diff)) return '';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(diff) < 60) return 'just now';
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 86400 * 14) return rtf.format(-Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}
export function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(multiple ? [...input.files] : input.files[0] || null); input.remove(); });
    document.body.append(input); input.click();
    // if the user cancels, clean up later; resolve null on focus return
    window.addEventListener('focus', () => setTimeout(() => { if (input.isConnected && !input.files.length) { resolve(null); input.remove(); } }, 500), { once: true });
  });
}
export function readFile(file, as = 'arrayBuffer') {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); as === 'text' ? r.readAsText(file) : r.readAsArrayBuffer(file); });
}
export function setTitle(t) { document.title = t ? `${t} · Clausery` : 'Clausery'; }
export function announce(msg) { let live = document.getElementById('sr-live'); if (!live) { live = h('div#sr-live.sr-only', { 'aria-live': 'polite' }); document.body.append(live); } live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 50); }

/** Replace an element's children; unlike Element.replaceChildren this flattens arrays and skips null/false. */
export function setChildren(el, ...children) { el.replaceChildren(); append(el, children); return el; }
