/**
 * articulation.js — phoneme → articulator parameters.
 *
 * This is the contract between the phonetic engine and the 3D model. Every
 * phoneme resolves to one or more KEYFRAMES; each keyframe is a full set of
 * normalised articulator parameters that mouthModel.js knows how to pose.
 *
 * Keeping the mapping declarative (data, not geometry) is what makes the app
 * extensible: adding a phoneme — or a whole other language — means adding a
 * row here, not touching the mesh code.
 *
 * Parameter space (all 0..1 unless noted):
 *   jaw              closed → wide open
 *   lipOpen          sealed → fully parted (vertical aperture)
 *   lipRound         spread → tightly rounded (horizontal narrowing)
 *   lipSpread        neutral → drawn back into a smile
 *   lipProtrude      flat → pushed forward
 *   lipTuck          lower lip drawn under the upper teeth (labiodentals)
 *   tongueBodyHigh   low → raised toward the palate
 *   tongueBodyFront  back (velar/pharyngeal) → front (palatal)
 *   tongueTipHigh    resting on the floor → touching the alveolar ridge
 *   tongueTipFront   retracted → protruding past the teeth
 *   tongueRoot       neutral → retracted, narrowing the pharynx
 *   groove           flat blade → deep central groove (sibilants)
 *   lateral          flat sides → sides lowered, air escapes laterally (/l/)
 *   velum            raised, oral → lowered, nasal port open
 *   voice            voiceless → vocal folds vibrating
 *   teeth            hidden → upper teeth exposed
 *
 * A keyframe also carries `hold` (relative duration weight) and an optional
 * `event` ('burst' for a plosive release) the visualiser can react to.
 */

/** Neutral, at-rest posture. Every keyframe is a patch on top of this. */
export const REST = Object.freeze({
  jaw: 0.12,
  lipOpen: 0.14,
  lipRound: 0.10,
  lipSpread: 0.10,
  lipProtrude: 0.02,
  lipTuck: 0,
  tongueBodyHigh: 0.45,
  tongueBodyFront: 0.50,
  tongueTipHigh: 0.32,
  tongueTipFront: 0.50,
  tongueRoot: 0.30,
  groove: 0,
  lateral: 0,
  velum: 0.08,
  voice: 0,
  teeth: 0,
});

export const PARAM_KEYS = Object.keys(REST);

/**
 * Vowel space: height (0 open → 1 close), front (0 back → 1 front),
 * round (0 spread → 1 rounded), plus optional rhotic bunching.
 */
const VOWEL_SPACE = {
  // ── base / General American ──
  i:   { h: 0.95, f: 0.95, r: 0.00 },
  'iː': { h: 0.95, f: 0.95, r: 0.00 },
  ɪ:   { h: 0.75, f: 0.80, r: 0.00 },
  e:   { h: 0.58, f: 0.82, r: 0.00 },
  ɛ:   { h: 0.52, f: 0.80, r: 0.00 },
  æ:   { h: 0.25, f: 0.75, r: 0.00 },
  a:   { h: 0.06, f: 0.60, r: 0.00 },
  'aː': { h: 0.06, f: 0.55, r: 0.00 },
  ɑ:   { h: 0.10, f: 0.12, r: 0.00 },
  'ɑː': { h: 0.10, f: 0.10, r: 0.02 },
  ɒ:   { h: 0.16, f: 0.10, r: 0.35 },
  ɔ:   { h: 0.40, f: 0.10, r: 0.55 },
  'ɔː': { h: 0.42, f: 0.08, r: 0.62 },
  o:   { h: 0.62, f: 0.10, r: 0.78 },
  'oː': { h: 0.62, f: 0.08, r: 0.80 },
  ʊ:   { h: 0.74, f: 0.30, r: 0.58 },
  u:   { h: 0.95, f: 0.10, r: 0.95 },
  'uː': { h: 0.95, f: 0.08, r: 0.95 },
  ʉ:   { h: 0.90, f: 0.55, r: 0.80 },
  'ʉː': { h: 0.90, f: 0.55, r: 0.80 },
  ʌ:   { h: 0.34, f: 0.35, r: 0.00 },
  ə:   { h: 0.48, f: 0.50, r: 0.05 },
  ɐ:   { h: 0.24, f: 0.38, r: 0.00 },
  'ɐː': { h: 0.20, f: 0.30, r: 0.00 },
  ɜ:   { h: 0.50, f: 0.45, r: 0.10 },
  'ɜː': { h: 0.50, f: 0.45, r: 0.10 },
  ɝ:   { h: 0.52, f: 0.45, r: 0.20, rhotic: true },
  ɚ:   { h: 0.48, f: 0.45, r: 0.15, rhotic: true },
};

