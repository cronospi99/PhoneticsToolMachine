/**
 * tongue.js — a parametric tongue driven by five articulator parameters.
 *
 * The tongue is the hardest articulator to fake, because learners need to see
 * WHERE it bunches, not just that it moves. So rather than blending a handful
 * of baked morph targets, the surface is regenerated each frame from a midline
 * curve:
 *
 *     tongueBodyHigh / tongueBodyFront  place the dorsum's peak
 *     tongueTipHigh  / tongueTipFront   place the tip and blade
 *     tongueRoot                        retracts the root into the pharynx
 *
 * and two cross-sectional shapers:
 *
 *     groove    a central channel down the blade for sibilants (/s/, /z/)
 *     lateral   the sides drop away so air escapes around them (/l/)
 *
 * Geometry is a height-field: a grid over (z, x) whose y is the tongue's
 * surface, skirted down to the floor of the mouth and capped. Only the
 * position attribute is rewritten on update, so it is cheap enough per frame.
 *
 * Axes (shared by every anatomy module):
 *   +x right, +y up, +z anterior (toward the lips)
 */

import * as THREE from '../../../vendor/three/three.module.min.js';
import { roofHeightAt } from './oralCavity.js';

const NZ = 30;           // samples front-to-back
const NX = 17;           // samples across (odd, so there is a midline vertex)
const Z_BACK = -3.15;
const Z_FRONT = 3.48;
const FLOOR_Y = -2.35;

/** Front edge of the hard palate — past this the tongue has open air above. */
const ROOF_FRONT = 3.25;

/** Catmull-Rom through the midline control points. */
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Height of the tongue when it is lying flat on the floor of the mouth. */
const FLAT_Y = -1.55;

/** Gap left at full closure, so a contacting articulator does not clip through. */
const CONTACT_GAP = 0.04;

/**
 * Interpolate between lying flat and touching the roof.
 * height 0 = flat, 1 = in contact with the roof directly above.
 */
function towardRoof(z, height, flat = FLAT_Y) {
  const roof = roofHeightAt(z) - CONTACT_GAP;
  return flat + (roof - flat) * height;
}

/**
 * The five control points of the midline (sagittal) profile, in (z, y).
 * These are what the articulator parameters actually move.
 *
 * Heights are expressed as a fraction of the distance to the roof rather than
 * as absolute coordinates, so "body height 1" means contact wherever the body
 * happens to be — the velum for /k/, the much higher palate for /iː/.
 */
function midlineControls(p) {
  const root = p.tongueRoot;
  const bh = p.tongueBodyHigh;
  const bf = p.tongueBodyFront;
  const th = p.tongueTipHigh;
  const tf = p.tongueTipFront;

  // The dorsum peak slides forward as the body fronts: velar /k/ sits back,
  // palatal /j/ sits forward.
  const bodyZ = -2.05 + bf * 3.1;
  const bladeZ = 1.95 + tf * 0.55;
  // The tip reaches the ridge at tipFront ~0.8 and protrudes between the
  // teeth (dental /θ/) as it approaches 1.
  const tipZ = 2.30 + tf * 0.90;

  return [
    { z: Z_BACK, y: -1.90 - root * 0.30 },
    { z: -2.35, y: towardRoof(-2.35, bh * 0.55, -1.70) - root * 0.45 },
    { z: bodyZ, y: towardRoof(bodyZ, bh) },
    // The blade rises with the tip: an alveolar stop seals along the blade,
    // not just at the very point of the tongue.
    { z: bladeZ, y: towardRoof(bladeZ, Math.max(th * (0.72 + 0.28 * th), bh * 0.55)) },
    { z: tipZ, y: towardRoof(Math.min(tipZ, 3.2), th) },
    // front edge: the surface falls away past the apex, rounding the tip off
    // rather than letting the spline run on through the upper teeth
    { z: Z_FRONT, y: towardRoof(Math.min(tipZ, 3.2), th) - 0.55 },
  ];
}

/** Sample the midline height at an arbitrary z by walking the control spline. */
function makeMidlineSampler(ctrl) {
  // Resample the control polyline into a dense monotonic-in-z table.
  const pts = [];
  const ext = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 0; i < ext.length - 3; i += 1) {
    for (let s = 0; s < 12; s += 1) {
      const t = s / 12;
      pts.push({
        z: catmull(ext[i].z, ext[i + 1].z, ext[i + 2].z, ext[i + 3].z, t),
        y: catmull(ext[i].y, ext[i + 1].y, ext[i + 2].y, ext[i + 3].y, t),
      });
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  pts.sort((a, b) => a.z - b.z);

  return (z) => {
    if (z <= pts[0].z) return pts[0].y;
    if (z >= pts[pts.length - 1].z) return pts[pts.length - 1].y;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].z <= z) lo = mid; else hi = mid;
    }
    const span = pts[hi].z - pts[lo].z || 1e-6;
    const t = (z - pts[lo].z) / span;
    return pts[lo].y + (pts[hi].y - pts[lo].y) * t;
  };
}

