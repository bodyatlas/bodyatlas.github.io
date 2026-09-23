/* core/controls.js - custom orbit controls for the atlas viewer (no ES modules).
   Left-drag rotate, right/middle/shift-drag pan, wheel zoom toward the cursor, touch: 1 finger rotate, 2 fingers pinch + pan.
   Exponential damping, tweened flyTo(). Exposes window.AtlasControls. */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  if (!THREE) { root.AtlasControls = null; return; }

  const EPS = 1e-6;
  const _offset = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function AtlasControls(camera, el, opts) {
    opts = opts || {};
    this.camera = camera;
    this.el = el;
    this.enabled = true;
    this.target = new THREE.Vector3();
    this.minDistance = opts.minDistance || 0.005;
    this.maxDistance = opts.maxDistance || 100;
    this.rotateSpeed = 1.0;
    this.panSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.damping = 0.2;              // fraction of the remaining delta applied per frame
    this.reducedMotion = false;
    this.onChange = opts.onChange || function () {};
    this.onStart = opts.onStart || null;

    this._sph = new THREE.Spherical();
    this._dTheta = 0; this._dPhi = 0;
    this._pan = new THREE.Vector3();
    this._dollyLog = 0;              // pending zoom in log-radius units (>0 zooms out)
    this._dollyNdc = null;           // [x, y] normalized device coords to zoom toward
    this._tween = null;
    this._pointers = new Map();      // pointerId -> {x, y, type, button}
    this._pinch = null;              // {dist, mx, my}
    this._mode = null;               // 'rotate' | 'pan'
    this._bound = [];

    const on = (ev, fn, o) => { el.addEventListener(ev, fn, o); this._bound.push([ev, fn, o]); };
    on('pointerdown', this._onPointerDown.bind(this));
    on('pointermove', this._onPointerMove.bind(this));
    on('pointerup', this._onPointerUp.bind(this));
    on('pointercancel', this._onPointerUp.bind(this));
    on('wheel', this._onWheel.bind(this), { passive: false });
    on('contextmenu', (e) => e.preventDefault());
    this._syncFromCamera();
  }

  const P = AtlasControls.prototype;

  P.dispose = function () { for (const [ev, fn, o] of this._bound) this.el.removeEventListener(ev, fn, o); this._bound.length = 0; };

  P.getDistance = function () { return this.camera.position.distanceTo(this.target); };
  P.isInteracting = function () { return this._pointers.size > 0; };
  P.isMoving = function () {
    return !!this._tween || Math.abs(this._dTheta) > EPS || Math.abs(this._dPhi) > EPS || this._pan.lengthSq() > 1e-14 || Math.abs(this._dollyLog) > 1e-5;
  };

  P._syncFromCamera = function () {
    _offset.copy(this.camera.position).sub(this.target);
    if (_offset.lengthSq() < 1e-12) _offset.set(0, 0, 1e-3);
    this._sph.setFromVector3(_offset);
    this._sph.phi = clamp(this._sph.phi, 0.001, Math.PI - 0.001);
  };

  P._clearDeltas = function () { this._dTheta = 0; this._dPhi = 0; this._pan.set(0, 0, 0); this._dollyLog = 0; this._dollyNdc = null; };

  /* Immediately place the camera. */
  P.setLook = function (position, target) {
    this._tween = null; this._clearDeltas();
    this.target.copy(target); this.camera.position.copy(position); this.camera.lookAt(this.target);
    this._syncFromCamera(); this.onChange();
  };

  /* Tween the camera position and target over ms milliseconds. */
  P.flyTo = function (position, target, ms) {
    if (!ms || ms <= 0 || this.reducedMotion) { this.setLook(position, target); return; }
    this._clearDeltas();
    this._tween = { p0: this.camera.position.clone(), t0: this.target.clone(), p1: position.clone(), t1: target.clone(), start: performance.now(), ms };
    this.onChange();
  };

  /* Returns true while the camera is still moving (caller keeps rendering). */
  P.update = function () {
    const cam = this.camera;
    if (this._tween) {
      const tw = this._tween; const t = clamp((performance.now() - tw.start) / tw.ms, 0, 1); const k = easeInOut(t);
      cam.position.lerpVectors(tw.p0, tw.p1, k); this.target.lerpVectors(tw.t0, tw.t1, k); cam.lookAt(this.target);
      if (t >= 1) { this._tween = null; this._syncFromCamera(); }
      this.onChange();
      return true;
    }
    const s = this._sph; let moved = false;
    const f = this.reducedMotion ? 1 : this.damping;
    if (Math.abs(this._dTheta) > EPS || Math.abs(this._dPhi) > EPS) {
      s.theta += this._dTheta * f; s.phi += this._dPhi * f;
      this._dTheta *= (1 - f); this._dPhi *= (1 - f);
      if (Math.abs(this._dTheta) <= EPS) this._dTheta = 0; if (Math.abs(this._dPhi) <= EPS) this._dPhi = 0;
      s.phi = clamp(s.phi, 0.001, Math.PI - 0.001);
      moved = true;
    }
    if (this._pan.lengthSq() > 1e-14) {
      this.target.addScaledVector(this._pan, f); this._pan.multiplyScalar(1 - f);
      if (this._pan.lengthSq() <= 1e-14) this._pan.set(0, 0, 0);
      moved = true;
    }
    if (Math.abs(this._dollyLog) > 1e-5) {
      const step = this._dollyLog * f; this._dollyLog -= step; if (Math.abs(this._dollyLog) <= 1e-5) this._dollyLog = 0;
      this._applyDolly(Math.exp(step));
      moved = true;
    }
    if (moved) {
      _offset.setFromSpherical(s); cam.position.copy(this.target).add(_offset); cam.lookAt(this.target);
      this.onChange();
    }
    return moved;
  };

  P._applyDolly = function (scale) {
    const s = this._sph, cam = this.camera;
    const prev = s.radius, next = clamp(prev * scale, this.minDistance, this.maxDistance);
    if (this._dollyNdc) {
      // move the camera along the ray through the cursor, then re-seat the target on the view axis at the new radius
      _v.set(this._dollyNdc[0], this._dollyNdc[1], 0.5).unproject(cam).sub(cam.position).normalize();
      cam.position.addScaledVector(_v, prev - next);
      cam.updateMatrixWorld();
      _fwd.set(0, 0, -1).transformDirection(cam.matrixWorld);
      this.target.copy(cam.position).addScaledVector(_fwd, next);
    }
    s.radius = next;
  };

  P._ndc = function (x, y) {
    const r = this.el.getBoundingClientRect();
    return [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
  };

  P._rotateBy = function (dx, dy) {
    const h = this.el.clientHeight || 1;
    this._dTheta -= 2 * Math.PI * dx / h * this.rotateSpeed;
    this._dPhi -= 2 * Math.PI * dy / h * this.rotateSpeed;
  };

  P._panBy = function (dx, dy) {
    const cam = this.camera, h = this.el.clientHeight || 1;
    const dist = this._sph.radius;
    const worldPerPx = 2 * dist * Math.tan((cam.fov * Math.PI / 180) / 2) / h * this.panSpeed;
    _right.setFromMatrixColumn(cam.matrix, 0); _up.setFromMatrixColumn(cam.matrix, 1);
    this._pan.addScaledVector(_right, -dx * worldPerPx).addScaledVector(_up, dy * worldPerPx);
  };

  P._zoomBy = function (logDelta, ndc) {
    this._dollyLog = clamp(this._dollyLog + logDelta, -2.5, 2.5);
    this._dollyNdc = ndc || null;
  };

  P._onPointerDown = function (e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button > 2) return;
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button });
    this._tween = null;
    if (this.onStart) this.onStart(e);
    if (e.pointerType === 'touch') {
      if (this._pointers.size === 2) { this._pinch = this._pinchState(); this._mode = 'pinch'; }
      else if (this._pointers.size === 1) this._mode = 'rotate';
      else this._mode = null;
    } else {
      this._mode = (e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey) ? 'pan' : 'rotate';
    }
    if (e.button === 1) e.preventDefault();
  };

  P._pinchState = function () {
    const it = this._pointers.values(); const a = it.next().value, b = it.next().value;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };

  P._onPointerMove = function (e) {
    if (!this.enabled) return;
    const p = this._pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this._mode === 'pinch' && this._pointers.size === 2 && this._pinch) {
      const st = this._pinchState();
      const ratio = this._pinch.dist / st.dist;
      if (isFinite(ratio) && ratio > 0) this._zoomBy(Math.log(ratio), this._ndc(st.mx, st.my));
      this._panBy(st.mx - this._pinch.mx, st.my - this._pinch.my);
      this._pinch = st;
    } else if (this._mode === 'pan') {
      this._panBy(dx, dy);
    } else if (this._mode === 'rotate') {
      this._rotateBy(dx, dy);
    }
    this.onChange();
  };

  P._onPointerUp = function (e) {
    if (!this._pointers.has(e.pointerId)) return;
    this._pointers.delete(e.pointerId);
    try { this.el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (this._pointers.size === 1 && e.pointerType === 'touch') { this._mode = 'rotate'; this._pinch = null; }
    else if (this._pointers.size === 0) { this._mode = null; this._pinch = null; }
  };

  P._onWheel = function (e) {
    if (!this.enabled) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= (this.el.clientHeight || 600);
    if (e.ctrlKey) d *= 3; // trackpad pinch gesture
    this._tween = null;
    this._zoomBy(clamp(d, -240, 240) * 0.0018 * this.zoomSpeed, this._ndc(e.clientX, e.clientY));
    this.onChange();
  };

  root.AtlasControls = AtlasControls;
})(typeof window !== 'undefined' ? window : globalThis);