/** Diphthongs and triphthongs: a glide between points of the vowel space. */
const GLIDES = {
  eɪ: ['e', 'ɪ'],
  aɪ: ['a', 'ɪ'],
  ɔɪ: ['ɔ', 'ɪ'],
  oʊ: ['o', 'ʊ'],
  əʊ: ['ə', 'ʊ'],
  aʊ: ['a', 'ʊ'],
  ɪə: ['ɪ', 'ə'],
  eə: ['e', 'ə'],
  ʊə: ['ʊ', 'ə'],
  // Australian realisations
  ɪi: ['ɪ', 'i'],
  æɪ: ['æ', 'ɪ'],
  ɑe: ['ɑ', 'e'],
  əʉ: ['ə', 'ʉ'],
  æɔ: ['æ', 'ɔ'],
  oɪ: ['o', 'ɪ'],
  ɑeə: ['ɑ', 'e', 'ə'],
  æɔə: ['æ', 'ɔ', 'ə'],
  aɪə: ['a', 'ɪ', 'ə'],
  aʊə: ['a', 'ʊ', 'ə'],
};

/** Turn a point in vowel space into a full parameter patch. */
function vowelParams(key) {
  const v = VOWEL_SPACE[key] || VOWEL_SPACE.ə;
  const openness = 1 - v.h;
  const params = {
    jaw: 0.08 + openness * 0.78,
    lipOpen: 0.22 + openness * 0.62,
    lipRound: v.r,
    lipSpread: v.f * (1 - v.r) * v.h * 0.9,
    lipProtrude: v.r * 0.85,
    tongueBodyHigh: v.h,
    tongueBodyFront: v.f,
    tongueTipHigh: 0.18 + v.h * v.f * 0.45,
    tongueTipFront: 0.35 + v.f * 0.35,
    tongueRoot: 0.42 - v.f * 0.28 + (1 - v.h) * 0.22,
    velum: 0.06,
    voice: 1,
  };
  if (v.rhotic) {
    params.tongueTipHigh = 0.62;
    params.tongueBodyHigh = Math.max(params.tongueBodyHigh, 0.55);
    params.tongueRoot = 0.62;
    params.lipRound = Math.max(params.lipRound, 0.28);
  }
  return params;
}

/**
 * Consonants. `frames` lets a segment describe its own internal movement —
 * a plosive is a closure followed by a release burst, an affricate is a
 * closure followed by a fricative.
 */
