/**
 * symbols.js — IPA inventory, tokenizer and the 44-phoneme reference chart.
 *
 * Internal representation
 * -----------------------
 * A transcription is an ARRAY OF TOKENS, never a raw string. Tokens are:
 *   { type: 'phoneme', ipa: 'iː', ... }
 *   { type: 'stress',  ipa: 'ˈ' | 'ˌ' }
 *   { type: 'syllable', ipa: '.' }
 * Keeping the array form means the accent transforms, the renderer and the 3D
 * visualiser all agree on what a "segment" is — a string like "ˈtʃiːz" would
 * otherwise have to be re-parsed by each consumer.
 *
 * The BASE dialect is General American (rhotic, no length marks). UK/AU are
 * derived from it in accents.js.
 */

/** Multi-character IPA symbols, longest first — the tokenizer is greedy. */
const MULTI = [
  'ɑːr', 'ɔːr', 'ɪər', 'eər', 'ʊər', 'aɪər', 'aʊər',
  'tʃ', 'dʒ', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'əʊ', 'aʊ', 'ɪə', 'eə', 'ʊə', 'æɪ', 'ɑe',
  'əʉ', 'æɔ', 'ɪi', 'ʉː', 'ɔe',
  'iː', 'uː', 'ɑː', 'ɔː', 'ɜː', 'ɐː', 'aː', 'eː', 'oː',
];

const SINGLE = [
  'i', 'ɪ', 'e', 'ɛ', 'æ', 'a', 'ɑ', 'ɒ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə', 'ɜ', 'ɝ', 'ɚ', 'ɐ', 'ʉ',
  'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h',
  'm', 'n', 'ŋ', 'l', 'r', 'ɹ', 'j', 'w', 'ɾ', 'ʔ', 'x',
];

const STRESS = ['ˈ', 'ˌ'];

/** Every symbol the tokenizer understands, ordered longest-first. */
export const SYMBOLS = [...MULTI, ...SINGLE].sort((a, b) => b.length - a.length);

const VOWEL_HEADS = new Set(['i', 'ɪ', 'e', 'ɛ', 'æ', 'a', 'ɑ', 'ɒ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə', 'ɜ', 'ɝ', 'ɚ', 'ɐ', 'ʉ']);

/** True when an IPA segment is a vowel or diphthong (tested on its first char). */
export function isVowel(ipa) {
  return VOWEL_HEADS.has(ipa[0]);
}

export function isConsonant(ipa) {
  return !isVowel(ipa) && !STRESS.includes(ipa) && ipa !== '.';
}

/**
 * Fold the common typographic variants onto the symbols the tokenizer knows,
 * and strip slashes/brackets. Pasted IPA very often carries U+0261 script-g or
 * the precise U+0279 rhotic; both mean the same phoneme to us.
 */