/** Half-width of the tongue at a given z — narrower at the tip and the root. */
function halfWidth(z) {
  const t = (z - Z_BACK) / (Z_FRONT - Z_BACK); // 0 back .. 1 front
  const bulge = Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.06)));
  return 0.95 + bulge * 1.05;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class Tongue {
  constructor(material) {
    this.geometry = new THREE.BufferGeometry();
    this.topCount = NZ * NX;
    // top surface + skirt ring (NZ*2 + NX*2 around the perimeter) + floor
    this.perimeter = 2 * (NZ + NX) - 4;
    // top grid + skirt ring + floor ring + one centre vertex for the floor fan
    this.vertexCount = this.topCount + this.perimeter * 2 + 1;

    this.positions = new Float32Array(this.vertexCount * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setIndex(this.buildIndices());

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = 'tongue';
    this.mesh.castShadow = true;
  }

  /** Grid triangles for the top, a skirt down to the floor, and a floor cap. */
  buildIndices() {
    const idx = [];
    for (let i = 0; i < NZ - 1; i += 1) {
      for (let j = 0; j < NX - 1; j += 1) {
        const a = i * NX + j;
        const b = a + 1;
        const c = a + NX;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // perimeter walk of the grid, used for the skirt
    this.rim = [];
    for (let j = 0; j < NX; j += 1) this.rim.push((NZ - 1) * NX + j);          // front edge
    for (let i = NZ - 2; i >= 0; i -= 1) this.rim.push(i * NX + NX - 1);        // right edge
    for (let j = NX - 2; j >= 0; j -= 1) this.rim.push(j);                      // back edge
    for (let i = 1; i < NZ - 1; i += 1) this.rim.push(i * NX);                  // left edge

    const n = this.rim.length;
    const skirtStart = this.topCount;
    for (let k = 0; k < n; k += 1) {
      const k2 = (k + 1) % n;
      const top1 = this.rim[k];
      const top2 = this.rim[k2];
      const bot1 = skirtStart + k;
      const bot2 = skirtStart + k2;
      idx.push(top1, bot1, top2, top2, bot1, bot2);
    }
    // floor cap: fan from a dedicated centre vertex on the underside
    const floorStart = skirtStart + n;
    const centre = floorStart + n;
    for (let k = 0; k < n; k += 1) {
      const k2 = (k + 1) % n;
      idx.push(centre, floorStart + k2, floorStart + k);
    }
    this.rimLength = n;
    this.floorStart = floorStart;
    this.floorCentre = centre;
    return idx;
  }

  /**
   * Rewrite the surface for a parameter set.
   * @param {object} p resolved articulator parameters
   */
  update(p) {
    const ctrl = midlineControls(p);
    const midline = makeMidlineSampler(ctrl);
    const pos = this.positions;

    for (let i = 0; i < NZ; i += 1) {
      const zt = i / (NZ - 1);
      const z = Z_BACK + (Z_FRONT - Z_BACK) * zt;
      const w = halfWidth(z);
      const yMid = midline(z);
      // blade region — where grooving and lateral channels apply
      const blade = smooth(0.4, 0.78, zt);

      for (let j = 0; j < NX; j += 1) {
        const xt = j / (NX - 1);
        const x = (xt * 2 - 1) * w;
        const rel = Math.abs(x) / w;

        // domed cross-section
        let y = yMid - rel * rel * 0.62;

        // central groove for sibilants
        if (p.groove > 0) {
          const g = Math.exp(-((x / 0.46) ** 2));
          y -= p.groove * blade * 0.52 * g;
        }
        // lateral channels: sides drop, midline stays up against the ridge
        if (p.lateral > 0) {
          y -= p.lateral * blade * 0.85 * smooth(0.45, 1.0, rel);
        }

        const o = (i * NX + j) * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
      }
    }

    // Skirt + floor. The underside meets the top surface in a thin edge at the
    // tip and only drops to the floor further back, so the tongue reads as a
    // body with a blade rather than a block with a vertical front wall.
    const n = this.rimLength;
    let cx = 0;
    let cz = 0;
    for (let k = 0; k < n; k += 1) {
      const src = this.rim[k] * 3;
      const x = pos[src];
      const yTop = pos[src + 1];
      const z = pos[src + 2];

      const solid = smooth(3.30, 0.60, z);          // 1 well back, 0 at the tip
      const under = FLOOR_Y * solid + (yTop - 0.20) * (1 - solid);
      const inset = 0.90 + (1 - solid) * 0.08;

      const o = (this.topCount + k) * 3;
      pos[o] = x * inset;
      pos[o + 1] = Math.min(under, yTop - 0.10);
      pos[o + 2] = z;
      cx += pos[o];
      cz += pos[o + 2];

      const o2 = (this.floorStart + k) * 3;
      pos[o2] = pos[o];
      pos[o2 + 1] = pos[o + 1];
      pos[o2 + 2] = pos[o + 2];
    }
    const c = this.floorCentre * 3;
    pos[c] = cx / n;
    pos[c + 1] = FLOOR_Y - 0.05;
    pos[c + 2] = cz / n;

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  /**
   * Where the tongue comes closest to the roof of the mouth, and by how much.
   *
   * This — not the highest point — is what defines a constriction: the dorsum
   * for /k/ is lower in absolute terms than the tip for /t/, yet both are
   * closures, because the roof above them is at different heights.
   *
   * @returns {{gap:number, point:[number,number,number]}}
   */
  closestApproach() {
    const pos = this.positions;
    let best = Infinity;
    let at = [0, 0, 0];
    for (let i = 0; i < this.topCount; i += 1) {
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      // in front of the hard palate there is no roof to close against
      if (z > ROOF_FRONT) continue;
      const gap = roofHeightAt(z) - y;
      if (gap < best) {
        best = gap;
        at = [pos[i * 3], y, z];
      }
    }
    return { gap: best, point: at };
  }

  /** Highest point of the tongue surface, in model space. */
  peak() {
    const pos = this.positions;
    let best = -Infinity;
    let at = [0, 0, 0];
    for (let i = 0; i < this.topCount; i += 1) {
      const y = pos[i * 3 + 1];
      if (y > best) { best = y; at = [pos[i * 3], y, pos[i * 3 + 2]]; }
    }
    return { y: best, point: at };
  }
}

export default Tongue;
