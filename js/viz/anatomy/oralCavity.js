/**
 * oralCavity.js — the static (or near-static) walls of the vocal tract:
 * hard palate and alveolar ridge, the hinged velum, the pharyngeal wall,
 * the floor of the mouth, and the vocal folds.
 *
 * Only the velum and the folds animate; everything else is the fixed frame the
 * tongue and lips move against.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

const NZ = 26;
const NX = 15;
const PALATE_FRONT = 3.30;   // just behind the upper incisors
const PALATE_BACK = -1.55;   // where the soft palate takes over

/**
 * Midline height of the roof of the mouth at a given z. The bump just behind
 * the teeth is the alveolar ridge — the target for /t/, /d/, /n/, /s/, /l/.
 */
function palateMidline(z) {
  const t = (PALATE_FRONT - z) / (PALATE_FRONT - PALATE_BACK); // 0 front .. 1 back
  const dome = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 0.95;
  const ridge = Math.exp(-(((t - 0.10) / 0.13) ** 2)) * 0.34;
  return 0.72 + dome + ridge * 0.9;
}

/** Hard palate as a height-field sheet, arching down toward the tooth line. */
export function buildPalate(material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NZ * NX * 3);
  const idx = [];

  for (let i = 0; i < NZ; i += 1) {
    const zt = i / (NZ - 1);
    const z = PALATE_FRONT + (PALATE_BACK - PALATE_FRONT) * zt;
    const halfW = 1.55 + Math.sin(Math.PI * zt) * 0.42;
    const yMid = palateMidline(z);
    for (let j = 0; j < NX; j += 1) {
      const xt = j / (NX - 1);
      const x = (xt * 2 - 1) * halfW;
      const rel = Math.abs(x) / halfW;
      const o = (i * NX + j) * 3;
      pos[o] = x;
      pos[o + 1] = yMid - rel * rel * 0.78;  // vaulted, dropping to the gums
      pos[o + 2] = z;
    }
  }
  for (let i = 0; i < NZ - 1; i += 1) {
    for (let j = 0; j < NX - 1; j += 1) {
      const a = i * NX + j;
      idx.push(a, a + 1, a + NX, a + 1, a + NX + 1, a + NX);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'palate';
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Soft palate. Hinged at its front edge so it can swing down and open the
 * nasal port — the single visible difference between /b/ and /m/.
 */
export function buildVelum(material) {
  const pivot = new THREE.Group();
  pivot.name = 'velum';
  pivot.position.set(0, palateMidline(PALATE_BACK), PALATE_BACK);

  const geo = new THREE.BufferGeometry();
  const rows = 8;
  const cols = 11;
  const pos = new Float32Array(rows * cols * 3);
  const idx = [];
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    for (let j = 0; j < cols; j += 1) {
      const xt = j / (cols - 1);
      const halfW = 1.35 * (1 - t * 0.42);
      const x = (xt * 2 - 1) * halfW;
      const o = (i * cols + j) * 3;
      pos[o] = x;
      pos[o + 1] = -Math.sin(t * 1.5) * 0.28 - (Math.abs(x) / halfW) ** 2 * 0.22;
      pos[o + 2] = -t * 1.55;
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < cols - 1; j += 1) {
      const a = i * cols + j;
      idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const flap = new THREE.Mesh(geo, material);
  flap.name = 'velum-flap';
  pivot.add(flap);

  /** @param {number} open 0 = raised against the wall, 1 = lowered (nasal) */
  pivot.userData.setOpen = (open) => {
    // raised = sealed against the pharyngeal wall; lowered = air into the nose
    pivot.rotation.x = -0.55 + open * 1.15;
  };
  return pivot;
}

/** Back wall of the pharynx, curving down toward the larynx. */
export function buildPharynx(material) {
  const rows = 16;
  const cols = 13;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(rows * cols * 3);
  const idx = [];
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);                 // 0 top .. 1 bottom
    // stops above the bottom of the head, so the wall never pokes out of the neck
    const y = 1.95 - t * 5.55;
    const z = -3.25 + Math.sin(t * Math.PI) * 0.55;
    const halfW = 1.50 - t * 0.62;
    for (let j = 0; j < cols; j += 1) {
      const xt = j / (cols - 1);
      const x = (xt * 2 - 1) * halfW;
      const rel = Math.abs(x) / halfW;
      const o = (i * cols + j) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z - rel * rel * 0.55;
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
  mesh.name = 'pharynx';
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Vocal folds at the bottom of the tract. They part for voiceless sounds and
 * vibrate for voiced ones, which is the whole of the voiced/voiceless contrast
 * that the chart colours blue and green.
 */
export function buildVocalFolds(material) {
  const group = new THREE.Group();
  group.name = 'vocal-folds';
  group.position.set(0, -3.35, -2.85);

  const make = (side) => {
    const geo = new THREE.SphereGeometry(0.52, 18, 12);
    geo.scale(0.42, 0.34, 1.25);
    const m = new THREE.Mesh(geo, material);
    m.position.x = side * 0.24;
    return m;
  };
  const left = make(-1);
  const right = make(1);
  group.add(left, right);

  /**
   * @param {number} voice 0 (open, silent) .. 1 (adducted, vibrating)
   * @param {number} phase animation phase in radians
   */
  group.userData.setVoicing = (voice, phase) => {
    const flutter = voice > 0.5 ? Math.sin(phase) * 0.06 : 0;
    const gap = 0.42 - voice * 0.30 + flutter;
    left.position.x = -gap;
    right.position.x = gap;
    const s = 1 + (voice > 0.5 ? Math.sin(phase) * 0.10 : 0);
    left.scale.setScalar(s);
    right.scale.setScalar(s);
  };
  return group;
}

/** Floor of the mouth under the tongue, so the model is not hollow. */
export function buildFloor(material) {
  const geo = new THREE.SphereGeometry(2.6, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  geo.scale(0.86, 0.42, 1.35);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(0, -2.30, 0.35);
  mesh.name = 'mouth-floor';
  return mesh;
}

/**
 * Height of the roof of the vocal tract at any z the tongue can reach —
 * hard palate at the front, soft palate and the pharyngeal roof behind it.
 *
 * The tongue module uses this to turn "tongue body height = 1" into "the
 * dorsum is touching the roof HERE", which is what close/open actually means
 * in articulatory terms, and which keeps /k/ meeting the velum while /iː/
 * meets the much higher palatal vault.
 */
export function roofHeightAt(z) {
  const clamped = Math.min(PALATE_FRONT, Math.max(-3.1, z));
  if (clamped >= PALATE_BACK) return palateMidline(clamped);
  // behind the hard palate the roof falls away toward the pharynx
  const t = (PALATE_BACK - clamped) / (PALATE_BACK + 3.1);
  return palateMidline(PALATE_BACK) - t * 0.42;
}

export { palateMidline };
