/**
 * engine.test.mjs — assertions over the phonetic engine.
 *
 * These are the cases that broke while the rules were being written, so they
 * are the ones most likely to break again: the lexical splits, the stress
 * heuristic, and the accent transforms.
 *
 *   node tests/engine.test.mjs
 */

import { transcribe, transcribeWord, lineFor } from '../js/phonetics/transcriber.js';
import { graphemesToPhonemes } from '../js/phonetics/g2p.js';
import { toAccent } from '../js/phonetics/accents.js';
import { tokenize, stringify, CHART } from '../js/phonetics/symbols.js';
import { articulate, buildPoseTrack, describe } from '../js/viz/articulation.js';

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  if (actual === expected) { passed += 1; return; }
  failures.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`);
}

const ipa = (word, accent) => stringify(toAccent(transcribeWord(word).base, accent, word));

/* ── tokenizer ───────────────────────────────────────────────────────────── */
check('tokenize keeps multi-char symbols whole',
  tokenize('tʃiːz').filter((t) => t.type === 'phoneme').length, 3);
check('tokenize normalises script g',
  stringify(tokenize('ɡoʊ')), 'goʊ');
check('tokenize reads stress marks',
  tokenize('ˈspaɪdɚ')[0].type, 'stress');

/* ── grapheme-to-phoneme rules ───────────────────────────────────────────── */
check('magic-e through -le', graphemesToPhonemes('table'), 'ˈteɪbəl');
check('geminate blocks lengthening', graphemesToPhonemes('little'), 'ˈlɪtəl');
check('-tion tenses the vowel', graphemesToPhonemes('nation'), 'ˈneɪʃən');
check('-nge is an affricate', graphemesToPhonemes('strange'), 'streɪndʒ');
check('-ible is a schwa suffix', graphemesToPhonemes('possible'), 'ˈpɑsəbəl');
check('geminate after a- keeps initial stress', graphemesToPhonemes('apple'), 'ˈæpəl');
check('a- prefix before a cluster is unstressed', graphemesToPhonemes('arrive'), 'əˈraɪv');
check('final -ow in a polysyllable is /oʊ/', graphemesToPhonemes('arrow'), 'ˈæroʊ');
check('regular past tense devoices', graphemesToPhonemes('watched'), 'wætʃt');
check('doubled r is one consonant', graphemesToPhonemes('horrible'), 'ˈhɑrəbəl');

/* ── accent transforms ───────────────────────────────────────────────────── */
check('UK is non-rhotic', ipa('car', 'uk'), 'kɑː');
check('US keeps the r', ipa('car', 'us'), 'kɑr');
check('AU START vowel', ipa('car', 'au'), 'kɐː');
check('UK BATH split', ipa('bath', 'uk'), 'bɑːθ');
check('UK BATH before a nasal cluster', ipa('dance', 'uk'), 'dɑːns');
check('AU keeps /æ/ in dance', ipa('dance', 'au'), 'dæns');
check('UK CLOTH is /ɒ/', ipa('dog', 'uk'), 'dɒg');
check('UK THOUGHT is /ɔː/', ipa('thought', 'uk'), 'θɔːt');
check('UK PALM stays long', ipa('father', 'uk'), 'ˈfɑːðə');
check('UK LOT unrounds', ipa('not', 'uk'), 'nɒt');
check('UK GOAT is /əʊ/', ipa('coat', 'uk'), 'kəʊt');
check('AU GOAT is /əʉ/', ipa('coat', 'au'), 'kəʉt');
check('UK restores the yod', ipa('new', 'uk'), 'njuː');
check('US drops the yod', ipa('new', 'us'), 'nu');
check('US flaps intervocalic t', ipa('water', 'us'), 'ˈwɔɾɚ');
check('UK does not flap', ipa('water', 'uk'), 'ˈwɔːtə');
check('RP happY stays short', ipa('very', 'uk'), 'ˈveri');
check('RP FLEECE in a monosyllable', ipa('he', 'uk'), 'hiː');
check('r before a vowel survives', ipa('very', 'us'), 'ˈvɛri');
check('AU MOUTH vowel', ipa('house', 'au'), 'hæɔs');
check('AU PRICE vowel', ipa('high', 'au'), 'hɑe');

/* ── transcriber ─────────────────────────────────────────────────────────── */
const line = transcribe('The amazing Spider-Man!');
check('sentence word count (a hyphenated compound is one word)', line.wordCount, 3);
check('punctuation is preserved', lineFor(line, 'uk').endsWith('!'), true);
check('hyphenated compounds join', transcribeWord('spider-man').base.includes('mæn'), true);
check('possessives add /z/', transcribeWord("spider's").base.endsWith('z'), true);
check('known words are not flagged as estimated', transcribeWord('table').estimated, false);
check('unknown words are flagged', transcribeWord('zorblatt').estimated, true);

/* ── articulation model ──────────────────────────────────────────────────── */
check('plosives have a closure and a release', articulate('p').frames.length, 2);
check('the release is a burst', articulate('p').frames[1].event, 'burst');
check('the bilabial closure seals the lips', articulate('p').frames[0].params.lipOpen, 0);
check('nasals open the velum', articulate('m').frames[0].params.velum, 1);
check('/b/ keeps the velum shut', articulate('b').frames[0].params.velum, 0.02);
check('sibilants groove the tongue', articulate('s').frames[0].params.groove, 1);
check('/l/ opens a lateral channel', articulate('l').frames[0].params.lateral, 1);
check('/f/ tucks the lower lip', articulate('f').frames[0].params.lipTuck, 1);
check('diphthongs glide between two targets', articulate('aɪ').frames.length, 2);
check('/k/ raises the tongue body', articulate('k').frames[0].tongueBodyHigh, undefined);
check('describe names the place and manner', describe('ʃ').summary, 'voiceless post-alveolar sibilant');
check('describe reads the vowel space', describe('iː').summary, 'close front unrounded vowel');
check('every chart symbol is articulable',
  [...CHART.vowels, ...CHART.consonants].filter((r) => !articulate(r.ipa)).length, 0);
// Some US counterparts are sequences (NEAR = /ɪr/), so they must be tokenized
// before articulating — this is what visualizer.showPhoneme() does.
const articulable = (s) => tokenize(s)
  .filter((t) => t.type === 'phoneme')
  .every((t) => !!articulate(t.ipa));
check('every US chart counterpart is articulable once tokenized',
  [...CHART.vowels, ...CHART.consonants].filter((r) => !articulable(r.us)).length, 0);

const track = buildPoseTrack([{ ipa: 's' }, { ipa: 'p' }, { ipa: 'aɪ' }], 1);
check('pose track expands every keyframe', track.length, 5);
check('pose track is monotonic in time',
  track.every((f, i) => i === 0 || f.at >= track[i - 1].at), true);

/* ── every accent of every lexicon word must survive the pipeline ────────── */
let broke = 0;
for (const row of [...CHART.vowels, ...CHART.consonants]) {
  for (const accent of ['us', 'uk', 'au']) {
    const out = stringify(toAccent(transcribeWord(row.ex).base, accent, row.ex));
    if (!out || /undefined/.test(out)) broke += 1;
  }
}
check('all chart example words transcribe in all accents', broke, 0);

/* ── report ──────────────────────────────────────────────────────────────── */
if (failures.length) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  failures.forEach((f) => console.error(`  ✗ ${f}\n`));
  process.exit(1);
}
console.log(`✓ all ${passed} engine assertions passed`);
