# PLAN

## 1. Product

**One line:** Upload a song clip, get a playable right-hand guitar sheet in your style and at your level, and hear it alongside the original.

**Who it's for:** Guitarists who can fret basic chords but don't know what their picking hand should do for a song. Secondary: developer-guitarists who contribute patterns.

**What the sheet is:** an arrangement the engine generates from the song's chords, key and tempo. It is **not** a transcription of the recording. UI copy must set this expectation ("We hear the chords and write a part for you to play").

**Core flow (v1)**
1. **Upload** an audio clip (MP3, WAV, M4A; up to 8 minutes).
2. **Listen**: in-browser analysis of tempo, beats, key and a bar-aligned chord timeline.
3. **Review** detected chords. Low-confidence chords are highlighted; tapping one offers the top 3 alternatives. Not a note editor.
4. **Generate** sheets: **style** (Arpeggio, Fingerstyle, Flamenco) × **level** (Basic, Moderate, Advanced).
5. **Play** with a moving playhead. Modes: sheet, original, both. Loop a bar range; speed 50/75/100% without changing pitch.

**Out of scope for v1:** note/pattern editor, a strumming *style* (rasgueado is in scope as flamenco technique; slow strums, rolls and brushes are in as fingerstyle techniques since 2026-10-06, M11), accounts/backend, 12-beat palos (v1.5). _(Melody extraction moved into v1 on 2026-10-05: see M9.)_

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
- [x] Metronome swings at the detected BPM on the Listening screen (with the M8 Lottie).
- [ ] Listening → Review view transition (only drop zone → listening and chord grid → tab exist).
- [ ] Loop a bar range by drag-selecting bars on the sheet; today Loop repeats the whole song.
- [x] Seeking: click the tab to play from there; back/forward a bar and a position slider in the player bar; ←/→ work playing or paused; Pause resumes where it stopped (it used to restart from bar 1). A play that jumped ahead doesn't count as the first full play.
- [x] Player bar sticks to the bottom of the screen (it never did: its wrapper was exactly its size).
- [ ] Compact player bar for phones. It wraps to ~270px there, so it stays at the end of the page below 560px. `DESIGN-REVIEW`
- [ ] Review popover shows ranked alternatives without percentages: `ChordSegment.alternatives` has no scores. Adding them is a contract change in `docs/engine-spec.md`. `DESIGN-REVIEW`
- [ ] Accuracy: the sample clip (G Em C D) reads Em as E7 in some bars; add to the M5 eval set.

### M6b: Fuller sheets
Sheets sound thin next to the recording: on a 70 bpm ballad (Hotel California) every pattern averages about 1.8 notes audibly ringing at once, and arpeggios never strike two notes together. Measured cause, biggest first: patterns pick one note at a time over the same 3 treble strings (each re-strike cuts the last note); slow tempos expose the gaps; the synth is dry. Longer synth decay alone only lifts it to about 2.3. Order agreed: B, then A, then C1.