const CONSONANTS = {
  p: { place: 'bilabial', manner: 'plosive', voice: 0 },
  b: { place: 'bilabial', manner: 'plosive', voice: 1 },
  t: { place: 'alveolar', manner: 'plosive', voice: 0 },
  d: { place: 'alveolar', manner: 'plosive', voice: 1 },
  k: { place: 'velar', manner: 'plosive', voice: 0 },
  g: { place: 'velar', manner: 'plosive', voice: 1 },
  ʔ: { place: 'glottal', manner: 'plosive', voice: 0 },

  tʃ: { place: 'post-alveolar', manner: 'affricate', voice: 0 },
  dʒ: { place: 'post-alveolar', manner: 'affricate', voice: 1 },

  f: { place: 'labiodental', manner: 'fricative', voice: 0 },
  v: { place: 'labiodental', manner: 'fricative', voice: 1 },
  θ: { place: 'dental', manner: 'fricative', voice: 0 },
  ð: { place: 'dental', manner: 'fricative', voice: 1 },
  s: { place: 'alveolar', manner: 'sibilant', voice: 0 },
  z: { place: 'alveolar', manner: 'sibilant', voice: 1 },
  ʃ: { place: 'post-alveolar', manner: 'sibilant', voice: 0 },
  ʒ: { place: 'post-alveolar', manner: 'sibilant', voice: 1 },
  h: { place: 'glottal', manner: 'fricative', voice: 0 },
  x: { place: 'velar', manner: 'fricative', voice: 0 },

  m: { place: 'bilabial', manner: 'nasal', voice: 1 },
  n: { place: 'alveolar', manner: 'nasal', voice: 1 },
  ŋ: { place: 'velar', manner: 'nasal', voice: 1 },

  l: { place: 'alveolar', manner: 'lateral', voice: 1 },
  r: { place: 'post-alveolar', manner: 'approximant', voice: 1 },
  ɾ: { place: 'alveolar', manner: 'tap', voice: 1 },
  j: { place: 'palatal', manner: 'approximant', voice: 1 },
  w: { place: 'labial-velar', manner: 'approximant', voice: 1 },
};

/** Where the tongue goes for each place of articulation. */
const PLACE_POSTURE = {
  bilabial:       { tongueTipHigh: 0.30, tongueBodyHigh: 0.42, tongueBodyFront: 0.50 },
  labiodental:    { tongueTipHigh: 0.30, tongueBodyHigh: 0.44, tongueBodyFront: 0.52 },
  dental:         { tongueTipHigh: 0.88, tongueTipFront: 1.00, tongueBodyHigh: 0.42, tongueBodyFront: 0.70 },
  alveolar:       { tongueTipHigh: 1.00, tongueTipFront: 0.78, tongueBodyHigh: 0.48, tongueBodyFront: 0.66 },
  'post-alveolar':{ tongueTipHigh: 0.82, tongueTipFront: 0.58, tongueBodyHigh: 0.62, tongueBodyFront: 0.62 },
  palatal:        { tongueTipHigh: 0.55, tongueTipFront: 0.60, tongueBodyHigh: 0.92, tongueBodyFront: 0.90 },
  velar:          { tongueTipHigh: 0.22, tongueTipFront: 0.40, tongueBodyHigh: 1.00, tongueBodyFront: 0.08 },
  'labial-velar': { tongueTipHigh: 0.25, tongueTipFront: 0.42, tongueBodyHigh: 0.90, tongueBodyFront: 0.10 },
  glottal:        { tongueTipHigh: 0.30, tongueBodyHigh: 0.42, tongueBodyFront: 0.48, tongueRoot: 0.45 },
};

/** How the manner modifies lips, velum, groove and jaw. */
const MANNER_POSTURE = {
  plosive:     { jaw: 0.10, lipOpen: 0.30, velum: 0.02 },
  affricate:   { jaw: 0.12, lipOpen: 0.32, velum: 0.02 },
  fricative:   { jaw: 0.14, lipOpen: 0.30, velum: 0.04 },
  sibilant:    { jaw: 0.09, lipOpen: 0.24, velum: 0.03, groove: 1 },
  nasal:       { jaw: 0.10, lipOpen: 0.26, velum: 1 },
  lateral:     { jaw: 0.18, lipOpen: 0.38, velum: 0.05, lateral: 1 },
  approximant: { jaw: 0.20, lipOpen: 0.42, velum: 0.05 },
  tap:         { jaw: 0.14, lipOpen: 0.34, velum: 0.04 },
};

