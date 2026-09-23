/* systems/nervous_peripheral.js - Peripheral nervous system: cranial nerves beyond their brainstem roots, the 31 pairs of
   spinal nerves, cervical/brachial/lumbar/sacral plexuses, named limb and trunk nerves, sympathetic trunks with ganglia,
   autonomic plexuses (cardiac, celiac, mesenteric, hypogastric), an enteric-plexus marker and a magnified neuron inset beside
   the left shoulder. Every nerve is an H.tube course along its anatomical path (colour H.COLORS.nerve, layer NERVE; cutaneous
   nerves depth 0, deep nerves depth 0.3); ganglia are small fbm blobs. All positions come from L.*; fully deterministic.
   NOT built here: cranial-nerve root stubs at the brainstem (nervous_central), the intraorbital optic nerve (eye), the
   cochlear/vestibular nerves inside the temporal bone (ear), spinal cord / cauda equina / representative DRG (nervous_central). */
ANATOMY.register('nervous_peripheral', {
  name: 'Nervous (peripheral)',
  description: 'Cranial and spinal nerves, plexuses, limb and trunk nerves, sympathetic trunks and autonomic plexuses, plus a magnified neuron'
}, function (THREE, H, L, ctx) {
  const SYS = 'nervous', LAYER = H.LAYER.NERVE, C = H.COLORS.nerve, DEEP = 0.3, SUP = 0, V = H.V;
  const root = H.group('nervous_peripheral');

  // ---------------------------------------------------------------- private helpers
  const tube = (pts, r, o) => H.tube(pts, r, Object.assign({ radial: 8, step: 0.008 }, o || {}));   // main nerves
  const fine = (pts, r, o) => H.tube(pts, r, Object.assign({ radial: 6, step: 0.005 }, o || {}));   // fine branches
  const taper = (a, b) => (t => a + (b - a) * t);
  const mirRegion = r => r === 'armL' ? 'armR' : r === 'legL' ? 'legR' : r;
  function mk(group, spec) { const m = H.part(Object.assign({ system: SYS, layer: LAYER, color: C, depth: DEEP }, spec)); group.add(m); return m; }
  // bilateral pair from a LEFT geometry; spec.parent (a base id) gets the -l/-r suffix, spec.parentM is used verbatim
  function mk2(group, spec) {
    const base = Object.assign({ system: SYS, layer: LAYER, color: C, depth: DEEP }, spec); delete base.parentM;
    const left = H.part(Object.assign({}, base, { id: spec.id + '-l', name: 'Left ' + spec.name, side: 'L', parent: spec.parent ? spec.parent + '-l' : (spec.parentM || null) }));
    const right = H.part(Object.assign({}, base, { id: spec.id + '-r', name: 'Right ' + spec.name, side: 'R', geometry: H.mirrorX(spec.geometry), region: mirRegion(spec.region), parent: spec.parent ? spec.parent + '-r' : (spec.parentM || null) }));
    group.add(left, right); return [left, right];
  }
  // small lumpy ganglion: r = [rx, ry, rz], rot optional
  function ganglion(pos, r, seed, rot) {
    const g = H.blob(r, { ws: 12, hs: 8, deform: p => 1 + 0.09 * H.fbm(p.x * 2.7 + seed, p.y * 2.7 + seed * 0.3, p.z * 2.7 + seed * 1.7, 2) });
    if (rot) H.transform(g, { rot }); g.translate(pos[0], pos[1], pos[2]); return g;
  }
  function sePt(t, rx, rz, n) { const c = Math.cos(t), s = Math.sin(t), e = 2 / n; return [rx * Math.sign(c) * Math.pow(Math.abs(c), e), rz * Math.sign(s) * Math.pow(Math.abs(s), e)]; }
  const bs = L.head.brainstem;   // axis x=0, z=-0.02, y 1.578..1.625, r 0.014
  const apex = L.eye.orbitApexL; // [0.028, 1.633, 0.035]

  // ================================================================ CRANIAL NERVES (left side built, mirrored)
  const gCN = H.group('cranial-nerves'); root.add(gCN);
  const cn = (n, name, latin, geom, info, extra) => mk2(gCN, Object.assign({ id: 'cranial-nerve-' + n, name, latin, region: 'head', geometry: geom, tags: ['cranial'], info }, extra || {}));

  // I olfactory: bulb on the cribriform plate, tract running back to the anterior perforated substance, fila down into the nose
  {
    const bulb = ganglion([0.008, 1.648, 0.054], [0.0024, 0.0022, 0.006], 1.3);
    const tract = fine([[0.0085, 1.647, 0.047], [0.010, 1.645, 0.035], [0.012, 1.642, 0.022], [0.014, 1.639, 0.012]], taper(0.0015, 0.0012));
    const fila = [[0.006, 0.058], [0.009, 0.056], [0.007, 0.051], [0.010, 0.05], [0.008, 0.06]].map(([x, z]) => fine([[x, 1.6465, z], [x + 0.001, 1.641, z + 0.001]], 0.0003, { radial: 5, step: 0.002 }));
    cn('1-olfactory', 'olfactory nerve (CN I)', 'Nervus olfactorius', H.merge([bulb, tract, ...fila]), {
      description: 'The nerve of smell. About twenty tiny bundles (fila) rise from the roof of the nasal cavity through the sieve-like cribriform plate into the olfactory bulb, which lies under the frontal lobe; the olfactory tract then runs back to the brain.',
      function: 'Carries smell from the olfactory mucosa to the olfactory cortex; it is the only sense that bypasses the thalamus.',
      size: 'Bulb 10-12 x 4 mm; tract about 3.5 cm long', notes: 'Fila are torn in head injuries that shear the cribriform plate, causing loss of smell (anosmia); a fracture there can also leak cerebrospinal fluid into the nose.' });
  }
  // II optic (orbit apex -> optic canal -> chiasm), chiasm, optic tract (chiasm -> lateral geniculate body)
  {
    const on = tube([apex, [0.021, 1.631, 0.024], [0.011, 1.629, 0.012], [0.004, 1.628, 0.006]], 0.0022, { step: 0.005 });
    cn('2-optic', 'optic nerve (CN II), intracranial part', 'Nervus opticus (pars intracranialis)', on, {
      description: 'The intracanalicular and intracranial part of the optic nerve, from the apex of the orbit through the optic canal to the optic chiasm. The part inside the orbit is built with the eye. It is really a tract of the brain, wrapped in all three meninges.',
      function: 'Carries about 1.2 million retinal ganglion-cell axons - the entire visual signal of one eye - toward the chiasm.',
      size: '4 mm in diameter with its sheath; intracranial part ~10 mm, canal ~6 mm', notes: 'Because it is bathed in cerebrospinal fluid, raised intracranial pressure swells the nerve head (papilloedema), visible with an ophthalmoscope.' }, { parentM: 'optic-chiasm' });
    const chiasmG = H.blob([0.0075, 0.0022, 0.0045], { ws: 20, hs: 10, deform: p => 1 - 0.28 * Math.max(0, 1 - Math.abs(p.x) * 2.2) * (1 - Math.abs(p.y)) });
    chiasmG.translate(L.eye.opticChiasm[0], L.eye.opticChiasm[1], L.eye.opticChiasm[2]);
    mk(gCN, { id: 'optic-chiasm', name: 'Optic chiasm', latin: 'Chiasma opticum', side: 'M', region: 'head', geometry: chiasmG, tags: ['cranial'],
      info: { description: 'The X-shaped crossing of the two optic nerves on the floor of the brain, just above the pituitary gland and in front of the pituitary stalk.',
        function: 'Fibres from the nasal half of each retina cross here so that each optic tract carries the opposite visual field.',
        size: 'About 12 mm wide, 8 mm long, 4 mm thick', notes: 'A pituitary tumour growing upward presses on the crossing fibres first, producing loss of both outer (temporal) visual fields - bitemporal hemianopia.' } });
    const tract = tube([[0.004, 1.628, 0.001], [0.011, 1.631, -0.008], [0.017, 1.636, -0.016], [0.022, 1.641, -0.023]], 0.0018, { step: 0.005 });
    cn('2-optic-tract', 'optic tract', 'Tractus opticus', tract, {
      description: 'The band of visual fibres running back from the chiasm around the cerebral peduncle to the lateral geniculate body of the thalamus, with a small branch to the midbrain for pupil reflexes.',
      function: 'Delivers the opposite half of the visual field of both eyes to the thalamus, which relays it to the visual cortex.',
      size: 'About 3 cm long, 3-4 mm wide', notes: 'Damage to one tract causes loss of the same half of the visual field in both eyes (homonymous hemianopia), the opposite side to the lesion.' }, { parentM: 'optic-chiasm' });
  }
  // III oculomotor: interpeduncular fossa -> cavernous sinus (lateral wall) -> superior orbital fissure
  cn('3-oculomotor', 'oculomotor nerve (CN III)', 'Nervus oculomotorius', tube([[0.007, 1.62, -0.002], [0.012, 1.624, 0.01], [0.017, 1.629, 0.022], apex], 0.0015, { step: 0.005 }), {
    description: 'Leaves the front of the midbrain between the cerebral peduncles, runs forward in the roof and lateral wall of the cavernous sinus beside the pituitary and enters the orbit through the superior orbital fissure.',
    function: 'Moves the eye up, down and inward (superior, inferior and medial recti, inferior oblique), lifts the upper lid (levator palpebrae) and constricts the pupil and focuses the lens via parasympathetic fibres.',
    size: 'About 3 mm thick, 2.5 cm from midbrain to orbit', notes: 'A complete third-nerve palsy gives a drooping lid and an eye that sits "down and out"; a dilated pupil with it suggests compression by an aneurysm or a herniating temporal lobe - a neurosurgical emergency.' });
  // IV trochlear: exits the DORSAL midbrain, wraps around the brainstem, then forward to the orbit
  cn('4-trochlear', 'trochlear nerve (CN IV)', 'Nervus trochlearis', fine([[0.006, 1.617, -0.035], [0.013, 1.616, -0.03], [0.019, 1.618, -0.02], [0.021, 1.622, -0.008], [0.021, 1.627, 0.006], [0.024, 1.631, 0.022], [0.029, 1.635, 0.035]], 0.0009, { step: 0.004 }), {
    description: 'The thinnest cranial nerve and the only one to leave the back of the brainstem. It winds around the midbrain, runs in the lateral wall of the cavernous sinus and enters the orbit to reach the superior oblique muscle.',
    function: 'Supplies the superior oblique, which turns the eye down and in and rotates it inward (intorsion) - essential for looking down stairs.',
    size: 'About 1 mm thick; the longest intracranial course (~7.5 cm)', notes: 'Its long, thin course makes it the cranial nerve most often damaged by closed head injury; patients tilt the head away from the weak side to fuse double images.' });
  // V trigeminal: sensory root from the lateral pons -> trigeminal ganglion over the petrous apex -> V1, V2, V3
  {
    cn('5-trigeminal', 'trigeminal nerve (CN V), root', 'Nervus trigeminus (radix sensoria et motoria)', tube([[0.018, 1.611, -0.018], [0.022, 1.612, -0.011], [0.025, 1.613, -0.005]], 0.0028, { step: 0.004 }), {
      description: 'The largest cranial nerve. Its thick sensory root and small motor root leave the side of the pons and run forward over the petrous ridge to the trigeminal (Gasserian) ganglion in Meckel\'s cave.',
      function: 'Sensation for the whole face, scalp to the vertex, cornea, teeth, mouth and the front two-thirds of the tongue; motor to the chewing muscles.',
      size: 'Sensory root about 4-5 mm wide; 1.5 cm to the ganglion', notes: 'Trigeminal neuralgia - lightning stabs of facial pain - is usually caused by a looping artery pressing on this root where it enters the pons.' });
    const gang = ganglion([0.027, 1.613, 0.0], [0.006, 0.0026, 0.0038], 2.2, [0, 0.3, 0]);
    mk2(gCN, { id: 'trigeminal-ganglion', name: 'trigeminal ganglion', latin: 'Ganglion trigeminale', region: 'head', geometry: gang, parent: 'cranial-nerve-5-trigeminal', tags: ['cranial', 'ganglion'],
      info: { description: 'A crescent-shaped sensory ganglion the size of a fingernail, lodged in a dural pocket (Meckel\'s cave) on the tip of the petrous temporal bone. It holds the cell bodies of the facial sensory neurons; its convex front edge gives off the three divisions.',
        function: 'Relay station equivalent to a dorsal root ganglion for the face: the first-order sensory neurons of touch, pain and temperature sit here.',
        size: 'About 15-20 x 5 mm', notes: 'The ganglion can be reached with a needle through the foramen ovale to inject or heat it for intractable trigeminal neuralgia; it is also where the chickenpox virus hides before shingles of the face.' } });
    // V1 ophthalmic: superior orbital fissure -> frontal nerve along the orbit roof -> supraorbital notch -> forehead; lacrimal branch
    const v1 = H.merge([
      fine([[0.028, 1.6165, 0.005], [0.027, 1.626, 0.018], [0.029, 1.638, 0.034], [0.031, 1.649, 0.055], [0.031, 1.658, 0.078], [0.03, 1.668, 0.087], [0.028, 1.685, 0.0862]], taper(0.0016, 0.0009)),
      fine([[0.029, 1.64, 0.038], [0.04, 1.646, 0.055], [0.049, 1.648, 0.072]], 0.0006),
      fine([[0.028, 1.633, 0.03], [0.018, 1.636, 0.045], [0.014, 1.64, 0.06]], 0.0006)   // nasociliary / ethmoidal branch toward the nose
    ]);
    mk2(gCN, { id: 'cranial-nerve-5-ophthalmic', name: 'ophthalmic nerve (V1)', latin: 'Nervus ophthalmicus', region: 'head', geometry: v1, parent: 'trigeminal-ganglion', tags: ['cranial'], depth: SUP,
      info: { description: 'The upper, purely sensory division of the trigeminal nerve. It passes through the superior orbital fissure and splits into frontal, lacrimal and nasociliary nerves; the frontal nerve runs along the orbit roof and emerges at the supraorbital notch onto the forehead.',
        function: 'Sensation from the forehead and scalp back to the vertex, upper eyelid, cornea and conjunctiva, bridge of the nose and the frontal and ethmoid sinuses.',
        size: 'About 2.5 mm thick, 2.5 cm to the fissure', notes: 'The corneal reflex tests V1 (the blink is via the facial nerve). Shingles in V1 (herpes zoster ophthalmicus) threatens the cornea; a lesion on the nose tip warns of eye involvement.' } });
    // V2 maxillary: foramen rotundum -> pterygopalatine fossa -> infraorbital canal -> infraorbital foramen -> cheek; superior alveolar to the upper teeth
    const v2 = H.merge([
      fine([[0.029, 1.612, 0.006], [0.031, 1.61, 0.018], [0.034, 1.611, 0.03], [0.035, 1.615, 0.048], [0.034, 1.616, 0.066], [0.032, 1.613, 0.0825], [0.027, 1.605, 0.0848], [0.0215, 1.598, 0.0882]], taper(0.0016, 0.0009)),
      fine([[0.032, 1.613, 0.0825], [0.04, 1.612, 0.0795], [0.0475, 1.614, 0.0742]], 0.0005),   // palpebral / zygomatic twig (under the lower lid and cheekbone)
      fine([[0.035, 1.612, 0.04], [0.036, 1.598, 0.055], [0.033, 1.588, 0.075], [0.027, 1.583, 0.0848]], taper(0.0007, 0.0004))   // superior alveolar nerves to the upper teeth
    ]);
    mk2(gCN, { id: 'cranial-nerve-5-maxillary', name: 'maxillary nerve (V2)', latin: 'Nervus maxillaris', region: 'head', geometry: v2, parent: 'trigeminal-ganglion', tags: ['cranial'], depth: SUP,
      info: { description: 'The middle, sensory division. It leaves the skull through the foramen rotundum, crosses the pterygopalatine fossa, runs forward in the floor of the orbit as the infraorbital nerve and emerges below the eye at the infraorbital foramen; branches drop to the upper teeth.',
        function: 'Sensation from the cheek, lower eyelid, side of the nose, upper lip, upper teeth and gums, palate, maxillary sinus and nasal cavity.',
        size: 'About 2.5 mm thick; ~5 cm from ganglion to cheek', notes: 'A blow-out fracture of the orbit floor bruises the infraorbital nerve, leaving the cheek and upper lip numb. Dentists anaesthetise its alveolar branches for upper-tooth work.' } });
    // V3 mandibular: foramen ovale -> infratemporal fossa -> inferior alveolar (mandibular canal -> mental foramen), lingual, auriculotemporal
    const v3 = H.merge([
      fine([[0.03, 1.608, 0.002], [0.033, 1.598, 0.005], [0.04, 1.59, 0.008], [0.047, 1.582, 0.007]], taper(0.0018, 0.0014)),                                             // trunk to the infratemporal fossa
      fine([[0.047, 1.582, 0.007], [0.052, 1.574, 0.012], [0.052, 1.563, 0.024], [0.044, 1.552, 0.0405], [0.0347, 1.544, 0.0558], [0.0275, 1.542, 0.0675], [0.0212, 1.548, 0.0775], [0.0139, 1.552, 0.0852]], taper(0.0012, 0.0006)),   // inferior alveolar (in the mandibular canal) -> mental nerve
      fine([[0.046, 1.583, 0.008], [0.042, 1.573, 0.022], [0.033, 1.568, 0.038], [0.022, 1.573, 0.05]], taper(0.0009, 0.0005)),                                            // lingual nerve
      fine([[0.047, 1.583, 0.006], [0.058, 1.588, -0.004], [0.066, 1.6, -0.01], [0.069, 1.62, -0.006], [0.067, 1.645, 0.004]], taper(0.0008, 0.0004)),                     // auriculotemporal nerve
      fine([[0.045, 1.586, 0.008], [0.05, 1.598, 0.012], [0.056, 1.612, 0.02]], 0.0005),                                                                                     // deep temporal (motor to temporalis)
      fine([[0.044, 1.584, 0.01], [0.038, 1.578, 0.028], [0.033, 1.574, 0.05], [0.03, 1.57, 0.072]], 0.0005)                                                                // buccal nerve (sensory to the cheek)
    ]);
    mk2(gCN, { id: 'cranial-nerve-5-mandibular', name: 'mandibular nerve (V3)', latin: 'Nervus mandibularis', region: 'head', geometry: v3, parent: 'trigeminal-ganglion', tags: ['cranial'],
      info: { description: 'The lowest and only mixed division. It drops through the foramen ovale into the infratemporal fossa and splits into the inferior alveolar nerve (which runs inside the jaw bone and exits at the chin as the mental nerve), the lingual nerve to the tongue, the auriculotemporal nerve to the temple, and motor branches to the chewing muscles.',
        function: 'Sensation from the lower lip, chin, lower teeth, front two-thirds of the tongue, cheek lining and temple; motor to masseter, temporalis, pterygoids and the mylohyoid.',
        size: 'Trunk about 3-4 mm thick; inferior alveolar nerve ~7 cm', notes: 'The inferior alveolar block at the mandibular foramen is the standard dental anaesthetic for lower teeth; it numbs the lip and chin too, and a misplaced needle can hit the lingual nerve.' } });
  }
  // VI abducens: pontomedullary junction -> up the clivus -> Dorello's canal -> inside the cavernous sinus -> lateral rectus
  cn('6-abducens', 'abducens nerve (CN VI)', 'Nervus abducens', fine([[0.005, 1.6, -0.003], [0.008, 1.61, 0.005], [0.011, 1.62, 0.011], [0.015, 1.627, 0.018], [0.02, 1.631, 0.027], [0.03, 1.632, 0.038]], 0.0009, { step: 0.004 }), {
    description: 'A slender nerve that leaves the junction of the pons and medulla, climbs the clivus inside the dura, bends sharply over the petrous apex and runs through the middle of the cavernous sinus beside the internal carotid artery to the orbit.',
    function: 'Supplies only the lateral rectus, which turns the eye outward (abduction).',
    size: 'About 1-1.5 mm thick; ~4 cm intracranial course', notes: 'Its long climb up the clivus makes it vulnerable to any rise in intracranial pressure: a sixth-nerve palsy (eye cannot look outward, horizontal double vision) is a classic "false localising sign".' });
  // VII facial: cerebellopontine angle -> internal acoustic meatus -> geniculate ganglion -> tympanic and mastoid segments -> stylomastoid foramen -> parotid
  {
    const trunk = H.merge([
      tube([[0.018, 1.606, -0.019], [0.021, 1.618, -0.02], [0.026, 1.628, -0.016], [0.033, 1.635, -0.008], [0.04, 1.636, -0.012], [0.048, 1.632, -0.016], [0.054, 1.62, -0.022], [0.058, 1.6, -0.024], [0.06, 1.588, -0.02], [0.059, 1.58, -0.008], [0.058, 1.577, 0.006]], 0.0016, { step: 0.004 }),
      ganglion([0.035, 1.636, -0.009], [0.0025, 0.0015, 0.0022], 3.3),   // geniculate ganglion
      fine([[0.058, 1.588, -0.018], [0.063, 1.596, -0.03], [0.0655, 1.606, -0.0368]], 0.0006)   // posterior auricular nerve
    ]);
    mk2(gCN, { id: 'cranial-nerve-7-facial', name: 'facial nerve (CN VII), trunk', latin: 'Nervus facialis', region: 'head', geometry: trunk, tags: ['cranial'],
      info: { description: 'Leaves the brainstem beside the vestibulocochlear nerve, enters the internal acoustic meatus, bends sharply at the geniculate ganglion, runs through the temporal bone along the inner wall of the middle ear, turns down behind it and exits the skull at the stylomastoid foramen just below the ear, then enters the parotid gland.',
        function: 'Motor to all the muscles of facial expression and the stapedius; taste from the front two-thirds of the tongue (chorda tympani); secretomotor to the lacrimal, submandibular and sublingual glands.',
        size: 'About 2 mm thick; ~3 cm inside the temporal bone', notes: 'Bell\'s palsy (swelling of the nerve in its narrow bony canal) paralyses one whole side of the face; a stroke spares the forehead because the upper face has bilateral cortical control.' } });
    const fork = [0.058, 1.577, 0.006];
    const br = H.merge([
      fine([fork, [0.063, 1.598, 0.018], [0.065, 1.628, 0.036], [0.06, 1.655, 0.052], [0.05, 1.672, 0.068]], taper(0.001, 0.0004)),                  // temporal
      fine([fork, [0.06, 1.596, 0.03], [0.057, 1.618, 0.05], [0.052, 1.63, 0.066], [0.049, 1.63, 0.071]], taper(0.001, 0.0004)),                      // zygomatic (to orbicularis oculi at the lateral orbit rim)
      fine([fork, [0.058, 1.584, 0.035], [0.047, 1.58, 0.056], [0.036, 1.574, 0.0712], [0.025, 1.571, 0.0818]], taper(0.001, 0.0004)),                 // buccal
      fine([fork, [0.058, 1.565, 0.02], [0.0525, 1.557, 0.0285], [0.0463, 1.55, 0.0365], [0.0405, 1.545, 0.0475], [0.034, 1.54, 0.0578], [0.0207, 1.537, 0.0765]], taper(0.0009, 0.0004)),   // marginal mandibular (along the jaw line)
      fine([fork, [0.057, 1.562, 0.0], [0.053, 1.542, 0.008], [0.047, 1.522, 0.016]], taper(0.0008, 0.0004))                                           // cervical
    ]);
    mk2(gCN, { id: 'cranial-nerve-7-facial-branches', name: 'facial nerve, terminal branches', latin: 'Rami temporales, zygomatici, buccales, marginalis mandibulae et colli', region: 'head', geometry: br, parent: 'cranial-nerve-7-facial', tags: ['cranial'], depth: SUP,
      info: { description: 'Inside the parotid gland the facial nerve fans out like a goose\'s foot (pes anserinus) into five branches - temporal, zygomatic, buccal, marginal mandibular and cervical - that spread across the face just under the skin.',
        function: 'Temporal: frontalis and eye closure; zygomatic: eye closure; buccal: cheek and upper lip; marginal mandibular: lower lip and chin; cervical: platysma.',
        size: 'Branches 0.5-1.5 mm thick, 4-8 cm long', notes: 'Surgeons removing the parotid dissect out this fan; a cut below the jaw can catch the marginal mandibular branch and leave a permanently lopsided smile.' } });
  }
  // VIII vestibulocochlear: cerebellopontine angle -> internal acoustic meatus (ear module continues from L.ear.vestibulocochlearNerveEnd)
  cn('8-vestibulocochlear', 'vestibulocochlear nerve (CN VIII)', 'Nervus vestibulocochlearis', tube([[0.016, 1.606, -0.021], [0.018, 1.616, -0.021], L.ear.vestibulocochlearNerveEnd], 0.0016, { step: 0.003 }), {
    description: 'A short, thick sensory nerve that crosses the cerebellopontine angle from the brainstem to the internal acoustic meatus together with the facial nerve. Inside the temporal bone it splits into the cochlear nerve (hearing) and the vestibular nerve (balance).',
    function: 'Hearing from the cochlea and head position and motion from the utricle, saccule and semicircular canals.',
    size: 'About 3 mm thick, 2 cm from brainstem to meatus', notes: 'A vestibular schwannoma (acoustic neuroma) grows on its vestibular part in the meatus, causing slowly progressive one-sided deafness and tinnitus before it presses on the facial nerve and cerebellum.' });
  // IX glossopharyngeal: lateral medulla -> jugular foramen -> between carotid and jugular -> stylopharyngeus -> tongue base
  cn('9-glossopharyngeal', 'glossopharyngeal nerve (CN IX)', 'Nervus glossopharyngeus', fine([[0.017, 1.593, -0.016], [0.024, 1.59, -0.013], [0.031, 1.585, -0.01], [0.036, 1.572, -0.001], [0.036, 1.56, 0.014], [0.032, 1.556, 0.03], [0.024, 1.562, 0.042], [0.016, 1.568, 0.047]], taper(0.0013, 0.0008), { step: 0.004 }), {
    description: 'Leaves the side of the medulla as a row of rootlets, passes through the jugular foramen with the vagus and accessory nerves, descends between the internal carotid artery and jugular vein, winds forward around the stylopharyngeus muscle and ends in the back of the tongue and the tonsil.',
    function: 'Taste and sensation from the back third of the tongue, sensation from the pharynx, tonsil and middle ear; motor to stylopharyngeus; saliva from the parotid; and the carotid body/sinus reflexes for blood pressure and oxygen.',
    size: 'About 1.5 mm thick, ~9 cm long', notes: 'It carries the sensory side of the gag reflex (the vagus does the motor side). Glossopharyngeal neuralgia gives stabbing throat and ear pain triggered by swallowing.' });
  // X vagus: asymmetric, built per side. Neck in the carotid sheath; left over the aortic arch, right beside the trachea; both to the stomach
  {
    const neckL = [[0.017, 1.589, -0.016], [0.025, 1.587, -0.013], [0.031, 1.583, -0.01], [0.031, 1.565, -0.002], [0.029, 1.54, 0.008], [0.028, 1.52, 0.012], [0.028, 1.50, 0.013], [0.027, 1.48, 0.013], [0.026, 1.46, 0.011]];
    const vagL = tube(neckL.concat([[0.028, 1.44, 0.004], [0.03, 1.42, -0.008], [0.029, 1.40, -0.018], [0.03, 1.375, -0.028], [0.028, 1.35, -0.034], [0.022, 1.32, -0.033], [0.014, 1.29, -0.029], [0.01, 1.26, -0.022], [0.007, 1.235, -0.013], [0.005, 1.215, -0.005], [0.003, 1.198, 0.004], [0.012, 1.178, 0.022], [0.018, 1.158, 0.034], [0.012, 1.135, 0.044]]), taper(0.0022, 0.0013), { step: 0.007 });
    const hepBr = fine([[0.008, 1.19, 0.012], [-0.003, 1.184, 0.017], [-0.012, 1.178, 0.022]], 0.0006);   // start of the hepatic branch of the anterior trunk (kept short so the left nerve stays on +X)
    mk(gCN, { id: 'cranial-nerve-10-vagus-l', name: 'Left vagus nerve (CN X)', latin: 'Nervus vagus sinister', side: 'L', region: 'body', geometry: H.merge([vagL, hepBr]), tags: ['cranial', 'autonomic'],
      info: { description: 'The "wandering" nerve. From the jugular foramen it runs down the neck inside the carotid sheath behind the carotid artery and jugular vein, crosses the left side of the aortic arch (where it gives off the recurrent laryngeal nerve), passes behind the root of the left lung, spreads over the front of the oesophagus and enters the abdomen as the anterior vagal trunk onto the stomach.',
        function: 'Parasympathetic supply to the heart, lungs and gut as far as the transverse colon; sensation from the larynx, airways and viscera; motor to the palate, pharynx and larynx (via the recurrent laryngeal).',
        size: 'About 2-3 mm thick in the neck; ~60 cm long', notes: 'Vagal stimulation slows the heart - the basis of carotid sinus massage and of fainting at the sight of blood. Its anterior gastric branches were once cut (vagotomy) to treat peptic ulcers.' } });
    const rlnL = fine([[0.028, 1.393, -0.02], [0.022, 1.384, -0.03], [0.015, 1.39, -0.028], [0.013, 1.41, -0.012], [0.013, 1.44, 0.008], [0.013, 1.465, 0.022], [0.011, 1.485, 0.031], [0.008, 1.5, 0.036]], 0.0008, { step: 0.005 });
    mk(gCN, { id: 'recurrent-laryngeal-nerve-l', name: 'Left recurrent laryngeal nerve', latin: 'Nervus laryngeus recurrens sinister', side: 'L', region: 'body', geometry: rlnL, parent: 'cranial-nerve-10-vagus-l', tags: ['cranial'],
      info: { description: 'Leaves the left vagus as it crosses the aortic arch, hooks under the arch behind the ligamentum arteriosum and climbs back up in the groove between the trachea and oesophagus to enter the larynx behind the thyroid gland.',
        function: 'Motor to all intrinsic laryngeal muscles except the cricothyroid, and sensation below the vocal folds - it opens and closes the vocal cords.',
        size: 'About 1 mm thick, ~15 cm on the left (the right is ~5 cm shorter)', notes: 'Its detour into the chest lets a lung cancer or enlarged left atrium paralyse the left vocal cord, causing a hoarse voice; it is also the nerve thyroid surgeons must protect.' } });
    const neckR = neckL.map(p => [-p[0], p[1], p[2]]);
    const vagR = tube(neckR.concat([[-0.028, 1.44, 0.005], [-0.028, 1.425, 0.0], [-0.024, 1.41, -0.01], [-0.022, 1.39, -0.018], [-0.024, 1.36, -0.03], [-0.022, 1.33, -0.04], [-0.014, 1.30, -0.043], [-0.008, 1.27, -0.038], [-0.004, 1.245, -0.03], [-0.002, 1.222, -0.022], [0.002, 1.2, -0.015], [0.01, 1.185, -0.014], [0.014, 1.165, -0.012]]), taper(0.0022, 0.0013), { step: 0.007 });
    const celBr = fine([[0.002, 1.2, -0.015], [0.0, 1.175, -0.024], [0.0, 1.155, -0.03]], 0.0007);   // coeliac branch of the posterior trunk
    mk(gCN, { id: 'cranial-nerve-10-vagus-r', name: 'Right vagus nerve (CN X)', latin: 'Nervus vagus dexter', side: 'R', region: 'body', geometry: H.merge([vagR, celBr]), tags: ['cranial', 'autonomic'],
      info: { description: 'Runs down the right side of the neck in the carotid sheath, crosses in front of the right subclavian artery (looping its recurrent laryngeal nerve under it), descends beside the trachea, passes behind the root of the right lung and spreads over the back of the oesophagus to become the posterior vagal trunk, which reaches the back of the stomach and sends a large branch to the coeliac plexus.',
        function: 'Parasympathetic and sensory supply to the heart (mainly the sinoatrial node), lungs and gut; via the coeliac branch it reaches the liver, pancreas, kidneys and intestine.',
        size: 'About 2-3 mm thick; ~55 cm long', notes: 'The right vagus mostly innervates the SA node and the left the AV node, so right-sided stimulation slows the heart rate more. Vagus nerve stimulators for epilepsy are implanted on the left to spare the heart.' } });
    const rlnR = fine([[-0.028, 1.428, 0.001], [-0.03, 1.418, -0.008], [-0.022, 1.42, -0.014], [-0.015, 1.44, 0.006], [-0.013, 1.465, 0.022], [-0.011, 1.485, 0.031], [-0.008, 1.5, 0.036]], 0.0008, { step: 0.005 });
    mk(gCN, { id: 'recurrent-laryngeal-nerve-r', name: 'Right recurrent laryngeal nerve', latin: 'Nervus laryngeus recurrens dexter', side: 'R', region: 'body', geometry: rlnR, parent: 'cranial-nerve-10-vagus-r', tags: ['cranial'],
      info: { description: 'Branches from the right vagus at the root of the neck, loops under the right subclavian artery and ascends in the tracheo-oesophageal groove to the larynx.',
        function: 'Motor to the right-sided intrinsic laryngeal muscles (except cricothyroid) and sensation below the vocal folds.',
        size: 'About 1 mm thick, ~10 cm', notes: 'In about 1 % of people, when the right subclavian artery arises abnormally, this nerve does not recur at all and runs straight to the larynx - a surprise for the thyroid surgeon.' } });
  }
  // XI accessory: spinal root climbs through the foramen magnum, exits the jugular foramen, descends to sternocleidomastoid and trapezius
  cn('11-accessory', 'accessory nerve (CN XI)', 'Nervus accessorius', H.merge([
    fine([[0.007, 1.525, -0.048], [0.008, 1.55, -0.04], [0.01, 1.572, -0.028], [0.014, 1.582, -0.02], [0.022, 1.587, -0.015], [0.031, 1.584, -0.011]], taper(0.0008, 0.0012)),   // spinal root ascending
    tube([[0.031, 1.584, -0.011], [0.038, 1.568, -0.008], [0.046, 1.55, -0.012], [0.052, 1.532, -0.021], [0.0513, 1.515, -0.0267], [0.0505, 1.5, -0.031], [0.0548, 1.487, -0.0363], [0.06, 1.475, -0.041], [0.066, 1.462, -0.047], [0.072, 1.448, -0.053], [0.078, 1.435, -0.06]], 0.0013, { step: 0.006 })   // across the posterior triangle, under the investing fascia
  ]), {
    description: 'Formed mainly by a spinal root that rises from the upper five cervical cord segments, enters the skull through the foramen magnum and leaves again through the jugular foramen. It then runs down and back across the side of the neck, piercing the sternocleidomastoid and crossing the posterior triangle to the trapezius.',
    function: 'Motor to the sternocleidomastoid (turns the head) and trapezius (shrugs the shoulder and rotates the shoulder blade).',
    size: 'About 1.5 mm thick; ~12 cm from foramen magnum to trapezius', notes: 'Its superficial course through the posterior triangle makes it the nerve most often injured in lymph-node biopsies of the neck, leaving a dropped shoulder and difficulty lifting the arm.' }, { region: 'body' });
  // XII hypoglossal: preolivary sulcus -> hypoglossal canal -> down lateral to the carotid -> forward above the hyoid -> tongue
  cn('12-hypoglossal', 'hypoglossal nerve (CN XII)', 'Nervus hypoglossus', fine([[0.012, 1.584, -0.006], [0.02, 1.582, -0.007], [0.028, 1.574, -0.001], [0.034, 1.562, 0.01], [0.035, 1.55, 0.024], [0.031, 1.545, 0.04], [0.024, 1.552, 0.054], [0.016, 1.562, 0.064], [0.01, 1.572, 0.068]], taper(0.0012, 0.0008), { step: 0.004 }), {
    description: 'Emerges from the medulla as a line of rootlets between the pyramid and the olive, leaves the skull through the hypoglossal canal, descends lateral to the carotid arteries, then hooks forward just above the hyoid bone into the underside of the tongue.',
    function: 'Motor to all the muscles of the tongue except palatoglossus - protrusion, retraction and shaping for speech and swallowing.',
    size: 'About 1.5 mm thick, ~11 cm', notes: 'Ask a patient to stick out the tongue: with a hypoglossal palsy it deviates TOWARD the weak side, because the healthy genioglossus pushes it across.' });

  // ================================================================ SPINAL NERVES - 31 pairs: root from the canal -> DRG in the foramen -> dorsal + ventral rami
  const SP = L.spine, SAC = SP.sacrum, gSN = H.group('spinal-nerves'); root.add(gSN);
  const sacZ = y => SAC.zTop + (SAC.zBottom - SAC.zTop) * H.clamp((SAC.top - y) / (SAC.top - SAC.bottom), 0, 1);   // sacral mid-plane z at height y
  function bead(pos, r, seed) {   // light-weight ganglion (~80 triangles)
    const g = H.blob(r, { ws: 8, hs: 6, deform: p => 1 + 0.1 * H.fbm(p.x * 2.3 + seed, p.y * 2.3 - seed, p.z * 2.3 + seed * 0.5, 2) });
    g.translate(pos[0], pos[1], pos[2]); return g;
  }
  const LEVELS = [], LV = {};
  {
    const mid = (a, b) => ({ y: (SP[a].y + SP[b].y) / 2, zb: (SP[a].z + SP[b].z) / 2, d: (SP[a].d + SP[b].d) / 2 });
    const add = (name, kind, m, between) => LEVELS.push(Object.assign({ name, kind, between }, m));
    add('c1', 'C', { y: SP.C1.y + 0.007, zb: SP.C1.z, d: SP.C1.d }, 'the occipital bone and the atlas');
    for (let i = 2; i <= 7; i++) add('c' + i, 'C', mid('C' + (i - 1), 'C' + i), 'C' + (i - 1) + ' and C' + i);
    add('c8', 'C', mid('C7', 'T1'), 'C7 and T1');
    for (let i = 1; i <= 12; i++) { const b = i < 12 ? 'T' + (i + 1) : 'L1'; add('t' + i, 'T', mid('T' + i, b), 'T' + i + ' and ' + b); }
    for (let i = 1; i <= 5; i++) { const b = i < 5 ? 'L' + (i + 1) : 'S1'; add('l' + i, 'L', mid('L' + i, b), 'L' + i + ' and ' + (i < 5 ? b : 'the sacrum')); }
    [0.962, 0.937, 0.913, 0.894].forEach((y, i) => add('s' + (i + 1), 'S', { y, zb: sacZ(y), d: 0.024 }, 'the ' + ['first', 'second', 'third', 'fourth'][i] + ' sacral foramina'));
    add('s5', 'S', { y: 0.877, zb: sacZ(0.877) - 0.002, d: 0.016 }, 'the sacral hiatus and the coccyx');
    add('co1', 'Co', { y: 0.866, zb: SP.coccyx.z + 0.002, d: 0.012 }, 'the sacral hiatus, below the fifth sacral nerve');
  }
  // [dermatome / main target, clinical note] per nerve
  const SN = {
    c1: ['the suboccipital muscles (it usually has no skin territory)', 'C1 is almost purely motor; some of its fibres travel with the hypoglossal nerve to reach the infrahyoid strap muscles via the ansa cervicalis.'],
    c2: ['the back of the scalp (via the greater occipital nerve)', 'Its dorsal ramus becomes the greater occipital nerve; irritation causes occipital neuralgia - shooting pain from the nape over the back of the head.'],
    c3: ['the upper neck and the skin over the angle of the jaw', '"C3, 4 and 5 keep the diaphragm alive": a spinal-cord injury above C3 stops breathing because the phrenic nerve is cut off.'],
    c4: ['the base of the neck and the top of the shoulder', 'The main root of the phrenic nerve, which is why diaphragm irritation (e.g. a ruptured spleen) is felt as shoulder-tip pain.'],
    c5: ['the skin over the deltoid (the "regimental badge" area)', 'Test: shoulder abduction and the biceps reflex. Traction on C5-C6 at birth (Erb palsy) leaves the arm hanging in the "waiter\'s tip" posture.'],
    c6: ['the lateral forearm, thumb and index finger', 'Test: elbow flexion, wrist extension and the brachioradialis reflex; a C5/6 disc prolapse sends pain and tingling into the thumb.'],
    c7: ['the middle finger', 'Test: elbow extension and the triceps reflex; C7 is the root most often compressed in the neck (C6/7 disc).'],
    c8: ['the little finger and the medial forearm', 'There are eight cervical nerves but only seven cervical vertebrae, so C8 exits below C7. Test: finger flexion and grip.'],
    t1: ['the medial side of the arm and forearm', 'Supplies the small muscles of the hand. An apical lung (Pancoast) tumour invading T1 and the sympathetic chain gives hand wasting with a Horner syndrome.'],
    t2: ['the armpit and inner upper arm', 'Its intercostobrachial branch supplies the armpit and is often cut in axillary breast surgery, leaving the inner arm numb.'],
    t3: ['a band of skin across the upper chest', 'Shingles (herpes zoster) reactivates in a thoracic dorsal root ganglion more often than anywhere else, giving a painful blistering stripe along one dermatome.'],
    t4: ['a band of skin around the chest at the level of the nipples', 'T4 at the nipple is the classic landmark for mapping the sensory level of a spinal cord injury.'],
    t5: ['a band of skin around the chest below the nipples', 'Its ventral ramus is the fifth intercostal nerve; the fourth to sixth are blocked for breast and chest-drain surgery.'],
    t6: ['a band of skin around the lower chest', 'Cord injuries at or above T6 risk autonomic dysreflexia - dangerous surges of blood pressure triggered by a full bladder or bowel.'],
    t7: ['a band of skin at the level of the xiphoid process', 'T7 marks the xiphoid; lower intercostal nerves also supply the abdominal wall, so chest disease can mimic abdominal pain.'],
    t8: ['a band of skin just below the rib margin', 'T7-T9 supply the upper abdominal wall; the upper abdominal reflex tests these segments.'],
    t9: ['a band of skin across the upper abdomen', 'A T9 dermatome band crosses the upper abdomen halfway between xiphoid and umbilicus.'],
    t10: ['a band of skin around the waist at the umbilicus', 'T10 at the umbilicus is a key sensory landmark; early appendicitis pain is felt here because the appendix shares T10 visceral afferents.'],
    t11: ['a band of skin across the lower abdomen', 'With T12 it supplies the lower abdominal muscles; weakness pulls the umbilicus upward when the patient lifts the head (Beevor sign).'],
    t12: ['the lower abdomen and the skin above the pubis and the hip', 'Its ventral ramus runs under the twelfth rib as the subcostal nerve, which can be irritated in kidney surgery through the flank.'],
    l1: ['the groin and the inguinal region', 'Gives the iliohypogastric, ilioinguinal and genitofemoral nerves; the cremasteric reflex tests L1-L2.'],
    l2: ['the upper front of the thigh', 'Test: hip flexion (iliopsoas); it contributes to the femoral, obturator and lateral femoral cutaneous nerves.'],
    l3: ['the lower front of the thigh and the inner knee', 'Test: knee extension and hip adduction; an upper lumbar disc or a femoral stretch test provokes L3 pain.'],
    l4: ['the medial leg and the medial ankle', 'Test: the knee-jerk reflex and ankle dorsiflexion; compressed by an L3/4 disc or foraminal narrowing.'],
    l5: ['the lateral leg, top of the foot and the big toe', 'Test: big-toe extension; the L4/5 disc is one of the two commonest sites of sciatica and severe compression causes foot drop.'],
    s1: ['the lateral border and sole of the foot and the little toe', 'Test: the ankle-jerk reflex and standing on tiptoe; the L5/S1 disc is the other classic sciatica level.'],
    s2: ['the back of the thigh and calf', 'S2-S4 carry the pelvic parasympathetic outflow for bladder emptying and erection ("S2, 3, 4 keeps the penis off the floor").'],
    s3: ['the buttock crease and inner buttock', 'Part of the saddle area; saddle numbness with urinary retention signals cauda equina syndrome - a surgical emergency.'],
    s4: ['the skin around the anus', 'Supplies the pelvic floor and external anal sphincter; the anal wink reflex tests S2-S4.'],
    s5: ['the skin immediately around the anus', 'A tiny nerve that joins S4 and the coccygeal nerve in the coccygeal plexus.'],
    co1: ['a small patch of skin over the coccyx', 'The single coccygeal nerve is the last and smallest of the 31 pairs; its dorsal ramus supplies the skin over the tailbone.']
  };
  const ORD = k => k + (k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th');
  const VDEST = n => /^c[1-4]$/.test(n) ? 'which joins the cervical plexus' : /^(c[5-8]|t1)$/.test(n) ? 'which joins the brachial plexus' + (n === 't1' ? ' (a small part forms the first intercostal nerve)' : '')
    : /^t([2-9]|1[01])$/.test(n) ? 'which becomes the ' + ORD(+n.slice(1)) + ' intercostal nerve' : n === 't12' ? 'which becomes the subcostal nerve'
      : /^l[1-3]$/.test(n) ? 'which enters the lumbar plexus inside psoas' : n === 'l4' ? 'which splits between the lumbar plexus and the lumbosacral trunk'
        : /^(l5|s[1-4])$/.test(n) ? 'which joins the sacral plexus' : 'which joins the small coccygeal plexus';
  const regionOf = n => n === 'c1' ? 'head' : n[0] === 'c' && n !== 'co1' ? 'neck' : n[0] === 't' ? 'thorax' : n[0] === 'l' ? 'abdomen' : 'pelvis';
  LEVELS.forEach((lv, k) => {
    const { y, zb, d, kind } = lv, sac = kind === 'S' || kind === 'Co';
    const zc = sac ? zb - 0.012 : zb - d / 2 - 0.012, zg = sac ? zb - 0.003 : zb - d / 2 - 0.003;
    const dy = kind === 'C' ? 0.004 : kind === 'T' ? 0.01 : 0.012;
    const big = /^(c[5-8]|t1|l[2-5]|s[1-3])$/.test(lv.name), tiny = /^(s[45]|co1)$/.test(lv.name);
    const r = big ? 0.0022 : tiny ? 0.0011 : 0.0016;
    const Gp = [0.015, y + 0.001, zg], N = [0.021, y - 0.002, zg + 0.002];
    let ven;
    if (kind === 'C') ven = [N, [0.029, y - 0.005, zb], [0.036, y - 0.009, zb + 0.006]];
    else if (kind === 'T') ven = [N, [0.03, y - 0.004, zg + 0.006], [0.038, y - 0.007, zg + 0.01]];
    else if (kind === 'L') ven = [N, [0.03, y - 0.007, zg + 0.009], [0.037, y - 0.014, zg + 0.016]];
    else ven = [Gp, [0.022, y - 0.003, zb + 0.012], [0.03, y - 0.008, zb + 0.02]];
    // dorsal ramus: back into the erector spinae; kept >= 6 mm inside the trunk / neck skin silhouette (inSkin, hoisted below)
    const dor = sac ? [Gp, [0.018, y - 0.002, zb - 0.018], [0.022, y - 0.006, zb - 0.028]] : [N, inSkin([0.026, y - 0.003, zg - 0.01], 0.006), inSkin([0.03, y - 0.008, zg - 0.026], 0.006)];
    lv.vEnd = ven[ven.length - 1]; lv.vMid = ven[1]; lv.zg = zg; LV[lv.name] = lv;
    const geo = H.merge([
      fine([[0.003, y + dy, zc], [0.008, y + dy * 0.5, zc + 0.002], [0.012, y + 0.002, zg - 0.002], Gp], 0.001, { step: 0.004 }),   // dorsal + ventral roots (as one bundle)
      bead(Gp, [r * 1.6, r * 1.9, r * 1.4], k * 1.7),                                                                            // dorsal root ganglion
      sac ? null : fine([Gp, N], r, { step: 0.004 }),                                                                            // short mixed spinal nerve
      fine(ven, taper(r, r * 0.9), { step: 0.004 }), fine(dor, taper(r * 0.7, r * 0.5), { step: 0.004 })]);
    const lab = lv.name === 'co1' ? 'Co1' : lv.name.toUpperCase();
    const [derm, note] = SN[lv.name];
    mk2(gSN, { id: 'spinal-nerve-' + lv.name, name: lab + ' spinal nerve', latin: 'Nervus spinalis ' + lab, region: regionOf(lv.name), geometry: geo, tags: ['spinal'],
      info: { description: 'The ' + lab + ' spinal nerve leaves the spinal canal between ' + lv.between + '. Its sensory (dorsal) and motor (ventral) roots meet just beyond the dorsal root ganglion; the short mixed nerve then splits into a small dorsal ramus for the back muscles and skin and a larger ventral ramus, ' + VDEST(lv.name) + '.',
        function: 'Carries motor fibres to the muscles of its segment (myotome) and sensation back from its strip of skin (dermatome): ' + derm + '.',
        size: (big ? 'About 4-5 mm' : tiny ? 'About 1 mm' : 'About 2-3 mm') + ' thick; the mixed nerve is only ~1 cm long before it divides', notes: note } });
  });

  // ================================================================ SYMPATHETIC TRUNKS - 22 ganglia per side (3 cervical, 11 thoracic, 4 lumbar, 4 sacral) + ganglion impar
  const gAU = H.group('autonomic'); root.add(gAU);
  const bodySide = (vn, dy) => { const v = SP[vn], hw = v.w / 2, x = Math.max(0.02, hw * 0.9 + 0.001), zo = x < hw ? (v.d / 2) * Math.sqrt(1 - (x / hw) * (x / hw)) : 0; return [x, v.y + (dy || 0), v.z + zo + 0.003]; };
  const impar = [0, 0.867, SP.coccyx.z + 0.012];
  const SYMG = [];   // [position, radii, segmental nerves reached by grey rami]
  {
    SYMG.push([[0.021, (SP.C2.y + SP.C3.y) / 2, SP.C2.z + 0.003], [0.003, 0.011, 0.0027], ['c1', 'c2', 'c3', 'c4']]);                                    // superior cervical ganglion
    SYMG.push([[0.02, SP.C6.y, SP.C6.z + 0.003], [0.002, 0.003, 0.0018], ['c5', 'c6']]);                                                                  // middle cervical ganglion
    SYMG.push([[0.024, (SP.C7.y + SP.T1.y) / 2 - 0.003, (SP.C7.z + SP.T1.z) / 2 + 0.002], [0.0042, 0.0058, 0.0026], ['c7', 'c8', 't1']]);                 // cervicothoracic (stellate)
    for (let i = 2; i <= 12; i++) SYMG.push([bodySide('T' + i, -0.006), [0.0021, 0.003, 0.0017], ['t' + i]]);
    for (let i = 1; i <= 4; i++) SYMG.push([bodySide('L' + i, 0), [0.0022, 0.0034, 0.0019], ['l' + i]]);
    [0.962, 0.937, 0.913, 0.894].forEach((y, i) => SYMG.push([[0.016 - i * 0.0015, y, sacZ(y) + 0.015], [0.0019, 0.0026, 0.0016], ['s' + (i + 1)]]));
    const chain = tube([[0.021, 1.573, SP.C2.z + 0.001]].concat(SYMG.map(e => e[0]), [[0.006, 0.873, impar[2]], impar]), 0.0011, { radial: 6, step: 0.006 });
    const parts = [chain];
    SYMG.forEach((e, i) => {
      parts.push(i < 3 ? ganglion(e[0], e[1], 5 + i * 0.9) : bead(e[0], e[1], 5 + i * 0.9));
      e[2].forEach(n => { parts.push(fine([e[0], LV[n].vMid], 0.0006, { step: 0.004 })); if (/^(t\d+|l[12])$/.test(n)) parts.push(fine([[e[0][0], e[0][1] + 0.002, e[0][2]], [LV[n].vMid[0], LV[n].vMid[1] + 0.002, LV[n].vMid[2]]], 0.0005, { step: 0.004 })); });
    });
    mk2(gAU, { id: 'sympathetic-trunk', name: 'sympathetic trunk', latin: 'Truncus sympathicus', region: 'body', geometry: H.merge(parts), tags: ['autonomic'],
      info: { description: 'A beaded nerve cord running the whole length of the spine beside the vertebral bodies, from the base of the skull to the coccyx, where the two trunks meet. Each bead is a sympathetic ganglion: three in the neck (superior, middle and cervicothoracic or stellate), eleven thoracic, four lumbar and four sacral; thin white and grey rami link them to the spinal nerves.',
        function: 'Distributes the "fight or flight" outflow: preganglionic fibres from cord segments T1-L2 enter through white rami, relay in the ganglia, and postganglionic fibres return through grey rami to every spinal nerve (sweat glands, blood vessels, hair muscles) or go directly to the head, heart and lungs.',
        size: 'About 45 cm long; ganglia 3-6 mm, the superior cervical ganglion 2.5-3 cm, the stellate ganglion ~1.5 cm', notes: 'Interrupting the cervical chain (apical lung tumour, carotid dissection, neck surgery) causes Horner syndrome - a drooping lid, small pupil and dry skin on that side of the face. Cutting the T2-T3 ganglia cures severe hand sweating.' } });
    mk(gAU, { id: 'ganglion-impar', name: 'Ganglion impar', latin: 'Ganglion impar', side: 'M', region: 'pelvis', geometry: ganglion(impar, [0.003, 0.0025, 0.0022], 9.1), tags: ['autonomic', 'ganglion'], parent: null,
      info: { description: 'The single, unpaired ganglion in front of the coccyx where the lower ends of the two sympathetic trunks fuse.', function: 'Supplies sympathetic fibres to the perineum, distal rectum, anus and the end of the urethra and vagina.',
        size: 'About 3-5 mm', notes: 'Injecting local anaesthetic at the ganglion impar (through the sacrococcygeal joint) relieves otherwise intractable perineal and tailbone (coccydynia) pain.' } });
  }

  // ================================================================ INTERCOSTAL NERVES 1-11 (ventral rami of T1-T11) along the costal groove of each rib
  const gTR = H.group('trunk-nerves'); root.add(gTR);
  // keep a trunk point at least m metres inside the skin silhouette (L.trunkAt superellipse)
  function inSkin(p, m) {
    const s = L.trunkAt(p[1]), dz = p[2] - s.cz, f = Math.pow(Math.pow(Math.abs(p[0]) / (s.rx - m), s.n) + Math.pow(Math.abs(dz) / (s.rz - m), s.n), 1 / s.n);
    return f > 1 ? [p[0] / f, p[1], s.cz + dz / f] : p;
  }
  {
    const HW = [0.06, 0.085, 0.10, 0.112, 0.12, 0.126, 0.13, 0.132, 0.132, 0.13, 0.126];          // inner half-width of rib N (x)
    const ZF = [0.05, 0.066, 0.075, 0.08, 0.085, 0.088, 0.088, 0.086, 0.084, 0.08, 0.076];        // front of the ring (z)
    const ZB = [-0.07, -0.085, -0.092, -0.096, -0.098, -0.1, -0.1, -0.098, -0.095, -0.09, -0.085];// back of the ring (z)
    const YF = [1.415, 1.375, 1.345, 1.315, 1.29, 1.26, 1.215, 1.17, 1.12, 1.07, 1.02];           // height of the anterior end
    const TE = [1.3, 1.35, 1.35, 1.35, 1.35, 1.35, 1.3, 1.26, 1.24, 1.22, 1.2];                   // end angle (0 = lateral, PI/2 = front)
    const NOTE = [
      'The first intercostal nerve is tiny because most of T1 goes up into the brachial plexus; it has no anterior cutaneous branch.',
      'Its lateral cutaneous branch, the intercostobrachial nerve, crosses the armpit to the inner arm and is commonly cut during axillary lymph-node surgery.',
      'An intercostal nerve block is given just below the lower edge of the rib, where the nerve lies under the intercostal vein and artery.',
      'Supplies the skin at the nipple (T4 dermatome) - the landmark used to map the level of a spinal-cord injury.',
      'Chest drains are pushed in just ABOVE a rib so that the needle misses this nerve and its vessels in the groove below the rib above.',
      'Shingles most often erupts along a mid-thoracic intercostal nerve as a one-sided painful band of blisters that stops at the midline.',
      'The seventh to eleventh nerves continue into the abdominal wall (thoracoabdominal nerves), so lower-lobe pneumonia can present as abdominal pain.',
      'Supplies the upper rectus abdominis; cutting it in an upper abdominal incision weakens the muscle segment below.',
      'Anterior cutaneous branches can become trapped where they pierce the rectus sheath (ACNES), a cause of chronic abdominal-wall pain.',
      'The tenth thoracic dermatome encircles the body at the umbilicus.',
      'The last intercostal nerve; below it runs the subcostal nerve (T12). Transverse abdominal incisions spare these segmental nerves better than vertical ones.'];
    for (let N = 1; N <= 11; N++) {
      const lv = LV['t' + N], hw = HW[N - 1], zf = ZF[N - 1], zb = ZB[N - 1], cz = (zf + zb) / 2, t0 = -1.05, t1 = TE[N - 1];
      const y0 = lv.vEnd[1], y1 = YF[N - 1];
      const pts = [lv.vEnd];
      const at = t => { const u = (t - t0) / (t1 - t0), s = Math.sin(t); return inSkin([hw * Math.cos(t), y0 + (y1 - y0) * Math.pow(u, 1.4), cz + (s < 0 ? cz - zb : zf - cz) * s], 0.018); };
      for (let i = 0; i <= 9; i++) pts.push(at(t0 + (t1 - t0) * i / 9));
      const lat = at(0.05), end = pts[pts.length - 1];
      const parts = [tube(pts, taper(0.0015, 0.0011), { radial: 6, step: 0.01 }),
        fine([lat, [lat[0] + 0.012, lat[1] - 0.012, lat[2] + 0.004], [lat[0] + 0.016, lat[1] - 0.024, lat[2] + 0.012]], 0.0007, { step: 0.008 }),   // lateral cutaneous branch
        fine([end, [end[0] + 0.004, end[1] - 0.004, end[2] + 0.012]], 0.0006, { step: 0.006 })];                                                        // anterior cutaneous branch
      if (N === 2) parts.push(fine([lat, [0.14, 1.375, -0.01], [0.165, 1.35, -0.005], [0.18, 1.31, 0.0]], 0.0007, { step: 0.008 }));   // intercostobrachial nerve
      const thAb = N >= 7;
      mk2(gTR, { id: 'intercostal-nerve-' + N, name: ORD(N) + ' intercostal nerve', latin: 'Nervus intercostalis ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][N - 1], region: N <= 8 ? 'thorax' : 'abdomen', geometry: H.merge(parts), tags: ['spinal', 'intercostal'],
        info: { description: 'The ventral ramus of the ' + ORD(N) + ' thoracic nerve. It runs round the chest in the costal groove on the underside of the ' + ORD(N) + ' rib, between the internal and innermost intercostal muscles and below the intercostal vein and artery' + (thAb ? ', then leaves the costal margin to run forward between the internal oblique and transversus abdominis to the rectus sheath.' : ', ending beside the sternum as an anterior cutaneous branch.'),
          function: 'Motor to the intercostal muscles' + (thAb ? ' and the anterior abdominal wall' : '') + '; sensation from a band of skin (lateral and anterior cutaneous branches) and from the parietal pleura' + (thAb ? ' and peritoneum.' : '.'),
          size: 'About 2-3 mm thick; ' + Math.round(6 + hw * 190) + '-' + Math.round(10 + hw * 200) + ' cm long', notes: NOTE[N - 1] } });
    }
  }

  // ================================================================ CERVICAL PLEXUS (C1-C4) + PHRENIC NERVES
  const gPL = H.group('plexuses'); root.add(gPL);
  {
    const v = ['c1', 'c2', 'c3', 'c4'].map(n => LV[n].vEnd);
    const erb = [0.05, 1.515, -0.01];
    const parts = [
      tube([v[0], [0.043, v[0][1] - 0.006, v[0][2] + 0.002], v[1], [0.043, v[1][1] - 0.008, v[1][2] + 0.001], v[2], [0.043, v[2][1] - 0.008, v[2][2]], v[3]], 0.0014, { radial: 6, step: 0.005 }),  // the loops
      fine([v[1], [0.045, 1.535, -0.01], erb], 0.0013), fine([v[2], [0.045, 1.525, -0.012], erb], 0.0013),
      fine([erb, [0.052, 1.535, -0.023], [0.0499, 1.55, -0.0273], [0.0502, 1.565, -0.0318], [0.054, 1.583, -0.04], [0.0585, 1.6, -0.0474]], taper(0.0009, 0.0005), { step: 0.007 }),   // lesser occipital (up the back border of sternocleidomastoid)
      fine([erb, [0.055, 1.54, -0.006], [0.0557, 1.555, -0.0074], [0.0623, 1.575, -0.0089], [0.0673, 1.6, -0.0139]], taper(0.001, 0.0005), { step: 0.007 }),   // great auricular (over sternocleidomastoid)
      fine([erb, [0.048, 1.512, 0.018], [0.036, 1.506, 0.04], [0.0195, 1.503, 0.0507]], taper(0.0009, 0.0005), { step: 0.007 }),     // transverse cervical
      fine([erb, [0.045, 1.475, 0.02], [0.038, 1.44, 0.058], [0.03, 1.415, 0.072]], taper(0.0009, 0.0005), { step: 0.007 }),        // medial supraclavicular
      fine([erb, [0.065, 1.47, 0.01], [0.078, 1.435, 0.05], [0.082, 1.41, 0.062]], taper(0.0009, 0.0005), { step: 0.007 }),         // intermediate supraclavicular
      fine([erb, [0.0617, 1.49, -0.008], [0.075, 1.462, 0.0], [0.1, 1.445, 0.012], [0.13, 1.432, 0.02], [0.155, 1.42, 0.018]], taper(0.0009, 0.0005), { step: 0.007 }),   // lateral supraclavicular (down the posterior triangle, then over the shoulder)
      fine([[0.034, 1.556, 0.01], [0.031, 1.53, 0.022], [0.029, 1.5, 0.031], [0.026, 1.488, 0.03]], 0.0006, { step: 0.006 }),         // ansa cervicalis, superior root (C1 via XII)
      fine([v[2], [0.04, 1.525, 0.005], [0.034, 1.5, 0.026], [0.026, 1.488, 0.03], [0.016, 1.495, 0.04]], 0.0006, { step: 0.006 })  // inferior root + loop to the strap muscles
    ];
    mk2(gPL, { id: 'cervical-plexus', name: 'cervical plexus', latin: 'Plexus cervicalis', region: 'body', geometry: H.merge(parts), tags: ['plexus', 'spinal'], depth: SUP,
      info: { description: 'A series of loops between the ventral rami of C1-C4, lying deep to the sternocleidomastoid. Its skin branches fan out from the middle of the muscle\'s back border (Erb\'s point): lesser occipital, great auricular, transverse cervical and supraclavicular nerves; a loop on the carotid sheath (ansa cervicalis) supplies the strap muscles.',
        function: 'Sensation from the side of the neck, the ear lobe and the skin behind the ear, and the skin over the clavicle and upper chest; motor to the infrahyoid muscles and, through the phrenic nerve, the diaphragm.',
        size: 'Loops within ~4 cm of the spine; skin branches 1-2 mm thick, 6-10 cm long', notes: 'A superficial cervical plexus block at the mid-point of the sternocleidomastoid numbs the neck for carotid surgery. The great auricular nerve is the one most often injured in facelift surgery, leaving a numb ear lobe.' } });
    // phrenic nerves (C3-C5): anterior scalene -> between subclavian artery and vein -> pericardium -> diaphragm (asymmetric, built per side)
    const neckPh = [[0.04, 1.528, -0.008], [0.042, 1.505, 0.0], [0.039, 1.478, 0.007], [0.036, 1.452, 0.011], [0.034, 1.43, 0.013]];
    const phL = H.merge([
      tube([LV.c3.vEnd, LV.c4.vEnd].concat(neckPh, [[0.03, 1.405, 0.015], [0.036, 1.37, 0.024], [0.058, 1.33, 0.032], [0.077, 1.30, 0.036], [0.084, 1.26, 0.04], [0.085, 1.228, 0.048], [0.083, 1.215, 0.052]]), taper(0.0019, 0.0016), { radial: 6, step: 0.007 }),
      fine([LV.c5.vEnd, [0.04, 1.495, -0.006], [0.041, 1.49, -0.002]], 0.0009),
      fine([[0.083, 1.215, 0.052], [0.07, 1.22, 0.07], [0.055, 1.225, 0.075]], 0.0008), fine([[0.083, 1.215, 0.052], [0.11, 1.215, 0.03], [0.125, 1.2, 0.0]], 0.0008), fine([[0.083, 1.215, 0.052], [0.09, 1.235, 0.01], [0.09, 1.225, -0.04]], 0.0008)]);
    const neckR = neckPh.map(p => [-p[0], p[1], p[2]]);
    const phR = H.merge([
      tube([L.mirror(LV.c3.vEnd), L.mirror(LV.c4.vEnd)].concat(neckR, [[-0.036, 1.405, 0.018], [-0.039, 1.37, 0.026], [-0.04, 1.33, 0.032], [-0.038, 1.29, 0.036], [-0.036, 1.258, 0.03], [-0.035, 1.24, 0.024]]), taper(0.0019, 0.0016), { radial: 6, step: 0.007 }),
      fine([L.mirror(LV.c5.vEnd), [-0.04, 1.495, -0.006], [-0.041, 1.49, -0.002]], 0.0009),
      fine([[-0.035, 1.24, 0.024], [-0.05, 1.245, 0.05], [-0.06, 1.24, 0.07]], 0.0008), fine([[-0.035, 1.24, 0.024], [-0.07, 1.255, 0.01], [-0.11, 1.235, -0.01]], 0.0008), fine([[-0.035, 1.24, 0.024], [-0.06, 1.255, -0.02], [-0.08, 1.24, -0.05]], 0.0008)]);
    const phInfo = side => ({ description: 'Arises mainly from C4 (with C3 and C5) in the neck, runs straight down on the front of the anterior scalene muscle, enters the chest between the subclavian artery and vein and descends over the fibrous pericardium in front of the lung root to the diaphragm. ' + (side === 'L' ? 'The left nerve crosses the aortic arch and runs over the left ventricle, piercing the diaphragm near the heart apex.' : 'The right nerve runs on the brachiocephalic vein, superior vena cava and right atrium and reaches the diaphragm beside the inferior vena cava.'),
      function: 'The only motor nerve to its half of the diaphragm (the main breathing muscle); also carries sensation from the central diaphragm, pericardium and mediastinal pleura.',
      size: 'About 2 mm thick; ' + (side === 'L' ? '~33' : '~30') + ' cm long', notes: 'Irritation under the diaphragm is felt as shoulder-tip pain (C4 dermatome). A paralysed phrenic nerve - after heart surgery, from a lung tumour or after an interscalene block - leaves one hemidiaphragm high on the chest X-ray.' });
    mk(gPL, { id: 'phrenic-nerve-l', name: 'Left phrenic nerve', latin: 'Nervus phrenicus sinister', side: 'L', region: 'body', geometry: phL, parent: 'cervical-plexus-l', tags: ['plexus'], info: phInfo('L') });
    mk(gPL, { id: 'phrenic-nerve-r', name: 'Right phrenic nerve', latin: 'Nervus phrenicus dexter', side: 'R', region: 'body', geometry: phR, parent: 'cervical-plexus-r', tags: ['plexus'], info: phInfo('R') });
  }

  // ================================================================ BRACHIAL PLEXUS (C5-T1) and the nerves of the upper limb (LEFT built, mirrored)
  const gUL = H.group('upper-limb-nerves'); root.add(gUL);
  const HB = L.bone.humerusL, RB = L.bone.radiusL, UB = L.bone.ulnaL;
  // point along the humerus axis (t 0 = head, 1 = elbow) offset by dx (+ lateral) and dz (+ anterior)
  const hum = (t, dx, dz) => [HB.top[0] + (HB.bottom[0] - HB.top[0]) * t + dx, HB.top[1] + (HB.bottom[1] - HB.top[1]) * t, HB.top[2] + (HB.bottom[2] - HB.top[2]) * t + dz];
  const faA = [(RB.top[0] + UB.top[0]) / 2, (RB.top[1] + UB.top[1]) / 2, (RB.top[2] + UB.top[2]) / 2], faB = [(RB.bottom[0] + UB.bottom[0]) / 2, (RB.bottom[1] + UB.bottom[1]) / 2, (RB.bottom[2] + UB.bottom[2]) / 2];
  const fa = (t, dx, dz) => [faA[0] + (faB[0] - faA[0]) * t + dx, faA[1] + (faB[1] - faA[1]) * t, faA[2] + (faB[2] - faA[2]) * t + dz];
  const LC2 = [0.152, 1.372, 0.006], PC2 = [0.152, 1.366, -0.017], MC2 = [0.146, 1.362, -0.005], MED0 = [0.158, 1.35, 0.002];
  {
    const U0 = [0.052, 1.495, -0.012], M0 = [0.054, 1.474, -0.018], Lo0 = [0.05, 1.455, -0.03];
    const U1 = [0.085, 1.462, -0.01], M1 = [0.086, 1.452, -0.016], Lo1 = [0.082, 1.442, -0.022];
    const LC = [0.132, 1.402, 0.004], PC = [0.13, 1.397, -0.016], MC = [0.126, 1.392, -0.006];
    const T = (pts, r) => tube(pts, r, { radial: 6, step: 0.006 });
    const parts = [
      T([LV.c5.vEnd, [0.044, 1.505, -0.012], U0], 0.0022), T([LV.c6.vEnd, [0.045, 1.49, -0.013], U0], 0.0024), T([LV.c7.vEnd, [0.046, 1.474, -0.02], M0], 0.0024),
      T([LV.c8.vEnd, [0.044, 1.455, -0.03], Lo0], 0.0023), T([LV.t1.vEnd, [0.042, 1.446, -0.042], Lo0], 0.002),                      // roots
      T([U0, [0.06, 1.486, -0.011], [0.0667, 1.477, -0.0104], [0.074, 1.469, -0.0101], U1], 0.003), T([M0, [0.07, 1.463, -0.017], M1], 0.0027), T([Lo0, [0.066, 1.448, -0.026], Lo1], 0.0028),   // trunks
      T([U1, [0.105, 1.428, -0.002], LC], 0.002), T([U1, [0.106, 1.424, -0.013], PC], 0.0018), T([M1, [0.107, 1.42, -0.004], LC], 0.0018),
      T([M1, [0.106, 1.416, -0.016], PC], 0.0018), T([Lo1, [0.104, 1.41, -0.012], MC], 0.0022), T([Lo1, [0.105, 1.408, -0.02], PC], 0.0014),  // divisions
      T([LC, [0.143, 1.388, 0.006], LC2], 0.0028), T([PC, [0.142, 1.382, -0.017], PC2], 0.003), T([MC, [0.137, 1.377, -0.006], MC2], 0.0026),   // cords
      fine([[0.045, 1.49, -0.022], [0.07, 1.445, -0.04], [0.1, 1.40, -0.045], [0.125, 1.33, -0.03], [0.135, 1.24, -0.015]], 0.0009, { step: 0.008 }),   // long thoracic nerve
      fine([U1, [0.105, 1.452, -0.035], [0.115, 1.448, -0.052], [0.1212, 1.442, -0.068], [0.14, 1.42, -0.09]], 0.001, { step: 0.007 }),            // suprascapular nerve
      fine([PC2, [0.148, 1.35, -0.04], [0.145, 1.3, -0.065], [0.145, 1.24, -0.07]], 0.0009, { step: 0.008 }),                                        // thoracodorsal nerve
      fine([LC, [0.12, 1.39, 0.03], [0.1, 1.37, 0.06]], 0.0008), fine([MC, [0.125, 1.375, 0.02], [0.12, 1.345, 0.055]], 0.0008)                       // lateral + medial pectoral
    ];
    mk2(gUL, { id: 'brachial-plexus', name: 'brachial plexus', latin: 'Plexus brachialis', region: 'body', geometry: H.merge(parts), tags: ['plexus', 'spinal'],
      info: { description: 'The nerve network of the upper limb, formed by the ventral rami of C5-T1. The five roots emerge between the anterior and middle scalene muscles, merge into upper, middle and lower trunks in the base of the neck, split into divisions behind the clavicle and regroup as lateral, posterior and medial cords around the axillary artery in the armpit.',
        function: 'Mixes fibres from five spinal segments so that each arm nerve carries several segments; supplies every muscle of the shoulder girdle and limb and all the skin of the arm except the armpit.',
        size: 'About 15 cm from the spine to the armpit; roots and trunks 3-6 mm thick', notes: 'Birth or motorbike traction injuries damage the upper roots (Erb palsy, "waiter\'s tip") or the lower roots (Klumpke palsy, claw hand). Anaesthetists block the plexus above or below the clavicle to operate on the arm.' } });
  }
  const arm = (id, name, latin, geom, info) => mk2(gUL, { id, name, latin, region: 'armL', geometry: geom, parent: 'brachial-plexus', tags: ['upper-limb'], info });
  // proper palmar digital nerves follow the finger axes of the hand skin (MCP base, three phalanges curling toward the palm, radius
  // tapering r -> 0.78 r; thumb abducted and rotated, pad facing medially) on the palmar side, ~0.5 r off the axis, ending in the pulp
  const HANDL = L.limb.hand, PCX = L.joint.handCenterL[0] + 0.0025;
  const FINGER = { index: [0.028, 0.752, 0.06, HANDL.fingerLength[1], 0.0095], middle: [0.008, 0.748, 0.01, HANDL.fingerLength[2], 0.0098],
    ring: [-0.012, 0.751, -0.04, HANDL.fingerLength[3], 0.009], little: [-0.030, 0.758, -0.09, HANDL.fingerLength[4], 0.008] };   // [x from palm centre, MCP y, splay, length, base radius]
  function digitalNerve(name, side) {   // side: +1 lateral (thumb side) edge, -1 medial edge, 0 centred on the palmar pad
    let base, dirs, lens, radii, hint = V(0, 0, 1);
    if (name === 'thumb') { base = V(0.268, 0.828, 0.020); dirs = [V(0.45, -0.85, 0.35), V(0.3, -0.9, 0.35), V(0.2, -0.93, 0.3)]; lens = [0.042, 0.031, 0.027]; radii = [0.0125, 0.011, 0.010, 0.009]; hint = V(-1, 0, 0.3); }
    else { const [dx, y, sp, len, r] = FINGER[name]; base = V(PCX + dx, y, 0.015); dirs = [V(sp, -1, 0.10), V(sp * 0.7, -1, 0.28), V(sp * 0.5, -1, 0.45)]; lens = [len * 0.45, len * 0.31, len * 0.24]; radii = [r, r * 0.93, r * 0.85, r * 0.78]; }
    const out = [], p = base.clone();
    for (let i = 0; i < 3; i++) {
      const d = dirs[i].normalize(), nP = hint.clone().addScaledVector(d, -hint.dot(d)).normalize();
      const nS = side ? V(1, 0, 0).addScaledVector(d, -d.x).addScaledVector(nP, -nP.x).normalize() : V(0, 0, 0);
      for (const f of (i < 2 ? [0, 0.5] : [0, 0.45, 0.8])) {
        const r = radii[i] + (radii[i + 1] - radii[i]) * f, q = p.clone().addScaledVector(d, lens[i] * f).addScaledVector(nP, 0.42 * r).addScaledVector(nS, 0.28 * side * r);
        out.push([q.x, q.y, q.z]);
      }
      p.addScaledVector(d, lens[i]);
    }
    return out;
  }
  const LT = (pts, r) => tube(pts, r, { radial: 7, step: 0.011 });
  arm('nerve-musculocutaneous', 'musculocutaneous nerve', 'Nervus musculocutaneus', H.merge([
    LT([LC2, [0.165, 1.35, 0.012], hum(0.2, -0.008, 0.016), hum(0.42, -0.004, 0.018), hum(0.65, 0.003, 0.018), hum(0.88, 0.01, 0.02), hum(0.98, 0.016, 0.024)], taper(0.0028, 0.0018)),
    LT([hum(0.98, 0.016, 0.024), fa(0.12, 0.022, 0.018), fa(0.4, 0.024, 0.014), fa(0.72, 0.021, 0.011), fa(0.96, 0.017, 0.009)], taper(0.0014, 0.0007)),   // lateral cutaneous nerve of the forearm
    fine([hum(0.42, -0.004, 0.018), hum(0.45, 0.0, 0.032)], 0.0008), fine([hum(0.6, 0.002, 0.018), hum(0.63, 0.006, 0.006)], 0.0008)]), {
    description: 'A branch of the lateral cord that pierces coracobrachialis, runs down between biceps and brachialis and emerges lateral to the biceps tendon at the elbow, where it continues as the lateral cutaneous nerve of the forearm.',
    function: 'Motor to the three front-of-arm muscles (coracobrachialis, biceps, brachialis); sensation from the lateral side of the forearm.',
    size: 'About 3 mm thick; ~20 cm in the arm plus ~20 cm of cutaneous branch', notes: 'Rarely injured on its own; its loss weakens elbow flexion and supination and abolishes the biceps reflex. Heavy lifting can pinch its cutaneous branch under the biceps aponeurosis.' });
  arm('nerve-median', 'median nerve', 'Nervus medianus', H.merge([
    LT([LC2, [0.157, 1.36, 0.006], MED0], 0.0024), LT([MC2, [0.152, 1.356, -0.001], MED0], 0.0022),   // lateral and medial roots
    LT([MED0, hum(0.2, -0.022, 0.006), hum(0.45, -0.02, 0.01), hum(0.7, -0.018, 0.012), hum(0.92, -0.012, 0.016), fa(0.08, -0.004, 0.016), fa(0.3, 0.0, 0.011), fa(0.6, 0.002, 0.011), fa(0.88, 0.003, 0.016), [0.246, 0.845, 0.024], [0.25, 0.815, 0.028]], taper(0.0036, 0.0028)),
    fine([[0.25, 0.815, 0.028], [0.262, 0.814, 0.031], [0.274, 0.822, 0.032]], 0.0008),                                                  // recurrent (thenar) branch
    fine([[0.25, 0.815, 0.028], [0.258, 0.822, 0.027]].concat(digitalNerve('thumb', 0)), taper(0.0012, 0.0006)),                     // thumb
    fine([[0.25, 0.815, 0.028], [0.266, 0.785, 0.027], [0.276, 0.765, 0.023]].concat(digitalNerve('index', 0)), taper(0.0012, 0.0006)),   // index
    fine([[0.25, 0.815, 0.028], [0.256, 0.785, 0.027], [0.259, 0.765, 0.023]].concat(digitalNerve('middle', 0)), taper(0.0012, 0.0006)),  // middle
    fine([[0.25, 0.815, 0.028], [0.247, 0.785, 0.027], [0.244, 0.765, 0.023]].concat(digitalNerve('ring', 1)), taper(0.0011, 0.0006)),    // lateral half of ring
    fine([fa(0.1, -0.003, 0.014), fa(0.25, 0.006, -0.002), fa(0.7, 0.004, -0.004)], 0.0009)]), {                                        // anterior interosseous nerve
    description: 'Formed by the lateral and medial cords in front of the axillary artery, it runs down the medial side of the arm with the brachial artery, enters the forearm between the heads of pronator teres, descends in the middle of the forearm between the superficial and deep finger flexors and passes through the carpal tunnel into the palm.',
    function: 'Motor to most forearm flexors and both pronators, the thenar muscles and the two lateral lumbricals; sensation from the palm side of the thumb, index, middle and half of the ring finger.',
    size: 'About 4 mm thick in the arm; ~60 cm from the axilla to the fingertips', notes: 'Carpal tunnel syndrome - compression under the flexor retinaculum - causes night-time tingling in the thumb-to-ring fingers and wasting of the thumb ball; a supracondylar fracture in a child can injure it higher up.' });
  arm('nerve-ulnar', 'ulnar nerve', 'Nervus ulnaris', H.merge([
    LT([MC2, hum(0.2, -0.026, -0.004), hum(0.45, -0.024, -0.012), hum(0.7, -0.022, -0.018), hum(0.9, -0.02, -0.02), [0.205, 1.10, -0.025], fa(0.06, -0.018, -0.012), fa(0.3, -0.018, -0.002), fa(0.6, -0.016, 0.004), fa(0.9, -0.014, 0.012), [0.231, 0.845, 0.022], [0.228, 0.815, 0.026]], taper(0.0035, 0.0026)),
    fine([[0.228, 0.815, 0.026], [0.225, 0.785, 0.026], [0.223, 0.77, 0.022]].concat(digitalNerve('little', 0)), taper(0.0011, 0.0006)),   // little finger
    fine([[0.228, 0.815, 0.026], [0.234, 0.785, 0.026], [0.237, 0.767, 0.022]].concat(digitalNerve('ring', -1)), taper(0.0011, 0.0006)),   // medial half of ring
    fine([[0.228, 0.815, 0.026], [0.235, 0.805, 0.02], [0.252, 0.795, 0.018], [0.272, 0.8, 0.02]], 0.0009),                              // deep motor branch across the palm
    fine([fa(0.7, -0.017, 0.006), fa(0.88, -0.022, -0.008), [0.232, 0.82, 0.007], [0.228, 0.78, 0.009]], 0.0008)]), {                  // dorsal cutaneous branch
    description: 'The main continuation of the medial cord. It runs down the medial arm, passes behind the medial epicondyle of the humerus (the "funny bone"), enters the forearm through flexor carpi ulnaris, runs under that muscle to the wrist and enters the hand through Guyon\'s canal beside the pisiform bone.',
    function: 'Motor to flexor carpi ulnaris, the medial half of flexor digitorum profundus and most small muscles of the hand (interossei, hypothenar muscles, medial lumbricals, adductor pollicis); sensation from the little finger and half of the ring finger.',
    size: 'About 4 mm thick; ~65 cm from the axilla to the little finger', notes: 'Knocking the funny bone jolts this nerve against the epicondyle. Chronic compression at the elbow (cubital tunnel) or wrist gives tingling in the little finger, a weak pinch (Froment sign) and eventually a claw hand.' });
  arm('nerve-radial', 'radial nerve', 'Nervus radialis', H.merge([
    LT([PC2, hum(0.12, -0.018, -0.022), hum(0.3, -0.006, -0.027), hum(0.45, 0.01, -0.023), hum(0.6, 0.02, -0.01), hum(0.75, 0.022, 0.006), hum(0.92, 0.02, 0.013), [0.243, 1.10, -0.001]], taper(0.0038, 0.003)),
    LT([[0.243, 1.10, -0.001], fa(0.15, 0.022, 0.01), fa(0.45, 0.026, 0.008), fa(0.7, 0.026, 0.002), fa(0.92, 0.024, -0.006), [0.27, 0.83, 0.004]], taper(0.0016, 0.0011)),   // superficial branch
    fine([[0.27, 0.83, 0.004], [0.28, 0.805, 0.01], [0.29, 0.775, 0.016]], 0.0007), fine([[0.27, 0.83, 0.004], [0.265, 0.8, 0.007], [0.27, 0.76, 0.009]], 0.0007),
    LT([[0.243, 1.10, -0.001], fa(0.08, 0.018, -0.006), fa(0.2, 0.008, -0.016), fa(0.45, 0.0, -0.018), fa(0.75, 0.0, -0.016), fa(0.95, 0.0, -0.012)], taper(0.0022, 0.0012)),   // deep branch / posterior interosseous
    fine([hum(0.3, -0.006, -0.027), hum(0.4, -0.012, -0.036), hum(0.6, -0.008, -0.036)], 0.0008)]), {                                       // branches to triceps
    description: 'The largest branch of the posterior cord. It winds around the back of the humerus in the spiral groove between the heads of triceps, pierces the lateral intermuscular septum to reach the front of the lateral elbow, and there splits into a superficial sensory branch running down the lateral forearm to the back of the hand, and a deep branch that turns through supinator into the back of the forearm as the posterior interosseous nerve.',
    function: 'Motor to triceps, brachioradialis, supinator and every extensor of the wrist, fingers and thumb; sensation from the back of the arm and forearm and the thumb side of the back of the hand.',
    size: 'About 4 mm thick; ~55 cm long', notes: 'A mid-shaft humeral fracture, or sleeping with the arm hung over a chair ("Saturday night palsy"), damages it in the spiral groove and causes wrist drop; the triceps is usually spared because its branches arise higher.' });
  arm('nerve-axillary', 'axillary nerve', 'Nervus axillaris', H.merge([
    LT([PC2, [0.158, 1.36, -0.03], [0.172, 1.362, -0.042], [0.19, 1.368, -0.037], [0.208, 1.372, -0.03], [0.218, 1.375, -0.012], [0.212, 1.378, 0.008], [0.2, 1.38, 0.022]], taper(0.0028, 0.0016)),
    fine([[0.205, 1.371, -0.033], [0.225, 1.35, -0.032], [0.236, 1.32, -0.022]], 0.0008)]), {                    // superior lateral cutaneous nerve of the arm
    description: 'A short branch of the posterior cord that leaves the armpit backwards through the quadrangular space, with the posterior circumflex humeral artery, and winds around the surgical neck of the humerus beneath the deltoid.',
    function: 'Motor to deltoid and teres minor; sensation from the "regimental badge" patch of skin over the lower deltoid.',
    size: 'About 3 mm thick; ~10 cm long', notes: 'Injured by a dislocated shoulder or a fracture of the surgical neck of the humerus: the deltoid wastes, lifting the arm sideways is weak and the badge area goes numb.' });

  // ================================================================ LUMBAR + SACRAL PLEXUSES and the nerves of the lower limb (LEFT built, mirrored)
  const gLL = H.group('lower-limb-nerves'); root.add(gLL);
  const LG = (pts, r) => tube(pts, r, { radial: 7, step: 0.013 });
  const T6 = (pts, r) => tube(pts, r, { radial: 6, step: 0.007 });
  const leg = (id, name, latin, region, geom, parent, info, extra) => mk2(gLL, Object.assign({ id, name, latin, region, geometry: geom, parent, tags: ['lower-limb'], info }, extra || {}));
  const F0 = [0.05, 1.03, -0.04], O0 = [0.035, 1.02, -0.035], LFC0 = [0.058, 1.075, -0.05], LST = [0.047, 0.965, -0.05];
  const FT = [0.083, 0.89, 0.058], SC0 = [0.07, 0.915, -0.068], SPL = [0.092, 0.6, -0.045];
  {
    const v = ['l1', 'l2', 'l3', 'l4', 'l5'].map(n => LV[n].vEnd), s = ['s1', 's2', 's3', 's4'].map(n => LV[n].vEnd);
    mk2(gLL, { id: 'lumbar-plexus', name: 'lumbar plexus', latin: 'Plexus lumbalis', region: 'body', tags: ['plexus', 'spinal'], geometry: H.merge([
      T6([v[0], [0.042, 1.1, -0.05], v[1]], 0.0014), T6([v[0], [0.05, 1.115, -0.058]], 0.0016),
      T6([v[1], [0.047, 1.07, -0.046], F0], 0.0022), T6([v[2], [0.046, 1.045, -0.043], F0], 0.0026), T6([v[3], [0.047, 1.025, -0.042], F0], 0.0022),
      T6([v[1], [0.036, 1.055, -0.04], O0], 0.0014), T6([v[2], [0.035, 1.035, -0.038], O0], 0.0016), T6([v[3], [0.034, 1.015, -0.037], O0], 0.0014),
      T6([v[1], [0.05, 1.08, -0.052], LFC0], 0.0012), T6([v[2], [0.052, 1.062, -0.048], LFC0], 0.0012),
      T6([v[3], [0.042, 1.0, -0.046], LST], 0.0022),                                                                                   // L4 contribution to the lumbosacral trunk
      fine([v[0], [0.04, 1.085, -0.042], [0.044, 1.05, -0.024], [0.054, 1.0, -0.01], [0.064, 0.96, 0.02], [0.068, 0.94, 0.05], [0.045, 0.905, 0.07]], 0.0009, { step: 0.007 }),   // genitofemoral + genital branch
      fine([[0.064, 0.96, 0.02], [0.075, 0.925, 0.058], [0.08, 0.885, 0.07]], 0.0007)]),                                                // femoral branch of genitofemoral
      info: { description: 'Formed inside the psoas major muscle by the ventral rami of L1-L4. Its branches emerge around psoas: the iliohypogastric, ilioinguinal and lateral femoral cutaneous nerves from its lateral border, the femoral nerve lower down, the genitofemoral nerve through its front and the obturator nerve from its medial border; part of L4 joins L5 as the lumbosacral trunk.',
        function: 'Supplies the lower abdominal wall, hip flexors, knee extensors and thigh adductors, and the skin of the groin, the front and inner thigh and the inner leg.',
        size: 'Spans ~12 cm inside psoas from L1 to the pelvic brim', notes: 'A psoas haematoma or abscess can compress the whole plexus, causing groin and thigh pain with a weak knee; surgeons approaching the spine through psoas monitor it with electrodes.' } });
    mk2(gLL, { id: 'sacral-plexus', name: 'sacral plexus', latin: 'Plexus sacralis', region: 'body', tags: ['plexus', 'spinal'], geometry: H.merge([
      T6([v[4], [0.042, 0.975, -0.045], LST], 0.0026), T6([LST, [0.058, 0.94, -0.058], SC0], 0.0034),
      T6([s[0], [0.05, 0.945, -0.045], [0.062, 0.928, -0.058], SC0], 0.0032), T6([s[1], [0.052, 0.924, -0.05], SC0], 0.0028), T6([s[2], [0.05, 0.908, -0.055], SC0], 0.0022),
      T6([s[3], [0.038, 0.89, -0.055], [0.036, 0.902, -0.052]], 0.0014),                                                               // S4 to the pudendal nerve
      fine([LST, [0.07, 0.945, -0.075], [0.1, 0.955, -0.08], [0.13, 0.95, -0.065]], 0.0012),                                         // superior gluteal nerve
      fine([SC0, [0.08, 0.905, -0.085], [0.1, 0.9, -0.098], [0.12, 0.89, -0.1]], 0.0012),                                           // inferior gluteal nerve
      fine([SC0, [0.082, 0.9, -0.084], [0.09, 0.8, -0.07], [0.09, 0.65, -0.06], [0.09, 0.55, -0.05]], taper(0.0011, 0.0006), { step: 0.01 })]),   // posterior femoral cutaneous
      info: { description: 'A triangular sheet on the front of the piriformis muscle on the back wall of the pelvis, formed by the lumbosacral trunk (L4-L5) and the ventral rami of S1-S4. Its roots converge on the greater sciatic foramen, where the sciatic, gluteal, posterior femoral cutaneous and pudendal nerves leave the pelvis.',
        function: 'Supplies the buttock muscles, the back of the thigh, everything below the knee, the pelvic floor and perineum, and the S2-S4 parasympathetic outflow to the pelvic organs.',
        size: 'About 10 cm across; the roots converge into a band ~2 cm wide', notes: 'Pelvic fractures, sacral tumours or a difficult childbirth can stretch it; the S2-S4 parasympathetic branches that control bladder emptying and erection are protected during rectal-cancer surgery.' } });
  }
  leg('nerve-iliohypogastric', 'iliohypogastric and ilioinguinal nerves', 'Nervus iliohypogastricus et nervus ilioinguinalis', 'body', H.merge([
    LG([[0.05, 1.115, -0.058], [0.08, 1.11, -0.066], [0.115, 1.09, -0.052], [0.132, 1.06, -0.02], [0.13, 1.03, 0.03], [0.1, 0.99, 0.075], [0.06, 0.975, 0.088]], taper(0.0016, 0.0009)),
    fine([[0.132, 1.06, -0.02], [0.13, 1.02, 0.025], [0.11, 0.97, 0.065], [0.075, 0.935, 0.08], [0.05, 0.915, 0.075]], taper(0.0011, 0.0007), { step: 0.008 })]), 'lumbar-plexus', {
    description: 'Twin branches of L1 that emerge from the lateral border of psoas, cross in front of quadratus lumborum behind the kidney, pierce transversus abdominis above the iliac crest and run forward between the abdominal muscle layers; the lower one (ilioinguinal) passes through the inguinal canal.',
    function: 'Motor to the lowest fibres of internal oblique and transversus abdominis; sensation from the skin above the pubis, the groin, the upper inner thigh and the front of the scrotum or labia.',
    size: 'About 2 mm thick; ~25 cm long', notes: 'They can be caught in stitches or mesh during hernia repair or low abdominal incisions, causing chronic burning groin pain; an ilioinguinal block is used for hernia surgery in children.' });
  leg('nerve-lateral-femoral-cutaneous', 'lateral femoral cutaneous nerve', 'Nervus cutaneus femoris lateralis', 'body',
    LG([LFC0, [0.07, 1.06, -0.045], [0.1, 1.03, -0.02], [0.115, 1.0, 0.03], [0.116, 0.98, 0.058], [0.124, 0.94, 0.066], [0.13, 0.85, 0.05], [0.138, 0.75, 0.035], [0.14, 0.65, 0.02]], taper(0.0013, 0.0008)), 'lumbar-plexus', {
    description: 'A sensory branch of L2-L3 that crosses the iliacus muscle toward the anterior superior iliac spine and passes under (sometimes through) the inguinal ligament just medial to it into the outer thigh.',
    function: 'Sensation from the skin of the front and outer thigh down to the knee.',
    size: 'About 1.5 mm thick; ~30 cm long', notes: 'Meralgia paraesthetica - burning numbness of the outer thigh - is caused by compression at the inguinal ligament from tight belts, obesity or pregnancy.' }, { depth: SUP });
  leg('nerve-femoral', 'femoral nerve', 'Nervus femoralis', 'body', H.merge([
    LG([F0, [0.06, 1.0, -0.028], [0.07, 0.96, 0.0], [0.078, 0.935, 0.035], [0.082, 0.915, 0.056], FT], 0.0036),
    fine([FT, [0.09, 0.85, 0.068], [0.087, 0.75, 0.062], [0.08, 0.62, 0.052]], taper(0.0011, 0.0006), { step: 0.01 }),                  // anterior cutaneous / sartorius
    fine([FT, [0.095, 0.86, 0.06], [0.098, 0.8, 0.054]], 0.0012), fine([FT, [0.09, 0.86, 0.045], [0.093, 0.78, 0.03]], 0.0012),       // rectus femoris, vastus intermedius
    fine([FT, [0.1, 0.87, 0.05], [0.118, 0.8, 0.04], [0.13, 0.7, 0.025]], 0.0012, { step: 0.01 }),                                   // vastus lateralis
    fine([FT, [0.075, 0.86, 0.05], [0.065, 0.76, 0.04], [0.06, 0.64, 0.03]], 0.0012, { step: 0.01 }),                                // vastus medialis
    LG([FT, [0.078, 0.86, 0.052], [0.068, 0.78, 0.04], [0.058, 0.68, 0.025], [0.052, 0.6, 0.008], [0.05, 0.54, -0.008], [0.052, 0.47, -0.01], [0.058, 0.38, -0.006], [0.064, 0.26, 0.002], [0.07, 0.15, 0.008], [0.076, 0.095, 0.01], [0.078, 0.06, 0.04], [0.082, 0.045, 0.08]], taper(0.0016, 0.0008))]), 'lumbar-plexus', {   // saphenous nerve
    description: 'The largest branch of the lumbar plexus (L2-L4). It emerges from the lateral border of psoas, runs in the groove between psoas and iliacus, passes under the inguinal ligament just lateral to the femoral artery and within a few centimetres fans out in the femoral triangle; its longest branch, the saphenous nerve, follows the adductor canal to the inner knee and runs down the inner leg to the foot.',
    function: 'Motor to iliacus, pectineus, sartorius and the four heads of quadriceps (knee extension); sensation from the front of the thigh and, via the saphenous nerve, the inner leg and foot.',
    size: 'About 4 mm thick at the groin; the saphenous nerve ~50 cm long', notes: 'The knee-jerk reflex tests it (L3-L4). A femoral nerve block lateral to the pulse in the groin (order N-A-V: nerve, artery, vein from outside in) relieves the pain of a hip fracture.' });
  leg('nerve-obturator', 'obturator nerve', 'Nervus obturatorius', 'body', H.merge([
    LG([O0, [0.04, 0.98, -0.03], [0.055, 0.945, -0.01], [0.06, 0.915, 0.02], [0.058, 0.895, 0.035]], 0.0028),
    fine([[0.058, 0.895, 0.035], [0.052, 0.85, 0.04], [0.045, 0.76, 0.03], [0.04, 0.68, 0.02]], taper(0.0014, 0.0008), { step: 0.01 }),   // anterior branch
    fine([[0.058, 0.895, 0.035], [0.058, 0.86, 0.02], [0.055, 0.76, 0.004]], taper(0.0013, 0.0008), { step: 0.01 })]), 'lumbar-plexus', {   // posterior branch
    description: 'Leaves the medial border of psoas at the pelvic brim, runs along the side wall of the pelvis and leaves through the obturator canal at the top of the obturator foramen, then splits into anterior and posterior branches around adductor brevis.',
    function: 'Motor to the adductor muscles of the thigh (adductor longus, brevis and part of magnus, gracilis, obturator externus); sensation from a patch of skin on the inner thigh.',
    size: 'About 3 mm thick; ~25 cm long', notes: 'A pelvic tumour or hernia through the obturator canal pressing on it causes pain referred to the inner knee (Howship-Romberg sign); it is blocked during bladder surgery to stop the leg jerking.' });
  leg('nerve-sciatic', 'sciatic nerve', 'Nervus ischiadicus', 'legL',
    tube([SC0, [0.085, 0.9, -0.08], [0.098, 0.87, -0.076], [0.095, 0.82, -0.058], [0.092, 0.74, -0.048], [0.092, 0.66, -0.045], SPL], t => 0.008 - 0.0028 * H.smoothstep(0.55, 1, t), { radial: 10, step: 0.012 }), 'sacral-plexus', {
    description: 'The thickest and longest nerve in the body (L4-S3). It leaves the pelvis through the greater sciatic foramen below piriformis, curves down under gluteus maximus between the greater trochanter and the ischial tuberosity, and descends in the middle of the back of the thigh deep to the hamstrings, dividing above the knee into the tibial and common fibular nerves.',
    function: 'Motor to the hamstrings and part of adductor magnus, and through its two divisions to every muscle below the knee; sensation from nearly all of the leg below the knee and the foot.',
    size: 'Up to 2 cm wide at its origin; ~50 cm from the pelvis to the knee', notes: 'Sciatica - pain shooting down the back of the leg - is usually caused by a disc pressing on its L5 or S1 root. Buttock injections go in the upper outer quadrant to avoid it.' });
  leg('nerve-tibial', 'tibial nerve', 'Nervus tibialis', 'legL', H.merge([
    LG([SPL, [0.09, 0.55, -0.046], [0.09, 0.5, -0.042], [0.09, 0.44, -0.036], [0.09, 0.36, -0.03], [0.088, 0.25, -0.026], [0.082, 0.15, -0.028], [0.076, 0.1, -0.028], [0.075, 0.07, -0.022], [0.078, 0.045, -0.01]], taper(0.0045, 0.003)),
    fine([[0.078, 0.045, -0.01], [0.08, 0.028, 0.03], [0.083, 0.016, 0.09], [0.087, 0.0085, 0.135]], taper(0.0018, 0.001), { step: 0.008 }),   // medial plantar
    fine([[0.083, 0.016, 0.09], [0.081, 0.009, 0.11], [0.078, 0.0075, 0.125], [0.074, 0.0072, 0.135]], 0.0008),                              // plantar digital branch to the big toe (to the base of the toe)
    fine([[0.078, 0.045, -0.01], [0.09, 0.025, 0.02], [0.105, 0.018, 0.07], [0.115, 0.014, 0.12]], taper(0.0016, 0.0009), { step: 0.008 }), // lateral plantar
    fine([[0.076, 0.07, -0.024], [0.082, 0.035, -0.045], [0.088, 0.022, -0.06]], 0.0008)]), 'nerve-sciatic', {                              // medial calcaneal
    description: 'The larger division of the sciatic nerve. It runs straight down the middle of the popliteal fossa, passes under the fibrous arch of soleus, descends deep in the calf with the posterior tibial artery, curves behind the medial malleolus through the tarsal tunnel and divides into the medial and lateral plantar nerves of the sole.',
    function: 'Motor to the calf muscles (pointing the foot and toes, inversion) and all the small muscles of the sole; sensation from the heel and the sole.',
    size: 'About 4 mm thick; ~45 cm from the knee to the ankle', notes: 'Tarsal tunnel syndrome - compression behind the medial malleolus - causes burning pain in the sole. Tibial nerve loss prevents standing on tiptoe and abolishes the ankle jerk.' });
  leg('nerve-common-fibular', 'common fibular (peroneal) nerve', 'Nervus fibularis communis', 'legL', H.merge([
    LG([SPL, [0.1, 0.56, -0.05], [0.1043, 0.54, -0.0459], [0.1085, 0.52, -0.0418], [0.114, 0.505, -0.0386], [0.12, 0.49, -0.035], [0.13, 0.465, -0.02], [0.134, 0.45, -0.005], [0.13, 0.44, 0.008], [0.125, 0.435, 0.012]], taper(0.0034, 0.003)),
    LG([[0.125, 0.435, 0.012], [0.115, 0.4, 0.012], [0.105, 0.3, 0.008], [0.1, 0.2, 0.01], [0.097, 0.13, 0.012], [0.093, 0.09, 0.012], [0.092, 0.058, 0.05], [0.088, 0.045, 0.1], [0.085, 0.034, 0.125], [0.084, 0.032, 0.13]], taper(0.0022, 0.001)),   // deep fibular (to the first web space)
    LG([[0.125, 0.435, 0.012], [0.13, 0.4, 0.004], [0.126, 0.35, 0.006], [0.122, 0.3, 0.01], [0.117, 0.25, 0.013], [0.112, 0.2, 0.016], [0.1056, 0.15, 0.0158], [0.101, 0.11, 0.015], [0.0996, 0.1, 0.0154], [0.0995, 0.085, 0.019], [0.1, 0.075, 0.028], [0.103, 0.062, 0.05], [0.1, 0.048, 0.09]], taper(0.0022, 0.0012)),   // superficial fibular (anterolateral, subcutaneous in the lower third)
    fine([[0.1, 0.048, 0.09], [0.093, 0.04, 0.12], [0.091, 0.032, 0.135]], 0.0008), fine([[0.1, 0.048, 0.09], [0.11, 0.04, 0.12], [0.113, 0.031, 0.135]], 0.0008)]), 'nerve-sciatic', {   // dorsal digital nerves (to the toe bases)
    description: 'The smaller, lateral division of the sciatic nerve. It follows the biceps femoris tendon to the back of the fibular head, winds around the neck of the fibula just under the skin and divides into the superficial fibular nerve (lateral compartment, then the top of the foot) and the deep fibular nerve (front compartment, then the first web space).',
    function: 'Motor to the muscles that lift the foot and toes (deep branch) and turn the sole outward (superficial branch); sensation from the outer leg, most of the top of the foot and the skin between the first two toes.',
    size: 'About 3 mm thick; ~15 cm before dividing, branches ~40 cm', notes: 'The most frequently injured nerve of the leg: a fibular-neck fracture, a tight plaster cast or habitual leg-crossing presses it against the bone, causing foot drop and a high-stepping gait.' });
  leg('nerve-sural', 'sural nerve', 'Nervus suralis', 'legL', H.merge([
    fine([[0.09, 0.49, -0.045], [0.092, 0.42, -0.05], [0.094, 0.34, -0.046], [0.1, 0.25, -0.042]], taper(0.0012, 0.0014), { step: 0.01 }),   // medial sural cutaneous (from tibial)
    fine([[0.12, 0.49, -0.035], [0.114, 0.4, -0.045], [0.1, 0.25, -0.042]], 0.0009, { step: 0.01 }),                                        // sural communicating branch (from common fibular)
    LG([[0.1, 0.25, -0.042], [0.103, 0.2, -0.038], [0.105, 0.16, -0.034], [0.1058, 0.125, -0.0301], [0.1097, 0.095, -0.0296], [0.114, 0.07, -0.018], [0.118, 0.055, -0.005], [0.125, 0.035, 0.05], [0.128, 0.02, 0.12]], taper(0.0015, 0.0008))]), 'nerve-tibial', {
    description: 'A cutaneous nerve formed by the medial sural branch of the tibial nerve and a communicating branch from the common fibular nerve. It descends just under the skin down the back of the calf beside the small saphenous vein, passes behind the lateral malleolus and runs along the outer edge of the foot to the little toe.',
    function: 'Sensation from the lower back of the calf, the outer ankle and the lateral border of the foot.',
    size: 'About 2 mm thick; ~40 cm long', notes: 'Losing it only numbs a strip of the foot, so it is the standard donor for nerve grafts and the nerve biopsied to diagnose peripheral neuropathy.' }, { depth: SUP });
  {
    const male = ctx.sex !== 'female';
    const pc = [[0.036, 0.902, -0.052], [0.055, 0.898, -0.068], [0.066, 0.892, -0.08], [0.062, 0.884, -0.082], [0.058, 0.875, -0.07], [0.055, 0.868, -0.045], [0.048, 0.866, -0.015], [0.03, 0.866, 0.015], [0.014, 0.874, 0.045]];
    const dors = male ? [[0.014, 0.874, 0.045], [0.007, 0.885, 0.066], [0.006, 0.886, 0.085], [0.006, 0.878, 0.106], [0.006, 0.86, 0.1155], [0.006, 0.84, 0.1135], [0.005, 0.82, 0.108]] : [[0.014, 0.874, 0.045], [0.006, 0.878, 0.05], [0.004, 0.874, 0.052]];
    leg('nerve-pudendal', 'pudendal nerve', 'Nervus pudendus', 'pelvis', H.merge([
      T6(pc, taper(0.0026, 0.0016)), fine(dors, 0.0008),
      fine([[0.055, 0.868, -0.045], [0.03, 0.866, -0.055], [0.012, 0.866, -0.06]], 0.0008),                                           // inferior rectal nerve
      fine([[0.048, 0.866, -0.015], [0.035, 0.863, 0.0], [0.02, 0.862, 0.01]], 0.0008)]), 'sacral-plexus', {                           // perineal branches
      description: 'Arises from S2-S4, leaves the pelvis through the greater sciatic foramen, hooks around the sacrospinous ligament at the ischial spine, re-enters through the lesser sciatic foramen and runs forward in the pudendal (Alcock) canal on the wall of the ischioanal fossa, giving the inferior rectal, perineal and dorsal ' + (male ? 'penile' : 'clitoral') + ' nerves.',
      function: 'Motor to the external anal and urethral sphincters and the perineal muscles; sensation from the anus, perineum and external genitalia - the nerve of continence and sexual sensation.',
      size: 'About 3 mm thick; ~15 cm long', notes: 'A pudendal block at the ischial spine is used in childbirth and perineal repairs; long-distance cyclists can compress it on the saddle, causing genital numbness.' });
  }

  // ================================================================ AUTONOMIC PLEXUSES: splanchnic nerves, celiac, superior mesenteric, cardiac, hypogastric, enteric marker
  const net = (pts, r) => fine(pts, r || 0.0006, { radial: 5, step: 0.006 });
  const ring = (c, R, tilt, n) => { const p = []; for (let i = 0; i < (n || 8); i++) { const a = i / (n || 8) * Math.PI * 2; p.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a) * Math.cos(tilt || 0), c[2] + R * Math.sin(a) * Math.sin(tilt || 0)]); } return fine(p, 0.0006, { radial: 5, step: 0.004, closed: true }); };
  const CEL = [0, 1.14, -0.03], CGL = [0.017, 1.142, -0.03], CGR = [-0.017, 1.138, -0.03];
  {
    // greater (T5-T9), lesser (T10-T11) and least (T12) splanchnic nerves: from the thoracic ganglia down the vertebral bodies, through the crura
    const gi = n => SYMG[n + 1][0];   // SYMG index of thoracic ganglion Tn (T2 = 3)
    const side = (s, xs) => {
      const X = p => [p[0] * xs, p[1], p[2]], P = [];
      const gsp = [[0.024, 1.315, -0.072], [0.026, 1.255, -0.064], [0.024, 1.2, -0.057], [0.022, 1.17, -0.045], [0.019, 1.152, -0.034], [CGL[0], CGL[1] + 0.004, CGL[2]]];
      const zAt = y => -0.064 - 0.008 * (y - 1.255) / 0.06;
      [5, 6, 7, 8, 9].forEach(n => { const g0 = gi(n), ye = Math.max(1.262, g0[1] - 0.04); P.push(net([X(g0), X([0.023, g0[1] - 0.014, g0[2] + 0.002]), X([0.025, ye, zAt(ye)])], 0.0007)); });
      P.push(fine(gsp.map(X), 0.0012, { radial: 6, step: 0.006 }));
      P.push(net([X(gi(10)), X([0.026, 1.2, -0.06]), X([0.025, 1.16, -0.05]), X([0.022, 1.12, -0.04])], 0.0009), net([X(gi(11)), X([0.026, 1.19, -0.058])], 0.0007));
      P.push(net([X(gi(12)), X([0.028, 1.15, -0.055]), X([0.03, 1.115, -0.05]), X([0.032, 1.1, -0.048])], 0.0008));
      P.push(bead(X([0.022, 1.118, -0.04]), [0.0028, 0.0035, 0.002], 3 + s));   // aorticorenal ganglion
      return P;
    };
    mk(gAU, { id: 'splanchnic-nerves', name: 'Thoracic splanchnic nerves', latin: 'Nervi splanchnici thoracici (major, minor, imus)', side: 'M', region: 'body', geometry: H.merge(side(1, 1).concat(side(2, -0.85))), tags: ['autonomic'],
      info: { description: 'Three nerves on each side that leave the thoracic sympathetic ganglia and run down and forward over the sides of the vertebral bodies, piercing the crura of the diaphragm: the greater splanchnic (roots T5-T9) ends in the celiac ganglion, the lesser (T10-T11) in the aorticorenal ganglion and the least (T12) in the renal plexus.',
        function: 'Carry preganglionic sympathetic fibres that pass through the chain without synapsing, to relay in the abdominal prevertebral ganglia (and directly to the adrenal medulla), plus pain fibres from the upper abdominal organs.',
        size: 'Greater splanchnic ~2-3 mm thick and ~20 cm long; lesser and least thinner', notes: 'Because they carry visceral pain, blocking or cutting them (splanchnicectomy) relieves the severe pain of pancreatic cancer and chronic pancreatitis.' } });
  }
  {
    const crescent = (c, s) => { const g = H.blob([1, 1, 1], { ws: 14, hs: 10, deform: p => new THREE.Vector3(c[0] + p.x * 0.0055 * (1 + 0.15 * H.fbm(p.x * 3 + s, p.y * 3, p.z * 3, 2)) - s * 0.004 * p.y * p.y, c[1] + p.y * 0.009, c[2] + p.z * 0.003) }); g.computeVertexNormals(); return g; };
    mk(gAU, { id: 'celiac-plexus', name: 'Celiac plexus and ganglia', latin: 'Plexus coeliacus; ganglia coeliaca', side: 'M', region: 'abdomen', tags: ['autonomic', 'plexus'], geometry: H.merge([
      crescent(CGL, 1), crescent(CGR, -1), ring([0, 1.14, -0.026], 0.009, 0.25, 9), ring([0, 1.14, -0.028], 0.014, 0.2, 10),
      net([CGL, [0.012, 1.162, -0.02], [0.016, 1.18, -0.008], [0.02, 1.192, 0.004]]),                  // left gastric plexus
      net([CGL, [0.05, 1.146, -0.035], [0.085, 1.142, -0.042]]), net([CGR, [-0.04, 1.145, -0.017], [-0.06, 1.152, 0.0]]),   // splenic, hepatic
      net([CGL, [0.03, 1.108, -0.045], [0.036, 1.1, -0.05]]), net([CGR, [-0.028, 1.095, -0.045], [-0.035, 1.085, -0.05]]),   // renal plexuses
      net([CGL, [0.04, 1.158, -0.05]]), net([CGR, [-0.04, 1.15, -0.052]]), net([CGL, [0.006, 1.125, -0.028], [0.003, 1.116, -0.027]]), net([CGR, [-0.006, 1.125, -0.028], [-0.003, 1.116, -0.027]])]),
      info: { description: 'The largest autonomic plexus ("solar plexus"): a dense web of nerve fibres and two irregular crescent-shaped celiac ganglia wrapped around the origin of the celiac trunk on the front of the aorta at the T12-L1 level, just behind the stomach and pancreas.',
        function: 'Sympathetic relay (from the greater splanchnic nerves) and parasympathetic crossroads (vagal fibres) for the stomach, liver, gallbladder, spleen, pancreas, kidneys, adrenals and small intestine; it also carries their pain signals.',
        size: 'Ganglia 1.5-2 cm each; the plexus spans ~4 cm', notes: 'A blow to the "solar plexus" knocks the wind out of you by jarring the diaphragm and this plexus; a celiac plexus block, guided by CT or endoscopic ultrasound, is the standard treatment for pain from pancreatic cancer.' } });
    // superior mesenteric plexus: three strands spiralling around the superior mesenteric artery, with a small ganglion
    const sma = [[0, 1.118, -0.03], [0, 1.1, -0.017], [-0.002, 1.075, 0.0], [-0.006, 1.045, 0.015], [-0.012, 1.02, 0.025]];
    const strands = [0, 1, 2].map(k => { const P = []; for (let i = 0; i <= 14; i++) { const t = i / 14, c = H.curvePoint(sma, t), c2 = H.curvePoint(sma, Math.min(1, t + 0.02)), c1 = H.curvePoint(sma, Math.max(0, t - 0.02)); const tg = c2.sub(c1).normalize(), n1 = new THREE.Vector3(1, 0, 0), n2 = new THREE.Vector3().crossVectors(tg, n1).normalize(), a = t * Math.PI * 4 + k * Math.PI * 2 / 3, rr = 0.0055 * (1 - 0.3 * t); P.push([c.x + rr * Math.cos(a), c.y + rr * Math.sin(a) * n2.y, c.z + rr * Math.sin(a) * n2.z]); } return net(P, 0.0005); });
    mk(gAU, { id: 'superior-mesenteric-plexus', name: 'Superior mesenteric plexus', latin: 'Plexus mesentericus superior', side: 'M', region: 'abdomen', parent: 'celiac-plexus', tags: ['autonomic', 'plexus'], geometry: H.merge(strands.concat([
      bead([0.005, 1.114, -0.027], [0.003, 0.0035, 0.0022], 4.4), net([[-0.002, 1.075, 0.0], [0.025, 1.05, 0.03], [0.04, 1.03, 0.045]]), net([[-0.006, 1.045, 0.015], [-0.03, 1.02, 0.035], [-0.045, 1.0, 0.04]]), net([[-0.009, 1.03, 0.02], [-0.015, 1.0, 0.045]])])),
      info: { description: 'A continuation of the celiac plexus that surrounds the superior mesenteric artery like a sleeve, with a small superior mesenteric ganglion at the artery\'s origin; its fibres follow the arterial branches into the mesentery.',
        function: 'Autonomic supply to the small intestine, caecum, appendix, ascending and most of the transverse colon (midgut): sympathetic fibres slow peristalsis and narrow vessels, vagal fibres stimulate secretion and motility.',
        size: 'Sleeve ~1 cm wide along 5-10 cm of the artery', notes: 'Midgut pain from these fibres is felt around the umbilicus, which is why appendicitis begins as vague central abdominal pain before settling in the right lower quadrant.' } });
  }
  {
    const CP = [0.004, 1.355, -0.004], P = [ring(CP, 0.009, 1.2, 9), ring([0.006, 1.35, 0.006], 0.006, 0.4, 7), bead([0.008, 1.352, 0.006], [0.0028, 0.0022, 0.0022], 7.7), bead([-0.004, 1.36, -0.01], [0.0024, 0.002, 0.002], 8.3)];
    for (const xs of [1, -1]) {
      const X = p => [p[0] * xs, p[1], p[2]];
      P.push(net([X(SYMG[0][0]), X([0.022, 1.5, -0.006]), X([0.018, 1.42, -0.006]), CP], 0.0005), net([X(SYMG[1][0]), X([0.016, 1.42, -0.008]), CP], 0.0005),
        net([X(SYMG[2][0]), X([0.016, 1.4, -0.01]), CP], 0.0006), net([X([0.028, 1.47, 0.013]), X([0.022, 1.41, 0.006]), CP], 0.0005),
        net([CP, X([0.03, 1.35, -0.02]), X([0.045, 1.35, -0.026])], 0.0006));   // cardiac nerves in, pulmonary plexus out
    }
    P.push(net([CP, [-0.01, 1.33, 0.03], [-0.02, 1.3, 0.05], [-0.022, 1.25, 0.062]], 0.0006), net([CP, [0.02, 1.33, 0.032], [0.04, 1.3, 0.062], [0.062, 1.25, 0.066]], 0.0006));   // right and left coronary plexuses
    mk(gAU, { id: 'cardiac-plexus', name: 'Cardiac plexus', latin: 'Plexus cardiacus', side: 'M', region: 'body', geometry: H.merge(P), tags: ['autonomic', 'plexus'],
      info: { description: 'A web of autonomic nerves at the base of the heart - its superficial part below the aortic arch, its deep part between the arch and the tracheal bifurcation - fed by cardiac branches of both sympathetic trunks (cervical and upper thoracic ganglia) and both vagus nerves; it continues along the coronary arteries and into the lung roots.',
        function: 'Sets heart rate and force: sympathetic fibres speed the SA node and strengthen contraction, vagal fibres slow the rate and AV conduction; it also carries cardiac pain fibres back to T1-T4.',
        size: 'About 3-4 cm across; individual cardiac nerves 0.5-1 mm', notes: 'Heart pain travels with the sympathetic fibres to T1-T4, so angina is felt in the chest, left arm and jaw (referred pain). A transplanted heart has no plexus connections, so its rate only rises slowly with circulating adrenaline.' } });
  }
  {
    const P = [];
    for (let k = 0; k < 4; k++) { const Q = []; for (let i = 0; i <= 6; i++) { const t = i / 6; Q.push([(k - 1.5) * 0.004 + 0.002 * Math.sin(t * 9 + k * 1.7), 1.045 - t * 0.05, -0.026 + 0.004 * t]); } P.push(net(Q, 0.0006)); }
    for (const xs of [1, -1]) {
      const X = p => [p[0] * xs, p[1], p[2]], IH = X([0.032, 0.915, -0.045]);
      P.push(net([X([0.005, 0.995, -0.022]), X([0.018, 0.968, -0.03]), X([0.028, 0.938, -0.042]), IH], 0.0009));   // hypogastric nerve
      P.push(ring(IH, 0.007, 1.5708, 8), bead(IH, [0.0022, 0.004, 0.003], 2.9 + xs));
      ['s2', 's3', 's4'].forEach(n => P.push(net([X(LV[n].vEnd), X([(LV[n].vEnd[0] + IH[0]) / 2, (LV[n].vEnd[1] + IH[1]) / 2, (LV[n].vEnd[2] + IH[2]) / 2 + 0.004]), IH], 0.0006)));   // pelvic splanchnic nerves
      P.push(net([IH, X([0.028, 0.905, -0.01]), X([0.02, 0.905, 0.025])], 0.0006), net([IH, X([0.02, 0.9, -0.058])], 0.0005));
    }
    mk(gAU, { id: 'hypogastric-plexus', name: 'Superior and inferior hypogastric plexuses', latin: 'Plexus hypogastricus superior et inferior', side: 'M', region: 'pelvis', geometry: H.merge(P), tags: ['autonomic', 'plexus'],
      info: { description: 'The superior hypogastric plexus is a flat band of fibres in front of the fifth lumbar vertebra, just below the aortic bifurcation. It divides into right and left hypogastric nerves that descend to the inferior hypogastric (pelvic) plexuses on the sides of the rectum, where the parasympathetic pelvic splanchnic nerves (S2-S4) join them.',
        function: 'Controls the bladder, rectum and sexual organs: parasympathetic fibres empty the bladder and cause erection, sympathetic fibres close the bladder neck and drive ejaculation.',
        size: 'Superior plexus ~4-5 cm long; each inferior plexus ~4 cm across', notes: 'Injury to these plexuses during rectal or prostate surgery can cause bladder and erectile dysfunction, so surgeons use nerve-sparing techniques; blocking the superior plexus relieves pelvic cancer pain.' } });
  }
  {
    // enteric (myenteric) plexus marker: a lattice of fibre bundles and ganglia wrapped on a short piece of jejunum
    const c = [0.045, 1.02, 0.065], R = 0.0125, P = [];
    for (let i = 0; i < 4; i++) { const x = c[0] - 0.015 + i * 0.01, Q = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; Q.push([x + 0.002 * Math.sin(a * 3 + i), c[1] + R * Math.cos(a), c[2] + R * Math.sin(a)]); } P.push(fine(Q, 0.0005, { radial: 5, step: 0.004, closed: true })); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; P.push(net([[c[0] - 0.016, c[1] + R * Math.cos(a), c[2] + R * Math.sin(a)], [c[0] + 0.016, c[1] + R * Math.cos(a + 0.2), c[2] + R * Math.sin(a + 0.2)]], 0.0004)); }
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + i; P.push(bead([c[0] - 0.015 + i * 0.01, c[1] + R * Math.cos(a), c[2] + R * Math.sin(a)], [0.0014, 0.0014, 0.0014], i * 3 + k)); }
    mk(gAU, { id: 'enteric-plexus', name: 'Enteric (myenteric) plexus - marker', latin: 'Plexus entericus (myentericus)', side: 'M', region: 'abdomen', geometry: H.merge(P), tags: ['autonomic', 'plexus', 'marker'], depth: 0.6,
      info: { description: 'A representative piece of the enteric nervous system: a net of small ganglia and fibre bundles lying between the muscle layers of the gut wall (myenteric plexus), with a finer submucosal plexus inside it. It runs continuously from the oesophagus to the anus; only a short segment is shown.',
        function: 'The "second brain" of the gut: its roughly 500 million neurons coordinate peristalsis, secretion and local blood flow on their own, merely adjusted by vagal and sympathetic input.',
        size: 'Ganglia 0.1-0.5 mm (enlarged here); network mesh a few millimetres', notes: 'Congenital absence of these ganglia in the last part of the colon (Hirschsprung disease) leaves a segment that cannot relax, causing severe constipation in newborns.' } });
  }

  // ================================================================ NEURON INSET (magnified multipolar neuron beside/above the left shoulder)
  // Centred at x 0.285 (not 0.34) so the whole inset stays inside the atlas body envelope (x <= 0.33); spans y 1.47-1.60.
  {
    const gIN = H.group('inset-neuron'); root.add(gIN);
    const S = [0.285, 1.56, 0.02];
    const ins = (id, name, latin, geom, color, depth, info) => mk(gIN, { id, name, latin, side: 'M', region: 'body', geometry: geom, color, depth, tags: ['inset'], parent: id === 'inset-neuron-soma' ? null : 'inset-neuron-soma', info });
    const DIRS = [[0.05, 1, 0.1], [0.55, 0.8, 0.2], [-0.65, 0.72, -0.1], [0.8, 0.12, -0.3], [-0.85, 0.05, 0.35], [0.1, 0.45, -0.85]].map(d => new THREE.Vector3(d[0], d[1], d[2]).normalize());
    const soma = H.blob([0.0075, 0.008, 0.0068], { ws: 24, hs: 16, deform: p => { let s = 1 + 0.06 * H.fbm(p.x * 3, p.y * 3, p.z * 3, 2); DIRS.forEach(d => { s += 0.5 * Math.pow(Math.max(0, p.dot(d)), 6); }); return s + 0.45 * Math.pow(Math.max(0, -p.y), 5); } });
    soma.translate(S[0], S[1], S[2]);
    ins('inset-neuron-soma', 'Neuron cell body (soma) - magnified', 'Soma (pericaryon) neuronis', soma, '#e0a84a', 0.2, {
      description: 'Magnified model (about 1000x) of a multipolar neuron such as a spinal motor neuron. The cell body holds the nucleus, stacks of rough endoplasmic reticulum (Nissl bodies) and the machinery that makes the proteins for the whole cell.',
      function: 'Keeps the entire neuron alive and integrates the signals arriving on its dendrites before firing an impulse from the axon hillock.',
      size: 'Real soma 20-100 micrometres across; shown ~16 mm', notes: 'Neurons do not divide, so a lost cell body is not replaced; motor neurone disease (ALS) destroys exactly these cells.' });
    ins('inset-neuron-nucleus', 'Neuron nucleus', 'Nucleus neuronis', H.blob(0.0034, { ws: 16, hs: 12 }).translate(S[0], S[1] + 0.0005, S[2] + 0.001), '#5d3f8e', 0.5, {
      description: 'A large, round, pale nucleus with a prominent nucleolus sitting in the middle of the soma - the sign of a cell making proteins at a very high rate.',
      function: 'Stores the DNA and directs protein synthesis for the soma, dendrites and the whole length of the axon.',
      size: 'About 10-20 micrometres in reality', notes: 'When an axon is cut, the nucleus moves to the edge of the soma and the Nissl bodies dissolve (chromatolysis) as the cell switches to repair mode.' });
    const dend = [];
    const branch = (a, dir, len, r, lvl, seed) => {
      const bend = new THREE.Vector3(H.noise3(seed, 1.3, 0.7), H.noise3(0.4, seed, 2.1), H.noise3(1.9, 0.2, seed)).multiplyScalar(0.25 * len);
      const b = a.clone().addScaledVector(dir, len), m = a.clone().lerp(b, 0.5).add(bend);
      dend.push(fine([a, m, b], taper(r, r * 0.7), { radial: 6, step: 0.004 }));
      if (lvl >= 2) return;
      const perp = new THREE.Vector3().crossVectors(dir, Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).normalize().applyAxisAngle(dir, seed * 1.3);
      [-1, 1].forEach(sg => branch(b, dir.clone().multiplyScalar(Math.cos(0.6)).addScaledVector(perp, sg * Math.sin(0.6)).normalize(), len * 0.7, r * 0.65, lvl + 1, seed * 1.7 + sg));
    };
    DIRS.forEach((d, i) => { const len = d.x > 0.5 ? 0.009 : 0.012; branch(new THREE.Vector3(S[0], S[1], S[2]).addScaledVector(d, 0.0065), d, len, 0.0016, 0, i + 1.1); });
    ins('inset-neuron-dendrites', 'Dendrites', 'Dendritae', H.merge(dend), '#e3b85c', 0.2, {
      description: 'Several thick, tapering processes that leave the soma and branch again and again into a tree; their surfaces are studded with tiny spines where other neurons make contact.',
      function: 'Collect thousands of incoming synaptic signals and carry the resulting graded potentials toward the soma, where they are added up at the axon hillock.',
      size: 'A real dendritic tree spans 0.2-1 mm; branches taper from ~5 to under 1 micrometre', notes: 'Dendritic spines grow and shrink with learning; their loss is an early change in Alzheimer disease.' });
    const AX = [[0.285, 1.551, 0.02], [0.2855, 1.54, 0.0205], [0.2845, 1.525, 0.0195], [0.2855, 1.51, 0.0205], [0.285, 1.495, 0.02], [0.285, 1.484, 0.02]];
    ins('inset-neuron-axon', 'Axon', 'Axon (neuritum)', tube(AX, 0.0009, { radial: 8, step: 0.003 }), '#e8d24a', 0.35, {
      description: 'The single long output fibre. It leaves the soma at a cone-shaped axon hillock, runs inside its myelin sheath and ends in terminal branches at the synapse.',
      function: 'Conducts the action potential - an all-or-nothing electrical impulse - away from the cell body, and transports proteins and organelles along its length in both directions.',
      size: '1-20 micrometres thick; from under 1 mm to over 1 m long (spinal cord to big toe)', notes: 'After a peripheral nerve injury the axon can regrow about 1 mm a day inside its old sheath, which is why feeling returns to the fingertips months after a wrist injury.' });
    const my = [], nodes = [];
    for (let k = 0; k < 5; k++) {
      const ta = 0.12 + k * 0.155, tb = ta + 0.14, P = [];
      for (let i = 0; i <= 8; i++) P.push(H.curvePoint(AX, ta + (tb - ta) * i / 8));
      my.push(H.tube(P, u => 0.0028 * Math.sqrt(Math.min(1, u * 5, (1 - u) * 5)) + 0.0002, { radial: 12, tubular: 12 }));
      if (k < 4) {
        const t = tb + 0.0075, c = H.curvePoint(AX, t), tg = H.curvePoint(AX, t + 0.01).sub(H.curvePoint(AX, t - 0.01));
        const tor = H.torus(0.0013, 0.00045, { radial: 6, tubular: 14 }); tor.rotateX(-Math.PI / 2); H.aim(tor, tg); tor.translate(c.x, c.y, c.z); nodes.push(tor);
      }
    }
    ins('inset-neuron-myelin', 'Myelin sheath', 'Stratum myelini', H.merge(my), '#f4efe2', 0.0, {
      description: 'Segments of fatty insulation wrapped around the axon in dozens of tight spiral layers - made by Schwann cells in peripheral nerves and by oligodendrocytes in the brain and spinal cord.',
      function: 'Insulates the axon so the impulse jumps from gap to gap (saltatory conduction), raising conduction speed from about 1 m/s to as much as 120 m/s.',
      size: 'Each internode 0.2-2 mm long; sheath up to ~2 micrometres thick', notes: 'Multiple sclerosis strips myelin in the brain and cord; Guillain-Barre syndrome attacks peripheral myelin, causing rapidly ascending weakness.' });
    ins('inset-neuron-nodes-of-ranvier', 'Nodes of Ranvier', 'Nodi fibrae nervosae (Ranvier)', H.merge(nodes), '#3fa7c4', 0.05, {
      description: 'Short bare gaps between neighbouring myelin segments, where the axon membrane is exposed and densely packed with voltage-gated sodium channels.',
      function: 'Regenerate the action potential at each gap so the signal leaps from node to node instead of creeping along the whole membrane.',
      size: 'About 1 micrometre long, spaced 0.2-2 mm apart', notes: 'Local anaesthetics work by blocking the sodium channels at the nodes; blocking about three nodes in a row stops conduction completely.' });
    const end = AX[AX.length - 1], B = [[0.276, 1.4772, 0.0205], [0.285, 1.4768, 0.0225], [0.294, 1.4772, 0.0192]];
    const syn = [];
    B.forEach((b, i) => { syn.push(fine([end, [(end[0] + b[0]) / 2, end[1] - 0.002, (end[2] + b[2]) / 2], [b[0], b[1] + 0.0015, b[2]]], 0.0005, { radial: 6, step: 0.002 })); const k = H.blob([0.0021, 0.0017, 0.0021], { ws: 12, hs: 8, deform: p => 1 - 0.25 * Math.max(0, -p.y) }); k.translate(b[0], b[1], b[2]); syn.push(k); });
    ins('inset-neuron-synapse', 'Synapse (axon terminals and boutons)', 'Synapsis; boutons terminaux', H.merge(syn), '#e0703a', 0.2, {
      description: 'The axon ends in fine terminal branches whose swollen tips (boutons) come within 20-40 nanometres of the next cell. Each bouton is packed with vesicles of neurotransmitter lined up at the release zone facing the synaptic cleft.',
      function: 'Converts the electrical impulse into a chemical message: calcium entering the bouton triggers vesicles to release transmitter (e.g. acetylcholine or glutamate) that binds receptors on the next cell.',
      size: 'Boutons 1-2 micrometres; synaptic cleft 20-40 nanometres', notes: 'Most nerve drugs and toxins act here - antidepressants, botulinum toxin (blocks acetylcholine release) and nerve agents; in myasthenia gravis antibodies attack the acetylcholine receptors.' });
    const tgt = H.merge([tube([[0.258, 1.4705, 0.02], [0.27, 1.4718, 0.021], [0.285, 1.4722, 0.0205], [0.3, 1.4718, 0.02], [0.315, 1.4725, 0.019]], 0.0028, { radial: 10, step: 0.004 }),
      fine([[0.265, 1.469, 0.021], [0.266, 1.465, 0.024]], 0.0006), bead([0.266, 1.4645, 0.0245], [0.001, 0.001, 0.001], 1.1), fine([[0.305, 1.47, 0.019], [0.307, 1.466, 0.016]], 0.0006), bead([0.307, 1.4655, 0.0155], [0.001, 0.001, 0.001], 2.2)]);
    ins('inset-neuron-target', 'Postsynaptic dendrite of the next neuron', 'Dendritum postsynapticum', tgt, '#b79ac8', 0.2, {
      description: 'A segment of a dendrite belonging to the next neuron in the chain, with small spines; a receptor-rich postsynaptic density lies under each bouton.',
      function: 'Receives the neurotransmitter and turns it back into an electrical signal - an excitatory or inhibitory postsynaptic potential.',
      size: 'About 1-2 micrometres thick in reality', notes: 'A single cortical neuron receives around 10 000 synapses; strengthening or weakening individual synapses (synaptic plasticity) is the cellular basis of memory.' });
  }

  return root;
});
