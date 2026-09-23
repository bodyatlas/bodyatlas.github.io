/* systems/integumentary.js - Integumentary system: whole-body skin (head with face, neck, trunk, arms, hands with 5 fingers,
   legs, feet with toes), scalp hair, eyebrows, lips, nipples/areolae, nails, female breasts (skin mound), the subcutaneous
   fat layer (layer FAT) and a magnified skin-block cross-section beside the left thigh.
   Everything is positioned from core/landmarks.js (L). Units: metres. +X = subject's LEFT, +Z = anterior, Y up. Deterministic. */
ANATOMY.register('integumentary', {
  name: 'Integumentary (skin, hair, nails, fat)',
  description: 'Whole-body skin with face, hair, eyebrows, lips, nipples, nails, female breasts, subcutaneous fat and a magnified skin block'
}, function (THREE, H, L, ctx) {
  const g = H.group('integumentary');
  const SYS = 'integumentary', PI = Math.PI, LY = H.LAYER, female = ctx.sex === 'female';
  const SKIN = H.COLORS.skin, FAT = H.COLORS.fat;

  // ------------------------------------------------------------------ private helpers
  const G2 = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));
  const G3 = (p, c, s) => { const a = (p.x - c[0]) / s[0], b = (p.y - c[1]) / s[1], d = (p.z - c[2]) / s[2]; return Math.exp(-(a * a + b * b + d * d)); };
  const smin = (a, b, k) => { const h = H.clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
  const cm = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  // Catmull-Rom interpolated row of a table T (rows [key, v1, v2, ...], keys monotonic) at key k
  function tabAt(T, k) {
    const n = T.length, dsc = T[0][0] > T[n - 1][0];
    let i = 0; while (i < n - 2 && (dsc ? k < T[i + 1][0] : k > T[i + 1][0])) i++;
    const t = H.clamp((k - T[i][0]) / (T[i + 1][0] - T[i][0]), 0, 1);
    const a = T[Math.max(0, i - 1)], b = T[i], c = T[i + 1], d = T[Math.min(n - 1, i + 2)];
    return b.map((_, j) => cm(a[j], b[j], c[j], d[j], t));
  }
  // distance from Vector3 p to segment a-b (arrays)
  function segD(p, a, b) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], l2 = ux * ux + uy * uy + uz * uz;
    const t = H.clamp(((p.x - a[0]) * ux + (p.y - a[1]) * uy + (p.z - a[2]) * uz) / l2, 0, 1);
    return Math.hypot(p.x - a[0] - ux * t, p.y - a[1] - uy * t, p.z - a[2] - uz * t);
  }
  // indexed grid surface fn(u,v)->Vector3; u wraps around (counter-clockwise seen from above), v runs top -> bottom => outward normals
  function grid(nu, nv, fn) {
    const pos = [], idx = [], r = nu + 1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p.x, p.y, p.z); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * r + i, b = a + 1, c = a + r, d = c + 1; idx.push(a, b, c, b, d, c); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  // average the duplicated seam normals of a sphere/grid layout (rows of nu+1 vertices) so no lighting seam shows
  function weld(geo, nu, nv) {
    const n = geo.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
    return geo;
  }
  // place a geometry built about the origin (+Y = long axis, +Z = outward face) into a frame
  function orient(geo, origin, yAxis, zHint) {
    const Y = H.v3(yAxis).normalize(), X = new THREE.Vector3().crossVectors(Y, H.v3(zHint)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
    return geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(H.v3(origin)));
  }
  // ray-cast onto a (temporary, never returned) mesh: first hit point + face normal
  const rc = new THREE.Raycaster(), rayMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  function hit(geo, from, dir) { rc.set(H.v3(from), H.v3(dir).normalize()); const r = rc.intersectObject(new THREE.Mesh(geo, rayMat), false); return r.length ? { p: r[0].point.clone(), n: r[0].face.normal.clone() } : null; }
  // fat copy: surface pushed ~6 mm inward along normals with a faint lobular fbm texture
  const fatOf = (geo, d) => H.displace(geo, p => -(d || 0.006) + 0.0006 * H.fbm(p.x * 90 + 3.1, p.y * 90, p.z * 90, 2));
  // merge (non-indexed, position+normal). H.merge spreads huge arrays into push() and overflows the call stack on big meshes.
  function merge(list) {
    const gs = list.filter(Boolean).map(x => x.index ? x.toNonIndexed() : x); let n = 0;
    gs.forEach(x => { if (!x.attributes.normal) x.computeVertexNormals(); n += x.attributes.position.array.length; });
    const P = new Float32Array(n), N = new Float32Array(n); let o = 0;
    gs.forEach(x => { P.set(x.attributes.position.array, o); N.set(x.attributes.normal.array, o); o += x.attributes.position.array.length; });
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return out;
  }
  // H.loft with its end caps re-wound outward (H.loft emits both caps facing inward, so they are culled from outside)
  function loft(S, o) {
    const geo = H.loft(S, o), r = o.radial || 48, nc = (o.capBottom !== false ? 1 : 0) + (o.capTop !== false ? 1 : 0), a = geo.index.array;
    for (let i = a.length - nc * r * 3; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
    geo.index.needsUpdate = true; geo.computeVertexNormals(); return geo;
  }
  function add(s) { const m = H.part(Object.assign({ system: SYS, layer: LY.SKIN, depth: 0, side: 'M' }, s)); g.add(m); return m; }
  function add2(s, o) { const ps = H.pair(Object.assign({ system: SYS, layer: LY.SKIN, depth: 0 }, s), o); ps.forEach(m => g.add(m)); return ps; }
  const skinMat = () => H.mat({ color: SKIN, roughness: 0.55 });

  // =================================================================== HEAD: face + scalp as one sculpted deformed sphere
  const HD = L.head, yEq = HD.center[1], Ht = L.y.crown - yEq, czH = HD.center[2];
  const Weq = HD.width / 2, Feq = HD.frontZ - czH, Beq = czH - HD.backZ;
  // face & jaw cross-sections below the widest level: [y, half-width, midline front z, back z, front superellipse exponent]
  const LOW = [
    [yEq, Weq, HD.frontZ, HD.backZ, 2.6], [1.640, 0.0768, 0.0925, -0.0985, 2.55], [1.625, 0.0752, 0.0915, -0.0945, 2.4],
    [1.610, 0.0728, 0.0940, -0.0885, 2.2], [1.595, 0.0698, 0.0975, -0.0810, 2.0], [1.580, 0.0664, 0.0990, -0.0725, 1.85],
    [1.565, 0.0625, 0.0970, -0.0640, 1.8], [1.550, 0.0565, 0.0955, -0.0560, 1.8], [1.535, 0.0500, 0.0920, -0.0490, 1.8],
    [1.520, 0.0380, 0.0860, -0.0420, 1.8], [1.505, 0.0220, 0.0760, -0.0350, 1.8]];
  function sec(y) {
    if (y >= yEq) {   // cranial vault: superellipsoid dome, flatter forehead than occiput
      const w = H.clamp((y - yEq) / Ht, 0, 1), k = m => Math.pow(Math.max(0, 1 - Math.pow(w, m)), 1 / m);
      return { W: Weq * k(2.3), F: Feq * k(2.9), B: Beq * k(2.1), nF: 2.6, nB: 2.2 };
    }
    const r = tabAt(LOW, y); return { W: r[1], F: r[2] - czH, B: czH - r[3], nF: r[4], nB: 2.2 };
  }
  function secPt(a, y) {
    const S = sec(y), c = Math.cos(a), s = Math.sin(a), e = 2 / (s >= 0 ? S.nF : S.nB);
    return [S.W * Math.sign(c) * Math.pow(Math.abs(c), e), y, czH + (s >= 0 ? S.F : S.B) * Math.sign(s) * Math.pow(Math.abs(s), e)];
  }
  const EYE = HD.eyeL, EAR = HD.earCanalL;
  // facial relief (forward offsets), lateral relief, and the orbital recess that leaves the cornea uncovered
  function sculpt(x, y, z, a) {
    const s = Math.sin(a), c = Math.cos(a), fw = H.smoothstep(0.02, 0.4, s), ax = Math.abs(x), sx = x < 0 ? -1 : 1;
    let dz = 0;
    dz += 0.0042 * G2(ax - 0.027, y - (L.y.brow + 0.0005), 0.019, 0.0062);   // superciliary arches (brow ridge)
    dz += 0.0020 * G2(x, y - 1.669, 0.011, 0.009);                          // glabella
    dz -= 0.0035 * G2(x, y - 1.647, 0.010, 0.007);                          // nasion
    dz += 0.0050 * G2(ax - 0.050, y - 1.614, 0.013, 0.011);                 // zygomatic prominence (cheekbone)
    dz -= 0.0028 * G2(ax - 0.044, y - 1.587, 0.011, 0.012);                 // hollow below the cheekbone
    const sd = (ax - 0.019) * 0.952 + (y - 1.594) * 0.307, tl = ((ax - 0.019) * 0.307 - (y - 1.594) * 0.952) / 0.0326;
    dz += G2(tl - 0.5, 0, 0.62, 1) * (-0.0012 * G2(sd, 0, 0.0018, 1) + 0.0016 * G2(sd - 0.0055, 0, 0.0045, 1)); // nasolabial fold
    dz -= 0.0022 * G2(x, y - HD.mouth[1], 0.023, 0.0022);                   // oral fissure
    dz += 0.0012 * G2(x, y - 1.578, 0.018, 0.006);                          // upper-lip body
    dz -= 0.0008 * G2(x, y - 1.580, 0.0022, 0.0045);                        // philtrum
    dz -= 0.0030 * G2(x, y - 1.5445, 0.019, 0.0042);                        // mentolabial sulcus
    dz += 0.0055 * G2(x, y - (HD.chin[1] + 0.005), 0.015, 0.0095);          // chin (mental protuberance)
    z += dz * fw;
    let dx = 0;
    dx -= 0.0030 * G2(z - 0.045, y - 1.665, 0.020, 0.018);                  // temple hollow
    dx += 0.0028 * G2(z - 0.018, y - 1.575, 0.020, 0.016);                  // masseter
    dx += 0.0022 * G2(z + 0.036, y - 1.603, 0.011, 0.010);                  // mastoid process
    dx -= 0.0050 * G2(z - EAR[2], y - EAR[1], 0.0065, 0.0075);              // ear socket (concha / external meatus; auricle = ear module)
    x += sx * dx * Math.abs(c);
    const ex = ax - EYE[0], ey = y - EYE[1];
    if (fw > 0 && ex * ex + ey * ey < 0.0016) {   // orbit: skin sits on the rim, eyeball + cornea left open (r ~ 14 mm)
      const r = Math.hypot(ex / 1.1, ey * (ey < 0 ? 1.3 : 1.0));
      const zt = EYE[2] - 0.0075 + 0.045 * H.smoothstep(0.0092, 0.030, r);   // rises well above the face before the region edge
      z = H.lerp(z, smin(z, zt, 0.004), fw);
    }
    return new THREE.Vector3(x, y, z);
  }
  // parameterisation: phi = azimuth (front columns denser), v 0..vE dome, vE..vF face/jaw rows, vF..1 floor under the jaw
  const vE = 0.36, vF = 0.86, BETA = 0.42, FL = [0, 1.566, 0.004];
  const ybot = s => s >= 0 ? H.lerp(1.556, 1.513, H.smoothstep(0.08, 0.8, s)) : H.lerp(1.556, 1.578, Math.pow(-s, 1.2));
  function headPt(phi, v) {
    const a = phi - BETA * Math.sin(phi - PI / 2), s = Math.sin(a);
    let P;
    if (v <= vE) P = secPt(a, yEq + Ht * Math.sin((PI / 2) * (1 - v / vE)));
    else if (v <= vF) P = secPt(a, yEq - (v - vE) / (vF - vE) * (yEq - ybot(s)));
    else {
      const t = (v - vF) / (1 - vF), yb = ybot(s), E = secPt(a, yb), k = Math.cos(t * PI / 2);
      const drop = s > 0 ? 0.006 + 0.004 * s * s : 0.006;
      P = [FL[0] + (E[0] - FL[0]) * k, yb + (FL[1] - yb) * t * t - drop * Math.sin(t * PI / 2) * (1 - t) * 2, FL[2] + (E[2] - FL[2]) * k];
    }
    return sculpt(P[0], P[1], P[2], a);
  }
  const headGeo = (ws, hs) => weld(H.blob(1, { ws, hs, deform: p => headPt(Math.atan2(p.z, p.x), Math.acos(H.clamp(p.y, -1, 1)) / PI) }), ws, hs);
  // nose: upper hemisphere = dorsum from the tip up to the bridge, lower hemisphere = lobule, alae and nostril floor
  const TIP = HD.noseTip, NOS = HD.nostrilL;
  function nosePt(p) {
    const hr = Math.hypot(p.x, p.z), cx = hr > 1e-9 ? p.x / hr : 0, sz = hr > 1e-9 ? p.z / hr : 1;
    let y, hs, zf, hw;
    if (p.y >= 0) { const f = p.y; y = TIP[1] + f * (L.y.noseBridge + 0.008 - TIP[1]); hs = Math.pow(Math.max(0, 1 - Math.pow(f, 6)), 1 / 6); zf = TIP[2] - 0.0295 * Math.pow(f, 1.1); hw = H.lerp(0.0165, 0.0068, H.smoothstep(0, 0.6, f)); }
    else { const q = -p.y; hs = Math.pow(Math.max(0, 1 - q * q), 1 / 3); y = TIP[1] - 0.0135 * Math.pow(q, 2 / 3); zf = TIP[2]; hw = 0.0165; }
    const zb = 0.079, sp = Math.max(0, sz);
    const z = sz >= 0 ? zb + (zf - zb) * Math.pow(sz, 0.7) * hs : zb + 0.009 * sz * hs;
    let x = hw * cx * hs * (1 - 0.4 * sp * sp);
    if (p.y < 0.3) x -= Math.sign(x) * 0.0012 * G2(z - 0.1075, y - 1.597, 0.0022, 0.006);                                   // alar groove
    if (p.y < -0.4) y += 0.0042 * H.smoothstep(0.4, 0.8, -p.y) * G2(Math.abs(x) - NOS[0] + 0.0025, z - NOS[2], 0.0035, 0.0055); // nostrils
    return new THREE.Vector3(x, y, z);
  }
  const headG = headGeo(160, 124), noseG = H.blob(1, { ws: 40, hs: 36, deform: nosePt });
  const headSkin = merge([headG, noseG]);
  add({ id: 'skin-head', name: 'Skin of the head (face and scalp)', latin: 'Cutis capitis et faciei', region: 'head', geometry: headSkin, material: skinMat(), tags: ['skin', 'face'],
    info: { description: 'The skin covering the face and scalp, sculpted over the skull: forehead, brow ridges, orbits, nose, cheekbones, lips, chin and jaw line. Facial skin is thin, very vascular and rich in sebaceous glands; scalp skin is thick and carries about 100 000 hair follicles.',
      function: 'Protects the head, senses touch, pain and temperature (trigeminal nerve), and is moved by the muscles of facial expression, which insert directly into it.',
      size: 'Face–scalp height ~23 cm (chin to crown), head width ~15.5 cm, length ~19.5 cm; skin 0.5 mm (eyelids) to 3–5 mm (scalp) thick',
      notes: 'Scalp wounds bleed heavily because the vessels are held open by dense connective tissue. The scalp layers spell SCALP: Skin, Connective tissue, Aponeurosis, Loose areolar tissue, Pericranium.' } });
  // lips (vermilion): lofts along X following the mouth arc; upper lip with Cupid's bow, fuller lower lip
  function lipGeo(upper) {
    const S = [], N = 15, half = 0.0255, ym = HD.mouth[1] + 0.0002;
    for (let i = 0; i < N; i++) {
      const X = -half + 2 * half * i / (N - 1), u = Math.abs(X) / half, zc = HD.mouth[2] + 0.0045 - 0.016 * u * u;
      let h, rz, zo;
      if (upper) { h = 0.0092 * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 0.8) + 0.0011 * G2(Math.abs(X) - 0.0055, 0, 0.004, 1) - 0.0012 * G2(X, 0, 0.0025, 1); rz = 0.0038 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.0006; zo = -0.0015; }
      else { h = 0.0105 * Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.7); rz = 0.0044 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.0006; zo = -0.003; }
      h = Math.max(h, 0.0008);
      const yc = upper ? ym + h / 2 - 0.0003 : ym - h / 2 + 0.0003;
      S.push({ y: X, rx: h / 2 + 0.0004, rz, cx: -yc, cz: zc + zo });
    }
    return loft(S, { radial: 20, subdiv: 3, axis: "x" });
  }
  const lipInfo = (up) => ({ description: (up ? 'The upper lip vermilion, with the central tubercle and the Cupid\'s-bow border below the philtrum.' : 'The lower lip vermilion, fuller than the upper lip, resting on the lower incisors.') + ' The red colour comes from blood in capillaries seen through a thin, non-keratinised, hair-less epithelium.',
    function: 'Closes the mouth, seals around food and drink, shapes speech sounds and is one of the most touch-sensitive areas of the body.', size: up ? 'Vermilion ~5 cm wide, ~8–9 mm high at the midline' : 'Vermilion ~5 cm wide, ~10 mm high',
    notes: 'The lips lack sweat and sebaceous glands and so dry and crack easily; the vermilion border must be realigned exactly when repairing a cut lip or cleft lip.' });
  add({ id: 'lip-upper', name: 'Upper lip', latin: 'Labium superius oris', region: 'head', geometry: lipGeo(true), color: H.COLORS.lip, tags: ['lip', 'face'], info: lipInfo(true) });
  add({ id: 'lip-lower', name: 'Lower lip', latin: 'Labium inferius oris', region: 'head', geometry: lipGeo(false), color: H.COLORS.lip, tags: ['lip', 'face'], info: lipInfo(false) });

  // eyebrows: short hair strips ray-cast onto the brow skin (medial head thick, lateral tail thin, arched)
  const browPts = [[0.012, 1.6555], [0.020, 1.6595], [0.029, 1.662], [0.038, 1.6625], [0.047, 1.6605], [0.054, 1.6565]].map(([x, y]) => {
    const h = hit(headG, [x, y, 0.2], [0, 0, -1]); return h ? h.p.addScaledVector(h.n, 0.0006) : H.V(x, y, 0.088); });
  const browG = H.displace(H.tube(browPts, t => 0.0022 - 0.0012 * t, { radial: 10, step: 0.0015 }), p => 0.0004 * H.fbm(p.x * 1400, p.y * 500, p.z * 1400, 2));
  add2({ id: 'eyebrow', name: 'eyebrow', latin: 'Supercilium', region: 'head', geometry: browG, color: '#4a3526', tags: ['hair', 'face'],
    info: { description: 'An arched band of short, thick hairs on the skin over the superciliary arch of the frontal bone, pointing laterally.',
      function: 'Diverts sweat and rain away from the eye and is a major tool of facial expression (raised by frontalis, drawn together by corrugator supercilii).',
      size: '~5 cm long, 5–10 mm high; ~250 hairs; hairs live ~4 months', notes: 'Loss of the outer third of the eyebrow (Hertoghe sign) is a classic, though non-specific, sign of hypothyroidism.' } });

  // scalp hair: a cap following the head surface from the hairline to the crown, thicker on top, strand-like fbm texture
  const HAIRLINE = [[-1, 1.595], [-0.7, 1.600], [-0.45, 1.615], [-0.3, 1.640], [-0.2, 1.664], [0.0, 1.668], [0.06, 1.655], [0.12, 1.637], [0.22, 1.637],
    [0.32, 1.660], [0.45, 1.690], [0.65, 1.703], [0.85, 1.708], [1.0, L.y.forehead + 0.002]];
  function hairV(a) {
    const y = tabAt(HAIRLINE, Math.sin(a))[1];
    return y >= yEq ? vE * (1 - Math.asin(H.clamp((y - yEq) / Ht, 0, 1)) / (PI / 2)) : vE + (yEq - y) / (yEq - ybot(Math.sin(a))) * (vF - vE);
  }
  const HNU = 128, HNV = 42;
  const hairG = grid(HNU, HNV, (u, w) => { const phi = -PI + 2 * PI * u, a = phi - BETA * Math.sin(phi - PI / 2); return headPt(phi, w * hairV(a)); });
  weld(hairG, HNU, HNV);   // weld before displacing so the seam cannot crack
  H.displace(hairG, (p, n, i) => {
    const w = Math.floor(i / (HNU + 1)) / HNV, th = 0.0011 + 0.0052 * H.smoothstep(0, 0.55, 1 - w) + 0.0011 * H.fbm(p.x * 260, p.y * 70, p.z * 260, 3);
    return w === 0 ? H.V(p.x, p.y + th, p.z) : th;
  });
  weld(hairG, HNU, HNV);
  add({ id: 'hair', name: 'Scalp hair', latin: 'Capilli', region: 'head', geometry: hairG, material: H.mat({ color: H.COLORS.hair, roughness: 0.85 }), tags: ['hair'],
    info: { description: 'Short scalp hair covering the vault of the skull from the frontal hairline and temples to the nape. Each hair is a dead keratin shaft growing from a living follicle in the dermis.',
      function: 'Insulates the head against heat loss and sunlight, cushions minor blows and has social and sensory roles (hair follicles are wrapped by touch receptors).',
      size: '~100 000 follicles; each hair 50–100 µm thick, growing ~1 cm per month for 2–7 years (anagen) before shedding', notes: 'Losing 50–100 scalp hairs a day is normal. Male-pattern baldness is driven by dihydrotestosterone shrinking follicles at the temples and crown.' } });

  // =================================================================== NECK
  const NECK = [[1.47, 0.063, 0.061, -0.008], [1.50, 0.060, 0.060, -0.004], [1.52, 0.0595, 0.061, -0.003], [1.545, 0.057, 0.060, -0.006], [1.565, 0.0553, 0.059, -0.010], [1.588, 0.052, 0.061, -0.016]];
  const neckWarp = (u, y, d) => {
    const th = Math.atan2(d[1], Math.abs(d[0])), f = H.clamp((y - 1.45) / 0.15, 0, 1), ths = H.lerp(1.2, -0.3, f);
    let m = 1 + 0.07 * Math.exp(-(((th - ths) / 0.25) ** 2)) * H.smoothstep(1.46, 1.49, y) * (1 - H.smoothstep(1.575, 1.6, y));   // sternocleidomastoid
    m += (female ? 0.02 : 0.075) * Math.exp(-(((th - PI / 2) / 0.17) ** 2)) * G2(y - L.y.thyroidCartilage, 0, 0.009, 1);            // laryngeal prominence
    return m;
  };
  const neckGeo = () => loft(NECK.map(r => ({ y: r[0], rx: r[1], rz: r[2], cz: r[3], n: 2.1 })), { radial: 48, subdiv: 5, warp: neckWarp });
  add({ id: 'skin-neck', name: 'Skin of the neck', latin: 'Cutis colli', region: 'neck', geometry: neckGeo(), material: skinMat(), tags: ['skin'],
    info: { description: 'Thin, mobile skin of the neck showing the sternocleidomastoid ridges running from behind the ears to the top of the sternum and, in front, the laryngeal prominence (Adam\'s apple, larger in men).',
      function: 'Covers and allows free movement of the neck; its natural horizontal skin creases are used by surgeons to hide scars.', size: 'Neck ~12 cm long, ~37 cm circumference (adult male); skin ~1–1.5 mm thick',
      notes: 'The platysma muscle lies directly under this skin; thyroid surgery is done through a transverse "collar" incision in a skin crease about 2 cm above the sternal notch.' } });

  // subcutaneous fat of head and neck (copies of the skin pushed inward along the normals)
  const fatHead = weld(fatOf(headGeo(72, 56), 0.005), 72, 56);
  add({ id: 'fat-head', name: 'Subcutaneous fat of the head', latin: 'Tela subcutanea capitis', layer: LY.FAT, region: 'head', geometry: fatHead, color: FAT, tags: ['fat'],
    info: { description: 'The fatty layer (hypodermis) under the skin of the face and scalp. On the scalp it is a dense fibro-fatty layer carrying the vessels; in the face it forms discrete fat compartments, including the buccal fat pad in the cheek.',
      function: 'Pads and shapes the face, insulates, and carries the blood vessels and nerves to the skin.', size: 'About 2–6 mm thick on the scalp; facial compartments up to ~1–2 cm (buccal pad ~10 ml)',
      notes: 'Facial fat compartments shrink and descend with age, which is a major cause of hollow temples, tear troughs and jowls.' } });
  add({ id: 'fat-neck', name: 'Subcutaneous fat of the neck', latin: 'Tela subcutanea colli', layer: LY.FAT, region: 'neck', geometry: fatOf(neckGeo()), color: FAT, tags: ['fat'],
    info: { description: 'The layer of fat and loose connective tissue between the neck skin and the platysma / deep cervical fascia.', function: 'Lets the skin glide over the neck muscles and stores energy.',
      size: 'Usually 3–10 mm thick; thickest under the chin (submental fat)', notes: 'Excess submental fat produces a "double chin"; the external jugular vein runs in this layer and is visible when venous pressure is raised.' } });

  // =================================================================== TRUNK
  // distance in the XY plane from (x,y) to the 2D segment (x0,y0)-(x1,y1)
  const seg2 = (x, y, x0, y0, x1, y1) => { const ux = x1 - x0, uy = y1 - y0, t = H.clamp(((x - x0) * ux + (y - y0) * uy) / (ux * ux + uy * uy), 0, 1); return Math.hypot(x - x0 - ux * t, y - y0 - uy * t); };
  const TS = L.trunkSections.map(s => Object.assign({}, s));
  TS[TS.length - 1] = Object.assign({}, TS[TS.length - 1], { rx: 0.054, rz: 0.056, cz: 0 });   // tuck the top ring inside the neck skin
  TS.unshift({ y: 0.835, rx: 0.12, rz: 0.075, cz: -0.012, n: 2.2 });                           // rounded perineal floor between the thighs
  const nip = [0.098, L.y.nipple], ASIS = [0.125, L.y.ASIS], PUBT = [0.02, L.y.pubis];
  function trunkRelief(p, n) {
    const ax = Math.abs(p.x), y = p.y, fr = H.smoothstep(0.15, 0.6, n.z), bk = H.smoothstep(0.15, 0.6, -n.z), fm = female ? 0.5 : 1;
    let d = 0;
    d += fr * (female ? 0.003 * G2(ax - 0.08, y - 1.35, 0.06, 0.05) : 0.009 * G2(ax - 0.085, y - 1.33, 0.06, y < 1.33 ? 0.032 : 0.055));   // pectoralis major
    const dc = seg2(ax, y, 0.02, 1.432, 0.18, 1.44);
    d += fr * (0.003 * Math.exp(-((dc / 0.007) ** 2)) - 0.002 * G2(dc - 0.02, 0, 0.008, 1) * (y < 1.44 ? 1 : 0));                           // clavicles + infraclavicular fossa
    d -= fr * 0.006 * G2(p.x, y - (L.y.sternalNotch + 0.004), 0.013, 0.012);                                                              // suprasternal (jugular) notch
    d -= fr * 0.002 * fm * G2(p.x, y - 1.32, 0.012, 0.08);                                                                               // presternal groove
    d += fr * fm * (0.004 * G2(ax - 0.042, y - 1.13, 0.03, 0.10) - 0.0025 * G2(p.x, y - 1.14, 0.007, 0.12));                           // rectus abdominis + linea alba
    for (const k of [1.19, 1.135, 1.085]) d -= fr * fm * 0.0015 * G2(ax - 0.042, y - k, 0.03, 0.004);                                   // tendinous intersections
    d += fr * (-0.009 * G2(p.x, y - L.y.umbilicus, 0.0055, 0.0065) + 0.0015 * G2(Math.hypot(p.x, y - L.y.umbilicus) - 0.009, 0, 0.004, 1)); // umbilicus
    d -= fr * 0.02 * H.smoothstep(0.93, 0.86, y) * H.smoothstep(0.03, 0.08, ax);                                                         // lower trunk recedes into the groin (mons pubis stays)
    d -= fr * 0.004 * Math.exp(-((seg2(ax, y, ASIS[0], ASIS[1], PUBT[0], PUBT[1]) / 0.008) ** 2));                                       // inguinal groove
    d += 0.004 * G2(ax - 0.14, y - 1.06, 0.03, 0.04) + fr * 0.004 * G2(p.x, y - 0.985, 0.08, 0.05);                                     // flank (oblique) + lower abdomen
    d += bk * (-0.005 * G2(p.x, 0, 0.012, 1) * H.smoothstep(0.98, 1.05, y) * (1 - H.smoothstep(1.42, 1.46, y)) + 0.005 * G2(ax - 0.03, y - 1.1, 0.018, 0.12)); // spine furrow + erector spinae
    d += bk * (0.005 * G2(ax - 0.095, y - 1.34, 0.045, 0.07) + 0.004 * G2(ax - 0.14, y - 1.25, 0.03, 0.08));                             // scapulae, latissimus
    d += bk * (0.022 * G2(ax - 0.07, y - 0.905, 0.065, 0.06) - 0.012 * G2(p.x, y - 0.9, 0.006, 0.06) * (y < 0.97 ? 1 : 0) - 0.002 * G2(ax - 0.035, y - 1.0, 0.008, 0.008)); // buttocks, natal cleft, sacral dimples
    return d + 0.00025 * H.fbm(p.x * 150, p.y * 150, p.z * 150, 2);
  }
  const trunkGeo = (radial, subdiv) => H.displace(loft(TS, { radial, subdiv }), trunkRelief);
  const trunkG = trunkGeo(72, 6);
  // deltoid shoulder caps: rounded over the shoulder joint, tapering to the deltoid tuberosity on the lateral arm
  const SH = L.joint.shoulderL;
  const deltG = H.blob(1, { ws: 36, hs: 28, deform: p => { const lo = Math.max(0, -p.y), k = 1 - 0.8 * Math.pow(lo, 1.3);
    const f = 1 - 0.25 * Math.max(0, p.y) ** 2; return H.V(SH[0] + 0.002 + 0.05 * p.x * k * f + 0.035 * lo, SH[1] - 0.03 + (p.y > 0 ? 0.05 : 0.1) * p.y, SH[2] - 0.002 + 0.055 * p.z * k * f); } });
  add({ id: 'skin-trunk', name: 'Skin of the trunk', latin: 'Cutis trunci', region: 'body', geometry: merge([trunkG, deltG, H.mirrorX(deltG)]), material: skinMat(), tags: ['skin'],
    info: { description: 'The skin of the chest, abdomen, back, shoulders and buttocks, showing the relief of the clavicles, pectoral muscles, rectus abdominis, umbilicus, inguinal grooves, spine furrow, scapulae, deltoids and buttocks.',
      function: 'Barrier against water loss, microbes and UV; thermoregulation through sweat and blood flow; touch, pressure and pain sensing; vitamin D synthesis.',
      size: 'Largest part of the ~1.8 m² body surface (trunk ≈ 36 % by the rule of nines); 1–2 mm thick on the front, up to ~4 mm on the upper back',
      notes: 'The skin of the back has the thickest dermis in the body. Skin tension (Langer) lines run mostly horizontally on the trunk, so horizontal incisions heal with finer scars.' } });
  add({ id: 'fat-trunk', name: 'Subcutaneous fat of the trunk', latin: 'Tela subcutanea trunci', layer: LY.FAT, region: 'body', geometry: fatOf(trunkGeo(56, 4)), color: FAT, tags: ['fat'],
    info: { description: 'The hypodermis of the trunk: fat lobules separated by fibrous septa, split over the lower abdomen into a fatty superficial layer (Camper fascia) and a membranous deep layer (Scarpa fascia).',
      function: 'Energy store, thermal insulation and shock absorber; also an endocrine organ secreting leptin and adiponectin.', size: 'Typically 5–30 mm; thickest over the lower abdomen, flanks and buttocks',
      notes: 'Men tend to store fat centrally (abdomen), women on the hips and buttocks; waist circumference is a better predictor of cardiovascular risk than body weight.' } });

  // female breasts: a mound conforming to the chest wall (rim sits on the trunk skin, back buried), fuller lower pole, apex slightly lateral
  const chestZ = (x, y) => { const T = L.trunkAt(y); return T.cz + T.rz * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / T.rx), T.n)), 1 / T.n); };
  const BR = L.organ.breastL;
  const breastGeo = () => H.blob(1, { ws: 40, hs: 32, deform: p => {
    const lo = Math.max(0, -p.y), up = Math.max(0, p.y), x = BR.center[0] + BR.size[0] / 2 * p.x, y = BR.center[1] + BR.size[1] / 2 * p.y;
    if (p.z < 0) return H.V(x, y, chestZ(x, y) - 0.006 * -p.z);
    const hz = 0.037 * Math.pow(p.z, 0.8) * (1 + 0.25 * lo - 0.3 * up);
    return H.V(x + 0.008 * p.z, y - 0.012 * p.z * (0.6 + 0.4 * lo), chestZ(x, y) + hz - 0.0025);   // rim buried 2.5 mm under the trunk skin
  } });
  let nipPt = null;
  if (female) {
    const bG = breastGeo();
    add2({ id: 'breast', name: 'breast', latin: 'Mamma', region: 'thorax', geometry: bG, color: SKIN, tags: ['skin', 'breast'],
      info: { description: 'The skin-covered mound of the female breast over pectoralis major between the 2nd and 6th ribs, sternum to mid-axillary line, with an axillary tail. Inside lie the mammary gland lobes, ducts and fat (glands module).',
        function: 'Houses the mammary gland, which produces and delivers milk to the nipple during lactation.', size: '~12 cm wide, ~11 cm high, projecting ~3–4 cm here; size varies greatly',
        notes: 'About three-quarters of lymph from the breast drains to the axillary nodes, which is why the axilla is examined and sampled in breast cancer; most cancers arise in the upper outer quadrant.' } });
    add2({ id: 'fat-breast', name: 'breast fat', latin: 'Corpus adiposum mammae', layer: LY.FAT, region: 'thorax', geometry: fatOf(breastGeo(), 0.004), color: FAT, tags: ['fat', 'breast'],
      info: { description: 'The subcutaneous and retromammary fat that makes up most of the volume of the non-lactating breast, divided by suspensory (Cooper) ligaments.', function: 'Gives the breast its shape and cushions the glandular tissue.',
        size: 'Majority of breast volume (typically 200–500 ml per breast)', notes: 'Cooper ligament shortening by a tumour dimples the overlying skin — a warning sign on examination.' } });
    const h = hit(bG, [BR.center[0] + 0.006, L.y.nipple, 0.3], [0, 0, -1]); if (h) nipPt = h;
  } else nipPt = hit(trunkG, [nip[0], nip[1], 0.3], [0, 0, -1]);
  if (nipPt) {
    const ra = female ? 0.019 : 0.012, rn = female ? 0.0048 : 0.0032;
    const areola = H.displace(H.blob([ra, ra, 0.0012], { ws: 28, hs: 10 }), p => 0.0003 * Math.max(0, H.noise3(p.x * 900, p.y * 900, 1)));
    const papilla = H.blob([rn, rn, rn * (female ? 1.1 : 0.9)], { ws: 16, hs: 12 }).translate(0, 0, female ? 0.0035 : 0.002);
    const nipG = orient(merge([areola, papilla]), nipPt.p.clone().addScaledVector(nipPt.n, -0.0002), [0, 1, 0], nipPt.n);
    add2({ id: 'nipple', name: 'nipple and areola', latin: 'Papilla mammaria et areola', region: 'thorax', geometry: nipG, color: '#b06f5d', tags: ['skin', 'breast'],
      info: { description: 'The nipple (mammary papilla) surrounded by the pigmented areola, which carries small raised areolar (Montgomery) glands. In men it lies over the 4th intercostal space in the mid-clavicular line.',
        function: female ? 'Delivers milk from 15–20 lactiferous duct openings; smooth muscle erects the nipple and areolar glands lubricate it during breastfeeding.' : 'Rudimentary in males; sensitive erogenous skin with smooth muscle but no functioning gland.',
        size: female ? 'Areola ~3.5–4.5 cm diameter, nipple ~1 cm' : 'Areola ~2.5 cm diameter, nipple ~5 mm', notes: 'Extra (supernumerary) nipples along the embryonic milk line from axilla to groin occur in 1–5 % of people.' } });
  }

  // =================================================================== ARMS (built on the left, mirrored by H.pair)
  const JL = L.joint, UA = L.limb.upperArm, FA = L.limb.forearm, HAND = L.limb.hand;
  const axisAt = (y, lo, mid, hi) => y >= mid[1] ? H.mix3(mid, hi, H.clamp((y - mid[1]) / (hi[1] - mid[1]), 0, 1)) : H.mix3(lo, mid, H.clamp((y - lo[1]) / (mid[1] - lo[1]), 0, 1));
  const ARM = [[0.84, FA.rBottom * 1.04, FA.rBottom * 0.66], [0.88, FA.rBottom * 1.08, FA.rBottom * 0.72], [0.95, 0.034, 0.025], [1.02, 0.040, 0.031], [1.06, FA.rTop, FA.rTop * 0.81],
    [L.y.elbow, UA.rBottom * 1.03, UA.rBottom * 0.9], [1.14, 0.039, 0.039], [1.22, 0.040, 0.044], [1.30, 0.043, 0.046], [1.36, UA.rTop * 0.96, UA.rTop * 0.98], [1.40, 0.043, 0.044], [1.425, 0.030, 0.032]];
  const Gy = (y, c, s) => Math.exp(-(((y - c) / s) ** 2)), pos2 = v => Math.max(0, v);
  const armWarp = (u, y, d) => 1 + 0.09 * Gy(y, 1.22, 0.06) * pos2(d[1]) ** 2 + 0.06 * Gy(y, 1.28, 0.07) * pos2(-d[1]) ** 2       // biceps / triceps
    + 0.06 * Gy(y, 1.03, 0.05) * pos2(0.7 * d[1] - 0.7 * d[0]) ** 2 + 0.07 * Gy(y, 1.06, 0.045) * pos2(0.8 * d[0] + 0.6 * d[1]) ** 2   // forearm flexors / brachioradialis
    + 0.08 * Gy(y, 1.10, 0.015) * pos2(-d[1]) ** 4 + 0.05 * Gy(y, 1.105, 0.012) * pos2(-d[0]) ** 4 - 0.04 * Gy(y, 1.11, 0.02) * pos2(d[1]) ** 3; // olecranon, medial epicondyle, cubital fossa
  const armGeo = (radial, subdiv) => loft(ARM.map(r => { const c = axisAt(r[0], JL.wristL, JL.elbowL, JL.shoulderL); return { y: r[0], rx: r[1], rz: r[2], cx: c.x, cz: c.z, n: 2.1 }; }), { radial, subdiv, warp: armWarp });
  add2({ id: 'skin-arm', name: 'arm skin', latin: 'Cutis membri superioris', region: 'armL', geometry: H.displace(armGeo(40, 5), p => 0.0002 * H.fbm(p.x * 160, p.y * 160, p.z * 160, 2)), color: SKIN, tags: ['skin'],
    info: { description: 'Skin of the upper arm, elbow and forearm, showing the biceps and triceps bulges, the olecranon and epicondyles at the elbow and the fleshy forearm muscle masses tapering to the flattened wrist.',
      function: 'Protective, sensory and thermoregulatory covering of the arm; the skin over the olecranon is loose and wrinkled so the elbow can flex fully.', size: 'Shoulder to wrist ~57 cm; each arm ≈ 9 % of body surface (rule of nines)',
      notes: 'The cubital fossa at the front of the elbow is the usual site for drawing blood, because the median cubital vein lies just under the thin skin there.' } });
  add2({ id: 'fat-arm', name: 'arm subcutaneous fat', latin: 'Tela subcutanea membri superioris', layer: LY.FAT, region: 'armL', geometry: fatOf(armGeo(32, 4), 0.005), color: FAT, tags: ['fat'],
    info: { description: 'The layer of fat between the arm skin and the deep (brachial and antebrachial) fascia, carrying the cephalic and basilic veins and cutaneous nerves.', function: 'Insulation, energy storage and a gliding layer over the muscles.',
      size: 'Usually 4–15 mm; thickest over the back of the upper arm', notes: 'Triceps skinfold thickness, pinched over the back of the upper arm, is a classic field measure of body fat.' } });

  // hands: palm loft (palm faces +Z in the anatomical position), fingers of 3 phalanges, abducted & rotated thumb, nails on the dorsal side
  const HANDT = [[0.742, 0.036, 0.010, 0.253, 0.016], [0.750, 0.042, 0.0125, 0.253, 0.017], [0.765, HAND.palmWidth / 2, HAND.thickness * 0.47, 0.2525, 0.018], [0.790, HAND.palmWidth / 2 + 0.0005, HAND.thickness / 2, 0.252, 0.018],
    [0.812, 0.043, 0.016, 0.250, 0.016], [0.832, 0.037, 0.0175, 0.248, 0.014], [0.850, 0.030, 0.0175, JL.wristL[0] + 0.001, JL.wristL[2] + 0.001], [0.870, 0.026, 0.016, 0.245, 0.010]];
  const handWarp = (u, y, d) => 1 + 0.28 * Gy(y, 0.815, 0.022) * pos2(0.6 * d[0] + 0.8 * d[1]) ** 3 + 0.14 * Gy(y, 0.80, 0.03) * pos2(-0.7 * d[0] + 0.7 * d[1]) ** 3;
  const palmGeo = (rad) => loft(HANDT.map(r => ({ y: r[0], rx: r[1], rz: r[2], cx: r[3], cz: r[4], n: 2.6 })), { radial: rad || 40, subdiv: 5, warp: handWarp });
  // chain of capsule segments; returns { geos, tip, dir, rTip, lenLast }
  function digit(base, dirs, lens, radii) {
    const geos = []; let p = H.v3(base);
    for (let i = 0; i < lens.length; i++) { const q = p.clone().addScaledVector(dirs[i], lens[i]); geos.push(H.segment(p, q, [radii[i], radii[i + 1]], { radial: 14 })); if (i === lens.length - 1) return { geos, a: p, tip: q, dir: dirs[i], rTip: radii[i + 1], len: lens[i] }; p = q; }
  }
  function nailGeo(dg, dorsal, scale) {
    const w = dg.rTip * 0.74 * (scale || 1), l = dg.len * 0.5, r = dg.rTip;
    const ng = H.blob([1, 1, 1], { ws: 16, hs: 10, deform: p => H.V(p.x * w, p.y * l, p.z * 0.0006 - (p.x * w) ** 2 / (2.2 * r)) });
    return orient(ng, dg.tip.clone().addScaledVector(dg.dir, -l * 0.75 - r * 0.25).addScaledVector(H.v3(dorsal).projectOnPlane(dg.dir).normalize(), r * 0.9), dg.dir, dorsal);
  }
  const FING = [ // [x offset from palm centre, MCP y, splay, length, base radius]
    [0.028, 0.752, 0.06, HAND.fingerLength[1], 0.0095], [0.008, 0.748, 0.01, HAND.fingerLength[2], 0.0098], [-0.012, 0.751, -0.04, HAND.fingerLength[3], 0.009], [-0.030, 0.758, -0.09, HAND.fingerLength[4], 0.008]];
  const handParts = [palmGeo()], nailParts = [];
  FING.forEach(([dx, y, sp, len, r]) => {
    const d0 = H.V(sp, -1, 0.10).normalize(), d1 = H.V(sp * 0.7, -1, 0.28).normalize(), d2 = H.V(sp * 0.5, -1, 0.45).normalize();
    const dg = digit([0.2525 + dx, y, 0.015], [d0, d1, d2], [len * 0.45, len * 0.31, len * 0.24], [r, r * 0.93, r * 0.85, r * 0.78]);
    handParts.push(...dg.geos); nailParts.push(nailGeo(dg, [0, 0, -1]));
  });
  const th = digit([0.268, 0.828, 0.020], [H.V(0.45, -0.85, 0.35).normalize(), H.V(0.3, -0.9, 0.35).normalize(), H.V(0.2, -0.93, 0.3).normalize()], [0.042, 0.031, 0.027], [0.0125, 0.011, 0.0100, 0.0090]);
  handParts.push(...th.geos); nailParts.push(nailGeo(th, [1, 0, -0.3], 1.1));
  add2({ id: 'skin-hand', name: 'hand skin', latin: 'Cutis manus', region: 'armL', geometry: merge(handParts), color: SKIN, tags: ['skin', 'hand'],
    info: { description: 'Skin of the hand: thick, hair-less, ridged glabrous skin on the palm (facing forward in the anatomical position) with thenar and hypothenar eminences, thin mobile skin on the back, four fingers of three phalanges and an abducted, rotated two-phalanx thumb.',
      function: 'The body\'s main tactile organ: fingertips carry the densest touch receptors (Meissner and Merkel), and friction ridges and sweat improve grip.', size: 'Hand length ~19 cm, palm ~8.8 cm wide and ~10 cm long; palmar skin up to ~1.5 mm epidermis',
      notes: 'Fingerprint ridge patterns are fixed by the 17th week of fetal life and are unique even in identical twins.' } });
  add2({ id: 'nails-hand', name: 'fingernails', latin: 'Ungues manus', region: 'armL', geometry: merge(nailParts), color: H.COLORS.nail, tags: ['nail', 'hand'],
    info: { description: 'Five translucent plates of hard keratin on the backs of the distal phalanges, each growing from a matrix under the proximal nail fold; the pale half-moon (lunula) is the visible front of the matrix.',
      function: 'Protect the fingertips, provide counter-pressure that sharpens fine touch, and help pick up small objects.', size: '~10–12 mm long, ~0.5 mm thick; grow ~3 mm per month (a whole nail regrows in ~6 months)',
      notes: 'Nail changes can reveal systemic disease: clubbing (lung disease), spoon nails (iron deficiency), pitting (psoriasis), Beau lines (a past severe illness).' } });
  add2({ id: 'fat-hand', name: 'palmar subcutaneous fat', latin: 'Tela subcutanea manus', layer: LY.FAT, region: 'armL', geometry: fatOf(palmGeo(28), 0.003), color: FAT, tags: ['fat', 'hand'],
    info: { description: 'Fibro-fatty pad of the palm, divided into small chambers by vertical fibrous bands that tie the skin to the palmar aponeurosis; thin and loose on the back of the hand.', function: 'Cushions grip while stopping the palmar skin from sliding.',
      size: '~3–8 mm under the palm, 1–2 mm on the dorsum', notes: 'Because the palmar skin is tethered, infections of the palm spread to the looser dorsal tissues, so a palm infection often shows as swelling on the back of the hand.' } });

  // =================================================================== LEGS (left, mirrored)
  const TH = L.limb.thigh, SK = L.limb.shank;
  const LEGT = [[0.062, 0.031, 0.029], [0.085, SK.rAnkle, 0.030], [0.13, 0.030, 0.030], [0.20, 0.034, 0.038], [0.28, 0.042, 0.048], [L.y.calfMax, SK.rCalf * 0.85, SK.rCalf],
    [0.44, 0.049, 0.052], [0.475, 0.050, 0.050], [L.y.kneeJoint, SK.rTop * 0.92, 0.051], [0.54, 0.056, 0.054], [0.60, TH.rBottom * 1.05, 0.062], [0.68, 0.068, 0.070],
    [0.76, 0.075, 0.080], [0.84, TH.rTop * 0.965, 0.090], [0.88, 0.078, 0.088], [0.91, 0.070, 0.080], [0.935, 0.058, 0.065]];   // top tucks inside the trunk skin
  const legWarp = (u, y, d) => 1 + 0.16 * Gy(y, L.y.calfMax - 0.005, 0.075) * Math.pow(pos2(-d[1]), 1.5) + 0.05 * Gy(y, 0.33, 0.05) * pos2(-0.6 * d[1] - 0.8 * d[0]) ** 2   // gastrocnemius heads
    + 0.10 * Gy(y, L.y.patella, 0.03) * pos2(d[1]) ** 4 + 0.05 * Gy(y, L.y.tibialTuberosity, 0.015) * pos2(d[1]) ** 6                                                   // patella, tibial tuberosity
    + 0.07 * Gy(y, 0.58, 0.04) * pos2(0.6 * d[1] - 0.8 * d[0]) ** 2 + 0.04 * Gy(y, 0.70, 0.10) * pos2(d[1]) ** 2 - 0.04 * Gy(y, 0.51, 0.03) * pos2(-d[1]) ** 3   // vastus medialis, quadriceps, popliteal fossa
    + 0.12 * Gy(y, 0.07, 0.014) * pos2(d[0]) ** 4 + 0.10 * Gy(y, 0.085, 0.014) * pos2(-d[0]) ** 4 - 0.10 * Gy(y, 0.11, 0.035) * pos2(-d[1]) * Math.abs(d[0]);         // malleoli, hollows beside the Achilles tendon
  const legGeo = (radial, subdiv) => loft(LEGT.map(r => { const c = axisAt(r[0], JL.ankleL, JL.kneeL, JL.hipL); return { y: r[0], rx: r[1], rz: r[2], cx: c.x + 0.004 * H.smoothstep(0.6, 0.9, r[0]), cz: c.z + 0.008 * H.smoothstep(0.6, 0.88, r[0]), n: 2.1 }; }), { radial, subdiv, warp: legWarp });
  add2({ id: 'skin-leg', name: 'leg skin', latin: 'Cutis membri inferioris', region: 'legL', geometry: H.displace(legGeo(44, 5), p => 0.0002 * H.fbm(p.x * 160, p.y * 160, p.z * 160, 2)), color: SKIN, tags: ['skin'],
    info: { description: 'Skin of the thigh, knee and leg: the tapering thigh with the quadriceps and the vastus medialis "teardrop", the kneecap, the calf bulge of gastrocnemius at the back, the subcutaneous shin and the ankle malleoli.',
      function: 'Protective and sensory covering of the lower limb; the calf muscle pump beneath it drives venous blood back up against gravity.', size: 'Hip to ankle ~85 cm; each lower limb ≈ 18 % of body surface (rule of nines)',
      notes: 'The skin over the shin lies directly on the tibia with little padding, so shin wounds heal slowly; venous leg ulcers occur typically just above the medial malleolus.' } });
  add2({ id: 'fat-leg', name: 'leg subcutaneous fat', latin: 'Tela subcutanea membri inferioris', layer: LY.FAT, region: 'legL', geometry: fatOf(legGeo(32, 4)), color: FAT, tags: ['fat'],
    info: { description: 'The fatty layer of the thigh and leg above the fascia lata and crural fascia, carrying the great and small saphenous veins and cutaneous nerves.', function: 'Insulation, energy storage and a gliding plane over the muscles.',
      size: '5–25 mm on the thigh (thicker in women), a few mm over the shin', notes: 'The great saphenous vein in this layer is the vessel most often harvested for coronary bypass grafts.' } });

  // feet: loft along Z (heel -> ball) with a raised medial arch, 5 toes (big toe 2 phalanges, others 3), toenails
  const FOOT = [[-0.072, 0.017, 0.022, 0.092, 0.030], [-0.062, 0.026, 0.032, 0.092, 0.036], [-0.045, 0.031, 0.040, 0.092, 0.042], [-0.015, 0.033, 0.050, 0.092, 0.052], [0.020, 0.037, 0.046, 0.094, 0.046],
    [0.060, 0.042, 0.036, 0.096, 0.036], [0.100, L.limb.foot.width / 2 - 0.0015, 0.026, 0.098, 0.026], [JL.ballOfFootL[2], L.limb.foot.width / 2, 0.019, JL.ballOfFootL[0] + 0.004, 0.020], [0.150, 0.045, 0.015, 0.100, 0.016], [0.160, 0.040, 0.012, 0.100, 0.014]];
  // local loft frame after axis 'z': local x = world x, local y = world z, local +z = world -y (so d[1] > 0 is plantar)
  const footWarp = (u, zw, d) => 1 - 0.32 * Gy(zw, 0.035, 0.045) * pos2(0.8 * d[1] - 0.6 * d[0]) ** 2 + 0.05 * Gy(zw, -0.05, 0.03) * pos2(d[1]) ** 2;
  const footGeo = () => loft(FOOT.map(r => ({ y: r[0], rx: r[1], rz: r[2], cx: r[3], cz: -r[4], n: 2.5 })), { radial: 40, subdiv: 5, warp: footWarp, axis: 'z' });
  const TOES = [[[0.074, 0.021, 0.140], [0.073, 0.013, 0.198], 0.0125, 0.0105, 2], [[0.094, 0.017, 0.145], [JL.toeTipL[0], 0.011, JL.toeTipL[2] - 0.004], 0.0085, 0.007, 3],
    [[0.110, 0.016, 0.141], [0.117, 0.010, 0.187], 0.0080, 0.0066, 3], [[0.124, 0.015, 0.136], [0.131, 0.009, 0.176], 0.0075, 0.0062, 3], [[0.137, 0.014, 0.128], [0.144, 0.009, 0.163], 0.0070, 0.0058, 3]];
  const footParts = [footGeo()], toeNails = [];
  TOES.forEach(([b, t, r0, r1, n]) => {
    const pts = []; for (let i = 0; i <= n; i++) { const f = i / n; pts.push(H.mix3(b, t, f).add(H.V(0, 0.0025 * Math.sin(PI * f), 0))); }
    const dirs = [], lens = [], radii = [];
    for (let i = 0; i < n; i++) { const v = pts[i + 1].clone().sub(pts[i]); lens.push(v.length()); dirs.push(v.normalize()); }
    for (let i = 0; i <= n; i++) radii.push(H.lerp(r0, r1, i / n));
    const dg = digit(pts[0], dirs, lens, radii); footParts.push(...dg.geos); toeNails.push(nailGeo(dg, [0, 1, 0], n === 2 ? 1.15 : 1));
  });
  add2({ id: 'skin-foot', name: 'foot skin', latin: 'Cutis pedis', region: 'legL', geometry: merge(footParts), color: SKIN, tags: ['skin', 'foot'],
    info: { description: 'Skin of the foot: very thick glabrous skin on the sole over the heel and ball, a raised medial longitudinal arch, thin skin on the dorsum and five toes (the big toe has two phalanges, the others three).',
      function: 'Bears body weight and friction in standing and walking and senses ground contact for balance.', size: 'Foot ~26 cm long, ~9.5 cm wide at the ball; plantar epidermis up to ~1.5 mm, heel skin several mm in total',
      notes: 'Loss of protective sensation in the sole (diabetic neuropathy) lets painless pressure ulcers develop — the commonest cause of non-traumatic amputation.' } });
  add2({ id: 'nails-foot', name: 'toenails', latin: 'Ungues pedis', region: 'legL', geometry: merge(toeNails), color: H.COLORS.nail, tags: ['nail', 'foot'],
    info: { description: 'Keratin plates on the dorsal tips of the five toes; the big-toe nail is by far the largest.', function: 'Protect the tips of the toes and give counter-pressure to the toe pulp.',
      size: 'Big-toe nail ~15–18 mm wide; toenails grow only ~1–1.5 mm per month (12–18 months to regrow)', notes: 'Ingrown toenail (onychocryptosis) usually affects the big toe, promoted by tight shoes and cutting the nail edges too short.' } });
  add2({ id: 'fat-foot', name: 'foot subcutaneous fat', latin: 'Tela subcutanea pedis', layer: LY.FAT, region: 'legL', geometry: fatOf(footGeo(), 0.004), color: FAT, tags: ['fat', 'foot'],
    info: { description: 'Subcutaneous fat of the foot, forming a specialised honeycomb heel pad of fat chambers walled by fibrous septa under the calcaneus, and a thin layer on the dorsum.', function: 'The heel pad absorbs the impact of heel strike, which reaches ~1–1.5 times body weight in walking.',
      size: 'Heel pad ~15–20 mm thick; dorsal fat ~2–3 mm', notes: 'Heel-pad atrophy with age is a common cause of heel pain that is mistaken for plantar fasciitis.' } });

  // =================================================================== SKIN BLOCK inset: magnified (~x20) cube of skin beside the left thigh
  // Built in local coordinates (top surface = skin surface at +BH) and translated to BC. In front of the hanging left hand (hand z < 0.06).
  const BC = [0.26, 0.72, 0.10], BH = 0.035, put = geo => geo.translate(BC[0], BC[1], BC[2]);
  function slab(nt, nb, top, bot) {   // square slab (side 2*BH) with height-field top and bottom
    const pos = [], idx = [], v = (x, y, z) => (pos.push(x, y, z), pos.length / 3 - 1);
    const sheet = (n, f, up) => { const r = n + 1, b0 = pos.length / 3;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = -BH + 2 * BH * i / n, z = -BH + 2 * BH * j / n; v(x, f(x, z), z); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = b0 + j * r + i, b = a + 1, c = a + r, d = c + 1; if (up) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); } };
    sheet(nt, top, true); sheet(nb, bot, false);
    const lp = [], s = k => -BH + 2 * BH * k / nt;
    for (let k = 0; k < nt; k++) lp.push([s(k), BH]); for (let k = 0; k < nt; k++) lp.push([BH, -s(k)]); for (let k = 0; k < nt; k++) lp.push([-s(k), -BH]); for (let k = 0; k <= nt; k++) lp.push([-BH, s(k)]);
    for (let k = 0; k < lp.length - 1; k++) { const [x0, z0] = lp[k], [x1, z1] = lp[k + 1]; const t0 = v(x0, top(x0, z0), z0), b0 = v(x0, bot(x0, z0), z0), t1 = v(x1, top(x1, z1), z1), b1 = v(x1, bot(x1, z1), z1); idx.push(b0, b1, t0, t0, b1, t1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  const pap = (x, z) => 0.029 + 0.0022 * (0.5 + 0.5 * Math.sin(x * 900 + 0.4) * Math.sin(z * 900 + 1.1));          // dermal papillae / rete ridges
  const epiTop = (x, z) => BH - 0.0004 + 0.00035 * Math.sin((x * 0.8 + z * 0.6) * 620) + 0.00025 * H.fbm(x * 300, 0.5, z * 300, 2);   // skin furrows
  const blk = s => add(Object.assign({ region: 'legL', parent: 'skinblock', tags: ['inset', 'skinblock'] }, s));
  blk({ id: 'skinblock-epidermis', name: 'Epidermis (magnified skin block)', latin: 'Epidermis', depth: 0, geometry: put(slab(30, 30, epiTop, (x, z) => pap(x, z) - 0.0001)), color: '#e2b590',
    info: { description: 'The outer, cell-only layer of skin: a keratinised stratified squamous epithelium (basal, spinous, granular and horny layers) whose underside interlocks with the dermal papillae in rete ridges. It has no blood vessels.',
      function: 'Waterproof, microbe- and UV-resistant barrier; melanocytes add pigment, Langerhans cells police for pathogens, Merkel cells sense light touch.', size: 'Real thickness ~0.05–0.1 mm (eyelids) to ~1.5 mm (palms, soles); shown magnified ~x20',
      notes: 'The epidermis renews itself about every 4 weeks: basal cells divide, flatten and die as they rise, and ~500 million dead cells are shed daily.' } });
  blk({ id: 'skinblock-dermis', name: 'Dermis (magnified skin block)', latin: 'Dermis (corium)', depth: 0.3, geometry: put(slab(30, 4, pap, () => 0.006)), material: H.mat({ color: '#e9ab98', opacity: 0.45, roughness: 0.7 }),
    info: { description: 'The tough connective-tissue layer under the epidermis: a thin papillary layer of loose tissue in the dermal papillae over a thick reticular layer of dense collagen and elastic fibres. It holds the vessels, nerves, hair follicles and glands (shown translucent here).',
      function: 'Gives skin its strength and elasticity, nourishes the epidermis and houses its appendages and sensory receptors.', size: 'Real thickness ~0.6 mm (eyelids) to ~3–4 mm (back)',
      notes: 'Leather is tanned dermis. Stretch marks (striae) are tears in the dermal collagen; a burn is "full thickness" once the whole dermis is destroyed.' } });
  const lobs = [];
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) {
    const n3 = s => 0.0025 * H.noise3(i * 1.37 + s, k * 2.11 + s, j * 3.07 + s), c = [-BH + 0.0175 * (i + 0.5) + n3(0.3), -BH + 0.0205 * (k + 0.5) + n3(1.7), -BH + 0.0175 * (j + 0.5) + n3(2.9)];
    const lb = H.blob(0.0098 + 0.0012 * H.noise3(i + 0.5, k + 0.5, j + 0.5), { ws: 10, hs: 7, noise: { amp: 0.12, freq: 2.5 } }).translate(c[0], c[1], c[2]);
    lobs.push(H.displace(lb, p => H.V(H.clamp(p.x, -BH, BH), H.clamp(p.y, -BH, 0.0058), H.clamp(p.z, -BH, BH))));   // cut flat at the block faces
  }
  blk({ id: 'skinblock-hypodermis', name: 'Hypodermis (magnified skin block)', latin: 'Tela subcutanea (hypodermis)', layer: LY.SKIN, depth: 0.6, geometry: put(merge(lobs)), color: FAT,
    info: { description: 'The subcutaneous layer below the dermis: lobules of fat cells (adipocytes) separated by thin fibrous septa that tether the skin to the deep fascia.', function: 'Insulates, stores energy, cushions and lets the skin move over deeper structures.',
      size: 'Real thickness a few mm to several cm depending on site and body fat; lobules ~1 cm, adipocytes ~0.1 mm', notes: 'Insulin and many vaccines are injected into this layer (subcutaneous injection) because its blood supply gives slow, steady absorption.' } });
  // hair follicles (main + a smaller one) with shafts, sebaceous glands and arrector pili muscles
  const folG = [], shaftG = [], sebG = [], apG = [];
  [[[-0.012, 0.002, -0.004], [0.002, BH - 0.0005, -0.004], 1], [[0.008, 0.008, 0.017], [0.017, BH - 0.0005, 0.017], 0.7]].forEach(([b, e, s]) => {
    const B = H.v3(b), E = H.v3(e), dir = E.clone().sub(B).normalize(), at = t => B.clone().lerp(E, t);
    folG.push(H.tube([B, at(0.5), E], t => (0.0026 - 0.0006 * t) * s, { radial: 14, step: 0.002 }));
    folG.push(H.blob([0.0042 * s, 0.005 * s, 0.0042 * s], { ws: 16, hs: 12, deform: p => 1 - 0.35 * H.smoothstep(0.5, 1, -p.y) }).translate(B.x, B.y, B.z));   // hair bulb around the dermal papilla
    shaftG.push(H.tube([B.clone().addScaledVector(dir, 0.002), at(0.5), E, E.clone().addScaledVector(dir, 0.012 * s), E.clone().addScaledVector(dir, 0.026 * s).add(H.V(0.006 * s, 0, 0))], 0.0011 * s, { radial: 10, step: 0.002 }));
    const sp = at(0.6).add(H.V(-0.0045 * s, 0, 0));   // sebaceous gland in the obtuse angle between follicle and arrector pili
    for (let k = 0; k < 5; k++) sebG.push(H.blob(0.0021 * s, { ws: 10, hs: 8, noise: { amp: 0.1, freq: 3 } }).translate(sp.x + 0.0022 * s * Math.cos(k * 1.3), sp.y + s * (0.0022 * Math.sin(k * 2.1) - 0.001), sp.z + 0.0022 * s * Math.sin(k * 1.3)));
    sebG.push(H.tube([sp, at(0.68)], 0.0008 * s, { radial: 8 }));
    const a0 = at(0.4), a1 = H.V(a0.x - 0.013 * s, 0.0285, a0.z);
    apG.push(H.tube([a0, a0.clone().lerp(a1, 0.5).add(H.V(-0.001, -0.002, 0)), a1], t => 0.0009 * s * (0.6 + 0.6 * Math.sin(PI * t)), { radial: 8, step: 0.0015 }));
  });
  blk({ id: 'skinblock-hair-follicle', name: 'Hair follicle (magnified skin block)', latin: 'Folliculus pili', depth: 0.35, geometry: put(merge(folG)), color: '#d99a84',
    info: { description: 'A tubular pocket of epidermis sunk obliquely into the dermis; its swollen base, the hair bulb, wraps a dermal papilla of capillaries that feeds the dividing matrix cells which build the hair.',
      function: 'Produces the hair shaft; its bulge region holds stem cells that regenerate the follicle and help re-surface wounds.', size: 'Terminal scalp follicles ~3–4 mm deep, bulb ~0.3 mm wide (magnified here)',
      notes: 'Follicles cycle through growth (anagen), regression (catagen) and rest (telogen); chemotherapy attacks the rapidly dividing matrix cells, causing hair loss.' } });
  blk({ id: 'skinblock-hair-shaft', name: 'Hair shaft (magnified skin block)', latin: 'Scapus pili', depth: 0.35, geometry: put(merge(shaftG)), color: H.COLORS.hair,
    info: { description: 'The dead, keratinised hair emerging from the follicle, made of a medulla, a pigmented cortex and a scaly cuticle.', function: 'Insulation, protection and touch sensing (bending the hair stimulates nerve endings around the follicle).',
      size: 'Scalp hair ~50–100 µm diameter (magnified here)', notes: 'Hair records exposure to drugs and toxins as it grows, so a segment of hair can date exposure month by month.' } });
  blk({ id: 'skinblock-sebaceous-gland', name: 'Sebaceous gland (magnified skin block)', latin: 'Glandula sebacea', depth: 0.4, geometry: put(merge(sebG)), color: '#efd9a0',
    info: { description: 'A cluster of grape-like alveoli beside the upper follicle that empties into the follicle canal by holocrine secretion (whole cells burst to release their contents).',
      function: 'Secretes sebum, an oily mix of triglycerides, wax esters and squalene that waterproofs and softens skin and hair.', size: '~0.2–2 mm; largest on the face, scalp and upper trunk', notes: 'Acne develops when a sebaceous follicle is plugged by sebum and keratin and colonised by Cutibacterium acnes.' } });
  blk({ id: 'skinblock-arrector-pili', name: 'Arrector pili muscle (magnified skin block)', latin: 'Musculus arrector pili', depth: 0.4, geometry: put(merge(apG)), color: H.COLORS.muscle,
    info: { description: 'A tiny band of smooth muscle running from the follicle bulge region to the papillary dermis on the obtuse-angle side of the hair.', function: 'Contracts under sympathetic control to stand the hair upright ("goose bumps") and squeeze sebum from the gland.',
      size: '~0.5–1 mm long, a few cells thick', notes: 'Goose bumps are a vestige of fur-fluffing for warmth and display seen in other mammals.' } });
  // eccrine sweat gland: coiled secretory tube in the deep dermis, duct rising to a spiral pore through the epidermis
  const SW = [0.02, 0.0075, -0.015], swP = [];
  for (let i = 0; i <= 64; i++) { const t = i / 64, an = t * PI * 8; swP.push(H.V(SW[0] + 0.0035 * Math.cos(an) * (0.7 + 0.3 * Math.sin(t * 9)), SW[1] + 0.005 * t + 0.0008 * Math.sin(an * 0.5), SW[2] + 0.0035 * Math.sin(an))); }
  for (let i = 1; i <= 8; i++) { const t = i / 8; swP.push(H.V(SW[0] + 0.003 + 0.0008 * Math.sin(t * 9), SW[1] + 0.005 + t * (0.029 - SW[1] - 0.005), SW[2] + 0.0006 * Math.cos(t * 7))); }
  for (let i = 1; i <= 12; i++) { const t = i / 12, an = t * PI * 4; swP.push(H.V(SW[0] + 0.003 + 0.001 * Math.cos(an), 0.029 + t * (BH - 0.0292), SW[2] + 0.001 * Math.sin(an))); }
  blk({ id: 'skinblock-sweat-gland', name: 'Eccrine sweat gland (magnified skin block)', latin: 'Glandula sudorifera eccrina', depth: 0.4, geometry: put(H.tube(swP, 0.00085, { radial: 8, step: 0.0007 })), color: H.COLORS.gland,
    info: { description: 'A single long tube whose lower end is a tight secretory coil in the deep dermis; its duct climbs through the dermis and corkscrews through the epidermis to open at a sweat pore.',
      function: 'Secretes watery sweat whose evaporation cools the body; up to 2–4 litres an hour in extreme heat.', size: 'Coil ~0.4 mm across; 2–4 million glands, densest on palms and soles (~600 per cm²)',
      notes: 'Cystic fibrosis raises the salt content of sweat (faulty CFTR chloride channels in the duct), which is the basis of the sweat test.' } });
  // capillaries: superficial and deep dermal plexuses with hairpin loops into the papillae
  const capG = [], PK = [[-0.0197, 0.0075], [-0.0057, 0.0145], [0.0083, 0.0005], [0.0223, 0.0075], [-0.0127, -0.0204], [0.0153, -0.0134], [0.0292, 0.0215], [-0.0266, -0.0065]];
  for (const z0 of [-0.02, 0.0, 0.02]) { const pts = []; for (let i = 0; i <= 8; i++) { const x = -BH + 0.001 + (2 * BH - 0.002) * i / 8; pts.push([x, 0.0245 + 0.0008 * Math.sin(i * 1.9 + z0 * 99), z0 + 0.002 * Math.sin(i * 1.3 + z0 * 50)]); } capG.push(H.tube(pts, 0.0006, { radial: 6, step: 0.002 })); }
  for (const x0 of [-0.022, 0.012]) { const pts = []; for (let i = 0; i <= 8; i++) { const z = -BH + 0.001 + (2 * BH - 0.002) * i / 8; pts.push([x0 + 0.002 * Math.sin(i * 1.7), 0.0075, z]); } capG.push(H.tube(pts, 0.001, { radial: 8, step: 0.002 })); }
  capG.push(H.tube([[-0.022, 0.0075, 0.0], [-0.02, 0.016, 0.001], [-0.019, 0.0245, 0.0]], 0.0007, { radial: 6 }), H.tube([[0.012, 0.0075, -0.02], [0.011, 0.016, -0.02], [0.012, 0.0245, -0.02]], 0.0007, { radial: 6 }));
  PK.forEach(([x, z]) => capG.push(H.tube([[x - 0.0009, 0.0245, z], [x - 0.0006, 0.029, z], [x, 0.0305, z], [x + 0.0006, 0.029, z], [x + 0.0009, 0.0245, z]], 0.00045, { radial: 6, step: 0.001 })));
  blk({ id: 'skinblock-capillaries', name: 'Dermal capillaries (magnified skin block)', latin: 'Vasa capillaria dermis', depth: 0.45, geometry: put(merge(capG)), color: H.COLORS.capillary,
    info: { description: 'Two horizontal networks of small vessels — a deep plexus at the dermis–hypodermis border and a superficial plexus under the papillae — joined by vertical vessels, with hairpin capillary loops rising into each dermal papilla.',
      function: 'Nourish the avascular epidermis by diffusion and regulate heat loss by opening (flushing) or closing (pallor) the superficial blood flow.', size: 'Capillaries ~5–10 µm diameter; papillary loops ~0.2–0.4 mm tall (magnified here)',
      notes: 'Skin blood flow can rise from ~0.25 to ~8 litres per minute in heat stress — almost a third of cardiac output — to dump heat.' } });
  // nerve: fibre from the subcutis branching to a Pacinian corpuscle, a Meissner corpuscle in a papilla and free endings in the epidermis
  const nG = [], nb = [0.012, 0.012, 0.026];
  nG.push(H.tube([[0.008, -BH + 0.001, 0.03], [0.011, -0.01, 0.029], [0.012, 0.004, 0.027], nb], 0.0008, { radial: 8, step: 0.002 }));
  nG.push(H.tube([nb, [0.018, 0.0105, 0.026], [0.0215, 0.0098, 0.026]], 0.0006, { radial: 8 }));
  nG.push(H.displace(H.blob([0.0032, 0.0032, 0.0055], { ws: 18, hs: 12 }), p => 0.00018 * Math.sin(Math.hypot(p.x, p.y) * 5200)).translate(0.024, 0.0098, 0.026));   // Pacinian (lamellated) corpuscle
  nG.push(H.tube([nb, [0.014, 0.022, 0.024], [0.0153, 0.0285, 0.0215]], 0.0005, { radial: 8 }), H.blob([0.0011, 0.0019, 0.0011], { ws: 12, hs: 8 }).translate(0.0153, 0.0298, 0.0215)); // Meissner corpuscle
  nG.push(H.tube([nb, [0.009, 0.022, 0.028], [0.0085, 0.0325, 0.029]], 0.0003, { radial: 6 }), H.tube([nb, [0.017, 0.021, 0.029], [0.019, 0.0328, 0.03]], 0.0003, { radial: 6 }));   // free nerve endings
  blk({ id: 'skinblock-nerve-ending', name: 'Sensory nerve endings (magnified skin block)', latin: 'Terminationes nervorum cutis', depth: 0.45, geometry: put(merge(nG)), color: H.COLORS.nerve,
    info: { description: 'A cutaneous nerve fibre branching to an onion-like lamellated (Pacinian) corpuscle in the deep dermis, an encapsulated Meissner corpuscle in a dermal papilla, and bare free nerve endings that penetrate the epidermis.',
      function: 'Pacinian corpuscles sense vibration and deep pressure, Meissner corpuscles light touch, and free endings pain, itch and temperature.', size: 'Pacinian ~1 × 0.5 mm, Meissner ~0.1 mm (magnified here)',
      notes: 'Meissner corpuscles are densest in the fingertips and lips and decline with age, one reason fine touch fades in the elderly.' } });

  // @@MORE
  return g;
});
