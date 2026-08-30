/**
 * lips.js — upper and lower lips built as tubes swept around the mouth
 * aperture, so they read correctly from the front AND in profile.
 *
 * Driven by:
 *   lipOpen      vertical aperture (0 = sealed, for /p/ /b/ /m/)
 *   lipRound     horizontal narrowing (/u/, /w/, /ʃ/)
 *   lipSpread    corners drawn back (/i/, /s/)
 *   lipProtrude  pushed forward along +z
 *   lipTuck      lower lip drawn back under the upper teeth (/f/, /v/)
 *
 * The aperture is an ellipse of half-width W and half-height H at the lip
 * plane. Lip flesh is a tube of varying radius around it — fat at the centre
 * of each lip, thin at the corners, which is what makes it look like a mouth
 * rather than a doughnut.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

const LIP_Z = 4.15;      // lip plane, just in front of the incisors
const RING = 44;         // samples around the aperture
const TUBE = 10;         // samples around the flesh cross-section

/** Half-width and half-height of the aperture for a parameter set. */
function aperture(p) {
  const w = 1.72 - p.lipRound * 0.92 + p.lipSpread * 0.26;
  const h = 0.05 + p.lipOpen * 1.30 + p.jaw * 0.28;
  return { w: Math.max(0.38, w), h };
}

/** Flesh radius around the ring: thick mid-lip, thin at the corners. */
function fleshRadius(theta, isUpper, p) {
  const corner = Math.abs(Math.cos(theta));          // 1 at the corners
  const mid = 1 - corner;
  const base = isUpper ? 0.24 : 0.30;
  return 0.08 + base * (0.35 + mid * 0.85) + p.lipRound * 0.08 * mid;
}

export class Lips {
  /**
   * @param {THREE.Material} material
   * @param {boolean} isUpper upper lip is fixed to the skull, lower rides the jaw
   */
  constructor(material, isUpper) {
    this.isUpper = isUpper;
    this.geometry = new THREE.BufferGeometry();
    this.count = RING * TUBE;
    this.positions = new Float32Array(this.count * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const idx = [];
    for (let i = 0; i < RING - 1; i += 1) {
      for (let j = 0; j < TUBE; j += 1) {
        const j2 = (j + 1) % TUBE;
        const a = i * TUBE + j;
        const b = i * TUBE + j2;
        const c = (i + 1) * TUBE + j;
        const d = (i + 1) * TUBE + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    this.geometry.setIndex(idx);

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = isUpper ? 'lip-upper' : 'lip-lower';
    this.mesh.castShadow = true;
  }

  update(p) {
    const { w, h } = aperture(p);
    const pos = this.positions;
    const up = this.isUpper;

    // Upper lip sweeps theta 0..PI, lower lip PI..2PI, so together they close.
    const t0 = up ? 0 : Math.PI;
    const protrude = p.lipProtrude * 0.85;
    // A tucked lower lip retreats behind the upper incisors instead of meeting
    // the upper lip — this is what /f/ and /v/ actually look like.
    const tuck = up ? 0 : p.lipTuck;

    for (let i = 0; i < RING; i += 1) {
      const theta = t0 + (Math.PI * i) / (RING - 1);
      const cx = Math.cos(theta) * w;
      const cy = Math.sin(theta) * h;
      const r = fleshRadius(theta, up, p);

      // outward normal of the ring in the lip plane
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);

      for (let j = 0; j < TUBE; j += 1) {
        const phi = (j / TUBE) * Math.PI * 2;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        // ring-local frame: outward (nx, ny, 0) and depth (0, 0, 1)
        let x = cx + nx * r * cosP;
        let y = cy + ny * r * cosP;
        let z = LIP_Z + protrude + r * sinP * 1.15;

        // vermilion roll: the front face of the lip bows outward
        z += (1 - Math.abs(cosP)) * 0.10;

        if (tuck > 0) {
          y += tuck * 0.30;
          z -= tuck * 0.62;
        }

        const o = (i * TUBE + j) * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

export default Lips;
