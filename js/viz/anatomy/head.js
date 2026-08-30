/**
 * head.js — a full human head, sculpted procedurally.
 *
 * The previous face shell was a caricature: its whole height was barely larger
 * than the mouth cavity inside it. A real head is about 23 cm tall around an
 * oral cavity of roughly 8 cm, so this model is built to proper proportions
 * around the existing anatomy — the teeth, palate and tongue keep their
 * coordinates, and the head is scaled up to fit around them.
 *
 * Canonical proportions, measured down from the crown:
 *
 *     crown ────────── y = +11.0
 *     hairline ─────── y =  +8.4  ┐
 *     brow ─────────── y =  +4.8  ├ three equal thirds
 *     nose base ────── y =  +1.2  ┘
 *     mouth ────────── y =  -0.05   (fixed: the teeth sit at y = 0)
 *     chin ─────────── y =  -2.4
 *
 * Construction is a deformed ellipsoid: every vertex starts on a sphere, is
 * scaled into a head-shaped ellipsoid, then pushed around by a stack of
 * anatomical fields — brow ridge, eye sockets, nose, cheekbones, philtrum,
 * chin, jaw taper. Triangles falling inside the mouth and eye openings are
 * dropped, leaving real apertures: when the jaw opens you see the teeth and
 * tongue through the mouth, exactly as you would on a real face.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

/**
 * Vertical landmarks, shared with the eyes, brows, hair and ears.
 *
 * These come from the anatomy, not from taste. The tongue in tongue.js spans
 * 6.6 units, which is about 8 cm of real tongue — so one unit is ~1.2 cm, and
 * a 23 cm head has to be very nearly 20 units tall. An earlier attempt at a
 * smaller head put the chin at the same height as the floor of the mouth, and
 * the tongue hung out through the jaw.
 */
export const LANDMARKS = {
  crown: 16.3,
  hairline: 12.4,
  brow: 7.10,
  eye: 6.20,
  noseBase: 1.70,
  noseTip: 2.45,
  mouth: -0.05,
  chin: -3.60,
  earY: 4.60,
  eyeX: 2.60,
  eyeZ: 3.28,   // centre of the globe, well back inside the orbit
  earX: 6.00,
  earZ: -0.60,
};

/** The base ellipsoid the head is carved out of. */
const C = { y: 6.35, z: -1.50 };
const R = { x: 6.25, y: 9.95, z: 7.60 };

let SEG_W = 128;
let SEG_H = 96;

/**
 * Sexual dimorphism in the skull, as multipliers on the sculpt fields.
 *
 * The differences that actually read are the brow ridge (far heavier in the
 * male skull), the jaw — square and wide versus tapered to a narrower chin —
 * and the relative fullness of the lips and cheekbones. Overall head SIZE is
 * deliberately left alone: the oral cavity inside is fixed by the phonetics,
 * so scaling the skull would pull the face away from the teeth it wraps.
 */
export const PROFILES = {
  male: {
    id: 'male',
    label: 'Male',
    jawTaper: 0.26,        // less taper = a squarer jaw
    jawWidth: 1.00,
    browRidge: 1.00,
    cheekbone: 0.88,
    chin: 1.00,
    chinWidth: 1.18,
    noseWidth: 1.00,
    noseLength: 1.00,
    lipFullness: 0.88,
    // LINEAR values, not sRGB. Three treats vertex colours as linear working
    // space, so writing what looks like a skin hex here renders it far paler
    // and greyer than intended: 0.63 green displays as 0.82.
    skinTone: [0.807, 0.478, 0.313],
    hairLength: 0.0,
    voice: { f0: 118, tract: 1.00 },
  },
  female: {
    id: 'female',
    label: 'Female',
    jawTaper: 0.36,        // more taper = a narrower, rounder jaw
    jawWidth: 0.94,
    browRidge: 0.32,       // the single clearest difference between the skulls
    cheekbone: 1.18,
    chin: 0.82,
    chinWidth: 0.86,
    noseWidth: 0.87,
    noseLength: 0.92,
    lipFullness: 1.25,
    skinTone: [0.868, 0.545, 0.393],
    hairLength: 1.0,
    voice: { f0: 205, tract: 1.16 },
  },
};

export const DEFAULT_PROFILE = PROFILES.male;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Anisotropic gaussian blob: 1 at the centre, falling to 0 by `radii`. */
function blob(p, cx, cy, cz, rx, ry, rz) {
  const dx = (p.x - cx) / rx;
  const dy = (p.y - cy) / ry;
  const dz = (p.z - cz) / rz;
  const d2 = dx * dx + dy * dy + dz * dz;
  return d2 >= 1 ? 0 : (1 - d2) ** 2;
}

/** Same, but symmetric across the midline — one call does both sides. */
function blobPair(p, cx, cy, cz, rx, ry, rz) {
  return Math.max(
    blob(p, cx, cy, cz, rx, ry, rz),
    blob(p, -cx, cy, cz, rx, ry, rz),
  );
}

