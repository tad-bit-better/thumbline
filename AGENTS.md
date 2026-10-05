# AGENTS.md

Instructions for any AI coding agent in this repository. Read `PLAN.md` (scope, current milestone), `docs/engine-spec.md` (contracts) and, for UI work, `docs/design/*` before changing code.

## Project in one paragraph
Thumbline turns an uploaded song clip into right-hand guitar sheets (Arpeggio, Fingerstyle, Flamenco × Basic, Moderate, Advanced) and plays them back in sync with the original. Analysis runs in a browser Web Worker; there is no backend. Sheets are arrangements generated from the detected chords and tempo, not transcriptions. `docs/prototype/thumbline.html` is the reference implementation for engine, renderer and synth.

## Layout
```
apps/web                Next.js App Router UI
packages/engine         Pure TS: AnalysisResult → Arrangement
packages/audio-analysis Web Worker: audio → AnalysisResult (essentia.js)
packages/tab-renderer   React tab staff, chord diagrams, playhead
packages/playback       Web Audio synth, scheduler, audio sync
packages/ui             Tokens, components, 3D icons, motion primitives, Lottie
docs/                   Specs, design docs, prototype
fixtures/               Licensed test audio + ground truth
```

## Commands
```bash
pnpm install
pnpm nx dev web
pnpm nx test <project>
pnpm nx lint <project>
pnpm nx affected -t lint test build
pnpm nx storybook ui
pnpm nx storybook tab-renderer
pnpm nx run audio-analysis:eval
```
Run `lint` and `test` for every project you touch before calling a task done.

## Hard rules
1. **No audio leaves the device.** No upload endpoints, no audio in analytics, no third-party calls with audio.
2. **`engine` is pure**: no DOM, Web Audio, `window` or React.
3. **Respect module boundaries** (PLAN.md §3). Import other packages only through their `index.ts`.
4. **Contracts live in `docs/engine-spec.md`.** Changing `AnalysisResult`, `PatternDef` or `Arrangement` means updating the spec in the same change.
5. **Patterns are data** in `packages/engine/src/patterns/*.ts`. No special cases in the runner.
6. **Never commit copyrighted audio.** Every fixture needs a `fixtures/audio/LICENSES.md` entry.
7. **No new runtime dependency** without a stated reason and an AGPL-compatible licence.
8. **Stay in scope**: no note editor, strumming style or accounts in v1 (slow strums, rolls and brushes are in as fingerstyle techniques, 2026-10-06, PLAN.md M11). Melody extraction moved into v1 (2026-10-05, PLAN.md M9) using essentia's melody tracker, still on the device.
9. **Never hardcode colours, radii, shadows, durations or easings** in components. Use tokens from `packages/ui/src/styles/tokens.css`.
10. **Every animation respects reduced motion** via `useReducedMotion` or the `prefers-reduced-motion` media query.

## Code conventions
- TypeScript `strict`, no `any`. `type` over `interface` for data. Named exports only.
- Music vocabulary from the spec: string 0 = low E; frets relative to capo; `pc` 0–11 with C = 0; 480 ticks per beat.
- Tests beside code (`foo.spec.ts`), Vitest. Review snapshot diffs; never blindly update.
- Conventional Commits (`feat(ui): add SegmentedControl`).

## UI conventions
- Components live in `packages/ui`; `apps/web` composes them. No one-off styled buttons in the app.
- CSS Modules + tokens. Class names describe purpose (`.playhead`, not `.purpleLine`).
- Motion: use `motion/react` for component state transitions and layout; CSS keyframes for simple loops; dotLottie only for the eight named moments in `docs/design/motion.md`.
- Animate `transform` and `opacity` only (exception: the progress bar width). Cap stagger lists at 60 animated items; beyond that, reveal by system/row.
- 3D icons come from `packages/ui/src/icons3d`; don't inline new gradient icons elsewhere.
- Accessibility is part of done: real `<button>`/`<a>`, visible focus ring, labels on icon-only buttons, 44px targets, 4.5:1 text contrast.
- Copy: sentence case, plain words, no exclamation marks except the "first full play" moment.

## Working style
- Before a multi-file change, list the files you'll touch.
- One milestone task per change. Out-of-scope findings go into `PLAN.md` under the right milestone.
- Port behaviour and tests from the prototype, not its single-file structure.
- Uncertain musical choice → simpler, more playable option plus a `// MUSIC-REVIEW:` comment.
- Uncertain design choice → follow `docs/design/*`; if it isn't covered, add a `// DESIGN-REVIEW:` comment.
