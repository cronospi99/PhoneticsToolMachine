/**
 * phonemeAudio.js — how to make a single phoneme audible.
 *
 * TTS engines speak words, not segments: hand one an "s" and it says the
 * letter "ess". Two strategies, and which is better depends on what the
 * learner is after:
 *
 *  1. The built-in formant voice (voiceEngine) renders the segment ITSELF, in
 *     isolation. Synthetic, but it is the actual sound rather than a word that
 *     happens to contain it — and it works with no OS voices installed.
 *  2. The system voice speaks the chart's example word, which is what a
 *     teacher would do, and sounds natural where a real voice exists.
 */

import { CHART_INDEX } from '../phonetics/symbols.js';
import voiceEngine from './voiceEngine.js';
import speaker from './tts.js';

/**
 * Play a phoneme the best way available.
 *
 * @param {string} ipa
 * @param {object} opts { accent, prefer: 'builtin'|'word', rate }
 * @returns {Promise<{via:string, word?:string}>}
 */
export async function playPhoneme(ipa, opts = {}) {
  const { accent = 'uk', prefer = 'builtin', rate = 1 } = opts;
  const entry = CHART_INDEX.get(ipa);

  if (prefer === 'word' && entry && speaker.supported) {
    await speaker.speak(entry.ex, { accent, rate: rate * 0.85 });
    return { via: 'word', word: entry.ex };
  }

  if (voiceEngine.supported) {
    voiceEngine.unlock();
    // slower than running speech, because a segment on its own is over fast
    await voiceEngine.speak([{ ipa }], { rate: rate * 0.55 });
    return { via: 'builtin' };
  }

  if (entry && speaker.supported) {
    await speaker.speak(entry.ex, { accent, rate });
    return { via: 'word', word: entry.ex };
  }
  return { via: 'none' };
}

/** Browsers require a user gesture before any audio can start. */
export function unlockAudio() {
  voiceEngine.unlock();
}