/**
 * Push one point on the base ellipsoid into a face.
 * Facial relief is applied along +z (outward from the face) because that is
 * how the underlying bone and cartilage actually build up.
 */
function sculpt(p, g) {
  const L = LANDMARKS;
  const faceness = smoothstep(-2.5, 3.5, p.z);   // 1 on the face, 0 round the back

  // ── the mandible: the head narrows sharply below the cheekbones ──
  const jaw = smoothstep(4.0, -3.6, p.y);
  p.x *= (1 - jaw * g.jawTaper) * (1 - (1 - g.jawWidth) * jaw);
  p.z -= jaw * faceness * 0.35;

  // the very bottom rounds under toward the throat
  const underJaw = smoothstep(-1.6, -4.0, p.y);
  p.z -= underJaw * 1.9;
  p.x *= 1 - underJaw * 0.26;

  // ── cranium: temples pulled in, back of the skull slightly flattened ──
  p.x *= 1 - blobPair(p, 5.2, L.brow + 1.6, 2.6, 3.2, 3.4, 4.6) * 0.09;
  p.z += smoothstep(11.0, 16.3, p.y) * -0.55;

  // ── brow ridge ──
  p.z += blob(p, 0, L.brow + 0.20, 5.6, 4.2, 1.15, 3.8) * 0.52 * g.browRidge * faceness;

  // ── eye sockets: scooped back, deeper toward the nose ──
  p.z -= blobPair(p, L.eyeX, L.eye + 0.10, 5.9, 2.10, 1.45, 2.9) * 1.05;
  p.z -= blobPair(p, 1.30, L.eye + 0.30, 5.9, 1.15, 1.25, 2.6) * 0.45;

  // ── nose ──
  // the bridge runs from between the brows down to the tip
  const bridge = smoothstep(L.brow + 0.8, L.noseTip, p.y)
    * smoothstep(L.noseBase - 1.3, L.noseBase + 0.3, p.y + 1.7);
  const narrow = Math.exp(-((p.x / (1.15 * g.noseWidth)) ** 2));
  p.z += bridge * narrow * 1.85 * g.noseLength * faceness;
  // the tip and the ball of the nose
  p.z += blob(p, 0, L.noseTip, 6.2, 1.15 * g.noseWidth, 1.05, 2.5) * 1.55 * g.noseLength;
  // the wings either side of the nostrils
  p.z += blobPair(p, 1.02 * g.noseWidth, L.noseBase + 0.18, 5.8, 0.78 * g.noseWidth, 0.72, 1.9) * 0.85;
  // and the nostrils themselves, punched back underneath
  p.z -= blobPair(p, 0.58 * g.noseWidth, L.noseBase - 0.48, 6.5, 0.42, 0.40, 1.1) * 1.15;

  // ── cheekbones, and the hollow under them ──
  const cheek = blobPair(p, 3.85, 3.60, 4.1, 2.3, 2.0, 3.4);
  p.z += cheek * 0.60 * g.cheekbone;
  p.x += cheek * 0.34 * g.cheekbone * Math.sign(p.x || 1);
  p.z -= blobPair(p, 3.30, 0.70, 4.5, 2.0, 1.8, 2.8) * 0.50;

  // ── the mouth region ──
  // philtrum: the groove from the nose down to the upper lip
  p.z -= blob(p, 0, 0.85, 5.6, 0.40, 0.85, 1.7) * 0.34;
  // the lips themselves are separate meshes; the skin around them swells a
  // little, and the crease below the lower lip is what reads as a mouth
  p.z += blob(p, 0, L.mouth, 5.2, 2.5, 1.30, 2.0) * 0.26 * g.lipFullness;
  p.z -= blob(p, 0, -1.70, 5.2, 1.6, 0.60, 1.7) * 0.40;

  // ── chin ──
  p.z += blob(p, 0, -2.70, 4.9, 1.70 * g.chinWidth, 1.35, 2.6) * 0.60 * g.chin;

  return p;
}

/** Is this point inside the mouth opening? */
function inMouth(p) {
  if (p.z < 2.5) return false;
  const dx = p.x / 2.35;
  const dy = (p.y - LANDMARKS.mouth) / 1.45;
  return dx * dx + dy * dy < 1;
}

/** Is this point inside one of the eye openings? */
function inEye(p) {
  if (p.z < 2.5) return false;
  const dy = (p.y - LANDMARKS.eye) / 0.44;
  const dx = (Math.abs(p.x) - LANDMARKS.eyeX) / 1.22;
  // almond rather than ellipse: pinched at the corners
  return dx * dx + dy * dy < 1;
}

