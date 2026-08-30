/**
 * main.js — wiring.
 *
 * Owns no logic of its own beyond orchestration: it builds the views, holds
 * the small amount of app state (text, accent, rate), and connects the event
 * bus to the phonetic engine, the speech layer and the 3D visualiser.
 */

import { $, el } from './core/dom.js';
import bus from './core/eventBus.js';
import { transcribe, lineFor, phonemeStream, transcribeWord } from './phonetics/transcriber.js';
import { ACCENTS } from './phonetics/accents.js';
import { CHART_INDEX } from './phonetics/symbols.js';
import speaker from './audio/tts.js';
import voiceEngine from './audio/voiceEngine.js';
import { playPhoneme, unlockAudio } from './audio/phonemeAudio.js';
import { TranscriptView } from './ui/transcriptView.js';
import { ChartView } from './ui/chartView.js';
import { Readout } from './ui/readout.js';
import { Visualizer, webglAvailable } from './viz/visualizer.js';

const SAMPLES = [
  'With great power comes great responsibility.',
  'The thoughtful zebra measured the vision of a thousand voices.',
  'She sells sea shells; the shells she sells are surely seashells.',
  'A tourist asked the singer about the strange yellow bird.',
  'Judge the picture, watch the chips, and hear the treasure.',
  'How now brown cow — the loud crowd found the mountain.',
];

const state = {
  text: '',
  accent: 'uk',
  rate: 1,
  result: null,
  skinMode: 'face',
  /** 'auto' | 'builtin' | 'system' — which synthesiser speaks. */
  voice: 'auto',
};

/** Filled in once the browser reports its voice list. */
let voiceAvailability = {};

/**
 * Should this accent be spoken by the built-in engine?
 *
 * In 'auto', yes whenever the system has no genuine voice for that accent —
 * which on a stock Windows install is usually en-GB and en-AU. Falling back to
 * a US voice reading a UK transcription would be actively misleading.
 */
function useBuiltIn(accent) {
  if (state.voice === 'builtin') return true;
  if (state.voice === 'system') return false;
  const info = voiceAvailability[accent];
  return !(info && info.exact);
}

/* ── boot ────────────────────────────────────────────────────────────────── */

const ui = {
  input: $('#text-input'),
  status: $('#status'),
  statusText: $('#status-text'),
  accentSelect: $('#accent-select'),
  rate: $('#rate'),
  voiceSelect: $('#voice-select'),
  rateOut: $('#rate-out'),
  stage: $('#stage'),
};

const transcript = new TranscriptView($('#transcript'));
const chart = new ChartView($('#chart'));
const readout = new Readout($('#meters'));
$('#readout-slot').appendChild(readout.overlay);

let visualizer = null;

function setStatus(message, tone = 'ok') {
  ui.statusText.textContent = message;
  ui.status.dataset.tone = tone;
}

/* ── accent selector ─────────────────────────────────────────────────────── */

for (const a of ACCENTS) {
  ui.accentSelect.appendChild(el('option', { value: a.id, text: `${a.flag} ${a.name}` }));
}
ui.accentSelect.value = state.accent;
ui.accentSelect.addEventListener('change', () => {
  state.accent = ui.accentSelect.value;
  transcript.setActiveAccent(state.accent);
  reportVoices();
});

const VOICE_MODES = [
  ['auto', 'Auto — best available'],
  ['builtin', 'Built-in voice (always works)'],
  ['system', "System voice (your device's)"],
];
for (const [value, label] of VOICE_MODES) {
  ui.voiceSelect.appendChild(el('option', { value, text: label }));
}
ui.voiceSelect.value = state.voice;
ui.voiceSelect.addEventListener('change', () => {
  state.voice = ui.voiceSelect.value;
  speaker.cancel();
  voiceEngine.stop();
  reportVoices();
});

ui.rate.addEventListener('input', () => {
  state.rate = Number(ui.rate.value);
  ui.rateOut.textContent = `${state.rate.toFixed(1)}×`;
});

/* ── transcription ───────────────────────────────────────────────────────── */

let debounce = null;