export function normalizeIpa(input) {
  return String(input || '')
    .normalize('NFC')
    .replace(/[/[\]]/g, '')
    .replace(/\u0261/g, 'g')   // script g -> g
    .replace(/\u0279/g, 'r')   // turned r -> r
    .replace(/['\u2019]/g, '\u02C8')  // apostrophe used as primary stress
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse an IPA string into the token array described at the top of the file.
 * Unknown characters are preserved as `type:'raw'` so nothing is silently lost.
 */
export function tokenize(ipaString) {
  const out = [];
  let i = 0;
  const s = normalizeIpa(ipaString);
  outer: while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i += 1; continue; }
    if (STRESS.includes(ch)) { out.push({ type: 'stress', ipa: ch }); i += 1; continue; }
    if (ch === '.') { out.push({ type: 'syllable', ipa: '.' }); i += 1; continue; }
    for (const sym of SYMBOLS) {
      if (s.startsWith(sym, i)) {
        out.push({ type: 'phoneme', ipa: sym, vowel: isVowel(sym) });
        i += sym.length;
        continue outer;
      }
    }
    out.push({ type: 'raw', ipa: ch });
    i += 1;
  }
  return out;
}

/** Render a token array back to a display string. */
export function stringify(tokens) {
  return tokens.map((t) => t.ipa).join('');
}

/** Convenience: only the sounding segments, in order. */
export function phonemesOf(tokens) {
  return tokens.filter((t) => t.type === 'phoneme');
}

/**
 * The 44 phonemes of Standard British English, as laid out on the classic
 * wall chart. `us` gives the General-American counterpart so a click on the
 * chart can drive the same pipeline as typed text.
 */
export const CHART = {
  vowels: [
    { ipa: 'iː', us: 'i',  cls: 'long',     ex: 'sheep',  spell: ['eagle', 'field'] },
    { ipa: 'ɪ',  us: 'ɪ',  cls: 'short',    ex: 'ship',   spell: ['busy', 'started'] },
    { ipa: 'ʊ',  us: 'ʊ',  cls: 'short',    ex: 'good',   spell: ['put', 'should'] },
    { ipa: 'uː', us: 'u',  cls: 'long',     ex: 'moon',   spell: ['grew', 'through'] },
    { ipa: 'ɪə', us: 'ɪr', cls: 'diphthong', ex: 'ear',    spell: ['here', 'career'] },
    { ipa: 'eɪ', us: 'eɪ', cls: 'diphthong', ex: 'train',  spell: ['say', 'plane'] },

    { ipa: 'e',  us: 'ɛ',  cls: 'short',    ex: 'bed',    spell: ['dead', 'said'] },
    { ipa: 'ə',  us: 'ə',  cls: 'short',    ex: 'about',  spell: ['police', 'the'] },
    { ipa: 'ɜː', us: 'ɝ',  cls: 'long',     ex: 'bird',   spell: ['hurt', 'work'] },
    { ipa: 'ɔː', us: 'ɔ',  cls: 'long',     ex: 'door',   spell: ['walk', 'saw'] },
    { ipa: 'ʊə', us: 'ʊr', cls: 'diphthong', ex: 'sure',   spell: ['your', 'tourist'] },
    { ipa: 'ɔɪ', us: 'ɔɪ', cls: 'diphthong', ex: 'boy',    spell: ['point', 'oil'] },

    { ipa: 'æ',  us: 'æ',  cls: 'short',    ex: 'cat',    spell: ['apple', 'mat'] },
    { ipa: 'ʌ',  us: 'ʌ',  cls: 'short',    ex: 'up',     spell: ['money', 'cut'] },
    { ipa: 'ɑː', us: 'ɑ',  cls: 'long',     ex: 'car',    spell: ['bath', 'safari'] },
    { ipa: 'ɒ',  us: 'ɑ',  cls: 'short',    ex: 'not',    spell: ['what', 'because'] },
    { ipa: 'eə', us: 'ɛr', cls: 'diphthong', ex: 'hair',   spell: ['careful', 'there'] },
    { ipa: 'aɪ', us: 'aɪ', cls: 'diphthong', ex: 'by',     spell: ['high', 'fine'] },
    { ipa: 'əʊ', us: 'oʊ', cls: 'diphthong', ex: 'coat',   spell: ['low', 'note'] },
    { ipa: 'aʊ', us: 'aʊ', cls: 'diphthong', ex: 'now',    spell: ['our', 'house'] },
  ],
  consonants: [
    { ipa: 'p',  us: 'p',  cls: 'unvoiced', ex: 'pen',   spell: ['hopping', 'jump'] },
    { ipa: 'b',  us: 'b',  cls: 'voiced',   ex: 'ball',  spell: ['hobby', 'herb'] },
    { ipa: 't',  us: 't',  cls: 'unvoiced', ex: 'table', spell: ['little', 'watched'] },
    { ipa: 'd',  us: 'd',  cls: 'voiced',   ex: 'dog',   spell: ['added', 'played'] },
    { ipa: 'tʃ', us: 'tʃ', cls: 'unvoiced', ex: 'chips', spell: ['itch', 'picture'] },
    { ipa: 'dʒ', us: 'dʒ', cls: 'voiced',   ex: 'jam',   spell: ['danger', 'fudge'] },
    { ipa: 'k',  us: 'k',  cls: 'unvoiced', ex: 'key',   spell: ['car', 'luck'] },
    { ipa: 'g',  us: 'g',  cls: 'voiced',   ex: 'green', spell: ['hug', 'league'] },

    { ipa: 'f',  us: 'f',  cls: 'unvoiced', ex: 'fire',  spell: ['laugh', 'phone'] },
    { ipa: 'v',  us: 'v',  cls: 'voiced',   ex: 'video', spell: ['move', 'of'] },
    { ipa: 'θ',  us: 'θ',  cls: 'unvoiced', ex: 'thick', spell: ['healthy', 'teeth'] },
    { ipa: 'ð',  us: 'ð',  cls: 'voiced',   ex: 'mother', spell: ['this', 'with'] },
    { ipa: 's',  us: 's',  cls: 'unvoiced', ex: 'see',   spell: ['city', 'notice'] },
    { ipa: 'z',  us: 'z',  cls: 'voiced',   ex: 'zebra', spell: ['cosy', 'has'] },
    { ipa: 'ʃ',  us: 'ʃ',  cls: 'unvoiced', ex: 'shop',  spell: ['nation', 'special'] },
    { ipa: 'ʒ',  us: 'ʒ',  cls: 'voiced',   ex: 'television', spell: ['visual', 'leisure'] },

    { ipa: 'm',  us: 'm',  cls: 'voiced',   ex: 'man',   spell: ['tummy', 'lamb'] },
    { ipa: 'n',  us: 'n',  cls: 'voiced',   ex: 'no',    spell: ['funny', 'knife'] },
    { ipa: 'ŋ',  us: 'ŋ',  cls: 'voiced',   ex: 'sing',  spell: ['uncle', 'angry'] },
    { ipa: 'j',  us: 'j',  cls: 'voiced',   ex: 'yes',   spell: ['onion', 'view'] },
    { ipa: 'l',  us: 'l',  cls: 'voiced',   ex: 'light', spell: ['smelly', 'feel'] },
    { ipa: 'r',  us: 'r',  cls: 'voiced',   ex: 'right', spell: ['berry', 'wrong'] },
    { ipa: 'w',  us: 'w',  cls: 'voiced',   ex: 'win',   spell: ['where', 'one'] },
    { ipa: 'h',  us: 'h',  cls: 'unvoiced', ex: 'house', spell: ['hungry', 'who'] },
  ],
};

/** Flat lookup: any chart IPA (UK form) -> its chart entry. */
export const CHART_INDEX = (() => {
  const map = new Map();
  for (const row of [...CHART.vowels, ...CHART.consonants]) {
    map.set(row.ipa, row);
    if (!map.has(row.us)) map.set(row.us, row);
  }
  return map;
})();