/** Per-phoneme overrides that place and manner cannot express. */
const CONSONANT_TWEAKS = {
  p: { lipOpen: 0, lipRound: 0.14 },
  b: { lipOpen: 0, lipRound: 0.14 },
  m: { lipOpen: 0, lipRound: 0.12 },
  f: { lipOpen: 0.06, lipTuck: 1, teeth: 1 },
  v: { lipOpen: 0.06, lipTuck: 1, teeth: 1 },
  θ: { lipOpen: 0.20, teeth: 1, tongueTipHigh: 0.60 },
  ð: { lipOpen: 0.20, teeth: 1, tongueTipHigh: 0.60 },
  s: { teeth: 0.7, lipSpread: 0.45, tongueTipHigh: 0.93 },
  z: { teeth: 0.7, lipSpread: 0.45, tongueTipHigh: 0.93 },
  ʃ: { lipRound: 0.50, lipProtrude: 0.55, groove: 0.6, teeth: 0.4, tongueTipHigh: 0.90 },
  ʒ: { lipRound: 0.50, lipProtrude: 0.55, groove: 0.6, teeth: 0.4, tongueTipHigh: 0.90 },
  tʃ: { lipRound: 0.45, lipProtrude: 0.5, tongueTipHigh: 0.90 },
  dʒ: { lipRound: 0.45, lipProtrude: 0.5, tongueTipHigh: 0.90 },
  r: { lipRound: 0.32, lipProtrude: 0.3, tongueRoot: 0.60 },
  l: { tongueTipFront: 0.74 },
  w: { lipRound: 0.95, lipProtrude: 0.9, lipOpen: 0.16 },
  j: { lipSpread: 0.5, lipOpen: 0.24 },
  h: { jaw: 0.34, lipOpen: 0.5 },
  k: { jaw: 0.08 },
  g: { jaw: 0.08 },
  ŋ: { jaw: 0.10 },
};

const frame = (params, hold = 1, event = null) => ({ params, hold, event });

/** Build the keyframe list for a consonant, including stop release. */
function consonantFrames(ipa, def) {
  const base = {
    ...PLACE_POSTURE[def.place],
    ...MANNER_POSTURE[def.manner],
    ...(CONSONANT_TWEAKS[ipa] || {}),
    voice: def.voice,
  };

  if (def.manner === 'plosive') {
    // full closure, then an abrupt release
    const closed = { ...base };
    if (def.place === 'alveolar') closed.tongueTipHigh = 1;
    if (def.place === 'velar') closed.tongueBodyHigh = 1;
    const released = { ...base, jaw: base.jaw + 0.16, lipOpen: Math.max(base.lipOpen, 0.34) };
    if (def.place === 'alveolar') released.tongueTipHigh = 0.72;
    if (def.place === 'velar') released.tongueBodyHigh = 0.78;
    return [frame(closed, 2.2), frame(released, 0.8, 'burst')];
  }

  if (def.manner === 'affricate') {
    const stop = { ...base, ...PLACE_POSTURE.alveolar, tongueTipHigh: 1, groove: 0.2 };
    const fric = { ...base, groove: 0.7 };
    return [frame(stop, 1.4), frame(fric, 1.6, 'burst')];
  }

  if (def.manner === 'tap') {
    return [frame({ ...base, tongueTipHigh: 1 }, 0.6), frame({ ...base, tongueTipHigh: 0.5 }, 0.4)];
  }

  return [frame(base, 1)];
}

/**
 * Accent-specific symbols that share an articulation with a base symbol.
 * Keeps the table above focused on distinct gestures.
 */
const ALIASES = { ɡ: 'g', ɹ: 'r', ˈ: null, ˌ: null, '.': null };

/**
 * Resolve one IPA segment to its articulation.
 *
 * @param {string} ipa
 * @returns {{ipa:string, kind:string, place:string, manner:string, voiced:boolean,
 *            frames:Array<{params:object, hold:number, event:?string}>}|null}
 */
