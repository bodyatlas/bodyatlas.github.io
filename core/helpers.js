/* core/helpers.js - shared geometry / material / part helpers. Works in the browser (window.THREE) and in
   node (globalThis.THREE = require('three')). Exposes root.H. Requires landmarks.js loaded first (root.L). */
(function (root) {
  const THREE = root.THREE;
  const H = {};

  // ------------------------------------------------------------------ enums
  H.LAYER = { SKIN: 1, FAT: 2, MUSCLE_SUPERFICIAL: 3, MUSCLE_DEEP: 4, VESSEL: 5, NERVE: 6, LYMPH: 7, ORGAN: 8, GLAND: 9, BONE: 10 };
  H.LAYER_NAMES = { 1: 'Skin', 2: 'Fat & fascia', 3: 'Superficial muscles', 4: 'Deep muscles', 5: 'Blood vessels', 6: 'Nerves', 7: 'Lymphatics', 8: 'Organs', 9: 'Glands', 10: 'Skeleton' };
  H.SYSTEMS = {
    integumentary: { name: 'Integumentary (skin)', color: '#d9a982' },
    skeletal: { name: 'Skeletal', color: '#e9dfc7' },
    muscular: { name: 'Muscular', color: '#b03a3a' },
    cardiovascular: { name: 'Cardiovascular', color: '#d3363b' },
    respiratory: { name: 'Respiratory', color: '#e2a5a5' },
    digestive: { name: 'Digestive', color: '#d9968f' },
    urinary: { name: 'Urinary', color: '#8b3b3b' },
    reproductive: { name: 'Reproductive', color: '#c76a7a' },
    nervous: { name: 'Nervous', color: '#e8d24a' },
    endocrine: { name: 'Endocrine & glands', color: '#e0a85c' },
    lymphatic: { name: 'Lymphatic & immune', color: '#79c27a' },
    sensory: { name: 'Sensory (eye & ear)', color: '#5a7a9a' }
  };
  H.REGIONS = ['head', 'neck', 'thorax', 'abdomen', 'pelvis', 'armL', 'armR', 'legL', 'legR', 'body'];
  H.COLORS = {
    skin: '#d9a982', fat: '#f0d27a', fascia: '#e8e6d8', muscle: '#b03a3a', muscleDeep: '#8f2f2f', tendon: '#e6e2d5',
    bone: '#e9dfc7', cartilage: '#c7d6d3', tooth: '#f4f1e8', ligament: '#d8d2c0', marrow: '#c9575a',
    artery: '#d3363b', vein: '#3b56c9', capillary: '#b65a6a', heart: '#b8323a', pericardium: '#e7d9d2',
    nerve: '#e8d24a', brain: '#d7b7a3', whiteMatter: '#efe6dc', spinalCord: '#e7dcc8', meninges: '#d9cfe8', ventricle: '#8fc7e8',
    lymph: '#79c27a', spleen: '#7b2f43', thymus: '#e3b8a3', lymphNode: '#8bd08c', tonsil: '#d99a9a',
    lung: '#e2a5a5', trachea: '#e8dccc', bronchus: '#e3cfc0', pleura: '#f3e4e4', larynx: '#d7dfd8',
    liver: '#8d3a2a', gallbladder: '#4f8a3a', stomach: '#d9968f', smallIntestine: '#d8a89a', colon: '#c98f7d',
    esophagus: '#d49c93', pancreas: '#e5c58c', tongue: '#d67b7b', salivary: '#e6c39a',
    kidney: '#8b3b3b', bladder: '#e0b89a', ureter: '#e3c0a6', urethra: '#e3c0a6', adrenal: '#e4b86f',
    gland: '#e0a85c', thyroid: '#c8654a', pituitary: '#e3a26e', pineal: '#c98a6a', parathyroid: '#e8c48a', mammary: '#e9cbb5',
    uterus: '#c76a7a', ovary: '#e0b6b0', testis: '#d9a29a', prostate: '#c88a86', penis: '#d9a982', vagina: '#c98a90',
    sclera: '#f3f1ee', iris: '#5a7a9a', cornea: '#dfeaf2', lens: '#f0efe6', retina: '#d16f4b', choroid: '#7a3b2a', vitreous: '#eaf2f7', pupil: '#111111',
    ear: '#d9b9a8', eardrum: '#e8d7c8', ossicle: '#f0eadc', cochlea: '#e3c9b1', hair: '#3a2a20', nail: '#e9c9bd', eyelid: '#d4a07c', lip: '#c9736a'
  };

  // ------------------------------------------------------------------ math
  H.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  H.lerp = (a, b, t) => a + (b - a) * t;
  H.smoothstep = (a, b, x) => { const t = H.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  H.V = (x, y, z) => new THREE.Vector3(x, y, z);
  H.v3 = (p) => (p && p.isVector3) ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]);
  H.mix3 = (a, b, t) => H.v3(a).lerp(H.v3(b), t);
  H.dist = (a, b) => H.v3(a).distanceTo(H.v3(b));
  H.mirror = (p) => (p && p.isVector3) ? new THREE.Vector3(-p.x, p.y, p.z) : [-p[0], p[1], p[2]];
  // deterministic value noise in [-1,1]
  const hash3 = (x, y, z) => { let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; };
  H.noise3 = function (x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
      l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
  };
  H.fbm = function (x, y, z, octaves = 3, lac = 2.0, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < octaves; i++) { s += a * H.noise3(x * f, y * f, z * f); norm += a; a *= gain; f *= lac; }
    return s / norm;
  };


  /* H.smoothNormals(g): computeVertexNormals, then average the normals of vertices that share a position
     (UV seams, sphere poles, lathe seams) so smooth organs show no shading seam. Leaves opposite-facing pairs alone. */
  H.smoothNormals = function (g) {
    g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    if (!nor || n < 3 || n > 400000) return g;
    const pa = pos.array, na = nor.array, q = 1e6, map = new Map(), next = new Int32Array(n).fill(-1);
    let dup = false;
    for (let i = 0; i < n; i++) {
      const x = Math.round(pa[i * 3] * q), y = Math.round(pa[i * 3 + 1] * q), z = Math.round(pa[i * 3 + 2] * q);
      const k = x * 73856093 ^ y * 19349663 ^ z * 83492791;
      let head = map.get(k), j = head;
      while (j !== undefined && j >= 0) { if (Math.round(pa[j * 3] * q) === x && Math.round(pa[j * 3 + 1] * q) === y && Math.round(pa[j * 3 + 2] * q) === z) break; j = next[j]; }
      if (j === undefined || j < 0) { next[i] = head === undefined ? -1 : head; map.set(k, i); }
      else { next[i] = next[j]; next[j] = i; dup = true; } // splice i into j's chain so the group is contiguous from j
    }
    if (!dup) return g;
    const seen = new Uint8Array(n), grp = [];
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      grp.length = 0; let sx = 0, sy = 0, sz = 0;
      const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
      for (let j = i; j >= 0; j = next[j]) { if (pa[j * 3] === x && pa[j * 3 + 1] === y && pa[j * 3 + 2] === z || (Math.abs(pa[j * 3] - x) < 2e-6 && Math.abs(pa[j * 3 + 1] - y) < 2e-6 && Math.abs(pa[j * 3 + 2] - z) < 2e-6)) { grp.push(j); } }
      if (grp.length < 2) { seen[i] = 1; continue; }
      for (const j of grp) { seen[j] = 1; sx += na[j * 3]; sy += na[j * 3 + 1]; sz += na[j * 3 + 2]; }
      const L = Math.hypot(sx, sy, sz); if (L < 0.3 * grp.length * 0.5) continue;
      sx /= L; sy /= L; sz /= L;
      for (const j of grp) { const d = na[j * 3] * sx + na[j * 3 + 1] * sy + na[j * 3 + 2] * sz; if (d < 0.2) continue; na[j * 3] = sx; na[j * 3 + 1] = sy; na[j * 3 + 2] = sz; }
    }
    nor.needsUpdate = true; return g;
  };

  // ------------------------------------------------------------------ geometry builders (all return BufferGeometry, +Y up)
  function superellipsePoint(t, rx, rz, n) {
    const c = Math.cos(t), s = Math.sin(t), e = 2 / n;
    return [rx * Math.sign(c) * Math.pow(Math.abs(c), e), rz * Math.sign(s) * Math.pow(Math.abs(s), e)];
  }
  function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }

  /* H.loft(sections, opts): smooth skin over stacked cross-sections.
     sections: [{ y, rx, rz, cx=0, cz=0, n=2, rot=0, r=[per-angle radius multipliers, length = radial] }] sorted by y (or by 't' along an axis, see opts.axis)
     opts: { radial=48, subdiv=6, capTop=true, capBottom=true, warp:(t,y,dir)=>scale, closed: false }
     Interpolates every parameter with Catmull-Rom so the surface is smooth between sections. Angle t=0 points +X, t=PI/2 points +Z (front). */
  H.loft = function (sections, opts = {}) {
    const radial = opts.radial || 48, subdiv = opts.subdiv == null ? 6 : opts.subdiv;
    const S = sections.map(s => ({ y: s.y, rx: s.rx, rz: s.rz == null ? s.rx : s.rz, cx: s.cx || 0, cz: s.cz || 0, n: s.n || 2, rot: s.rot || 0, r: s.r || null }));
    const stations = [];
    for (let i = 0; i < S.length - 1; i++) {
      const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)];
      const steps = (i === S.length - 2) ? subdiv + 1 : subdiv;
      for (let k = 0; k < steps; k++) {
        const t = k / subdiv;
        const st = {};
        for (const key of ['y', 'rx', 'rz', 'cx', 'cz', 'n', 'rot']) st[key] = catmull(p0[key], p1[key], p2[key], p3[key], t);
        st.rx = Math.max(1e-5, st.rx); st.rz = Math.max(1e-5, st.rz); st.n = Math.max(0.5, st.n);
        if (p1.r || p2.r) { const a = p0.r || p1.r || p2.r, b = p1.r || p2.r, c = p2.r || p1.r, d = p3.r || p2.r; st.r = b.map((_, j) => catmull(a[j], b[j], c[j], d[j], t)); }
        stations.push(st);
      }
    }
    const pos = [], uv = [], idx = [];
    const yMin = S[0].y, yMax = S[S.length - 1].y;
    stations.forEach((st, si) => {
      for (let j = 0; j <= radial; j++) {
        const t = (j % radial) / radial * Math.PI * 2 + st.rot;
        let [x, z] = superellipsePoint(t, st.rx, st.rz, st.n);
        let m = st.r ? st.r[j % radial] : 1;
        if (opts.warp) m *= opts.warp(j / radial, st.y, [Math.cos(t), Math.sin(t)]);
        x *= m; z *= m;
        pos.push(x + st.cx, st.y, z + st.cz);
        uv.push(j / radial, (st.y - yMin) / Math.max(1e-6, yMax - yMin));
      }
    });
    const ring = radial + 1;
    for (let s = 0; s < stations.length - 1; s++) for (let j = 0; j < radial; j++) {
      const a = s * ring + j, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    function cap(stationIndex, top) {
      const st = stations[stationIndex];
      const ci = pos.length / 3; pos.push(st.cx, st.y, st.cz); uv.push(0.5, 0.5);
      for (let j = 0; j < radial; j++) { const a = stationIndex * ring + j, b = a + 1; if (top) idx.push(ci, a, b); else idx.push(ci, b, a); }
    }
    if (opts.capBottom !== false) cap(0, false);
    if (opts.capTop !== false) cap(stations.length - 1, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    H.smoothNormals(g);
    if (opts.axis) H.reaxis(g, opts.axis);
    return g;
  };
  // rotate a +Y-built geometry so its axis points along 'x' | 'z' | '-x' | '-z' | '-y' or an arbitrary [x,y,z] direction
  H.reaxis = function (g, axis) {
    const dir = typeof axis === 'string' ? ({ x: [1, 0, 0], '-x': [-1, 0, 0], z: [0, 0, 1], '-z': [0, 0, -1], '-y': [0, -1, 0], y: [0, 1, 0] })[axis] : axis;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), H.v3(dir).normalize());
    g.applyQuaternion(q); return g;
  };

  /* H.tube(points, radius, opts): smooth tube along a Catmull-Rom curve through points ([x,y,z] or Vector3).
     radius: number or function(t 0..1) => number. opts: { radial=12, step=0.008 (m per segment) | tubular, closed=false, caps=true, tension=0.5, curveType='centripetal' } */
  H.tube = function (points, radius, opts = {}) {
    const pts = points.map(H.v3);
    if (pts.length < 2) throw new Error('tube needs >= 2 points');
    const curve = new THREE.CatmullRomCurve3(pts, !!opts.closed, opts.curveType || 'centripetal', opts.tension == null ? 0.5 : opts.tension);
    const len = curve.getLength();
    const tubular = opts.tubular || Math.max(4, Math.min(600, Math.round(len / (opts.step || 0.008))));
    const radial = opts.radial || 12;
    const rf = typeof radius === 'function' ? radius : () => radius;
    const frames = curve.computeFrenetFrames(tubular, !!opts.closed);
    const pos = [], uv = [], idx = [];
    const P = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular; curve.getPointAt(t, P);
      const r = Math.max(1e-5, rf(t)); const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
        pos.push(P.x + r * (cx * N.x + sx * B.x), P.y + r * (cx * N.y + sx * B.y), P.z + r * (cx * N.z + sx * B.z));
        uv.push(t, j / radial);
      }
    }
    const ring = radial + 1;
    for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1; idx.push(a, b, c, b, d, c);
    }
    if (opts.caps !== false && !opts.closed) {
      for (const end of [0, tubular]) {
        curve.getPointAt(end / tubular, P); const ci = pos.length / 3; pos.push(P.x, P.y, P.z); uv.push(end ? 1 : 0, 0.5);
        for (let j = 0; j < radial; j++) { const a = end * ring + j, b = a + 1; if (end) idx.push(ci, a, b); else idx.push(ci, b, a); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); H.smoothNormals(g);
    g.userData.curve = curve;
    return g;
  };
  H.curvePoint = (points, t) => new THREE.CatmullRomCurve3(points.map(H.v3), false, 'centripetal').getPointAt(t);

  /* H.blob(r, opts): deformed sphere. r: number or [rx, ry, rz]. opts: { ws=48, hs=32, deform:(p:Vector3 unit-sphere point) => number (radius scale) | Vector3 (absolute position) , noise: {amp, freq} } */
  H.blob = function (r, opts = {}) {
    const g = new THREE.SphereGeometry(1, opts.ws || 48, opts.hs || 32);
    const [rx, ry, rz] = Array.isArray(r) ? r : [r, r, r];
    const pos = g.attributes.position, p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      let s = 1;
      if (opts.noise) { const nf = opts.noise.freq || 3, na = opts.noise.amp || 0.05; s += na * H.fbm(p.x * nf + 7.1, p.y * nf + 3.3, p.z * nf + 1.7, opts.noise.oct || 2); }
      if (opts.deform) { const d = opts.deform(p.clone(), i); if (typeof d === 'number') s *= d; else if (d && d.isVector3) { pos.setXYZ(i, d.x, d.y, d.z); continue; } }
      pos.setXYZ(i, p.x * rx * s, p.y * ry * s, p.z * rz * s);
    }
    H.smoothNormals(g); return g;
  };
  H.ellipsoid = (rx, ry, rz, opts = {}) => H.blob([rx, ry, rz], opts);
  H.sphere = (r, ws = 32, hs = 24) => new THREE.SphereGeometry(r, ws, hs);
  H.capsule = (r, length, opts = {}) => new THREE.CapsuleGeometry(r, length, opts.capSegments || 8, opts.radial || 24); // axis Y, centred, total height = length + 2r
  H.lathe = (profile, opts = {}) => { const pts = profile.map(p => new THREE.Vector2(p[0], p[1])); const g = new THREE.LatheGeometry(pts, opts.segments || 32, opts.phiStart || 0, opts.phiLength == null ? Math.PI * 2 : opts.phiLength); H.smoothNormals(g); return g; };
  H.box = (w, h, d, seg = 1) => new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  H.torus = (R, r, opts = {}) => new THREE.TorusGeometry(R, r, opts.radial || 12, opts.tubular || 48, opts.arc == null ? Math.PI * 2 : opts.arc);
  H.cylinder = (rTop, rBottom, h, seg = 24, open = false) => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
  H.cone = (r, h, seg = 24) => new THREE.ConeGeometry(r, h, seg);

  /* H.longBone({from, to, r, rEnd1, rEnd2, bow}) : shaft with flared ends spanning from->to. */
  H.longBone = function (o) {
    const a = H.v3(o.from), b = H.v3(o.to), len = a.distanceTo(b);
    const r = o.r, r1 = o.rEnd1 || r * 2.2, r2 = o.rEnd2 || r * 1.9;
    const prof = [[0, 0], [r2 * 0.6, 0], [r2, r2 * 0.4], [r2 * 0.85, r2 * 1.3], [r * 1.05, r2 * 2.4], [r, len * 0.5], [r * 1.05, len - r1 * 2.4], [r1 * 0.85, len - r1 * 1.3], [r1, len - r1 * 0.4], [r1 * 0.6, len], [0, len]];
    const g = H.lathe(prof, { segments: o.segments || 20 });
    if (o.bow) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const s = Math.sin(y / len * Math.PI); p.setX(i, p.getX(i) + o.bow[0] * s); p.setZ(i, p.getZ(i) + (o.bow[1] || 0) * s); } H.smoothNormals(g); }
    return H.span(g, a, b);
  };
  // move a +Y geometry spanning y in [0, len] so it runs from a to b (no scaling; build it with the right length)
  H.span = function (g, a, b) {
    a = H.v3(a); b = H.v3(b);
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g;
  };
  // capsule/cylinder-like segment between two points with radius r (or [rA, rB])
  H.segment = function (a, b, r, opts = {}) {
    a = H.v3(a); b = H.v3(b); const len = a.distanceTo(b);
    const [ra, rb] = Array.isArray(r) ? r : [r, r];
    const g = opts.capsule === false ? H.cylinder(rb, ra, len, opts.radial || 16) : H.lathe([[0, 0], [ra * 0.7, -ra * 0.7], [ra, 0], [rb, len], [rb * 0.7, len + rb * 0.7], [0, len + rb]], { segments: opts.radial || 16 });
    if (opts.capsule === false) g.translate(0, len / 2, 0);
    return H.span(g, a, b);
  };

  // ------------------------------------------------------------------ geometry ops (in place unless noted)
  H.transform = function (g, o = {}) {
    const m = new THREE.Matrix4();
    const pos = o.pos ? H.v3(o.pos) : new THREE.Vector3();
    const rot = o.rot ? (o.rot.isEuler ? o.rot : new THREE.Euler(o.rot[0], o.rot[1], o.rot[2])) : new THREE.Euler();
    const sc = o.scale == null ? new THREE.Vector3(1, 1, 1) : (typeof o.scale === 'number' ? new THREE.Vector3(o.scale, o.scale, o.scale) : H.v3(o.scale));
    m.compose(pos, new THREE.Quaternion().setFromEuler(rot), sc);
    g.applyMatrix4(m); return g;
  };
  H.translate = (g, x, y, z) => { if (Array.isArray(x)) { g.translate(x[0], x[1], x[2]); } else g.translate(x, y, z); return g; };
  // point the geometry's +Y axis along dir (unit or not), about the origin
  H.aim = (g, dir) => { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), H.v3(dir).normalize()); g.applyQuaternion(q); return g; };
  // displace vertices: fn(p:Vector3, n:Vector3, i) => number (offset along normal) | Vector3 (new position)
  H.displace = function (g, fn) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
      const d = fn(p.clone(), n.clone(), i);
      if (typeof d === 'number') pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d);
      else if (d && d.isVector3) pos.setXYZ(i, d.x, d.y, d.z);
    }
    H.smoothNormals(g); return g;
  };
  // mirror a geometry across the YZ plane (x -> -x) returning a NEW geometry with correct winding
  H.mirrorX = function (g) {
    const m = g.clone();
    m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    if (m.index) { const a = m.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } m.index.needsUpdate = true; }
    else { const p = m.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; } }
    if (m.index) H.smoothNormals(m); else m.computeVertexNormals(); m.userData = Object.assign({}, g.userData); return m;
  };
  // merge geometries into one (non-indexed). Keeps position/normal/uv.
  H.merge = function (geoms) {
    const list = geoms.filter(Boolean).map(g => g.index ? g.toNonIndexed() : g);
    const hasUv = list.length > 0 && list.every(g => g.attributes.uv);
    const hasCol = list.length > 0 && list.every(g => g.attributes.color && g.attributes.color.itemSize === 3);
    let nv = 0; for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); nv += g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = hasUv ? new Float32Array(nv * 2) : null, C = hasCol ? new Float32Array(nv * 3) : null;
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      P.set(g.attributes.position.array.subarray(0, c * 3), o * 3); N.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (U) U.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
      if (C) C.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    return out;
  };
  H.bbox = (g) => { g.computeBoundingBox(); return g.boundingBox; };
  H.center = (g) => { const b = H.bbox(g); return b.getCenter(new THREE.Vector3()); };

  // ------------------------------------------------------------------ materials
  H.mat = function (c) {
    const o = (typeof c === 'string' || typeof c === 'number') ? { color: c } : (c || {});
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(o.color || '#cccccc'), roughness: o.roughness == null ? 0.6 : o.roughness, metalness: o.metalness || 0,
      transparent: !!o.transparent || (o.opacity != null && o.opacity < 1), opacity: o.opacity == null ? 1 : o.opacity,
      side: o.side == null ? THREE.FrontSide : o.side, flatShading: !!o.flatShading, emissive: new THREE.Color(o.emissive || 0x000000), emissiveIntensity: o.emissiveIntensity == null ? 1 : o.emissiveIntensity
    });
    if (o.opacity != null && o.opacity < 1) m.depthWrite = o.depthWrite == null ? false : o.depthWrite;
    m.userData.baseColor = m.color.getHex(); m.userData.baseOpacity = m.opacity;
    return m;
  };

  // ------------------------------------------------------------------ parts
  /* H.part(spec) -> THREE.Mesh tagged with userData.part.
     spec: { id (unique slug), name, latin, system (H.SYSTEMS key), layer (H.LAYER value), depth (0..0.95, finer peel order inside the layer, default 0),
             side ('L'|'R'|'M'), region (H.REGIONS), geometry | mesh, material | color, info: { description, function, size, notes }, parent (id of enclosing part/group), tags: [] ,
             pos, rot, scale (applied to the mesh) } */
  H.part = function (s) {
    for (const k of ['id', 'name', 'system', 'layer', 'region']) if (s[k] == null) throw new Error('H.part: missing ' + k + ' for ' + JSON.stringify(s.id || s.name));
    if (!s.geometry && !s.mesh) throw new Error('H.part: geometry or mesh required for ' + s.id);
    if (!H.SYSTEMS[s.system]) throw new Error('H.part: unknown system ' + s.system + ' for ' + s.id);
    if (H.REGIONS.indexOf(s.region) < 0) throw new Error('H.part: unknown region ' + s.region + ' for ' + s.id);
    const mesh = s.mesh || new THREE.Mesh(s.geometry, s.material || H.mat(s.color || H.SYSTEMS[s.system].color));
    if (s.pos) mesh.position.copy(H.v3(s.pos));
    if (s.rot) mesh.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
    if (s.scale != null) { if (typeof s.scale === 'number') mesh.scale.setScalar(s.scale); else mesh.scale.copy(H.v3(s.scale)); }
    mesh.name = s.id;
    mesh.userData.part = {
      id: s.id, name: s.name, latin: s.latin || '', system: s.system, layer: s.layer, depth: s.depth || 0, side: s.side || 'M', region: s.region,
      info: Object.assign({ description: '', function: '', size: '', notes: '' }, s.info || {}), parent: s.parent || null, tags: s.tags || []
    };
    return mesh;
  };
  // convenience: build the LEFT part and a mirrored RIGHT part. spec.id/name should not include the side; they are suffixed.
  H.pair = function (spec, opts = {}) {
    const left = H.part(Object.assign({}, spec, { id: spec.id + '-l', name: 'Left ' + spec.name, side: 'L', region: spec.region || 'body' }));
    const rg = H.mirrorX(spec.geometry);
    const right = H.part(Object.assign({}, spec, { id: spec.id + '-r', name: 'Right ' + spec.name, side: 'R', geometry: rg, region: opts.regionR || (spec.region === 'armL' ? 'armR' : spec.region === 'legL' ? 'legR' : spec.region) }));
    if (spec.pos) { right.position.x = -right.position.x; }
    return [left, right];
  };
  H.group = function (name, children = []) { const g = new THREE.Group(); g.name = name; children.forEach(c => { if (Array.isArray(c)) c.forEach(x => g.add(x)); else if (c) g.add(c); }); return g; };
  H.parts = function (obj) { const out = []; obj.traverse(o => { if (o.userData && o.userData.part) out.push(o); }); return out; };

  root.H = H;
})(typeof window !== 'undefined' ? window : globalThis);
