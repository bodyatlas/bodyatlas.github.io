/* systems/respiratory.js - Respiratory system: external-nose cartilages, nasal cavity, paranasal sinuses, pharynx, larynx,
   trachea with C-rings, bronchial tree, lungs (5 lobes with fissures), pleura and a magnified acinus inset.
   Everything is positioned from core/landmarks.js (L). Lungs are ray-marched shells of a signed-distance model built from
   the chest wall (L.trunkAt - 3 cm), the diaphragm domes, the mediastinum (heart, aorta, SVC) and the fissure planes. */
ANATOMY.register('respiratory', { name: 'Respiratory', description: 'Nose, sinuses, pharynx, larynx, trachea, bronchial tree, lungs and pleura' }, function (THREE, H, L, ctx) {
  const g = H.group('respiratory');
  const SYS = 'respiratory', ORG = H.LAYER.ORGAN, C = H.COLORS;
  const add = (spec) => { const m = H.part(Object.assign({ system: SYS, layer: ORG }, spec)); g.add(m); return m; };
  const addPair = (spec, opts) => { const ps = H.pair(Object.assign({ system: SYS, layer: ORG }, spec), opts); ps.forEach(p => g.add(p)); return ps; };
  const M = (color, o) => H.mat(Object.assign({ color, roughness: 0.55 }, o || {}));
  const glass = (color, op) => H.mat({ color, opacity: op, roughness: 0.35, side: THREE.DoubleSide });
  const info = (description, fn, size, notes) => ({ description, function: fn, size, notes });

  // ---------------------------------------------------------------- private helpers
  const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
  function segDist(p, a, b) {
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], px = p.x - a[0], py = p.y - a[1], pz = p.z - a[2];
    const t = H.clamp((px * ax + py * ay + pz * az) / (ax * ax + ay * ay + az * az), 0, 1);
    return Math.hypot(px - ax * t, py - ay * t, pz - az * t);
  }
  function polyDist(p, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(p, pts[i], pts[i + 1])); return d; }
  function ellD(p, c, r) { const q = Math.hypot((p.x - c[0]) / r[0], (p.y - c[1]) / r[1], (p.z - c[2]) / r[2]); return (q - 1) * Math.min(r[0], r[1], r[2]); }
  // average normals of coincident vertices (sphere seams / poles) so shading has no seams
  function weld(geo) {
    geo.computeVertexNormals();
    const P = geo.attributes.position, N = geo.attributes.normal, map = new Map();
    for (let i = 0; i < P.count; i++) {
      const k = Math.round(P.getX(i) * 2e5) + ',' + Math.round(P.getY(i) * 2e5) + ',' + Math.round(P.getZ(i) * 2e5);
      let e = map.get(k); if (!e) map.set(k, e = []); e.push(i);
    }
    for (const e of map.values()) if (e.length > 1) {
      let x = 0, y = 0, z = 0; for (const i of e) { x += N.getX(i); y += N.getY(i); z += N.getZ(i); }
      const l = Math.hypot(x, y, z) || 1; for (const i of e) N.setXYZ(i, x / l, y / l, z / l);
    }
    N.needsUpdate = true; return geo;
  }
  // star-shaped shell of the region F(p) <= 0 seen from centre c (ray march + bisection along every sphere direction)
  function shell(F, c, ws, hs) {
    const Cc = H.v3(c), q = new THREE.Vector3(), step = 0.0015, tmax = 0.32;
    const geo = new THREE.SphereGeometry(1, ws, hs), P = geo.attributes.position, T = new Float32Array(P.count), dir = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      dir.fromBufferAttribute(P, i).normalize(); let t0 = 0, t = step, hit = false;
      for (; t < tmax; t += step) { q.copy(dir).multiplyScalar(t).add(Cc); if (F(q) > 0) { hit = true; break; } t0 = t; }
      if (!hit) t = tmax;
      let a = t0, b = t;
      for (let k = 0; k < 13; k++) { const m = (a + b) / 2; q.copy(dir).multiplyScalar(m).add(Cc); if (F(q) > 0) b = m; else a = m; }
      T[i] = (a + b) / 2;
    }
    // 3x3 median filter on the (hs+1) x (ws+1) grid removes isolated spikes where rays graze thin margins
    const W = ws + 1, id = (iy, ix) => H.clamp(iy, 0, hs) * W + ((ix + ws) % ws), T2 = new Float32Array(P.count);
    for (let iy = 0; iy <= hs; iy++) for (let ix = 0; ix <= ws; ix++) {
      const nb = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) nb.push(T[id(iy + a, ix + b)]);
      nb.sort((x, y) => x - y); T2[iy * W + ix] = nb[4];
    }
    for (let i = 0; i < P.count; i++) { dir.fromBufferAttribute(P, i).normalize().multiplyScalar(T2[i]).add(Cc); P.setXYZ(i, dir.x, dir.y, dir.z); }
    geo.computeVertexNormals(); return geo;
  }
  // mottled vertex colours (multiplied with the material colour)
  function mottle(geo, amp, freq, seed) {
    const P = geo.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) * freq + seed, y = P.getY(i) * freq, z = P.getZ(i) * freq;
      const n = 0.5 + 0.5 * H.fbm(x, y, z, 3), sp = H.noise3(x * 6 + 11, y * 6, z * 6 - 5);
      const v = 1 - amp * n - (sp > 0.66 ? 0.14 * (sp - 0.66) / 0.34 : 0);
      col[i * 3] = v; col[i * 3 + 1] = v * 0.96; col[i * 3 + 2] = v * 0.97;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo;
  }
  function lungMat(opts) { const m = H.mat(Object.assign({ color: C.lung, roughness: 0.72 }, opts || {})); m.vertexColors = true; return m; }

  // ---------------------------------------------------------------- lung / pleura signed-distance model
  const DI = L.organ.diaphragm, HT = L.organ.heart, LR = L.organ.lungR, LLg = L.organ.lungL;
  const base = L.trunkAt(1.2);
  function wallRatio(x, z) { const rx = base.rx - 0.03, rz = base.rz - 0.03, n = base.n; return Math.pow(Math.pow(Math.abs(x) / rx, n) + Math.pow(Math.abs(z - base.cz) / rz, n), 1 / n); }
  // height of the upper surface of the diaphragm under (x, z): domes, steep zone of apposition at the wall, lower posteriorly
  function diaphY(x, z, drop) {
    const dome = x < 0 ? DI.domeR : DI.domeL;
    const rim = DI.rimY + 0.002 + 0.05 * H.smoothstep(0.0, 0.1, z);
    const q = Math.min(1.2, wallRatio(x, z)), bump = Math.max(0, 1 - Math.pow(q, 3.5));
    const dd = Math.pow((x - dome[0]) / 0.09, 2) + Math.pow((z - dome[2]) / 0.1, 2);
    return rim - (drop || 0) * (1 - bump) + Math.max(0, dome[1] - rim) * bump * (1 - 0.35 * H.smoothstep(0, 1, dd));
  }
  function wallD(p, inset) { const s = L.trunkAt(p.y), rx = s.rx - inset, rz = s.rz - inset; return (Math.pow(Math.pow(Math.abs(p.x) / rx, s.n) + Math.pow(Math.abs(p.z - s.cz) / rz, s.n), 1 / s.n) - 1) * Math.min(rx, rz); }
  function apexD(p, sgn) {
    const ap = sgn < 0 ? LR.apex : LLg.apex, cx = sgn < 0 ? LR.center[0] : LLg.center[0];
    const f = H.clamp((ap[1] - p.y) / 0.16, 0, 1), ax = H.lerp(ap[0], cx * 0.95, f), az = H.lerp(ap[2], -0.005, f);
    const r = p.y >= ap[1] ? -(p.y - ap[1]) : 0.1 * Math.sqrt((ap[1] - p.y) / 0.14);
    return Math.hypot(p.x - ax, p.z - az) - r;
  }
  const hAx = new THREE.Vector3().subVectors(H.v3(HT.apex), H.v3(HT.base)), hLen = hAx.length() / 2; hAx.normalize();
  const hC = H.v3(HT.base).lerp(H.v3(HT.apex), 0.5);
  function heartD(p) { // rotated ellipsoid around the base->apex axis, inflated for pericardium
    const dx = p.x - hC.x, dy = p.y - hC.y, dz = p.z - hC.z, u = dx * hAx.x + dy * hAx.y + dz * hAx.z;
    const v = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - u * u)), A = hLen + 0.012, B = 0.058;
    return (Math.hypot(u / A, v / B) - 1) * B;
  }
  const AORTA = [[0.004, 1.33, 0.022], [0.004, 1.385, 0.01], [0.004, 1.397, -0.012], [0.014, 1.378, -0.042], [0.016, 1.30, -0.052], [0.016, 1.17, -0.05]];
  const SVC = [[-0.028, 1.45, 0.02], [-0.028, 1.33, 0.018]];
  function medW(p) { return 0.022 - 0.014 * H.smoothstep(0.015, 0.04, p.z) + 0.004 * H.smoothstep(-0.04, -0.065, p.z); }
  // o: { wall, drop, grow } -> parietal pleura uses a smaller inset and a lower (recess) base
  function lungF(p, sgn, o) {
    o = o || {}; const K = 0.008, grow = o.grow || 0;
    let d = wallD(p, o.wall || 0.03);
    d = smax(d, apexD(p, sgn) - grow, K);
    d = smax(d, diaphY(p.x, p.z, o.drop) + 0.004 - grow - p.y, K);
    d = smax(d, medW(p) - grow - sgn * p.x, K);
    d = smax(d, -heartD(p) - grow, K);
    if (sgn > 0) { d = smax(d, -ellD(p, [0.03, 1.255, 0.085], [0.05, 0.048, 0.06]) - grow, K); d = smax(d, 0.0155 - grow - polyDist(p, AORTA), K); }
    else d = smax(d, 0.013 - grow - polyDist(p, SVC), K);
    return d;
  }
  // fissure planes (oblique: T3 spinous level posteriorly -> 6th costal cartilage anteriorly; horizontal right at y 1.30)
  function obl(sgn) {
    const A = sgn < 0 ? [1.39, -0.09] : [1.395, -0.09], B = sgn < 0 ? [1.20, 0.07] : [1.205, 0.065];
    const dy = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dy, dz), ny = -dz / l * -1, nz = dy / l * -1;
    return (p) => (p.y - A[0]) * Math.abs(ny) + (p.z - A[1]) * Math.abs(nz);
  }
  const oblR = obl(-1), oblL = obl(1), GAP = 0.0016, HFY = 1.30, KF = 0.003;
  const LOBE = {
    ru: (p) => smax(smax(lungF(p, -1), GAP - oblR(p), KF), HFY + GAP - p.y, KF),
    rm: (p) => smax(smax(lungF(p, -1), GAP - oblR(p), KF), p.y - HFY + GAP, KF),
    rl: (p) => smax(lungF(p, -1), oblR(p) + GAP, KF),
    lu: (p) => smax(lungF(p, 1), GAP - oblL(p), KF),
    ll: (p) => smax(lungF(p, 1), oblL(p) + GAP, KF)
  };
  const lungInside = (p) => (p.x < 0 ? lungF(p, -1) : lungF(p, 1));   // used to keep the bronchial tree inside the lungs

  function lobeGeo(F, c, seed) {
    const geo = shell(F, c, 72, 54);
    H.displace(geo, (p) => 0.0006 * H.fbm(p.x * 160 + seed, p.y * 160, p.z * 160, 2));
    mottle(geo, 0.16, 70, seed); return weld(geo);
  }
  const LOBES = [
    { id: 'lung-right-upper-lobe', name: 'Right lung, upper lobe', latin: 'Lobus superior pulmonis dextri', side: 'R', F: LOBE.ru, c: [-0.085, 1.37, 0.0],
      info: info('The right upper lobe fills the apex and upper front of the right lung, above the horizontal fissure and in front of the upper part of the oblique fissure.', 'Gas exchange; it is ventilated by the right upper lobe bronchus through its apical, posterior and anterior segments.', 'About 20% of total lung volume; its apex rises 2–3 cm above the medial third of the clavicle.', 'Because the apex projects into the root of the neck, subclavian line insertion or a stab wound there can cause a pneumothorax; apical (Pancoast) tumours can compress the brachial plexus and sympathetic chain.') },
    { id: 'lung-right-middle-lobe', name: 'Right lung, middle lobe', latin: 'Lobus medius pulmonis dextri', side: 'R', F: LOBE.rm, c: [-0.105, 1.265, 0.045],
      info: info('A wedge-shaped lobe at the front and lower part of the right lung, between the horizontal fissure (4th costal cartilage) and the oblique fissure.', 'Gas exchange; ventilated by the middle lobe bronchus through its lateral and medial segments.', 'The smallest lobe, roughly 10% of total lung volume.', 'Its long, narrow bronchus makes it prone to collapse (middle lobe syndrome); consolidation here blurs the right heart border on a chest X-ray (silhouette sign).') },
    { id: 'lung-right-lower-lobe', name: 'Right lung, lower lobe', latin: 'Lobus inferior pulmonis dextri', side: 'R', F: LOBE.rl, c: [-0.11, 1.29, -0.06],
      info: info('The largest right lobe, lying below and behind the oblique fissure and resting on the right dome of the diaphragm.', 'Gas exchange; ventilated by the right lower lobe bronchus through a superior and four basal segments.', 'About 25% of total lung volume; posteriorly it reaches the 10th rib.', 'Inhaled foreign bodies and aspirated material most often end up here, because the right main bronchus is wider and more vertical than the left.') },
    { id: 'lung-left-upper-lobe', name: 'Left lung, upper lobe (with lingula)', latin: 'Lobus superior pulmonis sinistri', side: 'L', F: LOBE.lu, c: [0.105, 1.35, 0.0],
      info: info('The upper lobe of the left lung, including the lingula: the tongue-shaped process below the cardiac notch, where the anterior border is pushed aside by the heart.', 'Gas exchange; ventilated by the left upper lobe bronchus (apicoposterior and anterior segments, plus superior and inferior lingular segments).', 'About 22% of total lung volume; the cardiac notch indents the anterior border by 3–4 cm at the 4th–5th costal cartilages.', 'The lingula is the left-sided counterpart of the right middle lobe; the cardiac notch leaves part of the pericardium uncovered by lung (the area of superficial cardiac dullness).') },
    { id: 'lung-left-lower-lobe', name: 'Left lung, lower lobe', latin: 'Lobus inferior pulmonis sinistri', side: 'L', F: LOBE.ll, c: [0.11, 1.285, -0.06],
      info: info('The left lower lobe lies below and behind the oblique fissure and rests on the left dome of the diaphragm; its medial surface is grooved by the descending aorta.', 'Gas exchange; ventilated by the left lower lobe bronchus (superior, anteromedial basal, lateral basal and posterior basal segments).', 'About 23% of total lung volume; the left lung as a whole is ~10% smaller than the right because of the heart.', 'Lower-lobe pneumonia irritating the diaphragmatic pleura can refer pain to the shoulder tip (phrenic nerve, C3–C5) or the upper abdomen.') }
  ];
  LOBES.forEach((lb, i) => add({ id: lb.id, name: lb.name, latin: lb.latin, side: lb.side, region: 'thorax', depth: 0.2, geometry: lobeGeo(lb.F, lb.c, i * 13.7),
    material: lungMat(), info: lb.info, parent: 'pleura-visceral-' + lb.side.toLowerCase(), tags: ['lung', 'lobe'] }));

  // pleura: visceral hugs the lung (and dips into fissures), parietal lines the wall and extends into the costodiaphragmatic recess
  [-1, 1].forEach(sgn => {
    const sd = sgn < 0 ? 'r' : 'l', c = [sgn * 0.1, 1.30, -0.02];
    const vis = weld(shell((p) => lungF(p, sgn) - 0.0012, c, 60, 44));
    add({ id: 'pleura-visceral-' + sd, name: (sgn < 0 ? 'Right' : 'Left') + ' visceral pleura', latin: 'Pleura visceralis', side: sgn < 0 ? 'R' : 'L', region: 'thorax', depth: 0,
      geometry: vis, material: H.mat({ color: C.pleura, opacity: 0.25, roughness: 0.25 }), tags: ['lung', 'pleura'],
      info: info('A thin, glistening serous membrane that tightly covers the lung surface and dips into the fissures between the lobes.', 'Secretes and spreads pleural fluid so the lung glides smoothly against the chest wall during breathing.', 'A single layer of mesothelial cells on connective tissue, roughly 30–80 µm thick.', 'The visceral pleura has no pain fibres; chest pain in pneumonia (pleurisy) starts only when inflammation reaches the parietal pleura.') });
    const par = weld(shell((p) => lungF(p, sgn, { wall: 0.026, drop: 0.018, grow: 0.003 }), c, 56, 42));
    add({ id: 'pleura-parietal-' + sd, name: (sgn < 0 ? 'Right' : 'Left') + ' parietal pleura', latin: 'Pleura parietalis', side: sgn < 0 ? 'R' : 'L', region: 'thorax', depth: 0,
      geometry: par, material: H.mat({ color: C.pleura, opacity: 0.12, roughness: 0.25, side: THREE.DoubleSide }), tags: ['pleura'],
      info: info('The outer pleural layer lining the inner chest wall, diaphragm and mediastinum; below the lung edge it forms the costodiaphragmatic recess.', 'Seals the pleural cavity, a potential space with 10–20 ml of fluid under negative pressure that keeps the lungs expanded.', 'The recess extends about two rib spaces (≈5 cm) below the lower lung border in the mid-axillary line.', 'Effusions collect first in the costodiaphragmatic recess and blunt the costophrenic angle on an upright chest X-ray; the parietal pleura is richly supplied by pain-sensitive intercostal and phrenic nerves.') });
  });

  // ---------------------------------------------------------------- airway helpers
  // thin solid plate around a parametric mid-surface f(u,v) -> [x,y,z], u,v in 0..1; th = thickness (number | fn(u,v))
  function slab(f, nu, nv, th) {
    const mid = [], nrm = [], pos = [], idx = [], W = nu + 1, e = 1e-3, T = typeof th === 'function' ? th : () => th;
    const P = (u, v) => H.v3(f(H.clamp(u, 0, 1), H.clamp(v, 0, 1)));
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, du = P(u + e, v).sub(P(u - e, v)), dv = P(u, v + e).sub(P(u, v - e));
      mid.push(P(u, v)); nrm.push(du.cross(dv).normalize());
    }
    const cnt = mid.length;
    for (const s of [1, -1]) for (let k = 0; k < cnt; k++) { const i = k % W, j = (k - i) / W, h = s * T(i / nu, j / nv) / 2, p = mid[k], n = nrm[k]; pos.push(p.x + n.x * h, p.y + n.y * h, p.z + n.z * h); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, b, d, a, d, c, cnt + a, cnt + d, cnt + b, cnt + a, cnt + c, cnt + d);
    }
    const bd = [];
    for (let i = 0; i < nu; i++) bd.push(i);
    for (let j = 0; j < nv; j++) bd.push(j * W + nu);
    for (let i = nu; i > 0; i--) bd.push(nv * W + i);
    for (let j = nv; j > 0; j--) bd.push(j * W);
    for (let k = 0; k < bd.length; k++) { const a = bd[k], b = bd[(k + 1) % bd.length]; idx.push(a, cnt + a, b, b, cnt + a, cnt + b); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  // matrix placing a local XY-plane ring (axis +Z) at p, facing along tangent T, with local -Y pointing to 'back'
  function ringMatrix(p, T, back) {
    const Z = T.clone().normalize(), Bk = back.clone().sub(Z.clone().multiplyScalar(back.dot(Z))).normalize();
    const Y = Bk.clone().negate(), X = new THREE.Vector3().crossVectors(Y, Z);
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
  }
  // tube with shallow cartilage-ring ridges every 'pitch' metres
  function ringedTube(pts, r0, r1, radial, pitch, amp) {
    const geo = H.tube(pts, (t) => H.lerp(r0, r1, t), { radial, step: 0.003 }), len = geo.userData.curve.getLength(), uv = geo.attributes.uv;
    if (pitch) H.displace(geo, (p, n, i) => amp * Math.pow(0.5 + 0.5 * Math.cos(uv.getX(i) * len / pitch * Math.PI * 2), 3));
    return geo;
  }
  const rot = (v, axis, ang) => v.clone().applyAxisAngle(axis, ang);
  const perp = (d) => { const a = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); return new THREE.Vector3().crossVectors(d, a).normalize(); };
  // longest s <= len along dir from start that stays inside region F (with margin)
  function fit(F, start, dir, len, margin) {
    const q = new THREE.Vector3();
    for (let s = len; s > 0.004; s -= 0.002) { q.copy(dir).multiplyScalar(s).add(start); if (F(q) < -margin) return s; }
    return 0;
  }

  // ---------------------------------------------------------------- trachea, carina, main & lobar bronchi
  const TR = L.organ.trachea;
  const trPts = [TR.top, [0, 1.455, 0.031], [-0.001, 1.43, 0.023], [-0.003, 1.405, 0.011], [-0.002, 1.382, -0.004], TR.carina];
  const trR = TR.r - 0.0006, BACK = new THREE.Vector3(0, 0, -1);
  const trWall = H.tube(trPts, trR, { radial: 24, step: 0.004, caps: false });
  const trCurve = trWall.userData.curve, trUv = trWall.attributes.uv;
  H.displace(trWall, (p, n, i) => {   // flatten the posterior (membranous) wall into a D-shaped cross-section
    const c = trCurve.getPointAt(trUv.getX(i)), off = p.clone().sub(c), b = off.dot(BACK), lim = 0.62 * trR;
    return b > lim ? p.clone().add(BACK.clone().multiplyScalar(lim - b)) : p;
  });
  add({ id: 'trachea', name: 'Trachea', latin: 'Trachea', side: 'M', region: 'body', depth: 0.35, geometry: trWall, material: M(C.trachea, { side: THREE.DoubleSide }), tags: ['airway'],
    info: info('The windpipe: a flexible tube running from the cricoid cartilage (C6) down to the carina at the sternal angle (T4/T5), held open by C-shaped cartilage rings.', 'Conducts air between the larynx and the bronchi; its ciliated mucosa sweeps mucus and trapped particles up towards the throat (mucociliary escalator).', '10–12 cm long and about 2 cm in outer diameter in adults, with 16–20 cartilage rings.', 'It shifts away from a tension pneumothorax and towards a collapsed lung; a tracheostomy is made through the 2nd–4th rings, just below the thyroid isthmus.') });
  const rings = [], NR = 18, ARC = Math.PI * 2 * 0.72;
  for (let i = 0; i < NR; i++) {
    const t = 0.035 + i * (0.93 / (NR - 1)), p = trCurve.getPointAt(t), T = trCurve.getTangentAt(t);
    const tor = H.torus(trR + 0.0003, 0.0013, { radial: 6, tubular: 26, arc: ARC });
    tor.rotateZ(Math.PI / 2 - ARC / 2); tor.scale(1, 1, 1.45);
    tor.applyMatrix4(ringMatrix(p, T, BACK)); rings.push(tor);
  }
  add({ id: 'tracheal-cartilages', name: 'Tracheal cartilages (C-rings)', latin: 'Cartilagines tracheales', side: 'M', region: 'body', depth: 0.35, geometry: H.merge(rings), color: C.cartilage, parent: 'trachea', tags: ['airway', 'cartilage'],
    info: info('Eighteen horseshoe-shaped rings of hyaline cartilage embedded in the tracheal wall, open at the back where the trachea touches the oesophagus.', 'Keep the airway from collapsing under the negative pressure of inspiration while leaving the posterior wall flexible.', 'Each ring is about 4 mm high and 1 mm thick, joined to its neighbours by fibrous annular ligaments.', 'The rings often calcify with age; congenital complete "O-rings" are a cause of tracheal stenosis in infants.') });
  const tml = slab((u, v) => {
    const t = 0.02 + v * 0.95, c = trCurve.getPointAt(t), T = trCurve.getTangentAt(t);
    const bk = BACK.clone().sub(T.clone().multiplyScalar(BACK.dot(T))).normalize(), sd = new THREE.Vector3().crossVectors(T, bk).normalize();
    return c.add(bk.multiplyScalar(0.62 * trR + 0.0007)).add(sd.multiplyScalar((u - 0.5) * 0.017));
  }, 6, 40, 0.0012);
  add({ id: 'trachealis', name: 'Trachealis muscle and membranous wall', latin: 'Musculus trachealis', side: 'M', region: 'body', depth: 0.35, geometry: tml, color: '#c98a84', parent: 'trachea', tags: ['airway'],
    info: info('A band of smooth muscle and fibro-elastic membrane that closes the gap between the ends of the C-rings on the back of the trachea, directly in front of the oesophagus.', 'Contracts to narrow the trachea and speed up airflow when coughing; its pliability lets a swallowed food bolus bulge forwards.', 'About 1.5 cm wide and 1–2 mm thick along the whole tracheal length.', 'Because the back wall is membranous, an oesophageal foreign body can compress the airway, and tracheo-oesophageal fistulas form here.') });
  add({ id: 'carina', name: 'Carina of trachea', latin: 'Carina tracheae', side: 'M', region: 'thorax', depth: 0.45, color: C.cartilage, parent: 'trachea', tags: ['airway'],
    geometry: H.blob([0.0022, 0.0045, 0.009], { ws: 20, hs: 14, deform: (p) => 1 - 0.45 * H.smoothstep(0, 1, p.y) }).translate(TR.carina[0], TR.carina[1] - 0.001, TR.carina[2] + 0.001),
    info: info('A keel-shaped ridge of cartilage at the tracheal bifurcation, where the trachea divides into the two main bronchi at the level of the sternal angle (T4/T5).', 'Splits the airflow between the two lungs; its mucosa is the most sensitive trigger zone of the cough reflex.', 'The bifurcation angle is about 60–75°; the carina lies ~12 cm below the vocal folds and ~25 cm from the incisor teeth.', 'Widening or blunting of the carina on bronchoscopy suggests enlarged subcarinal lymph nodes or a dilated left atrium.') });

  const BR = {
    mainR: [[-0.002, 1.365, -0.018], [-0.009, 1.352, -0.019], [-0.019, 1.337, -0.021]],
    mainL: [[0.002, 1.365, -0.018], [0.02, 1.35, -0.024], [0.035, 1.336, -0.028], [0.044, 1.326, -0.03]],
    upR: [[-0.016, 1.341, -0.021], [-0.03, 1.345, -0.02], [-0.04, 1.348, -0.02]],
    intR: [[-0.019, 1.337, -0.021], [-0.026, 1.318, -0.022], [-0.031, 1.305, -0.022]],
    midR: [[-0.031, 1.305, -0.022], [-0.04, 1.297, -0.008], [-0.048, 1.29, 0.005]],
    lowR: [[-0.031, 1.305, -0.022], [-0.038, 1.29, -0.031], [-0.045, 1.279, -0.039]],
    upL: [[0.044, 1.326, -0.03], [0.052, 1.333, -0.022], [0.058, 1.336, -0.016]],
    lowL: [[0.044, 1.326, -0.03], [0.05, 1.305, -0.036], [0.055, 1.29, -0.04]]
  };
  add({ id: 'bronchus-main-r', name: 'Right main bronchus', latin: 'Bronchus principalis dexter', side: 'R', region: 'thorax', depth: 0.4, geometry: ringedTube(BR.mainR, 0.0074, 0.0068, 16, 0.0045, 0.0004), color: C.bronchus, tags: ['airway', 'bronchus'],
    info: info('The right main (primary) bronchus leaves the carina only about 25° from the vertical and is shorter and wider than the left.', 'Carries air into the right lung, giving off the upper lobe bronchus before continuing as the bronchus intermedius.', 'About 2.5 cm long and 1.5 cm in diameter.', 'Its steep, wide course is why inhaled objects and an endotracheal tube pushed too far usually enter the right side.') });
  add({ id: 'bronchus-main-l', name: 'Left main bronchus', latin: 'Bronchus principalis sinister', side: 'L', region: 'thorax', depth: 0.4, geometry: ringedTube(BR.mainL, 0.0063, 0.0058, 16, 0.0045, 0.0004), color: C.bronchus, tags: ['airway', 'bronchus'],
    info: info('The left main bronchus runs more horizontally (about 45°), passing under the aortic arch and in front of the oesophagus and descending aorta to reach the left hilum.', 'Carries air into the left lung, dividing at the hilum into the upper and lower lobe bronchi.', 'About 5 cm long and 1.2 cm in diameter.', 'An enlarged left atrium or an aortic arch aneurysm can compress it; its length suits left-sided double-lumen tubes used in thoracic surgery.') });
  const lobar = [
    ['bronchus-lobar-upper-r', 'Right upper lobe bronchus', 'Bronchus lobaris superior dexter', 'R', BR.upR, 0.0048, 'Arises from the right main bronchus only 1–2 cm below the carina, above the pulmonary artery (hence "eparterial"), and splits into apical, posterior and anterior segmental bronchi.', 'About 1–1.5 cm long, 8–10 mm wide.'],
    ['bronchus-intermedius-r', 'Bronchus intermedius', 'Bronchus intermedius', 'R', BR.intR, 0.0058, 'The short continuation of the right main bronchus between the upper lobe origin and the middle/lower lobe bronchi.', 'About 2–3 cm long, 10–12 mm wide.'],
    ['bronchus-lobar-middle-r', 'Right middle lobe bronchus', 'Bronchus lobaris medius', 'R', BR.midR, 0.0037, 'Runs forwards and laterally from the bronchus intermedius and divides into lateral and medial segmental bronchi.', 'About 1.5–2 cm long, 5–7 mm wide.'],
    ['bronchus-lobar-lower-r', 'Right lower lobe bronchus', 'Bronchus lobaris inferior dexter', 'R', BR.lowR, 0.0047, 'Continues down and back from the bronchus intermedius, giving a superior segmental bronchus and four basal segmental bronchi.', 'About 1–1.5 cm to the basal division, 8–10 mm wide.'],
    ['bronchus-lobar-upper-l', 'Left upper lobe bronchus', 'Bronchus lobaris superior sinister', 'L', BR.upL, 0.0048, 'Leaves the left main bronchus at the hilum and divides into an upper division (apicoposterior and anterior) and a lingular division.', 'About 1–1.5 cm long, 8–10 mm wide.'],
    ['bronchus-lobar-lower-l', 'Left lower lobe bronchus', 'Bronchus lobaris inferior sinister', 'L', BR.lowL, 0.0047, 'Continues down and back from the left main bronchus, giving a superior segmental bronchus and the basal segmental bronchi.', 'About 1–1.5 cm to the basal division, 8–10 mm wide.']
  ];
  lobar.forEach(([id, name, latin, side, pts, r, desc, size]) => add({ id, name, latin, side, region: 'thorax', depth: 0.45, geometry: ringedTube(pts, r, r * 0.9, 12, 0.004, 0.0003), color: C.bronchus, tags: ['airway', 'bronchus'],
    info: info(desc, 'Secondary (lobar) bronchus: conducts air to one lobe of the lung.', size, 'Lobar bronchi are the level at which the lung is removed in a lobectomy; their walls contain irregular cartilage plates instead of rings.') }));

  // ---------------------------------------------------------------- segmental bronchi + bronchial tree (generations 4-6)
  const upRE = BR.upR[2], midRE = BR.midR[2], lowRE = BR.lowR[2], upLE = BR.upL[2], lowLE = BR.lowL[2];
  const SEG = {
    r: [
      ['apical', 'apical', 'B1', 'ru', upRE, [-0.15, 1, 0.05], 0.05, 'The apical segments of the upper lobes are the classic site of post-primary (reactivation) tuberculosis.'],
      ['posterior', 'posterior', 'B2', 'ru', upRE, [-0.5, 0.35, -0.8], 0.05, 'In a person lying on the right side, aspirated material drains into this segment.'],
      ['anterior', 'anterior', 'B3', 'ru', upRE, [-0.4, 0, 0.9], 0.055, null],
      ['lateral', 'lateral', 'B4', 'rm', midRE, [-0.8, -0.2, 0.5], 0.05, null],
      ['medial', 'medial', 'B5', 'rm', midRE, [-0.15, -0.3, 1], 0.05, null],
      ['superior', 'superior', 'B6', 'rl', BR.lowR[1], [-0.3, 0.3, -1], 0.05, 'The superior segment of the lower lobe is the commonest site of aspiration pneumonia in a patient lying on the back.'],
      ['medial-basal', 'medial basal', 'B7', 'rl', lowRE, [-0.1, -0.5, 0.45], 0.05, null],
      ['anterior-basal', 'anterior basal', 'B8', 'rl', lowRE, [-0.5, -0.35, 0.7], 0.055, null],
      ['lateral-basal', 'lateral basal', 'B9', 'rl', lowRE, [-0.9, -0.35, -0.1], 0.065, null],
      ['posterior-basal', 'posterior basal', 'B10', 'rl', lowRE, [-0.35, -0.45, -0.9], 0.065, 'The posterior basal segments are the most dependent parts of the lungs when upright, where aspirated fluid and effusions first gather.']
    ],
    l: [
      ['apicoposterior', 'apicoposterior', 'B1+2', 'lu', upLE, [0.2, 1, -0.4], 0.055, 'On the left the apical and posterior segmental bronchi share a common stem.'],
      ['anterior', 'anterior', 'B3', 'lu', upLE, [0.4, 0.1, 0.9], 0.05, null],
      ['superior-lingular', 'superior lingular', 'B4', 'lu', [0.055, 1.334, -0.019], [0.6, -0.5, 0.7], 0.055, 'The lingular segments correspond to the right middle lobe.'],
      ['inferior-lingular', 'inferior lingular', 'B5', 'lu', [0.055, 1.334, -0.019], [0.45, -0.6, 0.75], 0.06, null],
      ['superior', 'superior', 'B6', 'll', BR.lowL[1], [0.3, 0.3, -1], 0.05, 'The superior segment of the lower lobe is the commonest site of aspiration pneumonia in a patient lying on the back.'],
      ['anteromedial-basal', 'anteromedial basal', 'B7+8', 'll', lowLE, [0.15, -1, 0.45], 0.06, 'On the left the medial and anterior basal bronchi usually share a common stem.'],
      ['lateral-basal', 'lateral basal', 'B9', 'll', lowLE, [0.8, -0.8, 0], 0.065, null],
      ['posterior-basal', 'posterior basal', 'B10', 'll', lowLE, [0.3, -0.8, -0.75], 0.065, null]
    ]
  };
  const LOBE_NAME = { ru: 'right upper lobe', rm: 'right middle lobe', rl: 'right lower lobe', lu: 'left upper lobe', ll: 'left lower lobe' };
  function grow(list, F, p, d, gen, len, r, seed) {
    if (gen > 4) return;
    const a = rot(perp(d), d, seed * 1.3 + gen * Math.PI / 2);
    for (const s of [-1, 1]) {
      const cd = rot(d, a, s * (0.42 + 0.08 * Math.sin(seed * 3.1 + s))).normalize();
      const l2 = fit(F, p, cd, len, 0.0035); if (l2 < 0.005) continue;
      const e = p.clone().add(cd.clone().multiplyScalar(l2)), m = p.clone().add(cd.clone().multiplyScalar(l2 * 0.5)).add(a.clone().multiplyScalar(s * 0.0012));
      list.push(H.tube([p, m, e], (t) => H.lerp(r, r * 0.8, t), { radial: 6, tubular: 4 }));
      grow(list, F, e, cd, gen + 1, len * 0.72, r * 0.72, seed + (s > 0 ? 1.7 : 3.1));
    }
  }
  ['r', 'l'].forEach(sd => {
    const tree = [], side = sd === 'r' ? 'R' : 'L';
    SEG[sd].forEach(([key, nm, code, lobe, start, dir, len, note], k) => {
      const S = H.v3(start), D = H.v3(dir).normalize(), F = LOBE[lobe];
      let s = fit(F, S, D, len, 0.006); s = s < 0.015 ? len * 0.5 : Math.max(0.015, s * 0.72);
      const E = S.clone().add(D.clone().multiplyScalar(s)), Mi = S.clone().add(D.clone().multiplyScalar(s * 0.5)).add(perp(D).multiplyScalar(0.002));
      add({ id: 'bronchus-segmental-' + key + '-' + sd, name: (sd === 'r' ? 'Right ' : 'Left ') + nm + ' segmental bronchus (' + code + ')', latin: 'Bronchus segmentalis ' + nm, side, region: 'thorax', depth: 0.5,
        geometry: H.tube([S, Mi, E], (t) => H.lerp(0.0031, 0.0023, t), { radial: 10, step: 0.004 }), color: C.bronchus, tags: ['airway', 'bronchus'],
        info: info('Segmental (tertiary) bronchus ' + code + ', supplying the ' + nm + ' bronchopulmonary segment of the ' + LOBE_NAME[lobe] + '.', 'Conducts air to one bronchopulmonary segment, a pyramidal unit of lung with its own bronchus and segmental artery.', 'About ' + Math.round(s * 100) + ' cm long and 4–6 mm in diameter; its wall holds irregular cartilage plates.',
          note || 'Because each segment has its own airway and blood supply, a diseased segment can be removed on its own (segmentectomy).') });
      grow(tree, F, E, D, 1, 0.026, 0.0019, k * 2.3 + (sd === 'r' ? 0 : 7));
    });
    add({ id: 'bronchial-tree-' + sd, name: (sd === 'r' ? 'Right' : 'Left') + ' bronchial tree (subsegmental bronchi)', latin: 'Arbor bronchialis', side, region: 'thorax', depth: 0.55,
      geometry: H.merge(tree), color: '#e8d2c4', tags: ['airway', 'bronchus'],
      info: info('The subsegmental bronchi and bronchioles branch repeatedly (about 23 generations in all) from each segmental bronchus into the lung tissue; four further generations are shown here.', 'Distributes inspired air evenly through the lung and warms, humidifies and filters it on the way to the alveoli.', 'Airways shrink from ~4 mm (subsegmental) to ~1 mm (bronchioles, which lack cartilage) and 0.5 mm (terminal bronchioles).', 'Bronchioles have no cartilage, so their smooth muscle can close them almost completely during an asthma attack.') });
  });

  // ---------------------------------------------------------------- magnified acinus inset (right of the chest)
  const IC = new THREE.Vector3(-0.298, 1.30, 0.05);   // kept inside the atlas envelope (|x| <= 0.33)
  const lp = (x, y, z) => new THREE.Vector3(x, y, z).add(IC);
  const bronchiole = [H.tube([lp(0.002, 0.029, -0.003), lp(0.0, 0.02, 0.0), lp(0.0, 0.012, 0.0)], 0.0022, { radial: 14, step: 0.002 })];
  const BP = [lp(-0.008, 0.004, 0.001), lp(0.008, 0.004, 0.0)];
  bronchiole.push(H.tube([lp(0, 0.012, 0), lp(-0.004, 0.009, 0.001), BP[0]], (t) => 0.0019 - 0.0003 * t, { radial: 12, step: 0.002 }));
  bronchiole.push(H.tube([lp(0, 0.012, 0), lp(0.004, 0.009, 0), BP[1]], (t) => 0.0019 - 0.0003 * t, { radial: 12, step: 0.002 }));
  const SACS = [[-0.016, -0.004, 0.006, 0], [-0.010, -0.017, -0.006, 0], [0.0, -0.02, 0.009, 0], [0.012, -0.016, -0.005, 1], [0.017, -0.003, 0.007, 1]];
  const alv = [], caps = [], art = [];
  const fib = (k, n) => { const y = 1 - 2 * (k + 0.5) / n, r = Math.sqrt(1 - y * y), ph = k * 2.39996; return new THREE.Vector3(r * Math.cos(ph), y, r * Math.sin(ph)); };
  SACS.forEach(([x, y, z, b], si) => {
    const c = lp(x, y, z), from = BP[b];
    bronchiole.push(H.tube([from, from.clone().lerp(c, 0.5).add(new THREE.Vector3(0, -0.001, 0)), c], 0.0013, { radial: 10, step: 0.002 }));   // alveolar duct
    const inDir = from.clone().sub(c).normalize();
    for (let k = 0; k < 9; k++) {
      const d = fib(k, 9); if (d.dot(inDir) > 0.75) continue;   // leave the duct entrance open
      const r = 0.0033 + 0.0005 * Math.sin(si * 3 + k * 1.7), ac = c.clone().add(d.clone().multiplyScalar(0.0047));
      alv.push(H.blob(r, { ws: 14, hs: 10, deform: (p) => 1 + 0.08 * H.fbm(p.x * 2.5 + si * 5.3 + k, p.y * 2.5, p.z * 2.5, 2) }).translate(ac.x, ac.y, ac.z));
      // capillary loops wrapped over the exposed cap of each alveolus
      for (let q = 0; q < 2; q++) {
        const ax = rot(perp(d), d, q * 1.4 + k), loop = [];
        for (let m = 0; m < 10; m++) {
          const ang = m / 10 * Math.PI * 2, ring = rot(ax, d, ang).multiplyScalar(r * (0.78 + 0.1 * q));
          loop.push(ac.clone().add(ring).add(d.clone().multiplyScalar(r * (0.55 - 0.35 * q) + 0.0003 * Math.sin(ang * 3 + k))));
        }
        caps.push(H.tube(loop, 0.00032, { radial: 4, tubular: 16, closed: true }));
      }
    }
    art.push(H.tube([lp(0.006, 0.029, -0.006), lp(0.004, 0.012, -0.004), from.clone().add(new THREE.Vector3(0, 0, -0.004)), c.clone().add(new THREE.Vector3(0, 0, -0.0085))], 0.0009, { radial: 8, step: 0.002 }));
  });
  const insetTags = ['inset', 'lung'];
  add({ id: 'inset-terminal-bronchiole', name: 'Terminal & respiratory bronchioles (magnified)', latin: 'Bronchiolus terminalis', side: 'R', region: 'body', depth: 0.3, geometry: H.merge(bronchiole), color: C.bronchus, tags: insetTags,
    info: info('Magnified view (~×10) of one pulmonary acinus: a terminal bronchiole, the last purely conducting airway, splits into respiratory bronchioles and alveolar ducts.', 'Carries air into the gas-exchanging acinus; beyond this point the walls are lined by alveoli.', 'Real terminal bronchioles are about 0.5 mm wide; an acinus is 6–10 mm across and there are ~30,000 of them.', 'Club (Clara) cells in the bronchiolar lining secrete protective proteins; centrilobular emphysema from smoking begins at the respiratory bronchioles.') });
  add({ id: 'inset-alveolar-sac', name: 'Alveolar sacs (magnified)', latin: 'Sacculi alveolares', side: 'R', region: 'body', depth: 0.3, geometry: H.merge(alv), color: '#efb4ae', tags: insetTags, parent: 'inset-terminal-bronchiole',
    info: info('Grape-like clusters of alveoli at the ends of the alveolar ducts, where the airway ends in thin-walled air sacs.', 'Gas exchange: oxygen diffuses from alveolar air into capillary blood and carbon dioxide diffuses out across a barrier only ~0.5 µm thick.', 'Each alveolus is about 0.2–0.3 mm across; the lungs hold roughly 300–500 million, a surface of ~70 m².', 'Type II cells make surfactant that stops alveoli collapsing; premature babies lacking it develop respiratory distress syndrome.') });
  add({ id: 'inset-alveolar-capillaries', name: 'Alveolar capillary network (magnified)', latin: 'Rete capillare alveolare', side: 'R', region: 'body', depth: 0.1, geometry: H.merge(caps), color: C.capillary, tags: insetTags, parent: 'inset-terminal-bronchiole',
    info: info('A dense mesh of pulmonary capillaries wrapped over the alveolar walls, fed by branches of the pulmonary artery.', 'Brings deoxygenated blood within half a micrometre of alveolar air; each red cell crosses in about 0.75 s, time enough to load oxygen.', 'Capillaries are 5–8 µm wide, just enough for red cells in single file; together they hold ~70–100 ml of blood at rest.', 'Thickening of this barrier (pulmonary fibrosis) or loss of capillaries (emphysema) lowers the lung\'s diffusing capacity for carbon monoxide (DLCO).') });
  add({ id: 'inset-pulmonary-arteriole', name: 'Pulmonary arteriole (magnified)', latin: 'Arteriola pulmonalis', side: 'R', region: 'body', depth: 0.1, geometry: H.merge(art), color: C.vein, tags: insetTags, parent: 'inset-terminal-bronchiole',
    info: info('Branch of the pulmonary artery that runs beside the bronchiole and divides with it to feed the alveolar capillaries; shown blue because it carries deoxygenated blood.', 'Delivers blood from the right ventricle to the gas-exchange surface.', 'Real pulmonary arterioles are ~15–100 µm in diameter.', 'Unlike systemic arterioles, pulmonary arterioles constrict when alveolar oxygen is low (hypoxic vasoconstriction), diverting blood to well-ventilated lung.') });

  // ---------------------------------------------------------------- nose: cartilages, cavity, septum, turbinates
  const HD = L.head, NT = HD.noseTip, MUCOSA = '#d98c88';
  const lerp2 = (a, b, t) => [H.lerp(a[0], b[0], t), H.lerp(a[1], b[1], t)];
  // external-nose skin surface, rebuilt from the same landmarks the skin (integumentary) uses: tip L.head.noseTip, bridge
  // L.y.noseBridge, nostrils L.head.nostrilL, base plane z 0.079. y = height, a = azimuth round the nose (0 = side wall,
  // PI/2 = front midline); LEFT side. underNose() lays the cartilages a fixed depth under it so they never break the skin.
  const NZB = 0.079, NUP = L.y.noseBridge + 0.008 - NT[1], NOS = HD.nostrilL;
  const G2 = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));
  function noseSkin(y, a) {
    const f = (y - NT[1]) / NUP; let hs, zf, hw, q = 0;
    if (f >= 0) { hs = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, f), 6)), 1 / 6); zf = NT[2] - 0.0295 * Math.pow(f, 1.1); hw = H.lerp(0.0165, 0.0068, H.smoothstep(0, 0.6, f)); }
    else { q = Math.min(1, Math.pow((NT[1] - y) / 0.0135, 1.5)); hs = Math.pow(Math.max(0, 1 - q * q), 1 / 3); zf = NT[2]; hw = 0.0165; }
    const cx = Math.cos(a), sz = Math.sin(a), z = NZB + (zf - NZB) * Math.pow(sz, 0.7) * hs;
    let x = hw * cx * hs * (1 - 0.4 * sz * sz);
    if (f < 0.3) x -= Math.sign(x) * 0.0012 * G2(z - 0.1075, y - 1.597, 0.0022, 0.006);                                   // alar groove
    if (q > 0.4) y += 0.0042 * H.smoothstep(0.4, 0.8, q) * G2(Math.abs(x) - NOS[0] + 0.0025, z - NOS[2], 0.0035, 0.0055); // nostril
    return new THREE.Vector3(x, y, z);
  }
  function underNose(y, a, depth) {   // point 'depth' metres inside the nose skin (along the inward surface normal)
    const e = 2e-5, p = noseSkin(y, a), ty = noseSkin(y + e, a).sub(noseSkin(y - e, a)), ta = noseSkin(y, a + e).sub(noseSkin(y, a - e));
    return p.sub(ty.cross(ta).normalize().multiplyScalar(depth));
  }
  // septal cartilage: quadrangular plate [y, z] corners, caudal angle just behind the tip, dorsal border ~2.7 mm under the dorsum
  const SAS = [1.6235, 0.102], SAI = [1.600, NT[2] - 0.009], SPI = [1.589, 0.085], SPS = [1.633, 0.085];
  const septCart = slab((u, v) => { const lo = lerp2(SAI, SPI, u), hi = lerp2(SAS, SPS, u), p = lerp2(lo, hi, v); return [0, p[0], p[1]]; }, 10, 8, 0.0022);
  // upper lateral cartilage (left): from the dorsum (fused with the septal cartilage) round the side wall to the pyriform aperture
  const ulc = slab((u, v) => underNose(H.lerp(1.6255, 1.607, v), H.lerp(1.4, 0.3, u), 0.0024), 8, 8, 0.0011);
  // major alar cartilage (left): medial crus (columella) -> dome (tip) -> lateral crus (ala), a curved ribbon laid out in the
  // nose-skin (height, azimuth) frame so the whole ribbon stays 2.4 mm (edges curling to 3.2 mm) under the skin
  const alarC = new THREE.CatmullRomCurve3([[1.5885, 1.36], [1.5935, 1.34], [1.5985, 1.30], [1.6012, 1.15], [1.6025, 0.95], [1.6028, 0.72], [1.6022, 0.5], [1.6012, 0.3]]
    .map(q => new THREE.Vector3(q[0] / 0.012, q[1], 0)), false, 'centripetal');
  const alar = slab((u, v) => {
    const c = alarC.getPointAt(v), t = alarC.getTangentAt(v), yc = c.x * 0.012, ac = c.y, e = 2e-5;
    const my = noseSkin(yc + e, ac).distanceTo(noseSkin(yc - e, ac)) / (2 * e), ma = noseSkin(yc, ac + e).distanceTo(noseSkin(yc, ac - e)) / (2 * e);
    const ty = t.x * 0.012 * my, ta = t.y * ma, tl = Math.hypot(ty, ta), w = (u - 0.5) * 2, s = w * H.lerp(0.0012, 0.0026, H.smoothstep(0.35, 0.8, v));
    return underNose(yc - ta / tl * s / my, ac + ty / tl * s / ma, 0.0024 + 0.0008 * w * w);
  }, 3, 30, 0.0009);
  add({ id: 'nasal-cartilage', name: 'Nasal cartilages (septal, lateral and alar)', latin: 'Cartilagines nasi', side: 'M', region: 'head', depth: 0.0,
    geometry: H.merge([septCart, ulc, H.mirrorX(ulc), alar, H.mirrorX(alar)]), color: C.cartilage, tags: ['nose', 'cartilage'],
    info: info('The flexible lower two-thirds of the external nose: the midline septal cartilage, paired upper lateral cartilages under the dorsum, and paired U-shaped major alar cartilages that shape the tip and nostrils.', 'Give the nose its shape while keeping the nostrils open yet pliable; the alar cartilages stiffen the nasal valve against collapse when breathing in.', 'Septal cartilage about 3 × 3.5 cm and 2–4 mm thick; the alar domes lie ~4 mm under the skin of the tip.', 'Rhinoplasty mainly reshapes these cartilages; a septal haematoma after injury can cut off the cartilage\'s blood supply and cause a "saddle nose".') });

  const NAS = [   // world z, centre y, half-height, half-width; the vestibule (z > 0.09) stays inside the alar/lateral cartilages, above the nostril floor
    [0.018, 1.607, 0.013, 0.013], [0.035, 1.614, 0.023, 0.0165], [0.06, 1.617, 0.027, 0.017], [0.08, 1.612, 0.022, 0.015],
    [0.094, 1.6045, 0.0145, 0.0115], [0.103, 1.6025, 0.0085, 0.0088], [NT[2] - 0.009, 1.600, 0.0045, 0.0062]];
  const nasalAt = (z) => { for (let i = 0; i < NAS.length - 1; i++) if (z <= NAS[i + 1][0]) { const t = H.clamp((z - NAS[i][0]) / (NAS[i + 1][0] - NAS[i][0]), 0, 1); return NAS[i].map((v, k) => H.lerp(v, NAS[i + 1][k], t)); } return NAS[NAS.length - 1]; };
  const cav = H.loft(NAS.map(s => ({ y: s[0], rx: s[3], rz: s[2], cz: -s[1], n: s[0] > 0.09 ? 2.2 : 2.6 })), { radial: 36, subdiv: 5,
    warp: (j, y, d) => 1 - 0.42 * Math.max(0, -d[1]) * Math.pow(Math.abs(d[0]), 0.6) }, 0);
  H.reaxis(cav, 'z');
  add({ id: 'nasal-cavity', name: 'Nasal cavity (air space)', latin: 'Cavitas nasi', side: 'M', region: 'head', depth: 0.2, geometry: weld(cav), material: glass('#bcd8e4', 0.28), tags: ['nose', 'airway'],
    info: info('The air passage from the nostrils (nares) to the choanae at the back of the nose, divided by the septum into two halves whose side walls carry the turbinates.', 'Warms, humidifies and filters inhaled air; the olfactory mucosa in its roof detects smell.', 'About 7–8 cm long and 5 cm high; each half is only 1–1.5 cm wide at the floor and a few mm at the roof.', 'Air flows mainly through the middle meatus; the nasal cycle alternately congests each side every few hours.') });
  const septum = slab((u, v) => {
    const zb = H.lerp(0.031, 0.02, v), z = H.lerp(zb, 0.084, u), s = nasalAt(z);
    const y = H.lerp(s[1] - s[2] + 0.0012, s[1] + s[2] - 0.003, v);
    return [0.0016 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v), y, z];
  }, 14, 8, 0.0024);
  add({ id: 'nasal-septum', name: 'Nasal septum', latin: 'Septum nasi', side: 'M', region: 'head', depth: 0.3, geometry: septum, color: MUCOSA, parent: 'nasal-cavity', tags: ['nose'],
    info: info('The midline wall dividing the nasal cavity, formed by the perpendicular plate of the ethmoid above, the vomer below and the septal cartilage in front, all covered by vascular mucosa.', 'Separates the two nasal passages and supports the nasal dorsum.', 'About 7 cm long and 2–4 mm thick; most adults have a slight deviation to one side.', 'Kiesselbach\'s plexus on the front of the septum (Little\'s area) is the source of about 90% of nosebleeds.') });
  const TURB = [
    ['inferior', 'Inferior', 'Concha nasalis inferior', 0.0138, [[1.600, 0.088], [1.598, 0.066], [1.597, 0.046], [1.598, 0.027]], 0.0048, 'The largest turbinate (a separate bone), about 4–5 cm long and 1 cm high; the nasolacrimal duct opens under it.', 'Its erectile venous tissue swells and shrinks with the nasal cycle; enlargement (turbinate hypertrophy) is a common cause of nasal blockage.'],
    ['middle', 'Middle', 'Concha nasalis media', 0.0115, [[1.617, 0.078], [1.615, 0.06], [1.614, 0.042], [1.616, 0.029]], 0.0041, 'Part of the ethmoid bone, about 4 cm long; the frontal, maxillary and anterior ethmoid sinuses drain beneath it into the middle meatus.', 'The middle meatus (ostiomeatal complex) is the key drainage pathway targeted by functional endoscopic sinus surgery.'],
    ['superior', 'Superior', 'Concha nasalis superior', 0.0085, [[1.632, 0.056], [1.631, 0.043], [1.632, 0.03]], 0.0027, 'The smallest turbinate, part of the ethmoid, about 2 cm long; the posterior ethmoid cells drain beneath it and the sphenoid sinus opens above and behind it.', 'Olfactory epithelium covers its upper surface, next to the cribriform plate.']
  ];
  TURB.forEach(([k, nm, latin, x, pts, r, size, notes], i) => {
    const tg = H.tube(pts.map(p => [0, p[0], p[1]]), (t) => r * Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * t)), 0.45), { radial: 14, step: 0.003 });
    tg.scale(0.55, 1, 1); tg.translate(x, 0, 0);
    H.displace(tg, (p) => 0.00035 * H.fbm(p.x * 400 + i, p.y * 400, p.z * 400, 2));
    addPair({ id: 'nasal-turbinate-' + k, name: nm.toLowerCase() + ' nasal turbinate', latin, region: 'head', depth: 0.35, geometry: tg, color: MUCOSA, parent: 'nasal-cavity', tags: ['nose'],
      info: info(nm + ' nasal concha (turbinate): a scroll of thin bone covered by thick, vascular mucosa projecting from the lateral wall of the nasal cavity.', 'Increases the mucosal surface and creates turbulent airflow so inhaled air is warmed, humidified and filtered.', size, notes) });
  });

  // ---------------------------------------------------------------- paranasal sinuses (air spaces lined by mucosa)
  const sinusMat = () => H.mat({ color: '#e8cdb9', opacity: 0.65, roughness: 0.4 });
  const fr = H.blob([0.011, 0.013, 0.0068], { ws: 28, hs: 20, noise: { amp: 0.09, freq: 2.4 }, deform: (p) => 1 - 0.35 * H.smoothstep(-0.2, -1, p.y) * (0.6 + 0.4 * p.x) + 0.12 * H.smoothstep(0.2, 1, p.y) * H.smoothstep(0, 1, p.x) }).translate(0.015, 1.68, 0.074);
  addPair({ id: 'sinus-frontal', name: 'frontal sinus', latin: 'Sinus frontalis', region: 'head', depth: 0.1, geometry: fr, material: sinusMat(), tags: ['sinus'],
    info: info('Air-filled space in the frontal bone behind the eyebrow, usually asymmetric and separated from its partner by a thin bony septum.', 'Lightens the skull, adds resonance to the voice and may act as a crumple zone protecting the brain.', 'About 3 cm high, 2.5 cm wide and 2 cm deep; absent at birth, it develops after about age 7.', 'It drains through the frontonasal duct into the middle meatus; infection can spread to the orbit or through the thin posterior wall to the brain.') });
  const mx = H.blob([0.0125, 0.0175, 0.0145], { ws: 30, hs: 22, noise: { amp: 0.06, freq: 2.2 }, deform: (p) => (1 - 0.32 * H.smoothstep(0, 1, p.x) * (1 - p.y * 0.3)) * (1 - 0.25 * H.smoothstep(-0.3, -1, p.y)) }).translate(0.03, 1.60, 0.06);
  addPair({ id: 'sinus-maxillary', name: 'maxillary sinus', latin: 'Sinus maxillaris', region: 'head', depth: 0.1, geometry: mx, material: sinusMat(), tags: ['sinus'],
    info: info('The largest paranasal sinus: a pyramid-shaped air space in the body of the maxilla, below the orbit and above the upper molar roots, with its base on the lateral nasal wall.', 'Lightens the face and warms/humidifies air; it drains into the middle meatus.', 'About 3.5 cm high, 2.5 cm wide and 3.5 cm deep (~15 ml).', 'Its opening lies high on the medial wall, so it drains poorly and is the sinus most often infected; upper molar roots can protrude into its floor.') });
  const sph = H.blob([0.012, 0.0095, 0.0105], { ws: 28, hs: 20, noise: { amp: 0.07, freq: 2.6 }, deform: (p) => 1 + 0.12 * p.x * (1 - p.y * p.y) }).translate(0, 1.614, 0.001);
  add({ id: 'sinus-sphenoid', name: 'Sphenoid sinus', latin: 'Sinus sphenoidalis', side: 'M', region: 'head', depth: 0.1, geometry: sph, material: sinusMat(), tags: ['sinus'],
    info: info('Paired, often unequal air spaces in the body of the sphenoid bone, directly below the pituitary gland and between the cavernous sinuses.', 'Lightens the skull base; drains into the sphenoethmoidal recess above the superior turbinate.', 'About 2 cm in each dimension (combined volume ~7 ml).', 'Surgeons reach pituitary tumours through the nose and this sinus (transsphenoidal surgery); the optic nerves and internal carotids bulge into its walls.') });
  const eth = [];
  for (let k = 0; k < 9; k++) {
    const r = 0.0031 + 0.0006 * Math.sin(k * 1.3);
    eth.push(H.blob(r, { ws: 12, hs: 8, noise: { amp: 0.12, freq: 3 } }).translate(0.0092 + 0.0013 * Math.cos(k * 1.7), 1.636 + 0.0065 * Math.sin(k * 2.1), H.lerp(0.034, 0.066, k / 8)));
  }
  addPair({ id: 'sinus-ethmoid', name: 'ethmoid air cells', latin: 'Cellulae ethmoidales', region: 'head', depth: 0.1, geometry: H.merge(eth), material: sinusMat(), tags: ['sinus'],
    info: info('A honeycomb of 3–18 small air cells in the ethmoid labyrinth, between the upper nasal cavity and the orbit, grouped as anterior, middle and posterior cells.', 'Lighten the skull and drain into the middle and superior meatuses.', 'Individual cells 2–10 mm; the labyrinth is ~4–5 cm long and 1–2.5 cm wide.', 'The lateral wall (lamina papyracea) is paper-thin, so ethmoid sinusitis in children can spread into the orbit (orbital cellulitis).') });

  // ---------------------------------------------------------------- pharynx (translucent muscular tube behind nose, mouth and larynx)
  const pharMat = () => glass('#d88f8a', 0.4);
  const pharynx = [
    ['nasopharynx', 'Nasopharynx', 'Pars nasalis pharyngis', 'head', [[1.587, 0.014, 0.008, 0.009], [1.600, 0.017, 0.011, 0.009], [1.614, 0.016, 0.011, 0.008], [1.624, 0.012, 0.008, 0.005], [1.63, 0.006, 0.004, 0.003]], { capBottom: false },
      info('The upper part of the pharynx, behind the choanae and above the soft palate; the adenoid lies on its roof and the Eustachian tubes open on its side walls.', 'Air passage from the nose to the lower airway; the soft palate seals it off during swallowing.', 'About 2 cm high, 3–4 cm wide and 2 cm deep.', 'Enlarged adenoids block nasal breathing and the Eustachian tubes in children; nasopharyngeal cancer often first shows as one-sided glue ear.')],
    ['oropharynx', 'Oropharynx', 'Pars oralis pharyngis', 'head', [[1.545, 0.015, 0.009, 0.008], [1.56, 0.017, 0.010, 0.009], [1.575, 0.016, 0.0095, 0.009], [1.588, 0.014, 0.008, 0.009]], { capBottom: false, capTop: false },
      info('The middle part of the pharynx, behind the mouth from the soft palate down to the tip of the epiglottis, containing the palatine and lingual tonsils.', 'Shared passage for air and food, where the breathing and swallowing pathways cross.', 'About 4–5 cm high and 4 cm wide.', 'Loss of muscle tone here during sleep causes snoring and obstructive sleep apnoea; HPV now causes most oropharyngeal cancers in many countries.')],
    ['laryngopharynx', 'Laryngopharynx', 'Pars laryngea pharyngis', 'neck', [[1.479, 0.007, 0.005, 0.001], [1.49, 0.012, 0.0065, 0.004], [1.505, 0.018, 0.008, 0.007], [1.525, 0.018, 0.009, 0.008], [1.545, 0.015, 0.009, 0.008]], { capBottom: false, capTop: false,
      warp: (j, y, d) => 1 + (1 - H.smoothstep(1.525, 1.543, y)) * (0.12 * Math.max(0, d[1]) * Math.abs(d[0]) - 0.4 * Math.pow(Math.max(0, d[1]), 4) * H.smoothstep(1.485, 1.505, y)) },
      info('The lowest part of the pharynx (hypopharynx), from the epiglottis to the cricoid cartilage, lying behind the larynx with a piriform recess on either side.', 'Channels swallowed food around the laryngeal inlet into the oesophagus.', 'About 4–5 cm long, narrowing to ~1.5 cm at the upper oesophageal sphincter (level of C6).', 'Fish bones often lodge in the piriform recesses; a Zenker\'s diverticulum bulges through its back wall just above the cricopharyngeus.')]
  ];
  pharynx.forEach(([id, name, latin, region, secs, o, inf]) => add({ id, name, latin, side: 'M', region, depth: 0.1, material: pharMat(), tags: ['pharynx', 'airway'], info: inf,
    geometry: weld(H.loft(secs.map(s => ({ y: s[0], rx: s[1], rz: s[2], cz: s[3] })), Object.assign({ radial: 28, subdiv: 5 }, o))) }));

  // ---------------------------------------------------------------- larynx
  const NK = L.neck, LX = 0.0325;   // z of the laryngeal lumen axis
  function closedGrid(nu, nv, fn) {   // surface closed in both u and v
    const pos = [], idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) pos.push(...fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * nu + i, b = j * nu + (i + 1) % nu, c = ((j + 1) % nv) * nu + i, d = ((j + 1) % nv) * nu + (i + 1) % nu; idx.push(a, c, b, b, c, d);
    }
    let vol = 0; const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    for (let t = 0; t < idx.length; t += 3) vol += P(idx[t]).dot(P(idx[t + 1]).cross(P(idx[t + 2])));
    if (vol < 0) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  const half = (ctx.sex === 'female' ? 60 : 45) * Math.PI / 180, TW = 0.026;
  const thyL = slab((u, v) => {
    const bot = 1.4915 - 0.002 * u - 0.0075 * H.smoothstep(0.84, 1, u), top = 1.507 + 0.0095 * H.smoothstep(0, 0.22, u) + 0.001 * u + 0.017 * H.smoothstep(0.84, 1, u);
    const zf = NK.thyroidCartilage[2] - 0.0045 + 0.0045 * v * v;
    return [Math.sin(half) * u * TW + 0.0016 * Math.sin(Math.PI * u), H.lerp(bot, top, v), zf - Math.cos(half) * u * TW];
  }, 14, 10, 0.0022);
  add({ id: 'thyroid-cartilage', name: 'Thyroid cartilage', latin: 'Cartilago thyroidea', side: 'M', region: 'neck', depth: 0.1, geometry: H.merge([thyL, H.mirrorX(thyL)]), color: C.cartilage, tags: ['larynx', 'cartilage'],
    info: info('The largest laryngeal cartilage: two quadrilateral plates of hyaline cartilage fused in front at an angle that forms the laryngeal prominence (Adam\'s apple), with superior and inferior horns on the posterior borders.', 'Shields the larynx and anchors the vocal folds, which attach to the inside of its angle.', 'About 3–4 cm wide and 2.5–3 cm high; the laminae meet at ~90° in men and ~120° in women.', 'The cricothyroid muscle tilts it forward on the cricoid to stretch the vocal folds and raise pitch; it often ossifies with age.') });
  const cric = closedGrid(48, 12, (u, v) => {
    const th = u * Math.PI * 2, back = H.smoothstep(-0.2, 0.8, -Math.sin(th)), ph = v * Math.PI * 2;
    const yb = H.lerp(NK.cricoid[1] - 0.0055, NK.cricoid[1] - 0.0085, back), yt = H.lerp(NK.cricoid[1] + 0.0035, NK.cricoid[1] + 0.016, back);
    const c = Math.cos(ph), s = Math.sin(ph), sx = Math.sign(c) * Math.pow(Math.abs(c), 0.5), sy = Math.sign(s) * Math.pow(Math.abs(s), 0.5);
    const hw = H.lerp(0.0011, 0.0017, back), rad = 1 + sx * hw / 0.0102, y = (yb + yt) / 2 + sy * (yt - yb) / 2;
    return [Math.cos(th) * 0.0106 * rad, y, LX + Math.sin(th) * 0.0102 * rad];
  });
  add({ id: 'cricoid-cartilage', name: 'Cricoid cartilage', latin: 'Cartilago cricoidea', side: 'M', region: 'neck', depth: 0.1, geometry: cric, color: C.cartilage, tags: ['larynx', 'cartilage'],
    info: info('The only complete ring of cartilage in the airway, shaped like a signet ring: a narrow arch in front and a tall lamina behind.', 'Forms the base of the larynx, carrying the arytenoid and thyroid cartilages on synovial joints, and holds the airway open at the laryngo-tracheal junction.', 'About 2.5 cm across; arch 5–7 mm high, lamina 2–3 cm high; at the level of C6.', 'An emergency airway (cricothyrotomy) is made through the cricothyroid membrane just above its arch; it is the narrowest point of a young child\'s airway.') });
  const ary = H.blob([0.0032, 0.0052, 0.0034], { ws: 20, hs: 14, deform: (p) => 1 - 0.5 * H.smoothstep(-0.4, 1, p.y) + 0.6 * Math.pow(Math.max(0, p.z), 2) * H.smoothstep(0.2, -0.6, p.y) + 0.4 * Math.pow(Math.max(0, p.x), 2) * H.smoothstep(0.2, -0.6, p.y) * Math.max(0, -p.z) })
    .translate(0.0056, NK.cricoid[1] + 0.0225, LX - 0.0108);
  addPair({ id: 'arytenoid-cartilage', name: 'arytenoid cartilage', latin: 'Cartilago arytenoidea', region: 'neck', depth: 0.3, geometry: ary, color: C.cartilage, tags: ['larynx', 'cartilage'],
    info: info('A small pyramid-shaped cartilage sitting on the upper border of the cricoid lamina, with a vocal process pointing forward and a muscular process pointing sideways.', 'Rotates and glides to open (abduct) and close (adduct) the vocal folds for breathing, speaking and coughing.', 'About 15–18 mm tall.', 'Only the posterior cricoarytenoid muscles open the glottis; injury to both recurrent laryngeal nerves can therefore obstruct breathing.') });
  const gy = 1.5005, comm = [0, gy, NK.thyroidCartilage[2] - 0.0072];
  const vf = H.tube([[0.0021, gy, comm[2]], [0.0041, gy, comm[2] - 0.0065], [0.0066, gy + 0.0005, LX - 0.0075]], (t) => 0.0022 * (0.75 + 0.25 * Math.sin(Math.PI * t)), { radial: 12, step: 0.0015 });
  vf.scale(1, 0.85, 1); vf.translate(0, gy * 0.15, 0);
  addPair({ id: 'vocal-fold', name: 'vocal fold', latin: 'Plica vocalis', region: 'neck', depth: 0.4, geometry: vf, color: '#f2e4dc', tags: ['larynx'],
    info: info('The true vocal cord: a fold of mucosa over the vocal ligament and vocalis muscle, running from the inside of the thyroid angle to the arytenoid vocal process; the two folds bound the V-shaped rima glottidis.', 'Vibrates in the exhaled airstream to produce voice, and closes tightly to protect the airway and build pressure for a cough.', 'About 17–23 mm long in men and 12–17 mm in women; vibrates at ~100–150 Hz (men) and ~180–250 Hz (women) in speech.', 'Swelling of its loose superficial layer (Reinke\'s oedema) in smokers deepens the voice; hoarseness lasting more than 3 weeks warrants laryngoscopy.') });
  const epi = slab((u, v) => {
    const w = (u - 0.5) * 2, hw = 0.0015 + 0.0095 * Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.72) / 0.72, 2)));
    const y = H.lerp(1.5055, 1.543, v) - 0.006 * w * w * H.smoothstep(0.7, 1, v), z = 0.037 - 0.012 * v + 0.003 * H.smoothstep(0.75, 1, v) - 0.0035 * w * w;
    return [w * hw, y, z];
  }, 12, 16, 0.0014);
  add({ id: 'epiglottis', name: 'Epiglottis', latin: 'Epiglottis', side: 'M', region: 'neck', depth: 0.2, geometry: epi, color: '#d6dcc4', tags: ['larynx', 'cartilage'],
    info: info('A leaf-shaped plate of elastic cartilage behind the root of the tongue, attached by its stalk to the inside of the thyroid angle and free above.', 'During swallowing it tips back over the laryngeal inlet as the larynx rises, helping steer food into the oesophagus.', 'About 3 cm long and 2.5 cm wide.', 'Acute epiglottitis can swell it within hours and block the airway, especially in children; do not examine the throat with a spatula if it is suspected.') });
  const lcav = H.loft([[1.476, 0.0078, 0.0082, LX], [1.49, 0.0072, 0.0078, LX], [1.497, 0.0045, 0.0072, LX - 0.001], [gy, 0.0026, 0.0068, LX - 0.001], [1.503, 0.0055, 0.007, LX - 0.001],
    [1.506, 0.0078, 0.0075, LX - 0.001], [1.51, 0.0048, 0.0072, LX - 0.0015], [1.518, 0.0072, 0.0085, LX - 0.0035], [1.527, 0.0085, 0.0095, LX - 0.0055]].map(s => ({ y: s[0], rx: s[1], rz: s[2], cz: s[3] })), { radial: 28, subdiv: 4, capTop: false, capBottom: false });
  add({ id: 'laryngeal-cavity', name: 'Laryngeal cavity', latin: 'Cavitas laryngis', side: 'M', region: 'neck', depth: 0.5, geometry: weld(lcav), material: glass('#f0c4c4', 0.35), tags: ['larynx', 'airway'],
    info: info('The air space inside the larynx from the inlet behind the epiglottis to the lower border of the cricoid, pinched at the vocal folds (glottis) into an upper vestibule, the small lateral ventricles and a lower infraglottic cavity.', 'Air passage between pharynx and trachea; the glottis acts as the valve controlling voice and airway protection.', 'About 5 cm long; the glottis is its narrowest part in adults.', 'The laryngeal ventricles between the true and false vocal folds contain mucous glands that keep the vocal folds lubricated.') });

  // @@MORE
  return g;
});
