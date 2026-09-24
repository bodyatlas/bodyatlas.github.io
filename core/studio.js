/* core/studio.js - studio rendering for the atlas: image-based lighting from a procedural softbox room, a key light with soft
   shadows on a shadow-catching floor, and a post-processing chain built from core Three.js only (no examples/ modules):
   MSAA half-float colour pass -> half-res normal+depth pre-pass (respects the cut plane) -> screen-space ambient occlusion ->
   depth-aware blur -> composite with backdrop gradient, tone mapping and sRGB output.
   Exposes window.AtlasStudio. quality: 'high' (shadows + AO + MSAA) or 'fast' (direct render). Degrades to 'fast' by itself when
   the GPU cannot render to float targets (WebGL 1 without extensions). */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  if (!THREE) { root.AtlasStudio = null; return; }

  const AO_SAMPLES = 16;
  function kernel() {
    // hemisphere samples (z >= 0), denser near the origin; deterministic so every load looks the same
    const out = []; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < AO_SAMPLES; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 0.85 + 0.15).normalize();
      let s = i / AO_SAMPLES; s = 0.12 + 0.88 * s * s;
      out.push(v.multiplyScalar(s * (0.5 + 0.5 * rnd())));
    }
    return out;
  }

  const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const PRE_VS = [
    '#include <common>', '#include <clipping_planes_pars_vertex>',
    'varying vec3 vN; varying float vD;',
    'void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vD = -mvPosition.z;',
    '  gl_Position = projectionMatrix * mvPosition;', '#include <clipping_planes_vertex>', '}'
  ].join('\n');
  const PRE_FS = [
    '#include <common>', '#include <clipping_planes_pars_fragment>',
    'varying vec3 vN; varying float vD;',
    'void main(){', '#include <clipping_planes_fragment>',
    '  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n, vD); }'
  ].join('\n');
  const AO_FS = [
    'varying vec2 vUv; uniform sampler2D tG; uniform mat4 uProj; uniform vec2 uTan; uniform float uRadius; uniform float uBias; uniform vec3 uKernel[' + AO_SAMPLES + '];',
    'void main(){',
    '  vec4 g = texture2D(tG, vUv); float d = g.a;',
    '  if (d <= 0.0) { gl_FragColor = vec4(1.0); return; }',
    '  vec3 P = vec3((vUv * 2.0 - 1.0) * uTan * d, -d); vec3 N = normalize(g.xyz);',
    '  float a = 6.2831853 * fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));',
    '  vec3 rv = vec3(cos(a), sin(a), 0.0); vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N);',
    '  float occ = 0.0; float r = uRadius;',
    '  for (int i = 0; i < ' + AO_SAMPLES + '; i++) {',
    '    vec3 s = P + TBN * uKernel[i] * r; vec4 o = uProj * vec4(s, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;',
    '    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;',
    '    float sd = texture2D(tG, suv).a; if (sd <= 0.0) continue;',
    '    float dz = -s.z - sd; float range = smoothstep(0.0, 1.0, r / abs(d - sd));',
    '    occ += (dz > uBias * d ? 1.0 : 0.0) * range;',
    '  }',
    '  occ /= ' + AO_SAMPLES + '.0;',
    '  gl_FragColor = vec4(vec3(1.0 - occ), 1.0); }'
  ].join('\n');
  const BLUR_FS = [
    'varying vec2 vUv; uniform sampler2D tAO; uniform sampler2D tG; uniform vec2 uDir;',
    'void main(){ float d0 = texture2D(tG, vUv).a; if (d0 <= 0.0) { gl_FragColor = vec4(1.0); return; } float sum = 0.0, wsum = 0.0;',
    '  for (int i = -4; i <= 4; i++) { vec2 uv = vUv + uDir * float(i); float d = texture2D(tG, uv).a;',
    '    float w = exp(-float(i * i) / 9.0) * exp(-abs(d - d0) / (0.02 * d0 + 1e-4)); sum += texture2D(tAO, uv).r * w; wsum += w; }',
    '  gl_FragColor = vec4(vec3(sum / max(wsum, 1e-5)), 1.0); }'
  ].join('\n');
  const COMP_FS = [
    'varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tG; uniform vec2 uHalfRes;',
    'uniform vec3 uBgTop; uniform vec3 uBgBottom; uniform float uAOStrength; uniform vec3 uAOTint; uniform float uVignette;',
    'void main(){',
    '  vec4 c = texture2D(tColor, vUv);',
    // depth-aware upsample of the half-res AO: weight the 4 nearest AO texels by how close their depth is to the centre sample
    '  float d0 = texture2D(tG, vUv).a; vec2 px = 1.0 / uHalfRes; vec2 base = (floor(vUv * uHalfRes - 0.5) + 0.5) * px; vec2 f = fract(vUv * uHalfRes - 0.5);',
    '  float ao = 0.0, wsum = 0.0;',
    '  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) { vec2 uv = base + vec2(float(i), float(j)) * px; float d = texture2D(tG, uv).a;',
    '    float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) * (1.0 / (1.0 + 60.0 * abs(d - d0) / max(d0, 1e-3))); ao += texture2D(tAO, uv).r * w; wsum += w; }',
    '  ao = wsum > 1e-5 ? ao / wsum : 1.0; ao = mix(1.0, ao, uAOStrength);',
    '  vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);',
    '  col *= mix(uAOTint, vec3(1.0), ao);',
    '  gl_FragColor = vec4(col, 1.0);',
    '#include <tonemapping_fragment>',
    '#include <colorspace_fragment>',
    '  vec2 p = vUv - vec2(0.5, 0.42); float vig = 1.0 - uVignette * smoothstep(0.35, 1.05, length(p * vec2(1.0, 1.25)));',
    '  vec3 bg = mix(uBgBottom, uBgTop, smoothstep(0.0, 1.0, vUv.y)) * vig;',
    '  gl_FragColor = vec4(mix(bg, gl_FragColor.rgb, c.a), 1.0); }'
  ].join('\n');

  function AtlasStudio(renderer, scene, camera, opts) {
    opts = opts || {};
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.quality = 'high';
    this.aoStrength = opts.aoStrength == null ? 0.85 : opts.aoStrength;
    this.aoRadius = 0.03;
    this.aoScale = opts.aoScale || 0.5;
    this.maxPixelRatio = opts.maxPixelRatio || 1.5;
    this.width = 1; this.height = 1; this.dpr = 1;
    this.frameMs = 0;
    const caps = renderer.capabilities, ext = renderer.extensions;
    this.floatType = null;
    if (caps.isWebGL2) this.floatType = ext.has('EXT_color_buffer_float') ? THREE.HalfFloatType : (ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : null);
    else if (ext.has('OES_texture_half_float') && ext.has('EXT_color_buffer_half_float')) this.floatType = THREE.HalfFloatType;
    this.supportsPost = !!this.floatType && !!caps.isWebGL2;
    this.maxSamples = caps.isWebGL2 ? Math.min(4, caps.maxSamples || 0) : 0;

    // ---- lights and environment
    this.envMap = this._buildEnvironment();
    scene.environment = this.envMap;
    this.hemi = new THREE.HemisphereLight(0xfff4e8, 0x7d7671, 0.5);
    this.key = new THREE.DirectionalLight(0xfff1e2, 2.4); this.key.position.set(1.5, 4.6, 2.0);
    this.fill = new THREE.DirectionalLight(0xd8e4ff, 0.55); this.fill.position.set(-2.8, 1.2, 1.6);
    this.rim = new THREE.DirectionalLight(0xffffff, 1.1); this.rim.position.set(-0.8, 2.2, -3.0);
    this.key.target.position.set(0, 0.9, 0);
    this.key.castShadow = true;
    const sh = this.key.shadow;
    sh.mapSize.set(2048, 2048); sh.bias = -0.00025; sh.normalBias = 0.0025; sh.radius = 3;
    sh.camera.near = 0.5; sh.camera.far = 14;
    scene.add(this.hemi, this.key, this.key.target, this.fill, this.rim);
    this.fitShadow(new THREE.Box3(new THREE.Vector3(-0.35, -0.01, -0.2), new THREE.Vector3(0.35, 1.8, 0.25)));

    // ---- floor: soft radial disc + shadow catcher
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0.8, 0.75, 0.7) }, opacity: { value: 0.5 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 color; uniform float opacity; void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.15, 1.0, d)) * opacity; gl_FragColor = vec4(color, a); }',
      transparent: true, depthWrite: false
    });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1.7, 72), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.004; this.ground.renderOrder = -2; this.ground.name = 'ground';
    this.shadowMat = new THREE.ShadowMaterial({ color: new THREE.Color(0x2a1a14), opacity: 0.34, transparent: true, depthWrite: false });
    this.shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(1.7, 72), this.shadowMat);
    this.shadowCatcher.rotation.x = -Math.PI / 2; this.shadowCatcher.position.y = -0.003; this.shadowCatcher.receiveShadow = true; this.shadowCatcher.renderOrder = -1; this.shadowCatcher.name = 'shadow-catcher';
    scene.add(this.ground, this.shadowCatcher);
    // the floor is never an occluder in the AO pre-pass (it would darken the soles for nothing)
    this.ground.layers.set(1); this.shadowCatcher.layers.set(1);

    // ---- post-processing
    this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._quadGeo = new THREE.PlaneGeometry(2, 2);
    this.preMat = new THREE.ShaderMaterial({ vertexShader: PRE_VS, fragmentShader: PRE_FS, side: THREE.DoubleSide, clipping: true, clippingPlanes: opts.clippingPlanes || [] });
    this.aoMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: AO_FS, depthTest: false, depthWrite: false,
      uniforms: { tG: { value: null }, uProj: { value: new THREE.Matrix4() }, uTan: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0.03 }, uBias: { value: 0.004 }, uKernel: { value: kernel() } }
    });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false, uniforms: { tAO: { value: null }, tG: { value: null }, uDir: { value: new THREE.Vector2(0, 0) } } });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false, toneMapped: true,
      uniforms: { tColor: { value: null }, tAO: { value: null }, tG: { value: null }, uHalfRes: { value: new THREE.Vector2(1, 1) }, uBgTop: { value: new THREE.Color('#efe9df') }, uBgBottom: { value: new THREE.Color('#e2d9cb') },
        uAOStrength: { value: this.aoStrength }, uAOTint: { value: new THREE.Color(0.62, 0.5, 0.47) }, uVignette: { value: 0.18 } }
    });
    this._quad = new THREE.Mesh(this._quadGeo, this.compMat); this._quad.frustumCulled = false;
    this._quadScene = new THREE.Scene(); this._quadScene.add(this._quad);
    this.rtColor = null; this.rtG = null; this.rtAO = null; this.rtBlur = null;
    this.setQuality(opts.quality || 'high');
  }
  const P = AtlasStudio.prototype;

  P._buildEnvironment = function () {
    // a softbox studio: warm key panel high front-left of camera, cool fill on the other side, bright rim panel behind, mid-grey walls
    const env = new THREE.Scene();
    const mat = (r, g, b, side) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: side || THREE.FrontSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 12), mat(0.22, 0.21, 0.2, THREE.BackSide)); room.position.y = 3.5; env.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mat(0.34, 0.31, 0.28)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.99; env.add(floor);
    const panel = (w, h, pos, look, r, g, b) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(r, g, b, THREE.DoubleSide)); m.position.set(pos[0], pos[1], pos[2]); m.lookAt(look[0], look[1], look[2]); env.add(m); };
    panel(4.5, 3.2, [2.6, 4.6, 3.2], [0, 1, 0], 3.2, 2.9, 2.5);      // key softbox
    panel(3.5, 4.0, [-4.5, 2.2, 2.4], [0, 1, 0], 1.1, 1.2, 1.4);   // cool fill
    panel(4.0, 2.4, [-1.0, 4.4, -4.6], [0, 1, 0], 1.7, 1.7, 1.8);     // rim / hair light
    panel(6.0, 6.0, [0, 8.4, 0], [0, 0, 0], 0.55, 0.53, 0.5);        // ceiling bounce
    panel(2.0, 1.4, [4.8, 0.9, -1.5], [0, 1, 0], 0.7, 0.6, 0.55);     // low warm kicker
    const pm = new THREE.PMREMGenerator(this.renderer); pm.compileEquirectangularShader();
    const tex = pm.fromScene(env, 0.035).texture; pm.dispose();
    env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  };

  /* Fit the key light's shadow camera around a world-space box (the body) so shadow texels are not wasted. */
  P.fitShadow = function (box) {
    const cam = this.key.shadow.camera;
    this.key.updateMatrixWorld(); this.key.target.updateMatrixWorld();
    const lookAt = new THREE.Matrix4().lookAt(this.key.position, this.key.target.position, new THREE.Vector3(0, 1, 0));
    const inv = lookAt.clone().invert();
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(c.x + (i & 1 ? 0.5 : -0.5) * s.x, c.y + (i & 2 ? 0.5 : -0.5) * s.y, c.z + (i & 4 ? 0.5 : -0.5) * s.z).sub(this.key.position).applyMatrix4(inv);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 0.04;
    cam.left = minX - pad; cam.right = maxX + pad; cam.bottom = minY - pad; cam.top = maxY + pad;
    cam.updateProjectionMatrix();
  };

  P.setQuality = function (q) {
    q = q === 'fast' ? 'fast' : 'high';
    if (q === 'high' && !this.supportsPost) q = 'fast';
    this.quality = q;
    const r = this.renderer;
    r.shadowMap.enabled = q === 'high';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadowCatcher.visible = q === 'high';
    if (q === 'fast') this._disposeTargets();
    else this._ensureTargets();
    // in fast mode the canvas is transparent and the page backdrop shows through; in high mode the composite draws the backdrop
    r.setClearColor(0x000000, 0);
    this.scene.background = null;
    this.scene.traverse(o => { if (o.material && o.material.isMeshPhysicalMaterial) o.material.needsUpdate = true; });
    return q;
  };
  P.setBackdrop = function (top, bottom, ground) {
    this.compMat.uniforms.uBgTop.value.set(top); this.compMat.uniforms.uBgBottom.value.set(bottom || top);
    if (ground) this.groundMat.uniforms.color.value.set(ground).convertLinearToSRGB();
    this.hemi.groundColor.set(bottom || top).lerp(new THREE.Color(0x888888), 0.5);
  };
  P.setSize = function (w, h, dpr) {
    this.width = Math.max(1, w | 0); this.height = Math.max(1, h | 0);
    this.dpr = Math.min(dpr || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.quality === 'high' ? this.dpr : Math.min(dpr || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    if (this.quality === 'high') this._ensureTargets(true);
  };
  P._disposeTargets = function () {
    for (const k of ['rtColor', 'rtG', 'rtAO', 'rtBlur']) { if (this[k]) { this[k].dispose(); this[k] = null; } }
  };
  P._ensureTargets = function (force) {
    const pw = Math.max(1, Math.round(this.width * this.dpr)), ph = Math.max(1, Math.round(this.height * this.dpr));
    if (!force && this.rtColor && this.rtColor.width === pw && this.rtColor.height === ph) return;
    this._disposeTargets();
    const samples = pw * ph > 2.6e6 ? Math.min(2, this.maxSamples) : this.maxSamples;
    this.rtColor = new THREE.WebGLRenderTarget(pw, ph, { type: this.floatType, samples, depthBuffer: true, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const hw = Math.max(1, Math.round(pw * this.aoScale)), hh = Math.max(1, Math.round(ph * this.aoScale));
    this.rtG = new THREE.WebGLRenderTarget(hw, hh, { type: this.floatType, depthBuffer: true, stencilBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rtAO = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rtBlur = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.compMat.uniforms.uHalfRes.value.set(hw, hh);
  };

  /* Render one frame. */
  P.render = function () {
    const r = this.renderer, scene = this.scene, cam = this.camera;
    const t0 = performance.now();
    r.info.autoReset = false; r.info.reset();
    if (this.quality !== 'high' || !this.rtColor) {
      r.setRenderTarget(null); r.clear(); r.render(scene, cam);
      this.frameMs = performance.now() - t0; return;
    }
    const prevMask = cam.layers.mask;
    // 1. lit colour, MSAA, linear HDR
    r.setRenderTarget(this.rtColor); r.setClearColor(0x000000, 0); r.clear();
    cam.layers.enableAll();
    r.render(scene, cam);
    // 2. normal + depth of the AO occluders (layer 0 only; ghost shells, thin films and the floor live on layer 1)
    cam.layers.set(0);
    scene.overrideMaterial = this.preMat;
    r.setRenderTarget(this.rtG); r.clear(); r.render(scene, cam);
    scene.overrideMaterial = null;
    cam.layers.mask = prevMask;
    // 3. ambient occlusion
    const tan = Math.tan(cam.fov * Math.PI / 360);
    this.aoMat.uniforms.tG.value = this.rtG.texture; this.aoMat.uniforms.uProj.value.copy(cam.projectionMatrix);
    this.aoMat.uniforms.uTan.value.set(tan * cam.aspect, tan); this.aoMat.uniforms.uRadius.value = this.aoRadius;
    this._quad.material = this.aoMat; r.setRenderTarget(this.rtAO); r.render(this._quadScene, this._quadCam);
    // 4. depth-aware blur, two passes
    this.blurMat.uniforms.tG.value = this.rtG.texture;
    this.blurMat.uniforms.tAO.value = this.rtAO.texture; this.blurMat.uniforms.uDir.value.set(1 / this.rtG.width, 0);
    this._quad.material = this.blurMat; r.setRenderTarget(this.rtBlur); r.render(this._quadScene, this._quadCam);
    this.blurMat.uniforms.tAO.value = this.rtBlur.texture; this.blurMat.uniforms.uDir.value.set(0, 1 / this.rtG.height);
    r.setRenderTarget(this.rtAO); r.render(this._quadScene, this._quadCam);
    // 5. composite to the screen with tone mapping
    const u = this.compMat.uniforms;
    u.tColor.value = this.rtColor.texture; u.tAO.value = this.rtAO.texture; u.tG.value = this.rtG.texture; u.uAOStrength.value = this.aoStrength;
    this._quad.material = this.compMat; r.setRenderTarget(null); r.render(this._quadScene, this._quadCam);
    this.frameMs = performance.now() - t0;
  };

  P.dispose = function () {
    this._disposeTargets();
    for (const m of [this.preMat, this.aoMat, this.blurMat, this.compMat, this.groundMat, this.shadowMat]) m.dispose();
    this._quadGeo.dispose();
    if (this.envMap) this.envMap.dispose();
  };

  root.AtlasStudio = AtlasStudio;
})(typeof window !== 'undefined' ? window : globalThis);
