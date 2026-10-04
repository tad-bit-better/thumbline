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
- [ ] Follow-ups: install Playwright browsers locally (`pnpm exec playwright install`) and add `e2e` to CI once M6 has real flows; add a `LICENSE` file (M8).
- **Done when:** a fresh clone passes `pnpm nx run-many -t lint test build`.

### M1: Engine core (port from prototype)
- [ ] Chord parser and vocabulary (maj, m, 7, m7, maj7, sus2, sus4, dim, add9, 6, slash).
- [ ] Voicing library, movable shapes, beginner substitutions.
- [ ] Capo optimiser; bass and alt-bass selection.
- [ ] Pattern DSL types and runner; Arpeggio and Fingerstyle patterns for all levels.
- **Done when:** unit tests cover parser, voicings, capo, alt-bass; snapshots for 5 progressions × 6 style-levels; ≥ 90% coverage.

### M2: UI kit (`packages/ui`)
- [ ] Tokens (`tokens.css`) and a `Theme` story showing every token.
- [ ] Components: Button (3D press), IconButton, SegmentedControl with sliding pill, Chip, Card, StyleCard, Stepper, ProgressBar (shimmer), Toast, Popover, Dialog.
- [ ] 3D icon set (SVG): Pick, Metronome, Waveform tile, Arpeggio, Fingerstyle, Flamenco, Play sphere, Check badge.
- [ ] Motion primitives: `Reveal` (staggered pop-in), `PressScale`, `Pulse`, `useReducedMotion` wrapper.
- [ ] `LottieMoment` component wrapping dotLottie with a static fallback and reduced-motion handling.
- **Done when:** every component has stories (default, hover, focus, disabled, reduced motion, dark), axe checks pass in Storybook, all interactive targets ≥ 44px.

### M3: Tab renderer
- [ ] Staff with wrapping systems, chord lane, technique lane, six strings, finger lane.
- [ ] Technique symbols: apoyando, rasgueado arrows, golpe, hammer/pull arcs, accents, tremolo.
- [ ] Notes reveal with `Reveal` on style/level change; playhead with glow.
- [ ] Chord diagrams.
- **Done when:** stories for each technique and style-level; 200 bars render in < 50 ms; reveal animation is skipped under reduced motion.

### M4: Playback
- [ ] Nylon Karplus-Strong synth; rasgueado string stagger; golpe noise burst.
- [ ] Lookahead scheduler, loop range, speed 50–100%, tempo change mid-play.
- [ ] Sync with original: sheet, original, both; pitch-preserving slowdown.
- **Done when:** playhead drift vs audio < 20 ms over 3 minutes.

### M5: Audio analysis worker
- [ ] Decode, mono, resample; essentia pipeline; post-processing; progress events; cancel; errors.
- [ ] `nx run audio-analysis:eval` reports per-bar chord accuracy and tempo error on fixtures.
- **Done when:** tempo within ±3 BPM on 90% of clips; 3-minute clip analysed in < 15 s on a mid-range laptop.

### M6: App flow (`apps/web`)
- [ ] Upload screen (drop zone, file picker, sample clip, limits) with Pick drop moment.
- [ ] Listening screen with metronome synced to detected BPM, live step list, progress.
- [ ] Review screen: chord grid, confidence highlighting, alternatives popover, confirm tick, meter toggle.
- [ ] Sheet screen: style cards, level pill, pattern card, chord shapes, tab, sticky player bar.
- [ ] Screen transitions (View Transitions API): drop zone → listening card; chord blocks → sheet.
- [ ] IndexedDB persistence of the current song.
- **Done when:** end-to-end Playwright test with a fixture clip on Chromium, WebKit, Firefox; matches `docs/design/screens.md`.

### M7: Flamenco (rumba, tangos)
- [ ] Phrygian and Andalusian-cadence voicing and capo handling.
- [ ] Flamenco patterns for all levels (rasgueado, alzapúa, picado, golpe, tremolo).
- **Done when:** snapshot tests per level; signed off by a flamenco player.

### M8: Polish and launch
- [ ] Final dotLottie files for the 8 moments replace CSS placeholders.
- [ ] Accessibility pass: keyboard play/stop/loop, tab screen-reader summary, focus order, reduced motion.
- [ ] Performance: first-load JS < 200 KB gzipped; essentia WASM and Lottie files lazy-loaded; LCP < 2 s.
- [ ] Offline (service worker), deploy (Vercel), LICENSE (AGPL-3.0), CONTRIBUTING with "add a pattern" guide.

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
| Chord detection accuracy on full mixes | Review step; eval script; swappable model in v3 |
| Users expect a transcription | Clear copy on Upload and Sheet screens; melody tier in v2 |
| Beat tracker misreads flamenco | v1 limits flamenco to rumba/tangos |
| AGPL from essentia.js | AGPL repo; replacing the detector is the exit path |
| Motion hurts performance or accessibility | Lazy-load Lottie, cap concurrent animations, honour reduced motion everywhere |
| Unplayable output | Hand-span limit and fingering cost; guitarist review before release |
