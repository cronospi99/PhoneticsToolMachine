/**
 * smoke.mjs — drive the real page in a real browser.
 *
 * The engine tests cover the phonetics; this covers everything that can only
 * break in a browser: module loading, WebGL start-up, the render loop actually
 * producing pixels, and the click paths through the UI.
 *
 *   node tests/smoke.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../tools/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8139;
const OUT = process.env.SHOT_DIR || null;

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label} — expected ${expected}, got ${actual}`);
};

const server = createServer(ROOT);
await new Promise((r) => server.listen(PORT, r));

/**
 * Some CI images ship a Chromium that does not match the revision this
 * Playwright build expects. Prefer an explicit binary when one is present
 * (CHROME_PATH, or a chromium-* directory under PLAYWRIGHT_BROWSERS_PATH)
 * rather than downloading a second copy.
 */
function findChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .pop();
  if (!dir) return undefined;
  const bin = path.join(base, dir, 'chrome-linux', 'chrome');
  return fs.existsSync(bin) ? bin : undefined;
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  // blocked web fonts are fine — the app ships a full fallback stack
  if (/fonts\.g|ERR_CONNECTION_RESET|ERR_BLOCKED/.test(m.text())) return;
  consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`uncaught: ${e.message}`));
page.on('requestfailed', (r) => {
  // web fonts are a progressive enhancement; the app must not depend on them
  if (!r.url().includes('fonts.g')) consoleErrors.push(`request failed: ${r.url()}`);
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(2200);

/* ── the page came up ────────────────────────────────────────────────────── */
const boot = await page.evaluate(() => ({
  engine: !!window.PhoneticsToolMachine,
  chips: document.querySelectorAll('.chip').length,
  rows: document.querySelectorAll('.accent-row').length,
  words: document.querySelectorAll('#ipa-uk .ipa-word').length,
  meters: document.querySelectorAll('.meter').length,
  canvas: !!document.querySelector('#stage canvas'),
  fallback: !!document.querySelector('.stage__fallback'),
}));

check('engine is exposed', boot.engine, true);
check('chart renders 44 phonemes', boot.chips, 44);
check('three accent rows render', boot.rows, 3);
check('the sample sentence transcribes', boot.words > 4, true);
check('articulator meters render', boot.meters, 8);
check('WebGL canvas is created', boot.canvas, true);
check('no WebGL fallback was needed', boot.fallback, false);

/* ── the canvas is actually drawing, and animating ───────────────────────── */
const stage = page.locator('#stage');
await page.click('#btn-animate');
await page.waitForTimeout(250);
const frameA = await stage.screenshot();
await page.waitForTimeout(400);
const frameB = await stage.screenshot();

check('the stage renders a substantial image', frameA.length > 5000, true);
check('the scene animates between frames', Buffer.compare(frameA, frameB) !== 0, true);

const during = await page.evaluate(() => ({
  ipa: document.querySelector('.readout__ipa').textContent,
  meterSum: [...document.querySelectorAll('.meter__fill')]
    .reduce((s, m) => s + parseFloat(m.style.width || '0'), 0),
}));
check('a segment is under the playhead while animating', during.ipa !== '—', true);
check('the meters reflect live parameters', during.meterSum > 0, true);
await page.click('#btn-stop');
await page.waitForTimeout(200);

/* ── chart click poses the model ─────────────────────────────────────────── */
await page.click('.chip[data-ipa="s"]');
await page.waitForTimeout(900);   // long enough for the pose to finish AND hold
const afterChip = await page.evaluate(() => ({
  ipa: document.querySelector('.readout__ipa').textContent,
  desc: document.querySelector('.readout__desc').textContent,
  active: document.querySelectorAll('.chip.is-active').length,
}));
check('clicking a chip drives the readout', afterChip.ipa, 's');
check('the readout describes the sound', afterChip.desc, 'voiceless alveolar sibilant');
check('the clicked chip is marked active', afterChip.active, 1);
check('a single phoneme holds its pose instead of snapping back',
  await page.evaluate(() => window.PhoneticsToolMachine.visualizer.holdAtEnd), true);

/* ── a US-only sequence symbol still animates ────────────────────────────── */
await page.selectOption('#accent-select', 'us');
await page.click('.chip[data-ipa="ɪə"]');
await page.waitForTimeout(500);
const seqOk = await page.evaluate(() => document.querySelector('.readout__ipa').textContent !== '—');
check('US /ɪr/ chart entry animates', seqOk, true);
await page.selectOption('#accent-select', 'uk');

/* ── the anatomy actually lines up ───────────────────────────────────────── */
// These are geometric facts about the rig, and the reason it teaches anything:
// a stop must reach closure, a fricative must leave a gap, and an open vowel
// must leave a wide one. They can only be measured with the meshes built.
const anatomy = await page.evaluate(async () => {
  const { resolveParams, articulate } = await import('/js/viz/articulation.js');
  const model = window.PhoneticsToolMachine.visualizer.model;
  const gapOf = (ipa) => {
    const art = articulate(ipa);
    // the defining frame, i.e. the closure of a plosive rather than its release
    const frame = art.frames.reduce((b, f) => (f.hold > b.hold ? f : b), art.frames[0]);
    model.apply(resolveParams(frame.params), { kind: art.kind });
    return model.tongue.closestApproach().gap;
  };
  return {
    t: gapOf('t'), k: gapOf('k'), s: gapOf('s'),
    i: gapOf('iː'), a: gapOf('ɑː'),
    pLips: (model.apply(resolveParams(articulate('p').frames[0].params)),
            model.params.lipOpen),
  };
});

check('/t/ closes against the alveolar ridge', anatomy.t < 0.06, true);
check('/k/ closes against the soft palate', anatomy.k < 0.10, true);
check('/s/ leaves a fricative gap, not a closure', anatomy.s > anatomy.t + 0.15, true);
check('a close vowel is narrower than an open one', anatomy.i < anatomy.a, true);
check('an open vowel leaves the tract wide', anatomy.a > 1.0, true);
check('/p/ seals the lips', anatomy.pLips, 0);

/* ── the built-in voice actually makes the right sound ───────────────────── */
// The point of the built-in engine is that it works with no OS voices AND that
// the accents genuinely differ. Both are claims about audio, so they are
// checked by rendering offline and measuring the spectrum, not by trusting the
// code path. A crude DFT over the steady middle of the buffer is enough to
// locate a formant peak within a band.
const voice = await page.evaluate(async () => {
  const { voiceEngine } = await import('/js/audio/voiceEngine.js');
  const { transcribe, phonemeStream } = window.PhoneticsToolMachine;

  const peakIn = (buf, lo, hi) => {
    const d = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const from = Math.floor(d.length * 0.35);
    const to = Math.floor(d.length * 0.65);
    let best = 0;
    let bestF = 0;
    for (let f = lo; f <= hi; f += 12) {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * f) / sr;
      for (let i = 0; i < to - from; i += 2) {
        const sample = d[from + i];
        re += sample * Math.cos(w * i);
        im += sample * Math.sin(w * i);
      }
      const mag = Math.hypot(re, im);
      if (mag > best) { best = mag; bestF = f; }
    }
    return bestF;
  };
  const rms = (buf) => {
    const d = buf.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < d.length; i += 1) sum += d[i] * d[i];
    return Math.sqrt(sum / d.length);
  };

  const out = { f2: {}, rms: {} };
  for (const ipa of ['i\u02D0', 'u\u02D0', '\u0251\u02D0']) {
    const buf = await voiceEngine.render([{ ipa }], { rate: 0.6 });
    out.f2[ipa] = peakIn(buf, 900, 2600);
    out.rms[ipa] = rms(buf);
  }
  // Rhoticity is a property of the /r/ itself: a low third formant. Measuring
  // it across a whole word means averaging over the /k/ burst, which is made
  // of random noise and moves the peak around between runs.
  out.f3 = {};
  for (const ipa of ['r', '\u025D', '\u0251\u02D0', 'i\u02D0']) {
    const buf = await voiceEngine.render([{ ipa }], { rate: 0.6 });
    out.f3[ipa] = peakIn(buf, 1400, 3000);
  }
  const car = transcribe('car');
  for (const accent of ['us', 'uk', 'au']) {
    const buf = await voiceEngine.render(phonemeStream(car, accent), { rate: 1 });
    out.rms[accent] = rms(buf);
  }
  const sentence = await voiceEngine.render(
    phonemeStream(transcribe('the amazing spider'), 'uk'), { rate: 1 },
  );
  out.sentenceRms = rms(sentence);
  out.sentenceSeconds = sentence.duration;
  return out;
});