**B: a warmer sound (playback)**
- [x] Longer sustain, treble strings most: t60 4.5 s (low E) → 2.2 s (top), and t60 now holds for the fundamental (the Karplus-Strong averaging filter's own loss is divided out). E5 one second after the pluck: −49 dB before, −25 dB now.
- [x] Soft room reverb on the sheet only (ConvolverNode, generated 1.8 s impulse, 22% send after the mix gain; no dependency, no network).
- [x] Strings spread across the stereo field (low E 25% left, high E 25% right).
- Synthetic eval fixtures use this synth: regenerating them (`--force`) changes their audio, so re-run the eval baseline when you do.

**A: fuller patterns (engine data)**
- [x] Pinches: bass and a treble note together on strong beats. New default `fingerstyle.moderate.travis-pinch` (a treble note on every thumb stroke).
- [x] Rolls across more strings, so notes ring into each other instead of re-striking the same three. New defaults `arpeggio.basic.let-ring` (each string once per half bar) and `arpeggio.moderate.pinch-roll` (pinch, then four strings). Old patterns stay under "Try another pattern".
- _Notes ringing at once on the Hotel California verse (70 bpm), before B → after B + A:_ Arpeggio Basic 1.8 → 2.7, Arpeggio Moderate 1.8 → 3.0, Fingerstyle Moderate 1.8 → 4.0.
- [ ] Slow songs get denser patterns (sixteenth fills). Choosing patterns by tempo needs a field on `PatternDef` (a contract change): waiting for a decision.

**C1: a top line that moves**
- [x] Moderate and Advanced: top-string notes alternate between a chord tone and a neighbour (next chord tone, or a key note 2–3 semitones away), each chord starting near where the line was (voice leading). Always within reach of the shape; Basic unchanged. Spec: `docs/engine-spec.md` §2 "Moving top line". Not the song's melody.

**Feedback (2026-10-04):** B + A + C1 sound "a bit better"; the output needs another pass later. Candidates: tempo-aware patterns, a richer synth body, the real melody.

**Later (v2):** the real melody on top (melody extraction), which is what makes it a lead part. Out of v1 scope (AGENTS.md rule 8).

### M7: Flamenco (rumba, tangos)
- [x] Phrygian and Andalusian-cadence voicing and capo handling: the Phrygian home chord (a major chord with one a semitone above, else a minor key's dominant) goes on the E shape, or the A shape past capo 7. Bm–A–G–F# plays Am–G–F–E shapes at capo 2.
- [x] Flamenco patterns for all levels (rasgueado, alzapúa, picado, golpe, tremolo), by palo: Rumba (strum with golpe; eighths with golpe; four-finger rasgueado) and Tangos (strum; alzapúa; picado run), plus tremolo at Advanced for both. Golpe and the scale walker (picado) in the runner. App: Flamenco card with the palo as its sub-label, a Rumba/Tangos control, 4/4 only ("Needs 4/4" otherwise).
- **Done when:** snapshot tests per level; signed off by a flamenco player. _(Snapshots per palo and level are in `flamenco.spec.ts`. Sign-off still needed: every pattern carries a `MUSIC-REVIEW` note, as does the barre F at Moderate/Advanced, where flamenco players often play 1-3-3-2-0-0.)_
- [ ] Flamenco player sign-off of the patterns, accents and levels.
- [ ] Flamenco in 3/4 (soleá, bulerías, alegrías): the palos are in the type; no patterns yet.

### M7b: Techniques that make the levels sound different
User feedback (2026-10-05): Basic, Moderate and Advanced "all sound the same"; no hammer-ons, slides, slaps or tone changes can be heard. Causes: levels only change note density; hammer-ons exist only in two Advanced patterns, are usually dropped by the runner (they need the previous note on that string to be lower), and the synth plays them as a quieter ordinary pluck.
- [x] **T1 Audible techniques (contract):** `Technique` gains `palm-mute`, `slap` and `apagado` (both pitchless, like golpe), and `harmonic` (natural, fret 12 or 7, whichever sounds a chord tone; dropped when a fretted note sounds with it). The synth gives each its own sound: legato swells in with no pluck, palm-muted notes die in ~0.2 s, a bell-like harmonic, a slap thud with a bright snap, and apagado stops every ringing string. Hammer-ons and pull-offs survive far more often: when the earlier note sits on the same fret, the runner starts/ends at the barre or open string, or hammers an open chord tone up two frets to a scale note. Tab marks: `PM`, chips `S` and `×`, `<12>`.
- [x] **T2 Level ladder:** Basic: plain plucks. Moderate: Travis gets a palm-muted thumb on the off-beat bass and a hammer-on each bar; Pinch-and-roll ends each bar on a hammer-on. Advanced: "Percussive Travis" (slaps on 2 and 4, hammer-on, pull-off, a harmonic on the bar's last eighth), the five-string arpeggio gets a pull-off and a hammer-on, the four-finger rasgueado rumba chokes beat 2 with an apagado. Snapshots reviewed and updated. _(MUSIC-REVIEW: the bar-end harmonic needs the fretting hand to lift; check it at faster tempos.)_
- [x] **T3 Flamenco vocabulary:** new targets `campanella`, `drone`, `pedal` (contract). New patterns: Moderate — three-finger rasgueado (a-m-i, rumba), pulgar (thumb melody with rest strokes, tangos), pedal and drone (both palos); Advanced — five-stroke and continuous rasgueado (rumba), abanico and campanella (tangos). Apagado chokes strums in the advanced rumba, pulgar and abanico. Already in: golpe, picado, alzapúa, apoyando, tremolo, arpeggios, ligados, e-a-m-i (the four-finger rasgueado), cejilla (capo), compás (meter accents per palo). The Andalusian cadence is a chord progression, not a right-hand technique: we follow the song's chords and voice the cadence on the E shape (M7). Fixed on the way: the moving top line made flamenco tremolo alternate two notes; it now skips flamenco. _(All first drafts with MUSIC-REVIEW notes, pending the flamenco player sign-off.)_
- [x] **R Review shows where you are in the song:** each block shows its time (0:24); a play button plays that bar from the original clip; repeated chord runs get section letters (A, B, A…) so the verse and chorus stand out.

### M9: The song's melody on top (chord-melody)
User feedback (2026-10-05): the chords are in sync, but with the original muted "I can't make out what song it is", in every style and level. Chords say which notes fit; the melody says which song it is. Decision: bring melody extraction into v1 (was v2), spike first, melody at every level.
- [x] **Spike:** `tools/melody-spike/melody-spike.mjs` runs essentia's `PredominantPitchMelodia` + `PitchContourSegmentation` (already shipped, no new dependency) on the fixtures and renders the melody with the app's synth to `fixtures/local/melody-spike/` (melody alone; melody over the original). First run: ~2.9 notes/s, voice found in ~66% of frames, ~81% of notes in the detected key; analysis 25 s for 4.4 min (60 s for 7.6 min) in Node.
- [x] **Gate (user listens):** with the original muted, the melody file is recognisable as the song. _(2026-10-05: "identifiable, but very robotic and jittery". Spike v2 adds cleanup — blips dropped, octave slips fixed, split notes merged, short out-of-key notes snapped, onsets on the 16th grid, notes held to the next — and legato/accents/room in the render: 2.1 notes/s, 97–100% in key. Awaiting a listen.)_ If not: tune the tracker (voicing tolerance, min note length, side-signal input as in M5b), then consider Basic Pitch (TF.js, new dependency, needs approval).
- [x] **Contract:** `AnalysisResult.melody` (notes: time, duration, MIDI, confidence), cleaned in the worker (`audio-analysis/src/melody.ts`); `NoteEvent.melody` marks the tune; `ArrangeOptions.melody` (default on). Quantised by the engine to 16ths through the beat grid; octave-shifted so its middle sits on strings 2–5.
- [x] **Engine:** `engine/src/melody.ts` — placement near the shape's hand position (the shape's own note preferred, then higher strings, then small moves); the pattern makes room (no note on the tune's string or within 2 semitones under it while it sounds; fretted pattern notes the hand can't hold with the tune go, open strings and the bass stay). Basic: one tune note per beat; Moderate/Advanced: every 16th, with hammer-ons/pull-offs on 1–2 fret steps. The invented top line (M6b) only runs when there's no tune. _(Flamenco picado/tremolo following the tune: later.)_
- [x] **App:** Listen shows "Following the tune"; songs read before M9 get an "Add the tune" card on the Sheet (listen again; chord edits are cleared). Tab draws the tune bold on an orange chip, with a legend entry. Playback lifts the tune (×1.3), adds vibrato to held tune notes and a guitar-body EQ to the sheet.
- [ ] **Performance:** melody step under ~10 s for a 4-minute clip in the browser (hop 256 now; next: only voiced sections), else run it after the first sheet shows. _(Measured 2026-10-05: the whole analysis of the 4.4-min Tum Hi Ho takes 27 s in Chromium on this Mac, melody and mood included.)_
- [ ] **Wrong notes:** the tracker still grabs instruments between phrases and misses some notes (user: "some err moments"). Next: drop low-confidence notes, feed it the stereo centre (vocals) instead of the mix, and prefer chord tones on strong beats.
- [ ] **Brittle, disjointed notes (2026-10-05 feedback: "we can identify the song; the notes still sound brittle and disjointed"):** each note is a fresh, separate pluck that is cut when the next one on its string starts. Next: let melody notes ring into each other (overlap and crossfade instead of a hard damp), slides and legato between close notes, longer and warmer sustain on the melody voice, and a softer, more varied attack (velocity from the singer's loudness, round-robin excitations so repeats don't sound identical).
  _Measured against 6 reference recordings (`tools/melody-spike/reference-probe.mjs`, fixtures/audio, git-ignored): real fingerstyle covers sit at 1100–1500 Hz spectral centroid, ours at 2500–2800 Hz (twice as bright: the main "brittle" cause); players sit 15–23 ms off the grid, ours ±6 ms (machine-like); attack spread 3.3–6.2 dB vs ours 3.0–3.5; notes fade 5–8 dB before the next one, ours 7–9. Targets in that order: a darker, rounder pluck and body (centroid ≈ 1500 Hz); human timing ≈ 15 ms with phrase push and pull; touch variation ≈ 4–5 dB; notes ringing into each other (≈ 6 dB)._ _Round 1 (2026-10-05): pitch-scaled finger excitation and a loop low-pass (single notes 900–1400 Hz, all within 1 cent), humanising (±9 ms jitter, ±7 ms phrase push, ±22% touch, heavier on the beat), 30 ms string hand-over. Mix centroid 2.6–2.8 kHz → 1.9–2.1 kHz; still above the 1.1–1.5 kHz references (several strings at once, the tune placed high). The probe's onset timing is too coarse to show the humanising; judge by ear._ _User (2026-10-05): "too plucky, monotonous, all notes the same weight". Round 2: dynamics in the engine (the tune leads and phrases, thumb ×0.82, inner ×0.66, metric accents), a velocity curve, the treble cut no longer hits the tune, and touch-dependent plucks (soft: 9 ms rise, darker; hard: 1.5 ms, brighter). Attack spread 3.2 → 4.4 dB and song dynamics 9.5 → 11.8 dB, both inside the references' range; brightness 1.8–1.9 kHz, still above 1.1–1.5. User: "much more pleasing". Next: the last of the brightness (the mix, not single notes)._ _Round 3: the brightness was the app's room reverb (nearly white noise, 74% of its energy above 4 kHz), not the guitar: without it the mix already measured 1.17 kHz. The room now darkens like a real one (a note's brightness); the renders use the app's own impulse. Tum Hi Ho mix ≈ 1.0 kHz. User: "this is good"._
- [ ] **Groove:** loudness that follows the song (needs per-beat energy in `AnalysisResult`, contract) and a human timing push, as in the spike renders.

### M10: Mood and sections (the vibe)
User feedback (2026-10-05): "the vibe of all the songs remains the same"; a sad song gets the same groove and cadence as a happy one. Patterns were chosen by style and level only. Decision: all four of mood → pattern, mood → touch, sections build and breathe, mood shown and editable.
- [x] **Probe:** `tools/melody-spike/mood-probe.mjs` — essentia's OnsetRate, Danceability, DynamicComplexity and spectral centroid on the fixtures. Tum Hi Ho: F minor, 94 bpm, 2.8 onsets/s, danceability 1.00, 1664 Hz; Hotel California (cover): B minor, 70 bpm, 3.1 onsets/s, 1.06, 2075 Hz. Both dark and calm. _(Need an upbeat major-key fixture to calibrate.)_
- [x] **Contract + analysis:** `AnalysisResult.mood = { energy, valence }` (0..1: calm→driving, dark→bright) from tempo, onset rate, danceability, brightness, mode and the share of major chords; `AnalysisResult.beatEnergy` (loudness per beat, 0..1). Mood labels: melancholic (calm, dark), warm (calm, bright), intense (driving, dark), upbeat (driving, bright).
- [x] **Mood picks the pattern:** `PatternDef.moods`; the level's patterns are ordered mood-first. New calm patterns where a style lacks one (a fingerstyle ballad at Moderate and Advanced: let-ring rolls, legato, no slaps or palm mutes).
- [x] **Mood shapes the touch:** `Arrangement.mood`; engine: note lengths (ring vs short), velocity curve and accents; playback: tone (darker/brighter), room, strum speed.
- [x] **Sections build and breathe:** bar loudness from `beatEnergy`, smoothed over phrases, into soft / normal / full; soft bars thin the pattern to the beat and play softer, full bars get the whole pattern and accents. The tune always stays.
- [x] **App:** Review shows the mood next to tempo and meter (Sad · Warm · Intense · Happy) and lets you change it; the sheet re-arranges.
- [x] **Feel on the Sheet (2026-10-05 feedback):** the mood shows on the Sheet too, with presets (Sad · Warm · Intense · Happy) and two sliders, Energy (calm → driving) and Colour (dark → bright). The touch and playback feel follow the slider values continuously; the quadrant still picks the pattern. Review's presets set the same values. (`ArrangeOptions.mood` takes a label or values; `Arrangement.feel`; contract.)
- [x] **Follow the playhead without fighting the reader (2026-10-05 feedback):** the sheet follows the playhead until the user scrolls (wheel, touch, keys, scrollbar); then following pauses and a "Back to the playhead" pill (arrow up/down) appears above the player bar: one tap on a phone, or the F key. Following comes back on that tap, on any seek (tab click, back/forward, play), or when the user scrolls the playhead back into view and stops for a moment. No timed auto-return: it would pull the user away from the style cards. _(Checked in Chromium on Tum Hi Ho, 101 bars: follows; scroll to the top → pill, page stays put for 6 s while playing; tap → back in view. A row behind the sticky player bar counts as out of view.)_ DESIGN-REVIEW: with the Feel card in the controls row, the Level control sits low on the left with space above it.
- [ ] **Calibrate** the mood weights on an upbeat major-key song (and a few more of each kind); check the sections on songs with a quiet verse and a big chorus. _(2026-10-05, six references: 5 of 6 read right — My Heart Will Go On and Nothing Else Matters sad, blue happy, Lean On intense, Closer warm. Hotel California (Igor Presnyakov, in A minor) read as C major → "warm": the key finder confuses relative major and minor, and the major key is 55% of valence. Fix: decide minor vs major from the chords too (the tonic chord's quality), and weigh the key less.)_ _Done (refineMode): the chords pick between a key and its relative (home chord by duration, first and last chord ×2, 1.2× margin). My Heart Will Go On now reads C# major (warm, likely right: the song is in a major key). Hotel California still reads C major: its chords come out as C 58 beats, Am 50, Em7 42… — the E7 that pulls the song home to Am is heard as Em7 (no G#), so neither home wins. That is a chord-quality problem (M5b: telling E7 from Em7 on solo guitar), not a mood one._ _Then: a major key's chord bonus now also accepts the relative minor's leading note (G# in C), so E7 → Am isn't pushed to Em7. Eval: overall unchanged (root 88%, major/minor 81%, exact 71%), with vocals 71→72% / 54→55%. Hotel California: E7 found (22 beats, was 0), Em7 42→26, but C 58 vs Am 50 and the song's first/last chords read D7/G, so it stays C major / warm. Left for M5b (chord accuracy on solo guitar)._

### M10b: Songs that move (key changes, free time, a player's touch)
User feedback (2026-10-06) on My Heart Will Go On (Sungha Jung): "sounds like a metronome… monotonous… like a retro game MIDI; can't be identified unless told". Measured: not tuning (all six references within 5 cents of A440) and not the capo. Three causes, in order of harm:
- [x] **Key changes:** the cover is in F major, then steps up to F# major at 2:08; one key for the whole song (C# major, which fits neither) bent 100 of the first half's 153 tune notes toward the wrong scale, and the fills/hammer-ons used the wrong scale. Now `AnalysisResult.keys` (contract): sections from the chords (12 scales per bar, switch cost, 8-bar minimum, major vs relative minor per section); the chords are re-chosen with each bar's key; tune cleanup and the engine (scale walker, hammer-ons, drone, pedal, top line) use the key of the moment. My Heart Will Go On: F major → F# major at 128 s, first-half tune notes in F major 102/153 → 153/153. No false changes on the other six references; chord eval unchanged (root 88%, major/minor 81%, exact 71%).
- [x] **Dead notes (2026-10-06 feedback on the Moderate render):** 23% of the notes were palm-muted (the Travis thumb on beats 2 and 4: 0.22 s and dark), a thud twice a bar on a ballad. Calm moods (energy < 0.5) now drop palm mutes; driving songs keep them.
- [x] **Free time:** in three loose, rubato stretches (0:00–0:27, 1:40–2:10, 3:25–3:48) the beat finder locks onto a pulse ~1.5× too fast (≈150 vs ≈107 bpm): the pattern rushes and the bar lines slip afterwards. Beat spacing varies 18% on this song vs 2–6% on the other covers. Done: `foldBeats` re-spaces stretches whose local beat is outside 0.85–1.18× the song's at the song's beat. My Heart Will Go On: beat variation 18% → 4% (the other covers 1–4%); chord eval unchanged. Open: whether truly free stretches should play let-ring chords with the tune instead of a running pattern (judge by ear first).
- [ ] **Play like a player (the "metronome" feel, every song) → moved to M11:** one pattern repeats every bar for the whole song, every note on the 16th grid, and the humanising is only small random wobble. Next: vary the pattern every 4/8 bars, fills and bass walk-ups into chord changes, space (rests) in quiet sections, a small ritardando into phrase ends and section changes.
- [ ] **Sound depth (target: `fixtures/audio/The_Thread_of_Everything.mp3`, AI-generated, user: "we have to reach that level of sound quality ultimately"):** it is not solo guitar: in 63% of frames its lowest note is below the guitar's low E (A#1, F1, G1: a bass instrument and pads), with 19% of its energy under 80 Hz and 21% at 80–250 Hz. Our app-accurate render: 0% and 10–12% (real solo covers 21–41% at 80–250 Hz); we pile into 250–2500 Hz (85%), the boxy "MIDI" range. Found on the way: the offline renders convolved with the raw room impulse while the browser's ConvolverNode normalises it, so every render the user judged had ~31 dB more room than the app (fixed in `melody-full.mjs`; `--raw-room` keeps the old sound for A/B). Next, in order: (1) ~~A/B the room~~ user (2026-10-06): the app's own (drier) room wins on clarity; it stays; (2) body and low end: stronger bass-string fundamentals and body resonance (target 80–250 Hz ≥ 20%); (3) decide whether to go beyond a modelled guitar — sampled nylon guitar (licensed samples, new asset, ask first) and/or an optional backing layer (bass an octave under the thumb, soft pad) that is clearly not part of the sheet.
- [x] **Off-pitch recordings (2026-10-07, user: Gham Chhod Ke (1965) and O Mere Dil Ke Chain (1972) "way too off"):** both sit a third of a semitone flat (−26, −29 cents; old records mastered off speed), so every note fell between two chroma bins: plain chords read as maj7/7 (29 of 102 on O Mere Dil Ke Chain), major and minor swapped, the tune flickered. Now the analysis measures the tuning (`AnalysisResult.tuningCents`, contract) and reads key, chords, bass and tune against it; playback detunes the sheet to match, so Both is in tune. O Mere Dil Ke Chain: a coherent B♭ minor (B♭m, Fm, A♭, E♭m), maj7 29 → 13. Tune notes out of key 26 → 11% (held notes 9 → 3%); Gham Chhod Ke 21 → 14% (3 → 0%). (Essentia's note segmenter ignores its tuning parameter, so the pitch track is rescaled to A440 before it.) Every modern reference reads 0 (Hotel California 6, under the threshold); chord eval unchanged (root 88%, major/minor 81%, exact 71%).
- [ ] **Ornamented singing (same songs), parked:** measured 2026-10-07, slide-in fragments (a note shorter than a 16th running a step into a longer one) are 10–12% of the tune on these songs and as common on songs that read well (Lean On 12%, The Thread of Everything 16%), so merging them isn't justified; the tuning bug was the cause. Revisit only with a song where it is heard.
- [ ] **Busy orchestras:** under weak chord confidence, prefer the plain triad over 7ths and maj7s.
- [x] **Fullness setting (user, 2026-10-07: "fill up the unnecessary silences, and having some harmony… not stuff notes so it sounds fast and robotic"):** `ArrangeOptions.fullness` 1–10 (contract), a slider in Customize saved with the preferences; 5 = as before. Higher fills shorter rests with longer runs, harmonises more of the tune, walks the bass into shorter chords, and Basic catches the tune's eighths from 8; lower thins the pattern under the tune. On real songs (Advanced) notes per second go 6.4 → 7.1 from 5 to 10 (O Mere Dil Ke Chain), fills ×1.6–1.8, harmony ×2–2.5.

### M11: Instrumentals a listener recognises (play like a guitarist)
User direction (2026-10-06): "We don't want to strum strum strum and make vocal the lead and guitar only as a percussion. We want to create instrumentals listeners can listen to and immediately get what the song is; we should harmonise, and use strumming and the other variations guitarists use to fill up and make the listening more pleasing." The tune leads; everything else serves it.
- [x] **Slow strums (rolls and brushes):** techniques `brush-down` / `brush-up` (contract), slower than rasgueado and set by the mood (55 − 30e ms per string). A thumb roll opens each phrase (every 4 bars; 8 when driving) and the last chord rings as a roll, in every style but flamenco. New grooves for happy songs: Moderate "Thumb and brush", Advanced "Pop groove" (brushes on 2 and 4, a flick up after); Intense keeps the percussive Travis patterns. Tab: a wavy roll line with the stroke's arrow; legend entry. Scope note: a strumming *style* stays out of v1 (AGENTS rule 8 updated).
- [x] **Harmonise the tune:** chord tones a third or sixth (else a fourth) under strong-beat and held tune notes, two voices on Advanced downbeats; `NoteEvent.harmony` (contract). My Heart Will Go On: 20% of tune notes harmonised at Moderate, 36% at Advanced (rolls and pinches already under a note count). Next if needed: diatonic thirds that follow the tune between chord tones (parallel thirds), not only chord tones.
- [x] **A bass that moves:** the thumb walks into the next chord through the key's scale (Moderate one passing note on the last beat, Advanced two eighths); `NoteEvent.walk` (contract). Still open: following the song's own bass line where the analysis hears one (bass chroma per beat exists in the worker, not yet in `AnalysisResult`).
- [x] **Fills where the tune rests:** a scale run into the next tune note (Moderate: two eighths; Advanced: eighths then sixteenths with slurs), the thumb's bass kept; `NoteEvent.fill` (contract). ~40–65 runs over a 4-minute song. Next if wanted: more fill shapes (arpeggio climbs, hammer-on licks, a bass walk instead of a treble run).
- [x] **The song's bass (bass-heavy songs, 2026-10-06: Heat Waves, Don't Stop, Lean On):** a long-frame bass reading per beat; a held bass that isn't the root becomes the chord's bass note (Cm/Ab), a minor chord over its major third turns major; the thumb, rolls and walks play it under the plain shape when reachable. Don't Stop: the song's bass fits our chord on 77% → 80% of beats; covers unchanged (92%); chord eval unchanged. User: "much better… I can make out which song is being played, specially Glass Animals". Still open: where one detected chord spans a moving bass (Lean On: G, Eb, F, Bb under "Gm7"), split the chord at the bass changes; and a double-time feel for half-time dance tracks (Don't Stop reads Sad/calm at 80 bpm).
- [x] **Vary by section:** quiet sections play a calm pattern, loud ones the mood's main pattern, long steady stretches switch to a second mood-suited pattern every 8 bars; `Arrangement.patternChanges` (contract). My Heart Will Go On Moderate: Ballad verses, Travis choruses; blue: Ballad intro, brush groove, a Travis variant. Next (app): show the changes on the sheet ("Verse: Ballad · Chorus: Travis"); calm-only levels (Advanced on warm songs) don't vary yet.
- [ ] **Intro and ending:** an intro from the first phrase's chords (harmonics or a roll), a ritardando into the last chord and a final roll.
- [ ] **Breathing time:** a small slow-down into phrase ends and a push into a chorus, in playback (the sheet stays on the grid).

### M12: Reach (search and footfall)
User ask (2026-10-06): "how can we improve the SEO performance of the app and bring in more footfall?" Audit of the live site: title "Thumbline" only, one 160-word page, no robots.txt or sitemap (404), no link previews, app steps indexable; Lighthouse (mobile): SEO 100, accessibility 100, best practices 100, performance 68 (TBT 960 ms, 123 KiB unused JS: the animation player was warmed on idle during load).
- [x] **Technical basics:** keyword title and description (`apps/web/src/lib/site.ts`), canonical, Open Graph and X card with a generated 1200×630 image, `robots.txt` and `sitemap.xml`, noindex on /listen, /review and /sheet (crawlable, so the noindex is seen), WebApplication and FAQPage structured data, a visible Questions section on the home page, a web manifest with install icons (all generated by `tools/make-icons.mjs`), the logo's fret digits drawn as paths (no stray "0 2 5" in the page text), and the animation player warmed on first interaction instead of on idle.
- [ ] **Verify after deploy:** Lighthouse again (target performance ≥ 85), the link preview on WhatsApp / X / Reddit, Google's Rich Results test for the FAQ; submit the sitemap in Google Search Console (the user's account).
- [ ] **Pattern and technique pages (the big lever):** one page per pattern and technique ("Travis picking", "p-i-m-a arpeggio", "flamenco rumba", "hammer-on"…), built from the pattern data: what it is, an interactive tab that plays and slows down, Basic → Advanced, "try it on your own song". No song-specific pages (the tune is copyrighted).
- [ ] **Share a sheet:** export as image or PDF with a small "made with thumbline.app" footer; nothing leaves the device unless the user shares it.
- [ ] **Launch:** Reddit (r/fingerstyle, r/guitarlessons, r/classicalguitar, r/flamenco), Show HN (in-browser analysis, audio never leaves the device), Product Hunt, AlternativeTo next to Chordify and Songsterr, short videos, guitar teachers.
- [ ] **Measure:** Google Search Console (no code); optional cookieless analytics (a new third-party call: the user decides; never audio).

### M13: Sheet screen v2 (use the width)
User mock (2026-10-06): three columns on desktop, bar cards, arrangement summary with Customize, now/next and chord shapes in a right rail, section navigation, display options; phone: section chips, now/next, one bar per row, compact player. Decisions: bar cards; Customize in a side panel; no song library, count-in, bpm stepper or bar-range loops for now; notation unchanged. Spec: docs/design/screens.md §4.
- [x] `packages/ui`: Checkbox, SectionNav (list and chips), Drawer (side panel / bottom sheet), chevron glyphs, with stories and tests; full-width segmented controls size from their track.
- [x] `packages/tab-renderer`: bar-card mode for TabSheet (sections, chord-name mode, tab size S/M/L), NowNext, chord shapes as a list with badges.
- [x] `apps/web`: the new Sheet page (header facts, arrangement bar with pattern stepping, Customize panel, one-line notices, three columns up to 1440px, tablet and phone layouts); display options saved with the song; `useWidth` now observes when its element appears; unit and e2e tests updated (chromium e2e passing locally).
- [x] Sections column dropped (user, 2026-10-06: "it is unnecessarily eating up the space"): headings stay over the bar cards; Display moved into a popover in the arrangement bar; the tab gets a card per row back.
- [ ] Compact player bar for phones (moved from M6).

### M8: Polish and launch
- [x] Final dotLottie files for the 8 moments replace CSS placeholders. _(#1 Pick drop, #3 Metronome (swings at the detected tempo), #4 Chord confirmed, #8 First full play, built by `tools/make-lottie.mjs`, 0.9–2.6 KB each; #2 stays the CSS wave; #5–#7 are in code. Renderer WASM self-hosted, not from a CDN.)_
- [ ] Accessibility pass: keyboard play/stop/loop, tab screen-reader summary, focus order, reduced motion.
- [ ] Move WSOLA time-stretch into a Web Worker: switching speed on a 3-minute clip blocks the main thread ~80 ms (audio unaffected, playhead hesitates once).
- [ ] Performance: first-load JS < 200 KB gzipped; essentia WASM and Lottie files lazy-loaded; LCP < 2 s.
- [ ] Design review (moved from M2) of `DESIGN-REVIEW` notes in `packages/ui` (popover radius 18px has no token; using `--radius-md`). Loop periods and toast duration live in `motion/springs.ts`; promote to tokens if wanted.
- [ ] Offline (service worker), CONTRIBUTING with "add a pattern" guide.
- [ ] Listen screen mascot (user idea, 2026-10-06; parked, no effort for now): one cute 3D-style dog, one scene per step. Finding the beat: digging the ground while notes pop out (dig at the detected tempo, as the metronome swings now). Hearing the chords: ears resting on a guitar, listening hard. Following the tune: chasing notes with hearts popping out. Writing your sheets: writing the sheet. Needs an animator: one character in four short matching loops as `.lottie` files, with commercial rights (LottieFiles, Dribbble or Fiverr, roughly $300–1,500); stock animations won't keep the same dog across scenes; rendered 3D as alpha video is the heavier alternative. Code side: swap the scene by step with a crossfade, the metronome as the fallback until the files land, a still frame under reduced motion, loaded only on Listen; add the four to the named moments in `docs/design/motion.md`.
- [x] Deploy: Vercel, https://thumbline.app (apps/web/vercel.json; pushes to main deploy).

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
