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
  skinMode: 'glass',
};

/* ── boot ────────────────────────────────────────────────────────────────── */

const ui = {
  input: $('#text-input'),
  status: $('#status'),
  statusText: $('#status-text'),
  accentSelect: $('#accent-select'),
  rate: $('#rate'),
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

async function speakLine(accent = state.accent) {
  if (!state.text.trim()) return;
  unlockAudio();
  if (!speaker.supported) {
    setStatus('This browser has no speech synthesis.', 'error');
    return;
  }
  setStatus(`Speaking (${accent.toUpperCase()})…`);
  await speaker.speak(state.text, { accent, rate: state.rate });
  setStatus('Ready.');
}

/** Animate the mouth through a phoneme stream, and speak it alongside. */
function animateLine(accent = state.accent, alsoSpeak = false) {
  if (!state.result || !state.result.wordCount || !visualizer) return;
  const stream = phonemeStream(state.result, accent);
  if (!stream.length) return;
  transcript.setActiveAccent(accent);
  visualizer.play(stream, state.rate);
  setStatus(`Articulating ${stream.length} segments (${accent.toUpperCase()})…`);
  if (alsoSpeak) speaker.speak(state.text, { accent, rate: state.rate });
}

/* ── bus wiring ──────────────────────────────────────────────────────────── */

bus.on('speak:line', ({ accent }) => speakLine(accent));
bus.on('animate:line', ({ accent }) => animateLine(accent, true));

bus.on('word:selected', async ({ wordIndex, accent }) => {
  const tok = state.result?.tokens[wordIndex];
  if (!tok || tok.kind !== 'word') return;
  unlockAudio();
  transcript.setActiveAccent(accent);
  transcript.markWordSpeaking(accent, wordIndex);

  if (visualizer) {
    visualizer.play(tok.accents[accent].phonemes.map((p) => ({ ipa: p.ipa })), state.rate);
  }
  await speaker.speak(tok.spelling, { accent, rate: state.rate * 0.9 });
  transcript.clearHighlight();
});

bus.on('phoneme:selected', async ({ ipa, entry }) => {
  unlockAudio();
  chart.setActive(ipa);

  // The chart is written in RP; map to the selected accent where they differ.
  const symbol = state.accent === 'us' && entry ? entry.us : ipa;
  if (visualizer) visualizer.showPhoneme(symbol);

  const played = await playPhoneme(symbol, { accent: state.accent, rate: state.rate });
  setStatus(
    played.via === 'word'
      ? `/${ipa}/ as in “${played.word}”`
      : `/${ipa}/ — synthesised in isolation`,
  );
});

/* ── buttons ─────────────────────────────────────────────────────────────── */

$('#btn-speak').addEventListener('click', () => speakLine());
$('#btn-animate').addEventListener('click', () => animateLine(state.accent, true));
$('#btn-stop').addEventListener('click', () => {
  speaker.cancel();
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

const skinBtn = $('#btn-skin');
skinBtn.addEventListener('click', () => {
  const order = ['glass', 'solid', 'hidden'];
  state.skinMode = order[(order.indexOf(state.skinMode) + 1) % order.length];
  skinBtn.setAttribute('aria-pressed', String(state.skinMode !== 'glass'));
  skinBtn.textContent = { glass: 'Skin', solid: 'Skin ●', hidden: 'Skin ○' }[state.skinMode];
  visualizer?.setSkinMode(state.skinMode);
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

async function reportVoices() {
  if (!speaker.supported) {
    setStatus('No speech synthesis in this browser — text and the 3D model still work.', 'warn');
    return;
  }
  await speaker.ready;
  const avail = speaker.availability();
  const here = avail[state.accent];
  if (!here.available) {
    setStatus(`No English voice installed for ${state.accent.toUpperCase()}.`, 'warn');
  } else if (!here.exact) {
    setStatus(`No native ${state.accent.toUpperCase()} voice here — using “${here.name}”.`, 'warn');
  }
}

/* ── go ──────────────────────────────────────────────────────────────────── */

function init() {
  state.text = SAMPLES[0];
  ui.input.value = state.text;
  ui.rateOut.textContent = '1.0×';
  render();
  startVisualizer();
  reportVoices();

  // expose the engine for teaching, debugging and automated tests
  window.PhoneticsToolMachine = {
    transcribe, transcribeWord, lineFor, phonemeStream, CHART_INDEX, state,
    get visualizer() { return visualizer; },
    get speaker() { return speaker; },
  };
}

init();
