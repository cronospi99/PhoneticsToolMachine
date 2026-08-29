/**
 * accents.js — derive US / UK / AU transcriptions from the General American base.
 *
 * The lexicon and the rule engine both emit General American (rhotic, /ɑ/ vs
 * /ɔ/ kept apart, no length marks). Everything else is derived here, so there
 * is exactly one place to fix when a mapping is wrong.
 *
 *   US  General American   — base, plus intervocalic /t/ flapping
 *   UK  Received Pronunciation — non-rhotic, BATH and CLOTH splits, yod kept
 *   AU  General Australian  — non-rhotic like RP, then its own vowel shifts
 *
 * Because UK and AU share the non-rhotic machinery, that runs once and each
 * accent supplies only its vowel realisations.
 *
 * These are broad transcriptions of prestige varieties, not a claim that every
 * speaker in a country talks this way.
 */

import { tokenize, isVowel } from './symbols.js';

export const ACCENTS = [
  { id: 'us', label: 'US', name: 'General American', flag: '🇺🇸', lang: 'en-US' },
  { id: 'uk', label: 'UK', name: 'Received Pronunciation', flag: '🇬🇧', lang: 'en-GB' },
  { id: 'au', label: 'AU', name: 'General Australian', flag: '🇦🇺', lang: 'en-AU' },
];

/* ── lexical sets that spelling alone cannot predict ────────────────────── */

/** GA /ɑ/ that is PALM, not LOT — stays long and back in RP/AU. */
const PALM_WORDS = new Set([
  'father', 'rather', 'calm', 'palm', 'balm', 'psalm', 'spa', 'bra', 'ma', 'pa',
  'drama', 'llama', 'banana', 'tomato', 'safari', 'salami', 'avocado', 'lager',
  'plaza', 'sonata', 'pyjamas', 'pajamas', 'garage', 'mirage', 'macho', 'taco',
]);

/** BATH words whose trigger is a nasal cluster — RP only, AU keeps /æ/. */
const BATH_NASAL_WORDS = new Set([
  'dance', 'chance', 'france', 'advance', 'answer', 'plant', 'grant', 'slant',
  'command', 'demand', 'example', 'sample', 'branch', 'aunt', 'cant', "can't",
  'advantage', 'rather',
]);

/** Look like BATH by the fricative rule, but are not. */
const BATH_EXCEPTIONS = new Set([
  'mass', 'gas', 'lass', 'crass', 'ass', 'bass', 'mascot', 'massive', 'gasp',
  'math', 'maths', 'ambassador', 'asset', 'cassette', 'classic', 'passage',
]);

/** Consonants after which a BATH /æ/ lengthens (fricative rule). */
const BATH_TRIGGER = new Set(['f', 'θ', 's']);

/** GA /ɔ/ before these is CLOTH, which RP renders /ɒ/ (dog, off, long, cross). */
const CLOTH_TRIGGER = new Set(['f', 'θ', 's', 'ŋ', 'g']);

/** Coronals that take a yod before /uː/ in RP and AU (new, tune, duke). */
const YOD_CONSONANTS = new Set(['t', 'd', 'n', 'θ', 's', 'z', 'l']);

/* ── vowel realisations per accent ──────────────────────────────────────── */

/** RP: mostly length marks; DRESS is written /e/. */
const UK_VOWELS = {
  i: 'iː', u: 'uː', ɛ: 'e', oʊ: 'əʊ',
};

/**
 * General Australian. Includes the non-rhotic nuclei produced upstream, since
 * AU realises START/NORTH/SQUARE differently from RP.
 */
const AU_VOWELS = {
  i: 'ɪi', u: 'ʉː', ɛ: 'e', ʌ: 'ɐ',
  oʊ: 'əʉ', eɪ: 'æɪ', aɪ: 'ɑe', ɔɪ: 'oɪ', aʊ: 'æɔ',
  // nuclei created by the non-rhotic pass
  'ɑː': 'ɐː', 'ɔː': 'oː', 'ɒ': 'ɔ', 'eə': 'eː', 'aɪə': 'ɑeə', 'aʊə': 'æɔə',
};

const VOWEL_MAP = { us: {}, uk: UK_VOWELS, au: AU_VOWELS };

/* ── transforms ─────────────────────────────────────────────────────────── */

const ph = (ipa) => ({ type: 'phoneme', ipa, vowel: isVowel(ipa) });

/** Is token i a vowel we can attach a following /r/ to? */
function nextIsVowel(toks, i) {
  for (let j = i + 1; j < toks.length; j += 1) {
    if (toks[j].type === 'stress' || toks[j].type === 'syllable') continue;
    return toks[j].vowel === true;
  }
  return false;
}

/** Vowel + coda /r/ pairs, written in RP notation. AU remaps them afterwards. */
const RHOTIC_PAIRS = {
  'ɑ+r': 'ɑː', 'ɔ+r': 'ɔː', 'ɪ+r': 'ɪə', 'ɛ+r': 'eə', 'ʊ+r': 'ʊə',
  'u+r': 'ʊə', 'ɝ+r': 'ɜː', 'aɪ+r': 'aɪə', 'aʊ+r': 'aʊə', 'oʊ+r': 'ɔː',
  'æ+r': 'ɑː', 'ʌ+r': 'ɜː',
};

/**
 * Collapse rhotic nuclei and delete coda /r/. A /r/ that still has a vowel
 * after it (very, grass, hero) is kept — RP and AU are non-rhotic, not r-less.
 */
