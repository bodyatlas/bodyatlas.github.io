/* systems/muscular_lower.js - hip, thigh, leg and foot muscles (LEFT built, RIGHT mirrored with H.pair).
   Limb muscles are lofted in a cylindrical frame (angle, radius) wrapped around the femoral / tibial axis so they hug
   the bones; oblique muscles and tendons are swept along origin -> insertion curves. Every vertex is clamped to stay
   >= 9 mm inside the skin loft (thigh r 0.085 -> 0.058, calf 0.056 at y 0.38, ankle 0.034) or the trunk silhouette.
   Foot parts are placed from a copy of the integumentary foot loft (arch hollow, heel pad) and its toe chains: sole sheets are draped a set
   gap above the sole, foot muscles wrap the loft at a set depth, and toe slips run as flat bands 1 mm under the skin of each toe. */
ANATOMY.register('muscular_lower', { name: 'Muscles - lower limb', description: 'Hip, thigh, leg and foot muscles with the quadriceps, patellar and calcaneal tendons, iliotibial band and plantar fascia' }, function (THREE, H, L, ctx) {
  const g = H.group('muscular_lower');
  const V3 = THREE.Vector3, D2R = Math.PI / 180;
  const J = L.joint, hip = J.hipL, knee = J.kneeL, ank = J.ankleL;
  const TH = L.limb.thigh, SH = L.limb.shank, yCalf = L.y.calfMax;
  const SUP = H.LAYER.MUSCLE_SUPERFICIAL, DEEP = H.LAYER.MUSCLE_DEEP, TEN = H.COLORS.tendon, FASCIA = H.COLORS.fascia;
  const MARGIN = 0.009, R0 = 0.05;

  // ---------------- skin axis + envelope (skin loft radius minus 9 mm) ----------------
  function skinAxis(y) {
    if (y >= knee[1]) { const t = Math.min(1.4, (y - knee[1]) / (hip[1] - knee[1])); return [H.lerp(knee[0], hip[0], t), H.lerp(knee[2], hip[2], t)]; }
    const t = H.clamp((knee[1] - y) / (knee[1] - ank[1]), 0, 1); return [H.lerp(knee[0], ank[0], t), H.lerp(knee[2], ank[2], t)];
  }
  // leg skin loft cross-sections [y, rx, rz] about the hip-knee-ankle axis (same profile as the integumentary leg loft:
  // thigh 0.085 -> knee 0.053 x 0.051, calf 0.048 x 0.056 at y 0.38 (+ posterior bulge), ankle 0.034 x 0.030); thigh centre shifts 7 mm laterally at the top
  const LEG = [[0.062, 0.031, 0.029], [0.085, SH.rAnkle, 0.030], [0.13, 0.030, 0.030], [0.20, 0.034, 0.038], [0.28, 0.042, 0.048], [yCalf, SH.rCalf * 0.85, SH.rCalf],
    [0.44, 0.049, 0.052], [0.475, 0.050, 0.050], [L.y.kneeJoint, SH.rTop * 0.92, 0.051], [0.54, 0.056, 0.054], [0.60, TH.rBottom * 1.05, 0.062], [0.68, 0.068, 0.070],
    [0.76, 0.075, 0.078], [0.84, 0.081, 0.085], [0.90, TH.rTop, 0.090], [0.935, 0.078, 0.085]];
  function limbFrame(y) {      // envelope ellipse = skin - 9 mm: centre, half-width, front / back half-depth
    let i = 0; while (i < LEG.length - 2 && y > LEG[i + 1][0]) i++;
    const a = LEG[i], b = LEG[i + 1], t = H.clamp((y - a[0]) / (b[0] - a[0]), 0, 1), rz = H.lerp(a[2], b[2], t);
    const [ax, az] = skinAxis(y), calf = 1 + 0.12 * Math.exp(-Math.pow((y - yCalf) / 0.075, 2));
    return { cx: ax + 0.007 * H.smoothstep(0.6, 0.9, y), cz: az, ex: H.lerp(a[1], b[1], t) - MARGIN, ezf: rz - MARGIN, ezb: rz * calf - MARGIN };
  }
  const softMax = (v, hi, k) => v <= hi - k ? v : hi - k * Math.exp(-(v - hi + k) / k);
  const softMin = (v, lo, k) => v >= lo + k ? v : lo + k * Math.exp((v - lo - k) / k);
  function envelope(p) {
    const y = p.y; if (y < ank[1] + 0.01) return p;                       // foot: placed explicitly
    const F = limbFrame(y), dx = p.x - F.cx, dz = p.z - F.cz, q = Math.hypot(dx / F.ex, dz / (dz >= 0 ? F.ezf : F.ezb)) || 1e-6;
    const limb = () => { const s = softMax(q, 1, 0.08) / q; return new V3(F.cx + dx * s, y, F.cz + dz * s); };
    if (y < 0.845) return q > 0.92 ? limb() : p;
    const T = L.trunkAt(Math.min(y, 1.12)), rx = T.rx - MARGIN, rz = T.rz - MARGIN;
    const qt = Math.pow(Math.pow(Math.abs(p.x) / rx, T.n) + Math.pow(Math.abs(p.z - T.cz) / rz, T.n), 1 / T.n);
    if (qt <= 0.95 || (y < 0.935 && q <= 0.92)) return p;
    const s = softMax(qt, 1, 0.05) / qt, tp = new V3(p.x * s, y, T.cz + (p.z - T.cz) * s);
    if (y >= 0.935) return tp;
    const lp = limb(); return tp.distanceTo(p) < lp.distanceTo(p) ? tp : lp;
  }
  // femoral-shaft wrap axis: from the knee up to just medial of the greater trochanter, bowing slightly forward
  const FA = [0.105, 0.905, -0.006];
  function femAxis(y) { const t = (y - knee[1]) / (FA[1] - knee[1]); return [H.lerp(knee[0], FA[0], t), H.lerp(knee[2], FA[2], t) + 0.006 * Math.sin(Math.PI * H.clamp(t, 0, 1))]; }
  const legAxis = y => y >= knee[1] ? femAxis(y) : skinAxis(y);
  function rayEnv(y, th, axis) {       // distance from the wrap axis to the envelope along angle th
    const A = axis(y), F = limbFrame(y), ux = Math.cos(th), uz = Math.sin(th), ex2 = F.ex * F.ex, ez = uz >= 0 ? F.ezf : F.ezb, ez2 = ez * ez;
    const dx = A[0] - F.cx, dz = A[1] - F.cz;
    const a = ux * ux / ex2 + uz * uz / ez2, b = dx * ux / ex2 + dz * uz / ez2, c = dx * dx / ex2 + dz * dz / ez2 - 1;
    return Math.max(0.012, (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a);
  }
  // faint longitudinal striation, applied in the loft's parameter space (y = along the fibres)
  function striate(geo, amp, ky) { if (amp > 0) H.displace(geo, p => amp * H.fbm(p.x * 140 + 3.1, p.y * ky + 7.7, p.z * 140 + 1.3, 2)); return geo; }

  /* wrap(stations): limb muscle. station = [y, angleDeg, r, halfWidth, halfThick]; angle 0 = lateral(+X), 90 = anterior,
     180 = medial, 270 = posterior (LEFT limb). r > 0: centre radius from the wrap axis; r <= 0: outer surface |r| below the envelope. */
  function wrap(st, o = {}) {
    const axis = o.axis || legAxis;
    const secs = st.map(([y, a, r, w, h]) => {
      const th = a * D2R, rc = r > 0 ? r : rayEnv(y, th, axis) + r - h;
      return { y, rx: Math.max(0.0006, w) * R0 / rc, rz: Math.max(0.0006, h), cx: -th * R0, cz: rc };
    });
    const geo = striate(H.loft(secs, { radial: o.radial || 24, subdiv: o.subdiv || 5 }), o.stri == null ? 0.0012 : o.stri, 14);
    const rmin = o.rmin || 0.0135;
    return H.displace(geo, p => {
      const th = -p.x / R0, rr = softMin(p.z, rmin, 0.002), A = axis(p.y);
      const q = new V3(A[0] + rr * Math.cos(th), p.y, A[1] + rr * Math.sin(th));
      return o.env === false ? q : envelope(q);
    });
  }
  /* sweep(points, profile): oblique muscle / flat tendon along a centre-line. profile = [[t, halfWidth, halfThick]].
     o.nrm = outward normal hint (vector, or one per point); o.bend curls the edges inward; o.shear slants the ends. */
  function sweep(pts, prof, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map(H.v3), false, 'centripetal'), len = curve.getLength();
    const hs = o.nrm || [0, 0, 1], multi = Array.isArray(hs[0]);
    const hint = t => { if (!multi) return H.v3(hs); const f = t * (hs.length - 1), i = Math.min(hs.length - 2, Math.floor(f)); return H.v3(hs[i]).lerp(H.v3(hs[i + 1]), f - i); };
    const secs = prof.map(([t, w, h]) => ({ y: t, rx: Math.max(0.0006, w), rz: Math.max(0.0005, h) }));
    const geo = striate(H.loft(secs, { radial: o.radial || 20, subdiv: o.subdiv || 5 }), o.stri == null ? 0.001 : o.stri, len * 14);
    const P = new V3(), T = new V3(), bend = o.bend || 0, shear = o.shear || 0;
    return H.displace(geo, p => {
      const t = H.clamp(p.y, 0, 1); curve.getPointAt(t, P); curve.getTangentAt(t, T);
      const N = hint(t); N.addScaledVector(T, -N.dot(T)).normalize();
      const W = new V3().crossVectors(T, N);
      const q = P.clone().addScaledVector(W, p.x).addScaledVector(N, p.z - bend * p.x * p.x).addScaledVector(T, -shear * p.x);
      return o.env === false ? q : envelope(q);
    });
  }
  // round tendon / slender cord
  function cord(pts, r0, r1, o = {}) {
    const geo = H.tube(pts, t => H.lerp(r0, r1 == null ? r0 : r1, t), { radial: o.radial || 8, step: o.step || 0.01 });
    return o.env === false ? geo : H.displace(geo, p => envelope(p));
  }
  const I = (description, fn, size, notes) => ({ description, function: fn, size, notes });
  function add(id, name, latin, geo, layer, depth, region, info, o = {}) {
    const color = o.color || (layer === DEEP ? H.COLORS.muscleDeep : H.COLORS.muscle);
    H.pair({ id, name, latin, system: 'muscular', layer, depth, region, geometry: geo, color, info, tags: o.tags || [] }).forEach(m => g.add(m));
  }
  // ---------------- foot skin (same loft as the integumentary foot): sections along Z [z, half-width, half-height, centre x, centre y],
  // superellipse n 2.5, hollowed under the medial arch and padded under the heel; plus the skin's five toe chains ----------------
  const FWID = L.limb.foot.width, BALL = J.ballOfFootL;
  const FSK = [[-0.072, 0.017, 0.022, 0.092, 0.030], [-0.062, 0.026, 0.032, 0.092, 0.036], [-0.045, 0.031, 0.040, 0.092, 0.042], [-0.015, 0.033, 0.050, 0.092, 0.052],
    [0.020, 0.037, 0.046, 0.094, 0.046], [0.060, 0.042, 0.036, 0.096, 0.036], [0.100, FWID / 2 - 0.0015, 0.026, 0.098, 0.026], [BALL[2], FWID / 2, 0.019, BALL[0] + 0.004, 0.020],
    [0.150, 0.045, 0.015, 0.100, 0.016], [0.160, 0.040, 0.012, 0.100, 0.014]];
  const cmr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const gau = (v, c, s) => Math.exp(-(((v - c) / s) ** 2)), pos0 = v => Math.max(0, v);
  const tab = (T, v) => { let i = 0; while (i < T.length - 2 && v > T[i + 1][0]) i++; return H.lerp(T[i][1], T[i + 1][1], H.clamp((v - T[i][0]) / (T[i + 1][0] - T[i][0]), 0, 1)); };
  function footSec(z) {                // skin cross-section at z (Catmull-Rom through the stations, as H.loft interpolates them)
    const n = FSK.length; let i = 0; while (i < n - 2 && z > FSK[i + 1][0]) i++;
    const A = FSK[Math.max(0, i - 1)], B = FSK[i], C = FSK[i + 1], D = FSK[Math.min(n - 1, i + 2)];
    let lo = 0, hi = 1; for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (cmr(A[0], B[0], C[0], D[0], m) < z) lo = m; else hi = m; }
    const t = (lo + hi) / 2, f = k => cmr(A[k], B[k], C[k], D[k], t);
    return { z, rx: f(1), ry: f(2), cx: f(3), cy: f(4) };
  }
  function footR(S, ux, uy) {          // section centre -> skin along the direction (ux, uy); uy > 0 = dorsal
    const e = 0.8, ph = Math.atan2(Math.abs(uy), Math.abs(ux)), tt = Math.atan(Math.pow(Math.tan(Math.min(ph, 1.5707)) * S.rx / S.ry, 1 / e));
    const c = Math.cos(tt), s = Math.sin(tt), dc = ux < 0 ? -c : c, ds = uy > 0 ? -s : s;     // loft angle (its +sin side is plantar)
    return Math.hypot(S.rx * Math.pow(c, e), S.ry * Math.pow(s, e)) * (1 - 0.32 * gau(S.z, 0.035, 0.045) * pos0(0.8 * ds - 0.6 * dc) ** 2 + 0.05 * gau(S.z, -0.05, 0.03) * pos0(ds) ** 2);
  }
  const footIn = (S, x, y) => { const dx = x - S.cx, dy = y - S.cy, r = Math.hypot(dx, dy) || 1e-9; return r - footR(S, dx / r, dy / r); };   // < 0 inside the skin
  function skinY(x, z, up) { const S = footSec(z); let a = S.cy, b = S.cy + (up ? 2 : -2) * S.ry; for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (footIn(S, x, m) < 0) a = m; else b = m; } return a; }
  const sole = (x, z, gap) => [x, skinY(x, z, false) + gap, z], dors = (x, z, gap) => [x, skinY(x, z, true) - gap, z];   // points 'gap' above the sole / below the dorsum
  // toe chains of the skin (base, tip, base radius, tip radius, segments; 2.5 mm dorsal arch), great toe first
  const SKT = [[[0.074, 0.021, 0.140], [0.073, 0.013, 0.198], 0.0125, 0.0105, 2], [[0.094, 0.017, 0.145], [J.toeTipL[0], 0.011, J.toeTipL[2] - 0.004], 0.0085, 0.007, 3],
    [[0.110, 0.016, 0.141], [0.117, 0.010, 0.187], 0.0080, 0.0066, 3], [[0.124, 0.015, 0.136], [0.131, 0.009, 0.176], 0.0075, 0.0062, 3], [[0.137, 0.014, 0.128], [0.144, 0.009, 0.163], 0.0070, 0.0058, 3]];
  function toe(k, f, gap, ang, rho) {  // point on toe k at fraction f (base -> tip; < 0 = behind the base), 'gap' inside its skin (or at radius rho) at angle ang (deg: 0 lateral, 90 dorsal, 270 plantar)
    const [b, t, r0, r1, n] = SKT[k], jp = i => new V3(H.lerp(b[0], t[0], i / n), H.lerp(b[1], t[1], i / n) + 0.0025 * Math.sin(Math.PI * i / n), H.lerp(b[2], t[2], i / n));
    const i = H.clamp(Math.floor(f * n), 0, n - 1), A = jp(i), B = jp(i + 1), d = B.clone().sub(A).normalize(), P = A.lerp(B, f * n - i);
    const up = new V3(0, 1, 0).addScaledVector(d, -d.y).normalize(), lat = new V3().crossVectors(up, d), rr = rho != null ? rho : H.lerp(r0, r1, f) - gap, th = ang * D2R;
    return P.addScaledVector(lat, Math.cos(th) * rr).addScaledVector(up, Math.sin(th) * rr).toArray();
  }
  const toeLen = k => H.v3(SKT[k][0]).distanceTo(H.v3(SKT[k][1]));
  // where a forefoot tendon of radius rt hands over to its toe band: just behind the rim of the toe chain's base (skin toe segments have a 0.7 r deep conical base)
  const toeEntry = (k, ang, rt) => toe(k, -(0.7 * SKT[k][2] + rt + 0.001) / toeLen(k), 0, ang, 0.62 * SKT[k][2]);
  /* toeBand(k, pA, fEnd, ang, w): toe slip of a tendon - a flat band 1 mm under the skin of toe k on side ang (the skin toes are only 6-12 mm in radius),
     from pA (end of its forefoot part) round the rim of the toe's base, then along the toe to fraction fEnd; w = half-width */
  function toeBand(k, pA, fEnd, ang, w) {
    const r0 = SKT[k][2], L0 = toeLen(k), th = ang * D2R, pts = [pA];
    for (const s of [-0.55 * r0, -0.25 * r0]) pts.push(toe(k, s / L0, 0, ang, r0 + 0.43 * s - 0.001));
    for (let f = 0.05; f < fEnd - 0.06; f += 0.13) pts.push(toe(k, f, 0.001, ang));
    pts.push(toe(k, fEnd, 0.001, ang));
    const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push([t, w * (t < 0.08 ? H.lerp(0.7, 1, t / 0.08) : t > 0.92 ? H.lerp(1, 0.5, (t - 0.92) / 0.08) : 1), t < 0.08 ? 0.0005 : 0.00035]); }
    return sweep(pts, prof, { nrm: [Math.cos(th), Math.sin(th), 0], env: false, stri: 0, radial: 8, subdiv: 2, bend: 0.5 / (r0 - 0.001) });
  }
  /* footWrap(stations): foot muscle lofted round the foot-skin section centre at a set depth. station = [z, angleDeg, gap, halfWidth, halfThick];
     angle 0 = lateral (+X), 90 = dorsal, 180 = medial, 270 = plantar (LEFT foot); gap = skin -> outer surface of the muscle. */
  function footWrap(st, o = {}) {
    const secs = st.map(([z, a, d, w, h]) => { const S = footSec(z), th = a * D2R, rc = Math.max(0.006, footR(S, Math.cos(th), Math.sin(th)) - d - h);
      return { y: z, rx: Math.max(0.0006, w) * R0 / rc, rz: Math.max(0.0006, h), cx: th * R0, cz: -(d + h) }; });
    const geo = striate(H.loft(secs, { radial: o.radial || 20, subdiv: o.subdiv || 5 }), o.stri == null ? 0.0004 : o.stri, 14);
    return H.displace(geo, p => { const S = footSec(p.y), th = p.x / R0, c = Math.cos(th), s = Math.sin(th), rr = Math.max(0.004, footR(S, c, s) + p.z); return new V3(S.cx + rr * c, S.cy + rr * s, p.y); });
  }
  /* soleSheet(path, profile, gap): flat muscle / aponeurosis draped over the sole. path = plan centre-line [[x, z], ...]; profile = [[t, halfWidth, halfThick]];
     gap(z) = skin of the sole -> lower surface of the sheet. */
  function soleSheet(path, prof, gap, o = {}) {
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new V3(x, 0, z)), false, 'centripetal'), hM = Math.max(...prof.map(r => r[2]));
    const geo = striate(H.loft(prof.map(([t, w, h]) => ({ y: t, rx: Math.max(0.0006, w), rz: Math.max(0.0005, h) })), { radial: o.radial || 16, subdiv: o.subdiv || 5 }), o.stri == null ? 0.0002 : o.stri, curve.getLength() * 14);
    const P = new V3(), T = new V3();
    return H.displace(geo, p => { const t = H.clamp(p.y, 0, 1); curve.getPointAt(t, P); curve.getTangentAt(t, T);
      const x = P.x + T.z * p.x, z = P.z - T.x * p.x; return new V3(x, skinY(x, z, false) + gap(z) + hM - p.z, z); });
  }
  const fasciaGap = z => tab([[-0.036, 0.009], [0.012, 0.0045], [0.045, 0.003], [0.118, 0.0045]], z);   // heel pad thick, arch skin thin, ball pad

  // =============================== THIGH - anterior (quadriceps, sartorius) ===============================
  add('rectus-femoris', 'rectus femoris', 'Musculus rectus femoris', wrap([
    [0.565, 90, -0.003, 0.005, 0.002], [0.585, 90, -0.002, 0.01, 0.005], [0.64, 90, -0.001, 0.019, 0.01], [0.73, 90, 0, 0.026, 0.0145],
    [0.84, 90, -0.001, 0.02, 0.012], [0.925, 91, 0.05, 0.009, 0.006], [0.965, 92, 0.05, 0.004, 0.003]], { radial: 28 }), SUP, 0.3, 'legL',
    I('The only quadriceps head that crosses the hip: a spindle-shaped, bipennate muscle running straight down the front of the thigh from the anterior inferior iliac spine (straight head) and the rim above the acetabulum (reflected head) to the quadriceps tendon, patella and, via the patellar ligament, the tibial tuberosity.',
      'Extends the knee and flexes the hip - the main kicking muscle.', 'About 35-40 cm long; belly up to 5 cm wide and 3 cm thick.',
      'The most frequently strained quadriceps muscle (sprinting, kicking) because it crosses two joints; in adolescents its origin can avulse from the AIIS.'), { tags: ['quadriceps', 'thigh-anterior'] });

  add('vastus-lateralis', 'vastus lateralis', 'Musculus vastus lateralis', wrap([
    [0.55, 60, -0.005, 0.01, 0.003], [0.58, 45, -0.004, 0.022, 0.008], [0.65, 22, -0.004, 0.034, 0.014], [0.75, 0, -0.004, 0.038, 0.016],
    [0.84, -5, -0.004, 0.03, 0.013], [0.915, 0, 0.042, 0.012, 0.005]], { radial: 32 }), SUP, 0.35, 'legL',
    I('Largest head of the quadriceps, forming the bulk of the outer thigh. It arises from the greater trochanter, intertrochanteric line, gluteal tuberosity and lateral lip of the linea aspera, and inserts through the quadriceps tendon on the lateral border of the patella.',
      'Extends the knee.', 'About 40 cm long and up to 8 cm wide; roughly 3 cm thick at mid-thigh.',
      'Common site for intramuscular injections in infants and for muscle biopsies; its lateral pull on the patella is balanced by vastus medialis.'), { tags: ['quadriceps', 'thigh-anterior'] });

  add('vastus-medialis', 'vastus medialis', 'Musculus vastus medialis', wrap([
    [0.535, 105, -0.006, 0.008, 0.003], [0.555, 112, -0.004, 0.02, 0.009], [0.59, 124, -0.002, 0.03, 0.016], [0.645, 140, -0.002, 0.032, 0.015],
    [0.74, 162, -0.006, 0.022, 0.009], [0.83, 190, 0.03, 0.008, 0.004]], { radial: 28 }), SUP, 0.4, 'legL',
    I('The teardrop-shaped bulge above and inside the knee. It arises from the intertrochanteric line and medial lip of the linea aspera; its lowest, almost horizontal fibres (vastus medialis obliquus) insert on the medial border of the patella and the quadriceps tendon.',
      'Extends the knee and holds the patella medially in its groove during the last degrees of extension.', 'About 30 cm long; the teardrop is about 7 cm wide and 3 cm thick above the knee.',
      'Wastes quickly after knee injury or surgery; weakness of its oblique fibres is linked to patellofemoral pain and lateral patellar maltracking.'), { tags: ['quadriceps', 'thigh-anterior'] });

  add('vastus-intermedius', 'vastus intermedius', 'Musculus vastus intermedius', wrap([
    [0.56, 90, 0.03, 0.012, 0.004], [0.6, 88, 0.026, 0.024, 0.008], [0.68, 80, 0.022, 0.034, 0.008], [0.8, 70, 0.022, 0.03, 0.008],
    [0.885, 55, 0.022, 0.012, 0.004]], { radial: 28, rmin: 0.015 }), DEEP, 0.6, 'legL',
    I('Deepest head of the quadriceps, wrapped directly around the front and outer side of the femoral shaft beneath rectus femoris. It arises from the upper two-thirds of the anterior and lateral femur and inserts through the deep layer of the quadriceps tendon.',
      'Extends the knee.', 'About 30 cm long, 1.5-2 cm thick.',
      'A small slip (articularis genus) lifts the suprapatellar bursa during extension; a "dead leg" contusion crushes it against the femur and can lead to myositis ossificans.'), { tags: ['quadriceps', 'thigh-anterior'] });

  add('quadriceps-tendon', 'quadriceps tendon', 'Tendo musculi quadricipitis femoris',
    sweep([[0.09, 0.602, 0.042], [0.09, 0.572, 0.046], [0.09, 0.544, 0.049]], [[0, 0.009, 0.0015], [0.25, 0.014, 0.004], [0.75, 0.018, 0.0045], [1, 0.018, 0.0028]], { nrm: [0, 0, 1], stri: 0, env: false, radial: 16 }),
    SUP, 0.2, 'legL', I('Common tendon of the four quadriceps heads, attaching to the base (upper border) of the patella; its superficial fibres continue over the patella into the patellar ligament.',
      'Transmits the pull of the quadriceps across the knee via the patella, which acts as a pulley that increases its leverage.', 'About 3 cm wide, 7-8 mm thick and 4-5 cm long above the patella.',
      'Ruptures mainly in people over 40, often with diabetes, kidney disease or steroid use; the patient cannot straighten the knee against gravity.'), { color: TEN, tags: ['quadriceps', 'tendon'] });

  add('patellar-tendon', 'patellar tendon', 'Ligamentum patellae',
    sweep([[0.09, 0.5, 0.046], [0.09, 0.478, 0.041], [0.09, 0.457, 0.031]], [[0, 0.011, 0.0025], [0.2, 0.012, 0.0035], [0.6, 0.011, 0.003], [1, 0.012, 0.0022]], { nrm: [0, 0, 1], stri: 0, env: false, radial: 16 }),
    SUP, 0.2, 'legL', I('Strong flat band running from the apex of the patella to the tibial tuberosity - the continuation of the quadriceps tendon below the patella (strictly a ligament, as it joins two bones).',
      'Transfers the quadriceps pull to the tibia to extend the knee; tapping it elicits the knee-jerk reflex (L3-L4).', 'About 4-5 cm long, 2.5-3 cm wide and 5 mm thick.',
      'Its central third, with bone blocks, is a classic graft for ACL reconstruction; overload causes patellar tendinopathy ("jumper\'s knee").'), { color: TEN, tags: ['quadriceps', 'tendon'] });

  add('sartorius', 'sartorius', 'Musculus sartorius', wrap([
    [0.448, 145, 0.021, 0.004, 0.0015], [0.472, 178, 0.03, 0.007, 0.0022], [0.51, 198, -0.002, 0.012, 0.0045], [0.58, 196, 0, 0.016, 0.0055],
    [0.7, 168, 0, 0.019, 0.006], [0.82, 128, 0, 0.02, 0.006], [0.92, 95, 0, 0.018, 0.0055], [0.995, 80, 0.064, 0.006, 0.003]], { radial: 20 }), SUP, 0.05, 'body',
    I('The longest muscle in the body: a narrow strap that spirals across the front of the thigh from the anterior superior iliac spine, down the inner side of the knee, to the upper medial surface of the tibia (pes anserinus).',
      'Flexes, abducts and laterally rotates the hip and flexes the knee - together producing the cross-legged "tailor\'s" position (sartor = tailor).', 'About 50 cm long, 4 cm wide and 1 cm thick.',
      'Forms the lateral border of the femoral triangle and the roof of the adductor canal; the ASIS origin can be avulsed in adolescent sprinters.'), { tags: ['thigh-anterior', 'pes-anserinus'] });

  add('iliotibial-band', 'iliotibial band', 'Tractus iliotibialis', wrap([
    [0.472, 40, 0.03, 0.006, 0.0012], [0.51, 24, 0, 0.01, 0.0013], [0.6, 10, 0, 0.014, 0.0014], [0.75, 3, 0, 0.017, 0.0014], [0.87, 0, 0, 0.021, 0.0015],
    [0.96, -5, 0, 0.028, 0.0013], [1.045, -6, 0.03, 0.018, 0.001]], { radial: 20, stri: 0.0003, rmin: 0.02 }), SUP, 0.0, 'body',
    I('Thickened lateral strip of the fascia lata running from the iliac tubercle of the iliac crest down the outside of the thigh to Gerdy\'s tubercle on the anterolateral tibial condyle. Tensor fasciae latae and about three-quarters of gluteus maximus insert into it.',
      'Steadies the hip and the extended knee on the lateral side, helping to hold the pelvis level in single-leg stance.', 'About 45-50 cm long, 3-5 cm wide in the thigh, 2-3 mm thick.',
      'Friction over the lateral femoral epicondyle causes iliotibial band syndrome, a very common cause of lateral knee pain in runners and cyclists.'), { color: FASCIA, tags: ['fascia', 'thigh-lateral'] });

  add('tensor-fasciae-latae', 'tensor fasciae latae', 'Musculus tensor fasciae latae',
    sweep([[0.126, 0.99, 0.052], [0.142, 0.935, 0.04], [0.15, 0.88, 0.024], [0.152, 0.835, 0.012]], [[0, 0.008, 0.003], [0.2, 0.014, 0.007], [0.6, 0.015, 0.0075], [0.85, 0.01, 0.004], [1, 0.006, 0.0012]], { nrm: [0.75, 0, 0.66], bend: 3 }),
    SUP, 0.1, 'pelvis', I('Short flat muscle enclosed between two layers of the fascia lata, running from the anterior iliac crest and ASIS to the iliotibial tract about a third of the way down the thigh.',
      'Abducts, flexes and medially rotates the hip and tenses the iliotibial band to steady the extended knee.', 'About 15 cm long, 2-4 cm wide.',
      'Supplied by the superior gluteal nerve; a tight TFL/iliotibial band contributes to lateral hip and knee pain.'), { tags: ['hip', 'thigh-lateral'] });

  // =============================== HIP / GLUTEAL REGION ===============================
  add('gluteus-maximus', 'gluteus maximus', 'Musculus gluteus maximus',
    sweep([[0.04, 0.945, -0.088], [0.08, 0.925, -0.097], [0.12, 0.895, -0.078], [0.145, 0.855, -0.036]],
      [[0, 0.05, 0.006], [0.3, 0.065, 0.013], [0.62, 0.055, 0.014], [0.88, 0.03, 0.008], [1, 0.016, 0.003]],
      { nrm: [[0.2, 0.15, -1], [0.3, -0.1, -1], [0.7, -0.2, -0.7], [0.9, -0.1, -0.4]], bend: 3.5, shear: 0.43, radial: 32, subdiv: 7 }),
    SUP, 0.0, 'pelvis', I('The largest and most superficial gluteal muscle, a thick coarse-fibred quadrilateral sheet that shapes the buttock. It arises from the posterior ilium behind the posterior gluteal line, the back of the sacrum and coccyx and the sacrotuberous ligament, and inserts into the iliotibial tract and the gluteal tuberosity of the femur.',
      'Powerful extensor and lateral rotator of the hip - used to climb stairs, rise from a chair, run and jump; through the iliotibial tract it also steadies the extended knee.', 'About 20 x 15 cm and 2-3 cm thick; at roughly 0.8-1 kg the heaviest single muscle.',
      'Intramuscular injections go into the upper outer quadrant of the buttock to avoid the sciatic nerve, which runs beneath its lower half.'), { tags: ['gluteal', 'hip'] });

  add('gluteus-medius', 'gluteus medius', 'Musculus gluteus medius',
    sweep([[0.126, 1.04, -0.025], [0.139, 0.99, -0.02], [0.149, 0.94, -0.01]], [[0, 0.052, 0.005], [0.25, 0.05, 0.01], [0.6, 0.038, 0.011], [0.88, 0.02, 0.007], [1, 0.01, 0.003]],
      { nrm: [1, 0.1, 0], bend: 4, radial: 28 }),
    SUP, 0.3, 'pelvis', I('Thick fan-shaped muscle on the outer surface of the ilium between the anterior and posterior gluteal lines, partly covered by gluteus maximus; its fibres converge on the lateral surface of the greater trochanter.',
      'Main abductor of the hip; in walking it keeps the pelvis level when the opposite foot is off the ground. Its anterior fibres also rotate the hip medially.', 'About 15 cm wide at its origin, 2 cm thick.',
      'Weakness or superior gluteal nerve injury gives a positive Trendelenburg sign: the pelvis drops on the unsupported side during single-leg stance.'), { tags: ['gluteal', 'hip'] });

  add('gluteus-minimus', 'gluteus minimus', 'Musculus gluteus minimus',
    sweep([[0.113, 1.01, -0.02], [0.123, 0.975, -0.01], [0.136, 0.94, 0.004]], [[0, 0.042, 0.004], [0.3, 0.038, 0.007], [0.7, 0.026, 0.007], [1, 0.01, 0.003]], { nrm: [1, 0.1, 0], bend: 4.5 }),
    DEEP, 0.2, 'pelvis', I('Smallest and deepest gluteal muscle, a fan beneath gluteus medius from the outer ilium between the anterior and inferior gluteal lines to the anterior surface of the greater trochanter.',
      'Abducts and medially rotates the hip and helps keep the pelvis level while walking.', 'About 10 cm wide at its origin, 1 cm thick.',
      'Tendinopathy or tears of the gluteus minimus and medius tendons ("rotator cuff of the hip") are a major cause of greater trochanteric pain syndrome.'), { tags: ['gluteal', 'hip'] });

  add('piriformis', 'piriformis', 'Musculus piriformis',
    sweep([[0.024, 0.95, -0.05], [0.058, 0.942, -0.07], [0.1, 0.935, -0.058], [0.133, 0.935, -0.026]], [[0, 0.02, 0.006], [0.3, 0.017, 0.008], [0.7, 0.009, 0.005], [1, 0.003, 0.002]], { nrm: [0, 0.1, -1] }),
    DEEP, 0.3, 'pelvis', I('Pear-shaped muscle arising from the front (pelvic) surface of the sacrum; it leaves the pelvis through the greater sciatic foramen and inserts on the upper border of the greater trochanter.',
      'Laterally rotates the extended hip, abducts the flexed hip and helps hold the femoral head in the acetabulum.', 'About 12 cm long, 3-4 cm wide at its origin.',
      'Landmark of the buttock: vessels and nerves are described as above or below it. The sciatic nerve passes beneath it (or through it in ~10-15 % of people) - the anatomical basis of "piriformis syndrome".'), { tags: ['hip', 'lateral-rotators'] });

  add('obturator-internus', 'obturator internus', 'Musculus obturatorius internus',
    sweep([[0.044, 0.888, 0.026], [0.05, 0.883, -0.018], [0.068, 0.886, -0.056], [0.1, 0.902, -0.05], [0.13, 0.924, -0.027]],
      [[0, 0.02, 0.005], [0.25, 0.017, 0.006], [0.48, 0.006, 0.003], [0.75, 0.005, 0.003], [1, 0.004, 0.002]],
      { nrm: [[-1, 0, 0], [-1, 0, 0], [-0.6, 0, -0.8], [0, 0.2, -1], [0, 0.2, -1]], subdiv: 8 }),
    DEEP, 0.45, 'pelvis', I('Fan-shaped muscle lining the inner surface of the obturator membrane and surrounding pelvic bone. Its tendon turns a right angle around the lesser sciatic notch and runs laterally, flanked by the two gemelli, to the medial surface of the greater trochanter.',
      'Laterally rotates the extended hip, abducts the flexed hip and stabilises the femoral head.', 'About 10 cm long; its intrapelvic fan is about 5 cm across.',
      'Its fascia forms the pudendal (Alcock\'s) canal carrying the pudendal nerve and vessels along the side wall of the ischioanal fossa.'), { tags: ['hip', 'lateral-rotators'] });

  add('obturator-externus', 'obturator externus', 'Musculus obturatorius externus',
    sweep([[0.058, 0.876, 0.03], [0.082, 0.868, 0.004], [0.108, 0.892, -0.02], [0.126, 0.915, -0.022]], [[0, 0.02, 0.005], [0.35, 0.013, 0.006], [0.7, 0.006, 0.004], [1, 0.003, 0.002]],
      { nrm: [[0.6, -0.2, 0.8], [0.2, -1, 0.1], [0, -0.7, -0.7], [0, -0.5, -1]] }),
    DEEP, 0.5, 'pelvis', I('Flat triangular muscle covering the outer surface of the obturator membrane; its tendon winds below and behind the neck of the femur to the trochanteric fossa.',
      'Laterally rotates the hip and steadies the femoral head in the acetabulum.', 'About 8-10 cm long.',
      'Unlike the other short lateral rotators it is supplied by the obturator nerve; an obturator hernia can compress that nerve and cause medial thigh pain.'), { tags: ['hip', 'lateral-rotators'] });

  const gemQF = H.merge([
    cord([[0.062, 0.902, -0.062], [0.1, 0.911, -0.053], [0.128, 0.926, -0.03]], 0.0045, 0.003, { radial: 10 }),
    cord([[0.066, 0.878, -0.058], [0.1, 0.893, -0.05], [0.128, 0.919, -0.03]], 0.005, 0.003, { radial: 10 }),
    sweep([[0.07, 0.862, -0.05], [0.1, 0.866, -0.045], [0.126, 0.872, -0.03]], [[0, 0.012, 0.005], [0.5, 0.013, 0.006], [1, 0.012, 0.004]], { nrm: [0, 0, -1] })]);
  add('gemelli-quadratus-femoris', 'gemelli and quadratus femoris', 'Musculi gemelli superior et inferior; musculus quadratus femoris', gemQF,
    DEEP, 0.4, 'pelvis', I('Three small deep rotators behind the hip: the superior gemellus (from the ischial spine) and inferior gemellus (from the ischial tuberosity) run alongside the obturator internus tendon to the greater trochanter; below them quadratus femoris, a flat rectangle, passes from the ischial tuberosity to the quadrate tubercle on the intertrochanteric crest.',
      'Laterally rotate the hip and hold the femoral head in its socket.', 'Gemelli about 6-8 cm long and 1 cm thick; quadratus femoris about 7 x 4 cm.',
      'With piriformis and the obturators they form the "short external rotators" that are detached and repaired in the posterior approach to hip replacement.'), { tags: ['hip', 'lateral-rotators'] });

  add('pectineus', 'pectineus', 'Musculus pectineus',
    sweep([[0.046, 0.926, 0.058], [0.068, 0.9, 0.045], [0.088, 0.874, 0.018], [0.1, 0.857, -0.008]], [[0, 0.017, 0.005], [0.35, 0.019, 0.009], [0.75, 0.015, 0.008], [1, 0.009, 0.003]], { nrm: [-0.3, 0.3, 1], bend: 6 }),
    DEEP, 0.1, 'pelvis', I('Flat quadrangular muscle from the pectineal line (pecten) of the superior pubic ramus to the pectineal line of the femur just below the lesser trochanter; it forms part of the floor of the femoral triangle.',
      'Adducts and flexes the hip.', 'About 10-12 cm long and 4-5 cm wide.',
      'Often has a dual nerve supply (femoral and obturator); it lies directly behind the femoral vessels and femoral canal, the site of femoral hernias.'), { tags: ['hip', 'adductors'] });

  // =============================== THIGH - medial (adductors, gracilis) ===============================
  add('adductor-longus', 'adductor longus', 'Musculus adductor longus', wrap([
    [0.66, 214, 0.02, 0.006, 0.003], [0.72, 198, 0.036, 0.018, 0.007], [0.8, 172, 0.046, 0.03, 0.01], [0.86, 148, -0.004, 0.026, 0.009],
    [0.9, 134, 0.1, 0.009, 0.005]], { radial: 24 }), SUP, 0.5, 'legL',
    I('Triangular fan arising by a narrow tendon from the body of the pubis just below the pubic tubercle and widening to insert on the middle third of the linea aspera. The most anterior adductor; its medial border bounds the femoral triangle.',
      'Adducts and flexes the hip and assists medial rotation.', 'About 20-25 cm long and up to 6 cm wide.',
      'Its tendinous origin is the usual site of a "groin strain" in football, ice hockey and other kicking or cutting sports.'), { tags: ['adductors', 'thigh-medial'] });

  add('adductor-brevis', 'adductor brevis', 'Musculus adductor brevis', wrap([
    [0.76, 222, 0.02, 0.008, 0.003], [0.8, 205, 0.03, 0.018, 0.007], [0.85, 176, 0.048, 0.022, 0.008], [0.887, 150, 0.08, 0.012, 0.005]], { radial: 20 }),
    DEEP, 0.3, 'legL', I('Short triangular adductor lying behind pectineus and adductor longus, from the body and inferior ramus of the pubis to the upper third of the linea aspera.',
      'Adducts the hip and helps flex it.', 'About 12-15 cm long.',
      'The obturator nerve divides around it - the anterior division runs in front of it and the posterior division behind it.'), { tags: ['adductors', 'thigh-medial'] });

  add('adductor-magnus', 'adductor magnus', 'Musculus adductor magnus', wrap([
    [0.535, 195, 0.037, 0.005, 0.003], [0.58, 205, 0.036, 0.012, 0.006], [0.66, 222, 0.036, 0.028, 0.012], [0.76, 228, 0.04, 0.04, 0.014],
    [0.84, 212, 0.05, 0.042, 0.013], [0.877, 195, 0.056, 0.032, 0.007]], { radial: 32 }), DEEP, 0.5, 'legL',
    I('The largest adductor: a huge triangular sheet from the inferior pubic ramus, ischial ramus and ischial tuberosity to the whole length of the linea aspera (adductor part) and the adductor tubercle above the medial femoral condyle (hamstring part).',
      'Adducts the hip; its adductor part also flexes and its hamstring part extends the hip.', 'About 30 cm long and up to 15 cm wide.',
      'The adductor hiatus in its lower tendon lets the femoral vessels pass to the back of the knee, where they become the popliteal vessels; dual nerve supply (obturator and tibial).'), { tags: ['adductors', 'thigh-medial'] });

  add('gracilis', 'gracilis', 'Musculus gracilis', wrap([
    [0.442, 152, 0.021, 0.003, 0.0015], [0.468, 188, 0.031, 0.005, 0.0025], [0.52, 214, -0.003, 0.006, 0.003], [0.6, 205, -0.001, 0.01, 0.005],
    [0.72, 192, 0, 0.016, 0.006], [0.83, 180, 0, 0.022, 0.0065], [0.885, 165, 0.088, 0.012, 0.004]], { radial: 20 }), SUP, 0.2, 'legL',
    I('Long, slender strap along the inner thigh, from the body and inferior ramus of the pubis to the upper medial surface of the tibia (pes anserinus), between the insertions of sartorius and semitendinosus.',
      'Adducts the hip, flexes the knee and medially rotates the flexed leg.', 'About 40-45 cm long, 3-4 cm wide at the top.',
      'Largely expendable, so it is a favourite free muscle flap in reconstructive surgery and its tendon a graft for ligament reconstruction.'), { tags: ['adductors', 'thigh-medial', 'pes-anserinus'] });

  // =============================== THIGH - posterior (hamstrings) ===============================
  add('biceps-femoris-long-head', 'biceps femoris (long head)', 'Musculus biceps femoris, caput longum', wrap([
    [0.47, 342, 0.034, 0.005, 0.003], [0.51, 330, -0.003, 0.008, 0.0045], [0.57, 316, -0.001, 0.014, 0.009], [0.66, 296, 0, 0.02, 0.012],
    [0.76, 274, 0, 0.02, 0.012], [0.83, 254, -0.001, 0.014, 0.009], [0.862, 236, 0.058, 0.007, 0.004]], { radial: 24 }), SUP, 0.3, 'legL',
    I('The lateral hamstring. Its long head arises from the ischial tuberosity (common tendon with semitendinosus) and runs obliquely down the back of the thigh, joining the short head to insert on the head of the fibula.',
      'Extends the hip, flexes the knee and laterally rotates the flexed knee.', 'About 35 cm long; belly 4-5 cm wide.',
      'The most frequently injured hamstring in sprinting; the common fibular nerve runs along its medial border at the knee.'), { tags: ['hamstrings', 'thigh-posterior'] });

  add('biceps-femoris-short-head', 'biceps femoris (short head)', 'Musculus biceps femoris, caput breve', wrap([
    [0.5, 336, 0.034, 0.005, 0.003], [0.56, 322, 0.026, 0.013, 0.007], [0.64, 305, 0.023, 0.015, 0.007], [0.72, 292, 0.02, 0.007, 0.004]], { radial: 20, rmin: 0.015 }),
    DEEP, 0.4, 'legL', I('Arises from the lateral lip of the linea aspera and lateral supracondylar line of the femur, deep to the long head, and joins it in the common tendon to the fibular head.',
      'Flexes the knee and laterally rotates the leg.', 'About 15-20 cm long.',
      'The only part of the hamstrings that does not cross the hip; it is supplied by the common fibular division of the sciatic nerve.'), { tags: ['hamstrings', 'thigh-posterior'] });

  add('semitendinosus', 'semitendinosus', 'Musculus semitendinosus', wrap([
    [0.436, 158, 0.021, 0.003, 0.0015], [0.462, 195, 0.03, 0.0035, 0.002], [0.52, 222, -0.003, 0.0045, 0.0025], [0.6, 232, -0.002, 0.0055, 0.003],
    [0.665, 238, -0.001, 0.013, 0.008], [0.75, 242, 0, 0.02, 0.011], [0.83, 238, 0, 0.018, 0.01], [0.862, 229, 0.06, 0.008, 0.005]], { radial: 22 }), SUP, 0.3, 'legL',
    I('Superficial medial hamstring with a fleshy upper half and a long cord-like tendon. It arises from the ischial tuberosity with the biceps long head and inserts on the upper medial tibia (pes anserinus) behind gracilis.',
      'Extends the hip, flexes the knee and medially rotates the flexed knee.', 'About 45 cm long including a tendon of roughly 20 cm.',
      'Its tendon (often with gracilis) is the commonest graft used to reconstruct a torn anterior cruciate ligament.'), { tags: ['hamstrings', 'thigh-posterior', 'pes-anserinus'] });

  add('semimembranosus', 'semimembranosus', 'Musculus semimembranosus', wrap([
    [0.475, 224, 0.028, 0.006, 0.004], [0.52, 228, 0.034, 0.011, 0.006], [0.58, 234, 0.036, 0.018, 0.01], [0.66, 240, 0.037, 0.02, 0.011],
    [0.75, 240, 0.043, 0.014, 0.006], [0.83, 234, 0.05, 0.011, 0.004], [0.864, 226, 0.056, 0.007, 0.003]], { radial: 24 }), SUP, 0.5, 'legL',
    I('Deep medial hamstring with a flat, membrane-like upper tendon and a thick lower belly. It runs from the ischial tuberosity to the posterior surface of the medial tibial condyle, sending an expansion that forms the oblique popliteal ligament.',
      'Extends the hip, flexes the knee and medially rotates the leg.', 'About 40 cm long; belly about 6 cm wide in the lower thigh.',
      'The bursa between it and the medial head of gastrocnemius can distend into a Baker\'s (popliteal) cyst behind the knee.'), { tags: ['hamstrings', 'thigh-posterior'] });

  // =============================== LEG - posterior compartment ===============================
  add('gastrocnemius-medial-head', 'gastrocnemius (medial head)', 'Musculus gastrocnemius, caput mediale', wrap([
    [0.26, 262, 0.036, 0.008, 0.0018], [0.3, 255, -0.001, 0.017, 0.007], [0.36, 246, 0, 0.025, 0.011], [0.42, 238, 0, 0.025, 0.011],
    [0.48, 232, -0.001, 0.018, 0.008], [0.535, 228, 0.034, 0.008, 0.004]], { radial: 26 }), SUP, 0.2, 'legL',
    I('The larger head of gastrocnemius, arising from the back of the medial femoral condyle. It forms the prominent inner bulge of the calf, extends lower than the lateral head and blends into the calcaneal (Achilles) tendon.',
      'Plantarflexes the ankle (push-off, standing on tiptoe) and flexes the knee.', 'Belly about 20 cm long, 6-7 cm wide.',
      '"Tennis leg" is a tear of its musculotendinous junction on the inner calf, typically in middle-aged recreational athletes.'), { tags: ['calf', 'triceps-surae'] });

  add('gastrocnemius-lateral-head', 'gastrocnemius (lateral head)', 'Musculus gastrocnemius, caput laterale', wrap([
    [0.3, 280, 0.037, 0.007, 0.0018], [0.34, 286, -0.001, 0.016, 0.007], [0.4, 295, 0, 0.021, 0.0095], [0.47, 305, -0.001, 0.016, 0.008],
    [0.535, 311, 0.033, 0.007, 0.004]], { radial: 24 }), SUP, 0.25, 'legL',
    I('The smaller, shorter head of gastrocnemius, arising from the lateral surface of the lateral femoral condyle and joining the medial head in the calcaneal tendon.',
      'Plantarflexes the ankle and flexes the knee.', 'Belly about 15-18 cm long, 4-5 cm wide.',
      'A small sesamoid bone, the fabella, is found in its tendon in a minority of people and can be mistaken for a loose body on knee X-rays.'), { tags: ['calf', 'triceps-surae'] });

  add('soleus', 'soleus', 'Musculus soleus', wrap([
    [0.115, 270, 0.024, 0.006, 0.002], [0.15, 270, 0.025, 0.014, 0.0045], [0.21, 270, 0.027, 0.026, 0.0055], [0.29, 270, 0.027, 0.03, 0.0055],
    [0.37, 271, 0.026, 0.029, 0.005], [0.43, 278, 0.025, 0.022, 0.0042], [0.465, 292, 0.027, 0.01, 0.003]], { radial: 30, rmin: 0.014 }), DEEP, 0.1, 'legL',
    I('Broad flat muscle deep to gastrocnemius, named after the sole fish. It arises from the back of the fibular head and upper fibula, the soleal line of the tibia and a tendinous arch between them, and joins the calcaneal tendon; its fleshy fibres reach almost to the ankle and bulge on both sides of the tendon.',
      'Plantarflexes the ankle; a tireless postural muscle that stops the body toppling forward at the ankle while standing.', 'About 30 cm long, 8-9 cm wide.',
      'Its large venous sinuses are emptied by contraction - the "calf muscle pump" or second heart; calf immobility is a major risk factor for deep vein thrombosis.'), { tags: ['calf', 'triceps-surae'] });

  add('plantaris', 'plantaris', 'Musculus plantaris',
    sweep([[0.113, 0.555, -0.02], [0.107, 0.51, -0.028], [0.099, 0.46, -0.03]], [[0, 0.002, 0.002], [0.4, 0.0055, 0.0045], [1, 0.0015, 0.0015]], { nrm: [0, 0, -1], radial: 14 }),
    DEEP, 0.15, 'legL', I('Small muscle with a 7-10 cm belly arising from the lateral supracondylar line of the femur just above the lateral head of gastrocnemius, continuing as a very long thin tendon.',
      'Weakly assists knee flexion and plantarflexion; its many muscle spindles suggest a proprioceptive role.', 'Belly 7-10 cm long; tendon about 30 cm long and 3 mm wide.',
      'Absent in roughly one person in ten; because it is expendable its tendon is harvested as a free tendon graft.'), { tags: ['calf'] });
  add('plantaris-tendon', 'plantaris tendon', 'Tendo musculi plantaris',
    cord([[0.099, 0.46, -0.03], [0.092, 0.4, -0.031], [0.085, 0.3, -0.031], [0.081, 0.2, -0.028], [0.082, 0.11, -0.029], [0.086, 0.045, -0.044]], 0.0013, 0.0012, { radial: 6 }),
    DEEP, 0.15, 'legL', I('The long, ribbon-like tendon of plantaris running down between gastrocnemius and soleus, along the medial edge of the calcaneal tendon, to the posterior calcaneus.',
      'Transmits the small plantaris force to the heel.', 'About 30 cm long, 2-3 mm wide.',
      'A sudden "snap" felt in the calf was once blamed on plantaris rupture; ultrasound shows most such injuries are gastrocnemius tears.'), { color: TEN, tags: ['calf', 'tendon'] });

  add('popliteus', 'popliteus', 'Musculus popliteus',
    sweep([[0.124, 0.51, -0.012], [0.104, 0.478, -0.022], [0.078, 0.447, -0.02]], [[0, 0.004, 0.003], [0.45, 0.013, 0.005], [1, 0.021, 0.004]], { nrm: [0, 0, -1] }),
    DEEP, 0.05, 'legL', I('Thin triangular muscle forming the floor of the popliteal fossa: from a groove on the lateral femoral condyle (and the lateral meniscus) obliquely down to the back of the tibia above the soleal line.',
      '"Unlocks" the fully extended knee by rotating the femur laterally on the tibia at the start of flexion, and pulls the lateral meniscus backwards.', 'About 8-10 cm long, triangular.',
      'Its tendon runs inside the knee joint capsule; popliteus tendon injuries are part of posterolateral corner knee injuries.'), { tags: ['knee'] });

  add('achilles-tendon', 'Achilles tendon', 'Tendo calcaneus',
    sweep([[0.092, 0.285, -0.038], [0.092, 0.2, -0.033], [0.092, 0.14, -0.031], [0.092, 0.09, -0.0315], [0.092, 0.06, -0.037], [0.092, 0.042, -0.047]],
      [[0, 0.013, 0.0012], [0.25, 0.009, 0.0026], [0.55, 0.0065, 0.0033], [0.85, 0.008, 0.003], [1, 0.011, 0.0025]], { nrm: [0, 0, -1], stri: 0.0002, radial: 16, bend: 8 }),
    SUP, 0.1, 'legL', I('The calcaneal tendon, thickest and strongest tendon in the body, formed by the union of gastrocnemius and soleus and inserting on the middle of the back of the calcaneus.',
      'Transmits the force of the triceps surae to plantarflex the foot in walking, running and jumping - loads of several times body weight.', 'About 15 cm long; about 1.5 cm wide and 6 mm thick at its narrowest.',
      'Usually ruptures 2-6 cm above its insertion where the blood supply is poorest; the Thompson (calf-squeeze) test detects a complete tear.'), { color: TEN, tags: ['calf', 'tendon', 'triceps-surae'] });

  add('tibialis-posterior', 'tibialis posterior', 'Musculus tibialis posterior', wrap([
    [0.14, 225, 0.02, 0.003, 0.003], [0.2, 245, 0.016, 0.007, 0.0038], [0.3, 268, 0.017, 0.011, 0.004], [0.4, 284, 0.017, 0.012, 0.004],
    [0.46, 290, 0.018, 0.008, 0.003]], { radial: 18, rmin: 0.013 }), DEEP, 0.5, 'legL',
    I('The deepest muscle of the back of the leg, arising from the interosseous membrane and adjoining tibia and fibula between flexor digitorum longus and flexor hallucis longus.',
      'Inverts the foot and plantarflexes the ankle; the main dynamic support of the medial longitudinal arch.', 'Belly about 20 cm; total length with tendon about 35 cm.',
      'Tibialis posterior tendon dysfunction is the commonest cause of adult-acquired flatfoot.'), { tags: ['calf', 'deep-posterior'] });
  add('tibialis-posterior-tendon', 'tibialis posterior tendon', 'Tendo musculi tibialis posterioris',
    cord([[0.0776, 0.155, -0.022], [0.075, 0.11, -0.022], [0.072, 0.08, -0.019], [0.068, 0.058, -0.012], [0.066, 0.045, 0.01], [0.068, 0.038, 0.035], [0.075, 0.028, 0.05]], 0.0028, 0.0022),
    DEEP, 0.5, 'legL', I('Tendon of tibialis posterior: it grooves the back of the medial malleolus, then runs forward under the spring ligament to the tuberosity of the navicular, with slips to the cuneiforms, cuboid and bases of metatarsals 2-4.',
      'Pulls the foot into inversion and supports the arch from below.', 'About 15 cm long, 6 mm diameter.',
      'Degeneration where it rounds the medial malleolus (a zone of poor blood supply) leads to progressive collapse of the arch.'), { color: TEN, tags: ['tendon', 'deep-posterior'] });

  add('flexor-digitorum-longus', 'flexor digitorum longus', 'Musculus flexor digitorum longus', wrap([
    [0.15, 235, 0.022, 0.003, 0.003], [0.2, 232, 0.022, 0.006, 0.004], [0.3, 228, 0.02, 0.009, 0.004], [0.38, 225, 0.019, 0.008, 0.0038],
    [0.43, 222, 0.018, 0.004, 0.002]], { radial: 18, rmin: 0.013 }), DEEP, 0.55, 'legL',
    I('Arises from the posterior surface of the tibia below the soleal line, on the medial side of the deep posterior compartment.',
      'Flexes the lateral four toes and helps plantarflex and invert the foot.', 'Belly about 20 cm; about 35 cm with its tendons.',
      'Just above the ankle it crosses superficial to tibialis posterior (the crural chiasm); its tendon is transferred to replace a failed tibialis posterior tendon.'), { tags: ['calf', 'deep-posterior'] });
  const fdlT = [cord([[0.0791, 0.165, -0.026], [0.077, 0.11, -0.025], [0.076, 0.08, -0.025], [0.071, 0.055, -0.015], [0.073, 0.036, 0.01], [0.086, 0.022, 0.05]], 0.0022, 0.002)];
  for (let k = 1; k < 5; k++) {       // slips run deep in the sole above flexor digitorum brevis, then along the plantar side of toes 2-5 to the distal phalanges
    const xb = SKT[k][0][0], ang = [0, 290, 290, 275, 262][k], pA = toeEntry(k, ang, 0.001);
    fdlT.push(cord([[0.086, 0.022, 0.05], sole(H.lerp(0.086, xb, 0.5), 0.09, 0.014), sole(H.lerp(0.086, xb, 0.85), 0.115, 0.012), pA], 0.0012, 0.001, { radial: 6, env: false, step: 0.005 }), toeBand(k, pA, 0.85, ang, 0.0011));
  }
  add('flexor-digitorum-longus-tendons', 'flexor digitorum longus tendons', 'Tendines musculi flexoris digitorum longi', H.merge(fdlT),
    DEEP, 0.55, 'legL', I('The FDL tendon passes behind the medial malleolus into the sole, receives quadratus plantae and gives origin to the lumbricals, then splits into four tendons that pierce the flexor digitorum brevis tendons to reach the distal phalanges of toes 2-5.',
      'Curls the lateral four toes and helps grip the ground in push-off.', 'Main tendon about 5 mm diameter; digital slips 2 mm.',
      'Weakness of the long and short toe flexors against the pull of the extensors contributes to claw and hammer toes.'), { color: TEN, tags: ['tendon', 'deep-posterior', 'foot'] });

  add('flexor-hallucis-longus', 'flexor hallucis longus', 'Musculus flexor hallucis longus', wrap([
    [0.12, 280, 0.016, 0.004, 0.003], [0.18, 290, 0.018, 0.009, 0.0045], [0.26, 300, 0.02, 0.011, 0.0045], [0.33, 310, 0.021, 0.009, 0.004],
    [0.38, 315, 0.021, 0.004, 0.002]], { radial: 18, rmin: 0.013 }), DEEP, 0.6, 'legL',
    I('Powerful deep calf muscle arising from the lower two-thirds of the posterior fibula and interosseous membrane, lateral in the deep compartment; its fleshy fibres extend almost to the ankle.',
      'Flexes the great toe - essential for the final push-off in walking - and assists plantarflexion and inversion.', 'Belly about 20 cm; about 35 cm with its tendon.',
      'Tendinitis where it passes behind the talus is common in ballet dancers ("dancer\'s tendinitis") from repeated pointe work.'), { tags: ['calf', 'deep-posterior'] });
  add('flexor-hallucis-longus-tendon', 'flexor hallucis longus tendon', 'Tendo musculi flexoris hallucis longi',
    H.merge([cord([[0.0946, 0.135, -0.0245], [0.09, 0.1, -0.024], [0.084, 0.075, -0.024], [0.076, 0.05, -0.016], [0.077, 0.031, 0.02], sole(0.076, 0.07, 0.013), toeEntry(0, 270, 0.0017)], 0.0023, 0.0017, { step: 0.006 }),
      toeBand(0, toeEntry(0, 270, 0.0017), 0.85, 270, 0.0018)]),
    DEEP, 0.6, 'legL', I('Grooves the back of the talus, runs beneath the sustentaculum tali (which acts as its pulley) and along the sole between the sesamoids of the great toe to its distal phalanx.',
      'Flexes the great toe and supports the medial arch.', 'About 20 cm long, 5 mm diameter.',
      'Can be trapped behind the talus (posterior ankle impingement), producing pain and triggering of the big toe.'), { color: TEN, tags: ['tendon', 'deep-posterior', 'foot'] });

  // =============================== LEG - anterior & lateral compartments ===============================
  add('tibialis-anterior', 'tibialis anterior', 'Musculus tibialis anterior', wrap([
    [0.17, 75, 0.028, 0.004, 0.003], [0.22, 68, 0.029, 0.008, 0.006], [0.3, 62, -0.002, 0.013, 0.009], [0.38, 58, -0.001, 0.015, 0.011],
    [0.44, 52, -0.001, 0.013, 0.009], [0.478, 46, 0.03, 0.008, 0.004]], { radial: 24 }), SUP, 0.2, 'legL',
    I('The fleshy muscle just lateral to the shin, arising from the lateral tibial condyle, the upper two-thirds of the lateral tibia and the interosseous membrane.',
      'Dorsiflexes the ankle and inverts the foot; lifts the forefoot clear of the ground during the swing phase of walking.', 'Belly about 20 cm long, 3-4 cm wide.',
      'Paralysis (e.g. common fibular nerve palsy) causes foot drop with a high-stepping gait; it is often involved in anterior "shin splints" and compartment syndrome.'), { tags: ['anterior-compartment'] });
  add('tibialis-anterior-tendon', 'tibialis anterior tendon', 'Tendo musculi tibialis anterioris',
    cord([[0.099, 0.21, 0.02], [0.095, 0.14, 0.016], [0.086, 0.095, 0.012], [0.079, 0.068, 0.02], [0.073, 0.048, 0.039], [0.07, 0.035, 0.058]], 0.0028, 0.0034),
    SUP, 0.2, 'legL', I('Thick tendon crossing the front of the ankle, the most medial under the extensor retinacula, to the medial surface of the medial cuneiform and base of the first metatarsal.',
      'Transmits dorsiflexion and inversion to the medial foot.', 'About 15 cm long, 6-7 mm diameter.',
      'Easily seen and felt in front of the ankle when the foot is dorsiflexed and inverted; spontaneous rupture occurs in older adults.'), { color: TEN, tags: ['anterior-compartment', 'tendon'] });

  add('extensor-digitorum-longus', 'extensor digitorum longus', 'Musculus extensor digitorum longus', wrap([
    [0.12, 60, 0.024, 0.003, 0.003], [0.18, 44, 0.028, 0.007, 0.005], [0.28, 30, -0.002, 0.01, 0.0075], [0.38, 20, -0.001, 0.011, 0.008],
    [0.46, 14, -0.002, 0.008, 0.005], [0.49, 12, 0.033, 0.004, 0.003]], { radial: 20 }), SUP, 0.3, 'legL',
    I('Feather-shaped (unipennate) muscle lateral to tibialis anterior, arising from the lateral tibial condyle, the upper three-quarters of the anterior fibula and the interosseous membrane.',
      'Extends the lateral four toes and dorsiflexes the ankle.', 'Belly about 25 cm long, 2-3 cm wide.',
      'Its lowest part often forms a separate slip, fibularis tertius, inserting on the fifth metatarsal.'), { tags: ['anterior-compartment'] });
  const edlT0 = dors(0.105, 0.045, 0.0085), edlT = [cord([[0.104, 0.15, 0.014], [0.101, 0.095, 0.012], [0.102, 0.068, 0.026], edlT0], 0.0024, 0.0022)];
  for (let k = 1; k < 5; k++) {       // slips fan out just under the skin of the dorsum, then along the back of toes 2-5
    const xb = SKT[k][0][0], pA = toeEntry(k, 90, 0.001);
    edlT.push(cord([edlT0, dors(H.lerp(0.105, xb, 0.45), 0.085, 0.0065), dors(H.lerp(0.105, xb, 0.85), 0.115, 0.006), pA], 0.0012, 0.001, { radial: 6, env: false, step: 0.005 }), toeBand(k, pA, 0.85, 90, 0.0012));
  }
  add('extensor-digitorum-longus-tendons', 'extensor digitorum longus tendons', 'Tendines musculi extensoris digitorum longi', H.merge(edlT),
    SUP, 0.3, 'legL', I('A common tendon passes under the extensor retinacula in front of the ankle and fans into four slips on the dorsum of the foot, forming the dorsal (extensor) expansions of toes 2-5.',
      'Lifts (extends) the lateral four toes.', 'Common tendon about 5 mm; slips about 2 mm wide.',
      'The slips stand out under the skin of the dorsum when the toes are raised - a quick test of the deep fibular nerve.'), { color: TEN, tags: ['anterior-compartment', 'tendon', 'foot'] });

  add('extensor-hallucis-longus', 'extensor hallucis longus', 'Musculus extensor hallucis longus', wrap([
    [0.12, 72, 0.022, 0.003, 0.0025], [0.18, 50, 0.023, 0.006, 0.0045], [0.27, 38, 0.022, 0.007, 0.005], [0.35, 34, 0.021, 0.004, 0.003]], { radial: 16 }),
    DEEP, 0.6, 'legL', I('Thin muscle hidden between tibialis anterior and extensor digitorum longus, arising from the middle of the anterior fibula and the interosseous membrane.',
      'Extends the great toe and helps dorsiflex the ankle.', 'Belly about 15 cm long.',
      'Testing the strength of great-toe extension is the classic check of the L5 nerve root.'), { tags: ['anterior-compartment'] });
  add('extensor-hallucis-longus-tendon', 'extensor hallucis longus tendon', 'Tendo musculi extensoris hallucis longi',
    H.merge([cord([[0.0985, 0.14, 0.012], [0.093, 0.095, 0.012], [0.086, 0.068, 0.024], dors(0.08, 0.06, 0.0075), dors(0.076, 0.1, 0.0068), toeEntry(0, 90, 0.0016)], 0.0019, 0.0016, { step: 0.006 }),
      toeBand(0, toeEntry(0, 90, 0.0016), 0.82, 90, 0.0018)]),
    DEEP, 0.6, 'legL', I('Crosses the front of the ankle between the tendons of tibialis anterior and extensor digitorum longus and runs along the dorsum of the first metatarsal to the base of the distal phalanx of the great toe.',
      'Extends the great toe.', 'About 15 cm long, 4 mm diameter.',
      'Easily cut by lacerations on the top of the foot, leaving the big toe drooping.'), { color: TEN, tags: ['anterior-compartment', 'tendon'] });

  add('fibularis-longus', 'fibularis longus', 'Musculus fibularis (peroneus) longus', wrap([
    [0.2, -25, 0.033, 0.004, 0.003], [0.26, -20, -0.001, 0.009, 0.0055], [0.34, -14, 0, 0.013, 0.006], [0.42, -10, 0, 0.013, 0.006],
    [0.47, -6, -0.002, 0.008, 0.004]], { radial: 20 }), SUP, 0.4, 'legL',
    I('Superficial muscle of the lateral compartment, arising from the head and upper two-thirds of the lateral fibula (also called peroneus longus).',
      'Everts the foot and plantarflexes the ankle; with tibialis anterior it forms a "stirrup" under the foot that supports the transverse arch.', 'Belly about 20 cm long.',
      'The common fibular nerve winds around the fibular neck deep to its origin - a vulnerable spot for compression by casts, braces or leg-crossing.'), { tags: ['lateral-compartment'] });
  add('fibularis-longus-tendon', 'fibularis longus tendon', 'Tendo musculi fibularis longi',
    cord([[0.121, 0.215, -0.02], [0.117, 0.15, -0.025], [0.111, 0.1, -0.025], [0.112, 0.068, -0.023], [0.117, 0.042, -0.006], [0.119, 0.026, 0.024], [0.105, 0.024, 0.045], [0.085, 0.026, 0.055], [0.074, 0.03, 0.058]], 0.0024, 0.002),
    SUP, 0.4, 'legL', I('Passes behind the lateral malleolus, along the side of the calcaneus and through the groove of the cuboid, then obliquely across the deep sole to the medial cuneiform and base of the first metatarsal.',
      'Everts the foot and depresses the first metatarsal head.', 'About 25 cm long, 5 mm diameter.',
      'Tears or subluxation of the fibular tendons behind the malleolus follow ankle sprains and cause persistent lateral ankle pain.'), { color: TEN, tags: ['lateral-compartment', 'tendon'] });

  add('fibularis-brevis', 'fibularis brevis', 'Musculus fibularis (peroneus) brevis', wrap([
    [0.12, -55, 0.027, 0.004, 0.003], [0.18, -40, 0.031, 0.009, 0.005], [0.26, -30, 0.033, 0.011, 0.005], [0.34, -25, 0.033, 0.008, 0.004],
    [0.38, -22, 0.033, 0.004, 0.002]], { radial: 18 }), DEEP, 0.7, 'legL',
    I('Lies deep to fibularis longus, arising from the lower two-thirds of the lateral surface of the fibula.',
      'Everts the foot and weakly plantarflexes the ankle.', 'Belly about 15 cm long.',
      'Its tendon can avulse the tuberosity of the fifth metatarsal during an inversion sprain ("pseudo-Jones" fracture).'), { tags: ['lateral-compartment'] });
  add('fibularis-brevis-tendon', 'fibularis brevis tendon', 'Tendo musculi fibularis brevis',
    cord([[0.1073, 0.14, -0.028], [0.108, 0.1, -0.022], [0.109, 0.068, -0.018], [0.116, 0.045, -0.002], [0.124, 0.03, 0.028], [0.131, 0.024, 0.05]], 0.0026, 0.0022),
    DEEP, 0.7, 'legL', I('Runs behind the lateral malleolus in front of the fibularis longus tendon, above the fibular trochlea, to the tuberosity at the base of the fifth metatarsal.',
      'Everts the foot.', 'About 12 cm long, 5 mm diameter.',
      'Longitudinal splits of this tendon against the back of the fibula are a common finding after chronic ankle instability.'), { color: TEN, tags: ['lateral-compartment', 'tendon'] });

  // =============================== FOOT ===============================
  // draped over the sole (it rises into the hollow of the medial arch); slips end on the plantar plates of the MTP joints, 3-4 mm behind the toe creases
  const pf = [soleSheet([[0.09, -0.036], [0.093, 0.02], [0.096, 0.075], [0.099, 0.118]], [[0, 0.01, 0.0018], [0.35, 0.016, 0.0014], [0.7, 0.026, 0.0012], [1, 0.034, 0.001]], fasciaGap)];
  for (let k = 0; k < 5; k++) { const [xb, , zb] = SKT[k][0], x0 = 0.099 + (k - 2) * 0.014; pf.push(cord([sole(x0, 0.112, 0.0058), sole(H.lerp(x0, xb, 0.6), H.lerp(0.112, zb - 0.004, 0.6), 0.0056), sole(xb, zb - 0.004, 0.0054)], 0.0015, 0.0011, { radial: 6, env: false, step: 0.005 })); }
  add('plantar-fascia', 'plantar fascia', 'Aponeurosis plantaris', H.merge(pf), SUP, 0.05, 'legL',
    I('The plantar aponeurosis: a thick, pearly fibrous sheet under the sole, from the medial tubercle of the calcaneus fanning out into five slips that attach to the toes via the plantar plates and flexor sheaths.',
      'Ties the heel to the toes like a bowstring, supporting the longitudinal arch; it tightens when the toes extend at push-off (windlass mechanism).', 'About 20 cm long; 2-4 mm thick at the heel.',
      'Plantar fasciitis - heel pain worst with the first steps in the morning - is the commonest cause of heel pain in adults.'), { color: FASCIA, tags: ['foot', 'fascia'] });

  add('abductor-hallucis', 'abductor hallucis', 'Musculus abductor hallucis',
    footWrap([[-0.042, 238, 0.007, 0.005, 0.003], [-0.02, 226, 0.0045, 0.009, 0.0052], [0.015, 214, 0.003, 0.011, 0.006], [0.055, 206, 0.003, 0.009, 0.0052],
      [0.095, 200, 0.0028, 0.0055, 0.0035], [0.125, 192, 0.0028, 0.003, 0.002], [0.138, 188, 0.0028, 0.002, 0.0014]], { radial: 18 }),
    DEEP, 0.1, 'legL', I('Forms the soft medial border of the sole, from the medial process of the calcaneal tuberosity and flexor retinaculum to the medial side of the base of the great toe\'s proximal phalanx.',
      'Abducts and flexes the great toe and helps support the medial arch.', 'About 12-14 cm long.',
      'The plantar nerves and vessels pass deep to it - it can compress them in tarsal tunnel syndrome; it is often weak in hallux valgus (bunions).'), { tags: ['foot', 'sole'] });

  // lies on the plantar fascia (0.5 mm above it); its tendons run under the long flexor slips to the plantar side of toes 2-5, ending at the middle phalanges
  const fdbGap = z => fasciaGap(z) + 0.0041;
  const fdb = [soleSheet([[0.094, -0.028], [0.098, 0.02], [0.102, 0.07]], [[0, 0.005, 0.003], [0.4, 0.013, 0.005], [0.8, 0.014, 0.0042], [1, 0.011, 0.002]], fdbGap, { radial: 18, stri: 0.0006 })];
  for (let k = 1; k < 5; k++) {
    const xb = SKT[k][0][0], x0 = H.lerp(0.102, xb, 0.3), ang = [0, 250, 250, 242, 232][k], pA = toeEntry(k, ang, 0.001);
    fdb.push(cord([sole(x0, 0.068, fdbGap(0.068) + 0.003), sole(H.lerp(x0, xb, 0.6), 0.1, fdbGap(0.1) + 0.0025), pA], 0.0013, 0.001, { radial: 6, env: false, step: 0.005 }), toeBand(k, pA, 0.5, ang, 0.001));
  }
  add('flexor-digitorum-brevis', 'flexor digitorum brevis', 'Musculus flexor digitorum brevis', H.merge(fdb), DEEP, 0.2, 'legL',
    I('Central muscle of the first layer of the sole, lying directly on the plantar fascia; from the medial calcaneal tuberosity it sends four tendons that split to insert on the middle phalanges of toes 2-5, letting the long flexor tendons pass through.',
      'Flexes the lateral four toes at the proximal interphalangeal joints and helps support the arch.', 'Belly about 10-12 cm long, 3 cm wide.',
      'Together with abductor hallucis and abductor digiti minimi it forms the first of the four muscle layers of the sole.'), { tags: ['foot', 'sole'] });

  // belly on the dorsolateral calcaneus in front of the lateral malleolus, slanting forward and medially over the dorsum; its four tendons run
  // deep and lateral to the EDL slips to toes 1-4 (extensor hallucis brevis to the great toe) and end on the proximal phalanges
  const edb = [footWrap([[-0.006, -18, 0.004, 0.006, 0.0025], [0.015, 8, 0.0035, 0.011, 0.004], [0.04, 32, 0.0035, 0.012, 0.0045], [0.062, 52, 0.0035, 0.01, 0.0032], [0.078, 64, 0.0035, 0.006, 0.0015]], { radial: 16 })];
  for (let k = 0; k < 4; k++) {
    const xb = SKT[k][0][0], S = footSec(0.074), th = 62 * D2R, R = footR(S, Math.cos(th), Math.sin(th)) - 0.0065, x0 = S.cx + R * Math.cos(th), y0 = S.cy + R * Math.sin(th), pA = toeEntry(k, 58, 0.0009);
    edb.push(cord([[x0, y0, 0.074], dors(H.lerp(x0, xb, 0.5) + 0.002, 0.1, 0.0085), dors(H.lerp(x0, xb, 0.85) + 0.003, 0.118, 0.0075), pA], 0.0011, 0.0009, { radial: 6, env: false, step: 0.005 }), toeBand(k, pA, 0.35, 58, 0.0009));
  }
  add('extensor-digitorum-brevis', 'extensor digitorum brevis', 'Musculus extensor digitorum brevis', H.merge(edb), DEEP, 0.3, 'legL',
    I('The only muscle on the top of the foot: a small fleshy mass on the dorsolateral calcaneus whose four thin tendons run to toes 1-4 (the slip to the great toe is called extensor hallucis brevis) and join the long extensor tendons.',
      'Extends toes 1-4 at the metatarsophalangeal joints.', 'Belly about 6-8 cm long.',
      'Its soft bulge in front of the lateral malleolus can be mistaken for swelling; it is a standard recording site for deep fibular nerve conduction studies.'), { tags: ['foot', 'dorsum'] });

  return g;
});