/** Per-vertex skin colour — cheaper and easier to control than a UV texture. */
function skinColour(p, out, tone) {
  const L = LANDMARKS;
  let r = tone[0];
  let g = tone[1];
  let b = tone[2];

  // blood shows through more on the cheeks and the nose
  const flush = blobPair(p, 3.4, 2.4, 5.0, 2.7, 2.4, 3.2) * 0.55
    + blob(p, 0, L.noseTip, 6.2, 1.4, 1.5, 2.2) * 0.35;
  r += flush * 0.075;
  g -= flush * 0.045;
  b -= flush * 0.030;

  // the lip border and the skin right around the mouth are redder
  const perioral = blob(p, 0, L.mouth, 5.3, 2.8, 1.5, 2.0);
  r += perioral * 0.060;
  g -= perioral * 0.070;
  b -= perioral * 0.050;

  // sockets and the underside of the jaw sit in shadow
  const shade = blobPair(p, L.eyeX, L.eye - 0.45, 5.8, 2.0, 1.3, 2.6) * 0.55
    + smoothstep(-2.0, -4.0, p.y) * 0.35;
  r -= shade * 0.22;
  g -= shade * 0.14;
  b -= shade * 0.10;

  out.setRGB(r, g, b);
}

/**
 * Build the head.
 * @param {THREE.Material} material expected to have vertexColors enabled
 * @returns {THREE.Mesh}
 */
export function buildHeadGeometry(profile = DEFAULT_PROFILE, segments = null) {
  const g = { ...DEFAULT_PROFILE, ...profile };
  const w = segments ? segments.w : SEG_W;
  const h = segments ? segments.h : SEG_H;
  const base = new THREE.SphereGeometry(1, w, h);
  const pos = base.attributes.position;
  const count = pos.count;

  const out = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    p.set(pos.getX(i) * R.x, pos.getY(i) * R.y + C.y, pos.getZ(i) * R.z + C.z);
    sculpt(p, g);
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
    skinColour(p, c, g.skinTone);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }

  // Drop the triangles that fall in the openings. Doing it by centroid keeps
  // the rim of the hole clean, since a triangle is either in or out.
  const srcIndex = base.getIndex();
  const keep = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const mid = new THREE.Vector3();

  for (let t = 0; t < srcIndex.count; t += 3) {
    const i0 = srcIndex.getX(t);
    const i1 = srcIndex.getX(t + 1);
    const i2 = srcIndex.getX(t + 2);
    a.fromArray(out, i0 * 3);
    b.fromArray(out, i1 * 3);
    d.fromArray(out, i2 * 3);
    mid.copy(a).add(b).add(d).multiplyScalar(1 / 3);
    if (inMouth(mid) || inEye(mid)) continue;
    keep.push(i0, i1, i2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.setIndex(keep);
  geo.computeVertexNormals();
  base.dispose();
  return geo;
}

/**
 * Convenience wrapper for the runtime fallback path, when the pre-built glTF
 * asset could not be loaded.
 */
export function buildHead(material, profile = DEFAULT_PROFILE) {
  const mesh = new THREE.Mesh(buildHeadGeometry(profile), material);
  mesh.name = 'head';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Ears. Built separately because they are a different shape problem from the
 * rest of the head — a flattened torus with a lobe reads well enough at the
 * scale this model is ever seen at.
 */
export function buildEars(material) {
  const group = new THREE.Group();
  group.name = 'ears';
  const L = LANDMARKS;

  for (const side of [-1, 1]) {
    const ear = new THREE.Group();

    const helix = new THREE.Mesh(
      new THREE.TorusGeometry(1.30, 0.34, 10, 26, Math.PI * 1.55),
      material,
    );
    helix.rotation.y = Math.PI / 2 * side;
    helix.rotation.z = -0.35 * side;
    ear.add(helix);

    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.02, 18, 14), material);
    bowl.scale.set(0.30, 1.05, 0.78);
    ear.add(bowl);

    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), material);
    lobe.scale.set(0.42, 0.95, 0.85);
    lobe.position.set(0, -1.30, 0.08);
    ear.add(lobe);

    ear.position.set(side * L.earX, L.earY, L.earZ);
    ear.rotation.z = side * 0.10;
    ear.rotation.x = -0.12;
    group.add(ear);
  }
  return group;
}

/**
 * The neck.
 *
 * Built separately because the head is a closed ellipsoid whose lowest vertex
 * is the chin — there is nothing below it to displace downward. Without this
 * the larynx and trachea hang in mid-air under the jaw.
 */
export function buildNeck(material) {
  const group = new THREE.Group();
  group.name = 'neck';

  const rows = 18;
  const cols = 28;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(rows * cols * 3);
  const idx = [];

  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);                 // 0 at the jaw .. 1 at the base
    const y = -1.9 - t * 7.6;
    // flares into the shoulders at the bottom, tucks under the jaw at the top
    const r = 2.35 + t * t * 1.9 + (1 - t) * 0.55;
    const cz = -1.75 + (1 - t) * 0.55;
    for (let j = 0; j < cols; j += 1) {
      const a = (j / (cols - 1)) * Math.PI * 2;
      const o = (i * cols + j) * 3;
      pos[o] = Math.sin(a) * r;
      pos[o + 1] = y;
      // slightly oval rather than round, which is what a neck actually is
      pos[o + 2] = cz + Math.cos(a) * r * 0.86;
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < cols - 1; j += 1) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'neck-skin';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export { C as HEAD_CENTRE, R as HEAD_RADII };
