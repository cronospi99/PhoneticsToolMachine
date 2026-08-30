/**
 * hair.js — a hair shell over the cranium.
 *
 * Strand-based hair is out of reach without a shader and a lot of geometry, so
 * this is the standard game-art compromise: a solid cap that follows the skull
 * a little way out, with an irregular hairline and a few overlapping locks to
 * break up the silhouette. It reads as hair at any distance the model is
 * actually viewed from.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';
import { LANDMARKS, HEAD_CENTRE, HEAD_RADII, DEFAULT_PROFILE } from './head.js';

const SEG_W = 144;
const SEG_H = 108;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * How much hair covers this point: 1 well up on the skull, 0 below the
 * hairline. The hairline dips at the temples and rises over the forehead,
 * which is what stops it looking like a swimming cap.
 */
function coverage(x, y, z, longer) {
  const L = LANDMARKS;
  // front hairline, with a slight widow's peak at the midline
  const peak = Math.exp(-((x / 2.0) ** 2)) * 0.75;
  // a little irregularity, so the hairline is not a clean drawn arc
  const ragged = Math.sin(x * 2.9) * 0.16 + Math.sin(x * 7.3 + 1.1) * 0.09;
  const frontLine = L.hairline - peak + Math.abs(x) * 0.30 + ragged;
  const front = smoothstep(frontLine - 1.1, frontLine + 0.6, y);

  // At the back and sides the hair comes further down. These thresholds are in
  // head units and have to track the skull: on a head 12.5 wide and 17 deep,
  // the old values treated the entire side of the face as "side of the head"
  // and pulled the hair down over the cheek like a helmet.
  const backness = smoothstep(2.0, -3.0, z);
  const sideness = smoothstep(4.3, 6.1, Math.abs(x));
  const low = Math.max(backness, sideness * 0.85);
  // `longer` drops the back and sides well past the jaw
  const lowLine = L.earY - 0.6 - longer * 6.5;
  const back = smoothstep(lowLine - 1.8, lowLine + 1.8, y);

  return Math.max(front, low * back);
}

/**
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildHair(material, profile = DEFAULT_PROFILE) {
  const group = new THREE.Group();
  group.name = 'hair';
  const longer = profile.hairLength ?? 0;

  const base = new THREE.SphereGeometry(1, SEG_W, SEG_H);
  const pos = base.attributes.position;
  const count = pos.count;
  const out = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const cover = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    p.set(
      pos.getX(i) * HEAD_RADII.x,
      pos.getY(i) * HEAD_RADII.y + HEAD_CENTRE.y,
      pos.getZ(i) * HEAD_RADII.z + HEAD_CENTRE.z,
    );
    // match the head's jaw taper so the hair does not float off the skull
    const jaw = smoothstep(2.6, -2.4, p.y);
    p.x *= 1 - jaw * 0.34;

    const c = coverage(p.x, p.y, p.z, longer);
    cover[i] = c;

    // lift off the scalp, with clumping so the surface is not glassy-smooth
    const clump = (Math.sin(p.x * 1.5) * Math.cos(p.z * 1.2 + p.y * 0.45)) * 0.22
      + Math.sin(p.x * 3.1 + p.z * 2.4) * 0.09;
    const lift = c * (0.62 + clump);
    const n = new THREE.Vector3(
      p.x / HEAD_RADII.x,
      (p.y - HEAD_CENTRE.y) / HEAD_RADII.y,
      (p.z - HEAD_CENTRE.z) / HEAD_RADII.z,
    ).normalize();
    p.addScaledVector(n, lift);

    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }

  // keep only the triangles that actually carry hair
  const srcIndex = base.getIndex();
  const keep = [];
  for (let t = 0; t < srcIndex.count; t += 3) {
    const i0 = srcIndex.getX(t);
    const i1 = srcIndex.getX(t + 1);
    const i2 = srcIndex.getX(t + 2);
    if ((cover[i0] + cover[i1] + cover[i2]) / 3 < 0.22) continue;
    keep.push(i0, i1, i2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setIndex(keep);
  geo.computeVertexNormals();
  base.dispose();

  const cap = new THREE.Mesh(geo, material);
  cap.name = 'hair-cap';
  cap.castShadow = true;
  group.add(cap);

  return group;
}

export default buildHair;
