/* systems/muscular_upper.js - skeletal muscles of the head, neck, trunk, shoulder, arm, forearm and hand, and the diaphragm.
   Muscles are built along their real origin -> insertion courses: `sweep` = spindle/strap lofted along a curve with a
   flattened cross-section, `sheet` = broad muscle sheet whose fibres are shrink-wrapped to the trunk envelope (L.trunkAt).
   Tendons/aponeuroses are painted pale with vertex colours (material colour = muscle, vertex colour = multiplier). */
ANATOMY.register('muscular_upper', { name: 'Muscles: head, trunk & arms', description: 'Skeletal muscles of the face, neck, trunk, shoulder, arm, forearm and hand, plus the diaphragm' }, function (THREE, H, L, ctx) {
  const g = H.group('muscular_upper');
  const V3 = THREE.Vector3, PI = Math.PI, SUP = H.LAYER.MUSCLE_SUPERFICIAL, DEEP = H.LAYER.MUSCLE_DEEP, v = H.v3;
  const fnOf = (f) => typeof f === 'function' ? f : () => f;
  const pf = (keys) => (t) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b[0]) return H.lerp(a[1], b[1], H.smoothstep(a[0], b[0], t)); } return keys[keys.length - 1][1]; };
  const tenAmt = (t, a, b) => Math.max(a > 0 ? 1 - H.smoothstep(a * 0.6, a * 1.15, t) : 0, b > 0 ? H.smoothstep(1 - b * 1.15, 1 - b * 0.6, t) : 0);
  const edge = (x, p) => Math.pow(Math.max(0, Math.sin(PI * H.clamp(x, 0, 1))), p == null ? 0.5 : p);

  // ------------------------------------------------------------ materials (vertex colour tints tendon ends)
  const MATS = {}, cTen = new THREE.Color(H.COLORS.tendon);
  function matOf(hex) { if (!MATS[hex]) { const m = H.mat({ color: hex, roughness: 0.58 }); m.vertexColors = true; const c = new THREE.Color(hex); MATS[hex] = { m, k: [cTen.r / c.r, cTen.g / c.g, cTen.b / c.b] }; } return MATS[hex]; }
  function mk(pos, uv, ten, idx) { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals(); q.userData.ten = Float32Array.from(ten); return q; }
  function tri(idx, p, a, b, c, w) {
    const ux = p[3 * b] - p[3 * a], uy = p[3 * b + 1] - p[3 * a + 1], uz = p[3 * b + 2] - p[3 * a + 2], wx = p[3 * c] - p[3 * a], wy = p[3 * c + 1] - p[3 * a + 1], wz = p[3 * c + 2] - p[3 * a + 2];
    if ((uy * wz - uz * wy) * w.x + (uz * wx - ux * wz) * w.y + (ux * wy - uy * wx) * w.z >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  }
  const quad = (idx, p, a, b, c, d, w) => { tri(idx, p, a, b, c, w); tri(idx, p, b, d, c, w); };
  function merge(list) {
    const P = [], U = [], T = [], I = []; let off = 0;
    for (const q of list) { const p = q.attributes.position.array, uv = q.attributes.uv.array, t = q.userData.ten, ix = q.index.array, n = p.length / 3;
      for (let i = 0; i < p.length; i++) P.push(p[i]); for (let i = 0; i < n; i++) { U.push(uv[2 * i], uv[2 * i + 1]); T.push(t ? t[i] : 0); } for (let i = 0; i < ix.length; i++) I.push(ix[i] + off); off += n; }
    return mk(P, U, T, I);
  }
  function paint(q, k) { const t = q.userData.ten, n = q.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = t ? t[i] : 0; for (let e = 0; e < 3; e++) c[3 * i + e] = 1 + (k[e] - 1) * a; } q.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const I = (description, fn, size, notes) => ({ description, function: fn, size, notes });
  let count = 0;
  function add(s, geo) {
    const mm = matOf(s.color || (s.layer === DEEP ? H.COLORS.muscleDeep : H.COLORS.muscle)); unband(geo); paint(geo, mm.k);
    const spec = { id: s.id, name: s.name, latin: s.latin, system: 'muscular', layer: s.layer, depth: s.depth || 0, region: s.region || 'body', geometry: geo, material: mm.m, info: s.info, tags: ['muscle'].concat(s.tags || []), parent: s.parent || null };
    if (s.mid) g.add(H.part(Object.assign(spec, { side: 'M' }))); else H.pair(spec).forEach(p => g.add(p));
    count++;
  }

  // ------------------------------------------------------------ trunk envelope (skin silhouette) and rib-cage envelope
  const rPol = (phi, s) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(phi)) / s.rx, s.n) + Math.pow(Math.abs(Math.sin(phi)) / s.rz, s.n), 1 / s.n);
  const skinEnv = (y) => L.trunkAt(y);
  const cageEnv = (y) => { const s = L.trunkAt(y), k = y > 1.33 ? Math.pow(Math.min(1, (y - 1.33) / 0.125), 2) : 0; return { rx: Math.min(s.rx - 0.02, 0.148 - 0.093 * k), rz: s.rz - 0.028, cz: s.cz + 0.02 * k, n: s.n }; };
  function sPt(phi, y, env) { const s = (env || skinEnv)(y), r = rPol(phi, s); return new V3(r * Math.cos(phi), y, s.cz + r * Math.sin(phi)); }
  // point at polar angle phi (0 = +X subject's left, PI/2 = front, -PI/2 = back), height y, `inset` m inside the envelope along its normal
  function T(phi, y, inset, env) {
    const S = sPt(phi, y, env); if (!inset) return S;
    const e = 0.003, a = sPt(phi + e, y, env).sub(sPt(phi - e, y, env)), b = sPt(phi, y + e, env).sub(sPt(phi, y - e, env));
    const n = new V3().crossVectors(a, b).normalize(); if (n.x * Math.cos(phi) + n.z * Math.sin(phi) < 0) n.negate();
    return S.addScaledVector(n, -inset);
  }
  const phiOf = (p, env) => Math.atan2(p.z - (env || skinEnv)(p.y).cz, p.x);
  function phiX(x, y, side, env) { const s = (env || skinEnv)(y), q = Math.min(0.995, Math.abs(x) / s.rx); return Math.atan2(side * s.rz * Math.pow(1 - Math.pow(q, s.n), 1 / s.n), x); }
  const TX = (x, y, inset, side, env) => T(phiX(x, y, side || 1, env), y, inset, env);
  const trunkOut = (P) => new V3(P.x, 0, P.z - skinEnv(P.y).cz).normalize();
  // fibre over the envelope from a to b; ends are [phi, y] (on the surface) or [x, y, z] (free point, blended in)
  function fib(a, b, M, inset, o = {}) {
    const env = o.env, A = a.length === 2 ? { phi: a[0], y: a[1] } : { p: v(a) }, B = b.length === 2 ? { phi: b[0], y: b[1] } : { p: v(b) };
    for (const X of [A, B]) if (X.p) { X.phi = phiOf(X.p, env); X.y = X.p.y; }
    let dp = B.phi - A.phi; while (dp > PI) dp -= 2 * PI; while (dp < -PI) dp += 2 * PI;
    const out = [], ins = fnOf(inset), ey = o.ey || (u => u), ep = o.ep || (u => u);
    for (let j = 0; j < M; j++) {
      const u = j / (M - 1), p = T(A.phi + dp * ep(u), H.lerp(A.y, B.y, ey(u)) + (o.sag || 0) * Math.sin(PI * u), ins(u), env);
      if (A.p) p.lerp(A.p, 1 - H.smoothstep(0, o.bA || 0.3, u)); if (B.p) p.lerp(B.p, H.smoothstep(1 - (o.bB || 0.3), 1, u));
      out.push(p);
    }
    return out;
  }
  function fibC(ctrl, M) { const c = new THREE.CatmullRomCurve3(ctrl.map(v), false, 'centripetal'), out = []; for (let j = 0; j < M; j++) out.push(c.getPointAt(j / (M - 1))); return out; }

  // ------------------------------------------------------------ builders
  /* sheet(F, th, o): F = fibres (array of nf arrays of M mid-surface points). th(u,v,P) half thickness (u along fibre, v across).
     o: { out(P) outward dir, ten(u,v,P) tendon amount, amp striation amplitude, ks striation count, seed } */
  function sheet(F, th, o = {}) {
    const nf = F.length, M = F[0].length, outf = o.out || trunkOut, thf = fnOf(th), amp = o.amp == null ? 0.0008 : o.amp, sd = o.seed || 1, ks = o.ks || nf * 1.2, Nm = [];
    for (let i = 0; i < nf; i++) for (let j = 0; j < M; j++) {
      const du = F[i][Math.min(M - 1, j + 1)].clone().sub(F[i][Math.max(0, j - 1)]), dv = F[Math.min(nf - 1, i + 1)][j].clone().sub(F[Math.max(0, i - 1)][j]);
      const w = outf(F[i][j]), n = new V3().crossVectors(du, dv); if (n.lengthSq() < 1e-16) n.copy(w); n.normalize(); if (n.dot(w) < 0) n.negate(); Nm.push(n);
    }
    const pos = [], uv = [], ten = [], idx = [];
    for (let s = 0; s < 2; s++) for (let i = 0; i < nf; i++) for (let j = 0; j < M; j++) {
      const u = j / (M - 1), vv = i / (nf - 1), P = F[i][j], n = Nm[i * M + j], t = Math.max(2e-4, thf(u, vv, P));
      const d = s ? -t : Math.max(0.35 * t, t + amp * H.fbm(vv * ks + sd, u * 3 + sd * 0.3, sd * 0.7, 2));
      pos.push(P.x + n.x * d, P.y + n.y * d, P.z + n.z * d); uv.push(u, vv); ten.push(o.ten ? o.ten(u, vv, P) : 0);
    }
    const at = (s, i, j) => (s * nf + i) * M + j;
    for (let s = 0; s < 2; s++) for (let i = 0; i < nf - 1; i++) for (let j = 0; j < M - 1; j++) { const w = Nm[i * M + j].clone().add(Nm[(i + 1) * M + j + 1]); if (s) w.negate(); quad(idx, pos, at(s, i, j), at(s, i, j + 1), at(s, i + 1, j), at(s, i + 1, j + 1), w); }
    const ring = []; for (let j = 0; j < M; j++) ring.push([0, j]); for (let i = 1; i < nf; i++) ring.push([i, M - 1]); for (let j = M - 2; j >= 0; j--) ring.push([nf - 1, j]); for (let i = nf - 2; i > 0; i--) ring.push([i, 0]);
    for (let k = 0; k < ring.length; k++) { const [i1, j1] = ring[k], [i2, j2] = ring[(k + 1) % ring.length], w = F[i1][j1].clone().sub(F[H.clamp(i1, 1, nf - 2)][H.clamp(j1, 1, M - 2)]); quad(idx, pos, at(0, i1, j1), at(0, i2, j2), at(1, i1, j1), at(1, i2, j2), w); }
    return mk(pos, uv, ten, idx);
  }
  /* sweep(pts, w, th, o): spindle/strap along a Catmull-Rom curve. w(t) half width, th(t) half thickness (along `up`).
     o: { up: vec | fn(t,P), closed, radial, n (superellipse), bulge (outer face rounder), tA/tB tendon fraction at ends | ten(t), amp, ks, seed, segs|step } */
  function sweep(pts, w, th, o = {}) {
    const closed = !!o.closed, curve = new THREE.CatmullRomCurve3(pts.map(v), closed, 'centripetal');
    const segs = o.segs || H.clamp(Math.round(curve.getLength() / (o.step || 0.007)), 6, 44), R = o.radial || 12, n = o.n || 2.4, bl = o.bulge == null ? 0.2 : o.bulge;
    const wf = fnOf(w), tf = fnOf(th), upf = typeof o.up === 'function' ? o.up : o.up ? (() => { const u = v(o.up); return () => u; })() : ((t, P) => trunkOut(P));
    const rows = closed ? segs : segs + 1, pos = [], uv = [], ten = [], idx = [], C = [], TT = [], P = new V3(), Tg = new V3(), B = new V3(), N = new V3();
    for (let i = 0; i < rows; i++) {
      const t = i / segs; curve.getPointAt(t, P); curve.getTangentAt(t, Tg);
      B.copy(v(upf(t, P))); B.addScaledVector(Tg, -B.dot(Tg)); if (B.lengthSq() < 1e-10) B.set(Tg.y, -Tg.x, 0); B.normalize(); N.crossVectors(B, Tg).normalize();
      const ww = Math.max(3e-4, wf(t)), tt = Math.max(3e-4, tf(t)), ta = o.ten ? o.ten(t) : tenAmt(t, o.tA || 0, o.tB || 0);
      C.push(P.clone()); TT.push(Tg.clone());
      for (let j = 0; j < R; j++) {
        const a = j / R * 2 * PI, c = Math.cos(a), s = Math.sin(a), ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * ww, ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * tt * (s > 0 ? 1 + bl : 1 - bl);
        pos.push(P.x + N.x * ex + B.x * ez, P.y + N.y * ex + B.y * ez, P.z + N.z * ex + B.z * ez); uv.push(t, j / R); ten.push(ta);
      }
    }
    for (let i = 0; i < segs; i++) { const i2 = (i + 1) % rows; for (let j = 0; j < R; j++) { const a = i * R + j, j2 = (j + 1) % R; quad(idx, pos, a, i * R + j2, i2 * R + j, i2 * R + j2, new V3(pos[3 * a] - C[i].x, pos[3 * a + 1] - C[i].y, pos[3 * a + 2] - C[i].z)); } }
    if (!closed) for (const [ri, sg] of [[0, -1], [segs, 1]]) { const ci = pos.length / 3, c = C[ri], wv = TT[ri].clone().multiplyScalar(sg); pos.push(c.x, c.y, c.z); uv.push(ri ? 1 : 0, 0.5); ten.push(ten[ri * R]); for (let j = 0; j < R; j++) tri(idx, pos, ci, ri * R + j, ri * R + (j + 1) % R, wv); }
    const q = mk(pos, uv, ten, idx);
    const amp = o.amp == null ? 0.0007 : o.amp, sd = o.seed || 3, ka = o.ks || 9;
    if (amp > 0) { const U = q.attributes.uv.array; H.displace(q, (p, nn, i) => { const a = U[2 * i + 1] * 2 * PI; return amp * H.fbm(Math.cos(a) * ka / (2 * PI) + sd, Math.sin(a) * ka / (2 * PI) + sd * 0.5, U[2 * i] * 4 + sd * 0.37, 2); }); }
    return q;
  }

  // ------------------------------------------------------------ limb frames (LEFT side; H.pair mirrors to the right)
  const JL = L.joint, SH = v(JL.shoulderL), EL = v(JL.elbowL), WR = v(JL.wristL), CLM = v(L.bone.clavicleL.medial), CLL = v(L.bone.clavicleL.lateral);
  function frame(A, B) { const D = B.clone().sub(A), len = D.length(); D.normalize(); const ant = new V3(0, 0, 1).addScaledVector(D, -D.z).normalize(), lat = new V3().crossVectors(ant, D).normalize(); return { A, D, len, ant, lat }; }
  const UA = frame(SH, EL), FA = frame(EL, WR), HF = frame(WR, v(JL.fingertipMiddleL));
  // point in a limb frame: t along the segment, deg around it (0 anterior, 90 lateral/radial/thumb side, 180 posterior, -90 medial), r radial distance
  function lp(F, t, deg, r) { const a = deg * PI / 180; return F.A.clone().addScaledVector(F.D, t * F.len).addScaledVector(F.ant, Math.cos(a) * r).addScaledVector(F.lat, Math.sin(a) * r); }
  const lout = (F) => (t, P) => { const q = P.clone().sub(F.A), al = q.dot(F.D); return (al < 0 && F === UA) ? q : q.addScaledVector(F.D, -al); };
  const clav = (f) => CLM.clone().lerp(CLL, f);

  // ------------------------------------------------------------ analytic replica of the skin round the shoulder (integumentary builds the trunk loft on
  // L.trunkSections, a deltoid cap blob over each shoulder joint and the arm loft). The shoulder skin sits only ~2 cm above the joint centre, so the
  // shoulder muscles are tucked under it: points are pulled back along rays from an inner anchor until they lie >= m inside it (14-direction erosion).
  const CAPC = [JL.shoulderL[0] + 0.002, JL.shoulderL[1] - 0.03, JL.shoulderL[2] - 0.002];
  const ARMR = [[1.10, 0.0412, 0.036], [1.14, 0.039, 0.039], [1.22, 0.040, 0.044], [1.30, 0.043, 0.046], [1.36, 0.0461, 0.047], [1.40, 0.043, 0.044], [1.425, 0.030, 0.032]];
  function inSkinSh(x, y, z) {
    x = Math.abs(x);
    if (y > 0.86 && y < 1.515) { const s = L.trunkAt(y); if (Math.pow(x / s.rx, s.n) + Math.pow(Math.abs(z - s.cz) / s.rz, s.n) <= 1) return true; }
    const dy = y - CAPC[1]; let q, rh, cx = CAPC[0];
    if (dy >= 0) { q = dy / 0.05; rh = q < 1 ? Math.sqrt(1 - q * q) * (1 - 0.25 * q * q) : 0; }
    else { q = -dy / 0.1; rh = q < 1 ? Math.sqrt(1 - q * q) * Math.max(0, 1 - 0.8 * Math.pow(q, 1.3)) : 0; cx += 0.035 * q; }
    if (rh > 0 && ((x - cx) / (0.05 * rh)) ** 2 + ((z - CAPC[2]) / (0.055 * rh)) ** 2 <= 1) return true;
    if (y > 1.10 && y < 1.425) {
      let i = 0; while (ARMR[i + 1][0] < y) i++;
      const a = ARMR[i], b = ARMR[i + 1], t = (y - a[0]) / (b[0] - a[0]), k = (y - 1.10) / (JL.shoulderL[1] - 1.10);
      if (Math.pow(Math.abs(x - H.lerp(EL.x, SH.x, k)) / H.lerp(a[1], b[1], t), 2.1) + Math.pow(Math.abs(z - H.lerp(EL.z, SH.z, k)) / H.lerp(a[2], b[2], t), 2.1) <= 1) return true;
    }
    return false;
  }
  const E14 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].concat([[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]].map(d => d.map(c => c / Math.sqrt(3))));
  const inSkinM = (x, y, z, m) => E14.every(d => inSkinSh(x + d[0] * m, y + d[1] * m, z + d[2] * m));
  // pull point P (in place) back towards anchor A so it ends >= m inside the replica; smooth and order-preserving within w of the limit
  function tuckPt(P, A, m, w) {
    const D = P.clone().sub(A), r = D.length(); if (r < 1e-6) return P; D.divideScalar(r);
    const at = (s) => inSkinM(A.x + D.x * s, A.y + D.y * s, A.z + D.z * s, m);
    if (!at(0)) return P;
    const lim = r + w; let s = 0; while (s < lim && at(Math.min(lim, s + 0.002))) s = Math.min(lim, s + 0.002);
    if (s >= lim) return P;
    let lo = s, hi = s + 0.002; for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; if (at(mid)) lo = mid; else hi = mid; }
    if (r <= lo - w) return P;
    return P.copy(A).addScaledVector(D, lo - w + w * Math.tanh((r - lo + w) / w));
  }
  // tuck every vertex of a finished geometry (safety net after the control points / fibres were tucked)
  function tuckGeo(q, anchor, m, w, only) {
    const p = q.attributes.position, P = new V3();
    for (let i = 0; i < p.count; i++) { P.fromBufferAttribute(p, i); if (only && !only(P)) continue; tuckPt(P, anchor(P), m, w); p.setXYZ(i, P.x, P.y, P.z); }
    p.needsUpdate = true; q.computeVertexNormals(); return q;
  }
  // anchor on the humeral axis (clamped to its upper half; the joint centre for points above/medial to it)
  const humAnchor = (P) => { const t = H.clamp(P.clone().sub(SH).dot(UA.D), 0, UA.len * 0.5); return SH.clone().addScaledVector(UA.D, t); };

  // ------------------------------------------------------------ shoulder double-shell guard. The trunk skin is ONE part made of the trunk loft plus a
  // deltoid-cap blob over each shoulder, and the arm skin is a separate loft; the thin zone inside BOTH the trunk loft and the cap but outside the arm
  // loft is wrapped by two shells of the same skin part, so ray-parity inside/outside tests (test/poke.js) read it as "outside the skin".
  // Exact replicas of the three shells (<= 0.5 mm): trunk loft on the integumentary sections with its relief, cap blob, arm loft. Muscle vertices
  // lying > 1 mm deep in that zone are slid ALONG their own mesh edges until they leave it, so the muscle keeps its shape (see unband below).
  const cmrS = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  function stations(S, sub) { const st = []; for (let i = 0; i < S.length - 1; i++) { const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)];
    for (let k = 0; k < (i === S.length - 2 ? sub + 1 : sub); k++) { const t = k / sub, q = {}; for (const key of Object.keys(p1)) q[key] = cmrS(p0[key], p1[key], p2[key], p3[key], t); st.push(q); } } return st; }
  function secAt(st, y) { if (y < st[0].y || y > st[st.length - 1].y) return null; let i = 0; while (i < st.length - 2 && st[i + 1].y < y) i++; const a = st[i], b = st[i + 1], t = (y - a.y) / Math.max(1e-9, b.y - a.y), q = {}; for (const k of Object.keys(a)) q[k] = a[k] + (b[k] - a[k]) * t; return q; }
  const TSK = L.trunkSections.map(s => ({ y: s.y, rx: s.rx, rz: s.rz, cz: s.cz, n: s.n }));
  TSK[TSK.length - 1] = { y: TSK[TSK.length - 1].y, rx: 0.054, rz: 0.056, cz: 0, n: TSK[TSK.length - 1].n }; TSK.unshift({ y: 0.835, rx: 0.12, rz: 0.075, cz: -0.012, n: 2.2 });
  const TST = stations(TSK, 6), female = ctx && ctx.sex === 'female';
  const armAx = (y) => { const lo = JL.wristL, mid = JL.elbowL, hi = JL.shoulderL, up = y >= mid[1], a = up ? mid : lo, b = up ? hi : mid, t = H.clamp((y - a[1]) / (b[1] - a[1]), 0, 1); return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]; };
  const UAr = L.limb.upperArm, FAr = L.limb.forearm;
  const AST = stations([[0.84, FAr.rBottom * 1.04, FAr.rBottom * 0.66], [0.88, FAr.rBottom * 1.08, FAr.rBottom * 0.72], [0.95, 0.034, 0.025], [1.02, 0.040, 0.031], [1.06, FAr.rTop, FAr.rTop * 0.81],
    [L.y.elbow, UAr.rBottom * 1.03, UAr.rBottom * 0.9], [1.14, 0.039, 0.039], [1.22, 0.040, 0.044], [1.30, 0.043, 0.046], [1.36, UAr.rTop * 0.96, UAr.rTop * 0.98], [1.40, 0.043, 0.044], [1.425, 0.030, 0.032]]
    .map(r => { const c = armAx(r[0]); return { y: r[0], rx: r[1], rz: r[2], cx: c[0], cz: c[1] }; }), 5);
  const G2s = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));
  const seg2 = (x, y, x0, y0, x1, y1) => { const ux = x1 - x0, uy = y1 - y0, t = H.clamp(((x - x0) * ux + (y - y0) * uy) / (ux * ux + uy * uy), 0, 1); return Math.hypot(x - x0 - ux * t, y - y0 - uy * t); };
  function trunkRelief(ax, y, nz) {   // the shoulder-relevant terms of the skin's trunk relief (displacement along the normal)
    const fr = H.smoothstep(0.15, 0.6, nz), bk = H.smoothstep(0.15, 0.6, -nz), dc = seg2(ax, y, 0.02, 1.432, 0.18, 1.44);
    return fr * (female ? 0.003 * G2s(ax - 0.08, y - 1.35, 0.06, 0.05) : 0.009 * G2s(ax - 0.085, y - 1.33, 0.06, y < 1.33 ? 0.032 : 0.055)) + fr * (0.003 * Math.exp(-((dc / 0.007) ** 2)) - 0.002 * G2s(dc - 0.02, 0, 0.008, 1) * (y < 1.44 ? 1 : 0))
      + bk * (0.005 * G2s(ax - 0.095, y - 1.34, 0.045, 0.07) + 0.004 * G2s(ax - 0.14, y - 1.25, 0.03, 0.08));
  }
  const tF = (x, y, z) => { const s = secAt(TST, y); return s ? Math.pow(x / s.rx, s.n) + Math.pow(Math.abs(z - s.cz) / s.rz, s.n) : 9; };
  function shTrunk(x, y, z) { const e = 0.001, gx = (tF(x + e, y, z) - tF(x - e, y, z)) / (2 * e), gy = (tF(x, y + e, z) - tF(x, y - e, z)) / (2 * e), gz = (tF(x, y, z + e) - tF(x, y, z - e)) / (2 * e), gl = Math.hypot(gx, gy, gz) || 1;
    const d = trunkRelief(x, y, gz / gl); return tF(x - gx / gl * d, y - gy / gl * d, z - gz / gl * d) <= 1; }
  function shArm(x, y, z) { const s = secAt(AST, y); if (!s) return false; const dx = x - s.cx, dz = z - s.cz, a = Math.atan2(dz / s.rz, dx / s.rx), m = 1 + 0.06 * Math.exp(-(((y - 1.28) / 0.07) ** 2)) * Math.max(0, -Math.sin(a)) ** 2;
    return Math.pow(Math.abs(dx) / (s.rx * m), 2.1) + Math.pow(Math.abs(dz) / (s.rz * m), 2.1) <= 1; }
  function shCap(x, y, z) { const dy = y - CAPC[1]; let q, rh, cx = CAPC[0];
    if (dy >= 0) { q = dy / 0.05; rh = q < 1 ? Math.sqrt(1 - q * q) * (1 - 0.25 * q * q) : 0; } else { q = -dy / 0.1; rh = q < 1 ? Math.sqrt(1 - q * q) * Math.max(0, 1 - 0.8 * Math.pow(q, 1.3)) : 0; cx += 0.035 * q; }
    return rh > 0 && ((x - cx) / (0.05 * rh)) ** 2 + ((z - CAPC[2]) / (0.055 * rh)) ** 2 <= 1; }
  const shEven = (x, y, z) => { x = Math.abs(x); return y > 1.28 && y < 1.445 && x > 0.13 && shCap(x, y, z) && shTrunk(x, y, z) && !shArm(x, y, z); };
  const shCore = (x, y, z) => shEven(x, y, z) && E14.every(d => shEven(x + d[0] * 0.0008, y + d[1] * 0.0008, z + d[2] * 0.0008));
  // slide every vertex lying > 0.8 mm deep in the double-shell zone along the mesh (shortest edge path) to where that path reaches <= 0.8 mm of
  // the zone's edge (it stops before the next vertex, so no triangle folds); replica error <= 0.5 mm keeps it within 1.5 mm of a skin shell
  function unband(q) {
    const p = q.attributes.position, n = p.count, O = Float32Array.from(p.array), risky = [];
    for (let i = 0; i < n; i++) if (shCore(O[3 * i], O[3 * i + 1], O[3 * i + 2])) risky.push(i);
    if (!risky.length || !q.index) return q;
    const ix = q.index.array, adj = Array.from({ length: n }, () => new Set());
    for (let k = 0; k < ix.length; k += 3) for (let e = 0; e < 3; e++) { const a = ix[k + e], b = ix[k + (e + 1) % 3]; if (a !== b) { adj[a].add(b); adj[b].add(a); } }
    const P = (i) => new V3(O[3 * i], O[3 * i + 1], O[3 * i + 2]), ev = (v) => shCore(v.x, v.y, v.z);
    for (const s0 of risky) {
      const dist = new Map([[s0, 0]]), prev = new Map(), done = new Set(); let hit = -1;
      while (true) {
        let u = -1, du = Infinity; for (const [k, d] of dist) if (!done.has(k) && d < du) { du = d; u = k; }
        if (u < 0 || du > 0.03) break; done.add(u);
        if (!ev(P(u))) { hit = u; break; }
        for (const w of adj[u]) { const nd = du + P(u).distanceTo(P(w)); if (!dist.has(w) || nd < dist.get(w)) { dist.set(w, nd); prev.set(w, u); } }
      }
      if (hit < 0) continue;
      const path = [hit]; while (path[0] !== s0) path.unshift(prev.get(path[0]));
      for (let k = 0; k < path.length - 1; k++) {
        const A = P(path[k]), B = P(path[k + 1]); if (ev(B)) continue;
        let lo = 0, hi = 1; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (ev(A.clone().lerp(B, mid))) lo = mid; else hi = mid; }
        const len = A.distanceTo(B), t = Math.min(1, hi + 0.0002 / Math.max(1e-6, len)), X = A.lerp(B, t); p.setXYZ(s0, X.x, X.y, X.z); break;
      }
    }
    p.needsUpdate = true; q.computeVertexNormals(); return q;
  }

  // ============================================================ PECTORALIS MAJOR
  {
    const nf = 16, M = 22, F = [];
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o, bA = 0.3;
      if (s < 0.22) { o = clav(0.5 - 0.42 * s / 0.22).add(new V3(0, -0.004, 0.009)).toArray(); bA = 0.5; }
      else if (s < 0.84) { const y = H.lerp(1.418, 1.235, (s - 0.22) / 0.62); o = [phiX(0.012, y, 1), y]; }
      else { const k = (s - 0.84) / 0.16, x = H.lerp(0.012, 0.075, k), y = H.lerp(1.232, 1.222, k); o = [phiX(x, y, 1), y]; }
      const ins = lp(UA, H.lerp(0.06, 0.2, s), 25, 0.019).toArray();
      F.push(fib(o, ins, M, 0.0145, { bA, bB: 0.3, ey: u => Math.pow(u, 1.5) }));
    }
    const th = (u, w) => 0.0055 * pf([[0, 0.35], [0.2, 1], [0.7, 0.9], [1, 0.35]])(u) * (0.3 + 0.7 * edge(w));
    add({ id: 'pectoralis-major', name: 'pectoralis major', latin: 'Musculus pectoralis major', layer: SUP, depth: 0.0, region: 'thorax', tags: ['chest', 'shoulder'],
      info: I('Large fan-shaped chest muscle arising from the medial half of the clavicle, the front of the sternum and the upper six costal cartilages; its fibres converge on a folded flat tendon inserting on the lateral lip of the intertubercular groove (crest of the greater tubercle) of the humerus.',
        'Adducts and medially rotates the arm; the clavicular head flexes it, the sternocostal head pulls the raised arm down and forwards.',
        'About 20 cm across, 1–1.5 cm thick; insertion tendon ~5 cm wide.',
        'Congenital absence of its sternocostal head is Poland syndrome; the muscle is often used as a pedicled flap in head-and-neck reconstruction.') },
      sheet(F, th, { ten: (u, w) => Math.max(H.smoothstep(0.86, 0.97, u), s0(u, w)), amp: 0.0011, seed: 2 }));
    function s0(u, w) { return w > 0.25 ? 1 - H.smoothstep(0.0, 0.035, u) : 0; }
  }

  // ============================================================ DELTOID (wraps the humeral head r 0.024 at L.joint.shoulderL)
  {
    const nf = 18, M = 22, F = [], acr = new THREE.CatmullRomCurve3([v([0.205, 1.437, 0.0]), v([0.217, 1.436, -0.02]), v([0.2, 1.432, -0.046])]);
    const dir = (deg) => UA.ant.clone().multiplyScalar(Math.cos(deg * PI / 180)).addScaledVector(UA.lat, Math.sin(deg * PI / 180));
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o;
      if (s < 0.33) o = clav(0.66 + 0.3 * s / 0.33).add(new V3(0, 0.004, 0.006));
      else if (s < 0.66) o = acr.getPointAt((s - 0.33) / 0.33);
      else o = v([0.19, 1.43, -0.052]).lerp(v([0.118, 1.405, -0.086]), (s - 0.66) / 0.34);
      const d = o.clone().sub(SH); if (d.length() < 0.034) o = SH.clone().addScaledVector(d.normalize(), 0.034);
      const psi = -12 + 205 * s;
      F.push(fibC([o, SH.clone().addScaledVector(dir(psi), 0.036).addScaledVector(UA.D, -0.01), lp(UA, 0.15, psi, 0.035), lp(UA, 0.3, 90 + (psi - 90) * 0.55, 0.028), lp(UA, 0.42, 90 + (psi - 90) * 0.12, 0.015)], M));
    }
    const th = (u, w) => 0.0068 * pf([[0, 0.35], [0.2, 0.85], [0.5, 1], [0.85, 0.55], [1, 0.3]])(u) * (0.35 + 0.65 * edge(w));
    // the cap of the shoulder is only ~2 cm above the joint centre: flatten the fibres under the shoulder skin (outer face >= 3 mm inside it)
    for (let i = 0; i < nf; i++) for (let j = 0; j < M; j++) tuckPt(F[i][j], humAnchor(F[i][j]), th(j / (M - 1), i / (nf - 1)) + 0.0013 + 0.003, 0.006);
    add({ id: 'deltoid', name: 'deltoid', latin: 'Musculus deltoideus', layer: SUP, depth: 0.0, region: 'armL', tags: ['shoulder'],
      info: I('Thick triangular muscle that caps the shoulder. It arises from the lateral third of the clavicle, the acromion and the spine of the scapula, wraps over the head of the humerus and converges on the deltoid tuberosity about 40% of the way down the humerus.',
        'Abducts the arm beyond the first ~15° (middle fibres); anterior fibres flex and medially rotate it, posterior fibres extend and laterally rotate it.',
        'About 15 cm long, up to 2.5 cm thick over the shoulder.',
        'A common intramuscular injection site; its axillary nerve can be damaged in shoulder dislocation or surgical-neck fracture, weakening abduction.') },
      tuckGeo(sheet(F, th, { out: (P) => lout(UA)(0, P), ten: (u) => H.smoothstep(0.9, 1.0, u), amp: 0.0013, seed: 5, ks: 22 }), humAnchor, 0.003, 0.002));
  }

  // ============================================================ RECTUS ABDOMINIS (both straps, midline part) + LINEA ALBA
  {
    const ys = []; for (let y = 0.915; y <= 1.2451; y += 0.006) ys.push(y);
    const INT = [1.05, 1.125, 1.19];   // tendinous intersections: umbilicus, midway, near xiphoid
    const xm = (y) => 0.0035 + 0.0055 * H.smoothstep(0.98, 1.1, y), xl = pf([[0.915, 0.032], [1.0, 0.058], [1.1, 0.076], [1.245, 0.09]]);
    const nf = 8, F = [];
    for (let i = 0; i < nf; i++) { const w = i / (nf - 1); F.push(ys.map(y0 => { const y = y0 + 0.04 * w * H.smoothstep(1.19, 1.245, y0); const x = H.lerp(xm(y), xl(y), w); return TX(x, y, 0.0145); })); }
    const near = (y, s) => Math.max(...INT.map(c => Math.exp(-Math.pow((y - c) / s, 2))));
    const th = (u, w, P) => (0.0032 + 0.0018 * (1 - near(P.y, 0.013)) * H.smoothstep(0.99, 1.03, P.y)) * (0.45 + 0.55 * edge(w, 0.35));
    const strap = sheet(F, th, { ten: (u, w, P) => Math.max(near(P.y, 0.0035), 1 - H.smoothstep(0.918, 0.93, P.y)), amp: 0.0005, seed: 7, ks: 10 });
    add({ id: 'rectus-abdominis', name: 'Rectus abdominis', latin: 'Musculus rectus abdominis', layer: SUP, depth: 0.1, region: 'body', mid: true, tags: ['abdominal wall'],
      info: I('Paired vertical strap muscles either side of the linea alba, running from the pubic crest and symphysis up to the xiphoid process and costal cartilages 5–7. Three tendinous intersections divide each strap into the segments of the "six-pack".',
        'Flexes the lumbar spine (sit-up), tenses the abdominal wall and raises intra-abdominal pressure.',
        'About 30 cm long; each strap ~8 cm wide above, ~3 cm at the pubis, ~1 cm thick.',
        'Rectus diastasis (separation at the linea alba) is common after pregnancy; the anterior rectus sheath is omitted here to show the muscle.') },
      merge([strap, H.mirrorX(strap)]));
    const la = []; for (let i = 0; i < 3; i++) { const w = i / 2; la.push(ys.map(y => TX((w - 0.5) * 2 * (xm(y) + 0.0012), y, 0.0132))); }
    const ringPts = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * PI; ringPts.push(TX(0.0055 * Math.cos(a), 1.05 + 0.0055 * Math.sin(a), 0.0125)); }
    add({ id: 'linea-alba', name: 'Linea alba', latin: 'Linea alba', layer: SUP, depth: 0.05, region: 'body', mid: true, color: H.COLORS.tendon, tags: ['abdominal wall', 'aponeurosis'],
      info: I('Tendinous midline seam from the xiphoid process to the pubic symphysis where the aponeuroses of the three flat abdominal muscles interlace; the umbilical ring lies in it.',
        'Anchors the abdominal aponeuroses so the left and right muscles pull against each other.',
        'About 1–2 cm wide above the umbilicus, only a few mm below it; ~31 cm long.',
        'Being nearly bloodless it is the classic route of midline laparotomy; defects in it cause epigastric and umbilical hernias.') },
      merge([sheet(la, 0.0008, { amp: 0 }), sweep(ringPts, 0.0018, 0.0012, { closed: true, up: [0, 0, 1], radial: 8, amp: 0 })]));
  }

  // ============================================================ HEAD & FACE
  const HC = v([0, 1.66, (L.head.frontZ + L.head.backZ) / 2]), HR = [L.head.sideX, L.y.crown - 1.66, (L.head.frontZ - L.head.backZ) / 2];
  function onHead(p, inset) { const d = v(p).sub(HC), k = 1 / Math.sqrt((d.x / HR[0]) ** 2 + (d.y / HR[1]) ** 2 + (d.z / HR[2]) ** 2), s = HC.clone().addScaledVector(d, k); const n = new V3((s.x - HC.x) / HR[0] ** 2, (s.y - HC.y) / HR[1] ** 2, (s.z - HC.z) / HR[2] ** 2).normalize(); return s.addScaledVector(n, -inset); }
  const headOut = (P) => P.clone().sub(HC).normalize();
  const headFront = (x, y, inset) => onHead([x, y, HC.z + HR[2] * Math.sqrt(Math.max(0.02, 1 - (x / HR[0]) ** 2 - ((y - HC.y) / HR[1]) ** 2))], inset);
  // replica of the face skin's front surface z(x, y) (integumentary: head cross-sections built from L.head + facial relief + orbital recess);
  // facial muscles are placed a given NORMAL distance under it and finally squashed along -Z so they stay >= 3 mm inside it
  const FHC = L.head.center, yEqF = FHC[1], czF = FHC[2], HtF = L.y.crown - yEqF, WeqF = L.head.width / 2, FeqF = L.head.frontZ - czF;
  const LOWF = [[yEqF, WeqF, L.head.frontZ, 2.6], [1.640, 0.0768, 0.0925, 2.55], [1.625, 0.0752, 0.0915, 2.4], [1.610, 0.0728, 0.0940, 2.2], [1.595, 0.0698, 0.0975, 2.0], [1.580, 0.0664, 0.0990, 1.85],
    [1.565, 0.0625, 0.0970, 1.8], [1.550, 0.0565, 0.0955, 1.8], [1.535, 0.0500, 0.0920, 1.8], [1.520, 0.0380, 0.0860, 1.8], [1.505, 0.0220, 0.0760, 1.8]];
  const cmr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  function faceSec(y) {   // [half width, midline front z, front superellipse exponent]
    if (y >= yEqF) { const w = H.clamp((y - yEqF) / HtF, 0, 1), k = (m) => Math.pow(Math.max(0, 1 - Math.pow(w, m)), 1 / m); return [WeqF * k(2.3), czF + FeqF * k(2.9), 2.6]; }
    const n = LOWF.length; let i = 0; while (i < n - 2 && y < LOWF[i + 1][0]) i++;
    const t = H.clamp((y - LOWF[i][0]) / (LOWF[i + 1][0] - LOWF[i][0]), 0, 1), a = LOWF[Math.max(0, i - 1)], b = LOWF[i], c = LOWF[i + 1], d = LOWF[Math.min(n - 1, i + 2)];
    return [1, 2, 3].map(j => cmr(a[j], b[j], c[j], d[j], t));
  }
  const G2 = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));
  const smin = (a, b, k) => { const h = H.clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
  function faceZ(x, y) {
    const [W, zf, nF] = faceSec(y), ax = Math.abs(x), rr = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, ax / W), nF)), 1 / nF), fw = H.smoothstep(0.02, 0.4, Math.pow(rr, nF / 2));
    let dz = 0.0042 * G2(ax - 0.027, y - (L.y.brow + 0.0005), 0.019, 0.0062) + 0.002 * G2(x, y - 1.669, 0.011, 0.009) - 0.0035 * G2(x, y - 1.647, 0.01, 0.007)
      + 0.005 * G2(ax - 0.05, y - 1.614, 0.013, 0.011) - 0.0028 * G2(ax - 0.044, y - 1.587, 0.011, 0.012) - 0.0022 * G2(x, y - L.head.mouth[1], 0.023, 0.0022)
      + 0.0012 * G2(x, y - 1.578, 0.018, 0.006) - 0.0008 * G2(x, y - 1.58, 0.0022, 0.0045) - 0.003 * G2(x, y - 1.5445, 0.019, 0.0042) + 0.0055 * G2(x, y - (L.head.chin[1] + 0.005), 0.015, 0.0095);
    const sd = (ax - 0.019) * 0.952 + (y - 1.594) * 0.307, tl = ((ax - 0.019) * 0.307 - (y - 1.594) * 0.952) / 0.0326;
    dz += G2(tl - 0.5, 0, 0.62, 1) * (-0.0012 * G2(sd, 0, 0.0018, 1) + 0.0016 * G2(sd - 0.0055, 0, 0.0045, 1));   // nasolabial fold
    let z = czF + (zf - czF) * rr + dz * fw;
    const E = L.head.eyeL, ex = ax - E[0], ey = y - E[1];
    if (fw > 0 && ex * ex + ey * ey < 0.0016) { const r = Math.hypot(ex / 1.1, ey * (ey < 0 ? 1.3 : 1)); z = H.lerp(z, smin(z, E[2] - 0.0075 + 0.045 * H.smoothstep(0.0092, 0.03, r), 0.004), fw); }   // orbital recess
    return z;
  }
  const fGrad = (x, y) => { const e = 0.0008; return [(faceZ(x + e, y) - faceZ(x - e, y)) / (2 * e), (faceZ(x, y + e) - faceZ(x, y - e)) / (2 * e)]; };
  const faceOut = (t, P) => { const g = fGrad(P.x, P.y); return new V3(-g[0], -g[1], 1).normalize(); };
  const FP = (x, y, inset) => { const g = fGrad(x, y); return new V3(x, y, faceZ(x, y) - inset * Math.sqrt(1 + g[0] * g[0] + g[1] * g[1])); };
  // squash a finished face-muscle geometry along -Z so every vertex ends >= m (normal distance) under the face skin
  function tuckFace(q, m, w) {
    const p = q.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), g = fGrad(x, y), lim = faceZ(x, y) - m * Math.sqrt(1 + g[0] * g[0] + g[1] * g[1]);
      if (z > lim - w) p.setZ(i, lim - w + w * Math.tanh((z - lim + w) / w));
    }
    p.needsUpdate = true; q.computeVertexNormals(); return q;
  }
  {
    const F = []; for (let i = 0; i < 9; i++) { const x = H.lerp(0.006, 0.056, i / 8); const F1 = []; for (let j = 0; j < 16; j++) { const y = H.lerp(1.662 + 0.006 * (i / 8), 1.738, j / 15); F1.push(headFront(x, y, 0.0055)); } F.push(F1); }
    add({ id: 'frontalis', name: 'frontalis', latin: 'Venter frontalis musculi occipitofrontalis', layer: SUP, depth: 0.05, region: 'head', tags: ['face'],
      info: I('Frontal belly of the occipitofrontalis: a thin quadrilateral sheet over the forehead that arises from the galea aponeurotica (epicranial aponeurosis) and inserts into the skin of the eyebrow, blending with orbicularis oculi. It has no bony attachment.',
        'Raises the eyebrows and wrinkles the forehead horizontally.', 'About 6 cm tall and 5 cm wide per side, 1–2 mm thick.',
        'Supplied by the temporal branch of the facial nerve: in Bell\'s palsy the forehead cannot be wrinkled on that side, whereas it is spared in a stroke.') },
      sheet(F, (u, w) => 0.0014 * (0.4 + 0.6 * edge(w)) * (1 - 0.5 * H.smoothstep(0.7, 1, u)), { out: headOut, ten: (u) => H.smoothstep(0.62, 0.8, u), amp: 0.0004, ks: 14 }));
    const ring = (cx, cy, rx, ry, zf, n) => { const pts = []; for (let k = 0; k < n; k++) { const a = k / n * 2 * PI; pts.push(zf(cx + rx * Math.cos(a), cy + ry * Math.sin(a))); } return pts; };
    const E = L.head.eyeL;
    add({ id: 'orbicularis-oculi', name: 'orbicularis oculi', latin: 'Musculus orbicularis oculi', layer: SUP, depth: 0.05, region: 'head', tags: ['face', 'eye'],
      info: I('Concentric sphincter around the eye: an orbital part lying on the bony orbital margin and a thin palpebral part within the eyelids, anchored medially to the medial palpebral ligament and lacrimal bone.',
        'Closes the eyelids — gently in blinking (palpebral part) or tightly when squeezing the eyes shut (orbital part) — and helps pump tears into the lacrimal sac.',
        'Ring about 5 cm across and ~1 cm wide, 1–2 mm thick.', 'Facial nerve palsy prevents eye closure and risks corneal drying; "crow\'s feet" wrinkles run at right angles to its lateral fibres.') },
      tuckFace(sweep(ring(E[0], E[1] + 0.001, 0.0205, 0.0165, (x, y) => FP(x, y, 0.0042), 22), 0.0074, 0.0013, { closed: true, up: faceOut, radial: 10, amp: 0.0003, ks: 5 }), 0.003, 0.002));
    add({ id: 'orbicularis-oris', name: 'Orbicularis oris', latin: 'Musculus orbicularis oris', layer: SUP, depth: 0.05, region: 'head', mid: true, tags: ['face', 'mouth'],
      info: I('Sphincter of the mouth made of fibres encircling the lips; many are continuations of buccinator and the other lip muscles converging at the modioli, with small incisive slips to the maxilla and mandible.',
        'Closes, purses and protrudes the lips (whistling, kissing) and keeps food in the mouth while chewing.', 'Ring about 6 cm wide and 3.5 cm tall around the oral fissure.',
        'Its fibres must be re-joined precisely in cleft-lip repair for normal lip movement and speech.') },
      // narrower under the nose (t = 0.25 is the top of the ring) so its upper edge stops at the base of the nose skin
      tuckFace(sweep(ring(0, L.head.mouth[1] + 0.001, 0.027, 0.0155, (x, y) => FP(x, y, 0.005), 26), (t) => 0.0082 * (1 - 0.45 * Math.exp(-(((t - 0.25) / 0.07) ** 2))), 0.002, { closed: true, up: faceOut, radial: 10, amp: 0.0003, ks: 6 }), 0.003, 0.002));
    add({ id: 'zygomaticus-major', name: 'zygomaticus major', latin: 'Musculus zygomaticus major', layer: SUP, depth: 0.1, region: 'head', tags: ['face'],
      info: I('Slender strap from the lateral surface of the zygomatic bone running down and forwards to the modiolus at the corner of the mouth.', 'Draws the angle of the mouth upwards and outwards — the principal smiling muscle.',
        'About 6 cm long and 1 cm wide.', 'A bifid zygomaticus major is thought to cause cheek dimples; a genuine (Duchenne) smile combines it with orbicularis oculi.') },
      tuckFace(sweep([FP(0.059, 1.614, 0.0048), FP(0.047, 1.59, 0.0048), FP(0.029, 1.564, 0.0048)], pf([[0, 0.004], [0.4, 0.005], [1, 0.0035]]), 0.0017, { up: faceOut, radial: 10, tA: 0.1 }), 0.003, 0.002));
    add({ id: 'masseter', name: 'masseter', latin: 'Musculus masseter', layer: SUP, depth: 0.1, region: 'head', tags: ['face', 'jaw'],
      info: I('Thick quadrilateral muscle on the side of the jaw, running from the lower border of the zygomatic arch to the lateral surface of the ramus and angle of the mandible.',
        'Elevates the mandible, closing the jaw with great force; its superficial part also helps protrude it.', 'About 5 cm tall, 3 cm wide and up to 1.5 cm thick.',
        'Enlarges with habitual clenching or bruxism (masseteric hypertrophy), which is sometimes treated with botulinum toxin.') },
      sweep([[0.058, 1.613, 0.024], [0.059, 1.59, 0.017], [0.054, 1.564, 0.012]], pf([[0, 0.012], [0.5, 0.016], [1, 0.013]]), pf([[0, 0.003], [0.45, 0.0055], [1, 0.003]]), { up: [1, 0, 0.25], radial: 14, tA: 0.12, amp: 0.0009, ks: 12 }));
    const TF = [], nfT = 12;
    for (let i = 0; i < nfT; i++) { const s = i / (nfT - 1), a = PI * (0.1 + 0.85 * s), O = onHead([0.07, 1.645 + 0.05 * Math.sin(a), 0.008 + 0.058 * Math.cos(a)], 0.0075);
      const arch = v([0.056, 1.614, H.lerp(0.03, 0.006, s)]); TF.push(fibC([O, onHead(O.clone().lerp(arch, 0.45), 0.0085), arch, [0.049, 1.593, H.lerp(0.03, 0.022, s)]], 16)); }
    add({ id: 'temporalis', name: 'temporalis', latin: 'Musculus temporalis', layer: SUP, depth: 0.15, region: 'head', tags: ['face', 'jaw'],
      info: I('Fan-shaped muscle filling the temporal fossa on the side of the skull. Its fibres converge deep to the zygomatic arch onto a strong tendon inserting on the coronoid process and anterior border of the mandibular ramus.',
        'Elevates the mandible (closes the jaw); its horizontal posterior fibres retract the jaw.', 'Fan about 10 cm across, up to 1.5 cm thick near the arch.',
        'Tension-type headache is often felt over it; it can be felt hardening at the temple when the teeth are clenched.') },
      sheet(TF, (u, w) => pf([[0, 0.0022], [0.5, 0.0038], [0.85, 0.004], [1, 0.0022]])(u) * (0.45 + 0.55 * edge(w)), { out: headOut, ten: (u) => H.smoothstep(0.72, 0.9, u), amp: 0.0008, ks: 16, seed: 4 }));
    add({ id: 'buccinator', name: 'buccinator', latin: 'Musculus buccinator', layer: DEEP, depth: 0.1, region: 'head', tags: ['face', 'mouth'],
      info: I('Thin quadrilateral muscle forming the wall of the cheek, from the alveolar processes of the maxilla and mandible opposite the molars and the pterygomandibular raphe, running forwards into the modiolus and orbicularis oris.',
        'Presses the cheek against the teeth to keep food between the molars and expels air from the mouth (blowing, playing a trumpet).', 'About 5 cm long, 2–3 cm tall, 2–3 mm thick.',
        'Pierced by the parotid duct opposite the upper second molar; although named after the trumpeter, it is supplied by the facial nerve.') },
      sweep([[0.046, 1.568, 0.028], [0.041, 1.566, 0.052], [0.026, 1.565, 0.075]], pf([[0, 0.011], [0.6, 0.01], [1, 0.006]]), 0.0017, { up: [1, 0, 0.35], radial: 10, amp: 0.0004 }));
  }

  // ============================================================ NECK
  {
    const PF = []; for (let i = 0; i < 10; i++) { const s = i / 9, top = v([0.012, 1.52, 0.05]).lerp(v([0.05, 1.556, 0.014]), s), x = H.lerp(0.03, 0.155, s), y = H.lerp(1.392, 1.402, s);
      PF.push(fib(top.toArray(), [phiX(x, y, 1), y], 20, 0.0088, { bA: 0.35 })); }
    add({ id: 'platysma', name: 'platysma', latin: 'Platysma', layer: SUP, depth: 0.0, region: 'body', tags: ['neck', 'face'],
      info: I('Very thin broad muscle sheet in the superficial fascia of the neck, running from the fascia over the upper pectoralis major and deltoid, across the clavicle, up to the lower border of the mandible and the skin of the lower face.',
        'Tenses the skin of the neck and pulls the corners of the mouth and the lower lip downwards (grimace of horror or strain).', 'About 15 cm long and under 2 mm thick.',
        'With age its medial edges separate into visible vertical "platysmal bands"; it is closed as a separate layer when suturing neck incisions.') },
      sheet(PF, (u, w) => 0.0007 * (0.45 + 0.55 * edge(w)), { amp: 0.0003, ks: 20 }));
    const scmS = [[0.062, 1.603, -0.03], [0.0505, 1.565, -0.013], [0.043, 1.525, 0.006], [0.035, 1.49, 0.027], [0.024, 1.456, 0.052], CLM.clone().add(new V3(0.003, 0.009, 0.005))];
    const scmC = [[0.035, 1.49, 0.027], [0.043, 1.462, 0.04], clav(0.21).add(new V3(0, 0.006, 0.005))];
    add({ id: 'sternocleidomastoid', name: 'sternocleidomastoid', latin: 'Musculus sternocleidomastoideus', layer: SUP, depth: 0.1, region: 'body', tags: ['neck'],
      info: I('Strap muscle crossing the side of the neck obliquely, from the mastoid process and superior nuchal line down to two heads: a rounded tendinous sternal head on the manubrium and a flat fleshy clavicular head on the medial third of the clavicle.',
        'Acting alone it turns the face to the opposite side and tilts the head to the same side; both together flex the neck and help lift the thorax in forced inspiration.', 'About 16 cm long and 3–4 cm wide at mid-neck.',
        'Fibrosis of it in infancy causes congenital torticollis (wry neck); it divides the neck into the anterior and posterior triangles.') },
      merge([sweep(scmS, pf([[0, 0.011], [0.4, 0.013], [0.8, 0.007], [1, 0.004]]), pf([[0, 0.004], [0.35, 0.0055], [1, 0.0035]]), { radial: 14, tA: 0.07, tB: 0.14, amp: 0.001, ks: 11 }),
        sweep(scmC, pf([[0, 0.004], [0.5, 0.008], [1, 0.009]]), 0.003, { radial: 12, tB: 0.08, amp: 0.0007 })]));
    const scal = [
      ['scalenus-anterior', 'scalenus anterior', 'Musculus scalenus anterior', [[0.022, 1.535, -0.004], [0.03, 1.49, 0.004], T(0.75, 1.444, -0.004, cageEnv)], 0.0045, 0.3,
        I('Lies deep to sternocleidomastoid, running from the anterior tubercles of the C3–C6 transverse processes to the scalene tubercle on the inner border of the first rib.', 'Elevates the first rib in forced inspiration and flexes and bends the neck to its side.', 'About 6 cm long and 1 cm wide.', 'The phrenic nerve descends on its front; the subclavian artery and brachial plexus pass behind it, between it and scalenus medius — a narrow gap here causes thoracic outlet syndrome.')],
      ['scalenus-medius', 'scalenus medius', 'Musculus scalenus medius', [[0.026, 1.56, -0.022], [0.038, 1.5, -0.013], T(0.3, 1.447, -0.004, cageEnv)], 0.0055, 0.32,
        I('The largest scalene, from the posterior tubercles of the C2–C7 transverse processes to the upper surface of the first rib behind the groove for the subclavian artery.', 'Elevates the first rib and bends the neck to its own side.', 'About 8 cm long.', 'The dorsal scapular nerve and roots of the long thoracic nerve pierce it.')],
      ['scalenus-posterior', 'scalenus posterior', 'Musculus scalenus posterior', [[0.03, 1.525, -0.032], [0.046, 1.48, -0.03], T(-0.25, 1.42, -0.005, cageEnv)], 0.0045, 0.34,
        I('The smallest and deepest scalene, from the posterior tubercles of the C4–C6 transverse processes to the outer surface of the second rib.', 'Elevates the second rib and bends the neck to its side.', 'About 6 cm long.', 'Often fused with scalenus medius; it is the only scalene to reach the second rib.')]];
    for (const [id, name, latin, pts, w, dep, info] of scal) add({ id, name, latin, layer: DEEP, depth: dep, region: 'neck', tags: ['neck', 'scalene'], info }, sweep(pts, pf([[0, w * 0.6], [0.5, w], [1, w * 0.8]]), w * 0.8, { radial: 10, tA: 0.1, tB: 0.1, amp: 0.0005 }));
    add({ id: 'longus-colli', name: 'longus colli', latin: 'Musculus longus colli', layer: DEEP, depth: 0.5, region: 'body', tags: ['neck', 'prevertebral'],
      info: I('Deep prevertebral muscle lying on the front of the vertebral bodies from the atlas (C1) down to T3, made of vertical, superior oblique and inferior oblique parts.', 'Flexes the cervical spine and resists hyperextension.', 'About 15 cm long, ~1 cm wide and thin.',
        'Strained in whiplash injury; calcific tendinitis of longus colli causes sudden painful neck stiffness and pain on swallowing.') },
      sweep([[0.009, 1.405, -0.047], [0.012, 1.455, -0.029], [0.013, 1.5, -0.013], [0.01, 1.55, -0.003], [0.006, 1.586, 0.004]], pf([[0, 0.003], [0.35, 0.0055], [1, 0.0025]]), 0.0024, { up: [0, 0, 1], radial: 10, tA: 0.08, tB: 0.08, amp: 0.0004 }));
    add({ id: 'levator-scapulae', name: 'levator scapulae', latin: 'Musculus levator scapulae', layer: DEEP, depth: 0.2, region: 'body', tags: ['neck', 'shoulder'],
      info: I('Strap muscle from the transverse processes of C1–C4 descending along the side and back of the neck to the superior angle and upper medial border of the scapula.', 'Elevates the scapula and rotates it so the glenoid tilts downwards; bends the neck to its side.',
        'About 15 cm long and 2 cm wide.', 'A frequent source of "stiff neck" and trigger-point pain at the angle between neck and shoulder.') },
      sweep([[0.03, 1.568, -0.022], [0.034, 1.52, -0.03], [0.044, 1.475, -0.044], [0.07, 1.438, -0.078]], pf([[0, 0.0045], [0.5, 0.0075], [1, 0.009]]), 0.0038, { radial: 10, tA: 0.1, amp: 0.0005 }));
  }

  // ============================================================ BACK: trapezius, latissimus dorsi, rhomboids, erector spinae
  const tip = (n) => L.spinousTip(n);
  {
    const nf = 22, M = 26, F = [], yC7 = tip('C7').y, yT12 = tip('T12').y;
    const spn = new THREE.CatmullRomCurve3([v([0.188, 1.432, -0.05]), v([0.14, 1.415, -0.075]), v([0.072, 1.393, -0.098])]);
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o, ins;
      if (s < 0.08) o = v([0.034, 1.607, -0.073]).lerp(v([0.004, 1.615, -0.084]), s / 0.08).toArray();
      else { const y = s < 0.3 ? H.lerp(1.598, yC7, (s - 0.08) / 0.22) : H.lerp(yC7, yT12, (s - 0.3) / 0.7); o = [phiX(0.004, y, -1), y]; }
      if (s < 0.3) ins = clav(H.lerp(0.64, 0.97, s / 0.3)).add(new V3(0, 0.007, -0.004));
      else if (s < 0.42) ins = v([0.197, 1.438, -0.022]).lerp(v([0.19, 1.435, -0.045]), (s - 0.3) / 0.12);
      else ins = spn.getPointAt(H.clamp((s - 0.42) / 0.5, 0, 1));
      const k = H.smoothstep(0.08, 0.34, s);
      F.push(fib(o, ins.toArray(), M, 0.011, { bA: 0.22, bB: 0.28, ey: u => H.lerp(1 - (1 - u) * (1 - u), u, k), ep: u => H.lerp(u * u, u, k) }));
    }
    const dia = (s) => Math.exp(-Math.pow((s - 0.3) / 0.1, 2));
    // lateral insertion (clavicle, acromion, scapular spine) tucked under the low shoulder skin, pulled down and in
    const trapIn = (P) => P.x > 0.12 && P.y < 1.47, trapA = (P) => new V3(P.x * 0.85, P.y - 0.03, P.z * 0.6);
    for (const f of F) for (const P of f) if (trapIn(P)) tuckPt(P, trapA(P), 0.0065, 0.005);
    add({ id: 'trapezius', name: 'trapezius', latin: 'Musculus trapezius', layer: SUP, depth: 0.0, region: 'body', tags: ['back', 'neck', 'shoulder'],
      info: I('Large flat kite-shaped muscle of the upper back and neck (the pair together forms a trapezium). It arises from the external occipital protuberance and superior nuchal line, the ligamentum nuchae and the spinous processes of C7–T12, and inserts on the lateral third of the clavicle, the acromion and the spine of the scapula.',
        'Upper fibres elevate the shoulder (shrug) and extend the neck, middle fibres retract the scapula, lower fibres depress it; upper and lower parts together rotate the glenoid upwards for overhead reaching.',
        'About 45 cm tall along the spine, up to ~1 cm thick in the neck.', 'Supplied by the accessory nerve (CN XI), which can be injured in surgery of the posterior triangle of the neck, leaving a drooping shoulder; note the tendinous "diamond" at the neck–back junction.') },
      tuckGeo(sheet(F, (u, w) => 0.0024 * pf([[0, 0.45], [0.2, 1], [0.8, 0.85], [1, 0.4]])(u) * (0.35 + 0.65 * edge(w)) * (1 - 0.35 * H.smoothstep(0.5, 1, w)), { ten: (u, w) => Math.max(1 - H.smoothstep(0.0, 0.025, u), dia(w) * (1 - H.smoothstep(0.06, 0.16, u)), H.smoothstep(0.85, 0.95, w) * H.smoothstep(0.82, 0.95, u)), amp: 0.001, ks: 30, seed: 11 }), trapA, 0.003, 0.002, trapIn));
  }
  {
    const nf = 20, M = 26, F = [];
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o;
      if (s < 0.55) { const y = H.lerp(tip('T7').y, 0.96, s / 0.55); o = [phiX(0.005, y, -1), y]; }
      else { const k = (s - 0.55) / 0.45, x = H.lerp(0.04, 0.115, k), y = H.lerp(0.985, 1.062, Math.sqrt(k)); o = [phiX(x, y, -1), y]; }
      F.push(fib(o, lp(UA, H.lerp(0.09, 0.19, s), -25, 0.014).toArray(), M, 0.0135, { bB: 0.3, ey: u => Math.pow(u, 1.3) }));
    }
    add({ id: 'latissimus-dorsi', name: 'latissimus dorsi', latin: 'Musculus latissimus dorsi', layer: SUP, depth: 0.1, region: 'body', tags: ['back', 'shoulder'],
      info: I('The broadest muscle of the back: a thin triangular sheet arising via the thoracolumbar fascia from the spinous processes of T7–L5 and the sacrum, the posterior iliac crest and the lower ribs. It sweeps up round the side of the chest, forming the posterior axillary fold, to a flat tendon in the floor of the intertubercular groove of the humerus.',
        'Extends, adducts and medially rotates the arm; pulls the trunk up towards the arms in climbing and helps in forced expiration and coughing.', 'Up to ~40 cm across, 2–5 mm thick; tendon about 3 cm wide.',
        'A workhorse flap for breast reconstruction; supplied by the thoracodorsal nerve.') },
      sheet(F, (u, w) => pf([[0, 0.0008], [0.35, 0.0016], [0.75, 0.003], [0.92, 0.0034], [1, 0.0016]])(u) * (0.4 + 0.6 * edge(w)), { ten: (u, w) => Math.max(1 - H.smoothstep(0.05 + 0.3 * H.smoothstep(0.25, 1, w), 0.15 + 0.3 * H.smoothstep(0.25, 1, w), u), H.smoothstep(0.93, 0.99, u)), amp: 0.0006, ks: 26, seed: 13 }));
  }
  {
    const rh = (y0, y1, b0, b1, x0, x1, nf) => { const F = []; for (let i = 0; i < nf; i++) { const s = i / (nf - 1), yo = H.lerp(y0, y1, s), yi = H.lerp(b0, b1, s), xi = H.lerp(x0, x1, s); F.push(fib([phiX(0.005, yo, -1), yo], [phiX(xi, yi, -1), yi], 12, (u) => H.lerp(0.0165, 0.018, u))); } return F; };
    const thr = (u, w) => 0.0026 * (0.4 + 0.6 * edge(w)) * (0.6 + 0.4 * edge(u, 0.3));
    add({ id: 'rhomboid-minor', name: 'rhomboid minor', latin: 'Musculus rhomboideus minor', layer: DEEP, depth: 0.1, region: 'thorax', tags: ['back', 'scapula'],
      info: I('Small band above rhomboid major, from the lower ligamentum nuchae and the spinous processes of C7 and T1 to the medial border of the scapula at the root of its spine.', 'Retracts and elevates the scapula together with rhomboid major.', 'About 2 cm wide and 8 cm long.', 'Often fused with rhomboid major; both are supplied by the dorsal scapular nerve (C5).') },
      sheet(rh(tip('C7').y, tip('T1').y, 1.412, 1.398, 0.058, 0.06, 4), thr, { ten: (u) => 1 - H.smoothstep(0.02, 0.1, u), amp: 0.0005 }));
    add({ id: 'rhomboid-major', name: 'rhomboid major', latin: 'Musculus rhomboideus major', layer: DEEP, depth: 0.1, region: 'thorax', tags: ['back', 'scapula'],
      info: I('Parallelogram-shaped sheet deep to trapezius, from the spinous processes of T2–T5 running down and laterally to the medial border of the scapula between the root of the spine and the inferior angle.', 'Retracts (braces back) the scapula, rotates the glenoid downwards and holds the scapula against the chest wall.', 'About 10 cm long, 5–6 cm wide, a few mm thick.', 'Weakness (dorsal scapular nerve injury) lets the medial border of the scapula drift away from the ribs.') },
      sheet(rh(tip('T2').y, tip('T5').y, 1.392, 1.278, 0.061, 0.085, 8), thr, { ten: (u) => 1 - H.smoothstep(0.02, 0.1, u), amp: 0.0006 }));
  }
  {
    const col = (xf, y0, y1, thf, extra) => { const pts = []; for (let y = y0; y <= y1 + 1e-6; y += 0.035) pts.push(TX(xf(y), y, 0.0155 + 1.2 * thf(y), -1)); return extra ? pts.concat(extra) : pts; };
    const es = [
      ['iliocostalis', 'iliocostalis', 'Musculus iliocostalis', pf([[0.97, 0.052], [1.1, 0.058], [1.25, 0.07], [1.36, 0.066], [1.48, 0.042]]), 0.97, 1.49, pf([[0.97, 0.006], [1.05, 0.009], [1.15, 0.006], [1.35, 0.004], [1.49, 0.003]]), pf([[0.97, 0.012], [1.1, 0.012], [1.25, 0.01], [1.49, 0.005]]), null,
        I('Lateral column of the erector spinae, rising from the sacrum and iliac crest (common erector tendon) along the angles of the ribs to the transverse processes of C4–C6 (lumborum, thoracis and cervicis parts).', 'Extends the spine and bends it to its own side; the lumbar part helps depress the lower ribs.', 'About 60 cm long; up to 3 cm wide in the loin.', 'Spasm of the lumbar erector spinae is the usual cause of acute "lumbago".')],
      ['longissimus', 'longissimus', 'Musculus longissimus', pf([[0.93, 0.03], [1.1, 0.033], [1.3, 0.036], [1.45, 0.032], [1.55, 0.03]]), 0.93, 1.545, pf([[0.93, 0.006], [1.05, 0.011], [1.15, 0.007], [1.35, 0.0045], [1.55, 0.0035]]), pf([[0.93, 0.01], [1.1, 0.013], [1.3, 0.009], [1.55, 0.005], [1.6, 0.004]]), [[0.05, 1.58, -0.038], [0.058, 1.598, -0.036]],
        I('Intermediate and longest column of the erector spinae, from the sacrum and lumbar transverse processes up via the thoracic and cervical transverse processes to the mastoid process (longissimus capitis).', 'Extends the vertebral column and head; acting on one side it bends them to that side and turns the head to that side.', 'About 70 cm long.', 'It forms most of the rounded paraspinal bulge either side of the lumbar spine.')],
      ['spinalis', 'spinalis', 'Musculus spinalis', () => 0.0125, 1.14, 1.5, () => 0.0035, pf([[1.14, 0.003], [1.25, 0.005], [1.4, 0.0045], [1.5, 0.003]]), null,
        I('Medial and smallest column of the erector spinae, running between spinous processes from the upper lumbar to the upper thoracic and lower cervical spine.', 'Extends the thoracic and cervical spine.', 'About 30 cm long and ~1 cm wide.', 'Lies against the spinous processes, where the paraspinal muscles are stripped in posterior spinal surgery.')]];
    for (const [id, name, latin, xf, y0, y1, thf, wf, extra, info] of es) {
      const pts = col(xf, y0, y1, thf, extra), n = pts.length, ys = pts.map(p => p.y);
      const yAt = (t) => { const f = t * (n - 1), i = Math.min(n - 2, Math.floor(f)); return H.lerp(ys[i], ys[i + 1], f - i); };
      add({ id, name, latin, layer: DEEP, depth: 0.2, region: 'body', tags: ['back', 'erector spinae'], info }, sweep(pts, (t) => wf(yAt(t)) * (0.4 + 0.6 * H.smoothstep(0, 0.12, t)), (t) => thf(yAt(t)) * (0.5 + 0.5 * H.smoothstep(0, 0.1, t)), { up: (t, P) => trunkOut(P), radial: 12, tA: id === 'spinalis' ? 0.06 : 0.12, tB: 0.05, amp: 0.0009, ks: 10, step: 0.012 }));
    }
  }

  // ============================================================ CHEST & ABDOMINAL WALL
  // rib course model: rib k leaves its vertebra at T_k height and descends anteriorly by drop[k] until its front end (polar angle end[k])
  const RIB = { drop: [0.03, 0.06, 0.07, 0.075, 0.075, 0.08, 0.08, 0.09, 0.095, 0.1, 0.085, 0.08], end: [1.35, 1.38, 1.4, 1.42, 1.42, 1.4, 1.36, 1.2, 1.0, 0.8, 0.3, -0.2] };
  const ribY = (k, phi) => L.spine['T' + k].y - RIB.drop[k - 1] * Math.pow(H.clamp((phi + PI / 2) / (RIB.end[k - 1] + PI / 2), 0, 1), 1.3);
  const rectXL = pf([[0.915, 0.032], [1.0, 0.058], [1.1, 0.076], [1.245, 0.09]]);
  {
    const phS = [0.3, 0.45, 0.55, 0.62, 0.66, 0.68, 0.66, 0.6], ins = [[0.068, 1.432], [0.064, 1.405], [0.062, 1.385], [0.07, 1.345], [0.08, 1.305], [0.086, 1.288], [0.09, 1.278], [0.092, 1.272]], list = [];
    for (let k = 1; k <= 8; k++) {
      const yi = ins[k - 1][1], pts = fib([phS[k - 1], ribY(k, phS[k - 1]) - 0.004], [phiX(ins[k - 1][0], yi, -1, cageEnv), yi], 12, (u) => H.lerp(-0.0035, -0.0005, H.smoothstep(0.55, 1, u)), { env: cageEnv });
      const w0 = k < 3 ? 0.008 : k < 5 ? 0.009 : 0.011;
      list.push(sweep(pts, pf([[0, w0 * 0.7], [0.25, w0], [1, w0 * 0.55]]), pf([[0, 0.0012], [0.3, 0.0022], [1, 0.0016]]), { radial: 10, tA: 0.07, amp: 0.0004, seed: 20 + k, step: 0.012 }));
    }
    add({ id: 'serratus-anterior', name: 'serratus anterior', latin: 'Musculus serratus anterior', layer: SUP, depth: 0.2, region: 'thorax', tags: ['chest', 'scapula'],
      info: I('Broad sheet on the side of the chest whose saw-toothed digitations arise from the outer surfaces of ribs 1–8; it wraps backwards around the chest wall, deep to the scapula, to the costal surface of its medial border, most fibres converging on the inferior angle.',
        'Protracts the scapula (punching, pushing) and rotates it upwards so the arm can be raised above the head; holds the scapula flat against the ribs.', 'About 15 cm tall; each digitation 1–2 cm wide.',
        'Injury to its long thoracic nerve (for example during axillary surgery) produces a "winged scapula" when pushing against a wall.') }, merge(list));
    const F = []; for (let i = 0; i < 7; i++) { const s = i / 6, k = 3 + 2 * s, ph = H.lerp(1.1, 1.15, s), y = H.lerp(ribY(3, ph), ribY(5, ph), s);
      F.push(fib([ph, y], [0.155, H.lerp(1.401, 1.409, s), 0.03], 14, 0.025, { bB: 0.35 })); }
    add({ id: 'pectoralis-minor', name: 'pectoralis minor', latin: 'Musculus pectoralis minor', layer: DEEP, depth: 0.1, region: 'thorax', tags: ['chest', 'scapula'],
      info: I('Thin triangular muscle deep to pectoralis major, from the outer surfaces of ribs 3–5 near their costal cartilages up to the coracoid process of the scapula.', 'Draws the scapula forwards and downwards and steadies it; helps raise the ribs in forced inspiration.',
        'About 12 cm long and 5 cm wide at its origin.', 'A key surgical landmark: it divides the axillary artery into three parts and the axillary lymph nodes into levels I–III in breast-cancer surgery.') },
      sheet(F, (u, w) => 0.0032 * (0.35 + 0.65 * edge(w)) * pf([[0, 0.5], [0.3, 1], [1, 0.45]])(u), { ten: (u) => Math.max(H.smoothstep(0.88, 0.97, u), 1 - H.smoothstep(0.02, 0.08, u)), amp: 0.0006 }));
  }
  {
    // external oblique: origins on ribs 5-12, fibres down & forwards to the linea semilunaris, inguinal ligament and iliac crest
    const nf = 18, M = 22, F = [], phR = [1.0, 0.8, 0.62, 0.45, 0.28, 0.1, -0.15, -0.4];
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1), kf = s * 7, k0 = Math.floor(Math.min(6, kf)), f = kf - k0, ph = H.lerp(phR[k0], phR[k0 + 1], f), yo = H.lerp(ribY(5 + k0, phR[k0]), ribY(6 + k0, phR[k0 + 1]), f) - 0.006;
      let e;
      if (s < 0.55) { const y = H.lerp(1.17, 0.99, s / 0.55); e = [phiX(rectXL(y) + 0.004, y, 1), y]; }
      else if (s < 0.72) { const q = (s - 0.55) / 0.17, x = H.lerp(0.07, 0.118, q), y = H.lerp(0.935, 0.995, q); e = [phiX(x, y, 1), y]; }
      else { const q = (s - 0.72) / 0.28, y = H.lerp(0.998, 1.062, Math.sqrt(q)); e = [H.lerp(phiX(0.12, 1.0, 1), -0.3, q), y]; }
      F.push(fib([ph, yo], e, M, (u) => { const y = H.lerp(yo, e[1], u); return 0.0115 + 0.011 * H.smoothstep(1.2, 1.245, y); }));
    }
    const apo = (P) => P.z > 0.02 ? Math.max(1 - H.smoothstep(0.078, 0.097, Math.abs(P.x)), 1 - H.smoothstep(0.985, 1.008, P.y)) : 0;
    add({ id: 'external-oblique', name: 'external oblique', latin: 'Musculus obliquus externus abdominis', layer: SUP, depth: 0.05, region: 'body', tags: ['abdominal wall'],
      info: I('Largest and most superficial flat abdominal muscle. Fleshy digitations from the outer surfaces of ribs 5–12 (interlocking with serratus anterior and latissimus dorsi) run down and forwards ("hands in pockets") into a broad aponeurosis reaching the linea alba, pubic tubercle and anterior iliac crest; its folded lower edge is the inguinal ligament.',
        'Compresses the abdomen, flexes the trunk and rotates it to the opposite side; assists forced expiration.', 'About 30 cm tall; fleshy part 5–7 mm thick.',
        'Its aponeurosis forms the front wall of the inguinal canal, and the superficial inguinal ring is a split in it. The part covering rectus (anterior rectus sheath) is omitted here.') },
      sheet(F, (u, w, P) => H.lerp(0.0028, 0.0007, apo(P)) * (0.4 + 0.6 * edge(w, 0.3)), { ten: (u, w, P) => Math.max(apo(P), H.smoothstep(0.92, 1, u) * H.smoothstep(0.7, 0.8, w)), amp: 0.0008, ks: 26, seed: 31 }));
  }
  {
    const nf = 16, M = 18, F = [];
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o, e;
      if (s < 0.7) { const q = s / 0.7, y = H.lerp(1.05, 0.996, q * q); o = [H.lerp(-0.9, phiX(0.12, 0.996, 1), q), y]; }
      else { const q = (s - 0.7) / 0.3, x = H.lerp(0.118, 0.075, q), y = H.lerp(0.996, 0.945, q); o = [phiX(x, y, 1), y]; }
      if (s < 0.35) { const q = s / 0.35, k = Math.round(12 - 2 * q), ph = H.lerp(-0.35, 0.35, q); e = [ph, ribY(k, ph) - 0.01]; }
      else { const y = H.lerp(1.17, 0.952, (s - 0.35) / 0.65); e = [phiX(rectXL(y) + 0.003, y, 1), y]; }
      F.push(fib(o, e, M, 0.0185));
    }
    const apo = (P) => P.z > 0.03 ? 1 - H.smoothstep(0.095, 0.112, Math.abs(P.x)) : 0;
    add({ id: 'internal-oblique', name: 'internal oblique', latin: 'Musculus obliquus internus abdominis', layer: DEEP, depth: 0.1, region: 'abdomen', tags: ['abdominal wall'],
      info: I('Middle flat abdominal muscle, deep to the external oblique with fibres roughly at right angles to it: from the thoracolumbar fascia, anterior two-thirds of the iliac crest and lateral inguinal ligament up and forwards to the lower borders of ribs 10–12 and an aponeurosis that splits around rectus to reach the linea alba.',
        'Compresses the abdomen, flexes the trunk and rotates it to the same side (together with the opposite external oblique).', 'About 20 cm tall, ~5 mm thick.', 'Its lowest fibres form the cremaster muscle around the spermatic cord and, with transversus, the conjoint tendon.') },
      sheet(F, (u, w, P) => H.lerp(0.0026, 0.0007, apo(P)) * (0.4 + 0.6 * edge(w, 0.3)), { ten: (u, w, P) => Math.max(apo(P), 1 - H.smoothstep(0.02, 0.08, u)), amp: 0.0007, ks: 22, seed: 33 }));
  }
  {
    const nf = 14, M = 24, F = [];
    for (let i = 0; i < nf; i++) {
      const s = i / (nf - 1); let o;
      if (s < 0.6) { const y = H.lerp(1.2, 1.035, s / 0.6); o = [-1.05, y]; }
      else { const q = (s - 0.6) / 0.4, y = H.lerp(1.03, 0.95, q), ph = H.lerp(-0.6, phiX(0.085, 0.95, 1), q); o = [ph, y]; }
      const ye = H.lerp(1.215, 0.935, s); F.push(fib(o, [phiX(0.005, ye, 1), ye], M, (u) => 0.024 + 0.002 * H.smoothstep(0.8, 1, u)));
    }
    const apo = (P) => P.z > 0.03 ? 1 - H.smoothstep(0.085, 0.1, Math.abs(P.x)) : 0;
    add({ id: 'transversus-abdominis', name: 'transversus abdominis', latin: 'Musculus transversus abdominis', layer: DEEP, depth: 0.3, region: 'abdomen', tags: ['abdominal wall'],
      info: I('Deepest flat abdominal muscle, with horizontal fibres running from the inner surfaces of costal cartilages 7–12, the thoracolumbar fascia, the iliac crest and the lateral inguinal ligament forwards into an aponeurosis that ends in the linea alba.',
        'Acts like a corset, compressing the abdominal contents and stiffening the lumbar spine just before limb movements.', 'About 20 cm tall, 2–4 mm thick.', 'The TAP (transversus abdominis plane) block places local anaesthetic between it and the internal oblique, where the lower intercostal nerves run.') },
      sheet(F, (u, w, P) => H.lerp(0.0018, 0.0006, apo(P)) * (0.4 + 0.6 * edge(w, 0.3)), { ten: (u, w, P) => Math.max(apo(P), 1 - H.smoothstep(0.03, 0.1, u)), amp: 0.0005, ks: 20, seed: 35 }));
  }
  {
    const strips = (ext) => { const list = [];
      for (let k = 1; k <= 11; k++) {
        const pe = Math.min(RIB.end[k - 1], RIB.end[k]), p0 = ext ? -1.2 : -0.9, p1 = ext ? (k <= 7 ? pe - 0.3 : pe - 0.05) : pe, F = [];
        for (let r = 0; r < 3; r++) { const row = []; for (let j = 0; j < 22; j++) { const ph = H.lerp(p0, p1, j / 21), yt = ribY(k, ph) - 0.0035, yb = ribY(k + 1, ph) + 0.0035; row.push(T(ph, H.lerp(yb, yt, r / 2), ext ? -0.0012 : 0.0022, cageEnv)); } F.push(row); }
        list.push(sheet(F, 0.0011, { amp: 0.0002, ks: 3 }));
      } return merge(list); };
    add({ id: 'external-intercostals', name: 'external intercostal muscles', latin: 'Musculi intercostales externi', layer: DEEP, depth: 0.35, region: 'body', tags: ['chest', 'respiration'],
      info: I('Eleven thin sheets, one in each intercostal space, whose fibres run from the lower border of one rib down and forwards to the upper border of the rib below; they reach from the rib tubercles to the costochondral junctions, beyond which the external intercostal membrane continues.',
        'Raise the ribs in inspiration and stop the intercostal spaces bulging or being sucked in.', 'Each space ~1.5–2 cm tall; sheets ~3 mm thick.',
        'The intercostal nerve and vessels run under the rib above, so chest drains and needles are passed just over the upper border of a rib.') }, strips(true));
    add({ id: 'internal-intercostals', name: 'internal intercostal muscles', latin: 'Musculi intercostales interni', layer: DEEP, depth: 0.45, region: 'body', tags: ['chest', 'respiration'],
      info: I('Eleven thin sheets deep to the external intercostals with fibres at right angles to them (down and backwards), from the sternum and costal cartilages back to the angles of the ribs, where the internal intercostal membrane takes over.',
        'Pull the ribs down in forced expiration; their front (interchondral) parts help raise the ribs in inspiration.', 'Each space ~1.5–2 cm tall; sheets 2–3 mm thick.', 'The intercostal neurovascular bundle runs in the costal groove between this layer and the innermost intercostals.') }, strips(false));
  }
  {
    add({ id: 'quadratus-lumborum', name: 'quadratus lumborum', latin: 'Musculus quadratus lumborum', layer: DEEP, depth: 0.4, region: 'abdomen', tags: ['back', 'posterior abdominal wall'],
      info: I('Quadrilateral muscle of the posterior abdominal wall between the iliac crest and iliolumbar ligament below and the 12th rib and transverse processes of L1–L4 above, lateral to psoas and in front of erector spinae.', 'Bends the trunk to its own side, extends the lumbar spine and anchors the 12th rib during deep inspiration.',
        'About 12 cm tall, 5–6 cm wide, 1–2 cm thick.', 'A common hidden source of low-back pain; the kidney lies directly in front of it.') },
      sweep([[0.074, 1.04, -0.075], [0.072, 1.1, -0.077], [0.062, 1.168, -0.074]], pf([[0, 0.016], [0.5, 0.016], [1, 0.013]]), 0.005, { up: [0.25, 0, -1], radial: 12, tA: 0.1, tB: 0.1, amp: 0.0006 }));
    add({ id: 'psoas-major', name: 'psoas major', latin: 'Musculus psoas major', layer: DEEP, depth: 0.5, region: 'body', tags: ['posterior abdominal wall', 'hip'],
      info: I('Long spindle-shaped muscle beside the lumbar spine, from the sides of the T12–L5 vertebral bodies, their discs and transverse processes, running down along the pelvic brim and under the inguinal ligament to join iliacus on the lesser trochanter of the femur.',
        'The main flexor of the hip; also flexes the trunk on the thigh (sitting up) and bends the lumbar spine sideways.', 'About 30 cm long and up to 5 cm thick at the lower lumbar spine.',
        'A spinal abscess can track down its sheath to the groin; pain on hip extension ("psoas sign") suggests an inflamed retrocaecal appendix.') },
      sweep([[0.018, 1.175, -0.052], [0.027, 1.117, -0.045], [0.038, 1.05, -0.03], [0.05, 0.99, -0.012], [0.068, 0.945, 0.012], [0.082, 0.912, 0.028], [0.096, 0.885, 0.018], [0.104, 0.868, -0.012]],
        pf([[0, 0.006], [0.2, 0.011], [0.45, 0.017], [0.7, 0.012], [0.9, 0.007], [1, 0.005]]), pf([[0, 0.006], [0.2, 0.01], [0.45, 0.015], [0.7, 0.011], [0.9, 0.005], [1, 0.004]]), { up: [0, 0, 1], radial: 14, n: 2, bulge: 0.05, tA: 0.04, tB: 0.14, amp: 0.001, ks: 12 }));
    const F = []; const crest = new THREE.CatmullRomCurve3([v([0.058, 1.05, -0.048]), v([0.1, 1.062, -0.035]), v([0.126, 1.058, 0.0]), v([0.12, 1.02, 0.04]), v([0.114, 1.0, 0.052])]);
    for (let i = 0; i < 10; i++) { const s = i / 9, O = crest.getPointAt(s), E = v([0.088, 0.918, 0.024]).add(new V3(0.004 * (s - 0.5), 0, 0)); F.push(fibC([O, O.clone().lerp(E, 0.5).add(new V3(0.012, 0, -0.012)), E, [0.1, 0.885, 0.016]], 16)); }
    add({ id: 'iliacus', name: 'iliacus', latin: 'Musculus iliacus', layer: DEEP, depth: 0.5, region: 'body', tags: ['posterior abdominal wall', 'hip'],
      info: I('Fan-shaped muscle filling the iliac fossa on the inner surface of the ilium; its fibres converge onto the lateral side of the psoas tendon and insert with it on the lesser trochanter of the femur (together: iliopsoas).', 'Flexes the hip and steadies the pelvis on the femur.',
        'About 15 cm long; fan ~10 cm wide.', 'Bleeding into it (in haemophilia or on anticoagulants) can compress the femoral nerve, weakening the thigh.') },
      sheet(F, (u, w) => pf([[0, 0.003], [0.4, 0.006], [0.75, 0.007], [1, 0.004]])(u) * (0.4 + 0.6 * edge(w)), { out: () => new V3(-0.5, 0.25, 0.8), ten: (u) => H.smoothstep(0.8, 0.95, u), amp: 0.0008, ks: 14 }));
  }

  // ============================================================ SCAPULAR / ROTATOR CUFF (scapular plane taken ~0.02 m inside the back skin)
  const armUp = lout(UA), foreUp = lout(FA);
  {
    add({ id: 'supraspinatus', name: 'supraspinatus', latin: 'Musculus supraspinatus', layer: DEEP, depth: 0.15, region: 'thorax', tags: ['shoulder', 'rotator cuff'],
      info: I('Rotator-cuff muscle filling the supraspinous fossa above the spine of the scapula; its tendon runs under the acromion and over the top of the shoulder joint to the superior facet of the greater tubercle of the humerus.',
        'Initiates abduction of the arm (first ~15°) and holds the humeral head in the glenoid.', 'About 12 cm long, up to 3 cm thick in the fossa; tendon ~2.5 cm wide.',
        'The most commonly torn rotator-cuff tendon; pinched under the acromion in impingement, giving a "painful arc" between about 60° and 120° of abduction.') },
      // runs under the trapezius and, laterally, under the flattened deltoid (>= 9 mm under the skin there) to the top of the greater tubercle
      tuckGeo(sweep([[0.064, 1.415, -0.092], [0.11, 1.427, -0.077], [0.158, 1.424, -0.05], SH.clone().add(new V3(0.016, 0.001, 0.003))], pf([[0, 0.012], [0.4, 0.016], [0.8, 0.01], [1, 0.008]]), pf([[0, 0.003], [0.4, 0.0042], [0.8, 0.0035], [1, 0.0018]]), { radial: 12, tB: 0.25, amp: 0.0008, ks: 12 }),
        (P) => new V3(P.x, P.y - 0.04, P.z + 0.02), 0.009, 0.004, (P) => P.x > 0.08));
    const F = []; for (let i = 0; i < 10; i++) { const s = i / 9, y = H.lerp(1.385, 1.29, s), x = H.lerp(0.064, 0.084, s); F.push(fib([phiX(x, y, -1), y], SH.clone().add(new V3(0.019, -0.004 - 0.008 * s, -0.021)).toArray(), 16, 0.0165, { bB: 0.35, ey: u => Math.pow(u, 0.8) })); }
    add({ id: 'infraspinatus', name: 'infraspinatus', latin: 'Musculus infraspinatus', layer: DEEP, depth: 0.1, region: 'thorax', tags: ['shoulder', 'rotator cuff'],
      info: I('Thick triangular rotator-cuff muscle filling most of the infraspinous fossa below the spine of the scapula and converging on the middle facet of the greater tubercle of the humerus.', 'The main lateral rotator of the arm; stabilises the humeral head in the glenoid.',
        'About 15 cm long and ~10 cm wide at its origin.', 'Wastes when the suprascapular nerve is trapped at the spinoglenoid notch, a classic overuse injury of volleyball players.') },
      sheet(F, (u, w) => 0.0028 * (0.4 + 0.6 * edge(w)) * pf([[0, 0.6], [0.4, 1], [0.85, 0.8], [1, 0.5]])(u), { ten: (u) => H.smoothstep(0.84, 0.95, u), amp: 0.0008, ks: 14, seed: 41 }));
    add({ id: 'teres-minor', name: 'teres minor', latin: 'Musculus teres minor', layer: DEEP, depth: 0.15, region: 'thorax', tags: ['shoulder', 'rotator cuff'],
      info: I('Narrow rotator-cuff muscle from the upper two-thirds of the lateral border of the scapula to the lowest facet of the greater tubercle of the humerus.', 'Laterally rotates the arm and holds the humeral head in place.', 'About 10 cm long and 2 cm wide.',
        'Unlike the other posterior cuff muscles it is supplied by the axillary nerve.') },
      sweep([TX(0.118, 1.318, 0.0165, -1), TX(0.15, 1.355, 0.017, -1), [0.185, 1.388, -0.04], SH.clone().add(new V3(0.014, -0.02, -0.024))], pf([[0, 0.006], [0.4, 0.008], [1, 0.005]]), 0.0034, { radial: 10, tB: 0.2, amp: 0.0006 }));
    add({ id: 'teres-major', name: 'teres major', latin: 'Musculus teres major', layer: DEEP, depth: 0.1, region: 'thorax', tags: ['shoulder'],
      info: I('Thick rounded muscle from the dorsal surface of the inferior angle of the scapula, running up and laterally with latissimus dorsi to the medial lip of the intertubercular groove of the humerus.', 'Adducts, extends and medially rotates the arm.', 'About 12 cm long and 3–4 cm wide.',
        'Nicknamed "lat\'s little helper"; with teres minor and the long head of triceps it bounds the quadrangular and triangular spaces through which axillary vessels and nerves pass.') },
      sweep([TX(0.096, 1.283, 0.016, -1), TX(0.132, 1.318, 0.017, -1), [0.168, 1.352, -0.022], lp(UA, 0.14, -35, 0.013)], pf([[0, 0.009], [0.4, 0.012], [0.85, 0.009], [1, 0.006]]), pf([[0, 0.004], [0.4, 0.0062], [1, 0.0025]]), { radial: 12, tB: 0.15, amp: 0.0008 }));
    const S = []; for (let i = 0; i < 9; i++) { const s = i / 8, y = H.lerp(1.425, 1.29, s), x = H.lerp(0.068, 0.088, s); S.push(fib([phiX(x, y, -1), y], SH.clone().add(new V3(0.004, -0.004 - 0.012 * s, 0.024)).toArray(), 16, 0.0238, { bB: 0.45 })); }
    add({ id: 'subscapularis', name: 'subscapularis', latin: 'Musculus subscapularis', layer: DEEP, depth: 0.4, region: 'thorax', tags: ['shoulder', 'rotator cuff'],
      info: I('The largest rotator-cuff muscle: a triangular sheet filling the subscapular fossa on the rib-facing surface of the scapula, converging onto the lesser tubercle of the humerus in front of the shoulder joint.', 'Medially rotates the arm and prevents forward dislocation of the humeral head.',
        'About 15 cm long; fan ~10 cm wide.', 'Tested with the "lift-off" and "belly-press" tests; it glides on serratus anterior across the scapulothoracic space.') },
      sheet(S, (u, w) => pf([[0, 0.0012], [0.5, 0.0019], [0.85, 0.0026], [1, 0.0016]])(u) * (0.4 + 0.6 * edge(w)), { ten: (u) => H.smoothstep(0.86, 0.96, u), amp: 0.0004, seed: 43 }));
  }

  // ============================================================ ARM
  {
    const TUB = lp(FA, 0.13, 20, 0.008);   // radial tuberosity (biceps insertion)
    const lh = sweep([[0.166, 1.424, -0.012], [0.182, 1.427, 0.003], lp(UA, 0.02, 20, 0.026), lp(UA, 0.15, 12, 0.026), lp(UA, 0.4, 8, 0.028), lp(UA, 0.65, 2, 0.028), lp(UA, 0.85, -4, 0.022), lp(UA, 0.96, -5, 0.014), TUB],
      pf([[0, 0.0022], [0.28, 0.0025], [0.4, 0.008], [0.55, 0.0105], [0.75, 0.008], [0.86, 0.0035], [1, 0.003]]), pf([[0, 0.0018], [0.28, 0.002], [0.4, 0.0065], [0.58, 0.0092], [0.78, 0.006], [0.86, 0.0025], [1, 0.0022]]), { up: armUp, radial: 14, ten: (t) => Math.max(1 - H.smoothstep(0.3, 0.38, t), H.smoothstep(0.8, 0.86, t)), amp: 0.001, ks: 12, seed: 51, step: 0.006 });
    tuckGeo(lh, humAnchor, 0.009, 0.003, (P) => P.y > 1.39);   // intra-articular tendon arches over the humeral head under the deltoid
    const sh = sweep([[0.158, 1.402, 0.032], lp(UA, 0.12, -25, 0.027), lp(UA, 0.3, -18, 0.029), lp(UA, 0.5, -12, 0.029), lp(UA, 0.7, -8, 0.026), lp(UA, 0.86, -5, 0.02), lp(UA, 0.96, -5, 0.013), TUB],
      pf([[0, 0.003], [0.12, 0.004], [0.3, 0.009], [0.5, 0.0105], [0.72, 0.008], [0.84, 0.0035], [1, 0.003]]), pf([[0, 0.0022], [0.12, 0.003], [0.35, 0.0075], [0.55, 0.0088], [0.75, 0.006], [0.85, 0.0025], [1, 0.0022]]), { up: armUp, radial: 14, ten: (t) => Math.max(1 - H.smoothstep(0.1, 0.18, t), H.smoothstep(0.8, 0.86, t)), amp: 0.001, ks: 12, seed: 53, step: 0.006 });
    const apon = sweep([lp(UA, 0.88, -10, 0.02), lp(UA, 0.97, -45, 0.02), lp(FA, 0.1, -80, 0.019), lp(FA, 0.2, -105, 0.018)], pf([[0, 0.004], [0.5, 0.006], [1, 0.004]]), 0.0006, { up: foreUp, radial: 8, ten: () => 1, amp: 0 });
    add({ id: 'biceps-brachii', name: 'biceps brachii', latin: 'Musculus biceps brachii', layer: SUP, depth: 0.1, region: 'armL', tags: ['arm'],
      info: I('Two-headed muscle on the front of the arm. The long head\'s tendon arises from the supraglenoid tubercle and arches through the shoulder joint into the intertubercular groove; the short head arises from the coracoid process. The united belly ends in a tendon on the radial tuberosity plus the bicipital aponeurosis fanning over the forearm flexors.',
        'The strongest supinator of the forearm and a powerful elbow flexor; weakly flexes the shoulder.', 'About 30 cm from origin to insertion; belly ~4 cm wide.',
        'Rupture of the long-head tendon gives a "Popeye" bulge; the biceps reflex tests the C5–C6 nerve roots.') }, merge([lh, sh, apon]));
    const olec = lp(UA, 1.0, 180, 0.023);
    const tl = sweep([[0.172, 1.393, -0.032], lp(UA, 0.2, 205, 0.028), lp(UA, 0.5, 195, 0.029), lp(UA, 0.78, 185, 0.025), lp(UA, 0.93, 180, 0.021), olec], pf([[0, 0.004], [0.12, 0.007], [0.45, 0.012], [0.75, 0.011], [1, 0.008]]), pf([[0, 0.003], [0.12, 0.005], [0.45, 0.0088], [0.75, 0.006], [1, 0.0022]]), { up: armUp, radial: 14, ten: (t) => Math.max(1 - H.smoothstep(0.05, 0.12, t), H.smoothstep(0.62, 0.78, t) * 0.9), amp: 0.001, ks: 12, seed: 55 });
    const tla = sweep([lp(UA, 0.1, 125, 0.022), lp(UA, 0.35, 150, 0.03), lp(UA, 0.65, 165, 0.029), lp(UA, 0.9, 177, 0.022), olec], pf([[0, 0.005], [0.3, 0.011], [0.7, 0.01], [1, 0.008]]), pf([[0, 0.003], [0.35, 0.0082], [0.7, 0.006], [1, 0.0022]]), { up: armUp, radial: 14, ten: (t) => Math.max(1 - H.smoothstep(0.02, 0.08, t), H.smoothstep(0.66, 0.8, t) * 0.9), amp: 0.001, ks: 12, seed: 57 });
    const tm = sweep([lp(UA, 0.4, 210, 0.0155), lp(UA, 0.7, 190, 0.0175), lp(UA, 0.93, 180, 0.017), olec], pf([[0, 0.007], [0.4, 0.013], [1, 0.008]]), 0.0045, { up: armUp, radial: 12, tB: 0.12, amp: 0.0008, seed: 59 });
    add({ id: 'triceps-brachii', name: 'triceps brachii', latin: 'Musculus triceps brachii', layer: SUP, depth: 0.1, region: 'armL', tags: ['arm'],
      info: I('The only muscle on the back of the arm, with three heads: the long head from the infraglenoid tubercle of the scapula, the lateral head from the posterior humerus above the radial groove and the deep medial head from below it. They join a broad flat tendon on the olecranon of the ulna.',
        'The main extensor of the elbow; the long head also extends and adducts the shoulder.', 'About 30 cm long; the bulkiest muscle of the arm.',
        'The radial nerve spirals between its lateral and medial heads in the radial groove, where humeral shaft fractures injure it (wrist drop); the triceps reflex tests C7.') }, merge([tl, tla, tm]));
    add({ id: 'brachialis', name: 'brachialis', latin: 'Musculus brachialis', layer: DEEP, depth: 0.2, region: 'armL', tags: ['arm'],
      info: I('Broad flat muscle deep to biceps, from the lower half of the anterior humerus across the front of the elbow joint to the coronoid process and tuberosity of the ulna.', 'The main flexor of the elbow, whatever the position of the forearm.', 'About 15 cm long and 4–5 cm wide.',
        'Bleeding into it after elbow injury can ossify (myositis ossificans), limiting movement.') },
      sweep([lp(UA, 0.44, 15, 0.0152), lp(UA, 0.7, 5, 0.017), lp(UA, 0.9, 0, 0.0172), lp(FA, 0.05, -25, 0.012), lp(FA, 0.12, -35, 0.008)], pf([[0, 0.009], [0.45, 0.017], [0.8, 0.012], [1, 0.006]]), pf([[0, 0.002], [0.45, 0.0042], [0.85, 0.0035], [1, 0.002]]), { up: armUp, radial: 14, tB: 0.12, amp: 0.0008, seed: 61 }));
    add({ id: 'coracobrachialis', name: 'coracobrachialis', latin: 'Musculus coracobrachialis', layer: DEEP, depth: 0.2, region: 'armL', tags: ['arm', 'shoulder'],
      info: I('Slender muscle from the tip of the coracoid process (sharing a tendon with the short head of biceps) to the medial surface of the middle of the humerus.', 'Flexes and adducts the arm at the shoulder.', 'About 15 cm long, 2 cm wide.',
        'Pierced by the musculocutaneous nerve — a landmark when blocking that nerve in the axilla.') },
      sweep([[0.157, 1.4, 0.027], lp(UA, 0.22, -45, 0.021), lp(UA, 0.38, -55, 0.016), lp(UA, 0.5, -62, 0.0125)], pf([[0, 0.003], [0.35, 0.0068], [1, 0.004]]), pf([[0, 0.0025], [0.35, 0.0055], [1, 0.002]]), { up: armUp, radial: 12, tA: 0.12, tB: 0.12, amp: 0.0006 }));
    add({ id: 'anconeus', name: 'anconeus', latin: 'Musculus anconeus', layer: DEEP, depth: 0.1, region: 'armL', tags: ['elbow'],
      info: I('Small triangular muscle behind the elbow, from the back of the lateral epicondyle to the lateral surface of the olecranon and upper posterior ulna.', 'Assists triceps in extending the elbow and steadies the ulna during pronation.', 'About 4 cm long.',
        'Often regarded as a continuation of triceps; the Kocher approach to the radial head passes between it and extensor carpi ulnaris.') },
      sweep([lp(UA, 0.98, 125, 0.024), lp(FA, 0.08, 160, 0.019), lp(FA, 0.2, 182, 0.0145)], pf([[0, 0.003], [0.4, 0.008], [1, 0.005]]), 0.0027, { up: foreUp, radial: 10, tA: 0.15, amp: 0.0004 }));
  }

  // ============================================================ FOREARM (anatomical position: palm forward, radius lateral) & HAND
  {
    const ME = lp(UA, 1.0, -95, 0.029), LE = lp(UA, 1.0, 92, 0.026), rad = L.bone.radiusL, uln = L.bone.ulnaL;
    const RA = (t) => v(rad.top).lerp(v(rad.bottom), t), UL = (t) => v(uln.top).lerp(v(uln.bottom), t);
    // knuckle (MCP) x of the index..little fingers = the skin's finger axes (palm centre 0.2525 + finger offsets); the palm is only ~2 cm thick there,
    // so the extensor, profundus and superficialis tendons end at z 0.012 / 0.018 / 0.021 between its dorsal (~0.007) and palmar (~0.026) skin.
    // MCy = level of the metacarpal heads, ~8.5 mm proximal to where the skin's finger segments start (y 0.752, 0.748, 0.751, 0.758)
    const MCPx = [0.2805, 0.2605, 0.2405, 0.2225], MCy = [0.7605, 0.7565, 0.7595, 0.7665];
    // thumb frame = the skin's first thumb segment (integumentary: capsule from [0.268, 0.828, 0.020] along (0.45, -0.85, 0.35), radius 12.5 -> 11 mm,
    // MCP at t = 42 mm). Up to ~t = 20 mm that capsule lies wholly inside the palm skin loft, and a space wrapped by two shells of one skin part reads
    // as "outside" to ray-parity skin tests, so thumb muscles avoid its interior there: the thenar group runs along the radial side of the capsule and
    // turns palmar into the capsule only beyond t ~ 30 mm; the FPL tendon and first dorsal interosseous pass on its ulnar side.
    // TP(t, deg, r): t along the thumb axis, deg around it (0 = palmar, +90 = ulnar/index side, -90 = radial border), r from the axis
    const TB = v([0.268, 0.828, 0.020]), TD = v([0.45, -0.85, 0.35]).normalize(), TPal = new V3(0, 0, 1).addScaledVector(TD, -TD.z).normalize(), TUl = new V3().crossVectors(TD, TPal).normalize();
    const TP = (t, deg, r) => { const a = deg * PI / 180; return TB.clone().addScaledVector(TD, t).addScaledVector(TPal, Math.cos(a) * r).addScaledVector(TUl, Math.sin(a) * r); };
    const thumbOut = (t, P) => { const q = P.clone().sub(TB); return q.addScaledVector(TD, -q.dot(TD)); };
    // forearm muscle: fleshy belly then tendon from `tf` on
    const fm = (pts, wB, thB, tf, o = {}) => sweep(pts, pf([[0, wB * 0.45], [0.1, wB * 0.85], [0.3, wB], [tf - 0.12, wB * 0.7], [tf, Math.min(0.0028, wB)], [1, 0.0022]]), pf([[0, thB * 0.45], [0.12, thB * 0.85], [0.3, thB], [tf - 0.12, thB * 0.7], [tf, Math.min(0.002, thB)], [1, 0.0016]]),
      Object.assign({ up: foreUp, radial: 12, ten: (t) => Math.max(1 - H.smoothstep(0.02, 0.07, t), H.smoothstep(tf - 0.1, tf, t)), amp: 0.0007, ks: 10, step: 0.008 }, o));
    const tendons = (from, z, r, xs, ys) => xs.map((x, i) => sweep([from.clone().add(new V3((i - 1.5) * 0.004, 0, 0)), [H.lerp(from.x, x, 0.55), H.lerp(from.y, ys[i], 0.55), z], [x, ys[i], z]], r, r * 0.8, { up: [0, 0, 1], radial: 8, ten: () => 1, amp: 0, step: 0.01 }));
    const F = [
      ['brachioradialis', 'brachioradialis', 'Musculus brachioradialis', SUP, 0.1, fm([lp(UA, 0.72, 100, 0.02), lp(UA, 0.9, 85, 0.027), lp(FA, 0.15, 70, 0.028), lp(FA, 0.45, 75, 0.021), lp(FA, 0.75, 85, 0.014), lp(FA, 0.98, 85, 0.012)], 0.011, 0.0068, 0.62),
        I('Superficial muscle along the radial (thumb) border of the forearm, from the upper lateral supracondylar ridge of the humerus to the base of the radial styloid process.', 'Flexes the elbow, most strongly with the forearm half-pronated (thumb up, as when drinking).', 'About 25 cm long; belly 3–4 cm wide.', 'Although it lies in the extensor compartment and is supplied by the radial nerve, it flexes the elbow; its reflex tests C6.')],
      ['extensor-carpi-radialis-longus', 'extensor carpi radialis longus', 'Musculus extensor carpi radialis longus', SUP, 0.15, fm([lp(UA, 0.86, 105, 0.021), lp(FA, 0.12, 108, 0.026), lp(FA, 0.35, 112, 0.023), lp(FA, 0.7, 120, 0.016), lp(FA, 1.0, 130, 0.015), lp(HF, 0.14, 145, 0.01)], 0.008, 0.0055, 0.5),
        I('Arises from the lower lateral supracondylar ridge of the humerus and runs along the radial side of the forearm to the dorsal base of the second metacarpal.', 'Extends and radially deviates the wrist; keeps the wrist extended during a firm grip.', 'About 25 cm long; fleshy in its upper half.', 'A frequent donor tendon for tendon transfers after nerve injuries.')],
      ['extensor-carpi-radialis-brevis', 'extensor carpi radialis brevis', 'Musculus extensor carpi radialis brevis', SUP, 0.15, fm([LE, lp(FA, 0.15, 128, 0.025), lp(FA, 0.45, 138, 0.021), lp(FA, 0.75, 146, 0.016), lp(FA, 1.0, 152, 0.015), lp(HF, 0.14, 172, 0.009)], 0.0075, 0.005, 0.58),
        I('Arises from the common extensor origin on the lateral epicondyle and inserts on the dorsal base of the third metacarpal.', 'Extends and radially deviates the wrist and steadies it during gripping.', 'About 22 cm long.', 'Its origin is the main site of degeneration in lateral epicondylitis ("tennis elbow").')],
      ['extensor-digitorum', 'extensor digitorum', 'Musculus extensor digitorum', SUP, 0.15, null,
        I('Arises from the common extensor origin on the lateral epicondyle; its belly divides into four tendons that cross the back of the hand to the extensor expansions of the index to little fingers.', 'Extends the fingers at the knuckle and, via the expansions, the finger joints; helps extend the wrist.', 'About 25 cm to the knuckles; tendons ~2 mm thick.', 'Its tendons are linked by juncturae tendinum on the back of the hand, which is why the ring finger cannot be lifted fully on its own. The tendons are shown only as far as the knuckles.')],
      ['extensor-carpi-ulnaris', 'extensor carpi ulnaris', 'Musculus extensor carpi ulnaris', SUP, 0.15, fm([LE.clone().add(new V3(-0.004, -0.004, -0.006)), lp(FA, 0.15, 178, 0.023), lp(FA, 0.45, 200, 0.021), lp(FA, 0.8, 212, 0.016), lp(FA, 1.0, 228, 0.014), lp(HF, 0.12, 240, 0.013)], 0.0075, 0.0052, 0.7),
        I('Arises from the lateral epicondyle and the posterior border of the ulna and runs down the back of the ulna to the base of the fifth metacarpal.', 'Extends and adducts (ulnar-deviates) the wrist.', 'About 24 cm long.', 'Its tendon can snap out of its groove over the ulnar head in tennis and golf players.')],
      ['flexor-carpi-radialis', 'flexor carpi radialis', 'Musculus flexor carpi radialis', SUP, 0.15, fm([ME, lp(FA, 0.15, -40, 0.025), lp(FA, 0.35, -15, 0.023), lp(FA, 0.6, 0, 0.018), lp(FA, 0.85, 20, 0.016), lp(FA, 1.0, 35, 0.014), lp(HF, 0.12, 50, 0.01)], 0.008, 0.0055, 0.5),
        I('Arises from the common flexor origin on the medial epicondyle; its long tendon runs in its own groove on the trapezium to the base of the second (and third) metacarpal.', 'Flexes the wrist and deviates it radially.', 'About 25 cm long, tendinous in the distal half.', 'The radial pulse is felt just lateral to its tendon at the wrist.')],
      ['palmaris-longus', 'palmaris longus', 'Musculus palmaris longus', SUP, 0.15, null,
        I('Small spindle-shaped muscle from the medial epicondyle with a long slender tendon passing superficial to the flexor retinaculum into the palmar aponeurosis.', 'Weakly flexes the wrist and tenses the palmar aponeurosis.', 'Belly ~6 cm, tendon ~15 cm.', 'Absent in about 15% of people; its tendon is a favourite graft for tendon and ligament reconstruction.')],
      ['flexor-carpi-ulnaris', 'flexor carpi ulnaris', 'Musculus flexor carpi ulnaris', SUP, 0.15, fm([ME.clone().add(new V3(0, 0, -0.008)), lp(FA, 0.15, -100, 0.026), lp(FA, 0.45, -85, 0.023), lp(FA, 0.8, -70, 0.017), lp(HF, 0.06, -55, 0.013)], 0.0085, 0.0058, 0.86),
        I('The most medial superficial flexor, arising from the medial epicondyle and from the olecranon and posterior border of the ulna, and inserting on the pisiform (and via ligaments on the hamate and fifth metacarpal).', 'Flexes and adducts (ulnar-deviates) the wrist.', 'About 25 cm long, fleshy almost to the wrist.', 'The ulnar nerve enters the forearm between its two heads — the cubital tunnel.')],
      ['flexor-digitorum-superficialis', 'flexor digitorum superficialis', 'Musculus flexor digitorum superficialis', SUP, 0.3, null,
        I('Broad intermediate-layer flexor from the medial epicondyle, coronoid process and anterior radius; its four tendons pass through the carpal tunnel and split to insert on the middle phalanges of the fingers.', 'Flexes the proximal interphalangeal and knuckle joints of the fingers and helps flex the wrist.', 'About 25 cm to the palm.', 'Tested by holding the other fingers straight and bending one finger at its middle joint. The tendons are shown only as far as the knuckles.')],
      ['pronator-teres', 'pronator teres', 'Musculus pronator teres', DEEP, 0.05, fm([ME.clone().add(new V3(0.003, 0.004, 0.004)), lp(FA, 0.15, -30, 0.024), lp(FA, 0.3, 20, 0.021), lp(FA, 0.45, 72, 0.013)], 0.009, 0.0055, 0.9),
        I('Two-headed muscle from the medial epicondyle (humeral head) and coronoid process (ulnar head) crossing the front of the forearm obliquely to the middle of the lateral surface of the radius.', 'Pronates the forearm and assists elbow flexion.', 'About 13 cm long.', 'The median nerve passes between its two heads, where it can be compressed (pronator syndrome).')],
      ['supinator', 'supinator', 'Musculus supinator', DEEP, 0.3, sweep([RA(0.03).addScaledVector(FA.ant, -0.012).addScaledVector(FA.lat, 0.002), RA(0.12).addScaledVector(FA.lat, 0.011), RA(0.2).addScaledVector(FA.ant, 0.007).addScaledVector(FA.lat, 0.007), RA(0.28).addScaledVector(FA.ant, 0.0095)], pf([[0, 0.006], [0.4, 0.011], [1, 0.006]]), 0.0026, { up: (t, P) => { const q = P.clone().sub(v(rad.top)), d = v(rad.bottom).sub(v(rad.top)).normalize(); return q.addScaledVector(d, -q.dot(d)); }, radial: 10, tA: 0.12, amp: 0.0004 }),
        I('Deep curved sheet wrapping around the upper third of the radius, from the lateral epicondyle, radial collateral and annular ligaments and the supinator crest of the ulna.', 'Supinates the forearm (turns the palm up), especially with the elbow straight.', 'About 6 cm long.', 'The deep branch of the radial nerve passes through it beneath the arcade of Frohse, a site of nerve entrapment.')],
      ['pronator-quadratus', 'pronator quadratus', 'Musculus pronator quadratus', DEEP, 0.4, sweep([UL(0.86).add(new V3(-0.004, 0, 0.008)), lp(FA, 0.88, 0, 0.011), RA(0.86).add(new V3(0.001, 0, 0.0065))], 0.019, 0.0026, { up: FA.ant, radial: 10, n: 3, amp: 0.0004, ten: (t) => 0.25 * (1 - edge(t, 0.3)) }),
        I('Flat square muscle deep in the lower forearm, stretching across from the lower quarter of the front of the ulna to that of the radius.', 'The prime mover of pronation; also binds the lower ends of radius and ulna together.', 'About 4–5 cm square and ~5 mm thick.', 'It is lifted off the radius in the standard volar approach for plating distal radius fractures.')],
      ['flexor-digitorum-profundus', 'flexor digitorum profundus', 'Musculus flexor digitorum profundus', DEEP, 0.3, null,
        I('Deep flexor from the upper anterior and medial ulna and the interosseous membrane; its four tendons run through the carpal tunnel beneath and then through the split superficialis tendons to the distal phalanges.', 'The only muscle that bends the fingertips (distal interphalangeal joints); also flexes the other finger joints and the wrist.', 'About 25 cm to the palm.', '"Jersey finger" is avulsion of its ring-finger tendon when grabbing a shirt. The tendons are shown only as far as the knuckles.')],
      ['flexor-pollicis-longus', 'flexor pollicis longus', 'Musculus flexor pollicis longus', DEEP, 0.3, fm([lp(FA, 0.28, 48, 0.012), lp(FA, 0.55, 42, 0.0125), lp(FA, 0.85, 35, 0.01), lp(FA, 1.0, 28, 0.008), TP(-0.006, 80, 0.0135), TP(0.006, 84, 0.0155), TP(0.02, 78, 0.015)], 0.0075, 0.0045, 0.6),
        I('Deep flexor arising from the anterior surface of the radius and interosseous membrane; its tendon passes through the carpal tunnel to the distal phalanx of the thumb.', 'Flexes the thumb, especially its tip joint.', 'About 20 cm long.', 'Inability to bend the thumb tip (with an intact index fingertip) points to anterior interosseous nerve palsy. The tendon is shown only as far as the thumb\'s metacarpal.')]];
    const palm = (x, y, z) => new V3(x, y, z);
    for (const [id, name, latin, layer, depth, geo, info] of F) {
      let gm = geo;
      if (id === 'extensor-digitorum') gm = merge([fm([LE.clone().add(new V3(-0.002, -0.004, -0.004)), lp(FA, 0.15, 152, 0.023), lp(FA, 0.45, 166, 0.019), lp(FA, 0.75, 175, 0.015), lp(FA, 0.98, 180, 0.013)], 0.0105, 0.0058, 0.72)].concat(tendons(lp(FA, 0.98, 180, 0.013), 0.0118, 0.0014, MCPx, MCy)));
      if (id === 'palmaris-longus') gm = merge([fm([ME.clone().add(new V3(0.004, 0.002, 0.006)), lp(FA, 0.15, -55, 0.029), lp(FA, 0.4, -22, 0.025), lp(FA, 0.65, -5, 0.0185), lp(FA, 0.92, 0, 0.0145), lp(HF, 0.1, 0, 0.0135)], 0.006, 0.0045, 0.42),
        sweep([lp(HF, 0.08, 0, 0.0135), lp(HF, 0.22, 0, 0.0138), lp(HF, 0.4, 0, 0.0132)], pf([[0, 0.004], [1, 0.022]]), 0.0008, { up: HF.ant, radial: 10, n: 4, ten: () => 1, amp: 0 })]);
      if (id === 'flexor-digitorum-superficialis') gm = merge([fm([ME.clone().add(new V3(0.004, -0.004, 0.002)), lp(FA, 0.1, -60, 0.019), lp(FA, 0.35, -20, 0.018), lp(FA, 0.7, -5, 0.014), lp(FA, 0.98, -5, 0.011)], 0.013, 0.0068, 0.78)].concat(tendons(lp(FA, 0.98, -5, 0.011), 0.0212, 0.0019, MCPx, MCy)));
      if (id === 'flexor-digitorum-profundus') gm = merge([fm([lp(FA, 0.08, -75, 0.013), lp(FA, 0.4, -40, 0.0135), lp(FA, 0.75, -20, 0.0115), lp(FA, 0.97, -10, 0.008)], 0.014, 0.0055, 0.8)].concat(tendons(lp(FA, 0.97, -10, 0.008), 0.0176, 0.0018, MCPx, MCy.map(y => y - 0.002))));
      add({ id, name, latin, layer, depth, region: 'armL', tags: ['forearm'], info }, gm);
    }
    // ---- hand
    add({ id: 'thenar-muscles', name: 'thenar muscles', latin: 'Eminentia thenaris (mm. abductor et flexor pollicis brevis, opponens pollicis)', layer: SUP, depth: 0.2, region: 'armL', tags: ['hand'],
      info: I('The fleshy ball of the thumb: abductor pollicis brevis, flexor pollicis brevis and opponens pollicis (with adductor pollicis deeper), from the flexor retinaculum, scaphoid and trapezium to the first metacarpal and base of the thumb\'s proximal phalanx.', 'Moves the thumb, above all in opposition — bringing the thumb pad onto the finger pads.', 'About 5 cm long and 3 cm wide.', 'Wasting of the thenar eminence is a late sign of carpal tunnel syndrome (median nerve compression).') },
      // from the trapezium / scaphoid tubercle along the radial border of the first metacarpal to its distal third (just outside the skin's thumb
      // capsule, see TP above; the capsule's interior is left free)
      sweep([TP(-0.012, -80, 0.009), TP(-0.004, -100, 0.0128), TP(0.004, -110, 0.0135), TP(0.015, -115, 0.0138), TP(0.025, -116, 0.0133), TP(0.032, -112, 0.012)],
        pf([[0, 0.003], [0.15, 0.0045], [0.3, 0.0055], [0.75, 0.005], [1, 0.0025]]), pf([[0, 0.0011], [0.3, 0.0021], [0.75, 0.0019], [1, 0.0011]]), { up: thumbOut, radial: 14, tB: 0.1, amp: 0.0003, bulge: 0.15 }));
    add({ id: 'hypothenar-muscles', name: 'hypothenar muscles', latin: 'Eminentia hypothenaris (mm. abductor, flexor et opponens digiti minimi)', layer: SUP, depth: 0.2, region: 'armL', tags: ['hand'],
      info: I('Muscles forming the little-finger side of the palm: abductor, flexor and opponens digiti minimi, from the pisiform, hamate and flexor retinaculum to the fifth metacarpal and base of the little finger.', 'Abducts and flexes the little finger and cups the palm.', 'About 5 cm long and 2 cm wide.', 'Supplied by the ulnar nerve; their wasting suggests ulnar nerve damage at the elbow or in Guyon\'s canal.') },
      sweep([lp(HF, 0.08, -60, 0.011), palm(0.2245, 0.8, 0.024), palm(0.222, 0.779, 0.0215), palm(0.2222, 0.7655, 0.0185)], pf([[0, 0.005], [0.4, 0.009], [1, 0.004]]), pf([[0, 0.003], [0.45, 0.0055], [1, 0.0025]]), { up: [-0.6, 0, 1], radial: 12, tB: 0.1, amp: 0.0005 }));
    const MCb = [0.263, 0.251, 0.239, 0.228], sp = (a, b, z, r) => sweep([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z + 0.001], b], pf([[0, r * 0.5], [0.45, r], [1, r * 0.45]]), r * 0.8, { up: [0, 0, 1], radial: 8, tB: 0.15, amp: 0.0002 });
    // first dorsal interosseous: from the ulnar-dorsal side of metacarpal 1 (outside the skin's thumb capsule) to the index; then dorsal 2-4, palmar 1-3
    const dor = [sp(TP(0.012, 130, 0.017).toArray(), [0.2835, 0.762, 0.015], 0.015, 0.0055)]; for (let i = 0; i < 3; i++) dor.push(sp([(MCb[i] + MCb[i + 1]) / 2, 0.825, 0.013], [(MCPx[i] + MCPx[i + 1]) / 2, 0.7625, 0.013], 0.013, 0.0035));
    for (let i = 0; i < 3; i++) dor.push(sp([(MCb[i] + MCb[i + 1]) / 2 + (i ? 0.002 : -0.0005), i ? 0.82 : 0.817, 0.022], [(MCPx[i] + MCPx[i + 1]) / 2 + 0.002, 0.764, 0.022], 0.022, 0.0027));
    add({ id: 'hand-interossei', name: 'interossei of the hand', latin: 'Musculi interossei dorsales et palmares manus', layer: DEEP, depth: 0.4, region: 'armL', tags: ['hand'],
      info: I('Seven small muscles filling the spaces between the metacarpals: four two-headed dorsal interossei and three palmar interossei, inserting on the proximal phalanges and extensor expansions.', 'Dorsal interossei spread the fingers (DAB), palmar interossei draw them together (PAD); together they flex the knuckles and straighten the finger joints.', 'Each about 5–6 cm long.', 'Supplied by the ulnar nerve; wasting of the first dorsal interosseous hollows the thumb web in ulnar palsy.') }, merge(dor));
    const lum = []; for (let i = 0; i < 4; i++) lum.push(sweep([[H.lerp(MCb[i], MCPx[i], 0.3), 0.803, 0.0245], [MCPx[i] + 0.004, 0.775, 0.0245], [MCPx[i] + 0.005, MCy[i], 0.019]], pf([[0, 0.0012], [0.45, 0.0024], [1, 0.001]]), 0.0017, { up: [0, 0, 1], radial: 8, tB: 0.2, amp: 0 }));
    add({ id: 'hand-lumbricals', name: 'lumbricals of the hand', latin: 'Musculi lumbricales manus', layer: DEEP, depth: 0.3, region: 'armL', tags: ['hand'],
      info: I('Four slender worm-like muscles arising from the flexor digitorum profundus tendons in the palm and inserting on the radial (thumb) side of the extensor expansions of the fingers.', 'Flex the knuckles while straightening the finger joints (the "tabletop" position).', 'Each 4–6 cm long and a few mm thick.', 'Unique in arising from tendons; the two lateral ones are supplied by the median nerve, the two medial ones by the ulnar nerve.') }, merge(lum));
  }

  // ============================================================ DIAPHRAGM (double dome fitted through L.organ.diaphragm domes and the opening landmarks)
  {
    const DG = L.organ.diaphragm, env = L.trunkAt(DG.rimY), wa = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const back = (phi) => Math.exp(-Math.pow(wa(phi + PI / 2) / 0.4, 2)), notch = 1 - 0.055 / (rPol(-PI / 2, env) - 0.02);
    const rRim = (phi) => (rPol(phi, env) - 0.02) * (1 - notch * back(phi));   // rim follows trunkAt(1.17) - 0.02, notched round the vertebral column
    const yRim = (phi) => DG.rimY + 0.02 * Math.sin(phi) + 0.04 * Math.exp(-Math.pow(wa(phi + PI / 2) / 0.35, 2));
    const polar = (x, z) => { const phi = Math.atan2(z - env.cz, x); return { phi, rho: Math.hypot(x, z - env.cz) / rRim(phi) }; };
    const fade = (rho) => Math.max(0, 1 - Math.pow(Math.min(1, rho), 3));
    const gs = (x, z, cx, cz, sx, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
    const f0 = (x, z) => { const q = polar(x, z), lv = 1.175 + (yRim(q.phi) - 1.175) * Math.min(1, q.rho * q.rho); return lv + fade(q.rho) * (0.09 * gs(x, z, DG.domeR[0], DG.domeR[2], 0.06, 0.06) + 0.08 * gs(x, z, DG.domeL[0], DG.domeL[2], 0.06, 0.06) - 0.022 * gs(x, z, 0.03, 0.035, 0.04, 0.03)); };
    const CAV = [-0.02, 1.26, -0.02], ESO = [0.01, 1.22, -0.045], AOR = [0, 1.19, -0.055];
    const TG = [[DG.domeR, 0.04], [DG.domeL, 0.04], [CAV, 0.025], [ESO, 0.02]];
    const basis = (k, x, z) => fade(polar(x, z).rho) * gs(x, z, TG[k][0][0], TG[k][0][2], TG[k][1], TG[k][1]);
    const A = TG.map(([p]) => TG.map((_, k) => basis(k, p[0], p[2]))), bv = TG.map(([p]) => p[1] - f0(p[0], p[2]));
    for (let c = 0; c < 4; c++) { let m = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]]; [bv[c], bv[m]] = [bv[m], bv[c]];
      for (let r = 0; r < 4; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; bv[r] -= f * bv[c]; } }
    const cf = bv.map((b, i) => b / A[i][i]);
    const hgt = (x, z) => f0(x, z) + cf.reduce((s, c, k) => s + c * basis(k, x, z), 0) - 0.005 * (gs(x, z, CAV[0], CAV[2], 0.009, 0.009) + gs(x, z, ESO[0], ESO[2], 0.007, 0.006));
    const rt = (psi) => 0.036 + 0.02 * Math.cos(3 * (psi - PI / 2)), CT = [0, 0.002];   // trefoil central tendon: anterior, right & left leaflets
    const inTendon = (x, z) => { const dx = x - CT[0], dz = z - CT[1]; return 1 - H.smoothstep(0.85, 1.05, Math.hypot(dx, dz) / rt(Math.atan2(dz, dx))); };
    function polarShell(xz, yf, NR, NP, th, tenf) {
      const P = [], NN = [], pos = [], uv = [], ten = [], idx = [], e = 0.0015;
      const nrm = (x, z) => new V3(-(yf(x + e, z) - yf(x - e, z)) / (2 * e), 1, -(yf(x, z + e) - yf(x, z - e)) / (2 * e)).normalize();
      for (let i = 0; i <= NR; i++) for (let j = 0; j < NP; j++) { const [x, z] = xz(Math.max(0.015, 1 - Math.pow(1 - i / NR, 1.4)), j / NP * 2 * PI); P.push([x, yf(x, z), z]); NN.push(nrm(x, z)); }
      for (let s = 0; s < 2; s++) for (let k = 0; k < P.length; k++) { const [x, y, z] = P[k], n = NN[k], d = s ? -th : th; pos.push(x + n.x * d, y + n.y * d, z + n.z * d); uv.push(k / P.length, s); ten.push(tenf ? tenf(x, z) : 0); }
      const at = (s, i, j) => s * P.length + i * NP + ((j + NP) % NP);
      for (let s = 0; s < 2; s++) for (let i = 0; i < NR; i++) for (let j = 0; j < NP; j++) { const w = NN[i * NP + j].clone(); if (s) w.negate(); quad(idx, pos, at(s, i, j), at(s, i, j + 1), at(s, i + 1, j), at(s, i + 1, j + 1), w); }
      for (let s = 0; s < 2; s++) for (let j = 1; j < NP - 1; j++) tri(idx, pos, at(s, 0, 0), at(s, 0, j), at(s, 0, j + 1), new V3(0, s ? -1 : 1, 0));
      for (let j = 0; j < NP; j++) { const [x, , z] = P[NR * NP + j]; quad(idx, pos, at(0, NR, j), at(0, NR, j + 1), at(1, NR, j), at(1, NR, j + 1), new V3(x - CT[0], 0, z - CT[1])); }
      return mk(pos, uv, ten, idx);
    }
    const thD = 0.0022;
    const dome = polarShell((rho, phi) => [rho * rRim(phi) * Math.cos(phi), env.cz + rho * rRim(phi) * Math.sin(phi)], hgt, 24, 80, thD, inTendon);
    const crus = (sx, pts) => sweep(pts, pf([[0, 0.009], [0.5, 0.006], [1, 0.004]]), 0.004, { up: [sx * 0.5, 0, 1], radial: 10, tB: 0.4, amp: 0.0004 });
    const spine = (n, dx) => [dx, L.spine[n].y, L.spine[n].z + L.spine[n].d / 2 - 0.002];
    add({ id: 'diaphragm', name: 'Diaphragm', latin: 'Diaphragma', layer: DEEP, depth: 0.6, region: 'abdomen', mid: true, tags: ['respiration', 'thorax', 'abdomen'],
      info: I('Dome-shaped musculotendinous sheet separating the chest from the abdomen. Its muscle fibres arise from the xiphoid process, the inner surfaces of the lower six ribs and costal cartilages, the arcuate ligaments and — through the right and left crura — the upper lumbar vertebral bodies, and converge on the central tendon. The right dome sits higher, over the liver.',
        'The main muscle of breathing: contracting, it flattens and descends, enlarging the chest to draw air in; it also raises abdominal pressure for coughing, vomiting, childbirth and defecation.',
        'About 30 cm across and 2–5 mm thick; the domes reach about the 5th rib, and it descends 1–2 cm in quiet breathing and up to 10 cm in a deep breath.',
        'Supplied by the phrenic nerves ("C3, 4, 5 keeps the diaphragm alive"); irritation of it is felt as shoulder-tip pain.') },
      merge([dome, crus(-1, [[-0.016, 1.196, -0.05], spine('L1', -0.017), spine('L2', -0.016), spine('L3', -0.013)]), crus(1, [[0.016, 1.196, -0.05], spine('L1', 0.017), spine('L2', 0.014)])]));
    add({ id: 'diaphragm-central-tendon', name: 'Central tendon of the diaphragm', latin: 'Centrum tendineum', layer: DEEP, depth: 0.58, region: 'thorax', mid: true, color: H.COLORS.tendon, tags: ['respiration'],
      info: I('Thin, strong trefoil-shaped aponeurosis at the top of the diaphragm with anterior, right and left leaflets; the fibrous pericardium is fused to its upper surface and the inferior vena cava passes through it.', 'Gives all the diaphragm\'s muscle fibres a common insertion, so their contraction pulls the dome down.',
        'About 10 cm across the leaflets and ~1 mm thick.', 'Because the vena caval opening lies in the tendon, inspiration stretches it open, helping blood return to the heart.') },
      polarShell((rho, psi) => [CT[0] + 0.98 * rho * rt(psi) * Math.cos(psi), CT[1] + 0.98 * rho * rt(psi) * Math.sin(psi)], (x, z) => hgt(x, z) + thD + 0.0011, 8, 60, 0.0007));
    const ringAt = (c, rx, rz, up) => { const n = v(up).normalize(), e1 = new V3(1, 0, 0).addScaledVector(n, -n.x).normalize(), e2 = new V3().crossVectors(n, e1), pts = [];
      for (let k = 0; k < 20; k++) { const a = k / 20 * 2 * PI; pts.push(v(c).addScaledVector(e1, rx * Math.cos(a)).addScaledVector(e2, rz * Math.sin(a))); } return sweep(pts, 0.0024, 0.0022, { closed: true, up: n, radial: 8, n: 2, bulge: 0, amp: 0 }); };
    const nAt = (p) => { const e = 0.0015; return [-(hgt(p[0] + e, p[2]) - hgt(p[0] - e, p[2])) / (2 * e), 1, -(hgt(p[0], p[2] + e) - hgt(p[0], p[2] - e)) / (2 * e)]; };
    add({ id: 'diaphragm-caval-opening', name: 'Caval opening of the diaphragm', latin: 'Foramen venae cavae', layer: DEEP, depth: 0.6, region: 'thorax', mid: true, color: H.COLORS.tendon, tags: ['respiration', 'opening'],
      info: I('Opening in the central tendon at about the T8 level, just right of the midline, transmitting the inferior vena cava and branches of the right phrenic nerve.', 'Lets the inferior vena cava through; its tendinous rim is pulled open during inspiration.', 'About 2.5 cm across.', 'The highest of the three large openings: "I 8 10 Eggs At 12" — IVC T8, oesophagus T10, aorta T12.') },
      ringAt(CAV, 0.0125, 0.0125, nAt(CAV)));
    add({ id: 'diaphragm-esophageal-hiatus', name: 'Oesophageal hiatus', latin: 'Hiatus oesophageus', layer: DEEP, depth: 0.6, region: 'thorax', mid: true, tags: ['respiration', 'opening'],
      info: I('Oval opening in the muscular part of the diaphragm at about T10, formed by a sling of right-crus fibres, transmitting the oesophagus and the vagal trunks.', 'Its muscular sling acts as an external lower oesophageal sphincter, helping to prevent acid reflux.', 'About 2.5 × 1.5 cm.', 'Widening of the hiatus lets the top of the stomach slide into the chest — a sliding hiatus hernia, a common cause of heartburn.') },
      ringAt(ESO, 0.0085, 0.011, nAt(ESO)));
    add({ id: 'diaphragm-aortic-hiatus', name: 'Aortic hiatus (median arcuate ligament)', latin: 'Hiatus aorticus', layer: DEEP, depth: 0.6, region: 'thorax', mid: true, color: H.COLORS.tendon, tags: ['respiration', 'opening'],
      info: I('Arched opening behind the diaphragm at T12, bounded in front by the median arcuate ligament that joins the two crura across the vertebral column; it transmits the aorta, the thoracic duct and often the azygos vein.', 'Lets the aorta pass behind the muscle rather than through it, so breathing does not squeeze it.', 'About 2.5–3 cm across.',
        'A low-lying median arcuate ligament can compress the coeliac trunk, causing pain after meals (median arcuate ligament syndrome).') },
      ringAt(AOR, 0.0135, 0.0125, [0, 1, 0]));
  }

  return g;
});
