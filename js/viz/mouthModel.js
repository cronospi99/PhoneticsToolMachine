/**
 * mouthModel.js — assembles the anatomy into one rig and applies a parameter
 * set to it.
 *
 * This is the only module that knows how an articulator parameter becomes a
 * transform. Everything above it speaks in parameters; everything below it is
 * geometry. Adding an articulator means adding a mesh here and a key in
 * articulation.js — nothing else changes.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { Tongue } from './anatomy/tongue.js';
import { Lips } from './anatomy/lips.js';
import { buildArch } from './anatomy/teeth.js';
import {
  buildPalate, buildVelum, buildPharynx, buildVocalFolds, buildFloor,
} from './anatomy/oralCavity.js';
import { buildFaceShell } from './anatomy/faceShell.js';
import { REST, resolveParams } from './articulation.js';

/** Jaw hinge, roughly at the temporomandibular joint. */
const JAW_PIVOT = new THREE.Vector3(0, 1.15, -4.35);
const JAW_MAX_ROTATION = 0.30; // radians at jaw = 1

/** Gap below which the constriction marker starts to show. */
const CONTACT_VISIBLE = 0.45;

function materials() {
  const tissue = (color, opts = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.62, metalness: 0.02, ...opts,
  });

  return {
    tongue: tissue(0xd2544f, { roughness: 0.48 }),
    lipUpper: tissue(0xc4413f, { roughness: 0.40 }),
    lipLower: tissue(0xcf4a45, { roughness: 0.40 }),
    teeth: tissue(0xfbf7ee, { roughness: 0.24, metalness: 0.04 }),
    palate: tissue(0xe7a19c, { roughness: 0.70, side: THREE.DoubleSide }),
    velum: tissue(0xdb8f8c, { roughness: 0.72, side: THREE.DoubleSide }),
    pharynx: tissue(0xa8524f, { roughness: 0.80, side: THREE.DoubleSide }),
    folds: tissue(0xef7b74, { roughness: 0.45, emissive: 0x3a0d0b }),
    floor: tissue(0xc86560, { roughness: 0.70 }),
    // Plain transparency reads far more cleanly here than physical
    // transmission, which muddies the articulators behind it.
    skin: new THREE.MeshStandardMaterial({
      color: 0xf0c3a4,
      roughness: 0.68,
      metalness: 0,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };
}

export class MouthModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'mouth-model';
    this.mat = materials();
    this.params = { ...REST };
    this.meta = null;
    this.phase = 0;

    // ── skull-fixed structures ──
    this.palate = buildPalate(this.mat.palate);
    this.velum = buildVelum(this.mat.velum);
    this.pharynx = buildPharynx(this.mat.pharynx);
    this.folds = buildVocalFolds(this.mat.folds);
    this.upperTeeth = buildArch(this.mat.teeth, true);
    this.upperLip = new Lips(this.mat.lipUpper, true);
    this.faceShell = buildFaceShell(this.mat.skin);

    this.group.add(
      this.palate, this.velum, this.pharynx, this.folds,
      this.upperTeeth, this.upperLip.mesh, this.faceShell,
    );

    // ── jaw-mounted structures ──
    // The lower teeth, lower lip, floor and tongue all ride the mandible, so
    // opening the jaw moves them together the way a real one does.
    this.jaw = new THREE.Group();
    this.jaw.name = 'mandible';
    this.jaw.position.copy(JAW_PIVOT);

    this.jawContents = new THREE.Group();
    this.jawContents.position.copy(JAW_PIVOT).multiplyScalar(-1);
    this.jaw.add(this.jawContents);

    this.lowerTeeth = buildArch(this.mat.teeth, false);
    this.lowerLip = new Lips(this.mat.lipLower, false);
    this.tongue = new Tongue(this.mat.tongue);
    this.floor = buildFloor(this.mat.floor);

    this.jawContents.add(
      this.lowerTeeth, this.lowerLip.mesh, this.tongue.mesh, this.floor,
    );
    this.group.add(this.jaw);

    // contact marker: lights up where an articulator meets the roof
    // An annotation, not anatomy: it draws on top of everything so the point of
    // constriction is never hidden behind the palate or the cheek.
    const markerGeo = new THREE.SphereGeometry(0.32, 16, 12);
    this.contact = new THREE.Mesh(
      markerGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfedd00,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    this.contact.name = 'contact-marker';
    this.contact.renderOrder = 999;
    this.group.add(this.contact);

    this.apply(this.params);
  }

  /**
   * Pose the whole rig.
   * @param {object} rawParams complete or partial articulator parameters
   */
  apply(rawParams, meta = null) {
    const p = resolveParams({ ...this.params, ...rawParams });
    this.params = p;
    if (meta) this.meta = meta;

    // Jaw first — everything mounted on it inherits the rotation.
    this.jaw.rotation.x = -p.jaw * JAW_MAX_ROTATION;

    this.tongue.update(p);
    this.upperLip.update(p);
    this.lowerLip.update(p);
    this.velum.userData.setOpen(p.velum);
    this.folds.userData.setVoicing(p.voice, this.phase);

    // Upper teeth are revealed by retracting the upper lip.
    this.upperLip.mesh.position.y = p.teeth * 0.16;

    this.updateContact(p);
  }

  /**
   * Vowels have no constriction worth marking — the tract is open by
   * definition, and a marker floating over an open mouth reads as a closure
   * that is not there.
   */
  get marksConstriction() {
    return !this.meta || this.meta.kind === 'consonant';
  }

  /**
   * Highlight the point of maximum constriction. The marker is what turns an
   * abstract parameter set into "the tongue is touching HERE".
   */
  updateContact(p) {
    const near = this.tongue.closestApproach();
    const jawDrop = -p.jaw * JAW_MAX_ROTATION;
    // the tongue rides the jaw, so its world height falls as the jaw opens
    const worldY = near.point[1] + Math.sin(jawDrop) * (near.point[2] - JAW_PIVOT.z);

    let show = 0;
    if (!this.marksConstriction) {
      this.contact.visible = false;
      this.contact.material.opacity = 0;
      this.constrictionGap = near.gap;
      return;
    }
    if (p.lipOpen < 0.05) {
      // bilabial closure — the constriction is at the lips, not the tongue
      this.contact.position.set(0, 0.05, 4.05);
      show = 1;
    } else if (p.lipTuck > 0.5) {
      // labiodental: lower lip against the upper incisors
      this.contact.position.set(0, -0.15, 3.95);
      show = 0.9;
    } else if (p.teeth > 0.8 && p.tongueTipFront > 0.9) {
      // interdental: the constriction is the tongue against the teeth, which
      // sits in front of the palate and so never shows up as a small roof gap
      this.contact.position.set(0, 0.05, 3.30);
      show = 0.9;
    } else if (near.gap < CONTACT_VISIBLE) {
      this.contact.position.set(near.point[0] * 0.4, worldY + 0.14, near.point[2]);
      show = 1 - near.gap / CONTACT_VISIBLE;
    }
    this.contact.material.opacity = Math.min(1, show) * 0.75;
    this.contact.visible = show > 0.02;
    this.constrictionGap = near.gap;
  }

  /** Advance time-based motion (vocal fold flutter). */
  tick(dt) {
    this.phase += dt * 34;
    this.folds.userData.setVoicing(this.params.voice, this.phase);
  }

  /** Toggle the translucent skin between glass, solid-ish and hidden. */
  setSkinMode(mode) {
    const s = this.mat.skin;
    if (mode === 'hidden') {
      this.faceShell.visible = false;
      return;
    }
    this.faceShell.visible = true;
    s.opacity = mode === 'solid' ? 0.62 : 0.26;
    s.needsUpdate = true;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  }
}

export default MouthModel;
