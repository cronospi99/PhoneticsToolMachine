/**
 * tts.js — accent-aware speech synthesis.
 *
 * Wraps the Web Speech API with the two things it does not give you for free:
 *
 *  1. Voice selection per accent. Browsers expose wildly different voice lists,
 *     so voices are SCORED (exact locale, then language family, then name
 *     heuristics) rather than matched exactly — and the UI is told honestly
 *     when no true en-AU voice exists on the device.
 *  2. A promise-based, cancel-safe speak(), because overlapping utterances and
 *     the well-known Chrome "speaking but never fires end" hang otherwise leak
 *     into the UI as stuck buttons.
 */

const ACCENT_LOCALE = { us: 'en-US', uk: 'en-GB', au: 'en-AU' };

/** Names that reliably indicate a locale when the lang tag is vague. */
const NAME_HINTS = {
  us: [/united states/i, /\bus\b/i, /american/i, /samantha/i, /alex/i, /aria/i],
  uk: [/united kingdom/i, /\bgb\b/i, /british/i, /daniel/i, /kate/i, /serena/i, /libby/i],
  au: [/australia/i, /\bau\b/i, /karen/i, /catherine/i, /lee/i, /natasha/i],
};

export class Speaker {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.current = null;
    this.ready = this.loadVoices();
  }

  get supported() {
    return !!this.synth && typeof window.SpeechSynthesisUtterance === 'function';
  }

  /**
   * Voice lists populate asynchronously (and in Chrome, only after an event).
   * Resolve as soon as we have anything, but keep listening for late arrivals.
   */
  loadVoices() {
    if (!this.supported) return Promise.resolve([]);
    const read = () => {
      this.voices = this.synth.getVoices() || [];
      return this.voices;
    };
    read();
    if (this.voices.length) return Promise.resolve(this.voices);

    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(read());
      };
      this.synth.addEventListener?.('voiceschanged', done, { once: true });
      setTimeout(done, 1200);   // Safari sometimes never fires the event
    });
  }

  /**
   * Rank the available voices for an accent.
   * @param {'us'|'uk'|'au'} accent
   * @returns {{voice:SpeechSynthesisVoice|null, exact:boolean}}
   */
  pickVoice(accent) {
    const locale = ACCENT_LOCALE[accent] || 'en-US';
    const hints = NAME_HINTS[accent] || [];
    let best = null;
    let bestScore = -1;

    for (const v of this.voices) {
      const lang = (v.lang || '').replace('_', '-');
      let score = 0;
      if (lang.toLowerCase() === locale.toLowerCase()) score += 100;
      else if (lang.toLowerCase().startsWith('en')) score += 20;
      else continue;                                   // not English at all

      if (hints.some((re) => re.test(v.name))) score += 30;
      if (v.localService) score += 6;                  // lower latency
      if (/google/i.test(v.name)) score += 4;

      if (score > bestScore) { bestScore = score; best = v; }
    }
    return { voice: best, exact: bestScore >= 100 };
  }

  /** Which accents this device can actually voice authentically. */
  availability() {
    const out = {};
    for (const id of Object.keys(ACCENT_LOCALE)) {
      const { voice, exact } = this.pickVoice(id);
      out[id] = { available: !!voice, exact, name: voice ? voice.name : null };
    }
    return out;
  }

  /**
   * Speak text in an accent.
   * @param {string} text
   * @param {object} opts { accent, rate, pitch, onBoundary }
   * @returns {Promise<void>} resolves when speech ends or is cancelled
   */
  async speak(text, opts = {}) {
    if (!this.supported || !text) return;
    await this.ready;
    this.cancel();

    const { accent = 'us', rate = 1, pitch = 1, onBoundary } = opts;
    const utter = new SpeechSynthesisUtterance(String(text));
    const { voice } = this.pickVoice(accent);
    if (voice) utter.voice = voice;
    utter.lang = ACCENT_LOCALE[accent] || 'en-US';
    utter.rate = Math.min(2, Math.max(0.35, rate));
    utter.pitch = Math.min(2, Math.max(0, pitch));
    if (onBoundary) utter.onboundary = onBoundary;

    this.current = utter;

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        clearInterval(keepAlive);
        if (this.current === utter) this.current = null;
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;

      // Chrome pauses long utterances after ~15s unless nudged.
      const keepAlive = setInterval(() => {
        if (!this.synth.speaking) { finish(); return; }
        this.synth.pause();
        this.synth.resume();
      }, 9000);

      // Hard stop so a dropped 'end' event can never wedge the UI.
      const estimate = 1400 + (String(text).length / Math.max(0.5, utter.rate)) * 130;
      const guard = setTimeout(finish, Math.min(45000, estimate));

      this.synth.speak(utter);
    });
  }

  cancel() {
    if (!this.supported) return;
    this.current = null;
    try { this.synth.cancel(); } catch { /* Safari can throw when idle */ }
  }

  get speaking() {
    return !!this.synth && this.synth.speaking;
  }
}

export const speaker = new Speaker();
export default speaker;
