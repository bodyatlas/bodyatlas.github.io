/* systems/digestive.js - the alimentary canal and its accessory glands: tongue & palate, esophagus, stomach, duodenum,
   jejunum, ileum, cecum, appendix, colon, rectum, anal canal, liver, biliary tree, pancreas, mesentery, greater omentum.
   (Salivary glands -> glands module; pharynx -> respiratory module.) Every position comes from L (core/landmarks.js). */
ANATOMY.register('digestive', { name: 'Digestive', description: 'Mouth, esophagus, stomach, small and large intestine, liver, gallbladder, pancreas, mesentery and omentum' }, function (THREE, H, L, ctx) {
  const g = H.group('digestive');
  const O = L.organ, V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
  const DS = THREE.DoubleSide;
  const M = (color, o) => H.mat(Object.assign({ color, roughness: 0.5 }, o || {}));
  const I = (description, fn, size, notes) => ({ description, function: fn, size, notes });
  const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const gauss = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  function add(s) {
    const spec = Object.assign({ system: 'digestive', layer: H.LAYER.ORGAN, depth: 0.2, side: 'M' }, s);
    if (!spec.material && !spec.mesh) spec.material = M(spec.color || H.COLORS.stomach, spec.matOpts);
    const p = H.part(spec); g.add(p); return p;
  }

  // ---------------------------------------------------------------- private geometry helpers
  // flip triangle winding if the signed volume is negative (so normals face outward), then recompute normals
  function orient(geo) {
    const p = geo.attributes.position, ix = geo.index.array, a = V(), b = V(), c = V(), o = H.center(geo); let vol = 0;
    for (let i = 0; i < ix.length; i += 3) { a.fromBufferAttribute(p, ix[i]).sub(o); b.fromBufferAttribute(p, ix[i + 1]).sub(o); c.fromBufferAttribute(p, ix[i + 2]).sub(o); vol += a.dot(b.cross(c)); }
    if (vol < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    geo.computeVertexNormals(); return geo;
  }
  // (rows+1) x (cols+1) vertex grid from fn(s 0..1, u 0..1) -> [x,y,z]; column seam duplicated; optional centroid caps on both row ends
  function grid(rows, cols, fn, o = {}) {
    const pos = [], uv = [], idx = [], W = cols + 1;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) { const q = fn(i / rows, j / cols); pos.push(q[0], q[1], q[2]); uv.push(i / rows, j / cols); }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
    if (o.caps) for (const r of [0, rows]) { if ((o.caps === 'start' && r) || (o.caps === 'end' && !r)) continue;
      let cx = 0, cy = 0, cz = 0; for (let j = 0; j < cols; j++) { const k = (r * W + j) * 3; cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2]; }
      const ci = pos.length / 3; pos.push(cx / cols, cy / cols, cz / cols); uv.push(r / rows, 0.5);
      for (let j = 0; j < cols; j++) { const a = r * W + j; if (r) idx.push(ci, a, a + 1); else idx.push(ci, a + 1, a); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    return o.noOrient ? (geo.computeVertexNormals(), geo) : orient(geo);
  }
  const curveOf = (pts) => new THREE.CatmullRomCurve3(pts.map(H.v3), false, 'centripetal', 0.5);
  // sweep a (non-circular) cross-section along a curve. rfn(f, a, ring) -> r | [rN, rB]; f = arc fraction of the WHOLE curve,
  // a = angle; N = transported frame pulled toward `ref` (default anterior +Z), B = T x N. o: { t0, t1, step, radial, ref, pull, caps }
  function sweep(curve, rfn, o = {}) {
    if (Array.isArray(curve)) curve = curveOf(curve);
    const t0 = o.t0 || 0, t1 = o.t1 == null ? 1 : o.t1, radial = o.radial || 16;
    const step = o.step || 0.005, n = Math.max(4, Math.round(curve.getLength() * (t1 - t0) / step));
    const ref = H.v3(o.ref || [0, 0, 1]), pull = o.pull == null ? 0.5 : o.pull, rings = [];
    // frames are transported from the START of the curve (cached per curve) so sub-ranges of one curve join seamlessly
    const key = ref.toArray().join() + pull;
    if (!curve._fr || curve._fr.key !== key) {
      const Mx = Math.max(8, Math.round(curve.getLength() / 0.002)), Ns = []; let prevN = null;
      for (let i = 0; i <= Mx; i++) {
        const T = curve.getTangentAt(i / Mx).normalize(); let N = (prevN || ref).clone(); N.addScaledVector(T, -N.dot(T));
        const Rp = ref.clone().addScaledVector(T, -ref.dot(T)), rl = Rp.length();
        if (rl > 0.25) N.lerp(Rp.divideScalar(rl), prevN ? pull : 1);
        if (N.lengthSq() < 1e-8) N = Math.abs(T.x) < 0.9 ? V(1, 0, 0).addScaledVector(T, -T.x) : V(0, 1, 0).addScaledVector(T, -T.y);
        N.normalize(); prevN = N; Ns.push(N);
      }
      curve._fr = { key, Mx, Ns };
    }
    for (let i = 0; i <= n; i++) {
      const f = t0 + (t1 - t0) * i / n, P = curve.getPointAt(f), T = curve.getTangentAt(f).normalize();
      const N = curve._fr.Ns[Math.round(f * curve._fr.Mx)].clone(); N.addScaledVector(T, -N.dot(T)).normalize();
      rings.push({ f, P, T, N, B: V().crossVectors(T, N) });
    }
    return grid(n, radial, (s, u) => {
      const R = rings[Math.round(s * n)], a = u * Math.PI * 2, r = rfn(R.f, a, R);
      const rn = Array.isArray(r) ? r[0] : r, rb = Array.isArray(r) ? r[1] : r, ca = Math.cos(a) * rn, sa = Math.sin(a) * rb;
      return [R.P.x + ca * R.N.x + sa * R.B.x, R.P.y + ca * R.N.y + sa * R.B.y, R.P.z + ca * R.N.z + sa * R.B.z];
    }, { caps: o.caps == null ? true : o.caps });
  }
  // Catmull-Rom interpolation of column c of a table whose rows are sorted by column 0
  function tab(rows, x, c) {
    const n = rows.length; if (x <= rows[0][0]) return rows[0][c]; if (x >= rows[n - 1][0]) return rows[n - 1][c];
    let i = 0; while (x > rows[i + 1][0]) i++;
    const t = (x - rows[i][0]) / (rows[i + 1][0] - rows[i][0]), t2 = t * t, t3 = t2 * t;
    const p0 = rows[Math.max(0, i - 1)][c], p1 = rows[i][c], p2 = rows[i + 1][c], p3 = rows[Math.min(n - 1, i + 2)][c];
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  // arc fraction of the curve point nearest to p
  function fracOf(curve, p) {
    p = H.v3(p); let best = 0, bd = 1e9; const q = V();
    for (let i = 0; i <= 600; i++) { curve.getPointAt(i / 600, q); const d = q.distanceToSquared(p); if (d < bd) { bd = d; best = i / 600; } }
    return best;
  }
  // thin duct tube along a Catmull-Rom course
  const duct = (pts, r, radial) => H.tube(pts, r, { radial: radial || 8, step: 0.004 });

  // ================================================================ ORAL CAVITY
  // tongue: loft from the root (s=0, pharyngeal part) to the tip (s=1); rows [s, z, dorsum y, underside y, half width]
  const TG = [[0, 0.0125, 1.55, 1.54, 0.009], [0.06, 0.0155, 1.5575, 1.5375, 0.0145], [0.14, 0.021, 1.5645, 1.537, 0.019], [0.3, 0.034, 1.576, 1.540, 0.023], [0.49, 0.049, 1.5805, 1.545, 0.0245],
    [0.68, 0.063, 1.5795, 1.552, 0.022], [0.84, 0.075, 1.577, 1.558, 0.017], [0.94, 0.082, 1.5735, 1.563, 0.011], [1.0, L.head.mouth[2] - 0.009, 1.5705, 1.567, 0.004]];
  const tongue = grid(46, 72, (s, u) => {
    const z = tab(TG, s, 1), top = tab(TG, s, 2), bot = tab(TG, s, 3), hw = tab(TG, s, 4);
    const a = u * Math.PI * 2, cu = Math.cos(a), su = Math.sin(a), ym = bot + 0.55 * (top - bot);
    return [hw * spow(cu, 0.8), su >= 0 ? ym + (top - ym) * spow(su, 0.85) : ym + (ym - bot) * spow(su, 0.75), z];
  }, { caps: true });
  H.displace(tongue, (p, n) => {
    if (n.y < 0.25) return 0;
    const zV = 0.031 + Math.abs(p.x) * 0.75;                                   // sulcus terminalis: V with apex (foramen cecum) pointing back
    let d = 0.00035 * H.fbm(p.x * 700, p.y * 700, p.z * 700, 2);                 // filiform / fungiform papillae
    if (p.z < zV) d += 0.0008 * H.fbm(p.x * 260 + 5, p.y * 260, p.z * 260, 2);   // nodular pharyngeal third
    d -= 0.0012 * gauss(p.x, 0, 0.003) * H.smoothstep(zV, zV + 0.01, p.z) * H.smoothstep(0.086, 0.07, p.z);   // median sulcus
    d -= 0.0008 * gauss(p.z, zV, 0.0018);
    for (let k = -4; k <= 4; k++) { const xk = k * 0.0042, zk = 0.031 + Math.abs(xk) * 0.75 + 0.0045; d += 0.0013 * Math.exp(-((p.x - xk) ** 2 + (p.z - zk) ** 2) / 2.9e-6); }  // circumvallate row
    return d * H.smoothstep(0.25, 0.6, n.y);
  });
  add({ id: 'tongue', name: 'Tongue', latin: 'Lingua', region: 'head', geometry: tongue, color: H.COLORS.tongue, matOpts: { roughness: 0.75 }, tags: ['mouth'],
    info: I('Muscular organ filling the floor of the mouth. Its upper surface (dorsum) is covered with papillae; a V-shaped groove, the sulcus terminalis, separates the oral two-thirds from the lumpy pharyngeal third, with a row of 8-12 large circumvallate papillae just in front of it.',
      'Moves food during chewing, pushes the bolus into the pharynx when swallowing, carries most taste buds and shapes speech sounds.',
      'About 10 cm from tip to root (about 6.5 cm lies in the mouth), about 5 cm wide; roughly 70 g.',
      'All its muscles are supplied by the hypoglossal nerve (XII) except palatoglossus (vagus). A tongue that deviates when protruded points to the side of a hypoglossal nerve lesion.') });

  // hard palate: thin arched plate (rows back -> front): [s, z, half width, lateral y, vault height, thickness]
  const hp = L.head.hardPalate;
  const HP = [[0, hp[2] - 0.02, 0.019, hp[1] - 0.003, 0.0075, 0.004], [0.3, hp[2] - 0.006, 0.0205, hp[1] - 0.0035, 0.0075, 0.004], [0.6, hp[2] + 0.009, 0.019, hp[1] - 0.004, 0.006, 0.004],
    [0.85, hp[2] + 0.021, 0.0135, hp[1] - 0.0045, 0.0035, 0.0035], [1, hp[2] + 0.028, 0.005, hp[1] - 0.005, 0.001, 0.003]];
  const palate = grid(30, 40, (s, u) => {
    const a = u * Math.PI * 2, cu = Math.cos(a), su = Math.sin(a);
    return [tab(HP, s, 2) * cu, tab(HP, s, 3) + tab(HP, s, 4) * (1 - cu * cu) + tab(HP, s, 5) * (0.5 + 0.5 * su), tab(HP, s, 1)];
  }, { caps: true });
  H.displace(palate, (p, n) => {
    if (n.y > -0.4) return 0;
    const rug = Math.pow(Math.max(0, Math.sin(((p.z - hp[2]) + 0.0015 * Math.sin(p.x * 300)) * Math.PI * 2 / 0.0065)), 3) * H.smoothstep(hp[2] - 0.002, hp[2] + 0.01, p.z) * H.smoothstep(hp[2] + 0.026, hp[2] + 0.018, p.z) * (1 - gauss(p.x, 0, 0.002));
    return 0.0007 * rug + 0.0004 * gauss(p.x, 0, 0.0012);   // transverse palatine rugae + midline raphe
  });
  add({ id: 'hard-palate', name: 'Hard palate', latin: 'Palatum durum', region: 'head', geometry: palate, color: '#d08d90', tags: ['mouth'],
    info: I('Bony front two-thirds of the roof of the mouth (palatine processes of the maxillae and horizontal plates of the palatine bones) covered by firm mucosa with a midline raphe and transverse ridges called palatine rugae.',
      'Separates the mouth from the nasal cavity and gives the tongue a rigid surface to press food against while chewing and swallowing.',
      'About 5 cm long and 3.5-4 cm wide between the teeth; the vault is 1-1.5 cm high.',
      'Incomplete fusion of the two palatal shelves in the embryo causes cleft palate, one of the most common birth defects; it disturbs feeding and speech until repaired.') });

  // soft palate: muscular flap sloping back and down to the uvula; [s, z, mid y, half width, thickness, vault]
  const up = [0, 1.579, 0.022];     // uvula base (uvula centre ~[0, 1.575, 0.02])
  const SP = [[0, hp[2] - 0.019, hp[1] - 0.0005, 0.019, 0.006, 0.006], [0.35, hp[2] - 0.025, hp[1] - 0.003, 0.017, 0.0085, 0.005], [0.7, hp[2] - 0.031, hp[1] - 0.0055, 0.012, 0.008, 0.003], [1, up[2], up[1] - 0.0015, 0.006, 0.006, 0.001]];
  const softPal = grid(20, 32, (s, u) => {
    const a = u * Math.PI * 2, cu = Math.cos(a), su = Math.sin(a);
    return [tab(SP, s, 3) * cu, tab(SP, s, 2) + tab(SP, s, 5) * (1 - cu * cu) - 0.004 * cu * cu * s + tab(SP, s, 4) * 0.5 * su, tab(SP, s, 1)];
  }, { caps: true });
  add({ id: 'soft-palate', name: 'Soft palate', latin: 'Palatum molle', region: 'head', geometry: softPal, color: '#c97c84', tags: ['mouth'],
    info: I('Mobile muscular fold covered with mucosa that hangs from the back edge of the hard palate and ends in the uvula; laterally it continues into the palatoglossal and palatopharyngeal arches.',
      'Rises and tenses during swallowing and speech to seal off the nasopharynx so food and air go the right way.',
      'About 3 cm long and up to 1 cm thick.',
      'If it is paralysed (e.g. vagus nerve injury) fluids regurgitate into the nose and speech sounds nasal; it is also a major site of vibration in snoring.') });
  const uvula = H.span(H.lathe([[0, 0], [0.0035, 0.0005], [0.0042, 0.004], [0.004, 0.008], [0.0036, 0.0108], [0.002, 0.0126], [0, 0.013]], { segments: 20 }), up, [0, up[1] - 0.0122, up[2] - 0.0035]);
  add({ id: 'uvula', name: 'Uvula', latin: 'Uvula palatina', region: 'head', geometry: uvula, color: '#c46f78', tags: ['mouth'],
    info: I('Small conical fleshy projection hanging from the middle of the free edge of the soft palate.',
      'Helps the soft palate close the nasopharynx during swallowing and secretes thin saliva.',
      'About 1-1.5 cm long and 0.8 cm wide.',
      'With a vagus nerve lesion the uvula deviates away from the injured side when the patient says "ah".') });

  // ================================================================ ESOPHAGUS (behind the trachea, slightly left, behind the heart, through the hiatus)
  const T6 = L.spine.T6, cardia = O.stomach.cardia;
  const ES = [L.neck.esophagusTop, [0.003, 1.455, -0.008], [0.006, 1.42, -0.021], [0.007, 1.39, -0.031], [0.006, 1.36, -0.037], [0.003, T6.y, T6.z + 0.045],
    [0.004, 1.29, -0.033], [0.007, 1.25, -0.038], [0.01, 1.22, -0.045], [0.007, 1.207, -0.022], [cardia[0] + 0.006, cardia[1] - 0.001, cardia[2]]];
  const esoph = sweep(ES, (f, a, R) => {
    const y = R.P.y, r = 0.0102 - 0.0018 * gauss(y, 1.48, 0.012) - 0.0012 * gauss(y, 1.37, 0.015) - 0.0012 * gauss(y, 1.222, 0.008) + 0.003 * H.smoothstep(1.212, 1.2, y);
    const flat = 1 - H.smoothstep(1.24, 1.21, y);   // collapsed (flattened front-to-back) except where it flares into the stomach
    return [r * (1 - 0.2 * flat), r * (1 + 0.12 * flat)];
  }, { step: 0.005, radial: 16 });
  add({ id: 'esophagus', name: 'Esophagus', latin: 'Oesophagus', region: 'body', geometry: esoph, color: H.COLORS.esophagus, matOpts: { side: DS }, tags: ['gi-tract'],
    info: I('Muscular tube carrying food from the pharynx to the stomach. It runs behind the trachea and the heart, slightly left of the midline, and passes through the esophageal hiatus of the diaphragm at T10 to reach the cardia of the stomach.',
      'Moves swallowed food down by waves of peristalsis; the lower esophageal sphincter keeps stomach acid from refluxing upward.',
      'About 25 cm long (C6 to T11), about 2 cm wide when distended; flattened front-to-back when empty.',
      'It narrows at three points - the cricoid, where the aortic arch and left main bronchus cross it, and the diaphragm - where swallowed objects most often lodge.') });

  // ================================================================ STOMACH (J: fundus dome under the left diaphragm -> body -> antrum -> pylorus)
  const st = O.stomach, pyl = st.pylorus;
  const SC = curveOf([[st.fundus[0] + 0.002, 1.236, st.fundus[2] - 0.006], [0.074, 1.214, -0.016], [0.062, 1.19, -0.006], [0.057, 1.16, 0.013], [0.06, 1.128, 0.03],
    [0.057, 1.104, 0.041], [0.036, 1.087, 0.047], [0.01, 1.088, 0.05], [-0.008, 1.095, 0.048], pyl]);
  const SR = [[0, 0.03], [0.12, 0.035], [0.3, 0.037], [0.5, 0.035], [0.66, 0.029], [0.8, 0.021], [0.92, 0.014], [1, 0.0115]];
  // [front-back semi-axis, frontal semi-axis]; +sin(a) side (B) = lesser curvature, -sin(a) = greater curvature
  function stomR(f, a) {
    let R = tab(SR, f, 1); if (f < 0.1) R *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - f / 0.1, 2)));
    const s = Math.sin(a), lesser = 0.85 + 0.6 * gauss(f, 0.2, 0.08), greater = 1 + 0.25 * gauss(f, 0.4, 0.25);
    return [R * 0.74, R * (s >= 0 ? 1 + (lesser - 1) * s : 1 - (greater - 1) * s)];
  }
  add({ id: 'stomach', name: 'Stomach', latin: 'Gaster', region: 'abdomen', geometry: sweep(SC, stomR, { step: 0.004, radial: 48 }), color: H.COLORS.stomach, matOpts: { side: DS }, tags: ['gi-tract'],
    info: I('J-shaped muscular sac in the left upper abdomen: the cardia where the esophagus enters, the dome-shaped fundus under the left diaphragm, the body, and the antrum narrowing to the pylorus. The short concave right border is the lesser curvature, the long convex left border the greater curvature.',
      'Stores a meal and churns it with acid and pepsin into semi-liquid chyme, which it releases a little at a time into the duodenum.',
      'About 25 cm long along the greater curvature; holds 1-1.5 L after a meal (up to about 4 L when stretched), about 50 mL when empty.',
      'Parietal cells secrete hydrochloric acid (pH 1.5-3.5) and intrinsic factor, without which vitamin B12 cannot be absorbed (pernicious anaemia).') });
  const rugae = sweep(SC, (f, a) => {
    const [rn, rb] = stomR(f, a);
    const ridge = Math.pow(0.5 + 0.5 * Math.cos(11 * a + 2.5 * H.fbm(f * 8, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 2)), 3);
    const k = 0.9 * (1 - 0.13 * ridge * (0.35 + 0.65 * Math.max(0, -Math.sin(a))));
    return [rn * k, rb * k];
  }, { step: 0.003, radial: 72, t0: 0.012, t1: 0.99 });
  add({ id: 'stomach-rugae', name: 'Gastric rugae (mucosa)', latin: 'Plicae gastricae', region: 'abdomen', depth: 0.5, geometry: rugae, color: '#b85c5f', matOpts: { side: DS, roughness: 0.4 }, parent: 'stomach', tags: ['gi-tract', 'interior'],
    info: I('Longitudinal folds of the gastric mucosa lining the inside of the stomach, most prominent along the greater curvature and in the body.',
      'Let the stomach expand as it fills and increase the surface of the acid- and enzyme-secreting gastric glands.',
      'Folds 3-5 mm high; they flatten out when the stomach is distended.',
      'Along the lesser curvature the folds run straight toward the pylorus (the "gastric canal"), channelling swallowed liquids quickly past the food mass.') });
  { const f = 0.975, P = SC.getPointAt(f), T = SC.getTangentAt(f).normalize(), N = V(0, 0, 1).addScaledVector(T, -T.z).normalize(), B = V().crossVectors(T, N);
    const tor = H.torus(0.0105, 0.0038, { radial: 12, tubular: 40 }); tor.scale(0.78, 1, 1);
    tor.applyMatrix4(new THREE.Matrix4().makeBasis(N, B, T).setPosition(P)); tor.computeVertexNormals();
    add({ id: 'pyloric-sphincter', name: 'Pyloric sphincter', latin: 'Musculus sphincter pyloricus', region: 'abdomen', depth: 0.3, geometry: tor, color: '#b8695e', parent: 'stomach', tags: ['gi-tract', 'sphincter'],
      info: I('Thick ring of circular smooth muscle at the outlet of the stomach, felt as a firm ridge between the antrum and the duodenum.',
        'Meters chyme into the duodenum a few millilitres at a time and limits reflux of bile back into the stomach.',
        'Ring about 2-3 cm across; the muscle is about 0.5 cm thick.',
        'In infantile hypertrophic pyloric stenosis the muscle thickens, causing projectile vomiting at 2-8 weeks of age; it is cured by splitting the muscle (pyloromyotomy).') }); }

  // ================================================================ DUODENUM: C-loop around the pancreatic head, pylorus -> duodenojejunal flexure
  const djf = [0.03, 1.10, -0.01];
  const DU = curveOf([pyl, [-0.035, 1.112, 0.038], [-0.05, 1.118, 0.026], [-0.06, 1.113, 0.014], [-0.065, 1.095, 0.008], [-0.065, 1.07, 0.006], [-0.058, 1.048, 0.004],
    [-0.04, 1.036, 0.001], [-0.012, 1.034, -0.002], [0.014, 1.04, -0.004], [0.03, 1.058, -0.008], [0.034, 1.08, -0.01], djf]);
  const duoLen = DU.getLength();
  add({ id: 'duodenum', name: 'Duodenum', latin: 'Duodenum', region: 'abdomen', geometry: sweep(DU, (f) => 0.017 - 0.005 * H.smoothstep(0.05, 0, f) + 0.0005 * Math.sin(f * duoLen / 0.012 * Math.PI * 2), { step: 0.004, radial: 20 }),
    color: '#d5a090', matOpts: { side: DS }, tags: ['gi-tract', 'small-intestine'],
    info: I('First part of the small intestine: a C-shaped loop in four parts (superior, descending, horizontal, ascending) wrapped around the head of the pancreas, mostly fixed to the back wall of the abdomen.',
      'Receives chyme from the stomach plus bile and pancreatic juice through the major duodenal papilla in its descending part, neutralising the acid and starting most chemical digestion.',
      'About 25 cm long and 3-4 cm wide; the flexure where it becomes the jejunum lies left of L2.',
      'Its name means "twelve finger-breadths". Most peptic ulcers occur in its first 2-3 cm, the duodenal bulb.') });

  // ================================================================ PANCREAS: head in the duodenal C, neck, body over the aorta & left kidney, tail to the splenic hilum
  const pc = O.pancreas;
  const PC = curveOf([[pc.head[0] + 0.008, pc.head[1] + 0.004, pc.head[2] - 0.002], [0.01, 1.112, 0.002], pc.body, [0.07, 1.131, -0.026], [pc.tail[0], pc.tail[1] + 0.001, pc.tail[2]]]);
  const pancR = (f) => { const e = f > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.88) / 0.12, 2))) : 1; return [0.0085 * (1 - 0.15 * f) * e + 0.0005, (0.0125 + 0.002 * gauss(f, 0.45, 0.25) - 0.002 * f) * e + 0.0005]; };
  const lobul = (geo) => H.displace(geo, (p) => 0.0007 * H.fbm(p.x * 330 + 3, p.y * 330, p.z * 330, 2));
  const pInfo = (d, s, n) => I(d, 'Its acinar cells secrete about 1.5 L a day of enzyme-rich alkaline juice into the duodenum; scattered islets of Langerhans release insulin and glucagon into the blood.', s, n);
  const headG = H.blob([1, 1, 1], { ws: 40, hs: 28, deform: (p) => { const low = H.smoothstep(-0.1, -0.9, p.y); return V(p.x * 0.02 + low * 0.014 * (0.5 + 0.5 * p.x), p.y * 0.027, p.z * 0.0125 - low * 0.004); } });
  headG.translate(pc.head[0] - 0.004, pc.head[1] - 0.008, pc.head[2] + 0.001); lobul(headG);
  add({ id: 'pancreas-head', name: 'Head of pancreas', latin: 'Caput pancreatis', region: 'abdomen', geometry: headG, color: H.COLORS.pancreas, parent: 'pancreas', tags: ['pancreas', 'gland'],
    info: pInfo('Widest part of the pancreas, nestled in the C-loop of the duodenum; its hook-like uncinate process tucks behind the superior mesenteric vessels. The common bile duct runs through its back.',
      'About 5 cm high and up to 3 cm thick; the whole pancreas is 12-15 cm long and weighs 70-100 g.',
      'About two-thirds of pancreatic cancers arise in the head, where they often first show as painless jaundice by squeezing the common bile duct.') });
  const pParts = [['pancreas-neck', 'Neck of pancreas', 'Collum pancreatis', 0, 0.2, 'Short narrowed part joining the head to the body, lying in front of the portal vein and superior mesenteric vessels.', 'About 2 cm long.', 'The portal vein forms right behind it (superior mesenteric + splenic veins), making it the key landmark in pancreatic surgery.'],
    ['pancreas-body', 'Body of pancreas', 'Corpus pancreatis', 0.2, 0.62, 'Main central part, crossing the aorta, left adrenal and left kidney behind the stomach, from which it is separated by the lesser sac.', 'About 2.5 cm high and 1.5 cm thick.', 'Lying over the vertebral column, it can be crushed against the spine in blunt trauma such as steering-wheel or bicycle-handlebar injuries.'],
    ['pancreas-tail', 'Tail of pancreas', 'Cauda pancreatis', 0.62, 1, 'Narrow left end running in the splenorenal ligament to the hilum of the spleen; it has the highest density of islets.', 'About 2 cm high, tapering to a blunt tip.', 'Its closeness to the splenic hilum means it can be injured during splenectomy, causing a pancreatic fistula.']];
  for (const q of pParts) add({ id: q[0], name: q[1], latin: q[2], region: 'abdomen', geometry: lobul(sweep(PC, pancR, { t0: q[3], t1: q[4], step: 0.003, radial: 24, caps: q[4] === 1 ? 'end' : false })), color: H.COLORS.pancreas, parent: 'pancreas', tags: ['pancreas', 'gland'], info: pInfo(q[5], q[6], q[7]) });
  const amp = [-0.049, 1.072, 0.006];   // hepatopancreatic ampulla on the medial wall of the descending duodenum
  const pdPts = [0.95, 0.8, 0.6, 0.4, 0.2, 0.04].map(f => PC.getPointAt(f)).concat([V(-0.024, 1.094, 0.008), V(-0.037, 1.08, 0.005), H.v3(amp)]);
  add({ id: 'pancreatic-duct', name: 'Main pancreatic duct', latin: 'Ductus pancreaticus (Wirsung)', region: 'abdomen', depth: 0.5, geometry: H.tube(pdPts, t => 0.0014 + 0.0008 * t, { radial: 8, step: 0.004 }), color: '#d4b25a', parent: 'pancreas', tags: ['pancreas', 'duct', 'interior'],
    info: I('Main duct running the length of the pancreas from tail to head, collecting from side branches like a herringbone, then joining the common bile duct in the hepatopancreatic ampulla (of Vater).',
      'Carries pancreatic juice to the duodenum through the major duodenal papilla.',
      'About 2 mm wide in the tail widening to 3-4 mm in the head.',
      'A gallstone stuck at the shared ampulla can block it and trigger acute pancreatitis.') });

  // ================================================================ LIVER: normalised sagittal wedge profile lofted from the right lateral end to the left-lobe tip
  const lv = O.liver, ly = lv.center[1];
  // profile (z forward, y up) starts at the sharp antero-inferior border, climbs the front, crosses the dome, descends the back and returns along the concave visceral surface
  const LPc = new THREE.CatmullRomCurve3([[0.95, -0.8], [1.0, -0.35], [0.9, 0.25], [0.62, 0.68], [0.18, 0.95], [-0.3, 0.92], [-0.72, 0.62], [-0.95, 0.15], [-0.93, -0.25],
    [-0.7, -0.5], [-0.3, -0.45], [0.2, -0.5], [0.62, -0.66]].map(q => V(q[0], q[1], 0)), true, 'centripetal');
  const LPN = 72, LP = []; for (let j = 0; j <= LPN; j++) LP.push(LPc.getPointAt((j % LPN) / LPN));
  // stations [x, centre y, half height, centre z, half depth]: tall right lobe (dome to y~1.235), thin left lobe over the stomach to x~+0.08
  const LS = [[-0.138, ly, 0.02, -0.006, 0.02], [-0.135, ly + 0.001, 0.042, -0.006, 0.042], [-0.127, ly + 0.002, 0.055, -0.005, 0.056], [-0.108, ly + 0.003, 0.064, -0.003, 0.064],
    [-0.084, ly + 0.0075, 0.07, 0, 0.068], [-0.058, ly + 0.01, 0.068, 0.004, 0.069], [-0.032, ly + 0.012, 0.06, 0.01, 0.065], [-0.008, ly + 0.016, 0.048, 0.018, 0.058],
    [0.012, ly + 0.019, 0.034, 0.03, 0.046], [0.035, ly + 0.021, 0.024, 0.044, 0.032], [0.058, ly + 0.023, 0.016, 0.047, 0.027], [0.074, ly + 0.025, 0.009, 0.047, 0.019], [0.082, ly + 0.026, 0.003, 0.047, 0.008]];
  const liverAt = (x, j) => { const q = LP[j]; return [x, tab(LS, x, 1) + tab(LS, x, 2) * q.y, tab(LS, x, 3) + tab(LS, x, 4) * q.x]; };
  const xF = -0.004, xR = LS[0][0], xT = LS[LS.length - 1][0];   // falciform plane, right end, left tip
  const smooth = (geo) => H.displace(geo, (p) => 0.0006 * H.fbm(p.x * 45, p.y * 45, p.z * 45, 2));
  const lInfo = (d, s, n) => I(d, 'Hepatocytes make bile, process nutrients arriving in the portal vein, store glycogen and vitamins, build plasma proteins such as albumin and clotting factors, and detoxify drugs and ammonia.', s, n);
  add({ id: 'liver-right-lobe', name: 'Liver - right lobe', latin: 'Lobus hepatis dexter', region: 'abdomen', geometry: smooth(grid(44, LPN, (s, u) => liverAt(xR + (xF - xR) * (1 - Math.cos(s * Math.PI / 2)), Math.round(u * LPN)), { caps: true })),
    color: H.COLORS.liver, matOpts: { roughness: 0.35 }, parent: 'liver', tags: ['liver'],
    info: lInfo('Largest lobe of the liver, filling the right upper abdomen under the right dome of the diaphragm. Its smooth diaphragmatic surface is domed; below, it ends in a sharp inferior border, and its concave visceral surface carries impressions of the colon, right kidney, duodenum and the gallbladder fossa.',
      'The whole liver weighs 1.4-1.6 kg and measures about 21-22 cm across and up to 15-17 cm front-to-back; the anatomical right lobe is about six times larger than the left.',
      'Surgeons divide the liver along Cantlie\'s line (gallbladder fossa to IVC) into functional right and left halves and 8 Couinaud segments, each with its own portal and biliary supply.') });
  add({ id: 'liver-left-lobe', name: 'Liver - left lobe', latin: 'Lobus hepatis sinister', region: 'abdomen', geometry: smooth(grid(28, LPN, (s, u) => liverAt(xF + (xT - xF) * Math.sin(s * Math.PI / 2), Math.round(u * LPN)), { caps: true })),
    color: '#94402f', matOpts: { roughness: 0.35 }, parent: 'liver', tags: ['liver'],
    info: lInfo('Thinner, flattened lobe to the left of the falciform ligament, lying over the front of the stomach and reaching into the left upper abdomen under the heart.',
      'About 2-3 cm thick, reaching about 8 cm left of the midline.',
      'Its left lateral segments (II and III) are the part most often donated by a living adult for a liver transplant into a child.') });
  const caud = H.blob([0.014, 0.024, 0.012], { ws: 28, hs: 20, noise: { amp: 0.06, freq: 2.5 }, deform: (p) => 1 + 0.25 * H.smoothstep(0.2, 0.9, -p.y) * Math.max(0, p.x) });
  caud.translate(-0.013, ly - 0.005, -0.036);
  add({ id: 'liver-caudate-lobe', name: 'Liver - caudate lobe', latin: 'Lobus caudatus', region: 'abdomen', geometry: caud, color: '#7e3325', matOpts: { roughness: 0.35 }, parent: 'liver', tags: ['liver'],
    info: lInfo('Small lobe on the posterior visceral surface, between the groove for the inferior vena cava and the fissure for the ligamentum venosum; its lower end forms the papillary process.',
      'About 6 cm high and 3 cm wide (segment I).',
      'It drains straight into the IVC by its own short hepatic veins, so in Budd-Chiari syndrome (hepatic vein blockage) it is spared and enlarges.') });
  const quad = H.blob([0.018, 0.009, 0.02], { ws: 28, hs: 18, noise: { amp: 0.05, freq: 2 } }); quad.translate(-0.03, ly - 0.022, 0.045);
  add({ id: 'liver-quadrate-lobe', name: 'Liver - quadrate lobe', latin: 'Lobus quadratus', region: 'abdomen', geometry: quad, color: '#9a4636', matOpts: { roughness: 0.35 }, parent: 'liver', tags: ['liver'],
    info: lInfo('Rectangular area of the visceral surface in front of the porta hepatis, between the gallbladder fossa and the fissure for the ligamentum teres.',
      'About 5 cm long and 3 cm wide (segment IVb).',
      'Although classically counted with the right lobe, its blood supply and bile drainage come from the left branches, so functionally it belongs to the left liver.') });
  // falciform ligament: thin sagittal sheet over the anterosuperior surface at the lobe boundary + round ligament to the umbilicus in its free edge
  { const pts = [], hs = [];
    for (let j = 1; j < LPN; j++) { const q = LP[j]; if (q.x < -0.25) break;
      const t = LP[j + 1].clone().sub(LP[j - 1]); const nz = t.y * tab(LS, xF, 2), ny = -t.x * tab(LS, xF, 4), nl = Math.hypot(nz, ny) || 1;
      const p = liverAt(xF, j), h = 0.004 + 0.006 * H.smoothstep(0.7, -0.6, q.y); pts.push([xF, p[1] + ny / nl * h, p[2] + nz / nl * h]); hs.push(h); }
    const fal = sweep(pts, (f) => [0.0009, hs[Math.min(hs.length - 1, Math.round(f * (hs.length - 1)))] * H.smoothstep(0, 0.06, f) * H.smoothstep(1, 0.9, f) + 0.0005], { ref: [1, 0, 0], step: 0.003, radial: 8 });
    const notch = liverAt(xF, 0), teres = duct([[xF, notch[1] - 0.002, notch[2] + 0.004], [xF * 0.5, 1.09, 0.086], [0, L.y.umbilicus + 0.004, 0.088]], 0.0017, 8);
    add({ id: 'falciform-ligament', name: 'Falciform ligament', latin: 'Ligamentum falciforme hepatis', region: 'abdomen', geometry: H.merge([fal, teres]), color: '#e8d7c6', matOpts: { roughness: 0.6, opacity: 0.75, side: DS }, parent: 'liver', tags: ['liver', 'peritoneum'],
      info: I('Sickle-shaped double fold of peritoneum attaching the front of the liver to the diaphragm and anterior abdominal wall. Its free lower edge carries the ligamentum teres (round ligament), the fibrous remnant of the fetal umbilical vein, down to the umbilicus.',
        'Anchors the liver to the abdominal wall and marks the boundary between the anatomical right and left lobes.',
        'A thin sheet a few millimetres thick running from the diaphragm to the umbilicus.',
        'In portal hypertension, small paraumbilical veins alongside it enlarge and radiate from the umbilicus as "caput medusae".') }); }

  // ================================================================ GALLBLADDER & BILIARY TREE
  const gb = O.gallbladder, gbc = V(gb.center[0], gb.center[1] - 0.007, gb.center[2] - 0.008), gbd = V(-0.1, -0.85, 0.52).normalize(), gbL = gb.size[1];
  const gbNeck = gbc.clone().addScaledVector(gbd, -gbL / 2), gbTip = gbc.clone().addScaledVector(gbd, gbL / 2);
  const gbProf = [[0, 0], [0.0035, 0.001], [0.0055, 0.008], [0.0085, 0.018], [0.0115, 0.032], [0.0135, 0.047], [0.0145, 0.058], [0.013, 0.066], [0.0095, 0.0715], [0.005, 0.0742], [0, 0.075]].map(q => [q[0] * gb.size[0] / 0.03, q[1] * gbL / 0.075]);
  const gbG = H.span(H.lathe(gbProf, { segments: 32 }), gbNeck, gbTip);
  add({ id: 'gallbladder', name: 'Gallbladder', latin: 'Vesica biliaris', region: 'abdomen', geometry: gbG, color: H.COLORS.gallbladder, matOpts: { roughness: 0.35, side: DS }, tags: ['biliary'],
    info: I('Pear-shaped sac lying in a fossa on the underside of the right liver. Its rounded fundus projects just beyond the liver\'s lower border at the tip of the right 9th costal cartilage; the body narrows into a neck that continues as the cystic duct.',
      'Stores bile between meals and concentrates it up to 10-fold, then contracts under the hormone cholecystokinin when fatty food reaches the duodenum.',
      '7-10 cm long and 3-4 cm wide; holds about 30-50 mL.',
      'Gallstones affect 10-15% of adults. Inflammation (cholecystitis) causes Murphy\'s sign: pain that stops a deep breath when the examiner presses under the right ribs.') });
  const porta = [-0.03, 1.148, 0.012], junc = [-0.038, 1.125, 0.018];
  const bile = '#5f9a45', bInfo = I;
  add({ id: 'hepatic-duct-r', name: 'Right hepatic duct', latin: 'Ductus hepaticus dexter', side: 'R', region: 'abdomen', depth: 0.5, geometry: duct([[-0.085, 1.165, 0.0], [-0.06, 1.156, 0.008], porta], 0.0017), color: bile, parent: 'liver', tags: ['biliary', 'interior'],
    info: bInfo('Collects bile from the functional right half of the liver (segments V-VIII) and joins the left hepatic duct at the porta hepatis.', 'Drains bile out of the right liver.', 'About 1 cm long outside the liver, 3-4 mm wide.', 'Variations in how the right-sided ducts join are common, a known hazard during gallbladder surgery.') });
  add({ id: 'hepatic-duct-l', name: 'Left hepatic duct', latin: 'Ductus hepaticus sinister', side: 'L', region: 'abdomen', depth: 0.5, geometry: duct([[0.045, 1.183, 0.042], [0.015, 1.17, 0.03], [-0.01, 1.155, 0.018], porta], 0.0017), color: bile, parent: 'liver', tags: ['biliary', 'interior'],
    info: bInfo('Collects bile from the functional left half of the liver (segments II-IV) and runs along the base of the quadrate lobe to the porta hepatis.', 'Drains bile out of the left liver.', 'About 2 cm long outside the liver (longer than the right), 3-4 mm wide.', 'Its long horizontal extrahepatic course makes it the preferred site for surgical bile-duct reconstruction.') });
  add({ id: 'common-hepatic-duct', name: 'Common hepatic duct', latin: 'Ductus hepaticus communis', region: 'abdomen', depth: 0.3, geometry: duct([porta, [-0.034, 1.137, 0.016], junc], 0.0027), color: bile, tags: ['biliary'],
    info: bInfo('Formed at the porta hepatis by the union of the right and left hepatic ducts; descends in the free edge of the lesser omentum to meet the cystic duct.', 'Carries all the bile leaving the liver.', 'About 3 cm long and 6 mm wide.', 'With the cystic duct and the liver it bounds the hepatocystic (Calot\'s) triangle, which surgeons clear before clipping the cystic duct and artery.') });
  add({ id: 'cystic-duct', name: 'Cystic duct', latin: 'Ductus cysticus', region: 'abdomen', depth: 0.3, geometry: duct([gbNeck, [-0.059, 1.145, 0.032], [-0.051, 1.139, 0.027], [-0.044, 1.131, 0.022], junc], 0.0018), color: bile, parent: 'gallbladder', tags: ['biliary'],
    info: bInfo('Short, tortuous duct from the neck of the gallbladder to the common hepatic duct; its lining forms a spiral fold (valve of Heister).', 'Lets bile flow into the gallbladder for storage and out again when it contracts.', 'About 3-4 cm long and 2-3 mm wide.', 'A stone impacted here causes biliary colic or acute cholecystitis.') });
  add({ id: 'common-bile-duct', name: 'Common bile duct', latin: 'Ductus choledochus', region: 'abdomen', depth: 0.3, geometry: duct([junc, [-0.041, 1.113, 0.01], [-0.044, 1.097, 0.0], [-0.047, 1.082, 0.0], amp], 0.003), color: bile, tags: ['biliary'],
    info: bInfo('Formed where the cystic and common hepatic ducts join; runs down behind the first part of the duodenum and through the back of the pancreatic head, then unites with the pancreatic duct at the hepatopancreatic ampulla on the descending duodenum.', 'Delivers bile into the duodenum through the sphincter of Oddi.', 'About 8 cm long and up to 6 mm wide.', 'A stone or pancreatic-head tumour blocking it causes obstructive jaundice with pale stools and dark urine; a painless palpable gallbladder suggests cancer (Courvoisier\'s law).') });

  // ================================================================ LARGE INTESTINE: one continuous curve (cecum -> anus) split into named parts
  const co = O.colon, cec = co.cecum, hf = co.hepaticFlexure, sf = co.splenicFlexure, an = O.analCanal;
  const HF = [hf[0] + 0.002, hf[1] - 0.012, hf[2] + 0.004];          // kept just below the liver's colic impression
  const SF = [sf[0] - 0.004, sf[1] - 0.008, sf[2] + 0.022];          // in front of the spleen's lower pole
  const SIG0 = [0.1, 0.965, -0.005], RS = [0.004, 0.952, -0.035], AJ = [0, 0.884, -0.038];
  const CC = curveOf([[cec[0] - 0.001, cec[1] + 0.005, cec[2]], [-0.106, 1.035, 0.021], [-0.109, 1.075, 0.011], HF, [-0.095, 1.087, 0.03], [-0.072, 1.055, 0.046], [-0.038, 1.04, 0.054],
    [0, 1.03, 0.057], [0.035, 1.022, 0.058], [0.068, 1.04, 0.054], [0.095, 1.085, 0.036], [0.11, 1.125, 0.012], SF, [0.119, 1.125, -0.028], [0.119, 1.08, -0.033], [0.117, 1.03, -0.028],
    [0.113, 0.99, -0.02], SIG0, [0.085, 0.948, 0.012], [co.sigmoid[0] - 0.005, co.sigmoid[1], co.sigmoid[2] + 0.002], [0.042, 0.955, 0.018], [0.028, 0.975, 0.008], [0.013, 0.968, -0.02], RS,
    [co.rectum[0], co.rectum[1], co.rectum[2] + 0.018], [0, 0.91, -0.043], [0, 0.894, -0.039], AJ, [an[0], an[1] + 0.001, an[2] + 0.006], [0, 0.849, -0.066]]);
  const cLen = CC.getLength(), fA = fracOf(CC, HF), fT = fracOf(CC, SF), fD = fracOf(CC, SIG0), fS = fracOf(CC, RS), fR = fracOf(CC, AJ);
  // calibre: [f, radius] - widest at the cecum, narrowing to the sigmoid, rectal ampulla, anal canal
  const CR = [[0, 0.029], [fA, co.r + 0.001], [(fA + fT) / 2, co.r - 0.004], [fT, co.r - 0.003], [fD, co.r - 0.005], [fS, co.r - 0.006], [(fS + fR) / 2 + 0.01, co.r + 0.002], [fR - 0.004, 0.017], [fR + 0.01, 0.012], [1, 0.0095]];
  function colR(f, a) {
    const base = tab(CR, f, 1); if (f > fS - 0.005) return base;                  // rectum & anal canal: no haustra, taeniae merge into a continuous coat
    const s = f * cLen, hs = Math.pow(Math.abs(Math.sin(Math.PI * s / 0.03 + 0.3 * Math.sin(s * 40))), 0.7);   // haustra between semilunar folds
    let band = 0; for (let k = 0; k < 3; k++) { let d = Math.abs(((a - k * 2 * Math.PI / 3) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)); d = Math.min(d, 2 * Math.PI - d); band = Math.max(band, gauss(d, 0, 0.17)); }
    const fade = H.smoothstep(fS - 0.005, fS - 0.05, f);
    return base * (1 - fade * (0.09 - 0.17 * hs * (1 - band))) + fade * 0.0012 * band;   // raised taeniae coli strips
  }
  const colMat = (c) => M(c, { side: DS, roughness: 0.55 });
  const cParts = [
    ['colon-ascending', 'Ascending colon', 'Colon ascendens', 0, fA, 'abdomen', H.COLORS.colon,
      I('Rises from the cecum up the right flank to the hepatic (right colic) flexure under the liver; it is retroperitoneal, fixed to the back wall.', 'Absorbs water and salts from the liquid contents arriving from the ileum and moves them upward by periodic mass movements.', 'About 15 cm long and 5-6 cm wide.', 'Its surface shows the colon\'s hallmarks: three longitudinal muscle bands (taeniae coli), pouches between them (haustra) and small fatty tags (epiploic appendages).')],
    ['colon-transverse', 'Transverse colon', 'Colon transversum', fA, fT, 'abdomen', '#c9917f',
      I('Most mobile part of the colon, slung on the transverse mesocolon from the hepatic flexure to the higher splenic flexure and sagging below the stomach; the greater omentum hangs from it.', 'Continues water absorption and bacterial fermentation, compacting the contents into faeces.', 'About 45 cm long and about 5 cm wide.', 'The region near the splenic flexure is a watershed between the superior and inferior mesenteric arteries, so it is vulnerable to ischaemic colitis.')],
    ['colon-descending', 'Descending colon', 'Colon descendens', fT, fD, 'abdomen', '#c48a78',
      I('Runs down the left flank from the splenic flexure to the left iliac fossa; retroperitoneal and narrower than the right colon.', 'Stores and propels increasingly solid faeces toward the sigmoid colon.', 'About 25 cm long and about 4 cm wide.', 'Diverticula - pouches pushed out where vessels pierce the wall - are common here and in the sigmoid in people on low-fibre diets.')],
    ['colon-sigmoid', 'Sigmoid colon', 'Colon sigmoideum', fD, fS, 'pelvis', '#c08574',
      I('S-shaped loop on its own mesentery (sigmoid mesocolon) from the pelvic brim to the rectum in front of the third sacral vertebra.', 'Stores faeces until defecation.', 'About 40 cm long (very variable) and 3-4 cm wide.', 'Its long mobile mesentery lets it twist (sigmoid volvulus), and it is the commonest site of diverticulitis.')],
    ['rectum', 'Rectum', 'Rectum', fS, fR, 'pelvis', '#b97a6a',
      I('Final segment of the large intestine, following the curve of the sacrum and widening below into the rectal ampulla; it has no haustra because the taeniae spread into a continuous muscle coat.', 'Holds faeces before defecation; stretch receptors in its wall trigger the urge to defecate.', 'About 12-15 cm long; the ampulla can widen to about 5 cm.', 'Three transverse rectal folds (Houston\'s valves) project into it; a finger in the rectum can feel the prostate or cervix through its front wall.')],
    ['anal-canal', 'Anal canal', 'Canalis analis', fR, 1, 'pelvis', '#a86a62',
      I('Last 3-4 cm of the gut. At the anorectal junction the puborectalis sling pulls the gut forward, and the canal then runs down and back through the pelvic floor to the anus.', 'Keeps faeces and gas in with the internal (involuntary) and external (voluntary) anal sphincters, relaxing during defecation.', 'About 3-4 cm long.', 'The pectinate (dentate) line marks an embryological boundary: haemorrhoids above it are painless, those below it painful, because of different nerve supply.')]];
  for (const q of cParts) add({ id: q[0], name: q[1], latin: q[2], region: q[5], geometry: sweep(CC, colR, { t0: q[3], t1: q[4], step: 0.0035, radial: 18, caps: q[4] === 1 ? 'end' : false }), material: colMat(q[6]), tags: ['gi-tract', 'large-intestine'], info: q[7] });
  // cecum: blind sacculated pouch below the ileocecal junction; appendix from its posteromedial wall
  const cecG = H.blob([0.033, 0.03, 0.03], { ws: 36, hs: 26, deform: (p) => 1 + 0.07 * Math.pow(Math.abs(Math.sin(p.y * 4.2 + 0.5)), 0.7) * (1 - 0.8 * Math.pow(Math.abs(Math.cos(Math.atan2(p.z, p.x) * 1.5)), 8)) - 0.12 * Math.max(0, p.y) * p.y });
  cecG.translate(cec[0], cec[1] - 0.008, cec[2]);
  add({ id: 'cecum', name: 'Cecum', latin: 'Caecum', region: 'abdomen', geometry: cecG, material: colMat('#cc9480'), tags: ['gi-tract', 'large-intestine'],
    info: I('Blind pouch that begins the large intestine in the right iliac fossa, below the point where the ileum enters through the ileocecal valve; the appendix hangs from it.', 'Receives liquid contents from the ileum and begins absorbing water and salts; the ileocecal valve limits backflow of colonic bacteria.', 'About 6 cm long and 7.5 cm wide.', 'As the widest part of the colon it is the part most likely to split when the large bowel is obstructed (law of Laplace).') });
  const apB = O.appendix.base;
  add({ id: 'appendix', name: 'Vermiform appendix', latin: 'Appendix vermiformis', region: 'abdomen', geometry: H.tube([apB, [apB[0] + 0.006, apB[1] - 0.017, apB[2] + 0.003], [apB[0] + 0.018, apB[1] - 0.029, apB[2]], [apB[0] + 0.034, apB[1] - 0.034, apB[2] - 0.007], [apB[0] + 0.048, apB[1] - 0.03, apB[2] - 0.015], [apB[0] + 0.058, apB[1] - 0.023, apB[2] - 0.022]],
    t => 0.0034 * (t > 0.9 ? Math.sqrt(Math.max(0.02, 1 - Math.pow((t - 0.9) / 0.1, 2))) : 1) + 0.0004 * Math.sin(t * 40), { radial: 10, step: 0.003 }), color: '#c98a7c', tags: ['gi-tract', 'large-intestine', 'lymphoid'],
    info: I('Narrow, worm-like blind tube opening from the posteromedial wall of the cecum about 2 cm below the ileocecal valve, where the three taeniae coli converge; shown in the common pelvic-hanging position (retrocecal is most common).', 'Its wall is packed with lymphoid tissue, and it may serve as a safe-house that re-seeds the colon with helpful bacteria after diarrhoeal illness.', 'Usually 6-10 cm long (average about 8 cm), about 6 mm wide.', 'Appendicitis is the commonest abdominal surgical emergency; pain classically moves from the umbilicus to McBurney\'s point, one-third of the way from the right anterior superior iliac spine to the umbilicus.') });

  // ================================================================ JEJUNUM & ILEUM: one deterministic self-avoiding wander (DJ flexure -> ileocecal junction)
  // steered through waypoints, kept inside the trunk and clear of the other viscera (capsule obstacles), then split into jejunum / ileum
  const closest = (p, a, b) => { const ab = b.clone().sub(a), l2 = ab.lengthSq(); return l2 < 1e-12 ? a.clone() : a.clone().addScaledVector(ab, H.clamp(p.clone().sub(a).dot(ab) / l2, 0, 1)); };
  const obst = [], cap = (a, b, r) => obst.push({ a: H.v3(a), b: H.v3(b), r }), RB = 0.014, CL = RB + 0.004;
  for (let i = 0; i < 20; i++) { const f = 0.3 + 0.7 * i / 19; cap(SC.getPointAt(f), SC.getPointAt(Math.min(1, f + 0.04)), stomR(f, -Math.PI / 2)[1] * 1.05 + CL); }
  for (let i = 0; i < 16; i++) cap(DU.getPointAt(i / 16), DU.getPointAt((i + 1) / 16), 0.017 + CL);
  for (let i = 0; i < 44; i++) { const f = fR * i / 44; cap(CC.getPointAt(f), CC.getPointAt(fR * (i + 1) / 44), tab(CR, f, 1) * 1.05 + CL); }
  cap([cec[0], cec[1] - 0.008, cec[2]], [cec[0], cec[1] - 0.008, cec[2]], 0.034 + CL);
  cap([pc.head[0] - 0.004, pc.head[1] - 0.008, pc.head[2]], [pc.head[0] - 0.004, pc.head[1] - 0.008, pc.head[2]], 0.025 + CL);
  for (let i = 0; i < 6; i++) cap(PC.getPointAt(i / 6), PC.getPointAt((i + 1) / 6), 0.013 + CL);
  cap([-0.12, lv.center[1], 0], [0, lv.center[1] + 0.012, 0.02], 0.058 + CL);
  for (const k of [O.kidneyL, O.kidneyR]) cap([k.center[0], k.center[1] - 0.05, k.center[2]], [k.center[0], k.center[1] + 0.05, k.center[2]], 0.03 + CL);
  cap([0, L.spine.S1.y, -0.05], [0, L.spine.T12.y, -0.055], 0.03 + CL);                                          // vertebral bodies, aorta, IVC
  for (const sx of [1, -1]) cap([sx * 0.035, L.spine.L1.y, -0.05], [sx * 0.065, L.spine.S1.y - 0.03, -0.025], 0.02 + CL);   // psoas
  cap([O.bladder.center[0], O.bladder.center[1] - 0.005, O.bladder.center[2] - 0.005], [0, O.bladder.center[1] - 0.005, O.bladder.center[2] - 0.005], 0.04 + CL);
  cap([0, 0.94, 0.015], [0, 0.965, 0.02], 0.026 + CL);                                                             // uterus / seminal vesicles zone
  const icj = [cec[0] + 0.028, cec[1] + 0.008, cec[2] - 0.008];   // ileocecal junction (medial wall of the cecum)
  function wander(o) {
    const P = [H.v3(o.start)], step = 0.008, n = Math.round(o.len / step), wp = o.via.map(H.v3), end = H.v3(o.end), d = H.v3(o.dir).normalize();
    for (let i = 1; i <= n; i++) {
      const p = P[i - 1], t = i / n, s = o.seed, steer = V(H.noise3(i * 0.075 + s, s * 1.7, 0.3), H.noise3(s * 2.3, i * 0.075 + s, 1.9), H.noise3(3.7, s * 0.9, i * 0.075 + s)).multiplyScalar(1.2);
      const wpos = Math.min(0.999, t / 0.92) * (wp.length - 1), k = Math.floor(wpos);
      const target = t < 0.92 ? wp[k].clone().lerp(wp[k + 1], wpos - k) : end, toT = target.clone().sub(p), dT = toT.length();
      steer.addScaledVector(toT.normalize(), (t < 0.92 ? 1.0 : 3) * Math.min(1, dT / 0.04));
      for (let j = 0; j < i - 7; j++) { const v = p.clone().sub(P[j]), dd = v.length(); if (dd < o.sep) steer.addScaledVector(v, 2 * (o.sep - dd) / o.sep / Math.max(dd, 1e-4)); }
      for (const c of obst) { const v = p.clone().sub(closest(p, c.a, c.b)), dd = v.length(); if (dd < c.r) steer.addScaledVector(v, 9 * (c.r - dd) / c.r / Math.max(dd, 1e-4)); }
      const bx = t < o.split ? o.boxA : o.boxB;
      ['x', 'y', 'z'].forEach((ax, q) => { if (p[ax] < bx[0][q]) steer[ax] += (bx[0][q] - p[ax]) * 150; if (p[ax] > bx[1][q]) steer[ax] -= (p[ax] - bx[1][q]) * 150; });
      const tk = L.trunkAt(p.y), ex = p.x / (tk.rx - 0.045), ez = (p.z - tk.cz) / (tk.rz - 0.04), e = Math.hypot(ex, ez);
      if (e > 1) steer.add(V(-ex, 0, -ez).multiplyScalar(30 * (e - 1)));
      const nd = d.clone().addScaledVector(steer, 0.2).normalize(), ang = d.angleTo(nd);
      if (ang > 0.3) d.lerp(nd, 0.3 / ang).normalize(); else d.copy(nd);
      const q = p.clone().addScaledVector(d, step); ['x', 'y', 'z'].forEach((ax, m) => { q[ax] = H.clamp(q[ax], bx[0][m] - 0.004, bx[1][m] + 0.004); }); P.push(q);
      if (t > 0.92 && p.distanceTo(end) < 0.012) break;
    }
    P.push(end);
    for (let it = 0; it < 3; it++) for (let i = 1; i < P.length - 1; i++) P[i] = P[i - 1].clone().add(P[i + 1]).multiplyScalar(0.25).addScaledVector(P[i], 0.5);
    return P.filter((q, i) => i % 2 === 0 || i === P.length - 1);
  }
  const siPts = wander({ start: djf, dir: [0.2, -0.5, 0.8], end: icj, seed: 8.8, len: 2.8, sep: 0.03, split: 0.5,
    via: [[0.05, 1.07, 0.01], [0.085, 1.035, 0.0], [0.07, 0.99, 0.02], [0.03, 0.99, 0.045], [0.08, 0.97, 0.04], [0.05, 1.02, 0.01], [0.0, 0.985, 0.0],
      [-0.03, 0.96, 0.045], [-0.07, 0.99, 0.02], [-0.04, 0.945, 0.01], [0.02, 0.955, 0.05], [-0.05, 0.97, 0.055], [-0.075, 0.955, 0.025]],
    boxA: [[-0.03, 0.96, -0.02], [0.1, 1.085, 0.058]], boxB: [[-0.09, 0.949, -0.02], [0.06, 1.02, 0.058]] });
  const SI = curveOf(siPts), siLen = SI.getLength();
  const siR = (f) => (f < 0.5 ? RB : RB - 0.0028 * (f - 0.5) / 0.5) * (1 + 0.04 * Math.sin(f * siLen / 0.05 * Math.PI * 2)) * (f < 0.01 ? 0.95 : 1);
  const jej = sweep(SI, siR, { t1: 0.5, step: 0.006, radial: 10, caps: 'start' }), ile = sweep(SI, siR, { t0: 0.5, step: 0.006, radial: 10, caps: 'end' });
  jej.userData.path = siPts; ile.userData.path = siPts;
  add({ id: 'jejunum', name: 'Jejunum', latin: 'Jejunum', region: 'abdomen', geometry: jej, material: M('#d59a8a', { side: DS }), tags: ['gi-tract', 'small-intestine'],
    info: I('Middle part of the small intestine, starting at the duodenojejunal flexure and coiling mostly in the upper left of the infracolic abdomen; thicker-walled, wider and redder than the ileum, with tall, closely packed circular folds inside.',
      'Main site of absorption of sugars, amino acids and fatty acids through its villi.',
      'About 2.5 m long (two-fifths of the jejunoileum) and 2.5-3 cm wide; a representative 1.2 m of coil is modelled.',
      'Its name comes from Latin jejunus, "empty", because it was usually found empty at autopsy.') });
  add({ id: 'ileum', name: 'Ileum', latin: 'Ileum', region: 'abdomen', geometry: ile, material: M('#dcac9c', { side: DS }), tags: ['gi-tract', 'small-intestine'],
    info: I('Final and longest part of the small intestine, coiled in the lower right abdomen and pelvis, ending at the ileocecal valve in the medial wall of the cecum; its wall contains Peyer\'s patches.',
      'Absorbs vitamin B12 and bile salts, plus any nutrients that escaped the jejunum.',
      'About 3.5 m long (three-fifths of the jejunoileum), 2-2.5 cm wide; a representative 1.2 m of coil is modelled.',
      'Crohn\'s disease most often affects the terminal ileum; a Meckel\'s diverticulum (about 2% of people) lies about 60 cm from its end.') });

  // ================================================================ MESENTERY: pleated fan from its oblique root to the whole jejunoileum
  { const r0 = V(djf[0] - 0.006, djf[1] - 0.008, -0.018), r1 = V(icj[0] + 0.012, icj[1] - 0.02, -0.012), K = siPts.length;
    const mes = grid(K - 1, 5, (s, u) => {
      const k = Math.round(s * (K - 1)), R = r0.clone().lerp(r1, s), E = siPts[k].clone(); E.addScaledVector(R.clone().sub(E).normalize(), RB * 0.8);
      const Q = R.lerp(E, u); Q.z += 0.006 * Math.sin(u * Math.PI); return [Q.x, Q.y, Q.z];
    }, { noOrient: true });
    add({ id: 'mesentery', name: 'Mesentery (of the small intestine)', latin: 'Mesenterium', region: 'abdomen', depth: 0.1, geometry: mes, material: M('#f0dcb0', { opacity: 0.3, side: DS, roughness: 0.6 }), tags: ['peritoneum'],
      info: I('Fan-shaped double fold of peritoneum suspending the jejunum and ileum from an oblique root on the posterior abdominal wall; its free border is pleated to match the full length of the intestine.',
        'Carries the superior mesenteric vessels, lymphatics, lymph nodes and nerves to the small intestine while letting it move freely.',
        'Root about 15 cm long, from the duodenojejunal flexure (left of L2) to the right sacroiliac joint; about 20 cm from root to gut edge.',
        'Reclassified as a single continuous organ in 2016; twisting of the gut around its narrow root (volvulus) cuts off the intestinal blood supply.') }); }

  // ================================================================ GREATER OMENTUM: translucent fatty apron from the greater curvature over the intestines
  { const TOP = [[-0.105, 1.085], [-0.05, 1.075], [-0.02, 1.068], [0.02, 1.05], [0.05, 1.058], [0.08, 1.08], [0.105, 1.11], [0.125, 1.135]];
    const zFront = (x, y) => { const tk = L.trunkAt(y); return tk.cz + tk.rz * Math.pow(Math.max(0, 1 - Math.pow(Math.min(0.99, Math.abs(x) / tk.rx), tk.n)), 1 / tk.n) - 0.025; };
    const om = grid(30, 44, (s, u) => {
      const x = -0.105 + 0.23 * u, top = tab(TOP, x, 1), bot = 0.955 + 0.006 * Math.sin(x * 70) + 0.01 * u * u, y = top + (bot - top) * s;
      const z = H.lerp(0.058, zFront(x, y), H.smoothstep(0, 0.22, s)) + 0.003 * H.fbm(x * 60, y * 60, 1.3, 2) * s;
      return [x, y, z];
    }, { noOrient: true });
    add({ id: 'greater-omentum', name: 'Greater omentum', latin: 'Omentum majus', region: 'abdomen', depth: 0, geometry: om, material: M('#ecd28e', { opacity: 0.2, side: DS, roughness: 0.7 }), tags: ['peritoneum'],
      info: I('Apron-like, four-layered fold of peritoneum hanging from the greater curvature of the stomach in front of the intestines and folding back up to the transverse colon; it is usually laden with fat.',
        'Stores fat and, through immune "milky spots", sticks to and walls off areas of infection or inflammation - the "policeman of the abdomen".',
        'Hangs about 20-25 cm down in front of the small intestine; from paper-thin to several centimetres of fat thick.',
        'Surgeons use it as a vascularised flap to patch perforations, and ovarian cancer often spreads into it ("omental cake").') }); }

  return g;
});
