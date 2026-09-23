/* systems/glands.js - Endocrine glands (pituitary, pineal, thyroid, parathyroids, adrenals, pancreatic islets) and
   exocrine glands (parotid, submandibular, sublingual, lacrimal, female mammary). Layer GLAND, system 'endocrine'.
   NOT built here: thymus (lymphatic), pancreas body (digestive), ovaries/testes (urinary_reproductive), hypothalamus (nervous_central).
   Every position comes from L.* landmarks; all shapes are lofts/tubes/blobs with fbm surface texture; deterministic. */
ANATOMY.register('glands', {
  name: 'Glands (endocrine & exocrine)',
  description: 'Pituitary, pineal, thyroid, parathyroids, adrenals, pancreatic islets; salivary, lacrimal and (female) mammary glands'
}, function (THREE, H, L, ctx) {
  const SYS = 'endocrine', LAYER = H.LAYER.GLAND, V = H.V;
  const root = H.group('glands');

  // ---------------------------------------------------------------- private helpers
  // fbm surface roughness along normals (local coords, before translation). freq in 1/m: 200 -> ~5 mm lobulation
  function rough(g, amp, freq, seed) { return H.displace(g, p => amp * H.fbm(p.x * freq + seed, p.y * freq + seed * 0.37, p.z * freq + seed * 1.91, 2)); }
  function put(g, pos, rot) { if (rot) H.transform(g, { rot }); g.translate(pos[0], pos[1], pos[2]); return g; }
  function mk(group, spec) { const m = H.part(Object.assign({ system: SYS, layer: LAYER }, spec)); group.add(m); return m; }
  function mk2(group, spec) { const p = H.pair(Object.assign({ system: SYS, layer: LAYER }, spec)); group.add(p[0], p[1]); return p; }

  // ================================================================ PITUITARY (hypophysis) — in the sella turcica
  const gPit = H.group('pituitary'); root.add(gPit);
  const pit = L.head.pituitary, hyp = L.head.hypothalamus;
  // anterior lobe: the larger, bean-shaped front 3/4, its posterior face cupping the posterior lobe
  const antG = H.blob([0.0055, 0.0032, 0.0034], { ws: 28, hs: 18, noise: { amp: 0.035, freq: 4 }, deform: p => 1 - 0.14 * H.smoothstep(0.1, 1, -p.z) * (1 - 0.6 * Math.abs(p.x)) });
  put(antG, [pit[0], pit[1] - 0.0003, pit[2] + 0.0019]);
  mk(gPit, { id: 'pituitary-anterior', name: 'Anterior pituitary', latin: 'Adenohypophysis (lobus anterior)', depth: 0.2, side: 'M', region: 'head', geometry: antG, color: H.COLORS.pituitary, parent: 'pituitary', tags: ['pituitary', 'endocrine'],
    info: { description: 'The front three-quarters of the pituitary gland, a pea-sized gland hanging from the base of the brain in a bony cup (the sella turcica) behind the nose. It is true glandular tissue, controlled by releasing hormones that reach it through a private portal blood supply from the hypothalamus.',
      function: 'Secretes growth hormone, prolactin, ACTH, TSH, FSH and LH — the "master gland" signals that drive the adrenal cortex, thyroid, gonads, growth and lactation.',
      size: 'Whole pituitary about 12 × 8 × 6 mm, 0.5–0.6 g; the anterior lobe is ~75–80 % of it', notes: 'Pituitary adenomas are common (≈10 % of intracranial tumours). A growing one presses upward on the optic chiasm and classically causes bitemporal hemianopia (loss of both outer visual fields).' } });
  // posterior lobe: smaller, behind and slightly above the anterior lobe; nervous tissue continuous with the stalk
  const postG = H.blob([0.0036, 0.0029, 0.0027], { ws: 24, hs: 16, noise: { amp: 0.03, freq: 4 } });
  put(postG, [pit[0], pit[1] + 0.0005, pit[2] - 0.0038]);
  mk(gPit, { id: 'pituitary-posterior', name: 'Posterior pituitary', latin: 'Neurohypophysis (lobus posterior)', depth: 0.2, side: 'M', region: 'head', geometry: postG, color: '#c98b62', parent: 'pituitary', tags: ['pituitary', 'endocrine'],
    info: { description: 'The rear quarter of the pituitary. It is not a gland in its own right but a bundle of nerve endings: axons of hypothalamic neurons run down the stalk and end here beside capillaries.',
      function: 'Stores and releases oxytocin (uterine contraction, milk let-down) and vasopressin/ADH (water retention by the kidney), both made in the hypothalamus.',
      size: 'About 4–6 mm across, ~20 % of the gland', notes: 'Damage to the posterior lobe or stalk causes central diabetes insipidus — the kidneys cannot concentrate urine and the patient may pass 10–15 litres a day.' } });
  // infundibulum (stalk): from the top of the gland up to the median eminence of the hypothalamus
  const stalkG = H.tube([[pit[0], pit[1] + 0.0024, pit[2] - 0.0028], [pit[0], (pit[1] + hyp[1]) / 2 + 0.0004, (pit[2] + hyp[2]) / 2 - 0.0006], [hyp[0], hyp[1] - 0.0008, hyp[2]]], t => 0.0011 + 0.0011 * t * t, { radial: 10, step: 0.0012 });
  mk(gPit, { id: 'pituitary-stalk', name: 'Pituitary stalk', latin: 'Infundibulum hypophysis', depth: 0.2, side: 'M', region: 'head', geometry: stalkG, color: '#d4a07c', parent: 'pituitary', tags: ['pituitary', 'endocrine'],
    info: { description: 'A thin funnel of nerve fibres and portal blood vessels that hangs the pituitary from the floor of the hypothalamus (the median eminence), passing through a hole in the diaphragma sellae.',
      function: 'Carries hypothalamic axons to the posterior lobe and the hypophyseal portal veins that deliver releasing hormones to the anterior lobe.',
      size: 'About 8–10 mm long, 2–3 mm in diameter', notes: 'Anything that compresses the stalk (tumour, surgery, head injury) interrupts the dopamine brake on prolactin: prolactin rises while every other anterior hormone falls — the "stalk effect".' } });

  // ================================================================ PINEAL — pine-cone in the midline behind the third ventricle
  const pin = L.head.pineal;
  const pinealG = H.blob(1, { ws: 28, hs: 18, deform: p => {
    const k = 1 - 0.45 * Math.max(0, -p.z), n = 1 + 0.07 * H.fbm(p.x * 3.1 + 2.2, p.y * 3.1 + 1.1, p.z * 3.1 + 4.4, 2);
    return V(p.x * 0.0027 * k * n, p.y * 0.0026 * k * n, p.z * 0.0042 * n);
  } });
  put(pinealG, pin, [-0.2, 0, 0]);
  mk(root, { id: 'pineal-gland', name: 'Pineal gland', latin: 'Glandula pinealis', depth: 0.2, side: 'M', region: 'head', geometry: pinealG, color: H.COLORS.pineal, tags: ['endocrine'],
    info: { description: 'A tiny pine-cone-shaped gland in the exact midline of the brain, tucked behind the third ventricle above the midbrain. It receives light information from the eyes by a roundabout nerve route via the neck.',
      function: 'Secretes melatonin during darkness, setting the body\'s day–night (circadian) rhythm and, in childhood, restraining puberty.',
      size: '5–8 mm long, ~5 mm wide, 100–150 mg', notes: 'It calcifies with age ("brain sand"), so it shows up on skull X-rays and CT scans as a midline marker — a shifted pineal was once a classic sign of a mass pushing the brain sideways.' } });

  // ================================================================ THYROID — butterfly on the front/sides of the trachea
  const gThy = H.group('thyroid'); root.add(gThy);
  const thy = L.organ.thyroid, lobeC = [thy.lobeL[0], thy.lobeL[1], thy.lobeL[2] + 0.003];
  function thyroidLobe() {
    const secs = [
      { y: -0.025, rx: 0.0065, rz: 0.006, cz: 0.001 },      // broad rounded lower pole (5th–6th tracheal ring)
      { y: -0.018, rx: 0.0115, rz: 0.0105, cz: 0.0015 },
      { y: -0.008, rx: 0.0125, rz: 0.011, cz: 0.002 },     // widest in the lower third: 2.5 cm, 2.2 cm deep
      { y: 0.004, rx: 0.011, rz: 0.010, cz: 0.001 },
      { y: 0.015, rx: 0.0082, rz: 0.0075, cz: 0 },
      { y: 0.023, rx: 0.0045, rz: 0.004, cz: -0.001 },
      { y: 0.026, rx: 0.0015, rz: 0.0015, cz: -0.0015 }     // pointed upper pole on the thyroid cartilage lamina
    ];
    // medial face (towards the trachea, -X for the left lobe) flattened/concave
    const g = H.loft(secs, { radial: 40, subdiv: 5, warp: (t, y, d) => 1 - 0.22 * Math.max(0, -d[0]) });
    rough(g, 0.0005, 260, 3.1);                                // follicular lobulation
    return put(g, lobeC, [-0.15, 0, -0.12]);                   // upper pole tilts back and out along the cartilage lamina
  }
  const lobeInfo = { description: 'One of the two lobes of the butterfly-shaped thyroid, lying against the side of the windpipe just below the voice box. Its pointed upper pole rests on the thyroid cartilage and its rounded lower pole reaches the 5th–6th tracheal ring. It is packed with hormone-filled follicles.',
    function: 'Makes thyroxine (T4) and triiodothyronine (T3), which set the metabolic rate of nearly every cell, plus calcitonin from its C cells, which lowers blood calcium.',
    size: 'Each lobe about 5 × 2.5 × 2 cm; whole gland 15–25 g', notes: 'The gland is bound to the larynx by fascia, so a thyroid lump moves up and down when the patient swallows — the classic bedside test. Enlargement (goitre) is usually due to iodine deficiency worldwide.' };
  mk2(gThy, { id: 'thyroid-lobe', name: 'thyroid lobe', latin: 'Lobus glandulae thyroideae', depth: 0.1, region: 'neck', geometry: thyroidLobe(), color: H.COLORS.thyroid, parent: 'thyroid', tags: ['thyroid', 'endocrine'], info: lobeInfo });
  // isthmus: a band crossing the 2nd–4th tracheal rings in front of the trachea (lofted along X)
  const isthG = H.loft([
    { y: -0.0145, rx: 0.0078, rz: 0.0034, cz: -0.0045 },
    { y: -0.007, rx: 0.0068, rz: 0.003, cz: -0.001 },
    { y: 0, rx: 0.0064, rz: 0.003, cz: 0.0 },
    { y: 0.007, rx: 0.0068, rz: 0.003, cz: -0.001 },
    { y: 0.0145, rx: 0.0078, rz: 0.0034, cz: -0.0045 }
  ], { radial: 24, subdiv: 5, axis: 'x' });
  rough(isthG, 0.0004, 300, 4.2);
  put(isthG, [thy.isthmus[0], thy.isthmus[1], thy.isthmus[2] + 0.0035]);   // front face ~5 mm in front of the trachea's anterior wall (z 0.046)
  mk(gThy, { id: 'thyroid-isthmus', name: 'Thyroid isthmus', latin: 'Isthmus glandulae thyroideae', depth: 0.1, side: 'M', region: 'neck', geometry: isthG, color: H.COLORS.thyroid, parent: 'thyroid', tags: ['thyroid', 'endocrine'],
    info: { description: 'The narrow bridge of thyroid tissue joining the two lobes across the front of the windpipe, at the level of the 2nd to 4th tracheal rings.',
      function: 'Same follicular tissue as the lobes — makes T4/T3 — and physically links them into one gland.',
      size: 'About 1.25 cm tall and wide, 3–6 mm thick', notes: 'In about half of people a pyramidal lobe rises from the isthmus towards the hyoid, a remnant of the thyroglossal duct. Surgeons doing a tracheostomy either divide the isthmus or work just below it.' } });
  // parathyroids: four lentils on the posterior surface of the lobes (superior at the cricoid level, inferior near the lower pole)
  const paraInfo = (which) => ({ description: `A lentil-sized ${which} parathyroid gland embedded in the back of the thyroid lobe, one of four. Despite the name it has nothing to do with thyroid hormone; it is the body\'s calcium sensor.`,
    function: 'Secretes parathyroid hormone (PTH), which raises blood calcium by releasing it from bone, reducing its loss in urine and activating vitamin D.',
    size: '6 × 4 × 2 mm, 30–50 mg each', notes: which === 'superior' ? 'The superior glands are the more constant in position (behind the upper-middle lobe, near where the inferior thyroid artery crosses the recurrent laryngeal nerve). Removing all four during thyroid surgery causes tetany from low calcium within a day or two.' : 'The inferior glands wander: they descend with the thymus in the embryo and may end up anywhere from the lower pole to the chest. About 5–13 % of people have a fifth gland.' });
  const paraGeom = (pos) => put(H.blob([0.003, 0.0021, 0.0012], { ws: 18, hs: 12, noise: { amp: 0.06, freq: 3 } }), pos, [0.2, 0, 0.25]);
  mk2(gThy, { id: 'parathyroid-superior', name: 'superior parathyroid gland', latin: 'Glandula parathyroidea superior', depth: 0.3, region: 'neck', geometry: paraGeom([0.022, 1.492, 0.0212]), color: H.COLORS.parathyroid, parent: 'thyroid', tags: ['parathyroid', 'endocrine'], info: paraInfo('superior') });
  mk2(gThy, { id: 'parathyroid-inferior', name: 'inferior parathyroid gland', latin: 'Glandula parathyroidea inferior', depth: 0.3, region: 'neck', geometry: paraGeom([0.019, 1.462, 0.0246]), color: H.COLORS.parathyroid, parent: 'thyroid', tags: ['parathyroid', 'endocrine'], info: paraInfo('inferior') });

  // ================================================================ ADRENALS — caps on the upper poles of the kidneys
  const gAdr = H.group('adrenals'); root.add(gAdr);
  // LEFT: semilunar crescent draped over the superomedial pole of the left kidney, lower tip reaching towards the hilum
  const aL = L.organ.adrenalL.center;
  // flat semilunar plate 5.2 cm long, ~2.5 cm wide, 1 cm thick, bowed so its concave edge hugs the kidney; upper horn caps the
  // kidney's top, lower horn descends medially towards the hilum. Built as a bent, tapered ellipsoid (blob with absolute deform).
  const adrLG = H.blob(1, { ws: 40, hs: 26, deform: p => {
    const y = p.y;                                                                     // -1 lower horn .. +1 upper horn
    const n = 1 + 0.05 * H.fbm(p.x * 2.4 + 6.3, p.y * 2.4 + 1.9, p.z * 2.4 + 4.1, 2);   // lobulated surface
    const wid = 0.0125 * (0.45 + 0.55 * H.smoothstep(-1, 0.2, y)) * (1 - 0.35 * H.smoothstep(0.55, 1, y));  // broad body, tapered horns
    const thk = 0.0048 * (0.7 + 0.3 * (1 - 0.6 * y * y));
    const bend = 0.010 * (y * y - 0.35);                                               // crescent: horns bow laterally (+X), concave face towards the kidney
    return V(p.x * wid * n + bend, y * 0.026 * n, p.z * thk * n);
  } });
  put(adrLG, aL, [-0.1, 0, -0.5]);                                                     // long axis leans: upper horn lateral over the kidney, lower horn medial
  rough(adrLG, 0.0003, 240, 6.3);
  mk(gAdr, { id: 'adrenal-l', name: 'Left adrenal gland', latin: 'Glandula suprarenalis sinistra', depth: 0.1, side: 'L', region: 'abdomen', geometry: adrLG, color: H.COLORS.adrenal, parent: 'adrenals', tags: ['adrenal', 'endocrine'],
    info: { description: 'A flat, crescent-shaped (semilunar) gland draped over the inner upper pole of the left kidney, behind the stomach and pancreas. Like its partner it has an outer yellow cortex and an inner red-brown medulla, which are really two glands in one capsule.',
      function: 'Cortex: aldosterone (salt and blood-pressure control), cortisol (stress, glucose, immune suppression) and weak androgens; medulla: adrenaline and noradrenaline for fight-or-flight.',
      size: 'About 4–5 × 3 × 1 cm, 4–5 g', notes: 'The left adrenal vein drains into the left renal vein, unlike the right, which empties straight into the inferior vena cava. Adrenal failure (Addison\'s disease) causes fatigue, low blood pressure and a bronze tan from excess ACTH.' } });
  // RIGHT: pyramid, apex superomedial, flattened front-to-back; built three times as capsule → cortex → medulla with a
  // posterolateral wedge cut out of the outer two so the layers show (peel: 9.1 → 9.2 → 9.6)
  const aR = L.organ.adrenalR.center;
  function adrenalR(rs, hs, gapDeg, yOff) {
    const prof = [[0, 0], [0.0125, 0], [0.0145, 0.004], [0.0138, 0.011], [0.0115, 0.019], [0.008, 0.027], [0.0035, 0.033], [0, 0.036]].map(p => [p[0] * rs, p[1] * hs + yOff]);
    const gap = gapDeg * Math.PI / 180;
    const g = H.lathe(prof, { segments: 44, phiStart: Math.PI * 1.25 + gap / 2, phiLength: Math.PI * 2 - gap });
    rough(g, 0.00035, 230, 7.7);
    H.transform(g, { scale: [1, 1, 0.36] });
    return put(g, aR, [0.08, 0, -0.25]);                       // apex leans medially (+X for the right side)
  }
  mk(gAdr, { id: 'adrenal-r', name: 'Right adrenal gland', latin: 'Glandula suprarenalis dextra', depth: 0.1, side: 'R', region: 'abdomen', geometry: adrenalR(1, 1, 100, -0.018), material: H.mat({ color: H.COLORS.adrenal, side: THREE.DoubleSide }), parent: 'adrenals', tags: ['adrenal', 'endocrine'],
    info: { description: 'A pyramid-shaped gland perched on the top of the right kidney, wedged between the liver, the inferior vena cava and the diaphragm. Shown with a wedge cut away to reveal its outer cortex and inner medulla. Its thin fibrous capsule is what you see here.',
      function: 'The capsule binds the cortex and medulla into one organ and carries the dozens of small arteries that pierce it from the aorta, phrenic and renal arteries.',
      size: 'About 3 × 3.5 × 1 cm, 4–5 g', notes: 'The right adrenal vein is only a few millimetres long and enters the vena cava directly, which makes right adrenal surgery bloodier than the left.' } });
  mk(gAdr, { id: 'adrenal-cortex-r', name: 'Right adrenal cortex', latin: 'Cortex glandulae suprarenalis', depth: 0.2, side: 'R', region: 'abdomen', geometry: adrenalR(0.9, 0.93, 60, -0.0167), material: H.mat({ color: '#ecc873', side: THREE.DoubleSide }), parent: 'adrenal-r', tags: ['adrenal', 'endocrine'],
    info: { description: 'The thick yellow outer layer of the adrenal, about nine-tenths of the gland by weight. It has three zones from outside in: glomerulosa, fasciculata and reticularis, each making a different class of steroid from cholesterol.',
      function: 'Aldosterone (zona glomerulosa), cortisol (zona fasciculata) and DHEA/androgens (zona reticularis).',
      size: '1–2 mm thick shell around the medulla', notes: 'Too much cortisol (Cushing\'s syndrome) gives a moon face, central obesity, thin skin and diabetes; too much aldosterone (Conn\'s syndrome) is a common curable cause of high blood pressure.' } });
  mk(gAdr, { id: 'adrenal-medulla-r', name: 'Right adrenal medulla', latin: 'Medulla glandulae suprarenalis', depth: 0.6, side: 'R', region: 'abdomen', geometry: adrenalR(0.45, 0.62, 0, -0.0102), color: '#8e4b3f', parent: 'adrenal-r', tags: ['adrenal', 'endocrine'],
    info: { description: 'The dark red-brown core of the adrenal, a modified sympathetic ganglion whose chromaffin cells pour hormones straight into the blood instead of onto a nerve target.',
      function: 'Releases adrenaline (≈80 %) and noradrenaline within seconds of sympathetic stimulation — faster heart, dilated airways, mobilised glucose.',
      size: 'A central plate a few millimetres thick, ~10 % of the gland', notes: 'A phaeochromocytoma is a tumour of the medulla that causes episodic pounding headache, sweating and dangerous blood-pressure surges; ~10 % are outside the adrenal, bilateral or malignant.' } });

  // ================================================================ PANCREATIC ISLETS — marker cluster inside the pancreas, denser towards the tail
  const pc = L.organ.pancreas, pcPath = [pc.head, [0.01, 1.112, 0.0], pc.body, [0.07, 1.131, -0.026], pc.tail];
  const islets = [], NI = 42;
  for (let i = 0; i < NI; i++) {
    const t = Math.pow((i + 0.5) / NI, 0.8);
    const p = H.curvePoint(pcPath, t);
    const ox = 0.0075 * H.noise3(i * 0.731 + 0.3, 1.7, 2.9), oy = 0.007 * H.noise3(3.1, i * 0.613 + 0.7, 5.3), oz = 0.006 * H.noise3(7.7, 2.3, i * 0.517 + 1.1);
    const r = 0.0011 + 0.0007 * (0.5 + 0.5 * H.noise3(i * 0.41 + 0.2, i * 0.23 + 0.5, 9.1));
    const s = H.sphere(r, 10, 7); s.translate(p.x + ox, p.y + oy, p.z + oz); islets.push(s);
  }
  mk(root, { id: 'pancreatic-islets', name: 'Pancreatic islets', latin: 'Insulae pancreaticae (Langerhans)', depth: 0.5, side: 'M', region: 'abdomen', geometry: H.merge(islets), color: '#d98a86', tags: ['pancreas', 'endocrine'],
    info: { description: 'The islets of Langerhans: roughly a million microscopic clusters of hormone cells scattered through the pancreas, shown here as 42 exaggerated markers running from the head to the tail (where they are most numerous). They make up only 1–2 % of the organ, the rest being digestive-enzyme tissue.',
      function: 'Beta cells secrete insulin (lowers blood glucose), alpha cells glucagon (raises it), delta cells somatostatin and PP cells pancreatic polypeptide.',
      size: 'Each islet 0.1–0.2 mm across (markers here are ~2.5 mm); about 1–1.5 g of islet tissue in total', notes: 'Type 1 diabetes is autoimmune destruction of the beta cells; the islets are transplanted into the liver\'s portal vein in islet-cell transplantation.' } });

  // ================================================================ SALIVARY GLANDS
  const gSal = H.group('salivary'); root.add(gSal);
  // parotid: lobulated wedge in front of the ear, wrapping the posterior border of the mandibular ramus, tail at the jaw angle
  function parotidGeom() {
    // horizontal cross-sections stacked along Y: a wedge, broad under the zygomatic arch, tapering to a tail behind the jaw angle.
    // Tiny end sections close the loft so no flat cap shows.
    const secs = [
      // cx keeps the lateral (superficial) face ~3 mm under the cheek skin, whose half-width shrinks from ~7.3 cm at the tragus to ~5.7 cm at the jaw angle
      { y: -0.034, rx: 0.0015, rz: 0.0025, cx: -0.0062, cz: -0.010 },  // tail tip below/behind the angle of the jaw
      { y: -0.028, rx: 0.0045, rz: 0.007, cx: -0.0068, cz: -0.009 },
      { y: -0.016, rx: 0.0072, rz: 0.0135, cx: -0.0042, cz: -0.004 },
      { y: -0.002, rx: 0.009, rz: 0.0175, cx: -0.0024, cz: 0.0 },      // widest, over the ramus / masseter
      { y: 0.013, rx: 0.009, rz: 0.017, cx: 0.0005, cz: -0.002 },
      { y: 0.025, rx: 0.0075, rz: 0.0135, cx: 0.0025, cz: -0.005 },
      { y: 0.033, rx: 0.0035, rz: 0.007, cx: 0.0025, cz: -0.007 },
      { y: 0.036, rx: 0.0012, rz: 0.0025, cx: 0.0025, cz: -0.008 }     // top, tucked under the zygomatic arch in front of the ear canal
    ];
    // anteromedial quadrant hollowed where the ramus sits; posteromedial quadrant extended (the deep part behind the ramus) -> C-shape wrapping the bone
    const g = H.loft(secs, { radial: 44, subdiv: 6, warp: (t, y, d) => (1 - 0.38 * H.smoothstep(0, 1, -d[0]) * H.smoothstep(0, 1, d[1])) * (1 + 0.2 * H.smoothstep(0, 1, -d[0]) * H.smoothstep(0, 1, -d[1])) });
    rough(g, 0.0005, 230, 11.3);                               // fine lobulation
    return put(g, [0.058, 1.585, -0.005]);
  }
  mk2(gSal, { id: 'parotid-gland', name: 'parotid gland', latin: 'Glandula parotidea', depth: 0.1, region: 'head', geometry: parotidGeom(), color: H.COLORS.salivary, parent: 'salivary', tags: ['salivary', 'exocrine'],
    info: { description: 'The largest salivary gland, a lobulated wedge of tissue in front of and below the ear, wrapped around the back edge of the jaw bone and reaching down to the angle of the jaw. The facial nerve fans out through the middle of it on its way to the face muscles.',
      function: 'Produces thin, watery (serous) saliva rich in amylase, which starts starch digestion; it contributes ~25 % of saliva, most of it during meals.',
      size: 'About 5.8 × 3.4 cm, 1–2 cm thick, 20–30 g', notes: 'Mumps swells the parotids painfully in front of the ears. Because the facial nerve runs through the gland, parotid surgery carries a risk of facial palsy, and parotid tumours (mostly benign pleomorphic adenomas) must be removed carefully.' } });
  // Stensen's duct: forward across the masseter ~2 cm below the zygomatic arch, then medially through the buccinator to the mouth opposite the upper second molar
  const ductG = H.tube([[0.0605, 1.601, 0.008], [0.063, 1.599, 0.028], [0.056, 1.596, 0.049], [0.047, 1.592, 0.062], [0.037, 1.586, 0.064]], 0.0014, { radial: 10, step: 0.003 });
  mk2(gSal, { id: 'parotid-duct', name: 'parotid duct', latin: 'Ductus parotideus (Stensen)', depth: 0.1, region: 'head', geometry: ductG, color: '#efdcc2', parent: 'salivary', tags: ['salivary', 'exocrine'],
    info: { description: 'The parotid (Stensen\'s) duct leaves the front edge of the gland, runs forward over the masseter muscle a finger-breadth below the cheekbone, turns sharply inward through the buccinator muscle and opens inside the cheek opposite the upper second molar.',
      function: 'Carries parotid saliva into the mouth; the buccinator acts as a valve so the duct is not inflated when you blow.',
      size: 'About 5 cm long, 3 mm in diameter', notes: 'A small papilla marks its opening inside the cheek — press the gland and saliva squirts from it. Stones are rarer here than in the submandibular duct because parotid saliva is thin.' } });
  // submandibular: walnut-sized lobulated mass below the body of the mandible, long axis along the jaw line
  // 3.4 × 2 × 1.5 cm; the thin (1.5 cm) axis faces the skin of the submandibular triangle so the superficial surface stays under skin + platysma
  const subG = H.blob([0.017, 0.010, 0.0075], { ws: 32, hs: 20, noise: { amp: 0.07, freq: 3.2 }, deform: p => 1 - 0.1 * H.smoothstep(0.3, 1, p.y) });
  put(subG, [0.038, 1.537, 0.030], [0.15, 0.99, 0.1]);
  mk2(gSal, { id: 'submandibular-gland', name: 'submandibular gland', latin: 'Glandula submandibularis', depth: 0.1, region: 'head', geometry: subG, color: H.COLORS.salivary, parent: 'salivary', tags: ['salivary', 'exocrine'],
    info: { description: 'A walnut-sized gland tucked under the jaw bone in the submandibular triangle of the neck, hooking around the back edge of the mylohyoid muscle. Its duct runs forward under the tongue to open beside the frenulum.',
      function: 'Supplies about 70 % of resting saliva — a mixed watery and mucous secretion that keeps the mouth wet between meals.',
      size: 'About 3.5 × 2 × 1.5 cm, 10–15 g', notes: 'Because its saliva is thick and its duct (Wharton\'s duct, ~5 cm) runs uphill, 80 % of salivary stones form here, causing painful swelling under the jaw at mealtimes.' } });
  // sublingual: almond under the floor of the mouth, against the inner surface of the mandible, the two nearly meeting at the front
  const slG = H.blob([0.0055, 0.0075, 0.017], { ws: 24, hs: 16, noise: { amp: 0.08, freq: 3.5 } });
  put(slG, [0.015, 1.555, 0.06], [0.05, -0.3, 0]);
  mk2(gSal, { id: 'sublingual-gland', name: 'sublingual gland', latin: 'Glandula sublingualis', depth: 0.1, region: 'head', geometry: slG, color: H.COLORS.salivary, parent: 'salivary', tags: ['salivary', 'exocrine'],
    info: { description: 'The smallest major salivary gland, an almond-shaped body lying in the floor of the mouth just under the mucosa, between the tongue and the inner surface of the jaw bone; the two glands almost touch behind the chin.',
      function: 'Secretes mainly thick mucous saliva through 8–20 tiny ducts (of Rivinus) that open along a ridge under the tongue, lubricating food and speech.',
      size: 'About 3.5–4 cm long, 1.5 cm tall, 3–4 g', notes: 'A blocked sublingual duct produces a ranula — a bluish, frog-belly swelling under the tongue.' } });

  // ================================================================ LACRIMAL GLANDS — almond in the superolateral corner of the orbit
  // flattened almond (5 × 11 × 19 mm) lying along the superolateral orbital margin, concave face on the globe. The landmark marks the rim;
  // the orbital part sits in the fossa just behind it (7 mm back, 3 mm medial), under the brow-ridge skin rather than poking through the lid.
  const lacC = [L.eye.lacrimalGlandL[0] - 0.003, L.eye.lacrimalGlandL[1] + 0.001, L.eye.lacrimalGlandL[2] - 0.007];
  const lacG = H.blob(1, { ws: 24, hs: 16, deform: p => {
    const n = 1 + 0.06 * H.fbm(p.x * 3.5 + 7.1, p.y * 3.5 + 3.3, p.z * 3.5 + 1.7, 2);
    return V(p.x * 0.0026 * n - 0.002 * p.y * p.y, p.y * 0.0095 * n, p.z * 0.0055 * n + 0.0015 * p.y);   // ends curl round the globe; lateral end lies further back
  } });
  put(lacG, lacC, [0, 0, 0.63]);                               // long axis tangent to the rim: medial end up, lateral end down
  mk2(root, { id: 'lacrimal-gland', name: 'lacrimal gland', latin: 'Glandula lacrimalis', depth: 0.1, region: 'head', geometry: lacG, color: '#e8c69e', tags: ['lacrimal', 'exocrine'],
    info: { description: 'An almond-shaped tear gland lodged in a shallow fossa of the frontal bone at the upper outer corner of the eye socket, above and to the side of the eyeball. A larger orbital part and a smaller palpebral part sit either side of the tendon of the upper-lid muscle.',
      function: 'Secretes the watery layer of the tear film (with lysozyme and IgA) through 6–12 ducts into the upper outer fornix; blinking spreads it across the eye towards the drainage puncta at the inner corner.',
      size: 'About 20 × 12 × 5 mm, ~0.8 g', notes: 'Its parasympathetic supply comes from the facial nerve via the greater petrosal nerve. Autoimmune damage (Sjögren\'s syndrome) causes dry, gritty eyes; a very swollen gland gives the upper lid a characteristic S-shaped droop.' } });

  // ================================================================ MAMMARY GLANDS (female only) — 17 lobes radiating from the nipple with lactiferous ducts
  if (ctx.sex === 'female') {
    const gMam = H.group('mammary'); root.add(gMam);
    const BR = L.organ.breastL, C = BR.center, NIP = [C[0], L.y.nipple + 0.002, C[2] + 0.032];   // nipple assumed at [0.10, 1.272, 0.132]
    // chest-wall skin z at (x, y) from the trunk superellipse; the gland lies between the pectoral fascia and the breast skin dome
    const zWall = (x, y) => { const s = L.trunkAt(y); const u = Math.min(0.999, Math.abs(x) / s.rx); return s.cz + s.rz * Math.pow(1 - Math.pow(u, s.n), 1 / s.n); };
    // breast skin z over (x, y): the integumentary mound is an ellipsoidal cap on the chest wall over the landmark box (12 × 11 cm, ~3.7 cm
    // projection, apex nudged 8 mm lateral / 12 mm down); its parametrisation is inverted by fixed-point iteration (-1 = off the mound)
    function zMound(x, y) {
      const hx = BR.size[0] / 2, hy = BR.size[1] / 2; let px = (x - C[0]) / hx, py = (y - C[1]) / hy, pz = 0;
      for (let i = 0; i < 7; i++) {
        const r2 = px * px + py * py; if (r2 >= 1) return -1; pz = Math.sqrt(1 - r2);
        px = (x - 0.008 * pz - C[0]) / hx; py = (y + 0.012 * pz * (0.6 + 0.4 * Math.max(0, -py)) - C[1]) / hy;
      }
      const r2 = px * px + py * py; if (r2 >= 1) return -1; pz = Math.sqrt(1 - r2);
      return zWall(C[0] + hx * px, C[1] + hy * py) + 0.037 * Math.pow(pz, 0.8) * (1 + 0.25 * Math.max(0, -py) - 0.3 * Math.max(0, py)) - 0.0025;
    }
    const zOut = (x, y) => Math.max(zWall(x, y), zMound(x, y));
    // lobule of radius sz at (x, y): mid-breast depth (11 mm under the skin) but always >= 3.5 mm under the LOWEST skin point of its
    // footprint, so the thin rim and the steep lateral chest are respected; where that leaves no room above the pectoral fascia
    // (~6 mm under the chest-wall skin) the lobule is shrunk instead. Returns [z, scale].
    function lobuleZ(x, y, sz) {
      const hz = 0.92 * sz, R = sz + 0.002; let top = zOut(x, y);
      for (let i = 0; i < 8; i++) top = Math.min(top, zOut(x + R * Math.cos(i * Math.PI / 4), y + R * Math.sin(i * Math.PI / 4)));
      top -= 0.0035;
      const floor = zWall(x, y) - 0.006;
      if (top - floor >= 2 * hz) return [Math.min(top - hz, Math.max(floor + hz, zOut(x, y) - 0.011)), 1];
      const s = Math.max(0.55, (top - floor) / (2 * hz)); return [top - hz * s, s];
    }
    const lobes = [], ducts = [], NL = 17;
    for (let k = 0; k < NL; k++) {
      const a = k / NL * Math.PI * 2 + 0.2 * H.noise3(k * 0.37 + 0.1, 1.2, 3.4);
      const ca = Math.cos(a), sa = Math.sin(a) * 0.92;                                    // breast a little wider than tall
      // lobes reach further laterally (k=1 is the axillary tail in the upper outer quadrant) and stop short on the thin medial side
      const rOut = 0.044 + 0.005 * H.noise3(2.2, k * 0.53 + 0.4, 0.7) - 0.012 * Math.max(0, -ca) + (k === 1 ? 0.014 : 0);
      const rIn = 0.017 + 0.004 * (0.5 + 0.5 * H.noise3(k * 0.29 + 0.9, 4.1, 1.3));
      const NLB = 3;                                                                        // three lobules per lobe, larger towards the periphery
      for (let j = 0; j < NLB; j++) {
        const t = (j + 0.5) / NLB, r = rIn + (rOut - rIn) * t;
        const cx = NIP[0] + r * ca, cy = NIP[1] + r * sa, sz0 = 0.0048 + 0.0024 * t, [cz, ks] = lobuleZ(cx, cy, sz0), sz = sz0 * ks;
        const lob = H.blob([sz * 0.85, sz, sz * 0.72], { ws: 14, hs: 10, deform: p => 1 + 0.12 * H.fbm(p.x * 2.4 + k * 1.7 + j * 3.1, p.y * 2.4 + k * 0.9, p.z * 2.4 + j * 2.3, 2) });
        H.aim(lob, V(ca, sa, -0.3)); lob.translate(cx, cy, cz); lobes.push(lob);
      }
      // lactiferous duct: from the innermost lobule towards the nipple, widening into a sinus 5-10 mm behind the areola
      const s = [NIP[0] + rIn * ca, NIP[1] + rIn * sa, lobuleZ(NIP[0] + rIn * ca, NIP[1] + rIn * sa, 0.0048)[0]];
      const m = [NIP[0] + 0.007 * ca, NIP[1] + 0.007 * sa, NIP[2] - 0.009];
      const e = [NIP[0] + 0.0012 * ca, NIP[1] + 0.0012 * sa, NIP[2] - 0.001];
      ducts.push(H.tube([s, m, e], t => 0.0009 + 0.0012 * Math.exp(-Math.pow((t - 0.6) / 0.15, 2)), { radial: 8, step: 0.0025 }));
    }
    mk2(gMam, { id: 'mammary-gland', name: 'mammary gland', latin: 'Glandula mammaria', depth: 0.2, region: 'thorax', geometry: H.merge(lobes), color: H.COLORS.mammary, parent: 'mammary', tags: ['mammary', 'exocrine', 'female'],
      info: { description: 'The milk-producing tissue of the breast: 15–20 lobes arranged like the spokes of a wheel around the nipple, each lobe a cluster of lobules of tiny alveoli, embedded in fat and supported by suspensory (Cooper\'s) ligaments over the pectoralis major muscle. Shown here as 17 lobes of three lobules each, larger towards the edge of the breast, with one long lobe reaching towards the armpit.',
        function: 'Under prolactin the alveoli secrete milk; oxytocin makes the muscle-like cells around them contract to eject it. Between pregnancies the gland is mostly quiescent ducts.',
        size: 'Glandular tissue spread through a breast of ~10–12 cm diameter; adult breast 150–500 g, roughly half of it gland', notes: 'Most glandular tissue — and about half of breast cancers — lies in the upper outer quadrant, which also sends an axillary tail (of Spence) towards the armpit; this is why the axillary lymph nodes are examined.' } });
    mk2(gMam, { id: 'lactiferous-ducts', name: 'lactiferous ducts', latin: 'Ductus lactiferi', depth: 0.4, region: 'thorax', geometry: H.merge(ducts), color: '#f6e9dc', parent: 'mammary', tags: ['mammary', 'exocrine', 'female'],
      info: { description: 'One duct drains each lobe, converging on the nipple like the spokes of a wheel. Just beneath the areola each widens into a lactiferous sinus, then narrows again to open on the tip of the nipple through its own pore.',
        function: 'Conduct milk from the lobes to the nipple; the sinuses hold a small reserve that the baby\'s first sucks release.',
        size: '15–20 ducts, 2–4 mm in diameter, 5–8 mm sinuses; ~4–5 cm long', notes: 'Bloody discharge from a single duct opening is usually a benign intraductal papilloma but always needs investigation; nipple-sparing surgery must preserve these ducts.' } });
  }

  return root;
});