check('the built-in voice produces audible sound', voice.rms['i\u02D0'] > 0.01, true);
check('a whole sentence renders with sound', voice.sentenceRms > 0.01, true);
check('a sentence takes a plausible time to say',
  voice.sentenceSeconds > 1 && voice.sentenceSeconds < 8, true);
// F2 is the front/back dimension: /i/ front, /u/ back, /\u0251/ furthest back
check('/i\u02D0/ is rendered as a front vowel', voice.f2['i\u02D0'] > 1800, true);
check('/u\u02D0/ is rendered further back than /i\u02D0/',
  voice.f2['u\u02D0'] < voice.f2['i\u02D0'] - 500, true);
check('/\u0251\u02D0/ is rendered as a back vowel', voice.f2['\u0251\u02D0'] < 1200, true);
// A rhotic collapses F3 down toward F2; that dip is what makes an /r/ audible
// as an /r/, and it is the difference the US transcription of "car" carries.
check('/r/ renders with a rhotic (low) F3', voice.f3.r < 1950, true);
check('/\u025D/ renders with a rhotic F3', voice.f3['\u025D'] < 1950, true);
// Only compared against a vowel whose own F2 sits inside the search band.
// /ɑː/ has F2 down at ~950 Hz, so a peak search over 1400-3000 Hz finds the
// skirt of that resonance rather than F3, and says nothing about rhoticity.
check('a non-rhotic vowel peaks higher than a rhotic one',
  voice.f3['i\u02D0'] > voice.f3.r + 300, true);