function nonRhotic(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.type !== 'phoneme') { out.push(t); continue; }

    // ɝ / ɚ are r-coloured on their own
    if (t.ipa === 'ɝ') { out.push(ph('ɜː')); continue; }
    if (t.ipa === 'ɚ') { out.push(ph('ə')); continue; }

    if (t.vowel) {
      const nxt = toks[i + 1];
      const isCodaR = nxt && nxt.type === 'phoneme' && (nxt.ipa === 'r' || nxt.ipa === 'ɚ');
      if (isCodaR && !nextIsVowel(toks, i + 1)) {
        const merged = RHOTIC_PAIRS[`${t.ipa}+r`];
        if (merged) { out.push(ph(merged)); i += 1; continue; }
      }
      // vowel + ɚ across a syllable (fire, hour) even when a vowel follows
      if (nxt && nxt.type === 'phoneme' && nxt.ipa === 'ɚ' && RHOTIC_PAIRS[`${t.ipa}+r`]) {
        out.push(ph(RHOTIC_PAIRS[`${t.ipa}+r`]));
        i += 1;
        continue;
      }
      out.push(t);
      continue;
    }

    // a stray coda /r/ (no vowel following) simply goes
    if (t.ipa === 'r' && !nextIsVowel(toks, i)) continue;
    out.push(t);
  }
  return out;
}

/** RP/AU BATH lengthening: /æ/ before a voiceless fricative in the coda. */
function bathSplit(toks, word, accent) {
  if (BATH_EXCEPTIONS.has(word)) return toks;
  const nasal = accent === 'uk' && BATH_NASAL_WORDS.has(word);
  return toks.map((t, i) => {
    if (t.type !== 'phoneme' || t.ipa !== 'æ') return t;
    if (nasal) return ph('ɑː');
    const nxt = toks[i + 1];
    if (!nxt || nxt.type !== 'phoneme' || !BATH_TRIGGER.has(nxt.ipa)) return t;
    // must be a coda: the fricative is followed by a consonant or the word end
    const after = toks[i + 2];
    if (after && after.type === 'phoneme' && after.vowel) return t;
    return ph('ɑː');
  });
}

/** RP CLOTH/THOUGHT split on GA /ɔ/, and LOT unrounding on GA /ɑ/. */
function lotClothSplit(toks, word) {
  return toks.map((t, i) => {
    if (t.type !== 'phoneme') return t;
    if (t.ipa === 'ɔ') {
      const nxt = toks[i + 1];
      const cloth = nxt && nxt.type === 'phoneme' && CLOTH_TRIGGER.has(nxt.ipa);
      return ph(cloth ? 'ɒ' : 'ɔː');
    }
    if (t.ipa === 'ɑ') return ph(PALM_WORDS.has(word) ? 'ɑː' : 'ɒ');
    return t;
  });
}

/**
 * Restore the yod GA drops after coronals: new, tune, duke, student.
 * Spelling decides — GA /nuː/ from "new" takes a yod, from "noon" it does not.
 */
function yodRestore(toks, word) {
  if (!/[tdnszl](u|ew|eu)/i.test(word)) return toks;
  const out = [];
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    const nxt = toks[i + 1];
    out.push(t);
    const isTrigger = t.type === 'phoneme' && YOD_CONSONANTS.has(t.ipa);
    const beforeU = nxt && nxt.type === 'phoneme' && (nxt.ipa === 'u' || nxt.ipa === 'uː');
    if (isTrigger && beforeU) out.push(ph('j'));
  }
  return out;
}

/** GA intervocalic /t/ (and /nt/) becomes a tap: water, better, city. */
function flapping(toks) {
  return toks.map((t, i) => {
    if (t.type !== 'phoneme' || t.ipa !== 't') return t;
    const prev = toks[i - 1];
    if (!prev || prev.type !== 'phoneme' || !prev.vowel) return t;
    if (!nextIsVowel(toks, i)) return t;
    // only after a stressed vowel — "attack" keeps its /t/
    const nxt = toks[i + 1];
    if (nxt && nxt.type === 'stress') return t;
    return ph('ɾ');
  });
}

/**
 * Apply the accent's vowel realisation table.
 *
 * happY-tensing is the one exception: RP's word-final unstressed /i/ stays
 * short (very = ˈveri, not ˈveriː), while a monosyllable's /i/ is FLEECE
 * (he = hiː). AU takes the regular /ɪi/ there, so only RP needs the guard.
 */
function realiseVowels(toks, accent) {
  const map = VOWEL_MAP[accent] || {};
  const vowels = toks.filter((t) => t.type === 'phoneme' && t.vowel);
  const lastPhonemeIdx = toks.reduce((acc, t, i) => (t.type === 'phoneme' ? i : acc), -1);
  const polysyllabic = vowels.length > 1;

  return toks.map((t, i) => {
    if (t.type !== 'phoneme') return t;
    if (accent === 'uk' && t.ipa === 'i' && i === lastPhonemeIdx && polysyllabic) return t;
    const to = map[t.ipa];
    return to ? ph(to) : t;
  });
}

/**
 * Convert a base (General American) IPA string into one accent.
 *
 * @param {string} baseIpa  IPA in the base dialect
 * @param {'us'|'uk'|'au'} accent
 * @param {string} [word]   original spelling — needed for the lexical splits
 * @returns {Array<object>} token array (see symbols.js)
 */
export function toAccent(baseIpa, accent, word = '') {
  let toks = tokenize(baseIpa);
  const w = String(word || '').toLowerCase();

  if (accent === 'us') return flapping(toks);

  toks = nonRhotic(toks);
  toks = bathSplit(toks, w, accent);
  toks = lotClothSplit(toks, w);
  toks = yodRestore(toks, w);
  toks = realiseVowels(toks, accent);
  return toks;
}

export default toAccent;
