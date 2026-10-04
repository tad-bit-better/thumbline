# PLAN

## 1. Product

**One line:** Upload a song clip, get a playable right-hand guitar sheet in your style and at your level, and hear it alongside the original.

**Who it's for:** Guitarists who can fret basic chords but don't know what their picking hand should do for a song. Secondary: developer-guitarists who contribute patterns.

**What the sheet is:** an arrangement the engine generates from the song's chords, key and tempo. It is **not** a transcription of the recording. UI copy must set this expectation ("We hear the chords and write a part for you to play").

**Core flow (v1)**
1. **Upload** an audio clip (MP3, WAV, M4A; up to 6 minutes).
2. **Listen**: in-browser analysis of tempo, beats, key and a bar-aligned chord timeline.
3. **Review** detected chords. Low-confidence chords are highlighted; tapping one offers the top 3 alternatives. Not a note editor.
4. **Generate** sheets: **style** (Arpeggio, Fingerstyle, Flamenco) × **level** (Basic, Moderate, Advanced).
5. **Play** with a moving playhead. Modes: sheet, original, both. Loop a bar range; speed 50/75/100% without changing pitch.

**Out of scope for v1:** note/pattern editor, strumming patterns (rasgueado is in scope as flamenco technique), accounts/backend, melody extraction (v2), 12-beat palos (v1.5).

**Principles**
- Audio stays on the device. No upload endpoint exists.
- Output must be playable by a human hand. When in doubt, choose the simpler fingering.
- Patterns are data, not code.
- Playful but clean: motion has a job (feedback, continuity, delight), never decoration for its own sake.
- Works offline after first load.

## 2. Style × level matrix

| | Basic | Moderate | Advanced |
|---|---|---|---|
| **Arpeggio** | p-i-m-a rolls on open shapes | p-i-m-a-m-i, p-a-m-i, bass on each chord change | Moving bass, 4–5 string arpeggios, Giuliani-style figures |
| **Fingerstyle** | Thumb bass and pinch | Travis picking, alternating bass | Syncopated Travis, pinches, hammer-ons, pull-offs |
| **Flamenco** (rumba, tangos) | Basic rasgueado, thumb on accents | Alzapúa, simple picado, golpe | Four-finger rasgueado, tremolo p-a-m-i, picado, full accents |

At least 2 patterns per cell at launch (18+ patterns).

## 3. Architecture

Nx monorepo, pnpm, TypeScript strict.

```
apps/
  web/                 Next.js App Router: Upload → Listen → Review → Sheet
packages/
  engine/              Pure TS: AnalysisResult + style + level → Arrangement
  audio-analysis/      Web Worker: decode, beats, key, chords → AnalysisResult
  tab-renderer/        React: tab staff, finger lane, technique symbols, chord diagrams, playhead
  playback/            Web Audio: nylon synth, scheduler, original-audio sync, loop, speed
  ui/                  Design system: tokens, components, 3D icons, motion primitives, Lottie player
```

**Dependency rules** (enforced with Nx module boundary tags):
- `engine`, `audio-analysis`: depend on nothing in the repo.
- `tab-renderer`, `playback`: depend on `engine` types only.
- `ui`: depends on nothing in the repo (no music logic).
- `tab-renderer` may use `ui` tokens and motion primitives.
- `web`: depends on everything.

**Data flow**
```
File → [audio-analysis worker] → AnalysisResult
     → [Review UI edits chords] → AnalysisResult'
     → [engine] (style, level, capo?) → Arrangement
     → [tab-renderer] draws it ← cursor index ← [playback]
```
Contracts: `docs/engine-spec.md`.

**Front-end stack**
- Next.js App Router, React 19, CSS Modules + `tokens.css` custom properties.
- Fonts via `next/font/google`: Bricolage Grotesque (UI), IBM Plex Mono (tab numbers, data).
- `motion` (Motion for React) for component transitions, layout animations and the level pill.
- View Transitions API for screen-to-screen morphs, with a fade fallback.
- `@lottiefiles/dotlottie-react` for the eight signature animations (`docs/design/motion.md`).
- 3D icons as optimised SVG components in `packages/ui/src/icons3d` (v1), upgradeable to rendered WebP/Lottie.
- Zustand store; current song persisted to IndexedDB with `idb-keyval`.

