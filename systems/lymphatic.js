/* systems/lymphatic.js - Lymphatic & immune system. Layer LYMPH, system 'lymphatic'.
   Thymus (two lobes + medulla), spleen (with hilum, red/white pulp), tonsils (palatine x2, pharyngeal, lingual),
   regional lymph node groups (clusters of bean-shaped nodes with afferent/efferent threads), cisterna chyli,
   thoracic duct, right lymphatic duct, superficial + deep lymphatic trunks per side, Peyer's patches, sternal red marrow.
   Every position comes from L.* landmarks (metres); all shapes are lofts/tubes/blobs with fbm texture; deterministic. */
ANATOMY.register('lymphatic', {
  name: 'Lymphatic & immune',
  description: 'Thymus, spleen, tonsils, regional lymph node groups with afferent/efferent vessels, cisterna chyli, thoracic and right lymphatic ducts, limb and lumbar lymphatic trunks, Peyer\'s patches and sternal red marrow'
}, function (THREE, H, L, ctx) {
  const SYS = 'lymphatic', LAYER = H.LAYER.LYMPH, V = H.V;
  const root = H.group('lymphatic');
  const COL = { node: H.COLORS.lymphNode, vessel: H.COLORS.lymph, duct: '#6db86e', chyle: '#b7dfa6', spleen: H.COLORS.spleen, redPulp: '#5c1f2f', whitePulp: '#e9dfe2', hilum: '#9c4a5c',
    thymus: H.COLORS.thymus, medulla: '#f0d6c6', tonsil: H.COLORS.tonsil, marrow: H.COLORS.marrow, peyer: '#cfe0a0' };

  // ---------------------------------------------------------------- private helpers
  function rough(g, amp, freq, seed) { return H.displace(g, p => amp * H.fbm(p.x * freq + seed, p.y * freq + seed * 0.37, p.z * freq + seed * 1.91, 2)); }
  function put(g, pos, rot) { if (rot) H.transform(g, { rot }); g.translate(pos[0], pos[1], pos[2]); return g; }
  function mk(group, spec) { const m = H.part(Object.assign({ system: SYS, layer: LAYER }, spec)); group.add(m); return m; }
  function mk2(group, spec) { const p = H.pair(Object.assign({ system: SYS, layer: LAYER }, spec)); group.add(p[0], p[1]); return p; }
  // deterministic pseudo-random in [-1,1] from an index, a seed and a channel
  const rnd = (i, seed, k) => H.noise3(i * 3.17 + seed * 1.13 + 0.5, seed * 0.37 + k * 2.19 + 0.25, i * 1.29 + k * 0.53 + 0.75);
  function perp(d) { const a = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0); return a.cross(d).normalize(); }
  function curveLen(pts) { return new THREE.CatmullRomCurve3(pts.map(H.v3), false, 'centripetal').getLength(); }
  // beaded lymphatic vessel: lymphangions swell between the valves (every ~1.5 cm)
  function beaded(pts, base, o = {}) {
    const len = curveLen(pts), period = o.period || 0.015;
    const rf = t => base * (0.8 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(t * len / period * Math.PI * 2), 2));
    return H.tube(pts, rf, { radial: o.radial || 6, step: o.step || period / 4 });
  }
  // one lymph node: bean with a hilar dent. local axes: X thickness, Y long axis, Z width; hilum on -Z
  function bean(len, wid, thk, seed) {
    return H.blob([thk / 2, len / 2, wid / 2], { ws: 12, hs: 8, deform: p => {
      const dent = 0.38 * H.smoothstep(0.1, 1, -p.z) * Math.exp(-p.y * p.y * 3);
      return (1 - dent) * (1 + 0.06 * H.fbm(p.x * 2 + seed, p.y * 2 + seed * 0.4, p.z * 2 + seed * 1.7, 2));
    } });
  }
  /* nodeChain(pts, o): beans strung along pts (each bean's long axis follows the chain, a little tilted), each with an efferent
     thread leaving its hilum for the next node (the last one runs on along the chain) and o.afferents threads entering its convex face.
     o: { size: base length (m) | fn(i), seed, hilum: [x,y,z] preferred hilum direction, afferents=1, effLen=1.6, threadR=0.0006 }. Returns geometries. */
  function nodeChain(pts, o = {}) {
    const seed = o.seed || 1, base = o.size || 0.009, n = pts.length, cs = pts.map(H.v3), out = [];
    const dirs = [], hils = [], lens = [];
    for (let i = 0; i < n; i++) {
      const prev = cs[Math.max(0, i - 1)], next = cs[Math.min(n - 1, i + 1)];
      let d = next.clone().sub(prev); if (d.lengthSq() < 1e-10) d = V(0, 1, 0); d.normalize();
      const q1 = perp(d), q2 = d.clone().cross(q1);
      d.addScaledVector(q1, 0.35 * rnd(i, seed, 1)).addScaledVector(q2, 0.35 * rnd(i, seed, 2)).normalize();
      let h;
      if (o.hilum) { h = H.v3(o.hilum); h.addScaledVector(d, -h.dot(d)); if (h.lengthSq() < 1e-8) h = perp(d); h.normalize(); }
      else { const ang = rnd(i, seed, 3) * Math.PI, p1 = perp(d), p2 = d.clone().cross(p1); h = p1.multiplyScalar(Math.cos(ang)).addScaledVector(p2, Math.sin(ang)).normalize(); }
      const len = (typeof base === 'function' ? base(i) : base) * (1 + 0.3 * rnd(i, seed, 4));
      const wid = len * 0.62, thk = len * 0.48;
      const g = bean(len, wid, thk, seed + i * 0.61);
      const Y = d.clone(), Z = h.clone().negate(), X = Y.clone().cross(Z).normalize();
      const m = new THREE.Matrix4().makeBasis(X, Y, Z); m.setPosition(cs[i]);
      g.applyMatrix4(m); g.computeVertexNormals();
      out.push(g); dirs.push(d); hils.push(h); lens.push(len);
    }
    if (o.threads !== false) {
      const r = o.threadR || 0.0006, na = o.afferents == null ? 1 : o.afferents;
      for (let i = 0; i < n; i++) {
        const c = cs[i], d = dirs[i], h = hils[i], len = lens[i];
        const a = c.clone().addScaledVector(h, len * 0.62 * 0.5 * 0.8);   // hilar surface
        let b;
        if (i < n - 1) b = cs[i + 1].clone().addScaledVector(dirs[i + 1], -lens[i + 1] * 0.5 * 0.7);
        else b = c.clone().addScaledVector(d, len * (o.effLen || 1.6)).addScaledVector(h, len * 0.3);
        const mid = a.clone().lerp(b, 0.5).addScaledVector(h, len * 0.25);
        out.push(H.tube([a, mid, b], r, { radial: 5, tubular: 6, caps: false }));
        for (let k = 0; k < na; k++) {
          const p1 = perp(d), ang = rnd(i, seed, 5 + k) * Math.PI;
          const side = p1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(d.clone().cross(p1), Math.sin(ang));
          const away = h.clone().negate().multiplyScalar(0.8).addScaledVector(side, 0.6).addScaledVector(d, -0.5 - 0.3 * k).normalize();
          const start = c.clone().addScaledVector(away, len * 1.5);
          const end = c.clone().addScaledVector(h, -len * 0.62 * 0.5 * 0.6);
          const m2 = start.clone().lerp(end, 0.5).addScaledVector(side, len * 0.2);
          out.push(H.tube([start, m2, end], r * 0.9, { radial: 5, tubular: 6, caps: false }));
        }
      }
    }
    return out;
  }
  function nodeGroup(group, spec, chains) {
    const geoms = []; for (const ch of chains) geoms.push(...nodeChain(ch.pts, ch));
    const s = Object.assign({ color: COL.node, tags: ['lymph-node'] }, spec, { geometry: H.merge(geoms) });
    const pair = s.pair; delete s.pair;
    return pair ? mk2(group, s) : mk(group, s);
  }
  const NODE_DESC = ' Each node is a bean-shaped filter 5-15 mm long with a fibrous capsule, an outer cortex of B-cell follicles, a T-cell paracortex and an inner medulla. Several afferent lymphatics enter its convex surface; one or two efferents leave at the hilum.';

  // ================================================================ THYMUS - two lobes behind the manubrium, in front of the pericardium & great vessels
  const gThy = H.group('thymus'); root.add(gThy);
  const thyC = L.organ.thymus.center;                                  // [0, 1.38, 0.06], size [0.05, 0.06, 0.02]
  function thymusLobe(sign, scale) {
    const S = [
      { y: -0.03, rx: 0.0105, rz: 0.0075, cx: 0.002 * sign, cz: 0.001 },   // broad lower end spread over the pericardium
      { y: -0.018, rx: 0.0128, rz: 0.0098, cx: 0.0, cz: 0.0 },
      { y: -0.004, rx: 0.012, rz: 0.0095, cx: -0.001 * sign, cz: 0.0 },
      { y: 0.012, rx: 0.0095, rz: 0.0075, cx: -0.002 * sign, cz: -0.001 },
      { y: 0.024, rx: 0.0058, rz: 0.0048, cx: -0.003 * sign, cz: -0.002 },
      { y: 0.031, rx: 0.0025, rz: 0.0022, cx: -0.004 * sign, cz: -0.003 }  // pointed upper (cervical) pole toward the thyroid
    ].map(s => ({ y: s.y * scale, rx: s.rx * scale, rz: s.rz * scale, cx: s.cx * scale, cz: s.cz * scale }));
    // posterior face flattened against the pericardium/great vessels; medial face flattened where the lobes meet
    const g = H.loft(S, { radial: 28, subdiv: 5, warp: (t, y, d) => (1 - 0.18 * Math.max(0, -d[1])) * (1 - 0.1 * Math.max(0, -d[0] * sign)) });
    rough(g, 0.0007, 220, 3.3 + sign);                                    // lobulation
    return put(g, [thyC[0] + 0.0135 * sign, thyC[1] + (sign > 0 ? 0 : 0.003), thyC[2] + 0.002], [-0.22, 0, 0.18 * sign]);
  }
  mk(gThy, { id: 'thymus', name: 'Thymus', latin: 'Thymus', depth: 0, side: 'M', region: 'thorax', geometry: H.merge([thymusLobe(1, 1), thymusLobe(-1, 0.93)]), color: COL.thymus, tags: ['thymus', 'primary lymphoid organ'],
    info: { description: 'A soft, pinkish-grey, two-lobed gland in the front of the upper chest, tucked behind the breastbone (manubrium) and in front of the pericardium and great vessels. It is largest in childhood and, after puberty, slowly shrinks and is replaced by fat (involution).',
      function: 'Trains T lymphocytes: immature cells arriving from the bone marrow mature here and are selected so that they attack foreign antigens but tolerate the body\'s own tissues.',
      size: 'About 5 x 4 x 1-2 cm in an adult (10-20 g); heaviest at puberty (30-40 g), relatively largest in infancy', notes: 'Thymomas are linked to myasthenia gravis (10-15 % of patients have one) and removing the thymus can improve the disease. DiGeorge syndrome (22q11 deletion) leaves the thymus absent or tiny, with too few T cells.' } });
  const medG = H.blob([0.0055, 0.02, 0.0042], { ws: 20, hs: 14, noise: { amp: 0.06, freq: 3 } });
  put(medG, [thyC[0] + 0.0135, thyC[1], thyC[2] + 0.002], [-0.22, 0, 0.18]);
  mk2(gThy, { id: 'thymus-medulla', name: 'thymic medulla', latin: 'Medulla thymi', depth: 0.5, region: 'thorax', geometry: medG, color: COL.medulla, parent: 'thymus', tags: ['thymus'],
    info: { description: 'The paler inner zone of each thymic lobule, surrounded by the dark, lymphocyte-packed cortex. It holds mature T cells, epithelial cells and Hassall\'s corpuscles, whorled keratinised bodies found nowhere else.',
      function: 'Site of negative selection: T cells that react against the body\'s own proteins are deleted here before release into the blood.',
      size: 'Each lobule 0.5-2 mm across; the medulla is continuous from lobule to lobule', notes: 'Medullary epithelial cells use the AIRE gene to display tissue-specific proteins (insulin, thyroglobulin...) to developing T cells; AIRE mutations cause autoimmune polyendocrine syndrome type 1.' } });

  // ================================================================ SPLEEN - 12 x 7 x 4 cm, under the left dome of the diaphragm along ribs 9-11
  // local axes: X = width (7 cm, along the flank wall), Y = length (12 cm), Z = thickness (4 cm, along the flank normal; +Z diaphragmatic, -Z visceral with the hilum)
  const gSpl = H.group('spleen'); root.add(gSpl);
  const SPL_C = [0.10, L.organ.spleen.center[1], L.organ.spleen.center[2]];  // landmark x 0.12 pulled 2 cm medially so the organ stays inside the rib cage/skin silhouette
  const SPL_M = new THREE.Matrix4().compose(H.v3(SPL_C), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 2.034, -0.436)), V(1, 1, 1));  // long axis up/back/medial, visceral face antero-medial
  function spleenShape(scale, ws, hs) {
    return H.blob([0.035 * scale, 0.06 * scale, 0.02 * scale], { ws, hs, deform: p => {
      const vis = Math.max(0, -p.z);
      const hil = 0.28 * Math.pow(vis, 1.6) * Math.exp(-(p.y * p.y * 3.0 + (p.x + 0.15) * (p.x + 0.15) * 3.5));   // hilar concavity
      const flat = 0.08 * vis;                                                                                        // visceral surface flatter than the diaphragmatic one
      const notch = 0.22 * Math.max(0, -p.x - 0.55) * (Math.exp(-Math.pow((p.y - 0.25) * 6, 2)) + Math.exp(-Math.pow((p.y - 0.55) * 6, 2)));   // notches on the superior/anterior border
      const pole = 1 - 0.06 * Math.max(0, -p.y);
      const n = 1 + 0.02 * H.fbm(p.x * 4 + 1.3, p.y * 4 + 2.1, p.z * 4 + 0.7, 2);
      return (1 - hil - flat - notch) * pole * n;
    } });
  }
  mk(gSpl, { id: 'spleen', name: 'Spleen', latin: 'Splen (lien)', depth: 0, side: 'L', region: 'abdomen', geometry: spleenShape(1, 44, 30).applyMatrix4(SPL_M), color: COL.spleen, tags: ['spleen', 'secondary lymphoid organ'],
    info: { description: 'A soft, dark-purple, fist-sized organ tucked under the left dome of the diaphragm behind the stomach, lying along the 9th-11th ribs and fully protected by the rib cage. Its smooth outer (diaphragmatic) surface is convex; the inner (visceral) surface is concave and carries the hilum where the splenic vessels enter. A thin fibrous capsule wraps it.',
      function: 'Filters the blood: old and damaged red cells are destroyed by macrophages in the red pulp, while the white pulp mounts immune responses to blood-borne microbes.',
      size: 'About 12 x 7 x 4 cm, 150 g (range 80-300 g); the "odd numbers" rule: 1 x 3 x 5 inches, 7 oz, ribs 9-11', notes: 'The organ most often injured in blunt abdominal trauma; it can bleed massively and sometimes must be removed. After splenectomy, patients are vulnerable to encapsulated bacteria (pneumococcus, meningococcus, Haemophilus) and need vaccination. A normal spleen cannot be felt: it must enlarge 2-3 times to be palpable below the ribs.' } });
  // hilum: four cut vessel stubs (splenic artery/vein branches) emerging from the slit on the visceral surface
  const hilG = H.merge([-0.021, -0.007, 0.007, 0.021].map((y, i) => H.segment([-0.005 + 0.002 * (i % 2), y, -0.012], [-0.006 + 0.002 * (i % 2), y * 1.15, -0.021], [0.0028, 0.0022], { radial: 12 })));
  mk(gSpl, { id: 'spleen-hilum', name: 'Splenic hilum', latin: 'Hilum splenicum', depth: 0.1, side: 'L', region: 'abdomen', geometry: hilG.applyMatrix4(SPL_M), color: COL.hilum, parent: 'spleen', tags: ['spleen'],
    info: { description: 'The slit on the concave visceral surface where the splenic artery and vein, lymphatics and nerves enter and leave, wrapped in the gastrosplenic and splenorenal ligaments. The tail of the pancreas reaches right into the hilum.',
      function: 'Entry and exit for the spleen\'s rich blood supply, about 5 % of the cardiac output (250-300 ml per minute).',
      size: 'About 5-6 cm long; the splenic artery splits into 5-7 hilar branches', notes: 'Because the pancreatic tail sits in the hilum, splenectomy can injure it and cause a pancreatic fistula. Accessory spleens (splenunculi) are found near the hilum in 10-15 % of people.' } });
  mk(gSpl, { id: 'spleen-red-pulp', name: 'Splenic red pulp', latin: 'Pulpa rubra', depth: 0.5, side: 'L', region: 'abdomen', geometry: spleenShape(0.9, 32, 22).applyMatrix4(SPL_M), color: COL.redPulp, parent: 'spleen', tags: ['spleen'],
    info: { description: 'The bulk of the spleen: a spongy meshwork of blood-filled sinusoids and cords (of Billroth) packed with macrophages, which gives the organ its dark red colour.',
      function: 'Removes old, rigid or parasite-laden red cells, recycles their iron, and holds about a third of the body\'s platelets in reserve.',
      size: 'About 75-80 % of the spleen\'s volume', notes: 'Red cells must squeeze through 1-3 micrometre slits between the sinusoid lining cells; sickle cells and spherocytes cannot, so they are trapped and destroyed, which is why sickle cell disease causes haemolysis and eventually a scarred, non-functioning "autosplenectomised" spleen.' } });
  const wpG = [];
  for (let k = 0; k < 26; k++) {
    const p = [rnd(k, 9, 1) * 0.024, rnd(k, 9, 2) * 0.046, rnd(k, 9, 3) * 0.011 + 0.002];
    wpG.push(H.sphere(0.0011 + 0.0004 * Math.abs(rnd(k, 9, 4)), 8, 6).translate(p[0], p[1], p[2]));
  }
  mk(gSpl, { id: 'spleen-white-pulp', name: 'Splenic white pulp', latin: 'Pulpa alba (noduli lymphoidei splenici)', depth: 0.6, side: 'L', region: 'abdomen', geometry: H.merge(wpG).applyMatrix4(SPL_M), color: COL.whitePulp, parent: 'spleen', tags: ['spleen'],
    info: { description: 'Millimetre-sized whitish nodules (Malpighian corpuscles) scattered through the red pulp: sheaths of T lymphocytes around the central arterioles, with B-cell follicles attached to them.',
      function: 'Mounts antibody responses against antigens carried in the blood; the spleen holds about a quarter of the body\'s lymphocytes.',
      size: 'Each nodule 0.5-1 mm; together 20-25 % of the spleen', notes: 'Visible to the naked eye as pale specks on the cut surface; the nodules enlarge dramatically in glandular fever (infectious mononucleosis) and in lymphoma.' } });

  // ================================================================ TONSILS - Waldeyer's ring at the entrance of the throat
  const gTon = H.group('tonsils'); root.add(gTon);
  const palG = H.blob([0.005, 0.011, 0.0075], { ws: 24, hs: 18, deform: p => {
    const crypt = 0.2 * Math.max(0, -p.x) * H.smoothstep(0.05, 0.45, H.fbm(p.x * 5 + 2, p.y * 5 + 4, p.z * 5 + 1, 2));   // crypt openings on the medial (pharyngeal) face
    const flat = 0.12 * Math.max(0, p.x);                                                                                  // lateral face flat in the tonsillar fossa
    return 1 - crypt - flat + 0.03 * H.fbm(p.x * 3 + 1, p.y * 3 + 2, p.z * 3, 2);
  } });
  put(palG, [0.02, 1.575, 0.015], [0.1, 0, 0.12]);
  mk2(gTon, { id: 'tonsil-palatine', name: 'palatine tonsil', latin: 'Tonsilla palatina', depth: 0, region: 'head', geometry: palG, color: COL.tonsil, tags: ['tonsil', 'waldeyer ring'],
    info: { description: 'An almond-shaped mass of lymphoid tissue in the side wall of the throat, sitting in the tonsillar fossa between the palatoglossal and palatopharyngeal arches. Its surface is pitted with 10-20 deep crypts. These are the "tonsils" seen at the back of the mouth.',
      function: 'Samples swallowed and inhaled antigens at the entrance of the throat and starts antibody responses, as part of Waldeyer\'s ring.',
      size: 'About 20-25 x 15 x 10 mm in a child; they shrink in adults', notes: 'Tonsillitis is usually viral or due to group A streptococcus. Tonsillectomy is one of the commonest childhood operations. A peritonsillar abscess (quinsy) pushes the uvula toward the opposite side.' } });
  const adG = H.blob([0.012, 0.005, 0.008], { ws: 28, hs: 16, deform: p => 1 + 0.1 * Math.cos(p.x * 4 * Math.PI) * Math.max(0, p.z) - 0.25 * Math.max(0, -p.z) + 0.03 * H.fbm(p.x * 4 + 3, p.y * 4, p.z * 4 + 1, 2) });
  put(adG, [0, 1.605, 0.0], [0.6, 0, 0]);
  mk(gTon, { id: 'tonsil-pharyngeal', name: 'Pharyngeal tonsil (adenoid)', latin: 'Tonsilla pharyngea', depth: 0, side: 'M', region: 'head', geometry: adG, color: COL.tonsil, tags: ['tonsil', 'waldeyer ring'],
    info: { description: 'A ridged pad of lymphoid tissue in the roof and back wall of the nasopharynx, behind the nasal cavity and above the soft palate. Its free surface has 5-6 sagittal folds. It is prominent in children and normally regresses by the teenage years.',
      function: 'Traps and responds to antigens in the air breathed through the nose.',
      size: 'About 2-3 cm wide and 1-1.5 cm thick in a child', notes: 'Enlarged adenoids block the nose and the openings of the Eustachian tubes, causing mouth-breathing, snoring and "glue ear", the usual reasons for adenoidectomy.' } });
  const liG = H.blob([0.013, 0.004, 0.008], { ws: 30, hs: 16, deform: p => 1 + 0.16 * H.smoothstep(0.1, 0.6, H.fbm(p.x * 6 + 1, p.y * 6 + 2, p.z * 6 + 3, 2)) * Math.max(0, p.y) - 0.2 * Math.max(0, -p.y) });
  put(liG, [L.head.tongueCenter[0], L.head.tongueCenter[1] - 0.008, L.head.tongueCenter[2] - 0.023], [-0.6, 0, 0]);
  mk(gTon, { id: 'tonsil-lingual', name: 'Lingual tonsil', latin: 'Tonsilla lingualis', depth: 0, side: 'M', region: 'head', geometry: liG, color: COL.tonsil, tags: ['tonsil', 'waldeyer ring'],
    info: { description: 'A collection of lymphoid nodules covering the back third of the tongue (behind the V-shaped sulcus terminalis), giving it a cobblestone surface. Each nodule has a single crypt.',
      function: 'Forms the lower part of Waldeyer\'s ring of lymphoid tissue that guards the throat.',
      size: 'Spread over about 3 x 2 cm; individual nodules 1-3 mm', notes: 'It can enlarge and cause a sensation of a lump in the throat, or make intubation difficult; it is a rare site of carcinoma and lymphoma.' } });

  // ================================================================ LYMPH NODE GROUPS
  const gNod = H.group('lymph-nodes'); root.add(gNod);
  // deep cervical chain along the internal jugular vein (L.neck.jugularL), jugulodigastric node largest at the jaw angle, + two posterior cervical nodes
  nodeGroup(gNod, { id: 'lymph-nodes-cervical', name: 'cervical lymph nodes', latin: 'Nodi lymphoidei cervicales profundi', region: 'neck', pair: true,
    info: { description: 'The deep cervical chain: a string of nodes running down the neck along the internal jugular vein, under the sternocleidomastoid muscle, from the angle of the jaw to the collarbone. The jugulodigastric node at the top is the largest.' + NODE_DESC,
      function: 'Final drainage station for the whole head and neck (scalp, face, mouth, tonsils, pharynx, larynx, thyroid) before lymph enters the jugular trunk.',
      size: 'About 20-30 nodes per side, each 5-15 mm; the jugulodigastric node up to 15-20 mm', notes: 'They swell with tonsillitis and glandular fever. A hard, painless cervical node in an adult suggests a head-and-neck cancer; an enlarged left supraclavicular node (Virchow\'s node) can be the first sign of a stomach cancer.' } },
    [{ pts: [[0.043, 1.552, 0.004], [0.041, 1.535, 0.011], [0.038, 1.518, 0.017], [0.035, 1.502, 0.02], [0.033, 1.485, 0.022], [0.031, 1.468, 0.024], [0.03, 1.452, 0.026]], size: i => (i === 0 ? 0.014 : 0.009), seed: 11 },
     { pts: [[0.05, 1.507, -0.027], [0.047, 1.478, -0.03]], size: 0.008, seed: 12 }]);
  // submandibular nodes under the body of the mandible (between L.head.jawAngleL and L.head.chin)
  nodeGroup(gNod, { id: 'lymph-nodes-submandibular', name: 'submandibular lymph nodes', latin: 'Nodi lymphoidei submandibulares', region: 'head', pair: true,
    info: { description: 'Three to six nodes lying just under the lower border of the jaw, on and around the submandibular salivary gland.' + NODE_DESC,
      function: 'Drain the cheeks, nose, lips, gums, teeth, the front of the tongue and the floor of the mouth, sending their lymph on to the deep cervical chain.',
      size: '3-6 nodes of 5-10 mm', notes: 'The nodes most often felt as tender lumps under the jaw in dental abscesses, mouth ulcers and lip infections.' } },
    [{ pts: [[0.046, 1.549, 0.006], [0.039, 1.545, 0.019], [0.03, 1.538, 0.036], [0.018, 1.53, 0.054]], size: 0.008, seed: 13 }]);
  // axillary nodes in the armpit fat around [0.16, 1.36, -0.01]: pectoral -> central -> apical, with subscapular and humeral groups feeding the central ones
  nodeGroup(gNod, { id: 'lymph-nodes-axillary', name: 'axillary lymph nodes', latin: 'Nodi lymphoidei axillares', region: 'thorax', pair: true,
    info: { description: 'Twenty to thirty nodes embedded in the fat of the armpit, arranged in five groups: pectoral (anterior, along the chest wall), subscapular (posterior), humeral (lateral, beside the axillary vein), central and apical, the last passing lymph to the subclavian trunk.' + NODE_DESC,
      function: 'Drain the whole upper limb, the breast and the chest and upper back wall down to the navel.',
      size: '20-30 nodes of 5-15 mm', notes: 'About 75 % of breast lymph drains here, so a "sentinel node" biopsy of the first axillary node is used to stage breast cancer; clearing all the nodes can cause chronic swelling of the arm (lymphoedema).' } },
    [{ pts: [[0.145, 1.315, 0.042], [0.15, 1.34, 0.03], [0.16, 1.355, 0.0], [0.158, 1.365, -0.015], [0.15, 1.38, -0.01], [0.13, 1.40, 0.0], [0.115, 1.41, 0.008]], size: i => (i >= 2 && i <= 4 ? 0.012 : 0.009), seed: 21, afferents: 2 },
     { pts: [[0.155, 1.33, -0.06], [0.152, 1.35, -0.045]], size: 0.009, seed: 22, effLen: 1.2 },
     { pts: [[0.18, 1.39, -0.005], [0.172, 1.375, -0.012]], size: 0.008, seed: 23, effLen: 1.2 }]);
  // cubital (supratrochlear) nodes above the medial epicondyle, on the medial side of L.joint.elbowL
  nodeGroup(gNod, { id: 'lymph-nodes-cubital', name: 'cubital lymph nodes', latin: 'Nodi lymphoidei cubitales (supratrochleares)', region: 'armL', pair: true,
    info: { description: 'One to three small nodes on the inner side of the elbow, 3-5 cm above the medial epicondyle beside the basilic vein.' + NODE_DESC,
      function: 'Drain the little-finger side of the hand and forearm along the basilic vein, then send lymph on to the axillary nodes.',
      size: '1-3 nodes of 5-8 mm', notes: 'Enlarged in infections of the hand and in secondary syphilis; classically checked when examining the lymphatic system of the arm.' } },
    [{ pts: [[0.203, 1.112, 0.004], [0.199, 1.128, 0.001], [0.196, 1.145, -0.002]], size: 0.006, seed: 31 }]);
  // mediastinal nodes: paratracheal chains (L.organ.trachea), tracheobronchial at the carina, subcarinal, prevascular behind the thymus
  nodeGroup(gNod, { id: 'lymph-nodes-mediastinal', name: 'Mediastinal lymph nodes', latin: 'Nodi lymphoidei mediastinales', region: 'thorax', side: 'M',
    info: { description: 'Nodes clustered around the windpipe and its fork in the middle of the chest: right and left paratracheal chains, tracheobronchial nodes at the carina, subcarinal nodes beneath it and prevascular nodes in front of the great vessels behind the thymus.' + NODE_DESC,
      function: 'Receive lymph from the lungs (via the hilar nodes), heart, oesophagus and thymus and pass it to the bronchomediastinal trunks.',
      size: 'About 20-40 nodes of 5-15 mm', notes: 'Spread of lung cancer to these nodes (N2 disease) usually rules out simple surgery. Symmetrical enlargement of hilar and mediastinal nodes on a chest X-ray is the classic picture of sarcoidosis.' } },
    [{ pts: [[-0.02, 1.432, 0.012], [-0.021, 1.412, 0.004], [-0.022, 1.392, -0.005], [-0.02, 1.37, -0.014]], size: 0.01, seed: 41 },
     { pts: [[0.02, 1.427, 0.01], [0.021, 1.405, 0.0], [0.02, 1.37, -0.014]], size: 0.01, seed: 42 },
     { pts: [[0.004, 1.33, -0.012], [0.0, 1.345, -0.016]], size: 0.011, seed: 43, effLen: 1.0 },
     { pts: [[0.012, 1.385, 0.042], [-0.005, 1.405, 0.036]], size: 0.009, seed: 44, effLen: 1.0 }]);
  // hilar (bronchopulmonary) nodes along each main bronchus from the carina to the lung hilum
  nodeGroup(gNod, { id: 'lymph-nodes-hilar', name: 'hilar lymph nodes', latin: 'Nodi lymphoidei bronchopulmonales', region: 'thorax', pair: true,
    info: { description: 'Bronchopulmonary nodes packed around the main bronchus and pulmonary vessels at the root (hilum) of each lung, where the airway enters it.' + NODE_DESC,
      function: 'First filter for lymph draining from the lung tissue and airways, before it passes to the tracheobronchial and mediastinal nodes.',
      size: '5-10 nodes of 5-15 mm per side', notes: 'In adult city-dwellers and smokers these nodes are black with inhaled carbon (anthracosis). Enlargement is seen in tuberculosis, sarcoidosis and lung cancer.' } },
    [{ pts: [[0.035, 1.352, -0.02], [0.048, 1.338, -0.026], [0.06, 1.325, -0.032], [0.05, 1.31, -0.022]], size: 0.01, seed: 51, hilum: [-1, 0.3, 0], effLen: 1.0 },
     { pts: [[0.04, 1.34, -0.036]], size: 0.009, seed: 52, effLen: 1.0 }]);
  // mesenteric nodes along the root of the mesentery (duodenojejunal flexure -> ileocaecal junction) and in its fan
  nodeGroup(gNod, { id: 'lymph-nodes-mesenteric', name: 'Mesenteric lymph nodes', latin: 'Nodi lymphoidei mesenterici superiores', region: 'abdomen', side: 'M',
    info: { description: 'A hundred or more nodes strung along the branches of the superior mesenteric artery inside the fan-shaped mesentery that suspends the small intestine, densest along its root, which runs obliquely from the upper left to the lower right of the abdomen.' + NODE_DESC,
      function: 'Filter lymph from the small intestine, including fat-laden chyle absorbed after a meal, and pass it to the intestinal trunk and cisterna chyli.',
      size: '100-150 nodes of 3-10 mm', notes: 'Viral or Yersinia infection makes them swell and ache (mesenteric adenitis), the commonest mimic of appendicitis in children. They are a favoured site of lymphoma and of spread from bowel cancer.' } },
    [{ pts: [[0.03, 1.078, 0.002], [0.02, 1.065, 0.012], [0.008, 1.05, 0.02], [-0.005, 1.035, 0.025], [-0.02, 1.02, 0.028], [-0.035, 1.005, 0.03], [-0.05, 0.992, 0.03], [-0.065, 0.982, 0.03]], size: 0.008, seed: 61, afferents: 2 },
     { pts: [[0.03, 1.03, 0.045], [0.0, 1.0, 0.05], [-0.03, 0.985, 0.05]], size: 0.007, seed: 62, effLen: 1.0 }]);
  // para-aortic (lumbar) nodes beside and in front of the abdominal aorta and inferior vena cava, L1 -> bifurcation
  nodeGroup(gNod, { id: 'lymph-nodes-para-aortic', name: 'Para-aortic lymph nodes', latin: 'Nodi lymphoidei lumbales', region: 'abdomen', side: 'M',
    info: { description: 'Lumbar nodes lying on the back wall of the abdomen on either side of the aorta and in front of and between the aorta and inferior vena cava, from the diaphragm down to where the aorta divides.' + NODE_DESC,
      function: 'Drain the kidneys, adrenals, ovaries and testes, the posterior abdominal wall and all the lymph arriving from the pelvis and legs via the iliac nodes; their efferents form the lumbar trunks.',
      size: '20-30 nodes of 5-15 mm', notes: 'Because the testes descend from the abdomen, testicular cancer spreads first to these nodes at the level of the kidneys, not to the groin.' } },
    [{ pts: [[0.02, 1.06, -0.04], [0.022, 1.08, -0.041], [0.023, 1.105, -0.042], [0.024, 1.13, -0.044], [0.022, 1.155, -0.046]], size: 0.009, seed: 71 },
     { pts: [[-0.012, 1.065, -0.026], [-0.014, 1.09, -0.026], [-0.014, 1.12, -0.026], [-0.013, 1.15, -0.028]], size: 0.009, seed: 72 },
     { pts: [[0.002, 1.115, -0.026], [0.0, 1.14, -0.028]], size: 0.008, seed: 73, effLen: 1.0 }]);
  // iliac nodes along the common and external iliac vessels (bifurcation -> femoral ring) and internal iliac nodes
  nodeGroup(gNod, { id: 'lymph-nodes-iliac', name: 'iliac lymph nodes', latin: 'Nodi lymphoidei iliaci', region: 'pelvis', pair: true,
    info: { description: 'A chain of nodes following the common and external iliac vessels down the side wall of the pelvis to the groin, plus internal iliac nodes deeper in the pelvis around the branches of the internal iliac artery.' + NODE_DESC,
      function: 'External iliac nodes collect lymph from the inguinal nodes, bladder, prostate/uterus; internal iliac nodes drain the pelvic organs, perineum and buttock; both pass to the common iliac then lumbar nodes.',
      size: '8-12 nodes of 5-15 mm per side', notes: 'Staging cancers of the bladder, prostate, cervix and rectum depends on whether these nodes are involved; they are examined on CT and MRI and often removed at surgery.' } },
    [{ pts: [[0.082, 0.938, 0.04], [0.072, 0.952, 0.022], [0.06, 0.972, 0.0], [0.045, 0.995, -0.018], [0.03, 1.015, -0.03], [0.018, 1.035, -0.038]], size: 0.009, seed: 81, effLen: 1.0 },
     { pts: [[0.045, 0.97, -0.05], [0.04, 0.99, -0.045]], size: 0.008, seed: 82, effLen: 1.0 }]);
  // inguinal nodes around [0.09, 0.93, 0.07]: horizontal group below the inguinal ligament, vertical group along the great saphenous vein, one deep node (Cloquet)
  nodeGroup(gNod, { id: 'lymph-nodes-inguinal', name: 'inguinal lymph nodes', latin: 'Nodi lymphoidei inguinales', region: 'pelvis', pair: true,
    info: { description: 'The groin nodes: a horizontal row in the fat just below the inguinal ligament and a vertical row along the top of the great saphenous vein, plus a few deep nodes beside the femoral vein (the highest is Cloquet\'s node, in the femoral canal).' + NODE_DESC,
      function: 'Drain the whole lower limb, the buttock, the external genitalia, perineum and anus, and the abdominal wall below the navel, sending lymph on to the external iliac nodes.',
      size: '10-15 superficial nodes of 5-20 mm; 1-3 deep nodes', notes: 'The most easily felt nodes in the body; small "shotty" nodes are normal here. Enlarged in leg and foot infections, sexually transmitted infections and melanoma of the leg.' } },
    [{ pts: [[0.118, 0.958, 0.058], [0.104, 0.947, 0.064], [0.09, 0.937, 0.069], [0.076, 0.927, 0.072], [0.062, 0.918, 0.074]], size: 0.011, seed: 91, afferents: 2, effLen: 0.8 },
     { pts: [[0.088, 0.88, 0.066], [0.09, 0.9, 0.068], [0.092, 0.92, 0.07]], size: 0.013, seed: 92, effLen: 0.8 },
     { pts: [[0.085, 0.905, 0.05]], size: 0.008, seed: 93, effLen: 1.0 }]);
  // popliteal nodes in the fat of the popliteal fossa behind L.joint.kneeL
  nodeGroup(gNod, { id: 'lymph-nodes-popliteal', name: 'popliteal lymph nodes', latin: 'Nodi lymphoidei poplitei', region: 'legL', pair: true,
    info: { description: 'Five to seven small nodes buried in the fat of the hollow behind the knee, around the popliteal vessels and at the end of the small saphenous vein.' + NODE_DESC,
      function: 'Drain the outer side of the foot and the calf (the small saphenous territory) and the deep tissues of the leg, sending lymph up along the femoral vessels to the deep inguinal nodes.',
      size: '5-7 nodes of 3-8 mm', notes: 'Rarely palpable; they enlarge with infections of the heel and lateral foot and with melanoma of the lower leg.' } },
    [{ pts: [[0.1, 0.49, -0.032], [0.093, 0.505, -0.04], [0.086, 0.52, -0.042], [0.092, 0.535, -0.036]], size: 0.0065, seed: 101 },
     { pts: [[0.082, 0.495, -0.03]], size: 0.006, seed: 102, effLen: 1.0 }]);

  // ================================================================ CISTERNA CHYLI + THORACIC DUCT + RIGHT LYMPHATIC DUCT
  const gDuct = H.group('ducts'); root.add(gDuct);
  const CC = [-0.01, 1.135, -0.032];                                    // in front of L1-L2, right of the aorta, behind the right crus
  const cisG = H.loft([
    { y: -0.03, rx: 0.002 }, { y: -0.02, rx: 0.0038 }, { y: -0.005, rx: 0.0048 }, { y: 0.01, rx: 0.0045 }, { y: 0.025, rx: 0.0032 }, { y: 0.033, rx: 0.0022 }
  ], { radial: 14, subdiv: 4 });
  rough(cisG, 0.0002, 400, 7.7); cisG.translate(CC[0], CC[1], CC[2]);
  // intestinal trunk from the mesenteric root joins the sac
  const intG = beaded([[0.03, 1.078, 0.002], [0.012, 1.095, -0.018], [CC[0] + 0.003, CC[1] - 0.022, CC[2] - 0.002]], 0.0012, { period: 0.02, radial: 8 });
  mk(gDuct, { id: 'cisterna-chyli', name: 'Cisterna chyli', latin: 'Cisterna chyli', depth: 0, side: 'M', region: 'abdomen', geometry: H.merge([cisG, intG]), color: COL.chyle, tags: ['duct'],
    info: { description: 'A thin-walled, spindle-shaped sac on the back wall of the upper abdomen, in front of the first two lumbar vertebrae just to the right of the aorta and behind the right crus of the diaphragm. It is formed by the union of the right and left lumbar trunks with the intestinal trunk, and narrows upward into the thoracic duct.',
      function: 'Collects lymph from both legs, the pelvis and the abdominal organs, including the milky, fat-rich chyle from the intestine, and feeds it into the thoracic duct.',
      size: 'About 5-7 cm long and 5-6 mm wide (absent or replaced by a plexus in about half of people)', notes: 'Its content is chyle: after a fatty meal the lymph turns white with chylomicrons. Injury during spine or aortic surgery leaks chyle into the abdomen (chylous ascites).' } });
  const TD = [[CC[0] + 0.002, CC[1] + 0.031, CC[2] - 0.001], [-0.007, 1.19, -0.046], [-0.006, 1.23, -0.055], [-0.005, 1.28, -0.06], [-0.004, 1.33, -0.061], [0.003, 1.355, -0.061],
    [0.013, 1.378, -0.054], [0.02, 1.40, -0.05], [0.024, 1.43, -0.04], [0.028, 1.458, -0.028], [0.035, 1.463, -0.012], [0.038, 1.452, 0.006], [0.03, 1.42, 0.02]];
  const tdLen = curveLen(TD);
  const tdG = H.tube(TD, t => 0.002 * (0.88 + 0.24 * Math.pow(0.5 + 0.5 * Math.sin(t * tdLen / 0.012 * Math.PI * 2), 2)), { radial: 10, step: 0.003 });
  mk(gDuct, { id: 'thoracic-duct', name: 'Thoracic duct', latin: 'Ductus thoracicus', depth: 0, side: 'M', region: 'body', geometry: tdG, color: COL.duct, tags: ['duct'],
    info: { description: 'The largest lymph vessel in the body. It begins at the cisterna chyli, passes up through the aortic opening of the diaphragm, climbs the back of the chest between the aorta and the azygos vein, crosses from right to left behind the oesophagus at the level of T4-T6, arches over the top of the left lung at the root of the neck and empties into the junction of the left internal jugular and subclavian veins.',
      function: 'Returns 2-4 litres of lymph a day, from everything except the right arm and right side of the head and chest, back into the bloodstream.',
      size: 'About 38-45 cm long, 3-5 mm in diameter, with valves along its length and at its mouth', notes: 'Tearing it during chest surgery or by a penetrating injury fills the pleural space with milky chyle (chylothorax), which can drain litres a day and starve the patient of fat and lymphocytes.' } });
  const rld = [];
  const RJ = [-0.036, 1.436, 0.012];
  rld.push(H.tube([RJ, [-0.033, 1.428, 0.017], [-0.03, 1.42, 0.02]], 0.0016, { radial: 10, step: 0.002 }));
  rld.push(beaded([[-0.03, 1.452, 0.026], [-0.034, 1.44, 0.018], RJ], 0.001, { period: 0.012, radial: 6 }));                                 // right jugular trunk
  rld.push(beaded([[-0.115, 1.41, 0.008], [-0.075, 1.425, 0.008], [-0.045, 1.432, 0.008], RJ], 0.001, { period: 0.012, radial: 6 }));           // right subclavian trunk
  rld.push(beaded([[-0.02, 1.432, 0.012], [-0.028, 1.436, 0.01], RJ], 0.0009, { period: 0.012, radial: 6 }));                                  // right bronchomediastinal trunk
  mk(gDuct, { id: 'right-lymphatic-duct', name: 'Right lymphatic duct', latin: 'Ductus lymphaticus dexter', depth: 0, side: 'R', region: 'thorax', geometry: H.merge(rld), color: COL.duct, tags: ['duct'],
    info: { description: 'A very short vessel at the root of the right side of the neck formed by the right jugular, subclavian and bronchomediastinal trunks, opening into the junction of the right internal jugular and subclavian veins.',
      function: 'Drains the "right upper quadrant" of the body: the right side of the head and neck, the right arm and the right half of the chest, heart and lungs.',
      size: 'About 1-1.5 cm long, 2-3 mm wide', notes: 'Often absent as a single vessel: in most people the three trunks open into the veins separately. Its small territory is why breast or chest disease on the right rarely produces a chylothorax.' } });

  // ================================================================ LYMPHATIC VESSELS - superficial limb trunks + deep trunks, per side
  const gVes = H.group('lymphatic-vessels'); root.add(gVes);
  function vesselsFor(s) {
    const P = pts => pts.map(p => [p[0] * s, p[1], p[2]]), g = [];
    // upper limb, medial (basilic) trunk: ulnar side of the hand dorsum -> cubital nodes -> medial arm -> central axillary nodes
    g.push(beaded(P([[0.225, 0.772, 0.011], [0.222, 0.80, 0.012], [0.222, 0.85, 0.012], [0.215, 0.93, 0.005], [0.206, 1.02, 0.0], [0.2, 1.10, 0.003], [0.197, 1.15, -0.002], [0.188, 1.24, -0.008], [0.176, 1.31, -0.012], [0.16, 1.355, -0.002]]), 0.0008));
    // upper limb, lateral (cephalic) trunk: thumb side of the hand -> lateral forearm/arm -> deltopectoral groove -> apical axillary nodes
    // (starts on the radial side of the hand dorsum inside the palm skin; crosses from the shoulder into the trunk above the armpit hollow)
    g.push(beaded(P([[0.2785, 0.7845, 0.01], [0.275, 0.8325, 0.0055], [0.2685, 0.8655, 0.0075], [0.262, 0.95, 0.0], [0.256, 1.04, -0.008], [0.25, 1.10, -0.01], [0.241, 1.2, -0.015], [0.23, 1.30, -0.018], [0.212, 1.38, -0.012],
      [0.195, 1.40, -0.004], [0.17, 1.42, 0.004], [0.145, 1.42, 0.004], [0.13, 1.40, 0.0]]), 0.0008));
    // lower limb, medial (great saphenous) trunk: foot dorsum -> in front of the medial malleolus -> medial leg and thigh -> saphenous opening / inguinal nodes
    g.push(beaded(P([[0.08, 0.033, 0.10], [0.074, 0.05, 0.05], [0.0695, 0.085, 0.005], [0.0685, 0.15, 0.005], [0.059, 0.25, 0.0105], [0.051, 0.35, 0.0145], [0.049, 0.45, 0.02], [0.048, 0.52, 0.022], [0.052, 0.62, 0.04], [0.06, 0.72, 0.055], [0.07, 0.82, 0.065], [0.084, 0.885, 0.068]]), 0.0009));
    // lower limb, posterior (small saphenous) trunk: lateral foot -> behind the lateral malleolus -> midline of the calf -> popliteal nodes
    g.push(beaded(P([[0.12, 0.033, 0.07], [0.116, 0.05, 0.0], [0.11, 0.08, -0.025], [0.0985, 0.15, -0.0345], [0.095, 0.25, -0.0455], [0.092, 0.35, -0.05], [0.09, 0.45, -0.045], [0.1, 0.488, -0.033]]), 0.0008));
    // deep trunk with the femoral vessels: popliteal nodes -> adductor canal -> deep inguinal node -> external iliac nodes
    g.push(beaded(P([[0.092, 0.535, -0.036], [0.088, 0.62, -0.02], [0.086, 0.72, 0.01], [0.086, 0.82, 0.035], [0.085, 0.905, 0.05], [0.082, 0.938, 0.04]]), 0.0009));
    // superficial inguinal -> external iliac nodes through the femoral canal
    g.push(beaded(P([[0.076, 0.927, 0.072], [0.08, 0.935, 0.058], [0.082, 0.938, 0.04]]), 0.0009));
    // lumbar trunk: common iliac / lumbar nodes -> cisterna chyli (side specific: the cisterna lies right of the midline)
    g.push(beaded(s > 0 ? [[0.018, 1.035, -0.038], [0.012, 1.065, -0.04], [0.0, 1.09, -0.038], [CC[0] + 0.002, CC[1] - 0.029, CC[2] - 0.001]]
      : [[-0.018, 1.035, -0.038], [-0.022, 1.065, -0.04], [-0.018, 1.09, -0.038], [CC[0] - 0.002, CC[1] - 0.029, CC[2] - 0.001]], 0.0012, { period: 0.02, radial: 8 }));
    if (s > 0) {   // on the left the jugular, subclavian and bronchomediastinal trunks join the end of the thoracic duct
      g.push(beaded([[0.03, 1.452, 0.026], [0.032, 1.437, 0.024], [0.03, 1.42, 0.02]], 0.001, { period: 0.012, radial: 6 }));
      g.push(beaded([[0.115, 1.41, 0.008], [0.075, 1.425, 0.012], [0.04, 1.428, 0.018], [0.03, 1.42, 0.02]], 0.001, { period: 0.012, radial: 6 }));
      g.push(beaded([[0.02, 1.427, 0.01], [0.027, 1.432, 0.015], [0.03, 1.42, 0.02]], 0.0009, { period: 0.012, radial: 6 }));
    }
    return H.merge(g);
  }
  const vesInfo = side => ({
    description: `The ${side} lymphatic trunks: beaded, valved vessels no wider than a pencil lead that collect tissue fluid from the skin and muscles of the limbs. Superficial trunks run with the cephalic and basilic veins up the arm (via the cubital and axillary nodes) and with the great and small saphenous veins up the leg (via the popliteal and inguinal nodes); a deep trunk follows the femoral vessels, and the lumbar trunk carries everything from the iliac nodes up to the cisterna chyli${side === 'left' ? ', while the jugular, subclavian and bronchomediastinal trunks join the thoracic duct at the root of the neck' : ''}.`,
    function: 'Return the 2-4 litres of fluid, protein and immune cells that leak out of the capillaries each day, carrying them through the lymph nodes and back to the veins.',
    size: 'Collecting vessels 0.5-2 mm wide; the lumbar trunk about 3 mm; valves every 6-20 mm giving the beaded look', notes: 'Each segment between two valves (a lymphangion) contracts 6-10 times a minute, helped by the muscle pump. Blocked or removed vessels cause lymphoedema; infection spreading along them shows as red streaks up the limb (lymphangitis).'
  });
  mk(gVes, { id: 'lymphatic-vessels-l', name: 'Left lymphatic vessels', latin: 'Vasa lymphatica (sinistra)', depth: 0, side: 'L', region: 'body', geometry: vesselsFor(1), color: COL.vessel, tags: ['vessel'], info: vesInfo('left') });
  mk(gVes, { id: 'lymphatic-vessels-r', name: 'Right lymphatic vessels', latin: 'Vasa lymphatica (dextra)', depth: 0, side: 'R', region: 'body', geometry: vesselsFor(-1), color: COL.vessel, tags: ['vessel'], info: vesInfo('right') });

  // ================================================================ PEYER'S PATCHES - oval lymphoid plaques in the wall of the ileum
  const pey = [];
  const peyPos = [[-0.05, 0.985, 0.044, [0.3, 0.4, 0.2]], [-0.03, 0.975, 0.056, [-0.2, -0.3, 0.5]], [-0.008, 0.965, 0.05, [0.4, 0.9, -0.3]], [-0.036, 0.957, 0.038, [-0.5, 0.2, 0.8]], [0.006, 0.982, 0.034, [0.2, -0.6, 0.4]]];
  peyPos.forEach((p, i) => {
    const g = H.blob([0.012 + 0.003 * rnd(i, 5, 1), 0.0025, 0.006 + 0.0015 * rnd(i, 5, 2)], { ws: 18, hs: 10, deform: q => 1 + 0.2 * H.smoothstep(0.1, 0.6, H.fbm(q.x * 7 + i, q.y * 7 + 2, q.z * 7 + i * 0.5, 2)) * Math.max(0, q.y) - 0.3 * Math.max(0, -q.y) });
    pey.push(put(g, [p[0], p[1], p[2]], p[3]));
  });
  mk(root, { id: 'peyers-patches', name: 'Peyer\'s patches', latin: 'Noduli lymphoidei aggregati (ilei)', depth: 0.3, side: 'M', region: 'abdomen', geometry: H.merge(pey), color: COL.peyer, tags: ['gut-associated lymphoid tissue'],
    info: { description: 'Oval, slightly raised plaques of lymphoid follicles in the wall of the last part of the small intestine (ileum), on the side away from the mesentery. Shown here as representative plaques on a loop of ileum in the lower right abdomen; the real gut carries 30-40 of them.',
      function: 'Sample the contents of the gut through specialised M cells and generate IgA-secreting plasma cells that protect the whole intestinal lining.',
      size: 'Each 2-5 cm long and 1-2 cm wide; 30-40 patches, most numerous in the terminal ileum', notes: 'Typhoid fever ulcerates the patches and can perforate the bowel; they are also the entry point for polio virus and for prions in variant CJD.' } });

  // ================================================================ BONE MARROW - red marrow slab inside the sternum (manubrium + body)
  const marG = H.loft([
    { y: 1.228, rx: 0.006, rz: 0.0025, cz: 0.089, n: 2.4 },
    { y: 1.25, rx: 0.011, rz: 0.003, cz: 0.088, n: 2.5 },
    { y: 1.30, rx: 0.013, rz: 0.0032, cz: 0.084, n: 2.5 },
    { y: 1.36, rx: 0.014, rz: 0.0032, cz: 0.08, n: 2.5 },
    { y: 1.375, rx: 0.017, rz: 0.0035, cz: 0.078, n: 2.5 },   // sternal angle
    { y: 1.40, rx: 0.022, rz: 0.004, cz: 0.073, n: 2.5 },
    { y: 1.42, rx: 0.024, rz: 0.004, cz: 0.068, n: 2.5 },
    { y: 1.432, rx: 0.016, rz: 0.003, cz: 0.066, n: 2.4 }     // jugular notch
  ], { radial: 24, subdiv: 4 });
  rough(marG, 0.0004, 300, 5.5);
  mk(root, { id: 'bone-marrow-sternum', name: 'Bone marrow (sternum)', latin: 'Medulla ossium rubra (sterni)', depth: 0.5, side: 'M', region: 'thorax', geometry: marG, color: COL.marrow, tags: ['bone marrow', 'primary lymphoid organ'],
    info: { description: 'The red, blood-forming marrow filling the spongy interior of the breastbone, shown here as a slab inside the manubrium and body of the sternum. In adults red marrow survives only in the flat bones (sternum, ribs, pelvis, skull), the vertebrae and the upper ends of the femur and humerus.',
      function: 'Makes all blood cells, about 500 billion a day, including the B lymphocytes that mature here and the T-cell precursors sent to the thymus.',
      size: 'Slab about 15 cm long, 2-5 cm wide and 5 mm thick; the body holds about 2.6 kg of marrow, half of it red', notes: 'The sternum is a classic site for marrow aspiration with a needle (the posterior iliac crest is now preferred), and its marrow is what a bone-marrow transplant replaces after high-dose chemotherapy.' } });

  return root;
});
