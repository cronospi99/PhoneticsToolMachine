/**
 * eyes.js — eyeballs, irises, lids and brows.
 *
 * Eyes are what make a rendered face read as a face rather than a mannequin,
 * and most of that is motion: a still, staring eye looks dead no matter how
 * well modelled. So the lids blink on an irregular schedule and the gaze
 * drifts slightly, both driven from `tick()`.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';
import { LANDMARKS } from './head.js';

const EYE_R = 1.00;

/** Lid rotations for a relaxed, open eye. See the note where they are used. */
const UPPER_OPEN = -0.34;
const LOWER_OPEN = Math.PI + 0.50;

/**
 * @param {object} materials { sclera, iris, pupil, skin, brow }
 * @returns {THREE.Group} with userData.tick(dt) and userData.setGaze(x, y)
 */
export function buildEyes(materials) {
  const group = new THREE.Group();
  group.name = 'eyes';
  const L = LANDMARKS;
  const sides = [];

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * L.eyeX, L.eye, L.eyeZ);

    // ── the globe ──
    const globe = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 32, 24), materials.sclera);
    eye.add(globe);

    // ── iris and pupil, set into the front of the globe ──
    const irisGroup = new THREE.Group();
    const iris = new THREE.Mesh(
      new THREE.CircleGeometry(EYE_R * 0.46, 32),
      materials.iris,
    );
    iris.position.z = EYE_R * 0.90;
    irisGroup.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(EYE_R * 0.20, 24),
      materials.pupil,
    );
    pupil.position.z = EYE_R * 0.915;
    irisGroup.add(pupil);

    // the cornea bulges over the iris and catches the highlight
    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(EYE_R * 0.52, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
      materials.cornea,
    );
    cornea.rotation.x = Math.PI / 2;
    cornea.position.z = EYE_R * 0.72;
    irisGroup.add(cornea);

    eye.add(irisGroup);

    // ── lids: spherical caps a shade larger than the globe ──
    const lidGeo = new THREE.SphereGeometry(EYE_R * 1.04, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.60);
    // Lid opening angles matter more than they sound. The cap spans 99° from
    // its pole, so the tilt decides where its edge lands relative to the eye's
    // midline. An open eye shows the whole iris apart from its top sliver:
    // upper edge ~18° above the midline, lower edge ~27° below. Tilt them any
    // less and the lids meet over the iris, leaving a letterbox slit.
    const upper = new THREE.Mesh(lidGeo, materials.skin);
    upper.rotation.x = UPPER_OPEN;
    eye.add(upper);

    const lower = new THREE.Mesh(lidGeo.clone(), materials.skin);
    lower.rotation.x = LOWER_OPEN;
    eye.add(lower);

    // ── brow ──
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.55, L.brow - 0.30, 4.55),
      new THREE.Vector3(side * 1.35, L.brow + 0.12, 4.72),
      new THREE.Vector3(side * 2.20, L.brow + 0.14, 4.30),
      new THREE.Vector3(side * 2.85, L.brow - 0.28, 3.45),
    ]);
    const brow = new THREE.Mesh(
      new THREE.TubeGeometry(browCurve, 22, 0.16, 8, false),
      materials.brow,
    );
    brow.name = 'brow';
    group.add(brow);

    group.add(eye);
    sides.push({ eye, upper, lower, irisGroup });
  }

  // ── behaviour ──
  let blink = 0;          // 0 open .. 1 shut
  let nextBlink = 1.5 + Math.random() * 3;
  let closing = false;
  let clock = 0;
  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };

  const applyBlink = (amount) => {
    for (const s of sides) {
      s.upper.rotation.x = UPPER_OPEN + amount * 1.55;
      s.lower.rotation.x = LOWER_OPEN - amount * 0.45;
    }
  };
  applyBlink(0);

  group.userData.tick = (dt) => {
    clock += dt;

    // blink: a fast close and a slightly slower open, at irregular intervals
    if (!closing && clock >= nextBlink) {
      closing = true;
      blink = 0;
    }
    if (closing) {
      blink += dt * 9;
      if (blink >= 2) {
        closing = false;
        blink = 0;
        clock = 0;
        nextBlink = 1.8 + Math.random() * 4.5;
      }
      applyBlink(blink <= 1 ? blink : 2 - blink);
    }

    // gaze drifts to a new spot every few seconds — the eyes are never still
    if (Math.random() < dt * 0.35) {
      gaze.tx = (Math.random() - 0.5) * 0.34;
      gaze.ty = (Math.random() - 0.5) * 0.20;
    }
    gaze.x += (gaze.tx - gaze.x) * Math.min(1, dt * 6);
    gaze.y += (gaze.ty - gaze.y) * Math.min(1, dt * 6);
    for (const s of sides) {
      s.irisGroup.rotation.y = gaze.x;
      s.irisGroup.rotation.x = -gaze.y;
    }
  };

  /** Look at a fixed point instead of drifting (unused by default). */
  group.userData.setGaze = (x, y) => {
    gaze.tx = x;
    gaze.ty = y;
  };

  return group;
}

export default buildEyes;
