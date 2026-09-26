// Minimal stand-in for the one lodash function docxtemplater's inspect module uses (deep merge).
function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
export function merge(target, ...sources) {
  for (const src of sources) {
    if (!isPlainObject(src)) continue;
    for (const key of Object.keys(src)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const a = target[key], b = src[key];
      if (isPlainObject(a) && isPlainObject(b)) merge(a, b);
      else if (isPlainObject(b)) target[key] = merge({}, b);
      else if (Array.isArray(b)) target[key] = b.slice();
      else target[key] = b;
    }
  }
  return target;
}
export function cloneDeep(v) {
  if (Array.isArray(v)) return v.map(cloneDeep);
  if (isPlainObject(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = cloneDeep(v[k]); return o; }
  return v;
}
export default { merge, cloneDeep };
