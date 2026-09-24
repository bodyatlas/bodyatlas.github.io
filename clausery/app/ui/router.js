/* Hash router: routes are patterns like '/templates/:id'. */
export class Router {
  constructor() { this.routes = []; this.current = null; this.beforeLeave = null; window.addEventListener('hashchange', () => this.resolve()); }
  add(pattern, handler) { const keys = []; const rx = new RegExp('^' + pattern.replace(/:([\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); this.routes.push({ rx, keys, handler }); return this; }
  path() { return decodeURIComponent(location.hash.replace(/^#/, '') || '/'); }
  go(path, replace = false) { if (replace) history.replaceState(null, '', '#' + path); else location.hash = path; if (replace) this.resolve(); }
  async resolve() {
    const path = this.path();
    if (this.beforeLeave && this.current && this.current.path !== path) {
      const ok = await this.beforeLeave(path);
      if (!ok) { history.replaceState(null, '', '#' + this.current.path); return; }
      this.beforeLeave = null;
    }
    for (const r of this.routes) {
      const m = r.rx.exec(path);
      if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); this.current = { path, params }; await r.handler(params, path); return; }
    }
    this.current = { path, params: {} };
    if (this.notFound) await this.notFound(path);
  }
}