function render() {
  state.result = transcribe(state.text);
  transcript.render(state.result);
  transcript.setActiveAccent(state.accent);

  if (!state.result.wordCount) {
    setStatus('Ready.');
    return;
  }
  const est = state.result.estimatedCount;
  setStatus(
    est
      ? `${state.result.wordCount} words · ${est} estimated from spelling rules`
      : `${state.result.wordCount} words · all from the dictionary`,
    est ? 'warn' : 'ok',
  );
}

ui.input.addEventListener('input', () => {
  state.text = ui.input.value;
  clearTimeout(debounce);
  debounce = setTimeout(render, 140);
});

/* ── speech ──────────────────────────────────────────────────────────────── */

/**
 * Speak the current text, and drive the mouth from the same phoneme stream.
 *
 * Both the audio and the animation are timed by buildPoseTrack at the same
 * rate, so with the built-in voice the model and the sound stay in step for
 * free — the mouth is literally showing what is being synthesised.
 */
async function speakLine(accent = state.accent) {
  if (!state.text.trim() || !state.result || !state.result.wordCount) return;
  unlockAudio();

  const builtIn = useBuiltIn(accent);
  const stream = phonemeStream(state.result, accent);
  transcript.setActiveAccent(accent);

  if (!builtIn && !speaker.supported) {
    setStatus('No system speech here — switching to the built-in voice.', 'warn');
    state.voice = 'builtin';
    ui.voiceSelect.value = 'builtin';
    return speakLine(accent);
  }

  if (visualizer && stream.length) visualizer.play(stream, state.rate);

  if (builtIn) {
    setStatus(`Speaking with the built-in voice (${accent.toUpperCase()})…`);
    await voiceEngine.speak(stream, { rate: state.rate });
  } else {
    const name = voiceAvailability[accent]?.name;
    setStatus(`Speaking (${accent.toUpperCase()}${name ? ` · ${name}` : ''})…`);
    await speaker.speak(state.text, { accent, rate: state.rate });
  }
  setStatus('Ready.');
}

/** Animate the mouth alone, with no audio. */
function animateLine(accent = state.accent) {
  if (!state.result || !state.result.wordCount || !visualizer) return;
  const stream = phonemeStream(state.result, accent);
  if (!stream.length) return;
  transcript.setActiveAccent(accent);
  visualizer.play(stream, state.rate);
  setStatus(`Articulating ${stream.length} segments (${accent.toUpperCase()})…`);
}

/* ── bus wiring ──────────────────────────────────────────────────────────── */

bus.on('speak:line', ({ accent }) => speakLine(accent));
bus.on('animate:line', ({ accent }) => animateLine(accent));

bus.on('word:selected', async ({ wordIndex, accent }) => {
  const tok = state.result?.tokens[wordIndex];
  if (!tok || tok.kind !== 'word') return;
  unlockAudio();
  transcript.setActiveAccent(accent);
  transcript.markWordSpeaking(accent, wordIndex);

  const stream = tok.accents[accent].phonemes.map((p) => ({ ipa: p.ipa }));
  if (visualizer) visualizer.play(stream, state.rate);

  if (useBuiltIn(accent)) {
    await voiceEngine.speak(stream, { rate: state.rate * 0.85 });
  } else {
    await speaker.speak(tok.spelling, { accent, rate: state.rate * 0.9 });
  }
  transcript.clearHighlight();
});

bus.on('phoneme:selected', async ({ ipa, entry }) => {
  unlockAudio();
  chart.setActive(ipa);

  // The chart is written in RP; map to the selected accent where they differ.
  const symbol = state.accent === 'us' && entry ? entry.us : ipa;
  if (visualizer) visualizer.showPhoneme(symbol);

  const played = await playPhoneme(symbol, {
    accent: state.accent,
    rate: state.rate,
    prefer: useBuiltIn(state.accent) ? 'builtin' : 'word',
  });
  setStatus(
    played.via === 'word'
      ? `/${ipa}/ as in “${played.word}”`
      : `/${ipa}/ — the sound on its own, from the built-in voice`,
  );
});

/* ── buttons ─────────────────────────────────────────────────────────────── */

$('#btn-speak').addEventListener('click', () => speakLine());
$('#btn-animate').addEventListener('click', () => animateLine(state.accent));
$('#btn-stop').addEventListener('click', () => {
  speaker.cancel();
  voiceEngine.stop();
  visualizer?.stop();
  transcript.clearHighlight();
  chart.clearActive();
  setStatus('Stopped.');
});
$('#btn-sample').addEventListener('click', () => {
  const next = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  ui.input.value = next;
  state.text = next;
  render();
});

