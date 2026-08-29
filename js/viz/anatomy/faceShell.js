/**
 * faceShell.js — a translucent head wrapped around the articulators.
 *
 * Without it the tongue and teeth float in space and lose their scale; with it
 * opaque you cannot see the thing you came to see. So the shell renders as a
 * glassy skin, and can be dimmed or hidden entirely.
 *
 * Construction: the midsagittal silhouette is a closed profile loop in (z, y).
 * Moving sideways in x, that whole loop is scaled toward an interior centre by
 * an elliptical falloff — which is to say the head is a generalised ellipsoid
 * whose side view is exactly the profile. This keeps the silhouette right from
 * every angle, which a naive per-point sweep does not.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

/**
 * Closed profile of the head in the midsagittal plane, walked anticlockwise
 * from the bridge of the nose, down the face, under the jaw, up the back.
 */
const PROFILE = [
  // ── the face, front edge, top to bottom ──
  { z: 3.90, y: 3.20 },   // section cut, at the bridge of the nose
  { z: 4.65, y: 2.70 },
  { z: 5.50, y: 2.00 },   // tip of the nose
  { z: 4.80, y: 1.55 },   // base of the nose
  { z: 4.60, y: 1.15 },   // philtrum
  { z: 5.00, y: 0.60 },   // upper lip
  { z: 5.02, y: 0.00 },   // lip line
  { z: 4.95, y: -0.60 },  // lower lip
  { z: 4.50, y: -1.25 },  // mentolabial sulcus
  { z: 4.65, y: -2.05 },  // chin
  { z: 4.30, y: -2.90 },  // point of the chin
  { z: 3.40, y: -3.60 },  // under the chin
  { z: 1.70, y: -4.15 },  // submental
  // ── under the jaw and up the back of the neck ──
  { z: -0.40, y: -4.35 },
  { z: -2.40, y: -4.05 },
  { z: -3.70, y: -3.20 },
  { z: -4.40, y: -1.60 },
  { z: -4.70, y: 0.40 },
  { z: -4.60, y: 2.00 },
  { z: -4.20, y: 3.20 },  // section cut, at the back
  // ── the cut itself, closing the loop across the top ──
  { z: -1.50, y: 3.30 },
  { z: 1.50, y: 3.30 },
];

const RINGS = PROFILE.length;   // around the profile loop
const SLICES = 34;              // across the width
const HALF_WIDTH = 3.30;

/** Interior point the profile shrinks toward at the sides of the head. */
const CENTRE = { z: 0.30, y: -0.10 };

/**
 * Sideways falloff. A plain sqrt(1 - u²) ellipse pinches the temples too
 * hard for a head, so the exponent fattens the sides while keeping the
 * silhouette elliptical from above.
 */
const falloff = (u) => (1 - u * u) ** 0.34;

/**
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
export function buildFaceShell(material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(RINGS * SLICES * 3);
  const idx = [];

  for (let j = 0; j < SLICES; j += 1) {
    const u = (j / (SLICES - 1)) * 2 - 1;   // -1 .. 1 across the head
    const x = u * HALF_WIDTH;
    const s = falloff(u);

    for (let i = 0; i < RINGS; i += 1) {
      const p = PROFILE[i];
      const o = (j * RINGS + i) * 3;
      pos[o] = x;
      pos[o + 1] = CENTRE.y + (p.y - CENTRE.y) * s;
      pos[o + 2] = CENTRE.z + (p.z - CENTRE.z) * s;
    }
  }

  // The profile loop is closed, so wrap i; x slices are not, so j is open.
  for (let j = 0; j < SLICES - 1; j += 1) {
    for (let i = 0; i < RINGS; i += 1) {
      const i2 = (i + 1) % RINGS;
      const a = j * RINGS + i;
      const b = j * RINGS + i2;
      const c = (j + 1) * RINGS + i;
      const d = (j + 1) * RINGS + i2;
      idx.push(a, c, b, b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'face-shell';
  mesh.renderOrder = 2;     // drawn after the articulators it encloses
  return mesh;
}

export default buildFaceShell;
