/**
 * orbit.js — a small orbit camera controller.
 *
 * Three's own OrbitControls lives in examples/jsm, which would mean vendoring a
 * second file and its addons plumbing for ~80 lines of behaviour. This does
 * exactly what the visualiser needs: drag to orbit, wheel to dolly, pinch on
 * touch, and smooth programmatic moves to the view presets.
 */

import * as THREE from '../../vendor/three/three.module.min.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class OrbitCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} el element that receives the pointer events
   */
  constructor(camera, el) {
    this.camera = camera;
    this.el = el;
    this.target = new THREE.Vector3(0, -0.4, 0.2);

    // azimuth 0 puts the camera on +x, looking across the midsagittal plane —
    // the profile view. PI/2 puts it on +z, facing the front of the face.
    this.azimuth = 0;
    this.polar = Math.PI / 2;
    this.distance = 19;

    this.goalAzimuth = this.azimuth;
    this.goalPolar = this.polar;
    this.goalDistance = this.distance;

    this.minDistance = 8;
    this.maxDistance = 34;
    this.enabled = true;

    this.pointers = new Map();
    this.lastPinch = 0;
    this.bind();
    this.update(1);
  }

  bind() {
    const el = this.el;
    el.style.touchAction = 'none';

    this.onDown = (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    this.onMove = (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        this.goalAzimuth -= dx * 0.008;
        this.goalPolar = clamp(this.goalPolar - dy * 0.008, 0.25, Math.PI - 0.25);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastPinch) this.goalDistance = clamp(this.goalDistance * (this.lastPinch / d), this.minDistance, this.maxDistance);
        this.lastPinch = d;
      }
    };
    this.onUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.lastPinch = 0;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    this.onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.goalDistance = clamp(this.goalDistance * (1 + Math.sign(e.deltaY) * 0.10), this.minDistance, this.maxDistance);
    };

    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** Named camera positions the UI exposes as buttons. */
  setView(name) {
    const views = {
      sagittal: { az: 0, po: Math.PI / 2, d: 18 },
      front: { az: Math.PI / 2, po: Math.PI / 2, d: 17 },
      quarter: { az: Math.PI * 0.30, po: Math.PI * 0.44, d: 19 },
      top: { az: 0, po: 0.55, d: 20 },
    };
    const v = views[name] || views.sagittal;
    this.goalAzimuth = v.az;
    this.goalPolar = v.po;
    this.goalDistance = v.d;
  }

  /** @param {number} lerp 0..1 smoothing factor for this frame */
  update(lerp = 0.14) {
    this.azimuth += (this.goalAzimuth - this.azimuth) * lerp;
    this.polar += (this.goalPolar - this.polar) * lerp;
    this.distance += (this.goalDistance - this.distance) * lerp;

    const sinP = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.distance * sinP * Math.cos(this.azimuth),
      this.target.y + this.distance * Math.cos(this.polar),
      this.target.z + this.distance * sinP * Math.sin(this.azimuth),
    );
    this.camera.lookAt(this.target);
  }

  dispose() {
    const el = this.el;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
  }
}

export default OrbitCamera;
