/* core/landmarks.js - THE shared body coordinate reference. Every module positions parts from these.
   Units: metres. Ground (sole of foot) y = 0. Standing adult, 1.75 m tall, anatomical position
   (palms forward). Coordinate frame: +Y up, +Z anterior (front of body faces +Z),
   +X = the SUBJECT'S LEFT side (a viewer looking at the front sees the subject's left on the viewer's right).
   Anatomical RIGHT structures therefore have NEGATIVE X. Helper: L.mirror(p) flips X. */
(function (root) {
  const L = {};
  L.height = 1.75;

  // ---- vertical levels (y). Anterior structures use these plus a z from the anchors below ----
  L.y = {
    crown: 1.75, forehead: 1.71, glabella: 1.67, brow: 1.665, eye: 1.635, earCanal: 1.63, noseBridge: 1.645,
    noseTip: 1.60, noseBase: 1.585, upperLip: 1.575, mouth: 1.565, lowerLip: 1.555, chin: 1.525, jawAngle: 1.565,
    hyoid: 1.53, thyroidCartilage: 1.51, cricoid: 1.485, thyroidGland: 1.48,
    C1: 1.585, C7: 1.475, sternalNotch: 1.435, acromion: 1.43, clavicle: 1.43, sternalAngle: 1.37,
    nipple: 1.27, xiphoid: 1.22, carina: 1.36, diaphragmDome: 1.25,
    umbilicus: 1.05, iliacCrest: 1.065, ASIS: 1.00, pubis: 0.905, hipJoint: 0.92, trochanter: 0.93,
    crotch: 0.85, kneeJoint: 0.50, patella: 0.52, tibialTuberosity: 0.46, calfMax: 0.38, ankle: 0.075, sole: 0.0,
    shoulderJoint: 1.42, elbow: 1.10, wrist: 0.85, fingertip: 0.66,
    sacrumTop: 0.99, coccyx: 0.86
  };

  // ---- vertebral column: centre of each vertebral BODY (x=0). z is anterior(+)/posterior(-). ----
  // Cervical lordosis (bodies forward), thoracic kyphosis (bodies back), lumbar lordosis (forward again).
  // h = body height, w = body width (x), d = body depth (z)
  const spine = {};
  const cerv = [1.585, 1.567, 1.549, 1.531, 1.513, 1.494, 1.475];             // C1..C7
  const cervZ = [-0.012, -0.014, -0.016, -0.018, -0.02, -0.024, -0.03];
  for (let i = 0; i < 7; i++) spine['C' + (i + 1)] = { y: cerv[i], z: cervZ[i], h: 0.014, w: 0.022 + i * 0.001, d: 0.016 };
  const thorY0 = 1.455, thorZ = [-0.045, -0.055, -0.063, -0.07, -0.075, -0.078, -0.079, -0.078, -0.075, -0.07, -0.065, -0.06];
  for (let i = 0; i < 12; i++) spine['T' + (i + 1)] = { y: thorY0 - i * 0.025, z: thorZ[i], h: 0.02 + i * 0.0005, w: 0.028 + i * 0.0012, d: 0.022 + i * 0.0008 };
  const lumY = [1.15, 1.117, 1.084, 1.05, 1.017], lumZ = [-0.058, -0.052, -0.045, -0.04, -0.04];
  for (let i = 0; i < 5; i++) spine['L' + (i + 1)] = { y: lumY[i], z: lumZ[i], h: 0.027, w: 0.045 + i * 0.002, d: 0.032 };
  spine.S1 = { y: 0.985, z: -0.045, h: 0.03, w: 0.05, d: 0.03 };
  spine.sacrum = { top: 0.99, bottom: 0.88, zTop: -0.045, zBottom: -0.075, w: 0.105 };
  spine.coccyx = { top: 0.88, bottom: 0.845, z: -0.08 };
  L.spine = spine;
  L.vertebra = function (name) { return spine[name]; };
  L.spineOrder = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5', 'S1'];
  // spinal canal centre sits ~ (body depth/2 + 0.012) posterior to the body centre
  L.canal = function (name) { const v = spine[name]; return { x: 0, y: v.y, z: v.z - v.d / 2 - 0.012 }; };
  L.spinousTip = function (name) { const v = spine[name]; return { x: 0, y: v.y - 0.006, z: v.z - v.d / 2 - 0.045 }; };
  L.spinalCordEnd = { y: 1.117, z: -0.052 - 0.032 / 2 - 0.012 };   // conus medullaris at L1/L2

  // ---- head geometry ----
  L.head = {
    center: [0, 1.655, -0.005], width: 0.155, depth: 0.195, height: 0.23,   // ear-to-ear, glabella-to-occiput, chin-to-crown
    frontZ: 0.095, backZ: -0.10, sideX: 0.0775,
    eyeL: [0.032, 1.635, 0.072], eyeR: [-0.032, 1.635, 0.072], eyeRadius: 0.012, corneaZ: 0.086,
    orbitL: [0.032, 1.638, 0.068], orbitRadius: 0.019,
    earCanalL: [0.072, 1.63, -0.012], earCanalR: [-0.072, 1.63, -0.012], auricleCenterL: [0.078, 1.632, -0.018],
    noseTip: [0, 1.60, 0.118], noseBase: [0, 1.585, 0.10], nostrilL: [0.011, 1.588, 0.105],
    mouth: [0, 1.565, 0.095], chin: [0, 1.525, 0.085], jawAngleL: [0.062, 1.565, -0.01],
    foramenMagnum: [0, 1.578, -0.02],
    brain: { center: [0, 1.665, -0.012], size: [0.14, 0.125, 0.168] },   // width(x), height(y), length(z)
    cerebellum: { center: [0, 1.598, -0.055], size: [0.105, 0.05, 0.06] },
    brainstem: { top: [0, 1.625, -0.02], bottom: [0, 1.578, -0.02], radius: 0.014 },
    pituitary: [0, 1.628, -0.004], pineal: [0, 1.66, -0.032], hypothalamus: [0, 1.64, -0.008], thalamusL: [0.012, 1.655, -0.015],
    corpusCallosumCenter: [0, 1.675, -0.012], lateralVentricleL: [0.014, 1.672, -0.014],
    hardPalate: [0, 1.585, 0.06], tongueCenter: [0, 1.575, 0.05], teethUpperArchFront: [0, 1.578, 0.093]
  };

  // ---- neck ----
  L.neck = {
    center: [0, 1.50, 0], radius: 0.058, hyoid: [0, 1.53, 0.04], thyroidCartilage: [0, 1.51, 0.045],
    cricoid: [0, 1.485, 0.04], tracheaTop: [0, 1.48, 0.035], esophagusTop: [0, 1.48, 0.0],
    carotidL: [0.022, 1.50, 0.022], jugularL: [0.032, 1.50, 0.02], sternocleidomastoidOriginL: [0.02, 1.435, 0.03]
  };

  // ---- trunk cross-section silhouette (used by the skin; every other module stays INSIDE it) ----
  // each: y, rx (half width, X), rz (half depth, Z), cz (centre offset in Z), n (superellipse exponent: 2 = ellipse, >2 = boxier)
  L.trunkSections = [
    { y: 0.86, rx: 0.175, rz: 0.115, cz: -0.005, n: 2.3 },   // crotch level (legs split below this)
    { y: 0.92, rx: 0.178, rz: 0.12, cz: -0.008, n: 2.4 },    // hips widest
    { y: 0.98, rx: 0.168, rz: 0.113, cz: 0.0, n: 2.3 },      // ASIS
    { y: 1.05, rx: 0.15, rz: 0.105, cz: 0.0, n: 2.2 },       // umbilicus / waist
    { y: 1.12, rx: 0.152, rz: 0.106, cz: 0.0, n: 2.2 },
    { y: 1.22, rx: 0.165, rz: 0.113, cz: 0.0, n: 2.3 },      // xiphoid
    { y: 1.30, rx: 0.175, rz: 0.12, cz: 0.0, n: 2.4 },       // chest / nipple
    { y: 1.37, rx: 0.18, rz: 0.118, cz: -0.005, n: 2.4 },
    { y: 1.42, rx: 0.19, rz: 0.11, cz: -0.01, n: 2.4 },      // top of chest, under the shoulders (the deltoid bulge is added by the skin/arms)
    { y: 1.455, rx: 0.12, rz: 0.085, cz: -0.012, n: 2.2 },   // base of neck / trapezius slope
    { y: 1.475, rx: 0.075, rz: 0.068, cz: -0.008, n: 2.1 },
    { y: 1.52, rx: 0.058, rz: 0.06, cz: 0.0, n: 2.1 }        // neck under the chin
  ];
  L.trunk = { chestWidth: 0.35, chestDepth: 0.24, waistWidth: 0.30, waistDepth: 0.21, hipWidth: 0.356, shoulderWidth: 0.46 };
  // approximate skin cross-section at height y: {rx, rz, cz, n} by linear interpolation of trunkSections
  L.trunkAt = function (y) {
    const s = L.trunkSections; if (y <= s[0].y) return s[0]; if (y >= s[s.length - 1].y) return s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) if (y >= s[i].y && y <= s[i + 1].y) {
      const t = (y - s[i].y) / (s[i + 1].y - s[i].y);
      return { y, rx: s[i].rx + (s[i + 1].rx - s[i].rx) * t, rz: s[i].rz + (s[i + 1].rz - s[i].rz) * t, cz: s[i].cz + (s[i + 1].cz - s[i].cz) * t, n: s[i].n };
    }
    return s[0];
  };

  // ---- limbs: joint centres (LEFT side; use L.mirror for the right) and segment radii ----
  L.joint = {
    shoulderL: [0.185, 1.42, -0.01], elbowL: [0.225, 1.10, -0.015], wristL: [0.245, 0.85, 0.01],
    handCenterL: [0.25, 0.77, 0.02], fingertipMiddleL: [0.255, 0.66, 0.025],
    hipL: [0.088, 0.92, -0.005], kneeL: [0.09, 0.50, 0.0], ankleL: [0.092, 0.075, -0.01],
    heelL: [0.092, 0.03, -0.06], toeTipL: [0.10, 0.015, 0.20], ballOfFootL: [0.095, 0.02, 0.13],
    acromionL: [0.20, 1.43, -0.02], sternoclavicularL: [0.015, 1.43, 0.06], scapulaCenterL: [0.09, 1.34, -0.115],
    patellaL: [0.09, 0.52, 0.055]
  };
  L.limb = {
    upperArm: { rTop: 0.048, rBottom: 0.04 }, forearm: { rTop: 0.042, rBottom: 0.028 },
    hand: { length: 0.19, palmWidth: 0.088, palmLength: 0.10, thickness: 0.03, fingerLength: [0.065, 0.075, 0.082, 0.075, 0.06] /* thumb..little */ },
    thigh: { rTop: 0.085, rBottom: 0.058 }, shank: { rTop: 0.058, rCalf: 0.056, rAnkle: 0.034 },
    foot: { length: 0.26, width: 0.095, heightAtAnkle: 0.07 }
  };
  // long bone endpoints (LEFT). Bones run between these; muscles attach near them.
  L.bone = {
    humerusL: { top: [0.185, 1.42, -0.01], bottom: [0.225, 1.10, -0.015], r: 0.011 },
    radiusL: { top: [0.235, 1.09, -0.005], bottom: [0.255, 0.855, 0.012], r: 0.007 },  // lateral / thumb side in anatomical position
    ulnaL: { top: [0.215, 1.10, -0.02], bottom: [0.235, 0.85, 0.008], r: 0.007 },
    femurL: { top: [0.088, 0.92, -0.005], bottom: [0.09, 0.505, -0.005], r: 0.014, neckOrigin: [0.12, 0.93, -0.005] },
    tibiaL: { top: [0.088, 0.495, 0.0], bottom: [0.088, 0.085, -0.005], r: 0.012 },
    fibulaL: { top: [0.12, 0.47, -0.01], bottom: [0.118, 0.08, -0.01], r: 0.005 },
    clavicleL: { medial: [0.015, 1.43, 0.06], lateral: [0.20, 1.435, -0.015], r: 0.006 }
  };

  // ---- organ anchors: centre [x,y,z] and approx size [w(x), h(y), d(z)] ----
  L.organ = {
    heart: { center: [0.03, 1.27, 0.03], size: [0.10, 0.13, 0.085], apex: [0.075, 1.21, 0.055], base: [0.0, 1.33, 0.01] },
    lungL: { center: [0.095, 1.29, -0.015], size: [0.13, 0.25, 0.18], apex: [0.045, 1.445, -0.02], baseY: 1.19 },
    lungR: { center: [-0.10, 1.285, -0.015], size: [0.14, 0.26, 0.18], apex: [-0.045, 1.445, -0.02], baseY: 1.18 },
    trachea: { top: [0, 1.48, 0.035], carina: [0, 1.36, -0.02], r: 0.011 },
    thymus: { center: [0.0, 1.38, 0.06], size: [0.05, 0.06, 0.02] },
    thyroid: { center: [0, 1.48, 0.038], lobeL: [0.02, 1.48, 0.03], isthmus: [0, 1.475, 0.045], size: [0.05, 0.045, 0.02] },
    diaphragm: { domeR: [-0.07, 1.26, -0.01], domeL: [0.07, 1.245, -0.01], rimY: 1.17 },
    liver: { center: [-0.06, 1.16, 0.015], size: [0.24, 0.13, 0.15], rightLobeCenter: [-0.09, 1.16, 0.0], leftLobeCenter: [0.04, 1.185, 0.05] },
    gallbladder: { center: [-0.07, 1.115, 0.065], size: [0.03, 0.075, 0.03] },
    stomach: { center: [0.05, 1.145, 0.035], size: [0.15, 0.13, 0.08], cardia: [0.0, 1.20, 0.0], fundus: [0.08, 1.215, -0.02], pylorus: [-0.02, 1.10, 0.045] },
    spleen: { center: [0.12, 1.16, -0.05], size: [0.07, 0.11, 0.045] },
    pancreas: { head: [-0.02, 1.10, 0.01], body: [0.04, 1.12, -0.01], tail: [0.10, 1.14, -0.04], r: 0.014 },
    duodenum: { center: [-0.02, 1.09, 0.02] },
    smallIntestine: { center: [0.0, 1.0, 0.03], size: [0.22, 0.17, 0.12] },
    colon: { cecum: [-0.10, 0.99, 0.03], hepaticFlexure: [-0.11, 1.12, 0.0], splenicFlexure: [0.12, 1.15, -0.03], sigmoid: [0.07, 0.94, 0.02], rectum: [0, 0.93, -0.06], r: 0.026 },
    appendix: { base: [-0.10, 0.975, 0.035] },
    kidneyL: { center: [0.065, 1.10, -0.06], size: [0.06, 0.115, 0.035], hilum: [0.035, 1.10, -0.05] },
    kidneyR: { center: [-0.065, 1.085, -0.06], size: [0.06, 0.115, 0.035], hilum: [-0.035, 1.085, -0.05] },
    adrenalL: { center: [0.05, 1.165, -0.055], size: [0.035, 0.03, 0.01] },
    adrenalR: { center: [-0.05, 1.155, -0.058], size: [0.03, 0.035, 0.01] },
    bladder: { center: [0, 0.93, 0.055], size: [0.08, 0.07, 0.07] },
    prostate: { center: [0, 0.895, 0.045], size: [0.04, 0.03, 0.025] },
    uterus: { center: [0, 0.955, 0.02], size: [0.05, 0.075, 0.03], cervix: [0, 0.92, 0.01] },
    ovaryL: { center: [0.04, 0.97, 0.0], size: [0.03, 0.02, 0.015] },
    testisL: { center: [0.02, 0.80, 0.045], size: [0.025, 0.045, 0.03] },
    penis: { root: [0, 0.885, 0.06], tip: [0, 0.80, 0.09], r: 0.017 },
    vaginaTop: [0, 0.92, 0.01], analCanal: [0, 0.865, -0.06], urethraExitF: [0, 0.865, 0.03],
    aorta: { root: [0.005, 1.325, 0.02], archTop: [0, 1.395, -0.01], descendingT6: [0.012, 1.33, -0.05], bifurcation: [0, 1.05, -0.04] },
    ivc: { hepatic: [-0.02, 1.19, -0.02], atL3: [-0.022, 1.084, -0.03], confluence: [-0.01, 1.03, -0.035] },
    breastL: { center: [0.10, 1.28, 0.10], size: [0.12, 0.11, 0.06] }
  };
  L.organ.lung = { L: L.organ.lungL, R: L.organ.lungR };

  // ---- eye anatomy (LEFT eye; mirror for the right). Eyeball radius 0.012 (24 mm diameter). ----
  L.eye = {
    centerL: [0.032, 1.635, 0.072], radius: 0.012, corneaRadius: 0.0078, corneaApexZ: 0.086,
    lensCenterL: [0.032, 1.635, 0.0805], lensRadius: 0.0045, lensThickness: 0.004,
    opticNerveExitL: [0.029, 1.634, 0.061], opticNerveDir: [-0.15, 0.0, -1], opticChiasm: [0, 1.628, 0.004],
    lacrimalGlandL: [0.05, 1.648, 0.075], eyelidUpperL: [0.032, 1.646, 0.085], eyelidLowerL: [0.032, 1.626, 0.085],
    orbitApexL: [0.028, 1.633, 0.035],
    // extraocular muscle insertions RELATIVE to the left eye centre (nose side is -X for the LEFT eye)
    medialRectusIns: [-0.0095, 0, 0.0065], lateralRectusIns: [0.0095, 0, 0.0065], superiorRectusIns: [0, 0.0095, 0.0065], inferiorRectusIns: [0, -0.0095, 0.0065]
  };
  // ---- ear (LEFT) ----
  L.ear = {
    auricleCenterL: [0.079, 1.632, -0.02], auricleSize: [0.008, 0.062, 0.035], canalOuterL: [0.072, 1.63, -0.012], canalInnerL: [0.05, 1.63, -0.014],
    tympanicMembraneL: [0.048, 1.63, -0.014], cochleaL: [0.036, 1.632, -0.014], cochleaRadius: 0.005,
    vestibuleL: [0.034, 1.636, -0.018], semicircularCanalRadius: 0.004, eustachianTubeEnd: [0.012, 1.60, 0.02], vestibulocochlearNerveEnd: [0.02, 1.625, -0.02]
  };

  // ---- region bounding boxes [min],[max] for validation & camera focus ----
  L.region = {
    head: { min: [-0.10, 1.51, -0.115], max: [0.10, 1.77, 0.13] },
    neck: { min: [-0.09, 1.44, -0.08], max: [0.09, 1.56, 0.08] },
    thorax: { min: [-0.26, 1.17, -0.15], max: [0.26, 1.47, 0.16] },
    abdomen: { min: [-0.2, 0.96, -0.14], max: [0.2, 1.25, 0.15] },
    pelvis: { min: [-0.2, 0.78, -0.15], max: [0.2, 1.08, 0.15] },
    armL: { min: [0.13, 0.62, -0.08], max: [0.31, 1.47, 0.08] },
    armR: { min: [-0.31, 0.62, -0.08], max: [-0.13, 1.47, 0.08] },
    legL: { min: [0.0, -0.005, -0.1], max: [0.2, 0.95, 0.22] },
    legR: { min: [-0.2, -0.005, -0.1], max: [0.0, 0.95, 0.22] },
    body: { min: [-0.32, -0.005, -0.15], max: [0.32, 1.77, 0.22] }
  };

  L.mirror = function (p) { return [-p[0], p[1], p[2]]; };
  L.side = function (p, side) { return side === 'R' ? [-p[0], p[1], p[2]] : p.slice(); };

  root.L = L;
  root.LANDMARKS = L;
})(typeof window !== 'undefined' ? window : globalThis);
