/**
 * visualizer.js — the WebGL stage and the pose player.
 *
 * Owns the renderer, lighting, camera and animation loop, and plays a pose
 * track produced by articulation.js: given a phoneme stream it walks the
 * keyframes, easing between them so the articulators move continuously rather
 * than snapping.
 *
 * Emits 'segment' whenever the segment under the playhead changes, so the
 * transcript and the readout panel can highlight in sync with the mouth.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { MouthModel } from './mouthModel.js';
import { OrbitCamera } from './orbit.js';
import { buildPoseTrack, resolveParams, blendParams, REST, articulate } from './articulation.js';
import { tokenize } from '../phonetics/symbols.js';

/** Ease between articulator targets — real articulation overshoots slightly. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

export class Visualizer {
  /**
   * @param {HTMLElement} host element the canvas fills
   */
  constructor(host) {
    this.host = host;
    this.listeners = new Map();
    this.track = [];
    this.playing = false;
    this.holdAtEnd = false;
    this.holdFrame = null;
    this.currentMeta = null;
    this.clock = 0;
    this.currentIndex = -1;
    this.holdParams = resolveParams(REST);
    this.targetParams = resolveParams(REST);
    this.blendFrom = resolveParams(REST);
    this.blendT = 1;
    this.blendDuration = 120;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.model = new MouthModel();
    this.scene.add(this.model.group);
    this.addLights();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D model of the mouth and vocal tract');

    this.controls = new OrbitCamera(this.camera, this.renderer.domElement);
    this.controls.setView('sagittal');

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);

    this.lastFrame = performance.now();
    this.loop = this.loop.bind(this);
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  addLights() {
    const key = new THREE.DirectionalLight(0xfff4e2, 2.5);
    key.position.set(9, 8, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;

    const fill = new THREE.DirectionalLight(0x9dc8ff, 1.1);
    fill.position.set(-9, 2, 6);

    const rim = new THREE.DirectionalLight(0xffd166, 1.4);
    rim.position.set(-4, 5, -10);

    // a light down the throat, so the pharynx is not a black hole
    const throat = new THREE.PointLight(0xff8a7a, 12, 14, 2);
    throat.position.set(0, -1.2, -1.6);

    this.scene.add(key, fill, rim, throat, new THREE.AmbientLight(0xffffff, 0.55));
  }

  /* ── events ─────────────────────────────────────────────────────────── */

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.listeners.get(evt).delete(fn);
  }

  emit(evt, payload) {
    const set = this.listeners.get(evt);
    if (set) set.forEach((fn) => fn(payload));
  }

  /* ── playback ───────────────────────────────────────────────────────── */

  /**
   * Play a phoneme stream.
   * @param {Array<{ipa:string}>} stream
   * @param {number} rate speech rate multiplier
   * @param {{hold?:boolean}} [opts] hold the final pose instead of relaxing —
   *        what you want when a single sound is being studied
   */
  play(stream, rate = 1, opts = {}) {
    this.track = buildPoseTrack(stream, rate);
    this.clock = 0;
    this.currentIndex = -1;
    this.holdAtEnd = !!opts.hold;
    // When holding, settle on the segment's DEFINING posture rather than
    // whatever happens to be last: for a plosive the closure is the gesture
    // worth looking at, and the release is the moment it stops being one.
    this.holdFrame = this.holdAtEnd && this.track.length
      ? this.track.reduce((best, f) => (f.weight > best.weight ? f : best), this.track[0])
      : null;
    this.playing = this.track.length > 0;
    if (!this.playing) this.rest();
  }

  /**
   * Hold a single chart symbol, the way a chart click should.
   *
   * Some entries are sequences rather than single segments — General American
   * writes NEAR/SQUARE/CURE as /ɪr/, /ɛr/, /ʊr/ — so the string is tokenized
   * and played as a short sequence instead of being dropped on the floor.
   */
  showPhoneme(ipa) {
    const segs = tokenize(ipa)
      .filter((t) => t.type === 'phoneme')
      .filter((t) => articulate(t.ipa));
    if (!segs.length) return false;
    // slower, and holding at the end: a chart click is meant to be studied,
    // not glimpsed for a sixth of a second
    this.play(segs.map((t) => ({ ipa: t.ipa })), 0.55, { hold: true });
    return true;
  }

  stop() {
    this.playing = false;
    this.rest();
  }

  /** Return to the neutral posture. */
  rest() {
    this.track = [];
    this.currentIndex = -1;
    this.currentMeta = null;
    this.transitionTo(resolveParams(REST), 260);
    this.emit('segment', null);
  }

  transitionTo(params, duration = 120) {
    this.blendFrom = { ...this.holdParams };
    this.targetParams = params;
    this.blendT = 0;
    this.blendDuration = Math.max(30, duration);
  }

  /* ── frame loop ─────────────────────────────────────────────────────── */

  loop() {
    this.frameHandle = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dtMs = Math.min(80, now - this.lastFrame);
    this.lastFrame = now;

    if (this.playing && this.track.length) {
      this.clock += dtMs;
      const idx = this.track.findIndex((f) => this.clock < f.until);
      if (idx === -1) {
        this.playing = false;
        if (this.holdAtEnd) {
          // settle into the defining posture and stay there to be studied
          if (this.holdFrame) {
            this.currentMeta = {
              kind: this.holdFrame.kind,
              manner: this.holdFrame.manner,
              place: this.holdFrame.place,
            };
            this.transitionTo(this.holdFrame.params, 200);
            this.emit('segment', this.holdFrame);
          }
          this.emit('ended', { held: true });
        } else {
          this.rest();
          this.emit('ended', { held: false });
        }
      } else if (idx !== this.currentIndex) {
        this.currentIndex = idx;
        const seg = this.track[idx];
        this.currentMeta = { kind: seg.kind, manner: seg.manner, place: seg.place };
        this.transitionTo(seg.params, Math.max(45, (seg.until - seg.at) * 0.65));
        this.emit('segment', seg);
      }
    }

    // ease the rig toward the current target
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dtMs / this.blendDuration);
      this.holdParams = blendParams(this.blendFrom, this.targetParams, easeInOut(this.blendT));
    } else {
      this.holdParams = this.targetParams;
    }

    this.model.apply(this.holdParams, this.currentMeta);
    this.model.tick(dtMs / 1000);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setView(name) { this.controls.setView(name); }

  setSkinMode(mode) { this.model.setSkinMode(mode); }

  dispose() {
    cancelAnimationFrame(this.frameHandle);
    this.observer.disconnect();
    this.controls.dispose();
    this.model.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Does this browser have a usable WebGL context? The app degrades to the
 * text-and-audio features rather than showing a broken canvas.
 */
export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext
      && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

export default Visualizer;
