/**
 * g2p.js — rule-based grapheme-to-phoneme fallback.
 *
 * English spelling is only ~75% regular, so this engine is an approximation:
 * it exists so that a word missing from the lexicon still produces something
 * sensible and animatable rather than nothing at all. Results carry
 * `estimated: true` upstream so the UI can say so honestly.
 *
 * Pipeline:  normalise -> affix strip -> left-to-right longest-match rules
 *            -> syllabify -> assign stress -> reduce unstressed vowels
 *
 * Rule format: [pattern, phonemes, options]
 *   pattern  — literal grapheme string matched at the cursor
 *   phonemes — IPA string it emits (may be '' for silent letters)
 *   options  — { before, notBefore, after, notAfter, start, end, stressed }
 *              `before`/`after` are regexes tested against the remaining and
 *              consumed spelling respectively.
 */

import { tokenize } from './symbols.js';

const V = '[aeiouy]';
const C = '[bcdfghjklmnpqrstvwxyz]';

/**
 * Ordered rules. Within the engine the FIRST rule whose pattern matches at the
 * cursor and whose context holds wins, so longer/more specific patterns are
 * listed before their prefixes.
 */
const RULES = [
  // ── multi-letter consonant graphemes ──────────────────────────────────
  ['tch', 'tʃ'], ['dge', 'dʒ'], ['sch', 'sk'],
  ['cc', 'ks', { before: '^[eiy]' }],
  ['bb', 'b'], ['cc', 'k'], ['dd', 'd'], ['ff', 'f'], ['gg', 'g'], ['kk', 'k'],
  ['ll', 'l'], ['mm', 'm'], ['nn', 'n'], ['pp', 'p'], ['rr', 'r'], ['ss', 's'],
  ['tt', 't'], ['zz', 'z'],
  ['ealth', 'ɛlθ'],
  ['ation', 'eɪʃən'], ['otion', 'oʊʃən'], ['ution', 'uʃən'],
  ['ition', 'ɪʃən'], ['ision', 'ɪʒən'], ['usion', 'uʒən'],
  ['sion', 'ʒən', { after: `${V}$` }], ['sion', 'ʃən'],
  ['tion', 'ʃən'], ['cion', 'ʃən'], ['cial', 'ʃəl'], ['tial', 'ʃəl'],
  ['cious', 'ʃəs'], ['tious', 'ʃəs'], ['geous', 'dʒəs'], ['gious', 'dʒəs'],
  ['ture', 'tʃɚ'], ['sure', 'ʒɚ', { after: `${V}$` }], ['sure', 'ʃɚ'],
  ['ough', 'ʌf', { after: '^(t|r|en)$' }], ['ough', 'oʊ'],
  ['augh', 'æf', { after: '^l$' }], ['augh', 'ɔ'],
  ['eigh', 'eɪ'], ['igh', 'aɪ'],
  ['ch', 'k', { after: '^(s|te|me|ar)' }], ['ch', 'tʃ'],
  ['sh', 'ʃ'], ['ph', 'f'], ['gh', '', { after: `${V}$` }], ['gh', 'g'],
  ['th', 'ð', { after: `${V}$`, before: '^(er|ers|ering|e|es|ing)$' }],
  ['th', 'θ'],
  ['ck', 'k'],
  ['ange', 'eɪndʒ', { end: true }], ['inge', 'ɪndʒ', { end: true }],
  ['onge', 'ʌndʒ', { end: true }], ['nge', 'ndʒ', { end: true }],
  ['ng', 'ŋ', { end: true }], ['ng', 'ŋg'],
  ['qu', 'kw'], ['wh', 'w'], ['wr', 'r', { start: true }],
  ['kn', 'n', { start: true }], ['gn', 'n', { start: true }],
  ['ps', 's', { start: true }], ['rh', 'r', { start: true }],
  ['mb', 'm', { end: true }], ['mn', 'm', { end: true }],
  ['x', 'gz', { start: false, before: `^${V}`, after: '^e$' }], ['x', 'ks'],

  // ── syllabic -le (table, little, apple) ───────────────────────────────
  ['able', 'əbəl', { end: true, after: '^.{3,}$' }],
  ['ible', 'əbəl', { end: true, after: '^.{3,}$' }],
  ['stle', 'səl', { end: true }], ['le', 'əl', { end: true, after: `${C}$` }],

  // ── r-coloured vowels (base dialect keeps the /r/) ────────────────────
  ['air', 'ɛr'], ['are', 'ɛr', { end: true }], ['ear', 'ɪr'],
  ['eer', 'ɪr'], ['ere', 'ɪr', { end: true }], ['ier', 'ɪr', { end: true }],
  ['ire', 'aɪɚ', { end: true }], ['ure', 'jʊr', { end: true }],
  ['oor', 'ʊr'], ['oar', 'ɔr'], ['our', 'aʊr'], ['ore', 'ɔr', { end: true }],
  ['ar', 'ɑr', { notBefore: '^r' }], ['or', 'ɔr', { notBefore: '^r' }], ['er', 'ɚ', { notBefore: '^r' }], ['ir', 'ɝ', { notBefore: '^r' }], ['ur', 'ɝ', { notBefore: '^r' }], ['yr', 'ɝ', { notBefore: '^r' }],

  // ── reliable pre-cluster lengthening (find, child, old, bolt) ─────────
  ['ind', 'aɪnd', { end: true }], ['ild', 'aɪld', { end: true }],
  ['old', 'oʊld', { end: true }], ['olt', 'oʊlt', { end: true }],
  ['oll', 'oʊl', { end: true }], ['igh', 'aɪ'],

  // ── vowel digraphs ────────────────────────────────────────────────────
  ['eau', 'oʊ'], ['ee', 'i'], ['ea', 'i'], ['ei', 'i'], ['ie', 'i'],
  ['oo', 'u'], ['ou', 'aʊ'],
  ['ow', 'oʊ', { end: true, after: '^.{3,}$' }], ['ow', 'aʊ'], ['oi', 'ɔɪ'], ['oy', 'ɔɪ'],
  ['oa', 'oʊ'], ['oe', 'oʊ'], ['au', 'ɔ'], ['aw', 'ɔ'], ['ai', 'eɪ'],
  ['ay', 'eɪ'], ['ey', 'eɪ'], ['ew', 'u'], ['ue', 'u'], ['ui', 'u'],

  // ── single vowels: magic-e long, otherwise short ───────────────────────
  ['a', 'eɪ', { before: `^${C}e$|^${C}le$` }], ['a', 'æ'],
  ['e', '', { end: true, after: `${C}` }], ['e', 'i', { before: `^${C}e$` }], ['e', 'ɛ'],
  ['i', 'aɪ', { before: `^${C}e$|^${C}le$` }], ['i', 'ɪ'],
  ['o', 'oʊ', { before: `^${C}e$|^${C}le$` }], ['o', 'ɑ'],
  ['u', 'u', { before: `^${C}e$|^${C}le$` }], ['u', 'ʌ'],
  ['y', 'i', { end: true, after: `${C}$` }],
  ['y', 'aɪ', { end: true }], ['y', 'j', { start: true }], ['y', 'ɪ'],

  // ── single consonants ─────────────────────────────────────────────────
  ['c', 's', { before: '^[eiy]' }], ['c', 'k'],
  ['g', 'dʒ', { before: '^[eiy]' }], ['g', 'g'],
  ['s', 'z', { end: true, after: `[${'aeiouybdglmnrvwz'}]$` }], ['s', 's'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['h', 'h'], ['j', 'dʒ'], ['k', 'k'],
  ['l', 'l'], ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'r'], ['t', 't'],
  ['v', 'v'], ['w', 'w'], ['z', 'z'],
];

