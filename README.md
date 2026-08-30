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
npm run build:head # regenerate the glTF head assets
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

**3D visualiser.** A full human head — skull, eyes that blink and drift, brows,
nose, ears, hair — with the vocal tract inside it, all procedural geometry
posed from a declarative phoneme→parameter map. Clicking a chart symbol holds
the defining posture — for a plosive that is the closure, not the release — so
it can be studied.

**Voice.** The app ships its own speech synthesiser, so the accents work on a
machine with no en-GB or en-AU voices installed — which is most Windows
machines. See below.

---

## Architecture

```
assets/          head-male.glb · head-female.glb   (built, not hand-made)
tools/           build-head.mjs · serve.mjs
js/
  phonetics/     symbols · lexicon · g2p · accents · transcriber
  viz/           articulation · mouthModel · visualizer · orbit
    anatomy/     tongue · lips · teeth · oralCavity
                 head · eyes · hair · faceAsset
  audio/         tts · formants · voiceEngine · phonemeAudio
  ui/            transcriptView · chartView · readout
  core/          eventBus · dom
vendor/three/    three.module.min.js · jsm/ (GLTFLoader, GLTFExporter, …)
```

The layering is deliberate: **phonetics knows nothing about rendering, and the
3D code knows nothing about English.** They meet at exactly one place — the
articulator parameter set in `viz/articulation.js`.

### The head

The head ships as a **glTF binary asset** — `assets/head-male.glb` and
`assets/head-female.glb`, about 1.8 MB and 72–78k triangles each — built by
`tools/build-head.mjs` and loaded at runtime with `GLTFLoader`. Baking it buys a
much finer mesh than is sensible to sculpt during a page load, and it puts a
real asset boundary in the right place: **drop a scanned or hand-sculpted head
in over those files and it just works**, provided it keeps this frame —

> +y up, +z out through the face, the teeth at y = 0, the lip plane near
> z = 4.2, and meshes named `head`, `ears`, `neck` and `hair`.

If the asset cannot be fetched, the same geometry is sculpted in-process
instead, so the app degrades to a working face rather than a missing one.

The geometry itself is a deformed ellipsoid: every vertex starts on a sphere,
is scaled into a head-shaped ellipsoid, then pushed around by a stack of
anatomical fields — brow ridge, eye sockets, nose, cheekbones, philtrum, chin,
jaw taper. Triangles falling inside the mouth and eye openings are dropped,
leaving real apertures, so opening the jaw reveals the teeth and tongue through
the mouth exactly as it would on a real face.

**Male and female** are the same fields with different multipliers. The
differences that actually read are the brow ridge — far heavier in the male
skull — the jaw, square and wide versus tapered to a narrower chin, and the
relative fullness of the lips and cheekbones. Overall head *size* is
deliberately untouched: the oral cavity inside is fixed by the phonetics, so
scaling the skull would pull the face off the teeth it wraps. Switching gender
also switches the built-in voice, raising f0 from 118 Hz to 205 Hz **and**
shortening the vocal tract by 16%, which shifts every formant up — the raised
pitch alone just sounds like the same speaker straining.

Its proportions are dictated by the anatomy already inside it, not by taste.
The tongue spans 6.6 units, which is about 8 cm of real tongue, so one unit is
~1.2 cm and a 23 cm head has to be very nearly 20 units tall:

```
crown ────────── y = +16.3
hairline ─────── y = +12.4  ┐
brow ─────────── y =  +7.1  ├ three equal thirds
nose base ────── y =  +1.7  ┘
mouth ────────── y =  -0.05   (fixed: the teeth sit at y = 0)
chin ─────────── y =  -3.6
```

An earlier attempt at a smaller, better-looking head put the chin at the same
height as the floor of the mouth, and the tongue hung out through the jaw.

### Layers, and the complete airway

**Skin** (on → X-ray → off) and **Organs** (on/off) are independent switches,
because the questions are independent: *what does a face doing this look like*
and *what is the tongue doing*. A single control forced a choice between them.

The organs are the whole airway, not just the mouth: hard palate, soft palate
and uvula, both dental arches, the tongue, the pharyngeal wall, the nasal
cavity above the palate — which is where the air goes when the velum lowers for
/m/, /n/ and /ŋ/ — and below, the epiglottis, larynx and trachea. Only the
tongue, jaw, lips, velum and vocal folds move; the rest is there because a
mouth floating in a head reads as a diagram of nothing.

### Rendering

Three.js with image-based lighting (`PMREMGenerator` over `RoomEnvironment`),
ACES filmic tone mapping, physically based skin with a little sheen, and soft
shadow maps. Skin colour is per-vertex, baked into the asset.

One trap worth recording: Three treats vertex colours as **linear** working
space, so skin values written as though they were sRGB render far paler and
greyer than intended — 0.63 green displays as 0.82. The face was a grey mask
until those were converted properly.

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
- /r/ and /ɝ/ carry a rhotic (low) F3, which plain vowels do not

An earlier version of that last check measured F3 across the whole word "car".
It passed, then failed, then passed: the /k/ burst is built from random noise,
and averaging over it moved the peak between runs. Rhoticity is a property of
the /r/, so that is what is measured now.

The face and anatomy are checked too — that the glTF asset loads and carries
over 40k triangles, that the head has ears, neck, hair and eyes, that the eyes
blink and drift on their own, that the airway includes larynx, trachea,
epiglottis, nasal cavity and uvula, that skin and organs can each be shown
without the other, and that switching gender swaps both the head asset and the
voice.

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
- **The head is generated, not scanned.** It is delivered as glTF, but the
  geometry behind that file is computed from a few dozen anatomical fields with
  no texture maps, normal maps or scan data. It reads clearly as a human head
  and its proportions are anatomically derived, but it is stylised: soft
  featured, and the eyes in particular are the weakest part. That is the
  ceiling of procedural geometry, not something more parameters will fix.
  For a photoreal head, replace the two `.glb` files with a scanned model in
  the coordinate frame described above — the loader does not care where the
  mesh came from.
- **The vocal tract is a teaching diagram, not a medical one.** Its proportions
  are chosen for legibility.

## Credits

Chart layout and example words follow the familiar 44-phoneme wall chart for
Standard British English. [Three.js](https://threejs.org) is MIT licensed and
vendored under `vendor/three/`.
