/**
 * transcriptView.js — the three accent rows.
 *
 * Renders one row per accent, each word a clickable target, each phoneme its
 * own span so the visualiser can highlight the exact segment being articulated.
 */

import { el, fill } from '../core/dom.js';
import { ACCENTS } from '../phonetics/accents.js';
import bus from '../core/eventBus.js';

export class TranscriptView {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.result = null;
    this.rows = new Map();
    this.segIndex = new Map();   // accent -> flat array of phoneme spans
    this.build();
  }

  build() {
    const rows = ACCENTS.map((a) => {
      const line = el('div', { class: 'ipa-line', id: `ipa-${a.id}` });
      const row = el('div', {
        class: 'accent-row',
        dataset: { accent: a.id },
      }, [
        el('button', {
          class: 'accent-tag',
          type: 'button',
          title: `Hear the whole line in ${a.name}`,
          'aria-label': `Play line in ${a.name}`,
          onclick: () => bus.emit('speak:line', { accent: a.id }),
        }, [`${a.flag} ${a.label}`]),
        line,
        el('div', { class: 'row-actions' }, [
          el('button', {
            class: 'btn btn--sm btn--ghost',
            type: 'button',
            title: 'Animate the mouth through this line',
            onclick: () => bus.emit('animate:line', { accent: a.id }),
          }, ['▶ Mouth']),
          el('button', {
            class: 'btn btn--sm btn--ghost',
            type: 'button',
            title: 'Copy this transcription',
            onclick: (e) => this.copy(a.id, e.currentTarget),
          }, ['Copy']),
        ]),
      ]);
      this.rows.set(a.id, { row, line });
      return row;
    });

    fill(this.root, rows);
  }

  /**
   * @param {object} result output of transcriber.transcribe()
   */
  render(result) {
    this.result = result;
    this.segIndex.clear();

    for (const a of ACCENTS) {
      const { line } = this.rows.get(a.id);
      const segs = [];

      if (!result || !result.wordCount) {
        fill(line, [el('span', { class: 'ipa-empty', text: 'Type something above to see it in IPA.' })]);
        this.segIndex.set(a.id, segs);
        continue;
      }

      const nodes = [];
      result.tokens.forEach((tok, wordIndex) => {
        if (tok.kind !== 'word') {
          const t = tok.text.replace(/\s+/g, ' ');
          if (t.trim()) nodes.push(el('span', { class: 'ipa-punct', text: t }));
          return;
        }
        const acc = tok.accents[a.id];
        const spans = acc.tokens.map((seg) => {
          const span = el('span', {
            class: 'ipa-seg',
            dataset: { ipa: seg.ipa },
            text: seg.ipa,
          });
          if (seg.type === 'phoneme') segs.push(span);
          return span;
        });

        const word = el('span', {
          class: `ipa-word${tok.estimated ? ' is-estimated' : ''}`,
          role: 'button',
          tabindex: '0',
          dataset: { word: String(wordIndex) },
          title: tok.estimated
            ? `"${tok.spelling}" — estimated from spelling rules`
            : `"${tok.spelling}" — click to hear and animate`,
          onclick: () => bus.emit('word:selected', { wordIndex, accent: a.id }),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              bus.emit('word:selected', { wordIndex, accent: a.id });
            }
          },
        }, spans);
        nodes.push(word);
      });

      fill(line, nodes);
      this.segIndex.set(a.id, segs);
    }
  }

  /** Mark one accent row as the active one. */
  setActiveAccent(accentId) {
    for (const [id, { row }] of this.rows) {
      row.classList.toggle('is-active', id === accentId);
    }
  }

  /** Highlight the phoneme span at `index` for `accentId`. */
  highlightSegment(accentId, index) {
    for (const [id, segs] of this.segIndex) {
      segs.forEach((s, i) => {
        s.classList.toggle('is-current', id === accentId && i === index);
      });
    }
  }

  clearHighlight() {
    for (const segs of this.segIndex.values()) {
      segs.forEach((s) => s.classList.remove('is-current'));
    }
    for (const { line } of this.rows.values()) {
      [...line.querySelectorAll('.is-speaking')].forEach((w) => w.classList.remove('is-speaking'));
    }
  }

  markWordSpeaking(accentId, wordIndex) {
    this.clearHighlight();
    const { line } = this.rows.get(accentId) || {};
    if (!line) return;
    line.querySelector(`.ipa-word[data-word="${wordIndex}"]`)?.classList.add('is-speaking');
  }

  async copy(accentId, button) {
    const text = this.rows.get(accentId).line.textContent.trim();
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied!';
    } catch {
      button.textContent = 'Ctrl+C';
    }
    setTimeout(() => { button.textContent = label; }, 1400);
  }
}

export default TranscriptView;
