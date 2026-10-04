# Thumbline

Upload a song clip and get a playable right-hand guitar part in your style and at your level, then hear it alongside the original.

Thumbline listens for the chords, key and tempo and writes an arrangement for you to play: Arpeggio, Fingerstyle or Flamenco, at Basic, Moderate or Advanced level. It is not a transcription of the recording.

Analysis runs entirely in your browser. Audio never leaves your device.

> **Status:** early development (milestone M0, workspace setup). See [PLAN.md](PLAN.md).

## Getting started

Requires Node 24+ and pnpm (version pinned in `package.json` → `packageManager`; `corepack enable` picks it up).

```bash
pnpm install
pnpm nx dev web            # app at http://localhost:3000
```

## Common tasks

```bash
pnpm nx test <project>                  # unit tests (Vitest)
pnpm nx lint <project>
pnpm nx run-many -t lint test build     # everything
pnpm nx affected -t lint test build     # what CI runs
pnpm nx storybook ui                    # UI kit
pnpm nx storybook tab-renderer
pnpm nx e2e web-e2e                     # Playwright
pnpm nx graph                           # dependency graph
```

## Layout

| Project | What it does |
|---|---|
| `apps/web` | Next.js app: Upload → Listen → Review → Sheet |
| `packages/engine` | Pure TypeScript: analysis result + style + level → arrangement |
| `packages/audio-analysis` | Web Worker: audio → tempo, beats, key, chords |
| `packages/tab-renderer` | React tab staff, chord diagrams, playhead |
| `packages/playback` | Web Audio synth, scheduler, sync with the original |
| `packages/ui` | Design tokens, components, 3D icons, motion primitives |

Dependency rules between these are enforced by lint (`@nx/enforce-module-boundaries`). See [PLAN.md §3](PLAN.md#3-architecture).

## Docs

- [PLAN.md](PLAN.md): scope, architecture, milestones
- [docs/engine-spec.md](docs/engine-spec.md): data contracts
- [docs/design/](docs/design/): design system, motion, screens
- [AGENTS.md](AGENTS.md): rules for contributors and coding agents

## Licence

AGPL-3.0-or-later (required by essentia.js).
