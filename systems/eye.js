/* systems/eye.js - BOTH eyes. The LEFT eye is built in a local frame (origin = L.eye.centerL, +Z = optical axis,
   +X = lateral/temporal, +Y = up), translated to L.eye.centerL, and H.pair mirrors it to the right eye.
   Globe (outside -> in, peel depth in layer ORGAN): conjunctiva 0 -> sclera/cornea/limbus 0.1 -> iris, pupil, anterior
   chamber, ciliary body, choroid 0.3 -> retina, macula, fovea, optic disc, retinal vessels 0.5 -> vitreous 0.6 ->
   lens capsule/cortex/nucleus 0.62-0.7. Eyelids + lashes are SKIN, tarsal plates / orbital fat / Tenon's capsule FAT,
   extraocular muscles MUSCLE_DEEP, intraorbital optic nerve NERVE. System 'sensory', region 'head', tags ['eye']. Deterministic. */
ANATOMY.register('eye', { name: 'Eye', description: 'Both eyeballs in peelable layers, eyelids, conjunctiva, extraocular muscles, intraorbital optic nerve, orbital fat and tear drainage' }, function (THREE, H, L, ctx) {
  const E = L.eye, C = E.centerL, R = E.radius;
  const root = H.group('eye');
  const gGlobe = H.group('eye-globe'), gAdnexa = H.group('eye-adnexa'), gOrbit = H.group('eye-orbit');
  root.add(gGlobe, gAdnexa, gOrbit);
  const DS = THREE.DoubleSide, FS = THREE.FrontSide, D2R = Math.PI / 180;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rel = (p) => [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
  const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const bump = (d, w) => Math.exp(-(d * d) / (w * w));
  const LAY = H.LAYER;

  // ---- part adder: geometry in the LOCAL eye frame -> moved to the left eye; right eye mirrored by H.pair (own material)
  function add(grp, s) {
    const g = s.geo; g.translate(C[0], C[1], C[2]);
    const mo = Object.assign({ color: s.color || '#cccccc', side: DS }, s.mat || {});
    const spec = { id: s.id, name: s.name, latin: s.latin || '', system: 'sensory', layer: s.layer, depth: s.depth || 0, region: 'head', geometry: g,
      material: H.mat(mo), info: { description: s.info[0], function: s.info[1], size: s.info[2], notes: s.info[3] },
      parent: s.parent ? s.parent + '-l' : null, tags: ['eye'].concat(s.tags || []) };
    const pr = H.pair(spec);
    pr[1].material = H.mat(mo);
    if (s.parent) pr[1].userData.part.parent = s.parent + '-r';
    if (s.vcolors) { pr[0].material.vertexColors = true; pr[1].material.vertexColors = true; }
    grp.add(pr[0], pr[1]); return pr;
  }

  // ---- geometry helpers (local frame). Lathe profiles are [r, z]; traverse closed profiles counter-clockwise (outward faces).
  const revolve = (prof, seg) => H.reaxis(H.lathe(prof, { segments: seg || 48 }), 'z');
  function arc(rr, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R; o.push([Math.abs(rr * Math.sin(a)), rr * Math.cos(a)]); } return o; }
  function shell(rOut, rIn, aOut, aIn, n, seg) { const p = arc(rOut, 180, aOut, n).concat(arc(rIn, aIn, 180, n)); p.push(p[0].slice()); return revolve(p, seg); }
  // spherical cap patch of angular radius ang (deg) on radius rr, with radial offset fn(u 0..1), aimed along dir
  function cap(ang, rr, fn, dir, n, seg) {
    const p = []; for (let i = 0; i <= n; i++) { const u = i / n, a = ang * u * D2R, q = rr + (fn ? fn(u) : 0); p.push([q * Math.sin(a), q * Math.cos(a)]); }
    const g = revolve(p, seg || 32); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), H.v3(dir).normalize())); return g;
  }
  // swept strap/tube with elliptical (superellipse) section: w(t) half-width, h(t) half-thickness, hint(t,P) -> 'thickness' direction
  function sweep(pts, o) {
    const curve = new THREE.CatmullRomCurve3(pts.map(H.v3), false, 'centripetal');
    const n = o.n || 32, m = o.radial || 12, ex = 2 / (o.exp || 2);
    const pos = [], idx = [], col = [], P = V(0, 0, 0), T = V(0, 0, 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n; curve.getPointAt(t, P); curve.getTangentAt(t, T);
      const h = o.hint(t, P.clone()); const up = h.clone().sub(T.clone().multiplyScalar(h.dot(T)));
      if (up.lengthSq() < 1e-10) up.set(0, 1, 0); up.normalize();
      const side = V(0, 0, 0).crossVectors(T, up).normalize();
      const w = o.w(t), th = o.h(t), bend = o.bend ? o.bend(t) : 0;
      for (let j = 0; j < m; j++) {
        const a = j / m * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const xw = w * Math.sign(ca) * Math.pow(Math.abs(ca), ex), yh = th * Math.sign(sa) * Math.pow(Math.abs(sa), ex) - bend * xw * xw / 2;
        pos.push(P.x + side.x * xw + up.x * yh, P.y + side.y * xw + up.y * yh, P.z + side.z * xw + up.z * yh);
        if (o.vcol) col.push(...o.vcol(t));
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    for (const e of [0, n]) { curve.getPointAt(e / n, P); const ci = pos.length / 3; pos.push(P.x, P.y, P.z); if (o.vcol) col.push(...o.vcol(e / n)); for (let j = 0; j < m; j++) { const a = e * m + j, b = e * m + (j + 1) % m; if (e) idx.push(ci, b, a); else idx.push(ci, a, b); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (o.vcol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.userData.curve = curve; return g;
  }
  // surface grid through closed loops (loops[i] = array of Vector3, same length), capped at both ends
  function loftLoops(loops) {
    const m = loops[0].length, pos = [], idx = [];
    loops.forEach(lp => lp.forEach(p => pos.push(p.x, p.y, p.z)));
    for (let i = 0; i < loops.length - 1; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
    [0, loops.length - 1].forEach((li, k) => { const c = V(0, 0, 0); loops[li].forEach(p => c.add(p)); c.divideScalar(m); const ci = pos.length / 3; pos.push(c.x, c.y, c.z); for (let j = 0; j < m; j++) { const a = li * m + j, b = li * m + (j + 1) % m; if (k) idx.push(ci, a, b); else idx.push(ci, b, a); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  // ---- key dimensions (metres, local frame) ----
  const RC = E.corneaRadius, QC = -0.36, APEX = E.corneaApexZ - C[2];   // prolate cornea: apical radius 7.8 mm, asphericity Q
  const corneaZ = (r) => { const c = 1 / RC, k = 1 - (1 + QC) * c * c * r * r; return APEX - c * r * r / (1 + Math.sqrt(Math.max(k, 0))); };
  const LIMB_R = 0.0078, LIMB_Z = corneaZ(LIMB_R), A_LIMB = Math.atan2(LIMB_R, LIMB_Z) / D2R;   // sclera anterior opening (~40.5 deg)
  const cornThk = (r) => 0.00055 + 0.00015 * (r / LIMB_R) * (r / LIMB_R);
  const corneaIn = (r) => corneaZ(r) - cornThk(r);
  const LZ = E.lensCenterL[2] - C[2], LA = E.lensRadius, LHA = 0.0017, LHP = E.lensThickness - LHA, LEQ = LZ + E.lensThickness / 2 - LHA;
  const lensFront = (r) => LEQ + LHA * Math.sqrt(Math.max(0, 1 - (r / LA) * (r / LA)));
  // lens outline, posterior pole -> anterior pole (CCW), scaled s about the equator centre, offset d outward
  function lensProf(s, n, d) { const o = []; for (let i = n; i >= 0; i--) { const ps = Math.PI * i / n, c = Math.cos(ps); o.push([(LA * s + (d || 0)) * Math.sin(ps), LEQ + (c >= 0 ? (LHA * s + (d || 0)) * c : -(LHP * s + (d || 0)) * Math.pow(-c, 0.85))]); } return o; }
  const IR_IN = 0.002, IR_OUT = 0.006;
  const irisFront = (r) => 0.01075 - 0.00165 * Math.pow(H.clamp((r - IR_IN) / (IR_OUT - IR_IN), 0, 1), 1.25);
  const irisBack = (r) => irisFront(r) - (0.0003 + 0.00022 * bump(r - 0.0033, 0.0012));
  const exitDir = H.v3(rel(E.opticNerveExitL)).normalize();

  // ================================================================= GLOBE: outer coat
  add(gGlobe, { id: 'sclera', name: 'sclera', latin: 'Sclera', layer: LAY.ORGAN, depth: 0.1, color: H.COLORS.sclera, mat: { roughness: 0.45 },
    geo: H.displace(shell(R, R - 0.001, A_LIMB, A_LIMB + 3.5, 16, 48), (p) => 0.000012 * H.fbm(p.x * 900, p.y * 900, p.z * 900, 2)),
    info: ['The tough white outer coat of the eyeball, made of dense interwoven collagen. It covers the posterior five-sixths of the globe and is continuous in front with the cornea at the limbus and behind with the dural sheath of the optic nerve.',
      'Protects the eye and keeps its shape against the intraocular pressure; the six extraocular muscles pull on it.',
      'Globe 24 mm in diameter; sclera about 1 mm thick at the back, thinnest (0.3 mm) just behind the rectus insertions; anterior opening ~11-12 mm wide.',
      'A bluish sclera is seen in osteogenesis imperfecta (thin collagen lets the choroid show through); a yellow sclera is the first sign of jaundice.'] });

  const cprof = [];
  for (let i = 0; i <= 7; i++) { const r = LIMB_R * 0.94 * Math.sin(Math.PI / 2 * i / 7); cprof.push([r, corneaIn(r)]); }
  for (let i = 12; i >= 0; i--) { const r = LIMB_R * Math.sin(Math.PI / 2 * i / 12); cprof.push([r, corneaZ(r)]); }
  add(gGlobe, { id: 'cornea', name: 'cornea', latin: 'Cornea', layer: LAY.ORGAN, depth: 0.1, color: H.COLORS.cornea, mat: { opacity: 0.35, roughness: 0.05, side: FS },
    geo: revolve(cprof, 48),
    info: ['The clear, dome-shaped window at the front of the eye. It has no blood vessels and is kept transparent by the regular spacing of its collagen fibres and by its pumping endothelium.',
      'Provides about two-thirds of the eye\'s focusing power (~43 dioptres) and protects the front of the eye.',
      'About 11.5 mm wide (horizontal), central radius of curvature 7.8 mm, 0.55 mm thick centrally and ~0.7 mm at the edge.',
      'One of the most densely innervated tissues in the body, so a corneal scratch is intensely painful; LASIK and PRK reshape it to correct refractive error.'] });

  const lprof = [[0.0063, corneaZ(0.0063) - 0.0003], [LIMB_R - 0.0003, LIMB_Z - 0.0004]].concat(arc(R - 0.00045, A_LIMB + 0.5, A_LIMB + 3.2, 2)).concat(arc(R + 0.00005, A_LIMB + 3.2, A_LIMB, 4));
  for (let i = 0; i <= 5; i++) { const r = LIMB_R - (LIMB_R - 0.0063) * i / 5; lprof.push([r, corneaZ(r) + 0.00004]); }
  lprof.push(lprof[0].slice());
  add(gGlobe, { id: 'limbus', name: 'corneoscleral limbus', latin: 'Limbus corneae', layer: LAY.ORGAN, depth: 0.1, color: '#9aa6b0', mat: { roughness: 0.35 },
    geo: revolve(lprof, 48),
    info: ['The 1-2 mm wide grey-blue transition zone where the clear cornea meets the white sclera. It houses the corneal stem cells and, on its inner side, the drainage angle with the trabecular meshwork and Schlemm\'s canal.',
      'Regenerates the corneal surface and drains aqueous humour out of the eye.',
      'Ring ~11.7 mm across and 1-2 mm wide.',
      'Surgeons enter the eye at the limbus for cataract and glaucoma operations; a grey ring just inside it (arcus) can signal high cholesterol in younger adults.'] });

  // ================================================================= uvea: choroid, iris
  add(gGlobe, { id: 'choroid', name: 'choroid', latin: 'Choroidea', layer: LAY.ORGAN, depth: 0.3, color: H.COLORS.choroid, mat: { roughness: 0.7 },
    geo: H.displace(shell(R - 0.00105, R - 0.0014, 62, 62, 14, 48), (p) => 0.00004 * H.fbm(p.x * 700 + 3, p.y * 700, p.z * 700, 3)),
    info: ['A dark, pigmented, blood-rich layer between the sclera and the retina, forming the back part of the uveal tract. Its capillary layer (choriocapillaris) lies against the retinal pigment epithelium.',
      'Nourishes the outer retina (photoreceptors) and absorbs stray light inside the eye.',
      'About 0.2-0.3 mm thick, thickest at the posterior pole; extends forward to the ora serrata.',
      'Choroidal melanoma is the commonest primary eye cancer in adults; the choroid receives one of the highest blood flows per gram of any tissue.'] });

  const iprof = [];
  for (let i = 0; i <= 6; i++) { const r = IR_IN + (IR_OUT - IR_IN) * i / 6; iprof.push([r, irisBack(r)]); }
  for (let i = 20; i >= 0; i--) { const r = IR_IN + (IR_OUT - IR_IN) * i / 20; iprof.push([r, irisFront(r)]); }
  iprof.push([IR_IN - 0.00008, (irisFront(IR_IN) + irisBack(IR_IN)) / 2]); iprof.push(iprof[0].slice());
  const irisG = H.displace(revolve(iprof, 72), (p, nrm) => {
    const r = Math.hypot(p.x, p.y); if (nrm.z < 0.3 || r < IR_IN + 0.00015 || r > IR_OUT - 0.0001) return 0;
    const ph = Math.atan2(p.y, p.x), cx = Math.cos(ph), sy = Math.sin(ph);
    const collar = 0.00016 * bump(r - (0.0034 + 0.00012 * Math.sin(ph * 9 + 1.3)), 0.00032);
    const striae = 0.00011 * H.fbm(cx * 18, sy * 18, r * 900, 2);
    const cr = H.noise3(cx * 7 + 2, sy * 7, r * 1400), crypt = -0.00022 * H.smoothstep(0.3, 0.6, cr) * H.smoothstep(0.0026, 0.0031, r) * (1 - H.smoothstep(0.0045, 0.005, r));
    const furrow = -0.00008 * (bump(r - 0.0049, 0.00012) + bump(r - 0.0055, 0.00012)) * (0.6 + 0.4 * Math.sin(ph * 5));
    return collar + striae + crypt + furrow;
  });
  add(gGlobe, { id: 'iris', name: 'iris', latin: 'Iris', layer: LAY.ORGAN, depth: 0.3, color: H.COLORS.iris, mat: { roughness: 0.75 }, geo: irisG,
    info: ['The coloured, contractile diaphragm in front of the lens, part of the uveal tract. Its front surface shows radial fibres, pit-like crypts and a zig-zag collarette; its back is lined by dark pigment epithelium.',
      'Controls how much light enters the eye: the sphincter pupillae (parasympathetic) narrows the pupil, the dilator pupillae (sympathetic) widens it.',
      '12 mm in diameter, 0.3-0.6 mm thick; pupil 2-8 mm.',
      'Eye colour depends only on the amount of melanin in the front layers - blue irises have little, brown have much; the crypt pattern is unique enough for biometric iris scans.'] });

  add(gGlobe, { id: 'pupil', name: 'pupil', latin: 'Pupilla', layer: LAY.ORGAN, depth: 0.3, color: H.COLORS.pupil, mat: { roughness: 0.2 },
    geo: H.translate(H.reaxis(H.cylinder(IR_IN + 0.00005, IR_IN + 0.00005, 0.00008, 40), 'z'), 0, 0, 0.01076),
    info: ['The round opening in the centre of the iris. It looks black because light entering it is absorbed inside the eye.',
      'Admits light to the lens and retina; its size adjusts to brightness, focusing distance and emotion.',
      '2-4 mm in daylight, up to 8 mm in darkness; shown here at 4 mm.',
      'Unequal or unreactive pupils are an urgent neurological sign (e.g. a third-nerve palsy from raised intracranial pressure).'] });

  const acp = [[0, lensFront(0) + 0.00004]];
  for (let i = 1; i <= 4; i++) { const r = IR_IN * 0.95 * i / 4; acp.push([r, lensFront(r) + 0.00004]); }
  for (let i = 0; i <= 5; i++) { const r = IR_IN + (IR_OUT - IR_IN) * i / 5; acp.push([r, irisFront(r) + 0.00005]); }
  acp.push([0.0067, 0.0092]);
  for (let i = 8; i >= 0; i--) { const r = 0.0066 * i / 8; acp.push([r, corneaIn(r) - 0.00003]); }
  add(gGlobe, { id: 'anterior-chamber', name: 'anterior chamber (aqueous humour)', latin: 'Camera anterior bulbi', layer: LAY.ORGAN, depth: 0.3, color: '#bfe0f0', mat: { opacity: 0.15, roughness: 0.05, side: FS },
    geo: revolve(acp, 40),
    info: ['The fluid-filled space between the back of the cornea and the front of the iris and lens, filled with clear aqueous humour made by the ciliary body.',
      'Aqueous humour nourishes the lens and cornea and maintains the intraocular pressure (10-21 mmHg).',
      'About 3 mm deep centrally, volume ~0.25 ml; aqueous is replaced roughly every 100 minutes.',
      'If drainage at the angle is blocked, pressure rises (glaucoma) and slowly damages the optic nerve; a shallow chamber predisposes to acute angle-closure.'] });

  // ================================================================= retina + vitreous
  add(gGlobe, { id: 'retina', name: 'retina', latin: 'Retina (pars optica)', layer: LAY.ORGAN, depth: 0.5, color: H.COLORS.retina, mat: { roughness: 0.6 },
    geo: shell(R - 0.00142, R - 0.0017, 65, 65, 14, 48),
    info: ['The thin light-sensitive neural layer lining the back of the eye from the optic disc to the scalloped ora serrata. It has ten layers, with rods and cones at the back and the ganglion cells whose axons form the optic nerve on the inner surface.',
      'Converts the focused image into nerve signals and begins processing them (contrast, colour, motion) before sending them to the brain.',
      'About 0.25 mm thick (0.1 mm at the fovea); ~120 million rods and 6 million cones; surface ~1100 mm2.',
      'A retinal detachment (flashes, floaters, a curtain over the vision) is an emergency; diabetes and high blood pressure can be seen directly in the retinal vessels.'] });

  const vp = arc(R - 0.0018, 180, 64, 14);
  vp.push([0.0086, 0.0054], [0.0076, 0.0063], [0.0064, 0.0072], [0.0049, 0.0082]);
  lensProf(1, 12, 0.0001).filter(q => q[1] <= LEQ - 0.00005).reverse().forEach(q => vp.push(q));
  add(gGlobe, { id: 'vitreous-body', name: 'vitreous body', latin: 'Corpus vitreum', layer: LAY.ORGAN, depth: 0.6, color: H.COLORS.vitreous, mat: { opacity: 0.12, roughness: 0.05, side: FS },
    geo: revolve(vp, 40),
    info: ['The clear gel that fills the large cavity behind the lens (about 80% of the eye\'s volume). It is 99% water held in a mesh of collagen fibrils and hyaluronic acid, attached firmly at the ora serrata and optic disc.',
      'Keeps the globe inflated, holds the retina in place and transmits light to it.',
      'Volume ~4 ml; about 16-17 mm from lens to retina.',
      'With age it liquefies and can peel off the retina (posterior vitreous detachment), causing floaters; vitreous samples are used in forensic medicine.'] });

  // ================================================================= lens
  add(gGlobe, { id: 'lens-capsule', name: 'lens capsule', latin: 'Capsula lentis', layer: LAY.ORGAN, depth: 0.62, color: '#f4f2ea', mat: { opacity: 0.22, roughness: 0.1, side: FS },
    geo: revolve(lensProf(1, 18, 0.00006), 40),
    info: ['The thin, elastic, transparent basement membrane that wraps the whole lens; the zonular fibres attach to it around the equator.',
      'Shapes the lens during accommodation and anchors it to the zonules.',
      '4-23 micrometres thick, thickest near the equator in front.',
      'In cataract surgery the front of the capsule is opened (capsulorhexis) and the empty bag holds the artificial lens implant.'] });
  add(gGlobe, { id: 'lens', name: 'crystalline lens (cortex)', latin: 'Lens (cortex lentis)', layer: LAY.ORGAN, depth: 0.66, color: H.COLORS.lens, mat: { opacity: 0.55, roughness: 0.15, side: FS },
    geo: revolve(lensProf(1, 18, 0), 40),
    info: ['A transparent biconvex lens hung behind the iris by the zonules. It is built of long, tightly packed fibre cells laid down in layers like an onion, with no blood vessels or nerves.',
      'Fine-tunes focus (about one-third of the eye\'s power, ~20 D) by changing shape: it becomes rounder for near vision when the ciliary muscle contracts.',
      '9 mm in diameter and 4 mm thick in an adult; the back surface is more curved than the front.',
      'It keeps growing all life and stiffens, causing presbyopia after ~45; clouding of the lens (cataract) is the leading cause of blindness worldwide.'] });
  add(gGlobe, { id: 'lens-nucleus', name: 'lens nucleus', latin: 'Nucleus lentis', layer: LAY.ORGAN, depth: 0.7, color: '#e9d7a2', mat: { opacity: 0.9, roughness: 0.3, side: FS },
    geo: revolve(lensProf(0.62, 14, 0), 32),
    info: ['The dense central core of the lens, made of the oldest fibre cells, some formed before birth.',
      'Forms the central, highest-refractive-index part of the lens.',
      'About 6 x 2.5 mm, growing and hardening with age.',
      'A nuclear cataract turns yellow-brown with age and can temporarily improve near vision ("second sight").'] });

  // ================================================================= ciliary body, zonules, drainage angle
  const cbp = arc(R - 0.00115, 63, 44, 6);
  cbp.push([0.00625, 0.0089], [0.0064, 0.0083], [0.0069, 0.0075], [0.0077, 0.0066], [0.0086, 0.0057], [0.0094, 0.0048]);
  cbp.push(cbp[0].slice());
  const cbParts = [revolve(cbp, 48)];
  const dmR = 0.607, dmZ = -0.794;                                   // meridional direction of the pars plicata
  for (let k = 0; k < 70; k++) {
    const ph = (k + 0.3 * (hash(k) - 0.5)) / 70 * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
    const tau = V(-sp, cp, 0), dm = V(dmR * cp, dmR * sp, dmZ), nn = V(0, 0, 0).crossVectors(tau, dm).normalize();
    const b = H.blob([0.00017, 0.001 + 0.0002 * hash(k + 9), 0.00035], { ws: 5, hs: 4 });
    const M = new THREE.Matrix4().makeBasis(tau, dm, nn); b.applyMatrix4(M);
    b.translate(0.00705 * cp + nn.x * 0.00012, 0.00705 * sp + nn.y * 0.00012, 0.00745 + nn.z * 0.00012);
    cbParts.push(b);
  }
  add(gGlobe, { id: 'ciliary-body', name: 'ciliary body', latin: 'Corpus ciliare', layer: LAY.ORGAN, depth: 0.3, color: '#4b2a22', mat: { roughness: 0.7 },
    geo: H.merge(cbParts),
    info: ['A ring of muscle and folded, vascular epithelium between the iris root and the ora serrata, part of the uveal tract. Its front part (pars plicata) carries about 70 radial ciliary processes; its back part (pars plana) is flat.',
      'The ciliary processes secrete aqueous humour; the ciliary muscle contracts to slacken the zonules so the lens rounds up for near focus (accommodation).',
      'Ring ~6 mm wide from front to back (pars plicata 2 mm, pars plana 4 mm); processes ~2 mm long and 0.5-1 mm high.',
      'Glaucoma drops and some laser treatments reduce aqueous production here; atropine paralyses the ciliary muscle (cycloplegia) for eye examinations.'] });

  const zon = [];
  for (let k = 0; k < 60; k++) {
    const ph = (k + 0.5) / 60 * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph), kind = k % 3;
    const a = [0.0067 * cp, 0.0067 * sp, 0.0078 - 0.0005 * kind];
    const lr = kind === 1 ? LA + 0.00005 : LA - 0.0004, lz = LEQ + (kind === 0 ? 0.0006 : kind === 2 ? -0.0007 : 0);
    zon.push(H.tube([a, [lr * cp, lr * sp, lz]], 0.00003, { radial: 3, tubular: 1, caps: false }));
  }
  add(gGlobe, { id: 'zonule-fibres', name: 'zonular fibres (suspensory ligament of the lens)', latin: 'Fibrae zonulares', layer: LAY.ORGAN, depth: 0.61, color: '#f3f0e2', mat: { opacity: 0.85, roughness: 0.3 },
    geo: H.merge(zon),
    info: ['Hundreds of fine, transparent fibrillin threads running from the ciliary processes and pars plana to the capsule in front of, at, and behind the lens equator.',
      'Hold the lens centred behind the pupil and transmit the pull of the ciliary body: taut zonules flatten the lens for distance vision.',
      'Each fibre 5-30 micrometres thick; the zonular gap spans ~0.5-2 mm.',
      'In Marfan syndrome (fibrillin defect) the zonules are weak and the lens often dislocates upward (ectopia lentis).'] });

  add(gGlobe, { id: 'schlemm-canal', name: 'Schlemm\'s canal', latin: 'Sinus venosus sclerae', layer: LAY.ORGAN, depth: 0.2, color: '#b9606b', mat: { roughness: 0.5 },
    geo: H.translate(H.torus(0.0074, 0.00013, { radial: 6, tubular: 48 }), 0, 0, 0.0086),
    info: ['A circular channel running around the eye in the limbal sclera, just outside the trabecular meshwork of the drainage angle.',
      'Collects aqueous humour filtered through the trabecular meshwork and passes it to the episcleral veins.',
      'Ring ~12 mm across; channel ~0.2-0.3 mm wide.',
      'Resistance to outflow here raises eye pressure in open-angle glaucoma; minimally invasive glaucoma stents are placed into the canal.'] });

  // ================================================================= fundus: macula, fovea, optic disc
  const RF = R - 0.00173;                                             // just in front of the retinal inner surface
  add(gGlobe, { id: 'macula', name: 'macula lutea', latin: 'Macula lutea', layer: LAY.ORGAN, depth: 0.5, color: '#c98d3c', mat: { roughness: 0.55 },
    geo: cap(2.75 / 10.2 / D2R, RF, (u) => -0.00002 * bump(u - 0.45, 0.3), [0, 0, -1], 6, 32),
    info: ['An oval, yellowish area at the centre of the back of the retina, on the visual axis, coloured by the carotenoid pigments lutein and zeaxanthin.',
      'Provides sharp central and colour vision - reading, recognising faces, driving.',
      'About 5.5 mm across, centred ~3.5-4 mm temporal to the optic disc.',
      'Age-related macular degeneration destroys central vision while peripheral vision remains; it is the main cause of sight loss in older adults in wealthy countries.'] });
  add(gGlobe, { id: 'fovea', name: 'fovea centralis', latin: 'Fovea centralis', layer: LAY.ORGAN, depth: 0.5, color: '#7e2c1c', mat: { roughness: 0.4 },
    geo: cap(0.75 / 10.2 / D2R, RF - 0.00005, (u) => 0.00003 * (1 - u * u), [0, 0, -1], 4, 24),
    info: ['A small pit in the centre of the macula where the inner retinal layers are pushed aside so light falls directly on densely packed cones; it contains no rods and no blood vessels.',
      'The point of sharpest vision: we move our eyes to put whatever we look at onto the fovea.',
      '1.5 mm across; central foveola 0.35 mm with ~150,000-200,000 cones per mm2.',
      'In a central retinal artery occlusion the fovea stands out as a "cherry-red spot" against the pale, swollen retina.'] });
  add(gGlobe, { id: 'optic-disc', name: 'optic disc', latin: 'Discus nervi optici', layer: LAY.ORGAN, depth: 0.5, color: '#f0d7aa', mat: { roughness: 0.5 },
    geo: cap(0.75 / 10.2 / D2R, RF - 0.00003, (u) => 0.00005 * (1 - H.smoothstep(0.2, 0.6, u)), exitDir, 5, 28),
    info: ['The pale, round head of the optic nerve, where about 1.2 million ganglion-cell axons leave the eye and the central retinal vessels enter; it has a central depression, the optic cup.',
      'Carries all visual signals out of the eye; having no photoreceptors, it forms the physiological blind spot.',
      '1.5-1.8 mm in diameter, about 3-4 mm nasal to the fovea and slightly above it; normal cup-to-disc ratio < 0.5.',
      'An enlarging cup signals glaucoma; a swollen disc (papilloedema) signals raised intracranial pressure.'] });

  // ================================================================= intraorbital optic nerve (to the orbit apex) + central retinal vessels
  const apex = rel(E.orbitApexL), ex = rel(E.opticNerveExitL), ond = H.v3(E.opticNerveDir).normalize();
  const ON = [exitDir.clone().multiplyScalar(R - 0.0013).toArray(), [ex[0] + ond.x * 0.004, ex[1], ex[2] + ond.z * 0.004],
    [ex[0] + ond.x * 0.012 + 0.0005, ex[1] - 0.0008, ex[2] + ond.z * 0.012], [apex[0], apex[1], apex[2] + 0.006], apex];
  add(gOrbit, { id: 'optic-nerve', name: 'optic nerve (intraorbital part)', latin: 'Nervus opticus (pars orbitalis)', layer: LAY.NERVE, depth: 0.3, color: H.COLORS.nerve, mat: { roughness: 0.55 },
    geo: H.tube(ON, (t) => 0.0015 + 0.0005 * H.smoothstep(0, 0.12, t), { radial: 14, step: 0.0012 }),
    info: ['Cranial nerve II, a bundle of about 1.2 million retinal ganglion-cell axons. Its orbital part runs in a gentle S-curve from the back of the eyeball to the optic canal at the orbit apex; beyond the apex it continues to the optic chiasm.',
      'Carries visual information from the retina to the brain.',
      'Orbital part ~25 mm long (slack allows eye movement), 3-4 mm thick; whole nerve ~45-50 mm.',
      'It is a tract of the central nervous system, so it does not regenerate; inflammation (optic neuritis) is often the first sign of multiple sclerosis.'] });
  const ONS = [exitDir.clone().multiplyScalar(R - 0.0002).toArray()].concat(ON.slice(1));
  add(gOrbit, { id: 'optic-nerve-sheath', name: 'optic nerve sheath', latin: 'Vagina externa nervi optici', layer: LAY.NERVE, depth: 0.1, color: '#ece3d3', mat: { opacity: 0.55, roughness: 0.5, side: FS },
    geo: H.tube(ONS, (t) => 0.0024 + 0.0006 * (1 - H.smoothstep(0, 0.12, t)), { radial: 16, step: 0.0014 }),
    info: ['The three meningeal layers (dura, arachnoid, pia) that wrap the optic nerve from the brain to the eyeball, where the dura blends with the sclera. The subarachnoid space inside it contains cerebrospinal fluid.',
      'Protects the nerve and carries CSF pressure forward to the back of the eye.',
      'Outer diameter ~4.5-5 mm.',
      'An optic nerve sheath diameter above ~5-6 mm on ultrasound suggests raised intracranial pressure.'] });

  const onp = (t, dx, dy) => { const p = H.curvePoint(ON, t); return [p.x + dx, p.y + dy, p.z]; };
  const U0 = Math.atan2(exitDir.x, -exitDir.z) / D2R, V0 = Math.asin(exitDir.y) / D2R;
  const F = (u, v, rr) => { const a = u * D2R, b = v * D2R; return [rr * Math.sin(a) * Math.cos(b), rr * Math.sin(b), -rr * Math.cos(a) * Math.cos(b)]; };
  function fundusTube(ctrl, rr, r0, r1) {
    const pts = []; for (let i = 0; i < ctrl.length - 1; i++) { const [u0, v0] = ctrl[i], [u1, v1] = ctrl[i + 1], n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 2)); for (let k = 0; k < n; k++) pts.push(F(u0 + (u1 - u0) * k / n, v0 + (v1 - v0) * k / n, rr)); }
    pts.push(F(ctrl[ctrl.length - 1][0], ctrl[ctrl.length - 1][1], rr));
    return H.tube(pts, (t) => r0 + (r1 - r0) * t, { radial: 4, step: 0.0006 });
  }
  const D0 = [U0, V0];
  const ARC = [
    [D0, [-13, 1], [-8, 8], [0, 12], [12, 13], [26, 11], [42, 9], [58, 10]], [D0, [-13, -11], [-8, -18], [0, -21], [12, -21], [26, -18], [42, -15], [58, -15]],
    [D0, [-18, 2], [-24, 12], [-33, 24], [-45, 35], [-58, 44]], [D0, [-18, -12], [-24, -22], [-33, -33], [-45, -43], [-57, -52]]];
  const SUB = [[[0, 12], [3, 7], [4.5, 4]], [[12, 13], [20, 22], [30, 32], [40, 40]], [[0, -21], [3, -14], [4.5, -7]], [[12, -21], [20, -30], [30, -40], [40, -47]],
    [[-24, 12], [-35, 8], [-48, 7]], [[-24, -22], [-36, -18], [-49, -17]], [[26, 11], [30, 4], [34, -1]], [[-33, 24], [-30, 36], [-26, 48]]];
  function retinalVessel(isVein) {
    const s = isVein ? 1 : 0, rr = RF - 0.00003 - s * 0.00002, r0 = isVein ? 0.00008 : 0.00006, dx = isVein ? -0.0003 : 0.0003;
    const off = (c, i) => i === 0 ? c : [c[0] + s * 0.9, c[1] + s * (c[1] >= V0 ? 1.1 : -1.1)];
    const list = [H.tube([onp(0.45, dx, -0.0036), onp(0.4, dx, -0.0021), onp(0.34, dx, -0.0006), onp(0.2, dx, 0), onp(0.05, dx * 0.7, 0), F(U0, V0, rr)], r0 * 1.3, { radial: 5, step: 0.001 })];
    ARC.forEach(a => list.push(fundusTube(a.map(off), rr, r0, r0 * 0.35)));
    SUB.forEach(a => list.push(fundusTube(a.map((c, i) => i === 0 ? off(c, 1) : off(c, 1)), rr, r0 * 0.6, r0 * 0.25)));
    return H.merge(list);
  }
  add(gGlobe, { id: 'central-retinal-artery', name: 'central retinal artery', latin: 'Arteria centralis retinae', layer: LAY.ORGAN, depth: 0.5, color: H.COLORS.artery, mat: { roughness: 0.4 },
    geo: retinalVessel(false), tags: ['vessel'],
    info: ['A branch of the ophthalmic artery that pierces the underside of the optic nerve about 1 cm behind the eye, runs in its centre to the optic disc and divides into superior and inferior, nasal and temporal branches arching over the retina (the temporal arcades curve around the macula).',
      'Supplies the inner two-thirds of the retina; it is an end artery with no useful collaterals.',
      'About 0.1-0.16 mm in diameter at the disc; the fovea itself is avascular.',
      'Sudden painless loss of vision from its occlusion is a stroke-equivalent emergency; retinal arterioles are the only arteries in the body that can be looked at directly.'] });
  add(gGlobe, { id: 'central-retinal-vein', name: 'central retinal vein', latin: 'Vena centralis retinae', layer: LAY.ORGAN, depth: 0.5, color: H.COLORS.vein, mat: { roughness: 0.4 },
    geo: retinalVessel(true), tags: ['vessel'],
    info: ['Formed at the optic disc by four retinal venous branches that run beside the arteries; it leaves the optic nerve with the artery and drains into the superior ophthalmic vein or cavernous sinus.',
      'Drains blood from the inner retina.',
      'About 1.5 times the width of the matching artery (artery:vein ratio ~2:3).',
      'A central retinal vein occlusion gives a "blood-and-thunder" fundus with widespread haemorrhages; loss of spontaneous venous pulsation at the disc can hint at raised intracranial pressure.'] });

  const pole = LEQ - LHP - 0.00015;
  add(gGlobe, { id: 'hyaloid-canal', name: 'hyaloid canal (Cloquet\'s canal)', latin: 'Canalis hyaloideus', layer: LAY.ORGAN, depth: 0.6, color: '#dcecf5', mat: { opacity: 0.2, roughness: 0.1, side: FS },
    geo: H.tube([exitDir.clone().multiplyScalar(RF - 0.0001).toArray(), [-0.0018, -0.0006, -0.004], [-0.0006, 0.0002, 0.002], [0, 0, pole]], (t) => 0.0006 + 0.0004 * t, { radial: 10, step: 0.0012 }),
    info: ['A narrow, clear channel running through the vitreous from the optic disc to the back of the lens.',
      'The remnant of the path of the fetal hyaloid artery, which nourished the developing lens and normally regresses before birth.',
      'About 1-2 mm wide and ~15 mm long, widening towards the lens.',
      'Incomplete regression leaves a tiny dot on the back of the lens (Mittendorf dot) or a tag on the disc (Bergmeister papilla).'] });

  // ================================================================= EYELIDS (height field over the globe / orbital septum), tarsal plates, lashes
  const zGlobe = (x, y) => { const r = Math.hypot(x, y); return r < LIMB_R ? corneaZ(r) : r < R ? Math.sqrt(R * R - r * r) : -0.02; };
  const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
  function zEll(x, y) {
    const rx = 0.021, ry = 0.024 + 0.002 * Math.tanh(y / 0.003);
    const rz = 0.0128 - 0.0034 * H.smoothstep(0.002, 0.015, x) - 0.0012 * H.smoothstep(0.002, 0.016, -x) - 0.0065 * H.smoothstep(0.0135, 0.0195, x) - 0.0105 * H.smoothstep(0.0145, 0.0195, -x);   // dives back beyond the canthi into the orbital socket
    return rz * Math.sqrt(Math.max(1 - (x / rx) * (x / rx) - (y / ry) * (y / ry), 0.0004));
  }
  const zIn = (x, y) => smax(zGlobe(x, y) + 0.00035, zEll(x, y), 0.0008);
  const nrmOf = (zf) => (x, y) => { const e = 0.00015; return V(-(zf(x + e, y) - zf(x - e, y)) / (2 * e), -(zf(x, y + e) - zf(x, y - e)) / (2 * e), 1).normalize(); };
  const lidN = nrmOf(zIn);
  // tarsal plates conform to the globe: at the margin they lie in the back of the lid, higher up they curve back onto a
  // sphere (TRS about the eye centre) under the overhanging lid fold, as in the open eye - this keeps them inside the orbit
  const TRS = 0.0143, sminK = (a, b, k) => (a + b - Math.sqrt((a - b) * (a - b) + k * k)) / 2;
  const zTar = (x, y) => sminK(zIn(x, y), Math.sqrt(Math.max(TRS * TRS - x * x - y * y, 1e-6)), 0.0006);
  const XM = -0.0145, XL = 0.0135, XC = (XM + XL) / 2, XH = (XL - XM) / 2;       // medial / lateral canthus (fissure ~28 mm)
  const canY = (x) => -0.0003 + 0.0015 * (x - XM) / (XL - XM);                   // lateral canthus ~1.5 mm higher
  const marginY = (x, up) => { const u = H.clamp((x - XC) / XH, -1, 1), w = Math.pow(Math.max(0, 1 - u * u), 0.75); return canY(x) + (up ? 0.0058 * w * (1 - 0.12 * u) : -0.0042 * w * (1 + 0.1 * u)); };
  const edgeY = (x, up) => { const u = (x - XC) / XH; return up ? 0.021 - 0.006 * u * u : -0.0165 + 0.004 * u * u; };
  const thickU = (t) => 0.0021 + 0.0006 * H.smoothstep(0, 0.3, t) - 0.0021 * H.smoothstep(0.62, 1, t) - 0.0004 * bump(t - 0.56, 0.05) + 0.0005 * bump(t - 0.65, 0.07);
  const thickD = (t) => 0.0019 + 0.0004 * H.smoothstep(0, 0.3, t) - 0.0017 * H.smoothstep(0.6, 1, t) - 0.0002 * bump(t - 0.45, 0.06);
  function lidLoop(x, up, t0, t1, nt, inOff, thick, round, zf) {
    const zs = zf || zIn, nf = zf ? nrmOf(zf) : lidN;
    const et = H.smoothstep(XM - 0.005, XM - 0.0005, x) * H.smoothstep(XL + 0.006, XL + 0.0005, x), tk = 0.3 + 0.7 * et;
    const ym = marginY(x, up), ye = ym + (edgeY(x, up) - ym) * tk, inner = [], outer = [];
    for (let i = 0; i <= nt; i++) {
      const t = t0 + (t1 - t0) * i / nt, y = ym + (ye - ym) * t, n = nf(x, y), P = V(x, y, zs(x, y));
      inner.push(P.clone().addScaledVector(n, inOff));
      outer.push(P.clone().addScaledVector(n, thick(t) * tk + 0.00003 * H.fbm(x * 2500, y * 2500, 1.7, 2)));
    }
    const loop = []; for (let i = nt; i >= 0; i--) loop.push(outer[i]);
    if (round) {
      const m = inner[0].clone().sub(inner[1]).normalize(), c = inner[0].clone().add(outer[0]).multiplyScalar(0.5), a = outer[0].clone().sub(inner[0]).multiplyScalar(0.5), al = a.length();
      for (let k = 1; k < 5; k++) { const b = Math.PI * k / 5; loop.push(c.clone().addScaledVector(a, Math.cos(b)).addScaledVector(m, al * 0.9 * Math.sin(b))); }
    }
    for (let i = 0; i <= nt; i++) loop.push(inner[i]);
    return loop;
  }
  function lidGeo(up, x0, x1, ns, t0, t1f, nt, inOff, thick, round, zf) {
    const loops = []; for (let i = 0; i <= ns; i++) { const x = x0 + (x1 - x0) * i / ns; loops.push(lidLoop(x, up, t0, t1f(x), nt, inOff, thick, round, zf)); }
    return loftLoops(loops);
  }
  add(gAdnexa, { id: 'eyelid-upper', name: 'upper eyelid', latin: 'Palpebra superior', layer: LAY.SKIN, depth: 0, color: H.COLORS.eyelid, mat: { roughness: 0.65 },
    geo: lidGeo(true, XM - 0.005, XL + 0.006, 30, 0, () => 1, 10, 0, thickU, true),
    info: ['A mobile fold of very thin skin over a layer of orbicularis muscle, a stiff tarsal plate and the palpebral conjunctiva. Its margin carries the lashes in front and the openings of the meibomian glands behind; a skin crease marks where the levator aponeurosis inserts.',
      'Protects the cornea, spreads the tear film with every blink (15-20 per minute) and shuts out light during sleep.',
      'Covers the top 1-2 mm of the cornea; crease ~8-10 mm above the margin; lid skin <1 mm thick, the thinnest in the body.',
      'A drooping upper lid (ptosis) can come from a stretched levator aponeurosis, a third-nerve palsy, Horner syndrome or myasthenia gravis.'] });
  add(gAdnexa, { id: 'eyelid-lower', name: 'lower eyelid', latin: 'Palpebra inferior', layer: LAY.SKIN, depth: 0, color: H.COLORS.eyelid, mat: { roughness: 0.65 },
    geo: lidGeo(false, XM - 0.005, XL + 0.006, 30, 0, () => 1, 10, 0, thickD, true),
    info: ['The smaller, less mobile lower fold of skin, orbicularis muscle, tarsal plate and conjunctiva; its margin lies at the lower edge of the cornea.',
      'Supports the globe, guides tears towards the lower punctum and helps close the eye.',
      'Palpebral fissure between the two lids ~28-30 mm wide and 9-10 mm high.',
      'With age the lower lid can turn out (ectropion, causing watering) or in (entropion, lashes rub the cornea).'] });
  // vertical (projected) heights: the upper plate's 7 mm rise wraps ~10 mm of curved surface; plates run from just medial
  // of the punctum (the lacrimal part of the lid has no tarsus) to near the lateral canthus
  const tarH = (up) => (x) => { const u = H.clamp((x - XC) / XH, -1, 1), h = (up ? 0.0070 : 0.0045) * Math.pow(Math.max(0.02, 1 - u * u), 0.55); return h / Math.abs(edgeY(x, up) - marginY(x, up)); };
  add(gAdnexa, { id: 'tarsal-plate-upper', name: 'upper tarsal plate', latin: 'Tarsus superior', layer: LAY.FAT, depth: 0.2, color: '#efe2cc', mat: { roughness: 0.5 },
    geo: lidGeo(true, XM + 0.004, XL - 0.0015, 20, 0.03, tarH(true), 8, 0.0003, () => 0.0013, false, zTar),
    info: ['A plate of dense fibrous tissue that forms the skeleton of the upper lid, D-shaped and tallest in the middle. About 25-30 tall meibomian glands lie embedded in it vertically.',
      'Keeps the lid stiff and curved to fit the globe; its glands secrete the oily layer of the tear film.',
      '~29 mm long, 10 mm tall centrally, 1 mm thick.',
      'A blocked meibomian gland forms a chalazion, a painless lump in the tarsus; everting the upper lid over the tarsus is how foreign bodies are found.'] });
  add(gAdnexa, { id: 'tarsal-plate-lower', name: 'lower tarsal plate', latin: 'Tarsus inferior', layer: LAY.FAT, depth: 0.2, color: '#efe2cc', mat: { roughness: 0.5 },
    geo: lidGeo(false, XM + 0.004, XL - 0.0015, 20, 0.03, tarH(false), 5, 0.0003, () => 0.0012, false, zTar),
    info: ['The narrower fibrous plate of the lower lid, containing about 20 meibomian glands.',
      'Stiffens the lower lid and holds its margin against the globe.',
      '~29 mm long, 4-5 mm tall, ~1 mm thick.',
      'Lower-lid tightening surgery shortens and re-anchors the tarsus to the lateral orbital rim.'] });

  const lash = [];
  function lashRow(up, count, len, seed) {
    for (let i = 0; i < count; i++) {
      const s = 0.16 + 0.81 * (i + 0.5 + 0.4 * (hash(i + seed) - 0.5)) / count, x = XM + s * (XL - XM), y = marginY(x, up), n = lidN(x, y);
      const P = V(x, y, zIn(x, y)), m = V(0, up ? -1 : 1, 0), Lk = len * (0.8 + 0.25 * Math.sin(Math.PI * s) + 0.15 * hash(i + seed + 50));
      const r0 = P.clone().addScaledVector(n, (up ? thickU(0) : thickD(0)) * 0.8).addScaledVector(m, 0.0004), spl = V((x - XC) * 0.15 * Lk / 0.009, 0, 0);
      const pts = [r0, r0.clone().addScaledVector(n, 0.3 * Lk).addScaledVector(m, 0.03 * Lk), r0.clone().addScaledVector(n, 0.62 * Lk).addScaledVector(m, -0.06 * Lk).addScaledVector(spl, 0.5),
        r0.clone().addScaledVector(n, 0.86 * Lk).addScaledVector(m, -0.27 * Lk).add(spl)];
      lash.push(H.tube(pts, (t) => 0.00007 * (1 - 0.75 * t), { radial: 3, tubular: 6, caps: false }));
    }
  }
  lashRow(true, 25, 0.0088, 3); lashRow(false, 12, 0.0055, 40);
  add(gAdnexa, { id: 'eyelashes', name: 'eyelashes', latin: 'Cilia', layer: LAY.SKIN, depth: 0, color: H.COLORS.hair, mat: { roughness: 0.5 },
    geo: H.merge(lash),
    info: ['Short, curved hairs in two to three rows along the front edge of each lid margin, absent from the lacrimal part medial to the puncta; the upper lashes curl upward, the lower ones downward.',
      'Shield the eye from dust and trigger a protective blink when touched.',
      '~100-150 upper lashes 8-12 mm long, ~50-80 lower lashes 6-8 mm; each lasts 3-5 months (represented here by 25 + 12).',
      'Lashes turning in towards the cornea (trichiasis) cause scarring; repeated trachoma infection is a leading infectious cause of blindness through this mechanism.'] });

  // ================================================================= conjunctiva, caruncle, tear drainage
  add(gAdnexa, { id: 'conjunctiva', name: 'bulbar conjunctiva', latin: 'Tunica conjunctiva bulbi', layer: LAY.ORGAN, depth: 0, color: '#f6eceb', mat: { opacity: 0.45, roughness: 0.2, side: FS },
    geo: revolve(arc(R + 0.00025, 100, A_LIMB + 0.8, 10), 48),
    info: ['A thin, transparent mucous membrane covering the white of the eye up to the limbus; at the fornices it folds back to line the inner surface of both lids (palpebral conjunctiva).',
      'Lubricates the eye with mucus and tears, lets the lids glide over the globe and forms a barrier against infection.',
      'Epithelium only a few cell layers thick; upper fornix ~10 mm and lower ~8 mm from the limbus.',
      'Its fine vessels dilate in conjunctivitis ("pink eye"); a painless bright-red subconjunctival haemorrhage looks alarming but is usually harmless.'] });
  const carZ = zIn(-0.0128, 0.0004) - 0.0005;
  add(gAdnexa, { id: 'caruncle', name: 'lacrimal caruncle', latin: 'Caruncula lacrimalis', layer: LAY.SKIN, depth: 0.05, color: '#d98a8a', mat: { roughness: 0.4 },
    geo: H.translate(H.blob([0.0021, 0.0027, 0.0017], { ws: 14, hs: 10, noise: { amp: 0.08, freq: 4 } }), -0.0128, 0.0004, carZ),
    info: ['The small pink, fleshy nodule in the inner corner of the eye, with the crescent-shaped plica semilunaris just lateral to it. It is modified skin carrying fine hairs, sweat and sebaceous glands.',
      'Collects debris ("sleep") and helps direct tears towards the puncta.',
      'About 5 mm tall and 3 mm wide.',
      'The plica semilunaris beside it is a vestige of the nictitating membrane (third eyelid) of other animals.'] });
  const xp = XM + 0.006, can = [];
  for (const up of [true, false]) {
    const sg = up ? 1 : -1, y0 = marginY(xp, up);
    // vertical ampulla, then horizontal along the lid margin; the two converge behind the caruncle into the common canaliculus
    can.push(H.tube([[xp, y0 + sg * 0.0001, zIn(xp, y0) + 0.0003], [xp, y0 + sg * 0.0018, zIn(xp, y0 + sg * 0.0018) + 0.0008], [-0.0123, canY(-0.0123) + sg * 0.0019, zIn(-0.0123, canY(-0.0123) + sg * 0.0019) + 0.0001],
      [-0.0145, 0.0003 + sg * 0.0008, 0.006], [-0.0159, 0.0003, 0.0039], [-0.0176, 0.0002, 0.0033]], 0.00034, { radial: 6, step: 0.0008 }));
  }
  add(gAdnexa, { id: 'lacrimal-canaliculi', name: 'lacrimal puncta and canaliculi', latin: 'Canaliculi lacrimales', layer: LAY.ORGAN, depth: 0.05, color: '#e3a99c', mat: { roughness: 0.4 },
    geo: H.merge(can),
    info: ['Two tiny openings (puncta) on small elevations near the inner end of each lid margin lead into fine channels that run 2 mm vertically and then 8 mm horizontally, joining as a common canaliculus that enters the lacrimal sac.',
      'Drain tears from the eye surface; blinking pumps them towards the sac.',
      'Puncta ~0.3 mm wide, about 6 mm lateral to the inner canthus; canaliculi ~10 mm long, 0.5-1 mm wide.',
      'A punctal plug is inserted to keep tears on the eye in dry-eye disease.'] });
  add(gAdnexa, { id: 'lacrimal-sac', name: 'lacrimal sac', latin: 'Saccus lacrimalis', layer: LAY.ORGAN, depth: 0.05, color: '#e3a99c', mat: { roughness: 0.4 },
    geo: H.translate(H.blob([0.0022, 0.0058, 0.0023], { ws: 14, hs: 10, deform: (p) => 1 - 0.12 * H.smoothstep(0.2, 1, -p.y) }), -0.0185, -0.0012, 0.0032),
    info: ['A membranous pouch lying in the lacrimal fossa of the medial orbital wall, behind the medial canthal tendon; its upper end is closed and its lower end continues as the nasolacrimal duct.',
      'Collects tears from the canaliculi and passes them down to the nose.',
      '12-15 mm tall, 4-8 mm across.',
      'Infection of a blocked sac (dacryocystitis) gives a tender swelling at the inner corner; dacryocystorhinostomy bypasses the blockage into the nose.'] });
  add(gAdnexa, { id: 'nasolacrimal-duct', name: 'nasolacrimal duct', latin: 'Ductus nasolacrimalis', layer: LAY.ORGAN, depth: 0.05, color: '#e3a99c', mat: { roughness: 0.4 },
    geo: H.tube([[-0.0187, -0.0064, 0.003], [-0.0192, -0.016, 0.0012], [-0.0197, -0.026, -0.0005], rel([C[0] - 0.02, 1.60, 0.07])], (t) => 0.0016 - 0.0004 * t + 0.0004 * H.smoothstep(0.85, 1, t), { radial: 10, step: 0.002 }),
    info: ['A membranous canal running down from the lacrimal sac through a bony canal in the maxilla to open under the inferior nasal concha, guarded by a mucosal fold (valve of Hasner).',
      'Carries tears into the nose - which is why crying makes the nose run.',
      '12-18 mm long, 3-4 mm wide.',
      'In ~5% of newborns the lower end is still closed, causing a watery, sticky eye that usually opens by itself within the first year.'] });

  // ================================================================= EXTRAOCULAR MUSCLES (flat straps from the annulus at the apex, wrapping the globe to their insertions)
  const cM = new THREE.Color(H.COLORS.muscle), cT = new THREE.Color(H.COLORS.tendon), TR = [cT.r / cM.r, cT.g / cM.g, cT.b / cM.b];
  const tendon = (ts, t0) => (t) => { const k = Math.max(H.smoothstep(ts - 0.05, ts + 0.02, t), 1 - H.smoothstep(t0 * 0.5, t0, t)); return [1 + (TR[0] - 1) * k, 1 + (TR[1] - 1) * k, 1 + (TR[2] - 1) * k]; };
  const offAx = (z) => { const k = H.clamp(z / apex[2], 0, 1); return V(apex[0] * k, apex[1] * k, z); };
  function rectus(u, ins, ts) {
    const uo = V(u[0], u[1], 0), gp = (deg, rr) => { const a = deg * D2R; return uo.clone().multiplyScalar(rr * Math.sin(a)).setZ(rr * Math.cos(a)); };
    const pts = [offAx(apex[2] + 0.0012).addScaledVector(uo, 0.0028), offAx(-0.027).addScaledVector(uo, 0.0092), offAx(-0.015).addScaledVector(uo, 0.0142),
      gp(104, 0.0131), gp(82, 0.0128), gp(67, 0.01245), H.v3(ins).normalize().multiplyScalar(R + 0.0003)];
    return sweep(pts, { n: 26, radial: 10, exp: 2.6, vcol: tendon(ts, 0.06),
      w: (t) => 0.0014 + 0.0026 * H.smoothstep(0, 0.35, t) + 0.0008 * H.smoothstep(0.6, 1, t),
      h: (t) => 0.0002 + 0.0005 * (1 - H.smoothstep(0.7, 0.85, t)) + 0.001 * bump(t - 0.33, 0.22),
      hint: (t, p) => { const w = H.smoothstep(-0.006, 0.004, p.z); return uo.clone().multiplyScalar(1 - w).add(p.clone().normalize().multiplyScalar(w)); },
      bend: (t) => H.smoothstep(0.55, 0.75, t) / 0.0126 });
  }
  const MUS = { color: H.COLORS.muscle, mat: { roughness: 0.55 }, layer: LAY.MUSCLE_DEEP, tags: ['muscle'], vcolors: true };
  const REC = [
    ['rectus-medial', 'medial rectus', 'Musculus rectus medialis', [-1, 0], E.medialRectusIns, 0.91, 'Rotates the eye inward (adduction), towards the nose.', 'The largest and strongest rectus, ~40 mm long; its tendon inserts ~5.5 mm from the limbus.', 'Supplied by the oculomotor nerve (CN III); weakness causes an outward-drifting eye. Converging both medial recti lets us look at near objects.'],
    ['rectus-lateral', 'lateral rectus', 'Musculus rectus lateralis', [1, 0], E.lateralRectusIns, 0.8, 'Rotates the eye outward (abduction), away from the nose.', '~40 mm long; tendon ~8.8 mm long, inserting ~6.9 mm from the limbus.', 'The only muscle of the abducens nerve (CN VI, "LR6"); a sixth-nerve palsy - often the first sign of raised intracranial pressure - leaves the eye unable to look outward.'],
    ['rectus-superior', 'superior rectus', 'Musculus rectus superior', [0, 1], E.superiorRectusIns, 0.86, 'Elevates the eye (mainly when it looks outward) and also turns it in and rotates it inward (intorsion).', '~42 mm long; inserts ~7.7 mm from the limbus, obliquely.', 'Supplied by the superior division of CN III; it is tied to the levator by fascia, so the lid rises when we look up.'],
    ['rectus-inferior', 'inferior rectus', 'Musculus rectus inferior', [0, -1], E.inferiorRectusIns, 0.87, 'Depresses the eye (mainly when it looks outward) and also turns it in and rotates it outward (extorsion).', '~40 mm long; inserts ~6.5 mm from the limbus.', 'It can be trapped in a blow-out fracture of the orbital floor, preventing upward gaze and causing double vision; enlarged in thyroid eye disease.']];
  REC.forEach((r, i) => add(gOrbit, Object.assign({}, MUS, { id: r[0], name: r[1], latin: r[2], depth: 0.35, geo: rectus(r[3], r[4], r[5]),
    info: ['A flat strap muscle arising from the common tendinous ring at the orbit apex and running forward along the orbital wall to insert by a thin, broad, white tendon on the sclera in front of the equator.', r[6], r[7], r[8]] })));

  const soPts = [[-0.007, 0.0025, -0.035], [-0.0115, 0.0095, -0.022], [-0.0155, 0.0148, -0.006], [-0.0166, 0.0165, 0.0045], [-0.017, 0.017, 0.008],
    [-0.0138, 0.0166, 0.0062], [-0.0065, 0.0146, 0.0028], [0.0015, 0.0122, -0.0015], V(0.0068, 0.0089, -0.0047).normalize().multiplyScalar(R + 0.0003)];
  const soCore = (t) => 0.0008 + 0.0009 * bump(t - 0.27, 0.2) * (1 - H.smoothstep(0.4, 0.5, t));
  const soG = sweep(soPts, { n: 40, radial: 8, vcol: tendon(0.52, 0.05), w: (t) => soCore(t) + 0.0037 * H.smoothstep(0.75, 1, t), h: (t) => soCore(t) - 0.0006 * H.smoothstep(0.75, 1, t),
    hint: (t, p) => { const w = H.smoothstep(-0.02, -0.005, p.z); return V(-0.7, 0.7, 0).multiplyScalar(1 - w).add(p.clone().normalize().multiplyScalar(w)); },
    bend: (t) => H.smoothstep(0.85, 1, t) / 0.0125 });
  add(gOrbit, Object.assign({}, MUS, { id: 'oblique-superior', name: 'superior oblique', latin: 'Musculus obliquus superior', depth: 0.3, geo: soG,
    info: ['The longest, thinnest eye muscle. Its belly runs forward along the upper inner orbital wall; its round tendon passes through a cartilage pulley (the trochlea) and turns back and outward under the superior rectus to fan out on the upper-outer back quarter of the globe.',
      'Rotates the top of the eye inward (intorsion) and depresses and abducts it - most effective at looking down when the eye is turned in, as in reading or walking downstairs.',
      'Belly ~40 mm, reflected tendon ~20 mm; the reflected part runs ~54 degrees to the visual axis.',
      'Its nerve, the trochlear (CN IV), is the thinnest and longest intracranial cranial nerve; a palsy gives vertical double vision that patients reduce by tilting the head away from the affected side.'] }));
  const soC = soG.userData.curve; let tT = 0, dT = 1e9;
  for (let i = 0; i <= 200; i++) { const d = soC.getPointAt(i / 200).distanceTo(H.v3(soPts[4])); if (d < dT) { dT = d; tT = i / 200; } }
  const trPts = []; for (let i = -3; i <= 3; i++) trPts.push(soC.getPointAt(H.clamp(tT + i * 0.012, 0, 1)));
  add(gOrbit, { id: 'trochlea', name: 'trochlea of the superior oblique', latin: 'Trochlea musculi obliqui superioris', layer: LAY.MUSCLE_DEEP, depth: 0.45, color: H.COLORS.cartilage, mat: { roughness: 0.4 },
    geo: H.tube(trPts, (t) => 0.0013 + 0.0002 * Math.sin(Math.PI * t), { radial: 10, tubular: 8 }),
    info: ['A small U-shaped loop of fibrocartilage attached to the trochlear fossa of the frontal bone, just inside the upper inner orbital rim, lined by a synovial sheath.',
      'Acts as a pulley that redirects the pull of the superior oblique tendon backward and outward.',
      '~4-6 mm long; lies about 17 mm medial and 17 mm above the eye centre, just behind the rim.',
      'Inflammation here (trochleitis) causes pain at the inner upper corner of the orbit on looking up; the Brown syndrome is a tight tendon-trochlea complex that limits elevation in adduction.'] });

  const ioPts = [[-0.0125, -0.0158, 0.0098], [-0.004, -0.0152, 0.0058], [0.005, -0.0138, 0.0012], [0.0105, -0.0095, -0.0028], [0.0118, -0.0045, -0.0055], V(0.72, -0.25, -0.62).normalize().multiplyScalar(R + 0.0003)];
  add(gOrbit, Object.assign({}, MUS, { id: 'oblique-inferior', name: 'inferior oblique', latin: 'Musculus obliquus inferior', depth: 0.3,
    geo: sweep(ioPts, { n: 26, radial: 10, exp: 2.4, vcol: tendon(0.96, 0.03), w: (t) => 0.0016 + 0.0012 * bump(t - 0.4, 0.3) + 0.0018 * H.smoothstep(0.7, 1, t),
      h: (t) => 0.0003 + 0.0009 * bump(t - 0.35, 0.3), hint: (t, p) => p.clone().normalize(), bend: (t) => H.smoothstep(0.55, 0.85, t) / 0.0127 }),
    info: ['The only eye muscle that does not start at the orbit apex: it arises from the front of the orbital floor just beside the nasolacrimal canal, runs backward and outward beneath the inferior rectus and inserts on the lower-outer back quarter of the globe, near the macula.',
      'Rotates the eye outward (extorsion) and elevates and abducts it - chiefly elevation when the eye is turned in.',
      '~35 mm long; insertion ~2 mm from the macula projection.',
      'Supplied by the inferior division of CN III; overaction of this muscle is common in childhood squint and is treated by weakening surgery.'] }));

  add(gOrbit, Object.assign({}, MUS, { id: 'levator-palpebrae', name: 'levator palpebrae superioris', latin: 'Musculus levator palpebrae superioris', depth: 0.2,
    // belly over the globe under the orbital roof, then the aponeurosis turns down (radius ~16 mm about the eye centre)
    // in front of the upper tarsus to its lower third, staying inside the orbit behind the lid fold
    geo: sweep([[-0.004, 0.0048, -0.0345], [-0.0022, 0.0145, -0.019], [-0.0005, 0.0176, -0.005], [0, 0.0169, 0.0022], [0, 0.01478, 0.00612], [0, 0.01326, 0.00895], [0, 0.01111, 0.01151], [0, 0.00871, 0.01342]], {
      n: 28, radial: 10, exp: 2.6, vcol: tendon(0.66, 0.05), w: (t) => 0.0015 + 0.0025 * H.smoothstep(0, 0.55, t) + 0.0015 * H.smoothstep(0.6, 1, t),
      h: (t) => 0.00015 + 0.00035 * (1 - H.smoothstep(0.55, 0.75, t)) + 0.0007 * bump(t - 0.3, 0.2),
      hint: (t, p) => { const w = H.smoothstep(-0.008, 0.004, p.z); return V(0, 1, 0).multiplyScalar(1 - w).add(p.clone().normalize().multiplyScalar(w)); },
      bend: (t) => H.smoothstep(0.55, 0.8, t) / 0.0155 }),
    info: ['A thin triangular muscle lying above the superior rectus. It arises from the lesser wing of the sphenoid above the optic canal, runs forward to Whitnall\'s ligament and then becomes a broad aponeurosis that descends into the upper lid to the tarsal plate and skin.',
      'Raises and holds up the upper eyelid; a small smooth-muscle slip beneath it (Mueller\'s muscle) adds 1-2 mm of lift.',
      'Muscle ~40 mm, aponeurosis ~15-20 mm long and ~25 mm wide at the lid.',
      'Supplied by CN III (Mueller\'s muscle by sympathetic fibres); age-related stretching of the aponeurosis is the commonest cause of a drooping lid in adults.'] }));
  add(gOrbit, { id: 'annulus-tendineus', name: 'common tendinous ring (annulus of Zinn)', latin: 'Anulus tendineus communis', layer: LAY.MUSCLE_DEEP, depth: 0.5, color: H.COLORS.tendon, mat: { roughness: 0.5 },
    geo: H.translate(H.torus(0.0031, 0.0006, { radial: 6, tubular: 24 }), apex[0], apex[1], apex[2] + 0.0012),
    info: ['A fibrous ring at the apex of the orbit surrounding the optic canal and the middle of the superior orbital fissure.',
      'Gives origin to the four rectus muscles; the optic nerve, ophthalmic artery, oculomotor, abducens and nasociliary nerves pass through it.',
      'About 6-7 mm across.',
      'Pressure on structures inside it causes the orbital apex syndrome: vision loss plus paralysis of eye movements.'] });

  // ================================================================= orbital fat, Tenon's capsule
  const fs = [[-0.0366, 0.0028, 0.0026], [-0.03, 0.0085, 0.008], [-0.02, 0.0145, 0.0135], [-0.01, 0.0175, 0.016], [0, 0.0185, 0.0168], [0.004, 0.0172, 0.0158], [0.0065, 0.012, 0.011]]
    .map(([z, rx, ry]) => { const o = offAx(z); return { y: z, rx, rz: ry, cx: o.x, cz: -o.y }; });
  add(gOrbit, { id: 'orbital-fat', name: 'orbital fat', latin: 'Corpus adiposum orbitae', layer: LAY.FAT, depth: 0.5, color: H.COLORS.fat, mat: { opacity: 0.5, roughness: 0.6, side: FS },
    geo: H.displace(H.loft(fs, { radial: 24, subdiv: 3, axis: 'z' }), (p) => 0.0006 * H.fbm(p.x * 600 + 5, p.y * 600, p.z * 600, 2)),
    info: ['Soft, lobulated fat divided by fine septa that fills the orbit around the globe, muscles, nerves and vessels, both inside and outside the cone of the recti.',
      'Cushions the eye, lets it rotate smoothly and supports it in the orbit.',
      'Orbit volume ~30 ml, of which the globe is ~7 ml; fat makes up much of the rest.',
      'Swelling of orbital fat and muscles in thyroid eye disease pushes the eyes forward (proptosis); fat prolapsing through a weak septum forms "eye bags".'] });
  add(gOrbit, { id: 'tenon-capsule', name: 'Tenon\'s capsule (fascia bulbi)', latin: 'Vagina bulbi', layer: LAY.FAT, depth: 0.7, color: '#efe9dc', mat: { opacity: 0.3, roughness: 0.4, side: FS },
    geo: revolve(arc(R + 0.0005, 168, 52, 12), 40),
    info: ['A thin fibrous sheath enveloping the globe from the optic nerve to just behind the limbus, separated from the sclera by the episcleral space and pierced by the tendons of the eye muscles.',
      'Forms a socket in which the eye rotates smoothly, and gives rise to check ligaments and the suspensory ligament of Lockwood.',
      'About 0.5-1 mm thick; fuses with the conjunctiva ~1.5 mm behind the limbus.',
      'Anaesthetic injected into the space beneath it (sub-Tenon block) numbs the eye for cataract surgery.'] });

  // @@MORE
  return root;
});
