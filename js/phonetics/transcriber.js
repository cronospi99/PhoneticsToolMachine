/**
 * transcriber.js — the public face of the phonetic engine.
 *
 * Everything the UI and the 3D visualiser need comes from here:
 *
 *   transcribe('the amazing spider')
 *     -> { tokens: [ {kind:'word', spelling, base, estimated, accents:{us,uk,au}}, … ] }
 *
 * Each accent entry holds both the display string and the token array, so the
 * visualiser can walk segments without re-parsing text.
 */

import { lookup } from './lexicon.js';
import { graphemesToPhonemes } from './g2p.js';
import { toAccent, ACCENTS } from './accents.js';
import { stringify, phonemesOf, normalizeIpa } from './symbols.js';

const ACCENT_IDS = ACCENTS.map((a) => a.id);

/** Split input into words and the punctuation/whitespace between them. */
function segment(text) {
  const parts = [];
  const re = /([A-Za-z][A-Za-z'’-]*)|([^A-Za-z]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) parts.push({ kind: 'word', spelling: m[1] });
    else parts.push({ kind: 'gap', text: m[2] });
  }
  return parts;
}

/**
 * Base-dialect IPA for one word, plus whether it was guessed.
 * Hyphenated compounds are transcribed part by part.
 */
export function baseFor(spelling) {
  const clean = spelling.toLowerCase().replace(/[’]/g, "'");
  const hit = lookup(clean);
  if (hit) return { base: hit, estimated: false };

  if (clean.includes('-')) {
    const pieces = clean.split('-').filter(Boolean).map(baseFor);
    return {
      base: pieces.map((p) => p.base).join(''),
      estimated: pieces.some((p) => p.estimated),
    };
  }

  // possessives and plurals of known words: spider's -> spider + /z/
  const apos = clean.match(/^(.+?)'s$/);
  if (apos) {
    const stem = lookup(apos[1]);
    if (stem) {
      const voiceless = /[ptkfθ]$/.test(stem);
      return { base: stem + (voiceless ? 's' : 'z'), estimated: false };
    }
  }

  return { base: graphemesToPhonemes(clean), estimated: true };
}

/**
 * Transcribe a word into every accent.
 * @param {string} spelling
 * @returns {{spelling:string, base:string, estimated:boolean, accents:object}}
 */
export function transcribeWord(spelling) {
  const { base, estimated } = baseFor(spelling);
  const accents = {};
  for (const id of ACCENT_IDS) {
    const tokens = toAccent(base, id, spelling);
    accents[id] = { tokens, ipa: stringify(tokens), phonemes: phonemesOf(tokens) };
  }
  return { spelling, base, estimated, accents };
}

/**
 * Transcribe a whole sentence or paragraph.
 * @param {string} text
 * @returns {{tokens:Array, wordCount:number, estimatedCount:number}}
 */
export function transcribe(text) {
  const tokens = [];
  let wordCount = 0;
  let estimatedCount = 0;

  for (const part of segment(String(text || ''))) {
    if (part.kind === 'gap') {
      tokens.push({ kind: 'gap', text: part.text });
      continue;
    }
    const word = transcribeWord(part.spelling);
    if (!word.base) {
      tokens.push({ kind: 'gap', text: part.spelling });
      continue;
    }
    wordCount += 1;
    if (word.estimated) estimatedCount += 1;
    tokens.push({ kind: 'word', ...word });
  }
  return { tokens, wordCount, estimatedCount };
}

/** Whole-line IPA for one accent, e.g. for the copy-to-clipboard button. */
export function lineFor(result, accentId) {
  return result.tokens
    .map((t) => (t.kind === 'word' ? t.accents[accentId].ipa : t.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flatten a transcription into the phoneme stream the 3D visualiser animates,
 * keeping a back-reference to the word each segment came from.
 */
export function phonemeStream(result, accentId) {
  const stream = [];
  result.tokens.forEach((t, wordIndex) => {
    if (t.kind !== 'word') return;
    for (const p of t.accents[accentId].phonemes) {
      stream.push({ ipa: p.ipa, vowel: p.vowel, wordIndex, spelling: t.spelling });
    }
  });
  return stream;
}

/** Accept IPA typed directly by the user (chart clicks, paste-in). */
export function fromIpa(ipaString) {
  return normalizeIpa(ipaString);
}

export { ACCENTS };
