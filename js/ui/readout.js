/**
 * readout.js — the live articulator panel over the 3D stage.
 *
 * Shows the segment currently being articulated, a plain-English description
 * of it, and meters for the parameters actually driving the model. The meters
 * matter pedagogically: they turn "the mouth moved" into "the tongue body rose
 * to 0.9 and the velum opened".
 */

import { el, fill } from '../core/dom.js';
import { describe, REST } from '../viz/articulation.js';

/** The parameters worth showing — the full set would be noise. */
const SHOWN = [
  ['jaw', 'Jaw'],
  ['lipOpen', 'Lip aperture'],
  ['lipRound', 'Lip rounding'],
  ['tongueBodyHigh', 'Tongue height'],
  ['tongueBodyFront', 'Tongue front'],
  ['tongueTipHigh', 'Tongue tip'],
  ['velum', 'Velum (nasal)'],
  ['voice', 'Voicing'],
];

export class Readout {
  constructor(root) {
    this.root = root;
    this.meters = new Map();
    this.build();
  }

  build() {
    this.ipaNode = el('div', { class: 'readout__ipa', text: '—' });
    this.descNode = el('div', { class: 'readout__desc', text: 'Ready' });
    this.voiceNode = el('div', { class: 'voicing', dataset: { voiced: 'false' } }, ['◌ silent']);

    this.panel = el('div', { class: 'readout' }, [this.ipaNode, this.descNode, this.voiceNode]);

    this.meterWrap = el('div', { class: 'meters' }, SHOWN.map(([key, label]) => {
      const fillBar = el('div', { class: 'meter__fill' });
      const value = el('span', { class: 'meter__value', text: '0' });
      this.meters.set(key, { fill: fillBar, value });
      return el('div', { class: 'meter', dataset: { key } }, [
        el('div', { class: 'meter__label' }, [
          el('span', { text: label }),
          value,
        ]),
        el('div', { class: 'meter__track' }, [fillBar]),
      ]);
    }));

    fill(this.root, [this.meterWrap]);
  }

  /** The floating panel is mounted over the canvas, not in the meter strip. */
  get overlay() { return this.panel; }

  /**
   * @param {?object} seg pose-track segment, or null for rest
   */
  show(seg) {
    if (!seg) {
      this.ipaNode.textContent = '—';
      this.descNode.textContent = 'At rest';
      this.setVoiced(false);
      this.setParams(REST);
      return;
    }
    this.ipaNode.textContent = seg.ipa;
    const d = describe(seg.ipa);
    this.descNode.textContent = d ? d.summary : seg.kind;
    this.setVoiced(seg.voiced);
    this.setParams(seg.params);
  }

  setVoiced(voiced) {
    this.voiceNode.dataset.voiced = String(!!voiced);
    this.voiceNode.textContent = voiced ? '♪ voiced' : '◌ voiceless';
  }

  setParams(params) {
    for (const [key, { fill, value }] of this.meters) {
      const v = Math.round((params[key] ?? 0) * 100);
      fill.style.width = `${v}%`;
      value.textContent = String(v);
    }
  }
}

export default Readout;
