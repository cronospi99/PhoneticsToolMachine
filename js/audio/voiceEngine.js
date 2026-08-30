/**
 * voiceEngine.js — a formant speech synthesiser built into the app.
 *
 * Why this exists: the Web Speech API can only use voices the operating system
 * already has. On a stock Windows install there is usually one en-US voice and
 * nothing for en-GB or en-AU, so the accent buttons all sound identical — which
 * defeats the entire point of the tool.
 *
 * This engine has no such dependency. It renders speech from the app's OWN
 * phoneme stream, so the accents differ because the IPA differs: UK "car" is
 * /kɑː/ and AU is /kɐː/, those have different tongue positions in
 * articulation.js, and formants.js turns those into different frequencies.
 * Nothing here is accent-specific.
 *
 * It is a source-filter model, the classic account of how speech works:
 *
 *   glottal pulse train ─┐
 *                        ├─→ 3 parallel formant resonators ─→ output
 *   shaped noise ────────┘   (or straight out, for frication)
 *
 * It sounds synthetic — this is 1980s technology, not a neural vocoder — but it
 * is phonetically accurate, always available, and adds nothing to the download.
 */

import { buildPoseTrack } from '../viz/articulation.js';
import { acousticsFor, formantsFor } from './formants.js';

/** Rise/fall time for gain changes. Shorter than this and you hear clicks. */
const RAMP = 0.012;

/** Base fundamental frequency, in Hz, before pitch scaling. */
const BASE_F0 = 118;

/**
 * A glottal pulse is not a sawtooth: its harmonics roll off faster, which is
 * why a raw sawtooth sounds like a buzzer and this sounds (a bit) like a voice.
 */
