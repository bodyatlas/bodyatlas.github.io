/* core/viewer.js - Layered Body Atlas production viewer.
   Loads every registered anatomy module (one per animation frame), renders on demand, and exposes window.ATLAS.
   Requires (in order): three.min.js, core/landmarks.js, core/helpers.js, core/registry.js, systems/*.js, core/controls.js.
   Boot: ATLAS_VIEWER.boot() (called from index.html). Never throws on a missing or broken module. */
(function (root) {
  'use strict';
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const ACCENT_HEX = 0xc8323c;
  const GHOST_OPACITY = 0.06;
  const DEG = Math.PI / 180;
  const TWEEN_MS = 300;
  const SKIN_TONES = [
    { name: 'Light', color: '#e9c4a6' }, { name: 'Medium', color: '#d9a982' }, { name: 'Tan', color: '#b07a54' }, { name: 'Deep', color: '#6e4632' }
  ];
  const VIEW_DIRS = {
    front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], iso: [0.85, 0.42, 1]
  };
  const VIEW_KEYS = { '1': 'front', '2': 'back', '3': 'left', '4': 'right', '5': 'top', '6': 'bottom' };
  const EXTRA_REGIONS = {
    'hand-l': { min: [0.17, 0.62, -0.05], max: [0.33, 0.87, 0.08] },
    'knee-l': { min: [-0.01, 0.40, -0.09], max: [0.19, 0.61, 0.11] },
    'foot-l': { min: [0.0, -0.005, -0.09], max: [0.19, 0.13, 0.22] }
  };
  const FOCUS_MENU = [
    ['Whole body', 'all'], ['Head', 'head'], ['Brain', 'cerebrum'], ['Left eye', 'sclera-l'], ['Right eye', 'sclera-r'], ['Left ear', 'auricle-l'],
    ['Heart', 'heart-'], ['Lungs', 'lung-'], ['Thorax', 'thorax'], ['Abdomen', 'abdomen'], ['Pelvis', 'pelvis'],
    ['Left hand', ['skin-hand-l', 'metacarpal', 'hand-l']], ['Left knee', ['patella-l', 'knee-l']], ['Left foot', ['skin-foot-l', 'metatarsal', 'foot-l']],
    ['Skin block', 'skinblock'], ['Neuron', 'inset-neuron'], ['Nephron', 'inset-nephron'], ['Alveoli', 'inset-a'], ['Organ of Corti', 'inset-organ-of-corti']
  ];
  const SIDE_NAMES = { L: 'Left', R: 'Right', M: 'Midline' };
  const REGION_NAMES = { head: 'Head', neck: 'Neck', thorax: 'Thorax', abdomen: 'Abdomen', pelvis: 'Pelvis', armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg', body: 'Whole body' };

  const api = { ready: false };
  root.ATLAS = api;

  function fatal(msg) {
    const sub = $('loading-sub'), note = $('loading-note');
    if (sub) sub.textContent = 'The viewer could not start.';
    if (note) { note.textContent = msg; note.classList.add('err'); }
    api.error = msg;
    console.error('[atlas] ' + msg);
  }

  function boot() {
    const THREE = root.THREE, H = root.H, L = root.L, ANATOMY = root.ANATOMY;
    if (!THREE) return fatal('Three.js did not load from cdnjs.cloudflare.com. Check the connection and reload.');
    if (!H || !L || !ANATOMY) return fatal('Core files (core/landmarks.js, core/helpers.js, core/registry.js) did not load.');
    if (!root.AtlasControls) return fatal('core/controls.js did not load.');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return fatal('WebGL is not available in this browser: ' + (e.message || e)); }

    // ------------------------------------------------------------------ elements
    const el = {
      stage: $('stage'), labels: $('labels'), tooltip: $('tooltip'), topbar: $('topbar'), search: $('search'), results: $('results'),
      focusSelect: $('focus-select'), btnGhost: $('btn-ghost'), btnLabels: $('btn-labels'), btnCut: $('btn-cut'), btnReset: $('btn-reset'),
      rail: $('rail'), panel: $('panel'), depthSlider: $('depth-slider'), depthFill: $('depth-fill'), depthThumb: $('depth-thumb'),
      depthTicks: $('depth-ticks'), depthValue: $('depth-value'), depthLegend: $('depth-legend'), systems: $('systems'), tones: $('tones'),
      panelEmpty: $('panel-empty'), panelCard: $('panel-card'), selName: $('sel-name'), selLatin: $('sel-latin'), selChips: $('sel-chips'),
      selFacts: $('sel-facts'), selRel: $('sel-rel'), selClose: $('sel-close'), actions: $('sel-actions'),
      cutbar: $('cutbar'), cutAxis: $('cut-axis'), cutPos: $('cut-pos'), cutPosValue: $('cut-pos-value'), cutFlip: $('cut-flip'), cutOff: $('cut-off'),
      stats: $('stats'), notice: $('notice'), noticeText: $('notice-text'), noticeClose: $('notice-close'),
      sheetbar: $('sheetbar'), sheetLayers: $('sheet-layers'), sheetDetails: $('sheet-details'),
      loading: $('loading'), loadingSub: $('loading-sub'), loadingFill: $('loading-fill'), loadingNote: $('loading-note'),
      modulesNote: $('modules-note')
    };
    const mqMobile = root.matchMedia ? root.matchMedia('(max-width: 700px)') : null;
    const mqReduced = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const mqDark = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
    const isMobile = () => !!(mqMobile && mqMobile.matches);
    const reduced = () => !!(mqReduced && mqReduced.matches);
    const tweenMs = () => (reduced() ? 0 : TWEEN_MS);

    // ------------------------------------------------------------------ renderer / scene
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', '3D anatomy stage');
    canvas.tabIndex = -1;
    el.stage.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#efe9df');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(1.6, 1.5, 2.4);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.1);
    const key = new THREE.DirectionalLight(0xfff3e4, 2.6); key.position.set(1.4, 2.4, 2.8);
    const fill = new THREE.DirectionalLight(0xdbe6ff, 1.0); fill.position.set(-2.6, 1.0, 1.4);
    const rim = new THREE.DirectionalLight(0xffffff, 1.3); rim.position.set(-0.6, 2.0, -2.9);
    scene.add(hemi, key, fill, rim);

    const groundMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0.8, 0.75, 0.7) }, opacity: { value: 0.55 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 color; uniform float opacity; void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, d)) * opacity; gl_FragColor = vec4(color, a); }',
      transparent: true, depthWrite: false
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.15, 72), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.004; ground.renderOrder = -1; ground.name = 'ground';
    scene.add(ground);

    const bodyRoot = new THREE.Group(); bodyRoot.name = 'atlas-root'; scene.add(bodyRoot);
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
    const raycaster = new THREE.Raycaster();

    // ------------------------------------------------------------------ state
    const state = {
      sex: 'male', depth: 1, ghost: false, labels: false, cut: { axis: 'off', pos: 0.5, flip: false },
      systemsOn: {}, hidden: new Set(), isolated: null, selected: null, hovered: null, hoverSystem: null, skinTone: 1,
      building: false, loaded: [], failed: []
    };
    for (const k in H.SYSTEMS) state.systemsOn[k] = true;

    let parts = [], byId = new Map(), childrenOf = new Map(), pickables = [];
    const materials = new Set();      // every material used on the stage (for clipping / side)
    const ghostCache = new Map();     // colour hex -> ghost material
    const hlCache = new Map();        // base material uuid + mode -> highlight material
    let bodyBox = new THREE.Box3(new THREE.Vector3(...L.region.body.min), new THREE.Vector3(...L.region.body.max));
    let cutActive = false;
    const stats = { visible: 0, triangles: 0, totalTriangles: 0, frameMs: 0, calls: 0 };

    // ------------------------------------------------------------------ render loop (on demand)
    let renderQueued = false;
    function requestRender() { if (!renderQueued) { renderQueued = true; root.requestAnimationFrame(frame); } }
    function updateCameraClip() {
      const dist = Math.max(1e-4, camera.position.distanceTo(controls.target));
      const near = Math.max(0.0002, dist * 0.005), far = Math.max(25, dist * 60);
      if (Math.abs(camera.near - near) > near * 0.05 || Math.abs(camera.far - far) > far * 0.05) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    }
    function frame() {
      renderQueued = false;
      const moving = controls.update();
      updateCameraClip();
      const t0 = performance.now();
      renderer.render(scene, camera);
      stats.frameMs = performance.now() - t0;
      stats.calls = renderer.info.render.calls;
      updateLabels();
      updateStats();
      if (moving) requestRender();
    }
    const controls = new root.AtlasControls(camera, canvas, { minDistance: 0.006, maxDistance: 40, onChange: requestRender, onStart: () => { closeResults(); } });
    controls.reducedMotion = reduced();
    if (mqReduced) addMq(mqReduced, () => { controls.reducedMotion = reduced(); });

    function addMq(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }

    // ------------------------------------------------------------------ theme
    function readToken(name, fallback) { try { const v = getComputedStyle(doc.body).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; } }
    function applyTheme() {
      const bg = readToken('--stage-bg', '#efe9df'), gr = readToken('--stage-ground', '#ddd3c4');
      try { scene.background.set(bg); } catch (e) { scene.background.set('#efe9df'); }
      try { groundMat.uniforms.color.value.set(gr).convertLinearToSRGB(); } catch (e) { /* keep */ }
      hemi.groundColor.copy(scene.background).lerp(new THREE.Color(0x888888), 0.5);
      requestRender();
    }
    if (mqDark) addMq(mqDark, applyTheme);
    if (root.MutationObserver) new MutationObserver(applyTheme).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

    // ------------------------------------------------------------------ resize
    function resize() {
      const w = el.stage.clientWidth || root.innerWidth || 800, h = el.stage.clientHeight || root.innerHeight || 600;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const tb = el.topbar ? el.topbar.offsetHeight : 46;
      doc.documentElement.style.setProperty('--top', (tb + 20) + 'px');
      requestRender();
    }
    if (root.ResizeObserver) { const ro = new ResizeObserver(resize); ro.observe(el.stage); if (el.topbar) ro.observe(el.topbar); }
    root.addEventListener('resize', resize);

    // ------------------------------------------------------------------ materials
    function registerMaterial(m) {
      if (!m || materials.has(m)) return m;
      materials.add(m);
      m.clippingPlanes = [cutPlane];
      if (m.userData.baseSide == null) m.userData.baseSide = m.side;
      if (cutActive) m.side = THREE.DoubleSide;
      return m;
    }
    function setCutSides(double) {
      for (const m of materials) { const s = double ? THREE.DoubleSide : m.userData.baseSide; if (m.side !== s) { m.side = s; m.needsUpdate = true; } }
    }
    function ghostFor(p) {
      const hex = p.baseMat.color ? p.baseMat.color.getHex() : 0x999999;
      let g = ghostCache.get(hex);
      if (!g) {
        g = new THREE.MeshStandardMaterial({ color: hex, transparent: true, opacity: GHOST_OPACITY, depthWrite: false, roughness: 0.75, metalness: 0 });
        registerMaterial(g); ghostCache.set(hex, g);
      }
      return g;
    }
    function highlightFor(p, mode) {
      const keyId = p.baseMat.uuid + ':' + mode;
      let m = hlCache.get(keyId);
      if (!m) {
        m = p.baseMat.clone();
        if (m.emissive) { m.emissive.setHex(ACCENT_HEX); m.emissiveIntensity = mode === 'select' ? 0.55 : 0.32; }
        if (m.color) m.color.lerp(new THREE.Color(0xffffff), mode === 'select' ? 0.12 : 0.06);
        if (m.transparent && m.opacity < 1) m.opacity = Math.min(1, m.opacity + 0.25);
        registerMaterial(m); hlCache.set(keyId, m);
      }
      return m;
    }
    function materialFor(p) {
      if (p.id === state.selected) return highlightFor(p, 'select');
      if (p.id === state.hovered || (state.hoverSystem && p.system === state.hoverSystem)) return highlightFor(p, 'hover');
      return p.baseMat;
    }
    function refreshMaterial(p) { if (p && p.visible) p.mesh.material = materialFor(p); }
    function disposeCaches() {
      for (const m of ghostCache.values()) m.dispose(); ghostCache.clear();
      for (const m of hlCache.values()) m.dispose(); hlCache.clear();
    }

    // ------------------------------------------------------------------ build
    function disposeBody() {
      bodyRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const p of parts) if (p.baseMat && p.baseMat.dispose) p.baseMat.dispose();
      disposeCaches();
      materials.clear();
      while (bodyRoot.children.length) bodyRoot.remove(bodyRoot.children[0]);
      parts = []; byId = new Map(); childrenOf = new Map(); pickables = [];
      stats.totalTriangles = 0;
    }

    function registerGroup(group, moduleId) {
      group.updateMatrixWorld(true);
      const skipped = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        const pd = o.userData && o.userData.part;
        if (!pd) { skipped.push(o.name || '(unnamed mesh)'); o.visible = false; return; }
        if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) { skipped.push(pd.id); o.visible = false; return; }
        let mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!mat) { mat = H.mat(H.SYSTEMS[pd.system] ? H.SYSTEMS[pd.system].color : '#cccccc'); }
        o.material = mat; registerMaterial(mat);
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (!g.boundingBox) g.computeBoundingBox();
        const box = new THREE.Box3().copy(g.boundingBox).applyMatrix4(o.matrixWorld);
        const sc = new THREE.Vector3(); o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
        const center = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
        const radius = g.boundingSphere.radius * Math.max(Math.abs(sc.x), Math.abs(sc.y), Math.abs(sc.z));
        const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        if (!isFinite(box.min.x) || !isFinite(radius)) { skipped.push(pd.id); o.visible = false; return; }
        const p = {
          id: String(pd.id), name: pd.name || pd.id, latin: pd.latin || '', system: pd.system, layer: +pd.layer || 1, depth: +pd.depth || 0,
          side: pd.side || 'M', region: pd.region || 'body', info: pd.info || {}, parent: pd.parent || null, tags: pd.tags || [], module: moduleId,
          mesh: o, baseMat: mat, box, sphere: { center, radius: Math.max(radius, 1e-4) }, tris, visible: false, ghosted: false
        };
        p.peel = p.layer + p.depth;
        p.lname = p.name.toLowerCase(); p.llatin = p.latin.toLowerCase(); p.lid = p.id.toLowerCase();
        p.skin = p.system === 'integumentary' && p.id.indexOf('skin-') === 0;
        o.frustumCulled = true;
        if (byId.has(p.id)) { console.warn('[atlas] duplicate part id ' + p.id + ' (' + byId.get(p.id).module + ' / ' + moduleId + ')'); }
        else byId.set(p.id, p);
        parts.push(p);
        stats.totalTriangles += tris;
      });
      if (skipped.length) console.warn('[atlas] ' + moduleId + ': ' + skipped.length + ' mesh(es) skipped (not H.part or empty): ' + skipped.slice(0, 6).join(', '));
    }

    function finishRegistry() {
      childrenOf = new Map();
      for (const p of parts) { if (p.parent) { if (!childrenOf.has(p.parent)) childrenOf.set(p.parent, []); childrenOf.get(p.parent).push(p); } }
      const b = new THREE.Box3();
      for (const p of parts) b.union(p.box);
      if (b.isEmpty()) b.set(new THREE.Vector3(...L.region.body.min), new THREE.Vector3(...L.region.body.max));
      bodyBox = b;
      applySkinTone();
    }

    function setProgress(t, text, note) {
      if (el.loadingFill) el.loadingFill.style.width = Math.round(t * 100) + '%';
      if (el.loadingSub && text != null) el.loadingSub.textContent = text;
      if (el.loadingNote && note != null) el.loadingNote.textContent = note;
    }

    function moduleIds() {
      const ids = ANATOMY.MODULE_IDS.slice();
      for (const id of ANATOMY.order) if (ids.indexOf(id) < 0) ids.push(id);
      return ids;
    }

    function buildAll(sex, done) {
      state.building = true; state.loaded = []; state.failed = [];
      const loadInfo = root.__ATLAS_LOAD || { missing: [], errors: [] };
      const ids = moduleIds(); let i = 0;
      if (el.loading) { el.loading.hidden = false; el.loading.classList.remove('done'); }
      setProgress(0, 'Preparing the ' + sex + ' body', '');
      function step() {
        if (i >= ids.length) { finish(); return; }
        const id = ids[i++]; const mod = ANATOMY.modules[id];
        const label = mod ? mod.meta.name : id;
        setProgress(i / (ids.length + 1), 'Building ' + label + ' (' + i + ' of ' + ids.length + ')', null);
        if (!mod) {
          const why = loadInfo.missing.indexOf(id) >= 0 ? 'file not found' : (loadInfo.errors.find(e => e.id === id) || {}).message || 'did not register';
          state.failed.push({ id, reason: why });
        } else {
          try {
            const g = ANATOMY.build(id, { sex, quality: 1 });
            bodyRoot.add(g); registerGroup(g, id); state.loaded.push(id);
          } catch (e) {
            console.error('[atlas] build ' + id + ' failed', e);
            state.failed.push({ id, reason: 'build error: ' + (e && e.message ? e.message : String(e)) });
          }
        }
        if (state.failed.length && el.loadingNote) el.loadingNote.textContent = 'Skipped: ' + state.failed.map(f => f.id + ' (' + f.reason + ')').join(', ');
        root.requestAnimationFrame(step);
      }
      function finish() {
        finishRegistry();
        state.building = false;
        setProgress(1, 'Ready', null);
        done();
        if (state.pendingSex) { const ps = state.pendingSex; state.pendingSex = null; if (ps !== state.sex) api.setSex(ps); }
      }
      root.requestAnimationFrame(step);
    }

    // ------------------------------------------------------------------ visibility
    function applyVisibility() {
      pickables = []; let vis = 0, tris = 0;
      const iso = state.isolated;
      for (const p of parts) {
        const m = p.mesh;
        let show = state.systemsOn[p.system] !== false && !state.hidden.has(p.id);
        if (iso) show = show && iso.has(p.id);
        const peeled = !iso && p.peel < state.depth;
        if (!show) { m.visible = false; p.visible = false; p.ghosted = false; }
        else if (peeled) {
          if (state.ghost) { m.visible = true; m.material = ghostFor(p); p.visible = false; p.ghosted = true; }
          else { m.visible = false; p.visible = false; p.ghosted = false; }
        } else { m.visible = true; p.visible = true; p.ghosted = false; m.material = materialFor(p); pickables.push(m); vis++; tris += p.tris; }
      }
      stats.visible = vis; stats.triangles = tris;
      if (state.hovered && !(byId.get(state.hovered) || {}).visible) setHovered(null);
      updateSystemsUI();
      requestRender();
    }

    // ------------------------------------------------------------------ camera helpers
    function boxOf(spec) { return new THREE.Box3(new THREE.Vector3(...spec.min), new THREE.Vector3(...spec.max)); }
    function visibleBox() {
      const b = new THREE.Box3();
      for (const p of parts) if (p.visible) b.union(p.box);
      if (b.isEmpty()) b.copy(bodyBox);
      return b;
    }
    function resolveFocus(target) {
      if (Array.isArray(target)) { for (const t of target) { const r = resolveFocus(t); if (r) return r; } return null; }
      if (target && typeof target === 'object' && target.min) return boxOf(target);
      if (target && target.isBox3) return target;
      if (!target || target === 'all' || target === 'body') return visibleBox();
      if (typeof target !== 'string') return null;
      if (L.region[target]) return boxOf(L.region[target]);
      if (EXTRA_REGIONS[target]) return boxOf(EXTRA_REGIONS[target]);
      let list = []; const exact = byId.get(target);
      if (exact) list = [exact]; else for (const p of parts) if (p.id.indexOf(target) === 0) list.push(p);
      if (!list.length) return null;
      const vis = list.filter(p => p.visible || p.ghosted);
      const use = vis.length ? vis : list;
      const b = new THREE.Box3(); for (const p of use) b.union(p.box);
      return b.isEmpty() ? null : b;
    }
    function frameBox(box, dir, ms) {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(sphere.radius, 0.003);
      const vfov = camera.fov * DEG, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const f = Math.min(vfov, hfov);
      const dist = Math.min(controls.maxDistance, Math.max(controls.minDistance * 2, radius / Math.sin(f / 2) * 1.08));
      const d = new THREE.Vector3();
      if (dir) d.set(dir[0], dir[1], dir[2]).normalize();
      else { d.copy(camera.position).sub(controls.target); if (d.lengthSq() < 1e-10) d.set(...VIEW_DIRS.iso); d.normalize(); }
      const pos = sphere.center.clone().addScaledVector(d, dist);
      controls.flyTo(pos, sphere.center, ms == null ? tweenMs() : ms);
    }

    // ------------------------------------------------------------------ picking / hover
    let lastPointer = null, lastPickAt = 0, pickTimer = null;
    function ndcFromEvent(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; }
    function pickAt(e) {
      if (!pickables.length) return null;
      const n = ndcFromEvent(e);
      raycaster.setFromCamera(new THREE.Vector2(n.x, n.y), camera);
      raycaster.near = camera.near; raycaster.far = camera.far;
      let hits;
      try { hits = raycaster.intersectObjects(pickables, false); } catch (err) { return null; }
      for (const h of hits) {
        if (cutActive && cutPlane.distanceToPoint(h.point) < 0) continue;
        const p = h.object.userData.part && byId.get(h.object.userData.part.id);
        if (p) return { part: p, point: h.point };
      }
      return null;
    }
    function schedulePick() {
      const wait = 40 - (performance.now() - lastPickAt);
      if (wait <= 0) doPick();
      else if (!pickTimer) pickTimer = setTimeout(() => { pickTimer = null; doPick(); }, wait);
    }
    function doPick() {
      lastPickAt = performance.now();
      if (!lastPointer || controls.isInteracting() || state.building) return;
      const hit = pickAt(lastPointer);
      setHovered(hit ? hit.part.id : null);
      if (hit) positionTooltip(lastPointer);
    }
    function setHovered(id) {
      if (state.hovered === id) return;
      const prev = state.hovered && byId.get(state.hovered);
      state.hovered = id;
      refreshMaterial(prev);
      const cur = id && byId.get(id); refreshMaterial(cur);
      if (cur) {
        el.tooltip.textContent = '';
        const b = doc.createElement('b'); b.textContent = cur.name;
        const s = doc.createElement('span'); s.textContent = (H.SYSTEMS[cur.system] || { name: cur.system }).name;
        el.tooltip.appendChild(b); el.tooltip.appendChild(s); el.tooltip.hidden = false;
        canvas.style.cursor = 'pointer';
      } else { el.tooltip.hidden = true; canvas.style.cursor = ''; }
      requestRender();
    }
    function positionTooltip(pt) {
      const r = el.stage.getBoundingClientRect();
      let x = pt.clientX - r.left + 14, y = pt.clientY - r.top + 16;
      const w = el.tooltip.offsetWidth || 120, h = el.tooltip.offsetHeight || 40;
      if (x + w > r.width - 8) x = pt.clientX - r.left - w - 12;
      if (y + h > r.height - 8) y = pt.clientY - r.top - h - 12;
      el.tooltip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    function setHoverSystem(sys) {
      if (state.hoverSystem === sys) return;
      const prev = state.hoverSystem; state.hoverSystem = sys;
      for (const p of parts) if (p.system === prev || p.system === sys) refreshMaterial(p);
      requestRender();
    }

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      lastPointer = { clientX: e.clientX, clientY: e.clientY };
      if (state.hovered) positionTooltip(lastPointer);
      schedulePick();
    });
    canvas.addEventListener('pointerleave', () => { lastPointer = null; setHovered(null); });
    let downPos = null, downAt = 0;
    canvas.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; downAt = performance.now(); });
    canvas.addEventListener('click', (e) => {
      if (!downPos) return;
      const dx = e.clientX - downPos[0], dy = e.clientY - downPos[1];
      if (dx * dx + dy * dy > 36 || performance.now() - downAt > 600) return;
      const hit = pickAt(e);
      api.select(hit ? hit.part.id : null);
    });
    canvas.addEventListener('dblclick', (e) => {
      const hit = pickAt(e);
      if (hit) { api.select(hit.part.id); api.focus(hit.part.id); }
    });

    // ------------------------------------------------------------------ labels
    const labelPool = [];
    function updateLabels() {
      if (!state.labels) { for (const d of labelPool) if (!d.hidden) d.hidden = true; return; }
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      const tanHalf = Math.tan(camera.fov * DEG / 2);
      const v = new THREE.Vector3(); const cands = [];
      for (const p of parts) {
        if (!p.visible) continue;
        const hot = p.id === state.hovered || p.id === state.selected;
        const d = p.sphere.center.distanceTo(camera.position); if (d <= 0) continue;
        const px = p.sphere.radius / (d * tanHalf) * (h / 2);
        if (px < 16 && !hot) continue;
        v.copy(p.sphere.center).project(camera);
        if (v.z > 1 || v.z < -1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) continue;
        cands.push({ p, d, hot, x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h });
      }
      cands.sort((a, b) => (b.hot - a.hot) || (a.d - b.d));
      const cells = new Set(); let n = 0;
      for (const c of cands) {
        if (n >= 40 && !c.hot) break;
        const cell = Math.round(c.x / 100) + ':' + Math.round(c.y / 24);
        if (cells.has(cell) && !c.hot) continue;
        cells.add(cell);
        let d = labelPool[n];
        if (!d) { d = doc.createElement('div'); d.className = 'label'; el.labels.appendChild(d); labelPool.push(d); }
        d.hidden = false; d.textContent = c.p.name; d.classList.toggle('hot', c.hot);
        d.style.transform = 'translate(' + Math.round(c.x) + 'px,' + Math.round(c.y) + 'px) translate(-50%,-50%)';
        n++;
      }
      for (let i = n; i < labelPool.length; i++) if (!labelPool[i].hidden) labelPool[i].hidden = true;
    }

    // ------------------------------------------------------------------ stats
    function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k' : String(Math.round(n)); }
    function updateStats() {
      if (!el.stats) return;
      const mods = state.loaded.length + '/' + moduleIds().length;
      el.stats.textContent = stats.visible + '/' + parts.length + ' parts  ' + fmt(stats.triangles) + ' tris  ' + stats.calls + ' calls  ' + stats.frameMs.toFixed(1) + ' ms  ' + mods + ' modules';
    }

    // ------------------------------------------------------------------ UI: depth slider
    const LAYER_MAX = 11;
    function depthPct(v) { return ((v - 1) / (LAYER_MAX - 1) * 100).toFixed(2) + '%'; }
    function buildDepthTicks() {
      el.depthTicks.textContent = '';
      for (let i = 1; i <= 10; i++) {
        const b = doc.createElement('button'); b.type = 'button'; b.className = 'depth-tick'; b.dataset.layer = String(i);
        b.style.setProperty('--p', depthPct(i)); b.title = 'Peel to ' + H.LAYER_NAMES[i]; b.tabIndex = -1;
        const em = doc.createElement('em'); em.textContent = String(i);
        const i2 = doc.createElement('i');
        const sp = doc.createElement('span'); sp.textContent = H.LAYER_NAMES[i];
        b.appendChild(em); b.appendChild(i2); b.appendChild(sp);
        b.addEventListener('click', () => api.setDepth(i));
        el.depthTicks.appendChild(b);
      }
    }
    function updateDepthUI() {
      const v = state.depth; const pct = depthPct(v);
      el.depthSlider.style.setProperty('--p', pct);
      el.depthSlider.setAttribute('aria-valuenow', v.toFixed(2));
      el.depthSlider.setAttribute('aria-valuetext', v.toFixed(2) + ', ' + layerLabel(v));
      el.depthValue.textContent = v.toFixed(2);
      const cur = Math.min(10, Math.floor(v + 1e-9));
      for (const b of el.depthTicks.children) { const n = +b.dataset.layer; b.classList.toggle('active', n === cur); b.classList.toggle('peeled', n < cur); }
      el.depthLegend.textContent = v <= 1 ? 'All layers shown. Drag down to peel the body away, skin first.' : v >= LAYER_MAX ? 'Everything peeled.' : 'Peeling ' + H.LAYER_NAMES[cur].toLowerCase() + ' (' + cur + ') and everything above it. Deeper layers remain.';
    }
    function layerLabel(v) { const n = Math.min(10, Math.max(1, Math.floor(v))); return v >= LAYER_MAX ? 'everything peeled' : H.LAYER_NAMES[n]; }
    function depthFromPointer(e) {
      const r = el.depthSlider.getBoundingClientRect();
      const vertical = r.height > r.width;
      const t = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      return 1 + Math.max(0, Math.min(1, t)) * (LAYER_MAX - 1);
    }
    let depthDrag = false;
    el.depthSlider.addEventListener('pointerdown', (e) => { if (e.target.closest('.depth-tick')) return; depthDrag = true; try { el.depthSlider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } api.setDepth(depthFromPointer(e)); e.preventDefault(); });
    el.depthSlider.addEventListener('pointermove', (e) => { if (depthDrag) api.setDepth(depthFromPointer(e)); });
    el.depthSlider.addEventListener('pointerup', () => { depthDrag = false; });
    el.depthSlider.addEventListener('pointercancel', () => { depthDrag = false; });
    el.depthSlider.addEventListener('keydown', (e) => {
      const step = { ArrowUp: -0.25, ArrowLeft: -0.25, ArrowDown: 0.25, ArrowRight: 0.25, PageUp: -1, PageDown: 1 }[e.key];
      if (step != null) { api.setDepth(state.depth + step); e.preventDefault(); }
      else if (e.key === 'Home') { api.setDepth(1); e.preventDefault(); } else if (e.key === 'End') { api.setDepth(LAYER_MAX); e.preventDefault(); }
    });

    // ------------------------------------------------------------------ UI: systems list
    const sysRows = {};
    function buildSystemsList() {
      el.systems.textContent = '';
      for (const key of Object.keys(H.SYSTEMS)) {
        const s = H.SYSTEMS[key];
        const li = doc.createElement('li'); li.className = 'sys'; li.dataset.system = key;
        const label = doc.createElement('label');
        const cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = state.systemsOn[key] !== false; cb.setAttribute('aria-label', s.name);
        const dot = doc.createElement('span'); dot.className = 'dot'; dot.style.setProperty('--c', s.color);
        const name = doc.createElement('span'); name.className = 'sys-name'; name.textContent = s.name;
        const count = doc.createElement('span'); count.className = 'sys-count'; count.textContent = '0';
        label.appendChild(cb); label.appendChild(dot); label.appendChild(name); label.appendChild(count); li.appendChild(label);
        cb.addEventListener('change', () => api.setSystem(key, cb.checked));
        li.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setHoverSystem(key); });
        li.addEventListener('pointerleave', () => setHoverSystem(null));
        el.systems.appendChild(li);
        sysRows[key] = { li, cb, count };
      }
    }
    function updateSystemsUI() {
      const counts = {}, visCounts = {};
      for (const p of parts) { counts[p.system] = (counts[p.system] || 0) + 1; if (p.visible) visCounts[p.system] = (visCounts[p.system] || 0) + 1; }
      for (const key in sysRows) {
        const r = sysRows[key], n = counts[key] || 0;
        r.count.textContent = n ? ((visCounts[key] || 0) + '/' + n) : 'none';
        r.li.classList.toggle('empty', n === 0);
        r.cb.disabled = n === 0;
        r.cb.checked = state.systemsOn[key] !== false;
      }
    }

    // ------------------------------------------------------------------ UI: skin tones
    function buildTones() {
      el.tones.textContent = '';
      SKIN_TONES.forEach((t, i) => {
        const b = doc.createElement('button'); b.type = 'button'; b.className = 'tone' + (i === state.skinTone ? ' active' : ''); b.style.setProperty('--c', t.color);
        b.title = t.name + ' skin tone'; b.setAttribute('aria-label', t.name + ' skin tone'); b.setAttribute('aria-pressed', i === state.skinTone ? 'true' : 'false');
        b.addEventListener('click', () => api.setSkinTone(i));
        el.tones.appendChild(b);
      });
    }
    function applySkinTone() {
      const tone = SKIN_TONES[state.skinTone] || SKIN_TONES[1];
      const done = new Set();
      for (const p of parts) {
        if (!p.skin || !p.baseMat.color || done.has(p.baseMat)) continue;
        done.add(p.baseMat); p.baseMat.color.set(tone.color);
      }
      for (const m of hlCache.values()) m.dispose(); hlCache.clear();
      for (const p of parts) if (p.visible) p.mesh.material = materialFor(p);
      if (el.tones) for (const b of el.tones.children) { const on = b === el.tones.children[state.skinTone]; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      requestRender();
    }

    // ------------------------------------------------------------------ UI: selection panel
    function textEl(tag, cls, text) { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function partLink(p) { const b = textEl('button', 'link', p.name); b.type = 'button'; b.addEventListener('click', () => { api.select(p.id); api.focus(p.id); }); return b; }
    function renderSelection() {
      const p = state.selected && byId.get(state.selected);
      if (!p) { el.panelCard.hidden = true; el.panelEmpty.hidden = false; return; }
      el.panelEmpty.hidden = true; el.panelCard.hidden = false;
      el.selName.textContent = p.name;
      el.selLatin.textContent = p.latin; el.selLatin.hidden = !p.latin;
      el.selChips.textContent = '';
      const sys = H.SYSTEMS[p.system] || { name: p.system, color: '#999' };
      const c1 = textEl('span', 'chip'); const dot = textEl('i', 'dot'); dot.style.setProperty('--c', sys.color); c1.appendChild(dot); c1.appendChild(doc.createTextNode(sys.name));
      const c2 = textEl('span', 'chip', (H.LAYER_NAMES[p.layer] || 'Layer ' + p.layer) + ' · ' + p.peel.toFixed(1));
      c2.title = 'Peel layer ' + p.layer + ', depth ' + p.depth;
      const c3 = textEl('span', 'chip', SIDE_NAMES[p.side] || p.side);
      const c4 = textEl('span', 'chip', REGION_NAMES[p.region] || p.region);
      el.selChips.appendChild(c1); el.selChips.appendChild(c2); el.selChips.appendChild(c3); el.selChips.appendChild(c4);
      el.selFacts.textContent = '';
      const facts = [['Description', p.info.description], ['Function', p.info.function], ['Size', p.info.size], ['Notes', p.info.notes]];
      let any = false;
      for (const [k, v] of facts) { if (!v) continue; any = true; el.selFacts.appendChild(textEl('dt', null, k)); el.selFacts.appendChild(textEl('dd', null, String(v))); }
      if (!any) { el.selFacts.appendChild(textEl('dt', null, 'Description')); el.selFacts.appendChild(textEl('dd', null, 'No description was provided for this part.')); }
      el.selRel.textContent = '';
      if (p.parent) {
        const row = textEl('div'); row.appendChild(textEl('span', 'rel-label', 'Part of'));
        const pp = byId.get(p.parent); if (pp) row.appendChild(partLink(pp)); else row.appendChild(textEl('span', null, p.parent));
        el.selRel.appendChild(row);
      }
      const kids = childrenOf.get(p.id) || [];
      if (kids.length) {
        const row = textEl('div'); row.appendChild(textEl('span', 'rel-label', 'Contains'));
        for (const k of kids.slice(0, 24)) row.appendChild(partLink(k));
        if (kids.length > 24) row.appendChild(textEl('span', 'rel-label', '+' + (kids.length - 24) + ' more'));
        el.selRel.appendChild(row);
      }
      const mod = textEl('div'); mod.appendChild(textEl('span', 'rel-label', 'Module')); mod.appendChild(textEl('span', 'mono', p.module)); el.selRel.appendChild(mod);
      const hiddenNow = state.hidden.has(p.id);
      el.actions.querySelector('[data-act="hide"]').textContent = hiddenNow ? 'Unhide' : 'Hide';
      el.actions.querySelector('[data-act="isolate"]').setAttribute('aria-pressed', state.isolated && state.isolated.has(p.id) ? 'true' : 'false');
    }
    el.actions.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const act = b.dataset.act, id = state.selected;
      if (act === 'focus' && id) api.focus(id);
      else if (act === 'isolate' && id) { if (state.isolated && state.isolated.has(id)) api.showAll(); else api.isolate(id); }
      else if (act === 'hide' && id) { if (state.hidden.has(id)) api.unhide(id); else api.hide(id); }
      else if (act === 'showall') api.showAll();
    });
    el.selClose.addEventListener('click', () => api.select(null));

    // ------------------------------------------------------------------ UI: search
    let results = [], resultIndex = -1;
    function fuzzyScore(q, s) {
      if (!s) return 0;
      const idx = s.indexOf(q);
      if (idx === 0) return 100 - s.length * 0.05;
      if (idx > 0) return ((s[idx - 1] === ' ' || s[idx - 1] === '-' || s[idx - 1] === '(') ? 88 : 72) - idx * 0.2 - s.length * 0.02;
      let si = 0, score = 0, prev = -2, n = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const ch = q[qi]; if (ch === ' ') continue; n++;
        const j = s.indexOf(ch, si); if (j < 0) return 0;
        score += (j === prev + 1) ? 3 : (j === 0 || s[j - 1] === ' ' || s[j - 1] === '-') ? 2.2 : 1;
        prev = j; si = j + 1;
      }
      if (!n) return 0;
      return 15 + (score / (n * 3)) * 45 - s.length * 0.03;
    }
    function search(query) {
      const q = query.trim().toLowerCase(); if (!q) return [];
      const out = [];
      for (const p of parts) {
        const sc = Math.max(fuzzyScore(q, p.lname), fuzzyScore(q, p.llatin) * 0.96, fuzzyScore(q, p.lid) * 0.9);
        if (sc > 0) out.push({ p, sc });
      }
      out.sort((a, b) => b.sc - a.sc || a.p.lname.localeCompare(b.p.lname));
      return out.slice(0, 12).map(o => o.p);
    }
    function renderResults() {
      el.results.textContent = '';
      if (!el.search.value.trim()) { el.results.hidden = true; return; }
      if (!results.length) { const li = textEl('li', 'empty', 'No matching parts'); el.results.appendChild(li); el.results.hidden = false; return; }
      results.forEach((p, i) => {
        const li = doc.createElement('li'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === resultIndex ? 'true' : 'false'); li.id = 'result-' + i;
        const dot = textEl('i', 'dot'); dot.style.setProperty('--c', (H.SYSTEMS[p.system] || {}).color || '#999');
        const nm = textEl('span', 'r-name', p.name);
        const sub = textEl('span', 'r-sub', (p.latin ? p.latin + ' · ' : '') + (H.SYSTEMS[p.system] || { name: p.system }).name);
        li.appendChild(dot); li.appendChild(nm); li.appendChild(sub);
        li.addEventListener('pointerdown', (e) => { e.preventDefault(); chooseResult(i); });
        el.results.appendChild(li);
      });
      el.results.hidden = false;
    }
    function chooseResult(i) {
      const p = results[i]; if (!p) return;
      api.select(p.id); api.focus(p.id);
      el.search.value = p.name; closeResults(); el.search.blur();
    }
    function closeResults() { el.results.hidden = true; resultIndex = -1; el.search.removeAttribute('aria-activedescendant'); }
    el.search.addEventListener('input', () => { results = search(el.search.value); resultIndex = results.length ? 0 : -1; renderResults(); });
    el.search.addEventListener('focus', () => { if (el.search.value.trim()) { results = search(el.search.value); renderResults(); } });
    el.search.addEventListener('blur', () => setTimeout(closeResults, 120));
    el.search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { resultIndex = Math.min(results.length - 1, resultIndex + 1); renderResults(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { resultIndex = Math.max(0, resultIndex - 1); renderResults(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (resultIndex >= 0) chooseResult(resultIndex); e.preventDefault(); }
      else if (e.key === 'Escape') { closeResults(); el.search.blur(); }
    });

    // ------------------------------------------------------------------ UI: top bar
    function buildFocusMenu() {
      el.focusSelect.textContent = '';
      const o0 = doc.createElement('option'); o0.value = ''; o0.textContent = 'Focus on…'; el.focusSelect.appendChild(o0);
      FOCUS_MENU.forEach(([label, target], i) => { const o = doc.createElement('option'); o.value = String(i); o.textContent = label; el.focusSelect.appendChild(o); });
      el.focusSelect.addEventListener('change', () => {
        const i = +el.focusSelect.value; const entry = FOCUS_MENU[i];
        if (entry) { const ok = api.focus(entry[1]); if (!ok) showNotice('Nothing to focus on for "' + entry[0] + '" in the loaded modules.'); }
        el.focusSelect.value = '';
      });
    }
    el.topbar.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.view) api.setView(b.dataset.view);
      else if (b.dataset.sex) api.setSex(b.dataset.sex);
    });
    el.btnGhost.addEventListener('click', () => api.setGhost(!state.ghost));
    el.btnLabels.addEventListener('click', () => api.setLabels(!state.labels));
    el.btnCut.addEventListener('click', () => { if (state.cut.axis === 'off') api.setCut('x', 0.5, false); else api.setCut('off'); });
    el.btnReset.addEventListener('click', () => api.reset());
    el.cutAxis.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.axis) api.setCut(b.dataset.axis, state.cut.pos, state.cut.flip); });
    el.cutPos.addEventListener('input', () => api.setCut(state.cut.axis === 'off' ? 'x' : state.cut.axis, +el.cutPos.value, state.cut.flip));
    el.cutFlip.addEventListener('change', () => api.setCut(state.cut.axis === 'off' ? 'x' : state.cut.axis, state.cut.pos, el.cutFlip.checked));
    el.cutOff.addEventListener('click', () => api.setCut('off'));
    function updateTopbar() {
      for (const b of el.topbar.querySelectorAll('[data-sex]')) b.setAttribute('aria-pressed', b.dataset.sex === state.sex ? 'true' : 'false');
      el.btnGhost.setAttribute('aria-pressed', state.ghost ? 'true' : 'false');
      el.btnLabels.setAttribute('aria-pressed', state.labels ? 'true' : 'false');
      el.btnCut.setAttribute('aria-pressed', state.cut.axis !== 'off' ? 'true' : 'false');
      el.cutbar.hidden = state.cut.axis === 'off';
      for (const b of el.cutAxis.querySelectorAll('[data-axis]')) b.setAttribute('aria-pressed', b.dataset.axis === state.cut.axis ? 'true' : 'false');
      el.cutPos.value = String(state.cut.pos); el.cutFlip.checked = state.cut.flip;
      if (state.cut.axis !== 'off') {
        const ax = state.cut.axis; const v = bodyBox.min[ax] + (bodyBox.max[ax] - bodyBox.min[ax]) * state.cut.pos;
        el.cutPosValue.textContent = (v >= 0 ? '+' : '') + v.toFixed(3) + ' m';
      }
    }

    // ------------------------------------------------------------------ UI: notice, sheets, keyboard
    let noticeTimer = null;
    function showNotice(text, sticky) {
      el.noticeText.textContent = text; el.notice.hidden = false;
      if (noticeTimer) clearTimeout(noticeTimer);
      if (!sticky) noticeTimer = setTimeout(() => { el.notice.hidden = true; }, 6000);
    }
    el.noticeClose.addEventListener('click', () => { el.notice.hidden = true; });
    function openSheet(which) {
      el.rail.classList.toggle('open', which === 'layers');
      el.panel.classList.toggle('open', which === 'details');
      el.sheetLayers.setAttribute('aria-pressed', which === 'layers' ? 'true' : 'false');
      el.sheetDetails.setAttribute('aria-pressed', which === 'details' ? 'true' : 'false');
    }
    el.sheetLayers.addEventListener('click', () => openSheet(el.rail.classList.contains('open') ? null : 'layers'));
    el.sheetDetails.addEventListener('click', () => openSheet(el.panel.classList.contains('open') ? null : 'details'));
    for (const b of doc.querySelectorAll('[data-close-sheet]')) b.addEventListener('click', () => openSheet(null));

    root.addEventListener('keydown', (e) => {
      const t = e.target; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (typing) { closeResults(); t.blur(); } else { api.select(null); openSheet(null); }
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (VIEW_KEYS[k]) api.setView(VIEW_KEYS[k]);
      else if (k === '7') api.setView('iso');
      else if (k === 'f') api.focus(state.selected || 'all');
      else if (k === 'h') { if (state.selected) { if (state.hidden.has(state.selected)) api.unhide(state.selected); else api.hide(state.selected); } }
      else if (k === 'i') { if (state.isolated) api.showAll(); else if (state.selected) api.isolate(state.selected); }
      else if (k === 'r') api.reset();
      else if (k === 'g') api.setGhost(!state.ghost);
      else if (k === 'l') api.setLabels(!state.labels);
      else if (k === '[') api.setDepth(state.depth - 0.5);
      else if (k === ']') api.setDepth(state.depth + 0.5);
      else if (k === '/') { e.preventDefault(); el.search.focus(); el.search.select(); if (isMobile()) openSheet(null); }
      else return;
      e.preventDefault();
    });

    // ------------------------------------------------------------------ public API
    api.setDepth = function (v) {
      v = Math.max(1, Math.min(LAYER_MAX, +v || 1)); v = Math.round(v * 20) / 20;
      state.depth = v; updateDepthUI(); applyVisibility(); return v;
    };
    api.getDepth = () => state.depth;
    api.setSystem = function (id, on) { if (!H.SYSTEMS[id]) return false; state.systemsOn[id] = on !== false; applyVisibility(); return true; };
    api.setSex = function (sex) {
      sex = sex === 'female' ? 'female' : 'male';
      if (state.building) { state.pendingSex = sex; return; }
      if (sex === state.sex) { updateTopbar(); return; }
      state.sex = sex; updateTopbar();
      const sel = state.selected;
      const camPos = camera.position.clone(), camTarget = controls.target.clone();
      disposeBody();
      buildAll(sex, () => {
        controls.setLook(camPos, camTarget);
        state.selected = sel && byId.has(sel) ? sel : null;
        applyVisibility(); renderSelection(); updateSystemsUI(); updateTopbar();
        if (state.failed.length) showNotice('Skipped: ' + state.failed.map(f => f.id + ' (' + f.reason + ')').join('; '));
        if (el.loading) { el.loading.classList.add('done'); setTimeout(() => { el.loading.hidden = true; }, reduced() ? 0 : 420); }
        requestRender();
      });
    };
    api.getSex = () => state.sex;
    api.select = function (id) {
      const prevId = state.selected;
      if (id && !byId.has(id)) id = null;
      state.selected = id || null;
      refreshMaterial(prevId && byId.get(prevId));
      refreshMaterial(id && byId.get(id));
      renderSelection();
      if (isMobile() && id) openSheet('details');
      requestRender();
      return state.selected;
    };
    api.getSelected = () => state.selected;
    api.focus = function (target, dir) {
      const box = resolveFocus(target == null ? 'all' : target);
      if (!box) return false;
      frameBox(box, dir || null); return true;
    };
    api.setView = function (view) {
      const d = VIEW_DIRS[view] || VIEW_DIRS.iso;
      const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      const dist = controls.getDistance();
      const target = controls.target.clone();
      controls.flyTo(target.clone().addScaledVector(dir, dist), target, tweenMs());
      return view;
    };
    api.setCut = function (axis, position01, flip) {
      if (axis === 'off' || axis == null || !/^[xyz]$/.test(axis)) {
        state.cut.axis = 'off'; cutActive = false; cutPlane.normal.set(0, 1, 0); cutPlane.constant = 1e5; setCutSides(false);
      } else {
        state.cut.axis = axis; state.cut.pos = Math.max(0, Math.min(1, position01 == null ? state.cut.pos : +position01)); state.cut.flip = !!flip;
        const v = bodyBox.min[axis] + (bodyBox.max[axis] - bodyBox.min[axis]) * state.cut.pos;
        const n = new THREE.Vector3(axis === 'x' ? -1 : 0, axis === 'y' ? -1 : 0, axis === 'z' ? -1 : 0);
        if (state.cut.flip) { n.negate(); cutPlane.constant = -v; } else cutPlane.constant = v;
        cutPlane.normal.copy(n); cutActive = true; setCutSides(true);
      }
      updateTopbar(); requestRender();
      return Object.assign({}, state.cut);
    };
    api.setGhost = function (on) { state.ghost = !!on; updateTopbar(); applyVisibility(); return state.ghost; };
    api.setLabels = function (on) { state.labels = !!on; updateTopbar(); requestRender(); return state.labels; };
    api.hide = function (id) { if (!byId.has(id)) return false; state.hidden.add(id); if (state.selected === id) renderSelection(); applyVisibility(); return true; };
    api.unhide = function (id) { state.hidden.delete(id); if (state.selected === id) renderSelection(); applyVisibility(); return true; };
    api.isolate = function (id) {
      const p = byId.get(id); if (!p) return false;
      const set = new Set([id]); const stack = [id];
      while (stack.length) { const cur = stack.pop(); for (const k of (childrenOf.get(cur) || [])) if (!set.has(k.id)) { set.add(k.id); stack.push(k.id); } }
      for (const k of set) state.hidden.delete(k);
      state.isolated = set; applyVisibility(); renderSelection(); api.focus(id); return true;
    };
    api.showAll = function () { state.isolated = null; state.hidden.clear(); applyVisibility(); renderSelection(); return true; };
    api.setSkinTone = function (i) { state.skinTone = Math.max(0, Math.min(SKIN_TONES.length - 1, i | 0)); applySkinTone(); return state.skinTone; };
    api.reset = function () {
      state.depth = 1; for (const k in H.SYSTEMS) state.systemsOn[k] = true;
      state.hidden.clear(); state.isolated = null; state.ghost = false; state.labels = false;
      api.setCut('off'); api.select(null); updateDepthUI(); updateTopbar(); applyVisibility(); openSheet(null);
      el.search.value = ''; closeResults();
      frameBox(visibleBox(), VIEW_DIRS.iso);
      return true;
    };
    api.parts = () => parts.map(p => ({ id: p.id, name: p.name, system: p.system, layer: p.layer, depth: p.depth, visible: p.visible }));
    api.stats = () => ({
      parts: parts.length, visible: stats.visible, triangles: Math.round(stats.triangles), totalTriangles: Math.round(stats.totalTriangles),
      drawCalls: stats.calls, frameMs: +stats.frameMs.toFixed(2), modules: state.loaded.slice(), failed: state.failed.map(f => Object.assign({}, f)),
      depth: state.depth, sex: state.sex, ghost: state.ghost, labels: state.labels, cut: Object.assign({}, state.cut), selected: state.selected,
      building: state.building, hovered: state.hovered
    });
    api.busy = () => state.building || renderQueued || controls.isMoving();
    api.whenIdle = () => new Promise((res) => {
      let n = 0;
      const check = () => { if (!api.busy() || n++ > 400) root.requestAnimationFrame(() => root.requestAnimationFrame(() => res(api.stats()))); else setTimeout(check, 25); };
      check();
    });
    api.render = requestRender;
    api.SKIN_TONES = SKIN_TONES.map(t => Object.assign({}, t));
    api.FOCUS_MENU = FOCUS_MENU.map(e => e[0]);

    // ------------------------------------------------------------------ start
    buildDepthTicks(); buildSystemsList(); buildTones(); buildFocusMenu();
    updateDepthUI(); updateTopbar(); renderSelection(); applyTheme(); resize();
    buildAll(state.sex, () => {
      applyVisibility(); updateSystemsUI(); renderSelection();
      frameBox(visibleBox(), VIEW_DIRS.iso, 0);
      if (state.failed.length) {
        const txt = 'Unavailable: ' + state.failed.map(f => f.id + ' (' + f.reason + ')').join('; ');
        showNotice(txt, true);
        if (el.modulesNote) el.modulesNote.textContent = state.loaded.length + ' of ' + moduleIds().length + ' modules loaded.';
      } else if (el.modulesNote) el.modulesNote.textContent = 'All ' + state.loaded.length + ' modules loaded.';
      if (!parts.length) showNotice('No anatomy modules could be loaded, so the stage is empty.', true);
      updateCameraClip();
      renderer.render(scene, camera);
      stats.calls = renderer.info.render.calls; updateStats();
      if (el.loading) { el.loading.classList.add('done'); setTimeout(() => { el.loading.hidden = true; }, reduced() ? 0 : 420); }
      api.ready = true;
      requestRender();
      try { root.dispatchEvent(new CustomEvent('atlas-ready', { detail: api.stats() })); } catch (e) { /* ignore */ }
    });
  }

  root.ATLAS_VIEWER = { boot: function () { try { boot(); } catch (e) { fatal('Viewer failed to start: ' + (e && e.message ? e.message : e)); console.error(e); } } };
})(typeof window !== 'undefined' ? window : globalThis);
