/**
 * formants.js — acoustic targets for every phoneme.
 *
 * A vowel's identity is essentially its first three formants, and this app
 * already knows the articulation that produces them: tongue height sets F1,
 * tongue fronting and lip rounding set F2, and rhoticity drops F3. So rather
 * than storing a lookup table of frequencies, the targets are DERIVED from the
 * same articulator parameters that pose the 3D model.
 *
 * That is what makes the built-in voice accent-aware for free: /ɑː/ (UK) and
 * /ɐː/ (AU) have different tongue positions in articulation.js, so they come
 * out with different formants here, with no accent-specific audio code.
 *
 * Frequencies are for an adult male-ish tract (~17cm). `scale` shifts the whole
 * set for a shorter tract, which is how the voice pitch/size control works.
 */

import { articulate, resolveParams } from '../viz/articulation.js';

/** Noise spectra for fricatives, by place of articulation. */
const FRICATION = {
  labiodental:     { centre: 5200, q: 0.8,  gain: 0.16 },  // /f/ /v/ — diffuse, weak
  dental:          { centre: 6400, q: 0.7,  gain: 0.13 },  // /θ/ /ð/ — weakest of all
  alveolar:        { centre: 6200, q: 3.4,  gain: 0.62 },  // /s/ /z/ — the loud one
  'post-alveolar': { centre: 3100, q: 2.6,  gain: 0.60 },  // /ʃ/ /ʒ/ — lower, rounded
  velar:           { centre: 1700, q: 1.6,  gain: 0.28 },
  glottal:         { centre: 1400, q: 0.5,  gain: 0.20 },  // /h/ — shaped by the vowel
  bilabial:        { centre: 1000, q: 0.9,  gain: 0.22 },
  palatal:         { centre: 3000, q: 1.4,  gain: 0.20 },
  'labial-velar':  { centre: 1100, q: 1.0,  gain: 0.18 },
};

/** Plosive release bursts: brief, and their spectrum is the main place cue. */
const BURST = {
  bilabial:        { centre: 900,  q: 0.7, gain: 0.42 },  // /p/ /b/ — low, diffuse
  alveolar:        { centre: 4200, q: 1.6, gain: 0.55 },  // /t/ /d/ — sharp, high
  velar:           { centre: 1900, q: 2.2, gain: 0.52 },  // /k/ /g/ — mid "compact"
  'post-alveolar': { centre: 3000, q: 2.2, gain: 0.50 },
  dental:          { centre: 5000, q: 1.2, gain: 0.40 },
  glottal:         { centre: 1200, q: 0.6, gain: 0.30 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Formant frequencies implied by a set of articulator parameters.
 *
 * The mapping is the standard one from articulatory phonetics:
 *   F1 falls as the tongue body rises   (close vowels have low F1)
 *   F2 rises as the tongue body fronts, and falls with lip rounding
 *   F3 drops sharply for rhotics, which is what makes an /r/ sound like one
 *
 * @param {object} p resolved articulator parameters
 * @returns {{f:number[], bw:number[], gain:number[]}}
 */
export function formantsFor(p) {
  const high = p.tongueBodyHigh;
  const front = p.tongueBodyFront;
  const round = p.lipRound;
  const open = 1 - high;

  // F1: 270 Hz (close) .. 800 Hz (open), nudged up by an open jaw
  let f1 = 265 + open * 495 + p.jaw * 70;

  // F2: ~730 Hz (back, rounded) .. 2360 Hz (front, spread)
  let f2 = 700 + front * 1550 - round * 300 + high * 200;

  // F3: fairly stable, except for rhotics and laterals
  let f3 = 2500 + front * 220 - round * 220;

  // Rhotic: the tongue bunches AND the root retracts together, collapsing F3
  // down toward F2. This low F3 is the single acoustic cue that makes an /r/
  // audible as an /r/, so it is worth getting close to the real ~1600 Hz.
  // Both gates must open: a retracted root alone is just an open back vowel.
  const rhotic = clamp((p.tongueRoot - 0.45) / 0.20, 0, 1)
    * clamp((p.tongueTipHigh - 0.40) / 0.30, 0, 1);
  if (rhotic > 0) {
    f3 -= rhotic * 1150;
    f2 -= rhotic * 200;
  }

  // Lateral: the side channels add a low F2 and pull F3 down a little.
  if (p.lateral > 0.5) {
    f2 = Math.min(f2, 1250);
    f3 -= 180;
  }

  // Nasal: the extra nasal cavity adds a low murmur and damps the mouth output.
  const nasal = p.velum;

  f1 = clamp(f1, 200, 1000);
  f2 = clamp(f2, Math.max(f1 + 180, 600), 2600);
  f3 = clamp(f3, f2 + 220, 3400);

  // The glottal source rolls off steeply with frequency, so an open vowel —
  // whose F1 sits high — comes out much quieter than a close one unless F1 is
  // compensated. Real /ɑː/ is the loudest vowel in the language, not the
  // quietest, so without this the synthesis gets the loudness ordering
  // backwards.
  const f1Boost = 1 + clamp((f1 - 300) / 500, 0, 1) * 1.1;

  return {
    f: [f1, f2, f3],
    // Bandwidths widen as the tract opens; nasality damps everything.
    bw: [60 + open * 40 + nasal * 90, 90 + nasal * 110, 150 + nasal * 130],
    gain: [f1Boost, 0.62 - nasal * 0.22, 0.30 - nasal * 0.12],
    nasal,
  };
}

/**
 * The full acoustic description of one phoneme: what the source should do and
 * what the filter should do.
 *
 * @param {string} ipa
 * @returns {?object}
 */
export function acousticsFor(ipa) {
  const art = articulate(ipa);
  if (!art) return null;

  const frames = art.frames.map((frame) => {
    const p = resolveParams(frame.params);
    const spec = formantsFor(p);
    const place = art.place;
    const manner = art.manner;

    let source = 'voiced';
    let noise = null;
    let silent = false;

    if (manner === 'plosive' || manner === 'affricate') {
      if (frame.event === 'burst') {
        source = art.voiced ? 'mixed' : 'noise';
        noise = manner === 'affricate'
          ? (FRICATION[place] || FRICATION.alveolar)
          : (BURST[place] || BURST.alveolar);
      } else {
        // Closure: no airflow through the mouth. A voiced stop keeps a faint
        // low-frequency "voice bar" from the vibrating folds behind the seal.
        silent = !art.voiced;
        source = 'voicebar';
      }
    } else if (manner === 'fricative' || manner === 'sibilant') {
      source = art.voiced ? 'mixed' : 'noise';
      noise = FRICATION[place] || FRICATION.alveolar;
      // /h/ is just breath shaped by the following vowel's formants
      if (place === 'glottal') source = 'aspirate';
    } else if (manner === 'nasal') {
      source = 'voiced';
    }

    return {
      spec,
      source,
      noise,
      silent,
      voiced: art.voiced,
      manner,
      place,
      hold: frame.hold,
      event: frame.event,
      params: p,
    };
  });

  return { ipa: art.ipa, kind: art.kind, manner: art.manner, place: art.place, voiced: art.voiced, frames };
}

export { FRICATION, BURST };
