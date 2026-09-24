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

  // ------------------------------------------------------------------ materials: tissue shading
  /* Every part is a THREE.MeshPhysicalMaterial with a per-tissue preset (wet clearcoat on organs and vessels, fibrous sheen on
     tendons, peach-fuzz sheen + red wrap-lighting subsurface on skin, waxy fat, porous bone...) and a small shader patch that adds
     world-space procedural surface detail with no textures or UVs: bump (medium + fine noise), colour mottling, fibre striations
     (along the geometry's u axis, or azimuthal for hair), roughness variation and a wrap/back-light subsurface term.
     Detail fades automatically once its features are smaller than a pixel, so the whole body stays clean while close-ups get pores,
     fibres and lobules. All tissues share ONE shader program; presets only differ in uniforms and physical properties. */
  const TISSUE_GLSL = {
    pars: [
      'uniform vec4 uDetail;', // x medium freq (1/m), y medium amplitude (m), z fine freq, w fine amplitude
      'uniform vec4 uMottle;', // x freq, y brightness amount, z tint mix, w roughness variation
      'uniform vec3 uMottleTint;',  // tint of the positive mottle patches
      'uniform vec3 uMottleTint2;', // tint of the negative patches
      'uniform vec3 uTone;',        // albedo multiplier for the whole tissue
      'uniform vec4 uStria;',  // x bands across (per uv unit or per radian), y jitter along, z amplitude (m), w mode: 0 off, 1 along u (bands vary with v), 2 along v, 3 azimuthal about uStriaCenter
      'uniform vec3 uStriaCenter;',
      'uniform vec4 uSSS;',    // rgb subsurface colour, w wrap
      'varying vec3 vWPos;',
      'float ah3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.37, 0.73)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'float anoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(ah3(i), ah3(i + vec3(1,0,0)), f.x), mix(ah3(i + vec3(0,1,0)), ah3(i + vec3(1,1,0)), f.x), f.y),',
      '             mix(mix(ah3(i + vec3(0,0,1)), ah3(i + vec3(1,0,1)), f.x), mix(ah3(i + vec3(0,1,1)), ah3(i + vec3(1,1,1)), f.x), f.y), f.z); }',
      'float afbm(vec3 p){ return anoise(p) * 0.5 + anoise(p * 2.03 + 11.7) * 0.3 + anoise(p * 4.11 + 5.3) * 0.2; }',
      // fade factor for a feature of wavelength 1/freq when it gets smaller than ~1.5 px (fw = world size of one pixel)
      'float alod(float fw, float freq){ return 1.0 - smoothstep(0.25, 0.9, fw * freq); }',
      'float atlasHeight(vec3 P, float fw){',
      '  float h = 0.0;',
      '  if (uDetail.y > 0.0) h += uDetail.y * (afbm(P * uDetail.x) - 0.5) * alod(fw, uDetail.x);',
      '  if (uDetail.w > 0.0) h += uDetail.w * (anoise(P * uDetail.z + 7.3) - 0.5) * alod(fw, uDetail.z);',
      '  if (uStria.w > 0.5) {',
      '    vec2 c;',
      '    if (uStria.w < 1.5) c = vec2(vUv.y * uStria.x, vUv.x * uStria.y);',
      '    else if (uStria.w < 2.5) c = vec2(vUv.x * uStria.x, vUv.y * uStria.y);',
      '    else { vec3 d = P - uStriaCenter; c = vec2(atan(d.z, d.x) * uStria.x, d.y * uStria.y); }',
      '    float s = anoise(vec3(c, 0.37)) * 0.65 + anoise(vec3(c * 2.1 + 3.1, 1.9)) * 0.35;',
      '    float fwS = fw * uStria.x * (uStria.w > 2.5 ? 1.0 / max(1e-4, length(P - uStriaCenter)) : 0.0);',
      '    h += uStria.z * (s - 0.5) * (uStria.w > 2.5 ? alod(fwS, 1.0) : 1.0);',
      '  }',
      '  return h; }',
      'vec3 atlasPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){',
      '  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos); vec3 vN = surf_norm;',
      '  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);',
      '  float fDet = dot(vSigmaX, R1); fDet *= faceDirection;',
      '  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);',
      '  return normalize(abs(fDet) * surf_norm - vGrad); }'
    ].join('\n'),
    sss: [
      '#ifdef ATLAS_TISSUE',
      '  if (uSSS.w > 0.0) {',
      '    float w = uSSS.w;',
      '    float nl = dot(geometryNormal, directLight.direction);',
      '    float wrapped = saturate((nl + w) / ((1.0 + w) * (1.0 + w)));',
      '    float bleed = max(0.0, wrapped - dotNL);',
      '    vec3 lt = normalize(directLight.direction + geometryNormal * 0.3);',
      '    float back = pow(saturate(dot(geometryViewDir, -lt)), 4.0) * 0.35 * w;',
      '    reflectedLight.directDiffuse += directLight.color * (bleed + back) * uSSS.rgb * material.diffuseColor * RECIPROCAL_PI;',
      '  }',
      '#endif'
    ].join('\n'),
    start: [
      '#ifdef ATLAS_TISSUE',
      '  float atlasFw = length(fwidth(vWPos));',
      '  float atlasM = afbm(vWPos * uMottle.x + 3.7);',
      '#endif'
    ].join('\n'),
    color: [
      '#ifdef ATLAS_TISSUE',
      '  { float m = (atlasM - 0.5) * 2.0;',
      '    vec3 tint = mix(uMottleTint2, uMottleTint, smoothstep(-1.0, 1.0, m));',
      '    diffuseColor.rgb *= mix(vec3(1.0), tint, uMottle.z) * uTone * (1.0 + uMottle.y * m); }',
      '#endif'
    ].join('\n'),
    rough: [
      '#ifdef ATLAS_TISSUE',
      '  roughnessFactor = clamp(roughnessFactor * (1.0 + uMottle.w * (atlasM - 0.5) * 2.0), 0.03, 1.0);',
      '#endif'
    ].join('\n'),
    normal: [
      '#ifdef ATLAS_TISSUE',
      '  { float atlasH = atlasHeight(vWPos, atlasFw);',
      '    normal = atlasPerturb(-vViewPosition, normal, vec2(dFdx(atlasH), dFdy(atlasH)), faceDirection); }',
      '#endif'
    ].join('\n')
  };
  function tissueOnBeforeCompile(shader) {
    const u = this.atlasUniforms; if (u) for (const k in u) shader.uniforms[k] = u[k];
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const lp = THREE.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n' + TISSUE_GLSL.sss);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', TISSUE_GLSL.pars + '\n' + lp)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + TISSUE_GLSL.start)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + TISSUE_GLSL.color)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + TISSUE_GLSL.rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + TISSUE_GLSL.normal);
  }

  /* Presets. phys = MeshPhysicalMaterial properties; detail [medFreq, medAmp, fineFreq, fineAmp] (freq per metre, amplitude metres);
     mottle [freq, brightness, tintMix, roughnessVar] + tint; stria [across, along, amplitude, mode]; sss [r, g, b, wrap]. */
  const T = (o) => Object.assign({ phys: {}, detail: [300, 0, 900, 0], mottle: [40, 0.06, 0, 0.1], tint: [1, 1, 1], tint2: [1, 1, 1], tone: [1, 1, 1], stria: [0, 0, 0, 0], sss: [0, 0, 0, 0] }, o);
  H.TISSUES = {
    generic:   T({ phys: { roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, specularIntensity: 0.5 }, detail: [300, 0.00012, 1200, 0.00004], mottle: [45, 0.07, 0, 0.12] }),
    skin:      T({ phys: { roughness: 0.5, specularIntensity: 0.4, sheen: 0.45, sheenRoughness: 0.75, sheenColor: '#e8a98c', clearcoat: 0.08, clearcoatRoughness: 0.55 },
                   detail: [110, 0.0004, 1500, 0.00011], mottle: [26, 0.06, 0.75, 0.22], tint: [1.08, 0.86, 0.82], tint2: [0.94, 0.96, 1.02], tone: [1.0, 0.97, 0.95], sss: [0.95, 0.4, 0.3, 0.4] }),
    lip:       T({ phys: { roughness: 0.38, specularIntensity: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: '#ff9a8a' },
                   detail: [900, 0.00005, 2400, 0.00003], stria: [22, 3, 0.00004, 2], mottle: [80, 0.06, 0, 0.1], sss: [1.0, 0.35, 0.3, 0.45] }),
    hair:      T({ phys: { roughness: 0.55, specularIntensity: 0.6, sheen: 0.7, sheenRoughness: 0.5, sheenColor: '#7a5a48', clearcoat: 0.08, clearcoatRoughness: 0.4 },
                   detail: [400, 0.00012, 3000, 0.00006], stria: [420, 40, 0.00035, 3], center: [0, 1.66, -0.01], mottle: [70, 0.16, 0, 0.2], tone: [0.9, 0.88, 0.86] }),
    nail:      T({ phys: { roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, specularIntensity: 0.7 }, stria: [30, 4, 0.00003, 2], sss: [0.95, 0.55, 0.5, 0.35] }),
    fat:       T({ phys: { roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5, sheen: 0.25, sheenColor: '#f3d98a', specularIntensity: 0.45 },
                   detail: [160, 0.0005, 700, 0.0001], mottle: [55, 0.12, 0.5, 0.15], tint: [1.0, 0.94, 0.8], sss: [0.98, 0.85, 0.45, 0.45] }),
    fascia:    T({ phys: { roughness: 0.42, sheen: 0.55, sheenRoughness: 0.6, sheenColor: '#ffffff', specularIntensity: 0.55, clearcoat: 0.15 },
                   detail: [500, 0.00008, 1800, 0.00003], stria: [70, 5, 0.00007, 1], mottle: [60, 0.06, 0, 0.1], sss: [0.9, 0.85, 0.75, 0.15] }),
    muscle:    T({ phys: { roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.35, specularIntensity: 0.6, sheen: 0.12, sheenColor: '#ff7a7a' },
                   detail: [90, 0.00035, 900, 0.00006], stria: [64, 4, 0.0002, 1], mottle: [36, 0.1, 0.6, 0.2], tint: [0.84, 0.76, 0.8], tint2: [1.06, 0.96, 0.9], sss: [0.9, 0.22, 0.16, 0.28] }),
    heart:     T({ phys: { roughness: 0.36, clearcoat: 0.75, clearcoatRoughness: 0.28, specularIntensity: 0.7 },
                   detail: [120, 0.0003, 900, 0.00006], stria: [48, 3, 0.0001, 1], mottle: [30, 0.12, 0.55, 0.18], tint: [1.05, 0.92, 0.7], sss: [0.9, 0.25, 0.18, 0.3] }),
    bone:      T({ phys: { roughness: 0.6, specularIntensity: 0.4, sheen: 0.18, sheenRoughness: 0.8, sheenColor: '#fff2d6', clearcoat: 0.05 },
                   detail: [140, 0.00025, 800, 0.0001], mottle: [22, 0.12, 0.8, 0.22], tint: [1.0, 0.92, 0.76], tint2: [0.9, 0.9, 0.9], tone: [0.9, 0.86, 0.78], sss: [0.95, 0.85, 0.65, 0.2] }),
    tooth:     T({ phys: { roughness: 0.22, clearcoat: 0.85, clearcoatRoughness: 0.15, specularIntensity: 0.8 }, detail: [600, 0.00003, 2000, 0.00002], mottle: [90, 0.05, 0.3, 0.1], tint: [1.0, 0.95, 0.85], sss: [0.95, 0.9, 0.8, 0.4] }),
    cartilage: T({ phys: { roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.35, specularIntensity: 0.6 }, detail: [300, 0.00008, 1500, 0.00003], mottle: [50, 0.06, 0, 0.12], tone: [0.93, 0.95, 0.94], sss: [0.75, 0.9, 0.9, 0.45] }),
    vessel:    T({ phys: { roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.25, specularIntensity: 0.7 },
                   detail: [400, 0.00006, 1600, 0.00003], stria: [10, 3, 0.00006, 1], mottle: [70, 0.1, 0, 0.15], sss: [0.9, 0.25, 0.2, 0.32] }),
    nerve:     T({ phys: { roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.45, sheen: 0.35, sheenRoughness: 0.6, sheenColor: '#fff3c0', specularIntensity: 0.5 },
                   detail: [500, 0.00005, 1800, 0.00003], stria: [12, 3, 0.00008, 1], mottle: [60, 0.07, 0, 0.12], sss: [0.98, 0.88, 0.5, 0.3] }),
    brain:     T({ phys: { roughness: 0.42, clearcoat: 0.65, clearcoatRoughness: 0.35, specularIntensity: 0.65 },
                   detail: [220, 0.00015, 1000, 0.00004], mottle: [60, 0.1, 0.6, 0.15], tint: [1.04, 0.82, 0.78], sss: [0.92, 0.62, 0.52, 0.3] }),
    whiteMatter: T({ phys: { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4, specularIntensity: 0.55 }, detail: [300, 0.00008, 1200, 0.00003], mottle: [50, 0.05, 0, 0.1], sss: [0.95, 0.9, 0.8, 0.3] }),
    organ:     T({ phys: { roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.3, specularIntensity: 0.7 },
                   detail: [260, 0.00018, 1100, 0.00005], mottle: [42, 0.13, 0.55, 0.18], tint: [0.9, 0.8, 0.78], sss: [0.88, 0.32, 0.22, 0.3] }),
    liver:     T({ phys: { roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.28, specularIntensity: 0.7 },
                   detail: [700, 0.00006, 2000, 0.00003], mottle: [36, 0.09, 0.4, 0.15], tint: [0.85, 0.75, 0.7], sss: [0.85, 0.3, 0.2, 0.25] }),
    gut:       T({ phys: { roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.3, specularIntensity: 0.7 },
                   detail: [180, 0.0002, 900, 0.00005], stria: [90, 4, 0.00006, 2], mottle: [40, 0.12, 0.6, 0.18], tint: [1.0, 0.86, 0.82], sss: [0.92, 0.45, 0.35, 0.35] }),
    lung:      T({ phys: { roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.45, specularIntensity: 0.5 },
                   detail: [500, 0.00012, 1600, 0.00006], mottle: [90, 0.22, 0.7, 0.2], tint: [0.55, 0.5, 0.55], sss: [0.95, 0.6, 0.6, 0.3] }),
    gland:     T({ phys: { roughness: 0.44, clearcoat: 0.5, clearcoatRoughness: 0.4, specularIntensity: 0.6 },
                   detail: [450, 0.00014, 1400, 0.00004], mottle: [70, 0.12, 0.5, 0.15], tint: [0.92, 0.82, 0.75], sss: [0.95, 0.7, 0.45, 0.35] }),
    lymph:     T({ phys: { roughness: 0.46, clearcoat: 0.4, clearcoatRoughness: 0.45, specularIntensity: 0.5 }, detail: [500, 0.0001, 1500, 0.00003], mottle: [80, 0.1, 0, 0.12], sss: [0.8, 0.95, 0.75, 0.35] }),
    mucosa:    T({ phys: { roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.25, specularIntensity: 0.75 },
                   detail: [700, 0.0001, 2200, 0.00005], mottle: [60, 0.1, 0.5, 0.15], tint: [1.0, 0.8, 0.78], sss: [0.95, 0.4, 0.35, 0.4] }),
    membrane:  T({ phys: { roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, specularIntensity: 0.6 }, detail: [300, 0.00003, 1200, 0.00002], mottle: [50, 0.04, 0, 0.1], sss: [0.9, 0.85, 0.8, 0.35] }),
    sclera:    T({ phys: { roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, specularIntensity: 0.7 }, tone: [1.0, 0.985, 0.96],
                   detail: [1200, 0.00002, 3000, 0.00001], mottle: [260, 0.08, 0.7, 0.1], tint: [1.0, 0.72, 0.7], sss: [0.95, 0.8, 0.75, 0.3] }),
    iris:      T({ phys: { roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.2, specularIntensity: 0.6 }, stria: [90, 2, 0.00004, 2], mottle: [900, 0.18, 0.5, 0.2], tint: [0.7, 0.75, 0.85] }),
    glass:     T({ phys: { roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.05, specularIntensity: 1.0, ior: 1.38 } }),
    cornea:    T({ phys: { roughness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.04, specularIntensity: 1.0, ior: 1.376 }, opacity: 0.16, tone: [0.06, 0.06, 0.06] }),   // a clear film: highlight only, no diffuse haze
    film:      T({ phys: { roughness: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.1, specularIntensity: 0.4 }, opacity: 0.08, tone: [0.1, 0.1, 0.1] }),   // conjunctiva, aqueous humour: all but invisible
    dark:      T({ phys: { roughness: 0.95, clearcoat: 0, specularIntensity: 0.1 }, tone: [0.35, 0.35, 0.35], force: true })
  };
  // H.COLORS key -> tissue preset (used when a module passes one of the shared palette colours)
  H.TISSUE_BY_COLOR = {
    skin: 'skin', eyelid: 'skin', ear: 'skin', penis: 'skin', lip: 'lip', hair: 'hair', nail: 'nail', fat: 'fat',
    fascia: 'fascia', tendon: 'fascia', ligament: 'fascia', muscle: 'muscle', muscleDeep: 'muscle', heart: 'heart',
    bone: 'bone', ossicle: 'bone', cochlea: 'bone', tooth: 'tooth', cartilage: 'cartilage', larynx: 'cartilage', trachea: 'cartilage', bronchus: 'cartilage', marrow: 'organ',
    artery: 'vessel', vein: 'vessel', capillary: 'vessel', pericardium: 'membrane', pleura: 'membrane', meninges: 'membrane', ventricle: 'membrane', eardrum: 'membrane',
    nerve: 'nerve', spinalCord: 'nerve', brain: 'brain', whiteMatter: 'whiteMatter',
    lymph: 'lymph', lymphNode: 'lymph', tonsil: 'mucosa', thymus: 'gland', spleen: 'organ', lung: 'lung',
    liver: 'liver', gallbladder: 'organ', stomach: 'gut', smallIntestine: 'gut', colon: 'gut', esophagus: 'gut', pancreas: 'gland', tongue: 'mucosa', salivary: 'gland',
    kidney: 'organ', bladder: 'organ', ureter: 'gut', urethra: 'gut', adrenal: 'gland', gland: 'gland', thyroid: 'gland', pituitary: 'gland', pineal: 'gland', parathyroid: 'gland', mammary: 'gland',
    uterus: 'organ', ovary: 'organ', testis: 'organ', prostate: 'gland', vagina: 'mucosa',
    sclera: 'sclera', iris: 'iris', cornea: 'cornea', lens: 'glass', vitreous: 'glass', retina: 'membrane', choroid: 'organ', pupil: 'dark'
  };
  const TISSUE_BY_SYSTEM = { integumentary: 'skin', skeletal: 'bone', muscular: 'muscle', cardiovascular: 'vessel', respiratory: 'organ', digestive: 'gut', urinary: 'organ', reproductive: 'organ', nervous: 'nerve', endocrine: 'gland', lymphatic: 'lymph', sensory: 'generic' };
  const colorIndex = {};
  for (const k in H.COLORS) colorIndex[new THREE.Color(H.COLORS[k]).getHexString()] = k;
  H.tissueForColor = function (c) { try { const key = colorIndex[new THREE.Color(c).getHexString()]; return key ? H.TISSUE_BY_COLOR[key] || null : null; } catch (e) { return null; } };
  /* Guess the tissue of a part (the object stored in mesh.userData.part, or a viewer part record) from its material colour, tags, name and system. */
  H.guessTissue = function (part, mat) {
    const name = ((part && part.name) || '').toLowerCase(), id = ((part && part.id) || '').toLowerCase(), tags = (part && part.tags) || [];
    const has = (s) => name.indexOf(s) >= 0 || id.indexOf(s) >= 0;
    if (has('hair') || has('eyebrow') || has('eyelash')) return 'hair';
    if (has('nail')) return 'nail';
    if (has('lip') && !has('lipid')) return 'lip';
    if (has('tooth') || has('teeth') || has('incisor') || has('canine') || has('molar')) return 'tooth';
    if (has('cornea')) return 'cornea';
    if (has('conjunctiva') || has('aqueous') || has('anterior chamber')) return 'film';
    if (has('lens') || has('vitreous') || has('hyaloid')) return 'glass';
    if (has('sclera')) return 'sclera';
    if (has('iris')) return 'iris';
    if (has('pupil')) return 'dark';
    const fromColor = mat && mat.color ? H.tissueForColor(mat.color) : null;
    if (fromColor) return fromColor;
    if (tags.indexOf('skin') >= 0) return 'skin';
    if (tags.indexOf('muscle') >= 0) return 'muscle';
    if (has('tendon') || has('aponeurosis') || has('fascia') || has('ligament') || has('retinaculum') || has('capsule') || has('dura') || has('sheath')) return 'fascia';
    if (has('cartilage') || has('disc') || has('meniscus')) return 'cartilage';
    if (has('lung') || has('alveol') || has('bronch')) return 'lung';
    if (has('liver') || has('hepat')) return 'liver';
    if (has('brain') || has('cerebr') || has('cortex') || has('gyrus') || has('thalam') || has('hippocamp')) return 'brain';
    if (has('membrane') || has('pleura') || has('peritoneum') || has('pericardium') || has('mening') || has('serosa')) return 'membrane';
    if (has('fat') || has('adipose')) return 'fat';
    if (has('mucosa') || has('tongue') || has('palate') || has('gum')) return 'mucosa';
    if (part && part.system === 'nervous' && (part.layer === H.LAYER.ORGAN || part.region === 'head')) return has('nerve') ? 'nerve' : 'brain';
    if (part && part.system === 'respiratory' && part.layer === H.LAYER.ORGAN) return 'lung';
    if (part && part.system === 'cardiovascular' && has('heart')) return 'heart';
    return (part && TISSUE_BY_SYSTEM[part.system]) || 'generic';
  };
  function tissueUniforms(pre) {
    const c = pre.center || [0, 0, 0];
    return {
      uDetail: { value: new THREE.Vector4(pre.detail[0], pre.detail[1], pre.detail[2], pre.detail[3]) },
      uMottle: { value: new THREE.Vector4(pre.mottle[0], pre.mottle[1], pre.mottle[2], pre.mottle[3]) },
      uMottleTint: { value: new THREE.Vector3(pre.tint[0], pre.tint[1], pre.tint[2]) },
      uMottleTint2: { value: new THREE.Vector3(pre.tint2[0], pre.tint2[1], pre.tint2[2]) },
      uTone: { value: new THREE.Vector3(pre.tone[0], pre.tone[1], pre.tone[2]) },
      uStria: { value: new THREE.Vector4(pre.stria[0], pre.stria[1], pre.stria[2], pre.stria[3]) },
      uStriaCenter: { value: new THREE.Vector3(c[0], c[1], c[2]) },
      uSSS: { value: new THREE.Vector4(pre.sss[0], pre.sss[1], pre.sss[2], pre.sss[3]) }
    };
  }
  /* Apply a tissue preset to a material made by H.mat (physical properties + shader uniforms). Returns the material. */
  H.setTissue = function (mat, name) {
    const pre = H.TISSUES[name] || H.TISSUES.generic;
    const ph = pre.phys, keep = pre.force ? {} : (mat.userData.keep || {});
    if (mat.isMeshPhysicalMaterial) {
      if (keep.roughness == null) mat.roughness = ph.roughness == null ? 0.5 : ph.roughness;
      mat.clearcoat = ph.clearcoat || 0; mat.clearcoatRoughness = ph.clearcoatRoughness == null ? 0.4 : ph.clearcoatRoughness;
      mat.sheen = ph.sheen || 0; mat.sheenRoughness = ph.sheenRoughness == null ? 0.7 : ph.sheenRoughness; if (ph.sheenColor) mat.sheenColor.set(ph.sheenColor);
      mat.specularIntensity = ph.specularIntensity == null ? 0.5 : ph.specularIntensity; if (ph.ior) mat.ior = ph.ior;
      // transparent tissue keeps a low, glassy roughness so it reads as a wet film
      if (mat.transparent && mat.opacity < 0.7 && keep.roughness == null) mat.roughness = Math.min(mat.roughness, 0.3);
      if (pre.opacity != null) { mat.opacity = Math.min(mat.opacity, pre.opacity); mat.transparent = true; mat.depthWrite = false; mat.userData.baseOpacity = mat.opacity; }
    }
    mat.atlasUniforms = tissueUniforms(pre);
    mat.userData.tissue = name;
    mat.needsUpdate = true;
    return mat;
  };
  /* Clone a tissue material (three's clone drops onBeforeCompile), keeping the same preset and shared uniform objects. */
  H.tissueClone = function (mat) {
    const m = mat.clone();
    if (mat.atlasUniforms) { m.atlasUniforms = mat.atlasUniforms; m.onBeforeCompile = tissueOnBeforeCompile; m.defines = Object.assign({}, mat.defines); }
    m.userData.baseColor = mat.userData.baseColor; m.userData.baseOpacity = mat.userData.baseOpacity;
    return m;
  };
  /* H.mat(color | {color, roughness, metalness, opacity, transparent, side, flatShading, emissive, emissiveIntensity, depthWrite, tissue}) */
  H.mat = function (c) {
    const o = (typeof c === 'string' || typeof c === 'number') ? { color: c } : (c || {});
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(o.color || '#cccccc'), roughness: o.roughness == null ? 0.5 : o.roughness, metalness: o.metalness || 0,
      transparent: !!o.transparent || (o.opacity != null && o.opacity < 1), opacity: o.opacity == null ? 1 : o.opacity,
      side: o.side == null ? THREE.FrontSide : o.side, flatShading: !!o.flatShading, emissive: new THREE.Color(o.emissive || 0x000000), emissiveIntensity: o.emissiveIntensity == null ? 1 : o.emissiveIntensity
    });
    if (o.opacity != null && o.opacity < 1) m.depthWrite = o.depthWrite == null ? false : o.depthWrite;
    m.defines = Object.assign({}, m.defines, { ATLAS_TISSUE: '', USE_UV: '' });   // keep three's STANDARD/PHYSICAL defines
    m.onBeforeCompile = tissueOnBeforeCompile;
    m.userData.baseColor = m.color.getHex(); m.userData.baseOpacity = m.opacity;
    m.userData.keep = { roughness: o.roughness != null && o.roughness <= 0.2 ? o.roughness : null };   // explicit glassy roughness is intentional
    const t = o.tissue || H.tissueForColor(o.color || '#cccccc');
    if (t) H.setTissue(m, t); else { m.atlasUniforms = tissueUniforms(H.TISSUES.generic); m.userData.tissue = null; }
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
