# Phonetics Tool Machine

An interactive phonetics teaching tool. Type any English text and see it
transcribed into IPA for **General American**, **Received Pronunciation** and
**General Australian**; hear it in each accent; click any of the 44 phonemes on
the chart; and watch a real-time 3D anatomical model of the mouth articulate
every segment — lips, teeth, tongue, velum and vocal folds.

Vanilla JavaScript (ES modules), CSS3 and Three.js. No build step, no
framework, no runtime dependencies beyond a vendored copy of Three.

```bash
npm start          # http://localhost:8137
npm test           # engine assertions + a headless browser smoke test
```

A static server is required — ES modules will not load over `file://`.

---

## What it does

**Phonetic engine.** A 614-entry lexicon of General American pronunciations
covers the high-frequency vocabulary and the words whose spelling lies about
their sound. Anything else falls through to a context-sensitive
grapheme-to-phoneme rule engine, and is marked in the UI as estimated rather
than silently presented as fact.

**Accents.** UK and AU are *derived* from the American base rather than stored
separately, so there is one place to fix when a mapping is wrong. The
transforms implement the differences that actually matter:

| | US | UK | AU |
|---|---|---|---|
| `car` | `kɑr` | `kɑː` | `kɐː` |
| `bath` | `bæθ` | `bɑːθ` | `bɐːθ` |
| `dance` | `dæns` | `dɑːns` | `dæns` |
| `dog` | `dɔg` | `dɒg` | `dɔg` |
| `water` | `ˈwɔɾɚ` | `ˈwɔːtə` | `ˈwoːtə` |
| `new` | `nu` | `njuː` | `njʉː` |
| `coat` | `koʊt` | `kəʊt` | `kəʉt` |
| `house` | `haʊs` | `haʊs` | `hæɔs` |

That covers rhoticity, the BATH and CLOTH splits, LOT unrounding, PALM,
yod-dropping, American t-flapping, RP happY-tensing, and the Australian vowel
shifts.

**3D visualiser.** Procedural geometry, posed from a declarative
phoneme→parameter map. Clicking a chart symbol holds the defining posture —
for a plosive that is the closure, not the release — so it can be studied.

**Voice.** The app ships its own speech synthesiser, so the accents work on a
machine with no en-GB or en-AU voices installed — which is most Windows
machines. See below.

---

## Architecture

```
js/
  phonetics/     symbols · lexicon · g2p · accents · transcriber
  viz/           articulation · mouthModel · visualizer · orbit
    anatomy/     tongue · lips · teeth · oralCavity · faceShell
  audio/         tts · phonemeAudio
  ui/            transcriptView · chartView · readout
  core/          eventBus · dom
```

The layering is deliberate: **phonetics knows nothing about rendering, and the
3D code knows nothing about English.** They meet at exactly one place — the
articulator parameter set in `viz/articulation.js`.

### The built-in voice

The Web Speech API can only use voices the operating system already has. A
stock Windows install typically has one en-US voice and nothing for en-GB or
en-AU, so every accent button sounds American — which defeats the whole point
of the tool.

So `audio/voiceEngine.js` is a formant synthesiser: a source-filter model, the
classic account of how speech works.

```
glottal pulse train ─┐
                     ├─→ 3 parallel formant resonators ─→ output
shaped noise ────────┘   (or straight out, for frication)
```

It has no accent-specific code at all. Formant targets are derived from the
same articulator parameters that pose the 3D model — tongue height sets F1,
fronting and lip rounding set F2, rhotic bunching collapses F3 — so the
accents differ purely because the IPA differs. `kɑː` and `kɐː` have different
tongue positions, therefore different frequencies, therefore different sounds.

It also means the mouth and the audio are driven by one timeline: both are
timed by `buildPoseTrack`, so the model is literally showing what is being
synthesised.

It sounds synthetic — this is 1980s technology, not a neural vocoder — but it
is phonetically accurate, always available, and adds nothing to the download.
The **Voice** selector chooses between it and the system voices; on *Auto* the
built-in engine takes over for exactly the accents the device cannot voice.

### The parameter contract

Every phoneme resolves to keyframes of normalised articulator parameters:

```js
jaw  lipOpen  lipRound  lipSpread  lipProtrude  lipTuck
tongueBodyHigh  tongueBodyFront  tongueTipHigh  tongueTipFront  tongueRoot
groove  lateral  velum  voice  teeth
```

Heights mean *closeness to the roof of the mouth*, not absolute coordinates.
This is the idea the model is built around: "tongue body height = 1" means
contact wherever the body happens to be — the soft palate for /k/, the much
higher palatal vault for /iː/. The tongue is regenerated each frame from a
midline spline rather than blended between baked morph targets, which is what
lets `groove` cut a sibilant channel down the blade for /s/ while the sides
stay in contact, and `lateral` drop the sides for /l/.

Adding a phoneme — or another language — means adding a row to that table.
No mesh code changes.

---

## Testing

`tests/engine.test.mjs` runs in Node with no browser: tokenizer, spelling
rules, stress heuristics, accent transforms, articulation model.

`tests/smoke.mjs` drives the real page in headless Chromium: module loading,
WebGL start-up, the render loop producing pixels that change between frames,
the click paths, and geometric invariants that only exist once the meshes are
built —

- /t/ closes against the alveolar ridge, /k/ against the soft palate
- /s/ leaves a fricative gap rather than a closure
- a close vowel narrows the tract more than an open one
- /p/ seals the lips

The voice is tested the same way — by measuring the sound rather than trusting
the code path. Utterances are rendered through an `OfflineAudioContext` and a
DFT locates the formant peaks:

- /iː/ comes out as a front vowel (F2 > 1800 Hz), /ɑː/ as a back one (< 1200)
- US "car" is audibly rhotic — F3 below 1600 Hz — while UK and AU are not

---

## Honest limitations

- **Transcriptions are broad**, and describe prestige varieties. They are not a
  claim that everyone in a country speaks this way.
- **Out-of-dictionary words are estimated** by rule. English spelling is only
  about 75% regular, so these are approximations — the UI underlines them in
  red and says so in the status line.
- **Heteronyms** (`read`, `live`, `minute`, `lead`) get their most frequent
  reading only; telling them apart needs part-of-speech tagging.
- **Connected-speech effects** — assimilation, elision, RP linking /r/ across
  word boundaries — are not modelled. Each word is transcribed in isolation.
- **The built-in voice sounds like a speech synthesiser**, because it is one.
  It is accurate about vowel quality, rhoticity and voicing; it is not
  pleasant. For natural-sounding speech, install the system voices (on Windows:
  Settings → Time & language → Speech → Manage voices) and the app will pick
  them up on reload.
- **The 3D model is a teaching diagram, not a medical one.** Proportions are
  chosen for legibility.

## Credits

Chart layout and example words follow the familiar 44-phoneme wall chart for
Standard British English. [Three.js](https://threejs.org) is MIT licensed and
vendored under `vendor/three/`.
