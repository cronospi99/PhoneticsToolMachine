/**
 * phonemeAudio.js — how to make a single phoneme audible.
 *
 * TTS engines speak words, not segments: handing one an "s" says the letter
 * "ess". Two strategies, in order of fidelity:
 *
 *  1. Speak the chart's example word for that phoneme, which is always a real
 *     word containing the sound — and is what a teacher would do anyway.
 *  2. Synthesise the sound directly with the Web Audio API: filtered noise for
 *     fricatives, a formant-filtered glottal buzz for vowels. Rough, but it
 *     isolates the segment, which the word cannot.
 */

import { CHART_INDEX } from '../phonetics/symbols.js';
import { articulate } from '../viz/articulation.js';
import speaker from './tts.js';

let ctx = null;

function audioContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Two lowest formants, enough for a vowel to be recognisable. */
function formantsFor(params) {
  // F1 falls as the tongue rises; F2 rises as it fronts and falls with rounding
  const f1 = 780 - params.tongueBodyHigh * 500;
  const f2 = 700 + params.tongueBodyFront * 1500 - params.lipRound * 420;
  return [Math.max(220, f1), Math.max(600, f2)];
}

/**
 * Synthesise one segment.
 * @param {string} ipa
 * @param {number} durationMs
 */
export function synthesizePhoneme(ipa, durationMs = 420) {
  const ac = audioContext();
  const art = articulate(ipa);
  if (!ac || !art) return false;
  if (ac.state === 'suspended') ac.resume();

  const now = ac.currentTime;
  const dur = durationMs / 1000;
  const out = ac.createGain();
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(0.5, now + 0.03);
  out.gain.setValueAtTime(0.5, now + dur - 0.08);
  out.gain.linearRampToValueAtTime(0, now + dur);
  out.connect(ac.destination);

  const params = art.frames[0].params;
  const voiced = art.voiced;
  const isNoise = ['fricative', 'sibilant', 'plosive', 'affricate'].includes(art.manner);

  if (isNoise) {
    // filtered white noise; sibilants sit far higher than /f/ or /θ/
    const len = Math.ceil(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;

    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    const centre = art.manner === 'sibilant'
      ? (art.place === 'alveolar' ? 6200 : 3400)
      : (art.place === 'velar' ? 1600 : 4200);
    band.frequency.value = centre;
    band.Q.value = art.manner === 'sibilant' ? 3.2 : 1.1;

    src.connect(band).connect(out);
    // plosives are a burst, not a hiss
    if (art.manner === 'plosive') {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(0.7, now);
      out.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }
    src.start(now);
    src.stop(now + dur);
  }

  if (voiced || !isNoise) {
    const [f1, f2] = formantsFor(params);
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 118;

    const mk = (freq, q, gain) => {
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ac.createGain();
      g.gain.value = gain;
      f.connect(g).connect(out);
      return f;
    };
    osc.connect(mk(f1, 7, 0.9));
    osc.connect(mk(f2, 9, 0.55));
    if (art.manner === 'nasal') osc.connect(mk(280, 12, 0.7));

    osc.start(now);
    osc.stop(now + dur);
  }
  return true;
}

/**
 * Play a phoneme the best way available.
 * @param {string} ipa
 * @param {object} opts { accent, mode: 'word'|'isolated', rate }
 */
export async function playPhoneme(ipa, opts = {}) {
  const { accent = 'uk', mode = 'word', rate = 1 } = opts;
  const entry = CHART_INDEX.get(ipa);

  if (mode === 'word' && entry && speaker.supported) {
    await speaker.speak(entry.ex, { accent, rate: rate * 0.85 });
    return { via: 'word', word: entry.ex };
  }
  const ok = synthesizePhoneme(ipa);
  if (ok) return { via: 'synth' };
  if (entry && speaker.supported) {
    await speaker.speak(entry.ex, { accent, rate });
    return { via: 'word', word: entry.ex };
  }
  return { via: 'none' };
}

/** Browsers require a user gesture before audio can start. */
export function unlockAudio() {
  const ac = audioContext();
  if (ac && ac.state === 'suspended') ac.resume();
}
