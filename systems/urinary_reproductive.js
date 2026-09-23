/* systems/urinary_reproductive.js - kidneys (the RIGHT one cut away coronally: cortex, pyramids, calyces, pelvis),
   ureters, bladder + trigone, sex-specific urethra, a magnified nephron inset beside the right flank, and either the male
   (testes, epididymides, vasa deferentia, seminal vesicles, prostate, bulbourethral glands, penis, scrotum) or female
   (ovaries, uterine tubes + fimbriae, uterus, cervix, vagina, labia, clitoris) organs. Both sex sets are built; only the
   ctx.sex set is returned. Every position comes from L.organ / L.spine; deterministic (fbm noise only). */
ANATOMY.register('urinary_reproductive', {
  name: 'Urinary & reproductive',
  description: 'Kidneys, ureters, bladder, urethra, nephron inset and the male or female reproductive organs'
}, function (THREE, H, L, ctx) {
  const O = L.organ, V = H.V, ORG = H.LAYER.ORGAN;
  const g = H.group('urinary_reproductive');
  const gUri = H.group('urinary'), male = H.group('reproductive-male'), female = H.group('reproductive-female'), gInset = H.group('nephron-inset');
  g.add(gUri); g.add(gInset);

  // ---------------------------------------------------------------- private helpers
  function rough(geo, amp, freq, seed, fy) { const k = fy == null ? 1 : fy; return H.displace(geo, p => amp * H.fbm(p.x * freq + seed, p.y * freq * k + seed * 0.37, p.z * freq + seed * 1.91, 2)); }
  function mk(parent, spec) { const m = H.part(Object.assign({ system: 'urinary', layer: ORG, side: 'M' }, spec)); parent.add(m); return m; }
  // mirror that keeps smooth normals (H.mirrorX recomputes normals, which flat-shades merged non-indexed geometry)
  function mirrorKeep(geo) {
    const m = geo.clone(), P = m.attributes.position, N = m.attributes.normal;
    for (let i = 0; i < P.count; i++) { P.setX(i, -P.getX(i)); if (N) N.setX(i, -N.getX(i)); }
    if (m.index) { const a = m.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    else for (const key of ['position', 'normal', 'uv']) {
      const at = m.attributes[key]; if (!at) continue; const k = at.itemSize, arr = at.array;
      for (let t = 0; t < at.count; t += 3) for (let c = 0; c < k; c++) { const x = arr[(t + 1) * k + c]; arr[(t + 1) * k + c] = arr[(t + 2) * k + c]; arr[(t + 2) * k + c] = x; }
    }
    m.userData = Object.assign({}, geo.userData); return m;
  }
  function mk2(parent, spec) {
    const pr = H.pair(Object.assign({ system: 'urinary', layer: ORG }, spec));
    if (!spec.geometry.index) pr[1].geometry = mirrorKeep(spec.geometry);
    pr.forEach(m => parent.add(m)); return pr;
  }
  // elliptical tube along a Catmull-Rom path: a = half-width along `ref` (default world X), b = half-depth along T x ref
  function sweep(pts, a, b, o) {
    o = o || {};
    const curve = new THREE.CatmullRomCurve3(pts.map(H.v3), false, 'centripetal');
    const n = o.tubular || Math.max(8, Math.min(300, Math.round(curve.getLength() / (o.step || 0.004))));
    const rad = o.radial || 16, fa = typeof a === 'function' ? a : () => a, fb = typeof b === 'function' ? b : () => b;
    const ref = H.v3(o.ref || [1, 0, 0]), P = V(0, 0, 0), T = V(0, 0, 0), X = V(0, 0, 0), D = V(0, 0, 0), pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n; curve.getPointAt(t, P); curve.getTangentAt(t, T);
      X.copy(ref).addScaledVector(T, -ref.dot(T)).normalize(); D.crossVectors(T, X);
      const ra = Math.max(1e-5, fa(t)), rb = Math.max(1e-5, fb(t));
      for (let j = 0; j <= rad; j++) { const q = j / rad * Math.PI * 2, c = Math.cos(q) * ra, s = Math.sin(q) * rb; pos.push(P.x + X.x * c + D.x * s, P.y + X.y * c + D.y * s, P.z + X.z * c + D.z * s); }
    }
    const ring = rad + 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < rad; j++) { const a0 = i * ring + j, b0 = a0 + 1, c0 = a0 + ring, d0 = c0 + 1; idx.push(a0, b0, c0, b0, d0, c0); }
    [[0, o.capStart !== false], [n, o.capEnd !== false]].forEach(([e, on]) => {
      if (!on) return; curve.getPointAt(e / n, P); const ci = pos.length / 3; pos.push(P.x, P.y, P.z);
      for (let j = 0; j < rad; j++) { const a0 = e * ring + j, b0 = a0 + 1; if (e) idx.push(ci, a0, b0); else idx.push(ci, b0, a0); }
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    geo.userData.curve = curve; return geo;
  }
  // points along a midline (sagittal) curve offset dorsally (d, along (0,Tz,-Ty)) and laterally (x)
  function offsetPath(curve, tA, tB, n, d, x) {
    const out = [], P = V(0, 0, 0), T = V(0, 0, 0);
    for (let i = 0; i <= n; i++) { const t = tA + (tB - tA) * i / n; curve.getPointAt(t, P); curve.getTangentAt(t, T); const D = V(0, T.z, -T.y).normalize(), dd = typeof d === 'function' ? d(t) : d; out.push(V(P.x + x, P.y + D.y * dd, P.z + D.z * dd)); }
    return out;
  }
  // flatten everything in front of the plane z = zc onto it (coronal cut face); use on INDEXED geometry in local space
  function halfZ(geo, zc) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) > zc) p.setZ(i, zc); geo.computeVertexNormals(); return geo; }

  // ================================================================ KIDNEYS (built in left-kidney local space, lateral = +x)
  const KL = O.kidneyL, KRm = O.kidneyR, KRX = 0.029, KRY = 0.055, KRZ = 0.0175;
  // long axis tilted (upper pole medial, rot z) and hilum turned anteromedially (rot y)
  const kMat = new THREE.Matrix4().compose(H.v3(KL.center), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, 0.2)), V(1, 1, 1));
  const kDy = KRm.center[1] - KL.center[1];                       // right kidney sits lower (liver)
  const toL = geo => geo.applyMatrix4(kMat);
  const toR = geo => { const m = mirrorKeep(geo.applyMatrix4(kMat)); m.translate(0, kDy, 0); return m; };
  const kpt = (p, side) => { const v = H.v3(p).applyMatrix4(kMat); if (side === 'R') { v.x = -v.x; v.y += kDy; } return v; };
  function kidneyShape(s) {
    return H.blob(1, { ws: 48, hs: 36, deform: p => {
      const hil = Math.exp(-((p.y / 0.3) ** 2)) * H.smoothstep(0.2, 0.95, -p.x) * Math.exp(-((p.z / 0.75) ** 2));  // hilum / renal sinus notch
      const x = p.x * (1 - 0.52 * hil) * (1 + 0.05 * p.y) * KRX * s + 0.005 * s * (1 - p.y * p.y);                 // bean: lateral border convex
      return V(x, p.y * KRY * s, p.z * KRZ * s * (p.z < 0 ? 0.9 : 1) * (1 - 0.25 * hil));                          // flatter posterior surface
    } });
  }
  const kidInfo = {
    description: 'Bean-shaped retroperitoneal organ lying on the posterior abdominal wall between T12 and L3, wrapped in a tough fibrous capsule and perirenal fat. Its hilum, facing anteromedially, transmits the renal artery, vein and pelvis.',
    function: 'Filters about 180 L of plasma a day into 1–2 L of urine, regulating water, salt, potassium, acid–base balance and blood pressure, and secretes renin, erythropoietin and active vitamin D.',
    size: 'About 11 × 6 × 3 cm, 120–170 g each; ~1 million nephrons per kidney.',
    notes: 'The right kidney usually sits 1–2 cm lower than the left because the liver lies above it. Both move 2–3 cm with breathing.'
  };
  mk2(gUri, { id: 'kidney', name: 'kidney', latin: 'Ren', depth: 0.2, region: 'abdomen', geometry: toL(rough(kidneyShape(1), 0.0004, 160, 2.1)), color: H.COLORS.kidney, info: kidInfo, tags: ['kidney'] })[1].geometry.translate(0, kDy, 0);

  // ---- right kidney coronal cutaway: posterior half of the cortex, 8 pyramids, calyces, pelvis
  mk(gUri, { id: 'kidney-cortex-r', name: 'Renal cortex (right kidney, cut)', latin: 'Cortex renalis', depth: 0.4, side: 'R', region: 'abdomen', parent: 'kidney-r', tags: ['kidney'],
    geometry: toR(halfZ(rough(kidneyShape(0.975), 0.0003, 160, 2.1), 0)), color: '#a24a3e',
    info: { description: 'Outer granular zone of the kidney, about 1 cm thick, containing the glomeruli and convoluted tubules; it dips between the pyramids as the renal columns (of Bertin).', function: 'Site of blood filtration in the renal corpuscles and of most tubular reabsorption; receives about 90% of renal blood flow.', size: 'About 1 cm thick beneath the capsule.', notes: 'Shown as the posterior half of a coronal section so the medulla and collecting system are visible.' } });
  const S = [-0.003, 0, 0], pyrs = [], cal = [], papillae = [];
  for (let i = 0; i < 8; i++) {
    const th = (-115 + i * 230 / 7) * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    const E = [c * KRX * (1 + 0.05 * s) + 0.005 * c * c, s * KRY];
    const apex = V(S[0] + 0.36 * (E[0] - S[0]), 0.36 * E[1], 0), base = V(S[0] + 0.78 * (E[0] - S[0]), 0.78 * E[1], 0);
    const len = apex.distanceTo(base), rB = Math.abs(s) > 0.9 ? 0.0056 : 0.0064;
    const cone = H.lathe([[0, 0], [0.0014, 0.0005], [rB * 0.45, len * 0.3], [rB * 0.8, len * 0.66], [rB, len * 0.93], [rB * 0.8, len], [0, len * 1.03]], { segments: 18 });
    H.displace(cone, p => 0.00022 * Math.sin(Math.atan2(p.z, p.x) * 12) * (p.y / len));   // medullary rays
    cone.scale(1, 1, 0.8); H.span(cone, apex, base); pyrs.push(halfZ(cone, 0.0012));
    papillae.push({ apex, dir: base.clone().sub(apex).normalize(), s });
  }
  mk(gUri, { id: 'kidney-medulla-pyramids-r', name: 'Renal pyramids (right kidney)', latin: 'Pyramides renales', depth: 0.5, side: 'R', region: 'abdomen', parent: 'kidney-r', tags: ['kidney'],
    geometry: toR(H.merge(pyrs)), color: '#6e2832',
    info: { description: 'Cone-shaped masses of the renal medulla with their bases toward the cortex and their apices (papillae) pointing into the minor calyces at the hilum; their striped look comes from parallel tubules and vessels.', function: 'Contain the loops of Henle, vasa recta and collecting ducts that build the medullary salt gradient and concentrate the urine.', size: '8–18 per kidney (8 shown), each about 2.5 cm tall.', notes: 'Renal papillary necrosis (analgesic abuse, diabetes, sickle-cell disease) kills the papillary tips.' } });
  // calyces: a cup around each papilla + infundibula to three major calyces
  const Cu = V(-0.002, 0.017, 0), Cm = V(0.004, 0, 0), Cl = V(-0.002, -0.017, 0), Sv = H.v3(S);
  papillae.forEach(pp => {
    const cup = H.lathe([[0.0011, -0.0032], [0.0024, -0.0008], [0.0038, 0.0016], [0.0045, 0.0036], [0.0041, 0.0041], [0.0033, 0.0024], [0.0017, 0.0003], [0, 0.0006]], { segments: 22 });
    H.span(cup, pp.apex.clone().addScaledVector(pp.dir, -0.0018), pp.apex.clone().addScaledVector(pp.dir, 0.01)); cal.push(cup);
    const J = pp.s > 0.55 ? Cu : pp.s < -0.55 ? Cl : Cm;
    cal.push(H.tube([pp.apex.clone().addScaledVector(pp.dir, -0.004), pp.apex.clone().lerp(J, 0.6).addScaledVector(pp.dir, -0.002), J], 0.0017, { radial: 8, step: 0.002 }));
  });
  [Cu, Cm, Cl].forEach(J => cal.push(H.tube([J, J.clone().lerp(Sv, 0.5), Sv], t => 0.0026 + 0.0016 * t, { radial: 10, step: 0.002 })));
  mk(gUri, { id: 'kidney-calyces-r', name: 'Renal calyces (right kidney)', latin: 'Calices renales majores et minores', depth: 0.5, side: 'R', region: 'abdomen', parent: 'kidney-r', tags: ['kidney'],
    geometry: toR(H.merge(cal)), color: '#ecd4ae',
    info: { description: 'Minor calyces are cups that clasp each renal papilla; two or three of them join into each of two or three major calyces, which unite to form the renal pelvis.', function: 'Collect urine dripping from the papillary ducts and start the peristaltic waves that drive it toward the ureter.', size: '7–14 minor calyces (8 shown) and 2–3 major calyces per kidney.', notes: 'A "staghorn" calculus is a branched stone that fills the pelvis and calyces like a cast.' } });
  const pelvisPts = [[0.002, 0.0, 0.0], [-0.008, -0.003, 0.001], [-0.017, -0.008, 0.002], [-0.024, -0.013, 0.003], [-0.028, -0.017, 0.003]];
  mk(gUri, { id: 'kidney-pelvis-r', name: 'Renal pelvis (right)', latin: 'Pelvis renalis', depth: 0.5, side: 'R', region: 'abdomen', parent: 'kidney-r', tags: ['kidney'],
    geometry: toR(H.tube(pelvisPts, t => 0.0027 + 0.0065 * Math.pow(1 - t, 1.3), { radial: 16, step: 0.002 })), color: '#e6c79f',
    info: { description: 'Funnel-shaped expansion of the upper ureter lying in the renal sinus, formed by the union of the major calyces and emerging through the hilum behind the renal vessels.', function: 'Gathers urine from the calyces and funnels it into the ureter.', size: 'Holds about 5–10 mL; narrows to 2–3 mm at the pelviureteric junction.', notes: 'The pelviureteric junction is the first of the three narrowings where kidney stones tend to lodge.' } });

  // ================================================================ URETERS: pelvis -> along psoas -> pelvic brim -> bladder base
  const zPs = L.spine.L3.z + 0.02;
  function ureterPts(side) {
    const sx = side === 'R' ? -1 : 1, low = [[0.036, 1.02, zPs - 0.001], [0.041, 0.995, -0.02], [0.053, 0.965, -0.024], [0.051, 0.942, -0.008], [0.036, 0.928, 0.012], [0.02, 0.916, 0.03], [0.014, 0.914, 0.036]];
    const top = [[-0.012, -0.005, 0.001], [-0.022, -0.011, 0.002], [-0.028, -0.017, 0.003]].map(p => kpt(p, side));
    const mid = V(0.038 * sx, (side === 'R' ? KRm.center[1] : KL.center[1]) - 0.05, zPs - 0.009);
    return top.concat([mid], low.map(p => V(p[0] * sx, p[1], p[2])));
  }
  const urInfo = side => ({
    description: 'Muscular tube that carries urine from the renal pelvis down along the front of psoas major, crosses the pelvic brim at the bifurcation of the common iliac artery, runs down the pelvic side wall and pierces the bladder base obliquely.',
    function: 'Moves urine to the bladder by peristaltic waves (1–5 per minute); its oblique course through the bladder wall acts as a one-way valve against reflux.',
    size: '25–30 cm long, 3–5 mm in diameter.',
    notes: side === 'L' ? 'Stones lodge at three narrowings: the pelviureteric junction, the pelvic brim and the vesicoureteric junction.' : 'In men the vas deferens crosses above it near the bladder; in women the uterine artery passes over it beside the cervix ("water under the bridge").'
  });
  ['L', 'R'].forEach(side => mk(gUri, { id: 'ureter-' + side.toLowerCase(), name: (side === 'L' ? 'Left' : 'Right') + ' ureter', latin: 'Ureter', depth: 0.3, side, region: 'body', tags: ['ureter'],
    geometry: H.tube(ureterPts(side), t => 0.003 + 0.0035 * (1 - H.smoothstep(0, 0.1, t)), { radial: 10, step: 0.004 }), color: H.COLORS.ureter, info: urInfo(side) }));

  // ================================================================ BLADDER (moderately filled) + trigone
  const Bc = [O.bladder.center[0], O.bladder.center[1] + 0.005, O.bladder.center[2]], BX = O.bladder.size[0] / 2, BY = 0.031, BZ = 0.034;
  const blad = H.blob(1, { ws: 48, hs: 32, deform: p => {
    let x = p.x * BX * (1 - 0.1 * Math.max(0, -p.y)), y = p.y * BY * (p.y < 0 ? 0.8 : 1), z = p.z * BZ;
    y += 0.004 * Math.max(0, p.y) * Math.max(0, p.z);                           // apex points toward the median umbilical ligament
    const nk = H.smoothstep(0.55, 1.0, -p.y);                                    // neck funnels down to the internal urethral orifice
    x *= 1 - 0.55 * nk; z = z * (1 - 0.55 * nk) - 0.005 * nk; y -= 0.006 * nk;
    return V(x, y, z);
  } });
  rough(blad, 0.0007, 210, 5.3, 0.35); blad.translate(Bc[0], Bc[1], Bc[2]);
  mk(gUri, { id: 'bladder', name: 'Urinary bladder', latin: 'Vesica urinaria', depth: 0.2, region: 'pelvis', geometry: blad, color: H.COLORS.bladder, tags: ['bladder'],
    info: { description: 'Hollow muscular reservoir behind the pubic symphysis. Its wall is the detrusor muscle (interlacing smooth-muscle bundles) lined by stretchy urothelium that folds into rugae when empty.', function: 'Stores urine at low pressure and empties it during micturition, when the detrusor contracts and the urethral sphincters relax.', size: 'Capacity 400–600 mL (urge at ~150–250 mL); shown moderately full, about 8 cm across.', notes: 'As it fills it rises above the pubis into the extraperitoneal space, so a full bladder can be drained by a suprapubic catheter without entering the peritoneum.' } });
  const trig = H.blob([0.016, 0.0022, 0.011], { ws: 32, hs: 12, deform: p => 1 + 0.2 * Math.cos(3 * (Math.atan2(p.z, p.x) - Math.PI / 2)) });
  H.transform(trig, { rot: [0.5, 0, 0], pos: [0, Bc[1] - 0.0215, Bc[2] - 0.015] });
  mk(gUri, { id: 'bladder-trigone', name: 'Bladder trigone', latin: 'Trigonum vesicae', depth: 0.5, region: 'pelvis', parent: 'bladder', geometry: trig, color: '#d98f86', tags: ['bladder'],
    info: { description: 'Smooth triangular area of the bladder base whose corners are the two ureteric orifices and the internal urethral orifice; its lining is fixed to the muscle beneath, so it never forms folds.', function: 'Funnels urine toward the urethra; the interureteric ridge between its upper corners guides the cystoscopist to the ureteric orifices.', size: 'Each side about 2.5–3 cm.', notes: 'It develops from the absorbed ends of the mesonephric ducts and is a common site of infection and of bladder tumours.' } });

  // ================================================================ MALE SET
  const RS = 'reproductive';
  // --- penis shaft centre line: root under the symphysis -> forward -> hangs down (flaccid) -> tip (external meatus)
  const PR = O.penis.root, PT = O.penis.tip;
  const shaft = new THREE.CatmullRomCurve3([PR, [0, PR[1] - 0.001, PR[2] + 0.021], [0, PR[1] - 0.01, PR[2] + 0.04], [0, PR[1] - 0.025, PR[2] + 0.047],
    [0, PT[1] + 0.038, PT[2] + 0.015], [0, PT[1] + 0.018, PT[2] + 0.01], [0, PT[1] + 0.004, PT[2] + 0.004], PT].map(H.v3), false, 'centripetal');
  const shaftLen = shaft.getLength(), GL = 0.021, tG = 1 - GL / shaftLen;          // glans occupies the last 2.1 cm
  const mUrethra = [V(0, Bc[1] - 0.02, 0.05), V(0, 0.903, 0.049), V(0, O.prostate.center[1] - 0.002, 0.047), V(0, 0.883, 0.045), V(0, 0.874, 0.044), V(0, 0.868, 0.049), V(0, 0.869, 0.059)]
    .concat(offsetPath(shaft, 0.1, 1, 18, t => -0.0085 * (1 - H.smoothstep(tG - 0.06, 1, t)), 0));
  mk(male, { id: 'urethra-male', name: 'Male urethra', latin: 'Urethra masculina', depth: 0.5, region: 'pelvis', tags: ['urethra'],
    geometry: H.tube(mUrethra, t => 0.0026 + 0.0008 * H.smoothstep(0.25, 0.35, t) * (1 - H.smoothstep(0.9, 1, t)), { radial: 10, step: 0.003 }), color: H.COLORS.urethra,
    info: { description: 'S-shaped tube about 20 cm long running from the bladder neck through the prostate (prostatic part), the pelvic floor (membranous part, with the external sphincter) and the corpus spongiosum (spongy part) to the external meatus on the glans.', function: 'Carries urine from the bladder and semen from the ejaculatory ducts to the outside.', size: 'About 18–22 cm: prostatic ~3 cm, membranous ~1–2 cm, spongy ~15 cm.', notes: 'Its double curve and narrow membranous part make catheterisation harder in men; the prostatic part is squeezed by benign prostatic enlargement.' } });
  // --- testis local frame (upper pole tilted forward and laterally)
  const TC = O.testisL.center, TR = [O.testisL.size[0] / 2, O.testisL.size[1] / 2, O.testisL.size[2] / 2];
  const tMat = new THREE.Matrix4().compose(H.v3(TC), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, -0.15)), V(1, 1, 1));
  const tpt = p => H.v3(p).applyMatrix4(tMat);
  const testis = H.blob(TR, { ws: 40, hs: 28, deform: p => 1 + 0.04 * p.y }); rough(testis, 0.0002, 300, 4.4); testis.applyMatrix4(tMat);
  mk2(male, { id: 'testis', name: 'testis', latin: 'Testis', system: RS, depth: 0.2, region: 'pelvis', geometry: testis, color: H.COLORS.testis, tags: ['male'],
    info: { description: 'Oval gonad hanging in the scrotum on the spermatic cord, enclosed in the white fibrous tunica albuginea and divided into about 250 lobules packed with seminiferous tubules.', function: 'Produces sperm (about 100 million a day) and the hormone testosterone from its interstitial Leydig cells.', size: 'About 4.5 × 2.5 × 3 cm, 15–25 mL.', notes: 'Kept 2–3 °C below core temperature; the left usually hangs a little lower. An undescended testis raises the risk of infertility and cancer.' } });
  const epiPts = [[0.003, 0.0215, -0.004], [0.006, 0.017, -0.012], [0.0065, 0.006, -0.0158], [0.006, -0.008, -0.0158], [0.004, -0.018, -0.0135], [0.001, -0.022, -0.012]].map(tpt);
  const epi = H.tube(epiPts, t => 0.0032 + 0.0026 * Math.exp(-((t / 0.16) ** 2)) + 0.0012 * Math.exp(-(((1 - t) / 0.14) ** 2)), { radial: 12, step: 0.002 });
  rough(epi, 0.0006, 700, 1.2);
  mk2(male, { id: 'epididymis', name: 'epididymis', latin: 'Epididymis', system: RS, depth: 0.25, region: 'pelvis', geometry: epi, color: '#c98d86', tags: ['male'],
    info: { description: 'Comma-shaped organ along the back of the testis made of a single, tightly coiled duct, with a head on the upper pole, a body and a tail that becomes the vas deferens.', function: 'Stores sperm and lets them mature and gain the ability to swim over about 2 weeks.', size: 'About 5 cm long; the coiled duct is about 6 m long when uncoiled.', notes: 'Epididymitis, usually from infection, causes a painful swelling behind the testis.' } });
  const vasPts = [[0.001, -0.022, -0.012], [-0.003, -0.012, -0.019], [-0.004, 0.004, -0.02], [-0.002, 0.02, -0.016], [0.0, 0.032, -0.008]].map(tpt)
    .concat([[0.024, 0.84, 0.052], [0.027, 0.868, 0.078], [0.03, 0.889, 0.09], [0.05, 0.902, 0.068], [0.066, 0.922, 0.05], [0.072, 0.938, 0.03], [0.06, 0.945, 0.012], [0.04, 0.938, 0.008], [0.022, 0.925, 0.016], [0.012, 0.914, 0.024], [0.005, 0.904, 0.034]].map(H.v3));
  mk2(male, { id: 'vas-deferens', name: 'vas deferens', latin: 'Ductus deferens', system: RS, depth: 0.3, region: 'pelvis', geometry: H.tube(vasPts, t => 0.0016 + 0.0014 * H.smoothstep(0.84, 0.9, t) * (1 - H.smoothstep(0.96, 1, t)), { radial: 8, step: 0.003 }), color: '#e2cdb8', tags: ['male'],
    info: { description: 'Thick-walled muscular duct that continues from the tail of the epididymis, climbs in the spermatic cord, passes through the inguinal canal, hooks over the ureter and widens into the ampulla behind the bladder.', function: 'Propels sperm toward the ejaculatory duct by powerful peristalsis during ejaculation.', size: 'About 30–45 cm long and 2–3 mm thick, with a narrow lumen.', notes: 'It is the cord cut and tied in a vasectomy; it feels like a firm string in the upper scrotum.' } });
  const svA = V(0.007, 0.906, 0.029), svB = V(0.038, 0.92, -0.002), svPerp = V(0, 1, 0), svPts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; svPts.push(svA.clone().lerp(svB, t).add(V(0, 0.0032 * Math.sin(t * Math.PI * 4.5), 0.0022 * Math.cos(t * Math.PI * 4.5) * (i > 0 && i < 10 ? 1 : 0)))); }
  const sv = H.tube(svPts, t => 0.0034 + 0.0022 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.0006 * Math.sin(t * 40), { radial: 14, step: 0.0018 });
  rough(sv, 0.0009, 420, 6.2);
  mk2(male, { id: 'seminal-vesicle', name: 'seminal vesicle', latin: 'Glandula vesiculosa', system: RS, depth: 0.3, region: 'pelvis', geometry: sv, color: '#d4a58f', tags: ['male'],
    info: { description: 'Lobulated sac behind the bladder base, lateral to the ampulla of the vas deferens; it is really a single tube about 15 cm long folded on itself. Its duct joins the vas to form the ejaculatory duct.', function: 'Secretes 60–70% of the semen volume: a thick, alkaline, fructose-rich fluid that fuels sperm.', size: 'About 5 cm long and 1–2 cm wide.', notes: 'Its secretion contains semenogelin, which makes semen clot briefly after ejaculation.' } });
  const pro = H.blob(1, { ws: 40, hs: 28, deform: p => {
    const ap = 1 - 0.3 * H.smoothstep(0, 1, -p.y);
    return V(p.x * 0.02 * ap, p.y * 0.015, p.z * 0.0125 * ap * (p.z < 0 ? 0.85 * (1 - 0.18 * Math.exp(-((p.x / 0.25) ** 2))) : 1));
  } });
  rough(pro, 0.0006, 260, 7.7); pro.translate(O.prostate.center[0], O.prostate.center[1], O.prostate.center[2]);
  mk(male, { id: 'prostate', name: 'Prostate', latin: 'Prostata', system: RS, layer: H.LAYER.GLAND, depth: 0.2, region: 'pelvis', geometry: pro, color: H.COLORS.prostate, tags: ['male'],
    info: { description: 'Walnut-sized fibromuscular gland just below the bladder neck that encircles the first part of the urethra; it has transition, central and peripheral zones and is pierced by the two ejaculatory ducts.', function: 'Adds a thin, slightly acidic fluid rich in PSA and zinc that makes up about 20–30% of semen and helps liquefy it.', size: 'About 4 × 3 × 2.5 cm, 20–25 g in a young adult.', notes: 'Benign enlargement of the transition zone squeezes the urethra in older men; most cancers arise in the peripheral zone, which can be felt through the rectum.' } });
  const bu = H.blob(0.0042, { ws: 18, hs: 12, noise: { amp: 0.12, freq: 3 } }); bu.translate(0.009, 0.873, 0.04);
  mk2(male, { id: 'bulbourethral-gland', name: 'bulbourethral gland', latin: 'Glandula bulbourethralis', system: RS, layer: H.LAYER.GLAND, depth: 0.3, region: 'pelvis', tags: ['male'],
    geometry: H.merge([bu, H.tube([[0.009, 0.873, 0.04], [0.005, 0.868, 0.047], [0.002, 0.867, 0.056]], 0.0007, { radial: 6, step: 0.002 })]), color: '#d7a07a',
    info: { description: "Pea-sized gland (Cowper's gland) in the deep perineal pouch beside the membranous urethra; its 2–3 cm duct opens into the spongy urethra in the bulb.", function: 'Releases clear mucus (pre-ejaculate) on arousal that lubricates the urethra and neutralises traces of acidic urine.', size: 'About 1 cm across.', notes: "The female counterpart is the greater vestibular (Bartholin's) gland." } });
  // --- penis: two dorsal corpora cavernosa (from the crura), ventral corpus spongiosum (from the bulb) ending in the glans
  const ccPts = [V(0.03, 0.87, 0.028), V(0.018, 0.876, 0.043), V(0.009, 0.882, 0.055)].concat(offsetPath(shaft, 0.04, tG - 0.01, 14, 0.0035, 0.0068));
  mk2(male, { id: 'penis-corpus-cavernosum', name: 'corpus cavernosum', latin: 'Corpus cavernosum penis', system: RS, depth: 0.3, region: 'pelvis', tags: ['male', 'penis'],
    geometry: H.tube(ccPts, t => 0.0042 + 0.003 * H.smoothstep(0, 0.25, t) - 0.0027 * H.smoothstep(0.86, 1, t), { radial: 14, step: 0.003 }), color: '#a8464f',
    info: { description: 'One of the two dorsal erectile cylinders of the penis. Each starts as a crus fixed to the ischiopubic ramus, and the pair run side by side inside the tough tunica albuginea to end under the glans.', function: 'Its spongy sinusoids fill with blood during erection, making the penis rigid.', size: 'About 15 cm long including the crus; ~1.5 cm across when flaccid.', notes: 'Carries the deep (cavernous) artery; PDE5 inhibitors act on its smooth muscle. A penile "fracture" is a tear of its tunica albuginea.' } });
  const csPts = [V(0, 0.866, 0.034), V(0, 0.867, 0.047), V(0, 0.871, 0.06)].concat(offsetPath(shaft, 0.1, tG + 0.02, 16, -0.0085, 0));
  mk(male, { id: 'penis-corpus-spongiosum', name: 'Corpus spongiosum', latin: 'Corpus spongiosum penis', system: RS, depth: 0.3, region: 'pelvis', tags: ['male', 'penis'],
    geometry: H.tube(csPts, t => 0.0052 + 0.0036 * (1 - H.smoothstep(0, 0.22, t)), { radial: 14, step: 0.003 }), color: '#c46a6a',
    info: { description: 'Single ventral erectile body surrounding the spongy urethra; it swells into the bulb in the perineum and expands at its far end into the glans.', function: 'Engorges less than the corpora cavernosa, so the urethra stays open for ejaculation during erection.', size: 'About 1 cm across in the shaft; the bulb is about 3 cm wide.', notes: 'The bulbospongiosus muscle wraps its bulb and squeezes out the last drops of urine and semen.' } });
  const glans = H.lathe([[0, 0], [0.011, 0.0005], [0.0165, 0.0025], [0.0168, 0.0042], [0.0152, 0.0065], [0.0128, 0.011], [0.0095, 0.0155], [0.005, 0.019], [0.0015, 0.0208], [0, 0.021]], { segments: 36 });
  H.displace(glans, p => -0.0016 * Math.exp(-((p.x / 0.0009) ** 2)) * Math.exp(-((p.z / 0.003) ** 2)) * H.smoothstep(0.017, 0.021, p.y));   // meatus slit
  H.span(glans, shaft.getPointAt(tG), H.v3(PT));
  mk(male, { id: 'penis-glans', name: 'Glans penis', latin: 'Glans penis', system: RS, depth: 0.2, region: 'pelvis', geometry: glans, color: '#c97a78', tags: ['male', 'penis'],
    info: { description: 'Cone-shaped cap formed by the expanded end of the corpus spongiosum, bordered by the raised corona and bearing the slit-like external urethral meatus.', function: 'Densely innervated sensory tip of the penis that also directs the urinary stream.', size: 'About 2 cm long and 3 cm across the corona.', notes: 'Covered by the prepuce (foreskin) unless circumcised; in hypospadias the meatus opens on its underside.' } });
  const pSkin = sweep(offsetPath(shaft, 0.14, tG + 0.35 * GL / shaftLen, 20, 0, 0), t => 0.0174 - 0.0024 * H.smoothstep(0.88, 1, t), t => 0.0163 - 0.002 * H.smoothstep(0.88, 1, t), { radial: 28, step: 0.003, capEnd: false });
  rough(pSkin, 0.00035, 380, 3.9, 2.5);
  mk(male, { id: 'penis-skin', name: 'Skin of the penis', latin: 'Cutis penis', system: RS, layer: H.LAYER.SKIN, depth: 0.3, region: 'pelvis', geometry: pSkin, color: H.COLORS.penis, tags: ['male', 'penis'],
    info: { description: 'Thin, hairless, loosely attached skin over the shaft that slides freely and folds over the glans as the prepuce (foreskin).', function: 'Covers the erectile bodies while allowing large changes in size.', size: 'Flaccid penis about 9 cm long and 9–10 cm around (average).', notes: 'Lymph from the penile skin drains to the superficial inguinal nodes, whereas the glans also drains to deep nodes.' } });
  const scr = H.blob(1, { ws: 44, hs: 32, deform: p => {
    const nk = H.smoothstep(0.45, 1, p.y), rap = Math.exp(-((p.x / 0.14) ** 2));
    return V(p.x * 0.038 * (1 - 0.4 * nk), (p.y > 0 ? p.y * 0.052 : p.y * 0.042) + 0.004 * rap * H.smoothstep(0, 1, -p.y), p.z * 0.031 * (1 - 0.3 * nk) * (1 - 0.08 * rap));
  } });
  rough(scr, 0.0009, 150, 9.1, 3.0); scr.translate(0, TC[1], TC[2] + 0.001);
  mk(male, { id: 'scrotum', name: 'Scrotum', latin: 'Scrotum', system: RS, layer: H.LAYER.SKIN, depth: 0.3, region: 'pelvis', geometry: scr, color: '#c08a6e', tags: ['male'],
    info: { description: 'Pouch of thin, wrinkled, pigmented skin containing the dartos smooth muscle, divided by a midline raphe and septum into two compartments, each holding a testis, epididymis and the lower spermatic cord.', function: 'Keeps the testes 2–3 °C below body temperature by wrinkling or relaxing (dartos) and by the cremaster muscle raising or lowering them.', size: 'About 7 cm across and 8–10 cm tall.', notes: 'The raphe marks where the two labioscrotal swellings fused in the embryo; their female counterpart is the labia majora.' } });

  // ================================================================ FEMALE SET
  const EX = O.urethraExitF;
  mk(female, { id: 'urethra-female', name: 'Female urethra', latin: 'Urethra feminina', depth: 0.5, region: 'pelvis', tags: ['urethra'],
    geometry: H.tube([V(0, Bc[1] - 0.02, 0.05), V(0, 0.903, 0.049), V(0, 0.89, 0.046), V(0, 0.877, 0.039), H.v3(EX)], 0.003, { radial: 12, step: 0.003 }), color: H.COLORS.urethra,
    info: { description: 'Short tube running down and forward from the bladder neck behind the pubic symphysis, embedded in the front wall of the vagina, to the external urethral orifice in the vestibule between the clitoris and the vaginal opening.', function: 'Carries urine out of the bladder; the external urethral sphincter surrounds its middle third.', size: 'About 4 cm long and 6 mm wide.', notes: 'Its shortness is the main reason bladder infections are far commoner in women than in men.' } });
  // --- uterus local frame: origin at the external os, +y along the (anteverted) uterine axis, +z anterior
  const UO = V(0, O.uterus.cervix[1] - 0.014, O.uterus.cervix[2] - 0.012), UA = V(0, O.uterus.size[1], 0.018).normalize();
  const uMat = new THREE.Matrix4().makeBasis(V(1, 0, 0), UA, V(0, -UA.z, UA.y)).setPosition(UO);
  const flex = y => 0.006 * (y / 0.075) ** 2;                                      // anteflexion: body bends forward over the bladder
  const upt = p => V(p[0], p[1], p[2] + flex(p[1])).applyMatrix4(uMat);
  const uLoft = (secs, radial, n) => H.loft(secs.map(s => ({ y: s[0], rx: s[1], rz: s[2], cz: flex(s[0]), n: n || 2 })), { radial, subdiv: 5 }).applyMatrix4(uMat);
  const ut = uLoft([[0.024, 0.0132, 0.0122], [0.034, 0.0162, 0.0142], [0.047, 0.0228, 0.0165], [0.058, 0.026, 0.0165], [0.066, 0.0245, 0.015], [0.072, 0.018, 0.011], [0.0755, 0.008, 0.005], [0.0763, 0.001, 0.001]], 40, 2.2);
  rough(ut, 0.00035, 200, 8.8);
  mk(female, { id: 'uterus', name: 'Uterus', latin: 'Uterus', system: RS, depth: 0.2, region: 'pelvis', geometry: ut, color: H.COLORS.uterus, tags: ['female', 'uterus'],
    info: { description: 'Thick-walled, pear-shaped muscular organ between the bladder and the rectum, normally tipped forward over the bladder (anteverted and anteflexed). Its dome-shaped fundus lies above the openings of the uterine tubes, above the body and isthmus.', function: 'Receives the embryo, nourishes the growing fetus and expels it by powerful myometrial contractions in labour; sheds its lining each month as menstruation.', size: 'About 7.5 × 5 × 2.5 cm and 50–70 g in a woman who has not given birth; the wall (myometrium) is 1.5–2 cm thick.', notes: 'In pregnancy it grows to about 1 kg and reaches the ribs; fibroids (leiomyomas) are common benign tumours of its muscle.' } });
  const endo = uLoft([[0.026, 0.0035, 0.004], [0.036, 0.008, 0.0065], [0.05, 0.0135, 0.0078], [0.059, 0.0155, 0.0075], [0.065, 0.011, 0.0055], [0.068, 0.004, 0.003]], 28);
  rough(endo, 0.0004, 500, 2.6);
  mk(female, { id: 'uterus-endometrium', name: 'Endometrium', latin: 'Endometrium (tunica mucosa uteri)', system: RS, depth: 0.45, region: 'pelvis', parent: 'uterus', geometry: endo, color: '#c4505f', tags: ['female', 'uterus'],
    info: { description: 'Glandular mucous lining of the uterine cavity with a permanent basal layer and a functional layer that thickens and is shed every cycle.', function: 'Prepares a blood-rich bed for implantation under oestrogen and progesterone; if no embryo implants, its functional layer breaks down as menstruation.', size: '2–4 mm thick after menstruation, up to 10–14 mm in the secretory phase.', notes: 'Endometriosis is endometrium-like tissue growing outside the uterus, a common cause of pelvic pain and infertility.' } });
  mk(female, { id: 'uterine-cavity', name: 'Uterine cavity and cervical canal', latin: 'Cavitas uteri', system: RS, depth: 0.55, region: 'pelvis', parent: 'uterus', color: '#7a2a3a', tags: ['female', 'uterus'],
    geometry: uLoft([[0.0005, 0.0018, 0.0012], [0.012, 0.0026, 0.0014], [0.024, 0.0015, 0.001], [0.034, 0.004, 0.0014], [0.05, 0.0095, 0.0016], [0.059, 0.0125, 0.0015], [0.0625, 0.007, 0.0012], [0.064, 0.001, 0.001]], 20),
    info: { description: 'Slit-like space, triangular when seen from the front, with the tubal openings at its upper corners and the internal os below, continuing through the spindle-shaped cervical canal to the external os.', function: 'Pathway for sperm upward and menstrual blood and the baby downward; the site of implantation.', size: 'About 6–7 cm from external os to fundus (cavity ~4 cm, cervical canal ~2.5–3 cm).', notes: 'An intrauterine device (IUD) sits in this cavity with its arms in the upper corners.' } });
  const cvx = H.loft([[-0.0012, 0.004, 0.004], [0, 0.0085, 0.008], [0.003, 0.0115, 0.0105], [0.012, 0.0125, 0.0115], [0.022, 0.0128, 0.0118], [0.028, 0.0134, 0.0123]].map(s => ({ y: s[0], rx: s[1], rz: s[2], cz: flex(Math.max(0, s[0])) })), { radial: 32, subdiv: 4 });
  H.displace(cvx, p => p.y < 0.002 ? -0.0022 * Math.exp(-(p.x * p.x / 0.000009 + p.z * p.z / 0.000002)) : 0);   // external os dimple
  cvx.applyMatrix4(uMat);
  mk(female, { id: 'cervix', name: 'Cervix', latin: 'Cervix uteri', system: RS, depth: 0.2, region: 'pelvis', geometry: cvx, color: '#d08a93', tags: ['female', 'uterus'],
    info: { description: 'Narrow, firm lower third of the uterus; its lower part projects into the top of the vagina and carries the small external os.', function: 'Keeps the uterus closed with a mucus plug whose consistency changes through the cycle, then softens and dilates to about 10 cm in labour.', size: 'About 2.5–3 cm long and 2.5 cm across.', notes: 'The transformation zone at the external os is where HPV-related cervical cancer starts, which is why it is sampled in screening (Pap/HPV test).' } });
  // --- ovary with follicles
  const folls = [[0.6, 0.5, 0.62], [-0.4, 0.7, 0.3], [0.2, -0.6, 0.77], [-0.7, -0.3, -0.64], [0.5, 0.2, -0.84], [-0.1, 0.9, -0.4]].map(d => V(d[0], d[1], d[2]).normalize());
  const ov = H.blob([O.ovaryL.size[0] / 2, O.ovaryL.size[1] / 2, O.ovaryL.size[2] / 2], { ws: 36, hs: 24, deform: p => { let s = 1; folls.forEach((f, i) => { s += (0.1 + 0.03 * (i % 2)) * Math.exp(-(1 - p.dot(f)) / 0.035); }); return s; } });
  rough(ov, 0.0003, 400, 5.5); H.transform(ov, { rot: [0.2, 0, 0.5], pos: O.ovaryL.center });
  mk2(female, { id: 'ovary', name: 'ovary', latin: 'Ovarium', system: RS, depth: 0.2, region: 'pelvis', geometry: ov, color: H.COLORS.ovary, tags: ['female'],
    info: { description: 'Almond-shaped gonad lying in the ovarian fossa on the side wall of the pelvis, hung from the broad ligament and tethered to the uterus by the ovarian ligament; its surface bulges with follicles.', function: 'Matures egg cells in follicles, releasing usually one each cycle (ovulation), and secretes oestrogen and progesterone.', size: 'About 3 × 2 × 1.5 cm; shrinks after menopause.', notes: 'Born with about 1–2 million primordial follicles, of which only about 400 ever ovulate.' } });
  const C0 = upt([0.02, 0.062, 0.0]);
  const tubePts = [C0, V(0.034, C0.y + 0.007, C0.z + 0.001), V(0.05, 0.986, 0.012), V(0.062, 0.982, 0.003), V(0.067, 0.973, -0.006), V(0.062, 0.965, -0.013), V(0.055, 0.962, -0.015)];
  const tube = H.tube(tubePts, t => 0.0018 + 0.0017 * H.smoothstep(0.2, 0.6, t) + 0.0025 * H.smoothstep(0.82, 1, t), { radial: 12, step: 0.002 });
  mk2(female, { id: 'fallopian-tube', name: 'uterine (fallopian) tube', latin: 'Tuba uterina', system: RS, depth: 0.25, region: 'pelvis', geometry: tube, color: '#d98c95', tags: ['female'],
    info: { description: 'Slender muscular tube in the upper edge of the broad ligament running from the uterine corner (intramural part) through the narrow isthmus and the wide, curving ampulla to the funnel-shaped infundibulum over the ovary.', function: 'Catches the ovulated egg, is the usual site of fertilisation (ampulla) and carries the early embryo to the uterus over 3–4 days by cilia and peristalsis.', size: '10–12 cm long; lumen about 1 mm at the isthmus and up to 1 cm in the ampulla.', notes: 'The ampulla is the commonest site of ectopic pregnancy; tying or removing the tubes gives permanent contraception.' } });
  const fcurve = new THREE.CatmullRomCurve3(tubePts, false, 'centripetal'), FE = fcurve.getPointAt(1), FD = fcurve.getTangentAt(1);
  const fu = V(0, 1, 0).addScaledVector(FD, -FD.y).normalize(), fw = V(0, 0, 0).crossVectors(FD, fu), fing = [];
  for (let k = 0; k < 11; k++) {
    const q = k / 11 * Math.PI * 2, rd = fu.clone().multiplyScalar(Math.cos(q)).addScaledVector(fw, Math.sin(q)), ln = k === 7 ? 0.014 : 0.006 + 0.002 * ((k * 5) % 3);
    const a0 = FE.clone().addScaledVector(rd, 0.0045), a1 = a0.clone().addScaledVector(FD, ln * 0.5).addScaledVector(rd, ln * 0.35), a2 = a0.clone().addScaledVector(FD, ln).addScaledVector(rd, ln * 0.6 + 0.001 * Math.sin(k * 2.3));
    fing.push(H.tube([a0, a1, a2], t => 0.0013 * (1 - 0.55 * t), { radial: 6, step: 0.0015 }));
  }
  mk2(female, { id: 'fimbriae', name: 'fimbriae of the uterine tube', latin: 'Fimbriae tubae uterinae', system: RS, depth: 0.25, region: 'pelvis', geometry: H.merge(fing), color: '#e0a0a6', tags: ['female'],
    info: { description: 'Finger-like fringes around the open end of the infundibulum; one longer ovarian fimbria reaches the ovary.', function: 'At ovulation they engorge and sweep over the ovary, guiding the released egg into the tube.', size: 'About 1–1.5 cm long.', notes: 'The open tubal end means the peritoneal cavity communicates with the outside via the uterus and vagina in women.' } });
  // --- vagina: collapsed (H-shaped) canal from the vault around the cervix down and forward to the vestibule
  const vag = sweep([V(0, 0.929, -0.005), V(0, 0.91, -0.001), V(0, 0.889, 0.007), V(0, 0.871, 0.012), V(0, 0.857, 0.016)], t => 0.0155 - 0.0055 * H.smoothstep(0.3, 1, t), t => 0.0128 - 0.0045 * H.smoothstep(0.25, 0.55, t), { radial: 28, step: 0.002 });
  H.displace(vag, p => 0.00045 * Math.sin(p.y * 1100));                            // transverse rugae
  mk(female, { id: 'vagina', name: 'Vagina', latin: 'Vagina', system: RS, depth: 0.3, region: 'pelvis', geometry: vag, color: H.COLORS.vagina, tags: ['female'],
    info: { description: 'Fibromuscular canal running up and back from the vestibule to the cervix, normally collapsed front-to-back into an H-shaped slit and lined by folded (rugose) stratified squamous epithelium. The cervix projects into its upper end, surrounded by the fornices.', function: 'Receives the penis and semen, lets menstrual flow out and forms the lower birth canal.', size: 'About 7–9 cm long (posterior wall longer), highly distensible.', notes: 'Lactobacilli keep its pH around 4; the posterior fornix lies right against the rectouterine pouch.' } });
  const prof = (t, lo) => lo + (1 - lo) * Math.pow(Math.sin(Math.PI * t), 0.6);
  mk2(female, { id: 'labia-majora', name: 'labium majus', latin: 'Labium majus pudendi', system: RS, layer: H.LAYER.SKIN, depth: 0.3, region: 'pelvis', color: '#c8906f', tags: ['female', 'vulva'],
    geometry: rough(sweep([V(0.011, 0.87, 0.094), V(0.0135, 0.859, 0.08), V(0.0145, 0.853, 0.058), V(0.0135, 0.85, 0.034), V(0.012, 0.849, 0.012), V(0.008, 0.851, -0.006)], t => 0.0085 * prof(t, 0.35), t => 0.011 * prof(t, 0.3), { radial: 20, step: 0.003 }), 0.0005, 200, 3.1),
    info: { description: 'Rounded fold of hair-bearing skin over a pad of fat running back from the mons pubis; the two labia majora bound the pudendal cleft.', function: 'Protect the vestibule with the urethral and vaginal openings.', size: 'About 7–8 cm long, 2–3 cm wide and 1–1.5 cm thick.', notes: 'Counterpart of the scrotum; the round ligament of the uterus ends in its fat.' } });
  mk2(female, { id: 'labia-minora', name: 'labium minus', latin: 'Labium minus pudendi', system: RS, layer: H.LAYER.SKIN, depth: 0.4, region: 'pelvis', color: '#c7797f', tags: ['female', 'vulva'],
    geometry: sweep([V(0.004, 0.872, 0.068), V(0.0055, 0.864, 0.05), V(0.0055, 0.859, 0.03), V(0.005, 0.857, 0.012), V(0.0035, 0.857, 0.0)], 0.0018, t => 0.0075 * prof(t, 0.3), { radial: 14, step: 0.0025 }),
    info: { description: 'Thin, hairless fold of skin inside the labium majus bounding the vestibule; in front the two folds split to form the hood (prepuce) and frenulum of the clitoris.', function: 'Enclose the vestibule into which the urethra and vagina open; rich in sebaceous glands and nerve endings.', size: 'About 4–5 cm long; width varies widely (roughly 1–5 cm).', notes: 'They develop from the urogenital folds, which in males fuse to enclose the spongy urethra.' } });
  const cl = [H.blob([0.0033, 0.003, 0.0038], { ws: 16, hs: 12 }).translate(0, 0.873, 0.07), H.tube([[0, 0.874, 0.068], [0, 0.883, 0.064], [0, 0.884, 0.056], [0, 0.881, 0.05]], 0.0034, { radial: 10, step: 0.002 })];
  [1, -1].forEach(sx => cl.push(H.tube([[0, 0.881, 0.05], [0.012 * sx, 0.876, 0.04], [0.024 * sx, 0.866, 0.025], [0.03 * sx, 0.858, 0.012]], t => 0.0031 - 0.0017 * t, { radial: 10, step: 0.003 })));
  mk(female, { id: 'clitoris', name: 'Clitoris', latin: 'Clitoris', system: RS, layer: H.LAYER.SKIN, depth: 0.5, region: 'pelvis', geometry: H.merge(cl), color: '#b8606c', tags: ['female', 'vulva'],
    info: { description: 'Erectile organ made of a small glans under its hood, a body that bends back under the pubic symphysis, and two crura that run along the ischiopubic rami (the vestibular bulbs lie alongside the vestibule).', function: 'Densely innervated organ whose only known role is sexual sensation; it engorges with blood during arousal.', size: 'Glans about 5 mm; body plus crura about 9–11 cm in total.', notes: 'It is the counterpart of the penis (glans and corpora cavernosa); most of it lies hidden beneath the skin.' } });

  // ================================================================ NEPHRON INSET (schematic, magnified) outside the right flank
  const IC = [-0.3, 1.05, 0.0], at = p => V(IC[0] + p[0], IC[1] + p[1], IC[2] + p[2]), atAll = a => a.map(at);
  const ins = (spec) => mk(gInset, Object.assign({ region: 'body', parent: 'inset-nephron', tags: ['inset', 'nephron'] }, spec));
  const plate = H.loft([{ y: -0.0006, rx: 0.028, rz: 0.039, n: 5 }, { y: 0.0006, rx: 0.028, rz: 0.039, n: 5 }], { radial: 48, subdiv: 1, axis: 'z' }).translate(IC[0], IC[1], IC[2] - 0.012);
  const cmLine = H.tube(atAll([[-0.027, 0.004, -0.011], [0, 0.004, -0.011], [0.027, 0.004, -0.011]]), 0.0004, { radial: 6, step: 0.004 });
  mk(gInset, { id: 'inset-nephron', name: 'Nephron (magnified inset)', latin: 'Nephron', region: 'body', depth: 0.0, tags: ['inset', 'nephron'], geometry: H.merge([plate, cmLine]), material: H.mat({ color: '#efe2d6', opacity: 0.35 }),
    info: { description: 'Schematic enlargement of one juxtamedullary nephron, the kidney\'s filtering unit: the renal corpuscle and convoluted tubules sit in the cortex (above the line), the loop of Henle and collecting duct run down into the medulla (below it).', function: 'Each nephron filters blood and then reabsorbs or secretes water and solutes along its tubule to produce urine.', size: 'About 1 million per kidney; a nephron tubule is 3–5 cm long but only ~50 µm wide (not drawn to one scale).', notes: 'About 85% of nephrons are cortical with short loops; the 15% juxtamedullary nephrons with long loops make concentrated urine possible.' } });
  const G = [-0.008, 0.02, 0], tuft = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160, lat = Math.PI * (0.12 + 0.76 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 5.3))), lon = u * Math.PI * 2 * 3.1 + 0.9 * Math.sin(u * Math.PI * 2 * 11), r = 0.0058 * (0.72 + 0.22 * Math.sin(u * Math.PI * 2 * 17));
    tuft.push([G[0] + r * Math.sin(lat) * Math.cos(lon), G[1] + r * Math.cos(lat), G[2] + r * Math.sin(lat) * Math.sin(lon)]);
  }
  const aff = H.tube(atAll([[-0.024, 0.037, 0], [-0.014, 0.031, 0], [-0.0095, 0.0262, 0], tuft[0]]), 0.0014, { radial: 8, step: 0.0015 });
  const eff = H.tube(atAll([tuft[160], [-0.0065, 0.0262, 0], [-0.005, 0.031, -0.002], [-0.002, 0.037, -0.003]]), 0.0011, { radial: 8, step: 0.0015 });
  ins({ id: 'inset-glomerulus', name: 'Glomerulus (magnified)', latin: 'Glomerulus', depth: 0.5, color: '#c0392b', geometry: H.merge([H.tube(atAll(tuft), 0.0009, { radial: 6, step: 0.0006 }), aff, eff]),
    info: { description: 'Tuft of looping capillaries fed by the wider afferent arteriole and drained by the narrower efferent arteriole, which keeps the pressure inside high.', function: 'Filters plasma through fenestrated endothelium, a basement membrane and podocyte filtration slits; together the kidneys make about 180 L of filtrate a day (GFR ~125 mL/min).', size: 'About 0.2 mm across.', notes: 'Damage to the filter (diabetic nephropathy, glomerulonephritis) lets protein and blood leak into the urine.' } });
  const bc = H.lathe([0.45, 0.9, 1.4, 1.9, 2.4, 2.8, Math.PI].map(a => [0.0085 * Math.sin(a), 0.0085 * Math.cos(a)]).concat([Math.PI, 2.8, 2.4, 1.9, 1.4, 0.9, 0.45].map(a => [0.0079 * Math.sin(a), 0.0079 * Math.cos(a)])), { segments: 32 });
  bc.translate(IC[0] + G[0], IC[1] + G[1], IC[2] + G[2]);
  ins({ id: 'inset-bowmans-capsule', name: "Bowman's capsule (magnified)", latin: 'Capsula glomerularis', depth: 0.3, geometry: bc, material: H.mat({ color: '#e8d2bd', opacity: 0.45 }),
    info: { description: 'Double-walled cup around the glomerulus: an inner layer of podocytes clasping the capillaries and an outer parietal layer, with the urinary space between. Glomerulus plus capsule form the renal corpuscle.', function: 'Collects the glomerular filtrate and channels it into the proximal tubule at the urinary pole.', size: 'About 0.2 mm across.', notes: 'In crescentic glomerulonephritis cells proliferate inside the capsule and form crescents that crush the glomerulus.' } });
  ins({ id: 'inset-proximal-tubule', name: 'Proximal convoluted tubule (magnified)', latin: 'Tubulus contortus proximalis', depth: 0.4, color: '#d9955f',
    geometry: H.tube(atAll([[-0.0105, 0.0135, 0], [-0.013, 0.012, 0.001], [-0.017, 0.011, 0.003], [-0.021, 0.015, -0.002], [-0.018, 0.021, 0.003], [-0.022, 0.027, 0.0], [-0.026, 0.022, -0.003], [-0.023, 0.016, 0.002], [-0.025, 0.01, -0.001], [-0.021, 0.005, 0.0], [-0.02, -0.004, 0.0]]), 0.0017, { radial: 10, step: 0.0012 }),
    info: { description: 'Longest part of the tubule: a coiled segment near its own corpuscle, then a straight part heading into the medulla, lined by cube-shaped cells with a dense brush border of microvilli.', function: 'Reabsorbs about two-thirds of the filtered salt and water and almost all glucose, amino acids and bicarbonate, and secretes drugs and organic acids.', size: 'About 14 mm long, 50–60 µm across.', notes: 'Glucose spills into the urine once its transporters saturate (blood glucose ~10 mmol/L); SGLT2-inhibitor drugs block glucose uptake here.' } });
  ins({ id: 'inset-loop-of-henle', name: 'Loop of Henle (magnified)', latin: 'Ansa nephroni', depth: 0.4, color: '#e2c04f',
    geometry: H.tube(atAll([[-0.02, -0.004, 0], [-0.019, -0.018, 0], [-0.017, -0.03, 0], [-0.0135, -0.0345, 0], [-0.0105, -0.03, 0], [-0.01, -0.02, 0], [-0.0095, -0.006, 0], [-0.006, 0.004, 0.002], [0.0, 0.012, 0.004], [0.001, 0.022, 0.006], [-0.003, 0.028, 0.004]]),
      t => 0.0017 - 0.0006 * (1 - H.smoothstep(0.45, 0.52, t)) * H.smoothstep(0.0, 0.08, t), { radial: 10, step: 0.0012 }),
    info: { description: 'Hairpin loop dipping into the medulla: a thin descending limb, a thin ascending limb and a thick ascending limb that climbs back to touch its own glomerulus (macula densa).', function: 'Builds the salty medullary gradient by countercurrent multiplication: the descending limb lets water out, while the water-tight thick ascending limb pumps out NaCl (NKCC2 transporter).', size: 'Reaches up to ~1 cm into the medulla in juxtamedullary nephrons.', notes: 'Loop diuretics such as furosemide block NKCC2 in the thick ascending limb and cause a large diuresis.' } });
  ins({ id: 'inset-distal-tubule', name: 'Distal convoluted tubule (magnified)', latin: 'Tubulus contortus distalis', depth: 0.4, color: '#6fa8c9',
    geometry: H.tube(atAll([[-0.003, 0.028, 0.004], [0.003, 0.033, 0.002], [0.009, 0.03, -0.003], [0.012, 0.024, 0.003], [0.008, 0.018, -0.002], [0.013, 0.013, 0.002], [0.011, 0.007, -0.002], [0.016, 0.004, 0.0], [0.0195, 0.006, 0]]), 0.0015, { radial: 10, step: 0.0012 }),
    info: { description: 'Short coiled tubule in the cortex that begins at the macula densa, where the tubule touches its own glomerulus to form the juxtaglomerular apparatus, and drains via a connecting tubule into a collecting duct.', function: 'Fine-tunes sodium, chloride and calcium reabsorption (thiazide-sensitive NCC cotransporter; calcium under parathyroid hormone control).', size: 'About 5 mm long.', notes: 'The macula densa senses tubular salt and signals the neighbouring cells to release renin when it falls.' } });
  ins({ id: 'inset-collecting-duct', name: 'Collecting duct (magnified)', latin: 'Tubulus renalis colligens', depth: 0.4, color: '#8a7fc2',
    geometry: H.tube(atAll([[0.021, 0.036, 0], [0.0205, 0.02, 0], [0.02, 0.0, 0], [0.019, -0.02, 0], [0.018, -0.036, 0]]), t => 0.0018 + 0.0012 * t, { radial: 12, step: 0.002 }),
    info: { description: 'Duct that collects urine from several nephrons and runs straight down through the medulla, merging with others to open at the tip of a renal papilla (papillary ducts of Bellini).', function: 'Makes the final adjustment of urine: antidiuretic hormone inserts aquaporin-2 water channels, and aldosterone controls sodium and potassium exchange.', size: 'About 20 mm long, widening toward the papilla.', notes: 'Without ADH or a response to it (diabetes insipidus), many litres of dilute urine are passed each day.' } });

  // @@MORE
  g.add(ctx.sex === 'female' ? female : male);
  return g;
});