for (const btn of document.querySelectorAll('[data-view]')) {
  btn.addEventListener('click', () => visualizer?.setView(btn.dataset.view));
}

const SKIN_MODES = [
  ['face', 'Skin on', 'The full head — you see inside through the open mouth'],
  ['glass', 'X-ray', 'Translucent skin, so the articulators show through'],
  ['hidden', 'Skin off', 'Just the anatomy, with the face removed'],
];
const skinBtn = $('#btn-skin');
skinBtn.addEventListener('click', () => {
  const i = SKIN_MODES.findIndex(([id]) => id === state.skinMode);
  const [id, label, hint] = SKIN_MODES[(i + 1) % SKIN_MODES.length];
  state.skinMode = id;
  skinBtn.textContent = label;
  skinBtn.title = hint;
  skinBtn.setAttribute('aria-pressed', String(id !== 'face'));
  visualizer?.setSkinMode(id);
});

/* ── 3D stage ────────────────────────────────────────────────────────────── */

function startVisualizer() {
  if (!webglAvailable()) {
    ui.stage.appendChild(el('div', { class: 'stage__fallback' }, [
      el('p', {
        html: '<strong>WebGL is unavailable in this browser.</strong><br>'
          + 'Transcription, the chart and audio all still work — '
          + 'only the 3D mouth needs WebGL.',
      }),
    ]));
    return;
  }
  try {
    visualizer = new Visualizer(ui.stage);
    visualizer.on('segment', (seg) => {
      readout.show(seg);
      if (seg) chart.setActive(seg.ipa);
    });
    visualizer.on('ended', (info) => {
      transcript.clearHighlight();
      // a held pose stays on screen — leave the chip lit and the readout filled
      if (info && info.held) return;
      chart.clearActive();
      setStatus('Ready.');
    });
  } catch (err) {
    console.error('[visualizer] failed to start', err);
    ui.stage.appendChild(el('div', { class: 'stage__fallback' }, [
      el('p', { text: 'The 3D model could not start on this device. Everything else still works.' }),
    ]));
  }
}

/* ── voice availability ──────────────────────────────────────────────────── */

/**
 * Work out what this device can actually voice, and say so plainly.
 *
 * The honest message matters here: a stock Windows install typically has one
 * en-US voice and nothing for en-GB or en-AU, and silently reading a UK
 * transcription in an American accent would teach the wrong thing.
 */
async function reportVoices() {
  if (speaker.supported) {
    await speaker.ready;
    voiceAvailability = speaker.availability();
  } else {
    voiceAvailability = {};
  }

  const exact = ACCENTS.filter((a) => voiceAvailability[a.id]?.exact).map((a) => a.label);
  const missing = ACCENTS.filter((a) => !voiceAvailability[a.id]?.exact).map((a) => a.label);

  if (state.voice === 'builtin') {
    setStatus('Built-in voice: all three accents available, no system voices needed.');
    return;
  }
  if (state.voice === 'system' && missing.length) {
    setStatus(
      `System voices cover ${exact.length ? exact.join(', ') : 'none'} — `
      + `${missing.join(', ')} will fall back to the nearest voice.`,
      'warn',
    );
    return;
  }
  if (!missing.length) {
    setStatus('System voices found for US, UK and AU.');
    return;
  }
  setStatus(
    `No system voice for ${missing.join(', ')} — the built-in voice will speak `
    + `${missing.length === ACCENTS.length ? 'all accents' : 'those'}.`,
  );
}

/* ── go ──────────────────────────────────────────────────────────────────── */

function init() {
  state.text = SAMPLES[0];
  ui.input.value = state.text;
  ui.rateOut.textContent = '1.0×';
  render();
  startVisualizer();
  visualizer?.setSkinMode(state.skinMode);
  reportVoices();

  // expose the engine for teaching, debugging and automated tests
  window.PhoneticsToolMachine = {
    transcribe, transcribeWord, lineFor, phonemeStream, CHART_INDEX, state,
    voiceEngine,
    get visualizer() { return visualizer; },
    get speaker() { return speaker; },
  };
}

init();
