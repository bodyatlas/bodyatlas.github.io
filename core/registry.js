/* core/registry.js - module registry. Each systems/<id>.js file calls
   ANATOMY.register('<id>', { name, description }, function (THREE, H, L, ctx) { ... return THREE.Group })
   ctx = { sex: 'male' | 'female', quality: 1 }. The returned group's descendants must ALL be H.part meshes (or Groups). */
(function (root) {
  const ANATOMY = root.ANATOMY || (root.ANATOMY = { modules: {}, order: [] });
  ANATOMY.register = function (id, meta, build) {
    if (typeof meta === 'function') { build = meta; meta = {}; }
    ANATOMY.modules[id] = { id, meta: Object.assign({ name: id, description: '' }, meta), build };
    if (ANATOMY.order.indexOf(id) < 0) ANATOMY.order.push(id);
  };
  ANATOMY.build = function (id, ctx) {
    const m = ANATOMY.modules[id]; if (!m) throw new Error('unknown module ' + id);
    const group = m.build(root.THREE, root.H, root.L, Object.assign({ sex: 'male', quality: 1 }, ctx || {}));
    if (!group || !group.isObject3D) throw new Error('module ' + id + ' must return a THREE.Object3D');
    if (!group.name) group.name = id;
    group.userData.module = id;
    group.traverse(o => { if (o.userData && o.userData.part) o.userData.part.module = id; });
    return group;
  };
  ANATOMY.buildAll = function (ctx, ids) { return (ids || ANATOMY.order).map(id => ANATOMY.build(id, ctx)); };
  // canonical list of module files (systems/<id>.js). Keep in sync with the files that exist.
  ANATOMY.MODULE_IDS = ['integumentary', 'skeletal', 'muscular_upper', 'muscular_lower', 'cardiovascular', 'respiratory', 'digestive',
    'urinary_reproductive', 'nervous_central', 'nervous_peripheral', 'glands', 'lymphatic', 'eye', 'ear'];
})(typeof window !== 'undefined' ? window : globalThis);