**Analysis stack (v1):** decode with `decodeAudioData` → mono → 44.1 kHz → `essentia.js` in a Worker (`RhythmExtractor2013`, `KeyExtractor`, HPCP + `ChordsDetectionBeats`) → our post-processing (vocabulary mapping, median smoothing, snap to beats then bars, confidence + top-3 alternatives).

## 4. Roadmap

- **v1:** audio → 3 styles × 3 levels → playback, with the full design system and motion kit (M0–M8).
- **v1.5:** 12-beat flamenco (soleá, bulerías, alegrías), compás accents, accent metronome.
- **v2:** melody-aware Advanced tier (Basic Pitch via TF.js; optional server Demucs). Picado follows the real melody.
- **v3:** stronger chord model (ONNX Runtime Web), guitar samples, PDF/MusicXML export, shareable links (settings + chords only).

## 5. v1 milestones

Every milestone ends with green `lint`, `test`, `build` for affected projects.

### M0: Workspace
- [x] Generate app and packages (README), module boundary tags, lint rules.
- [x] CI: `nx affected -t lint test build` on GitHub Actions.
- [x] Fonts, `tokens.css` and global styles wired into `apps/web`.
- [x] Follow-ups: `e2e` job in CI (Chromium, Firefox, WebKit); `LICENSE` (AGPL-3.0).
- **Done when:** a fresh clone passes `pnpm nx run-many -t lint test build`.

### M1: Engine core (port from prototype)
- [x] Chord parser and vocabulary (maj, m, 7, m7, maj7, sus2, sus4, dim, add9, 6, slash).
- [x] Voicing library, movable shapes, beginner substitutions.
- [x] Capo optimiser; bass and alt-bass selection.
- [x] Pattern DSL types and runner; Arpeggio and Fingerstyle patterns for all levels.
- [ ] Music review of `MUSIC-REVIEW` notes in `packages/engine`: capo cost moves the capo far to avoid one barre (waltz in D → capo 7, C ballad → capo 5 and loses its Am/G bass line); slash-bass spelling ignores the key; five-string arpeggio repeats the D string.
- **Done when:** unit tests cover parser, voicings, capo, alt-bass; snapshots for 5 progressions × 6 style-levels; ≥ 90% coverage.

### M2: UI kit (`packages/ui`)
- [x] Tokens (`tokens.css`) and a `Theme` story showing every token.
- [x] Components: Button (3D press), IconButton, SegmentedControl with sliding pill, Chip, Card, StyleCard, Stepper, ProgressBar (shimmer), Toast, Popover, Dialog.
- [x] 3D icon set (SVG): Pick, Metronome, Waveform tile, Arpeggio, Fingerstyle, Flamenco, Play sphere, Check badge, Upload arrow.
- [x] Motion primitives: `Reveal` (staggered pop-in), `PressScale`, `Pulse`, `useReducedMotion` wrapper.
- [x] `LottieMoment` component wrapping dotLottie with a static fallback and reduced-motion handling.
- **Done when:** every component has stories (default, hover, focus, disabled, reduced motion), axe checks pass in Storybook and unit tests, all interactive targets ≥ 44px. Dark stories come with the v1.1 dark theme (design-system.md).

### M3: Tab renderer
- [x] Staff with wrapping systems, chord lane, technique lane, six strings, finger lane.
- [x] Technique symbols: apoyando, rasgueado arrows, golpe, hammer/pull arcs, accents, tremolo.
- [x] Notes reveal with `Reveal` on style/level change; playhead with glow.
- [x] Chord diagrams.
- [ ] Music review: rasgueado arrows follow the Guitar Pro convention (a down stroke points up the tab, since high e is on top). Confirm with a guitarist before M7.
- **Done when:** stories for each technique and style-level; 200 bars render in < 50 ms; reveal animation is skipped under reduced motion.

### M4: Playback
- [x] Nylon Karplus-Strong synth; rasgueado string stagger; golpe noise burst.
- [x] Lookahead scheduler, loop range, speed 50–100%, tempo change mid-play.
- [x] Sync with original: sheet, original, both; pitch-preserving slowdown.
- **Done when:** playhead drift vs audio < 20 ms over 3 minutes. _(Chromium, 191 s with 0.75× and back: mean lag 8.4 ms, p95 15.8 ms, drift −0.01 ms.)_