/** Prefixes that are practically never stressed in a polysyllable. */
const PREFIX = /^(a|be|con|com|de|dis|em|en|ex|im|in|ob|per|pre|pro|re|sub|sup|sur|to|un)/;

/** Endings whose final syllable is weak, forcing a trochee (apple, arrow). */
const WEAK_ENDING = /(le|ow|ey|er|el|en|on|y)$/;

/**
 * Does `word` open with a prefix that pulls stress off syllable one?
 * "about", "arrive", "connect" — yes; "apple", "berry", "author" — no.
 */
function hasUnstressedPrefix(word) {
  const m = word.match(PREFIX);
  if (!m) return false;
  const p = m[1];
  const rest = word.slice(p.length);
  if (rest.length < 3) return false;                    // no stem to stress
  if (p === 'a' && /^[aeiou]/.test(rest)) return false; // author, audio, aisle
  // A geminate right after the prefix closes syllable one — but only when the
  // word also ends weak, which is what separates apple/berry from arrive.
  if (rest[0] === rest[1] && WEAK_ENDING.test(word)) return false;
  return true;
}

/** Suffixes that pull primary stress onto the syllable immediately before. */
const PRE_STRESS_SUFFIX = /(tion|sion|cian|ic|ical|ity|ety|ify|ify|ious|eous|ual|ial|ian|logy|graphy|nomy|metry)$/;

/** Suffixes that are themselves stressed. */
const SELF_STRESS_SUFFIX = /(ee|eer|ese|ette|esque|oon|aire)$/;

function testCtx(opts, consumed, rest, atStart, atEnd) {
  if (!opts) return true;
  if (opts.start === true && !atStart) return false;
  if (opts.start === false && atStart) return false;
  if (opts.end === true && !atEnd) return false;
  if (opts.before && !new RegExp(opts.before).test(rest)) return false;
  if (opts.notBefore && new RegExp(opts.notBefore).test(rest)) return false;
  if (opts.after && !new RegExp(opts.after).test(consumed)) return false;
  if (opts.notAfter && new RegExp(opts.notAfter).test(consumed)) return false;
  return true;
}

