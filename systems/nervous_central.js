/* systems/nervous_central.js - Central nervous system: cerebral hemispheres split into lobes (one sculpted surface per side),
   white matter, corpus callosum, diencephalon, basal ganglia, limbic structures, ventricles, cerebellum, brainstem, spinal cord,
   cauda equina, filum terminale, meninges (cranial + spinal dura, arachnoid, falx, tentorium), dorsal root ganglia (representative)
   and the twelve cranial-nerve root stubs at the brain surface. Peel order (layer ORGAN = 8): dura 8.0 > arachnoid 8.1 >
   cortex 8.2 > white matter 8.45 / corpus callosum 8.5 > brainstem 8.6 > deep nuclei 8.7 > ventricles 8.9. */
ANATOMY.register('nervous_central', {
  name: 'Central nervous system',
  description: 'Brain (lobes, deep nuclei, ventricles, cerebellum, brainstem), meninges, spinal cord, cauda equina and cranial-nerve roots'
}, function (THREE, H, L, ctx) {
  const g = H.group('nervous_central');
  const SYS = 'nervous', ORG = H.LAYER.ORGAN, V3 = THREE.Vector3, ss = H.smoothstep;
  const gBrain = H.group('cerebrum'), gDeep = H.group('deep-brain'), gVent = H.group('ventricles'), gCb = H.group('cerebellum-brainstem'),
    gMen = H.group('meninges'), gSpine = H.group('spinal-cord-group'), gCN = H.group('cranial-nerve-roots');
  g.add(gMen, gBrain, gDeep, gVent, gCb, gSpine, gCN);

  // ================================================================ private helpers
  function add(into, spec) { const m = H.part(Object.assign({ system: SYS, layer: ORG, side: 'M', region: 'head' }, spec)); into.add(m); return m; }
  // H.pair recomputes normals on the mirrored copy, which shows seams on pieces cut from one surface: copy the left normals instead
  function addPair(into, spec, keepNormals) {
    const ms = H.pair(Object.assign({ system: SYS, layer: ORG, region: 'head' }, spec));
    if (keepNormals) { const a = ms[0].geometry.attributes.normal.array, b = ms[1].geometry.attributes.normal.array; for (let i = 0; i < a.length; i += 3) { b[i] = -a[i]; b[i + 1] = a[i + 1]; b[i + 2] = a[i + 2]; } }
    ms.forEach(m => into.add(m)); return ms;
  }
  function smin(a, b, k) { const h = H.clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
  const smax = (a, b, k) => -smin(-a, -b, k);
  // make the winding outward (positive signed volume) and compute normals
  function orient(gg) {
    const p = gg.attributes.position, ix = gg.index.array, a = new V3(), b = new V3(), c = new V3(); let vol = 0;
    for (let k = 0; k < ix.length; k += 3) { a.fromBufferAttribute(p, ix[k]); b.fromBufferAttribute(p, ix[k + 1]); c.fromBufferAttribute(p, ix[k + 2]); vol += a.dot(b.cross(c)); }
    if (vol < 0) for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    gg.computeVertexNormals(); return gg;
  }
  // closed sphere-topology grid: u wraps (nu columns), v=0 and v=1 are single pole vertices (no seams). fn(u01, v01, iu, iv) -> [x,y,z]
  function surf(nu, nv, fn, sym) {
    const pos = [], idx = [];
    const p0 = fn(0, 0, 0, 0); pos.push(p0[0], p0[1], p0[2]);
    for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) { const p = fn(i / nu, j / nv, i, j); pos.push(p[0], p[1], p[2]); }
    const p1 = fn(0, 1, 0, nv); pos.push(p1[0], p1[1], p1[2]);
    const last = pos.length / 3 - 1, R = (j, i) => 1 + (j - 1) * nu + (i % nu);
    for (let i = 0; i < nu; i++) idx.push(0, R(1, i + 1), R(1, i));
    for (let j = 1; j < nv - 1; j++) for (let i = 0; i < nu; i++) {
      const a = R(j, i), b = R(j, i + 1), c = R(j + 1, i), d = R(j + 1, i + 1);
      if (sym && j >= nv / 2) idx.push(a, b, d, a, d, c); else idx.push(a, b, c, b, d, c);   // sym: mirror-symmetric triangulation about v = 0.5
    }
    for (let i = 0; i < nu; i++) idx.push(last, R(nv - 1, i), R(nv - 1, i + 1));
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx);
    return orient(gg);
  }
  // split one indexed surface into several geometries by a per-triangle label, sharing positions AND normals (no seams)
  function split(gg, triLabel) {
    const P = gg.attributes.position.array, N = gg.attributes.normal.array, ix = gg.index.array, buckets = {}, out = {};
    for (let k = 0; k < ix.length / 3; k++) { const l = triLabel(ix[3 * k], ix[3 * k + 1], ix[3 * k + 2]); (buckets[l] || (buckets[l] = [])).push(k); }
    for (const l in buckets) {
      const map = new Map(), pos = [], nor = [], id = [];
      for (const k of buckets[l]) for (let e = 0; e < 3; e++) {
        const v = ix[3 * k + e]; let m = map.get(v);
        if (m === undefined) { m = pos.length / 3; map.set(v, m); pos.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); nor.push(N[3 * v], N[3 * v + 1], N[3 * v + 2]); }
        id.push(m);
      }
      const s = new THREE.BufferGeometry(); s.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); s.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); s.setIndex(id); out[l] = s;
    }
    return out;
  }
  const majority = (lab) => (a, b, c) => (lab[b] === lab[c] ? lab[b] : lab[a]);
  // elliptical sweep along a Catmull-Rom curve: ab(t, P) -> [a (along the reference axis, default X), b (perpendicular)]; shape(theta, t) radial multiplier
  function sweep(points, ab, o = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map(H.v3), false, 'centripetal');
    const n = o.seg || Math.max(6, Math.round(curve.getLength() / (o.step || 0.004))), rad = o.radial || 16, ref = H.v3(o.ref || [1, 0, 0]);
    const pos = [], idx = [], P = new V3(), T = new V3(), S = new V3(), U = new V3();
    for (let i = 0; i <= n; i++) {
      const t = i / n; curve.getPointAt(t, P); curve.getTangentAt(t, T);
      S.copy(ref).addScaledVector(T, -ref.dot(T)); if (S.lengthSq() < 1e-8) S.set(0, 0, 1); S.normalize(); U.crossVectors(T, S).normalize();
      const [a, b] = ab(t, P);
      for (let j = 0; j < rad; j++) { const th = j / rad * Math.PI * 2, m = o.shape ? o.shape(th, t) : 1, ca = a * Math.cos(th) * m, sb = b * Math.sin(th) * m; pos.push(P.x + ca * S.x + sb * U.x, P.y + ca * S.y + sb * U.y, P.z + ca * S.z + sb * U.z); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b = i * rad + (j + 1) % rad, c = a + rad, d = b + rad; idx.push(a, b, c, b, d, c); }
    for (const end of [0, n]) { curve.getPointAt(end / n, P); const ci = pos.length / 3; pos.push(P.x, P.y, P.z); for (let j = 0; j < rad; j++) { const a = end * rad + j, b = end * rad + (j + 1) % rad; if (end) idx.push(ci, a, b); else idx.push(ci, b, a); } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx);
    return orient(gg);
  }
  // distance from (z,y) to a polyline of [z,y] points in the sagittal plane
  function segDist(z, y, pts) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const z0 = pts[i][0], y0 = pts[i][1], dz = pts[i + 1][0] - z0, dy = pts[i + 1][1] - y0;
      const t = H.clamp(((z - z0) * dz + (y - y0) * dy) / (dz * dz + dy * dy), 0, 1); best = Math.min(best, Math.hypot(z - z0 - t * dz, y - y0 - t * dy));
    }
    return best;
  }
  function interp(x, tab) { if (x <= tab[0][0]) return tab[0][1]; for (let i = 0; i < tab.length - 1; i++) if (x <= tab[i + 1][0]) return H.lerp(tab[i][1], tab[i + 1][1], (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0])); return tab[tab.length - 1][1]; }
  const tx = (gg, p) => { gg.translate(p[0], p[1], p[2]); return gg; };
  const tmat = (color, opacity, extra) => H.mat(Object.assign({ color, opacity, roughness: 0.35, depthWrite: false }, extra || {}));

  // ================================================================ shared frame
  const BC = L.head.brain.center, BS = L.head.brain.size;
  const zF = BC[2] + BS[2] / 2, zB = BC[2] - BS[2] / 2 + 0.007;      // frontal pole 0.072, occipital pole -0.089 (kept inside the occiput)
  const zc = (zF + zB) / 2, hz = (zF - zB) / 2;
  const yTop = BC[1] + BS[1] / 2, yMid = BC[1] + 0.002;              // vertex 1.7275
  const halfW = BS[0] / 2 * 0.915, XM = 0.002;                         // 6.4 cm per hemisphere so the dura clears the skull; XM = half the 4 mm fissure
  const petZ = (x) => -0.002 - (Math.abs(x) - 0.018) * 0.9;            // petrous ridge: middle / posterior cranial fossa boundary
  // upper surface of the tentorium cerebelli (tent-shaped: highest along the straight sinus in the midline)
  const tentY = (x, z) => 1.628 + 0.013 * (1 - ss(0, 0.056, Math.abs(x))) * ss(-0.004, -0.04, z) * (1 - 0.35 * ss(-0.06, -0.095, z));
  const archTop = (z) => 1.686 - 0.02 * Math.pow((z + 0.012) / 0.04, 2);   // upper edge of the corpus callosum (sagittal)
  const LF = [[0.031, 1.636], [0.014, 1.645], [-0.012, 1.655], [-0.034, 1.663], [-0.046, 1.673]];   // lateral (Sylvian) fissure, [z, y]
  const CS = [[-0.016, 1.729], [-0.002, 1.702], [0.013, 1.668]];                                      // central sulcus
  const PO = [[-0.066, 1.712], [-0.05, 1.656]], CALC = [[-0.05, 1.655], [-0.07, 1.652], [-0.09, 1.652]];
  const CING = [[0.034, 1.664], [0.03, 1.677], [0.015, 1.693], [-0.012, 1.699], [-0.035, 1.695], [-0.05, 1.686]];
  const TB = [[-0.09, 1.66], [-0.034, 1.663], [-0.012, 1.655], [0.014, 1.645], [0.031, 1.636]];      // temporal lobe upper boundary by z
  // Inner limit of the cranial cavity behind the ears. The scalp over the occiput is a superellipse (exponent 2.2) round the head
  // axis z = L.head.center z: [y, half-width, back z] rows below the widest level (the lowest rows follow the nape), a dome above it.
  // The landmark boxes of the occipital poles and cerebellum reach through that curve at the lower back of the head, so those
  // surfaces are pulled in to lie m metres inside it (a smooth squash toward the head axis, room for scalp + occipital bone).
  const HD = L.head, czH = HD.center[2], yEqH = HD.center[1], htH = L.y.crown - yEqH;
  const OCC = [[1.55, 0.0555, -0.056], [1.565, 0.0553, -0.064], [1.58, 0.0664, -0.0725], [1.595, 0.0698, -0.081], [1.61, 0.0728, -0.0885],
    [1.625, 0.0752, -0.0945], [1.64, 0.0768, -0.0985], [yEqH, HD.sideX, HD.backZ]];
  const OCC_W = OCC.map(r => [r[0], r[1]]), OCC_B = OCC.map(r => [r[0], czH - r[2]]);
  function cranium(x, y, z, m, k) {
    let W, B;
    if (y >= yEqH) { const w = H.clamp((y - yEqH) / htH, 0, 1), f = (e) => Math.pow(Math.max(0, 1 - Math.pow(w, e)), 1 / e); W = HD.sideX * f(2.3); B = (czH - HD.backZ) * f(2.1); }
    else { W = interp(y, OCC_W); B = interp(y, OCC_B); }
    const wi = Math.max(0.01, W - m), bi = Math.max(0.01, B - m), dz = z - czH;
    const q = dz < 0 ? Math.pow(Math.pow(Math.abs(x) / wi, 2.2) + Math.pow(-dz / bi, 2.2), 1 / 2.2) : Math.abs(x) / wi;
    k = k || 0.08; if (q < 1 - k) return [x, z];
    const f = smin(q, 1, k) / q; return [x * f, dz < 0 ? czH + dz * f : z];
  }
  const clampGeo = (gg, m, k) => { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const r = cranium(p.getX(i), p.getY(i), p.getZ(i), m, k); p.setXYZ(i, r[0], p.getY(i), r[1]); } if (gg.index) gg.computeVertexNormals(); return gg; };
  const M_BRAIN = 0.0065, M_DURA = 0.0025;   // cortex >= ~6 mm and dura >= ~2.5 mm inside the scalp surface

  // one hemisphere (LEFT, x > 0): s = -1 occipital pole .. +1 frontal pole, a = angle round the coronal section (0 lateral, PI/2 up)
  function hemiBase(s, a) {
    const c = Math.cos(a), d = Math.sin(a), rho = Math.sqrt(Math.max(0, 1 - s * s)), fr = s > 0;
    const rm = Math.pow(rho, 0.35), rl = Math.pow(rho, fr ? 0.7 : 1.05), rt = Math.pow(rho, fr ? 0.6 : 0.95), rb = Math.pow(rho, fr ? 0.55 : 0.9);
    const z = zc + hz * s, yc = yMid - 0.016 * ss(-0.2, -1, s);
    const hT = (yTop - yMid) - 0.002 * s, hB = 0.017 + 0.017 * (1 - ss(0.25, 0.5, s));
    const W = halfW - 0.002 + 0.003 * Math.exp(-Math.pow((s + 0.25) / 0.35, 2)) - 0.006 * ss(0.2, 0.8, s), xmid = (XM + W) / 2;
    let x = c >= 0 ? xmid + (W - xmid) * rl * Math.pow(c, 0.8) : xmid - (xmid - XM) * rm * Math.pow(-c, 0.25);
    let y = d >= 0 ? yc + hT * rt * Math.pow(d, 0.9) : yc - hB * rb * Math.pow(-d, 0.8);
    const wT = ss(-0.75, -0.25, s) * (1 - ss(0.32, 0.47, s)) * ss(-0.5, 0.3, c) * ss(0.35, -0.6, d);   // temporal lobe hangs into the middle fossa
    y -= 0.016 * wT; x += 0.0015 * wT;
    const wM = ss(-0.15, -0.6, c), wZ = ss(0.034, 0.024, z) * ss(-0.058, -0.048, z);                    // medial recess for callosum + diencephalon
    const rec = wM * wZ * (0.011 * ss(0, 0.005, archTop(z) - y) + 0.006 * ss(1.648, 1.632, y)); x += rec;
    const wP = ss(0.004, -0.006, z - petZ(x)) * ss(0.3, -0.2, d);                                         // rests on the tentorium behind the petrous ridge
    y += wP * (smax(y, tentY(x, z) + 0.0025, 0.004) - y);
    const cr = cranium(x, y, z, M_BRAIN);                                                                 // occipital pole stays inside the occiput
    return [cr[0], y, cr[1], rec];
  }

  // insular floor weight of the opened lateral fissure, and the major fissures/sulci as inward offsets (w widens them for the white-matter core)
  const insulaW = (z, y, nx) => Math.exp(-Math.pow(segDist(z, y, LF) / 0.0075, 4)) * ss(0.026, 0.017, z) * ss(-0.03, -0.021, z) * ss(0.3, 0.6, nx);
  function sulci(p, n, ins, w) {
    let off = 0;
    if (n.x > 0.15) off -= ss(0.15, 0.5, n.x) * (0.0045 * Math.exp(-Math.pow(segDist(p.z, p.y, LF) / (0.0028 * w), 2)) + 0.006 * ins);
    if (n.x > -0.4) off -= 0.0035 * Math.exp(-Math.pow(segDist(p.z, p.y, CS) / (0.0017 * w), 2)) * ss(-0.4, -0.1, n.x) * ss(-0.2, 0.2, n.y);
    if (n.x < -0.45) { const m = ss(-0.45, -0.75, n.x), wd = 0.0016 * w; off -= m * 0.003 * (Math.exp(-Math.pow(segDist(p.z, p.y, PO) / wd, 2)) + Math.exp(-Math.pow(segDist(p.z, p.y, CALC) / wd, 2)) + 0.8 * Math.exp(-Math.pow(segDist(p.z, p.y, CING) / wd, 2))); }
    return off;
  }
  let hemiPos = null;   // displaced left-hemisphere vertices, reused to wrap the meninges
  // ================================================================ CEREBRAL HEMISPHERES (lobes cut from one surface per side)
  {
    const NU = 144, NV = 124, recA = [], labs = [];
    const hemi = surf(NU, NV, (u, v) => { const r = hemiBase(Math.cos(v * Math.PI), u * Math.PI * 2); recA.push(r[3]); return r; });
    // surf() calls fn pole0, rings, pole1 in vertex order, so recA is indexed like the vertices
    const P = hemi.attributes.position, N = hemi.attributes.normal, ins = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i);
      ins[i] = insulaW(z, y, nx);
      let l;
      if (ins[i] > 0.5) l = 'insula';
      else if (z < -0.066 + (1.71 - y) * 0.2) l = 'occipital';
      else if (z < 0.031 && y < interp(z, TB) && !(z > 0.012 && y > 1.646)) l = 'temporal';
      else if (z > interp(-y, [[-1.729, -0.016], [-1.702, -0.002], [-1.668, 0.013]])) l = 'frontal';
      else l = 'parietal';
      labs.push(l);
    }
    H.displace(hemi, (p, n, i) => {
      const nz = H.fbm(p.x * 72 + 3.1, p.y * 72 + 1.7, p.z * 72 + 5.3, 2);                  // gyri: plateaus separated by meandering sulci
      return sulci(p, n, ins[i], 1) + 0.003 * (ss(0.0, 0.25, Math.abs(nz)) - 0.62) * (1 - 0.85 * ss(0.002, 0.007, recA[i]));
    });
    hemiPos = hemi.attributes.position.array;
    const lobes = split(hemi, majority(labs));
    const cortex = H.mat({ color: H.COLORS.brain, roughness: 0.78 });
    const LOBES = {
      frontal: ['frontal lobe', 'Lobus frontalis', {
        description: 'The largest lobe, forming the front of each hemisphere from the frontal pole back to the central sulcus and down to the lateral fissure; its flat underside (orbital surface) rests on the roofs of the orbits.',
        function: 'Planning, decisions, working memory, personality and social behaviour (prefrontal cortex), voluntary movement (primary motor cortex in the precentral gyrus) and, usually on the left, speech production (Broca area).',
        size: 'About 7 cm from the frontal pole to the central sulcus; roughly a third of the cortical surface',
        notes: 'Prefrontal damage can change personality while sparing intelligence (Phineas Gage, 1848); a lesion of the left inferior frontal gyrus causes non-fluent (Broca) aphasia.' }],
      parietal: ['parietal lobe', 'Lobus parietalis', {
        description: 'Lies behind the central sulcus and above the lateral fissure, reaching back to the parieto-occipital sulcus under the parietal bone.',
        function: 'Receives touch, pain, temperature and limb position (primary somatosensory cortex in the postcentral gyrus) and builds the spatial map used for reaching, attention and reading.',
        size: 'About 5-6 cm front to back at the vertex',
        notes: 'Right parietal strokes often cause hemispatial neglect: the patient ignores the left side of space, e.g. eats only from the right half of the plate.' }],
      temporal: ['temporal lobe', 'Lobus temporalis', {
        description: 'Lies below the lateral (Sylvian) fissure in the middle cranial fossa; its rounded temporal pole projects forward beneath the frontal lobe, and its medial part hides the hippocampus and amygdala.',
        function: 'Hearing (primary auditory cortex on the transverse temporal gyri), understanding language (Wernicke area, usually left), recognising objects and faces, and laying down new memories.',
        size: 'About 9-10 cm long from the temporal pole back to the occipital lobe',
        notes: 'The commonest source of focal epilepsy (mesial temporal sclerosis); seizures often begin with a rising stomach sensation, deja vu or a strange smell.' }],
      occipital: ['occipital lobe', 'Lobus occipitalis', {
        description: 'The smallest lobe, forming the pointed back of each hemisphere behind the parieto-occipital sulcus and resting on the tentorium above the cerebellum; the calcarine sulcus runs along its medial face.',
        function: 'Vision: the primary visual cortex around the calcarine sulcus receives the optic radiation, and surrounding areas analyse shape, colour and motion.',
        size: 'About 4-5 cm from the occipital pole to the parieto-occipital sulcus',
        notes: 'Each occipital lobe sees the opposite half of the visual field; a posterior cerebral artery stroke causes a homonymous hemianopia, often sparing central (macular) vision.' }],
      insula: ['insula', 'Insula (lobus insularis)', {
        description: 'A hidden lobe of cortex in the depth of the lateral fissure, normally covered by the frontal, parietal and temporal opercula; shown here as the floor of the opened fissure, carrying short and long insular gyri.',
        function: 'Interoception (awareness of heartbeat, breathing and gut sensations), taste, disgust, pain and emotional awareness, and autonomic control.',
        size: 'About 5-6 cm long and 3 cm high; in life buried 1.5-2 cm beneath the opercula',
        notes: 'Branches of the middle cerebral artery run across its surface; damage to the insula has been reported to abolish the urge to smoke.' }]
    };
    for (const k of ['frontal', 'parietal', 'temporal', 'occipital', 'insula']) {
      if (!lobes[k]) continue;
      const [name, latin, info] = LOBES[k];
      addPair(gBrain, { id: k === 'insula' ? 'cerebrum-insula' : 'cerebrum-' + k + '-lobe', name, latin, depth: 0.2, geometry: lobes[k], material: cortex, parent: 'cerebrum', tags: ['brain', 'cortex', 'lobe'], info }, true);
    }
    // cerebral white matter: the same surface without gyri, 3.5 mm inside the cortex
    const wm = surf(64, 48, (u, v) => hemiBase(Math.cos(v * Math.PI), u * Math.PI * 2));
    H.displace(wm, (p, n) => -0.0036 + 1.1 * sulci(p, n, insulaW(p.z, p.y, n.x), 2.2));   // follows the fissures so it never shows through them
    addPair(gBrain, { id: 'cerebral-white-matter', name: 'cerebral white matter', latin: 'Substantia alba cerebri', depth: 0.45, geometry: wm, color: H.COLORS.whiteMatter, parent: 'cerebrum', tags: ['brain', 'white matter'],
      info: { description: 'The core of each hemisphere beneath the 2-4 mm grey cortex: bundles of myelinated axons (corona radiata, internal capsule, association and commissural fibres) whose fatty myelin makes it pale.',
        function: 'Wires cortical areas to each other, to the other hemisphere and to the thalamus, brainstem and spinal cord.',
        size: 'About 40% of brain volume; roughly 150,000-180,000 km of myelinated fibres in a young adult',
        notes: 'Multiple sclerosis strips myelin from white-matter tracts; MRI shows the plaques as bright spots around the ventricles.' } }, true);
  }

  // ================================================================ CORPUS CALLOSUM, FORNIX
  {
    const cc = sweep([[0, 1.655, 0.009], [0, 1.66, 0.019], [0, 1.668, 0.0245], [0, 1.676, 0.019], [0, 1.681, 0.006], [0, 1.6825, -0.012], [0, 1.680, -0.03], [0, 1.675, -0.043], [0, 1.668, -0.049]],
      (t) => [interp(t, [[0, 0.005], [0.2, 0.010], [0.5, 0.012], [1, 0.012]]), interp(t, [[0, 0.0014], [0.18, 0.0042], [0.3, 0.0028], [0.75, 0.0026], [0.92, 0.0048], [1, 0.0035]])],
      { step: 0.0025, radial: 20, shape: (th) => 1 - 0.12 * Math.pow(Math.abs(Math.cos(th)), 6) });
    add(gDeep, { id: 'corpus-callosum', name: 'Corpus callosum', latin: 'Corpus callosum', depth: 0.5, geometry: cc, color: H.COLORS.whiteMatter, tags: ['brain', 'white matter', 'commissure'],
      info: { description: 'The great arched bridge of white matter at the bottom of the longitudinal fissure, joining the two hemispheres. From front to back: rostrum, genu, body and the thick splenium; it forms the roof of the lateral ventricles.',
        function: 'Carries about 200 million axons between matching areas of the left and right cortex so the hemispheres share information.',
        size: 'About 7-8 cm long; 0.5-1 cm thick (thickest at the splenium)',
        notes: 'Cutting it (callosotomy) for intractable epilepsy produces "split-brain" patients who cannot name an object felt with the left hand alone.' } });
    const fx = [0.018, 1.651, -0.041], fxPts = [fx, [0.009, 1.664, -0.035], [0.0035, 1.6715, -0.02], [0.003, 1.671, -0.004], [0.003, 1.664, 0.004], [0.0035, 1.65, 0.003], [0.0035, 1.638, -0.013]];
    const fxL = H.tube(fxPts, (t) => 0.0017 - 0.0006 * t, { radial: 10, step: 0.003 });
    add(gDeep, { id: 'fornix', name: 'Fornix', latin: 'Fornix', depth: 0.55, geometry: H.merge([fxL, H.mirrorX(fxL)]), color: '#e9dccd', tags: ['brain', 'limbic', 'white matter'],
      info: { description: 'A paired arch of white matter that leaves the tail of each hippocampus, runs forward under the corpus callosum and plunges down as the columns of the fornix into the hypothalamus to end in the mammillary bodies.',
        function: 'The main output pathway of the hippocampus, part of the Papez memory circuit.', size: 'About 3.5 cm long; 3-4 mm thick',
        notes: 'Damage to both fornices (e.g. during removal of a colloid cyst of the third ventricle) can cause lasting amnesia for new events.' } });
  }

  // ================================================================ DIENCEPHALON: THALAMUS, HYPOTHALAMUS
  const TH = L.head.thalamusL, HY = L.head.hypothalamus;
  {
    const th = H.blob(1, { ws: 32, hs: 22, deform: (p) => {
      const back = ss(0.1, -1, p.z), fr = ss(0.3, 1, p.z);
      const x = p.x >= 0 ? 0.0085 * p.x : -0.0085 * Math.pow(-p.x, 0.45);           // flat medial face = wall of the third ventricle
      return new V3(x * (1 + 0.15 * back - 0.25 * fr), 0.0095 * p.y * (1 + 0.12 * back - 0.3 * fr), 0.016 * p.z);
    } });
    const lgb = H.blob([0.0032, 0.0025, 0.0035], { ws: 12, hs: 8 }); tx(lgb, [0.0085, -0.0085, -0.012]);
    const thal = tx(H.merge([th, lgb]), TH);
    addPair(gDeep, { id: 'thalamus', name: 'thalamus', latin: 'Thalamus', depth: 0.7, geometry: thal, color: '#c79a8a', tags: ['brain', 'diencephalon', 'deep nuclei'],
      info: { description: 'An egg-shaped mass of grey matter on each side of the third ventricle, with a swollen back end (pulvinar) and the lateral and medial geniculate bodies beneath it.',
        function: 'The relay and gatekeeper for almost all sensory information (except smell) and for motor loops on the way to the cortex; also important for arousal and attention.',
        size: 'About 3 cm long, 1.5-2 cm wide and 2 cm high', notes: 'A small thalamic stroke can cause loss of all sensation on the opposite side of the body, sometimes followed by severe burning pain (Dejerine-Roussy syndrome).' } });
    const hyB = H.blob([0.0065, 0.005, 0.0095], { ws: 24, hs: 16, deform: (p) => 1 - 0.3 * ss(0.2, 1, p.y) });
    const mam = [1, -1].map(sx => tx(H.blob(0.0026, { ws: 12, hs: 8 }), [sx * 0.0032, -0.0045, -0.0085]));
    const inf = H.tube([[0, -0.003, 0.004], [0, -0.0065, 0.004], [0, -0.0085, 0.004]], (t) => 0.0022 - 0.001 * t, { radial: 10, tubular: 6 });
    add(gDeep, { id: 'hypothalamus', name: 'Hypothalamus', latin: 'Hypothalamus', depth: 0.7, geometry: tx(H.merge([hyB, ...mam, inf]), HY), color: '#c98f86', tags: ['brain', 'diencephalon', 'endocrine'],
      info: { description: 'The floor and lower walls of the third ventricle, below the thalamus and above the optic chiasm; the paired mammillary bodies bulge from its back and the funnel-shaped infundibulum carries the pituitary stalk down to the pituitary gland (built with the glands).',
        function: 'Keeps the internal environment constant: body temperature, hunger, thirst and water balance, sleep-wake rhythm, sexual behaviour and the stress response, largely by controlling the pituitary.',
        size: 'About 4 g - under 1% of the brain; roughly the size of an almond', notes: 'It makes antidiuretic hormone and oxytocin, which travel down axons to the posterior pituitary; damage causes diabetes insipidus (large volumes of dilute urine).' } });
  }

  // ================================================================ BASAL GANGLIA, HIPPOCAMPUS, AMYGDALA
  {
    const cau = H.tube([[0.0155, 1.664, 0.016], [0.0165, 1.671, 0.004], [0.018, 1.675, -0.01], [0.019, 1.675, -0.024], [0.022, 1.670, -0.037], [0.027, 1.66, -0.045], [0.031, 1.648, -0.04], [0.033, 1.642, -0.026], [0.031, 1.64, -0.01]],
      (t) => interp(t, [[0, 0.0055], [0.08, 0.0075], [0.25, 0.005], [0.45, 0.0035], [0.65, 0.0024], [1, 0.0011]]), { radial: 16, step: 0.002 });
    addPair(gDeep, { id: 'caudate-nucleus', name: 'caudate nucleus', latin: 'Nucleus caudatus', depth: 0.7, geometry: cau, color: '#bf9180', tags: ['brain', 'basal ganglia', 'deep nuclei'],
      info: { description: 'A C-shaped nucleus with a large head bulging into the anterior horn of the lateral ventricle, a body arching back along the ventricle wall above the thalamus and a thin tail curving down into the temporal lobe.',
        function: 'Part of the striatum: helps select and start wanted movements and behaviours and suppress unwanted ones, and supports habit and reward learning.',
        size: 'Head about 1.5-2 cm across; about 10 cm long along its curve', notes: 'In Huntington disease the caudate head wastes away so the anterior horns look ballooned on scans, producing chorea and dementia.' } });
    const put = H.blob([0.0055, 0.0105, 0.016], { ws: 28, hs: 20, deform: (p) => (p.x < 0 ? 1 - 0.35 * Math.pow(-p.x, 1.5) : 1) * (1 - 0.12 * ss(0.3, 1, p.z) * ss(0, 1, p.y)) });
    H.transform(put, { rot: [0.15, 0, 0] });
    addPair(gDeep, { id: 'putamen', name: 'putamen', latin: 'Putamen', depth: 0.7, geometry: tx(put, [0.025, 1.657, 0.0]), color: '#bf9180', tags: ['brain', 'basal ganglia', 'deep nuclei'],
      info: { description: 'The outer, lens-shaped part of the lentiform nucleus, lying lateral to the globus pallidus and internal capsule and deep to the insula; strands of grey matter link it to the caudate across the capsule (the "striatum").',
        function: 'Receives motor and sensory cortex input and, with the caudate, shapes the scaling and smoothness of learned movements.',
        size: 'About 3 cm long, 2 cm high and 1 cm wide', notes: 'The lenticulostriate arteries supplying it are the commonest site of hypertensive brain haemorrhage.' } });
    const gp = H.blob(1, { ws: 22, hs: 16, deform: (p) => { const m = ss(0, -1, p.x); return new V3(0.0038 * p.x, 0.0075 * p.y * (1 - 0.45 * m), 0.0105 * p.z * (1 - 0.3 * m)); } });
    addPair(gDeep, { id: 'globus-pallidus', name: 'globus pallidus', latin: 'Globus pallidus', depth: 0.72, geometry: tx(gp, [0.0185, 1.6555, -0.004]), color: '#d9c2b3', tags: ['brain', 'basal ganglia', 'deep nuclei'],
      info: { description: 'The inner, wedge-shaped part of the lentiform nucleus pointing toward the internal capsule; it looks pale because of the many myelinated fibres crossing it.',
        function: 'The main output station of the basal ganglia: its inhibitory signals to the thalamus act as a brake on movement that the striatum releases selectively.',
        size: 'About 2 cm long and 1 cm across at its base', notes: 'Deep brain stimulation of the internal pallidum relieves dystonia and levodopa-induced dyskinesia in Parkinson disease.' } });
    const hip = H.tube([[0.026, 1.6325, 0.002], [0.026, 1.6335, -0.01], [0.024, 1.637, -0.024], [0.021, 1.644, -0.034], [0.017, 1.652, -0.039]],
      (t) => interp(t, [[0, 0.0045], [0.08, 0.0055], [0.3, 0.0045], [0.65, 0.0033], [1, 0.0014]]), { radial: 16, step: 0.0015 });
    H.displace(hip, (p) => 0.0007 * Math.sin(p.z * 1100) * ss(-0.014, -0.004, p.z));   // digitations of the hippocampal head (pes)
    addPair(gDeep, { id: 'hippocampus', name: 'hippocampus', latin: 'Hippocampus', depth: 0.7, geometry: hip, color: '#cf9f8c', tags: ['brain', 'limbic', 'deep nuclei'],
      info: { description: 'A curved ridge of rolled-in cortex in the floor of the temporal horn of the lateral ventricle, shaped like a seahorse (Greek hippokampos): a knobbly head in front, a body and a tail curving up behind the thalamus into the fornix.',
        function: 'Turns new experiences into long-term memories and maps places (place cells); essential for remembering facts and events.',
        size: 'About 4-4.5 cm long and 1 cm wide', notes: 'One of the first areas to shrink in Alzheimer disease; removal of both hippocampi left patient H.M. unable to form new memories.' } });
    const amy = H.blob([0.0065, 0.0058, 0.0075], { ws: 20, hs: 14, noise: { amp: 0.06, freq: 2.5 } });
    addPair(gDeep, { id: 'amygdala', name: 'amygdala', latin: 'Corpus amygdaloideum', depth: 0.7, geometry: tx(amy, [0.025, 1.635, 0.013]), color: '#b98476', tags: ['brain', 'limbic', 'deep nuclei'],
      info: { description: 'An almond-shaped cluster of nuclei in the front of the medial temporal lobe (the uncus), just in front of the hippocampal head and the tip of the temporal horn.',
        function: 'Detects threat and emotional significance, triggers fear responses and tags memories with emotion.', size: 'About 1.5-2 cm across; roughly 1.2-1.7 cm3',
        notes: 'Rare bilateral amygdala damage (Urbach-Wiethe disease) leaves people unable to feel or recognise fear.' } });
  }

  // ================================================================ VENTRICLES (CSF spaces)
  {
    const vm = tmat(H.COLORS.ventricle, 0.6);
    const lvMain = sweep([[0.0085, 1.667, 0.025], [0.009, 1.672, 0.013], [0.0105, 1.674, -0.003], [0.013, 1.6735, -0.02], [0.019, 1.668, -0.035], [0.025, 1.656, -0.042], [0.030, 1.645, -0.034], [0.032, 1.6395, -0.018], [0.030, 1.638, 0.003]],
      (t) => [interp(t, [[0, 0.004], [0.1, 0.0055], [0.25, 0.0075], [0.4, 0.0075], [0.5, 0.007], [0.6, 0.005], [0.75, 0.0035], [1, 0.0015]]), interp(t, [[0, 0.0035], [0.1, 0.0045], [0.25, 0.003], [0.4, 0.0032], [0.5, 0.0055], [0.6, 0.004], [0.75, 0.0025], [1, 0.0013]])],
      { step: 0.002, radial: 16 });
    const lvPost = sweep([[0.019, 1.668, -0.035], [0.021, 1.665, -0.05], [0.019, 1.661, -0.064]], (t) => [0.006 - 0.005 * t, 0.005 - 0.004 * t], { step: 0.002, radial: 12 });
    addPair(gVent, { id: 'ventricle-lateral', name: 'lateral ventricle', latin: 'Ventriculus lateralis', depth: 0.9, geometry: H.merge([lvMain, lvPost]), material: vm, tags: ['brain', 'ventricle', 'csf'],
      info: { description: 'The C-shaped CSF cavity inside each hemisphere: an anterior (frontal) horn, a body under the corpus callosum, the atrium, a posterior (occipital) horn and an inferior (temporal) horn curving down and forward into the temporal lobe.',
        function: 'Its choroid plexus makes most of the cerebrospinal fluid, which cushions the brain, carries away wastes and buoys the brain so it effectively weighs only ~50 g.',
        size: 'About 7-10 ml each; body 1-1.5 cm wide', notes: 'It drains through the interventricular foramen (of Monro) into the third ventricle; blockage there enlarges it (obstructive hydrocephalus).' } });
    const v3 = H.blob([0.0022, 0.0115, 0.017], { ws: 16, hs: 20, deform: (p) => 1 + 0.25 * ss(0.2, 1, p.z) * ss(0, -1, p.y) + 0.12 * ss(0.3, 1, -p.z) * ss(0.2, 1, p.y) });
    add(gVent, { id: 'ventricle-third', name: 'Third ventricle', latin: 'Ventriculus tertius', depth: 0.9, geometry: tx(v3, [0, 1.6545, -0.012]), material: vm, tags: ['brain', 'ventricle', 'csf'],
      info: { description: 'A narrow vertical slit in the midline between the two thalami, floored by the hypothalamus; small recesses point toward the optic chiasm, the pituitary stalk and the pineal gland.',
        function: 'Passes CSF from the lateral ventricles (via the foramina of Monro) back to the cerebral aqueduct.', size: 'About 2-3 cm long, 2 cm high and only 3-5 mm wide',
        notes: 'Its width on CT is a sensitive sign of hydrocephalus or brain atrophy; a colloid cyst at its roof can block both foramina of Monro suddenly.' } });
    const aq = H.tube([[0, 1.645, -0.024], [0, 1.636, -0.025], [0, 1.627, -0.027], [0, 1.62, -0.03]], 0.001, { radial: 10, step: 0.002 });
    add(gVent, { id: 'cerebral-aqueduct', name: 'Cerebral aqueduct', latin: 'Aqueductus mesencephali (Sylvii)', depth: 0.9, geometry: aq, material: vm, tags: ['brain', 'ventricle', 'csf'],
      info: { description: 'The narrow canal through the midbrain, between the tectum behind and the tegmentum in front, joining the third and fourth ventricles.',
        function: 'The only route for CSF from the forebrain ventricles to the fourth ventricle.', size: 'About 1.5 cm long and only 1-2 mm wide',
        notes: 'Being the narrowest point of the ventricular system, it is the commonest site of congenital obstruction (aqueduct stenosis) causing hydrocephalus in infants.' } });
    const v4 = H.blob(1, { ws: 24, hs: 20, deform: (p) => {
      const ay = Math.abs(p.y), rec = 0.004 * Math.sign(p.x) * Math.exp(-Math.pow((p.y + 0.15) / 0.22, 2)) * Math.pow(Math.abs(p.x), 3);
      return new V3(0.0085 * p.x * (1 - 0.55 * ay) + rec, 1.603 + 0.013 * p.y, -0.031 + (p.z > 0 ? 0.002 * p.z : 0.009 * p.z * (1 - 0.6 * ay)));
    } });
    add(gVent, { id: 'ventricle-fourth', name: 'Fourth ventricle', latin: 'Ventriculus quartus', depth: 0.9, geometry: v4, material: vm, tags: ['brain', 'ventricle', 'csf'],
      info: { description: 'A tent-shaped cavity between the pons and upper medulla in front (its diamond-shaped floor, the rhomboid fossa) and the cerebellum behind (the roof peaks at the fastigium); lateral recesses reach round the brainstem.',
        function: 'Lets CSF escape from the ventricles into the subarachnoid space through the median aperture (Magendie) and two lateral apertures (Luschka).',
        size: 'About 3 cm long and 1.5-2 cm wide at the lateral recesses', notes: 'Its floor holds the facial colliculus, vagal and hypoglossal triangles and the area postrema, the vomiting centre that senses toxins in the blood.' } });
  }

  // ================================================================ CEREBELLUM (one folded surface: hemispheres + vermis)
  const CB = L.head.cerebellum.center, CBS = L.head.cerebellum.size;
  let cbSurface = null;
  {
    const angDist = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
    // poles at the lateral tips (v = 0 left, v = 1 right); u runs round the sagittal outline
    const cb = surf(224, 80, (u, v) => {
      const px = Math.cos(v * Math.PI), rho = Math.sin(v * Math.PI), ph = u * Math.PI * 2, py = rho * Math.sin(ph), pz = rho * Math.cos(ph);
      const x = Math.sign(px) * CBS[0] / 2 * Math.pow(Math.abs(px), 0.85), wMid = Math.exp(-Math.pow(x / 0.013, 2));
      let z = CB[2] + 0.029 * pz;
      z -= 0.017 * wMid * ss(0.0, 0.7, pz);                  // anterior notch: brainstem and fourth ventricle
      z += 0.005 * wMid * ss(0.0, -0.8, pz);                 // posterior notch (falx cerebelli)
      const yTopHere = tentY(x, z) - 0.003;                  // superior surface follows the tentorium
      const y = py >= 0 ? CB[1] + (yTopHere - CB[1]) * Math.pow(py, 0.85) : CB[1] - 0.023 * Math.pow(-py, 0.9) * (1 - 0.3 * wMid);
      const cr = cranium(x, y, z, M_BRAIN);                  // posterior-inferior surface follows the occipital squama
      return [cr[0], y, cr[1]];
    }, true);
    H.displace(cb, (p) => {
      const phi = Math.atan2(p.y - 1.600, p.z + 0.036);
      // folia: onion-like lamellae = level sets of the distance from the cerebellar "hilum" (a transverse segment through the fastigium
      // and peduncles), so they run transversely on top and behind and curve concentrically round the peduncles on the lateral surface
      const hx = Math.max(0, Math.abs(p.x) - 0.018), dh = Math.hypot(hx, p.y - 1.603, p.z + 0.034);
      const f = Math.pow(Math.abs(Math.sin(dh * Math.PI / 0.0034 + 1.6 * H.noise3(p.x * 50, p.y * 50 + 3.3, p.z * 50))), 0.55);
      let off = 0.0011 * (f - 0.6);
      off -= 0.0026 * Math.exp(-Math.pow(angDist(phi, 1.8) / 0.05, 2)) * ss(0.045, 0.03, Math.abs(p.x));   // primary fissure (anterior / posterior lobe)
      off -= 0.0026 * Math.exp(-Math.pow(angDist(phi, 3.03) / 0.045, 2)) * ss(0.004, 0.02, Math.abs(p.x));   // horizontal fissure
      off -= 0.0018 * Math.exp(-Math.pow((Math.abs(p.x) - 0.0095) / 0.0013, 2));  // paravermian sulci
      return off;
    });
    cbSurface = cb;
    const parts = split(cb, (a, b, c) => { const P = cb.attributes.position, cx = (P.getX(a) + P.getX(b) + P.getX(c)) / 3; return cx > 0.0085 ? 'L' : cx < -0.0085 ? 'R' : 'V'; });
    addPair(gCb, { id: 'cerebellum-hemisphere', name: 'cerebellar hemisphere', latin: 'Hemispherium cerebelli', depth: 0.2, geometry: parts.L, color: '#cfa593', tags: ['brain', 'cerebellum'],
      info: { description: 'One of the two large lateral lobes of the cerebellum in the posterior cranial fossa, under the tentorium and behind the brainstem. Its surface is folded into thin parallel leaves (folia) separated by fissures; the horizontal fissure runs round its margin.',
        function: 'Coordinates movement on the SAME side of the body: timing, smoothness, balance and motor learning, comparing intended with actual movement.',
        size: 'Cerebellum about 10 cm wide, 5 cm high and 6 cm deep; ~150 g, 10% of brain weight but over half of all its neurons',
        notes: 'A hemisphere lesion causes ipsilateral clumsiness: overshooting (dysmetria), intention tremor and inability to do rapid alternating movements (dysdiadochokinesia).' } }, true);
    add(gCb, { id: 'cerebellum-vermis', name: 'Cerebellar vermis', latin: 'Vermis cerebelli', depth: 0.2, geometry: parts.V, color: '#c99d8a', tags: ['brain', 'cerebellum'],
      info: { description: 'The narrow, worm-like midline strip joining the two cerebellar hemispheres, raised on top (culmen) under the tentorium and sunk below between the hemispheres (vallecula).',
        function: 'Controls posture, balance, gait and eye movements via the fastigial and vestibular nuclei.', size: 'About 1-2 cm wide and 5 cm long around its curve',
        notes: 'Chronic alcohol damage typically hits the anterior superior vermis, causing a wide-based, staggering gait while arm coordination is relatively spared.' } });
    // arbor vitae: white-matter core with transverse lamellar branches running out into the folia (shows as a "tree" in a midline cut)
    const Oc = [0, 1.601, -0.046], plates = [tx(H.blob([0.022, 0.008, 0.009], { ws: 20, hs: 12 }), Oc)];
    for (const [deg, len] of [[70, 0.022], [95, 0.025], [120, 0.026], [145, 0.027], [170, 0.028], [195, 0.025], [220, 0.02], [245, 0.016]]) {
      const a = deg * Math.PI / 180, M = [0, Oc[1] + Math.sin(a) * len * 0.5, Oc[2] + Math.cos(a) * len * 0.5], E = [0, Oc[1] + Math.sin(a) * len, Oc[2] + Math.cos(a) * len];
      plates.push(sweep([Oc, M, E], (t) => [0.02 * (1 - 0.55 * t), 0.0017 * (1 - 0.6 * t)], { seg: 8, radial: 10 }));
      for (const sd of [-1, 1]) { const b = a + sd * 0.4; plates.push(sweep([M, [0, M[1] + Math.sin(b) * len * 0.45, M[2] + Math.cos(b) * len * 0.45]], (t) => [0.014 * (1 - 0.5 * t), 0.0011 * (1 - 0.5 * t)], { seg: 5, radial: 8 })); }
    }
    plates.forEach(pl => clampGeo(pl, M_BRAIN + 0.003));   // stays under the (squashed) posterior cerebellar cortex
    add(gCb, { id: 'cerebellar-white-matter', name: 'Cerebellar white matter (arbor vitae)', latin: 'Arbor vitae cerebelli', depth: 0.45, geometry: H.merge(plates), color: H.COLORS.whiteMatter, tags: ['brain', 'cerebellum', 'white matter'],
      info: { description: 'The branching white-matter core of the cerebellum: a central body (corpus medullare) sends thin lamellae out into every folium, so a midline cut shows a tree-like pattern, the "tree of life". The deep cerebellar nuclei (dentate, interposed, fastigial) sit inside it.',
        function: 'Carries fibres into the cerebellar cortex (mossy and climbing fibres) and Purkinje-cell output to the deep nuclei, which send the cerebellum\'s signals out through the peduncles.',
        size: 'Core about 3 x 1.5 cm; lamellae under 1 mm thick', notes: 'The dentate nucleus, the largest deep cerebellar nucleus, relays the lateral cerebellum to the thalamus and motor cortex; damage to it or its outflow causes intention tremor.' } });
  }

  // ================================================================ BRAINSTEM
  {
    const bsm = H.mat({ color: '#d9c2ae', roughness: 0.7 });
    const warpNotch = (depth, width, yA, yB) => (f, y, dir) => 1 - depth * Math.exp(-Math.pow(dir[0] / width, 2)) * ss(0.4, 1, dir[1]) * ss(yA, yB, y);
    const mid = H.loft([{ y: 1.6235, rx: 0.0125, rz: 0.0105, cz: -0.0185 }, { y: 1.630, rx: 0.0135, rz: 0.011, cz: -0.0185 }, { y: 1.637, rx: 0.015, rz: 0.0112, cz: -0.018 },
      { y: 1.643, rx: 0.0165, rz: 0.0105, cz: -0.0172 }, { y: 1.6475, rx: 0.0155, rz: 0.008, cz: -0.017 }], { radial: 36, subdiv: 4, warp: warpNotch(0.32, 0.25, 1.624, 1.64) });
    const coll = [[0.0048, 1.638, -0.0285, 0.0035], [0.0045, 1.629, -0.0287, 0.0031]].flatMap(([x, y, z, r]) => [1, -1].map(sx => tx(H.blob([r * 1.1, r * 0.8, r * 0.7], { ws: 14, hs: 10 }), [sx * x, y, z])));
    add(gCb, { id: 'midbrain', name: 'Midbrain', latin: 'Mesencephalon', depth: 0.6, geometry: H.merge([mid, ...coll]), material: bsm, tags: ['brain', 'brainstem'],
      info: { description: 'The top of the brainstem, passing through the notch of the tentorium. In front, two cerebral peduncles diverge upward with the interpeduncular fossa between them; behind, the tectum carries four bumps, the superior and inferior colliculi, and the cerebral aqueduct runs through its centre.',
        function: 'Carries the motor tracts from cortex to spinal cord, controls eye movements and pupil reflexes (oculomotor and trochlear nuclei), orients the eyes and head to sights and sounds, and contains the substantia nigra.',
        size: 'About 2 cm long and 2.5-3 cm wide across the peduncles', notes: 'Parkinson disease results from loss of the dopamine neurons of the substantia nigra; a swollen temporal lobe herniating through the tentorial notch compresses the midbrain.' } });
    const pons = H.loft([{ y: 1.5995, rx: 0.0112, rz: 0.0098, cz: -0.018 }, { y: 1.604, rx: 0.0148, rz: 0.0128, cz: -0.0155 }, { y: 1.612, rx: 0.0165, rz: 0.0145, cz: -0.0138 },
      { y: 1.619, rx: 0.0155, rz: 0.0138, cz: -0.0145 }, { y: 1.6245, rx: 0.0128, rz: 0.011, cz: -0.0182 }],
      { radial: 40, subdiv: 5, warp: (f, y, dir) => (1 - 0.06 * Math.exp(-Math.pow(dir[0] / 0.15, 2)) * ss(0.5, 1, dir[1])) * (1 - 0.14 * ss(0.3, 1, -dir[1])) });
    H.displace(pons, (p, n) => 0.00025 * Math.sin(p.y * 2400) * ss(0.2, 0.8, n.z));      // transverse pontine fibres
    const mcp = [1, -1].map(sx => H.tube([[sx * 0.010, 1.611, -0.019], [sx * 0.019, 1.609, -0.027], [sx * 0.027, 1.606, -0.036]], (t) => 0.0056 + 0.001 * t, { radial: 16, step: 0.003 }));
    add(gCb, { id: 'pons', name: 'Pons', latin: 'Pons', depth: 0.6, geometry: H.merge([pons, ...mcp]), material: bsm, tags: ['brain', 'brainstem'],
      info: { description: 'The bulging middle part of the brainstem, lying on the clivus in front of the cerebellum. Transverse fibres wrap its front and sweep back on each side as the thick middle cerebellar peduncles; the basilar artery runs in the groove down its midline.',
        function: 'Relays signals from the cerebral cortex to the cerebellum, houses the nuclei of cranial nerves V-VIII and helps control breathing rhythm and sleep (REM).',
        size: 'About 2.5 cm long, 3-3.5 cm wide', notes: 'A stroke in the ventral pons can cause locked-in syndrome: complete paralysis with consciousness and vertical eye movements preserved.' } });
    const med = H.loft([{ y: 1.5775, rx: 0.0062, rz: 0.0053, cz: -0.0205 }, { y: 1.584, rx: 0.0078, rz: 0.0066, cz: -0.0195 }, { y: 1.591, rx: 0.0092, rz: 0.0078, cz: -0.0185 },
      { y: 1.5975, rx: 0.0104, rz: 0.0088, cz: -0.018 }, { y: 1.6015, rx: 0.0108, rz: 0.0092, cz: -0.018 }], { radial: 32, subdiv: 4, warp: warpNotch(0.13, 0.12, 1.57, 1.575) });
    const olives = [1, -1].map(sx => tx(H.blob([0.0026, 0.0055, 0.0026], { ws: 14, hs: 10 }), [sx * 0.0072, 1.5905, -0.0128]));
    add(gCb, { id: 'medulla-oblongata', name: 'Medulla oblongata', latin: 'Medulla oblongata', depth: 0.6, geometry: H.merge([med, ...olives]), material: bsm, tags: ['brain', 'brainstem'],
      info: { description: 'The lowest part of the brainstem, tapering from the pons down to the foramen magnum where it becomes the spinal cord. Its front shows the two pyramids either side of the anterior median fissure and the oval olives lateral to them.',
        function: 'Vital centres for breathing, heart rate and blood pressure; reflexes of swallowing, coughing and vomiting; nuclei of cranial nerves IX-XII; and the crossing of the motor pyramids.',
        size: 'About 3 cm long; 1 cm wide below, 2 cm wide at the pons', notes: 'Most motor fibres cross here (decussation of the pyramids), so each side of the brain moves the opposite side of the body; tonsillar herniation compresses the medulla and stops breathing.' } });
  }

  // ================================================================ SPINAL CORD, CAUDA EQUINA, FILUM TERMINALE, SPINAL DURA, DRG
  const FM = L.head.foramenMagnum, CE = L.spinalCordEnd;
  // canal centre line: foramen magnum -> C2 ... L1 (C1's landmark y 1.585 lies above the foramen magnum 1.578, so the cord bends back to the C2 canal instead)
  const canalPts = [[0, FM[1] + 0.0005, FM[2] - 0.0005], [0, 1.5725, -0.027]].concat(L.spineOrder.slice(1, 20).map(n => { const c = L.canal(n); return [0, c.y, c.z]; }));
  const lumbarZ = (y) => interp(y, [[0.93, -0.083], [0.95, -0.081], [0.985, -0.072], [1.017, -0.068], [1.05, -0.068], [1.084, -0.073], [1.117, CE.z], [1.15, -0.086]]);
  {
    const cordW = (y) => interp(y, [[CE.y, 0.0008], [CE.y + 0.007, 0.003], [1.135, 0.0055], [1.16, 0.0062], [1.19, 0.0057], [1.23, 0.005], [1.33, 0.0047], [1.43, 0.005], [1.455, 0.0058], [1.49, 0.0072], [1.52, 0.0068], [1.55, 0.006], [1.58, 0.0062]]);
    const cord = sweep(canalPts.concat([[0, CE.y, CE.z]]), (t, P) => { const a = cordW(P.y); return [a, Math.max(0.0008, a * 0.78)]; },
      { step: 0.004, radial: 20, shape: (th) => 1 - 0.2 * Math.exp(-Math.pow((th - Math.PI / 2) / 0.12, 2)) - 0.08 * Math.exp(-Math.pow((th - 1.5 * Math.PI) / 0.1, 2)) });
    add(gSpine, { id: 'spinal-cord', name: 'Spinal cord', latin: 'Medulla spinalis', depth: 0.3, region: 'body', geometry: cord, color: H.COLORS.spinalCord, tags: ['spinal cord'],
      info: { description: 'The cable of nervous tissue continuing the medulla from the foramen magnum down the vertebral canal to the conus medullaris at the L1/L2 disc. It is thicker in the cervical enlargement (C4-T1, for the arms) and the lumbar enlargement (T11-L1, for the legs), with an anterior median fissure in front.',
        function: 'Carries sensory tracts up and motor tracts down between brain and body, and contains the circuits for spinal reflexes and rhythmic walking patterns; 31 pairs of spinal nerves leave it.',
        size: 'About 42-45 cm long; ~1 cm across (1.3-1.4 cm wide at the cervical enlargement); ~35 g',
        notes: 'Because the cord stops at L1/L2 while the canal continues, lumbar punctures are done at L3/L4 or L4/L5, below the cord, where the needle only meets floating nerve roots.' } });
    const strands = [];
    for (const sx of [1, -1]) for (let k = 0; k < 5; k++) {
      const x0 = sx * (0.0045 + 0.0008 * k), x1 = sx * (0.0014 + 0.0013 * k), dz = (k % 2 ? 0.0016 : -0.0014);
      const pts = [1.14, 1.117, 1.084, 1.05, 1.017, 0.985, 0.95].map((y, i, arr) => { const t = i / (arr.length - 1); return [H.lerp(x0, x1, Math.min(1, t * 1.6)), y - 0.002 * k * (1 - t), lumbarZ(y) + dz]; });
      strands.push(H.tube(pts, 0.00085, { radial: 6, step: 0.006 }));
    }
    add(gSpine, { id: 'cauda-equina', name: 'Cauda equina', latin: 'Cauda equina', depth: 0.3, region: 'body', geometry: H.merge(strands), color: '#eadfb8', tags: ['spinal cord', 'nerve roots'],
      info: { description: 'The "horse\'s tail": the bundle of lumbar, sacral and coccygeal nerve roots (L2-Co1) that stream down the dural sac below the end of the cord to reach their exit foramina.',
        function: 'Carries motor and sensory fibres for the legs, bladder, bowel and genitals.', size: 'About 20 pairs of roots filling the lumbar dural sac from L1/L2 to S2 (~15-20 cm)',
        notes: 'Compression by a large central disc herniation (cauda equina syndrome) causes saddle numbness and bladder retention - a surgical emergency.' } });
    const fil = H.tube([[0, CE.y + 0.002, CE.z], [0, 1.08, lumbarZ(1.08)], [0, 1.03, lumbarZ(1.03)], [0, 0.98, lumbarZ(0.98) - 0.001], [0, 0.945, -0.082], [0, 0.905, -0.085], [0, L.spine.coccyx.top - 0.003, L.spine.coccyx.z - 0.009]], 0.0006, { radial: 6, step: 0.006 });
    add(gSpine, { id: 'filum-terminale', name: 'Filum terminale', latin: 'Filum terminale', depth: 0.3, region: 'body', geometry: fil, color: '#e9e2cf', tags: ['spinal cord'],
      info: { description: 'A thin thread of pia mater running from the tip of the conus medullaris down through the dural sac (internal part) and, wrapped in dura, on to the back of the coccyx (external part).',
        function: 'Anchors the lower end of the spinal cord and steadies it within the vertebral canal.', size: 'About 20 cm long and 1 mm thick',
        notes: 'A short, thick filum (tethered cord) pulls on the conus as a child grows, causing back pain, leg weakness and bladder problems; it is treated by cutting the filum.' } });
    const sac = sweep(canalPts.concat([[0, 1.117, lumbarZ(1.117)], [0, 1.05, lumbarZ(1.05)], [0, 0.985, lumbarZ(0.985)], [0, 0.945, -0.0815]]),
      (t, P) => { const r = interp(P.y, [[0.945, 0.0015], [0.955, 0.006], [0.99, 0.0078], [1.2, 0.0074], [1.45, 0.0085], [1.58, 0.0095]]); return [r, r * 0.92]; }, { step: 0.006, radial: 18 });
    add(gMen, { id: 'spinal-dura-mater', name: 'Spinal dura mater (dural sac)', latin: 'Dura mater spinalis', depth: 0.0, region: 'body', geometry: sac, material: tmat(H.COLORS.meninges, 0.3), tags: ['meninges', 'spinal cord'],
      info: { description: 'The tough tube of dura that continues the cranial dura through the foramen magnum and encloses the spinal cord, CSF and cauda equina, ending as a blind sac at the level of S2; each nerve root takes a sleeve of it into its foramen.',
        function: 'Protects the cord and holds the CSF of the spinal subarachnoid space; the fat-filled epidural space outside it cushions it against the bone.', size: 'About 45-50 cm long; 1.5-2 cm across; ends at S2',
        notes: 'Epidural anaesthesia is injected outside this sac; a spinal anaesthetic or lumbar puncture pierces it (and the arachnoid) below L2 to reach the CSF.' } });
    // representative dorsal root ganglia (cervical, thoracic, lumbar) in the intervertebral foramina, with their dorsal roots
    for (const [vn, region] of [['C6', 'neck'], ['T6', 'thorax'], ['L4', 'abdomen']]) {
      const v = L.spine[vn], c = L.canal(vn), lat = v.w / 2 + 0.004, gy = v.y - v.h / 2 - 0.003, gz = c.z + 0.006;
      const gang = tx(H.blob([0.0024, 0.0034, 0.0024], { ws: 14, hs: 10, deform: (p) => 1 + 0.08 * H.noise3(p.x * 3, p.y * 3, p.z * 3) }), [lat, gy, gz]);
      const root = H.tube([[0.004, gy + 0.004, c.z - 0.001], [lat * 0.6, gy + 0.0015, gz - 0.002], [lat, gy, gz]], 0.0009, { radial: 8, step: 0.003 });
      const nerve = H.tube([[lat, gy, gz], [lat + 0.005, gy - 0.002, gz + 0.004]], 0.0014, { radial: 8, step: 0.003 });
      addPair(gSpine, { id: 'dorsal-root-ganglion-' + vn.toLowerCase(), name: vn + ' dorsal root ganglion', latin: 'Ganglion sensorium nervi spinalis', layer: H.LAYER.NERVE, depth: 0.3, region, geometry: H.merge([gang, root, nerve]), color: '#e3c86a', tags: ['spinal cord', 'ganglion'],
        info: { description: 'A swelling on the dorsal (sensory) root of the ' + vn + ' spinal nerve lying in the intervertebral foramen, just outside the dural sac, where the dorsal and ventral roots join. One of 31 pairs; three levels are shown as representatives.',
          function: 'Holds the cell bodies of the sensory neurons that bring touch, pain, temperature and position sense from its dermatome and muscles into the cord.', size: 'About 4-6 mm long',
          notes: 'The chickenpox virus lies dormant in dorsal root ganglia for decades and can reactivate as shingles, a painful rash confined to one dermatome.' } });
    }
  }

  // ================================================================ CRANIAL MENINGES
  {
    // shrink-wrap: bin every brain vertex by direction from C, keep the farthest, fill + smooth outward, then offset
    const C = new V3(0, 1.645, -0.015), NU = 72, NV = 48, R = new Float32Array((NV + 1) * NU);
    const bin = (x, y, z) => {
      const dx = x - C.x, dy = y - C.y, dz = z - C.z, r = Math.hypot(dx, dy, dz), th = Math.acos(H.clamp(dy / r, -1, 1));
      let ph = Math.atan2(dx, dz); if (ph < 0) ph += 2 * Math.PI;
      const k = Math.round(th / Math.PI * NV) * NU + Math.round(ph / (2 * Math.PI) * NU) % NU; if (r > R[k]) R[k] = r;
    };
    for (let i = 0; i < hemiPos.length; i += 3) { bin(hemiPos[i], hemiPos[i + 1], hemiPos[i + 2]); bin(-hemiPos[i], hemiPos[i + 1], hemiPos[i + 2]); }
    const cp = cbSurface.attributes.position.array; for (let i = 0; i < cp.length; i += 3) bin(cp[i], cp[i + 1], cp[i + 2]);
    for (const row of [0, NV]) { let m = 0; for (let i = 0; i < NU; i++) m = Math.max(m, R[row * NU + i]); for (let i = 0; i < NU; i++) R[row * NU + i] = m; }
    const nb = (iv, iu) => [[iv - 1, iu], [iv + 1, iu], [iv, iu - 1], [iv, iu + 1]].filter(([a]) => a >= 0 && a <= NV).map(([a, b]) => a * NU + ((b + NU) % NU));
    for (let pass = 0; pass < 80; pass++) {       // fill empty directions (under the brain, around the brainstem)
      let empty = 0; const Rn = R.slice();
      for (let iv = 0; iv <= NV; iv++) for (let iu = 0; iu < NU; iu++) {
        const k = iv * NU + iu; if (R[k] > 0) continue;
        const vals = nb(iv, iu).map(j => R[j]).filter(v => v > 0); if (vals.length) Rn[k] = vals.reduce((s, v) => s + v, 0) / vals.length; else empty++;
      }
      R.set(Rn); if (!empty) break;
    }
    const R0 = R.slice();
    for (let pass = 0; pass < 10; pass++) {        // smooth, never moving inward (bridges sulci, fissure and the gap above the cerebellum)
      const Rn = R.slice();
      for (let iv = 1; iv < NV; iv++) for (let iu = 0; iu < NU; iu++) { const k = iv * NU + iu, n = nb(iv, iu); Rn[k] = Math.max(R0[k], (R[k] * 2 + n.reduce((s, j) => s + R[j], 0)) / (2 + n.length)); }
      R.set(Rn);
    }
    const shell = (off) => surf(NU, NV, (u, v, iu, iv) => {
      const th = v * Math.PI, ph = u * Math.PI * 2, r = R[iv * NU + (iu % NU)] + off, s = Math.sin(th), y = C.y + r * Math.cos(th);
      const cr = cranium(C.x + r * s * Math.sin(ph), y, C.z + r * s * Math.cos(ph), M_DURA + 0.003 - off, 0.03);   // safety net under the occipital scalp
      return [cr[0], y, cr[1]];
    });
    add(gMen, { id: 'dura-mater', name: 'Dura mater (cranial)', latin: 'Dura mater cranialis', depth: 0.0, geometry: shell(0.003), material: tmat(H.COLORS.meninges, 0.35), tags: ['meninges'],
      info: { description: 'The thick, tough outer membrane lining the inside of the skull, fused with the periosteum. Its inner layer folds inward to form the falx cerebri and tentorium cerebelli, and the dural venous sinuses run between its layers.',
        function: 'Protects the brain, holds it in place and drains its venous blood through the dural sinuses.', size: 'About 0.5-1 mm thick; encloses ~1,400 ml of brain and CSF',
        notes: 'Arterial bleeding between skull and dura (extradural haematoma, often from the middle meningeal artery) can kill within hours after a "lucid interval"; the dura itself is pain-sensitive, unlike the brain.' } });
    add(gMen, { id: 'arachnoid-mater', name: 'Arachnoid mater', latin: 'Arachnoidea mater cranialis', depth: 0.1, geometry: shell(0.0015), material: tmat('#e6e0ee', 0.2), tags: ['meninges', 'csf'],
      info: { description: 'The thin, cobweb-like middle membrane lying against the inner dura. Fine trabeculae cross the CSF-filled subarachnoid space beneath it to the pia mater, which clings to every gyrus and sulcus of the brain surface.',
        function: 'Encloses the subarachnoid space where CSF cushions the brain and the large cerebral arteries run; arachnoid granulations return CSF to the venous sinuses.', size: 'Microscopically thin (tens of micrometres); subarachnoid space holds ~125-150 ml of CSF in total',
        notes: 'A ruptured berry aneurysm bleeds into the subarachnoid space, classically causing a sudden "worst headache of my life"; meningitis inflames the arachnoid and pia.' } });

    // falx cerebri: sickle between the hemispheres, from the crista galli to the internal occipital protuberance
    const Cs = [-0.01, 1.66];   // [z, y]
    const A0 = -7.5, A1 = 194, NA = 56, rOut = new Float32Array(NA + 1);
    for (let i = 0; i < hemiPos.length; i += 3) {
      if (hemiPos[i] > 0.012) continue;
      const dz = hemiPos[i + 2] - Cs[0], dy = hemiPos[i + 1] - Cs[1], a = Math.atan2(dy, dz) * 180 / Math.PI, aa = a < -90 ? a + 360 : a;
      const k = Math.round((aa - A0) / (A1 - A0) * NA); if (k >= 0 && k <= NA) rOut[k] = Math.max(rOut[k], Math.hypot(dz, dy));
    }
    for (let k = 0; k <= NA; k++) if (!rOut[k]) rOut[k] = rOut[k - 1] || 0.07;
    const outer = []; for (let k = 0; k <= NA; k++) { const a = (A0 + (A1 - A0) * k / NA) * Math.PI / 180, r = rOut[k] + 0.0015; outer.push([Cs[0] + r * Math.cos(a), Cs[1] + r * Math.sin(a)]); }
    const CG = [0.058, 1.651], IOP = [-0.092, tentY(0, -0.092) + 0.0005];
    outer[0] = CG; outer[NA] = IOP;
    const inner = [CG, [0.045, 1.668], [0.03, 1.684], [0.01, 1.695], [-0.012, 1.698], [-0.03, 1.694], [-0.042, 1.684], [-0.047, 1.662], [-0.05, tentY(0, -0.05) + 0.0005], [-0.07, tentY(0, -0.07) + 0.0005], IOP];
    const resample = (pl, n) => { const d = [0]; for (let i = 1; i < pl.length; i++) d.push(d[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1])); const out = []; for (let k = 0; k <= n; k++) { const s = d[d.length - 1] * k / n; let i = 1; while (i < pl.length - 1 && d[i] < s) i++; const t = (s - d[i - 1]) / Math.max(1e-9, d[i] - d[i - 1]); out.push([H.lerp(pl[i - 1][0], pl[i][0], t), H.lerp(pl[i - 1][1], pl[i][1], t)]); } return out; };
    const NS = 48, KS = 6, oR = resample(outer, NS), iR = resample(inner, NS), fp = [], fi = [];
    for (let s = 0; s <= NS; s++) for (let k = 0; k <= KS; k++) { const t = k / KS; fp.push(0, H.lerp(iR[s][1], oR[s][1], t), H.lerp(iR[s][0], oR[s][0], t)); }
    for (let s = 0; s < NS; s++) for (let k = 0; k < KS; k++) { const a = s * (KS + 1) + k, b = a + 1, c = a + KS + 1, d = c + 1; fi.push(a, b, c, b, d, c); }
    const falx = new THREE.BufferGeometry(); falx.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); falx.setIndex(fi); falx.computeVertexNormals();
    const sheetMat = tmat('#cfc6dd', 0.55, { side: THREE.DoubleSide, roughness: 0.5 });
    add(gMen, { id: 'falx-cerebri', name: 'Falx cerebri', latin: 'Falx cerebri', depth: 0.05, geometry: falx, material: sheetMat, tags: ['meninges', 'dural fold'],
      info: { description: 'A sickle-shaped fold of dura hanging down into the longitudinal fissure between the hemispheres, from the crista galli in front to the internal occipital protuberance behind, where it joins the tentorium. Its free lower edge arches above the corpus callosum.',
        function: 'Limits side-to-side movement of the hemispheres and carries the superior and inferior sagittal sinuses (and the straight sinus at its junction with the tentorium).',
        size: 'About 3-4 cm deep at the back, narrow in front; ~15 cm long along its attached edge',
        notes: 'A mass in one hemisphere can push the cingulate gyrus under the free edge of the falx (subfalcine herniation), compressing the anterior cerebral artery.' } });

    // tentorium cerebelli: tent between the occipital lobes and cerebellum with a U-shaped notch for the midbrain
    const NT = 40, KT = 8, tp = [], ti = [];
    for (let s = 0; s <= NT; s++) {
      const th = (-118 + 236 * s / NT) * Math.PI / 180;
      const ix = 0.016 * Math.sin(th), iz = -0.016 - 0.027 * Math.cos(th), ox = 0.058 * Math.sin(th), oz = -0.045 - 0.048 * Math.cos(th);
      for (let k = 0; k <= KT; k++) { const t = k / KT, x0 = H.lerp(ix, ox, t), z0 = H.lerp(iz, oz, t), y = tentY(x0, z0) - 0.0003, [x, z] = cranium(x0, y, z0, M_DURA + 0.0005, 0.03); tp.push(x, y, z); }
    }
    for (let s = 0; s < NT; s++) for (let k = 0; k < KT; k++) { const a = s * (KT + 1) + k, b = a + 1, c = a + KT + 1, d = c + 1; ti.push(a, b, c, b, d, c); }
    const tent = new THREE.BufferGeometry(); tent.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tent.setIndex(ti); tent.computeVertexNormals();
    add(gMen, { id: 'tentorium-cerebelli', name: 'Tentorium cerebelli', latin: 'Tentorium cerebelli', depth: 0.05, geometry: tent, material: sheetMat, tags: ['meninges', 'dural fold'],
      info: { description: 'A tent-shaped sheet of dura roofing the posterior cranial fossa: it separates the occipital lobes above from the cerebellum below, is attached to the transverse sinus grooves and petrous ridges, and has a U-shaped free edge (the tentorial notch) around the midbrain.',
        function: 'Supports the occipital lobes so they do not press on the cerebellum and divides the cranial cavity into supratentorial and infratentorial compartments.',
        size: 'About 10-11 cm wide; the notch is ~3 cm wide and 5 cm long', notes: 'Raised supratentorial pressure can squeeze the uncus of the temporal lobe through the notch (uncal herniation), stretching the oculomotor nerve and dilating the pupil.' } });
  }

  // ================================================================ CRANIAL NERVE ROOT STUBS (left built, mirrored; each part holds both sides)
  {
    const nerveMat = H.mat({ color: H.COLORS.nerve, roughness: 0.5 });
    const CN = [
      [1, 'Olfactory tract root (CN I)', 'Radix tractus olfactorii (striae olfactoriae)', [[[0.0125, 1.6415, 0.019], [0.014, 1.639, 0.012]], [[0.014, 1.639, 0.012], [0.019, 1.637, 0.006], [0.022, 1.636, 0.003]], [[0.014, 1.639, 0.012], [0.009, 1.6405, 0.009], [0.005, 1.642, 0.008]]], 0.0011,
        'Where the olfactory tract, running back from the olfactory bulb under the frontal lobe, joins the brain at the olfactory trigone and splits into lateral and medial olfactory striae at the anterior perforated substance.', 'Carries smell to the olfactory cortex (uncus, amygdala) without a thalamic relay.', 'Frontal meningiomas of the olfactory groove often present with a lost sense of smell on one side.'],
      [2, 'Optic tract root (CN II)', 'Radix tractus optici', [[[0.003, 1.6285, 0.002], [0.008, 1.6305, -0.004], [0.012, 1.6325, -0.009]]], 0.0019,
        'The start of each optic tract at the back corner of the optic chiasm, where fibres from both eyes regroup before sweeping round the cerebral peduncle toward the lateral geniculate body.', 'Carries the opposite half of the visual field from both eyes.', 'A pituitary tumour pressing up on the chiasm from below classically causes bitemporal hemianopia.'],
      [3, 'Oculomotor nerve root (CN III)', 'Radix nervi oculomotorii', [[[0.004, 1.6245, -0.0105], [0.0055, 1.622, -0.006], [0.007, 1.62, -0.002]]], 0.0014,
        'Emerges from the interpeduncular fossa on the medial side of the cerebral peduncle, between the posterior cerebral and superior cerebellar arteries.', 'Motor to four extraocular muscles and the eyelid levator; parasympathetic to the pupil.', 'A posterior communicating artery aneurysm compresses it here, giving a painful third-nerve palsy with a dilated pupil.'],
      [4, 'Trochlear nerve root (CN IV)', 'Radix nervi trochlearis', [[[0.0025, 1.6225, -0.029], [0.0045, 1.619, -0.033], [0.006, 1.617, -0.035]]], 0.0006,
        'The only cranial nerve to leave the back of the brainstem, just below the inferior colliculus; its fibres cross before exiting.', 'Motor to the superior oblique muscle, which turns the eye down and in.', 'The thinnest cranial nerve (~1 mm); its long course makes it vulnerable in head injury.'],
      [5, 'Trigeminal nerve root (CN V)', 'Radix nervi trigemini', [[[0.010, 1.6125, -0.017], [0.014, 1.612, -0.0175], [0.018, 1.611, -0.018]]], 0.0026,
        'The thick sensory root and small motor root leave the lateral side of the mid-pons where it joins the middle cerebellar peduncle.', 'Sensation from the face, mouth and cornea; motor to the muscles of chewing.', 'Trigeminal neuralgia is often caused by an artery looping against this root entry zone; microvascular decompression can cure it.'],
      [6, 'Abducens nerve root (CN VI)', 'Radix nervi abducentis', [[[0.0025, 1.6015, -0.0075], [0.004, 1.6005, -0.005], [0.005, 1.6, -0.003]]], 0.0008,
        'Leaves the front of the brainstem at the pontomedullary junction, close to the midline above the pyramid.', 'Motor to the lateral rectus, which turns the eye outward.', 'Its long climb over the petrous apex makes it a false-localising sign: raised intracranial pressure from any cause can paralyse it.'],
      [7, 'Facial nerve root (CN VII)', 'Radix nervi facialis', [[[0.010, 1.6025, -0.021], [0.014, 1.604, -0.0205], [0.018, 1.606, -0.019]]], 0.0013,
        'Emerges at the cerebellopontine angle at the lateral end of the pontomedullary junction, with the smaller nervus intermedius between it and CN VIII.', 'Motor to the muscles of facial expression; taste from the front of the tongue; tear and saliva secretion.', 'An acoustic neuroma in the cerebellopontine angle stretches it together with CN VIII.'],
      [8, 'Vestibulocochlear nerve root (CN VIII)', 'Radix nervi vestibulocochlearis', [[[0.0095, 1.601, -0.0235], [0.013, 1.6035, -0.0225], [0.016, 1.606, -0.021]]], 0.0017,
        'Enters the brainstem at the cerebellopontine angle just behind the facial nerve, beside the flocculus of the cerebellum.', 'Carries hearing and balance from the inner ear.', 'Vestibular schwannoma (acoustic neuroma) grows from its vestibular part: one-sided hearing loss and tinnitus are the first signs.'],
      [9, 'Glossopharyngeal nerve root (CN IX)', 'Radix nervi glossopharyngei', [[[0.0075, 1.5945, -0.0185], [0.012, 1.594, -0.0175], [0.017, 1.593, -0.016]]], 0.0009,
        'The uppermost of a row of rootlets leaving the postolivary sulcus of the medulla, behind the olive.', 'Taste and sensation from the back of the tongue and pharynx; carotid sinus and body reflexes; parotid secretion.', 'Leaves the skull through the jugular foramen with X and XI, so tumours there affect all three.'],
      [10, 'Vagus nerve root (CN X)', 'Radix nervi vagi', [[[0.0075, 1.5905, -0.0195], [0.012, 1.5895, -0.0175], [0.017, 1.589, -0.016]], [[0.007, 1.5875, -0.02], [0.012, 1.5875, -0.018], [0.017, 1.589, -0.016]], [[0.0078, 1.5925, -0.0195], [0.012, 1.591, -0.0178], [0.017, 1.589, -0.016]]], 0.0012,
        'A fan of eight to ten rootlets leaving the postolivary sulcus of the medulla below the glossopharyngeal rootlets and uniting into one trunk.', 'Parasympathetic supply to the heart, lungs and gut; motor to the palate, pharynx and larynx; sensation from the viscera.', 'Its motor nucleus (nucleus ambiguus) lies in the lateral medulla, so a lateral medullary (Wallenberg) stroke causes hoarseness and swallowing difficulty.'],
      [11, 'Accessory nerve root (CN XI)', 'Radix nervi accessorii', [[[0.006, 1.5845, -0.0215], [0.010, 1.583, -0.0205], [0.014, 1.582, -0.02]]], 0.0008,
        'Its cranial rootlets leave the lower medulla behind the olive, where the spinal root, which climbs from the upper cervical cord through the foramen magnum, joins them.', 'Motor to sternocleidomastoid and trapezius (spinal part); the cranial part joins the vagus for the larynx.', 'Often injured in posterior-triangle neck surgery, causing a drooping shoulder.'],
      [12, 'Hypoglossal nerve root (CN XII)', 'Radix nervi hypoglossi', [[[0.0035, 1.5895, -0.0125], [0.008, 1.586, -0.009], [0.012, 1.584, -0.006]], [[0.0035, 1.5855, -0.0135], [0.008, 1.5845, -0.0095], [0.012, 1.584, -0.006]], [[0.0035, 1.5815, -0.0145], [0.008, 1.583, -0.0095], [0.012, 1.584, -0.006]]], 0.0007,
        'A line of rootlets leaving the preolivary sulcus between the pyramid and the olive of the medulla.', 'Motor to the muscles of the tongue.', 'A lesion makes the protruded tongue deviate toward the weak side.']
    ];
    for (const [n, name, latin, paths, r, description, fn, notes] of CN) {
      const tubes = paths.map(p => H.tube(p, (t) => r * (1 - 0.25 * t), { radial: 8, step: 0.0015 }));
      const left = H.merge(tubes);
      add(gCN, { id: 'cranial-nerve-root-' + n, name, latin, depth: 0.6, geometry: H.merge([left, H.mirrorX(left)]), material: nerveMat, tags: ['cranial nerve', 'root'],
        info: { description: description + ' Shown as a short stub on both sides; the nerve continues in the peripheral nervous system.', function: fn, size: 'Stub about 1 cm; root ' + (r * 2000).toFixed(1) + ' mm thick', notes } });
    }
  }

  // @@MORE
  return g;
});
