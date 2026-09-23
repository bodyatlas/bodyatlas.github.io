/* systems/ear.js - BOTH ears. Outer ear (sculpted auricle, S-shaped canal, conical eardrum), middle ear (tympanic
   cavity, malleus/incus/stapes chain, tensor tympani, stapedius, Eustachian tube, oval & round windows) and inner ear
   (2.5-turn cochlea with scala vestibuli / scala tympani / cochlear duct and modiolus, vestibule with utricle and
   saccule, three semicircular canals with ampullae, cochlear and vestibular nerves to the internal acoustic meatus),
   plus a ~500x magnified organ-of-Corti inset floating beside the left ear. The LEFT ear is built from L.ear and the
   RIGHT is mirrored with H.pair. System 'sensory', tags ['ear'], region 'head' (inset: 'body'). Deterministic. */
ANATOMY.register('ear', { name: 'Ear', description: 'Outer, middle and inner ear on both sides, with a magnified organ of Corti' }, function (THREE, H, L, ctx) {
  const E = L.ear;
  const root = H.group('ear');
  const gOuter = H.group('ear-outer'), gMiddle = H.group('ear-middle'), gInner = H.group('ear-inner'), gInset = H.group('ear-inset');
  root.add(gOuter, gMiddle, gInner, gInset);

  // ------------------------------------------------------------ small vector / math helpers (arrays [x,y,z])
  const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
  const nrm = (a) => mul(a, 1 / vlen(a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lerp3 = (a, b, t) => add(mul(a, 1 - t), b, t);
  const D2R = Math.PI / 180;
  const bump = (d, w) => Math.exp(-(d * d) / (w * w));
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    const t = H.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  const DS = THREE.DoubleSide;

  // bilateral part: builds LEFT from the spec, mirrors the RIGHT (ids -l / -r). matFn gives each side its own material.
  function pairAdd(g, spec) {
    const s = Object.assign({ system: 'sensory', region: 'head' }, spec);
    s.tags = ['ear'].concat(spec.tags || []);
    const mf = s.matFn; delete s.matFn;
    if (mf) s.material = mf();
    const [l, r] = H.pair(s);
    if (mf) r.material = mf();
    g.add(l, r); return [l, r];
  }
  function single(g, spec) {
    const s = Object.assign({ system: 'sensory', region: 'body', side: 'M' }, spec);
    s.tags = ['ear', 'inset'].concat(spec.tags || []);
    const m = H.part(s); g.add(m); return m;
  }

  // ============================================================ OUTER EAR
  /* Auricle: a squashed sphere mapped onto an oval plate 62 x 35 mm (local x = lateral relief, y = up, z = anterior),
     then sculpted with a height field: concha bowl, crus of helix, helix rim, scapha, antihelix with its two crura,
     triangular fossa, tragus, antitragus, intertragic notch and a thick soft lobule. */
  function auricleGeom() {
    const au = 0.0175, av = 0.031;
    const concha = (u, v) => 1 - H.smoothstep(0.5, 1.15, Math.hypot((u - 0.0045) / 0.0085, (v + 0.002) / 0.011));
    function reliefFront(u, v, U, V, rho) {
      let h = 0;
      let a = Math.atan2(V, U); if (a < -0.35) a += Math.PI * 2;                       // 0 = anterior, pi/2 = top, pi = posterior
      h -= 0.0065 * concha(u, v);                                                        // concha bowl (leads to the canal)
      h += 0.003 * bump(segDist(u, v, 0.0175, 0.0025, 0.003, 0.0045), 0.0017);           // crus of helix crossing the concha
      const helixMask = H.smoothstep(0.1, 0.5, a) * (1 - H.smoothstep(4.3, 4.8, a));
      h += 0.0032 * bump(rho - 0.9, 0.075) * helixMask;                                 // helix: rolled rim
      h -= 0.0012 * bump(rho - 0.76, 0.06) * helixMask;                                 // scapha groove
      const ahMask = H.smoothstep(0.95, 1.25, a) * (1 - H.smoothstep(4.1, 4.5, a));
      h += 0.0026 * bump(rho - 0.6, 0.07) * ahMask;                                     // antihelix + superior crus
      h += 0.0022 * bump(segDist(U, V, 0.2, 0.32, 0.72, 0.52), 0.07);                   // inferior crus of antihelix
      h -= 0.0012 * (1 - H.smoothstep(0.4, 1.0, Math.hypot((U - 0.35) / 0.28, (V - 0.62) / 0.16)));   // triangular fossa
      h += 0.004 * (1 - H.smoothstep(0.45, 1.0, Math.hypot((u - 0.0155) / 0.0035, (v + 0.004) / 0.0055)));  // tragus
      h += 0.0025 * (1 - H.smoothstep(0.4, 1.0, Math.hypot((u - 0.003) / 0.004, (v + 0.0145) / 0.003)));    // antitragus
      h -= 0.002 * (1 - H.smoothstep(0.3, 1.0, Math.hypot((u - 0.011) / 0.003, (v + 0.011) / 0.003)));      // intertragic notch
      h += 0.0008 * H.smoothstep(-0.014, -0.024, v);                                    // soft lobule bulge
      return h;
    }
    const reliefBack = (u, v) => -0.0045 * concha(u, v);                                // eminentia conchae on the back
    const g = H.blob(1, {
      ws: 84, hs: 60, deform: (p) => {
        const V = p.y, U = p.z, face = p.x;
        const s = 1 - 0.3 * Math.pow(Math.max(0, -V), 1.3);                               // egg outline: narrow lobule
        const u = U * au * s, v = V * av;
        const rho = Math.min(1, Math.hypot(U, V));
        const T = 0.0018 + 0.0018 * H.smoothstep(-0.012, -0.024, v);                    // half thickness; lobule is fat
        const front = H.smoothstep(-0.3, 0.3, face);
        const x = face * T + front * reliefFront(u, v, U, V, rho) + (1 - front) * reliefBack(u, v);
        return new THREE.Vector3(x, v, u);
      }
    });
    H.displace(g, (p) => 0.00008 * H.fbm(p.x * 600 + 3.1, p.y * 600, p.z * 600, 2));  // faint skin texture
    g.rotateX(-15 * D2R);                                                               // long axis tilted back ~15 deg
    g.rotateY(-15 * D2R);                                                               // posterior edge stands off the head
    g.translate(E.auricleCenterL[0], E.auricleCenterL[1], E.auricleCenterL[2]);
    return g;
  }
  pairAdd(gOuter, {
    id: 'auricle', name: 'auricle', latin: 'Auricula', layer: H.LAYER.SKIN, depth: 0.3, geometry: auricleGeom(), color: H.COLORS.ear, parent: 'outer-ear', tags: ['outer-ear'],
    info: {
      description: 'The visible outer ear: a plate of elastic cartilage covered by thin skin and folded into the curled helix rim, the inner antihelix ridge, the deep concha bowl that funnels into the ear canal, the small tragus flap in front and the soft, cartilage-free lobule below.',
      function: 'Collects sound and, through its folds, filters it in a direction-dependent way that helps locate sounds above, below and behind the head.',
      size: 'About 62 mm tall and 35 mm wide; stands off the head at 20-30 degrees; cartilage 0.5-1 mm thick.',
      notes: 'The auricle keeps growing slowly throughout life (about 0.2 mm a year), which is why ears look larger in old age. A blow that strips the perichondrium off the cartilage causes a haematoma that scars into a "cauliflower ear".'
    }
  });

  // Ear canal: gentle S-bend, outer third cartilaginous (up and forward), inner two-thirds bony (down and forward)
  const canalPts = [E.canalOuterL, [0.0665, 1.6315, -0.0105], [0.059, 1.6313, -0.0125], [0.054, 1.6302, -0.0135], E.canalInnerL];
  const canalG = H.tube(canalPts, t => 0.0038 - 0.0008 * bump(t - 0.55, 0.25), { radial: 16, step: 0.0012 });
  pairAdd(gOuter, {
    id: 'ear-canal', name: 'ear canal', latin: 'Meatus acusticus externus', layer: H.LAYER.ORGAN, depth: 0.1, geometry: canalG, parent: 'outer-ear', tags: ['outer-ear'],
    matFn: () => H.mat({ color: '#e2c3b2', opacity: 0.45, roughness: 0.7 }),
    info: {
      description: 'The external acoustic meatus: a slightly S-shaped tube from the concha to the eardrum. Its outer third is cartilage carrying hairs, sebaceous and ceruminous (wax) glands; the inner two-thirds run through the temporal bone under thin, hairless skin.',
      function: 'Conducts airborne sound to the eardrum and, by its length, resonates at about 3 kHz to boost speech-range frequencies by 10-15 dB.',
      size: 'About 25 mm long and 7 mm in diameter, narrowest at the bony isthmus.',
      notes: 'Because the canal curves, clinicians pull the auricle up and back to straighten it before looking in with an otoscope (down and back in infants).'
    }
  });

  // Tympanic membrane: shallow cone, apex (umbo) pulled medially by the malleus handle; faces laterally, down and forward
  const drumC = E.tympanicMembraneL;
  const drumN = nrm([-1, 0.55, -0.35]);                                                 // medial normal = apex direction
  const drumUp = nrm(sub([0, 1, 0], mul(drumN, drumN[1])));                             // 'up' within the drum plane
  const umbo = add(drumC, drumN, 0.0022);
  function drumGeom() {
    const g = H.lathe([[0.0049, 0], [0.0045, 0.0001], [0.0036, 0.0006], [0.0022, 0.0014], [0.0009, 0.002], [0, 0.0022]], { segments: 40 });
    g.scale(0.9, 1, 1);
    H.aim(g, drumN); g.translate(drumC[0], drumC[1], drumC[2]);
    return g;
  }
  pairAdd(gOuter, {
    id: 'tympanic-membrane', name: 'eardrum', latin: 'Membrana tympanica', layer: H.LAYER.ORGAN, depth: 0.2, geometry: drumGeom(), parent: 'outer-ear', tags: ['outer-ear'],
    matFn: () => H.mat({ color: H.COLORS.eardrum, opacity: 0.6, roughness: 0.35, side: DS }),
    info: {
      description: 'The eardrum: a thin, pearly-grey, cone-shaped membrane closing the inner end of the ear canal, its apex (the umbo) pulled inward by the attached handle of the malleus. It has three layers: outer skin, a middle fibrous layer and inner mucosa.',
      function: 'Vibrates with incoming sound and passes the vibration to the ossicular chain.',
      size: 'About 9-10 mm across and 0.1 mm thick, set obliquely at roughly 55 degrees to the canal floor.',
      notes: 'Otoscopic landmarks are the malleus handle and the "cone of light" reflection in the antero-inferior quadrant; fluid in the middle ear makes the drum dull and bulging.'
    }
  });

  // ============================================================ MIDDLE EAR
  const cavC = [0.0425, 1.632, -0.0145];
  const cavG = H.blob([0.0045, 0.0075, 0.007], { ws: 28, hs: 20, deform: p => 1 - 0.18 * H.smoothstep(0.1, 1, -p.y) - 0.1 * H.smoothstep(0.3, 1, p.z) });
  H.translate(cavG, cavC);
  pairAdd(gMiddle, {
    id: 'middle-ear-cavity', name: 'middle ear cavity', latin: 'Cavitas tympani', layer: H.LAYER.ORGAN, depth: 0.3, geometry: cavG, parent: 'middle-ear', tags: ['middle-ear'],
    matFn: () => H.mat({ color: '#cfe0ea', opacity: 0.22, roughness: 0.5 }),
    info: {
      description: 'The tympanic cavity: an air-filled, mucosa-lined space in the temporal bone between the eardrum and the inner ear, bridged by the three ossicles. Its upper extension (the epitympanic recess or attic) holds the malleus head and incus body; behind, it opens into the mastoid air cells and in front into the Eustachian tube.',
      function: 'Houses the ossicular chain and keeps air at atmospheric pressure on the inner side of the eardrum.',
      size: 'About 15 mm high and 15 mm front-to-back but only 2-6 mm wide; volume 1-2 ml.',
      notes: 'Otitis media is infection of this space. The facial nerve runs in a thin bony canal along its medial wall, so it is at risk in ear surgery.'
    }
  });

  // --- ossicles
  const latProc = add(add(drumC, drumUp, 0.0042), drumN, -0.0004);                      // lateral process of the malleus at the drum's upper rim
  const malHead = [0.0462, 1.6372, -0.0143];
  function malleusGeom() {
    const handle = H.tube([umbo, lerp3(umbo, latProc, 0.5), latProc], t => 0.00042 + 0.0003 * t, { radial: 10, tubular: 12 });
    const neck = H.tube([latProc, lerp3(latProc, malHead, 0.5), malHead], t => 0.00055 + 0.0002 * t, { radial: 10, tubular: 8 });
    const head = H.blob([0.0011, 0.0013, 0.0011], { ws: 20, hs: 14, deform: p => 1 - 0.12 * H.smoothstep(0.2, 1, -p.z) });
    H.translate(head, malHead);
    const lat = H.sphere(0.00055, 12, 8); H.translate(lat, add(latProc, [0.0003, 0, 0]));
    const antTip = add(latProc, [-0.0004, -0.0008, 0.0022]);
    const ant = H.tube([add(latProc, [-0.0002, -0.0004, 0]), antTip], t => 0.00035 * (1 - 0.7 * t), { radial: 8, tubular: 6 });
    return H.merge([handle, neck, head, lat, ant]);
  }
  pairAdd(gMiddle, {
    id: 'malleus', name: 'malleus', latin: 'Malleus', layer: H.LAYER.ORGAN, depth: 0.4, geometry: malleusGeom(), color: H.COLORS.ossicle, parent: 'middle-ear', tags: ['middle-ear', 'ossicle'],
    info: {
      description: 'The "hammer": the outermost ossicle. Its long handle (manubrium) is embedded in the eardrum down to the umbo, while its rounded head sits up in the attic and articulates with the incus. A small lateral process tents the drum at the top of the handle.',
      function: 'Transfers eardrum vibrations to the incus.',
      size: 'About 8 mm long and 25 mg, the largest ossicle.',
      notes: 'The tensor tympani tendon inserts on its handle. The three ossicles are the only bones that are already adult-sized at birth.'
    }
  });

  const incBody = [0.0450, 1.6370, -0.0169];
  const stapesHead = [0.0405, 1.6325, -0.0168];
  const lentic = add(stapesHead, [0.00035, 0.00025, 0]);
  function incusGeom() {
    const body = H.blob([0.0012, 0.0013, 0.0013], { ws: 20, hs: 14, deform: p => 1 - 0.1 * H.smoothstep(0.3, 1, p.z) });
    H.translate(body, incBody);
    const shortP = H.tube([incBody, add(incBody, [0.0001, -0.0003, -0.0033])], t => 0.0008 - 0.0005 * t, { radial: 10, tubular: 6 });
    const longStart = add(incBody, [-0.0004, -0.0009, 0.0002]);
    const longP = H.tube([longStart, lerp3(longStart, lentic, 0.5), lentic], t => 0.00065 - 0.0002 * t, { radial: 10, tubular: 10 });
    const lens = H.sphere(0.00045, 12, 8); H.translate(lens, lentic);
    return H.merge([body, shortP, longP, lens]);
  }
  pairAdd(gMiddle, {
    id: 'incus', name: 'incus', latin: 'Incus', layer: H.LAYER.ORGAN, depth: 0.4, geometry: incusGeom(), color: H.COLORS.ossicle, parent: 'middle-ear', tags: ['middle-ear', 'ossicle'],
    info: {
      description: 'The "anvil": the middle ossicle. Its body articulates with the malleus head, a short process points backwards into the attic, and a long process descends parallel to the malleus handle to end in the knob-like lenticular process that meets the stapes.',
      function: 'Links malleus to stapes, adding lever action to the chain.',
      size: 'About 7 mm long, 27 mg.',
      notes: 'Its long process has the poorest blood supply of the chain and is the part most often eroded by chronic middle-ear disease, breaking the ossicular link.'
    }
  });

  const stapesAxis = nrm([-1, 0.35, -0.25]);
  const stapesLen = 0.0033;
  const ovalWin = add(stapesHead, stapesAxis, stapesLen);
  function stapesGeom() {
    const L0 = stapesLen;                                                                // local: head at y=0, footplate at y=L0, z = antero-posterior
    const head = H.sphere(0.00048, 12, 8); head.translate(0, 0.0003, 0);
    const neck = H.cylinder(0.00035, 0.00042, 0.0007, 10); neck.translate(0, 0.0009, 0);
    const crus = (sgn, r) => H.tube([[0, 0.0011, sgn * 0.00025], [0, 0.0019, sgn * 0.0009], [0, L0 - 0.0006, sgn * 0.00125], [0, L0 - 0.0001, sgn * 0.0012]], r, { radial: 8, tubular: 10 });
    const plate = H.blob([0.0007, 0.00018, 0.0015], { ws: 16, hs: 8 }); plate.translate(0, L0 - 0.0001, 0);
    const g = H.merge([head, neck, crus(1, 0.00026), crus(-1, 0.0003), plate]);
    return H.span(g, stapesHead, ovalWin);
  }
  pairAdd(gMiddle, {
    id: 'stapes', name: 'stapes', latin: 'Stapes', layer: H.LAYER.ORGAN, depth: 0.4, geometry: stapesGeom(), color: H.COLORS.ossicle, parent: 'middle-ear', tags: ['middle-ear', 'ossicle'],
    info: {
      description: 'The "stirrup": the innermost and smallest ossicle. Its head receives the incus; two slender crura (anterior and posterior) run down to an oval footplate that sits in the oval window, held by the annular ligament.',
      function: 'Pistons in the oval window, driving pressure waves into the perilymph of the inner ear.',
      size: 'About 3.3 mm long; footplate 3 x 1.4 mm; weight 3 mg, the smallest bone in the body.',
      notes: 'In otosclerosis new bone fixes the footplate, causing conductive hearing loss; a stapedectomy replaces it with a tiny piston prosthesis.'
    }
  });

  // --- middle-ear muscles
  const ttPts = [[0.0295, 1.6338, -0.0035], [0.0345, 1.6335, -0.0085], [0.0385, 1.6337, -0.0118], [0.0412, 1.6338, -0.0128], [0.0448, 1.6338, -0.0138], add(latProc, [-0.0005, -0.001, -0.0002])];
  const ttG = H.tube(ttPts, t => t < 0.62 ? 0.0004 + 0.00075 * Math.sin(Math.PI * t / 0.62) : 0.0004 - 0.0001 * (t - 0.62) / 0.38, { radial: 10, step: 0.001 });
  pairAdd(gMiddle, {
    id: 'tensor-tympani', name: 'tensor tympani', latin: 'Musculus tensor tympani', layer: H.LAYER.MUSCLE_DEEP, depth: 0.9, geometry: ttG, color: H.COLORS.muscleDeep, parent: 'middle-ear', tags: ['middle-ear', 'muscle'],
    info: {
      description: 'A small pennate muscle lying in a bony semicanal just above the Eustachian tube; its tendon turns sharply laterally around the cochleariform process to insert on the upper part of the malleus handle.',
      function: 'Pulls the malleus inward, tensing the eardrum and damping loud low-frequency sound and the noise of chewing.',
      size: 'About 20-25 mm long and 1.5 mm wide.',
      notes: 'Supplied by the mandibular division of the trigeminal nerve (CN V3), unlike the stapedius, which is a facial-nerve muscle.'
    }
  });
  const stapNeck = add(stapesHead, stapesAxis, 0.0009);
  const stG = H.tube([[0.0415, 1.6300, -0.0212], [0.0410, 1.6314, -0.0192], stapNeck], t => t < 0.6 ? 0.00035 + 0.0005 * Math.sin(Math.PI * t / 0.6) : 0.00035 - 0.0001 * (t - 0.6) / 0.4, { radial: 10, step: 0.0006 });
  pairAdd(gMiddle, {
    id: 'stapedius', name: 'stapedius', latin: 'Musculus stapedius', layer: H.LAYER.MUSCLE_DEEP, depth: 0.9, geometry: stG, color: H.COLORS.muscleDeep, parent: 'middle-ear', tags: ['middle-ear', 'muscle'],
    info: {
      description: 'The smallest skeletal muscle in the body, hidden inside the pyramidal eminence on the back wall of the middle ear; only its tendon emerges, to attach to the neck of the stapes.',
      function: 'Tilts the stapes to stiffen the ossicular chain: the acoustic reflex that protects the inner ear from loud sounds.',
      size: 'About 6 mm long and 1 mm wide.',
      notes: 'Paralysed in Bell\'s palsy (facial nerve, CN VII), causing hyperacusis: ordinary sounds seem uncomfortably loud.'
    }
  });

  // --- Eustachian tube: down, forward and medially from the anterior wall to the nasopharynx
  const etPts = [[0.0415, 1.6292, -0.0092], [0.0365, 1.6245, -0.0035], [0.0285, 1.6158, 0.0055], [0.0195, 1.6065, 0.0138], E.eustachianTubeEnd];
  const etG = H.tube(etPts, t => t < 0.3 ? 0.0015 - 0.0004 * (t / 0.3) : 0.0011 + 0.0017 * Math.pow((t - 0.3) / 0.7, 1.5), { radial: 12, step: 0.0018 });
  pairAdd(gMiddle, {
    id: 'eustachian-tube', name: 'Eustachian tube', latin: 'Tuba auditiva', layer: H.LAYER.ORGAN, depth: 0.3, geometry: etG, color: '#d9a9a0', parent: 'middle-ear', tags: ['middle-ear'],
    info: {
      description: 'The pharyngotympanic (auditory) tube runs downward, forward and medially from the front wall of the middle ear to the side wall of the nasopharynx. Its lateral third is bone; the medial two-thirds are a cartilage-supported slit that is normally closed.',
      function: 'Equalises middle-ear pressure with the atmosphere and drains middle-ear mucus into the throat.',
      size: 'About 36 mm long; 2 mm across at the isthmus, opening as an 8 mm slit in the pharynx.',
      notes: 'Opened by the palate muscles when swallowing or yawning, the "pop" felt in an aeroplane. Shorter and more horizontal in children, which favours middle-ear infections.'
    }
  });

  // --- windows
  const ovalG = H.blob([0.0009, 0.00013, 0.0017], { ws: 20, hs: 8 }); H.aim(ovalG, stapesAxis); H.translate(ovalG, add(ovalWin, stapesAxis, 0.00012));
  pairAdd(gMiddle, {
    id: 'oval-window', name: 'oval window', latin: 'Fenestra vestibuli', layer: H.LAYER.ORGAN, depth: 0.45, geometry: ovalG, parent: 'middle-ear', tags: ['middle-ear'],
    matFn: () => H.mat({ color: H.COLORS.eardrum, opacity: 0.7, side: DS }),
    info: {
      description: 'The fenestra vestibuli: an oval opening in the bony wall between the middle ear and the vestibule of the inner ear, sealed by the stapes footplate and its annular ligament.',
      function: 'Entry point for sound energy into the perilymph of the scala vestibuli.',
      size: 'About 3 x 1.5 mm.',
      notes: 'The eardrum is about 17 times larger than the footplate; this area ratio plus the ossicular lever boosts pressure some 22-fold, matching air to fluid.'
    }
  });

  // ============================================================ INNER EAR
  // --- cochlea: 2.5 turns around an anterolateral axis, basal turn centred on the landmark
  const cochB = E.cochleaL, cochA = nrm([0.65, -0.2, 0.73]);
  const cochE1 = nrm(cross(cochA, [0, 1, 0])), cochE2 = cross(cochA, cochE1);           // e2 points down: t=0 is lateral, posterior, inferior (round window end)
  function helix(radialOffset, axialOffset, n) {
    const pts = [], turns = 2.5, phi0 = Math.PI - 0.5;
    for (let i = 0; i <= n; i++) {
      const t = i / n, phi = phi0 + turns * Math.PI * 2 * t;
      const R = (0.0040 - 0.0028 * t) + radialOffset * (1 - 0.5 * t);
      const hgt = 0.0046 * t + axialOffset * (1 - 0.5 * t);
      pts.push(add(add(cochB, cochA, hgt), add(mul(cochE1, Math.cos(phi)), mul(cochE2, Math.sin(phi))), R));
    }
    return pts;
  }
  const cochleaPts = helix(0, 0, 150);
  const cochleaG = H.tube(cochleaPts, t => 0.00095 - 0.00045 * t, { radial: 12, tubular: 150 });
  pairAdd(gInner, {
    id: 'cochlea', name: 'cochlea', latin: 'Cochlea', layer: H.LAYER.ORGAN, depth: 0.5, geometry: cochleaG, color: H.COLORS.cochlea, parent: 'inner-ear', tags: ['inner-ear', 'cochlea'],
    info: {
      description: 'The spiral organ of hearing: a bony tube coiled two and a half turns around a central core (the modiolus), like a snail shell, tapering from the wide basal turn to the apex. Inside, three fluid channels run its whole length: scala vestibuli, cochlear duct (scala media) and scala tympani.',
      function: 'Converts fluid pressure waves into nerve impulses, high frequencies at the base and low frequencies at the apex (tonotopy).',
      size: 'About 9 mm across the base and 5 mm high; uncoiled length 32-35 mm; 2.5-2.75 turns.',
      notes: 'Its apex points forward and outward; the basal turn bulges into the middle ear as the promontory. Cochlear implants thread an electrode along the scala tympani.'
    }
  });
  const modG = H.lathe([[0, 0], [0.0016, 0], [0.0015, 0.0006], [0.0007, 0.0035], [0.0004, 0.0048], [0, 0.0048]], { segments: 16 });
  H.span(modG, add(cochB, cochA, -0.0004), add(cochB, cochA, 0.0044));
  pairAdd(gInner, {
    id: 'modiolus', name: 'modiolus', latin: 'Modiolus cochleae', layer: H.LAYER.ORGAN, depth: 0.55, geometry: modG, color: H.COLORS.ossicle, parent: 'cochlea', tags: ['inner-ear', 'cochlea'],
    info: {
      description: 'The bony central pillar of the cochlea, perforated by tiny canals for the fibres of the cochlear nerve. The spiral ganglion, holding the cell bodies of the hearing neurons, lies in a spiral canal around its base.',
      function: 'Anchors the bony spiral lamina and channels nerve fibres from the organ of Corti to the internal acoustic meatus.',
      size: 'About 4-5 mm high; the spiral ganglion holds roughly 30,000 neurons.',
      notes: 'Loss of spiral ganglion cells limits how well a cochlear implant can work, because the implant stimulates these neurons directly.'
    }
  });
  const scalaVG = H.tube(helix(0, 0.00035, 110), t => 0.00034 * (1 - 0.45 * t), { radial: 7, tubular: 110 });
  const scalaTG = H.tube(helix(0, -0.00035, 110), t => 0.00034 * (1 - 0.45 * t), { radial: 7, tubular: 110 });
  const ductG = H.tube(helix(0.00045, 0, 110), t => 0.00026 * (1 - 0.4 * t), { radial: 7, tubular: 110 });
  pairAdd(gInner, {
    id: 'scala-vestibuli', name: 'scala vestibuli', latin: 'Scala vestibuli', layer: H.LAYER.ORGAN, depth: 0.6, geometry: scalaVG, color: '#eef0f3', parent: 'cochlea', tags: ['inner-ear', 'cochlea'],
    info: {
      description: 'The upper perilymph-filled channel of the cochlea, running from the oval window to the apex above the cochlear duct, from which it is separated by the very thin Reissner\'s (vestibular) membrane.',
      function: 'Carries the pressure wave from the stapes footplate toward the apex.',
      size: 'Follows all 2.5 turns; joins the scala tympani through the helicotrema at the apex.',
      notes: 'Perilymph resembles cerebrospinal fluid (sodium-rich) and communicates with the subarachnoid space through the cochlear aqueduct.'
    }
  });
  pairAdd(gInner, {
    id: 'scala-tympani', name: 'scala tympani', latin: 'Scala tympani', layer: H.LAYER.ORGAN, depth: 0.6, geometry: scalaTG, color: '#e4e8ec', parent: 'cochlea', tags: ['inner-ear', 'cochlea'],
    info: {
      description: 'The lower perilymph-filled channel of the cochlea, running from the apex (helicotrema) back to the round window, beneath the basilar membrane.',
      function: 'Returns the pressure wave to the round window; the pressure difference across the basilar membrane between the two scalae makes it vibrate.',
      size: 'Follows all 2.5 turns; widest (about 1 mm) at the base.',
      notes: 'The preferred channel for inserting a cochlear-implant electrode, entered through the round window.'
    }
  });
  pairAdd(gInner, {
    id: 'cochlear-duct', name: 'cochlear duct', latin: 'Ductus cochlearis (scala media)', layer: H.LAYER.ORGAN, depth: 0.65, geometry: ductG, color: '#8fb8d8', parent: 'cochlea', tags: ['inner-ear', 'cochlea'],
    info: {
      description: 'The membranous middle channel, triangular in cross-section, bounded by Reissner\'s membrane above, the basilar membrane below and the stria vascularis on the outer wall. It is filled with potassium-rich endolymph and carries the organ of Corti on its floor.',
      function: 'Houses the sensory organ of Corti and maintains the +80 mV endocochlear potential that powers hair-cell transduction.',
      size: 'About 35 mm long following the spiral; endolymph volume about 2 microlitres.',
      notes: 'Swelling of this duct (endolymphatic hydrops) underlies Meniere\'s disease: attacks of vertigo, tinnitus and fluctuating hearing loss.'
    }
  });

  // --- round window at the basal end of the scala tympani
  const p0 = cochleaPts[0], rwN = nrm([1, -0.45, -0.35]);
  const roundG = H.blob([0.0011, 0.00012, 0.0011], { ws: 16, hs: 8 }); H.aim(roundG, rwN); H.translate(roundG, add(p0, rwN, 0.0009));
  pairAdd(gMiddle, {
    id: 'round-window', name: 'round window', latin: 'Fenestra cochleae', layer: H.LAYER.ORGAN, depth: 0.45, geometry: roundG, parent: 'middle-ear', tags: ['middle-ear'],
    matFn: () => H.mat({ color: H.COLORS.eardrum, opacity: 0.7, side: DS }),
    info: {
      description: 'The fenestra cochleae: a round opening at the base of the scala tympani, closed by a thin, flexible secondary tympanic membrane, lying below and behind the oval window in a small niche.',
      function: 'Bulges outward when the stapes pushes in, letting the incompressible inner-ear fluid move so the basilar membrane can vibrate.',
      size: 'About 2 mm in diameter; membrane about 70 micrometres thick.',
      notes: 'A route for delivering drugs to the inner ear and the usual entry point for cochlear-implant electrodes.'
    }
  });

  // --- vestibule with utricle and saccule
  const vest = E.vestibuleL;
  const vestG = H.blob([0.0028, 0.0026, 0.0031], { ws: 24, hs: 16, deform: p => 1 - 0.1 * H.smoothstep(0.2, 1, p.z) });
  H.translate(vestG, vest);
  pairAdd(gInner, {
    id: 'vestibule', name: 'vestibule', latin: 'Vestibulum', layer: H.LAYER.ORGAN, depth: 0.5, geometry: vestG, parent: 'inner-ear', tags: ['inner-ear', 'vestibular'],
    matFn: () => H.mat({ color: H.COLORS.cochlea, opacity: 0.4, roughness: 0.5 }),
    info: {
      description: 'The central chamber of the bony labyrinth, between the cochlea in front and the semicircular canals behind, with the oval window in its lateral wall. It contains the two otolith organs, the utricle and the saccule.',
      function: 'Houses the gravity and linear-acceleration sensors and connects the cochlea to the semicircular canals.',
      size: 'About 4 mm wide, 5 mm long and 3 mm deep.',
      notes: 'Its medial wall borders the internal acoustic meatus, through which the vestibular nerves leave for the brainstem.'
    }
  });
  const utrC = add(vest, [0.0002, 0.0008, -0.0006]), sacC = add(vest, [0.0004, -0.0011, 0.0012]);
  const utrG = H.blob([0.0011, 0.0009, 0.0019], { ws: 20, hs: 14, noise: { amp: 0.04, freq: 2 } }); H.translate(utrG, utrC);
  pairAdd(gInner, {
    id: 'utricle', name: 'utricle', latin: 'Utriculus', layer: H.LAYER.ORGAN, depth: 0.6, geometry: utrG, color: '#8fb8d8', parent: 'vestibule', tags: ['inner-ear', 'vestibular'],
    info: {
      description: 'An oblong membranous sac in the upper back part of the vestibule into which all three semicircular ducts open. On its floor lies a horizontal sensory patch (macula) covered by a gelatinous membrane studded with calcium-carbonate crystals, the otoconia.',
      function: 'Senses horizontal linear acceleration and tilt of the head relative to gravity.',
      size: 'About 3-4 mm long and 2 mm across.',
      notes: 'Otoconia that break loose and fall into the posterior semicircular canal cause benign paroxysmal positional vertigo (BPPV), treated with the Epley repositioning manoeuvre.'
    }
  });
  const sacG = H.blob([0.0008, 0.0009, 0.0008], { ws: 18, hs: 12, deform: p => 1 - 0.1 * H.smoothstep(0, 1, p.y) }); H.translate(sacG, sacC);
  pairAdd(gInner, {
    id: 'saccule', name: 'saccule', latin: 'Sacculus', layer: H.LAYER.ORGAN, depth: 0.6, geometry: sacG, color: '#8fb8d8', parent: 'vestibule', tags: ['inner-ear', 'vestibular'],
    info: {
      description: 'A smaller, rounded membranous sac in the front lower part of the vestibule, joined to the cochlear duct by the tiny ductus reuniens; its macula stands vertically on its medial wall.',
      function: 'Senses vertical linear acceleration (as in a lift) and head tilt in the sagittal plane.',
      size: 'About 2-3 mm across; macula about 2 mm.',
      notes: 'Its response to loud clicks is the basis of the cervical VEMP test of vestibular function.'
    }
  });

  // --- semicircular canals: 280-degree arcs of radius L.ear.semicircularCanalRadius in three orthogonal planes, ampulla at t=0
  const sccR = E.semicircularCanalRadius;
  function sccGeom(planeNormal, outward, ampullaToward) {
    const n = nrm(planeNormal);
    const e2 = nrm(sub(outward, mul(n, dot(outward, n))));                             // in-plane direction the arc bulges toward
    let e1 = nrm(cross(n, e2));
    if (dot(e1, ampullaToward) < 0) e1 = mul(e1, -1);                                   // put the ampullary end (t=0) on this side
    const c = add(vest, e2, 0.85 * sccR);
    const pts = [], th0 = -50 * D2R, th1 = 230 * D2R, N = 40;
    for (let i = 0; i <= N; i++) { const th = th0 + (th1 - th0) * i / N; pts.push(add(add(c, e1, sccR * Math.cos(th)), e2, sccR * Math.sin(th))); }
    const g = H.tube(pts, t => 0.0006 + 0.00065 * bump(t - 0.07, 0.06), { radial: 10, tubular: 64 });
    g.userData.ampulla = pts[3];
    return g;
  }
  const sccAntG = sccGeom([1, 0, -1], [0.15, 1, 0.1], [1, 0, 1]);                       // vertical, 45 deg to sagittal, arches up; ampulla anterolateral
  const sccPostG = sccGeom([1, 0, 1], [0.5, -0.65, -0.5], [0, -1, 0]);                  // vertical, parallel to petrous axis, arches back/down; ampulla inferior
  const sccLatG = sccGeom([0, 1, -0.45], [1, 0, -0.7], [0, 0, 1]);                      // ~horizontal (30 deg anterior tilt), arches laterally back; ampulla anterior
  pairAdd(gInner, {
    id: 'semicircular-canal-anterior', name: 'anterior semicircular canal', latin: 'Canalis semicircularis anterior', layer: H.LAYER.ORGAN, depth: 0.5, geometry: sccAntG, color: H.COLORS.cochlea, parent: 'vestibule', tags: ['inner-ear', 'vestibular'],
    info: {
      description: 'The anterior (superior) semicircular canal arches upward in a vertical plane set at about 45 degrees to the midline, at right angles to the long axis of the petrous bone. Its dilated ampulla lies at the anterolateral end; its other limb joins the posterior canal in a common crus.',
      function: 'Senses rotation of the head in its own plane, such as nodding forward and down.',
      size: 'Radius of curvature about 3.2-4 mm; bony lumen about 1 mm, membranous duct 0.3 mm; ampulla about 2 mm.',
      notes: 'Its summit raises the arcuate eminence on the floor of the middle cranial fossa; a thinned roof (superior canal dehiscence) lets patients hear their own eye movements.'
    }
  });
  pairAdd(gInner, {
    id: 'semicircular-canal-posterior', name: 'posterior semicircular canal', latin: 'Canalis semicircularis posterior', layer: H.LAYER.ORGAN, depth: 0.5, geometry: sccPostG, color: H.COLORS.cochlea, parent: 'vestibule', tags: ['inner-ear', 'vestibular'],
    info: {
      description: 'The posterior semicircular canal lies in a vertical plane parallel to the long axis of the petrous bone, the most posterior of the three, with its ampulla at the lower end.',
      function: 'Senses rotation in its plane: tilting the head toward the shoulder combined with pitch.',
      size: 'Radius about 3.2-4 mm; the longest canal, about 20 mm.',
      notes: 'The canal most often affected by benign positional vertigo, because loose otoconia settle into its lowest point.'
    }
  });
  pairAdd(gInner, {
    id: 'semicircular-canal-lateral', name: 'lateral semicircular canal', latin: 'Canalis semicircularis lateralis', layer: H.LAYER.ORGAN, depth: 0.5, geometry: sccLatG, color: H.COLORS.cochlea, parent: 'vestibule', tags: ['inner-ear', 'vestibular'],
    info: {
      description: 'The lateral (horizontal) semicircular canal, tilted about 30 degrees up at the front, bulges into the middle ear above the canal of the facial nerve; its ampulla lies at the anterior end next to the utricle.',
      function: 'Senses turning the head from side to side (yaw).',
      size: 'Radius about 3.2-4 mm; the shortest canal, about 15 mm.',
      notes: 'Caloric testing irrigates the ear canal with warm or cool water to set up convection in this canal and provoke nystagmus.'
    }
  });

  // --- nerves to the internal acoustic meatus
  const vcnEnd = E.vestibulocochlearNerveEnd;
  const cochNerveStart = add(cochB, cochA, -0.0008);
  const cochNerveG = H.tube([cochNerveStart, [0.0305, 1.6302, -0.0168], [0.025, 1.6275, -0.0188], vcnEnd], t => 0.0007 + 0.0004 * t, { radial: 10, step: 0.001 });
  pairAdd(gInner, {
    id: 'cochlear-nerve', name: 'cochlear nerve', latin: 'Nervus cochlearis', layer: H.LAYER.NERVE, depth: 0.5, geometry: cochNerveG, color: H.COLORS.nerve, parent: 'inner-ear', tags: ['inner-ear', 'nerve'],
    info: {
      description: 'The hearing part of the vestibulocochlear nerve (CN VIII): axons of the spiral ganglion neurons gather in the modiolus and run medially through the internal acoustic meatus to the cochlear nuclei of the brainstem.',
      function: 'Carries frequency-coded auditory signals from the hair cells to the brain.',
      size: 'About 30,000 fibres; about 1 mm in diameter at the meatus.',
      notes: 'A vestibular schwannoma ("acoustic neuroma") growing in the internal acoustic meatus typically presents with one-sided hearing loss and tinnitus.'
    }
  });
  const vestNerveStart = add(vest, [-0.0024, 0.0002, -0.0006]);
  const vestNerveMain = H.tube([vestNerveStart, [0.027, 1.6325, -0.0197], [0.0225, 1.6272, -0.0205], add(vcnEnd, [0, 0.0006, -0.0005])], t => 0.0006 + 0.0004 * t, { radial: 10, step: 0.001 });
  const twig = (from, to) => H.tube([from, lerp3(from, to, 0.5), to], 0.00025, { radial: 6, tubular: 6 });
  const infStart = add(vestNerveStart, [0.0005, -0.001, 0]);
  const vestNerveG = H.merge([vestNerveMain, twig(vestNerveStart, sccAntG.userData.ampulla), twig(vestNerveStart, sccLatG.userData.ampulla), twig(vestNerveStart, utrC),
    twig(infStart, sccPostG.userData.ampulla), twig(infStart, sacC)]);
  pairAdd(gInner, {
    id: 'vestibular-nerve', name: 'vestibular nerve', latin: 'Nervus vestibularis', layer: H.LAYER.NERVE, depth: 0.5, geometry: vestNerveG, color: H.COLORS.nerve, parent: 'inner-ear', tags: ['inner-ear', 'nerve'],
    info: {
      description: 'The balance part of CN VIII: a superior division from the utricle and the anterior and lateral ampullae, and an inferior division from the saccule and the posterior ampulla. The cell bodies form Scarpa\'s ganglion in the internal acoustic meatus, where it joins the cochlear nerve.',
      function: 'Carries signals of head rotation, tilt and acceleration to the vestibular nuclei and cerebellum.',
      size: 'About 20,000 fibres.',
      notes: 'Vestibular neuritis, a viral inflammation of this nerve, causes days of severe spinning vertigo without hearing loss.'
    }
  });

  // ============================================================ ORGAN OF CORTI INSET (~500x) beside the left ear
  const IC = [0.30, 1.63, -0.02];
  const at = (g, x, y, z) => { g.translate(IC[0] + x, IC[1] + y, IC[2] + z); return g; };
  const bmTop = -0.005;
  const zRows = [-0.0165, -0.0085, -0.0005, 0.0075, 0.0155];
  const ohcRowsX = [0.0035, 0.0095, 0.0155];
  const ohcCells = []; ohcRowsX.forEach((x, ri) => zRows.forEach(z => ohcCells.push({ x, z: z + (ri === 1 ? 0.0035 : 0) })));

  // frame: floor (bony spiral lamina / floor of the section), outer wall (stria vascularis) and Reissner's membrane
  function frameGeom() {
    const floor = H.box(0.05, 0.001, 0.044, 1); at(floor, -0.003, -0.0185, 0);
    const wall = H.box(0.0012, 0.046, 0.044, 1); at(wall, 0.0215, 0.004, 0);
    const rl = Math.hypot(0.048, 0.016), rm = H.box(rl, 0.0004, 0.044, 1); rm.rotateZ(Math.atan2(0.016, 0.048)); at(rm, -0.002, 0.016, 0);
    return H.merge([floor, wall, rm]);
  }
  single(gInset, {
    id: 'inset-organ-of-corti', name: 'Organ of Corti (magnified section)', latin: 'Organum spirale', layer: H.LAYER.ORGAN, depth: 0.1, geometry: frameGeom(), parent: 'inset-organ-of-corti',
    material: H.mat({ color: '#9fb4c8', opacity: 0.22, side: DS, roughness: 0.4 }),
    info: {
      description: 'A slice through the cochlear duct magnified about 500 times, floating beside the left ear. The faint frame shows the boundaries of the scala media: the floor, the outer wall (stria vascularis) and the sloping Reissner\'s membrane above. On the basilar membrane sits the organ of Corti with its inner and outer hair cells, pillar cells, the tectorial membrane and the nerve fibres leaving toward the modiolus.',
      function: 'The site where mechanical vibration is converted into nerve impulses.',
      size: 'Real organ of Corti about 0.1-0.2 mm wide and 35 mm long along the spiral; here about 50 mm wide.',
      notes: 'Alfonso Corti described it in 1851; the hair cells number only about 15,500 per ear and do not regenerate in mammals.'
    }
  });

  const bmG = H.box(0.048, 0.002, 0.04, 10); H.displace(bmG, (p, n) => 0.00015 * Math.sin(p.z * 900) * Math.abs(n.y)); at(bmG, -0.004, bmTop - 0.001, 0);
  single(gInset, {
    id: 'inset-basilar-membrane', name: 'Basilar membrane (magnified)', latin: 'Lamina basilaris', layer: H.LAYER.ORGAN, depth: 0.5, geometry: bmG, color: '#e0b8a0', parent: 'inset-organ-of-corti',
    info: {
      description: 'The fibrous sheet stretched across the cochlear duct from the bony spiral lamina to the outer wall, on which the organ of Corti sits. Its radial fibres are short and stiff at the base of the cochlea and long and floppy at the apex.',
      function: 'Its graded stiffness turns each sound frequency into a peak of vibration at one place along the spiral: the cochlea\'s frequency map.',
      size: 'Real width 0.1 mm at the base to 0.5 mm at the apex; about 35 mm long.',
      notes: 'Georg von Bekesy won the 1961 Nobel Prize for showing the travelling wave that runs along this membrane.'
    }
  });
  const limbG = H.box(0.008, 0.011, 0.04, 3); H.displace(limbG, (p, n) => 0.0002 * H.fbm(p.x * 900, p.y * 900, p.z * 900, 2)); at(limbG, -0.024, bmTop + 0.0055, 0);
  single(gInset, {
    id: 'inset-spiral-limbus', name: 'Spiral limbus (magnified)', latin: 'Limbus spiralis', layer: H.LAYER.ORGAN, depth: 0.5, geometry: limbG, color: '#d9c4ad', parent: 'inset-organ-of-corti',
    info: {
      description: 'The thickened connective-tissue shelf on the modiolar side of the cochlear duct, from whose lip the tectorial membrane hangs.',
      function: 'Anchors the tectorial membrane over the hair cells.',
      size: 'Real height about 50 micrometres.',
      notes: 'Its interdental cells secrete the tectorial membrane during development.'
    }
  });
  const tmG = H.loft([{ y: 0, rx: 0.0033, rz: 0.019, n: 3 }, { y: 0.014, rx: 0.0022, rz: 0.0192, n: 3 }, { y: 0.028, rx: 0.0016, rz: 0.019, n: 3 }, { y: 0.041, rx: 0.0009, rz: 0.018, n: 2.5 }], { radial: 24, subdiv: 5, axis: 'x' });
  H.displace(tmG, (p) => new THREE.Vector3(p.x, p.y - 0.0016 * Math.pow(p.x / 0.041, 2), p.z)); at(tmG, -0.022, 0.0118, 0);
  single(gInset, {
    id: 'inset-tectorial-membrane', name: 'Tectorial membrane (magnified)', latin: 'Membrana tectoria', layer: H.LAYER.ORGAN, depth: 0.4, geometry: tmG, parent: 'inset-organ-of-corti',
    material: H.mat({ color: '#f0e0c8', opacity: 0.55, roughness: 0.3 }),
    info: {
      description: 'A gelatinous, acellular ribbon anchored to the spiral limbus that floats over the hair cells; the tallest stereocilia of the outer hair cells are embedded in its underside, while those of the inner hair cells stand free just beneath it.',
      function: 'Shears against the stereocilia when the basilar membrane moves, bending them and opening their ion channels.',
      size: 'Real thickness about 30 micrometres, width 0.1-0.2 mm.',
      notes: 'Mutations in its collagen and tectorin proteins cause inherited forms of deafness.'
    }
  });
  function ihcGeom() {
    const parts = [];
    for (const z of zRows) {
      const cell = H.loft([{ y: 0, rx: 0.0021 }, { y: 0.0035, rx: 0.003 }, { y: 0.0075, rx: 0.0027 }, { y: 0.0105, rx: 0.0017 }, { y: 0.0115, rx: 0.0018 }], { radial: 16, subdiv: 4 });
      at(cell, -0.013, bmTop, z); parts.push(cell);
      [[-0.0006, 0.0015], [0, 0.0022], [0.0006, 0.003]].forEach(([dx, h]) => [-0.0005, 0.0005].forEach(dz => {
        const c = H.cylinder(0.00026, 0.0003, h, 6); at(c, -0.013 + dx, bmTop + 0.0115 + h / 2, z + dz); parts.push(c);
      }));
    }
    return H.merge(parts);
  }
  single(gInset, {
    id: 'inset-inner-hair-cells', name: 'Inner hair cells (magnified)', latin: 'Cellulae sensoriae internae', layer: H.LAYER.ORGAN, depth: 0.5, geometry: ihcGeom(), color: '#d98c7a', parent: 'inset-organ-of-corti',
    info: {
      description: 'A single row of flask-shaped sensory cells, about 3,500 per ear, each crowned by a shallow line of stereocilia in three rows of graded height. Every inner hair cell is contacted by 10-20 afferent nerve fibres.',
      function: 'The true sound receptors: bending of the stereocilia opens ion channels, depolarises the cell and releases glutamate onto cochlear-nerve endings.',
      size: 'Real length about 35 micrometres; stereocilia 2-8 micrometres tall.',
      notes: 'Loss of inner hair cells causes permanent deafness because mammalian hair cells do not regenerate.'
    }
  });
  function ohcGeom() {
    const parts = [];
    for (const c of ohcCells) {
      const cell = H.capsule(0.002, 0.0075, { capSegments: 4, radial: 12 }); at(cell, c.x, bmTop + 0.00575, c.z); parts.push(cell);
      [[-0.0008, 0.0025], [0, 0.0035], [0.0008, 0.0045]].forEach(([dx, h]) => [-0.0009, 0, 0.0009].forEach(dz => {   // W-shaped bundle, tallest row outermost
        const r = H.cylinder(0.00026, 0.0003, h, 6); at(r, c.x + dx + 0.0006 * (1 - Math.abs(dz) / 0.0009), bmTop + 0.0115 + h / 2, c.z + dz); parts.push(r);
      }));
    }
    return H.merge(parts);
  }
  single(gInset, {
    id: 'inset-outer-hair-cells', name: 'Outer hair cells (magnified)', latin: 'Cellulae sensoriae externae', layer: H.LAYER.ORGAN, depth: 0.5, geometry: ohcGeom(), color: '#d98c7a', parent: 'inset-organ-of-corti',
    info: {
      description: 'Three rows of cylindrical cells, about 12,000 per ear, each topped by a V- or W-shaped bundle of stereocilia in three rows of graded height, the tallest embedded in the tectorial membrane.',
      function: 'The cochlear amplifier: the motor protein prestin makes them shorten and lengthen with each sound cycle, boosting basilar-membrane vibration up to a thousand-fold and sharpening frequency tuning.',
      size: 'Real length 25-70 micrometres (longer toward the apex), diameter about 8 micrometres.',
      notes: 'Their motion produces otoacoustic emissions, used to screen newborns for hearing. They are the first cells destroyed by loud noise and by ototoxic drugs such as gentamicin and cisplatin.'
    }
  });
  function pillarGeom() {
    const mk = (xBase, ang) => { const b = H.box(0.0022, 0.0125, 0.038, 1); b.translate(0, 0.00625, 0); b.rotateZ(ang); at(b, xBase, bmTop, 0); return b; };
    return H.merge([mk(-0.0085, -20 * D2R), mk(0.0, 22 * D2R)]);
  }
  single(gInset, {
    id: 'inset-pillar-cells', name: 'Pillar cells (magnified)', latin: 'Cellulae pilares', layer: H.LAYER.ORGAN, depth: 0.5, geometry: pillarGeom(), color: '#e8c8a0', parent: 'inset-organ-of-corti',
    info: {
      description: 'Inner and outer pillar cells lean against each other to form the triangular tunnel of Corti between the inner and outer hair cells; with Deiters\' cells they make up the stiff scaffold of the organ.',
      function: 'Give the organ of Corti its rigidity and form the reticular lamina at its surface through which the stereocilia project.',
      size: 'Real height about 50 micrometres.',
      notes: 'The tunnel is crossed by thin efferent nerve fibres running from the brainstem to the outer hair cells.'
    }
  });
  function fibresGeom() {
    const parts = [];
    for (const z of zRows) parts.push(H.tube([[-0.013, bmTop + 0.001, z], [-0.0165, bmTop - 0.002, z], [-0.021, bmTop - 0.006, z], [-0.027, bmTop - 0.011, z]].map(p => add(IC, p)), 0.0005, { radial: 8, tubular: 12 }));
    for (const c of ohcCells) parts.push(H.tube([[c.x, bmTop + 0.0008, c.z], [c.x - 0.004, bmTop - 0.0025, c.z], [-0.017, bmTop - 0.0045, c.z], [-0.0255, bmTop - 0.0095, c.z]].map(p => add(IC, p)), 0.00025, { radial: 6, tubular: 12 }));
    return H.merge(parts);
  }
  single(gInset, {
    id: 'inset-cochlear-nerve-fibres', name: 'Cochlear nerve fibres (magnified)', latin: 'Neurofibrae cochleares', layer: H.LAYER.NERVE, depth: 0.3, geometry: fibresGeom(), color: H.COLORS.nerve, parent: 'inset-organ-of-corti',
    info: {
      description: 'Afferent fibres of the spiral ganglion neurons: thick type I fibres (95 per cent) each contact a single inner hair cell, while thin type II fibres branch across many outer hair cells. They leave through the habenula perforata and run to the modiolus.',
      function: 'Carry the electrical signal from the hair cells toward the brainstem, each fibre tuned to one frequency.',
      size: 'Type I fibres 2-4 micrometres, myelinated; about 30,000 per cochlea.',
      notes: 'Loud noise can destroy these synapses before any hair cell dies: "hidden hearing loss" with a normal audiogram but poor hearing in background noise.'
    }
  });

  return root;
});