/** Apply the rule cascade to a bare letter string. */
function applyRules(word) {
  let out = '';
  let i = 0;
  while (i < word.length) {
    const atStart = i === 0;
    let matched = false;
    for (const [pat, phon, opts] of RULES) {
      if (!word.startsWith(pat, i)) continue;
      const consumed = word.slice(0, i);
      const rest = word.slice(i + pat.length);
      if (!testCtx(opts, consumed, rest, atStart, rest.length === 0)) continue;
      out += phon;
      i += pat.length;
      matched = true;
      break;
    }
    if (!matched) i += 1; // unknown letter (digits, apostrophes) — skip
  }
  return out;
}

/**
 * Regular inflectional endings, handled before the main cascade so that
 * "watched" gets /t/ and not /ɛd/.
 */
function stripSuffix(word) {
  if (/[^aeiou]ies$/.test(word)) return { stem: `${word.slice(0, -3)}y`, add: 'z' };
  if (/(ch|sh|ss|x|z|s)es$/.test(word)) return { stem: word.slice(0, -2), add: 'ɪz' };
  if (/[^s]s$/.test(word) && !/(ss|us|is)$/.test(word)) {
    const stem = word.slice(0, -1);
    const voiceless = /[ptkfθ]$|[ptkf]$/.test(stem);
    return { stem, add: voiceless ? 's' : 'z' };
  }
  if (/ed$/.test(word) && word.length > 3) {
    const stem = word.slice(0, -2);
    if (/[td]$/.test(stem)) return { stem, add: 'ɪd' };
    return { stem, add: /[ptkfsxh]$|(ch|sh)$/.test(stem) ? 't' : 'd' };
  }
  if (/ing$/.test(word) && word.length > 4) return { stem: word.slice(0, -3), add: 'ɪŋ' };
  return null;
}

/** Split an IPA string into syllables at vowel nuclei (onset-maximal-ish). */
export function syllabify(ipa) {
  const toks = tokenize(ipa).filter((t) => t.type === 'phoneme');
  const sylls = [];
  let cur = [];
  let seenVowel = false;
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.vowel) {
      if (seenVowel) {
        // start a new syllable, giving the last consonant to the new onset
        const onset = cur.length && !cur[cur.length - 1].vowel ? [cur.pop()] : [];
        sylls.push(cur);
        cur = [...onset, t];
      } else {
        cur.push(t);
      }
      seenVowel = true;
    } else {
      cur.push(t);
    }
  }
  if (cur.length) sylls.push(cur);
  return sylls.filter((s) => s.length);
}

function countSyllables(ipa) {
  return tokenize(ipa).filter((t) => t.type === 'phoneme' && t.vowel).length;
}

/**
 * Choose a primary-stress syllable index from the spelling and the syllable
 * count. Heuristic, in descending confidence.
 */
function chooseStress(word, nSyll) {
  if (nSyll <= 1) return 0;
  if (SELF_STRESS_SUFFIX.test(word)) return nSyll - 1;
  if (PRE_STRESS_SUFFIX.test(word)) return Math.max(0, nSyll - 2);
  if (hasUnstressedPrefix(word)) return 1;
  return 0; // Germanic default: initial stress
}

/** Vowels that survive in an unstressed syllable rather than reducing. */
const NO_REDUCE = new Set(['i', 'u', 'oʊ', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'ɚ', 'ɝ', 'ɪ']);

/**
 * Convert a bare word to IPA using the rules.
 * @param {string} raw
 * @returns {string} IPA in the base (General American) dialect
 */
export function graphemesToPhonemes(raw) {
  const word = String(raw || '').toLowerCase().replace(/[^a-z']/g, '');
  if (!word) return '';

  let core = word;
  let tail = '';
  const suf = stripSuffix(word);
  if (suf && suf.stem.length >= 2) {
    core = suf.stem;
    tail = suf.add;
  }

  let ipa = applyRules(core) + tail;
  if (!ipa) return '';

  // ── stress + vowel reduction ──────────────────────────────────────────
  const nSyll = countSyllables(ipa);
  if (nSyll > 1) {
    const target = chooseStress(word, nSyll);
    const sylls = syllabify(ipa);
    ipa = sylls
      .map((syl, idx) => {
        const body = syl
          .map((t) => {
            if (!t.vowel || idx === target) return t.ipa;
            return NO_REDUCE.has(t.ipa) ? t.ipa : 'ə';
          })
          .join('');
        return (idx === target ? 'ˈ' : '') + body;
      })
      .join('');
  }
  return ipa;
}

export default graphemesToPhonemes;