function glottalWave(ctx) {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i += 1) {
    // ~-12 dB per octave, with the very lowest harmonics slightly softened
    imag[i] = (1 / i ** 1.55) * (i === 1 ? 0.85 : 1);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/** A second of white noise, looped — cheaper than generating it continuously. */
function noiseBuffer(ctx) {
  const len = Math.ceil(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Relative loudness by manner — vowels carry the energy, fricatives far less. */
const MANNER_GAIN = {
  vowel: 1,
  glide: 1,
  approximant: 0.78,
  lateral: 0.72,
  nasal: 0.42,
  plosive: 0.9,
  affricate: 0.85,
  fricative: 0.5,
  sibilant: 0.6,
  tap: 0.6,
};

/**
 * Turn a phoneme stream into a scheduled audio graph on `ctx`.
 *
 * @param {BaseAudioContext} ctx
 * @param {Array<{ipa:string, stressed?:number}>} stream
 * @param {{rate?:number, pitch?:number}} opts
 * @returns {{duration:number, output:GainNode}}
 */
function buildGraph(ctx, stream, opts = {}) {
  const rate = Math.min(2, Math.max(0.4, opts.rate ?? 1));
  const pitch = Math.min(2, Math.max(0.5, opts.pitch ?? 1));
  // A shorter vocal tract resonates higher across the board, which is most of
  // what separates a female voice from a male one — the raised f0 alone just
  // sounds like the same speaker straining.
  const tract = Math.min(1.4, Math.max(0.8, opts.tract ?? 1));
  const f0Base = opts.f0 ?? BASE_F0;
  const track = buildPoseTrack(stream, rate);

  const master = ctx.createGain();
  master.gain.value = 0.9;

  // ── the source: voiced pulses and turbulent noise ──
  const glottis = ctx.createOscillator();
  glottis.setPeriodicWave(glottalWave(ctx));

  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 0;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  noise.loop = true;

  const fricFilter = ctx.createBiquadFilter();
  fricFilter.type = 'bandpass';
  fricFilter.frequency.value = 4000;
  fricFilter.Q.value = 1;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;

  // ── the filter: three parallel formant resonators ──
  const bank = [0, 1, 2].map(() => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    const g = ctx.createGain();
    f.connect(g).connect(master);
    return { filter: f, gain: g };
  });

  glottis.connect(voiceGain);
  for (const b of bank) voiceGain.connect(b.filter);

  // Frication bypasses the formant bank: /s/ is shaped by the narrow channel
  // at the teeth, not by the resonances of the whole tract behind it.
  noise.connect(fricFilter).connect(noiseGain).connect(master);

  // Aspiration (/h/) is the exception — it IS the tract resonating, so it goes
  // through the formant bank alongside the voiced source.
  const aspGain = ctx.createGain();
  aspGain.gain.value = 0;
  noise.connect(aspGain);
  for (const b of bank) aspGain.connect(b.filter);

  // ── schedule every segment ──
  const t0 = ctx.currentTime === undefined ? 0 : ctx.currentTime;
  const start = t0 + 0.03;
  const totalMs = track.length ? track[track.length - 1].until : 0;
  const totalSec = totalMs / 1000;

  // f0 declination: pitch drifts down across an utterance. Without it, speech
  // sounds like a list rather than a sentence.
  glottis.frequency.setValueAtTime(f0Base * pitch, start);

  let prevSpec = null;

  for (const seg of track) {
    const at = start + seg.at / 1000;
    const until = start + seg.until / 1000;
    const dur = Math.max(0.02, until - at);
    const ac = acousticsFor(seg.ipa);
    if (!ac) continue;

    // A pose-track entry maps to one acoustic frame of the same phoneme.
    const frameIdx = Math.min(
      ac.frames.length - 1,
      ac.frames.findIndex((f) => f.event === seg.event) >= 0
        ? ac.frames.findIndex((f) => f.event === seg.event)
        : 0,
    );
    const frame = ac.frames[frameIdx];
    const spec = frame.spec;

    // Formant transitions: ramp INTO each target rather than stepping. These
    // transitions are most of what tells a listener where a stop was made.
    bank.forEach((b, i) => {
      const target = spec.f[i] * tract;
      const bw = spec.bw[i] * tract;
      const q = Math.max(1.2, target / Math.max(30, bw));
      if (prevSpec === null) {
        b.filter.frequency.setValueAtTime(target, at);
      } else {
        b.filter.frequency.linearRampToValueAtTime(target, at + Math.min(0.055, dur * 0.6));
      }
      b.filter.Q.setValueAtTime(q, at);
      b.gain.gain.setTargetAtTime(spec.gain[i], at, 0.012);
    });
    prevSpec = spec;

    // pitch: a small rise on stressed syllables, over a falling baseline
    const progress = totalSec > 0 ? (seg.at / 1000) / totalSec : 0;
    const stress = seg.source && seg.source.stressed ? seg.source.stressed : 0;
    const accentBump = stress === 1 ? 1.14 : stress === 2 ? 1.06 : 1;
    const f0 = f0Base * pitch * accentBump * (1 - progress * 0.20);
    glottis.frequency.linearRampToValueAtTime(f0, at + dur * 0.5);

    // amplitude
    const mannerGain = MANNER_GAIN[frame.manner] ?? 0.7;
    const stressGain = stress === 1 ? 1.15 : 1;

    if (frame.silent) {
      // voiceless closure — true silence is the cue for a stop
      voiceGain.gain.setTargetAtTime(0, at, RAMP * 0.5);
      noiseGain.gain.setTargetAtTime(0, at, RAMP * 0.5);
      aspGain.gain.setTargetAtTime(0, at, RAMP * 0.5);
      continue;
    }

    const voiceLevel = frame.source === 'noise' ? 0
      : frame.source === 'voicebar' ? 0.12
        : frame.source === 'aspirate' ? 0
          : frame.source === 'mixed' ? 0.55 * mannerGain * stressGain
            : mannerGain * stressGain;

    voiceGain.gain.setTargetAtTime(voiceLevel * 0.78, at, RAMP);

    if (frame.noise) {
      fricFilter.frequency.setTargetAtTime(frame.noise.centre * tract, at, 0.008);
      fricFilter.Q.setTargetAtTime(frame.noise.q, at, 0.008);
      noiseGain.gain.setTargetAtTime(frame.noise.gain, at, RAMP * 0.6);
      // a burst is a transient, not a sustained hiss
      if (seg.event === 'burst') {
        noiseGain.gain.setTargetAtTime(0.02, at + Math.min(0.045, dur * 0.5), 0.02);
      }
    } else {
      noiseGain.gain.setTargetAtTime(0, at, RAMP);
    }

    aspGain.gain.setTargetAtTime(frame.source === 'aspirate' ? 0.30 : 0, at, RAMP);
  }

  // tail off cleanly
  const end = start + totalSec;
  voiceGain.gain.setTargetAtTime(0, end, 0.03);
  noiseGain.gain.setTargetAtTime(0, end, 0.03);
  aspGain.gain.setTargetAtTime(0, end, 0.03);

  glottis.start(t0);
  noise.start(t0);
  glottis.stop(end + 0.20);
  noise.stop(end + 0.20);

  return { duration: totalSec + 0.25, output: master, startAt: start };
}

export class VoiceEngine {
  constructor() {
    this.ctx = null;
    this.active = null;
  }

  get supported() {
    return typeof window !== 'undefined'
      && !!(window.AudioContext || window.webkitAudioContext);
  }

  context() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  /** Browsers block audio until a user gesture; call this from a click. */
  unlock() {
    const ctx = this.context();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /**
   * Speak a phoneme stream aloud.
   * @param {Array<{ipa:string}>} stream
   * @param {{rate?:number, pitch?:number}} opts
   * @returns {Promise<void>} resolves when the utterance finishes
   */
  speak(stream, opts = {}) {
    const ctx = this.context();
    if (!ctx || !stream || !stream.length) return Promise.resolve();
    if (ctx.state === 'suspended') ctx.resume();
    this.stop();

    const { duration, output } = buildGraph(ctx, stream, opts);
    output.connect(ctx.destination);

    return new Promise((resolve) => {
      const token = { output, done: false };
      this.active = token;
      const finish = () => {
        if (token.done) return;
        token.done = true;
        try { output.disconnect(); } catch { /* already gone */ }
        if (this.active === token) this.active = null;
        resolve();
      };
      token.finish = finish;
      setTimeout(finish, duration * 1000 + 60);
    });
  }

  stop() {
    if (!this.active) return;
    const token = this.active;
    try { token.output.gain.cancelScheduledValues(this.ctx.currentTime); } catch { /* noop */ }
    try { token.output.gain.setValueAtTime(0, this.ctx.currentTime); } catch { /* noop */ }
    token.finish?.();
    this.active = null;
  }

  /**
   * Render to an AudioBuffer instead of the speakers.
   *
   * This is how the engine is tested: the smoke test renders a vowel offline
   * and checks that the spectrum actually peaks where the formant model says
   * it should, which is a claim about the sound rather than about the code.
   *
   * @returns {Promise<AudioBuffer>}
   */
  async render(stream, opts = {}) {
    const sampleRate = opts.sampleRate || 22050;
    const probe = buildPoseTrack(stream, opts.rate ?? 1);
    const seconds = (probe.length ? probe[probe.length - 1].until / 1000 : 0.2) + 0.3;
    const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtor) throw new Error('OfflineAudioContext unavailable');

    const ctx = new OfflineCtor(1, Math.ceil(seconds * sampleRate), sampleRate);
    const { output } = buildGraph(ctx, stream, opts);
    output.connect(ctx.destination);
    return ctx.startRendering();
  }
}

export const voiceEngine = new VoiceEngine();
export { formantsFor };
export default voiceEngine;
