/* Hash router: routes are patterns like '/templates/:id'. */
export class Router {
  constructor() {
    this.routes = []; this.current = null; this.beforeLeave = null;
    window.addEventListener('hashchange', () => this.resolve());
    // in-page anchors (href="#main", the skip link) are not routes: move focus to the target instead of changing the hash
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || e.defaultPrevented) return;
      const id = a.getAttribute('href').slice(1);
      if (!id || id.startsWith('/')) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault(); el.focus({ preventScroll: true }); el.scrollIntoView();
    });
  }
  add(pattern, handler) { const keys = []; const rx = new RegExp('^' + pattern.replace(/:([\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); this.routes.push({ rx, keys, handler }); return this; }
  path() { return location.hash.replace(/^#/, '') || '/'; }
  go(path, replace = false) { if (replace) history.replaceState(null, '', '#' + path); else location.hash = path; if (replace) this.resolve(); }
  async resolve() {
    let path = this.path();
    if (!path.startsWith('/')) {
      if (this.current) return;   // a fragment such as #main: the browser scrolls to it, the view stays
      path = '/';                 // a bookmarked fragment on a cold load: land on the home route
    }
    // the guard stays installed: the callback decides on every navigation (it returns true when nothing is unsaved)
    if (this.beforeLeave && this.current && this.current.path !== path) {
      const ok = await this.beforeLeave(path);
      if (!ok) { history.replaceState(null, '', '#' + this.current.path); return; }
    }
    for (const r of this.routes) {
      const m = r.rx.exec(path);
      if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = decode(m[i + 1]); }); this.current = { path, params }; await r.handler(params, path); return; }
    }
    this.current = { path, params: {} };
    if (this.notFound) await this.notFound(path);
  }
}

/** Params are decoded once; a malformed escape (a mangled shared link) keeps the raw text instead of throwing. */
function decode(s) { try { return decodeURIComponent(s); } catch { return s; } }
