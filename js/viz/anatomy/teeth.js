/**
 * teeth.js — upper and lower dental arches.
 *
 * Individual teeth (rather than one solid band) matter here: learners need to
 * see the lower lip meet the upper incisors for /f/, and the tongue tip appear
 * between the teeth for /θ/.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';

const PER_ARCH = 12;     // incisors through second molars, one side to the other
const ARCH_SPAN = 1.22;  // radians swept from the midline to the back

/** Position and size of tooth `i` on an arch. */
function toothAt(i, upper) {
  const t = (i / (PER_ARCH - 1)) * 2 - 1;            // -1 .. 1 across the arch
  const a = t * ARCH_SPAN;
  const x = Math.sin(a) * 1.88;
  const z = Math.cos(a) * 3.75 - 0.62;
  const front = 1 - Math.min(1, Math.abs(t) * 1.45); // 1 at the incisors

  return {
    x,
    z,
    yaw: -a,
    width: 0.30 + (1 - front) * 0.24,
    depth: 0.26 + (1 - front) * 0.30,
    height: (upper ? 0.62 : 0.56) * (0.62 + front * 0.45),
  };
}

/**
 * @param {THREE.Material} material
 * @param {boolean} upper
 * @returns {THREE.Group}
 */
export function buildArch(material, upper) {
  const group = new THREE.Group();
  group.name = upper ? 'teeth-upper' : 'teeth-lower';

  for (let i = 0; i < PER_ARCH; i += 1) {
    const t = toothAt(i, upper);
    const geo = new THREE.BoxGeometry(t.width, t.height, t.depth);
    // round the biting edge a little so the teeth do not read as raw cubes
    geo.translate(0, upper ? -t.height / 2 : t.height / 2, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(t.x, upper ? 0.02 : -0.02, t.z);
    mesh.rotation.y = t.yaw;
    mesh.castShadow = true;
    group.add(mesh);
  }

  // Gum ridge along the same arch as the teeth. A torus was the obvious
  // shortcut here and it was wrong: its radius runs far behind the molars, so
  // in profile it read as a long rod rather than a gum line.
  const spine = [];
  for (let i = 0; i < PER_ARCH; i += 1) {
    const t = toothAt(i, upper);
    spine.push(new THREE.Vector3(t.x, upper ? 0.30 : -0.30, t.z - 0.10));
  }
  const gum = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spine), 24, 0.30, 8, false),
    material,
  );
  gum.name = upper ? 'gum-upper' : 'gum-lower';
  group.add(gum);

  return group;
}

export default buildArch;
