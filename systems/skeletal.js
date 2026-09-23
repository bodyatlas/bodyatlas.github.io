/* systems/skeletal.js - Skeletal system: skull bones, 32 teeth, vertebrae + discs, sacrum/coccyx, sternum, ribs + costal
   cartilage, shoulder girdle, upper limb, pelvis, lower limb, hands, feet, articular cartilage and femoral marrow.
   Everything is positioned from core/landmarks.js (L). Layer BONE (10); cartilage/discs depth 0.1, marrow depth 0.5. */
ANATOMY.register('skeletal', { name: 'Skeletal', description: 'Bones of the skull, spine, thorax and limbs with teeth, discs, cartilage and marrow' }, function (THREE, H, L, ctx) {
  const g = H.group('skeletal');
  const V3 = H.v3, PI = Math.PI, C = H.COLORS, clamp = H.clamp, lerp = H.lerp;
  const mm = x => Math.round(x * 1000);
  const info = (description, fn, size, notes) => ({ description, function: fn, size, notes });

  // ------------------------------------------------------------ part helpers
  function add(s) { const m = H.part(Object.assign({ system: 'skeletal', layer: H.LAYER.BONE, color: C.bone, side: 'M' }, s)); g.add(m); return m; }
  // mirror that keeps smooth normals (H.mirrorX recomputes normals, which faceted merged/non-indexed geometry)
  function mirrorGeo(src) {
    const m = src.clone(); m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    if (m.index) { const a = m.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } m.index.needsUpdate = true; }
    else for (const k in m.attributes) { const at = m.attributes[k], s = at.itemSize, arr = at.array; for (let i = 0; i < at.count; i += 3) for (let c = 0; c < s; c++) { const t = arr[(i + 1) * s + c]; arr[(i + 1) * s + c] = arr[(i + 2) * s + c]; arr[(i + 2) * s + c] = t; } }
    return m;
  }
  function addPair(s) {
    const base = Object.assign({ system: 'skeletal', layer: H.LAYER.BONE, color: C.bone }, s), reg = s.region || 'body';
    const l = H.part(Object.assign({}, base, { id: s.id + '-l', name: 'Left ' + s.name, side: 'L', region: reg }));
    const r = H.part(Object.assign({}, base, { id: s.id + '-r', name: 'Right ' + s.name, side: 'R', geometry: mirrorGeo(s.geometry), region: reg === 'armL' ? 'armR' : reg === 'legL' ? 'legR' : reg }));
    g.add(l); g.add(r); return [l, r];
  }
  // local frame: +Y along a->b, +X toward hint xh (orthogonalised), origin a
  function frame(a, b, xh) {
    a = V3(a); const Y = V3(b).sub(a).normalize(), X = V3(xh || [1, 0, 0]);
    X.addScaledVector(Y, -X.dot(Y)); if (X.lengthSq() < 1e-9) { X.set(0, 0, 1); X.addScaledVector(Y, -Y.z); }
    X.normalize(); const Z = new THREE.Vector3().crossVectors(X, Y);
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(a);
  }
  const place = (geo, a, b, xh) => geo.applyMatrix4(frame(a, b, xh));
  const merge = list => H.merge(list);
  function blob(r, p, o = {}) {
    const geo = H.blob(r, { ws: o.ws || 14, hs: o.hs || 10, deform: o.deform, noise: o.noise });
    if (o.rot) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rot[0], o.rot[1], o.rot[2])));
    if (p) geo.translate(p[0], p[1], p[2]); return geo;
  }
  function indexed(pos, idx) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo; }
  const rough = (geo, amp, f) => H.displace(geo, p => amp * H.fbm(p.x * f + 3.1, p.y * f + 1.7, p.z * f + 5.3, 2));
  /* sweep(points, sec(t)->[a,b,offA,offB] | r, {radial, step, segs, up:[..]|fn(t), n, shape(t,ang), closed, caps})
     a = half-width along S (sideways), b = half-width along U (the 'up' reference projected off the tangent). */
  function sweep(pts, sec, o = {}) {
    const closed = !!o.closed, curve = new THREE.CatmullRomCurve3(pts.map(V3), closed, 'centripetal');
    const segs = o.segs || clamp(Math.round(curve.getLength() / (o.step || 0.005)), 3, 160);
    const rad = o.radial || 10, e = 2 / (o.n || 2), nr = closed ? segs : segs + 1;
    const pos = [], idx = [], centers = [], P = new THREE.Vector3(), T = new THREE.Vector3(), U = new THREE.Vector3(), S = new THREE.Vector3();
    for (let i = 0; i < nr; i++) {
      const t = i / segs; curve.getPointAt(t, P); curve.getTangentAt(t, T);
      const up = typeof o.up === 'function' ? o.up(t) : (o.up || [0, 1, 0]);
      U.set(up[0], up[1], up[2]); U.addScaledVector(T, -U.dot(T));
      if (U.lengthSq() < 1e-8) { U.set(1, 0, 0); U.addScaledVector(T, -U.dot(T)); if (U.lengthSq() < 1e-8) U.set(0, 0, 1); }
      U.normalize(); S.crossVectors(U, T).normalize();
      let s = typeof sec === 'function' ? sec(t) : sec; if (!Array.isArray(s)) s = [s, s];
      const a = s[0], b = s[1], oa = s[2] || 0, ob = s[3] || 0;
      centers.push([P.x + S.x * oa + U.x * ob, P.y + S.y * oa + U.y * ob, P.z + S.z * oa + U.z * ob]);
      for (let j = 0; j < rad; j++) {
        const ang = j / rad * PI * 2, c = Math.cos(ang), sn = Math.sin(ang), m = o.shape ? o.shape(t, ang) : 1;
        const ca = Math.sign(c) * Math.pow(Math.abs(c), e) * a * m + oa, sb = Math.sign(sn) * Math.pow(Math.abs(sn), e) * b * m + ob;
        pos.push(P.x + S.x * ca + U.x * sb, P.y + S.y * ca + U.y * sb, P.z + S.z * ca + U.z * sb);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const i2 = (i + 1) % nr, A = i * rad + j, B = i * rad + (j + 1) % rad, Cc = i2 * rad + j, D = i2 * rad + (j + 1) % rad;
      idx.push(A, B, Cc, B, D, Cc);
    }
    if (!closed && o.caps !== false) [0, segs].forEach(end => { const ci = pos.length / 3; pos.push(...centers[end]); for (let j = 0; j < rad; j++) { const A = end * rad + j, B = end * rad + (j + 1) % rad; if (end) idx.push(ci, A, B); else idx.push(ci, B, A); } });
    return indexed(pos, idx);
  }
  /* plate(fn(u,v)->[x,y,z], thick(u,v)->t | [front,back], nu, nv): thickened parametric sheet, closed with rims */
  function plate(fn, thick, nu, nv) {
    const G = [], pos = [], idx = [], du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= nu; i++) { G.push([]); for (let j = 0; j <= nv; j++) G[i].push(V3(fn(i / nu, j / nv))); }
    const Bk = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      du.subVectors(G[Math.min(nu, i + 1)][j], G[Math.max(0, i - 1)][j]); dv.subVectors(G[i][Math.min(nv, j + 1)], G[i][Math.max(0, j - 1)]);
      n.crossVectors(du, dv); if (n.lengthSq() < 1e-16) n.set(0, 0, 1); n.normalize();
      const t = thick(i / nu, j / nv), tf = Array.isArray(t) ? t[0] : t / 2, tb = Array.isArray(t) ? t[1] : t / 2, p = G[i][j];
      pos.push(p.x + n.x * tf, p.y + n.y * tf, p.z + n.z * tf); Bk.push(p.x - n.x * tb, p.y - n.y * tb, p.z - n.z * tb);
    }
    const off = pos.length / 3; pos.push(...Bk);
    const fi = (i, j) => i * (nv + 1) + j;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = fi(i, j), b = fi(i + 1, j), c = fi(i + 1, j + 1), d = fi(i, j + 1);
      idx.push(a, b, c, a, c, d, a + off, c + off, b + off, a + off, d + off, c + off);
    }
    for (let i = 0; i < nu; i++) {
      let f0 = fi(i, 0), f1 = fi(i + 1, 0); idx.push(f0, f0 + off, f1, f1, f0 + off, f1 + off);
      f0 = fi(i, nv); f1 = fi(i + 1, nv); idx.push(f0, f1, f0 + off, f1, f1 + off, f0 + off);
    }
    for (let j = 0; j < nv; j++) {
      let f0 = fi(0, j), f1 = fi(0, j + 1); idx.push(f0, f1, f0 + off, f1, f1 + off, f0 + off);
      f0 = fi(nu, j); f1 = fi(nu, j + 1); idx.push(f0, f0 + off, f1, f1, f0 + off, f1 + off);
    }
    return indexed(pos, idx);
  }
  const crv = pts => new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
  const cp = (c, t) => { const p = c.getPoint(clamp(t, 0, 1)); return [p.x, p.y, p.z]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const skinBackZ = y => { const s = L.trunkAt(y); return s.cz - s.rz; };
  // humeral head centre + radius: the deltoid skin cap tops out ~2 cm above L.joint.shoulderL, so the head (and with it the
  // glenoid, labrum and cartilage) sits 7 mm below the landmark with a 21 mm radius to stay under the skin.
  const SHC = [L.joint.shoulderL[0], L.joint.shoulderL[1] - 0.007, L.joint.shoulderL[2]], HHR = 0.021;

  // ============================================================ VERTEBRAL COLUMN
  const canalR = nm => nm[0] === 'C' ? 0.009 : nm[0] === 'T' ? 0.008 : 0.01;
  // the back skin has a 5 mm deep midline furrow between the erector spinae (integumentary trunkRelief), so near x = 0 the posterior
  // elements must stay >= 1.7 mm in front of it; at T7-T9 the canal lies only ~10 mm from the skin, so the laminae are flattened against it
  const furrow = y => 0.005 * H.smoothstep(0.98, 1.05, y) * (1 - H.smoothstep(1.42, 1.46, y));
  const backLim = (x, y) => skinBackZ(y) + furrow(y) * Math.exp(-((x / 0.012) ** 2)) + 0.0022 + 0.0007 * (1 - H.smoothstep(1.0, 1.12, y));
  function clampBack(geo) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { const lim = backLim(p.getX(i), p.getY(i)); if (p.getZ(i) < lim) { p.setZ(i, lim); if (n) n.setXYZ(i, 0, 0, -1); } }
    return geo;
  }
  const tpSpan = { C1: 0.036, C2: 0.026, C3: 0.025, C4: 0.025, C5: 0.026, C6: 0.027, C7: 0.03, T1: 0.034, T2: 0.033, T3: 0.032, T4: 0.031, T5: 0.03, T6: 0.03, T7: 0.029, T8: 0.029, T9: 0.028, T10: 0.027, T11: 0.024, T12: 0.021, L1: 0.03, L2: 0.033, L3: 0.035, L4: 0.034, L5: 0.033 };
  function tpTip(nm, sx) {
    const v = L.spine[nm], cn = L.canal(nm), s = tpSpan[nm] * sx;
    if (nm[0] === 'C') return [s, v.y - 0.001, nm === 'C1' ? v.z - 0.012 : v.z - 0.003];
    if (nm[0] === 'T') return [s, v.y + 0.003, cn.z - 0.004];
    return [s, v.y, cn.z + 0.004];
  }
  function bodyGeo(v) {
    const R = 16, r = []; for (let j = 0; j < R; j++) r.push(1 - 0.16 * Math.pow(Math.max(0, -Math.sin(j / R * PI * 2)), 3));
    const y0 = v.y - v.h / 2, y1 = v.y + v.h / 2, w = v.w / 2, d = v.d / 2;
    const geo = H.loft([{ y: y0, rx: w * 0.9, rz: d * 0.9, cz: v.z, r }, { y: y0 + 0.0012, rx: w, rz: d, cz: v.z, r }, { y: v.y, rx: w * 0.93, rz: d * 0.94, cz: v.z, r },
      { y: y1 - 0.0012, rx: w, rz: d, cz: v.z, r }, { y: y1, rx: w * 0.9, rz: d * 0.9, cz: v.z, r }], { radial: R, subdiv: 2 });
    return rough(geo, 0.0003, 400);
  }
  function vertebraGeo(nm) {
    const v = L.spine[nm], cn = L.canal(nm), T = nm[0], k = +nm.slice(1), rc = canalR(nm);
    const Ra = rc + 0.0032, th = T === 'C' ? 0.0022 : T === 'T' ? 0.0026 : 0.003, ah = v.h * 0.32, list = [];
    const fb = { ws: 8, hs: 6 };
    if (nm === 'C1') {
      const y = v.y, ring = [[0, y, v.z + 0.011], [0.011, y, v.z + 0.008], [0.018, y, v.z - 0.004], [0.017, y, cn.z + 0.002], [0.011, y, cn.z - Ra + 0.002], [0, y, cn.z - Ra - 0.001]];
      const full = ring.concat(ring.slice(1, 5).reverse().map(p => [-p[0], p[1], p[2]]));
      list.push(sweep(full, [0.0028, 0.0045], { radial: 8, closed: true, step: 0.004 }));
      for (const sx of [1, -1]) { list.push(blob([0.0065, 0.0075, 0.009], [sx * 0.016, y, v.z - 0.005], fb)); list.push(sweep([[sx * 0.018, y, v.z - 0.006], tpTip(nm, sx)], [0.003, 0.003], { radial: 8, segs: 4 })); }
      list.push(blob([0.004, 0.004, 0.003], [0, y, v.z + 0.013], fb)); list.push(blob([0.004, 0.0035, 0.003], [0, y, cn.z - Ra - 0.003], fb));
      return merge(list);
    }
    list.push(bodyGeo(v));
    if (nm === 'C2') { list.push(sweep([[0, v.y + 0.004, v.z + 0.002], [0, 1.584, v.z + 0.004], [0, 1.594, v.z + 0.0045]], t => 0.0048 * (1 - 0.35 * t * t), { radial: 10 })); list.push(blob(0.0042, [0, 1.594, v.z + 0.0045], fb)); }
    const zb = v.z - v.d / 2 + 0.003, arch = [[Ra * 0.8, v.y, zb]];
    for (let i = 0; i <= 8; i++) { const ph = (50 + i * 32.5) * PI / 180; arch.push([Ra * Math.sin(ph), v.y, cn.z + Ra * Math.cos(ph)]); }
    arch.push([-Ra * 0.8, v.y, zb]);
    list.push(sweep(arch, [th, ah], { radial: 8 }));
    const tip = L.spinousTip(nm); let ty = tip.y, tz = tip.z;
    if (T === 'T') ty -= 0.02 * Math.sin(PI * (k - 0.5) / 12);                 // thoracic spines slope downward
    tz = Math.max(tz, T === 'C' ? skinBackZ(ty) + (k === 7 ? 0.0095 : 0.008) : backLim(0, ty) + 0.0035);   // keep the tip (3 mm knob) under the skin
    const root = [0, v.y + (T === 'T' ? 0.003 : 0), cn.z - Ra], sh = T === 'L' ? 0.009 : T === 'T' ? 0.005 : (nm === 'C7' ? 0.005 : 0.004);
    list.push(sweep([root, mix(root, [0, ty, tz], 0.5), [0, ty, tz]], t => [0.0022 * (1 - 0.25 * t), sh * (0.75 + 0.25 * t)], { radial: 8, n: 2.4 }));
    if (T === 'C' && k < 7) for (const sx of [1, -1]) list.push(blob(0.0026, [sx * 0.003, ty, tz], fb)); else list.push(blob([0.003, sh * 0.9, 0.003], [0, ty, tz], fb));
    for (const sx of [1, -1]) {
      const tp = tpTip(nm, sx), base = [sx * Ra * 0.95, v.y, cn.z + (T === 'C' ? 0.005 : 0)];
      list.push(sweep([base, tp], t => T === 'L' ? [0.0022, 0.0036 * (1 - 0.3 * t)] : [0.0026 * (1 - 0.2 * t), 0.0028], { radial: 8, segs: 4 }));
      if (T === 'T') list.push(blob(0.0031, tp, fb));
      list.push(sweep([[sx * Ra * 0.88, v.y - v.h * 0.5, cn.z - 0.002], [sx * Ra * 0.88, v.y + v.h * 0.5, cn.z + 0.003]], [0.0032, 0.0027], { radial: 8, segs: 3, up: [0, 0, 1] }));   // articular pillar (superior + inferior facets)
    }
    return merge(list);
  }
  const vText = {
    C: ['A cervical (neck) vertebra: small oval body, large triangular canal and transverse processes pierced by foramina for the vertebral artery.', 'Supports the head and gives the neck its wide range of flexion, extension and rotation.', 'Cervical vertebrae C3–C6 have short bifid (forked) spinous processes.'],
    T: ['A thoracic vertebra: heart-shaped body with costal facets for the ribs, long spinous process angled downward and sturdy transverse processes.', 'Anchors the ribs and protects the spinal cord while allowing limited rotation of the chest.', 'Overlapping, downward-sloping spines limit extension of the thoracic spine.'],
    L: ['A lumbar vertebra: the largest vertebral bodies, kidney-shaped, with short hatchet-shaped spinous processes and long thin transverse processes.', 'Bears most of the upper-body weight and allows bending forward and backward.', 'Lumbar discs (L4–L5, L5–S1) are the commonest site of disc herniation and sciatica.']
  };
  const vSpecial = {
    C1: ['The atlas: a bony ring with no body and no spinous process; two lateral masses carry the occipital condyles of the skull.', 'Supports the skull and allows nodding at the atlanto-occipital joints.', 'Named after the Titan Atlas who held up the heavens.'],
    C2: ['The axis: carries the dens (odontoid peg), which projects up through the ring of the atlas and is held by the transverse ligament.', 'Acts as the pivot for about half of all head rotation.', 'A "hangman\'s fracture" breaks both pedicles of C2.'],
    C7: ['Vertebra prominens: the last cervical vertebra, with a long non-bifid spinous process easily felt at the base of the neck.', 'Transitions the flexible cervical spine to the rigid thoracic spine and anchors the nuchal ligament.', 'Its spine is the usual landmark for counting vertebrae on the back.']
  };
  for (const nm of L.spineOrder) {
    if (nm === 'S1') continue;
    const v = L.spine[nm], T = nm[0], t = vSpecial[nm] || vText[T];
    add({ id: 'vertebra-' + nm.toLowerCase(), name: nm + ' vertebra', latin: 'Vertebra ' + (T === 'C' ? 'cervicalis' : T === 'T' ? 'thoracica' : 'lumbalis') + ' ' + nm,
      region: T === 'C' ? (nm === 'C1' || nm === 'C2' ? 'head' : 'neck') : T === 'T' ? 'thorax' : 'abdomen', geometry: T === 'C' ? vertebraGeo(nm) : clampBack(vertebraGeo(nm)), tags: ['spine', 'vertebra'],
      info: info(t[0], t[1], `Body ${mm(v.w)} mm wide × ${mm(v.d)} mm deep × ${mm(v.h)} mm tall; canal ≈ ${mm(canalR(nm) * 2)} mm`, t[2]) });
  }
  // intervertebral discs
  for (let i = 1; i < L.spineOrder.length - 1; i++) {
    const na = L.spineOrder[i], nb = L.spineOrder[i + 1], a = L.spine[na], b = L.spine[nb];
    const yT = a.y - a.h / 2 + 0.0004, yB = b.y + b.h / 2 - 0.0004, w = (a.w + b.w) / 4, d = (a.d + b.d) / 4, R = 16, r = [];
    for (let j = 0; j < R; j++) r.push(1 - 0.16 * Math.pow(Math.max(0, -Math.sin(j / R * PI * 2)), 3));
    const geo = H.loft([{ y: yB, rx: w, rz: d, cz: b.z, r }, { y: (yT + yB) / 2, rx: w * 1.05, rz: d * 1.05, cz: (a.z + b.z) / 2, r }, { y: yT, rx: w, rz: d, cz: a.z, r }], { radial: R, subdiv: 2 });
    add({ id: `disc-${na.toLowerCase()}-${nb.toLowerCase()}`, name: `Intervertebral disc ${na}–${nb}`, latin: 'Discus intervertebralis', depth: 0.1, color: C.cartilage,
      region: na[0] === 'C' ? 'neck' : na[0] === 'T' ? 'thorax' : 'abdomen', geometry: geo, tags: ['spine', 'disc', 'cartilage'],
      info: info(`Fibrocartilage cushion between the ${na} and ${nb} vertebral bodies: a tough ring (annulus fibrosus) around a gel core (nucleus pulposus).`, 'Absorbs shock and lets adjacent vertebrae rock and twist on each other.',
        `≈ ${mm(w * 2)} × ${mm(d * 2)} mm, ${Math.max(1, mm(yT - yB))} mm thick here (discs make up ~25% of spinal length)`, 'Discs lose water with age, which is why people get slightly shorter; a torn annulus lets the nucleus herniate onto a nerve root.') });
  }
  // sacrum
  {
    const s = L.spine.sacrum, y0 = L.spine.S1.y + L.spine.S1.h / 2, ts = [0, 0.25, 0.5, 0.75, 1], rx = [0.0525, 0.046, 0.034, 0.02, 0.009], rz = [0.016, 0.013, 0.01, 0.007, 0.004];
    const czf = t => lerp(s.zTop, s.zBottom, t) - 0.008 * Math.sin(PI * t);
    const geo = H.loft(ts.map((t, i) => ({ y: lerp(y0, s.bottom, 1 - t) , rx: rx[4 - i], rz: rz[4 - i], cz: czf(1 - t), n: 2.6 })), { radial: 28, subdiv: 4 });
    H.displace(geo, (p, n) => {
      let d = 0; for (let i = 0; i < 4; i++) for (const sx of [1, -1]) { const fy = lerp(y0, s.bottom, 0.17 + 0.19 * i), fx = sx * (0.02 - 0.0025 * i); d -= 0.003 * Math.exp(-((p.x - fx) ** 2 + (p.y - fy) ** 2) / 0.000016); }
      if (n.z < -0.4 && Math.abs(p.x) < 0.005) d += 0.003 * (1 - Math.abs(p.x) / 0.005);
      return d;
    });
    const sap = [1, -1].map(sx => blob([0.006, 0.006, 0.005], [sx * 0.017, y0 + 0.002, czf(0) - 0.017], { ws: 8, hs: 6 }));
    add({ id: 'sacrum', name: 'Sacrum', latin: 'Os sacrum', region: 'pelvis', geometry: merge([geo].concat(sap)), tags: ['spine', 'pelvis'],
      info: info('Wedge-shaped bone of five fused sacral vertebrae, curved concave-forward, with four pairs of sacral foramina and a median crest behind.', 'Transmits the weight of the trunk to the hip bones through the sacroiliac joints and forms the back wall of the pelvis.',
        `≈ ${mm(s.w)} mm wide at the base, ${mm(s.top - s.bottom)} mm tall`, 'The sacral promontory (front edge of S1) is an obstetric landmark for measuring the pelvic inlet.') });
    const cz = L.spine.coccyx;
    const cg = sweep([[0, cz.top + 0.002, s.zBottom], [0, 0.868, cz.z + 0.001], [0, 0.856, cz.z + 0.003], [0, cz.bottom, cz.z + 0.01]], t => [0.011 * (1 - 0.72 * t) * (1 + 0.1 * Math.cos(8 * PI * t)), 0.004 * (1 - 0.5 * t)], { radial: 10, up: [0, 0, 1] });
    add({ id: 'coccyx', name: 'Coccyx', latin: 'Os coccygis', region: 'pelvis', geometry: cg, tags: ['spine', 'pelvis'],
      info: info('The tailbone: three to five small rudimentary vertebrae fused into a tapering, forward-curving triangle.', 'Anchors the gluteus maximus, the anococcygeal ligament and pelvic-floor muscles.', `≈ ${mm(cz.top - cz.bottom + 0.005)} mm long`, 'It is the vestigial remnant of a tail; a fall on the buttocks can bruise or fracture it (coccydynia).') });
  }

  // ============================================================ THORAX: sternum, ribs, costal cartilage
  const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 0; i < tab.length - 1; i++) if (x <= tab[i + 1][0]) return lerp(tab[i][1], tab[i + 1][1], (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0])); return tab[tab.length - 1][1]; };
  const sternFront = y => { const s = L.trunkAt(y); return s.rz + s.cz - 0.03; };
  const sternHW = y => interp([[1.19, 0.002], [1.2, 0.0055], [1.221, 0.008], [1.224, 0.01], [1.235, 0.012], [1.26, 0.0155], [1.29, 0.017], [1.33, 0.0155], [1.366, 0.014], [1.372, 0.0155], [1.395, 0.02], [1.415, 0.027], [1.435, 0.025]], y);
  const sternHT = y => y > 1.37 ? 0.0068 : y > 1.222 ? 0.0055 : 0.0028;
  function sternLoft(ys, notch) {
    const geo = H.loft(ys.map(y => ({ y, rx: sternHW(y), rz: sternHT(y), cz: sternFront(y) - sternHT(y), n: 2.8 })), { radial: 20, subdiv: 3 });
    if (notch) H.displace(geo, p => p.y > 1.428 && Math.abs(p.x) < 0.011 ? new THREE.Vector3(p.x, p.y - 0.005 * (1 - (p.x / 0.011) ** 2) * (p.y - 1.428) / 0.007, p.z) : 0);
    return rough(geo, 0.0003, 300);
  }
  add({ id: 'sternum-manubrium', name: 'Manubrium of sternum', latin: 'Manubrium sterni', region: 'thorax', geometry: sternLoft([1.371, 1.38, 1.395, 1.415, 1.428, L.y.sternalNotch], true), tags: ['thorax', 'sternum'],
    info: info('The broad upper part of the breastbone, with the jugular notch on top and notches for the clavicles and first ribs.', 'Anchors the clavicles (sternoclavicular joints) and the first two pairs of costal cartilages.', '≈ 50 mm wide, 60 mm tall, 12 mm thick', 'Its joint with the sternal body forms the sternal angle (of Louis), the landmark for the 2nd rib and the tracheal bifurcation.') });
  add({ id: 'sternum-body', name: 'Body of sternum', latin: 'Corpus sterni', region: 'thorax', geometry: sternLoft([1.222, 1.235, 1.26, 1.29, 1.33, 1.366, 1.3695]), tags: ['thorax', 'sternum'],
    info: info('The long flat middle part of the breastbone, formed from four fused segments (sternebrae), with notches for costal cartilages 2–7.', 'Forms the front of the rib cage and shields the heart; ribs 2–7 attach to it through their cartilages.', '≈ 100 mm long, 25–35 mm wide, 10 mm thick', 'Red marrow persists here throughout life, so it is a site for bone-marrow aspiration; it is split for open-heart surgery.') });
  add({ id: 'sternum-xiphoid', name: 'Xiphoid process', latin: 'Processus xiphoideus', region: 'thorax', geometry: sternLoft([1.19, 1.2, 1.21, 1.2212]), tags: ['thorax', 'sternum'],
    info: info('Small pointed tail of the sternum, cartilaginous in youth and gradually ossifying in adults.', 'Gives attachment to the diaphragm, the linea alba and the rectus abdominis.', '≈ 30 mm long', 'Hand position for chest compressions is kept above it because a broken xiphoid can injure the liver.') });

  const cageW = [[1.08, 0.125], [1.14, 0.14], [1.2, 0.152], [1.26, 0.162], [1.31, 0.162], [1.35, 0.152], [1.38, 0.134], [1.41, 0.112], [1.44, 0.086], [1.47, 0.062]];
  const cageCW = y => Math.min(interp(cageW, y), L.trunkAt(y).rx - 0.02);
  function wall(y, th) { // rib-cage wall (LEFT side): th 0 = posterior midline, PI/2 = lateral, PI = anterior midline
    const s = L.trunkAt(y), cw = cageCW(y), rz = th < PI / 2 ? s.rz - 0.016 : s.rz - 0.034, e = 2 / 2.2, sn = Math.sin(th), c = Math.cos(th);
    return [cw * Math.pow(Math.abs(sn), e), y, s.cz - rz * Math.sign(c) * Math.pow(Math.abs(c), e)];
  }
  const frontZ = (x, y) => { const s = L.trunkAt(y), cw = cageCW(y); return s.cz + (s.rz - 0.034) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, x / cw), 2.2)), 1 / 2.2); };
  const ribDrop = [0.035, 0.045, 0.05, 0.055, 0.058, 0.06, 0.06, 0.06, 0.058, 0.055, 0.05, 0.04];
  const ribEnd = [0.8, 0.8, 0.79, 0.78, 0.765, 0.75, 0.73, 0.69, 0.65, 0.61, 0.5, 0.4];
  const sternY = [1.418, 1.37, 1.345, 1.318, 1.29, 1.262, 1.235];
  const cartPaths = [];
  const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
  for (let N = 1; N <= 12; N++) {
    const nm = 'T' + N, T = L.spine[nm], tp = tpTip(nm, 1);
    const head = [0.011, T.y + T.h * 0.45, T.z - T.d * 0.3], tub = [tp[0] - 0.002, tp[1] - 0.001, tp[2] + 0.004];
    const thA = 0.15 * PI, thE = ribEnd[N - 1] * PI, pts = [head, tub];
    for (let i = 0; i < 6; i++) { const f = i / 5, th = lerp(thA, thE, f); pts.push(wall(tub[1] - ribDrop[N - 1] * Math.pow(f, 1.3), th)); }
    const flat = N === 1 ? [0.0056, 0.0028] : N === 2 ? [0.0042, 0.004] : [0.003, 0.0055], floating = N > 10;
    const geo = sweep(pts, t => { const k = t < 0.08 ? 1 - t / 0.08 : 0, taper = floating ? 1 - 0.55 * t : 1 + 0.2 * t; return [lerp(flat[0], 0.0036, k), lerp(flat[1], 0.0036, k) * taper]; }, { radial: 8, step: 0.006 });
    const cls = N <= 7 ? 'true (vertebrosternal) rib' : N <= 10 ? 'false (vertebrochondral) rib' : 'floating rib';
    addPair({ id: 'rib-' + N, name: ordinal[N - 1] + ' rib', latin: 'Costa ' + (N <= 7 ? 'vera' : N <= 10 ? 'spuria' : 'fluitans') + ' ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][N - 1], region: N === 12 ? 'abdomen' : 'thorax', geometry: geo, tags: ['thorax', 'rib'],
      info: info(`The ${ordinal[N - 1]} rib, a ${cls}: a curved flattened bar whose head articulates with T${N}${N > 1 && N < 10 ? ' and the vertebra above' : ''}, its tubercle with the T${N} transverse process, sloping down and forward to its costal cartilage.`,
        N === 1 ? 'Forms the rim of the thoracic inlet; the subclavian artery and vein and the brachial plexus cross its upper surface.' : 'Protects the thoracic organs and moves up and out with the intercostal muscles during breathing (bucket-handle motion).',
        `Cross-section ≈ 6 × 11 mm; arc length ≈ ${Math.round(sweepLen(pts) * 100)} cm`, N === 1 ? 'A cervical rib or tight first rib can compress the brachial plexus (thoracic outlet syndrome).' : N > 10 ? 'Floating ribs end free in the flank muscles and have no anterior attachment.' : 'Rib fractures are most common at the angle of the rib, the weakest point of the curve.') });
    const E = pts[pts.length - 1];
    let cpts;
    if (N <= 7) {
      const yS = sternY[N - 1], S = [sternHW(yS) - 0.001, yS, sternFront(yS) - sternHT(yS)], mx = (E[0] + S[0]) / 2, my = lerp(E[1], S[1], 0.6);
      cpts = [E, [mx, my, frontZ(mx, my)], S];
    } else if (N <= 10) {
      const tgt = cp(crv(cartPaths[N - 2]), [0.45, 0.4, 0.35][N - 8]); tgt[1] -= 0.004;
      const mx = lerp(E[0], tgt[0], 0.55), my = lerp(E[1], tgt[1], 0.6);
      cpts = [E, [mx, my, frontZ(mx, my)], tgt];
    } else cpts = [E, wall(E[1] - 0.002, thE + 0.012 * PI), wall(E[1] - 0.004, thE + 0.024 * PI)];
    cartPaths.push(cpts);
    const cg = sweep(cpts, t => N > 10 ? [0.003 * (1 - 0.5 * t), 0.0045 * (1 - 0.5 * t)] : [0.003, N === 1 ? 0.006 : 0.0055 * (1 - 0.15 * t)], { radial: 8, step: 0.006 });
    addPair({ id: 'costal-cartilage-' + N, name: ordinal[N - 1] + ' costal cartilage', latin: 'Cartilago costalis', region: N === 12 ? 'abdomen' : 'thorax', geometry: cg, color: C.cartilage, depth: 0.1, tags: ['thorax', 'cartilage'],
      info: info(`Bar of hyaline cartilage continuing the ${ordinal[N - 1]} rib ${N <= 7 ? 'to the sternum' : N <= 10 ? 'to the cartilage above, forming the costal margin' : '(a short free tip)'}.`, 'Gives the rib cage the elasticity it needs for breathing and to absorb blows.',
        `≈ ${Math.round(sweepLen(cpts) * 100)} cm long`, 'Costal cartilage often calcifies with age, stiffening the chest wall; inflammation of the costochondral joints (costochondritis) mimics heart pain.') });
  }
  function sweepLen(p) { return crv(p).getLength(); }

  // ============================================================ SHOULDER GIRDLE
  {
    const cl = L.bone.clavicleL, lat = [0.195, 1.4255, -0.013];   // lateral end meets the acromion just under the low shoulder skin
    const cpts = [cl.medial, [0.05, 1.435, 0.067], [0.1, 1.437, 0.05], [0.145, 1.4325, 0.02], [0.176, 1.424, -0.002], lat];
    const geo = sweep(cpts, t => [t < 0.15 ? lerp(0.0095, 0.0065, t / 0.15) : t < 0.65 ? 0.0065 : lerp(0.0065, 0.0115, (t - 0.65) / 0.35), t < 0.15 ? lerp(0.0105, 0.0058, t / 0.15) : t < 0.65 ? 0.0058 : lerp(0.0058, 0.0042, (t - 0.65) / 0.35)], { radial: 12, step: 0.005 });
    addPair({ id: 'clavicle', name: 'clavicle', latin: 'Clavicula', region: 'thorax', geometry: rough(geo, 0.0003, 250), tags: ['shoulder'],
      info: info('The collarbone: an S-shaped strut, convex forward in its medial two-thirds and concave forward laterally, between the sternum and the acromion.', 'Holds the shoulder out from the trunk so the arm can swing freely and transmits forces from the arm to the axial skeleton.', '≈ 15 cm long, 1–2 cm thick', 'The most frequently fractured bone, usually at the junction of its middle and lateral thirds after a fall on the outstretched hand.') });
    // scapula
    const IA = [0.082, 1.245, -0.094], SA = [0.07, 1.425, -0.094], LA = [0.145, 1.405, -0.056];
    const Mb = crv([[IA[0] - 0.003, IA[1] + 0.004, IA[2]], [0.066, 1.3, -0.1], [0.066, 1.385, -0.099], SA]), Lb = crv([[IA[0] + 0.004, IA[1] + 0.006, IA[2]], [0.105, 1.3, -0.088], [0.135, 1.375, -0.066], LA, [0.13, 1.42, -0.066]]);
    const blade = plate((u, v) => { const p = mix(cp(Mb, u), cp(Lb, u), v); p[2] -= 0.004 * Math.sin(PI * u) * Math.sin(PI * v); return p; }, (u, v) => 0.0025 + 0.0045 * v ** 6 + 0.006 * v ** 4 * u ** 6 + 0.003 * Math.max(0, 1 - u * 6), 16, 10);
    // spine rises laterally and swings forward into the acromion, which arches over the back/top of the humeral head just under the skin
    const spine = sweep([[0.068, 1.382, -0.101], [0.1, 1.392, -0.097], [0.13, 1.4, -0.086], [0.155, 1.405, -0.071], [0.17, 1.407, -0.058], [0.179, 1.4095, -0.047]],
      t => { const b = t < 0.7 ? 0.0035 + 0.004 * t : lerp(0.0063, 0.0035, (t - 0.7) / 0.3); return [0.0022 + 0.001 * t, b, 0, b * 0.8]; }, { radial: 8, up: t => [0, 0.35 + t, -1] });
    const acromion = sweep([[0.178, 1.406, -0.048], [0.188, 1.416, -0.0405], [0.198, 1.4235, -0.029], [0.2035, 1.4265, -0.018]], t => [0.0075 + 0.0035 * Math.sin(PI * t), 0.0032 * (1 - 0.25 * t)], { radial: 12 });
    const G = V3(SHC).add(V3([-0.8, 0, -0.6]).multiplyScalar(HHR + 0.0025));
    const glen = blob([0.0035, 0.018, 0.012], [G.x - 0.0016, G.y, G.z - 0.0012], { rot: [0, -0.6435, 0], deform: p => p.x > 0 ? 0.45 + 0.55 * (p.y * p.y + p.z * p.z) : 1 });
    const neck = sweep([LA, [G.x - 0.0048, G.y, G.z - 0.0036]], [0.008, 0.0105], { radial: 10, segs: 3 });
    const cor = sweep([[0.14, 1.41, -0.058], [0.143, 1.421, -0.042], [0.152, 1.423, -0.022], [0.162, 1.416, -0.005]], t => 0.0055 * (1 - 0.35 * t), { radial: 8 });
    addPair({ id: 'scapula', name: 'scapula', latin: 'Scapula', region: 'thorax', geometry: merge([blade, spine, acromion, glen, neck, cor]), tags: ['shoulder'],
      info: info('The shoulder blade: a thin triangular plate over ribs 2–7 with a posterior spine ending in the acromion, a hook-like coracoid process in front and the shallow glenoid cavity for the humeral head.', 'Provides the socket of the shoulder joint and attachment for 17 muscles, gliding over the chest wall to extend the arm\'s reach.',
        '≈ 15–17 cm tall, 10 cm wide; glenoid ≈ 35 × 25 mm', 'Winging of the scapula signals paralysis of serratus anterior (long thoracic nerve injury).') });
  }

  // ============================================================ UPPER LIMB
  // spherical cap shell (articular cartilage): radius r, thickness t, half-angle ang, pole along dir, centred at c
  function capShell(r, t, ang, dir, c, seg) {
    const prof = [], n = 10;
    for (let i = 0; i <= n; i++) { const a = ang * i / n; prof.push([(r - t) * Math.sin(a), (r - t) * Math.cos(a)]); }
    for (let i = n; i >= 0; i--) { const a = ang * i / n; prof.push([r * Math.sin(a), r * Math.cos(a)]); }
    const geo = H.lathe(prof, { segments: seg || 24 }); H.aim(geo, dir); geo.translate(c[0], c[1], c[2]); return geo;
  }
  function spool(len, r, groove) { const geo = H.lathe([[0, -len / 2], [r * 0.85, -len / 2], [r, -len * 0.32], [r * (1 - groove), 0], [r, len * 0.32], [r * 0.85, len / 2], [0, len / 2]], { segments: 14 }); geo.rotateZ(-PI / 2); return geo; }
  // small tubular bone (metacarpal/metatarsal 'mc', proximal/middle phalanx 'pp', distal phalanx 'dp') from a to b, radius scale s
  function smallBone(a, b, s, kind) {
    const len = V3(a).distanceTo(V3(b));
    const secs = kind === 'dp' ? [{ y: 0, rx: 0.9 * s, rz: 0.75 * s }, { y: 0.14 * len, rx: s, rz: 0.8 * s }, { y: 0.5 * len, rx: 0.6 * s, rz: 0.5 * s }, { y: 0.84 * len, rx: 0.78 * s, rz: 0.42 * s }, { y: len, rx: 0.45 * s, rz: 0.3 * s }]
      : [{ y: 0, rx: 0.95 * s, rz: 0.85 * s }, { y: 0.1 * len, rx: 1.05 * s, rz: 0.95 * s }, { y: 0.32 * len, rx: 0.66 * s, rz: 0.6 * s }, { y: 0.68 * len, rx: 0.62 * s, rz: 0.58 * s }, { y: 0.9 * len, rx: kind === 'mc' ? 0.95 * s : 0.88 * s, rz: kind === 'mc' ? 0.95 * s : 0.75 * s, n: 2.3 }, { y: len, rx: 0.55 * s, rz: 0.55 * s }];
    return place(H.loft(secs, { radial: 10, subdiv: 2 }), a, b, [1, 0, 0]);
  }
  {
    const E = L.joint.elbowL, S = SHC, hl = V3(S).distanceTo(V3(E));
    const shaft = H.loft([{ y: -0.011, rx: 0.008, rz: 0.006, cx: 0.002 }, { y: -0.005, rx: 0.02, rz: 0.0095 }, { y: 0.005, rx: 0.029, rz: 0.011, cx: -0.002 }, { y: 0.018, rx: 0.024, rz: 0.0105, cx: -0.001 },
      { y: 0.045, rx: 0.0155, rz: 0.0095 }, { y: 0.1, rx: 0.0108, rz: 0.0102 }, { y: 0.18, rx: 0.0112, rz: 0.0104, cx: 0.0015 }, { y: 0.25, rx: 0.0118, rz: 0.0115, cx: 0.004 },
      { y: hl - 0.035, rx: 0.015, rz: 0.0145, cx: 0.007 }, { y: hl - 0.018, rx: 0.019, rz: 0.018, cx: 0.011 }, { y: hl - 0.004, rx: 0.013, rz: 0.013, cx: 0.013 }], { radial: 20, subdiv: 3 });
    rough(shaft, 0.0003, 250);
    const troch = spool(0.019, 0.0102, 0.2); troch.translate(-0.008, -0.001, 0.001);
    const hum = merge([shaft, troch, blob(0.0085, [0.011, 0, 0.004], { ws: 12, hs: 8 }), blob([0.008, 0.007, 0.0065], [-0.029, 0.007, -0.002], { ws: 10, hs: 8 }), blob(0.005, [0.025, 0.007, -0.001], { ws: 8, hs: 6 }),
      blob(HHR, [0, hl, 0], { ws: 22, hs: 16, deform: p => p.x > 0.25 ? 1 - 0.3 * (p.x - 0.25) : 1 }), blob([0.011, 0.016, 0.013], [0.019, hl - 0.012, 0.002], { ws: 12, hs: 10 }),
      blob([0.007, 0.009, 0.006], [0.006, hl - 0.017, 0.016], { ws: 10, hs: 8 }), blob([0.003, 0.018, 0.004], [0.0105, 0.19, 0.003], { ws: 8, hs: 8 })]);
    place(hum, E, S);
    addPair({ id: 'humerus', name: 'humerus', latin: 'Humerus', region: 'armL', geometry: hum, tags: ['arm', 'long bone'],
      info: info('The upper-arm bone: a hemispherical head facing the glenoid, greater and lesser tubercles with the bicipital groove between, a cylindrical shaft with the deltoid tuberosity, and a flattened lower end bearing the trochlea, capitulum and epicondyles.', 'Transmits forces between shoulder and elbow and anchors the deltoid, rotator cuff, biceps, brachialis and triceps.',
        `≈ ${Math.round(hl * 100)} cm long; head radius ${mm(HHR)} mm; shaft ≈ 22 mm wide`, 'The ulnar nerve runs behind the medial epicondyle (the "funny bone"); mid-shaft fractures can injure the radial nerve in its spiral groove.') });
    addPair({ id: 'cartilage-humeral-head', name: 'humeral head cartilage', latin: 'Cartilago articularis capitis humeri', region: 'armL', color: C.cartilage, depth: 0.1, geometry: capShell(HHR + 0.0014, 0.0018, 1.2, [-0.85, 0.35, -0.4], S), tags: ['shoulder', 'cartilage'],
      info: info('Smooth hyaline cartilage covering the articular surface of the humeral head.', 'Lets the head glide in the glenoid with almost no friction.', '≈ 1–2 mm thick', 'The glenoid is only a third as large as the head, so the shoulder is the most commonly dislocated major joint.') });
    const G = V3(S).add(V3([-0.8, 0, -0.6]).multiplyScalar(HHR + 0.0022)), lab = H.torus(0.0125, 0.0022, { radial: 8, tubular: 28 });
    lab.scale(1, 1.3, 1); lab.rotateY(PI / 2 - 0.6435); lab.translate(G.x, G.y - 0.001, G.z);
    addPair({ id: 'glenoid-labrum', name: 'glenoid labrum', latin: 'Labrum glenoidale', region: 'thorax', color: C.cartilage, depth: 0.1, geometry: lab, tags: ['shoulder', 'cartilage'],
      info: info('Ring of fibrocartilage around the rim of the glenoid cavity, to which the long head of biceps is anchored above.', 'Deepens the shallow socket by about 50% and stabilises the shoulder.', 'Ring ≈ 30 × 22 mm, 4 mm thick', 'A SLAP tear (superior labrum anterior-to-posterior) is common in throwing athletes.') });
    // radius
    const rb = L.bone.radiusL, rl = V3(rb.top).distanceTo(V3(rb.bottom));
    const rad = merge([rough(H.loft([{ y: -0.002, rx: 0.013, rz: 0.0085, cx: 0.001 }, { y: 0.004, rx: 0.0155, rz: 0.0095, cx: 0.001 }, { y: 0.02, rx: 0.013, rz: 0.0085 }, { y: 0.045, rx: 0.0095, rz: 0.0068, cx: 0.001 }, { y: 0.1, rx: 0.0072, rz: 0.006, cx: 0.002 },
      { y: 0.16, rx: 0.0066, rz: 0.006, cx: 0.0015 }, { y: rl - 0.045, rx: 0.0062, rz: 0.006, cx: -0.0005 }, { y: rl - 0.025, rx: 0.0058, rz: 0.0056, cx: -0.001 }, { y: rl - 0.016, rx: 0.0058, rz: 0.0058 }, { y: rl - 0.012, rx: 0.0105, rz: 0.0105 },
      { y: rl - 0.003, rx: 0.011, rz: 0.011 }, { y: rl + 0.0005, rx: 0.0085, rz: 0.0085 }], { radial: 16, subdiv: 3 }), 0.0002, 300),
      blob([0.004, 0.007, 0.004], [-0.006, rl - 0.03, 0.003], { ws: 8, hs: 6 }), sweep([[0.012, 0.006, 0], [0.016, -0.009, -0.001]], t => 0.004 * (1 - 0.6 * t), { radial: 8, segs: 4 })]);
    addPair({ id: 'radius', name: 'radius', latin: 'Radius', region: 'armL', geometry: place(rad, rb.bottom, rb.top), tags: ['forearm', 'long bone'],
      info: info('The lateral (thumb-side) forearm bone: a disc-shaped head that spins against the capitulum and ulna, a bowed shaft, and a broad lower end that forms most of the wrist joint, ending in the styloid process.', 'Rotates around the ulna to turn the palm up and down (supination and pronation) and carries the hand.',
        `≈ ${Math.round(rl * 100)} cm long; head ≈ 22 mm across`, 'The distal radius (Colles\' fracture) is the most common fracture in adults, typically from a fall on an outstretched hand.') });
    // ulna
    const ub = L.bone.ulnaL, ul = V3(ub.top).distanceTo(V3(ub.bottom)), R = 0.0142, notch = [];
    for (let i = 0; i <= 8; i++) { const a = (20 + i * 28) * PI / 180; notch.push([0, ul - R * Math.sin(a), R * Math.cos(a)]); }
    const uln = merge([rough(H.loft([{ y: -0.003, rx: 0.0045, rz: 0.0045 }, { y: 0.004, rx: 0.0075, rz: 0.0075 }, { y: 0.014, rx: 0.0058, rz: 0.0058 }, { y: 0.06, rx: 0.0058, rz: 0.0062 }, { y: 0.13, rx: 0.0068, rz: 0.0078, cz: -0.001 },
      { y: 0.19, rx: 0.0082, rz: 0.0098, cz: -0.002 }, { y: ul - 0.03, rx: 0.0095, rz: 0.0115, cz: -0.003 }, { y: ul - 0.017, rx: 0.0085, rz: 0.009, cz: -0.004 }], { radial: 16, subdiv: 3 }), 0.0002, 300),
      sweep(notch, [0.0042, 0.0095], { radial: 12, up: [1, 0, 0] }), blob([0.0085, 0.011, 0.008], [0, ul + 0.004, -0.014], { ws: 12, hs: 10 }), blob([0.007, 0.005, 0.007], [0, ul - 0.009, 0.009], { ws: 10, hs: 8 }),
      sweep([[-0.003, 0.004, -0.003], [-0.004, -0.008, -0.004]], t => 0.0028 * (1 - 0.5 * t), { radial: 8, segs: 4 })]);
    addPair({ id: 'ulna', name: 'ulna', latin: 'Ulna', region: 'armL', geometry: place(uln, ub.bottom, ub.top), tags: ['forearm', 'long bone'],
      info: info('The medial (little-finger-side) forearm bone: a large hooked upper end (olecranon and coronoid process around the trochlear notch) that grips the humeral trochlea, tapering to a small head and styloid process at the wrist.', 'Forms the hinge of the elbow and the stable axis around which the radius rotates.',
        `≈ ${Math.round(ul * 100)} cm long`, 'The olecranon is the point of the elbow; it is fractured by falls directly onto the elbow.') });
    // carpals (two rows), metacarpals and phalanges - LEFT hand, mirrored
    const carp = [
      ['scaphoid', 'Os scaphoideum', [0.0055, 0.0095, 0.0055], [0.262, 0.836, 0.013], [0, 0, -0.6], 'Boat-shaped bone of the proximal row on the thumb side, bridging both carpal rows.', 'The most frequently fractured carpal bone; its blood supply enters distally, so the proximal pole can die (avascular necrosis).'],
      ['lunate', 'Os lunatum', [0.0062, 0.0068, 0.0075], [0.2495, 0.839, 0.012], [0, 0, 0], 'Crescent-shaped bone in the centre of the proximal row, articulating with the radius.', 'The most commonly dislocated carpal bone; Kienböck disease is its avascular necrosis.'],
      ['triquetrum', 'Os triquetrum', [0.0055, 0.0058, 0.0058], [0.237, 0.834, 0.01], [0, 0, 0.3], 'Pyramidal bone on the little-finger side of the proximal row.', 'Second most commonly fractured carpal, often as a dorsal chip.'],
      ['pisiform', 'Os pisiforme', [0.0042, 0.0045, 0.0042], [0.2345, 0.833, 0.0195], [0, 0, 0], 'Pea-shaped sesamoid bone lying on the palmar face of the triquetrum within the flexor carpi ulnaris tendon.', 'Palpable at the base of the hypothenar eminence.'],
      ['trapezium', 'Os trapezium', [0.0065, 0.0062, 0.0062], [0.268, 0.818, 0.017], [0, 0, 0.4], 'Distal-row bone at the base of the thumb with a saddle-shaped joint for the first metacarpal.', 'Its saddle joint gives the thumb opposition; it is a common site of osteoarthritis.'],
      ['trapezoid', 'Os trapezoideum', [0.0048, 0.0058, 0.006], [0.2585, 0.817, 0.0125], [0, 0, 0], 'Small wedge-shaped distal-row bone at the base of the index metacarpal.', 'The least commonly fractured carpal bone.'],
      ['capitate', 'Os capitatum', [0.0063, 0.0095, 0.0075], [0.2485, 0.817, 0.0115], [0, 0, 0], 'The largest carpal bone, in the centre of the distal row, with a rounded head fitting into the lunate and scaphoid.', 'It is the first carpal to ossify, in the first months of life.'],
      ['hamate', 'Os hamatum', [0.0068, 0.0085, 0.007], [0.2355, 0.818, 0.011], [0, 0, 0], 'Wedge-shaped distal-row bone on the little-finger side with a palmar hook (hamulus).', 'Its hook forms a wall of Guyon\'s canal and can break in golf or baseball swings.']];
    carp.forEach(([id, lat, r, p, rot, d, note], i) => {
      let geo = blob(r, p, { rot, ws: 12, hs: 9, noise: { amp: 0.07, freq: 2 } });
      if (id === 'hamate') geo = merge([geo, blob([0.0025, 0.004, 0.0045], [0.2345, 0.815, 0.02], { ws: 8, hs: 6 })]);
      addPair({ id, name: id, latin: lat, region: 'armL', geometry: geo, tags: ['hand', 'carpal'],
        info: info(d, i < 4 ? 'Proximal-row carpal: adapts its position as the wrist bends so the hand moves smoothly on the forearm.' : 'Distal-row carpal: forms a rigid unit with the metacarpals and transmits grip forces to the forearm.', `≈ ${mm(r[0] * 2)} × ${mm(r[1] * 2)} × ${mm(r[2] * 2)} mm`, note) });
    });
    // Digits follow the skin's finger chains (integumentary digit(): MCP bases at x = 0.2525 + dx, z = 0.015, segments of 45/31/24 % of
    // L.limb.hand.fingerLength curling palmward; thumb from [0.268, 0.828, 0.02] in 42/31/27 mm segments), set 1 mm toward the nail side.
    const SKF = { 2: [0.028, 0.752, 0.06], 3: [0.008, 0.748, 0.01], 4: [-0.012, 0.751, -0.04], 5: [-0.03, 0.758, -0.09] };
    const chainOf = f => {
      const thumb = f === 1, sp = thumb ? 0 : SKF[f][2], P = [V3(thumb ? [0.268, 0.828, 0.02] : [0.2525 + SKF[f][0], SKF[f][1], 0.015])];
      const d = (thumb ? [[0.45, -0.85, 0.35], [0.3, -0.9, 0.35], [0.2, -0.93, 0.3]] : [[sp, -1, 0.1], [sp * 0.7, -1, 0.28], [sp * 0.5, -1, 0.45]]).map(v => V3(v).normalize());
      const lens = thumb ? [0.042, 0.031, 0.027] : [0.45, 0.31, 0.24].map(q => q * L.limb.hand.fingerLength[f - 1]), off = thumb ? V3([0.958, 0, -0.287]).multiplyScalar(0.001) : V3([0, 0, -0.001]);
      lens.forEach((l, i) => P.push(P[i].clone().addScaledVector(d[i], l))); P.forEach(p => p.add(off)); return P;
    };
    const along = (P, s) => { for (let i = 0; i < P.length - 1; i++) { const l = P[i].distanceTo(P[i + 1]); if (s <= l || i === P.length - 2) return P[i].clone().lerp(P[i + 1], s / l); s -= l; } };
    const arr = v => [v.x, v.y, v.z];
    const mcBase = { 2: [0.264, 0.806, 0.0135], 3: [0.2515, 0.806, 0.0125], 4: [0.2405, 0.806, 0.0125], 5: [0.2305, 0.807, 0.0135] }, mcHead = {}, phal = {};
    for (let f = 1; f <= 5; f++) {
      const P = chainOf(f);
      if (f === 1) {   // the skin thumb is short: MC1, PP1 and DP1 share its 100 mm chain in real proportions (≈ 37 : 25 : 20 mm)
        mcBase[1] = arr(along(P, 0.012)); mcHead[1] = arr(along(P, 0.049));
        phal[1] = [[along(P, 0.052), along(P, 0.077)], [along(P, 0.08), along(P, 0.1005)]];
      } else {
        mcHead[f] = arr(P[0]);
        phal[f] = [0, 1, 2].map(k => { const u = P[k + 1].clone().sub(P[k]).normalize(); return [P[k].clone().addScaledVector(u, 0.0015), P[k + 1].clone().addScaledVector(u, k === 2 ? 0 : -0.0015)]; });
      }
    }
    const fname = ['', 'thumb', 'index finger', 'middle finger', 'ring finger', 'little finger'], fsc = [0, 0.0058, 0.0048, 0.005, 0.0046, 0.0041];
    for (let f = 1; f <= 5; f++) {
      addPair({ id: 'metacarpal-' + f, name: `${['', 'first', 'second', 'third', 'fourth', 'fifth'][f]} metacarpal`, latin: 'Os metacarpi ' + ['', 'I', 'II', 'III', 'IV', 'V'][f], region: 'armL', geometry: smallBone(mcBase[f], mcHead[f], f === 1 ? 0.0062 : 0.0055, 'mc'), tags: ['hand', 'metacarpal'],
        info: info(`Long bone of the palm behind the ${fname[f]}, with a base at the carpus, a slender shaft and a rounded head forming the knuckle.`, f === 1 ? 'Its mobile saddle joint lets the thumb oppose the fingers.' : 'Forms the skeleton of the palm and the knuckle joint of its finger.', `≈ ${mm(V3(mcBase[f]).distanceTo(V3(mcHead[f])))} mm long`, f === 5 ? 'A "boxer\'s fracture" breaks the neck of the fifth metacarpal.' : f === 1 ? 'A Bennett fracture is an intra-articular fracture of its base.' : 'The metacarpal heads are the knuckles seen when making a fist.') });
      const rows = f === 1 ? ['proximal', 'distal'] : ['proximal', 'middle', 'distal'];
      phal[f].forEach(([a, b], k) => {
        const row = rows[k];
        addPair({ id: `phalanx-${row}-${f}`, name: `${row} phalanx of the ${fname[f]}`, latin: `Phalanx ${row === 'proximal' ? 'proximalis' : row === 'middle' ? 'media' : 'distalis'} digiti ${['', 'I', 'II', 'III', 'IV', 'V'][f]} manus`, region: 'armL',
          geometry: smallBone([a.x, a.y, a.z], [b.x, b.y, b.z], fsc[f] * (row === 'proximal' ? 1 : row === 'middle' ? 0.85 : 0.78), row === 'distal' ? 'dp' : 'pp'), tags: ['hand', 'phalanx'],
          info: info(`${row[0].toUpperCase() + row.slice(1)} phalanx of the ${fname[f]}${row === 'distal' ? ', ending in a rough tuft that supports the fingertip pulp and nail' : ', a short long bone with a concave base and a pulley-shaped head'}.`, 'Forms a lever of the finger moved by the long flexor and extensor tendons.',
            `≈ ${mm(a.distanceTo(b))} mm long`, row === 'distal' ? 'Crush injuries of the fingertip commonly fracture the distal tuft.' : 'Each finger has three phalanges but the thumb only two (14 per hand).') });
      });
    }
  }

  // ============================================================ PELVIS (hip bone = ilium + ischium + pubis, fused at the acetabulum)
  const HIP = L.joint.hipL, accDir = V3([0.75, -0.5, 0.35]).normalize();
  {
    const Cr = crv([[0.12, 1.0, 0.06], [0.135, 1.04, 0.035], [0.137, 1.062, 0.0], [0.122, 1.065, -0.035], [0.09, 1.058, -0.07], [0.045, 1.04, -0.09]]);
    const Lo = crv([[0.108, 0.968, 0.048], [0.104, 0.952, 0.026], [0.1, 0.944, 0.0], [0.088, 0.944, -0.03], [0.066, 0.963, -0.056], [0.047, 0.998, -0.078]]);
    const il = plate((u, v) => { const p = mix(cp(Cr, u), cp(Lo, u), v); p[0] += 0.006 * Math.sin(PI * u) * Math.sin(PI * v); return p; },
      (u, v) => 0.0035 + 0.0045 * Math.exp(-v * 10) + 0.011 * v ** 3 + 0.01 * u ** 4 * (0.3 + v), 18, 10);
    addPair({ id: 'ilium', name: 'ilium', latin: 'Os ilium', region: 'pelvis', geometry: rough(il, 0.0004, 150), tags: ['pelvis', 'hip bone'],
      info: info('The large fan-shaped upper part of the hip bone: a thin wing (ala) with the concave iliac fossa inside, bounded above by the iliac crest from the anterior superior iliac spine (ASIS) to the posterior superior iliac spine (PSIS).', 'Supports the abdominal organs, anchors the abdominal, gluteal and iliacus muscles, and joins the sacrum at the sacroiliac joint.',
        'Crest ≈ 25 cm long; ASIS to PSIS ≈ 16 cm', 'The iliac crest is a standard donor site for bone grafts and marrow biopsy; the ASIS is a key surface landmark.') });
    const prof = []; const Ri = 0.0265, Ro = 0.034, rim = 85 * PI / 180;
    for (let i = 0; i <= 10; i++) { const a = rim * i / 10; prof.push([Ro * Math.sin(a), -Ro * Math.cos(a)]); }
    for (let i = 10; i >= 0; i--) { const a = rim * i / 10; prof.push([Ri * Math.sin(a), -Ri * Math.cos(a)]); }
    const acc = H.lathe(prof, { segments: 28 }); H.aim(acc, accDir); acc.translate(HIP[0], HIP[1], HIP[2]);
    addPair({ id: 'acetabulum', name: 'acetabulum', latin: 'Acetabulum', region: 'pelvis', geometry: acc, tags: ['pelvis', 'hip bone', 'joint'],
      info: info('Deep cup-shaped socket on the outer hip bone, formed where the ilium, ischium and pubis fuse (the triradiate cartilage in children).', 'Holds the femoral head in the hip joint, facing outward, downward and forward.', '≈ 5–5.5 cm across, 2.5–3 cm deep', 'Shallow acetabula (developmental dysplasia of the hip) are screened for in newborns.') });
    const isch = merge([sweep([[0.086, 0.905, -0.03], [0.078, 0.885, -0.042], [0.066, 0.865, -0.043], [0.056, 0.858, -0.025], [0.047, 0.861, 0.0], [0.039, 0.867, 0.028]],
      t => t < 0.5 ? [0.011 + 0.002 * Math.sin(PI * t * 2), 0.01] : [lerp(0.011, 0.007, (t - 0.5) * 2), lerp(0.01, 0.004, (t - 0.5) * 2)], { radial: 12, up: [1, 0, 0] }),
      sweep([[0.078, 0.905, -0.045], [0.066, 0.9, -0.058]], t => 0.004 * (1 - 0.6 * t), { radial: 8, segs: 4 }), blob([0.012, 0.014, 0.014], [0.09, 0.905, -0.022], { ws: 12, hs: 10 })]);
    addPair({ id: 'ischium', name: 'ischium', latin: 'Os ischii', region: 'pelvis', geometry: rough(isch, 0.0004, 150), tags: ['pelvis', 'hip bone'],
      info: info('The lower posterior part of the hip bone: a thick body behind the acetabulum, the ischial spine, the rough ischial tuberosity, and a flat ramus that joins the pubis around the obturator foramen.', 'Bears the body weight when sitting and anchors the hamstrings and adductor magnus.', 'Tuberosity ≈ 5 cm long; inter-tuberous distance ≈ 11 cm', 'The ischial spines mark the narrowest part of the birth canal and guide pudendal nerve blocks.') });
    const pub = merge([blob([0.01, 0.016, 0.0085], [0.013, 0.9, 0.067], { ws: 12, hs: 10 }), sweep([[0.006, 0.906, 0.07], [0.024, 0.912, 0.07], [0.05, 0.918, 0.052], [0.074, 0.924, 0.03], [0.088, 0.928, 0.013]], t => 0.0078 + 0.002 * t, { radial: 12 }),
      sweep([[0.008, 0.893, 0.066], [0.02, 0.882, 0.057], [0.031, 0.872, 0.043], [0.039, 0.867, 0.028]], [0.0055, 0.0078], { radial: 10, up: [1, 0, 0] }), blob(0.004, [0.024, 0.912, 0.075], { ws: 8, hs: 6 })]);
    addPair({ id: 'pubis', name: 'pubis', latin: 'Os pubis', region: 'pelvis', geometry: rough(pub, 0.0004, 150), tags: ['pelvis', 'hip bone'],
      info: info('The anterior part of the hip bone: a body meeting its partner at the pubic symphysis, with superior and inferior rami framing the obturator foramen and a pubic tubercle for the inguinal ligament.', 'Completes the pelvic ring in front and anchors the adductors, rectus abdominis and inguinal ligament.', 'Body ≈ 3 × 2 cm; symphysis ≈ 4 cm tall', 'The subpubic angle is wider in females (≈ 80–85°) than in males (≈ 50–60°).') });
    add({ id: 'pubic-symphysis', name: 'Pubic symphysis', latin: 'Symphysis pubica', region: 'pelvis', color: C.cartilage, depth: 0.1, geometry: blob([0.004, 0.016, 0.0085], [0, 0.9, 0.067], { ws: 10, hs: 10 }), tags: ['pelvis', 'cartilage', 'joint'],
      info: info('Fibrocartilaginous disc joining the two pubic bones in the midline.', 'Allows slight movement and absorbs stress in the pelvic ring.', '≈ 4 cm tall, 4 mm wide', 'Pregnancy hormones (relaxin) loosen it, widening the pelvis slightly for childbirth.') });
  }

  // ============================================================ FEMUR, PATELLA, KNEE CARTILAGE
  {
    const fb = L.bone.femurL, K = fb.bottom, J = [0.13, 0.885, -0.008], fl = V3(J).distanceTo(V3(K)), bow = y => 0.009 * Math.sin(PI * clamp(y / fl, 0, 1));
    const R = 20, asp = k => { const r = []; for (let j = 0; j < R; j++) r.push(1 + k * Math.exp(-((((j / R) * 2 * PI - 1.5 * PI) / 0.35) ** 2))); return r; };
    const fsec = [[0.03, 0.036, 0.027, -0.003, 0], [0.055, 0.029, 0.022, -0.002, 0], [0.09, 0.019, 0.0165, 0, 0.05], [0.14, 0.0145, 0.0145, 0, 0.14], [0.2, 0.0135, 0.014, 0, 0.18], [0.27, 0.0138, 0.014, 0, 0.16],
      [0.33, 0.016, 0.0158, 0, 0.08], [0.365, 0.02, 0.018, 0, 0.02], [0.395, 0.022, 0.0185, 0, 0], [0.425, 0.016, 0.015, 0, 0], [0.44, 0.009, 0.009, 0, 0]];
    const shaft = H.loft(fsec.map(([y, rx, rz, cz, k]) => ({ y, rx, rz, cx: y > 0.39 ? (y - 0.39) * 0.15 : 0, cz: cz + bow(y), r: asp(k) })), { radial: R, subdiv: 3 });
    place(rough(shaft, 0.0003, 200), K, J);
    const Kv = V3(K), rel = (d) => [Kv.x + d[0], Kv.y + d[1], Kv.z + d[2]];
    const fem = merge([shaft, sweep([HIP, mix(HIP, J, 0.5), J], t => [0.0125 + 0.006 * t * t, 0.0155 + 0.006 * t * t], { radial: 14 }),
      blob(0.024, HIP, { ws: 22, hs: 16, deform: p => 1 - 0.07 * Math.exp(-((p.x + 0.95) ** 2 + (p.y + 0.2) ** 2 + p.z ** 2) / 0.03) }),
      blob([0.013, 0.023, 0.017], [0.138, 0.91, -0.014], { ws: 14, hs: 12, noise: { amp: 0.05, freq: 2 } }), blob([0.009, 0.01, 0.008], [0.111, 0.858, -0.02], { ws: 10, hs: 8 }),
      sweep([[0.136, 0.905, -0.024], [0.122, 0.878, -0.026], [0.111, 0.86, -0.022]], 0.0045, { radial: 8 }),
      blob([0.013, 0.022, 0.028], rel([-0.02, 0.022, -0.009]), { ws: 16, hs: 12 }), blob([0.013, 0.021, 0.027], rel([0.021, 0.024, -0.009]), { ws: 16, hs: 12 }),
      blob([0.022, 0.02, 0.016], rel([0.001, 0.034, 0.016]), { ws: 16, hs: 12, deform: p => 1 - 0.14 * Math.exp(-p.x * p.x / 0.05) * Math.max(0, p.z) }),
      blob(0.0065, rel([-0.034, 0.032, -0.006]), { ws: 8, hs: 6 }), blob(0.0055, rel([0.034, 0.032, -0.006]), { ws: 8, hs: 6 })]);
    addPair({ id: 'femur', name: 'femur', latin: 'Femur', region: 'legL', geometry: fem, tags: ['thigh', 'long bone'],
      info: info('The thigh bone, longest and strongest in the body: a spherical head on an angled neck (≈125°), greater and lesser trochanters, a shaft bowed forward with the linea aspera behind, and two large condyles at the knee.', 'Carries the body weight from hip to knee and gives leverage to the most powerful muscles of the body.',
        `≈ ${Math.round(V3(HIP).distanceTo(V3(K)) * 100 + 2)} cm long (≈ ¼ of height); head Ø 48 mm; shaft Ø 27 mm`, 'Hip fractures through the femoral neck are common in older people with osteoporosis and can cut off the blood supply to the head.') });
    const marrow = H.loft([0.08, 0.14, 0.2, 0.27, 0.33].map(y => ({ y, rx: 0.0075, rz: 0.0075, cz: bow(y) })), { radial: 14, subdiv: 3 });
    add({ id: 'marrow-femur-l', name: 'Bone marrow of left femur', latin: 'Medulla ossium', side: 'L', region: 'legL', depth: 0.5, color: C.marrow, geometry: place(marrow, K, J), tags: ['thigh', 'marrow'],
      info: info('Soft tissue filling the medullary cavity of the femoral shaft, revealed by peeling away the compact bone; in adults the shaft holds mostly fatty yellow marrow.', 'Red marrow (in the ends of long bones, pelvis, sternum and vertebrae) makes about 500 billion blood cells a day; yellow marrow stores fat and can convert back when needed.',
        'Medullary cavity ≈ 15 mm across, ≈ 25 cm long', 'A large femoral fracture can release marrow fat into the bloodstream (fat embolism syndrome).') });
    addPair({ id: 'cartilage-femoral-head', name: 'femoral head cartilage', latin: 'Cartilago articularis capitis femoris', region: 'legL', color: C.cartilage, depth: 0.1, geometry: capShell(0.0256, 0.002, 1.35, [-0.75, 0.55, 0.15], HIP), tags: ['hip', 'cartilage'],
      info: info('Hyaline cartilage covering the femoral head except for the small fovea where the ligament of the head attaches.', 'Provides a smooth, load-spreading bearing surface for the hip joint.', '≈ 2–3 mm thick', 'Wear of this cartilage is hip osteoarthritis, the most common reason for hip replacement.') });
    const cy = Kv.y + 0.024, cz0 = Kv.z - 0.009, Rc = ph => ph < 0.5 * PI ? lerp(0.036, 0.0225, Math.sin(ph)) : lerp(0.0225, 0.025, (ph - 0.5 * PI) / (0.6 * PI));
    const kc = (x0, x1, p0, p1) => plate((u, v) => { const ph = lerp(p0, p1, v), r = Rc(ph) + 0.0006; return [Kv.x + lerp(x0, x1, u), cy - r * Math.sin(ph), cz0 + r * Math.cos(ph)]; }, () => 0.0024, 6, 12);
    addPair({ id: 'cartilage-femoral-condyles', name: 'femoral condyle cartilage', latin: 'Cartilago articularis condylorum femoris', region: 'legL', color: C.cartilage, depth: 0.1, tags: ['knee', 'cartilage'],
      geometry: merge([kc(-0.022, 0.024, -0.15, 0.28 * PI), kc(-0.031, -0.008, 0.28 * PI, 1.05 * PI), kc(0.009, 0.032, 0.28 * PI, 1.05 * PI)]),
      info: info('Hyaline cartilage capping the trochlear groove and both femoral condyles.', 'Lets the femur roll and glide on the tibia and patella through 140° of knee flexion.', '≈ 2–3 mm thick', 'Cartilage has no blood supply, so defects heal poorly; osteoarthritis of the knee is extremely common.') });
    const men = (cx, rx, rz, a0, a1) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push([cx + rx * Math.cos(a), 0.4985, rz * Math.sin(a) - 0.002]); } return sweep(pts, t => [0.0048 * (0.75 + 0.25 * Math.sin(PI * t)), 0.0026], { radial: 8 }); };
    addPair({ id: 'meniscus-medial', name: 'medial meniscus', latin: 'Meniscus medialis', region: 'legL', color: C.cartilage, depth: 0.1, geometry: men(0.069, 0.016, 0.019, 0.25 * PI, 1.75 * PI), tags: ['knee', 'cartilage'],
      info: info('C-shaped wedge of fibrocartilage on the medial tibial plateau, firmly attached to the joint capsule and medial collateral ligament.', 'Deepens the tibial socket, spreads load and stabilises the knee.', '≈ 4.5 cm long, 9–10 mm wide', 'Tears more often than the lateral meniscus because it is less mobile (part of the "unhappy triad").') });
    addPair({ id: 'meniscus-lateral', name: 'lateral meniscus', latin: 'Meniscus lateralis', region: 'legL', color: C.cartilage, depth: 0.1, geometry: men(0.107, 0.014, 0.016, -0.8 * PI, 0.8 * PI), tags: ['knee', 'cartilage'],
      info: info('Almost circular (O-shaped) fibrocartilage ring on the lateral tibial plateau.', 'Distributes load across the lateral compartment and aids knee stability.', '≈ 3.5 cm across, 10 mm wide', 'It is more mobile than the medial meniscus, which partly protects it from tearing.') });
    const pc = L.joint.patellaL, pat = blob([1, 1, 1], null, { ws: 18, hs: 14, deform: p => new THREE.Vector3(p.x * 0.021 * (0.7 + 0.3 * (p.y + 1) / 2), p.y * 0.0225, p.z * 0.009 * (p.z < 0 ? 0.72 - 0.2 * Math.abs(p.x) : 1)) });
    pat.translate(pc[0], pc[1], pc[2] - 0.010);   // sunk ~1 cm toward the trochlea: the skin front of the knee lies only ~3 mm in front of L.joint.patellaL
    addPair({ id: 'patella', name: 'patella', latin: 'Patella', region: 'legL', geometry: rough(pat, 0.0004, 200), tags: ['knee'],
      info: info('The kneecap: a triangular sesamoid bone, apex down, embedded in the quadriceps tendon, with a ridged cartilage-covered back that runs in the femoral groove.', 'Increases the leverage of the quadriceps by about 30% and protects the front of the knee.', '≈ 4.5 cm tall, 4.5 cm wide, 2–2.5 cm thick', 'Its posterior cartilage is the thickest in the body (up to 5 mm); anterior knee pain often arises here.') });
    addPair({ id: 'cartilage-patella', name: 'patellar cartilage', latin: 'Cartilago articularis patellae', region: 'legL', color: C.cartilage, depth: 0.1, geometry: blob([0.017, 0.018, 0.0035], [pc[0], pc[1] + 0.002, pc[2] - 0.0165], { ws: 14, hs: 10 }), tags: ['knee', 'cartilage'],
      info: info('Thick hyaline cartilage on the back of the patella, divided by a vertical ridge into medial and lateral facets.', 'Glides in the femoral trochlear groove as the knee bends.', 'Up to 5 mm thick', 'Softening of this cartilage (chondromalacia patellae) causes pain on stairs.') });
  }

  // ============================================================ LEG AND FOOT
  {
    const tb = L.bone.tibiaL, tl = V3(tb.top).distanceTo(V3(tb.bottom)), R = 20;
    const tri = k => { const r = []; for (let j = 0; j < R; j++) { const a = j / R * 2 * PI; r.push(1 + k * (0.22 * Math.exp(-(((a - 0.5 * PI) / 0.4) ** 2)) - 0.08 * Math.exp(-(((a - 1.5 * PI) / 0.9) ** 2)))); } return r; };
    const tsec = [[-0.004, 0.014, 0.012, 0, 0], [0.004, 0.019, 0.017, 0, 0], [0.03, 0.015, 0.015, 0, 0.3], [0.07, 0.0115, 0.012, 0, 0.8], [0.15, 0.011, 0.012, 0.001, 1], [0.25, 0.012, 0.013, 0.001, 1],
      [0.33, 0.016, 0.016, 0.002, 0.6], [0.37, 0.026, 0.021, -0.002, 0.1], [0.395, 0.036, 0.025, -0.004, 0], [0.405, 0.037, 0.026, -0.004, 0], [tl, 0.033, 0.023, -0.004, 0]];
    const tib = merge([rough(H.loft(tsec.map(([y, rx, rz, cz, k]) => ({ y, rx, rz, cz, cx: y < 0.02 ? -0.001 : 0, r: tri(k) })), { radial: R, subdiv: 3 }), 0.0003, 200),
      blob([0.009, 0.013, 0.006], [0.002, tl - 0.035, 0.022], { ws: 10, hs: 8 }), blob([0.006, 0.013, 0.009], [-0.016, -0.009, 0.001], { ws: 10, hs: 8 }), blob([0.006, 0.004, 0.008], [0, tl, -0.002], { ws: 8, hs: 6 })]);
    addPair({ id: 'tibia', name: 'tibia', latin: 'Tibia', region: 'legL', geometry: place(tib, tb.bottom, tb.top), tags: ['leg', 'long bone'],
      info: info('The shin bone: a broad upper end with two flat condyles (the tibial plateau) and the tibial tuberosity, a triangular shaft with a sharp anterior border just under the skin, and a lower end forming the medial malleolus.', 'Carries almost all the body weight from knee to ankle and forms the roof and inner wall of the ankle joint.',
        `≈ ${Math.round(tl * 100)} cm long; plateau ≈ 7.5 cm wide`, 'Because its front lies directly under the skin, the tibia is the long bone most often broken open (compound fracture).') });
    const fbn = L.bone.fibulaL;
    // lower shaft bowed ~4 mm medially above the malleolus, where the skin of the slim lower leg is only 30 mm from its axis
    const fib = H.loft([[-0.028, 0.003, 0.003, -0.0012], [-0.02, 0.0065, 0.008, -0.0011], [-0.005, 0.0075, 0.0105, -0.0008], [0.015, 0.0065, 0.008, -0.0012], [0.05, 0.0052, 0.0055, -0.004], [0.1, 0.0052, 0.0056, -0.004], [0.2, 0.0055, 0.0058, -0.0022], [0.27, 0.0053, 0.0055, -0.0006], [0.33, 0.005, 0.0052], [0.365, 0.0075, 0.0075], [0.382, 0.011, 0.0105], [0.395, 0.0085, 0.008], [0.402, 0.004, 0.004]]
      .map(([y, rx, rz, cx]) => ({ y, rx, rz, cx: cx || 0, n: 2.3 })), { radial: 12, subdiv: 3 });
    addPair({ id: 'fibula', name: 'fibula', latin: 'Fibula', region: 'legL', geometry: place(rough(fib, 0.0002, 250), fbn.bottom, fbn.top), tags: ['leg', 'long bone'],
      info: info('Slender lateral bone of the leg with a knob-like head below the knee and a lower end forming the lateral malleolus of the ankle.', 'Carries little weight (≈ 15%) but anchors leg muscles and stabilises the ankle mortise.', '≈ 40 cm long, 1–1.5 cm thick', 'The common fibular nerve winds around its neck, where it is easily injured, causing foot drop.') });
    const tars = [
      ['talus', 'Talus', 'The ankle bone: a domed trochlea gripped by the malleoli above, a neck and a rounded head that fits the navicular.', 'Transmits the entire body weight from the tibia to the foot; no muscles attach to it.', '≈ 5.5 cm long', 'Most of its surface is cartilage, so its blood supply is fragile and neck fractures risk avascular necrosis.',
        () => merge([blob([0.014, 0.0115, 0.017], [0.092, 0.0625, -0.008], { ws: 14, hs: 10, deform: p => p.y < 0 ? 1 - 0.2 * -p.y : 1 }), sweep([[0.09, 0.06, 0.005], [0.082, 0.056, 0.022]], 0.008, { radial: 10, segs: 4 }), blob([0.0095, 0.0095, 0.0085], [0.079, 0.054, 0.029], { ws: 12, hs: 8 })])],
      ['calcaneus', 'Calcaneus', 'The heel bone, largest of the foot: a long block with a posterior tuberosity, a medial shelf (sustentaculum tali) supporting the talus, and a front facet for the cuboid.', 'Forms the heel, bears the body weight on landing and anchors the Achilles tendon.', '≈ 7.5–8 cm long, 4 cm tall', 'Usually fractured by falls from a height landing on the heels.',
        () => merge([sweep([[0.094, 0.028, -0.043], [0.097, 0.035, -0.02], [0.101, 0.036, 0.0], [0.108, 0.033, 0.024]], t => [0.0125 - 0.002 * t, 0.016 - 0.006 * t], { radial: 12 }), blob([0.0135, 0.018, 0.011], [0.094, 0.028, -0.042], { ws: 14, hs: 10, noise: { amp: 0.05, freq: 2 } }), blob([0.008, 0.004, 0.01], [0.079, 0.043, -0.004], { ws: 10, hs: 6 })])],
      ['navicular', 'Os naviculare', 'Boat-shaped bone on the medial side of the midfoot between the talar head and the three cuneiforms, with a palpable medial tuberosity.', 'Keystone of the medial longitudinal arch; receives the tibialis posterior tendon.', '≈ 3 × 2 × 1.2 cm', 'Stress fractures occur in sprinters and jumpers.',
        () => merge([blob([0.013, 0.0105, 0.006], [0.077, 0.05, 0.043], { ws: 12, hs: 8 }), blob(0.0042, [0.0655, 0.0455, 0.041], { ws: 8, hs: 6 })])],
      ['cuboid', 'Os cuboideum', 'Cube-shaped bone on the lateral side of the midfoot, in front of the calcaneus, grooved underneath by the fibularis longus tendon.', 'Forms part of the lateral longitudinal arch and supports the 4th and 5th metatarsals.', '≈ 2.5 × 2 × 2 cm', 'Cuboid syndrome (subluxation) is a cause of lateral foot pain in dancers.',
        () => blob([0.011, 0.01, 0.013], [0.111, 0.032, 0.041], { ws: 12, hs: 8, noise: { amp: 0.06, freq: 2 } })],
      ['cuneiform-medial', 'Os cuneiforme mediale', 'The largest of the three wedge-shaped cuneiforms, at the base of the first metatarsal.', 'Supports the big toe ray and receives tibialis anterior and fibularis longus.', '≈ 2.5 × 2.5 × 1.5 cm', 'Its wedge shape, like the others, helps form the transverse arch of the foot.',
        () => blob([0.0075, 0.013, 0.012], [0.07, 0.042, 0.062], { ws: 12, hs: 8 })],
      ['cuneiform-intermediate', 'Os cuneiforme intermedium', 'The smallest cuneiform, wedged between the medial and lateral cuneiforms at the base of the second metatarsal.', 'Locks the second metatarsal base into a mortise that stabilises the midfoot.', '≈ 1.5 × 1.8 × 1.5 cm', 'Lisfranc injuries disrupt the joint between these bones and the metatarsals.',
        () => blob([0.0062, 0.009, 0.008], [0.0835, 0.049, 0.059], { ws: 10, hs: 8 })],
      ['cuneiform-lateral', 'Os cuneiforme laterale', 'Wedge-shaped cuneiform between the intermediate cuneiform and the cuboid, at the base of the third metatarsal.', 'Keystone of the transverse arch of the foot.', '≈ 2 × 2 × 1.8 cm', 'Together the cuneiforms and cuboid make the foot a flexible, arched lever.',
        () => blob([0.0068, 0.0095, 0.0095], [0.097, 0.045, 0.06], { ws: 10, hs: 8 })]];
    for (const [id, lat, d, fn, sz, note, mk] of tars) addPair({ id, name: id.replace('-', ' ').replace(/(\w+) (\w+)/, '$2 $1'), latin: lat, region: 'legL', geometry: mk(), tags: ['foot', 'tarsal'], info: info(d, fn, sz, note) });
    const mtB = { 1: [0.068, 0.04, 0.074], 2: [0.083, 0.046, 0.066], 3: [0.097, 0.042, 0.07], 4: [0.109, 0.036, 0.058], 5: [0.12, 0.028, 0.055] };
    // toes follow the skin's toe chains (integumentary TOES: base -> tip with a 2.5 mm dorsal arch; big toe 2 segments, others 3);
    // the MTP joint sits 3 mm behind the skin toe base, bones 0.5 mm dorsal of the chain, phalanges in real proportions along it
    const SKT = { 1: [[0.074, 0.021, 0.14], [0.073, 0.013, 0.198], 2], 2: [[0.094, 0.017, 0.145], [L.joint.toeTipL[0], 0.011, L.joint.toeTipL[2] - 0.004], 3], 3: [[0.11, 0.016, 0.141], [0.117, 0.01, 0.187], 3],
      4: [[0.124, 0.015, 0.136], [0.131, 0.009, 0.176], 3], 5: [[0.137, 0.014, 0.128], [0.144, 0.009, 0.163], 3] };
    const alongT = (P, s) => { for (let i = 0; i < P.length - 1; i++) { const l = P[i].distanceTo(P[i + 1]); if (s <= l || i === P.length - 2) return P[i].clone().lerp(P[i + 1], s / l); s -= l; } };
    const mtH = {}, toeP = {};
    for (let f = 1; f <= 5; f++) {
      const [b0, t0, n] = SKT[f], P = []; for (let i = 0; i <= n; i++) P.push(V3(mix(b0, t0, i / n)).add(V3([0, 0.0025 * Math.sin(PI * i / n) + 0.0005, 0])));
      const u0 = P[1].clone().sub(P[0]).normalize(); P[0].addScaledVector(u0, -0.003); mtH[f] = [P[0].x - u0.x * 0.0012, P[0].y - u0.y * 0.0012, P[0].z - u0.z * 0.0012];
      let tot = 0; for (let i = 0; i < n; i++) tot += P[i].distanceTo(P[i + 1]);
      const fr = f === 1 ? [0.58, 0.42] : [0.5, 0.27, 0.23]; let s = 0;
      toeP[f] = fr.map((q, k) => { const a = alongT(P, s + 0.0012), b = alongT(P, k === fr.length - 1 ? tot : s + q * tot - 0.0012); s += q * tot; return [a, b]; });
    }
    const tn = ['', 'big toe (hallux)', 'second toe', 'third toe', 'fourth toe', 'little toe'], tsc = [0, 0.0072, 0.0045, 0.0043, 0.0041, 0.004];
    for (let f = 1; f <= 5; f++) {
      let geo = smallBone(mtB[f], mtH[f], f === 1 ? 0.0085 : f === 5 ? 0.0058 : 0.0055, 'mc');
      if (f === 5) geo = merge([geo, blob(0.005, [0.126, 0.026, 0.052], { ws: 8, hs: 6 })]);
      addPair({ id: 'metatarsal-' + f, name: `${['', 'first', 'second', 'third', 'fourth', 'fifth'][f]} metatarsal`, latin: 'Os metatarsi ' + ['', 'I', 'II', 'III', 'IV', 'V'][f], region: 'legL', geometry: geo, tags: ['foot', 'metatarsal'],
        info: info(`Long bone of the forefoot behind the ${tn[f]}, with a wedge-shaped base, slender shaft and rounded head at the ball of the foot.`, f === 1 ? 'Short and thick, it carries about a third of forefoot load during push-off.' : 'Forms a spoke of the foot\'s arches and a lever for walking.',
          `≈ ${mm(V3(mtB[f]).distanceTo(V3(mtH[f])))} mm long`, f === 5 ? 'Fractures of the base of the fifth metatarsal (Jones fracture) follow inversion injuries.' : f === 2 ? 'The second metatarsal is the longest and the commonest site of "march" stress fractures.' : 'Bunions (hallux valgus) develop at the first metatarsal head.') });
      const rows = f === 1 ? ['proximal', 'distal'] : ['proximal', 'middle', 'distal'];
      toeP[f].forEach(([a, b], k) => {
        const row = rows[k];
        addPair({ id: `foot-phalanx-${row}-${f}`, name: `${row} phalanx of the ${tn[f]}`, latin: `Phalanx ${row === 'proximal' ? 'proximalis' : row === 'middle' ? 'media' : 'distalis'} digiti ${['', 'I', 'II', 'III', 'IV', 'V'][f]} pedis`, region: 'legL',
          geometry: smallBone([a.x, a.y, a.z], [b.x, b.y, b.z], tsc[f] * (row === 'proximal' ? 1 : row === 'middle' ? 0.85 : 0.82), row === 'distal' ? 'dp' : 'pp'), tags: ['foot', 'phalanx'],
          info: info(`${row[0].toUpperCase() + row.slice(1)} phalanx of the ${tn[f]}: a short tubular bone${row === 'distal' ? ' ending in a tuft under the toenail' : ''}.`, 'Toe bones help balance and push off during the last phase of each step.',
            `≈ ${mm(a.distanceTo(b))} mm long`, f === 1 ? 'The big toe has only two phalanges and bears most push-off force; gout classically attacks its first joint.' : 'The little toe\'s middle and distal phalanges are fused in many adults.') });
      });
    }
  }

  // ============================================================ SKULL: cranial vault split into bones along the sutures
  const HC = { c: [0, 1.665, -0.009], r: [0.0725, 0.077, 0.0925] };   // outer brain case: width 0.145, depth 0.185, top y 1.742
  const CB = { c: [0, 1.598, -0.055], r: [0.0585, 0.031, 0.036] };    // posterior cranial fossa bulge around the cerebellum
  const orb = a => [0.032 + 0.02 * Math.cos(a) * (Math.cos(a) < 0 ? 1.15 : 1), L.head.orbitL[1] + 0.0185 * Math.sin(a), 0.071 - (Math.cos(a) > 0 ? 0.007 : 0.004) * Math.cos(a) + 0.002 * Math.sin(a)];  // LEFT orbital rim, a=0 lateral, PI/2 up (medial margin kept behind the skin recess around the eye)
  const OA = L.eye.orbitApexL;
  const orbitWall = (a0, a1) => plate((u, v) => { const a = lerp(a0, a1, u) * PI / 180; return mix(orb(a), [OA[0] + 0.004 * Math.cos(a), OA[1] + 0.004 * Math.sin(a), OA[2]], v); }, () => 0.0016, 8, 6);
  const rimArc = (a0, a1, r) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(orb(lerp(a0, a1, i / 8) * PI / 180)); return sweep(pts, r, { radial: 8 }); };
  const both = geo => merge([geo, mirrorGeo(geo)]);
  {
    const o = HC.c, hs = 80, ws = 124, verts = [];
    const rayEll = (d, e) => { let A = 0, B = 0, Cq = -1; for (let k = 0; k < 3; k++) { const dk = d[k] / e.r[k], ok = (o[k] - e.c[k]) / e.r[k]; A += dk * dk; B += dk * ok; Cq += ok * ok; } const disc = B * B - A * Cq; return disc < 0 ? 0 : Math.max(0, (-B + Math.sqrt(disc)) / A); };
    const surf = d => {
      let t = Math.pow(rayEll(d, HC) ** 8 + rayEll(d, CB) ** 8, 1 / 8);
      t *= 1 - 0.04 * Math.exp(-(((d[1] + 0.3) / 0.35) ** 2)) * d[0] * d[0] * (d[2] > -0.3 ? 1 : 0.4);          // flatter temporal fossae
      t *= 1 + 0.035 * Math.exp(-((d[1] + 0.22) ** 2 + 4 * d[0] * d[0] + (d[2] + 1) ** 2) / 0.02);                 // external occipital protuberance
      t *= 1 + 0.004 * H.fbm(d[0] * 5 + 2, d[1] * 5, d[2] * 5, 2);
      return [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    };
    verts.push(surf([0, 1, 0]));
    for (let iy = 1; iy < hs; iy++) for (let j = 0; j < ws; j++) { const th = iy / hs * PI, ph = j / ws * 2 * PI; verts.push(surf([Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)])); }
    verts.push(surf([0, -1, 0]));
    // Keep the vault >= 3 mm inside the head skin. Its back half is a superellipse (n 2.2) per height (integumentary sec(): dome above
    // y 1.655, LOW table of [y, half-width, back z] below it, Catmull-Rom); the skin's occiput and nape are much flatter than the
    // cranial ellipsoids, so the lower occipital squama and the back of the temporals are drawn in horizontally.
    const HLOW = [[1.655, 0.0775, -0.1], [1.64, 0.0768, -0.0985], [1.625, 0.0752, -0.0945], [1.61, 0.0728, -0.0885], [1.595, 0.0698, -0.081], [1.58, 0.0664, -0.0725], [1.565, 0.0625, -0.064], [1.55, 0.0565, -0.056], [1.535, 0.05, -0.049]];
    const czH = L.head.center[2], cmr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const headBack = y => {
      if (y >= HLOW[0][0]) { const w = clamp((y - HLOW[0][0]) / (L.y.crown - HLOW[0][0]), 0, 1), k = m => Math.pow(Math.max(0, 1 - Math.pow(w, m)), 1 / m); return [HLOW[0][1] * k(2.3), (czH - HLOW[0][2]) * k(2.1)]; }
      let i = 0; while (i < HLOW.length - 2 && y < HLOW[i + 1][0]) i++;
      const t = clamp((y - HLOW[i][0]) / (HLOW[i + 1][0] - HLOW[i][0]), 0, 1), R = [HLOW[Math.max(0, i - 1)], HLOW[i], HLOW[i + 1], HLOW[Math.min(HLOW.length - 1, i + 2)]];
      return [cmr(R[0][1], R[1][1], R[2][1], R[3][1], t), czH - cmr(R[0][2], R[1][2], R[2][2], R[3][2], t)];
    };
    for (const v of verts) {
      const dz = v[2] - czH; if (dz > 0.01) continue;
      const [W, B] = headBack(v[1]), rho = Math.hypot(v[0], dz); if (W <= 0.004 || B <= 0.004 || rho < 1e-6) continue;
      const r = Math.pow(Math.pow(Math.abs(v[0]) / W, 2.2) + Math.pow(Math.max(0, -dz) / B, 2.2), 1 / 2.2), rMax = Math.max(0.2, 1 - 0.003 / rho);
      if (r > rMax) { const s = rMax / r; v[0] *= s; v[2] = czH + dz * s; }
    }
    const last = verts.length - 1, vi = (iy, j) => iy === 0 ? 0 : iy === hs ? last : 1 + (iy - 1) * ws + (j % ws), tris = [];
    for (let iy = 0; iy < hs; iy++) for (let j = 0; j < ws; j++) {
      const A = vi(iy, j), B = vi(iy + 1, j), Cc = vi(iy, j + 1), D = vi(iy + 1, j + 1);
      if (iy === 0) tris.push([A, B, D]); else if (iy === hs - 1) tris.push([A, B, Cc]); else { tris.push([A, B, Cc]); tris.push([Cc, B, D]); }
    }
    const fm = L.head.foramenMagnum;
    const label = (x, y, z) => {
      const ax = Math.abs(x), s = x >= 0 ? 'l' : 'r', zCor = 0.012 + 0.023 * clamp((1.742 - y) / 0.074, 0, 1);
      if (y < 1.605 && Math.hypot(x - fm[0], z - fm[2]) < 0.016) return null;                  // foramen magnum
      if (ax > 0.045 && Math.hypot(ax - 0.06, y - 1.628, z + 0.012) < 0.0068) return null;      // external acoustic meatus
      if (z < -0.08 - 0.158 * (y - 1.715)) return 'occipital';                                    // behind the lambdoid suture
      if (y < 1.615) { if (z > 0.035) return null; if (ax < 0.036 && z < 0.004) return 'occipital'; return ax >= 0.036 && z < 0.012 ? 'temporal-' + s : 'sphenoid'; }
      if (z > zCor) {                                                                              // in front of the coronal suture
        const yLow = ax < 0.012 ? 1.643 : ax < 0.05 ? 1.656 : 1.645;
        if (z > 0.035 && y < yLow) return ax > 0.05 && z < 0.052 ? 'sphenoid' : null;
        return ax > 0.05 && z < 0.045 && y < 1.668 ? 'sphenoid' : 'frontal';
      }
      if (ax > 0.035 && y < 1.683 - 16 * (z + 0.01) ** 2) return z > 0.016 ? 'sphenoid' : 'temporal-' + s;   // below the squamous suture
      return 'parietal-' + s;
    };
    const groups = {};
    for (const t of tris) { const c = [0, 1, 2].map(k => (verts[t[0]][k] + verts[t[1]][k] + verts[t[2]][k]) / 3), lb = label(c[0], c[1], c[2]); if (lb) (groups[lb] = groups[lb] || []).push(t); }
    const shell = (list, th) => {
      const map = new Map(), pos = [], idx = [], vid = i => { if (!map.has(i)) { map.set(i, pos.length / 3); pos.push(...verts[i]); } return map.get(i); };
      const outer = list.map(t => t.map(vid)), n = pos.length / 3;
      for (let k = 0; k < n; k++) { const d = [pos[3 * k] - o[0], pos[3 * k + 1] - o[1], pos[3 * k + 2] - o[2]], f = 1 - th / Math.hypot(d[0], d[1], d[2]); pos.push(o[0] + d[0] * f, o[1] + d[1] * f, o[2] + d[2] * f); }
      const es = new Set(); for (const [a, b, c] of outer) { es.add(a * 1e6 + b); es.add(b * 1e6 + c); es.add(c * 1e6 + a); }
      for (const [a, b, c] of outer) { idx.push(a, b, c, a + n, c + n, b + n); for (const [p, q] of [[a, b], [b, c], [c, a]]) if (!es.has(q * 1e6 + p)) idx.push(p, p + n, q, q, p + n, q + n); }
      return indexed(pos, idx);
    };
    const skullBone = (id, name, latin, side, extra, inf) => add({ id, name, latin, side, region: 'head', geometry: extra ? merge([shell(groups[id], 0.005)].concat(extra)) : shell(groups[id], 0.005), tags: ['skull', 'cranium'], info: inf });
    const frontalX = merge([rimArc(10, 168, 0.0032), orbitWall(28, 152), blob([0.014, 0.0045, 0.004], [0.02, 1.66, 0.075], { ws: 10, hs: 6 })]);
    skullBone('frontal', 'Frontal bone', 'Os frontale', 'M', [both(frontalX), blob([0.011, 0.007, 0.005], [0, 1.649, 0.078], { ws: 10, hs: 8 })],
      info('The forehead bone: a curved squama rising from the brow ridges and supraorbital margins, plus thin orbital plates forming the roofs of both orbits; it meets the parietals at the coronal suture.', 'Protects the frontal lobes, forms the forehead and orbital roofs, and contains the frontal sinuses.',
        '≈ 12 cm wide, 12 cm tall; 5–7 mm thick', 'It forms from two halves; a persistent midline metopic suture is seen in a few percent of adults.'));
    const par = side => info(`${side === 'l' ? 'Left' : 'Right'} parietal bone: a large, gently curved square plate forming the side and roof of the cranium, meeting its partner at the sagittal suture.`, 'Protects the parietal lobes and gives attachment to the temporalis fascia.', '≈ 12 × 12 cm, 5–7 mm thick', 'The parietal eminence is the widest point of the skull; the fontanelles of the newborn lie at its corners.');
    skullBone('parietal-l', 'Left parietal bone', 'Os parietale sinistrum', 'L', null, par('l'));
    skullBone('parietal-r', 'Right parietal bone', 'Os parietale dextrum', 'R', null, par('r'));
    const tempX = merge([sweep([[0.06, 1.632, -0.004], [0.065, 1.628, 0.006], [0.066, 1.624, 0.02]], [0.0022, 0.0042], { radial: 8 }),
      blob([0.008, 0.012, 0.009], [0.053, 1.6, -0.03], { ws: 10, hs: 8, deform: p => p.y < 0 ? 1 - 0.45 * p.y * p.y : 1 }), sweep([[0.042, 1.603, -0.01], [0.036, 1.58, 0.0]], t => 0.0018 * (1 - 0.7 * t), { radial: 6, segs: 4 })]);
    const tmp = side => info(`${side === 'l' ? 'Left' : 'Right'} temporal bone: a thin squama on the side of the skull, the zygomatic process forming the back of the cheek arch, the mastoid process behind the ear, the styloid process and the dense petrous part housing the middle and inner ear.`,
      'Houses the organs of hearing and balance, forms the socket of the jaw joint and anchors the temporalis, masseter and sternocleidomastoid.', 'Squama ≈ 6 × 5 cm; mastoid ≈ 2.5 cm', 'The pterion, where it meets the frontal, parietal and sphenoid, overlies the middle meningeal artery — a blow here can cause an epidural haematoma.');
    skullBone('temporal-l', 'Left temporal bone', 'Os temporale sinistrum', 'L', [tempX], tmp('l'));
    skullBone('temporal-r', 'Right temporal bone', 'Os temporale dextrum', 'R', [mirrorGeo(tempX)], tmp('r'));
    skullBone('occipital', 'Occipital bone', 'Os occipitale', 'M', [both(blob([0.0055, 0.004, 0.009], [0.0135, 1.582, -0.013], { ws: 10, hs: 6, rot: [0, 0.3, 0] }))],
      info('The back and base of the skull: a curved squama with the external occipital protuberance, cupping the cerebellum, and a base pierced by the foramen magnum with the occipital condyles on either side.', 'Protects the occipital lobes and cerebellum and articulates with the atlas to carry the head.',
        `Foramen magnum ≈ 35 × 30 mm at y ${L.head.foramenMagnum[1]}`, 'The spinal cord becomes the medulla oblongata as it passes up through the foramen magnum.'));
    const sphX = merge([sweep([[0.012, 1.607, 0.012], [0.014, 1.59, 0.018]], [0.0012, 0.005], { radial: 8, segs: 4, up: [0, 0, 1] }), sweep([[0.006, 1.627, 0.015], [0.02, 1.632, 0.024], [0.032, 1.635, 0.03]], [0.005, 0.0012], { radial: 8 })]);
    skullBone('sphenoid', 'Sphenoid bone', 'Os sphenoidale', 'M', [both(sphX), blob([0.012, 0.009, 0.012], [0, 1.615, 0.0], { ws: 14, hs: 10, deform: p => p.y > 0.3 ? 1 - 0.35 * Math.exp(-(p.x * p.x + p.z * p.z) / 0.15) : 1 })],
      info('Butterfly-shaped bone at the centre of the skull base: a hollow body with the sella turcica (seat of the pituitary), greater and lesser wings, and pterygoid plates hanging below.', 'Keystone of the cranial base, joining with every other cranial bone; transmits the optic nerves and many other nerves and vessels.',
        '≈ 7 cm across the greater wings', 'The pituitary gland is reached surgically through the sphenoid sinus (transsphenoidal surgery).'));
    add({ id: 'ethmoid', name: 'Ethmoid bone', latin: 'Os ethmoidale', region: 'head', geometry: merge([blob([0.011, 0.013, 0.019], [0, 1.635, 0.056], { ws: 14, hs: 10, noise: { amp: 0.06, freq: 3 } }), blob([0.0012, 0.018, 0.013], [0, 1.622, 0.06], { ws: 8, hs: 10 }),
      blob([0.0018, 0.006, 0.006], [0, 1.648, 0.052], { ws: 8, hs: 6 }), both(orbitWall(152, 212))]), tags: ['skull', 'cranium'],
      info: info('Light, box-like bone between the orbits: the sieve-like cribriform plate and crista galli above, a midline perpendicular plate (upper nasal septum) and air-cell labyrinths forming the medial orbital walls.', 'Separates the nasal cavity from the brain and orbits; olfactory nerve fibres pass through its cribriform plate.',
        '≈ 2.5 cm wide, 4 cm deep', 'A fracture of the cribriform plate can cause loss of smell and CSF leaking from the nose.') });

    // ---------------------------------------------------------- facial skeleton
    addPair({ id: 'nasal-bone', name: 'nasal bone', latin: 'Os nasale', region: 'head', tags: ['skull', 'face'],
      geometry: sweep([[0.003, 1.645, 0.0795], [0.0035, 1.633, 0.0869], [0.004, 1.62, 0.0937]], t => [0.0012, 0.0032 - 0.0005 * t], { radial: 8, up: [1, 0, -1] }),   // narrow, steeply sloped wings: the skin of the nasal bridge is only ~14-20 mm wide
      info: info('Small oblong bone forming, with its partner, the bony bridge of the nose; the lower edge carries the nasal cartilages.', 'Supports the upper nose and protects the nasal cavity.', '≈ 2.5 cm long, 1 cm wide', 'The most commonly fractured facial bones.') });
    const zA = [0.04, 1.603, 0.066], zB = orb(-60 * PI / 180), zC = orb(8 * PI / 180), zD = [0.059, 1.613, 0.047];
    const zygPlate = plate((u, v) => { const p = [0, 1, 2].map(k => (1 - u) * (1 - v) * zA[k] + u * (1 - v) * zD[k] + (1 - u) * v * zB[k] + u * v * zC[k]), b = 0.004 * Math.sin(PI * u) * Math.sin(PI * v); return [p[0] + 0.6 * b, p[1], p[2] + 0.8 * b]; },
      (u, v) => 0.0045 * (0.55 + 0.45 * Math.sin(PI * u) * Math.sin(PI * v)), 6, 6);
    const zyg = merge([zygPlate, rimArc(-95, 12, 0.0028), orbitWall(-40, 28), sweep([[0.056, 1.615, 0.052], [0.062, 1.619, 0.04], [0.066, 1.623, 0.022]], [0.0022, 0.0042], { radial: 8 })]);
    addPair({ id: 'zygomatic', name: 'zygomatic bone', latin: 'Os zygomaticum', region: 'head', geometry: zyg, tags: ['skull', 'face'],
      info: info('The cheekbone: a four-sided body forming the prominence of the cheek, with a frontal process up the lateral orbital rim and a temporal process joining the temporal bone to complete the zygomatic arch.', 'Shapes the cheek, forms the lateral wall and floor of the orbit and anchors the masseter.', '≈ 5 cm wide, 4 cm tall', 'A "tripod" fracture separates it at its three sutures after a blow to the cheek.') });
    const archCurve = (front, ctrl) => { const c = crv(ctrl.slice(1).reverse().map(([x, z]) => [-x, front[1], front[2] + z]).concat(ctrl.map(([x, z]) => [x, front[1], front[2] + z]))); c.half = c.getLength() / 2; return c; };
    const UAc = archCurve(L.head.teethUpperArchFront, [[0, 0], [0.009, -0.002], [0.016, -0.007], [0.021, -0.014], [0.025, -0.023], [0.028, -0.034], [0.03, -0.046], [0.031, -0.058]]);
    const LAc = archCurve([0, 1.565, L.head.teethUpperArchFront[2] - 0.0065], [[0, 0], [0.007, -0.002], [0.013, -0.006], [0.018, -0.013], [0.022, -0.022], [0.025, -0.033], [0.027, -0.045], [0.028, -0.058]]);
    const archAt = (c, s, y) => {
      const u = clamp(0.5 + s / (2 * c.half), 0, 1), p = c.getPointAt(u), t = c.getTangentAt(u), n = new THREE.Vector3(t.z, 0, -t.x).normalize();
      if (n.x * p.x + n.z * (p.z - (L.head.teethUpperArchFront[2] - 0.03)) < 0) n.negate(); if (y != null) p.y = y; return { p, t, n };
    };
    const ap = (c, s, y, out) => { const a = archAt(c, s, y); return [a.p.x + a.n.x * (out || 0), a.p.y, a.p.z + a.n.z * (out || 0)]; };
    // maxilla: alveolar arch + palate + facial walls around the piriform aperture + frontal processes + orbital floors
    const pal = plate((u, v) => { const s = lerp(0.006, 0.062, u), w = Math.abs(2 * v - 1), side = v < 0.5 ? -1 : 1, q = ap(UAc, side * s, 0, -0.0065); return [q[0] * w, 1.5915 + 0.007 * (1 - w * w), q[2]]; }, () => 0.003, 12, 12);
    const zFace = x => 0.0875 - 12 * x * x;
    const maxFront = plate((u, v) => {   // anterior maxilla: alveolar arch (buccal plate over the roots) rising to the nasal aperture and infraorbital margins
      const s = lerp(-0.046, 0.046, u), b = ap(UAc, s, 1.5815, 0.0031 + 0.0014 * H.smoothstep(0.01, 0.03, Math.abs(s))), xt = b[0] * 1.45, ax = Math.abs(xt);   // thinner cover over the incisors (upper-lip skin ~6 mm ahead)
      const yt = ax < 0.011 ? 1.598 : ax < 0.02 ? lerp(1.598, 1.619, (ax - 0.011) / 0.009) : 1.619;
      const p = mix(b, [xt, yt, zFace(xt) - 0.001], v), px = Math.abs(p[0]);
      p[2] += 0.002 * Math.sin(PI * v) * (Math.exp(-(((px - 0.016) / 0.005) ** 2)) - Math.exp(-(((px - 0.03) / 0.008) ** 2)));   // canine eminence / canine fossa
      return p;
    }, (u, v) => 0.0045 * (0.6 + 0.4 * Math.sin(PI * v)), 36, 6);
    const postAlv = sweep([0.036, 0.046, 0.056, 0.066].map(q => ap(UAc, q, 1.588)), [0.0065, 0.0075], { radial: 10 });
    const latWall = plate((u, v) => mix(mix(ap(UAc, 0.042, 1.592, 0.004), ap(UAc, 0.066, 1.592, 0.004), u), mix([0.045, 1.619, 0.06], [0.042, 1.612, 0.036], u), v), () => 0.003, 5, 4);
    const fproc = sweep([[0.0105, 1.617, 0.0825], [0.0092, 1.632, 0.0785], [0.0082, 1.645, 0.0765]], [0.003, 0.0015], { radial: 8, up: [0, 0, 1] });
    add({ id: 'maxilla', name: 'Maxilla', latin: 'Maxilla', region: 'head', tags: ['skull', 'face'],
      geometry: merge([maxFront, pal, both(merge([postAlv, latWall, fproc, rimArc(165, 262, 0.0024), orbitWall(212, 320)])), sweep([[0, 1.597, 0.085], [0, 1.598, 0.095]], t => 0.0025 * (1 - 0.7 * t), { radial: 8, segs: 3 })]),
      info: info('The upper jaw, formed by two maxillae fused in the midline: the alveolar arch holding the 16 upper teeth, the hard palate, the walls of the pear-shaped nasal aperture, the orbital floors and frontal processes beside the nose.', 'Holds the upper teeth, separates the mouth from the nose and forms the central face; it contains the large maxillary sinuses.',
        'Dental arch ≈ 5.5 cm wide, 5 cm deep; alveolar process ≈ 2 cm tall', 'Failure of the maxillary processes to fuse in the embryo causes cleft lip and palate.') });
    // mandible: continuous plate from right condyle to left condyle
    const Up = [ap(LAc, 0, 1.5625), ap(LAc, 0.015, 1.5625), ap(LAc, 0.03, 1.5625), ap(LAc, 0.045, 1.5625), [0.036, 1.566, 0.026], [0.046, 1.59, 0.024], [0.052, 1.613, 0.02]];
    const Lw = [[0, 1.527, 0.074], [0.018, 1.528, 0.068], [0.0271, 1.533, 0.0607], [0.0332, 1.54, 0.0491], [0.047, 1.549, 0.024], [L.head.jawAngleL[0] - 0.0055, L.head.jawAngleL[1] - 0.003, L.head.jawAngleL[2] + 0.004], [0.06, 1.611, -0.004]];
    const full = arr => arr.slice(1).reverse().map(p => [-p[0], p[1], p[2]]).concat(arr);
    const MU = crv(full(Up)), ML = crv(full(Lw));
    const mand = plate((u, v) => { const w = Math.abs(2 * u - 1), p = mix(cp(ML, u), cp(MU, u), v); p[1] -= 0.011 * Math.sin(PI * v) * H.smoothstep(0.85, 1, w); return p; },
      (u, v) => { const w = Math.abs(2 * u - 1), t0 = w < 0.62 ? 0.012 + 0.004 * Math.pow(1 - w / 0.62, 3) : lerp(0.012, 0.0068, clamp((w - 0.62) / 0.2, 0, 1)) - (w > 0.9 && v > 0.6 ? 0.002 : 0), sv = Math.pow(Math.sin(PI * v), 0.35); return t0 * (v < 0.5 ? 0.3 + 0.7 * sv : 0.55 + 0.45 * sv); }, 48, 10);
    add({ id: 'mandible', name: 'Mandible', latin: 'Mandibula', region: 'head', tags: ['skull', 'face'],
      geometry: merge([rough(mand, 0.0003, 200), both(blob([0.009, 0.0045, 0.005], [0.06, 1.617, -0.003], { ws: 12, hs: 8, rot: [0, 0.25, 0] })), blob([0.012, 0.007, 0.004], [0, 1.532, 0.074], { ws: 10, hs: 8 })]),
      info: info('The lower jaw, the only freely movable skull bone: a U-shaped body carrying the 16 lower teeth and the chin, and two vertical rami ending in the coronoid process (for temporalis) and the condyle that sits in the temporomandibular joint in front of the ear.', 'Opens and closes the mouth for chewing and speech, driven by the masseter, temporalis and pterygoid muscles.',
        '≈ 10 cm between the angles; ramus ≈ 5–6 cm tall', 'The strongest facial bone, yet often fractured in two places at once because it forms a ring with the skull base.') });
    add({ id: 'hyoid', name: 'Hyoid bone', latin: 'Os hyoideum', region: 'neck', tags: ['neck'],
      geometry: sweep([[-0.021, 1.536, 0.012], [-0.017, 1.532, 0.028], [-0.009, 1.529, 0.039], [0, 1.528, 0.042], [0.009, 1.529, 0.039], [0.017, 1.532, 0.028], [0.021, 1.536, 0.012]], t => { const w = Math.abs(2 * t - 1); return [0.0025 * (1 - 0.4 * w), 0.0045 * (1 - 0.55 * w)]; }, { radial: 10 }),
      info: info('U-shaped bone in the front of the neck at the level of C3, with a body and greater and lesser horns; it touches no other bone and hangs from muscles and ligaments.', 'Anchors the tongue and the muscles that raise and lower the larynx during swallowing and speech.', '≈ 4 cm across, body 2.5 cm wide', 'A fractured hyoid is a classic forensic sign of strangulation.') });

    // ---------------------------------------------------------- teeth (32): local y = 0 at the occlusal edge, +y toward the root apex
    const TT = ['central incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'third molar'];
    const TD = { u: { md: [0.0085, 0.0065, 0.0075, 0.007, 0.0065, 0.01, 0.009, 0.0085], bl: [0.007, 0.006, 0.008, 0.009, 0.009, 0.011, 0.011, 0.01], ch: [0.0105, 0.009, 0.01, 0.0085, 0.0078, 0.0075, 0.007, 0.0065], rl: [0.013, 0.013, 0.017, 0.014, 0.014, 0.013, 0.012, 0.011], tilt: [0.3, 0.3, 0.15, 0.08, 0.05, 0, 0, 0] },
      l: { md: [0.0053, 0.0059, 0.007, 0.007, 0.007, 0.011, 0.0105, 0.01], bl: [0.006, 0.0063, 0.0075, 0.0077, 0.008, 0.0105, 0.01, 0.0095], ch: [0.009, 0.0095, 0.011, 0.0085, 0.008, 0.0075, 0.007, 0.007], rl: [0.0125, 0.014, 0.016, 0.014, 0.0145, 0.014, 0.013, 0.011], tilt: [0.25, 0.25, 0.1, 0, 0, -0.04, -0.06, -0.08] } };
    function toothGeo(k, d, upper) {
      const md = d.md[k] / 2, bl = d.bl[k] / 2, ch = d.ch[k], rl = d.rl[k], roots = [];
      let secs;
      if (k < 2) secs = [[0, 0.9 * md, 0.2 * bl, 2.6], [0.25 * ch, md, 0.55 * bl, 2.4], [0.65 * ch, 0.92 * md, 0.9 * bl, 2.2], [ch, 0.7 * md, 0.85 * bl, 2], [ch + 0.45 * rl, 0.5 * md, 0.65 * bl, 2], [ch + 0.85 * rl, 0.22 * md, 0.28 * bl, 2], [ch + rl, 0.05 * md, 0.05 * bl, 2]];
      else if (k === 2) secs = [[0, 0.1 * md, 0.1 * bl, 2], [0.2 * ch, 0.6 * md, 0.55 * bl, 2], [0.55 * ch, md, bl, 2.1], [ch, 0.75 * md, 0.85 * bl, 2], [ch + 0.5 * rl, 0.5 * md, 0.62 * bl, 2], [ch + 0.88 * rl, 0.2 * md, 0.25 * bl, 2], [ch + rl, 0.04 * md, 0.04 * bl, 2]];
      else {
        const n = k > 4 ? 3.2 : 2.4; secs = [[0.14 * ch, 0.22 * md, 0.18 * bl, 2], [0, 0.62 * md, 0.62 * bl, n], [0.18 * ch, 0.95 * md, 0.95 * bl, n], [0.55 * ch, md, bl, n], [ch, 0.82 * md, 0.85 * bl, n]];
        if (k < 5) secs.push([ch + 0.5 * rl, 0.5 * md, 0.62 * bl, 2], [ch + 0.9 * rl, 0.18 * md, 0.25 * bl, 2], [ch + rl, 0.04 * md, 0.05 * bl, 2]);
        else {
          secs.push([ch + 0.2 * rl, 0.75 * md, 0.8 * bl, 2.4]);
          for (const [rx, rz] of (upper ? [[-0.45, 0.45], [0.45, 0.45], [0, -0.5]] : [[-0.5, 0], [0.5, 0]]))
            roots.push(sweep([[rx * md * 0.8, ch + 0.15 * rl, rz * bl * 0.8], [rx * md * 1.05, ch + 0.6 * rl, rz * bl * 1.05], [rx * md * 0.9, ch + rl, rz * bl]], t => (upper && rz < 0 ? 0.0024 : 0.002) * (1 - 0.75 * t) + 0.0004, { radial: 6, segs: 5 }));
        }
      }
      const geo = H.loft(secs.map(([y, rx, rz, n]) => ({ y, rx, rz, n })), { radial: 10, subdiv: 2 });
      if (k > 2) {
        const cusps = k < 5 ? [[0, 0.45 * bl]].concat([[0, -0.45 * bl]]) : [[0.45 * md, 0.45 * bl], [-0.45 * md, 0.45 * bl], [0.45 * md, -0.45 * bl], [-0.45 * md, -0.45 * bl]], sg = 0.35 * md;
        H.displace(geo, p => p.y < 0.35 * ch ? new THREE.Vector3(p.x, p.y - 0.0013 * cusps.reduce((s, [cx, cz]) => s + Math.exp(-((p.x - cx) ** 2 + (p.z - cz) ** 2) / (sg * sg)), 0), p.z) : 0);
      }
      return roots.length ? merge([geo].concat(roots)) : geo;
    }
    for (const jaw of ['u', 'l']) {
      const d = TD[jaw], upper = jaw === 'u', arch = upper ? UAc : LAc;
      for (const sd of [1, -1]) {
        let s = 0.0001;
        for (let k = 0; k < 8; k++) {
          const sc = s + d.md[k] / 2; s += d.md[k] + 0.0002;
          const edgeY = 1.5715 + (upper ? (k < 2 ? -0.0012 : k === 2 ? -0.0005 : 0.0003) : (k < 2 ? 0.0012 : k === 2 ? 0.0005 : -0.0003));
          const a = archAt(arch, sd * sc, edgeY), tilt = d.tilt[k];
          const Y = V3([-a.n.x * tilt, upper ? 1 : -1, -a.n.z * tilt]).normalize(), X = a.t.clone(); X.addScaledVector(Y, -X.dot(Y)).normalize();
          let Z = new THREE.Vector3().crossVectors(X, Y); if (Z.dot(a.n) < 0) { X.negate(); Z.negate(); }
          const geo = toothGeo(k, d, upper); geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(a.p));
          const kind = k < 2 ? 'incisor' : k === 2 ? 'canine' : k < 5 ? 'premolar' : 'molar', sideW = sd > 0 ? 'left' : 'right';
          const desc = kind === 'incisor' ? 'Chisel-shaped tooth with a thin cutting edge and a single conical root.' : kind === 'canine' ? 'The longest tooth, with one pointed cusp and a single very long root.'
            : kind === 'premolar' ? 'Transitional tooth with two cusps (buccal and lingual) on its biting surface and ' + (upper && k === 3 ? 'usually two roots.' : 'a single root.')
              : `Large grinding tooth with four cusps around a central fossa and ${upper ? 'three roots (two buccal, one palatal)' : 'two roots (mesial and distal)'}.`;
          const fn = kind === 'incisor' ? 'Bites and cuts food.' : kind === 'canine' ? 'Grips and tears food and guides the jaw in side-to-side movements.' : kind === 'premolar' ? 'Holds and crushes food.' : 'Grinds food into a paste during chewing.';
          const note = ['Central incisors erupt at about 7 years (lower first) and are the teeth most often chipped in falls.', 'Upper lateral incisors are the most often congenitally missing teeth after wisdom teeth.', 'Canine roots can reach 17 mm; upper canines are often called eye teeth.', 'First premolars are the teeth most often extracted to make space in orthodontics.', 'Premolars replace the deciduous molars at 10–12 years.', 'The first molar erupts at about 6 years (the "six-year molar") and is the key to the bite.', 'The second molar erupts at about 12 years.', 'The wisdom tooth erupts at 17–25 years, if at all, and is often impacted.'][k];
          add({ id: `tooth-${jaw}${sd > 0 ? 'l' : 'r'}${k + 1}`, name: `${upper ? 'Upper' : 'Lower'} ${sideW} ${TT[k]}`, latin: 'Dens ' + (kind === 'incisor' ? 'incisivus' : kind === 'canine' ? 'caninus' : kind === 'premolar' ? 'premolaris' : 'molaris'),
            side: sd > 0 ? 'L' : 'R', region: 'head', color: C.tooth, geometry: geo, tags: ['tooth', upper ? 'maxillary' : 'mandibular', kind],
            info: info(desc + ' The crown is covered with enamel, the hardest substance in the body.', fn, `Crown ≈ ${(d.md[k] * 1000).toFixed(1)} × ${(d.bl[k] * 1000).toFixed(1)} mm, ${(d.ch[k] * 1000).toFixed(1)} mm tall; root ≈ ${mm(d.rl[k])} mm`, note) });
        }
      }
    }
  }
  return g;
});