check('a non-rhotic vowel peaks higher than /\u025D/',
  voice.f3['i\u02D0'] > voice.f3['\u025D'] + 300, true);
check('all three accents of "car" render sound',
  Math.min(voice.rms.us, voice.rms.uk, voice.rms.au) > 0.01, true);

/* ── the face is actually a face ─────────────────────────────────────────── */
const faceParts = await page.evaluate(() => {
  const m = window.PhoneticsToolMachine.visualizer.model;
  const named = (n) => !!m.group.getObjectByName(n);
  const pose = () => {
    const out = [];
    m.eyes.traverse((o) => out.push(o.rotation.x.toFixed(4), o.rotation.y.toFixed(4)));
    return out.join(',');
  };
  const before = pose();
  // run a few seconds of idle time and see whether anything moved
  for (let i = 0; i < 200; i += 1) m.tick(0.05);
  const after = pose();
  return {
    head: named('head'),
    ears: named('ears'),
    eyes: named('eyes'),
    hair: named('hair-cap'),
    headTriangles: m.head.geometry.index.count / 3,
    blinked: before !== after,
  };
});
check('the head is built', faceParts.head, true);
check('the head has ears', faceParts.ears, true);
check('the head has eyes', faceParts.eyes, true);
check('the head has hair', faceParts.hair, true);
check('the head is more than a blocked-out shape', faceParts.headTriangles > 8000, true);
check('the eyes blink and drift on their own', faceParts.blinked, true);

// The face must be able to get out of the way — that is the whole app.
for (const expected of ['X-ray', 'Skin off', 'Skin on']) {
  await page.click('#btn-skin');
  await page.waitForTimeout(200);
  check(`the skin toggle reaches "${expected}"`,
    (await page.textContent('#btn-skin')).trim(), expected);
}

/* ── the voice selector is wired up ──────────────────────────────────────── */
await page.selectOption('#voice-select', 'builtin');
await page.waitForTimeout(250);
check('choosing the built-in voice is reported',
  /built-in/i.test(await page.textContent('#status-text')), true);

/* ── typing re-transcribes ───────────────────────────────────────────────── */
await page.fill('#text-input', 'zorblatt fizzled');
await page.waitForTimeout(400);
const typed = await page.evaluate(() => ({
  text: document.querySelector('#ipa-uk').textContent.trim(),
  estimated: document.querySelectorAll('#ipa-uk .is-estimated').length,
  status: document.querySelector('#status-text').textContent,
}));
check('typed text is transcribed', typed.text.length > 3, true);
check('out-of-dictionary words are flagged', typed.estimated, 2);
check('the status line reports estimates', /estimated/.test(typed.status), true);

/* ── view controls and skin toggle do not throw ──────────────────────────── */
for (const view of ['face', 'quarter', 'profile', 'sagittal']) {
  await page.click(`[data-view="${view}"]`);
  await page.waitForTimeout(180);
}
for (let i = 0; i < 3; i += 1) {
  await page.click('#btn-skin');
  await page.waitForTimeout(150);
}
await page.click('#btn-stop');
await page.waitForTimeout(300);

if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator('#stage').screenshot({ path: path.join(OUT, 'stage.png') });
  await page.screenshot({ path: path.join(OUT, 'full.png'), fullPage: true });
}

await browser.close();
server.close();

if (consoleErrors.length) failures.push(`console errors:\n    ${consoleErrors.join('\n    ')}`);

if (failures.length) {
  console.error(`\n✗ smoke test: ${failures.length} problem(s)\n`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}
console.log('✓ browser smoke test passed');
