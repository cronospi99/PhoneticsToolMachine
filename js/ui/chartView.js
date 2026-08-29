/**
 * chartView.js — the interactive 44-phoneme chart.
 *
 * Same layout and colour coding as the classic wall chart, but every cell is a
 * button: clicking plays the sound and poses the 3D mouth.
 */

import { el, fill } from '../core/dom.js';
import { CHART } from '../phonetics/symbols.js';
import bus from '../core/eventBus.js';

const SECTIONS = [
  { key: 'vowels', title: 'Vowels', rows: CHART.vowels },
  { key: 'consonants', title: 'Consonants', rows: CHART.consonants },
];

export class ChartView {
  constructor(root) {
    this.root = root;
    this.chips = new Map();
    this.build();
  }

  build() {
    const sections = SECTIONS.map((section) => {
      const grid = el('div', { class: 'chart-grid' },
        section.rows.map((row) => this.chip(row)));
      return el('section', { class: 'chart-section' }, [
        el('h3', { class: 'chart-heading', text: section.title }),
        grid,
      ]);
    });
    fill(this.root, sections);
  }

  chip(row) {
    const node = el('button', {
      type: 'button',
      class: 'chip',
      dataset: { cls: row.cls, ipa: row.ipa },
      'aria-label': `${row.ipa} as in ${row.ex}. ${row.cls}.`,
      title: `/${row.ipa}/ — ${row.cls}. Also spelled: ${row.spell.join(', ')}`,
      onclick: () => bus.emit('phoneme:selected', { ipa: row.ipa, entry: row }),
    }, [
      el('span', { class: 'chip__ipa', text: row.ipa }),
      el('span', { class: 'chip__ex', text: row.ex }),
      el('span', { class: 'chip__spell', text: row.spell.join(' · ') }),
    ]);
    this.chips.set(row.ipa, node);
    return node;
  }

  /** Light up a chip — used both by clicks and by playback. */
  setActive(ipa) {
    for (const [key, node] of this.chips) {
      node.classList.toggle('is-active', key === ipa);
    }
  }

  clearActive() {
    for (const node of this.chips.values()) node.classList.remove('is-active');
  }
}

export default ChartView;