### M5: Audio analysis worker
- [x] Decode, mono, resample; essentia pipeline; post-processing; progress events; cancel; errors.
- [x] `nx run audio-analysis:eval` reports per-bar chord accuracy and tempo error on fixtures.
- **Done when:** tempo within ±3 BPM on 90% of clips; 3-minute clip analysed in < 15 s on a mid-range laptop. _(15 synthetic clips: tempo 93%, meter 93%, chords root 89% / major-minor 81% / exact 72%. 3-minute clip in 5.1 s in Chromium on an Apple-silicon Mac; re-time on a mid-range Windows laptop.)_
- [ ] Add ≥ 15 real, licensed clips to `fixtures/audio` (PLAN §7 mix) and re-run the eval: tuning so far is on synthetic audio from our own synth.
- [ ] Known miss: slow 3/4 (66 bpm) solo picking is read at double tempo by every estimator tried.

### M5b: Chords on songs with vocals
Real mixes break chord detection: on a commercial track with vocals, half the chords came out low-confidence and half as sus/7/maj7, flipping every half bar. The voice and piano melody leak into the chroma (Fm with a Bb in the melody reads as Fsus4). Tempo, key and capo were fine. We go in stages, cheapest first, measure each one, and move to the next stage if the gate isn't met.

**Measure first**
- [x] Synthetic lead-vocal songs (5) in the eval: a loud, centre-panned singer with passing notes and suspensions over instruments spread left and right. They reproduce the real failure (major/minor 26% vs 81% on the other synthetic songs) with exact ground truth.
- [ ] Local eval set: ≥ 5 songs with vocals in `fixtures/local/` (git-ignored; songs we own but can't redistribute), each with a hand-labelled `.chords.json`. Baseline = the numbers before stage 1 (run the eval at commit `7ed20bb`).

**Stage 1: signal and music-theory fixes (no new dependencies)**
- [x] Bass chroma (40–180 Hz) favours chords with the bass note in them, the root most (an inversion like G/B still counts).
- [x] Stereo side channel (L − R) blended into the harmony chroma: lead vocals sit in the centre and cancel. Mono, or almost-mono, clips skip it. Meter detection uses the same chroma.
- [x] Key-aware smoothing (Viterbi over half bars): chords in the detected key get a small bonus, a change costs something (twice as much inside a bar), so passing melody notes are outvoted.
- [x] Triads by default: sus, 7, maj7 and dim penalties raised 1.5× (sevenths kept where clearly present).
- _Synthetic results (20 clips):_ lead-vocal songs root 42 → 83%, major/minor 26 → 71%, exact 14 → 54%, chord changes per bar 1.10 → 0.89 (truth 0.94). Other songs major/minor 81 → 84%. Meter 80 → 90%. Stereo 4.4-minute song in 9 s in Node.
- _Real song (Tum Hi Ho, no labels yet):_ chord changes per bar 1.42 → 0.92, median confidence 0.12 → 0.29, low-confidence chords 50 → 21%, sus/7/maj7 51 → 23%; chords now mostly diatonic to F minor. Accuracy unknown until it's labelled.
- **Gate:** on the local set (real songs, not synthetic), major/minor accuracy ≥ 70% and fewer chord changes than bars. No regression on the synthetic set (root 89%, major/minor 81%). If the gate isn't met, go to stage 2.

**Stage 2 (fallback): on-device vocal removal**
- [ ] Source separation (Demucs or Spleeter, MIT) via ONNX Runtime Web; chords from the accompaniment stem. Audio stays on the device.
- Needs decisions first: a new dependency; a 40–150 MB model download (the app fetches it and passes it in, so `audio-analysis` stays network-free); an opt-in "more accurate, slower" mode, since a 4-minute song may take a minute or more.

**Stage 3 (fallback): learned chord model**
- [ ] A chord-recognition model trained on real songs, if one exists with a licence compatible with AGPL (the "swappable model" in the risk table).

**Whatever the stage**
- [ ] Review: fixing a chord offers to fix the same spot in every repeat of that section.
- [ ] Spell chords for the key: Db, not C#, in F minor (the analysis only has pitch classes; naming happens in the engine).
- [ ] One lead-vocal synthetic song (`lead-minor-am`, drums, no keys) still misses the downbeat: meter detection could use the bass too.

### M6: App flow (`apps/web`)
- [x] Upload screen (drop zone, file picker, sample clip, limits) with Pick drop moment.
- [x] Listening screen with metronome synced to detected BPM, live step list, progress. *(Detected BPM and meter shown live; the metronome swing itself follows in M8 with the Lottie file.)*
- [x] Review screen: chord grid, confidence highlighting, alternatives popover, confirm tick, meter toggle.
- [x] Sheet screen: style cards, level pill, pattern card, chord shapes, tab, sticky player bar.
- [x] Screen transitions (View Transitions API): drop zone → listening card; chord blocks → sheet.
- [x] IndexedDB persistence of the current song.
- **Done when:** end-to-end Playwright test with a fixture clip on Chromium, WebKit, Firefox; matches `docs/design/screens.md`. *(Passes on Chromium locally; WebKit and Firefox run in CI.)*

**M6 follow-ups**
- [ ] Metronome swings at the detected BPM on the Listening screen (with the M8 Lottie).
- [ ] Listening → Review view transition (only drop zone → listening and chord grid → tab exist).
- [ ] Loop a bar range by drag-selecting bars on the sheet; today Loop repeats the whole song.
- [ ] Review popover shows ranked alternatives without percentages: `ChordSegment.alternatives` has no scores. Adding them is a contract change in `docs/engine-spec.md`. `DESIGN-REVIEW`
- [ ] Accuracy: the sample clip (G Em C D) reads Em as E7 in some bars; add to the M5 eval set.

### M7: Flamenco (rumba, tangos)
- [ ] Phrygian and Andalusian-cadence voicing and capo handling.
- [ ] Flamenco patterns for all levels (rasgueado, alzapúa, picado, golpe, tremolo).
- **Done when:** snapshot tests per level; signed off by a flamenco player.

### M8: Polish and launch
- [ ] Final dotLottie files for the 8 moments replace CSS placeholders.
- [ ] Accessibility pass: keyboard play/stop/loop, tab screen-reader summary, focus order, reduced motion.
- [ ] Move WSOLA time-stretch into a Web Worker: switching speed on a 3-minute clip blocks the main thread ~80 ms (audio unaffected, playhead hesitates once).
- [ ] Performance: first-load JS < 200 KB gzipped; essentia WASM and Lottie files lazy-loaded; LCP < 2 s.
- [ ] Design review (moved from M2) of `DESIGN-REVIEW` notes in `packages/ui` (popover radius 18px has no token; using `--radius-md`). Loop periods and toast duration live in `motion/springs.ts`; promote to tokens if wanted.
- [ ] Offline (service worker), deploy (Vercel), CONTRIBUTING with "add a pattern" guide.

## 6. Design references
- Visual language: `docs/design/design-system.md`
- Motion: `docs/design/motion.md`
- Screens: `docs/design/screens.md`
- Canvas prototype: `https://claude.ai/artifact/FgGxQWiVMV8cXMyPSh3MES`

## 7. Test audio
- Only self-recorded, CC0/public-domain, or royalty-free clips that allow redistribution.
- `fixtures/audio/` with `LICENSES.md` (source + licence per file) and hand-labelled `*.chords.json` ground truth.
- At least 15 clips: solo nylon, solo steel, voice + guitar, full band, a rumba, a tangos.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Chord detection accuracy on full mixes | Review step; eval script on a local set of songs with vocals; staged fixes in M5b (signal tricks → vocal removal → learned model) |
| Users expect a transcription | Clear copy on Upload and Sheet screens; melody tier in v2 |
| Beat tracker misreads flamenco | v1 limits flamenco to rumba/tangos |
| AGPL from essentia.js | AGPL repo; replacing the detector is the exit path |
| Motion hurts performance or accessibility | Lazy-load Lottie, cap concurrent animations, honour reduced motion everywhere |
| Unplayable output | Hand-span limit and fingering cost; guitarist review before release |
