/**
 * build-head.mjs — bake the head into glTF binary assets.
 *
 *   node tools/build-head.mjs
 *
 * Writes assets/head-male.glb and assets/head-female.glb. The app loads these
 * with GLTFLoader rather than sculpting the head at start-up, which means:
 *
 *   - the head is a real asset, not a runtime side effect;
 *   - it can be tessellated far more finely than is sensible to compute in a
 *     page load, because the cost is paid once, here;
 *   - and anyone can drop a scanned or hand-sculpted head in its place, so
 *     long as it keeps the same coordinate frame and mesh names.
 *
 * The frame is the one in head.js: +y up, +z out through the face, the teeth
 * at y = 0 and the lip plane near z = 4.2.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFExporter } from '../vendor/three/jsm/GLTFExporter.js';
import { buildHeadGeometry, buildEars, buildNeck, PROFILES } from '../js/viz/anatomy/head.js';
import { buildHair } from '../js/viz/anatomy/hair.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * GLTFExporter is written for the browser and reads its assembled Blob back
 * through a FileReader. Node has Blob but not FileReader, and the exporter
 * only ever uses readAsArrayBuffer, so a few lines cover it. Textures would
 * need a canvas too — this model has none, being entirely vertex-coloured.
 */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      }, (err) => {
        this.error = err;
        this.onerror?.(err);
      });
    }
  };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets');

/** Finer than the runtime fallback: this cost is paid once, at build time. */
const SEGMENTS = { w: 192, h: 144 };

function buildScene(profile) {
  const group = new THREE.Group();
  group.name = 'face';

  const skin = new THREE.MeshStandardMaterial({
    name: 'skin',
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
  });
  const skinPlain = new THREE.MeshStandardMaterial({
    name: 'skin-plain',
    color: new THREE.Color(...profile.skinTone),
    roughness: 0.62,
    metalness: 0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    name: 'hair',
    color: profile.id === 'female' ? 0x3a2418 : 0x2b1d16,
    roughness: 0.74,
    metalness: 0.08,
  });

  const head = new THREE.Mesh(buildHeadGeometry(profile, SEGMENTS), skin);
  head.name = 'head';
  group.add(head);

  const ears = buildEars(skinPlain);
  ears.name = 'ears';
  group.add(ears);

  const neck = buildNeck(skinPlain);
  neck.name = 'neck';
  group.add(neck);

  const hair = buildHair(hairMat, profile);
  hair.name = 'hair';
  group.add(hair);

  return group;
}

function writeGlb(buffer, file) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, Buffer.from(buffer));
  return fs.statSync(file).size;
}

const exporter = new GLTFExporter();

for (const profile of Object.values(PROFILES)) {
  const scene = buildScene(profile);
  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: false });
  });
  const file = path.join(OUT_DIR, `head-${profile.id}.glb`);
  const size = writeGlb(buffer, file);
  let tris = 0;
  scene.traverse((o) => { if (o.geometry?.index) tris += o.geometry.index.count / 3; });
  console.log(`${path.relative(ROOT, file)}  ${(size / 1024).toFixed(0)} KB  ${tris.toLocaleString()} triangles`);
}
