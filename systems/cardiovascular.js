/* systems/cardiovascular.js - the heart in detail (pericardium, chambers, valves, conduction system, coronary
   vessels) plus the arterial and venous trees of the whole body. All positions derive from core/landmarks.js (L). */
ANATOMY.register('cardiovascular', { name: 'Cardiovascular', description: 'Heart, arteries and veins' }, function (THREE, H, L, ctx) {
  const g = H.group('cardiovascular');
  const V = H.v3, CO = H.COLORS, SYS = 'cardiovascular', T = H.LAYER;
  const heart = H.group('heart'), vessels = H.group('vessels');
  g.add(heart); g.add(vessels);
  const male = !ctx || ctx.sex !== 'female';

  // ------------------------------------------------------------ private helpers
  const info = (description, fn, size, notes) => ({ description, function: fn, size, notes });
  function part(o, grp) { const m = H.part(Object.assign({ system: SYS, side: 'M' }, o)); (grp || vessels).add(m); return m; }
  function pair(o, grp) { const ps = H.pair(Object.assign({ system: SYS }, o), { regionR: o.regionR }); ps.forEach(m => (grp || vessels).add(m)); return ps; }
  function hpart(id, name, latin, depth, geometry, color, inf, extra) {
    return part(Object.assign({ id, name, latin, layer: T.ORGAN, depth, region: 'thorax', geometry, color, info: inf, parent: 'heart', tags: ['heart'] }, extra || {}), heart);
  }
  const taper = (a, b) => (t) => a + (b - a) * t;
  function tube(pts, r, radial, step) { return H.tube(pts, r, { radial: radial || 10, step: step || 0.008 }); }
  function rough(geo, amp, freq) { return H.displace(geo, (p) => amp * H.fbm(p.x * freq + 3.1, p.y * freq + 1.3, p.z * freq + 7.7, 2)); }
  // vessel part: o = {id, name, latin, kind:'a'|'v', pts, r, region, depth, info, pair(bool), radial, extraGeo:[...]}
  function vessel(o) {
    let geo = o.geometry || tube(o.pts, o.r, o.radial || 10, o.step);
    if (o.extra && o.extra.length) geo = H.merge([geo].concat(o.extra));
    const spec = { id: o.id, name: o.name, latin: o.latin || '', layer: T.VESSEL, depth: o.depth == null ? 0.2 : o.depth, region: o.region || 'body', geometry: geo,
      color: o.kind === 'v' ? CO.vein : CO.artery, info: o.info, parent: o.parent || null, tags: [o.kind === 'v' ? 'vein' : 'artery'].concat(o.tags || []) };
    if (o.pair) return pair(Object.assign(spec, { regionR: o.regionR }));
    return part(Object.assign(spec, { side: o.side || 'M' }));
  }
  const mirrorPts = (pts) => pts.map(p => [-p[0], p[1], p[2]]);

  // ------------------------------------------------------------ heart frame
  // local frame: +Y from apex toward base, +Z anterior (sternocostal surface), +X toward the subject's left (and up)
  const hc = L.organ.heart;
  const HC = V(hc.center);
  const EY = V(hc.base).sub(V(hc.apex)).normalize();
  const EZ = new THREE.Vector3(0, 0, 1).addScaledVector(EY, -EY.z).normalize();
  const EX = new THREE.Vector3().crossVectors(EY, EZ).normalize();
  const HM = new THREE.Matrix4().makeBasis(EX, EY, EZ).setPosition(HC);
  const HMI = HM.clone().invert();
  const hw = (x, y, z) => HC.clone().addScaledVector(EX, x).addScaledVector(EY, y).addScaledVector(EZ, z);
  const hwa = (x, y, z) => { const p = hw(x, y, z); return [p.x, p.y, p.z]; };
  const toW = (geo) => { geo.applyMatrix4(HM); geo.computeVertexNormals(); return geo; };
  const dA = V(hc.apex).sub(HC);
  const AP = { x: dA.dot(EX), y: dA.dot(EY), z: dA.dot(EZ) };   // apex in local coords (~0.006, -0.079, 0.001)

  // ventricular cross-sections [s = distance from apex along the axis, rx, rz, cx, cz] (local metres)
  const LVS = [[0.000, 0.001, 0.001, AP.x, AP.z], [0.004, 0.007, 0.0065, 0.0068, 0.0], [0.012, 0.0135, 0.012, 0.0082, -0.001], [0.022, 0.0195, 0.0172, 0.0096, -0.0028], [0.036, 0.025, 0.022, 0.011, -0.005],
    [0.056, 0.029, 0.026, 0.0122, -0.0075], [0.074, 0.030, 0.027, 0.0124, -0.009], [0.086, 0.027, 0.025, 0.0115, -0.009], [0.095, 0.021, 0.020, 0.008, -0.005],
    [0.105, 0.014, 0.014, 0.004, 0.002], [0.115, 0.0118, 0.0118, 0.002, 0.007], [0.119, 0.008, 0.008, 0.002, 0.008]];
  const RVS = [[0.012, 0.002, 0.002, 0.002, 0.006], [0.020, 0.008, 0.006, 0.0, 0.008], [0.036, 0.018, 0.013, -0.007, 0.012], [0.056, 0.026, 0.018, -0.012, 0.0145],
    [0.074, 0.028, 0.019, -0.013, 0.0145], [0.087, 0.025, 0.018, -0.010, 0.016], [0.099, 0.019, 0.016, 0.000, 0.020], [0.110, 0.0135, 0.0135, 0.011, 0.025],
    [0.120, 0.0125, 0.0125, 0.018, 0.027], [0.127, 0.012, 0.012, 0.022, 0.028]];
  const toSec = (S) => S.map(s => ({ y: AP.y + s[0], rx: s[1], rz: s[2], cx: s[3], cz: s[4], n: 2 }));
  const cat = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  // same Catmull-Rom interpolation as H.loft -> {rx, rz, cx, cz} at local height y, or null outside the chamber
  function secAt(S, y) {
    const s = y - AP.y; if (s < S[0][0] || s > S[S.length - 1][0]) return null;
    for (let i = 0; i < S.length - 1; i++) if (s <= S[i + 1][0]) {
      const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)];
      const t = (s - p1[0]) / (p2[0] - p1[0]);
      const v = [1, 2, 3, 4].map(k => cat(p0[k], p1[k], p2[k], p3[k], t));
      return { rx: Math.max(1e-5, v[0]), rz: Math.max(1e-5, v[1]), cx: v[2], cz: v[3] };
    }
    return null;
  }
  // outermost ventricular surface point at height y along angle a (0 = +X left, PI/2 = anterior), ray cast from the LV axis
  function vSurf(y, a, lift) {
    const lv = secAt(LVS, y); const ox = lv ? lv.cx : AP.x, oz = lv ? lv.cz : AP.z; const dx = Math.cos(a), dz = Math.sin(a);
    let best = 0;
    for (const S of [LVS, RVS]) {
      const e = secAt(S, y); if (!e) continue;
      const A = (dx / e.rx) ** 2 + (dz / e.rz) ** 2, B = 2 * ((ox - e.cx) * dx / (e.rx * e.rx) + (oz - e.cz) * dz / (e.rz * e.rz)), Cc = ((ox - e.cx) / e.rx) ** 2 + ((oz - e.cz) / e.rz) ** 2 - 1;
      const disc = B * B - 4 * A * Cc; if (disc < 0) continue; const s = (-B + Math.sqrt(disc)) / (2 * A); if (s > best) best = s;
    }
    const d = best + (lift || 0);
    return [ox + dx * d, y, oz + dz * d];
  }
  // interventricular grooves: LV-surface angle where the RV ellipse starts to cover it (front = anterior groove, back = posterior)
  function grooveAngle(y, front) {
    const lv = secAt(LVS, y), rv = secAt(RVS, y); if (!lv || !rv) return null;
    const inRV = (a) => { const x = lv.cx + lv.rx * Math.cos(a), z = lv.cz + lv.rz * Math.sin(a); return ((x - rv.cx) / rv.rx) ** 2 + ((z - rv.cz) / rv.rz) ** 2 < 1; };
    const mid = Math.atan2(rv.cz - lv.cz, rv.cx - lv.cx); if (!inRV(mid)) return null;
    let a = mid; const st = front ? -0.01 : 0.01;
    for (let k = 0; k < 400 && inRV(a); k++) a += st;
    return a;
  }
  const locToWorldPts = (pts) => pts.map(p => hwa(p[0], p[1], p[2]));

  // ------------------------------------------------------------ ventricles
  const lvGeo = rough(toW(H.loft(toSec(LVS), { radial: 48, subdiv: 5 })), 0.0006, 140);
  hpart('heart-left-ventricle', 'Left ventricle', 'Ventriculus sinister', 0.2, lvGeo, CO.heart, info(
    'The thick-walled, cone-shaped lower-left chamber of the heart. It forms the apex, the left border and most of the diaphragmatic (inferior) surface of the heart.',
    'Pumps oxygenated blood through the aortic valve into the aorta and the entire systemic circulation.',
    'Wall 8–12 mm thick (about three times the right ventricle); cavity ~120–150 mL at end-diastole; ejects ~70 mL per beat at rest.',
    'Generates systolic pressures of ~120 mmHg; its wall thickens with long-standing high blood pressure, and its ejection fraction (normally 55–70%) is the key measure of heart failure.'));
  const rvGeo = rough(toW(H.loft(toSec(RVS), { radial: 48, subdiv: 5 })), 0.0006, 140);
  hpart('heart-right-ventricle', 'Right ventricle', 'Ventriculus dexter', 0.2, rvGeo, '#b3353d', info(
    'The crescent-shaped chamber that forms most of the front (sternocostal) surface of the heart, wrapped around the left ventricle. It narrows upward into the smooth conus arteriosus (infundibulum) that leads to the pulmonary valve.',
    'Pumps deoxygenated blood through the pulmonary valve into the pulmonary trunk and the lungs.',
    'Wall 3–5 mm thick; volume similar to the left ventricle; systolic pressure only ~25 mmHg.',
    'Its inner wall is ridged by trabeculae carneae; the septomarginal trabecula (moderator band) carries the right bundle branch to the anterior papillary muscle.'));

  // ------------------------------------------------------------ atria (built in world orientation)
  // auricle (atrial appendage): flattened, tapering, crenated ear-shaped flap from base to tip, curved to hug the atrium
  function auricle(base, tip, outward, width, thick, seed) {
    const B = V(base), Tp = V(tip), ax = Tp.clone().sub(B), len = ax.length(); ax.normalize();
    const o = V(outward), nrm = o.clone().addScaledVector(ax, -o.dot(ax)).normalize(), w = new THREE.Vector3().crossVectors(ax, nrm);
    const geo = H.blob(1, { ws: 40, hs: 24, deform: (p) => {
      const u = (p.x + 1) / 2, taper = 1 - 0.5 * u * u;
      const cren = 1 + 0.1 * H.fbm(p.x * 4 + seed, p.z * 4, p.y * 2 + seed, 2) + 0.07 * Math.sin(p.x * 13 + seed) * Math.abs(p.z);
      const zz = p.z * width * taper * cren, yy = p.y * thick * (0.55 + 0.45 * taper) - 0.4 * (zz * zz) / width;
      return new THREE.Vector3(p.x * len / 2, yy, zz);
    } });
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(ax, nrm, w).setPosition(B.clone().add(Tp).multiplyScalar(0.5)));
    geo.computeVertexNormals(); return geo;
  }
  const RAc = hw(-0.031, 0.026, 0.0);            // ~(-0.010, 1.274, 0.021)
  const raBody = H.blob([0.021, 0.027, 0.021], { ws: 40, hs: 28, noise: { amp: 0.035, freq: 2.2 }, deform: (p) => 1 + 0.05 * Math.max(0, -p.x) - 0.06 * Math.max(0, p.x) * Math.max(0, -p.z) }).translate(RAc.x, RAc.y, RAc.z);
  const raApp = auricle([RAc.x - 0.004, RAc.y + 0.012, RAc.z + 0.013], [RAc.x + 0.02, RAc.y + 0.031, RAc.z + 0.03], [-0.2, 0.3, 1], 0.0095, 0.0042, 1.3);
  hpart('heart-right-atrium', 'Right atrium', 'Atrium dextrum', 0.2, H.merge([raBody, raApp]), '#c2474d', info(
    'Thin-walled chamber forming the right border of the heart. It receives the superior and inferior venae cavae and the coronary sinus; its ear-shaped right auricle overlaps the root of the aorta.',
    'Collects deoxygenated blood from the body and the heart wall and passes it through the tricuspid valve into the right ventricle.',
    'About 4–5 cm across; wall ~2 mm; auricle lined with comb-like pectinate muscles.',
    'Contains the sinoatrial node (the natural pacemaker) near the superior vena cava; the fossa ovalis on its septal wall marks the fetal foramen ovale, which stays probe-patent in about 25% of adults.'));
  const LAc = V([0.022, 1.294, -0.007]);
  const laBody = H.blob([0.031, 0.018, 0.02], { ws: 40, hs: 28, noise: { amp: 0.03, freq: 2.0 },
    deform: (p) => Math.pow(Math.pow(Math.abs(p.x), 2.6) + Math.pow(Math.abs(p.y), 2.6) + Math.pow(Math.abs(p.z), 2.6), -1 / 2.6) * 0.96 }).translate(LAc.x, LAc.y, LAc.z);
  const laApp = auricle([LAc.x + 0.021, LAc.y + 0.01, LAc.z + 0.01], [LAc.x + 0.02, LAc.y + 0.015, LAc.z + 0.048], [1, 0.35, 0.1], 0.0082, 0.0038, 4.1);
  hpart('heart-left-atrium', 'Left atrium', 'Atrium sinistrum', 0.2, H.merge([laBody, laApp]), '#c2474d', info(
    'The most posterior chamber of the heart, lying directly in front of the oesophagus. It receives the four pulmonary veins; its narrow, hook-shaped left auricle curls forward along the left side of the pulmonary trunk.',
    'Receives oxygenated blood from the lungs and passes it through the mitral valve into the left ventricle.',
    'About 4 cm in anteroposterior diameter (upper normal on echocardiography); wall 2–3 mm.',
    'In atrial fibrillation blood stagnates in the left atrial appendage, the source of most cardiac emboli that cause stroke; an enlarged left atrium can indent the oesophagus on a barium swallow.'));

  // ------------------------------------------------------------ surface builders for valves / septum
  function gridGeo(fn, nu, nv) {
    const pos = [], idx = [], W = nu + 1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  // closed thick sheet: fn(i, j) -> { p: Vector3 (mid-surface), o: Vector3 (half-thickness offset) }
  function slab(fn, nu, nv) {
    const pos = [], idx = [], W = nu + 1, N = W * (nv + 1);
    for (const s of [1, -1]) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = fn(i, j); pos.push(q.p.x + s * q.o.x, q.p.y + s * q.o.y, q.p.z + s * q.o.z); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c, N + a, N + c, N + b, N + b, N + c, N + d); }
    const ring = []; for (let i = 0; i < nu; i++) ring.push(i); for (let j = 0; j < nv; j++) ring.push(j * W + nu); for (let i = nu; i > 0; i--) ring.push(nv * W + i); for (let j = nv; j > 0; j--) ring.push(j * W);
    for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; idx.push(a, N + a, b, b, N + a, N + b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  const dbl = (color) => H.mat({ color, side: THREE.DoubleSide, roughness: 0.5 });
  // valve = annulus ring + leaflets/cusps in a frame whose +Y is the direction of blood flow. Returns world geometry + free-edge points.
  function valve(center, dir, R, semilunar, h, spans, rot0) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const M = new THREE.Matrix4().compose(center, q, new THREE.Vector3(1, 1, 1));
    const geos = [H.torus(R, R * 0.07, { radial: 6, tubular: 36 }).rotateX(Math.PI / 2)], edge = [];
    spans.forEach(([f0, f1], k) => {
      const a0 = (rot0 || 0) + f0 * Math.PI * 2 + 0.05, a1 = (rot0 || 0) + f1 * Math.PI * 2 - 0.05, hk = Array.isArray(h) ? h[k] : h;
      const fn = semilunar ? (u, v) => {
        const a = a0 + (a1 - a0) * u, s = Math.sin(Math.PI * u);
        const ya = 0.8 * hk * (1 - s), rf = R * (1 - 0.93 * s), yf = 0.8 * hk + 0.12 * hk * s;
        const r = R + (rf - R) * v, y = ya + (yf - ya) * v - 0.35 * hk * Math.sin(Math.PI * v) * s;
        return [r * Math.cos(a), y, r * Math.sin(a)];
      } : (u, v) => {
        const a = a0 + (a1 - a0) * u, s = Math.sin(Math.PI * u);
        const r = R * (1 - v * (0.3 + 0.35 * s)), y = hk * v * (0.6 + 0.4 * s) + 0.002 * Math.sin(Math.PI * v);
        return [r * Math.cos(a), y, r * Math.sin(a)];
      };
      geos.push(gridGeo(fn, 12, 6));
      if (!semilunar) for (const u of [0.2, 0.5, 0.8]) edge.push(V(fn(u, 1)).applyMatrix4(M));
    });
    geos.forEach(gg => gg.applyMatrix4(M));
    return { geo: H.merge(geos), edge };
  }

  // ------------------------------------------------------------ valves
  const LVOTdir = EX.clone().multiplyScalar(-0.006).addScaledVector(EY, 0.024).addScaledVector(EZ, 0.013).normalize();
  const AVc = hw(0.002, 0.039, 0.008), PVc = hw(0.022, 0.048, 0.028);
  const avDir = V(L.organ.aorta.root).sub(AVc).normalize().add(LVOTdir).normalize();
  const PT2 = V([0.024, 1.345, 0.036]);
  const aortic = valve(AVc, avDir, 0.0115, true, 0.012, [[0, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1]], 0.3);
  hpart('heart-aortic-valve', 'Aortic valve', 'Valva aortae', 0.5, aortic.geo, '#eadbc4', info(
    'Three half-moon (semilunar) cusps — right, left and posterior (non-coronary) — at the outlet of the left ventricle. Behind each cusp the aortic wall bulges into a sinus of Valsalva; the coronary arteries arise from the right and left sinuses.',
    'Opens during systole to let blood into the aorta and snaps shut in diastole to stop it flowing back into the left ventricle.',
    'Annulus ~20–25 mm diameter; opening area 3–4 cm².', 'Its closure makes the second heart sound (S2); age-related calcific aortic stenosis and a congenitally bicuspid valve (1–2% of people) are the commonest reasons for valve replacement.'),
    { material: dbl('#eadbc4') });
  const pulm = valve(PVc, PT2.clone().sub(PVc), 0.0105, true, 0.011, [[0, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1]], 1.2);
  hpart('heart-pulmonary-valve', 'Pulmonary valve', 'Valva trunci pulmonalis', 0.5, pulm.geo, '#eadbc4', info(
    'Three thin semilunar cusps (anterior, left and right) at the top of the right ventricular outflow tract, the most anterior and superior of the four valves.',
    'Lets the right ventricle eject into the pulmonary trunk and prevents back-flow during diastole.',
    'Annulus ~20–25 mm; cusps thinner than the aortic ones because pulmonary pressures are ~1/5 of systemic.', 'Heard best in the left 2nd intercostal space; the pulmonary component of S2 normally splits from the aortic one on inspiration.'),
    { material: dbl('#eadbc4') });
  const LVin = hw(0.012, -0.02, -0.008), RVin = hw(-0.013, -0.01, 0.015);
  const MVc = hw(0.012, 0.018, -0.012), TVc = hw(-0.018, 0.01, 0.003);
  const mitral = valve(MVc, LVin.clone().sub(LAc), 0.014, false, [0.02, 0.013], [[0, 0.36], [0.36, 1]], 1.9);
  hpart('heart-mitral-valve', 'Mitral valve', 'Valva atrioventricularis sinistra (valva mitralis)', 0.5, mitral.geo, '#eadbc4', info(
    'The left atrioventricular valve, with a large anterior leaflet (continuous with the aortic valve) and a long, narrow posterior leaflet, tethered by chordae tendineae to two papillary muscles.',
    'Lets blood flow from the left atrium into the left ventricle and seals during systole so blood is ejected only into the aorta.',
    'Annulus ~3 cm diameter (circumference ~9–10 cm); opening area 4–6 cm².', 'Named for its resemblance to a bishop\'s mitre; mitral valve prolapse affects 2–3% of people, and rheumatic fever classically causes mitral stenosis.'),
    { material: dbl('#eadbc4') });
  const tric = valve(TVc, RVin.clone().sub(RAc), 0.0145, false, [0.018, 0.015, 0.014], [[0, 0.4], [0.4, 0.72], [0.72, 1]], 0.8);
  hpart('heart-tricuspid-valve', 'Tricuspid valve', 'Valva atrioventricularis dextra (valva tricuspidalis)', 0.5, tric.geo, '#eadbc4', info(
    'The right atrioventricular valve, with anterior, posterior and septal leaflets anchored by chordae tendineae to the papillary muscles of the right ventricle.',
    'Allows blood to pass from the right atrium to the right ventricle and closes in systole to prevent regurgitation into the right atrium and veins.',
    'Largest valve: annulus ~3.5–4 cm diameter (circumference 11–13 cm); opening area 5–8 cm².', 'Closure of the mitral and tricuspid valves makes the first heart sound (S1); tricuspid endocarditis is typical in people who inject drugs.'),
    { material: dbl('#eadbc4') });

  // ------------------------------------------------------------ interventricular septum (curved muscular wall, convex into the RV)
  const SN = 14, SU = 10, sepY0 = AP.y + 0.02, sepY1 = 0.016, rows = [];
  let pa0 = null, pa1 = null;
  for (let j = 0; j <= SN; j++) {
    const y = sepY0 + (sepY1 - sepY0) * j / SN; const a0 = grooveAngle(y, true), a1 = grooveAngle(y, false);
    if (a0 != null) pa0 = a0; if (a1 != null) pa1 = a1; rows.push({ y, a0: pa0, a1: pa1 });
  }
  const firstOk = rows.find(r => r.a0 != null && r.a1 != null) || { a0: 1.4, a1: 3.4 };
  rows.forEach(r => { if (r.a0 == null) r.a0 = firstOk.a0; if (r.a1 == null) r.a1 = firstOk.a1; });
  const sepPt = (y, a, inset) => { const lv = secAt(LVS, y); const k = 1 - inset / Math.max(lv.rx, lv.rz); return [lv.cx + lv.rx * k * Math.cos(a), y, lv.cz + lv.rz * k * Math.sin(a)]; };
  const sepGeo = slab((i, j) => {
    const r = rows[j], a = r.a0 + (r.a1 - r.a0) * (i / SU), l = sepPt(r.y, a, 0.0055);
    return { p: hw(l[0], l[1], l[2]), o: EX.clone().multiplyScalar(0.005 * Math.cos(a)).addScaledVector(EZ, 0.005 * Math.sin(a)) };
  }, SU, SN);
  hpart('interventricular-septum', 'Interventricular septum', 'Septum interventriculare', 0.5, sepGeo, '#9a2a31', info(
    'The thick muscular wall between the two ventricles. It bulges into the right ventricle, which is why the RV cavity is crescent-shaped in cross-section; a small thin membranous part lies just below the aortic valve.',
    'Separates oxygenated from deoxygenated blood and contracts with the left ventricle; it carries the bundle of His and the bundle branches.',
    'About 10–12 mm thick (up to ~15 mm is normal on echo); ~9 cm long from base to apex.', 'Ventricular septal defect (VSD) is the commonest congenital heart defect; abnormal thickening of the septum occurs in hypertrophic cardiomyopathy.'),
    { material: dbl('#9a2a31') });

  // ------------------------------------------------------------ papillary muscles + chordae tendineae
  const cavPt = (S, y, a, frac, wall) => { const e = secAt(S, y); return [e.cx + frac * (e.rx - wall) * Math.cos(a), y, e.cz + frac * (e.rz - wall) * Math.sin(a)]; };
  const pap = [
    { base: cavPt(LVS, -0.045, 0.5, 0.9, 0.009), tip: cavPt(LVS, -0.012, 0.5, 0.5, 0.009), lv: true },     // anterolateral (LV)
    { base: cavPt(LVS, -0.045, -1.4, 0.9, 0.009), tip: cavPt(LVS, -0.012, -1.4, 0.5, 0.009), lv: true },   // posteromedial (LV)
    { base: cavPt(RVS, -0.04, 1.7, 0.85, 0.004), tip: cavPt(RVS, -0.01, 1.8, 0.45, 0.004), lv: false },    // anterior (RV)
    { base: cavPt(RVS, -0.035, 3.6, 0.85, 0.004), tip: cavPt(RVS, -0.008, 3.4, 0.45, 0.004), lv: false }   // posterior (RV)
  ].map(p => ({ base: hw(...p.base), tip: hw(...p.tip), lv: p.lv }));
  const papGeos = pap.map(p => H.tube([p.base, p.base.clone().lerp(p.tip, 0.5), p.tip], (t) => 0.0056 * (1 - 0.7 * t) + 0.0006, { radial: 10, step: 0.003 }));
  const chord = (edge, lv) => edge.map(e => { const cands = pap.filter(p => p.lv === lv); const tp = cands.reduce((b, p) => p.tip.distanceTo(e) < b.tip.distanceTo(e) ? p : b, cands[0]).tip; return H.tube([tp, e], 0.00035, { radial: 4, tubular: 3 }); });
  hpart('heart-papillary-muscles', 'Papillary muscles and chordae tendineae', 'Musculi papillares; chordae tendineae', 0.5,
    H.merge(papGeos.concat(chord(mitral.edge, true), chord(tric.edge, false))), '#a52d35', info(
      'Finger-like muscles projecting from the ventricular walls (two in the left ventricle, three in the right) whose tips send fine tendinous cords to the edges of the mitral and tricuspid leaflets.',
      'Contract with the ventricle and keep the leaflets from turning inside-out (prolapsing) into the atria during systole.',
      'Papillary muscles 1.5–3 cm long; chordae tendineae ~0.5–1 mm thick, 1–2 cm long.', 'Rupture of a papillary muscle after a heart attack causes sudden severe mitral regurgitation; the chordae are nicknamed the "heart strings".'));

  // ------------------------------------------------------------ conduction system
  const RAcL = RAc.clone().applyMatrix4(HMI);
  const saC = RAc.clone().add(V([-0.0072, 0.0185, 0.0072]));
  const saGeo = H.blob([0.0035, 0.0075, 0.0025], { ws: 16, hs: 12, noise: { amp: 0.15, freq: 3 } }); saGeo.rotateZ(0.25); saGeo.translate(saC.x, saC.y, saC.z);
  hpart('heart-sa-node', 'Sinoatrial (SA) node', 'Nodus sinuatrialis', 0.5, saGeo, '#f2c94c', info(
    'A small crescent of specialised pacemaker cells in the wall of the right atrium where the superior vena cava enters, at the top of the crista terminalis.',
    'Fires spontaneously 60–100 times a minute, starting every normal heartbeat (sinus rhythm).',
    'About 10–20 mm long, 3–5 mm wide, ~1 mm deep under the epicardium.', 'Supplied by the SA-nodal artery (from the right coronary artery in ~60% of people); its rate is sped up by sympathetic nerves and slowed by the vagus.'),
    { material: H.mat({ color: '#f2c94c', emissive: '#6a4a00', emissiveIntensity: 0.6 }) });
  const avL = [-0.006, 0.021, -0.002], avC = hw(...avL);
  const avGeo = H.blob([0.0035, 0.0022, 0.0018], { ws: 16, hs: 12, noise: { amp: 0.12, freq: 3 } }).translate(avC.x, avC.y, avC.z);
  hpart('heart-av-node', 'Atrioventricular (AV) node', 'Nodus atrioventricularis', 0.5, avGeo, '#f2c94c', info(
    'A compact knot of conducting tissue in the lower interatrial septum, inside the triangle of Koch just above the septal leaflet of the tricuspid valve and near the coronary sinus opening.',
    'Delays the electrical impulse by ~0.1 s so the atria finish emptying before the ventricles contract; it is the only normal electrical path from atria to ventricles.',
    'About 5 × 3 × 1 mm.', 'The delay shows as the PR interval on an ECG; damage to it causes heart block, often treated with a pacemaker.'),
    { material: H.mat({ color: '#f2c94c', emissive: '#6a4a00', emissiveIntensity: 0.6 }) });
  const midA = (y) => { const r = rows.reduce((b, q) => Math.abs(q.y - y) < Math.abs(b.y - y) ? q : b, rows[0]); return (r.a0 + r.a1) / 2; };
  const his = [avL, sepPt(0.012, midA(0.012), 0.0055)];
  const rbb = [his[1], sepPt(0.0, midA(0.0) + 0.05, -0.0008), sepPt(-0.02, midA(-0.02) + 0.05, -0.0008), sepPt(-0.034, midA(-0.034), -0.0008), cavPt(RVS, -0.038, 1.9, 0.8, 0.004)];
  const lbb = (da, tipA) => [his[1], sepPt(0.004, midA(0.004) + da * 0.5, 0.0108), sepPt(-0.018, midA(-0.018) + da, 0.0108), sepPt(-0.036, midA(-0.036) + da * 1.2, 0.0108), cavPt(LVS, -0.046, tipA, 0.85, 0.009)];
  hpart('heart-conduction-bundle', 'Bundle of His and bundle branches', 'Fasciculus atrioventricularis', 0.6, H.merge([
    tubeLoc(his, 0.0011, 6), tubeLoc(rbb, 0.0008, 6), tubeLoc(lbb(-0.35, -1.3), 0.0008, 6), tubeLoc(lbb(0.35, 0.5), 0.0008, 6)]), '#f4d35e', info(
    'The ventricular conduction pathway: the bundle of His runs from the AV node through the top of the septum and splits into a right bundle branch (reaching the RV via the moderator band) and a fan-like left bundle branch with anterior and posterior fascicles that end in Purkinje fibres.',
    'Spreads the impulse rapidly (up to 4 m/s) down the septum to the apex and papillary muscles so the ventricles contract from apex to base.',
    'His bundle ~1 cm long and 1–4 mm thick; bundle branches a few millimetres wide (exaggerated here for visibility).', 'Block of either bundle branch widens the QRS complex on the ECG (right or left bundle branch block).'),
    { material: H.mat({ color: '#f4d35e', emissive: '#5a4300', emissiveIntensity: 0.5 }) });
  function tubeLoc(lpts, r, radial) { return H.tube(locToWorldPts(lpts), r, { radial: radial || 8, step: 0.003 }); }

  // ------------------------------------------------------------ coronary arteries and cardiac veins (in the sulci, on the epicardium)
  const lad = []; let aL = null;
  for (let k = 0; k <= 16; k++) { const y = 0.014 + (AP.y + 0.016 - 0.014) * k / 16; const a = grooveAngle(y, true); if (a != null) aL = a; if (aL != null) lad.push(vSurf(y, aL - 0.03, 0.0008)); }
  aL = aL == null ? 1.6 : aL;
  lad.push(vSurf(AP.y + 0.009, aL, 0.0008), vSurf(AP.y + 0.003, aL + 0.8, 0.0008), vSurf(AP.y + 0.008, aL + 2.2, 0.0008));
  const lcaOst = [0.0118, 0.041, 0.002], lcaBif = [0.024, 0.02, 0.013];
  const lcx = [lcaBif]; for (let a = 0.75; a >= -1.75; a -= 0.25) lcx.push(vSurf(0.011, a, 0.0008));
  const diag = (y0, a0) => { const p = []; for (let k = 0; k <= 5; k++) p.push(vSurf(y0 - k * 0.009, a0 - 0.25 - k * 0.14, 0.0005)); return p; };
  const a1 = grooveAngle(-0.008, true) || 1.4, a2 = grooveAngle(-0.03, true) || 1.4;
  const om = []; for (let k = 0; k <= 5; k++) om.push(vSurf(0.011 - k * 0.011, -0.05 - k * 0.06, 0.0005));
  hpart('coronary-artery-left', 'Left coronary artery (LAD and circumflex)', 'Arteria coronaria sinistra', 0.15, H.merge([
    tubeLoc([lcaOst, [0.019, 0.034, 0.006], [0.023, 0.026, 0.011], lcaBif], 0.0021, 8), tubeLoc([lcaBif].concat(lad), (t) => 0.0018 - 0.001 * t, 8), tubeLoc(lcx, (t) => 0.0016 - 0.0007 * t, 8),
    tubeLoc(diag(-0.008, a1), 0.0008, 6), tubeLoc(diag(-0.03, a2), 0.0007, 6), tubeLoc(om, 0.0008, 6)]), CO.artery, info(
    'Arises from the left aortic sinus as a short left main stem that passes behind the pulmonary trunk and splits into the left anterior descending (LAD) artery, running down the anterior interventricular groove round the apex, and the circumflex artery in the left atrioventricular groove.',
    'Supplies most of the left ventricle, the front two-thirds of the septum and the left atrium.',
    'Left main 4–5 mm wide and 1–2.5 cm long; LAD ~3.5 mm tapering to 1 mm, ~12–15 cm long with diagonal branches; circumflex ~3 mm with obtuse marginal branches.', 'Blockage of the proximal LAD causes large anterior infarcts and is nicknamed the "widow-maker".'),
    { tags: ['heart', 'artery'] });
  const rcaOst = [-0.0018, 0.0402, 0.0199]; const rca = [rcaOst, [-0.012, 0.036, 0.022], [-0.02, 0.026, 0.028]];
  const aP = grooveAngle(0.006, false) || 3.8;
  for (let a = 2.3; a <= aP; a += 0.2) rca.push(vSurf(0.009, a, 0.0009));
  for (let y = 0.0; y >= AP.y + 0.03; y -= 0.008) rca.push(vSurf(y, (grooveAngle(y, false) || aP) + 0.03, 0.0008));
  const acm = []; for (let k = 0; k <= 5; k++) acm.push(vSurf(0.008 - k * 0.01, Math.PI + 0.1 - k * 0.05, 0.0005));
  hpart('coronary-artery-right', 'Right coronary artery', 'Arteria coronaria dextra', 0.15, H.merge([tubeLoc(rca, (t) => 0.0019 - 0.001 * t, 8), tubeLoc(acm, 0.0008, 6)]), CO.artery, info(
    'Arises from the right (anterior) aortic sinus, runs forward between the right auricle and the pulmonary trunk, then round the right atrioventricular groove to the back of the heart, where it usually gives the posterior interventricular (posterior descending) artery.',
    'Supplies the right atrium and ventricle, the back third of the septum, and in most people the SA and AV nodes.',
    'About 3–4 mm wide at its origin; acute marginal branch along the lower right border.', 'The heart is "right-dominant" in ~70–80% of people (the RCA gives the posterior descending artery); RCA occlusion typically causes an inferior infarct and slow heart rhythms.'),
    { tags: ['heart', 'artery'] });
  const gcv = [];
  for (let k = 0; k <= 10; k++) { const y = AP.y + 0.025 + (0.014 - AP.y - 0.025) * k / 10; const a = grooveAngle(y, true); if (a != null) gcv.push(vSurf(y, a - 0.14, 0.0012)); }
  for (let a = 0.7; a >= -1.0; a -= 0.25) gcv.push(vSurf(0.018, a, 0.0014));
  hpart('great-cardiac-vein', 'Great cardiac vein', 'Vena cardiaca magna', 0.15, tubeLoc(gcv, (t) => 0.0014 + 0.0016 * t, 8), CO.vein, info(
    'Begins near the apex, ascends in the anterior interventricular groove beside the LAD, then turns left in the atrioventricular groove alongside the circumflex artery to become the coronary sinus at the back of the heart.',
    'Drains blood from the territory of the left coronary artery (front of both ventricles and the septum).',
    'About 2–3 mm wide, widening to ~4 mm near the coronary sinus.', 'The coronary sinus and great cardiac vein are the route used to place the left-ventricular lead of a biventricular pacemaker (CRT).'),
    { tags: ['heart', 'vein'] });
  const cs = []; for (let a = -1.0; a >= -2.45; a -= 0.2) cs.push(vSurf(0.017, a, 0.0035));
  const csOs = RAcL.clone().add(V([0.009, -0.013, -0.015])); cs.push([csOs.x, csOs.y, csOs.z]);
  const mcv = []; for (let y = AP.y + 0.03; y <= 0.006; y += 0.008) mcv.push(vSurf(y, (grooveAngle(y, false) || aP) + 0.15, 0.001));
  mcv.push(cs[cs.length - 2]);
  hpart('coronary-sinus', 'Coronary sinus', 'Sinus coronarius', 0.15, H.merge([tubeLoc(cs, (t) => 0.003 + 0.0015 * t, 10), tubeLoc(mcv, (t) => 0.0012 + 0.0012 * t, 6)]), CO.vein, info(
    'A wide venous channel lying in the posterior atrioventricular groove between the left atrium and left ventricle, opening into the right atrium between the IVC opening and the tricuspid valve. Shown with its tributary the middle cardiac vein in the posterior interventricular groove.',
    'Collects most of the venous blood of the heart wall (great, middle and small cardiac veins) and returns it to the right atrium.',
    'About 3–5 cm long and ~1 cm wide at its opening.', 'Its opening is guarded by the thin Thebesian valve; the heart muscle extracts ~70% of the oxygen delivered, so coronary-sinus blood is the most deoxygenated in the body.'),
    { tags: ['heart', 'vein'] });

  // ------------------------------------------------------------ great vessels of the thorax
  const SP = L.spine, ao = L.organ.aorta;
  // point just in front of a vertebral body (clears the bone by `gap`)
  const preV = (n, x, r, gap) => [x, SP[n].y, SP[n].z + SP[n].d / 2 + r + (gap == null ? 0.0015 : gap)];
  const aoAsc = tube([AVc, ao.root, [-0.001, 1.348, 0.022], [-0.004, 1.368, 0.017]], (t) => 0.0136 - 0.0008 * t + 0.0024 * Math.exp(-(((t - 0.1) / 0.07) ** 2)), 20, 0.004);
  vessel({ id: 'aorta-ascending', name: 'Ascending aorta', latin: 'Aorta ascendens', kind: 'a', geometry: aoAsc, region: 'thorax', info: info(
    'The first ~5 cm of the aorta, rising from the aortic valve behind the sternum upward, forward and to the right inside the pericardial sac. Its root bulges into three aortic sinuses, from which the coronary arteries arise.',
    'Carries the entire output of the left ventricle (~5 L/min at rest) towards the arch.', '~5 cm long; 2.5–3.5 cm diameter (root up to ~3.7 cm).',
    'Commonest site of thoracic aortic aneurysm and of type A aortic dissection, a surgical emergency.') });
  const archPts = [[-0.004, 1.368, 0.017], [-0.003, 1.386, 0.006], ao.archTop, [0.008, 1.391, -0.028], [0.013, 1.378, -0.042], [0.014, 1.36, -0.049]];
  vessel({ id: 'aortic-arch', name: 'Aortic arch', latin: 'Arcus aortae', kind: 'a', pts: [[-0.001, 1.348, 0.022]].concat(archPts), r: taper(0.0128, 0.0119), radial: 20, region: 'thorax', info: info(
    'Curves backwards and to the left from the level of the sternal angle, arching over the pulmonary trunk bifurcation and the left main bronchus to reach the left side of T4. It gives off the brachiocephalic trunk, left common carotid and left subclavian arteries.',
    'Distributes blood to the head, neck and upper limbs and turns the flow downward into the descending aorta.', '~4.5 cm long, ~2.5 cm diameter; its top lies ~2.5 cm below the jugular notch.',
    'The ligamentum arteriosum (remnant of the fetal ductus arteriosus) tethers its underside to the left pulmonary artery; the left recurrent laryngeal nerve hooks under it, so an arch aneurysm can cause hoarseness.') });
  const thorX = { T6: 0.012, T7: 0.012, T8: 0.011, T9: 0.01, T10: 0.008, T11: 0.006, T12: 0.004 };
  const aoTh = [[0.014, 1.36, -0.049], ao.descendingT6].concat(['T7', 'T8', 'T9', 'T10', 'T11', 'T12'].map(n => preV(n, thorX[n], 0.0115, 0.002)));
  aoTh[1] = [ao.descendingT6[0], ao.descendingT6[1], Math.max(ao.descendingT6[2], preV('T6', 0, 0.0118)[2])];
  vessel({ id: 'aorta-thoracic', name: 'Descending thoracic aorta', latin: 'Aorta thoracica', kind: 'a', pts: [[0.013, 1.378, -0.042]].concat(aoTh), r: taper(0.0119, 0.0112), radial: 18, region: 'thorax', info: info(
    'Runs down the posterior mediastinum from T4 to T12, just left of the vertebral bodies and behind the left atrium and oesophagus, and leaves the chest through the aortic hiatus of the diaphragm.',
    'Gives posterior intercostal, bronchial, oesophageal and superior phrenic branches and conveys blood to the abdomen and legs.', '~20 cm long, ~2.3–2.5 cm diameter.',
    'The isthmus just beyond the left subclavian origin is where coarctation occurs and where the aorta tears in high-speed deceleration injuries.') });
  const aoAbPts = [aoTh[aoTh.length - 1]].concat([['L1', 0.003, 0.011], ['L2', 0.002, 0.0105], ['L3', 0.001, 0.0101], ['L4', 0.0, 0.0095]].map(a => preV(a[0], a[1], a[2])));
  const aoBif = aoAbPts[aoAbPts.length - 1]; aoBif[1] = ao.bifurcation[1];
  vessel({ id: 'aorta-abdominal', name: 'Abdominal aorta', latin: 'Aorta abdominalis', kind: 'a', pts: [aoTh[aoTh.length - 2]].concat(aoAbPts), r: taper(0.0112, 0.0092), radial: 18, region: 'abdomen', info: info(
    'Enters the abdomen through the aortic hiatus at T12 and descends in front of the lumbar vertebral bodies, slightly left of the midline, dividing into the two common iliac arteries at L4 (about the level of the umbilicus and iliac crests).',
    'Supplies the gut (coeliac trunk, superior and inferior mesenteric arteries), kidneys, adrenals, gonads and the posterior body wall.', '~13 cm long; ~2 cm tapering to ~1.7 cm diameter (over 3 cm counts as aneurysmal).',
    'Abdominal aortic aneurysms are mostly below the renal arteries; a pulsatile mass above the umbilicus can be felt in thin people, and ultrasound screening is offered to older men.') });

  // pulmonary circulation
  const ptPts = [PVc.clone().addScaledVector(PT2.clone().sub(PVc).normalize(), -0.005), PVc, PT2, [0.025, 1.353, 0.02], [0.022, 1.356, 0.005]];
  const ptGeo = tube(ptPts, taper(0.0125, 0.0118), 18, 0.004);
  vessel({ id: 'artery-pulmonary-trunk', name: 'Pulmonary trunk', latin: 'Truncus pulmonalis', kind: 'a', geometry: ptGeo, region: 'thorax', tags: ['pulmonary'], info: info(
    'A short, wide trunk rising from the conus arteriosus of the right ventricle, in front of and then to the left of the ascending aorta, dividing under the aortic arch into right and left pulmonary arteries.',
    'Carries deoxygenated blood from the right ventricle to the lungs.', '~5 cm long, ~2.5–3 cm diameter (normally under 2.9 cm on CT).',
    'With its branches it is the only adult artery carrying deoxygenated blood; a clot straddling the bifurcation is a "saddle" pulmonary embolus.') });
  vessel({ id: 'artery-pulmonary-r', name: 'Right pulmonary artery', latin: 'Arteria pulmonalis dextra', kind: 'a', side: 'R', region: 'thorax', tags: ['pulmonary'], r: taper(0.0095, 0.0078), radial: 14,
    pts: [[0.022, 1.356, 0.005], [0.005, 1.353, -0.003], [-0.015, 1.348, -0.004], [-0.035, 1.344, -0.005], [-0.05, 1.338, -0.009], [-0.063, 1.332, -0.013]], info: info(
      'The longer branch: runs horizontally to the right beneath the aortic arch, behind the ascending aorta and superior vena cava and in front of the right main bronchus, into the hilum of the right lung.',
      'Carries deoxygenated blood to the three lobes of the right lung.', '~5 cm long, 2–2.5 cm diameter.', 'Divides at the hilum into a truncus anterior for the upper lobe and an interlobar artery for the middle and lower lobes.') });
  vessel({ id: 'artery-pulmonary-l', name: 'Left pulmonary artery', latin: 'Arteria pulmonalis sinistra', kind: 'a', side: 'L', region: 'thorax', tags: ['pulmonary'], r: taper(0.009, 0.0078), radial: 14,
    pts: [[0.022, 1.356, 0.005], [0.035, 1.364, -0.004], [0.048, 1.36, -0.012], [0.063, 1.351, -0.018]], info: info(
      'The shorter branch: passes to the left in front of the descending aorta and arches over the left main bronchus into the hilum of the left lung; the ligamentum arteriosum links its origin to the aortic arch.',
      'Carries deoxygenated blood to the left lung.', '~3 cm long before dividing, ~2 cm diameter.', 'In the fetus the ductus arteriosus shunted blood from here into the aorta, bypassing the unexpanded lungs; it closes within days of birth.') });
  const pvInfo = (sup, side) => info(
    `The ${sup ? 'superior' : 'inferior'} ${side} pulmonary vein leaves the ${sup ? 'upper' : 'lower'} part of the ${side} lung hilum and runs a short course to open into the posterior wall of the left atrium.`,
    'Returns oxygenated blood from the lungs to the left side of the heart.', '~1–1.5 cm diameter; 1–2 cm long outside the lung.',
    'Sleeves of atrial muscle extending into the pulmonary veins trigger most atrial fibrillation, the target of catheter "pulmonary vein isolation".');
  [['superior', 'l', 'L', [[0.04, 1.305, -0.01], [0.052, 1.316, -0.016], [0.065, 1.326, -0.02]]], ['inferior', 'l', 'L', [[0.042, 1.29, -0.014], [0.055, 1.288, -0.022], [0.067, 1.286, -0.028]]],
    ['superior', 'r', 'R', [[0.002, 1.303, -0.012], [-0.025, 1.312, -0.014], [-0.045, 1.32, -0.016], [-0.061, 1.324, -0.018]]], ['inferior', 'r', 'R', [[0.002, 1.288, -0.016], [-0.025, 1.285, -0.02], [-0.045, 1.283, -0.024], [-0.059, 1.28, -0.028]]]]
    .forEach(([sup, s, S, pts]) => vessel({ id: `vein-pulmonary-${sup}-${s}`, name: `${S === 'L' ? 'Left' : 'Right'} ${sup} pulmonary vein`, latin: `Vena pulmonalis ${S === 'L' ? 'sinistra' : 'dextra'} ${sup}`,
      kind: 'v', side: S, pts, r: 0.0065, radial: 12, region: 'thorax', tags: ['pulmonary'], color: CO.vein, info: pvInfo(sup === 'superior', S === 'L' ? 'left' : 'right') }));

  // systemic veins entering the heart
  const svcPts = [[-0.026, 1.39, 0.029], [-0.028, 1.365, 0.024], [-0.027, 1.335, 0.018], [-0.024, 1.312, 0.015], [-0.02, 1.298, 0.016]];
  const svcGeo = tube(svcPts, taper(0.0095, 0.0105), 16, 0.004);
  vessel({ id: 'vein-superior-vena-cava', name: 'Superior vena cava', latin: 'Vena cava superior', kind: 'v', geometry: svcGeo, region: 'thorax', info: info(
    'A large valveless vein formed behind the right first costal cartilage by the union of the two brachiocephalic veins. It descends to the right of the ascending aorta, receives the azygos vein from behind and opens into the top of the right atrium.',
    'Returns blood from the head, neck, upper limbs and chest wall to the heart.', '~7 cm long, ~2 cm diameter.',
    'Compression by lung cancer or lymphoma causes superior vena cava syndrome (swollen face and arms, distended neck veins); central venous catheter tips are placed at its junction with the right atrium.') });
  const ivcPts = [[-0.018, 1.025, -0.018], [-0.022, 1.05, -0.017], [-0.024, 1.084, -0.02], [-0.025, 1.117, -0.024], [-0.024, 1.15, -0.026], [-0.022, 1.175, -0.024],
    [L.organ.ivc.hepatic[0], 1.195, -0.018], [-0.018, 1.225, -0.01], [-0.016, 1.245, -0.002], [-0.015, 1.262, 0.008]];
  vessel({ id: 'vein-inferior-vena-cava', name: 'Inferior vena cava', latin: 'Vena cava inferior', kind: 'v', pts: ivcPts, r: 0.0105, radial: 16, region: 'body', info: info(
    'The largest vein, formed at L5 by the union of the common iliac veins. It ascends to the right of the aorta, grooves the back of the liver (receiving the hepatic veins), pierces the central tendon of the diaphragm at T8 and opens into the lower right atrium.',
    'Returns blood from the legs, pelvis and abdomen to the heart.', '~22–25 cm long, ~2–2.5 cm diameter.',
    'In late pregnancy the uterus can compress it when the mother lies on her back, dropping blood pressure; filters are placed in it below the renal veins to catch leg clots.') });
  vessel({ id: 'vein-brachiocephalic-l', name: 'Left brachiocephalic vein', latin: 'Vena brachiocephalica sinistra', kind: 'v', side: 'L', region: 'thorax', r: 0.0062, radial: 12,
    pts: [[0.022, 1.432, 0.035], [0.01, 1.419, 0.04], [-0.005, 1.405, 0.04], [-0.018, 1.395, 0.034], [-0.026, 1.388, 0.029]], info: info(
      'Formed behind the left sternoclavicular joint by the union of the left internal jugular and subclavian veins; runs obliquely down and to the right behind the manubrium, in front of all three arch branches, to join the right brachiocephalic vein.',
      'Drains the left side of the head, neck and left arm, and receives the thoracic duct at its origin (the left venous angle).', '~6 cm long, ~1.2 cm wide.', 'Much longer than the right one because the superior vena cava lies to the right of the midline.') });
  vessel({ id: 'vein-brachiocephalic-r', name: 'Right brachiocephalic vein', latin: 'Vena brachiocephalica dextra', kind: 'v', side: 'R', region: 'thorax', r: 0.0064, radial: 12,
    pts: [[-0.022, 1.432, 0.035], [-0.024, 1.41, 0.033], [-0.026, 1.39, 0.029]], info: info(
      'Formed behind the right sternoclavicular joint by the right internal jugular and subclavian veins; descends almost vertically to unite with the left brachiocephalic vein as the superior vena cava.',
      'Drains the right side of the head, neck and right arm; receives the right lymphatic duct.', '~2.5 cm long, ~1.2 cm wide.', 'Its straight line into the SVC makes the right internal jugular the preferred route for central lines and pacing wires.') });
  const azyPts = [[-0.02, 1.13, -0.04]].concat(['T12', 'T11', 'T10', 'T9', 'T8', 'T7', 'T6', 'T5'].map(n => [-0.019, SP[n].y, SP[n].z + 0.45 * SP[n].d / 2 + 0.0045]))
    .concat([[-0.022, 1.372, -0.06], [-0.028, 1.382, -0.04], [-0.031, 1.378, -0.018], [-0.03, 1.367, 0.0], [-0.028, 1.358, 0.016]]);
  vessel({ id: 'vein-azygos', name: 'Azygos vein', latin: 'Vena azygos', kind: 'v', pts: azyPts, r: taper(0.0035, 0.0048), radial: 10, region: 'body', info: info(
    'Ascends on the right side of the thoracic vertebral bodies from the upper abdomen, then arches forward over the root of the right lung at T4 to enter the back of the superior vena cava.',
    'Drains the posterior intercostal veins and the chest wall, oesophagus and bronchi; it is a collateral route between the inferior and superior venae cavae.', '~1 cm diameter at its arch.',
    'Its name is Greek for "unpaired"; if the IVC is blocked, the azygos system can carry lower-body blood back to the heart.') });

  // ------------------------------------------------------------ pericardium (fitted around chambers + great-vessel roots)
  const pcPts = [];
  for (const geo of heart.children.filter(m => /atrium|ventricle/.test(m.name)).map(m => m.geometry).concat([aoAsc, ptGeo, svcGeo])) {
    const p = geo.attributes.position; for (let i = 0; i < p.count; i += 2) pcPts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(HMI));
  }
  const PR = 32, py0 = AP.y - 0.001, py1 = 0.094, NB = 17, pcs = [];
  for (let b = 0; b <= NB; b++) {
    const yc = py0 + (py1 - py0) * b / NB, hwid = (py1 - py0) / NB * 0.9, sel = pcPts.filter(v => Math.abs(v.y - yc) < hwid);
    if (sel.length < 4) continue;
    let cx = 0, cz = 0; sel.forEach(v => { cx += v.x; cz += v.z; }); cx /= sel.length; cz /= sel.length;
    const m = new Array(PR).fill(0);
    sel.forEach(v => { const a = Math.atan2(v.z - cz, v.x - cx), d = Math.hypot(v.x - cx, v.z - cz); const j = ((Math.round(a / (Math.PI * 2) * PR) % PR) + PR) % PR; for (const k of [j - 1, j, j + 1]) { const jj = (k + PR) % PR; m[jj] = Math.max(m[jj], d * (k === j ? 1 : 0.97)); } });
    const mx = Math.max(...m); for (let j = 0; j < PR; j++) m[j] = Math.max(m[j], mx * 0.55);
    for (let it = 0; it < 2; it++) { const c = m.slice(); for (let j = 0; j < PR; j++) m[j] = Math.max(c[j], (c[(j + PR - 1) % PR] + c[j] * 2 + c[(j + 1) % PR]) / 4); }
    pcs.push({ y: yc, rx: 1, rz: 1, cx, cz, r: m.map(d => d + 0.0035) });
  }
  pcs.unshift({ y: AP.y - 0.0045, rx: 1, rz: 1, cx: AP.x, cz: AP.z, r: new Array(PR).fill(0.003) });
  const pcGeo = toW(H.loft(pcs, { radial: PR, subdiv: 3 }));
  hpart('pericardium', 'Pericardium', 'Pericardium', 0, pcGeo, CO.pericardium, info(
    'A tough two-layered sac enclosing the heart and the roots of the great vessels: an outer fibrous layer fused to the diaphragm below and the great vessels above, lined by a serous layer that also covers the heart surface (epicardium).',
    'Anchors the heart in the mediastinum, limits sudden over-filling and lets the heart beat almost frictionlessly on a film of fluid.', 'Wall ~1–2 mm thick; contains ~15–50 mL of serous fluid.',
    'Fluid or blood accumulating in the sac can compress the heart (cardiac tamponade); inflammation (pericarditis) causes sharp chest pain eased by leaning forward.'),
    { material: H.mat({ color: CO.pericardium, opacity: 0.35, roughness: 0.35 }) });

  // ------------------------------------------------------------ arch branches, neck and head
  const bif = [-0.02, 1.43, 0.028], cbL = [0.024, 1.528, 0.024];
  vessel({ id: 'artery-brachiocephalic-trunk', name: 'Brachiocephalic trunk', latin: 'Truncus brachiocephalicus', kind: 'a', region: 'thorax', r: taper(0.0062, 0.0058), radial: 14,
    pts: [[-0.003, 1.385, 0.006], [-0.01, 1.405, 0.014], [-0.017, 1.422, 0.024], bif], info: info(
      'The first and largest branch of the aortic arch. It rises behind the manubrium to the right of the trachea and divides behind the right sternoclavicular joint into the right common carotid and right subclavian arteries.',
      'Supplies the right side of the head and neck and the right upper limb.', '4–5 cm long, ~1.2 cm diameter.',
      'Exists only on the right; in a common variant (so-called "bovine arch", ~15–25%) the left common carotid also arises from it.') });
  const ccaInfo = (left) => info(
    `Ascends in the carotid sheath beside the trachea and larynx, with the internal jugular vein lateral and the vagus nerve behind, dividing at the upper border of the thyroid cartilage (C3–C4). The ${left ? 'left arises directly from the aortic arch, so it has a thoracic part' : 'right arises from the brachiocephalic trunk'}.`,
    'Carries blood to the head, neck and brain.', `~7–8 mm diameter; ${left ? '~12' : '~9'} cm long.`,
    'The carotid pulse is felt at the front border of sternocleidomastoid; the carotid sinus at the bifurcation senses blood pressure and atherosclerotic plaque there is a major cause of stroke.');
  vessel({ id: 'artery-common-carotid-r', name: 'Right common carotid artery', latin: 'Arteria carotis communis dextra', kind: 'a', side: 'R', region: 'neck', r: 0.004, radial: 12,
    pts: [bif, [-0.021, 1.46, 0.024], L.mirror(L.neck.carotidL), L.mirror(cbL)], info: ccaInfo(false) });
  vessel({ id: 'artery-common-carotid-l', name: 'Left common carotid artery', latin: 'Arteria carotis communis sinistra', kind: 'a', side: 'L', region: 'body', r: taper(0.0043, 0.004), radial: 12,
    pts: [[0.0, 1.39, -0.004], [0.008, 1.415, 0.004], [0.015, 1.44, 0.012], [0.02, 1.47, 0.018], L.neck.carotidL, cbL], info: ccaInfo(true) });
  const subInfo = (left) => info(
    `Arises ${left ? 'directly from the aortic arch' : 'from the brachiocephalic trunk'} and arches laterally over the dome of the pleura and the first rib, passing behind the anterior scalene muscle; at the outer border of the first rib it becomes the axillary artery.`,
    'Supplies the arm and, through the vertebral, internal thoracic and thyrocervical branches, the brain, chest wall and neck.', '~9 mm diameter; ~6–9 cm long.',
    'Narrowing near its origin can make the vertebral artery flow backwards when the arm is exercised ("subclavian steal").');
  const subLat = [[0.05, 1.458, -0.006], [0.075, 1.455, 0.0], [0.1, 1.44, 0.004]];
  vessel({ id: 'artery-subclavian-l', name: 'Left subclavian artery', latin: 'Arteria subclavia sinistra', kind: 'a', side: 'L', region: 'thorax', r: taper(0.0048, 0.0043), radial: 12,
    pts: [[0.009, 1.388, -0.024], [0.018, 1.418, -0.018], [0.03, 1.443, -0.012]].concat(subLat), info: subInfo(true) });
  vessel({ id: 'artery-subclavian-r', name: 'Right subclavian artery', latin: 'Arteria subclavia dextra', kind: 'a', side: 'R', region: 'thorax', r: taper(0.0048, 0.0043), radial: 12,
    pts: [bif, [-0.032, 1.445, 0.016]].concat(mirrorPts(subLat)), info: subInfo(false) });
  const vertUp = [[0.026, SP.C6.y, SP.C6.z - 0.004], [0.026, SP.C5.y, SP.C5.z - 0.004], [0.026, SP.C4.y, SP.C4.z - 0.004], [0.026, SP.C3.y, SP.C3.z - 0.004], [0.027, SP.C2.y, SP.C2.z - 0.004],
    [0.034, SP.C1.y, SP.C1.z - 0.006], [0.028, 1.59, -0.034], [0.012, 1.595, -0.028], [0.005, 1.601, -0.01], [0.0005, 1.605, -0.004]];
  const vertInfo = info('The first branch of the subclavian artery. It climbs through the transverse foramina of C6 to C1, winds backwards over the arch of the atlas, enters the skull through the foramen magnum and joins its partner at the lower border of the pons to form the basilar artery.',
    'Supplies the spinal cord, brainstem, cerebellum and the back of the cerebrum (posterior circulation).', '~3–4 mm diameter; the left is often larger.',
    'Can be torn (dissected) by sudden neck twisting, a cause of stroke in young adults; about 20% of brain blood flow comes through the two vertebral arteries.');
  vessel({ id: 'artery-vertebral-l', name: 'Left vertebral artery', latin: 'Arteria vertebralis sinistra', kind: 'a', side: 'L', region: 'body', r: 0.0019, radial: 8, pts: [[0.03, 1.443, -0.012], [0.029, 1.47, -0.022]].concat(vertUp), info: vertInfo });
  vessel({ id: 'artery-vertebral-r', name: 'Right vertebral artery', latin: 'Arteria vertebralis dextra', kind: 'a', side: 'R', region: 'body', r: 0.0018, radial: 8, pts: [[-0.034, 1.447, 0.012], [-0.031, 1.47, -0.012]].concat(mirrorPts(vertUp)), info: vertInfo });
  vessel({ id: 'artery-basilar', name: 'Basilar artery', latin: 'Arteria basilaris', kind: 'a', region: 'head', r: 0.0016, radial: 8, pts: [[0, 1.604, -0.004], [0, 1.614, -0.0035], [0, 1.6245, -0.008]], info: info(
    'Formed by the union of the two vertebral arteries at the lower border of the pons; it runs up the groove on the front of the pons and divides at its upper border into the two posterior cerebral arteries.',
    'Supplies the pons, cerebellum (via superior and anterior inferior cerebellar arteries), inner ear and, through its terminal branches, the occipital lobes.', '~3 cm long, ~3–4 mm diameter.',
    'Basilar artery occlusion can cause "locked-in syndrome" — full consciousness with paralysis of all muscles except those moving the eyes.') });
  const cow = [[0, 1.633, 0.014], [0.007, 1.632, 0.012], [0.013, 1.629, 0.005], [0.013, 1.627, -0.003], [0.008, 1.625, -0.008], [0, 1.6245, -0.009]];
  const cowLoop = cow.concat(mirrorPts(cow.slice(1, 5)).reverse());
  const cowStubs = (s) => [[[s * 0.004, 1.633, 0.013], [s * 0.003, 1.645, 0.03], [s * 0.003, 1.662, 0.04], [s * 0.003, 1.683, 0.03], [s * 0.003, 1.695, 0.01]],
    [[s * 0.013, 1.629, 0.005], [s * 0.025, 1.633, 0.008], [s * 0.038, 1.64, 0.006], [s * 0.048, 1.65, 0.0], [s * 0.055, 1.66, -0.01]],
    [[s * 0.008, 1.625, -0.008], [s * 0.016, 1.628, -0.016], [s * 0.022, 1.634, -0.03], [s * 0.022, 1.64, -0.05], [s * 0.018, 1.645, -0.065]]];
  vessel({ id: 'circle-of-willis', name: 'Circle of Willis (ACA, MCA, PCA)', latin: 'Circulus arteriosus cerebri', kind: 'a', region: 'head', tags: ['brain'],
    geometry: H.merge([H.tube(cowLoop, 0.0011, { radial: 8, closed: true, step: 0.002 })].concat(cowStubs(1).concat(cowStubs(-1)).map(p => tube(p, taper(0.0013, 0.0008), 8, 0.003)))), info: info(
      'A ring of arteries on the base of the brain around the optic chiasm and pituitary stalk, linking the two internal carotids (via the anterior communicating artery and the anterior cerebral arteries) with the basilar system (via the posterior communicating and posterior cerebral arteries). Stubs of the anterior, middle and posterior cerebral arteries leave it.',
      'Provides alternative routes so that blood can still reach all parts of the brain if one feeding artery narrows; ACA supplies the medial frontal and parietal lobes, MCA most of the lateral cortex, PCA the occipital lobe.',
      'Ring ~3 × 2.5 cm; component arteries 1–4 mm diameter.', 'A complete, symmetric circle is present in fewer than half of people; berry aneurysms at its junctions (especially the anterior communicating artery) cause most subarachnoid haemorrhages.') });
  vessel({ id: 'artery-internal-carotid', name: 'internal carotid artery', latin: 'Arteria carotis interna', kind: 'a', pair: true, region: 'head', r: taper(0.0026, 0.002), radial: 10,
    pts: [cbL, [0.026, 1.545, 0.016], [0.028, 1.565, 0.004], [0.027, 1.585, -0.006], [0.026, 1.598, -0.01], [0.02, 1.608, -0.004], [0.014, 1.62, -0.002], [0.015, 1.627, 0.004], [0.013, 1.63, 0.006]], info: info(
      'Rises from the carotid bifurcation without branches in the neck, enters the skull through the carotid canal of the temporal bone, bends forward through the cavernous sinus beside the pituitary (the carotid siphon) and ends by dividing into the anterior and middle cerebral arteries.',
      'Supplies most of the cerebral hemisphere on its side and, via the ophthalmic artery, the eye.', '~5 mm diameter at its origin (carotid bulb); ~4 mm intracranially.',
      'Narrowing at its origin (carotid stenosis) is treated by endarterectomy or stenting to prevent stroke; transient blindness in one eye (amaurosis fugax) is a warning sign.') });
  const ecaMain = [cbL, [0.027, 1.54, 0.03], [0.032, 1.555, 0.028], [0.042, 1.575, 0.015], [0.052, 1.595, 0.004], [0.058, 1.61, -0.003], [0.065, 1.63, -0.002], [0.064, 1.655, 0.0], [0.06, 1.68, 0.008]];
  vessel({ id: 'artery-external-carotid', name: 'external carotid artery', latin: 'Arteria carotis externa', kind: 'a', pair: true, region: 'head', r: taper(0.0026, 0.0012), radial: 10, pts: ecaMain,
    // facial artery: hooks over the lower border of the mandible in front of masseter, then runs ~4 mm under the skin to the angle of the mouth and up beside the nose
    extra: [tube([[0.03, 1.55, 0.03], [0.037, 1.546, 0.042], [0.0401, 1.5521, 0.0523], [0.0366, 1.5615, 0.0647], [0.0308, 1.5687, 0.076], [0.0267, 1.5807, 0.0843], [0.0213, 1.5948, 0.0888], [0.0188, 1.6094, 0.0877], [0.0151, 1.6214, 0.0841]], taper(0.0014, 0.0007), 8, 0.004),
      tube([[0.055, 1.602, 0.0], [0.042, 1.597, 0.014], [0.03, 1.592, 0.028]], taper(0.0014, 0.001), 8, 0.004)], info: info(
      'Rises from the carotid bifurcation in front of the internal carotid and ascends behind the angle of the mandible into the parotid gland, ending as the superficial temporal and maxillary arteries. Shown with its facial artery (winding over the jaw to the corner of the mouth and side of the nose) and maxillary branches.',
      'Supplies the face, scalp, jaws, teeth, tongue, thyroid and the dura (via the middle meningeal artery).', '~4–5 mm diameter at its origin; eight named branches.',
      'The facial pulse is felt where the artery crosses the jaw in front of masseter and the superficial temporal pulse just in front of the ear; a tear of its middle meningeal branch causes an extradural haematoma.') });
  vessel({ id: 'vein-internal-jugular', name: 'internal jugular vein', latin: 'Vena jugularis interna', kind: 'v', pair: true, region: 'body', r: taper(0.0048, 0.006), radial: 12,
    pts: [[0.03, 1.595, -0.02], [0.033, 1.575, -0.01], [0.035, 1.55, 0.004], [0.034, 1.525, 0.014], L.neck.jugularL, [0.029, 1.47, 0.028], [0.025, 1.445, 0.033], [0.022, 1.432, 0.035]], info: info(
      'Continues the sigmoid sinus from the jugular foramen at the skull base and descends in the carotid sheath lateral to the carotid arteries, joining the subclavian vein behind the sternoclavicular joint to form the brachiocephalic vein.',
      'Drains the brain, face and neck.', '~1–1.5 cm wide (widest of the neck veins), with a bulb at each end.',
      'Its pulsations reflect right atrial pressure (the jugular venous pressure, JVP); the right one is the standard site for ultrasound-guided central venous catheters.') });
  vessel({ id: 'vein-subclavian', name: 'subclavian vein', latin: 'Vena subclavia', kind: 'v', pair: true, region: 'thorax', r: 0.0055, radial: 12,
    pts: [[0.105, 1.428, 0.016], [0.08, 1.429, 0.02], [0.05, 1.435, 0.029], [0.022, 1.432, 0.035]], info: info(
      'Continues the axillary vein from the outer border of the first rib and runs medially over the rib in front of the anterior scalene muscle, beneath the clavicle, to join the internal jugular vein at the venous angle.',
      'Drains the upper limb, and on the left receives lymph from the thoracic duct at its junction with the internal jugular vein.', '~1–2 cm diameter, ~3–4 cm long.',
      'Held open by fascial attachments, it is a classic site for central venous catheters placed just below the clavicle; repetitive overhead arm use can cause its thrombosis (Paget–Schroetter syndrome).') });

  // ------------------------------------------------------------ limb skin surface (same sections and muscle-relief warps as the arm/leg
  // skin lofts of integumentary) so superficial veins can be laid a fixed depth under the skin, inside the subcutaneous fat
  const JT = L.joint, Gy = (y, c, s) => Math.exp(-(((y - c) / s) ** 2)), pos2 = (v) => Math.max(0, v);
  const axisAt = (y, lo, mid, hi) => y >= mid[1] ? H.mix3(mid, hi, H.clamp((y - mid[1]) / (hi[1] - mid[1]), 0, 1)) : H.mix3(lo, mid, H.clamp((y - lo[1]) / (mid[1] - lo[1]), 0, 1));
  // rows [y, rx, rz, cx, cz] -> fn(y, angle in degrees (0 = +X, 90 = anterior), depth) = point `depth` under the skin
  function limbSkin(rows, warp) {
    return (y, angDeg, dep) => {
      let i = 0; while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
      const p0 = rows[Math.max(0, i - 1)], p1 = rows[i], p2 = rows[i + 1], p3 = rows[Math.min(rows.length - 1, i + 2)];
      let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (cat(p0[0], p1[0], p2[0], p3[0], m) < y) lo = m; else hi = m; }
      const t = (lo + hi) / 2, [rx, rz, cx, cz] = [1, 2, 3, 4].map(k => cat(p0[k], p1[k], p2[k], p3[k], t));
      const a = angDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.1, m = warp(y, [c, s]);
      const sx = rx * Math.sign(c) * Math.pow(Math.abs(c), e) * m, sz = rz * Math.sign(s) * Math.pow(Math.abs(s), e) * m, k = 1 - dep / Math.hypot(sx, sz);
      return [cx + sx * k, y, cz + sz * k];
    };
  }
  const lFA = L.limb.forearm, lUA = L.limb.upperArm, lTH = L.limb.thigh, lSK = L.limb.shank;
  const armSkin = limbSkin([[0.84, lFA.rBottom * 1.04, lFA.rBottom * 0.66], [0.88, lFA.rBottom * 1.08, lFA.rBottom * 0.72], [0.95, 0.034, 0.025], [1.02, 0.040, 0.031], [1.06, lFA.rTop, lFA.rTop * 0.81],
    [L.y.elbow, lUA.rBottom * 1.03, lUA.rBottom * 0.9], [1.14, 0.039, 0.039], [1.22, 0.040, 0.044], [1.30, 0.043, 0.046], [1.36, lUA.rTop * 0.96, lUA.rTop * 0.98], [1.40, 0.043, 0.044], [1.425, 0.030, 0.032]]
    .map(r => { const c = axisAt(r[0], JT.wristL, JT.elbowL, JT.shoulderL); return [r[0], r[1], r[2], c.x, c.z]; }),
  (y, d) => 1 + 0.09 * Gy(y, 1.22, 0.06) * pos2(d[1]) ** 2 + 0.06 * Gy(y, 1.28, 0.07) * pos2(-d[1]) ** 2 + 0.06 * Gy(y, 1.03, 0.05) * pos2(0.7 * d[1] - 0.7 * d[0]) ** 2
    + 0.07 * Gy(y, 1.06, 0.045) * pos2(0.8 * d[0] + 0.6 * d[1]) ** 2 + 0.08 * Gy(y, 1.10, 0.015) * pos2(-d[1]) ** 4 + 0.05 * Gy(y, 1.105, 0.012) * pos2(-d[0]) ** 4 - 0.04 * Gy(y, 1.11, 0.02) * pos2(d[1]) ** 3);
  const legSkin = limbSkin([[0.062, 0.031, 0.029], [0.085, lSK.rAnkle, 0.030], [0.13, 0.030, 0.030], [0.20, 0.034, 0.038], [0.28, 0.042, 0.048], [L.y.calfMax, lSK.rCalf * 0.85, lSK.rCalf],
    [0.44, 0.049, 0.052], [0.475, 0.050, 0.050], [L.y.kneeJoint, lSK.rTop * 0.92, 0.051], [0.54, 0.056, 0.054], [0.60, lTH.rBottom * 1.05, 0.062], [0.68, 0.068, 0.070],
    [0.76, 0.075, 0.080], [0.84, lTH.rTop * 0.965, 0.090], [0.88, 0.078, 0.088], [0.91, 0.070, 0.080], [0.935, 0.058, 0.065]]
    .map(r => { const c = axisAt(r[0], JT.ankleL, JT.kneeL, JT.hipL); return [r[0], r[1], r[2], c.x + 0.004 * H.smoothstep(0.6, 0.9, r[0]), c.z + 0.008 * H.smoothstep(0.6, 0.88, r[0])]; }),
  (y, d) => 1 + 0.16 * Gy(y, L.y.calfMax - 0.005, 0.075) * Math.pow(pos2(-d[1]), 1.5) + 0.05 * Gy(y, 0.33, 0.05) * pos2(-0.6 * d[1] - 0.8 * d[0]) ** 2
    + 0.10 * Gy(y, L.y.patella, 0.03) * pos2(d[1]) ** 4 + 0.05 * Gy(y, L.y.tibialTuberosity, 0.015) * pos2(d[1]) ** 6
    + 0.07 * Gy(y, 0.58, 0.04) * pos2(0.6 * d[1] - 0.8 * d[0]) ** 2 + 0.04 * Gy(y, 0.70, 0.10) * pos2(d[1]) ** 2 - 0.04 * Gy(y, 0.51, 0.03) * pos2(-d[1]) ** 3
    + 0.12 * Gy(y, 0.07, 0.014) * pos2(d[0]) ** 4 + 0.10 * Gy(y, 0.085, 0.014) * pos2(-d[0]) ** 4 - 0.10 * Gy(y, 0.11, 0.035) * pos2(-d[1]) * Math.abs(d[0]));

  // ------------------------------------------------------------ upper limb (left built, mirrored)
  const SH = V(L.joint.shoulderL), EL = V(L.joint.elbowL), WR = V(L.joint.wristL), UA = L.limb.upperArm, FA = L.limb.forearm;
  const armAx = (fore, s) => fore ? EL.clone().lerp(WR, s) : SH.clone().lerp(EL, s);
  // point in the arm at parameter s (0 = proximal joint), angle in degrees around the limb (0 = lateral +X, 90 = anterior), fraction of the skin radius
  const armPt = (fore, s, angDeg, frac) => { const R = fore ? H.lerp(FA.rTop, FA.rBottom, s) : H.lerp(UA.rTop, UA.rBottom, s), a = angDeg * Math.PI / 180, A = armAx(fore, s);
    return [A.x + R * frac * Math.cos(a), A.y, A.z + R * frac * Math.sin(a)]; };
  const offA = (fore, s, dx, dz) => { const A = armAx(fore, s); return [A.x + dx, A.y, A.z + dz]; };
  vessel({ id: 'artery-axillary', name: 'axillary artery', latin: 'Arteria axillaris', kind: 'a', pair: true, region: 'thorax', r: taper(0.0045, 0.004), radial: 12,
    pts: [[0.1, 1.44, 0.004], [0.125, 1.43, 0.002], [0.15, 1.405, -0.003], [0.168, 1.375, -0.008], [0.176, 1.355, -0.01]], info: info(
      'Continues the subclavian artery from the outer border of the first rib through the axilla, behind pectoralis minor and surrounded by the cords of the brachial plexus, to the lower border of teres major, where it becomes the brachial artery.',
      'Supplies the shoulder, lateral chest wall and axilla (thoracoacromial, lateral thoracic, subscapular and circumflex humeral branches) and carries blood on to the arm.', '~8–9 mm diameter; ~10 cm long.',
      'Its rich anastomosis around the scapula can keep the arm alive if the artery is tied off above the subscapular branch.') });
  const brach = [[0.176, 1.355, -0.01], offA(false, 0.3, -0.018, 0.008), offA(false, 0.5, -0.018, 0.009), offA(false, 0.7, -0.017, 0.01), offA(false, 0.88, -0.011, 0.015), offA(false, 1.0, -0.004, 0.02)];
  const cubBif = offA(true, 0.08, -0.002, 0.018);
  vessel({ id: 'artery-brachial', name: 'brachial artery', latin: 'Arteria brachialis', kind: 'a', pair: true, region: 'armL', r: taper(0.0034, 0.003), radial: 10, pts: brach.concat([cubBif]), info: info(
    'The main artery of the arm: runs down the medial side of the arm in the groove between biceps and triceps with the median nerve, then crosses to the front of the elbow (cubital fossa), dividing about 1 cm below the elbow crease into the radial and ulnar arteries.',
    'Supplies the arm muscles and the humerus (via the profunda brachii) and feeds the forearm and hand.', '~6 mm diameter; ~20 cm long.',
    'It is the artery used for measuring blood pressure with a cuff and stethoscope; supracondylar fractures of the humerus in children can compress it.') });
  vessel({ id: 'artery-radial', name: 'radial artery', latin: 'Arteria radialis', kind: 'a', pair: true, region: 'armL', r: taper(0.0017, 0.0014), radial: 8,
    // wrist -> dorsally round the snuffbox (behind the thumb's base) -> between the 1st/2nd metacarpal bases into the deep palmar arch
    pts: [cubBif, offA(true, 0.25, 0.012, 0.012), offA(true, 0.5, 0.014, 0.012), offA(true, 0.75, 0.013, 0.014), offA(true, 0.97, 0.012, 0.0105), [0.2605, 0.84, 0.011], [0.265, 0.828, 0.004], [0.262, 0.817, 0.004], [0.258, 0.807, 0.011], [0.248, 0.803, 0.015], [0.232, 0.806, 0.015]],
    extra: [tube([offA(true, 0.97, 0.012, 0.0105), [0.2545, 0.84, 0.023], [0.255, 0.822, 0.027], [0.257, 0.806, 0.027]], 0.0009, 6, 0.004)], info: info(
      'The smaller terminal branch of the brachial artery, running down the lateral (thumb) side of the forearm under brachioradialis to the wrist, where it lies on the distal radius, then winds through the anatomical snuffbox into the palm to form the deep palmar arch.',
      'Supplies the lateral forearm, the thumb and the deep palmar arch of the hand.', '~2–3 mm diameter; ~20 cm long.',
      'The radial pulse is felt just lateral to the flexor carpi radialis tendon; it is the usual route for coronary angiography and for arterial blood-gas samples.') });
  vessel({ id: 'artery-ulnar', name: 'ulnar artery', latin: 'Arteria ulnaris', kind: 'a', pair: true, region: 'armL', r: taper(0.0019, 0.0015), radial: 8,
    pts: [cubBif, offA(true, 0.2, -0.012, 0.01), offA(true, 0.5, -0.013, 0.01), offA(true, 0.8, -0.012, 0.012), offA(true, 0.97, -0.01, 0.012), [0.236, 0.835, 0.022]], info: info(
      'The larger terminal branch of the brachial artery; it passes deep to the flexor muscles, descends along the medial (little-finger) side of the forearm with the ulnar nerve and crosses the wrist superficial to the flexor retinaculum beside the pisiform bone.',
      'Supplies the medial forearm (including the common interosseous artery) and forms most of the superficial palmar arch.', '~3 mm diameter; ~23 cm long.',
      'The Allen test checks that the ulnar artery alone can supply the hand before the radial artery is cannulated or harvested for bypass grafts.') });
  // finger axes and radii of the skin's hand model (integumentary): MCP bases at z 0.015 around the palm centre x 0.2525, three phalanges
  // (45/31/24% of the length) that curl palmwards; proper digital arteries run in the finger pulp at ~55% of the local radius on each side
  const HL = L.limb.hand;
  const FG = [[0.028, 0.752, 0.06, HL.fingerLength[1], 0.0095], [0.008, 0.748, 0.01, HL.fingerLength[2], 0.0098], [-0.012, 0.751, -0.04, HL.fingerLength[3], 0.009], [-0.030, 0.758, -0.09, HL.fingerLength[4], 0.008]]
    .map(([dx, y, sp, len, r]) => ({ B: V([0.2525 + dx, y, 0.015]), len, ls: [len * 0.45, len * 0.31, len * 0.24], rs: [r, r * 0.93, r * 0.85, r * 0.78],
      ds: [V([sp, -1, 0.10]).normalize(), V([sp * 0.7, -1, 0.28]).normalize(), V([sp * 0.5, -1, 0.45]).normalize()] }));
  // point at axial distance s (m) from finger F's base (negative = back into the palm), rc (m) off its axis, at angle ang (degrees) from the
  // palmar midline towards +X (side 1) or -X (side -1)
  function fingerPt(F, s, side, rc, ang) {
    let d = s, i = 0; const p = F.B.clone();
    while (i < 2 && d > F.ls[i]) { p.addScaledVector(F.ds[i], F.ls[i]); d -= F.ls[i]; i++; }
    p.addScaledVector(F.ds[i], d);
    const dir = F.ds[i], pal = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
    const lat = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).addScaledVector(pal, -pal.x).normalize(), a = ang * Math.PI / 180;
    return p.addScaledVector(pal, rc * Math.cos(a)).addScaledVector(lat, side * rc * Math.sin(a)).toArray();
  }
  const fingerR = (F, s) => { let d = Math.max(0, s), i = 0; while (i < 2 && d > F.ls[i]) { d -= F.ls[i]; i++; } return H.lerp(F.rs[i], F.rs[i + 1], Math.min(1, d / F.ls[i])); };
  // proper digital artery. The skin finger is a chain of capsules (joint caps sloping 0.43) set into the palm, whose lower face lies at
  // y 0.742. The artery enters the side of the finger under the knuckle ~1 mm inside the capsule wall (still covered by the palm), sinks to
  // 55% of the radius in the pulp below the palm, and rises again to ~1 mm under the skin at the interphalangeal flexion creases, where
  // the digital neurovascular bundle is most superficial.
  const PALM_Y = 0.742;
  function digitalPts(f, side) {
    const F = FG[f], R0 = F.rs[0], J = [F.ls[0], F.ls[0] + F.ls[1]], JR = [F.rs[1], F.rs[2]], cy = -F.ds[0].y;
    const sBand = (F.B.y - PALM_Y - 0.0015) / cy, sOut = (F.B.y - PALM_Y) / cy;   // axial distances where y = 0.7435 and 0.742
    const S = [-0.8 * R0, -0.6 * R0, -0.4 * R0, -0.2 * R0, sBand, sOut, sOut + 0.002];
    for (let s = 0; s < sBand - 0.001; s += 0.003) S.push(s);
    for (let s = sOut + 0.005; s <= 0.93 * F.len + 1e-9; s += 0.004) S.push(s);
    J.forEach(j => [-0.006, -0.0035, -0.0015, 0, 0.0015, 0.0035, 0.006].forEach(d => S.push(j + d)));
    S.sort((a, b) => a - b);
    return S.filter((s, i) => i === 0 || s - S[i - 1] > 0.0009).map(s => {
      const R = fingerR(F, s);
      let rc;
      if (s < 0) rc = 0.975 * R0 - 0.0011 - 0.43 * -s;                 // along the inside of the base cap
      else if (s <= sBand + 1e-6) rc = 0.975 * R - 0.0011;             // along the inside of the wall, under the palm
      else rc = Math.max(0.55 * R, 0.975 * R - 0.0024 - 0.4 * (s - sOut));
      J.forEach((j, k) => { rc = Math.max(rc, 0.975 * JR[k] - 0.00115 - 0.43 * Math.abs(s - j)); });
      return fingerPt(F, s, side, rc, 90 - 40 * H.smoothstep(sOut, sOut + 0.012, s));
    });
  }
  const digital = (f, side, from) => tube(from.concat(digitalPts(f, side)), 0.0003, 6, 0.002);
  const archPtsH = [[0.236, 0.835, 0.022], [0.238, 0.81, 0.027], [0.245, 0.795, 0.029], [0.258, 0.797, 0.028], [0.263, 0.803, 0.027]];
  const webs = [[0, 1, [0.2605, 0.799, 0.028]], [1, 2, [0.251, 0.795, 0.029]], [2, 3, [0.238, 0.806, 0.027]]];   // [finger on +X side, finger on -X side, origin on the arch]
  const digGeos = [];
  webs.forEach(([fa, fb, o0]) => {   // common palmar digital artery down the web line between two fingers, splitting above the knuckles
    const wx = (FG[fa].B.x + FG[fb].B.x) / 2, yb = Math.max(FG[fa].B.y + 0.8 * FG[fa].rs[0], FG[fb].B.y + 0.8 * FG[fb].rs[0]) + 0.002, fork = [wx, yb, 0.0165];
    digGeos.push(tube([o0, [wx, 0.778, 0.024], [wx, (0.778 + yb) / 2, 0.019], fork], 0.0008, 6, 0.004), digital(fa, -1, [fork]), digital(fb, 1, [fork]));
  });
  digGeos.push(digital(3, -1, [[0.237, 0.815, 0.026], [0.225, 0.788, 0.022]]),     // ulnar side of the little finger (from the arch)
    digital(0, 1, [[0.263, 0.803, 0.027], [0.279, 0.782, 0.021]]));                 // radial side of the index finger (radialis indicis)
  vessel({ id: 'artery-palmar-arch', name: 'superficial palmar arch and digital arteries', latin: 'Arcus palmaris superficialis; arteriae digitales palmares', kind: 'a', pair: true, region: 'armL', r: 0.0011, radial: 8, pts: archPtsH,
    extra: digGeos, info: info(
      'An arterial arcade in the palm, level with the outstretched thumb\'s web, formed mainly by the ulnar artery and completed by a branch of the radial artery; common palmar digital arteries run from it to the finger webs and divide into proper digital arteries along each finger.',
      'Supplies the palm and the fingers (with the deep palmar arch as a parallel back-up).', 'Arch ~1.5 mm diameter; digital arteries ~1 mm.',
      'Lies just beneath the palmar aponeurosis, so deep palm cuts can bleed briskly from both ends because of the double supply.') });
  vessel({ id: 'vein-axillary', name: 'axillary vein', latin: 'Vena axillaris', kind: 'v', pair: true, region: 'thorax', r: 0.006, radial: 12,
    pts: [[0.17, 1.36, -0.004], [0.152, 1.372, 0.004], [0.132, 1.395, 0.01], [0.105, 1.428, 0.016]], info: info(
      'Formed at the lower border of teres major by the basilic vein joining the brachial veins; it ascends through the axilla on the medial side of the axillary artery and becomes the subclavian vein at the outer border of the first rib.',
      'Drains the whole upper limb and part of the chest wall, receiving the cephalic vein.', '~1–1.5 cm diameter.', 'Lymph nodes cluster along it, so it is carefully dissected during axillary clearance for breast cancer.') });
  vessel({ id: 'vein-cephalic', name: 'cephalic vein', latin: 'Vena cephalica', kind: 'v', pair: true, depth: 0, region: 'armL', r: 0.0021, radial: 8, tags: ['superficial'],
    // [y, angle round the arm (0 = lateral, 90 = front)] 4.5 mm under the skin, then through the deltopectoral groove to the axillary vein
    pts: [[0.86, 15], [0.93, 35], [1.0, 50], [1.075, 58, 0.0056], [1.13, 55, 0.0056], [1.2, 48], [1.26, 58], [1.30, 72], [1.335, 95]].map(([y, a, d]) => armSkin(y, a, d || 0.0045))
      .concat([[0.172, 1.352, 0.026], [0.155, 1.37, 0.03], [0.135, 1.395, 0.028], [0.12, 1.41, 0.02]]), info: info(
      'A superficial vein that starts on the thumb side of the dorsal venous network of the hand, winds round to the front of the forearm, ascends lateral to biceps and runs in the deltopectoral groove before piercing the clavipectoral fascia to join the axillary vein.',
      'Drains superficial tissues of the lateral hand, forearm and arm.', '~3–5 mm diameter.', 'Easily visible at the wrist ("intern\'s vein") and used for cannulas; surgeons use it to insert pacemaker leads.') });
  vessel({ id: 'vein-basilic', name: 'basilic vein', latin: 'Vena basilica', kind: 'v', pair: true, depth: 0, region: 'armL', r: 0.0023, radial: 8, tags: ['superficial'],
    pts: [[0.86, 165], [0.93, 150, 0.0058], [1.0, 140, 0.0058], [1.075, 132, 0.006], [1.13, 140, 0.006], [1.19, 158]].map(([y, a, d]) => armSkin(y, a, d || 0.0047))
      .concat([armPt(false, 0.5, 170, 0.6), armPt(false, 0.3, 176, 0.45), [0.17, 1.36, -0.004]]), info: info(
      'A superficial vein arising from the little-finger side of the dorsal venous network of the hand; it ascends along the medial forearm, receives the median cubital vein in front of the elbow, pierces the deep fascia halfway up the arm and joins the brachial veins to form the axillary vein.',
      'Drains superficial tissues of the medial hand, forearm and arm.', '~4–6 mm diameter.', 'Its large size and deep course make it a common choice for PICC lines and for dialysis fistulas.') });
  vessel({ id: 'vein-median-cubital', name: 'median cubital vein', latin: 'Vena mediana cubiti', kind: 'v', pair: true, depth: 0, region: 'armL', r: 0.002, radial: 8, tags: ['superficial'],
    pts: [[1.072, 60], [1.10, 95], [1.125, 135]].map(([y, a]) => armSkin(y, a, 0.0045)), info: info(
      'A short oblique superficial vein crossing the front of the elbow (cubital fossa) from the cephalic vein upward and medially to the basilic vein, lying on the bicipital aponeurosis that shields the brachial artery beneath.',
      'Links the two main superficial veins of the upper limb.', '~3–4 mm diameter; ~2.5 cm long.', 'The most common site for drawing blood (venepuncture) because it is large, fixed and superficial.') });

  // ------------------------------------------------------------ abdominal branches of the aorta
  const kL = L.organ.kidneyL, kR = L.organ.kidneyR;
  vessel({ id: 'artery-celiac-trunk', name: 'Coeliac trunk', latin: 'Truncus coeliacus', kind: 'a', region: 'abdomen', r: 0.0036, radial: 10, pts: [[0.003, 1.172, -0.026], [0.003, 1.171, -0.013], [0.003, 1.17, -0.007]], info: info(
    'A short, wide artery leaving the front of the aorta just below the aortic hiatus (T12) and dividing almost at once into the left gastric, common hepatic and splenic arteries (the "tripod of Haller").',
    'Supplies the foregut: lower oesophagus, stomach, first half of the duodenum, liver, gallbladder, pancreas and spleen.', '~1–2 cm long, ~7 mm diameter.',
    'In median arcuate ligament syndrome the diaphragm\'s tendinous arch compresses it, causing pain after meals.') });
  const celB = [0.003, 1.17, -0.007];
  vessel({ id: 'artery-left-gastric', name: 'Left gastric artery', latin: 'Arteria gastrica sinistra', kind: 'a', region: 'abdomen', r: taper(0.0017, 0.0011), radial: 8,
    pts: [celB, [0.006, 1.182, -0.008], [0.006, 1.195, -0.003], [0.003, 1.2, 0.006], [-0.002, 1.185, 0.022], [-0.008, 1.165, 0.036]], info: info(
      'The smallest coeliac branch; it climbs to the cardia of the stomach, gives oesophageal branches, then runs down the lesser curvature to join the right gastric artery.',
      'Supplies the lesser curvature of the stomach and the lower oesophagus.', '~3–4 mm diameter.', 'A bleeding gastric ulcer high on the lesser curvature can erode it, causing major haematemesis.') });
  const splPts = []; for (let k = 0; k <= 14; k++) { const t = k / 14; splPts.push([H.lerp(celB[0], 0.097, t), H.lerp(celB[1], 1.157, t) - 0.012 * Math.sin(Math.PI * t) + 0.0035 * Math.sin(t * Math.PI * 7), H.lerp(celB[2], -0.038, t) - 0.012 * Math.sin(Math.PI * t) + 0.003 * Math.cos(t * Math.PI * 6)]); }
  vessel({ id: 'artery-splenic', name: 'Splenic artery', latin: 'Arteria splenica (lienalis)', kind: 'a', region: 'abdomen', side: 'L', r: taper(0.0028, 0.0022), radial: 8, pts: splPts,
    extra: [tube([[0.097, 1.157, -0.038], [0.104, 1.17, -0.041], [0.108, 1.18, -0.044]], 0.0012, 6, 0.004), tube([[0.097, 1.157, -0.038], [0.105, 1.145, -0.042], [0.108, 1.135, -0.046]], 0.0012, 6, 0.004)], info: info(
      'The largest coeliac branch; it runs a markedly tortuous course to the left along the upper border of the pancreas, behind the stomach, and divides into several branches at the hilum of the spleen.',
      'Supplies the spleen, the body and tail of the pancreas, and via short gastric and left gastro-omental branches the fundus and greater curvature of the stomach.', '~5–6 mm diameter; ~10–12 cm long.',
      'Its coiling allows for movement of the stomach and spleen; splenic artery aneurysms are the commonest visceral aneurysms and can rupture in pregnancy.') });
  vessel({ id: 'artery-common-hepatic', name: 'Common hepatic artery', latin: 'Arteria hepatica communis', kind: 'a', region: 'abdomen', r: taper(0.0026, 0.002), radial: 8,
    pts: [celB, [-0.012, 1.166, -0.006], [-0.022, 1.158, 0.0], [-0.03, 1.152, 0.004], [-0.038, 1.148, 0.004], [-0.05, 1.15, -0.001], [-0.066, 1.155, -0.004]],
    extra: [tube([[-0.022, 1.158, 0.0], [-0.025, 1.13, 0.012], [-0.023, 1.11, 0.022]], 0.0014, 6, 0.004), tube([[-0.038, 1.148, 0.004], [-0.033, 1.153, 0.011], [-0.02, 1.16, 0.022]], 0.0013, 6, 0.004)], info: info(
      'Runs to the right from the coeliac trunk along the upper border of the pancreatic head, gives off the gastroduodenal artery and continues as the proper hepatic artery up the free edge of the lesser omentum to the porta hepatis, where it splits into right and left hepatic arteries.',
      'Supplies the liver, gallbladder (cystic artery), stomach (right gastric) and duodenum and pancreatic head (gastroduodenal).', '~5 mm diameter.',
      'Provides only ~25% of the liver\'s blood (the portal vein gives the rest) but about half its oxygen; variant origins (e.g. a replaced right hepatic artery from the SMA) are common and matter in surgery.') });
  const smaMain = [[0.002, 1.146, -0.024], [0.002, 1.138, -0.01], [0.001, 1.124, -0.002], [0.0, 1.11, 0.003], [-0.002, 1.093, 0.01], [-0.008, 1.07, 0.022], [-0.02, 1.04, 0.032], [-0.045, 1.005, 0.035], [-0.078, 0.99, 0.03]];
  vessel({ id: 'artery-superior-mesenteric', name: 'Superior mesenteric artery', latin: 'Arteria mesenterica superior', kind: 'a', region: 'abdomen', r: taper(0.0034, 0.002), radial: 10, pts: smaMain,
    extra: [tube([[-0.004, 1.08, 0.016], [0.03, 1.07, 0.035], [0.06, 1.06, 0.045]], 0.0013, 6, 0.005), tube([[-0.012, 1.058, 0.027], [0.02, 1.03, 0.045], [0.05, 1.01, 0.05]], 0.0013, 6, 0.005),
      tube([[-0.003, 1.087, 0.012], [-0.04, 1.09, 0.02], [-0.08, 1.1, 0.01]], 0.0013, 6, 0.005), tube([[0.0, 1.1, 0.006], [-0.01, 1.11, 0.03], [0.0, 1.125, 0.05]], 0.0012, 6, 0.005)], info: info(
      'Leaves the front of the aorta at L1, about 1 cm below the coeliac trunk, passes behind the neck of the pancreas and over the left renal vein and third part of the duodenum, then runs down in the root of the mesentery towards the right iliac fossa, giving jejunal, ileal and colic branches.',
      'Supplies the midgut: the duodenum beyond the bile duct, jejunum, ileum, caecum, appendix, ascending colon and two-thirds of the transverse colon.', '~6–8 mm diameter; ~20 cm long.',
      'Sudden blockage (usually an embolus) causes acute mesenteric ischaemia with pain out of proportion to the examination findings; the narrow aorto-mesenteric angle can squeeze the duodenum or left renal vein ("nutcracker").') });
  vessel({ id: 'artery-inferior-mesenteric', name: 'Inferior mesenteric artery', latin: 'Arteria mesenterica inferior', kind: 'a', region: 'abdomen', side: 'L', r: taper(0.0022, 0.0014), radial: 8,
    pts: [[0.003, 1.084, -0.013], [0.008, 1.078, -0.003], [0.02, 1.06, 0.001], [0.025, 1.02, -0.006], [0.02, 0.985, -0.026], [0.01, 0.962, -0.042]],
    extra: [tube([[0.012, 1.07, -0.002], [0.05, 1.08, 0.0], [0.09, 1.1, -0.012]], 0.0012, 6, 0.005), tube([[0.022, 1.045, -0.001], [0.045, 1.02, 0.008], [0.062, 0.99, 0.012]], 0.0011, 6, 0.005)], info: info(
      'Arises from the front-left of the aorta at L3, about 4 cm above the bifurcation, and runs down and to the left behind the peritoneum, giving the left colic and sigmoid arteries and ending as the superior rectal artery in the pelvis.',
      'Supplies the hindgut: the distal third of the transverse colon, descending and sigmoid colon and upper rectum.', '~4 mm diameter.',
      'Often sacrificed during abdominal aortic aneurysm repair because the marginal artery along the colon keeps the gut alive; the splenic flexure is a watershed prone to ischaemic colitis.') });
  const renInfo = (left) => info(
    `Leaves the side of the aorta at L1–L2 just below the superior mesenteric artery and runs ${left ? 'to the left, behind the left renal vein,' : 'to the right, behind the inferior vena cava (it is longer than the left),'} dividing near the hilum into segmental arteries.`,
    'Supplies the kidney (plus the adrenal gland and ureter); the kidneys receive ~20% of the cardiac output.', '~5–6 mm diameter; ~4–6 cm long.',
    'About 25–30% of people have an extra (accessory) renal artery; renal artery narrowing is a curable cause of high blood pressure.');
  vessel({ id: 'artery-renal-l', name: 'Left renal artery', latin: 'Arteria renalis sinistra', kind: 'a', side: 'L', region: 'abdomen', r: 0.0027, radial: 10,
    pts: [[0.006, 1.12, -0.026], [0.018, 1.114, -0.034], [0.028, 1.106, -0.043], kL.hilum, [kL.hilum[0] + 0.007, kL.hilum[1], kL.hilum[2] - 0.003]],
    extra: [tube([kL.hilum, [kL.hilum[0] + 0.011, kL.hilum[1] + 0.009, kL.hilum[2] - 0.005]], 0.0014, 6), tube([kL.hilum, [kL.hilum[0] + 0.011, kL.hilum[1] - 0.009, kL.hilum[2] - 0.005]], 0.0014, 6)], info: renInfo(true) });
  vessel({ id: 'artery-renal-r', name: 'Right renal artery', latin: 'Arteria renalis dextra', kind: 'a', side: 'R', region: 'abdomen', r: 0.0027, radial: 10,
    pts: [[-0.006, 1.121, -0.027], [-0.017, 1.113, -0.037], [-0.028, 1.097, -0.045], kR.hilum, [kR.hilum[0] - 0.007, kR.hilum[1], kR.hilum[2] - 0.003]],
    extra: [tube([kR.hilum, [kR.hilum[0] - 0.011, kR.hilum[1] + 0.009, kR.hilum[2] - 0.005]], 0.0014, 6), tube([kR.hilum, [kR.hilum[0] - 0.011, kR.hilum[1] - 0.009, kR.hilum[2] - 0.005]], 0.0014, 6)], info: renInfo(false) });
  vessel({ id: 'vein-renal-l', name: 'Left renal vein', latin: 'Vena renalis sinistra', kind: 'v', side: 'L', region: 'abdomen', r: 0.0045, radial: 10,
    pts: [[kL.hilum[0] + 0.005, kL.hilum[1], kL.hilum[2] + 0.002], [0.03, 1.106, -0.042], [0.018, 1.112, -0.028], [0.007, 1.113, -0.011], [0.0, 1.112, -0.008], [-0.01, 1.112, -0.011], [-0.02, 1.113, -0.019]], info: info(
      'Leaves the left kidney in front of the renal artery and crosses in front of the aorta, just below the origin of the superior mesenteric artery, to enter the inferior vena cava. It receives the left gonadal and left adrenal veins.',
      'Drains the left kidney, adrenal gland and gonad.', '~7.5 cm long (three times the right), ~1 cm diameter.',
      'Compression between the aorta and SMA ("nutcracker syndrome") can cause blood in the urine and, in men, a left-sided varicocele.') });
  vessel({ id: 'vein-renal-r', name: 'Right renal vein', latin: 'Vena renalis dextra', kind: 'v', side: 'R', region: 'abdomen', r: 0.0048, radial: 10,
    pts: [[kR.hilum[0] - 0.005, kR.hilum[1], kR.hilum[2] + 0.002], [-0.032, 1.09, -0.04], [-0.026, 1.094, -0.028]], info: info(
      'A short, wide vein running from the right renal hilum directly into the side of the inferior vena cava.',
      'Drains the right kidney.', '~2.5 cm long, ~1 cm diameter.', 'Its shortness is why surgeons prefer the left kidney for living-donor transplantation.') });
  // gonadal vessels follow the sex of the model
  const gonTail = male ? [[0.058, 0.965, -0.004], [0.066, 0.93, 0.045], [0.045, 0.905, 0.07], [0.028, 0.89, 0.078], [0.022, 0.86, 0.068], [0.02, 0.83, 0.055]]
    : [[0.052, 0.99, -0.02], [0.05, 0.978, -0.01], [L.organ.ovaryL.center[0] + 0.004, L.organ.ovaryL.center[1] + 0.004, L.organ.ovaryL.center[2]]];
  const gonA = [[0.008, 1.105, -0.016], [0.025, 1.08, -0.02], [0.04, 1.04, -0.024], [0.05, 1.0, -0.022]].concat(gonTail);
  vessel({ id: 'artery-gonadal', name: male ? 'testicular artery' : 'ovarian artery', latin: male ? 'Arteria testicularis' : 'Arteria ovarica', kind: 'a', pair: true, region: 'body', r: 0.0011, radial: 6, pts: gonA, info: info(
    male ? 'A long, slender artery arising from the aorta just below the renal arteries; it descends on psoas behind the peritoneum, crosses the ureter, and passes through the inguinal canal in the spermatic cord to the testis.'
      : 'A long, slender artery arising from the aorta just below the renal arteries; it descends on psoas, crosses the pelvic brim and runs in the suspensory ligament of the ovary to reach the ovary and uterine tube.',
    male ? 'Supplies the testis and epididymis.' : 'Supplies the ovary and the lateral part of the uterine tube, anastomosing with the uterine artery.', '~1–2 mm diameter; very long (up to ~30 cm in men).',
    'The gonads develop high in the abdomen next to the kidneys and descend, dragging their arteries with them — hence the high origin from the aorta.') });
  const gonV = gonA.map((p, i) => [p[0] + 0.005, p[1], p[2] - 0.002]);
  const gvInfo = (left) => info(`Ascends beside the gonadal artery on psoas${male ? ', formed from the pampiniform plexus of the spermatic cord,' : ''} and drains ${left ? 'into the left renal vein at a right angle' : 'obliquely into the front of the inferior vena cava just below the right renal vein'}.`,
    `Drains the ${male ? 'testis' : 'ovary'}.`, '~3–4 mm diameter.', left ? 'Its right-angled entry into the left renal vein is one reason varicoceles are far more common on the left.' : 'Its oblique entry into the IVC makes right-sided varicoceles uncommon; a new one warrants a search for a mass.');
  vessel({ id: 'vein-gonadal-l', name: male ? 'Left testicular vein' : 'Left ovarian vein', latin: male ? 'Vena testicularis sinistra' : 'Vena ovarica sinistra', kind: 'v', side: 'L', region: 'body', r: 0.0015, radial: 6,
    pts: gonV.slice(1).reverse().concat([[0.029, 1.1, -0.036], [0.03, 1.106, -0.042]]).reverse(), info: gvInfo(true) });
  vessel({ id: 'vein-gonadal-r', name: male ? 'Right testicular vein' : 'Right ovarian vein', latin: male ? 'Vena testicularis dextra' : 'Vena ovarica dextra', kind: 'v', side: 'R', region: 'body', r: 0.0015, radial: 6,
    pts: [[-0.02, 1.1, -0.014]].concat(mirrorPts(gonV.slice(1))), info: gvInfo(false) });

  // ------------------------------------------------------------ portal system and hepatic veins
  const pConf = [-0.01, 1.106, 0.006];
  vessel({ id: 'vein-portal', name: 'Hepatic portal vein', latin: 'Vena portae hepatis', kind: 'v', region: 'abdomen', r: 0.0065, radial: 12, tags: ['portal'],
    pts: [pConf, [-0.02, 1.122, 0.006], [-0.032, 1.136, 0.004], [-0.042, 1.146, 0.0], [-0.058, 1.152, -0.006], [-0.076, 1.158, -0.008]],
    extra: [tube([[-0.042, 1.146, 0.0], [-0.035, 1.152, 0.008], [-0.015, 1.16, 0.02], [0.01, 1.168, 0.03]], taper(0.005, 0.003), 10, 0.005)], info: info(
      'Formed behind the neck of the pancreas by the union of the superior mesenteric and splenic veins; it runs up behind the first part of the duodenum and in the free edge of the lesser omentum (behind the bile duct and hepatic artery) to the porta hepatis, where it divides into right and left branches.',
      'Carries nutrient-rich blood from the stomach, intestines, pancreas and spleen to the liver for processing before it reaches the general circulation.', '~8 cm long, ~1.2–1.5 cm diameter.',
      'Supplies ~75% of the liver\'s blood; in cirrhosis high portal pressure opens collaterals such as oesophageal varices, which can bleed torrentially.') });
  vessel({ id: 'vein-splenic', name: 'Splenic vein', latin: 'Vena splenica (lienalis)', kind: 'v', side: 'L', region: 'abdomen', r: 0.0042, radial: 10, tags: ['portal'],
    pts: [[0.097, 1.152, -0.043], [0.08, 1.145, -0.037], [0.06, 1.135, -0.031], [0.04, 1.122, -0.028], [0.02, 1.114, -0.016], [0.005, 1.109, 0.004], pConf], info: info(
      'Leaves the hilum of the spleen and runs to the right in a groove on the back of the body of the pancreas, below the splenic artery, to join the superior mesenteric vein behind the pancreatic neck. It receives the inferior mesenteric vein.',
      'Drains the spleen, pancreas and part of the stomach into the portal system.', '~1 cm diameter.', 'Pancreatitis or pancreatic cancer can cause it to clot, producing isolated gastric varices.') });
  vessel({ id: 'vein-superior-mesenteric', name: 'Superior mesenteric vein', latin: 'Vena mesenterica superior', kind: 'v', region: 'abdomen', r: 0.0045, radial: 10, tags: ['portal'],
    pts: [[-0.075, 0.992, 0.036], [-0.045, 1.01, 0.038], [-0.024, 1.04, 0.036], [-0.018, 1.07, 0.026], [-0.014, 1.09, 0.013], pConf], info: info(
      'Runs up in the root of the mesentery to the right of the superior mesenteric artery, passing in front of the third part of the duodenum and the uncinate process, to end behind the pancreatic neck by joining the splenic vein.',
      'Drains the small intestine, caecum, appendix, ascending and transverse colon into the portal vein.', '~1 cm diameter.', 'On CT a whirlpool of the SMV around the SMA is the sign of midgut volvulus.') });
  vessel({ id: 'vein-hepatic', name: 'Hepatic veins', latin: 'Venae hepaticae', kind: 'v', region: 'abdomen', r: taper(0.002, 0.0055), radial: 10,
    pts: [[-0.105, 1.16, 0.005], [-0.075, 1.18, -0.005], [-0.045, 1.195, -0.013], [-0.026, 1.2, -0.016]],
    extra: [tube([[-0.06, 1.13, 0.045], [-0.045, 1.165, 0.02], [-0.03, 1.19, 0.0], [-0.02, 1.202, -0.012]], taper(0.002, 0.005), 10), tube([[0.03, 1.17, 0.045], [0.01, 1.185, 0.025], [-0.005, 1.197, 0.005], [-0.015, 1.202, -0.01]], taper(0.002, 0.005), 10)], info: info(
      'Three large valveless veins (right, middle and left) running within the liver between its segments and opening into the inferior vena cava just below the diaphragm.',
      'Return all the blood that has passed through the liver (from both the portal vein and hepatic artery) to the inferior vena cava.', '~1–1.5 cm diameter near the IVC.',
      'Their obstruction causes Budd–Chiari syndrome (painful enlarged liver and ascites); the middle hepatic vein marks the plane between the functional right and left halves of the liver.') });

  // ------------------------------------------------------------ pelvis and lower limb (left built, mirrored)
  const ilDiv = [0.047, 0.985, -0.018], ing = [0.078, 0.915, 0.055];
  vessel({ id: 'artery-common-iliac', name: 'common iliac artery', latin: 'Arteria iliaca communis', kind: 'a', pair: true, region: 'pelvis', r: taper(0.0056, 0.005), radial: 12,
    pts: [aoBif, [0.018, 1.025, -0.002], [0.035, 1.0, -0.01], ilDiv], info: info(
      'One of the two terminal branches of the aorta, from its bifurcation at L4 running down and outwards to divide in front of the sacroiliac joint (L5/S1) into the external and internal iliac arteries.',
      'Carries blood to the pelvis and the lower limb.', '~4–5 cm long, ~1 cm diameter.', 'The right common iliac artery crosses in front of the start of the inferior vena cava; iliac narrowing causes buttock and thigh claudication.') });
  vessel({ id: 'artery-internal-iliac', name: 'internal iliac artery', latin: 'Arteria iliaca interna', kind: 'a', pair: true, region: 'pelvis', r: taper(0.0038, 0.003), radial: 10,
    pts: [ilDiv, [0.052, 0.965, -0.035], [0.053, 0.945, -0.048], [0.062, 0.935, -0.058], [0.07, 0.928, -0.07]],
    extra: [tube([[0.053, 0.95, -0.045], [0.05, 0.93, -0.036], [0.045, 0.915, -0.018], [0.035, 0.91, 0.01]], taper(0.0024, 0.0014), 8, 0.005)], info: info(
      'Descends into the pelvis over the pelvic brim and divides at the upper edge of the greater sciatic notch into a posterior division (superior gluteal, iliolumbar and lateral sacral arteries) and an anterior division (to the bladder, rectum, genitals, uterus and buttock).',
      'Supplies the pelvic organs, perineum, buttocks and medial thigh.', '~4 cm long, ~7 mm diameter.', 'Its uterine branch crosses above the ureter ("water under the bridge"), a key landmark during hysterectomy.') });
  vessel({ id: 'artery-external-iliac', name: 'external iliac artery', latin: 'Arteria iliaca externa', kind: 'a', pair: true, region: 'pelvis', r: 0.0049, radial: 12,
    pts: [ilDiv, [0.058, 0.965, 0.0], [0.068, 0.945, 0.025], [0.075, 0.925, 0.045], ing], info: info(
      'Follows the pelvic brim along the medial border of psoas to pass beneath the inguinal ligament at the mid-inguinal point, where it becomes the femoral artery; gives the inferior epigastric and deep circumflex iliac arteries.',
      'Carries blood to the lower limb and the lower anterior abdominal wall.', '~10 cm long, ~8–10 mm diameter.', 'Commonly used for inflow when a kidney transplant is placed in the iliac fossa.') });
  const hiatus = [0.07, 0.59, -0.012], popEnd = [0.091, 0.445, -0.032];
  vessel({ id: 'artery-femoral', name: 'femoral artery', latin: 'Arteria femoralis', kind: 'a', pair: true, region: 'legL', r: taper(0.005, 0.0044), radial: 12,
    pts: [ing, [0.08, 0.86, 0.052], [0.078, 0.8, 0.045], [0.072, 0.72, 0.03], [0.068, 0.64, 0.012], hiatus], info: info(
      'Continues the external iliac artery below the inguinal ligament through the femoral triangle (lateral to the femoral vein), then runs down the front-medial thigh under sartorius in the adductor canal and passes through the adductor hiatus to become the popliteal artery.',
      'The main supply of the lower limb; its large deep branch (profunda femoris) supplies the thigh muscles.', '~1 cm diameter at the groin; ~30 cm long.',
      'The femoral pulse is felt at the mid-inguinal point; it is the classic access route for catheter angiography and interventions.') });
  vessel({ id: 'artery-deep-femoral', name: 'deep femoral artery (profunda femoris)', latin: 'Arteria profunda femoris', kind: 'a', pair: true, region: 'legL', r: taper(0.0036, 0.0024), radial: 10,
    pts: [[0.08, 0.875, 0.053], [0.078, 0.85, 0.035], [0.074, 0.8, 0.018], [0.074, 0.72, 0.002], [0.078, 0.66, -0.012]], info: info(
      'The largest branch of the femoral artery, arising ~4 cm below the inguinal ligament and running deep, close to the femur between the adductor muscles, giving the medial and lateral circumflex femoral arteries and four perforating arteries.',
      'Supplies the muscles of the thigh and the head and neck of the femur (via the circumflex arteries).', '~6–7 mm diameter.', 'Damage to the medial circumflex femoral artery in a femoral neck fracture can cause avascular necrosis of the femoral head.') });
  vessel({ id: 'artery-popliteal', name: 'popliteal artery', latin: 'Arteria poplitea', kind: 'a', pair: true, region: 'legL', r: 0.0042, radial: 10,
    pts: [hiatus, [0.08, 0.55, -0.03], [0.088, 0.5, -0.037], [0.09, 0.46, -0.036], popEnd], info: info(
      'Continues the femoral artery from the adductor hiatus through the diamond-shaped popliteal fossa behind the knee, lying deepest of the neurovascular structures, and divides at the lower border of popliteus into the anterior and posterior tibial arteries.',
      'Supplies the knee joint (genicular arteries) and the calf muscles, and carries all blood to the leg and foot.', '~6–7 mm diameter; ~15–20 cm long.',
      'The popliteal pulse is hard to feel because the artery is deep; popliteal aneurysm is the commonest peripheral aneurysm, and knee dislocation can tear the artery.') });
  const atEnd = [0.093, 0.095, 0.014];
  vessel({ id: 'artery-anterior-tibial', name: 'anterior tibial artery', latin: 'Arteria tibialis anterior', kind: 'a', pair: true, region: 'legL', r: taper(0.0026, 0.002), radial: 8,
    pts: [popEnd, [0.1, 0.435, -0.018], [0.104, 0.42, 0.0], [0.104, 0.35, 0.006], [0.1, 0.25, 0.008], [0.096, 0.15, 0.012], atEnd], info: info(
      'Passes forward above the interosseous membrane into the front compartment of the leg and descends on the membrane between tibialis anterior and the long toe extensors, becoming the dorsalis pedis artery in front of the ankle.',
      'Supplies the anterior (extensor) compartment of the leg and the front of the ankle.', '~4 mm diameter.', 'Swelling in the tight anterior compartment (anterior compartment syndrome) can compress it and its nerve.') });
  vessel({ id: 'artery-dorsalis-pedis', name: 'dorsalis pedis artery', latin: 'Arteria dorsalis pedis', kind: 'a', pair: true, region: 'legL', r: 0.0017, radial: 8,
    pts: [atEnd, [0.092, 0.07, 0.03], [0.089, 0.056, 0.06], [0.086, 0.044, 0.09], [0.084, 0.034, 0.112]], info: info(
      'Continues the anterior tibial artery on the dorsum of the foot, lateral to the extensor hallucis longus tendon, to the first intermetatarsal space, where it dives into the sole to complete the deep plantar arch.',
      'Supplies the top of the foot and toes (arcuate and dorsal metatarsal arteries).', '~2–3 mm diameter.', 'Its pulse, felt just lateral to the big-toe extensor tendon, is checked in diabetic and vascular foot examinations; it is congenitally absent in ~5–10% of people.') });
  const ptEnd = [0.08, 0.035, 0.005];
  vessel({ id: 'artery-posterior-tibial', name: 'posterior tibial artery', latin: 'Arteria tibialis posterior', kind: 'a', pair: true, region: 'legL', r: taper(0.0028, 0.0021), radial: 8,
    pts: [popEnd, [0.086, 0.4, -0.032], [0.082, 0.3, -0.028], [0.078, 0.2, -0.026], [0.074, 0.12, -0.026], [0.072, 0.085, -0.024], [0.074, 0.055, -0.01], ptEnd],
    extra: [tube([[0.086, 0.41, -0.032], [0.1, 0.33, -0.03], [0.108, 0.2, -0.026], [0.11, 0.1, -0.024]], taper(0.0018, 0.0013), 6)], info: info(
      'The larger terminal branch of the popliteal artery; it descends in the deep posterior compartment of the calf and curves behind the medial malleolus (with tibialis posterior and the long flexor tendons and the tibial nerve) to divide under the flexor retinaculum into the medial and lateral plantar arteries. Shown with its fibular (peroneal) branch.',
      'Supplies the calf muscles, the fibula (via the fibular artery) and the sole of the foot.', '~4 mm diameter.', 'Its pulse is felt midway between the medial malleolus and the heel; weak foot pulses are an early sign of peripheral arterial disease.') });
  vessel({ id: 'artery-plantar', name: 'plantar arteries', latin: 'Arteriae plantares medialis et lateralis; arcus plantaris profundus', kind: 'a', pair: true, region: 'legL', r: 0.0014, radial: 6,
    pts: [ptEnd, [0.078, 0.022, 0.04], [0.08, 0.018, 0.08], [0.083, 0.016, 0.12]],
    extra: [tube([ptEnd, [0.095, 0.02, 0.03], [0.108, 0.018, 0.07], [0.1, 0.02, 0.1], [0.085, 0.022, 0.112]], taper(0.0017, 0.0012), 6, 0.005)], info: info(
      'The terminal branches of the posterior tibial artery: the small medial plantar artery runs along the inner sole towards the big toe; the larger lateral plantar artery crosses the sole and curves medially as the deep plantar arch, which joins the dorsalis pedis.',
      'Supply the muscles, skin and toes of the sole via plantar metatarsal and digital arteries.', 'Lateral plantar ~2 mm, medial ~1.5 mm diameter.', 'The plantar arch lies deep between muscle layers, well protected from weight-bearing pressure.') });
  // deep veins
  vessel({ id: 'vein-popliteal', name: 'popliteal vein', latin: 'Vena poplitea', kind: 'v', pair: true, region: 'legL', r: 0.005, radial: 10,
    pts: [[0.093, 0.44, -0.038], [0.092, 0.5, -0.043], [0.083, 0.55, -0.036], [0.074, 0.59, -0.019]], info: info(
      'Formed at the lower border of popliteus by the venae comitantes of the tibial arteries; it ascends through the popliteal fossa between the popliteal artery and the tibial nerve, receives the small saphenous vein and becomes the femoral vein at the adductor hiatus.',
      'Drains the leg, knee and foot.', '~7–10 mm diameter.', 'A common site of deep vein thrombosis, checked by compression ultrasound behind the knee.') });
  vessel({ id: 'vein-femoral', name: 'femoral vein', latin: 'Vena femoralis', kind: 'v', pair: true, region: 'legL', r: 0.0058, radial: 12,
    pts: [[0.074, 0.59, -0.019], [0.072, 0.64, -0.002], [0.068, 0.72, 0.017], [0.071, 0.8, 0.034], [0.068, 0.86, 0.045], [0.064, 0.915, 0.05]], info: info(
      'Accompanies the femoral artery from the adductor hiatus, lying behind it in the thigh and medial to it in the femoral triangle, and becomes the external iliac vein under the inguinal ligament. It receives the great saphenous and deep femoral veins.',
      'The main deep vein of the lower limb.', '~1–1.5 cm diameter; has 3–4 valves.', 'Deep vein thrombosis here can break off as a pulmonary embolus; it is used for emergency central access just medial to the femoral pulse.') });
  vessel({ id: 'vein-external-iliac', name: 'external iliac vein', latin: 'Vena iliaca externa', kind: 'v', pair: true, region: 'pelvis', r: 0.006, radial: 12,
    pts: [[0.064, 0.915, 0.05], [0.062, 0.93, 0.035], [0.055, 0.95, 0.015], [0.048, 0.97, -0.008], [0.044, 0.982, -0.024]], info: info(
      'Continues the femoral vein above the inguinal ligament and runs along the pelvic brim, medial and then posterior to the external iliac artery, to join the internal iliac vein in front of the sacroiliac joint.',
      'Drains the lower limb and lower abdominal wall.', '~1.2–1.5 cm diameter.', 'Compression of the left iliac vein by the overlying right common iliac artery (May–Thurner syndrome) predisposes to left-leg DVT.') });
  const civInfo = (left) => info(`Formed in front of the sacroiliac joint by the external and internal iliac veins; ${left ? 'the longer left vein runs obliquely to the right, behind the right common iliac artery,' : 'the short right vein ascends almost vertically'} to unite with its partner at L5, to the right of the aortic bifurcation, as the inferior vena cava.`,
    'Drains the pelvis and lower limb into the inferior vena cava.', left ? '~7 cm long, ~1.5 cm wide.' : '~5 cm long, ~1.5 cm wide.', left ? 'Receives the median sacral vein; compressed against L5 by the right common iliac artery in May–Thurner syndrome.' : 'Lies behind and then lateral to its artery.');
  const iivL = [[0.044, 0.982, -0.024], [0.05, 0.96, -0.042], [0.052, 0.94, -0.054]];
  vessel({ id: 'vein-common-iliac-l', name: 'Left common iliac vein', latin: 'Vena iliaca communis sinistra', kind: 'v', side: 'L', region: 'pelvis', r: 0.0065, radial: 12,
    pts: [[0.044, 0.982, -0.024], [0.03, 1.0, -0.021], [0.012, 1.015, -0.019], [-0.008, 1.022, -0.018], [-0.016, 1.025, -0.018]], extra: [tube(iivL, taper(0.0055, 0.004), 10)], info: civInfo(true) });
  vessel({ id: 'vein-common-iliac-r', name: 'Right common iliac vein', latin: 'Vena iliaca communis dextra', kind: 'v', side: 'R', region: 'pelvis', r: 0.0065, radial: 12,
    pts: [[-0.044, 0.982, -0.024], [-0.035, 1.0, -0.022], [-0.024, 1.015, -0.02], [-0.018, 1.025, -0.018]], extra: [tube(mirrorPts(iivL), taper(0.0055, 0.004), 10)], info: civInfo(false) });
  // superficial veins (depth 0 = just under the skin)
  vessel({ id: 'vein-great-saphenous', name: 'great saphenous vein', latin: 'Vena saphena magna', kind: 'v', pair: true, depth: 0, region: 'legL', r: 0.0021, radial: 8, tags: ['superficial'],
    // [y, angle round the leg (0 = lateral, 90 = front, 180 = medial)] laid 4.5 mm under the skin: in front of the medial malleolus, up the medial
    // leg, a hand's breadth behind the patella, up the medial thigh curving forward to the saphenous opening
    pts: [[0.078, 0.04, 0.08], [0.074, 0.06, 0.035]].concat([[0.095, 150, 0.0056], [0.13, 160], [0.18, 168], [0.24, 172], [0.30, 176], [0.36, 184], [0.42, 192], [0.48, 200], [0.54, 198],
      [0.60, 190], [0.66, 180], [0.72, 170], [0.78, 155], [0.835, 135]].map(([y, a, d]) => legSkin(y, a, d || 0.0045)), [[0.062, 0.895, 0.075], [0.064, 0.908, 0.056]]), info: info(
      'The longest vein in the body. It starts at the medial end of the dorsal venous arch of the foot, passes in front of the medial malleolus, climbs the medial side of the leg, passes a hand\'s breadth behind the patella at the knee, and ascends the medial thigh to join the femoral vein at the saphenous opening just below the groin.',
      'Drains the skin and superficial tissues of the foot, leg and thigh into the deep system via perforating veins and the saphenofemoral junction.', '~3–5 mm diameter, ~1 m long; 10–20 valves.',
      'Failure of its valves causes varicose veins; it is the vein most often harvested for coronary artery bypass grafts, and its position in front of the medial malleolus makes it reliable for emergency cut-down.') });
  vessel({ id: 'vein-small-saphenous', name: 'small saphenous vein', latin: 'Vena saphena parva', kind: 'v', pair: true, depth: 0, region: 'legL', r: 0.0018, radial: 8, tags: ['superficial'],
    // behind the lateral malleolus, then up the middle of the calf 4.2 mm under the skin; pierces the deep fascia to reach the popliteal vein
    pts: [[0.118, 0.035, 0.06], [0.12, 0.05, 0.01]].concat([[0.085, 322, 0.0052], [0.11, 305, 0.005], [0.15, 292], [0.20, 282], [0.26, 274], [0.32, 270], [0.38, 270], [0.425, 270]].map(([y, a, d]) => legSkin(y, a, d || 0.0042)),
      [[0.091, 0.458, -0.041], [0.092, 0.478, -0.04]]), info: info(
      'Begins at the lateral end of the dorsal venous arch, passes behind the lateral malleolus with the sural nerve, ascends the middle of the back of the calf and pierces the deep fascia to drain into the popliteal vein behind the knee.',
      'Drains the lateral foot and the back of the leg.', '~2–4 mm diameter.', 'Its close companion, the sural nerve, can be injured when it is stripped for varicose veins.') });

  // @@MORE
  return g;
});