export function articulate(ipa) {
  const sym = Object.prototype.hasOwnProperty.call(ALIASES, ipa) ? ALIASES[ipa] : ipa;
  if (!sym) return null;

  if (GLIDES[sym]) {
    const points = GLIDES[sym];
    return {
      ipa: sym,
      kind: 'diphthong',
      place: 'vocalic',
      manner: 'glide',
      voiced: true,
      frames: points.map((p, i) => frame(vowelParams(p), i === 0 ? 1.6 : 1)),
    };
  }

  if (VOWEL_SPACE[sym]) {
    return {
      ipa: sym,
      kind: 'vowel',
      place: 'vocalic',
      manner: 'vowel',
      voiced: true,
      frames: [frame(vowelParams(sym), 1.6)],
    };
  }

  const def = CONSONANTS[sym];
  if (!def) return null;
  return {
    ipa: sym,
    kind: 'consonant',
    place: def.place,
    manner: def.manner,
    voiced: def.voice === 1,
    frames: consonantFrames(sym, def),
  };
}

/** Fill a partial patch out to a complete parameter set. */
export function resolveParams(patch) {
  const out = { ...REST };
  for (const k of PARAM_KEYS) {
    if (patch && patch[k] !== undefined) out[k] = Math.min(1, Math.max(0, patch[k]));
  }
  return out;
}

/** Linear blend of two complete parameter sets. */
export function blendParams(a, b, t) {
  const out = {};
  for (const k of PARAM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/**
 * Expand a phoneme stream into a timed pose track the visualiser can scrub.
 *
 * @param {Array<{ipa:string}>} stream
 * @param {number} rate  playback rate multiplier (1 = normal)
 * @returns {Array<{at:number, until:number, params:object, ipa:string, event:?string}>}
 */
export function buildPoseTrack(stream, rate = 1) {
  const BASE_MS = 135;
  const track = [];
  let clock = 0;
  for (const seg of stream) {
    const art = articulate(seg.ipa);
    if (!art) continue;
    const total = art.frames.reduce((s, f) => s + f.hold, 0);
    for (const f of art.frames) {
      const dur = (BASE_MS * f.hold * (art.kind === 'vowel' ? 1.15 : 0.85)) / Math.max(0.25, rate);
      track.push({
        at: clock,
        until: clock + dur,
        params: resolveParams(f.params),
        ipa: art.ipa,
        kind: art.kind,
        place: art.place,
        manner: art.manner,
        voiced: art.voiced,
        event: f.event,
        weight: f.hold / total,
        source: seg,
      });
      clock += dur;
    }
  }
  return track;
}

/** Human-readable description for the on-screen articulator readout. */
export function describe(ipa) {
  const art = articulate(ipa);
  if (!art) return null;
  if (art.kind === 'vowel' || art.kind === 'diphthong') {
    const p = resolveParams(art.frames[0].params);
    const height = p.tongueBodyHigh > 0.66 ? 'close' : p.tongueBodyHigh > 0.38 ? 'mid' : 'open';
    const back = p.tongueBodyFront > 0.62 ? 'front' : p.tongueBodyFront >= 0.28 ? 'central' : 'back';
    const round = p.lipRound > 0.45 ? 'rounded' : 'unrounded';
    const rhotic = p.tongueRoot > 0.55 && p.tongueTipHigh > 0.55 ? 'r-coloured ' : '';
    return {
      kind: art.kind,
      summary: `${rhotic}${height} ${back} ${round}${art.kind === 'diphthong' ? ' glide' : ' vowel'}`,
      voiced: true,
    };
  }
  return {
    kind: 'consonant',
    summary: `${art.voiced ? 'voiced' : 'voiceless'} ${art.place} ${art.manner}`,
    voiced: art.voiced,
  };
}
