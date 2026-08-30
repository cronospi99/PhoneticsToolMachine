/**
 * faceAsset.js — load the head as a glTF asset.
 *
 * The head ships as a pre-built .glb (see tools/build-head.mjs) rather than
 * being sculpted at start-up. That buys three things: a much finer mesh than is
 * sensible to compute during a page load, a real asset boundary, and the
 * ability to swap in a scanned or hand-sculpted head by replacing the file —
 * so long as it keeps this coordinate frame:
 *
 *   +y up, +z out through the face, the teeth at y = 0, the lip plane near
 *   z = 4.2, and meshes named `head`, `ears` and `hair`.
 *
 * If the asset cannot be fetched the same geometry is built procedurally
 * instead, so the app degrades to a working face rather than a missing one.
 */

import * as THREE from '../../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../../vendor/three/jsm/GLTFLoader.js';
import { buildHead, buildEars, buildNeck, PROFILES, DEFAULT_PROFILE } from './head.js';
import { buildHair } from './hair.js';

const loader = new GLTFLoader();

/** Asset URLs resolved against this module, not the page. */
function assetUrl(id) {
  return new URL(`../../../assets/head-${id}.glb`, import.meta.url).href;
}

/**
 * Give the loaded meshes the material treatment the app wants: physically
 * based skin with a little sheen, so it does not read as painted plastic.
 * A model supplied from outside keeps whatever it came with — only the meshes
 * this project builds are recognised by name.
 */
function dressMaterials(root, profile) {
  const skins = [];
  const hairs = [];

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;

    const name = (o.material?.name || o.name || '').toLowerCase();
    if (name.includes('hair')) {
      const m = new THREE.MeshStandardMaterial({
        color: profile.id === 'female' ? 0x3a2418 : 0x2b1d16,
        roughness: 0.72,
        metalness: 0.10,
      });
      o.material = m;
      hairs.push(m);
      return;
    }
    if (name.includes('skin') || o.name === 'head') {
      const m = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: !!o.geometry.attributes.color,
        roughness: 0.58,
        metalness: 0,
        clearcoat: 0.07,
        clearcoatRoughness: 0.6,
        sheen: 0.16,
        sheenColor: new THREE.Color(0xffbfa0),
        sheenRoughness: 0.9,
        side: THREE.DoubleSide,
      });
      if (!o.geometry.attributes.color) m.color.setRGB(...profile.skinTone);
      o.material = m;
      skins.push(m);
    }
  });

  return { skins, hairs };
}

/** Build the same face without the asset, for the offline/failed-fetch path. */
function buildProcedural(profile) {
  const group = new THREE.Group();
  group.name = 'face';
  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.58,
    clearcoat: 0.07,
    clearcoatRoughness: 0.6,
    sheen: 0.16,
    sheenColor: new THREE.Color(0xffbfa0),
    side: THREE.DoubleSide,
  });
  const skinPlain = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...profile.skinTone),
    roughness: 0.62,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: profile.id === 'female' ? 0x3a2418 : 0x2b1d16,
    roughness: 0.72,
    metalness: 0.10,
  });

  group.add(
    buildHead(skin, profile), buildEars(skinPlain),
    buildNeck(skinPlain), buildHair(hairMat, profile),
  );
  return { group, skins: [skin, skinPlain], hairs: [hairMat], source: 'procedural' };
}

/**
 * @param {'male'|'female'} id
 * @returns {Promise<{group:THREE.Group, skins:THREE.Material[], hairs:THREE.Material[], source:string}>}
 */
export async function loadFace(id = 'male') {
  const profile = PROFILES[id] || DEFAULT_PROFILE;
  try {
    const gltf = await loader.loadAsync(assetUrl(profile.id));
    const group = gltf.scene;
    group.name = 'face';
    const { skins, hairs } = dressMaterials(group, profile);
    if (!skins.length) throw new Error('no skin mesh found in the asset');
    return { group, skins, hairs, source: 'gltf' };
  } catch (err) {
    console.warn('[face] glTF unavailable, sculpting at runtime instead:', err.message);
    return buildProcedural(profile);
  }
}

export { PROFILES };
